import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { tornarElementos, elementosDaPeca } from './linhasAuxiliares';
import { FOLGA_DA_LINHA_QUE_SAI_MM, FOLGA_DA_LINHA_SOLTA_MM, linhasQueSaem, linhasSoltas, semLinhasQueSaem, semLinhasSoltas } from './linhasSoltas';
import { criarMolde, type Molde } from './molde';

// Um L: o retângulo de 200 × 300 mm sem o canto de cima à direita (de x 100 a 200, de y 150 a 300).
const EM_L = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(100, 150), ponto(100, 300), ponto(0, 300)];
const molde = (linhasInternas: readonly (readonly Ponto2D[])[]): Molde =>
  criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: EM_L, linhasInternas, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 280) } }, 'f');

const DENTRO = [ponto(20, 50), ponto(180, 50)];
const ATRAVESSA = [ponto(-50, 100), ponto(250, 100)];
const ENCOSTADA = [ponto(200, 20), ponto(260, 20)];
const PERTO = [ponto(205, 20), ponto(205, 120)];
const LONGE = [ponto(1500, 100), ponto(1500, 300), ponto(1600, 300)];
// No vão do L: dentro da caixa da peça, mas fora dela, a 50 mm das duas bordas do vão.
const NO_VAO = [ponto(150, 200), ponto(150, 280)];

describe('linhas internas soltas', () => {
  it('a linha de dentro, a que atravessa a borda, a que encosta nela e a que passa perto pelo lado de fora não são soltas', () => {
    expect(linhasSoltas(molde([DENTRO, ATRAVESSA, ENCOSTADA, PERTO]))).toEqual([]);
    // A que passa por cima da peça com as duas pontas longe dela também não: ela cruza o contorno.
    expect(linhasSoltas(molde([[ponto(-500, 100), ponto(900, 100)]]))).toEqual([]);
  });

  it('a linha inteira do lado de fora, a mais de 10 mm do contorno, é solta — mesmo dentro da caixa da peça', () => {
    const soltas = linhasSoltas(molde([DENTRO, LONGE, NO_VAO]));

    expect(soltas.map((s) => s.indice)).toEqual([1, 2]);
    // A de longe está a 1300 mm do canto (200, 100..150) mais perto; a do vão, a 50 mm das duas bordas dele.
    expect(soltas[0]!.distanciaMm).toBeCloseTo(1300, 6);
    expect(soltas[1]!.distanciaMm).toBeCloseTo(50, 6);
    expect(FOLGA_DA_LINHA_SOLTA_MM).toBe(10);
  });

  it('a folga decide: a 5 mm da borda não é solta com a folga de 10, e é com a de 4', () => {
    expect(linhasSoltas(molde([PERTO]))).toEqual([]);
    expect(linhasSoltas(molde([PERTO]), 4).map((s) => [s.indice, s.distanciaMm])).toEqual([[0, 5]]);
    // Exatamente na folga ainda não é solta.
    expect(linhasSoltas(molde([PERTO]), 5)).toEqual([]);
  });

  it('a linha de um ponto só também conta, e a vazia não', () => {
    const soltas = linhasSoltas(molde([[ponto(1000, 0)], [], [ponto(50, 50)]]));

    expect(soltas).toEqual([{ indice: 0, distanciaMm: 800 }]);
  });

  it('tirar as soltas deixa as outras como estavam, e a peça sem nenhuma é devolvida como veio', () => {
    const peca = tornarElementos(molde([DENTRO, LONGE, ATRAVESSA, NO_VAO]), [0, 1]);
    const limpa = semLinhasSoltas(peca);

    expect(limpa.linhasInternas).toEqual([DENTRO, ATRAVESSA]);
    // A linha de construção que ficou continua de construção.
    expect(elementosDaPeca(limpa)).toEqual([0]);
    expect(limpa.contorno).toBe(peca.contorno);
    const semSoltas = molde([DENTRO, ATRAVESSA]);
    expect(semLinhasSoltas(semSoltas)).toBe(semSoltas);
    expect(linhasSoltas({ ...semSoltas, contorno: [ponto(0, 0), ponto(1, 1)] })).toEqual([]);
  });
});

describe('linhas internas que saem da peça', () => {
  // Uma moldura fechada de 1,5 m, que passa por dentro da peça e vai longe: sobra típica de importação.
  const MOLDURA = [ponto(50, 50), ponto(1500, 50), ponto(1500, 1500), ponto(50, 1500), ponto(50, 50)];
  // Uma linha de construção que passa 80 mm da borda de baixo: não chega aos 100 mm.
  const PROLONGADA = [ponto(50, 100), ponto(50, -80)];
  // Uma que começa a 5 mm da borda, do lado de fora, e vai a 600 mm: não é solta (está junto da peça), mas sai.
  const DE_FORA_E_LONGE = [ponto(205, 20), ponto(800, 20)];

  it('a linha que tem parte na peça e vai a mais de 100 mm da caixa dela sai da peça; a que passa pouco da borda, não', () => {
    const saem = linhasQueSaem(molde([DENTRO, MOLDURA, PROLONGADA, DE_FORA_E_LONGE, ATRAVESSA]));

    expect(saem.map((s) => s.indice)).toEqual([1, 3]);
    // A moldura vai até (1500, 1500): a 1772 mm do canto (200, 150)… o ponto do contorno mais perto é (100, 300): hipotenusa de 1400 e 1200.
    expect(saem[0]!.distanciaMm).toBeCloseTo(Math.hypot(1400, 1200), 6);
    expect(saem[1]!.distanciaMm).toBeCloseTo(600, 6);
    expect(FOLGA_DA_LINHA_QUE_SAI_MM).toBe(100);
  });

  it('a linha solta não é contada de novo aqui, e a folga decide', () => {
    expect(linhasQueSaem(molde([LONGE]))).toEqual([]);
    expect(linhasSoltas(molde([LONGE])).map((s) => s.indice)).toEqual([0]);
    // Com a folga de 50, a prolongada (80 mm para fora) passa a sair; exatamente na folga, ainda não.
    expect(linhasQueSaem(molde([PROLONGADA]), 50).map((s) => s.indice)).toEqual([0]);
    expect(linhasQueSaem(molde([PROLONGADA]), 80)).toEqual([]);
    // Cada lado da caixa conta: para a esquerda, para a direita, para baixo e para cima.
    const paraOsQuatroLados = [[ponto(10, 10), ponto(-150, 10)], [ponto(10, 10), ponto(350, 10)], [ponto(10, 10), ponto(10, -150)], [ponto(10, 10), ponto(10, 450)]];
    expect(linhasQueSaem(molde(paraOsQuatroLados)).map((s) => s.indice)).toEqual([0, 1, 2, 3]);
  });

  it('tirar as que saem remove cada uma inteira, e só elas', () => {
    const peca = molde([DENTRO, MOLDURA, PROLONGADA, LONGE]);
    const limpa = semLinhasQueSaem(peca);

    // A solta fica: quem a tira é o outro.
    expect(limpa.linhasInternas).toEqual([DENTRO, PROLONGADA, LONGE]);
    expect(semLinhasSoltas(limpa).linhasInternas).toEqual([DENTRO, PROLONGADA]);
    const semNenhuma = molde([DENTRO, PROLONGADA]);
    expect(semLinhasQueSaem(semNenhuma)).toBe(semNenhuma);
    expect(linhasQueSaem({ ...semNenhuma, contorno: [ponto(0, 0), ponto(1, 1)] })).toEqual([]);
  });

  it('tirar segue a folga pedida, nas soltas e nas que saem', () => {
    expect(semLinhasSoltas(molde([DENTRO, PERTO]), 4).linhasInternas).toEqual([DENTRO]);
    expect(semLinhasSoltas(molde([DENTRO, PERTO])).linhasInternas).toEqual([DENTRO, PERTO]);
    expect(semLinhasQueSaem(molde([DENTRO, PROLONGADA]), 50).linhasInternas).toEqual([DENTRO]);
    expect(semLinhasQueSaem(molde([DENTRO, PROLONGADA])).linhasInternas).toEqual([DENTRO, PROLONGADA]);
  });
});
