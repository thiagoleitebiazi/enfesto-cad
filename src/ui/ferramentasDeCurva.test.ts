import { describe, it, expect } from 'vitest';
import { ponto, type PosicaoNoContorno } from '../core/geometria';
import { comCurvaRegistrada, curvasDaPeca, gerarCurva } from '../domain/curvasDaPeca';
import { criarMolde, substituirTrechoDoMolde, type Molde } from '../domain/molde';
import { avisoDasAlcas, cliqueNaAlca, INSTRUCAO_COM_ALCA, previaDasAlcas } from './ferramentasDeCurva';

// Retângulo de 200 × 300 mm com o lado direito trocado por uma curva que passa por (240, 150).
const DE: PosicaoNoContorno = { indiceAresta: 1, ponto: ponto(200, 0) };
const ATE: PosicaoNoContorno = { indiceAresta: 2, ponto: ponto(200, 300) };

function molde(): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } },
    'f',
  );
}

function comCurva(): Molde {
  const controles = [DE.ponto, ponto(240, 150), ATE.ponto];
  const linha = gerarCurva('curva', controles);
  return comCurvaRegistrada(substituirTrechoDoMolde(molde(), DE, ATE, linha.slice(1, -1)), 'curva', controles, linha, 'c1');
}

const RAIO = 6;

describe('cliqueNaAlca', () => {
  it('o primeiro clique, perto de um ponto de passagem, escolhe-o; o segundo leva-o para onde foi clicado', () => {
    const peca = comCurva();
    const escolha = cliqueNaAlca([peca], peca, null, ponto(243, 152), RAIO);
    expect(escolha).toEqual({ tratou: true, alca: { curvaId: 'c1', indice: 1 }, recado: null });

    const movido = cliqueNaAlca([peca], peca, escolha.alca, ponto(270, 180), RAIO);
    expect(movido.tratou).toBe(true);
    expect(movido.alca).toBeNull();
    expect(curvasDaPeca(movido.pecas![0]!)[0]!.controles[1]).toEqual(ponto(270, 180));
    expect(movido.recado).toBe('Ponto de passagem movido em “Frente”: a curva foi refeita por ele.');
  });

  it('longe das alças, o clique não é delas: a ferramenta segue como antes', () => {
    const peca = comCurva();

    expect(cliqueNaAlca([peca], peca, null, ponto(100, 0), RAIO)).toEqual({ tratou: false, alca: null, recado: null });
    expect(cliqueNaAlca([molde()], molde(), null, ponto(240, 150), RAIO).tratou).toBe(false);
  });

  it('a curva que deixou de ter registro devolve a explicação e solta a alça', () => {
    const peca = comCurva();
    const semRegistro: Molde = { ...peca, contorno: peca.contorno.map((p) => (p.x === 240 ? ponto(245, 150) : p)) };

    const resultado = cliqueNaAlca([semRegistro], semRegistro, { curvaId: 'c1', indice: 1 }, ponto(270, 180), RAIO);
    expect(resultado.pecas).toBeUndefined();
    expect(resultado.alca).toBeNull();
    expect(resultado.recado).toMatch(/mexida à mão/);
  });
});

describe('previaDasAlcas e os textos', () => {
  it('marca os pontos de passagem e, com um escolhido, mostra a curva como ficaria com ele no mouse', () => {
    const peca = comCurva();

    expect(previaDasAlcas(peca, null, ponto(0, 0))).toEqual({ marcas: [ponto(240, 150)] });
    const comAlca = previaDasAlcas(peca, { curvaId: 'c1', indice: 1 }, ponto(270, 180))!;
    expect(comAlca.novo).toEqual(gerarCurva('curva', [DE.ponto, ponto(270, 180), ATE.ponto]));
    expect(comAlca.substituido).toEqual(curvasDaPeca(peca)[0]!.pontos);
    expect(previaDasAlcas(peca, { curvaId: 'c1', indice: 1 }, null)).toEqual({ marcas: [ponto(240, 150)] });
  });

  it('a peça sem curva registrada não tem prévia de alças nem aviso', () => {
    expect(previaDasAlcas(molde(), null, ponto(0, 0))).toBeNull();
    expect(avisoDasAlcas(molde())).toBe('');
    expect(avisoDasAlcas(null)).toBe('');
    expect(avisoDasAlcas(comCurva())).toMatch(/Ou clique num ponto de passagem de uma curva \(os anéis\)/);
    expect(INSTRUCAO_COM_ALCA).toMatch(/clique onde o ponto de passagem deve ficar/);
  });
});
