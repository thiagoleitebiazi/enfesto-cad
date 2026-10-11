import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, rotacionarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { FUNDURA_MINIMA_DA_SOBREPOSICAO_MM, interioresSeSobrepoem, validarProjeto, projetoTemErrosCriticos, TOLERANCIAS_PADRAO } from './validacao';

function pecaRetangular(
  id: string,
  x: number,
  y: number,
  largura: number,
  altura: number,
  sobrescrever: Partial<Parameters<typeof criarMolde>[0]> = {},
): Molde {
  return criarMolde(
    {
      nome: id,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(x, y), ponto(x + largura, y), ponto(x + largura, y + altura), ponto(x, y + altura)],
      linhaDeFio: { inicio: ponto(x + largura / 2, y + 10), fim: ponto(x + largura / 2, y + altura - 10) },
      ...sobrescrever,
    },
    id,
  );
}

function enfestoBase(sobrescrever: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1500,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 1,
    margemLateralMm: 10,
    margemDeExtremidadeMm: 10,
    distanciaMinimaEntrePecasMm: 5,
    ...sobrescrever,
  } as ConfiguracaoDeEnfesto);
}

describe('validarProjeto — projeto limpo', () => {
  it('nenhum problema para peças bem posicionadas, espaçadas e sem restrição de rotação', () => {
    const pecas = [pecaRetangular('a', 50, 50, 100, 100), pecaRetangular('b', 200, 50, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase());
    expect(problemas).toEqual([]);
    expect(projetoTemErrosCriticos(problemas)).toBe(false);
  });
});

describe('validarProjeto — sobreposição', () => {
  it('detecta duas peças sobrepostas', () => {
    const pecas = [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 50, 50, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase());
    const sobreposicoes = problemas.filter((p) => p.tipo === 'sobreposicao');
    expect(sobreposicoes).toHaveLength(1);
    expect(sobreposicoes[0]!.severidade).toBe('erro');
    expect([...sobreposicoes[0]!.pecasEnvolvidasIds].sort()).toEqual(['a', 'b']);
    expect(projetoTemErrosCriticos(problemas)).toBe(true);
  });
});

describe('validarProjeto — espaçamento insuficiente', () => {
  it('detecta duas peças próximas demais (mas não sobrepostas)', () => {
    const pecas = [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 102, 0, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase({ distanciaMinimaEntrePecasMm: 5 } as Partial<ConfiguracaoDeEnfesto>));
    const espacamentos = problemas.filter((p) => p.tipo === 'espacamento-insuficiente');
    expect(espacamentos).toHaveLength(1);
  });

  it('não reporta nada quando a distância mínima é 0 (desligada)', () => {
    const pecas = [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 100.5, 0, 100, 100)];
    const problemas = validarProjeto(pecas, enfestoBase({ distanciaMinimaEntrePecasMm: 0 } as Partial<ConfiguracaoDeEnfesto>));
    expect(problemas.filter((p) => p.tipo === 'espacamento-insuficiente')).toHaveLength(0);
  });
});

describe('validarProjeto — fora dos limites do tecido', () => {
  it('detecta peça além da largura útil', () => {
    const enfesto = enfestoBase({ larguraUtilMm: 300, margemLateralMm: 10 } as Partial<ConfiguracaoDeEnfesto>);
    const pecas = [pecaRetangular('a', 250, 50, 100, 100)]; // vai até x=350, acima de 300-10=290
    const problemas = validarProjeto(pecas, enfesto);
    expect(problemas.some((p) => p.tipo === 'fora-dos-limites')).toBe(true);
  });

  it('o ruído das contas na borda não conta como fora: a peça encostada na borda está dentro', () => {
    const enfesto = enfestoBase({ larguraUtilMm: 300, margemLateralMm: 0 } as Partial<ConfiguracaoDeEnfesto>);
    // Um ponto a 1,4e-15 mm para fora, como o que sobra de girar e deslocar um lado da peça.
    const naBorda = [pecaRetangular('a', -1.4210854715202005e-15, 50, 100, 100)];
    expect(validarProjeto(naBorda, enfesto).some((p) => p.tipo === 'fora-dos-limites')).toBe(false);
    // Um centésimo de milímetro para fora já é fora.
    const umCentesimoFora = [pecaRetangular('a', -0.01, 50, 100, 100)];
    expect(validarProjeto(umCentesimoFora, enfesto).some((p) => p.tipo === 'fora-dos-limites')).toBe(true);
  });

  it('nenhum problema de limite sem configuração de enfesto (null)', () => {
    const pecas = [pecaRetangular('a', -9999, 0, 100, 100)];
    const problemas = validarProjeto(pecas, null);
    expect(problemas.some((p) => p.tipo === 'fora-dos-limites')).toBe(false);
  });
});

describe('validarProjeto — rotação proibida', () => {
  it('detecta uma peça rotacionada além do que sua restrição permite', () => {
    const peca = pecaRetangular('a', 50, 50, 100, 100);
    const rotacionada = rotacionarMolde(peca, 90); // restrição padrão só permite 0°
    const problemas = validarProjeto([rotacionada], enfestoBase());
    const rotProblemas = problemas.filter((p) => p.tipo === 'rotacao-proibida');
    expect(rotProblemas).toHaveLength(1);
    expect(rotProblemas[0]!.severidade).toBe('erro');
  });

  it('não reporta nada quando a rotação aplicada é explicitamente permitida', () => {
    const peca = pecaRetangular('a', 50, 50, 100, 100, {
      restricaoDeRotacao: { permite180: true, permite90e270: false },
    });
    const rotacionada = rotacionarMolde(peca, 180);
    const problemas = validarProjeto([rotacionada], enfestoBase());
    expect(problemas.filter((p) => p.tipo === 'rotacao-proibida')).toHaveLength(0);
  });
});

describe('validarProjeto — escala suspeita', () => {
  it('avisa (não erro) para peça implausivelmente pequena', () => {
    const pecas = [pecaRetangular('a', 0, 0, 2, 2)];
    const problemas = validarProjeto(pecas, null, TOLERANCIAS_PADRAO);
    const suspeitas = problemas.filter((p) => p.tipo === 'escala-suspeita');
    expect(suspeitas).toHaveLength(1);
    expect(suspeitas[0]!.severidade).toBe('aviso');
    expect(projetoTemErrosCriticos(suspeitas)).toBe(false);
  });

  it('avisa para peça implausivelmente grande', () => {
    const pecas = [pecaRetangular('a', 0, 0, 20000, 20000)];
    const problemas = validarProjeto(pecas, null, TOLERANCIAS_PADRAO);
    expect(problemas.filter((p) => p.tipo === 'escala-suspeita')).toHaveLength(1);
  });
});

describe('validarProjeto — contorno inválido', () => {
  it('detecta furo com contorno degenerado sem lançar exceção', () => {
    // Construído diretamente (bypassando criarMolde) para simular dado corrompido/importado sem validação prévia.
    const pecaComFuroRuim: Molde = {
      ...pecaRetangular('a', 0, 0, 100, 100),
      furos: [[ponto(10, 10), ponto(20, 10)]],
    };
    const problemas = validarProjeto([pecaComFuroRuim], null);
    expect(problemas.some((p) => p.tipo === 'contorno-invalido')).toBe(true);
  });
});

describe('projetoTemErrosCriticos', () => {
  it('falso quando só há avisos', () => {
    const apenasAvisos = validarProjeto([pecaRetangular('a', 0, 0, 2, 2)], null);
    expect(projetoTemErrosCriticos(apenasAvisos)).toBe(false);
  });

  it('verdadeiro quando há ao menos um erro', () => {
    const comSobreposicao = validarProjeto(
      [pecaRetangular('a', 0, 0, 100, 100), pecaRetangular('b', 10, 10, 100, 100)],
      null,
    );
    expect(projetoTemErrosCriticos(comSobreposicao)).toBe(true);
  });
});

describe('validarProjeto — encostar não é sobrepor', () => {
  // Duas metades de um retângulo, borda com borda: como as duas partes de um corte.
  const ESQUERDA = pecaRetangular('a', 50, 50, 100, 200);
  const DIREITA = pecaRetangular('b', 150, 50, 100, 200);

  it('duas peças borda com borda não se sobrepõem: com distância mínima, estão encostadas; sem ela, não há problema', () => {
    const comMinimo = validarProjeto([ESQUERDA, DIREITA], enfestoBase());
    expect(comMinimo.map((p) => [p.tipo, p.severidade, p.mensagem])).toEqual([
      ['espacamento-insuficiente', 'erro', 'Peças "a" e "b" estão encostadas uma na outra; o mínimo exigido entre peças é de 5 mm.'],
    ]);
    expect([...comMinimo[0]!.pecasEnvolvidasIds]).toEqual(['a', 'b']);
    expect(validarProjeto([ESQUERDA, DIREITA], enfestoBase({ distanciaMinimaEntrePecasMm: 0 }))).toEqual([]);
    expect(validarProjeto([ESQUERDA, DIREITA], null)).toEqual([]);
  });

  it('encostadas só por um canto, ou com um canto de uma no meio do lado da outra, também não se sobrepõem', () => {
    const peloCanto = pecaRetangular('b', 150, 250, 100, 100);
    const noMeioDoLado: Molde = { ...DIREITA, contorno: [ponto(150, 150), ponto(250, 100), ponto(250, 200)] };

    expect(validarProjeto([ESQUERDA, peloCanto], enfestoBase({ distanciaMinimaEntrePecasMm: 0 }))).toEqual([]);
    expect(validarProjeto([ESQUERDA, noMeioDoLado], enfestoBase({ distanciaMinimaEntrePecasMm: 0 }))).toEqual([]);
    expect(interioresSeSobrepoem(ESQUERDA.contorno, peloCanto.contorno)).toBe(false);
  });

  it('continua sendo sobreposição quando os interiores têm parte em comum, por pouco que seja', () => {
    const sobreposta = (b: Molde): string[] => validarProjeto([ESQUERDA, b], enfestoBase({ distanciaMinimaEntrePecasMm: 0 })).map((p) => p.tipo);

    // Um décimo de milímetro para dentro.
    expect(sobreposta(pecaRetangular('b', 149.9, 50, 100, 200))).toEqual(['sobreposicao']);
    // A mesma peça, no mesmo lugar: nenhum canto de uma está dentro da outra, mas os interiores são o mesmo.
    expect(sobreposta(pecaRetangular('b', 50, 50, 100, 200))).toEqual(['sobreposicao']);
    // Uma dentro da outra, encostada num lado.
    expect(sobreposta(pecaRetangular('b', 50, 100, 40, 40))).toEqual(['sobreposicao']);
    // Uma tira que atravessa a outra de lado a lado: nenhum canto dentro, mas as bordas se cruzam.
    expect(sobreposta(pecaRetangular('b', 20, 100, 300, 20))).toEqual(['sobreposicao']);
    // Um bico que entra pela borda.
    expect(sobreposta({ ...DIREITA, contorno: [ponto(140, 150), ponto(250, 100), ponto(250, 200)] })).toEqual(['sobreposicao']);
    expect(interioresSeSobrepoem(ESQUERDA.contorno, DIREITA.contorno)).toBe(false);
    expect(interioresSeSobrepoem(DIREITA.contorno, ESQUERDA.contorno)).toBe(false);
  });

  it('a mensagem de quem está perto, sem encostar, continua dizendo a distância', () => {
    const problemas = validarProjeto([ESQUERDA, pecaRetangular('b', 152, 50, 100, 200)], enfestoBase());
    expect(problemas.map((p) => p.mensagem)).toEqual(['Peças "a" e "b" estão a 2.0 mm uma da outra, abaixo do mínimo exigido (5 mm).']);
  });
});

describe('validarProjeto — linha interna solta', () => {
  const comLinhas = (linhasInternas: Molde['linhasInternas']): Molde => ({ ...pecaRetangular('Frente', 50, 50, 200, 300), linhasInternas });

  it('avisa da peça que tem linha interna inteira fora dela, longe do contorno, e diz a quanto', () => {
    const umaSolta = validarProjeto([comLinhas([[ponto(70, 100), ponto(230, 100)], [ponto(1250, 100), ponto(1250, 300)]])], enfestoBase());
    expect(umaSolta).toEqual([
      { tipo: 'linha-solta', severidade: 'aviso', mensagem: 'Peça "Frente": uma linha interna está solta, fora da peça, a 1000 mm do contorno — sobra de desenho ou de importação.', pecasEnvolvidasIds: ['Frente'] },
    ]);
    expect(projetoTemErrosCriticos(umaSolta)).toBe(false);

    const duasSoltas = validarProjeto([comLinhas([[ponto(1250, 100), ponto(1250, 300)], [ponto(450, 100), ponto(450, 300)]])], enfestoBase());
    expect(duasSoltas.map((p) => p.mensagem)).toEqual(['Peça "Frente": 2 linhas internas estão soltas, fora da peça (a mais afastada, a 1000 mm do contorno) — sobra de desenho ou de importação.']);
  });

  it('a linha de dentro, a que atravessa a borda e a que passa perto dela não geram aviso', () => {
    expect(validarProjeto([comLinhas([[ponto(70, 100), ponto(230, 100)], [ponto(0, 200), ponto(300, 200)], [ponto(255, 100), ponto(255, 300)]])], enfestoBase())).toEqual([]);
  });
});

describe('validarProjeto — linha interna que sai da peça', () => {
  const comLinhas = (linhasInternas: Molde['linhasInternas']): Molde => ({ ...pecaRetangular('Frente', 50, 50, 200, 300), linhasInternas });
  const MOLDURA = [ponto(60, 60), ponto(1250, 60), ponto(1250, 1350), ponto(60, 1350), ponto(60, 60)];

  it('avisa da linha que tem parte na peça e vai para bem longe dela, e diz até onde', () => {
    const problemas = validarProjeto([comLinhas([[ponto(70, 100), ponto(230, 100)], MOLDURA])], enfestoBase());

    expect(problemas).toEqual([
      {
        tipo: 'linha-que-sai',
        severidade: 'aviso',
        mensagem: 'Peça "Frente": uma linha interna sai da peça e vai até 1414 mm para fora do contorno — pode ser sobra de desenho ou de importação (uma moldura, o contorno de outra peça).',
        pecasEnvolvidasIds: ['Frente'],
      },
    ]);
    const duas = validarProjeto([comLinhas([MOLDURA, [ponto(100, 100), ponto(100, 900)]])], enfestoBase());
    expect(duas.map((p) => p.mensagem)).toEqual(['Peça "Frente": 2 linhas internas saem da peça (a que vai mais longe, até 1414 mm para fora do contorno) — podem ser sobra de desenho ou de importação.']);
  });

  it('a peça com uma linha que sai e outra solta ganha os dois avisos, cada um com o seu', () => {
    const tipos = validarProjeto([comLinhas([MOLDURA, [ponto(1250, 100), ponto(1250, 300)]])], enfestoBase()).map((p) => p.tipo);
    expect(tipos).toEqual(['linha-que-sai', 'linha-solta']);
  });
});

describe('validarProjeto — a borda que entra centésimos de milímetro na outra está encostada', () => {
  // De x 50 a 150, de y 50 a 250.
  const ESQUERDA = pecaRetangular('a', 50, 50, 100, 200);
  const comContorno = (contorno: Molde['contorno']): Molde => ({ ...pecaRetangular('b', 150, 50, 100, 200), contorno });
  const tipos = (b: Molde, minimoMm = 0): string[] => validarProjeto([ESQUERDA, b], enfestoBase({ distanciaMinimaEntrePecasMm: minimoMm })).map((p) => p.tipo);

  it('entrar 0,02 mm é encostar; entrar 0,06 mm já é sobrepor', () => {
    const quaseJunta = pecaRetangular('b', 149.98, 50, 100, 200);

    expect(tipos(quaseJunta)).toEqual([]);
    expect(validarProjeto([ESQUERDA, quaseJunta], enfestoBase()).map((p) => p.mensagem)).toEqual(['Peças "a" e "b" estão encostadas uma na outra; o mínimo exigido entre peças é de 5 mm.']);
    expect(tipos(pecaRetangular('b', 149.94, 50, 100, 200))).toEqual(['sobreposicao']);
    expect(FUNDURA_MINIMA_DA_SOBREPOSICAO_MM).toBe(0.05);
  });

  it('as bordas que se cruzam por centésimos de milímetro — o erro de conta de um encaixe — estão encostadas', () => {
    // O lado de "b" entra 0,02 mm em "a" embaixo, cruza a borda no meio e fica 0,02 mm afastado em cima.
    const cruzandoPorPouco = comContorno([ponto(149.98, 50), ponto(250, 50), ponto(250, 250), ponto(150.02, 250)]);

    expect(tipos(cruzandoPorPouco)).toEqual([]);
    expect(tipos(cruzandoPorPouco, 5)).toEqual(['espacamento-insuficiente']);
    // O mesmo lado, cruzando por um milímetro, sobrepõe.
    expect(tipos(comContorno([ponto(149, 50), ponto(250, 50), ponto(250, 250), ponto(151, 250)]))).toEqual(['sobreposicao']);
    // Um bico que entra 0,03 mm pela borda encosta; o que entra meio milímetro sobrepõe.
    expect(tipos(comContorno([ponto(149.97, 150), ponto(250, 100), ponto(250, 200)]))).toEqual([]);
    expect(tipos(comContorno([ponto(149.5, 150), ponto(250, 100), ponto(250, 200)]))).toEqual(['sobreposicao']);
  });

  it('a fundura é um parâmetro: com 0, qualquer entrada sobrepõe; com meio milímetro, um décimo não', () => {
    const umDecimoParaDentro = pecaRetangular('b', 149.9, 50, 100, 200).contorno;
    const doisCentesimos = pecaRetangular('b', 149.98, 50, 100, 200).contorno;

    expect(interioresSeSobrepoem(ESQUERDA.contorno, doisCentesimos)).toBe(false);
    expect(interioresSeSobrepoem(ESQUERDA.contorno, doisCentesimos, 0)).toBe(true);
    expect(interioresSeSobrepoem(ESQUERDA.contorno, umDecimoParaDentro)).toBe(true);
    expect(interioresSeSobrepoem(ESQUERDA.contorno, umDecimoParaDentro, 0.5)).toBe(false);
    // Borda com borda, nem com 0 há sobreposição.
    expect(interioresSeSobrepoem(ESQUERDA.contorno, pecaRetangular('b', 150, 50, 100, 200).contorno, 0)).toBe(false);
  });

  it('uma faixa que passa por cima de um canto, sem nenhum canto de uma dentro da outra, sobrepõe', () => {
    // Uma faixa de 4 mm na diagonal: corta o lado de baixo de "a" de x 130 a 134 e o lado direito de y 66 a 70.
    const faixa = [ponto(100, 20), ponto(104, 20), ponto(204, 120), ponto(200, 120)];

    expect(interioresSeSobrepoem(ESQUERDA.contorno, faixa)).toBe(true);
    expect(interioresSeSobrepoem(faixa, ESQUERDA.contorno)).toBe(true);
    // Uma faixa de 4 centésimos no mesmo lugar também: é fina, mas está em cima da outra, a milímetros da borda dela.
    const fio = [ponto(100, 20), ponto(100.04, 20), ponto(200.04, 120), ponto(200, 120)];
    expect(interioresSeSobrepoem(ESQUERDA.contorno, fio)).toBe(true);
    expect(interioresSeSobrepoem(fio, ESQUERDA.contorno)).toBe(true);
  });

  it('a mesma peça quase no mesmo lugar sobrepõe, embora nenhuma borda entre fundo na outra', () => {
    // Deslocada 0,03 mm nos dois eixos: as bordas correm juntas, e os interiores são quase o mesmo.
    expect(tipos(pecaRetangular('b', 50.03, 50.03, 100, 200))).toEqual(['sobreposicao']);
    // Um nada menor, inteira dentro da outra, a 0,03 mm da borda dela — e com as duas trocadas.
    const umNadaMenor = pecaRetangular('b', 50.03, 50.03, 99.94, 199.94);
    expect(tipos(umNadaMenor)).toEqual(['sobreposicao']);
    expect(interioresSeSobrepoem(umNadaMenor.contorno, ESQUERDA.contorno)).toBe(true);
  });

  it('o ponto de dentro é procurado em três alturas, e vale o mais fundo', () => {
    // Uma ampulheta com 0,04 mm de cintura, no meio da altura: ali o meio do vão está a centésimos da borda.
    const ampulheta = [ponto(0, 0), ponto(40, 0), ponto(20.02, 20), ponto(40, 40), ponto(0, 40), ponto(19.98, 20)];
    expect(interioresSeSobrepoem(ampulheta, [...ampulheta])).toBe(true);
    // Uma chave: cabeça larga embaixo e haste de 0,04 mm em cima (na última das três alturas) — e a mesma de cabeça para baixo.
    const chave = [ponto(0, 0), ponto(40, 0), ponto(40, 25), ponto(20.02, 25), ponto(20.02, 40), ponto(19.98, 40), ponto(19.98, 25), ponto(0, 25)];
    const deCabecaParaBaixo = chave.map((p) => ponto(p.x, 40 - p.y)).reverse();
    expect(interioresSeSobrepoem(chave, [...chave])).toBe(true);
    expect(interioresSeSobrepoem(deCabecaParaBaixo, [...deCabecaParaBaixo])).toBe(true);
    // Um U em cima de outro igual sobrepõe; um retângulo que enche o vão do U só encosta nele.
    const emU = [ponto(0, 0), ponto(60, 0), ponto(60, 40), ponto(40, 40), ponto(40, 10), ponto(20, 10), ponto(20, 40), ponto(0, 40)];
    expect(interioresSeSobrepoem(emU, [...emU])).toBe(true);
    expect(interioresSeSobrepoem(emU, [ponto(20, 10), ponto(40, 10), ponto(40, 40), ponto(20, 40)])).toBe(false);
    // O mesmo U com o contorno começando noutro canto: os vãos saem na ordem da borda, e é preciso pô-los em ordem.
    const comecandoNoutroCanto = [...emU.slice(3), ...emU.slice(0, 3)];
    expect(interioresSeSobrepoem(comecandoNoutroCanto, [...comecandoNoutroCanto])).toBe(true);
    // Um contorno sem área não tem ponto de dentro: em cima dele mesmo, não há o que sobrepor.
    const semArea = [ponto(0, 0), ponto(10, 0), ponto(20, 0)];
    expect(interioresSeSobrepoem(semArea, [...semArea])).toBe(false);
  });

  it('basta o ponto de dentro de uma das duas estar dentro da outra', () => {
    // Um corpo de 10 × 10 ligado, por um pescoço de 0,08 mm, a um bojo bem maior. O ponto mais fundo dela está no bojo.
    const comBojo = [ponto(0, 0), ponto(10, 0), ponto(10, 5), ponto(11, 5), ponto(11, -20), ponto(51, -20), ponto(51, 30), ponto(11, 30), ponto(11, 5.08), ponto(10, 5.08), ponto(10, 10), ponto(0, 10)];
    // A outra é só o corpo: está inteira dentro da primeira, e nenhuma borda entra fundo na outra.
    const soOCorpo = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];

    expect(interioresSeSobrepoem(comBojo, soOCorpo)).toBe(true);
    expect(interioresSeSobrepoem(soOCorpo, comBojo)).toBe(true);
  });
});

describe('interioresSeSobrepoem — o que não conta e o que basta', () => {
  const ESQUERDA = pecaRetangular('a', 50, 50, 100, 200).contorno;

  it('o prolongamento de um lado, para além das pontas dele, não conta', () => {
    // O lado inclinado do triângulo, se continuasse, passaria por dentro de cada L — mas ele acaba antes.
    const triangulo = [ponto(0, 0), ponto(10, 0), ponto(0, 10)];
    const depoisDeUmaPonta = [ponto(5, -8), ponto(19, -8), ponto(19, 12), ponto(13, 12), ponto(13, -4), ponto(5, -4)];
    const depoisDaOutra = depoisDeUmaPonta.map((p) => ponto(p.y, p.x));

    for (const emL of [depoisDeUmaPonta, depoisDaOutra]) {
      expect(interioresSeSobrepoem(triangulo, emL)).toBe(false);
      expect(interioresSeSobrepoem(emL, triangulo)).toBe(false);
    }
  });

  it('basta a borda de uma das duas entrar na outra', () => {
    // Uma agulha: a ponta entra 5 mm na outra, mas onde cruza a borda dela tem menos de 5 centésimos de largura.
    const agulha = [ponto(145, 150), ponto(250, 149.5), ponto(250, 150.5)];

    expect(interioresSeSobrepoem(ESQUERDA, agulha)).toBe(true);
    expect(interioresSeSobrepoem(agulha, ESQUERDA)).toBe(true);
  });
});
