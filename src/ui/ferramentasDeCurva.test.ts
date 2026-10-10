import { describe, it, expect } from 'vitest';
import { ponto, type PosicaoNoContorno } from '../core/geometria';
import { comCurvaRegistrada, curvasDaPeca, gerarCurva } from '../domain/curvasDaPeca';
import { criarMolde, substituirTrechoDoMolde, type Molde } from '../domain/molde';
import {
  apagarAlca,
  aplicarTornarCurva,
  avisoDasAlcas,
  cliqueDeNovoPontoDePassagem,
  cliqueNaAlca,
  INSTRUCAO_COM_ALCA,
  previaDasAlcas,
} from './ferramentasDeCurva';

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

describe('pontos de passagem: pôr, tirar e tornar um trecho editável', () => {
  it('o segundo clique no mesmo lugar, em cima da curva, põe um ponto de passagem ali', () => {
    const peca = comCurva();
    const sobreACurva = curvasDaPeca(peca)[0]!.pontos[4]!;
    const posto = cliqueDeNovoPontoDePassagem([peca], peca, sobreACurva, ponto(sobreACurva.x + 2, sobreACurva.y + 1), RAIO);

    expect(posto.tratou).toBe(true);
    expect(curvasDaPeca(posto.pecas![0]!)[0]!.controles).toHaveLength(4);
    expect(posto.recado).toBe('Ponto de passagem posto na curva de “Frente”: clique nele (o anel) e, depois, onde ele deve ficar.');
  });

  it('longe do primeiro clique, ou fora de uma curva registrada, o clique segue sendo o fim do trecho', () => {
    const peca = comCurva();
    const sobreACurva = curvasDaPeca(peca)[0]!.pontos[4]!;

    expect(cliqueDeNovoPontoDePassagem([peca], peca, sobreACurva, ponto(200, 300), RAIO)).toEqual({ tratou: false, recado: null });
    expect(cliqueDeNovoPontoDePassagem([peca], peca, ponto(0, 150), ponto(0, 151), RAIO)).toEqual({ tratou: false, recado: null });
  });

  it('em cima de um ponto de passagem que já existe, explica e não muda nada', () => {
    const peca = comCurva();
    const repetido = cliqueDeNovoPontoDePassagem([peca], peca, ponto(240, 150), ponto(240, 150), RAIO);

    expect(repetido.tratou).toBe(true);
    expect(repetido.pecas).toBeUndefined();
    expect(repetido.recado).toMatch(/Já há um ponto de passagem aí/);
  });

  it('Delete tira o ponto de passagem escolhido; tirado o último, o trecho fica reto', () => {
    const peca = comCurva();
    const maisUm = cliqueDeNovoPontoDePassagem([peca], peca, curvasDaPeca(peca)[0]!.pontos[4]!, curvasDaPeca(peca)[0]!.pontos[4]!, RAIO).pecas![0]!;

    const menos = apagarAlca([maisUm], maisUm, { curvaId: 'c1', indice: 1 });
    expect(curvasDaPeca(menos.pecas![0]!)[0]!.controles).toHaveLength(3);
    expect(menos.recado).toBe('Ponto de passagem tirado em “Frente”: a curva foi refeita pelo que ficou.');

    const reta = apagarAlca([peca], peca, { curvaId: 'c1', indice: 1 });
    expect(curvasDaPeca(reta.pecas![0]!)).toHaveLength(0);
    expect(reta.pecas![0]!.contorno).toHaveLength(4);
    expect(reta.recado).toBe('Último ponto de passagem tirado em “Frente”: o trecho ficou reto, de uma ponta à outra.');

    const erro = apagarAlca([peca], peca, { curvaId: 'outra', indice: 1 });
    expect(erro.pecas).toBeUndefined();
    expect(erro.recado).toMatch(/mexida à mão/);
  });

  it('tornar o trecho uma curva editável diz quantos pontos de passagem ficaram e quanto a forma mudou', () => {
    const reta = aplicarTornarCurva([molde()], molde(), DE, ATE, 2, 'c9');
    expect(curvasDaPeca(reta.pecas[0]!)[0]!.controles).toHaveLength(4);
    expect(reta.recado).toBe('Trecho de “Frente” tornado curva editável, com 2 pontos de passagem (os anéis). A forma não mudou.');

    // A curva que perdeu o registro (um ponto dela foi mexido à mão) volta a ser editável.
    const peca = comCurva();
    const mexida = { ...peca, contorno: peca.contorno.map((p, i) => (i === 6 ? ponto(p.x + 8, p.y) : p)) };
    expect(curvasDaPeca(mexida)).toHaveLength(0);
    const n = mexida.contorno.length;
    const deNovo = aplicarTornarCurva([mexida], mexida, DE, { indiceAresta: n - 2, ponto: ATE.ponto }, 1, 'c9');
    expect(curvasDaPeca(deNovo.pecas[0]!)).toHaveLength(1);
    expect(deNovo.recado).toMatch(/com 1 ponto de passagem \(os anéis\)\. A forma mudou \d+,\d mm no ponto em que mais mudou\.$/);
    expect(() => aplicarTornarCurva([molde()], molde(), DE, ATE, 0, 'c9')).toThrow('inteiro de 1 a 20');
  });

  it('as instruções dizem do Delete e dos dois cliques', () => {
    expect(INSTRUCAO_COM_ALCA).toMatch(/Delete tira o ponto de passagem\.$/);
    expect(avisoDasAlcas(comCurva())).toMatch(/Dois cliques no mesmo lugar de uma curva põem um ponto de passagem ali\.$/);
  });
});
