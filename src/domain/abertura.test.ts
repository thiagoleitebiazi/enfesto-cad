import { describe, it, expect } from 'vitest';
import {
  MODOS_DE_ABERTURA,
  NOME_DO_MODO,
  PRAZO_PADRAO_DA_PAGINA_S,
  SEGUNDOS_DE_UMA_SESSAO_CURTA,
  SESSOES_CURTAS_PARA_PERGUNTAR,
  abertura,
  aoCancelar,
  aoComecar,
  aoFalhar,
  aoFechar,
  aoMostrarATela,
  aoResponderSeAbriuDireito,
  argumentosParaReabrir,
  devePerguntarSeAbriuDireito,
  estadoInicial,
  falhasParaDeixarOModo,
  fotoEstaPreta,
  lerEstado,
  lerLinhaDeComando,
  opcoesDoModo,
  prazosDeAbertura,
  proximoModo,
  type EstadoDaAbertura,
  type ModoDeAbertura,
} from './abertura';

const V = '0.1.0';
const estado = (mudancas: Partial<EstadoDaAbertura> = {}): EstadoDaAbertura => ({ ...estadoInicial(V), ...mudancas });

describe('os modos de abertura', () => {
  it('vão do padrão ao mais compatível, e cada um tem nome para os avisos', () => {
    expect(MODOS_DE_ABERTURA).toEqual(['padrao', 'video-no-principal', 'sem-isolamento', 'com-gpu']);
    expect(Object.keys(NOME_DO_MODO).sort()).toEqual([...MODOS_DE_ABERTURA].sort());
    expect(NOME_DO_MODO['sem-isolamento']).toBe('modo de compatibilidade');
  });

  it('em todos, o motor não deixa de desenhar a janela que ele julga encoberta', () => {
    for (const modo of MODOS_DE_ABERTURA) expect(opcoesDoModo(modo).recursosDesligados).toContain('CalculateNativeWinOcclusion');
  });

  it('o padrão desenha por software, com tudo isolado', () => {
    expect(opcoesDoModo('padrao')).toEqual({ semAceleracao: true, opcoes: [], recursosDesligados: ['CalculateNativeWinOcclusion'] });
  });

  it('o seguinte põe o vídeo no processo principal, sem isolá-lo; a página continua isolada', () => {
    expect(opcoesDoModo('video-no-principal')).toEqual({ semAceleracao: true, opcoes: ['in-process-gpu', 'disable-gpu-sandbox'], recursosDesligados: ['CalculateNativeWinOcclusion'] });
  });

  it('o de compatibilidade não isola nenhum processo do motor', () => {
    expect(opcoesDoModo('sem-isolamento')).toEqual({
      semAceleracao: true,
      opcoes: ['in-process-gpu', 'no-sandbox'],
      recursosDesligados: ['CalculateNativeWinOcclusion', 'RendererCodeIntegrity'],
    });
  });

  it('o último volta a desenhar pela placa de vídeo, ainda sem isolamento', () => {
    expect(opcoesDoModo('com-gpu')).toEqual({ semAceleracao: false, opcoes: ['no-sandbox'], recursosDesligados: ['CalculateNativeWinOcclusion', 'RendererCodeIntegrity'] });
  });
});

describe('o modo seguinte ao que falhou', () => {
  it('pela ordem, quando o defeito é de vídeo ou não se sabe', () => {
    expect(proximoModo('padrao', 'video')).toBe('video-no-principal');
    expect(proximoModo('padrao', 'desconhecida')).toBe('video-no-principal');
    expect(proximoModo('video-no-principal', 'video')).toBe('sem-isolamento');
    expect(proximoModo('video-no-principal', 'pagina')).toBe('sem-isolamento');
    expect(proximoModo('sem-isolamento', 'pagina')).toBe('com-gpu');
  });

  it('do padrão, se foi a página que não carregou, vai direto ao de compatibilidade', () => {
    expect(proximoModo('padrao', 'pagina')).toBe('sem-isolamento');
  });

  it('pula os que já foram tentados, e depois do último não há mais nenhum', () => {
    expect(proximoModo('padrao', 'video', ['video-no-principal'])).toBe('sem-isolamento');
    expect(proximoModo('padrao', 'pagina', ['sem-isolamento'])).toBe('com-gpu');
    expect(proximoModo('padrao', 'video', ['video-no-principal', 'sem-isolamento', 'com-gpu'])).toBeNull();
    expect(proximoModo('com-gpu', 'video')).toBeNull();
  });
});

describe('o estado guardado da abertura', () => {
  it('começa no modo padrão, sem falhas', () => {
    expect(estadoInicial(V)).toEqual({ versao: V, modo: 'padrao', falhas: 0, emCurso: null, fechadasLogo: 0, abreDireito: false });
  });

  it('é lido de volta como foi gravado', () => {
    const gravado = estado({ modo: 'sem-isolamento', falhas: 1, emCurso: 'sem-isolamento', fechadasLogo: 2, abreDireito: true });
    expect(lerEstado(JSON.stringify(gravado), V)).toEqual(gravado);
    expect(lerEstado(JSON.stringify(estado({ modo: 'com-gpu' })), V).modo).toBe('com-gpu');
  });

  it('gravado por outra versão do programa, vale como o inicial: a escada recomeça', () => {
    expect(lerEstado(JSON.stringify(estado({ modo: 'sem-isolamento' })), '0.2.0')).toEqual(estadoInicial('0.2.0'));
  });

  it('o que não dá para ler, ou está estragado, vale como o inicial', () => {
    const estragados = [
      null,
      '',
      '{{{',
      'null',
      '[]',
      '"padrao"',
      JSON.stringify({ ...estado(), modo: 'turbo' }),
      JSON.stringify({ ...estado(), modo: 7 }),
      JSON.stringify({ ...estado(), falhas: -1 }),
      JSON.stringify({ ...estado(), falhas: 1.5 }),
      JSON.stringify({ ...estado(), falhas: '1' }),
      JSON.stringify({ ...estado(), falhas: 1001 }),
      JSON.stringify({ ...estado(), fechadasLogo: -2 }),
      JSON.stringify({ ...estado(), fechadasLogo: 'muitas' }),
    ];
    for (const texto of estragados) expect(lerEstado(texto, V)).toEqual(estadoInicial(V));
  });

  it('os campos que podem faltar têm valor seguro: nenhuma abertura em curso, e a pergunta por fazer', () => {
    const lido = lerEstado(JSON.stringify({ versao: V, modo: 'video-no-principal', falhas: 0, fechadasLogo: 0, emCurso: 'turbo', abreDireito: 'sim' }), V);
    expect(lido).toEqual(estado({ modo: 'video-no-principal' }));
    expect(lerEstado(JSON.stringify({ versao: V, modo: 'padrao', falhas: 1000, fechadasLogo: 1000 }), V)).toEqual(estado({ falhas: 1000, fechadasLogo: 1000 }));
  });
});

describe('ao começar uma abertura', () => {
  it('o modo guardado fica marcado como em curso', () => {
    expect(aoComecar(estado())).toEqual(estado({ emCurso: 'padrao' }));
    expect(aoComecar(estado({ modo: 'sem-isolamento', falhas: 0 }))).toEqual(estado({ modo: 'sem-isolamento', emCurso: 'sem-isolamento' }));
    // As falhas contadas até aqui continuam contadas.
    expect(aoComecar(estado({ falhas: 1 })).falhas).toBe(1);
  });

  it('se a abertura anterior não chegou a mostrar a tela (o programa caiu), o modo dela é deixado de vez', () => {
    expect(aoComecar(estado({ emCurso: 'padrao', falhas: 1 }))).toEqual(estado({ modo: 'video-no-principal', falhas: 0, emCurso: 'video-no-principal' }));
    // Vale o modo que estava em curso, mesmo que não fosse o guardado (uma tentativa só daquela abertura).
    expect(aoComecar(estado({ modo: 'padrao', emCurso: 'sem-isolamento', falhas: 1 }))).toEqual(estado({ modo: 'com-gpu', falhas: 0, emCurso: 'com-gpu' }));
  });

  it('depois do último modo, recomeça do padrão', () => {
    expect(aoComecar(estado({ modo: 'com-gpu', emCurso: 'com-gpu' }))).toEqual(estado({ modo: 'padrao', emCurso: 'padrao' }));
  });
});

describe('quando a tela não aparece', () => {
  it('o padrão tem duas chances; os outros modos, uma', () => {
    expect(MODOS_DE_ABERTURA.map(falhasParaDeixarOModo)).toEqual([2, 1, 1, 1]);
  });

  it('na primeira falha do padrão, tenta outro modo já, mas o guardado continua sendo o padrão', () => {
    const { estado: depois, proximo } = aoFalhar(estado({ emCurso: 'padrao' }), 'padrao', 'pagina');

    expect(proximo).toBe('sem-isolamento');
    expect(depois).toEqual(estado({ falhas: 1 }));
  });

  it('na segunda, o modo guardado passa a ser o seguinte', () => {
    const { estado: depois, proximo } = aoFalhar(estado({ falhas: 1, emCurso: 'padrao' }), 'padrao', 'video');

    expect(proximo).toBe('video-no-principal');
    expect(depois).toEqual(estado({ modo: 'video-no-principal' }));
  });

  it('o modo tentado só nesta abertura, se também falha, não mexe no que está guardado', () => {
    const { estado: depois, proximo } = aoFalhar(estado({ falhas: 1, emCurso: 'video-no-principal' }), 'video-no-principal', 'video', ['padrao']);

    expect(proximo).toBe('sem-isolamento');
    expect(depois).toEqual(estado({ falhas: 1 }));
  });

  it('o modo guardado que não é o padrão é deixado na primeira falha', () => {
    const { estado: depois, proximo } = aoFalhar(estado({ modo: 'video-no-principal', emCurso: 'video-no-principal' }), 'video-no-principal', 'pagina');

    expect(proximo).toBe('sem-isolamento');
    expect(depois).toEqual(estado({ modo: 'sem-isolamento' }));
  });

  it('os já tentados nesta abertura não são tentados de novo', () => {
    expect(aoFalhar(estado({ falhas: 1 }), 'padrao', 'video', ['video-no-principal']).proximo).toBe('sem-isolamento');
    expect(aoFalhar(estado({ falhas: 1 }), 'padrao', 'video', ['video-no-principal']).estado.modo).toBe('sem-isolamento');
  });

  it('acabados os modos, não há próximo, e a escada recomeça do padrão na abertura seguinte', () => {
    const { estado: depois, proximo } = aoFalhar(estado({ modo: 'com-gpu', emCurso: 'com-gpu', fechadasLogo: 1, abreDireito: true }), 'com-gpu', 'video', ['padrao', 'video-no-principal', 'sem-isolamento']);

    expect(proximo).toBeNull();
    expect(depois).toEqual(estado({ abreDireito: true }));
  });
});

describe('quando a tela aparece', () => {
  it('no modo guardado, as falhas dele são esquecidas', () => {
    expect(aoMostrarATela(estado({ falhas: 1, emCurso: 'padrao' }), 'padrao')).toEqual(estado());
  });

  it('num modo tentado só nesta abertura, as falhas do guardado continuam contadas', () => {
    expect(aoMostrarATela(estado({ falhas: 1, emCurso: 'sem-isolamento' }), 'sem-isolamento')).toEqual(estado({ falhas: 1 }));
  });

  it('cancelar a abertura não conta como falha', () => {
    expect(aoCancelar(estado({ falhas: 1, emCurso: 'padrao' }))).toEqual(estado({ falhas: 1 }));
  });
});

describe('a abertura inteira, de um computador a outro', () => {
  /** Abre o programa uma vez: `funciona(modo)` diz se a tela aparece nesse modo; a falha é sempre da `falha` dada. Devolve os modos tentados e o estado guardado. */
  const abrir = (guardado: EstadoDaAbertura, funciona: (modo: ModoDeAbertura) => boolean, falha: 'pagina' | 'video'): { tentados: ModoDeAbertura[]; guardado: EstadoDaAbertura; abriu: boolean } => {
    let { estado: atual, modo } = abertura(guardado, lerLinhaDeComando([]));
    const tentados: ModoDeAbertura[] = [];
    for (;;) {
      if (funciona(modo)) return { tentados: [...tentados, modo], guardado: aoMostrarATela(atual, modo), abriu: true };
      const resultado = aoFalhar(atual, modo, falha, tentados);
      tentados.push(modo);
      if (resultado.proximo === null) return { tentados, guardado: resultado.estado, abriu: false };
      // O programa reabre no modo seguinte, com o estado gravado e a linha de comando da continuação.
      ({ estado: atual, modo } = abertura(resultado.estado, lerLinhaDeComando(argumentosParaReabrir([], resultado.proximo, tentados))));
    }
  };

  it('no computador em que tudo funciona, abre sempre no padrão', () => {
    const primeira = abrir(estadoInicial(V), () => true, 'pagina');

    expect(primeira).toEqual({ tentados: ['padrao'], guardado: estadoInicial(V), abriu: true });
    expect(abrir(primeira.guardado, () => true, 'pagina').tentados).toEqual(['padrao']);
  });

  it('no computador em que só o modo de compatibilidade funciona: abre já na primeira vez, e da terceira em diante vai direto nele', () => {
    const soCompativel = (modo: ModoDeAbertura): boolean => modo === 'sem-isolamento';
    const primeira = abrir(estadoInicial(V), soCompativel, 'pagina');
    const segunda = abrir(primeira.guardado, soCompativel, 'pagina');
    const terceira = abrir(segunda.guardado, soCompativel, 'pagina');

    expect(primeira.tentados).toEqual(['padrao', 'sem-isolamento']);
    expect(primeira.guardado).toEqual(estado({ falhas: 1 }));
    expect(segunda.tentados).toEqual(['padrao', 'sem-isolamento']);
    expect(segunda.guardado).toEqual(estado({ modo: 'sem-isolamento' }));
    expect(terceira.tentados).toEqual(['sem-isolamento']);
    expect([primeira.abriu, segunda.abriu, terceira.abriu]).toEqual([true, true, true]);
  });

  it('no computador lento, em que a primeira abertura só demorou: na segunda volta ao padrão, e as falhas são esquecidas', () => {
    let vezes = 0;
    const lentoNaPrimeira = (modo: ModoDeAbertura): boolean => modo !== 'padrao' || ++vezes > 1;
    const primeira = abrir(estadoInicial(V), lentoNaPrimeira, 'video');
    const segunda = abrir(primeira.guardado, lentoNaPrimeira, 'video');

    expect(primeira.tentados).toEqual(['padrao', 'video-no-principal']);
    expect(segunda.tentados).toEqual(['padrao']);
    expect(segunda.guardado).toEqual(estadoInicial(V));
  });

  it('no computador em que o defeito é de vídeo e só o último modo funciona, passa por todos uma vez e fica nele', () => {
    const soComGpu = (modo: ModoDeAbertura): boolean => modo === 'com-gpu';
    const primeira = abrir(estadoInicial(V), soComGpu, 'video');
    const segunda = abrir(primeira.guardado, soComGpu, 'video');
    const terceira = abrir(segunda.guardado, soComGpu, 'video');

    expect(primeira.tentados).toEqual(['padrao', 'video-no-principal', 'sem-isolamento', 'com-gpu']);
    expect(segunda.tentados).toEqual(['padrao', 'video-no-principal', 'sem-isolamento', 'com-gpu']);
    expect(segunda.guardado.modo).toBe('com-gpu');
    expect(terceira.tentados).toEqual(['com-gpu']);
  });

  it('no computador em que nada funciona, tenta todos, diz que não abriu, e recomeça do padrão na vez seguinte', () => {
    const nada = abrir(estadoInicial(V), () => false, 'pagina');

    expect(nada.tentados).toEqual(['padrao', 'sem-isolamento', 'com-gpu']);
    expect(nada.abriu).toBe(false);
    expect(nada.guardado).toEqual(estadoInicial(V));
  });
});

describe('a pergunta de se a janela abriu direito', () => {
  it('fechado logo depois de abrir, conta; fechado depois de um tempo de uso, a conta zera', () => {
    expect(aoFechar(estado(), SEGUNDOS_DE_UMA_SESSAO_CURTA - 1).fechadasLogo).toBe(1);
    expect(aoFechar(estado({ fechadasLogo: 1 }), 3).fechadasLogo).toBe(2);
    expect(aoFechar(estado({ fechadasLogo: 2 }), SEGUNDOS_DE_UMA_SESSAO_CURTA).fechadasLogo).toBe(0);
    expect(SEGUNDOS_DE_UMA_SESSAO_CURTA).toBe(25);
  });

  it('pergunta depois de duas vezes seguidas, e não pergunta mais a quem já disse que abre direito', () => {
    expect(SESSOES_CURTAS_PARA_PERGUNTAR).toBe(2);
    expect(devePerguntarSeAbriuDireito(estado({ fechadasLogo: 1 }))).toBe(false);
    expect(devePerguntarSeAbriuDireito(estado({ fechadasLogo: 2 }))).toBe(true);
    expect(devePerguntarSeAbriuDireito(estado({ fechadasLogo: 5, abreDireito: true }))).toBe(false);
  });

  it('"abriu direito": a conta zera e fica anotado', () => {
    expect(aoResponderSeAbriuDireito(estado({ fechadasLogo: 2, modo: 'video-no-principal' }), true)).toEqual(estado({ modo: 'video-no-principal', abreDireito: true }));
  });

  it('"ficou preta": o modo é deixado de vez, pelo lado do vídeo', () => {
    expect(aoResponderSeAbriuDireito(estado({ fechadasLogo: 2, falhas: 1 }), false)).toEqual(estado({ modo: 'video-no-principal' }));
    expect(aoResponderSeAbriuDireito(estado({ fechadasLogo: 2, modo: 'sem-isolamento' }), false)).toEqual(estado({ modo: 'com-gpu' }));
    // Do último modo, recomeça do padrão.
    expect(aoResponderSeAbriuDireito(estado({ fechadasLogo: 3, modo: 'com-gpu', emCurso: 'com-gpu' }), false)).toEqual(estado());
  });
});

describe('a linha de comando da abertura', () => {
  it('sem nada pedido', () => {
    expect(lerLinhaDeComando(['C:\\Programas\\Enfesto CAD.exe'])).toEqual({ modo: null, tentados: [], compatibilidade: false, padrao: false });
  });

  it('a continuação de uma abertura que falhou diz o modo e os já tentados', () => {
    expect(lerLinhaDeComando(['exe', '--abertura=sem-isolamento', '--abertura-tentados=padrao,video-no-principal'])).toEqual({
      modo: 'sem-isolamento',
      tentados: ['padrao', 'video-no-principal'],
      compatibilidade: false,
      padrao: false,
    });
  });

  it('o que não é um modo é ignorado', () => {
    expect(lerLinhaDeComando(['--abertura=turbo', '--abertura-tentados=padrao,,nada,com-gpu'])).toEqual({ modo: null, tentados: ['padrao', 'com-gpu'], compatibilidade: false, padrao: false });
  });

  it('os dois pedidos de quem usa o programa', () => {
    expect(lerLinhaDeComando(['exe', '--modo-de-compatibilidade']).compatibilidade).toBe(true);
    expect(lerLinhaDeComando(['exe', '--modo-padrao']).padrao).toBe(true);
  });

  it('para reabrir, ficam os outros argumentos e trocam-se os da abertura', () => {
    expect(argumentosParaReabrir(['pasta-do-app', '--user-data-dir=C:\\dados', '--abertura=padrao', '--abertura-tentados=', '--modo-padrao', '--modo-de-compatibilidade'], 'sem-isolamento', ['padrao'])).toEqual([
      'pasta-do-app',
      '--user-data-dir=C:\\dados',
      '--abertura=sem-isolamento',
      '--abertura-tentados=padrao',
    ]);
    expect(argumentosParaReabrir([], 'com-gpu', ['padrao', 'sem-isolamento'])).toEqual(['--abertura=com-gpu', '--abertura-tentados=padrao,sem-isolamento']);
  });
});

describe('o estado e o modo de uma abertura', () => {
  const semPedido = lerLinhaDeComando([]);

  it('sem pedido nenhum, vale o que está guardado', () => {
    expect(abertura(estado({ modo: 'sem-isolamento' }), semPedido)).toEqual({ estado: estado({ modo: 'sem-isolamento', emCurso: 'sem-isolamento' }), modo: 'sem-isolamento' });
  });

  it('a continuação usa o modo pedido e não mexe no guardado, além de marcá-lo em curso', () => {
    expect(abertura(estado({ falhas: 1 }), lerLinhaDeComando(['--abertura=sem-isolamento', '--abertura-tentados=padrao']))).toEqual({ estado: estado({ falhas: 1, emCurso: 'sem-isolamento' }), modo: 'sem-isolamento' });
  });

  it('--modo-de-compatibilidade passa a ser o modo guardado', () => {
    expect(abertura(estado({ falhas: 1, emCurso: 'padrao' }), lerLinhaDeComando(['--modo-de-compatibilidade']))).toEqual({ estado: estado({ modo: 'sem-isolamento', emCurso: 'sem-isolamento' }), modo: 'sem-isolamento' });
  });

  it('--modo-padrao esquece o que está guardado', () => {
    expect(abertura(estado({ modo: 'com-gpu', falhas: 0, fechadasLogo: 2, abreDireito: true }), lerLinhaDeComando(['--modo-padrao']))).toEqual({ estado: estado({ emCurso: 'padrao' }), modo: 'padrao' });
  });
});

describe('os prazos da abertura', () => {
  it('saem do prazo da página: um terço para o aviso, e seis décimos para o desenho', () => {
    expect(PRAZO_PADRAO_DA_PAGINA_S).toBe(25);
    expect(prazosDeAbertura(undefined)).toEqual({ avisoMs: 8333, paginaMs: 25000, pinturaMs: 15000 });
    expect(prazosDeAbertura('60')).toEqual({ avisoMs: 20000, paginaMs: 60000, pinturaMs: 36000 });
  });

  it('o pedido fora de 2 a 600 segundos, ou que não é número, vale como o padrão', () => {
    for (const pedido of ['', '   ', 'abc', '1.9', '601', '-5', 'NaN', 'Infinity']) expect(prazosDeAbertura(pedido).paginaMs).toBe(25000);
    expect(prazosDeAbertura('2').paginaMs).toBe(2000);
    expect(prazosDeAbertura('600').paginaMs).toBe(600000);
    expect(prazosDeAbertura('3.5')).toEqual({ avisoMs: 1167, paginaMs: 3500, pinturaMs: 2100 });
  });
});

describe('a conferência de que a tela foi desenhada', () => {
  const foto = (largura: number, altura: number, cor: (i: number) => [number, number, number]): Uint8Array => {
    const pontos = new Uint8Array(largura * altura * 4);
    for (let i = 0; i < largura * altura; i++) pontos.set([...cor(i), 255], i * 4);
    return pontos;
  };

  it('a foto toda preta é a tela preta; a da página clara, não', () => {
    expect(fotoEstaPreta(foto(200, 100, () => [0, 0, 0]), 200, 100)).toBe(true);
    expect(fotoEstaPreta(foto(200, 100, () => [232, 233, 235]), 200, 100)).toBe(false);
  });

  it('sem foto, ou com a foto menor que o tamanho dito, também é', () => {
    expect(fotoEstaPreta(new Uint8Array(0), 0, 0)).toBe(true);
    expect(fotoEstaPreta(new Uint8Array(0), 200, 100)).toBe(true);
    expect(fotoEstaPreta(foto(10, 10, () => [255, 255, 255]), 200, 100)).toBe(true);
    expect(fotoEstaPreta(foto(10, 10, () => [255, 255, 255]), -1, 5)).toBe(true);
  });

  it('quase preto (cada canal abaixo de 16) conta como preto; basta um canal mais claro para não contar', () => {
    expect(fotoEstaPreta(foto(100, 100, () => [15, 15, 15]), 100, 100)).toBe(true);
    expect(fotoEstaPreta(foto(100, 100, () => [16, 0, 0]), 100, 100)).toBe(false);
    expect(fotoEstaPreta(foto(100, 100, () => [0, 16, 0]), 100, 100)).toBe(false);
    expect(fotoEstaPreta(foto(100, 100, () => [0, 0, 16]), 100, 100)).toBe(false);
  });

  it('é preta com 99% dos pontos pretos; com 2% de pontos claros, já não é', () => {
    // 4000 pontos, todos olhados: 40 claros são 1%; 80 são 2%.
    expect(fotoEstaPreta(foto(80, 50, (i) => (i % 100 === 0 ? [255, 255, 255] : [0, 0, 0])), 80, 50)).toBe(true);
    expect(fotoEstaPreta(foto(80, 50, (i) => (i % 50 === 0 ? [255, 255, 255] : [0, 0, 0])), 80, 50)).toBe(false);
  });

  it('na foto grande olha uma amostra espalhada, e não só o começo', () => {
    // 1000 × 1000: a metade de cima preta e a de baixo clara.
    expect(fotoEstaPreta(foto(1000, 1000, (i) => (i < 500000 ? [0, 0, 0] : [240, 240, 240])), 1000, 1000)).toBe(false);
  });
});
