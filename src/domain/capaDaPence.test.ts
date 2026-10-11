import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, espelharMolde, transladarMolde, type Molde } from './molde';
import {
  alterarPence,
  comAcabamento,
  comPenceReconhecida,
  criarPence,
  dobraDaPence,
  pencesDaPeca,
  penceSemRegistroPerto,
  removerPence,
  semAcabamento,
  type OpcoesDePence,
} from './pences';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// O alto da peça em arco, com pontos a cada 5 mm (como uma cintura digitalizada): de (200, 300) sobe a 330 no meio e desce a (0, 300).
const ARCO = Array.from({ length: 41 }, (_, i) => ponto(200 - i * 5, 300 + 30 * Math.sin((Math.PI * i) / 40)));
// À direita do desenho (x > 100) o mesmo arco; à esquerda, a borda é reta, sem pontos no caminho.
const MEIO_ARCO = [...ARCO.slice(0, 21), ponto(0, 330)];
const RECORTAR: OpcoesDePence = { aberturaMm: 36, profundidadeMm: 80, modo: 'recortar', piquesLaterais: false, marcaNoVertice: false };

function molde(contorno: readonly Ponto2D[]): Molde {
  return criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1');
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

const NO_ALTO = (peca: Molde): PosicaoNoContorno => ({ indiceAresta: peca.contorno.findIndex((p) => p.x === 100 && p.y === 330), ponto: ponto(100, 330) });
/** A peça com uma pence recortada de 36 × 80 no ponto mais alto, em (100, 330). */
const comPence = (contorno: readonly Ponto2D[]): Molde => criarPence(molde(contorno), NO_ALTO(molde(contorno)), RECORTAR, ids());
const noArco = (): Molde => comPence([ponto(0, 0), ponto(200, 0), ...ARCO]);
const noMeioArco = (): Molde => comPence([ponto(0, 0), ponto(200, 0), ...MEIO_ARCO]);
const aDela = (peca: Molde) => pencesDaPeca(peca)[0]!;

/** O ponto espelhado na reta que passa por `a` e `b`. */
function espelhar(p: Ponto2D, a: Ponto2D, b: Ponto2D): Ponto2D {
  const comprimento = distancia(a, b);
  const u = ponto((b.x - a.x) / comprimento, (b.y - a.y) / comprimento);
  const aoLongo = (p.x - a.x) * u.x + (p.y - a.y) * u.y;
  return ponto(2 * (a.x + u.x * aoLongo) - p.x, 2 * (a.y + u.y * aoLongo) - p.y);
}

const perto = (p: Ponto2D, q: Ponto2D): boolean => distancia(p, q) < 1e-9;

describe('pence com acabamento dobrada para um lado, em borda curva: o acabamento acompanha a borda', () => {
  it.each(['esquerda', 'direita'] as const)('dobrada para a %s: a metade desse lado é a borda dele espelhada na perna; a outra, o espelho dessa na linha do meio', (dobra) => {
    const antes = noArco();
    const peca = comAcabamento(antes, aDela(antes).id, dobra);
    const pence = aDela(peca);
    const capa = pence.capa!;
    const meio = (capa.length - 1) / 2;
    const [ponta, vertice] = [pence.pontos[pence.dobra!]!, pence.pontos[1]!];

    // Vários pontos, com o bico no meio deles, na linha do meio da pence e para fora da reta das pontas.
    expect(capa.length).toBeGreaterThanOrEqual(5);
    expect(capa[meio]).toEqual(pence.bico);
    expect(pence.bico!.x).toBeCloseTo(100, 9);
    expect(pence.bico!.y).toBeGreaterThan(ponta.y);
    // De quem olha da borda para o vértice (para baixo), a esquerda é o x maior.
    expect(ponta.x > 100).toBe(dobra === 'esquerda');
    expect(dobraDaPence(pence)).toBe(dobra);

    // A metade do lado da dobra, a partir da ponta: cada ponto, espelhado de volta na perna, é um ponto da borda, cada vez mais longe da ponta.
    const doLadoDaDobra = pence.dobra === 0 ? capa.slice(0, meio) : capa.slice(meio + 1).reverse();
    const daBorda = doLadoDaDobra.map((p) => espelhar(p, ponta, vertice));
    daBorda.forEach((p) => expect(antes.contorno.some((q) => perto(p, q))).toBe(true));
    daBorda.forEach((p, k) => expect(distancia(p, ponta)).toBeGreaterThan(k === 0 ? 0 : distancia(daBorda[k - 1]!, ponta)));
    // A outra metade é o espelho dessa na linha do meio (x = 100).
    capa.forEach((p, k) => {
      const outro = capa[capa.length - 1 - k]!;
      expect(outro.x).toBeCloseTo(200 - p.x, 9);
      expect(outro.y).toBeCloseTo(p.y, 9);
    });
  });

  it('o contorno passa pelos pontos do acabamento, em ordem, entre as duas pontas da pence', () => {
    const antes = noArco();
    const peca = comAcabamento(antes, aDela(antes).id, 'esquerda');
    const pence = aDela(peca);
    const capa = pence.capa!;
    const n = peca.contorno.length;
    const i = peca.contorno.findIndex((p) => perto(p, pence.pontos[0]!));
    const passo = perto(peca.contorno[(i + 1) % n]!, capa[0]!) ? 1 : -1;
    const noContorno = (k: number): Ponto2D => peca.contorno[(((i + passo * k) % n) + n) % n]!;

    capa.forEach((p, k) => expect(noContorno(k + 1)).toEqual(p));
    expect(noContorno(capa.length + 1)).toEqual(pence.pontos[2]);
    // O vértice saiu do contorno; o recorte voltou a ser tecido, e mais o que o acabamento põe para fora.
    expect(peca.contorno).toHaveLength(antes.contorno.length - 1 + capa.length);
    expect(area(peca.contorno)).toBeGreaterThan(area(antes.contorno) + (36 * 80) / 2);
    expect(peca.linhasInternas).toEqual([pence.pontos]);
  });

  it('o registro com as pontas na outra ordem dá o mesmo acabamento, guardado da primeira ponta dele para a segunda', () => {
    const antes = noArco();
    const id = aDela(antes).id;
    const aoContrario = { ...antes, pences: antes.pences!.map((q) => ({ ...q, pontos: [q.pontos[2]!, q.pontos[1]!, q.pontos[0]!] })) };
    const [direto, invertido] = [comAcabamento(antes, id, 'esquerda'), comAcabamento(aoContrario, id, 'esquerda')];

    expect(invertido.contorno).toEqual(direto.contorno);
    expect(pencesDaPeca(invertido)).toHaveLength(1);
    expect(aDela(invertido).capa).toEqual([...aDela(direto).capa!].reverse());
    // A esquerda é a de quem olha, e não a da ordem das pontas: a dobra continua para a mesma borda.
    expect(aDela(invertido).pontos[aDela(invertido).dobra!]).toEqual(aDela(direto).pontos[aDela(direto).dobra!]);
    expect(semAcabamento(invertido, id).contorno).toEqual(antes.contorno);
  });

  it('numa borda reta com pontos no caminho, continua um ponto só: o registro não guarda a capa', () => {
    const reta = molde([ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(150, 300), ponto(130, 300), ponto(125, 300), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)]);
    const comRegistro = comPenceReconhecida(reta, penceSemRegistroPerto(reta, ponto(100, 200), 6, 'do-contorno', 'r1')!);
    const peca = comAcabamento(comRegistro, 'r1', 'esquerda');

    expect('capa' in aDela(peca)).toBe(false);
    // O bico da pence de 40 × 100 numa borda reta: sobe 20 × tan(2α), com tan α = 0,2.
    expect(aDela(peca).bico!.x).toBeCloseTo(100, 9);
    expect(aDela(peca).bico!.y).toBeCloseTo(300 + (20 * 0.4) / (1 - 0.04), 9);
    expect(peca.contorno).toHaveLength(reta.contorno.length);
  });

  it('só o lado da dobra conta: curva de um lado e reta do outro dão acabamentos diferentes; sem lado, o bico de um ponto só', () => {
    const antes = noMeioArco();
    const id = aDela(antes).id;
    const [paraACurva, paraAReta, semLado] = [aDela(comAcabamento(antes, id, 'esquerda')), aDela(comAcabamento(antes, id, 'direita')), aDela(comAcabamento(antes, id))];

    expect(paraACurva.capa!.length).toBeGreaterThanOrEqual(5);
    expect('capa' in paraAReta).toBe(false);
    expect('capa' in semLado).toBe(false);
    expect(distancia(paraACurva.bico!, paraAReta.bico!)).toBeGreaterThan(0.1);
    // A capa é guardada da primeira ponta do registro para a segunda, seja qual for o lado da dobra.
    const capa = paraACurva.capa!;
    expect(distancia(capa[0]!, paraACurva.pontos[0]!)).toBeLessThan(distancia(capa[0]!, paraACurva.pontos[2]!));
    expect(distancia(capa.at(-1)!, paraACurva.pontos[2]!)).toBeLessThan(distancia(capa.at(-1)!, paraACurva.pontos[0]!));
  });

  it('sem o acabamento, o contorno volta a ser o da pence recortada, e a capa sai do registro', () => {
    const antes = noArco();
    const id = aDela(antes).id;
    const depois = semAcabamento(comAcabamento(antes, id, 'esquerda'), id);

    expect(depois.contorno).toEqual(antes.contorno);
    expect(depois.linhasInternas).toEqual([]);
    expect(aDela(depois).tipo).toBe('recortada');
    expect('capa' in aDela(depois)).toBe(false);
    expect('bico' in aDela(depois)).toBe(false);
    // E apagada a pence, a peça é a de antes dela.
    const semPence = removerPence(comAcabamento(antes, id, 'esquerda'), id);
    expect(area(semPence.contorno)).toBeCloseTo(area([ponto(0, 0), ponto(200, 0), ...ARCO]), 6);
    expect('pences' in semPence).toBe(false);
  });

  it('o registro deixa de valer se um ponto do acabamento é mexido, e acompanha a peça movida, espelhada ou graduada', () => {
    const antes = noArco();
    const peca = comAcabamento(antes, aDela(antes).id, 'esquerda');
    const capa = aDela(peca).capa!;
    // Um ponto que não é o bico.
    const mexida = { ...peca, contorno: peca.contorno.map((p) => (perto(p, capa[0]!) ? ponto(p.x, p.y + 0.5) : p)) };
    expect(pencesDaPeca(mexida)).toHaveLength(0);

    const levada = transladarMolde(peca, ponto(10, 20), 'outra');
    expect(pencesDaPeca(levada)).toHaveLength(1);
    aDela(levada).capa!.forEach((p, k) => expect(p).toEqual(ponto(capa[k]!.x + 10, capa[k]!.y + 20)));

    const espelhada = espelharMolde(peca, 'm1');
    expect(pencesDaPeca(espelhada)).toHaveLength(1);
    expect(aDela(espelhada).capa).toHaveLength(capa.length);
    expect(dobraDaPence(aDela(espelhada))).toBe('direita');

    const g = moldeDoTamanho(definirTamanhosDoMolde(peca, ['M', 'G'], 'M'), 1, 'g');
    expect(pencesDaPeca(g)).toHaveLength(1);
    expect(aDela(g).capa).toHaveLength(capa.length);
  });

  it('mudadas as medidas, o acabamento é refeito para o mesmo lado; e o lado pode ser trocado junto', () => {
    const antes = noMeioArco();
    const peca = comAcabamento(antes, aDela(antes).id, 'esquerda');
    const medidas = { aberturaMm: 30, profundidadeMm: 60, desvioMm: 0 };

    const mudada = alterarPence(peca, aDela(peca).id, medidas, ids());
    expect(pencesDaPeca(mudada)).toHaveLength(1);
    expect(dobraDaPence(aDela(mudada))).toBe('esquerda');
    expect(aDela(mudada).capa!.length).toBeGreaterThanOrEqual(3);
    expect(distancia(aDela(mudada).pontos[0]!, aDela(mudada).pontos[2]!)).toBeCloseTo(30, 5);

    const paraAReta = alterarPence(peca, aDela(peca).id, medidas, ids(), 'direita');
    expect(dobraDaPence(aDela(paraAReta))).toBe('direita');
    expect('capa' in aDela(paraAReta)).toBe(false);

    const semLado = alterarPence(peca, aDela(peca).id, medidas, ids(), 'meio');
    expect(dobraDaPence(aDela(semLado))).toBe('meio');
    expect('dobra' in aDela(semLado)).toBe(false);
    expect('capa' in aDela(semLado)).toBe(false);
  });
});

describe('quando a dobra não alcança a borda, o contorno passa reto pelo meio das pontas', () => {
  // A pence de 40 × 100 com o vértice em (100, 200) e as pontas em (120, 300) e (80, 300); o que muda é a borda depois da ponta (120, 300).
  const comABorda = (...depoisDaPonta: Ponto2D[]): Molde => {
    const peca = molde([ponto(0, 0), ponto(200, 0), ...depoisDaPonta, ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)]);
    return comAcabamento(comPenceReconhecida(peca, penceSemRegistroPerto(peca, ponto(100, 200), 6, 'do-contorno', 'r1')!), 'r1', 'esquerda');
  };

  it('a borda que sai da ponta quase na direção da linha do meio só a encontraria longe demais da pence', () => {
    // A borda sai a 15° da perna: espelhada, só chega à linha do meio a uns 310 mm da ponta (o alcance é de 4 aberturas, 160 mm).
    const longe = aDela(comABorda(ponto(297, 658)));
    expect(longe.bico).toEqual(ponto(100, 300));
    expect('capa' in longe).toBe(false);

    // Mais aberta (a 52° da perna), chega logo: o bico existe.
    const perto = aDela(comABorda(ponto(320, 400)));
    expect(perto.bico!.x).toBeCloseTo(100, 9);
    expect(perto.bico!.y).toBeGreaterThan(315);
    expect(perto.bico!.y).toBeLessThan(330);
  });

  it('a borda que continua a perna por um trecho e só depois vira: o acabamento voltaria por cima do próprio contorno', () => {
    // De (120, 300) a (124, 320) a borda segue em linha com a perna; depois vira para (200, 340).
    const peca = comABorda(ponto(200, 340), ponto(124, 320));
    expect(aDela(peca).bico).toEqual(ponto(100, 300));
    expect('capa' in aDela(peca)).toBe(false);
    // O contorno não passa duas vezes pelo mesmo ponto.
    const repetidos = peca.contorno.filter((p, i) => peca.contorno.some((q, j) => j !== i && distancia(p, q) < 1e-9));
    expect(repetidos).toEqual([]);
  });

  it('sem lado, o bico também segue a borda de verdade: a borda que vira logo depois da ponta não o manda para longe', () => {
    // A borda sai da ponta (120, 300) a 13° da perna e vira 30 mm adiante. Pela semirreta desse primeiro trecho, o encontro com a linha do meio seria a uns 670 mm.
    const peca = molde([ponto(0, 0), ponto(200, 0), ponto(200, 250), ponto(132.3, 327.3), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)]);
    const comRegistro = comPenceReconhecida(peca, penceSemRegistroPerto(peca, ponto(100, 200), 6, 'do-contorno', 'r1')!);
    const semLado = aDela(comAcabamento(comRegistro, 'r1'));
    const [paraOLadoQueVira, paraAReta] = [aDela(comAcabamento(comRegistro, 'r1', 'esquerda')), aDela(comAcabamento(comRegistro, 'r1', 'direita'))];

    expect(paraOLadoQueVira.bico!.y).toBeGreaterThan(315);
    expect(paraOLadoQueVira.bico!.y).toBeLessThan(325);
    expect(paraAReta.bico!.y).toBeCloseTo(300 + (20 * 0.4) / (1 - 0.04), 9);
    // Sem lado: um ponto só, a meio caminho dos dois.
    expect(semLado.bico!.x).toBeCloseTo(100, 9);
    expect(semLado.bico!.y).toBeCloseTo((paraOLadoQueVira.bico!.y + paraAReta.bico!.y) / 2, 9);
    expect('capa' in semLado).toBe(false);
  });

  it('a borda que passa para o lado de dentro da perna (por cima da boca da pence) não dá bico', () => {
    // De (120, 300) a borda vai a (118, 340): do lado da pence em relação à reta da perna.
    const peca = comABorda(ponto(200, 340), ponto(118, 340));
    expect(aDela(peca).bico).toEqual(ponto(100, 300));
    expect('capa' in aDela(peca)).toBe(false);
  });
});
