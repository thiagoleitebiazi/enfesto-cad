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
  INSTRUCAO_COM_TANGENTE,
  instrucaoComAlca,
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

    // O ponto de passagem e, depois dele, as duas alças de tangente (as de saída natural).
    expect(previaDasAlcas(peca, null, ponto(0, 0))!.marcas![0]).toEqual(ponto(240, 150));
    expect(previaDasAlcas(peca, null, ponto(0, 0))!.marcas).toHaveLength(3);
    const comAlca = previaDasAlcas(peca, { curvaId: 'c1', indice: 1 }, ponto(270, 180))!;
    expect(comAlca.novo).toEqual(gerarCurva('curva', [DE.ponto, ponto(270, 180), ATE.ponto]));
    expect(comAlca.substituido).toEqual(curvasDaPeca(peca)[0]!.pontos);
    expect(previaDasAlcas(peca, { curvaId: 'c1', indice: 1 }, null)).toEqual(previaDasAlcas(peca, null, ponto(0, 0)));
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
    expect(avisoDasAlcas(comCurva())).toMatch(/Dois cliques no mesmo lugar de uma curva põem um ponto de passagem ali\. O anel preso a cada ponta da curva por um traço é a alça de tangente: dá a direção em que a curva sai dali\.$/);
  });
});

describe('as alças de tangente na tela', () => {
  // A alça de saída natural da primeira ponta fica em (213,3; 50); a da final, em (213,3; 250).
  const NA_ALCA = ponto(214, 51);
  const comArco = (): Molde => {
    const controles = [DE.ponto, ponto(240, 150), ATE.ponto];
    const linha = gerarCurva('arco', controles);
    return comCurvaRegistrada(substituirTrechoDoMolde(molde(), DE, ATE, linha.slice(1, -1)), 'arco', controles, linha, 'c1');
  };

  it('a prévia mostra um anel em cada alça, preso à ponta por um traço', () => {
    const previa = previaDasAlcas(comCurva(), null, ponto(0, 0))!;

    expect(previa.linhas).toHaveLength(2);
    expect(previa.linhas![0]![0]).toEqual(DE.ponto);
    expect(previa.linhas![1]![0]).toEqual(ATE.ponto);
    expect(previa.marcas!.slice(1)).toEqual([previa.linhas![0]![1], previa.linhas![1]![1]]);
    // O arco não tem alças de tangente: só o ponto de passagem dele.
    expect(previaDasAlcas(comArco(), null, ponto(0, 0))).toEqual({ marcas: [ponto(240, 150)] });
  });

  it('o clique na alça escolhe-a; o seguinte diz para onde ela aponta, e a curva é refeita', () => {
    const peca = comCurva();
    const escolha = cliqueNaAlca([peca], peca, null, NA_ALCA, RAIO);
    expect(escolha).toEqual({ tratou: true, alca: { curvaId: 'c1', indice: -1, tangente: 'inicio' }, recado: null });

    const posta = cliqueNaAlca([peca], peca, escolha.alca, ponto(260, 30), RAIO);
    expect(posta.alca).toBeNull();
    expect(posta.recado).toBe('Alça de tangente posta em “Frente”: a curva sai dessa ponta na direção dela.');
    expect(curvasDaPeca(posta.pecas![0]!)[0]!.tangentes).toEqual({ inicio: ponto(260, 30) });
    // O ponto de passagem tem a vez antes da alça, quando os dois estão ao alcance do clique.
    expect(cliqueNaAlca([peca], peca, null, ponto(240, 150), 200).alca).toEqual({ curvaId: 'c1', indice: 1 });
  });

  it('a alça que apontaria para fora da curva é recusada, e continua escolhida para o clique seguinte', () => {
    const peca = comCurva();
    const alca = { curvaId: 'c1', indice: -1, tangente: 'inicio' as const };
    const recusada = cliqueNaAlca([peca], peca, alca, ponto(180, -40), RAIO);

    expect(recusada.pecas).toBeUndefined();
    expect(recusada.alca).toEqual(alca);
    expect(recusada.recado).toMatch(/precisa apontar para o lado da curva/);
    // Se a curva já não tem registro, não há o que escolher.
    const semRegistro = cliqueNaAlca([molde()], molde(), alca, ponto(260, 30), RAIO);
    expect(semRegistro.alca).toBeNull();
    expect(semRegistro.recado).toMatch(/mexida à mão/);
  });

  it('com a alça escolhida, a prévia mostra a curva como ficaria com ela apontando para o mouse', () => {
    const peca = comCurva();
    const alca = { curvaId: 'c1', indice: -1, tangente: 'inicio' as const };
    const previa = previaDasAlcas(peca, alca, ponto(260, 30))!;

    expect(previa.novo).toEqual(gerarCurva('curva', [DE.ponto, ponto(240, 150), ATE.ponto], undefined, { inicio: ponto(260, 30) }));
    expect(previa.substituido).toEqual(curvasDaPeca(peca)[0]!.pontos);
    expect(previa.linhas).toHaveLength(2);
    // Com o mouse onde a alça não serve, só a curva de agora em destaque.
    const fora = previaDasAlcas(peca, alca, ponto(180, -40))!;
    expect(fora.novo).toBeUndefined();
    expect(fora.substituido).toEqual(curvasDaPeca(peca)[0]!.pontos);
  });

  it('Delete tira a alça posta; na que não foi posta, só avisa', () => {
    const peca = comCurva();
    const alca = { curvaId: 'c1', indice: -1, tangente: 'inicio' as const };
    const naoPosta = apagarAlca([peca], peca, alca);
    expect(naoPosta.pecas).toBeUndefined();
    expect(naoPosta.recado).toMatch(/não tem alça de tangente posta/);

    const comAlca = cliqueNaAlca([peca], peca, alca, ponto(260, 30), RAIO).pecas![0]!;
    const tirada = apagarAlca([comAlca], comAlca, alca);
    expect(curvasDaPeca(tirada.pecas![0]!)[0]!.tangentes).toBeUndefined();
    expect(curvasDaPeca(tirada.pecas![0]!)[0]!.pontos).toEqual(curvasDaPeca(peca)[0]!.pontos);
    expect(tirada.recado).toBe('Alça de tangente tirada em “Frente”: a curva voltou a sair dessa ponta na direção do ponto de passagem vizinho.');
    expect(apagarAlca([molde()], molde(), alca).recado).toMatch(/mexida à mão/);
  });

  it('a instrução é a da alça escolhida, e o aviso só fala das alças de tangente quando há curva que as tem', () => {
    expect(instrucaoComAlca({ curvaId: 'c1', indice: 1 })).toBe(INSTRUCAO_COM_ALCA);
    expect(instrucaoComAlca({ curvaId: 'c1', indice: -1, tangente: 'fim' })).toBe(INSTRUCAO_COM_TANGENTE);
    expect(INSTRUCAO_COM_TANGENTE).toMatch(/o comprimento não conta\)\. Delete tira a alça\.$/);
    expect(avisoDasAlcas(comArco())).toMatch(/põem um ponto de passagem ali\.$/);
  });
});
