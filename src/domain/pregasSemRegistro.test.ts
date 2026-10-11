import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, semCampo, type DadosDeNovoMolde, type Molde } from './molde';
import { alterarPrega, criarPregas, medidasDaPrega, pregasDaPeca, removerPrega, type OpcoesDePregas } from './pregas';
import { comPregaReconhecida, pregaSemRegistroPerto, pregasSemRegistro } from './pregasSemRegistro';

// Retângulo de 200 × 300 mm, anti-horário, com a linha de fio à esquerda (x = 50): o lado esquerdo fica parado.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    { nome: 'Saia', referencia: 'REF-001', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever },
    'm1',
  );
}

function na(indiceAresta: number, x: number, y: number): PosicaoNoContorno {
  return { indiceAresta, ponto: ponto(x, y) };
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

// A linha da prega: em pé, de (100, 0) a (100, 300).
const EMBAIXO = na(0, 100, 0);
const EM_CIMA = na(2, 100, 300);
const SIMPLES: OpcoesDePregas = { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 20, piques: false };

/** A prega feita pela ferramenta e, da mesma peça, a versão sem registro nenhum (como a de um projeto antigo). */
function antiga(opcoes: OpcoesDePregas = SIMPLES, base: Molde = molde(), a = EMBAIXO, b = EM_CIMA): { readonly feita: Molde; readonly semRegistro: Molde } {
  const feita = criarPregas(base, a, b, opcoes, null, ids());
  return { feita, semRegistro: semCampo(feita, 'pregas') };
}

const perto = (p: Ponto2D, q: Ponto2D): boolean => distancia(p, q) < 1e-6;
/** O mesmo par de pontos, nesta ordem ou na contrária. */
const mesmoPar = (obtido: readonly [Ponto2D, Ponto2D], esperado: readonly [Ponto2D, Ponto2D]): boolean =>
  (perto(obtido[0], esperado[0]) && perto(obtido[1], esperado[1])) || (perto(obtido[0], esperado[1]) && perto(obtido[1], esperado[0]));

describe('a prega sem registro é reconhecida pelo desenho', () => {
  it('a prega simples: as mesmas bordas, as mesmas linhas e as mesmas medidas da que a ferramenta registrou', () => {
    const { feita, semRegistro } = antiga();
    const original = pregasDaPeca(feita)[0]!;
    const achadas = pregasSemRegistro(semRegistro, 'r1');

    expect(achadas).toHaveLength(1);
    const reconhecida = achadas[0]!;
    expect(reconhecida.id).toBe('r1');
    expect(reconhecida.modo).toBe('simples-direita');
    expect(mesmoPar(reconhecida.parada, original.parada)).toBe(true);
    expect(mesmoPar(reconhecida.movida, original.movida)).toBe(true);
    // Três linhas de dobra e a seta.
    expect(reconhecida.linhas).toHaveLength(4);
    expect(reconhecida.pontasCriadas).toEqual([true, true]);
    expect(reconhecida.piques).toBeUndefined();
    expect(medidasDaPrega(reconhecida)).toMatchObject({ modo: 'simples-direita' });
    expect(medidasDaPrega(reconhecida).larguraMm).toBeCloseTo(20, 9);
    expect(medidasDaPrega(reconhecida).largura2Mm).toBeCloseTo(20, 9);
  });

  it('registrada, a prega reconhecida é tirada e mudada como a da ferramenta', () => {
    const { semRegistro } = antiga();
    const comRegistro = comPregaReconhecida(semRegistro, pregasSemRegistro(semRegistro, 'r1')[0]!);
    expect(pregasDaPeca(comRegistro)).toHaveLength(1);
    // Com registro, ela já não aparece entre as que não têm.
    expect(pregasSemRegistro(comRegistro, 'r2')).toHaveLength(0);

    const sem = removerPrega(comRegistro, 'r1');
    expect(sem.contorno).toHaveLength(4);
    for (const canto of RETANGULO) expect(sem.contorno.some((p) => perto(p, canto))).toBe(true);
    expect(sem.linhasInternas).toHaveLength(0);

    const maior = alterarPrega(comRegistro, 'r1', { modo: 'dupla', larguraMm: 15, largura2Mm: 15 }, ids());
    expect(area(maior.contorno)).toBeCloseTo(60000 + 60 * 300, 6);
    expect(pregasDaPeca(maior)[0]).toMatchObject({ modo: 'dupla' });
  });

  it('a seta diz para que lado a prega dobra', () => {
    const esquerda = antiga({ ...SIMPLES, modo: 'simples-esquerda' });
    const reconhecida = pregasSemRegistro(esquerda.semRegistro, 'r1')[0]!;
    // Aberta de novo com o modo lido, a seta fica onde estava.
    const comRegistro = comPregaReconhecida(esquerda.semRegistro, reconhecida);
    const deNovo = alterarPrega(comRegistro, 'r1', medidasDaPrega(reconhecida), ids());
    const setaDe = (m: Molde): readonly Ponto2D[] => m.linhasInternas.find((l) => l.length === 5)!;
    expect(perto(setaDe(deNovo)[0]!, setaDe(esquerda.feita)[0]!)).toBe(true);
    expect(perto(setaDe(deNovo)[1]!, setaDe(esquerda.feita)[1]!)).toBe(true);

    const direita = antiga();
    const daDireita = pregasSemRegistro(direita.semRegistro, 'r1')[0]!;
    const direitaDeNovo = alterarPrega(comPregaReconhecida(direita.semRegistro, daDireita), 'r1', medidasDaPrega(daDireita), ids());
    expect(perto(setaDe(direitaDeNovo)[1]!, setaDe(direita.feita)[1]!)).toBe(true);
    expect(reconhecida.modo).not.toBe(daDireita.modo);
  });

  it('a prega dupla: cinco linhas de dobra e as duas setas', () => {
    const { feita, semRegistro } = antiga({ ...SIMPLES, modo: 'dupla' });
    const reconhecida = pregasSemRegistro(semRegistro, 'r1')[0]!;

    expect(reconhecida.modo).toBe('dupla');
    expect(reconhecida.linhas).toHaveLength(7);
    expect(medidasDaPrega(reconhecida).larguraMm).toBeCloseTo(20, 9);
    expect(mesmoPar(reconhecida.movida, pregasDaPeca(feita)[0]!.movida)).toBe(true);
  });

  it('com larguras diferentes nas duas pontas, a ponta de onde a abertura foi medida é a que fica em esquadro', () => {
    const { feita, semRegistro } = antiga({ ...SIMPLES, largura2Mm: 30 });
    const original = pregasDaPeca(feita)[0]!;
    const reconhecida = pregasSemRegistro(semRegistro, 'r1')[0]!;

    expect(perto(reconhecida.parada[0], original.parada[0])).toBe(true);
    expect(perto(reconhecida.parada[1], original.parada[1])).toBe(true);
    expect(medidasDaPrega(reconhecida).larguraMm).toBeCloseTo(20, 6);
    expect(medidasDaPrega(reconhecida).largura2Mm).toBeCloseTo(30, 6);
    const sem = removerPrega(comPregaReconhecida(semRegistro, reconhecida), 'r1');
    expect(area(sem.contorno)).toBeCloseTo(60000, 6);
  });

  it('o lado da linha de fio é o que ficou parado', () => {
    const fioADireita = molde({ linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 250) } });
    const { feita, semRegistro } = antiga(SIMPLES, fioADireita);
    const original = pregasDaPeca(feita)[0]!;
    const reconhecida = pregasSemRegistro(semRegistro, 'r1')[0]!;

    expect(mesmoPar(reconhecida.parada, original.parada)).toBe(true);
    expect(mesmoPar(reconhecida.movida, original.movida)).toBe(true);
  });

  it('a ordem em que as linhas estão guardadas na peça não muda a leitura: vale o lado da linha de fio', () => {
    for (const fio of [{ inicio: ponto(50, 50), fim: ponto(50, 250) }, { inicio: ponto(150, 50), fim: ponto(150, 250) }]) {
      const { feita, semRegistro } = antiga(SIMPLES, molde({ linhaDeFio: fio }));
      const original = pregasDaPeca(feita)[0]!;
      const aoContrario = { ...semRegistro, linhasInternas: [...semRegistro.linhasInternas].reverse() };
      const reconhecida = pregasSemRegistro(aoContrario, 'r1')[0]!;

      expect(mesmoPar(reconhecida.parada, original.parada)).toBe(true);
      expect(mesmoPar(reconhecida.movida, original.movida)).toBe(true);
    }
  });

  it('os piques das pontas das linhas de dobra são os da prega, e saem com ela; a ponta que já era ponto do contorno fica', () => {
    const comPontos = molde({ contorno: [ponto(0, 0), ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(100, 300), ponto(0, 300)] });
    const { semRegistro } = antiga({ ...SIMPLES, piques: true }, comPontos, na(1, 100, 0), na(4, 100, 300));
    const reconhecida = pregasSemRegistro(semRegistro, 'r1')[0]!;

    expect(reconhecida.piques).toHaveLength(6);
    // As pontas já eram pontos do contorno, mas no meio de uma aresta reta: fechada a peça, ficam numa reta, e a leitura é que a prega os pôs.
    expect(reconhecida.pontasCriadas).toEqual([true, true]);
    const sem = removerPrega(comPregaReconhecida(semRegistro, reconhecida), 'r1');
    expect(sem.piques).toHaveLength(0);
    expect(area(sem.contorno)).toBeCloseTo(60000, 6);
  });

  it('a ponta que é um canto de verdade não é dada como posta pela prega', () => {
    // A linha da prega sai de um canto do contorno: um pentágono com o bico em (100, -40).
    const comBico = molde({ contorno: [ponto(0, 0), ponto(100, -40), ponto(200, 0), ponto(200, 300), ponto(0, 300)] });
    const { semRegistro } = antiga(SIMPLES, comBico, na(1, 100, -40), na(3, 100, 300));
    const reconhecida = pregasSemRegistro(semRegistro, 'r1')[0]!;

    expect(reconhecida.pontasCriadas).toEqual([false, true]);
    const sem = removerPrega(comPregaReconhecida(semRegistro, reconhecida), 'r1');
    expect(sem.contorno).toHaveLength(5);
  });

  it('vale no contorno que corre no outro sentido, e com duas pregas na mesma peça', () => {
    const aoContrario = molde({ contorno: [...RETANGULO].reverse() });
    const umaSo = antiga(SIMPLES, aoContrario, na(2, 100, 0), na(0, 100, 300));
    expect(pregasSemRegistro(umaSo.semRegistro, 'r1')).toHaveLength(1);

    const duas = semCampo(criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, quantidade: 2, distanciaMm: 40 }, ponto(150, 150), ids()), 'pregas');
    const achadas = pregasSemRegistro(duas, 'r1');
    expect(achadas).toHaveLength(2);
    // Cada uma com as linhas dela: nenhuma linha em duas pregas.
    const todas = achadas.flatMap((p) => p.linhas);
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe('o que não é reconhecido', () => {
  it('sem a linha do meio, duas linhas lado a lado não são uma prega', () => {
    const { semRegistro } = antiga();
    const semOMeio = { ...semRegistro, linhasInternas: semRegistro.linhasInternas.filter((l) => !(l.length === 2 && Math.abs(l[0]!.x - 120) < 1e-6)) };
    expect(semOMeio.linhasInternas).toHaveLength(3);
    expect(pregasSemRegistro(semOMeio, 'r1')).toHaveLength(0);
  });

  it('sem a seta, a prega é reconhecida do mesmo jeito, dobrada “para a direita”', () => {
    const { semRegistro } = antiga({ ...SIMPLES, modo: 'simples-esquerda' });
    const semSeta = { ...semRegistro, linhasInternas: semRegistro.linhasInternas.filter((l) => l.length === 2) };
    const reconhecida = pregasSemRegistro(semSeta, 'r1')[0]!;

    expect(reconhecida.modo).toBe('simples-direita');
    expect(reconhecida.linhas).toHaveLength(3);
  });

  it('a borda que não acaba num ponto do contorno, ou que esticou, não serve', () => {
    const { semRegistro } = antiga();
    // A borda que andou, encurtada 5 mm numa ponta: já não vai de um ponto do contorno a outro.
    const curta = { ...semRegistro, linhasInternas: semRegistro.linhasInternas.map((l) => (l.length === 2 && Math.abs(l[0]!.x - 140) < 1e-6 ? [l[0]!, ponto(l[1]!.x, l[1]!.y - 5)] : l)) };
    expect(pregasSemRegistro(curta, 'r1')).toHaveLength(0);
    // A peça sem linha interna nenhuma, e a que só tem linhas soltas.
    expect(pregasSemRegistro(molde(), 'r1')).toHaveLength(0);
    expect(pregasSemRegistro(molde({ linhasInternas: [[ponto(50, 50), ponto(150, 50)], [ponto(50, 100), ponto(150, 100)]] }), 'r1')).toHaveLength(0);
  });

  it('duas linhas de canto a canto, com a do meio, mas sem o esquadro da ferramenta, não são uma prega', () => {
    // Um trapézio com as "bordas" inclinadas: de (0, 0) a (50, 300) e de (200, 0) a (150, 300), e a do meio em pé.
    const trapezio = molde({
      contorno: [ponto(0, 0), ponto(200, 0), ponto(150, 300), ponto(50, 300)],
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
      linhasInternas: [[ponto(0, 0), ponto(50, 300)], [ponto(200, 0), ponto(150, 300)], [ponto(100, 0), ponto(100, 300)]],
    });
    expect(pregasSemRegistro(trapezio, 'r1')).toHaveLength(0);
  });
});

describe('pregaSemRegistroPerto', () => {
  it('acha a prega em cuja faixa o ponto está; fora dela, só se estiver ao alcance', () => {
    const { semRegistro } = antiga();

    expect(pregaSemRegistroPerto(semRegistro, ponto(120, 150), 0, 'r1')!.id).toBe('r1');
    expect(pregaSemRegistroPerto(semRegistro, ponto(60, 150), 0, 'r1')).toBeNull();
    expect(pregaSemRegistroPerto(semRegistro, ponto(95, 150), 6, 'r1')).not.toBeNull();
    expect(pregaSemRegistroPerto(molde(), ponto(120, 150), 6, 'r1')).toBeNull();
  });
});
