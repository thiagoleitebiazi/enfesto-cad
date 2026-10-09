import { describe, it, expect } from 'vitest';
import { area, ponto, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, type DadosDeNovoMolde, type Molde } from '../domain/molde';
import {
  aplicarBainha,
  aplicarDesdobrar,
  aplicarReta,
  aplicarUniao,
  arestaDeOutraPecaPerto,
  arestaPerto,
  cliqueDeReta,
  ehFerramentaDeMolde,
  ehFerramentaDeReta,
  nomeDaParteNova,
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
    expect(resultado.recado).toBe('“Frente” desdobrada: agora tem 1200,0 cm², e a dobra ficou como linha interna.');
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
