import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { cercaEntre, moverDentroDaCerca, TODAS_AS_OPCOES_DA_CERCA } from './cerca';
import { cortarMolde, desdobrarMolde, dobrarMolde, unirMoldes } from './corteEUniao';
import { dividirLinha, estenderReta, moverElemento, removerElemento } from './elementos';
import { definirRegra } from './graduacao';
import { comprimentoDasLinhasAuxiliares, ehElemento, elementosDaPeca, elementosLevados, linhasDoMolde, tornarAuxiliares, tornarElementos } from './linhasAuxiliares';
import { criarMolde, dimensionarMolde, espelharMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { giroEDeslocamento, levarOQueEstaNasRegioes } from './regioes';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm com três linhas internas: uma reta de 160 mm, uma em L de 80 + 100 mm e uma reta de 60 mm.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const RETA = [ponto(20, 50), ponto(180, 50)];
const EM_L = [ponto(20, 100), ponto(100, 100), ponto(100, 200)];
const CURTA = [ponto(150, 220), ponto(150, 280)];
const molde = (extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: RETANGULO, linhasInternas: [RETA, EM_L, CURTA], linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 280) } }, 'f'),
  ...extra,
});
const esperarLinha = (linha: readonly Ponto2D[], esperada: readonly Ponto2D[]): void => {
  expect(linha).toHaveLength(esperada.length);
  linha.forEach((p, i) => {
    expect(p.x).toBeCloseTo(esperada[i]!.x, 6);
    expect(p.y).toBeCloseTo(esperada[i]!.y, 6);
  });
};

describe('linhas auxiliares e elementos', () => {
  it('toda linha interna nasce fazendo parte do molde', () => {
    const peca = molde();

    expect(elementosDaPeca(peca)).toEqual([]);
    expect(linhasDoMolde(peca)).toEqual([RETA, EM_L, CURTA]);
    expect(comprimentoDasLinhasAuxiliares(peca)).toBeCloseTo(160 + 180 + 60, 9);
    expect([0, 1, 2, 3, -1].map((i) => ehElemento(peca, i))).toEqual([false, false, false, false, false]);
  });

  it('“Remover”: a linha passa a ser só de construção — continua na peça, mas fora das linhas do molde', () => {
    const peca = molde();
    const feita = tornarElementos(peca, [1]);

    expect(feita.elementos).toEqual([EM_L]);
    expect(feita.linhasInternas).toEqual([RETA, EM_L, CURTA]);
    expect(elementosDaPeca(feita)).toEqual([1]);
    expect(linhasDoMolde(feita)).toEqual([RETA, CURTA]);
    expect(comprimentoDasLinhasAuxiliares(feita)).toBeCloseTo(160 + 60, 9);
    // A peça de antes não muda, e o resto da nova é o mesmo.
    expect(peca.elementos).toBeUndefined();
    expect({ ...feita, elementos: undefined }).toEqual({ ...peca, elementos: undefined });
    // Outra linha removida depois se soma ao registro.
    expect(tornarElementos(feita, [2]).elementos).toEqual([EM_L, CURTA]);
  });

  it('a mesma linha não entra duas vezes no registro, e o número que não existe não faz nada', () => {
    const duasVezes = tornarElementos(tornarElementos(molde(), [1]), [1, 1]);
    expect(duasVezes.elementos).toEqual([EM_L]);

    const nada = tornarElementos(molde(), [7, -1]);
    expect('elementos' in nada).toBe(false);
    expect(tornarAuxiliares(tornarElementos(molde(), [0]), [7]).elementos).toEqual([RETA]);
  });

  it('“Adicionar”: o elemento volta a fazer parte do molde; sem nenhum, a peça fica sem o registro', () => {
    const dois = tornarElementos(molde(), [0, 2]);
    expect(elementosDaPeca(dois)).toEqual([0, 2]);

    const um = tornarAuxiliares(dois, [2]);
    expect(um.elementos).toEqual([RETA]);
    expect(linhasDoMolde(um)).toEqual([EM_L, CURTA]);
    // A linha que já fazia parte do molde continua como estava.
    expect(tornarAuxiliares(um, [1]).elementos).toEqual([RETA]);

    const nenhum = tornarAuxiliares(um, [0]);
    expect('elementos' in nenhum).toBe(false);
    expect(linhasDoMolde(nenhum)).toEqual([RETA, EM_L, CURTA]);
  });

  it('a linha é reconhecida pelos pontos, num sentido ou no outro', () => {
    const aoContrario = molde({ elementos: [[...EM_L].reverse()] });
    expect(elementosDaPeca(aoContrario)).toEqual([1]);
    // Tirada pelo número da linha, sai o registro guardado ao contrário.
    expect('elementos' in tornarAuxiliares(aoContrario, [1])).toBe(false);

    // Um ponto a mais, ou um ponto fora do lugar, já não é a mesma linha.
    expect(elementosDaPeca(molde({ elementos: [[...EM_L, ponto(100, 250)]] }))).toEqual([]);
    expect(elementosDaPeca(molde({ elementos: [[ponto(20, 100), ponto(100, 100.001), ponto(100, 200)]] }))).toEqual([]);
    // Os mesmos pontos em outra ordem, que não seja a inversa, também não.
    expect(elementosDaPeca(molde({ elementos: [[ponto(100, 100), ponto(20, 100), ponto(100, 200)]] }))).toEqual([]);
  });

  it('a linha mexida por outro caminho deixa de casar com o registro e volta a sair no molde', () => {
    const feita = tornarElementos(molde(), [1]);
    const mexida: Molde = { ...feita, linhasInternas: [RETA, [ponto(20, 100), ponto(100, 100), ponto(100, 210)], CURTA] };

    expect(elementosDaPeca(mexida)).toEqual([]);
    expect(linhasDoMolde(mexida)).toHaveLength(3);
    // A conversão seguinte limpa do registro o que já não é linha da peça.
    expect(tornarElementos(mexida, [0]).elementos).toEqual([RETA]);
  });
});

describe('o elemento continua elemento quando a peça é transformada', () => {
  const comElemento = (): Molde => tornarElementos(molde(), [1]);

  it('mover, girar, espelhar e dimensionar a peça levam o registro junto', () => {
    const peca = comElemento();
    const transformadas = [transladarMolde(peca, ponto(30, -10), 'a'), rotacionarMolde(peca, 37), espelharMolde(peca, 'b'), dimensionarMolde(peca, 1.2, 0.8)];

    for (const transformada of transformadas) {
      expect(elementosDaPeca(transformada)).toEqual([1]);
      expect(transformada.linhasInternas[1]).not.toEqual(EM_L);
      expect(linhasDoMolde(transformada)).toHaveLength(2);
    }
  });

  it('em cada tamanho da peça graduada o elemento é o mesmo', () => {
    // A peça cresce 10% em x e 20% em y no G: as linhas internas acompanham na proporção.
    const comTamanhos = definirTamanhosDoMolde(comElemento(), ['M', 'G'], 'M');
    let graduacao = comTamanhos.graduacao!;
    RETANGULO.forEach((p, i) => {
      graduacao = definirRegra(graduacao, RETANGULO, i, [ponto(0, 0), ponto(p.x * 0.1, p.y * 0.2)]);
    });
    const noG = moldeDoTamanho({ ...comTamanhos, graduacao }, 1, 'g');

    esperarLinha(noG.linhasInternas[1]!, [ponto(22, 120), ponto(110, 120), ponto(110, 240)]);
    expect(elementosDaPeca(noG)).toEqual([1]);
  });

  it('a parte da peça que anda (numa pence, numa prega) leva o elemento que está nela', () => {
    // A metade de cima (y > 150) anda 10 mm em y: a linha curta está nela; a em L, não.
    const peca = tornarElementos(molde(), [1, 2]);
    const levada = levarOQueEstaNasRegioes(peca, [[ponto(0, 150), ponto(200, 150), ponto(200, 300), ponto(0, 300)]], [[ponto(200, 300), ponto(0, 300)]], [[ponto(0, 0), ponto(200, 0)]], giroEDeslocamento(ponto(0, 0), 0, ponto(0, 10)));

    esperarLinha(levada.linhasInternas[2]!, [ponto(150, 230), ponto(150, 290)]);
    expect(levada.linhasInternas[1]).toEqual(EM_L);
    expect(elementosDaPeca(levada)).toEqual([1, 2]);
  });
});

describe('o elemento continua elemento quando a linha dele é mexida pelas ferramentas de elementos', () => {
  it('mover o elemento, ou esticar a ponta dele', () => {
    const peca = tornarElementos(molde(), [0]);

    const movida = moverElemento(peca, { tipo: 'linha', indice: 0 }, ponto(5, 7));
    esperarLinha(movida.linhasInternas[0]!, [ponto(25, 57), ponto(185, 57)]);
    expect(elementosDaPeca(movida)).toEqual([0]);

    const esticada = estenderReta(peca, 0, 'fim', 10);
    esperarLinha(esticada.linhasInternas[0]!, [ponto(20, 50), ponto(190, 50)]);
    expect(elementosDaPeca(esticada)).toEqual([0]);
    // Mexer numa linha que faz parte do molde não a torna elemento.
    expect(elementosDaPeca(moverElemento(peca, { tipo: 'linha', indice: 2 }, ponto(5, 7)))).toEqual([0]);
  });

  it('dividido, o elemento vira dois; e os que vêm depois da linha dividida continuam sendo os mesmos', () => {
    const doMeio = tornarElementos(molde(), [1]);
    const dividido = dividirLinha(doMeio, 1, ponto(60, 100));
    expect(dividido.linhasInternas).toHaveLength(4);
    expect(elementosDaPeca(dividido)).toEqual([1, 2]);

    // Dividida uma linha do molde, o elemento de depois dela passa um número adiante — e o de antes fica onde estava.
    const pontas = tornarElementos(molde(), [0, 2]);
    const outro = dividirLinha(pontas, 1, ponto(60, 100));
    expect(elementosDaPeca(outro)).toEqual([0, 3]);
    expect(outro.linhasInternas[3]).toEqual(CURTA);
  });

  it('apagado o elemento, as outras linhas continuam fazendo parte do molde', () => {
    const peca = tornarElementos(molde(), [0]);
    const sem = removerElemento(peca, { tipo: 'linha', indice: 0 });

    expect(elementosDaPeca(sem)).toEqual([]);
    expect(linhasDoMolde(sem)).toEqual([EM_L, CURTA]);
  });

  it('a cerca que leva uma ponta do elemento não o tira do registro', () => {
    const peca = tornarElementos(molde(), [0]);
    // A cerca pega só a ponta (180, 50) da reta e a leva 10 mm em y.
    const movida = moverDentroDaCerca(peca, cercaEntre(ponto(170, 40), ponto(190, 60)), ponto(0, 10), { ...TODAS_AS_OPCOES_DA_CERCA, pontosDoContorno: false });

    esperarLinha(movida.linhasInternas[0]!, [ponto(20, 50), ponto(180, 60)]);
    expect(elementosDaPeca(movida)).toEqual([0]);
  });

  it('sem registro, levar os elementos devolve a peça como veio', () => {
    const antes = molde();
    const depois: Molde = { ...antes, linhasInternas: [RETA] };

    expect(elementosLevados(antes, depois)).toBe(depois);
    // Com registro, a linha que não existe mais não entra nele.
    expect('elementos' in elementosLevados(tornarElementos(antes, [2]), depois)).toBe(false);
  });
});

describe('o elemento continua elemento quando a peça é cortada, dobrada, desdobrada ou unida a outra', () => {
  // A reta do corte e da dobra: de (200, 150) a (0, 150). A reta (y = 50) e a em L ficam embaixo; a curta, em cima.
  const NA_DIREITA = { indiceAresta: 1, ponto: ponto(200, 150) };
  const NA_ESQUERDA = { indiceAresta: 3, ponto: ponto(0, 150) };
  const ids = (): (() => string) => {
    let n = 0;
    return () => 'n' + ++n;
  };
  const elementosDe = (peca: Molde): (readonly Ponto2D[])[] => elementosDaPeca(peca).map((i) => peca.linhasInternas[i]!);

  it('cortada a peça, cada parte fica com os elementos que estão nela', () => {
    const partes = cortarMolde(tornarElementos(molde(), [0, 2]), NA_DIREITA, NA_ESQUERDA, 'outra');

    expect(partes.map((parte) => parte.linhasInternas.length).sort()).toEqual([1, 2]);
    expect(partes.flatMap(elementosDe)).toHaveLength(2);
    expect(partes.flatMap(elementosDe)).toEqual(expect.arrayContaining([RETA, CURTA]));
    // A em L, que faz parte do molde, continua fazendo.
    expect(partes.flatMap(linhasDoMolde)).toEqual([EM_L]);
  });

  it('dobrada com a metade guardada, o elemento que foi com ela volta elemento no desdobrar — mesmo com outra linha convertida no meio', () => {
    const dobrada = dobrarMolde(tornarElementos(molde(), [2]), NA_DIREITA, NA_ESQUERDA, ponto(100, 50), { manter: true, fioNoCentro: false });
    expect(dobrada.linhasInternas).toEqual([RETA, EM_L]);
    expect(elementosDaPeca(dobrada)).toEqual([]);

    // Enquanto está dobrada: a reta vira elemento, e depois é esticada.
    const mexida = estenderReta(tornarElementos(dobrada, [0]), 0, 'fim', 10);
    expect(elementosDaPeca(mexida)).toEqual([0]);
    const naDobra = mexida.contorno.findIndex((p, i) => p.y === 150 && mexida.contorno[(i + 1) % mexida.contorno.length]!.y === 150);
    const inteira = desdobrarMolde(mexida, naDobra, ids());

    expect(inteira.linhasInternas).toHaveLength(4);
    expect(elementosDe(inteira)).toEqual([[ponto(20, 50), ponto(190, 50)], CURTA]);
  });

  it('desdobrada pelo espelho, a cópia do elemento também é elemento; a linha de centro faz parte do molde', () => {
    // A aresta 0 (y = 0) é a dobra: a outra metade é a peça espelhada para o y negativo.
    const inteira = desdobrarMolde(tornarElementos(molde(), [0]), 0, ids());

    expect(inteira.linhasInternas).toHaveLength(7);
    expect(elementosDe(inteira)).toEqual([RETA, [ponto(20, -50), ponto(180, -50)]]);
    expect(linhasDoMolde(inteira)).toHaveLength(5);
    // Sem elemento na peça, a desdobrada fica sem o registro.
    expect('elementos' in desdobrarMolde(molde(), 0, ids())).toBe(false);
  });

  it('unidas duas peças, os elementos das duas continuam elementos', () => {
    const DA_OUTRA = [ponto(220, 50), ponto(380, 50)];
    const outra = (extra: Partial<Molde> = {}): Molde => ({
      ...criarMolde({ nome: 'Lado', referencia: 'R', tamanho: 'M', contorno: [ponto(200, 0), ponto(400, 0), ponto(400, 300), ponto(200, 300)], linhasInternas: [DA_OUTRA], linhaDeFio: { inicio: ponto(300, 20), fim: ponto(300, 280) } }, 'l'),
      ...extra,
    });

    // A aresta 1 da primeira (x = 200) com a aresta 3 da segunda (x = 200): já estão encostadas.
    const unida = unirMoldes(tornarElementos(molde(), [0]), 1, tornarElementos(outra(), [0]), 3);
    expect(unida.linhasInternas).toHaveLength(4);
    expect(elementosDe(unida)).toEqual([RETA, DA_OUTRA]);
    // Só uma delas com elemento; e nenhuma.
    expect(elementosDe(unirMoldes(molde(), 1, tornarElementos(outra(), [0]), 3))).toEqual([DA_OUTRA]);
    expect(elementosDe(unirMoldes(tornarElementos(molde(), [0]), 1, outra(), 3))).toEqual([RETA]);
    expect('elementos' in unirMoldes(molde(), 1, outra(), 3)).toBe(false);
  });
});
