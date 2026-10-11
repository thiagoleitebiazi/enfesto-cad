import { describe, it, expect } from 'vitest';
import { area, ponto, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, type DadosDeNovoMolde, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import {
  aplicarBainha,
  aplicarDesdobrar,
  aplicarReta,
  aplicarUniao,
  arestaDeOutraPecaPerto,
  arestaPerto,
  aplicarRemoverFaixaPelosElementos,
  aplicarRemoverPelosElementos,
  cliqueDeReta,
  cliqueNoElementoDeRemover,
  cliqueNoElementoDoCorte,
  confirmarCortePelosElementos,
  confirmarElementosDeRemover,
  dialogoDeCortar,
  elementosDoCorte,
  lerContornoDoCorte,
  previaDoCortePelosElementos,
  previaDoRemoverPelosElementos,
  dialogoDeRemoverRegiao,
  dialogoDeUnir,
  ehFerramentaDeMolde,
  ehFerramentaDeReta,
  instrucaoDaReta,
  lerDialogoDeCortar,
  lerDialogoDeRemoverRegiao,
  lerDialogoDeUnir,
  nomeDaParteNova,
  retaPeloElemento,
  previaDaBainha,
  previaDaReta,
  previaDeDesdobrar,
  previaDeUnir,
  retaCompleta,
} from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';

// Frente: 200 × 300 mm. Lateral: 100 × 300 mm, afastada 300 mm para a direita.
const FRENTE = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const LATERAL = [ponto(500, 0), ponto(600, 0), ponto(600, 300), ponto(500, 300)];

function molde(id: string, nome: string, contorno: readonly { x: number; y: number }[], extra: Partial<DadosDeNovoMolde> = {}): Molde {
  const meioX = (contorno[0]!.x + contorno[1]!.x) / 2;
  return criarMolde(
    { nome, referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(meioX, 50), fim: ponto(meioX, 250) }, ...extra },
    id,
  );
}

const frente = (): Molde => molde('f', 'Frente', FRENTE);
const lateral = (extra: Partial<DadosDeNovoMolde> = {}): Molde => molde('l', 'Lateral', LATERAL, extra);

function na(indiceAresta: number, x: number, y: number): PosicaoNoContorno {
  return { indiceAresta, ponto: ponto(x, y) };
}

const noContorno = (posicao: PosicaoNoContorno): CliqueDeTrecho => ({ noContorno: posicao, livre: posicao.ponto });
const solto = (x: number, y: number): CliqueDeTrecho => ({ noContorno: null, livre: ponto(x, y) });

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

// A reta de (100, 0) a (100, 300): corta a Frente ao meio, em pé.
const AO_MEIO: TrechoEmEdicao = { inicio: na(0, 100, 0), fim: na(2, 100, 300), livres: [] };

describe('quais modos são ferramentas de molde', () => {
  it('reconhece as seis, e as três que pedem uma reta', () => {
    for (const modo of ['cortar', 'remover-regiao', 'dobrar', 'desdobrar', 'unir', 'bainha']) expect(ehFerramentaDeMolde(modo)).toBe(true);
    for (const modo of ['selecionar', 'curva', 'pique']) expect(ehFerramentaDeMolde(modo)).toBe(false);
    for (const modo of ['cortar', 'remover-regiao', 'dobrar']) expect(ehFerramentaDeReta(modo)).toBe(true);
    for (const modo of ['desdobrar', 'unir', 'bainha', 'curva']) expect(ehFerramentaDeReta(modo)).toBe(false);
  });
});

describe('cliqueDeReta', () => {
  it('o primeiro clique só vale no contorno', () => {
    expect(cliqueDeReta('cortar', SEM_TRECHO, solto(50, 50))).toBe(SEM_TRECHO);
    expect(cliqueDeReta('cortar', SEM_TRECHO, noContorno(na(0, 100, 0))).inicio).toEqual(na(0, 100, 0));
  });

  it('o segundo também, e não pode ser o mesmo ponto', () => {
    const comInicio = cliqueDeReta('cortar', SEM_TRECHO, noContorno(na(0, 100, 0)));
    expect(cliqueDeReta('cortar', comInicio, solto(50, 50))).toBe(comInicio);
    expect(cliqueDeReta('cortar', comInicio, noContorno(na(0, 100, 0)))).toBe(comInicio);
    expect(cliqueDeReta('cortar', comInicio, noContorno(na(2, 100, 300))).fim).toEqual(na(2, 100, 300));
  });

  it('"Cortar" e "Bainha" terminam nos dois pontos; "Dobrar" e "Remover região" pedem ainda o lado', () => {
    expect(retaCompleta('cortar', AO_MEIO)).toBe(true);
    expect(retaCompleta('bainha', AO_MEIO)).toBe(true);
    expect(retaCompleta('dobrar', AO_MEIO)).toBe(false);
    expect(retaCompleta('remover-regiao', AO_MEIO)).toBe(false);
    const comLado = cliqueDeReta('dobrar', AO_MEIO, solto(150, 150));
    expect(comLado.livres).toEqual([ponto(150, 150)]);
    expect(retaCompleta('dobrar', comLado)).toBe(true);
  });

  it('o clique do lado pode cair no contorno: vale o ponto clicado', () => {
    const comLado = cliqueDeReta('remover-regiao', AO_MEIO, { noContorno: na(1, 200, 150), livre: ponto(198, 150) });
    expect(comLado.livres).toEqual([ponto(198, 150)]);
  });

  it('depois de completa, a reta não muda com mais cliques', () => {
    expect(cliqueDeReta('cortar', AO_MEIO, noContorno(na(1, 200, 150)))).toBe(AO_MEIO);
  });
});

describe('nomeDaParteNova', () => {
  it('usa "(2)" e, se já existe, o próximo número livre', () => {
    expect(nomeDaParteNova('Frente', [frente()])).toBe('Frente (2)');
    expect(nomeDaParteNova('Frente', [frente(), molde('x', 'Frente (2)', FRENTE)])).toBe('Frente (3)');
  });
});

describe('aplicarReta', () => {
  it('"Cortar": a peça vira duas, uma logo depois da outra na lista, e o recado diz as áreas e o nome da nova', () => {
    const pecas = [frente(), lateral()];
    const resultado = aplicarReta('cortar', pecas, pecas[0]!, { ...AO_MEIO, inicio: na(0, 50, 0), fim: na(2, 50, 300) }, ids());
    expect(resultado.pecas.map((p) => p.id)).toEqual(['f', 'novo-1', 'l']);
    expect(resultado.pecas.map((p) => p.nome)).toEqual(['Frente', 'Frente (2)', 'Lateral']);
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(45000, 6);
    expect(area(resultado.pecas[1]!.contorno)).toBeCloseTo(15000, 6);
    expect(resultado.recado).toBe('“Frente” cortada em duas: 450,0 cm² continuam nela e 150,0 cm² são a peça nova “Frente (2)”.');
  });

  it('"Cortar" de novo dá um nome que ainda não existe', () => {
    const primeiro = aplicarReta('cortar', [frente()], frente(), { ...AO_MEIO, inicio: na(0, 50, 0), fim: na(2, 50, 300) }, ids());
    const maior = primeiro.pecas[0]!;
    // A parte maior ficou com (50, 0), (200, 0), (200, 300), (50, 300): corta de novo em x = 150.
    const segundo = aplicarReta('cortar', primeiro.pecas, maior, { inicio: na(0, 150, 0), fim: na(2, 150, 300), livres: [] }, ids());
    expect(segundo.pecas.map((p) => p.nome)).toEqual(['Frente', 'Frente (3)', 'Frente (2)']);
  });

  it('"Remover região": sai o lado clicado', () => {
    const resultado = aplicarReta('remover-regiao', [frente()], frente(), { ...AO_MEIO, livres: [ponto(150, 150)] }, ids());
    expect(resultado.pecas).toHaveLength(1);
    expect(resultado.pecas[0]!.id).toBe('f');
    expect(Math.max(...resultado.pecas[0]!.contorno.map((p) => p.x))).toBe(100);
    expect(resultado.recado).toBe('Região de 300,0 cm² removida de “Frente”.');
  });

  it('"Dobrar": fica o lado clicado', () => {
    const resultado = aplicarReta('dobrar', [frente()], frente(), { ...AO_MEIO, livres: [ponto(150, 150)] }, ids());
    expect(Math.min(...resultado.pecas[0]!.contorno.map((p) => p.x))).toBe(100);
    expect(resultado.recado).toContain('“Frente” dobrada');
  });

  it('lança o erro do domínio quando a reta não serve, sem devolver peças', () => {
    expect(() => aplicarReta('cortar', [frente()], frente(), { inicio: na(0, 50, 0), fim: na(0, 150, 0), livres: [] }, ids())).toThrow(
      /dentro da peça/,
    );
    expect(() => aplicarReta('dobrar', [frente()], frente(), { ...AO_MEIO, livres: [ponto(900, 900)] }, ids())).toThrow(/lado que deve ficar/);
    expect(() => aplicarReta('dobrar', [frente()], frente(), AO_MEIO, ids())).toThrow(/escolher o lado/);
    expect(() => aplicarReta('cortar', [frente()], frente(), SEM_TRECHO, ids())).toThrow(/dois pontos/);
  });
});

describe('previaDaReta', () => {
  it('sem nada clicado, não mostra nada', () => {
    expect(previaDaReta('cortar', frente(), SEM_TRECHO, solto(50, 50))).toEqual({ marcas: [] });
  });

  it('com a primeira ponta, a reta vai até o mouse — presa ao contorno, quando o mouse está nele', () => {
    const comInicio: TrechoEmEdicao = { ...SEM_TRECHO, inicio: na(0, 100, 0) };
    expect(previaDaReta('cortar', frente(), comInicio, solto(120, 80)).novo).toEqual([ponto(100, 0), ponto(120, 80)]);
    expect(previaDaReta('cortar', frente(), comInicio, { noContorno: na(2, 100, 300), livre: ponto(101, 298) }).novo).toEqual([
      ponto(100, 0),
      ponto(100, 300),
    ]);
    expect(previaDaReta('cortar', frente(), comInicio, null).novo).toBeNull();
  });

  it('"Remover região", com a reta posta: destaca o lado sob o mouse, que é o que sai', () => {
    const previa = previaDaReta('remover-regiao', frente(), AO_MEIO, solto(150, 150));
    expect(previa.novo).toEqual([ponto(100, 0), ponto(100, 300)]);
    // O lado direito, fechado (o primeiro ponto repete no fim).
    expect(previa.substituido).toEqual([ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(100, 300), ponto(100, 0)]);
  });

  it('"Dobrar", com a reta posta: destaca o outro lado, que é o que sai', () => {
    const previa = previaDaReta('dobrar', frente(), AO_MEIO, solto(150, 150));
    expect(previa.substituido).toEqual([ponto(100, 300), ponto(0, 300), ponto(0, 0), ponto(100, 0), ponto(100, 300)]);
  });

  it('com o mouse fora da peça, só a reta', () => {
    const previa = previaDaReta('dobrar', frente(), AO_MEIO, solto(900, 900));
    expect(previa.novo).toEqual([ponto(100, 0), ponto(100, 300)]);
    expect(previa.substituido).toBeUndefined();
  });
});

describe('bainha', () => {
  const BARRA: TrechoEmEdicao = { inicio: na(0, 0, 0), fim: na(1, 200, 0), livres: [] };
  const OPCOES = { dobras: 2, larguraMm: 30, piques: true };

  it('aplica na peça e conta o que fez', () => {
    const resultado = aplicarBainha([frente()], frente(), BARRA, OPCOES, ids());
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(72000, 6);
    expect(resultado.pecas[0]!.piques).toHaveLength(4);
    expect(resultado.recado).toBe('Bainha com 2 dobras de 30,0 mm criada em “Frente”.');
  });

  it('com Largura 2 diferente, o recado diz as duas', () => {
    const resultado = aplicarBainha([frente()], frente(), BARRA, { dobras: 1, larguraMm: 30, largura2Mm: 45.5, piques: false }, ids());
    expect(resultado.recado).toBe('Bainha com 1 dobra de 30,0 mm a 45,5 mm criada em “Frente”.');
  });

  it('a prévia mostra o trecho e a sobra, do começo ao fim', () => {
    const previa = previaDaBainha(frente(), BARRA, null, { ...OPCOES, dobras: 1 });
    expect(previa.substituido).toEqual([ponto(0, 0), ponto(200, 0)]);
    expect(previa.novo).toEqual([ponto(0, 0), ponto(0, -30), ponto(200, -30), ponto(200, 0)]);
  });

  it('antes do segundo clique, a prévia usa o ponto do contorno sob o mouse', () => {
    const comInicio: TrechoEmEdicao = { ...SEM_TRECHO, inicio: na(0, 0, 0) };
    expect(previaDaBainha(frente(), comInicio, noContorno(na(0, 100, 0)), { ...OPCOES, dobras: 1 }).novo).toEqual([
      ponto(0, 0),
      ponto(0, -30),
      ponto(100, -30),
      ponto(100, 0),
    ]);
    expect(previaDaBainha(frente(), comInicio, solto(50, 50), OPCOES).novo).toBeUndefined();
  });
});

describe('desdobrar', () => {
  it('aplica na aresta e conta a área nova', () => {
    const resultado = aplicarDesdobrar([frente()], frente(), 3, ids());
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(120000, 6);
    expect(resultado.recado).toBe('“Frente” desdobrada: a outra metade entrou espelhada. Agora tem 1200,0 cm², e a dobra ficou como linha interna.');
  });

  it('a prévia mostra a peça inteira e a linha de dobra', () => {
    const previa = previaDeDesdobrar(frente(), 3);
    expect(previa.novo).toHaveLength(6);
    expect(previa.novoFechado).toBe(true);
    expect(previa.substituido).toEqual([ponto(0, 300), ponto(0, 0)]);
  });

  it('sem aresta sob o mouse, nada; na aresta que não serve de dobra, só a aresta', () => {
    expect(previaDeDesdobrar(frente(), null)).toEqual({});
    const emL = molde('l', 'L', [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)]);
    expect(previaDeDesdobrar(emL, 2)).toEqual({ substituido: [ponto(200, 100), ponto(100, 100)] });
  });
});

describe('unir', () => {
  it('une: a segunda peça some da lista, e a primeira fica com a área das duas', () => {
    const pecas = [frente(), lateral()];
    const resultado = aplicarUniao(pecas, pecas[0]!, 1, pecas[1]!, 3, false);
    expect(resultado.pecas.map((p) => p.id)).toEqual(['f']);
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(90000, 6);
    expect(resultado.recado).toBe('“Lateral” unida a “Frente”: agora são uma peça só, de 900,0 cm², com a linha de fio de “Frente”.');
  });

  it('"Apenas mover": a segunda encosta e as duas continuam na lista', () => {
    const pecas = [frente(), lateral()];
    const resultado = aplicarUniao(pecas, pecas[0]!, 1, pecas[1]!, 3, true);
    expect(resultado.pecas.map((p) => p.id)).toEqual(['f', 'l']);
    expect(Math.min(...resultado.pecas[1]!.contorno.map((p) => p.x))).toBeCloseTo(200, 6);
    expect(resultado.pecas[0]).toBe(pecas[0]);
    expect(resultado.recado).toBe('“Lateral” encostada em “Frente”; as duas continuam separadas.');
  });

  it('"Apenas mover" recusa o giro que o sentido do fio da segunda peça não permite', () => {
    const pecas = [frente(), lateral()];
    // A aresta de baixo da Lateral teria de ficar em pé: 270° de giro.
    expect(() => aplicarUniao(pecas, pecas[0]!, 1, pecas[1]!, 0, true)).toThrow(/ficaria girada 270°.*sentido do fio/);
  });

  it('"Apenas mover" aceita o giro liberado nas propriedades da peça', () => {
    const liberada = lateral({ restricaoDeRotacao: { permite180: true, permite90e270: true } });
    const resultado = aplicarUniao([frente(), liberada], frente(), 1, liberada, 0, true);
    expect(resultado.pecas[1]!.anguloDeRotacaoGraus).toBeCloseTo(270, 6);
  });

  it('unindo, o giro não é recusado: vale o fio da primeira', () => {
    const pecas = [frente(), lateral()];
    const resultado = aplicarUniao(pecas, pecas[0]!, 1, pecas[1]!, 0, false);
    expect(resultado.pecas).toHaveLength(1);
    expect(resultado.pecas[0]!.anguloDeRotacaoGraus).toBe(0);
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(90000, 6);
  });

  it('recusa unir a peça a ela mesma', () => {
    expect(() => aplicarUniao([frente()], frente(), 1, frente(), 3, false)).toThrow(/outra peça/);
  });

  it('prévia: antes da primeira aresta, destaca a que está sob o mouse', () => {
    expect(previaDeUnir(frente(), null, null, null)).toEqual({});
    expect(previaDeUnir(frente(), null, 1, null)).toEqual({ substituido: [ponto(200, 0), ponto(200, 300)] });
  });

  it('prévia: com a aresta escolhida e o mouse na aresta de outra peça, mostra onde ela vai parar', () => {
    const previa = previaDeUnir(frente(), 1, null, { peca: lateral(), indiceAresta: 3 });
    expect(previa.substituido).toEqual([ponto(200, 0), ponto(200, 300)]);
    expect(previa.novoFechado).toBe(true);
    expect(Math.min(...previa.novo!.map((p) => p.x))).toBeCloseTo(200, 6);
    expect(Math.max(...previa.novo!.map((p) => p.x))).toBeCloseTo(300, 6);
    expect(previaDeUnir(frente(), 1, 0, null)).toEqual({ substituido: [ponto(200, 0), ponto(200, 300)] });
  });
});

describe('achar a aresta sob o mouse', () => {
  it('arestaPerto: a aresta que passa dentro do raio, ou nenhuma', () => {
    expect(arestaPerto(ponto(203, 150), FRENTE, 5)).toBe(1);
    expect(arestaPerto(ponto(100, -4), FRENTE, 5)).toBe(0);
    expect(arestaPerto(ponto(100, 150), FRENTE, 5)).toBeNull();
  });

  it('arestaDeOutraPecaPerto: ignora a peça dada e escolhe a mais próxima das outras', () => {
    const pecas = [frente(), lateral()];
    expect(arestaDeOutraPecaPerto(ponto(498, 150), pecas, 'f', 5)).toEqual({ peca: pecas[1], indiceAresta: 3 });
    expect(arestaDeOutraPecaPerto(ponto(202, 150), pecas, 'f', 5)).toBeNull();
    expect(arestaDeOutraPecaPerto(ponto(202, 150), pecas, 'l', 5)).toEqual({ peca: pecas[0], indiceAresta: 1 });
    expect(arestaDeOutraPecaPerto(ponto(350, 150), pecas, 'f', 5)).toBeNull();
  });
});

describe('Cortar e Remover região: as opções das janelas', () => {
  const COM_COSTURA = { costuraMm: 10, costuraNasDuas: false, piques: true, modo: 'reta' as const, manterDistancias: true };
  const comLinha = (linhas: readonly (readonly { x: number; y: number }[])[]): Molde => molde('f', 'Frente', FRENTE, { linhasInternas: linhas });

  it('a janela do Cortar lê a costura, os dois moldes, o pique e o modo', () => {
    const dialogo = dialogoDeCortar(COM_COSTURA);
    expect(dialogo.titulo).toBe('Cortar molde');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['contorno', 'automatico'],
      ['costura', '10'],
      ['costuraNasDuas', false],
      ['piques', true],
      ['modo', 'reta'],
      ['manterDistancias', true],
    ]);
    expect(lerDialogoDeCortar({ costura: 7.5, costuraNasDuas: true, piques: false, modo: 'tangente', manterDistancias: false })).toEqual({
      costuraMm: 7.5,
      costuraNasDuas: true,
      piques: false,
      modo: 'tangente',
      manterDistancias: false,
    });
    // Sem o campo, vale o de sempre: manter.
    expect(lerDialogoDeCortar({ costura: 0, costuraNasDuas: false, piques: false, modo: 'reta' }).manterDistancias).toBe(true);
    expect(lerDialogoDeCortar({ costura: 0, costuraNasDuas: false, piques: false, modo: 'outro' }).modo).toBe('tangente');
    expect(() => lerDialogoDeCortar({ costura: -2, costuraNasDuas: false, piques: false, modo: 'reta' })).toThrow(/zero ou maior/);
  });

  it('cortar com costura: a peça nova cresce na borda do corte, e a mensagem diz', () => {
    const resultado = aplicarReta('cortar', [frente()], frente(), { inicio: na(0, 50, 0), fim: na(2, 50, 300), livres: [] }, ids(), undefined, { corte: COM_COSTURA });

    expect(area(resultado.pecas[1]!.contorno)).toBeCloseTo(18000, 6);
    expect(resultado.pecas[1]!.piques).toHaveLength(2);
    expect(resultado.recado).toBe(
      '“Frente” cortada em duas: 450,0 cm² continuam nela e 180,0 cm² são a peça nova “Frente (2)”. A borda do corte ganhou 10,0 mm de costura na peça nova, com um pique em cada ponta da linha do corte.',
    );
    const nasDuas = aplicarReta('cortar', [frente()], frente(), { inicio: na(0, 50, 0), fim: na(2, 50, 300), livres: [] }, ids(), undefined, { corte: { ...COM_COSTURA, costuraNasDuas: true, piques: false } });
    expect(nasDuas.recado).toMatch(/de costura nas duas partes\.$/);
  });

  it('o clique numa linha interna reta faz dela a reta do corte, de borda a borda', () => {
    // A linha interna vai de (100, 50) a (100, 250): a reta dela cruza a peça em (100, 0) e (100, 300).
    const peca = comLinha([[ponto(100, 50), ponto(100, 250)]]);
    const peloElemento = retaPeloElemento('cortar', peca, SEM_TRECHO, 0)!;

    expect(peloElemento.recado).toBeNull();
    expect([peloElemento.estado.inicio!.ponto, peloElemento.estado.fim!.ponto]).toContainEqual(ponto(100, 0));
    expect([peloElemento.estado.inicio!.ponto, peloElemento.estado.fim!.ponto]).toContainEqual(ponto(100, 300));
    // O corte por ela tira a linha interna: virou a borda.
    const cortada = aplicarReta('cortar', [peca], peca, peloElemento.estado, ids());
    expect(cortada.pecas.flatMap((p) => p.linhasInternas)).toEqual([]);
  });

  it('a linha que não é reta, ou o clique que não é de reta nova, não vale como elemento', () => {
    const curva = comLinha([[ponto(100, 50), ponto(130, 150), ponto(100, 250)]]);
    expect(retaPeloElemento('cortar', curva, SEM_TRECHO, 0)!.recado).toMatch(/precisa ser reta para servir de reta de corte/);
    expect(retaPeloElemento('cortar', curva, SEM_TRECHO, 0)!.estado).toBe(SEM_TRECHO);

    const peca = comLinha([[ponto(100, 50), ponto(100, 250)]]);
    expect(retaPeloElemento('cortar', peca, SEM_TRECHO, null)).toBeNull();
    expect(retaPeloElemento('dobrar', peca, SEM_TRECHO, 0)).toBeNull();
    // Com a reta já posta, o clique seguinte do "Remover região" é o lado, e não outro elemento.
    expect(retaPeloElemento('remover-regiao', peca, AO_MEIO, 0)).toBeNull();
    expect(retaPeloElemento('cortar', peca, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, 0)).toBeNull();
  });

  it('Remover região com “Manter região”: a região tirada vira uma peça nova', () => {
    expect(dialogoDeRemoverRegiao({ manter: true, unir: false }).campos.map((c) => [c.id, c.inicial])).toEqual([
      ['manter', true],
      ['unir', false],
    ]);
    expect(lerDialogoDeRemoverRegiao({ manter: true, unir: true })).toEqual({ manter: true, unir: true });
    expect(lerDialogoDeRemoverRegiao({})).toEqual({ manter: false, unir: false });

    const resultado = aplicarReta('remover-regiao', [frente()], frente(), { ...AO_MEIO, livres: [ponto(150, 150)] }, ids(), undefined, { remover: { manter: true, unir: false } });
    expect(resultado.pecas).toHaveLength(2);
    expect(resultado.pecas[1]!.nome).toBe('Frente (2)');
    expect(resultado.recado).toBe('Região de 300,0 cm² removida de “Frente”; ela virou a peça “Frente (2)”.');
  });

  it('Remover região com “Unir moldes”: duas retas, e sai a faixa entre elas', () => {
    const UNIR = { manter: false, unir: true };
    // Depois da primeira reta, os cliques são os dois pontos do contorno da segunda (fora do contorno não contam).
    expect(retaCompleta('remover-regiao', AO_MEIO, true)).toBe(false);
    expect(cliqueDeReta('remover-regiao', AO_MEIO, solto(150, 150), true)).toBe(AO_MEIO);
    const umPonto = cliqueDeReta('remover-regiao', AO_MEIO, noContorno(na(0, 140, 0)), true);
    expect(umPonto.livres).toEqual([ponto(140, 0)]);
    expect(cliqueDeReta('remover-regiao', umPonto, noContorno(na(0, 140, 0)), true)).toBe(umPonto);
    const completa = cliqueDeReta('remover-regiao', umPonto, noContorno(na(2, 140, 300)), true);
    expect(retaCompleta('remover-regiao', completa, true)).toBe(true);
    // Sem a opção, o mesmo estado estaria completo com um ponto só.
    expect(retaCompleta('remover-regiao', umPonto)).toBe(true);

    const resultado = aplicarReta('remover-regiao', [frente()], frente(), completa, ids(), undefined, { remover: UNIR });
    expect(resultado.pecas).toHaveLength(1);
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(48000, 6);
    expect(resultado.recado).toBe('Faixa de 120,0 cm² removida de “Frente”, e as duas partes que sobraram foram unidas: a peça passou de 600,0 cm² para 480,0 cm².');

    const mantendo = aplicarReta('remover-regiao', [frente()], frente(), completa, ids(), undefined, { remover: { manter: true, unir: true } });
    expect(mantendo.pecas).toHaveLength(2);
    expect(mantendo.recado).toMatch(/A faixa virou a peça “Frente \(2\)”\.$/);
    expect(() => aplicarReta('remover-regiao', [frente()], frente(), umPonto, ids(), undefined, { remover: UNIR })).toThrow(/duas retas/);
  });

  it('retas de comprimentos diferentes: a mensagem diz o degrau', () => {
    const torta = { ...AO_MEIO, livres: [ponto(140, 0), ponto(170, 300)] };
    const resultado = aplicarReta('remover-regiao', [frente()], frente(), torta, ids(), undefined, { remover: { manter: false, unir: true } });

    expect(resultado.recado).toMatch(/sobrou um degrau de 0,7 mm em cada ponta\.$/);
  });

  it('a segunda reta também pode ser um elemento, e a prévia destaca a faixa', () => {
    const peca = comLinha([[ponto(140, 50), ponto(140, 250)]]);
    const segunda = retaPeloElemento('remover-regiao', peca, AO_MEIO, 0, true)!;
    expect(segunda.estado.livres).toHaveLength(2);
    expect(segunda.estado.livres).toContainEqual(ponto(140, 0));
    expect(segunda.estado.livres).toContainEqual(ponto(140, 300));

    const umPonto = { ...AO_MEIO, livres: [ponto(140, 0)] };
    const previa = previaDaReta('remover-regiao', frente(), umPonto, noContorno(na(2, 140, 300)), true);
    expect(previa.linhas).toEqual([[ponto(140, 0), ponto(140, 300)]]);
    expect(area(previa.substituido!.slice(0, -1))).toBeCloseTo(12000, 6);
    // Sem a segunda ponta no contorno, só a reta até o mouse.
    const semPonta = previaDaReta('remover-regiao', frente(), umPonto, solto(150, 150), true);
    expect(semPonta.substituido).toBeUndefined();
    expect(semPonta.linhas).toEqual([[ponto(140, 0), ponto(150, 150)]]);
    // Antes da segunda reta começar, só as marcas da primeira.
    expect(previaDaReta('remover-regiao', frente(), AO_MEIO, solto(150, 150), true).linhas).toBeUndefined();
  });

  it('as instruções acompanham cada passo, com e sem “Unir moldes”', () => {
    expect(instrucaoDaReta('cortar', SEM_TRECHO)).toMatch(/onde o corte começa\. Ou clique numa linha interna da peça \(reta ou curva\): ela vira a linha do corte, de borda a borda\. Esc sai\.$/);
    expect(instrucaoDaReta('remover-regiao', SEM_TRECHO)).toMatch(/Ou clique numa linha interna da peça \(reta ou curva\): ela vira a linha que separa a região, de borda a borda\. Esc sai\.$/);
    // Com “Unir moldes”, as duas linhas são retas.
    expect(instrucaoDaReta('remover-regiao', SEM_TRECHO, { manter: false, unir: true })).toBe(
      'Remover região (unir): clique no contorno da peça selecionada, numa ponta da primeira reta. Ou clique nas linhas internas que formam a primeira linha (reta, curva ou várias emendadas) e confirme com Enter. Esc sai.',
    );
    // Com elementos indicados, o que falta é o lado.
    expect(instrucaoDaReta('remover-regiao', { ...SEM_TRECHO, livres: [ponto(50, 125)] })).toMatch(/^Remover região: 1 elemento indicado — clique dentro da peça, na região que deve sair \(ela fica em destaque\)\. /);
    expect(instrucaoDaReta('remover-regiao', { ...SEM_TRECHO, livres: [ponto(50, 125), ponto(150, 125)] })).toMatch(/2 elementos indicados/);
    expect(instrucaoDaReta('cortar', { ...SEM_TRECHO, inicio: na(0, 50, 0) })).toMatch(/onde o corte termina/);
    expect(instrucaoDaReta('remover-regiao', SEM_TRECHO)).toMatch(/numa ponta da reta que separa a região/);
    expect(instrucaoDaReta('remover-regiao', { ...SEM_TRECHO, inicio: na(0, 50, 0) })).toMatch(/na outra ponta da reta/);
    expect(instrucaoDaReta('remover-regiao', AO_MEIO)).toMatch(/na região que deve sair/);
    expect(instrucaoDaReta('remover-regiao', AO_MEIO, { manter: false, unir: true })).toMatch(/agora a segunda reta/);
    expect(instrucaoDaReta('remover-regiao', { ...AO_MEIO, livres: [ponto(140, 0)] }, { manter: false, unir: true })).toMatch(/na outra ponta da segunda reta/);
  });
});

describe('Cortar por elementos: uma linha interna curva, ou várias emendadas', () => {
  // A linha quebrada de borda a borda (sobe de (0, 100) a (100, 150) e desce a (200, 100)) e, separadas, as duas metades dela.
  const QUEBRADA = [ponto(0, 100), ponto(100, 150), ponto(200, 100)];
  const ESQUERDA = [ponto(0, 100), ponto(100, 150)];
  const DIREITA = [ponto(100, 150), ponto(200, 100)];
  const comLinhas = (linhas: readonly (readonly { x: number; y: number }[])[]): Molde => molde('f', 'Frente', FRENTE, { linhasInternas: linhas });
  const COSTURA = { costuraMm: 10, costuraNasDuas: false, piques: false, modo: 'reta' as const, manterDistancias: true };

  it('a janela guarda o contorno escolhido: automático ou manual', () => {
    expect(dialogoDeCortar(COSTURA, true).campos[0]).toMatchObject({ id: 'contorno', tipo: 'escolha', inicial: 'manual' });
    expect(dialogoDeCortar(COSTURA).campos[0]).toMatchObject({ id: 'contorno', inicial: 'automatico' });
    expect(lerContornoDoCorte({ contorno: 'manual' })).toBe(true);
    expect(lerContornoDoCorte({ contorno: 'automatico' })).toBe(false);
    expect(lerContornoDoCorte({})).toBe(false);
    // A janela diz que a emenda e o prolongamento são leitura nossa.
    expect(dialogoDeCortar(COSTURA).nota).toMatch(/nem o que se faz com o que não chega à borda: é a nossa leitura\.$/);
    // O trecho do contorno como elemento do corte não é falta: a janela diz por quê.
    expect(dialogoDeCortar(COSTURA).nota).toMatch(/Um trecho do contorno não entra como elemento do corte: ele já é a borda da peça, e cortar por ele não separa nada — o elemento é uma linha desenhada por cima da peça\./);
  });

  it('contorno automático: o clique na linha corta por ela na hora', () => {
    const peca = comLinhas([QUEBRADA]);
    const feito = cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, 0, false, ids())!;

    expect(feito.estado).toBe(SEM_TRECHO);
    expect(feito.pecas).toHaveLength(2);
    expect(feito.pecas!.map((p) => p.nome)).toEqual(['Frente', 'Frente (2)']);
    expect(feito.pecas!.flatMap((p) => p.linhasInternas)).toEqual([]);
    expect(feito.recado).toBe('“Frente” cortada em duas, pelo elemento indicado: 350,0 cm² continuam nela e 250,0 cm² são a peça nova “Frente (2)”.');
  });

  it('com costura, a mensagem manda conferir a costura do corte que não é reto', () => {
    const peca = comLinhas([QUEBRADA]);
    const feito = cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, 0, false, ids(), COSTURA)!;

    expect(feito.recado).toMatch(/A borda do corte ganhou 10,0 mm de costura na peça nova\. Num corte que não é reto, confira a costura: ela é a borda do corte deslocada\.$/);
    expect(area(feito.pecas![1]!.contorno)).toBeGreaterThan(25000);
    // O corte por um elemento reto também não ganha o aviso: a costura dele é a de sempre.
    const comReta = comLinhas([[ponto(50, 100), ponto(150, 100)]]);
    const peloReto = cliqueNoElementoDoCorte([comReta], comReta, SEM_TRECHO, 0, false, ids(), COSTURA)!;
    expect(peloReto.recado).toMatch(/pelo elemento indicado: .* de costura na peça nova\.$/);
    // O corte reto pelos dois pontos não ganha esse aviso.
    const reto = aplicarReta('cortar', [peca], peca, { inicio: na(0, 50, 0), fim: na(2, 50, 300), livres: [] }, ids(), undefined, { corte: COSTURA });
    expect(reto.recado).not.toMatch(/confira a costura/);
  });

  it('a linha que não serve deixa tudo como está e diz por quê', () => {
    const fechada = comLinhas([[ponto(50, 50), ponto(150, 50), ponto(100, 120), ponto(50, 50)]]);
    const recusado = cliqueNoElementoDoCorte([fechada], fechada, SEM_TRECHO, 0, false, ids())!;

    expect(recusado.pecas).toBeUndefined();
    expect(recusado.estado).toBe(SEM_TRECHO);
    expect(recusado.recado).toMatch(/fecham uma volta/);
  });

  it('o clique que não é num elemento, ou com a reta já começada, não é disso', () => {
    const peca = comLinhas([QUEBRADA]);
    expect(cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, null, false, ids())).toBeNull();
    expect(cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, 7, false, ids())).toBeNull();
    expect(cliqueNoElementoDoCorte([peca], peca, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, 0, false, ids())).toBeNull();
    expect(cliqueNoElementoDoCorte([peca], peca, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, 0, true, ids())).toBeNull();
  });

  it('contorno manual: cada clique indica um elemento, o clique repetido tira, e o Enter corta', () => {
    const peca = comLinhas([ESQUERDA, [ponto(20, 20), ponto(60, 20)], DIREITA]);
    const um = cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, 0, true, ids())!;
    expect(um.pecas).toBeUndefined();
    expect(elementosDoCorte(peca, um.estado)).toEqual([0]);
    expect(um.recado).toBe('1 elemento indicado para o corte. Enter corta; o clique num elemento já indicado tira ele da lista.');

    const dois = cliqueNoElementoDoCorte([peca], peca, um.estado, 2, true, ids())!;
    expect(elementosDoCorte(peca, dois.estado)).toEqual([0, 2]);
    expect(dois.recado).toMatch(/^2 elementos indicados para o corte\./);

    // O clique de novo no primeiro tira ele da lista.
    const semOPrimeiro = cliqueNoElementoDoCorte([peca], peca, dois.estado, 0, true, ids())!;
    expect(elementosDoCorte(peca, semOPrimeiro.estado)).toEqual([2]);
    const nenhum = cliqueNoElementoDoCorte([peca], peca, semOPrimeiro.estado, 2, true, ids())!;
    expect(nenhum.estado.livres).toEqual([]);
    expect(nenhum.recado).toBeNull();

    const cortado = confirmarCortePelosElementos([peca], peca, dois.estado, ids())!;
    expect(cortado.estado).toBe(SEM_TRECHO);
    expect(cortado.pecas).toHaveLength(2);
    expect(cortado.recado).toMatch(/cortada em duas, pelos 2 elementos indicados: 350,0 cm² continuam nela e 250,0 cm²/);
    // A linha que não foi indicada continua na parte em que está.
    expect(cortado.pecas!.flatMap((p) => p.linhasInternas)).toEqual([[ponto(20, 20), ponto(60, 20)]]);
  });

  it('o Enter sem elementos não faz nada; com elementos que não dão a linha, eles continuam indicados', () => {
    const peca = comLinhas([ESQUERDA, [ponto(20, 20), ponto(60, 20)], DIREITA]);
    expect(confirmarCortePelosElementos([peca], peca, SEM_TRECHO, ids())).toBeNull();
    // Com a reta de dois pontos começada, os pontos soltos do estado não são elementos.
    expect(elementosDoCorte(peca, { ...AO_MEIO, livres: [ponto(50, 125)] })).toEqual([]);

    const soltos = cliqueNoElementoDoCorte([peca], peca, cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, 0, true, ids())!.estado, 1, true, ids())!;
    const recusado = confirmarCortePelosElementos([peca], peca, soltos.estado, ids())!;
    expect(recusado.pecas).toBeUndefined();
    expect(recusado.estado).toBe(soltos.estado);
    expect(recusado.recado).toMatch(/não se emendam/);
  });

  it('a prévia mostra os elementos em jogo e a linha do corte que eles dão, de borda a borda', () => {
    // A linha para antes da borda: a prévia já mostra o corte prolongado.
    const curta = comLinhas([[ponto(50, 100), ponto(100, 150), ponto(150, 100)]]);
    const automatica = previaDoCortePelosElementos(curta, SEM_TRECHO, 0, false)!;
    expect(automatica.linhas).toEqual([curta.linhasInternas[0]]);
    expect(automatica.novo).toHaveLength(3);
    expect(automatica.novo![0]!.x).toBeCloseTo(0, 9);
    expect(automatica.novo![0]!.y).toBeCloseTo(50, 9);
    expect(automatica.marcas).toHaveLength(2);

    // No manual: os indicados mais o que está sob o mouse; enquanto não fecham a linha, só os elementos em destaque.
    const peca = comLinhas([ESQUERDA, [ponto(20, 20), ponto(60, 20)], DIREITA]);
    const um = cliqueNoElementoDoCorte([peca], peca, SEM_TRECHO, 0, true, ids())!.estado;
    expect(previaDoCortePelosElementos(peca, um, 2, true)!.novo).toEqual(QUEBRADA);
    expect(previaDoCortePelosElementos(peca, um, 2, true)!.linhas).toEqual([ESQUERDA, DIREITA]);
    const naoEmenda = previaDoCortePelosElementos(peca, um, 1, true)!;
    expect(naoEmenda.novo).toBeUndefined();
    expect(naoEmenda.linhas).toHaveLength(2);
    // Com o mouse em cima de um já indicado, ele não entra duas vezes.
    expect(previaDoCortePelosElementos(peca, um, 0, true)!.linhas).toEqual([ESQUERDA]);
    // No automático, o que está sob o mouse é o corte, e os indicados não contam.
    expect(previaDoCortePelosElementos(peca, um, 2, false)!.linhas).toEqual([DIREITA]);
    // Sem elemento nenhum em jogo, ou com a reta de dois pontos começada, a prévia é a da reta.
    expect(previaDoCortePelosElementos(peca, SEM_TRECHO, null, true)).toBeNull();
    expect(previaDoCortePelosElementos(peca, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, 0, false)).toBeNull();
  });

  it('as instruções do contorno manual dizem quantos elementos já foram indicados', () => {
    expect(instrucaoDaReta('cortar', SEM_TRECHO, undefined, true)).toMatch(/^Cortar \(contorno manual\): clique nas linhas internas que formam a linha do corte, uma a uma, e aperte Enter\./);
    expect(instrucaoDaReta('cortar', { ...SEM_TRECHO, livres: [ponto(1, 1)] }, undefined, true)).toMatch(/1 elemento indicado — clique nos outros, ou aperte Enter para cortar\. Esc sai\.$/);
    expect(instrucaoDaReta('cortar', { ...SEM_TRECHO, livres: [ponto(1, 1), ponto(2, 2)] }, undefined, true)).toMatch(/2 elementos indicados/);
    expect(instrucaoDaReta('cortar', { ...SEM_TRECHO, inicio: na(0, 50, 0) }, undefined, true)).toMatch(/onde o corte termina/);
  });
});

describe('Unir moldes: a janela e a graduação das duas peças', () => {
  it('a janela pergunta “Apenas mover”, “Unir tamanhos” e o giro', () => {
    const dialogo = dialogoDeUnir(false, { unirTamanhos: true, giro: 'base' });
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['apenasMover', false],
      ['unirTamanhos', true],
      ['giro', 'base'],
    ]);
    expect(lerDialogoDeUnir({ apenasMover: true, unirTamanhos: false, giro: 'tamanho' })).toEqual({ apenasMover: true, uniao: { unirTamanhos: false, giro: 'tamanho' } });
    expect(lerDialogoDeUnir({})).toEqual({ apenasMover: false, uniao: { unirTamanhos: true, giro: 'base' } });
  });

  it('a mensagem diz o que foi feito da graduação', () => {
    const graduar = (peca: Molde, tamanhos = ['M', 'G']): Molde => definirTamanhosDoMolde(peca, tamanhos, 'M');
    const [f, l] = [graduar(frente()), graduar(lateral())];
    const unir = (a: Molde, b: Molde, uniao?: { unirTamanhos: boolean; giro: 'base' | 'tamanho' }): string => aplicarUniao([a, b], a, 1, b, 3, false, uniao).recado;
    // A opção chega à união: com "Unir tamanhos", os pontos graduados das duas; sem, só os quatro da primeira.
    const pontosGraduados = (uniao?: { unirTamanhos: boolean; giro: 'base' | 'tamanho' }): number => aplicarUniao([f, l], f, 1, l, 3, false, uniao).pecas[0]!.graduacao!.pontos.length;
    expect(pontosGraduados()).toBe(8);
    expect(pontosGraduados({ unirTamanhos: false, giro: 'base' })).toBe(4);

    expect(unir(f, l)).toMatch(/Os tamanhos foram unidos, todos girados como o tamanho base\.$/);
    expect(unir(f, l, { unirTamanhos: true, giro: 'tamanho' })).toMatch(/cada tamanho de “Lateral” encostado no mesmo tamanho de “Frente”\.$/);
    expect(unir(f, l, { unirTamanhos: false, giro: 'base' })).toMatch(/Sem “Unir tamanhos”, ficou só a graduação de “Frente”\.$/);
    expect(unir(f, graduar(lateral(), ['P', 'M', 'G']))).toMatch(/A graduação de “Lateral” não entrou: os tamanhos \(ou o base\) não são os mesmos de “Frente”\.$/);
    expect(unir(frente(), l)).toMatch(/A graduação de “Lateral” não entrou: “Frente” não é graduada\.$/);
    // Sem graduação em nenhuma, a mensagem é a de sempre.
    expect(unir(frente(), lateral())).toMatch(/com a linha de fio de “Frente”\.$/);
  });
});

describe('“Remover região” pelos elementos: a linha curva, a linha quebrada e várias linhas emendadas', () => {
  // A Frente com uma linha quebrada de borda a borda (sobe de (0, 100) a (100, 150) e desce a (200, 100)) e uma linha solta embaixo.
  const QUEBRADA = [ponto(0, 100), ponto(100, 150), ponto(200, 100)];
  const comALinha = (): Molde => molde('f', 'Frente', FRENTE, { linhasInternas: [QUEBRADA, [ponto(20, 20), ponto(60, 20)]] });
  const emDois = (): Molde => molde('f', 'Frente', FRENTE, { linhasInternas: [[ponto(0, 100), ponto(100, 150)], [ponto(100, 150), ponto(200, 100)]] });
  const EM_CIMA = ponto(100, 250);

  it('o clique numa linha interna indica o elemento; outro clique nela tira; e a mensagem diz o que falta', () => {
    const peca = comALinha();
    const um = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!;

    expect(elementosDoCorte(peca, um.estado)).toEqual([0]);
    expect(um.pecas).toBeUndefined();
    // O que falta fazer, quem diz é a instrução da ferramenta.
    expect(um.recado).toBeNull();
    expect(instrucaoDaReta('remover-regiao', um.estado)).toBe(
      'Remover região: 1 elemento indicado — clique dentro da peça, na região que deve sair (ela fica em destaque). O clique em outra linha interna junta ela à linha; num elemento já indicado, tira ele. Enter confirma a linha: depois dele, o clique do lado vale mesmo em cima de outra linha. Esc sai.',
    );
    const nenhum = cliqueNoElementoDeRemover([peca], peca, um.estado, 0, ponto(50, 125), ids())!;
    expect(elementosDoCorte(peca, nenhum.estado)).toEqual([]);
    expect(nenhum.recado).toBeNull();
    // A reta também entra como elemento, do mesmo jeito.
    const dois = cliqueNoElementoDeRemover([peca], peca, um.estado, 1, ponto(40, 20), ids())!;
    expect(elementosDoCorte(peca, dois.estado)).toEqual([0, 1]);
    expect(instrucaoDaReta('remover-regiao', dois.estado)).toMatch(/^Remover região: 2 elementos indicados — /);
  });

  it('com o elemento indicado, o clique fora das linhas escolhe o lado: a região sai, e a mensagem diz', () => {
    const peca = comALinha();
    const indicado = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!.estado;
    const feito = cliqueNoElementoDeRemover([peca], peca, indicado, null, EM_CIMA, ids())!;

    expect(feito.estado).toBe(SEM_TRECHO);
    expect(feito.pecas).toHaveLength(1);
    expect(area(feito.pecas![0]!.contorno)).toBeCloseTo(25000, 6);
    expect(feito.recado).toBe('Região de 350,0 cm² removida de “Frente”, pelo elemento indicado.');
    // Do outro lado da linha.
    const deBaixo = cliqueNoElementoDeRemover([peca], peca, indicado, null, ponto(100, 50), ids())!;
    expect(area(deBaixo.pecas![0]!.contorno)).toBeCloseTo(35000, 6);
    expect(deBaixo.recado).toBe('Região de 250,0 cm² removida de “Frente”, pelo elemento indicado.');
  });

  it('com “Manter região do molde”, a região tirada vira uma peça nova; por vários elementos, a mensagem conta quantos', () => {
    const peca = emDois();
    const um = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!.estado;
    const dois = cliqueNoElementoDeRemover([peca], peca, um, 1, ponto(150, 125), ids())!.estado;
    const feito = cliqueNoElementoDeRemover([peca], peca, dois, null, EM_CIMA, ids(), { manter: true, unir: false })!;

    expect(feito.pecas).toHaveLength(2);
    expect(feito.pecas!.map((p) => p.nome)).toEqual(['Frente', 'Frente (2)']);
    expect(area(feito.pecas![1]!.contorno)).toBeCloseTo(35000, 6);
    expect(feito.recado).toBe('Região de 350,0 cm² removida de “Frente”, pelos 2 elementos indicados; ela virou a peça “Frente (2)”.');
    expect(aplicarRemoverPelosElementos([peca], peca, [0, 1], EM_CIMA, ids()).recado).toBe('Região de 350,0 cm² removida de “Frente”, pelos 2 elementos indicados.');
  });

  it('o clique que não serve explica e deixa os elementos indicados; sem elemento nenhum, não é com ela', () => {
    const peca = emDois();
    const um = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!.estado;
    // Um elemento só, que para no meio da peça, é prolongado em linha reta: dá uma linha. Fora da peça, o clique do lado é recusado.
    const fora = cliqueNoElementoDeRemover([peca], peca, um, null, ponto(500, 500), ids())!;
    expect(fora.recado).toMatch(/Clique dentro da peça, do lado que deve sair/);
    expect(fora.estado).toBe(um);
    expect(fora.pecas).toBeUndefined();
    // Sem elementos indicados, o clique fora das linhas não é disso; nem com a reta por dois pontos já começada.
    expect(cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, null, EM_CIMA, ids())).toBeNull();
    expect(cliqueNoElementoDeRemover([peca], peca, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, 0, ponto(50, 125), ids())).toBeNull();
    expect(cliqueNoElementoDeRemover([peca], peca, AO_MEIO, null, EM_CIMA, ids())).toBeNull();
  });

  it('a prévia mostra a linha que os elementos dão e, com o mouse fora deles, a região que sai', () => {
    const peca = comALinha();
    // Com o mouse em cima da linha, antes de qualquer clique: a linha de borda a borda.
    const sobre = previaDoRemoverPelosElementos(peca, SEM_TRECHO, 0, ponto(50, 125))!;
    expect(sobre.novo).toEqual(QUEBRADA);
    expect(sobre.substituido).toBeUndefined();
    // Indicada a linha, o mouse do lado de cima põe a região de cima em destaque.
    const indicado = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!.estado;
    const deCima = previaDoRemoverPelosElementos(peca, indicado, null, EM_CIMA)!;
    expect(deCima.novo).toEqual(QUEBRADA);
    expect(area(deCima.substituido!.slice(0, -1))).toBeCloseTo(35000, 6);
    expect(area(previaDoRemoverPelosElementos(peca, indicado, null, ponto(100, 50))!.substituido!.slice(0, -1))).toBeCloseTo(25000, 6);
    // Com o mouse em cima de outra linha interna, o clique juntaria essa linha: não há região em destaque.
    expect(previaDoRemoverPelosElementos(peca, indicado, 1, ponto(40, 20))!.substituido).toBeUndefined();
    // Fora da peça, ou sem o mouse, fica só a linha; sem elemento em jogo, nada.
    expect(previaDoRemoverPelosElementos(peca, indicado, null, ponto(500, 500))!.substituido).toBeUndefined();
    expect(previaDoRemoverPelosElementos(peca, indicado, null, null)!.substituido).toBeUndefined();
    expect(previaDoRemoverPelosElementos(peca, SEM_TRECHO, null, EM_CIMA)).toBeNull();
  });

  it('a janela diz que a linha pode ser curva ou de vários elementos, do Enter, e de como as duas linhas do “Unir moldes” são indicadas', () => {
    const nota = dialogoDeRemoverRegiao({ manter: false, unir: false }).nota;
    expect(nota).toMatch(/uma linha interna da peça \(o elemento: reta, curva, arco ou linha quebrada — ou várias emendadas, clicando uma a uma\)\./);
    expect(nota).toMatch(/Num molde cheio de linhas, confirme a linha com Enter: depois dele, o clique do lado vale em qualquer lugar\./);
    expect(nota).toMatch(/clique nas linhas internas da primeira e confirme com Enter, depois nas da segunda e Enter\. Linhas de formas diferentes são unidas pelas pontas delas, e a mensagem diz a diferença\.$/);
  });
});

describe('“Remover região”: o Enter confirma a linha, e daí em diante o clique escolhe o lado em qualquer lugar', () => {
  const QUEBRADA = [ponto(0, 100), ponto(100, 150), ponto(200, 100)];
  // Um molde com a linha quebrada e, logo acima dela, outra linha interna: não sobra lugar livre perto.
  const cheio = (): Molde => molde('f', 'Frente', FRENTE, { linhasInternas: [QUEBRADA, [ponto(20, 200), ponto(180, 200)]] });

  it('sem o Enter, o clique em cima de outra linha junta essa linha; com o Enter, é o clique do lado', () => {
    const peca = cheio();
    const um = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!.estado;
    // Em cima da outra linha, sem confirmar: ela entra na lista.
    const semConfirmar = cliqueNoElementoDeRemover([peca], peca, um, 1, ponto(100, 200), ids())!;
    expect(semConfirmar.pecas).toBeUndefined();
    expect(elementosDoCorte(peca, semConfirmar.estado)).toEqual([0, 1]);

    const confirmado = confirmarElementosDeRemover([peca], peca, um, ids())!;
    expect(confirmado.pecas).toBeUndefined();
    expect(confirmado.recado).toBeNull();
    expect(confirmado.estado.livres).toEqual([]);
    expect(confirmado.estado.grupos).toHaveLength(1);
    expect(instrucaoDaReta('remover-regiao', confirmado.estado)).toBe('Remover região: linha confirmada — clique dentro da peça, na região que deve sair (ela fica em destaque). Agora o clique vale mesmo em cima de outra linha. Esc sai.');
    // O mesmo clique, em cima da outra linha: agora é o lado, e a região de cima sai.
    const feito = cliqueNoElementoDeRemover([peca], peca, confirmado.estado, 1, ponto(100, 200), ids())!;
    expect(feito.pecas).toHaveLength(1);
    expect(area(feito.pecas![0]!.contorno)).toBeCloseTo(25000, 6);
    expect(feito.estado).toBe(SEM_TRECHO);
    expect(feito.recado).toBe('Região de 350,0 cm² removida de “Frente”, pelo elemento indicado.');
  });

  it('com a linha confirmada, a prévia mostra a região sob o mouse mesmo em cima de outra linha', () => {
    const peca = cheio();
    const um = cliqueNoElementoDeRemover([peca], peca, SEM_TRECHO, 0, ponto(50, 125), ids())!.estado;
    const confirmado = confirmarElementosDeRemover([peca], peca, um, ids())!.estado;
    const previa = previaDoRemoverPelosElementos(peca, confirmado, 1, ponto(100, 200))!;

    expect(previa.novo).toEqual(QUEBRADA);
    expect(area(previa.substituido!.slice(0, -1))).toBeCloseTo(35000, 6);
    expect(previaDoRemoverPelosElementos(peca, confirmado, null, null)!.substituido).toBeUndefined();
  });

  it('o Enter só confirma o que dá uma linha de borda a borda; sem nada indicado, não é com ele', () => {
    const soltos = molde('f', 'Frente', FRENTE, { linhasInternas: [[ponto(0, 100), ponto(60, 120)], [ponto(140, 120), ponto(200, 100)]] });
    const um = cliqueNoElementoDeRemover([soltos], soltos, SEM_TRECHO, 0, ponto(30, 110), ids())!.estado;
    const dois = cliqueNoElementoDeRemover([soltos], soltos, um, 1, ponto(170, 110), ids())!.estado;
    const recusado = confirmarElementosDeRemover([soltos], soltos, dois, ids())!;

    expect(recusado.recado).toMatch(/não se emendam/);
    expect(recusado.estado).toBe(dois);
    expect(confirmarElementosDeRemover([soltos], soltos, SEM_TRECHO, ids())).toBeNull();
    expect(confirmarElementosDeRemover([soltos], soltos, AO_MEIO, ids())).toBeNull();
  });
});

describe('“Remover região” com “Unir moldes” por linhas que não são retas', () => {
  const UNIR = { manter: false, unir: true };
  const QUEBRADA = [ponto(0, 100), ponto(100, 150), ponto(200, 100)];
  const DE_CIMA = QUEBRADA.map((p) => ponto(p.x, p.y + 60));
  // A linha de fio na parte de cima: é ela que fica parada.
  const peca = (): Molde => molde('f', 'Frente', FRENTE, { linhasInternas: [QUEBRADA, DE_CIMA, [ponto(0, 250), ponto(200, 250)]], linhaDeFio: { inicio: ponto(100, 255), fim: ponto(100, 295) } });
  const clicarNa = (p: Molde, estado: TrechoEmEdicao, linha: number | null, x = 50, y = 125) => cliqueNoElementoDeRemover([p], p, estado, linha, ponto(x, y), ids(), UNIR);

  it('os elementos de cada linha são confirmados com Enter: o segundo tira a faixa e une as partes', () => {
    const p = peca();
    const um = clicarNa(p, SEM_TRECHO, 0)!;
    expect(um.recado).toBeNull();
    expect(instrucaoDaReta('remover-regiao', um.estado, UNIR)).toBe('Remover região (unir): 1 elemento indicado para a primeira linha — clique nos outros que a formam, ou aperte Enter para confirmá-la. Esc sai.');
    const primeira = confirmarElementosDeRemover([p], p, um.estado, ids(), UNIR)!;
    expect(primeira.pecas).toBeUndefined();
    expect(primeira.estado.grupos).toHaveLength(1);
    expect(instrucaoDaReta('remover-regiao', primeira.estado, UNIR)).toBe('Remover região (unir): primeira linha confirmada — agora clique nos elementos da segunda linha. Esc sai.');
    const dois = clicarNa(p, primeira.estado, 1, 50, 185)!;
    expect(dois.estado.grupos).toHaveLength(1);
    expect(instrucaoDaReta('remover-regiao', dois.estado, UNIR)).toBe('Remover região (unir): 1 elemento indicado para a segunda linha — aperte Enter para confirmar: a faixa entre as duas sai (fica em destaque). Esc sai.');
    const feito = confirmarElementosDeRemover([p], p, dois.estado, ids(), UNIR)!;

    expect(feito.estado).toBe(SEM_TRECHO);
    expect(feito.pecas).toHaveLength(1);
    expect(area(feito.pecas![0]!.contorno)).toBeCloseTo(48000, 6);
    expect(feito.recado).toBe('Faixa de 120,0 cm² removida de “Frente”, entre as duas linhas indicadas, e as duas partes que sobraram foram unidas: a peça passou de 600,0 cm² para 480,0 cm².');
  });

  it('com “Manter região”, a faixa vira uma peça; linhas de formas diferentes são unidas pelas pontas, e a mensagem diz a diferença', () => {
    const p = peca();
    const mantida = aplicarRemoverFaixaPelosElementos([p], p, [0], [1], ids(), { manter: true, unir: true });
    expect(mantida.pecas).toHaveLength(2);
    expect(mantida.recado).toMatch(/ A faixa virou a peça “Frente \(2\)”\.$/);
    // A linha quebrada e a reta de cima.
    const diferentes = aplicarRemoverFaixaPelosElementos([p], p, [0], [2], ids(), UNIR);
    expect(diferentes.recado).toMatch(/ As duas linhas não têm a mesma forma: as partes foram unidas pelas pontas delas, e a peça unida tem 50,0 cm² a menos que as duas partes somadas — é o que uma linha tem de diferente da outra\.$/);
  });

  it('a reta também entra no grupo da vez, antes ou depois da primeira linha confirmada: assim várias retas emendadas formam uma linha', () => {
    const p = peca();
    // A reta clicada antes de qualquer outra coisa: é o primeiro elemento da primeira linha.
    const comecandoPelaReta = clicarNa(p, SEM_TRECHO, 2, 100, 250)!;
    expect(elementosDoCorte(p, comecandoPelaReta.estado)).toEqual([2]);
    expect(comecandoPelaReta.estado.inicio).toBeNull();
    // Com a primeira reta posta por dois pontos do contorno, o clique numa linha interna reta continua sendo a segunda reta inteira.
    expect(clicarNa(p, AO_MEIO, 2, 100, 250)).toBeNull();
    expect(retaPeloElemento('remover-regiao', p, AO_MEIO, 2, true)!.estado.livres).toHaveLength(2);
    // Depois da primeira linha confirmada, a reta é um elemento da segunda.
    const primeira = confirmarElementosDeRemover([p], p, clicarNa(p, SEM_TRECHO, 0)!.estado, ids(), UNIR)!.estado;
    const comAReta = clicarNa(p, primeira, 2, 100, 250)!;
    expect(elementosDoCorte(p, comAReta.estado)).toEqual([2]);
    expect(comAReta.estado.grupos).toHaveLength(1);
    // O clique nela de novo tira; a primeira linha continua confirmada.
    const semAReta = clicarNa(p, comAReta.estado, 2, 100, 250)!;
    expect(semAReta.estado.livres).toEqual([]);
    expect(semAReta.estado.grupos).toHaveLength(1);
  });

  it('fora das linhas, com um grupo em andamento, o clique não começa outra coisa: a mensagem lembra o Enter', () => {
    const p = peca();
    const um = clicarNa(p, SEM_TRECHO, 0)!.estado;
    const fora = clicarNa(p, um, null, 100, 280)!;
    expect(fora.estado).toBe(um);
    expect(fora.recado).toBe('Enter confirma os elementos indicados; Esc desiste.');
    const primeira = confirmarElementosDeRemover([p], p, um, ids(), UNIR)!.estado;
    expect(clicarNa(p, primeira, null, 100, 280)!.recado).toMatch(/A primeira linha está confirmada/);
    // Sem nada em andamento, o clique fora das linhas não é com ela.
    expect(clicarNa(p, SEM_TRECHO, null, 100, 280)).toBeNull();
  });

  it('a prévia desenha a primeira linha confirmada e, com a segunda sob o mouse, a faixa em destaque', () => {
    const p = peca();
    // Antes de tudo: a linha sob o mouse — curva ou reta — dá a prévia da linha, de borda a borda.
    expect(previaDoRemoverPelosElementos(p, SEM_TRECHO, 0, ponto(50, 125), true)!.novo).toEqual(QUEBRADA);
    expect(previaDoRemoverPelosElementos(p, SEM_TRECHO, 2, ponto(100, 250), true)!.novo).toEqual([ponto(0, 250), ponto(200, 250)]);
    expect(previaDoRemoverPelosElementos(p, SEM_TRECHO, null, ponto(100, 280), true)).toBeNull();
    const primeira = confirmarElementosDeRemover([p], p, clicarNa(p, SEM_TRECHO, 0)!.estado, ids(), UNIR)!.estado;
    const soAPrimeira = previaDoRemoverPelosElementos(p, primeira, null, ponto(100, 280), true)!;
    expect(soAPrimeira.linhas).toContainEqual(QUEBRADA);
    expect(soAPrimeira.substituido).toBeUndefined();
    const comASegunda = previaDoRemoverPelosElementos(p, primeira, 1, ponto(50, 185), true)!;
    expect(comASegunda.novo).toEqual(DE_CIMA);
    expect(area(comASegunda.substituido!.slice(0, -1))).toBeCloseTo(12000, 6);
  });
});
