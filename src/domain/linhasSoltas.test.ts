import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { tornarElementos, elementosDaPeca } from './linhasAuxiliares';
import { FOLGA_FORA_DA_PECA_MM, linhasQueSaem, linhasSoltas, semLinhasQueSaem, semLinhasSoltas, semOQueSaiDasLinhas } from './linhasSoltas';
import { criarMolde, type Molde } from './molde';

type Linha = readonly Ponto2D[];

// Um L: o retângulo de 200 × 300 mm sem o canto de cima à direita (de x 100 a 200, de y 150 a 300).
const EM_L = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(100, 150), ponto(100, 300), ponto(0, 300)];
const molde = (linhasInternas: readonly Linha[], margemDeCosturaMm = 0): Molde =>
  criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: EM_L, linhasInternas, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 280) }, margemDeCosturaMm }, 'f');
/** As linhas com as coordenadas em milésimos de milímetro (a conta do cruzamento deixa poeira na última casa). */
const emMilesimos = (linhas: readonly Linha[]): number[][][] => linhas.map((linha) => linha.map((p) => [Math.round(p.x * 1000) / 1000 + 0, Math.round(p.y * 1000) / 1000 + 0]));
const indices = (linhas: { indice: number }[]): number[] => linhas.map((linha) => linha.indice);

const DENTRO = [ponto(20, 50), ponto(180, 50)];
const NA_BORDA = [ponto(0, 50), ponto(0, 250)];
const ACABA_NA_BORDA = [ponto(50, 100), ponto(200, 100)];
// Passa 0,8 mm da borda de baixo: é o que sobra de um traço que acaba nela.
const PASSA_UM_NADA = [ponto(50, 100), ponto(50, -0.8)];
const PASSA = [ponto(50, 100), ponto(50, -3)];
const ATRAVESSA = [ponto(-50, 100), ponto(250, 100)];
const ENCOSTADA = [ponto(200, 20), ponto(260, 20)];
const PERTO = [ponto(205, 20), ponto(205, 120)];
const LONGE = [ponto(1500, 100), ponto(1500, 300), ponto(1600, 300)];
// No vão do L: dentro da caixa da peça, mas fora dela, a 50 mm das duas bordas do vão.
const NO_VAO = [ponto(150, 200), ponto(150, 280)];
// Sai pelo vão do L e volta: de dentro, vai até o meio do vão e desce para dentro de novo.
const PELO_VAO = [ponto(50, 200), ponto(150, 200), ponto(150, 100)];
// Uma moldura fechada de 1,5 m, que passa por dentro da peça e vai longe: sobra típica de importação.
const MOLDURA = [ponto(50, 50), ponto(1500, 50), ponto(1500, 1500), ponto(50, 1500), ponto(50, 50)];

describe('linhas internas que saem da peça', () => {
  it('a linha de dentro, a que corre na borda, a que acaba nela e a que passa menos de 1 mm não saem', () => {
    const peca = molde([DENTRO, NA_BORDA, ACABA_NA_BORDA, PASSA_UM_NADA]);

    expect(linhasQueSaem(peca)).toEqual([]);
    expect(linhasSoltas(peca)).toEqual([]);
    expect(FOLGA_FORA_DA_PECA_MM).toBe(1);
  });

  it('a que tem parte dentro e parte fora sai da peça, por pouco que passe; e diz até onde vai', () => {
    const saem = linhasQueSaem(molde([DENTRO, PASSA, ATRAVESSA, PELO_VAO, MOLDURA]));

    expect(indices(saem)).toEqual([1, 2, 3, 4]);
    expect(saem[0]!.distanciaMm).toBeCloseTo(3, 6);
    expect(saem[1]!.distanciaMm).toBeCloseTo(50, 6);
    // Pelo vão: o ponto mais afastado é a quina da linha, a 50 mm das duas bordas do vão.
    expect(saem[2]!.distanciaMm).toBeCloseTo(50, 6);
    // A moldura vai até (1500, 1500); o ponto da borda mais perto é (100, 300).
    expect(saem[3]!.distanciaMm).toBeCloseTo(Math.hypot(1400, 1200), 6);
  });

  it('a folga decide: exatamente nela ainda não sai', () => {
    expect(indices(linhasQueSaem(molde([PASSA]), 2.99))).toEqual([0]);
    expect(linhasQueSaem(molde([PASSA]), 3)).toEqual([]);
    expect(linhasQueSaem(molde([PELO_VAO]), 50)).toEqual([]);
    expect(indices(linhasQueSaem(molde([PASSA_UM_NADA]), 0.5))).toEqual([0]);
  });

  it('com margem de costura, a borda da peça é a linha de corte', () => {
    const passaOito = [ponto(50, 100), ponto(50, -8)];
    const passaQuinze = [ponto(50, 100), ponto(50, -15)];

    expect(linhasQueSaem(molde([passaOito, passaQuinze]))).toHaveLength(2);
    const comMargem = linhasQueSaem(molde([passaOito, passaQuinze], 10));
    expect(indices(comMargem)).toEqual([1]);
    // Da linha de corte, a 10 mm do contorno, até a ponta da linha.
    expect(comMargem[0]!.distanciaMm).toBeCloseTo(5, 6);
    expect(emMilesimos(semOQueSaiDasLinhas(molde([passaOito, passaQuinze], 10)).linhasInternas)).toEqual([
      [
        [50, 100],
        [50, -8],
      ],
      [
        [50, 100],
        [50, -10],
      ],
    ]);
  });
});

describe('linhas internas soltas', () => {
  it('a linha sem parte nenhuma na peça é solta: a de longe, a de perto, a que só encosta na borda e a do vão do L', () => {
    const soltas = linhasSoltas(molde([DENTRO, LONGE, PERTO, ENCOSTADA, NO_VAO, ATRAVESSA]));

    expect(indices(soltas)).toEqual([1, 2, 3, 4]);
    // Até onde cada uma vai: a de longe, até (1600, 300), a 1400 e 150 do canto (200, 150).
    expect(soltas[0]!.distanciaMm).toBeCloseTo(Math.hypot(1400, 150), 6);
    expect(soltas[1]!.distanciaMm).toBeCloseTo(5, 6);
    expect(soltas[2]!.distanciaMm).toBeCloseTo(60, 6);
    expect(soltas[3]!.distanciaMm).toBeCloseTo(50, 6);
    // E nenhuma delas é contada de novo entre as que saem.
    expect(indices(linhasQueSaem(molde([DENTRO, LONGE, PERTO, ENCOSTADA, NO_VAO, ATRAVESSA])))).toEqual([5]);
  });

  it('a linha que corre pela borda e sai, sem entrar na peça, também é solta: não há o que guardar dela', () => {
    // Uma moldura com dois lados em cima da borda da peça (o da esquerda e o de baixo) e o resto longe.
    const molduraNaBorda = [ponto(0, 300), ponto(0, 0), ponto(200, 0), ponto(1500, 0), ponto(1500, 1500), ponto(0, 1500), ponto(0, 300)];
    // E um traço que entra meio milímetro na peça e sai 30 mm.
    const entraUmNada = [ponto(50, 0.5), ponto(50, -30)];
    const peca = molde([DENTRO, molduraNaBorda, entraUmNada]);

    const soltas = linhasSoltas(peca);
    expect(indices(soltas)).toEqual([1, 2]);
    expect(soltas[0]!.distanciaMm).toBeCloseTo(Math.hypot(1400, 1200), 6);
    expect(soltas[1]!.distanciaMm).toBeCloseTo(30, 6);
    expect(linhasQueSaem(peca)).toEqual([]);
    expect(semOQueSaiDasLinhas(peca)).toBe(peca);
    expect(semLinhasSoltas(peca).linhasInternas).toEqual([DENTRO]);
    // Com a folga menor que meio milímetro, o traço passa a ter parte dentro: sai, e pode ser cortado.
    expect(indices(linhasQueSaem(peca, 0.4))).toEqual([2]);
  });

  it('a folga decide: a 5 mm da borda não é solta com a folga de 5, e é com a de 4,99', () => {
    expect(linhasSoltas(molde([PERTO]), 5)).toEqual([]);
    expect(indices(linhasSoltas(molde([PERTO]), 4.99))).toEqual([0]);
  });

  it('a linha de um ponto só também conta, e a vazia não', () => {
    const soltas = linhasSoltas(molde([[ponto(1000, 0)], [], [ponto(50, 50)], [ponto(200.5, 20)], [ponto(150, 200), ponto(150, 200)], [ponto(201, 20)]]));

    expect(soltas).toEqual([
      { indice: 0, distanciaMm: 800 },
      { indice: 4, distanciaMm: 50 },
    ]);
  });

  it('a distância dita é a do ponto mais afastado da linha, mesmo que ele não seja uma ponta dela', () => {
    // Um U; a linha passa por cima da boca dele, 5 mm acima dos dois braços. No meio da boca (x 30), os cantos mais perto estão a 10 e 5.
    // A linha vai de x 5 a 45: o ponto mais afastado não é uma ponta dela, nem o meio dela.
    const emU = [ponto(0, 0), ponto(60, 0), ponto(60, 40), ponto(40, 40), ponto(40, 10), ponto(20, 10), ponto(20, 40), ponto(0, 40)];
    const peca = criarMolde({ nome: 'U', referencia: 'R', tamanho: 'M', contorno: emU, linhasInternas: [[ponto(5, 45), ponto(45, 45)]], linhaDeFio: { inicio: ponto(10, 5), fim: ponto(50, 5) } }, 'u');

    expect(linhasSoltas(peca)[0]!.distanciaMm).toBeCloseTo(Math.hypot(10, 5), 2);
  });

  it('a linha fechada inteira fora da peça é solta, num trecho só', () => {
    const fechadaLonge = [ponto(1500, 100), ponto(1600, 100), ponto(1600, 200), ponto(1500, 100)];

    expect(indices(linhasSoltas(molde([fechadaLonge])))).toEqual([0]);
    expect(semLinhasSoltas(molde([DENTRO, fechadaLonge])).linhasInternas).toEqual([DENTRO]);
  });

  it('a peça sem contorno de verdade não tem linha solta nem que sai', () => {
    const semContorno = { ...molde([DENTRO, LONGE, ATRAVESSA]), contorno: [ponto(0, 0), ponto(1, 1)] };

    expect(linhasSoltas(semContorno)).toEqual([]);
    expect(linhasQueSaem(semContorno)).toEqual([]);
    expect(semLinhasSoltas(semContorno)).toBe(semContorno);
  });
});

describe('tirar as linhas de fora', () => {
  it('tirar as soltas deixa as outras como estavam, e a peça sem nenhuma é devolvida como veio', () => {
    const peca = tornarElementos(molde([DENTRO, LONGE, ATRAVESSA, NO_VAO]), [0, 1]);
    const limpa = semLinhasSoltas(peca);

    expect(limpa.linhasInternas).toEqual([DENTRO, ATRAVESSA]);
    // A linha de construção que ficou continua de construção; a que saiu, sai também do registro.
    expect(elementosDaPeca(limpa)).toEqual([0]);
    expect(limpa.elementos).toEqual([DENTRO]);
    expect(limpa.contorno).toBe(peca.contorno);
    const semSoltas = molde([DENTRO, ATRAVESSA]);
    expect(semLinhasSoltas(semSoltas)).toBe(semSoltas);
  });

  it('tirar as que saem remove cada uma inteira, e só elas', () => {
    const peca = molde([DENTRO, MOLDURA, PASSA_UM_NADA, LONGE]);
    const limpa = semLinhasQueSaem(peca);

    // A solta fica: quem a tira é o outro.
    expect(limpa.linhasInternas).toEqual([DENTRO, PASSA_UM_NADA, LONGE]);
    expect(semLinhasSoltas(limpa).linhasInternas).toEqual([DENTRO, PASSA_UM_NADA]);
    const semNenhuma = molde([DENTRO, PASSA_UM_NADA, LONGE]);
    expect(semLinhasQueSaem(semNenhuma)).toBe(semNenhuma);
  });

  it('tirar segue a folga pedida, nas soltas e nas que saem', () => {
    expect(semLinhasSoltas(molde([DENTRO, PERTO]), 10).linhasInternas).toEqual([DENTRO, PERTO]);
    expect(semLinhasSoltas(molde([DENTRO, PERTO])).linhasInternas).toEqual([DENTRO]);
    expect(semLinhasQueSaem(molde([DENTRO, PASSA]), 10).linhasInternas).toEqual([DENTRO, PASSA]);
    expect(semLinhasQueSaem(molde([DENTRO, PASSA])).linhasInternas).toEqual([DENTRO]);
    expect(semOQueSaiDasLinhas(molde([DENTRO, PASSA]), 10).linhasInternas).toEqual([DENTRO, PASSA]);
  });
});

describe('tirar só o que está fora', () => {
  it('corta a linha na borda e tira o trecho de fora; o que está dentro fica', () => {
    const limpa = semOQueSaiDasLinhas(molde([DENTRO, PASSA, ATRAVESSA]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [20, 50],
        [180, 50],
      ],
      [
        [50, 100],
        [50, 0],
      ],
      [
        [0, 100],
        [200, 100],
      ],
    ]);
    // A linha que não sai é a mesma de antes, e não uma cópia.
    expect(limpa.linhasInternas[0]).toBe(DENTRO);
    expect(linhasQueSaem(limpa)).toEqual([]);
  });

  it('a linha que sai e volta fica em duas, uma de cada lado; a ordem das outras não muda', () => {
    const limpa = semOQueSaiDasLinhas(molde([PELO_VAO, DENTRO]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, 200],
        [100, 200],
      ],
      [
        [150, 150],
        [150, 100],
      ],
      [
        [20, 50],
        [180, 50],
      ],
    ]);
  });

  it('da moldura fechada fica a parte de dentro, numa linha só, que passa pelo ponto em que ela fechava', () => {
    const limpa = semOQueSaiDasLinhas(molde([MOLDURA]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, 300],
        [50, 50],
        [200, 50],
      ],
    ]);
  });

  it('o trecho de fora que fica junto da borda não é mexido; o cruzamento com a borda não vira ponto no meio da linha', () => {
    // Começa 0,5 mm fora (o que sobra de um traço), entra, e sai 50 mm pela direita.
    const limpa = semOQueSaiDasLinhas(molde([[ponto(50, -0.5), ponto(50, 100), ponto(250, 100)]]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, -0.5],
        [50, 100],
        [200, 100],
      ],
    ]);
  });

  it('a linha que vem de dentro, corre pela borda e sai fica com a parte de dentro e a da borda', () => {
    const limpa = semOQueSaiDasLinhas(molde([[ponto(50, 100), ponto(0, 100), ponto(0, -40)]]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, 100],
        [0, 100],
        [0, 0],
      ],
    ]);
  });

  it('a borda é da peça em qualquer lado dela: de dentro, pela borda de cima, e para fora', () => {
    const limpa = semOQueSaiDasLinhas(molde([[ponto(50, 250), ponto(50, 300), ponto(80, 300), ponto(80, 340)]]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, 250],
        [50, 300],
        [80, 300],
      ],
    ]);
  });

  it('num lado só que atravessa a peça, sai o trecho que vai longe, e o que passa um nada da outra borda fica', () => {
    // Meio milímetro abaixo da borda de baixo, e 100 mm acima da de cima — num sentido e no outro.
    const deBaixoParaCima = [ponto(50, -0.5), ponto(50, 400)];
    const deCimaParaBaixo = [ponto(50, 400), ponto(50, -0.5)];

    expect(emMilesimos(semOQueSaiDasLinhas(molde([deBaixoParaCima, deCimaParaBaixo])).linhasInternas)).toEqual([
      [
        [50, -0.5],
        [50, 300],
      ],
      [
        [50, 300],
        [50, -0.5],
      ],
    ]);
  });

  it('o trecho de fora sai inteiro, da saída pela borda em diante — mesmo a parte dele que corre junto dela', () => {
    // Sai meio milímetro pela direita, desce junto da borda, e só então vai longe.
    const limpa = semOQueSaiDasLinhas(molde([[ponto(50, 100), ponto(200.5, 100), ponto(200.5, 50), ponto(260, 50)]]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, 100],
        [200, 100],
      ],
    ]);
  });

  it('na linha fechada que começa na borda, o que fica de um lado do fecho não se junta ao do outro', () => {
    // Começa na borda da direita, para dentro; desce meio milímetro abaixo da borda de baixo e volta; sai longe pela direita e fecha por fora.
    const comUmNadaDeFora = [ponto(200, 100), ponto(50, 100), ponto(50, -0.5), ponto(60, -0.5), ponto(60, 50), ponto(250, 50), ponto(250, 100), ponto(200, 100)];
    const umaParte = [
      [200, 100],
      [50, 100],
      [50, -0.5],
      [60, -0.5],
      [60, 50],
      [200, 50],
    ];
    expect(emMilesimos(semOQueSaiDasLinhas(molde([comUmNadaDeFora])).linhasInternas)).toEqual([umaParte]);
    expect(emMilesimos(semOQueSaiDasLinhas(molde([[...comUmNadaDeFora].reverse()])).linhasInternas)).toEqual([[...umaParte].reverse()]);

    // Começa na borda, para dentro; sai pelo vão do L e volta; sai longe pela direita e fecha por fora: ficam duas partes.
    const peloVaoEPorFora = [ponto(200, 50), ponto(50, 50), ponto(50, 200), ponto(150, 200), ponto(150, 100), ponto(260, 100), ponto(260, 50), ponto(200, 50)];
    const duasPartes = [
      [
        [200, 50],
        [50, 50],
        [50, 200],
        [100, 200],
      ],
      [
        [150, 150],
        [150, 100],
        [200, 100],
      ],
    ];
    expect(emMilesimos(semOQueSaiDasLinhas(molde([peloVaoEPorFora])).linhasInternas)).toEqual(duasPartes);
    expect(emMilesimos(semOQueSaiDasLinhas(molde([[...peloVaoEPorFora].reverse()])).linhasInternas)).toEqual([[...duasPartes[1]!].reverse(), [...duasPartes[0]!].reverse()]);
  });

  it('o pedaço que sobraria só em cima da borda, solto do resto, sai junto com o de fora', () => {
    // De dentro, sai pela direita, dá a volta por fora e acaba correndo pela borda de baixo, de x 100 a 150.
    const limpa = semOQueSaiDasLinhas(molde([[ponto(50, 100), ponto(250, 100), ponto(250, -20), ponto(100, -20), ponto(100, 0), ponto(150, 0)]]));

    expect(emMilesimos(limpa.linhasInternas)).toEqual([
      [
        [50, 100],
        [200, 100],
      ],
    ]);
  });

  it('na linha fechada, o trecho de fora do fim continua no do começo: sai inteiro', () => {
    // Fecha num ponto 0,5 mm fora da peça. O último lado vem de longe, por fora, até esse ponto.
    const fechada = [ponto(50, -0.5), ponto(50, 100), ponto(300, 100), ponto(300, -0.5), ponto(50, -0.5)];

    expect(emMilesimos(semOQueSaiDasLinhas(molde([fechada])).linhasInternas)).toEqual([
      [
        [50, 0],
        [50, 100],
        [200, 100],
      ],
    ]);
  });

  it('a linha só de construção continua de construção, e as partes dela também', () => {
    const peca = tornarElementos(molde([DENTRO, PELO_VAO, ATRAVESSA]), [1]);
    const limpa = semOQueSaiDasLinhas(peca);

    expect(limpa.linhasInternas).toHaveLength(4);
    expect(elementosDaPeca(limpa)).toEqual([1, 2]);
  });

  it('a solta não é cortada (não sobraria nada): fica para o outro tirar; e a peça sem linha que sai é devolvida como veio', () => {
    const peca = molde([DENTRO, LONGE, ENCOSTADA]);

    expect(semOQueSaiDasLinhas(peca)).toBe(peca);
    expect(semLinhasSoltas(peca).linhasInternas).toEqual([DENTRO]);
  });
});
