import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, rotacionar, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { abrirPence, comPenceReconhecida, criarPence, criarPenceInterna, medidasDaPence, pencesDaPeca, pivoDaPence } from '../domain/pences';
import { criarPregas, medidasDaPrega, pregasDaPeca } from '../domain/pregas';
import {
  aplicarEdicaoDaPence,
  aplicarEdicaoDaPrega,
  dialogoDeEditarPrega,
  aplicarPence,
  cliqueDePence,
  dialogoDaPence,
  dialogoDeEditarPence,
  ehFerramentaDePence,
  instrucaoDaPence,
  lerDialogoDaPence,
  OPCOES_INICIAIS_DAS_PENCES,
  penceCompleta,
  pontasIndicadas,
  penceSemRegistroSobOClique,
  ID_DA_PENCE_RECONHECIDA,
  previaDaPence,
  type FerramentaDePence,
  type OpcoesDasPences,
} from './ferramentasDePence';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';

// Retângulo de 200 × 300 mm, com a linha de fio à esquerda; e o mesmo com uma pence recortada no alto (vértice no ponto 5).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const COM_PENCE = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)];

function molde(contorno = RETANGULO): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } },
    'f',
  );
}

function na(indiceAresta: number, x: number, y: number): PosicaoNoContorno {
  return { indiceAresta, ponto: ponto(x, y) };
}

const noContorno = (posicao: PosicaoNoContorno): CliqueDeTrecho => ({ noContorno: posicao, livre: posicao.ponto });
const solto = (x: number, y: number): CliqueDeTrecho => ({ noContorno: null, livre: ponto(x, y) });
const ids = (): (() => string) => {
  let n = 0;
  return () => `novo-${++n}`;
};

const O = OPCOES_INICIAIS_DAS_PENCES;
const com = (parte: Partial<OpcoesDasPences>): OpcoesDasPences => ({ ...O, ...parte });
const NO_ALTO = na(2, 100, 300);
const VERTICE = na(4, 100, 200);
const TODAS: readonly FerramentaDePence[] = [
  'pence-no-contorno',
  'pence-interna',
  'fechar-pence',
  'transferir-pence',
  'multiplas-pences',
  'pregas',
];

/** Dá os cliques em ordem e devolve o estado final. */
function clicar(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, peca: Molde, cliques: readonly CliqueDeTrecho[]): TrechoEmEdicao {
  return cliques.reduce((estado, clique) => cliqueDePence(ferramenta, opcoes, peca, estado, clique).estado, SEM_TRECHO);
}

describe('quais modos são ferramentas de pence', () => {
  it('reconhece as seis', () => {
    for (const modo of TODAS) expect(ehFerramentaDePence(modo)).toBe(true);
    for (const modo of ['selecionar', 'cortar', 'bainha', 'pence']) expect(ehFerramentaDePence(modo)).toBe(false);
  });
});

describe('os cliques de cada ferramenta', () => {
  it('pence recortada em esquadro: um clique no contorno basta; fora dele, não conta', () => {
    expect(penceCompleta('pence-no-contorno', O, SEM_TRECHO)).toBe(false);
    expect(cliqueDePence('pence-no-contorno', O, molde(), SEM_TRECHO, solto(50, 50)).estado).toBe(SEM_TRECHO);
    const estado = clicar('pence-no-contorno', O, molde(), [noContorno(NO_ALTO)]);
    expect(estado.inicio).toEqual(NO_ALTO);
    expect(penceCompleta('pence-no-contorno', O, estado)).toBe(true);
  });

  it('pence sem o vértice em esquadro: o segundo clique, em qualquer lugar, aponta a pence', () => {
    const opcoes = com({ pence: { ...O.pence, perpendicular: false } });
    const umClique = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO)]);
    expect(penceCompleta('pence-no-contorno', opcoes, umClique)).toBe(false);
    const dois = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO), solto(160, 220)]);
    expect(dois.livres).toEqual([ponto(160, 220)]);
    expect(penceCompleta('pence-no-contorno', opcoes, dois)).toBe(true);
  });

  it('pence aberta: a posição e o pivô, os dois no contorno e diferentes', () => {
    const opcoes = com({ pence: { ...O.pence, modo: 'abrir' } });
    const umClique = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO)]);
    expect(cliqueDePence('pence-no-contorno', opcoes, molde(), umClique, solto(100, 100)).estado).toBe(umClique);
    expect(cliqueDePence('pence-no-contorno', opcoes, molde(), umClique, noContorno(NO_ALTO)).estado).toBe(umClique);
    const dois = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO), noContorno(na(0, 100, 0))]);
    expect(dois.fim).toEqual(na(0, 100, 0));
    expect(penceCompleta('pence-no-contorno', opcoes, dois)).toBe(true);
  });

  it('pence interna: um clique em qualquer lugar', () => {
    const estado = clicar('pence-interna', O, molde(), [solto(100, 150)]);
    expect(estado).toEqual({ inicio: null, fim: null, livres: [ponto(100, 150)] });
    expect(penceCompleta('pence-interna', O, estado)).toBe(true);
  });

  it('fechar e transferir: o primeiro clique tem de ser no vértice de uma pence recortada, e o clique errado diz por quê', () => {
    for (const ferramenta of ['fechar-pence', 'transferir-pence'] as const) {
      const noCanto = cliqueDePence(ferramenta, O, molde(COM_PENCE), SEM_TRECHO, noContorno(na(1, 200, 0)));
      expect(noCanto.estado).toBe(SEM_TRECHO);
      expect(noCanto.recusa).toMatch(/não é o vértice de uma pence recortada/);
      const naAresta = cliqueDePence(ferramenta, O, molde(COM_PENCE), SEM_TRECHO, noContorno(na(0, 100, 0)));
      expect(naAresta.recusa).toMatch(/não é o vértice de uma pence recortada/);
      const foraDoContorno = cliqueDePence(ferramenta, O, molde(COM_PENCE), SEM_TRECHO, solto(100, 100));
      expect(foraDoContorno).toEqual({ estado: SEM_TRECHO, recusa: null });
      const noVertice = cliqueDePence(ferramenta, O, molde(COM_PENCE), SEM_TRECHO, noContorno(VERTICE));
      expect(noVertice).toEqual({ estado: { ...SEM_TRECHO, inicio: VERTICE }, recusa: null });
    }
  });

  it('fechar: com "Somente o recorte" o vértice basta; sem, falta o pivô', () => {
    const noVertice = clicar('fechar-pence', O, molde(COM_PENCE), [noContorno(VERTICE)]);
    expect(penceCompleta('fechar-pence', O, noVertice)).toBe(false);
    expect(penceCompleta('fechar-pence', com({ fecharSomenteORecorte: true }), noVertice)).toBe(true);
    const comPivo = clicar('fechar-pence', O, molde(COM_PENCE), [noContorno(VERTICE), noContorno(na(0, 100, 0))]);
    expect(penceCompleta('fechar-pence', O, comPivo)).toBe(true);
  });

  it('pregas: as duas pontas e, com mais de uma prega, o lado', () => {
    const duasPontas = clicar('pregas', O, molde(), [noContorno(na(0, 100, 0)), noContorno(NO_ALTO)]);
    expect(penceCompleta('pregas', O, duasPontas)).toBe(true);
    const variasPregas = com({ pregas: { ...O.pregas, quantidade: 3 } });
    expect(penceCompleta('pregas', variasPregas, duasPontas)).toBe(false);
    const comLado = clicar('pregas', variasPregas, molde(), [noContorno(na(0, 100, 0)), noContorno(NO_ALTO), solto(150, 150)]);
    expect(penceCompleta('pregas', variasPregas, comLado)).toBe(true);
  });

  it('depois de completa, mais cliques não mudam nada', () => {
    const estado = clicar('multiplas-pences', O, molde(), [noContorno(NO_ALTO)]);
    expect(cliqueDePence('multiplas-pences', O, molde(), estado, noContorno(na(0, 50, 0))).estado).toBe(estado);
  });
});

describe('aplicarPence', () => {
  it('pence recortada: tira o triângulo e conta as medidas e a área', () => {
    const opcoes = com({ pence: { ...O.pence, aberturaMm: 40, profundidadeMm: 100, piquesLaterais: false } });
    const estado = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO)]);
    const resultado = aplicarPence('pence-no-contorno', opcoes, [molde()], molde(), estado, ids());
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(58000, 6);
    expect(resultado.recado).toBe(
      'Pence recortada em “Frente”: abertura de 40,0 mm, profundidade de 100,0 mm. A peça passou de 600,0 cm² para 580,0 cm².',
    );
  });

  it('pence marcada: o contorno não muda', () => {
    const opcoes = com({ pence: { ...O.pence, modo: 'marcar' } });
    const estado = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO)]);
    const resultado = aplicarPence('pence-no-contorno', opcoes, [molde()], molde(), estado, ids());
    expect(resultado.pecas[0]!.contorno).toEqual(RETANGULO);
    expect(resultado.pecas[0]!.linhasInternas).toHaveLength(1);
    expect(resultado.pecas[0]!.marcas).toHaveLength(1);
    expect(resultado.recado).toBe('Pence marcada em “Frente”: abertura de 30,0 mm, profundidade de 100,0 mm.');
  });

  it('pence apontada pelo segundo clique', () => {
    const opcoes = com({ pence: { ...O.pence, perpendicular: false, aberturaMm: 40, profundidadeMm: 100 } });
    const estado = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO), solto(160, 220)]);
    const nova = aplicarPence('pence-no-contorno', opcoes, [molde()], molde(), estado, ids()).pecas[0]!;
    expect(nova.contorno.some((p) => Math.abs(p.x - 160) < 1e-6 && Math.abs(p.y - 220) < 1e-6)).toBe(true);
  });

  it('pence aberta: a peça ganha área', () => {
    const opcoes = com({ pence: { ...O.pence, modo: 'abrir', aberturaMm: 60 } });
    const estado = clicar('pence-no-contorno', opcoes, molde(), [noContorno(NO_ALTO), noContorno(na(0, 100, 0))]);
    const resultado = aplicarPence('pence-no-contorno', opcoes, [molde()], molde(), estado, ids());
    expect(area(resultado.pecas[0]!.contorno)).toBeGreaterThan(60000);
    expect(resultado.recado).toMatch(/^Pence aberta em “Frente”: abertura de 60,0 mm, profundidade de 100,0 mm\. A peça passou de 600,0 cm² para 6\d\d,\d cm²\.$/);
  });

  it('pence interna, múltiplas pences e pregas', () => {
    const interna = aplicarPence('pence-interna', O, [molde()], molde(), clicar('pence-interna', O, molde(), [solto(100, 150)]), ids());
    expect(interna.pecas[0]!.linhasInternas).toHaveLength(2);
    expect(interna.recado).toBe('Pence interna desenhada em “Frente”.');

    const multiplas = aplicarPence('multiplas-pences', O, [molde()], molde(), clicar('multiplas-pences', O, molde(), [noContorno(NO_ALTO)]), ids());
    // Duas pences de 20 × 80.
    expect(area(multiplas.pecas[0]!.contorno)).toBeCloseTo(60000 - 2 * 800, 6);
    expect(multiplas.recado).toBe('2 pences recortadas em “Frente”, a cada 60,0 mm. A peça passou de 600,0 cm² para 584,0 cm².');

    const pregas = aplicarPence('pregas', O, [molde()], molde(), clicar('pregas', O, molde(), [noContorno(na(0, 100, 0)), noContorno(NO_ALTO)]), ids());
    expect(area(pregas.pecas[0]!.contorno)).toBeCloseTo(72000, 6);
    expect(pregas.recado).toBe('1 prega aberta em “Frente”. A peça passou de 600,0 cm² para 720,0 cm².');
  });

  it('transferir e fechar', () => {
    const peca = molde(COM_PENCE);
    const transferir = clicar('transferir-pence', O, peca, [noContorno(VERTICE), noContorno(na(1, 200, 200))]);
    const transferida = aplicarPence('transferir-pence', O, [peca], peca, transferir, ids());
    expect(area(transferida.pecas[0]!.contorno)).toBeCloseTo(58000, 6);
    // O contorno desta peça foi desenhado à mão, já com o recorte: a mensagem diz que o canto foi tratado como pence.
    expect(transferida.recado).toBe('Pence transferida em “Frente”, com o mesmo vértice e o mesmo ângulo. A área continua 580,0 cm². Esse canto não foi feito por uma ferramenta de pence: foi tratado como pence por ser um canto que entra na peça.');

    const soORecorte = com({ fecharSomenteORecorte: true });
    const fechada = aplicarPence('fechar-pence', soORecorte, [peca], peca, clicar('fechar-pence', soORecorte, peca, [noContorno(VERTICE)]), ids());
    expect(fechada.pecas[0]!.contorno).toHaveLength(6);
    expect(fechada.recado).toMatch(/a pence ficou marcada\. A peça passou de 580,0 cm² para 600,0 cm²\. Esse canto não foi feito por uma ferramenta de pence/);

    const comPivo = clicar('fechar-pence', O, peca, [noContorno(VERTICE), noContorno(na(0, 100, 0))]);
    const girada = aplicarPence('fechar-pence', O, [peca], peca, comPivo, ids());
    expect(girada.recado).toBe('Pence fechada em “Frente”, girando em torno do pivô. A peça passou de 580,0 cm² para 540,0 cm². Esse canto não foi feito por uma ferramenta de pence: foi tratado como pence por ser um canto que entra na peça.');
  });

  it('fechar com pivô: quando as pontas não ficam à mesma distância do pivô, a mensagem diz o degrau que sobrou', () => {
    const peca = molde(COM_PENCE);
    // Do pivô (150, 0): 301,5 mm até a ponta (120, 300) e 308,1 mm até a ponta (80, 300).
    const estado = clicar('fechar-pence', O, peca, [noContorno(VERTICE), noContorno(na(0, 150, 0))]);
    const resultado = aplicarPence('fechar-pence', O, [peca], peca, estado, ids());
    expect(resultado.recado).toMatch(/sobrou um degrau de 6,6 mm entre elas, para acertar com Mover ponto\.$/);
    // Com o pivô no meio, (100, 0), as pontas se encontram: sem aviso.
    const noMeio = clicar('fechar-pence', O, peca, [noContorno(VERTICE), noContorno(na(0, 100, 0))]);
    expect(aplicarPence('fechar-pence', O, [peca], peca, noMeio, ids()).recado).not.toMatch(/degrau/);
  });

  it('só troca a peça indicada, e lança o erro do domínio quando não dá', () => {
    const outra = criarMolde({ nome: 'Costas', referencia: 'R', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'c');
    const estado = clicar('pence-no-contorno', O, molde(), [noContorno(NO_ALTO)]);
    const resultado = aplicarPence('pence-no-contorno', O, [outra, molde()], molde(), estado, ids());
    expect(resultado.pecas[0]).toBe(outra);
    expect(resultado.pecas[1]!.id).toBe('f');

    const fundaDemais = com({ pence: { ...O.pence, profundidadeMm: 900 } });
    expect(() => aplicarPence('pence-no-contorno', fundaDemais, [molde()], molde(), estado, ids())).toThrow(/fora da peça/);
    expect(() => aplicarPence('pregas', O, [molde()], molde(), SEM_TRECHO, ids())).toThrow(/Faltam pontos/);
  });
});

describe('previaDaPence', () => {
  it('sem mouse, só os pontos já clicados', () => {
    expect(previaDaPence('pregas', O, molde(), { ...SEM_TRECHO, inicio: na(0, 100, 0) }, null)).toEqual({ marcas: [ponto(100, 0)] });
  });

  it('pence recortada: com o mouse no contorno, mostra o contorno como ficaria', () => {
    const previa = previaDaPence('pence-no-contorno', O, molde(), SEM_TRECHO, noContorno(NO_ALTO));
    expect(previa.novoFechado).toBe(true);
    expect(previa.novo).toHaveLength(7);
    expect(previa.linhas).toEqual([]);
  });

  it('pence marcada: o contorno não aparece como novo; aparecem as pernas', () => {
    const opcoes = com({ pence: { ...O.pence, modo: 'marcar' } });
    const previa = previaDaPence('pence-no-contorno', opcoes, molde(), SEM_TRECHO, noContorno(NO_ALTO));
    expect(previa.novo).toBeUndefined();
    expect(previa.linhas).toHaveLength(1);
    expect(previa.linhas![0]).toHaveLength(3);
  });

  it('com o mouse fora do contorno e nada clicado, não mostra nada', () => {
    expect(previaDaPence('pence-no-contorno', O, molde(), SEM_TRECHO, solto(50, 50))).toEqual({ marcas: [] });
  });

  it('pence interna: o losango segue o mouse; onde não cabe, some', () => {
    expect(previaDaPence('pence-interna', O, molde(), SEM_TRECHO, solto(100, 150)).linhas).toHaveLength(2);
    expect(previaDaPence('pence-interna', O, molde(), SEM_TRECHO, solto(100, 290))).toEqual({ marcas: [] });
  });

  it('pregas: do primeiro ponto ao mouse, uma reta; com o mouse na outra borda, a peça aberta e as linhas de dobra', () => {
    const umaPonta: TrechoEmEdicao = { ...SEM_TRECHO, inicio: na(0, 100, 0) };
    expect(previaDaPence('pregas', O, molde(), umaPonta, solto(120, 100))).toEqual({
      novo: [ponto(100, 0), ponto(120, 100)],
      marcas: [ponto(100, 0)],
    });
    const aberta = previaDaPence('pregas', O, molde(), umaPonta, noContorno(NO_ALTO));
    expect(aberta.novoFechado).toBe(true);
    expect(aberta.novo).toHaveLength(8);
    // Três linhas de dobra e a seta.
    expect(aberta.linhas).toHaveLength(4);
  });

  it('transferir: com o vértice indicado e o mouse no contorno, mostra a peça com a pence no lugar novo', () => {
    const noVertice: TrechoEmEdicao = { ...SEM_TRECHO, inicio: VERTICE };
    const previa = previaDaPence('transferir-pence', O, molde(COM_PENCE), noVertice, noContorno(na(1, 200, 200)));
    expect(previa.novoFechado).toBe(true);
    expect(previa.novo).toHaveLength(8);
    expect(previa.marcas).toEqual([ponto(100, 200)]);
  });

  it('quando o clique não daria certo ali, fica a reta até o mouse', () => {
    const noVertice: TrechoEmEdicao = { ...SEM_TRECHO, inicio: VERTICE };
    // A nova posição em cima de uma perna da própria pence.
    const previa = previaDaPence('transferir-pence', O, molde(COM_PENCE), noVertice, noContorno(na(3, 110, 250)));
    expect(previa.novo).toEqual([ponto(100, 200), ponto(110, 250)]);
    expect(previa.novoFechado).toBeUndefined();
  });
});

describe('instrucaoDaPence', () => {
  it('diz o próximo clique de cada ferramenta e termina com "Esc sai."', () => {
    for (const ferramenta of TODAS) {
      const texto = instrucaoDaPence(ferramenta, O, SEM_TRECHO);
      expect(texto.endsWith(' Esc sai.')).toBe(true);
      expect(texto).toMatch(/clique/);
    }
  });

  it('muda conforme o que já foi clicado e conforme as opções', () => {
    const comInicio: TrechoEmEdicao = { ...SEM_TRECHO, inicio: NO_ALTO };
    expect(instrucaoDaPence('pence-no-contorno', O, SEM_TRECHO)).toMatch(/^Pence \(recortar\): clique no contorno/);
    expect(instrucaoDaPence('pence-no-contorno', O, comInicio)).toMatch(/para onde o vértice deve apontar/);
    const abrir = com({ pence: { ...O.pence, modo: 'abrir' } });
    expect(instrucaoDaPence('pence-no-contorno', abrir, comInicio)).toMatch(/no pivô/);
    expect(instrucaoDaPence('transferir-pence', O, comInicio)).toMatch(/na nova posição/);
    expect(instrucaoDaPence('fechar-pence', O, comInicio)).toMatch(/no pivô/);
    expect(instrucaoDaPence('pregas', O, comInicio)).toMatch(/na outra ponta/);
    expect(instrucaoDaPence('pregas', O, { ...comInicio, fim: na(0, 100, 0) })).toMatch(/do lado em que as outras pregas/);
  });
});

describe('Fechar e Transferir com o início, o vértice e o fim indicados (a pence de pernas curvas)', () => {
  // O retângulo com uma pence de pernas curvas no alto: início (120, 300), um ponto na perna, o vértice (100, 200), outro ponto na perna e o fim (80, 300).
  const CURVA = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(112, 250), ponto(100, 200), ponto(88, 250), ponto(80, 300), ponto(0, 300)];
  const INICIO = na(3, 120, 300);
  const DO_VERTICE = na(5, 100, 200);
  const FIM = na(7, 80, 300);
  const P = com({ indicarPontas: true });
  const peca = (): Molde => molde(CURVA);

  it('os três primeiros cliques são pontos do contorno: o início, o vértice e o fim; o quarto, a nova posição', () => {
    const um = cliqueDePence('transferir-pence', P, peca(), SEM_TRECHO, noContorno(INICIO));
    expect(um.estado).toEqual({ inicio: null, fim: null, livres: [ponto(120, 300)] });
    // No meio de uma aresta não vale: as pontas e o vértice são pontos do contorno.
    const fora = cliqueDePence('transferir-pence', P, peca(), um.estado, noContorno(na(2, 150, 300)));
    expect(fora.estado).toBe(um.estado);
    expect(fora.recusa).toMatch(/Clique num ponto do contorno/);
    // Fora do contorno, ou no ponto já indicado, o clique não conta.
    expect(cliqueDePence('transferir-pence', P, peca(), um.estado, solto(100, 100)).estado).toBe(um.estado);
    expect(cliqueDePence('transferir-pence', P, peca(), um.estado, noContorno(INICIO)).estado).toBe(um.estado);

    const dois = cliqueDePence('transferir-pence', P, peca(), um.estado, noContorno(DO_VERTICE)).estado;
    expect(dois.inicio).toEqual(DO_VERTICE);
    expect(pontasIndicadas(peca(), dois)).toBeUndefined();
    const tres = cliqueDePence('transferir-pence', P, peca(), dois, noContorno(FIM)).estado;
    expect(tres.livres).toEqual([ponto(120, 300), ponto(80, 300)]);
    expect(pontasIndicadas(peca(), tres)).toEqual({ inicio: 3, fim: 7 });
    expect(penceCompleta('transferir-pence', P, tres)).toBe(false);

    // A nova posição pode ser no meio de uma aresta; no próprio vértice, não.
    expect(cliqueDePence('transferir-pence', P, peca(), tres, noContorno(DO_VERTICE)).estado).toBe(tres);
    const quatro = cliqueDePence('transferir-pence', P, peca(), tres, noContorno(na(1, 200, 150))).estado;
    expect(quatro.fim).toEqual(na(1, 200, 150));
    expect(penceCompleta('transferir-pence', P, quatro)).toBe(true);
    expect(cliqueDePence('transferir-pence', P, peca(), quatro, noContorno(na(0, 50, 0))).estado).toBe(quatro);
  });

  it('o fim que não fecha uma pence com os outros dois é recusado, e diz por quê', () => {
    const dois = clicar('transferir-pence', P, peca(), [noContorno(INICIO), noContorno(DO_VERTICE)]);
    const errado = cliqueDePence('transferir-pence', P, peca(), dois, noContorno(na(2, 200, 300)));

    expect(errado.estado).toBe(dois);
    expect(errado.recusa).toMatch(/não formam uma pence recortada/);
  });

  it('o início e o fim servem em qualquer ordem', () => {
    const aoContrario = clicar('fechar-pence', com({ indicarPontas: true, fecharSomenteORecorte: true }), peca(), [noContorno(FIM), noContorno(DO_VERTICE), noContorno(INICIO)]);
    expect(pontasIndicadas(peca(), aoContrario)).toEqual({ inicio: 7, fim: 3 });
    const fechada = aplicarPence('fechar-pence', com({ indicarPontas: true, fecharSomenteORecorte: true }), [peca()], peca(), aoContrario, ids());
    expect(area(fechada.pecas[0]!.contorno)).toBeCloseTo(60000, 6);
  });

  it('Fechar “somente o recorte”: bastam os três pontos; o contorno passa reto e a pence inteira fica desenhada', () => {
    const opcoes = com({ indicarPontas: true, fecharSomenteORecorte: true });
    const estado = clicar('fechar-pence', opcoes, peca(), [noContorno(INICIO), noContorno(DO_VERTICE), noContorno(FIM)]);
    expect(penceCompleta('fechar-pence', opcoes, estado)).toBe(true);
    const fechada = aplicarPence('fechar-pence', opcoes, [peca()], peca(), estado, ids());

    expect(fechada.pecas[0]!.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(80, 300), ponto(0, 300)]);
    expect(fechada.pecas[0]!.linhasInternas).toEqual([[ponto(120, 300), ponto(112, 250), ponto(100, 200), ponto(88, 250), ponto(80, 300)]]);
    expect(pencesDaPeca(fechada.pecas[0]!)).toHaveLength(0);
    expect(fechada.recado).toBe(
      'Recorte da pence fechado em “Frente”: o contorno passa reto, e a pence ficou marcada. A peça passou de 578,0 cm² para 600,0 cm². O início, o vértice e o fim da pence foram os pontos indicados.',
    );
  });

  it('Fechar por pivô: o lado sem a linha de fio gira até o início encontrar o fim, e as pernas saem do contorno', () => {
    const pivo = na(0, 100, 0);
    const estado = clicar('fechar-pence', P, peca(), [noContorno(INICIO), noContorno(DO_VERTICE), noContorno(FIM), noContorno(pivo)]);
    expect(penceCompleta('fechar-pence', P, estado)).toBe(true);
    const fechada = aplicarPence('fechar-pence', P, [peca()], peca(), estado, ids());
    const contorno = fechada.pecas[0]!.contorno;
    // O giro que leva o início (120, 300) para cima do fim (80, 300), vistos do pivô.
    const graus = ((Math.atan2(300, -20) - Math.atan2(300, 20)) * 180) / Math.PI;
    const tem = (x: number, y: number): boolean => contorno.some((p) => distancia(p, ponto(x, y)) < 1e-6);
    const temGirado = (x: number, y: number): boolean => contorno.some((p) => distancia(p, rotacionar(ponto(x, y), pivo.ponto, graus)) < 1e-6);

    expect(contorno).toHaveLength(6);
    for (const [x, y] of [[0, 0], [0, 300], [80, 300], [100, 0]] as const) expect(tem(x, y)).toBe(true);
    for (const [x, y] of [[200, 0], [200, 300]] as const) expect(temGirado(x, y)).toBe(true);
    // O vértice e os pontos das pernas não estão mais no contorno.
    for (const [x, y] of [[100, 200], [112, 250], [88, 250], [120, 300]] as const) expect(tem(x, y)).toBe(false);
    expect(fechada.recado).toMatch(/^Pence fechada em “Frente”, girando em torno do pivô\./);
    expect(fechada.recado).toMatch(/O início, o vértice e o fim da pence foram os pontos indicados\.$/);
    // As duas pontas estão à mesma distância do pivô: não sobra degrau.
    expect(fechada.recado).not.toMatch(/degrau/);
  });

  it('o degrau do Fechar por pivô é medido entre as pontas indicadas, e não entre os vizinhos do vértice', () => {
    // As pontas estão à mesma distância do pivô; os pontos das pernas, não (112 de um lado, 86 do outro).
    const torta = molde([ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(112, 250), ponto(100, 200), ponto(86, 250), ponto(80, 300), ponto(0, 300)]);
    const estado = clicar('fechar-pence', P, torta, [noContorno(INICIO), noContorno(DO_VERTICE), noContorno(FIM), noContorno(na(0, 100, 0))]);

    expect(aplicarPence('fechar-pence', P, [torta], torta, estado, ids()).recado).not.toMatch(/degrau/);
  });

  it('Transferir: a pence fecha onde estava e abre na nova posição, com pernas retas', () => {
    const estado = clicar('transferir-pence', P, peca(), [noContorno(INICIO), noContorno(DO_VERTICE), noContorno(FIM), noContorno(na(1, 200, 150))]);
    const transferida = aplicarPence('transferir-pence', P, [peca()], peca(), estado, ids());
    const contorno = transferida.pecas[0]!.contorno;
    const tem = (x: number, y: number): boolean => contorno.some((p) => distancia(p, ponto(x, y)) < 1e-6);

    expect(contorno).toHaveLength(8);
    // O vértice continua; a nova pence abre em (200, 150); as pernas curvas saíram.
    expect(tem(100, 200)).toBe(true);
    expect(tem(200, 150)).toBe(true);
    expect(tem(112, 250)).toBe(false);
    expect(tem(88, 250)).toBe(false);
    // A peça com a pence de pernas retas no lugar da curva: 600 cm² menos 20 cm².
    expect(area(contorno)).toBeCloseTo(58000, 6);
    expect(transferida.recado).toBe(
      'Pence transferida em “Frente”, com o mesmo vértice e o mesmo ângulo. As pernas da pence nova são retas: a peça passou de 578,0 cm² para 580,0 cm². O início, o vértice e o fim da pence foram os pontos indicados.',
    );
  });

  it('sem indicar as pontas, o clique no vértice dessa pence pegaria só os pontos vizinhos dele', () => {
    const soORecorte = com({ fecharSomenteORecorte: true });
    const fechada = aplicarPence('fechar-pence', soORecorte, [peca()], peca(), clicar('fechar-pence', soORecorte, peca(), [noContorno(DO_VERTICE)]), ids());
    // Só o vértice saiu: os pontos das pernas ficaram, e a peça não voltou a ser o retângulo.
    expect(fechada.pecas[0]!.contorno).toHaveLength(8);
    expect(area(fechada.pecas[0]!.contorno)).toBeLessThan(60000);
  });

  it('a prévia marca os pontos já indicados e mostra a peça como ficaria; as instruções acompanham cada clique', () => {
    const um = clicar('transferir-pence', P, peca(), [noContorno(INICIO)]);
    expect(previaDaPence('transferir-pence', P, peca(), um, solto(50, 50)).marcas).toContainEqual(ponto(120, 300));
    const tres = clicar('transferir-pence', P, peca(), [noContorno(INICIO), noContorno(DO_VERTICE), noContorno(FIM)]);
    const previa = previaDaPence('transferir-pence', P, peca(), tres, noContorno(na(1, 200, 150)));
    expect(previa.novoFechado).toBe(true);
    expect(previa.novo).toHaveLength(8);
    expect(previa.marcas).toContainEqual(ponto(80, 300));
    // Sem a opção, os pontos soltos do estado não são marcas.
    expect(previaDaPence('transferir-pence', O, peca(), um, solto(50, 50)).marcas).not.toContainEqual(ponto(120, 300));

    expect(instrucaoDaPence('transferir-pence', P, SEM_TRECHO)).toBe('Transferir pence (pontas indicadas): clique no ponto do contorno onde a pence começa. Esc sai.');
    expect(instrucaoDaPence('transferir-pence', P, um)).toMatch(/clique no vértice da pence, o ponto de dentro do recorte/);
    expect(instrucaoDaPence('fechar-pence', P, clicar('fechar-pence', P, peca(), [noContorno(INICIO), noContorno(DO_VERTICE)]))).toBe(
      'Fechar pence (pontas indicadas): clique no ponto do contorno onde a pence termina. Esc sai.',
    );
    expect(instrucaoDaPence('transferir-pence', P, tres)).toMatch(/na nova posição/);
    expect(instrucaoDaPence('fechar-pence', P, tres)).toMatch(/no pivô/);
  });

  it('as duas janelas têm a opção, e dizem a ordem dos cliques', () => {
    const transferir = dialogoDaPence('transferir-pence', P)!;
    expect(transferir.titulo).toBe('Transferir pence');
    expect(transferir.campos.map((c) => [c.id, c.inicial])).toEqual([['indicarPontas', true]]);
    expect(transferir.nota).toMatch(/os três primeiros cliques são esses pontos do contorno, nessa ordem \(a do manual da referência; a contrária também serve\)/);
    expect(dialogoDaPence('fechar-pence', O)!.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['somenteORecorte', false],
      ['indicarPontas', false],
    ]);
  });
});

describe('Pence aberta com “Cortar intersecções”', () => {
  // Um "C": a linha em pé em x = 150 entra pelo braço de cima, sai, e entra de novo pelo braço de baixo.
  const EM_C = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200), ponto(200, 300), ponto(0, 300)];
  const abrir = (cortarIntersecoes: boolean): OpcoesDasPences => com({ pence: { ...O.pence, modo: 'abrir', cortarIntersecoes, piquesLaterais: false, marcaNoVertice: false } });
  const cliques = [noContorno(na(6, 150, 300)), noContorno(na(0, 150, 0))];

  it('com a opção, a peça abre em todos os trechos da linha, e a mensagem diz que o resultado é uma prega', () => {
    const peca = molde(EM_C);
    const aberta = aplicarPence('pence-no-contorno', abrir(true), [peca], peca, clicar('pence-no-contorno', abrir(true), peca, cliques), ids());

    expect(area(aberta.pecas[0]!.contorno)).toBeGreaterThan(50000);
    expect(aberta.pecas[0]!.linhasInternas).toHaveLength(4);
    expect(pencesDaPeca(aberta.pecas[0]!)).toHaveLength(0);
    expect(aberta.recado).toBe(
      '“Frente” aberta com “Cortar intersecções”: a linha até o pivô sai da peça no caminho, e a peça abriu em todos os trechos dela, 30,0 mm na posição indicada. O resultado é uma prega, sem vértice (a profundidade não conta), com as bordas de cada trecho desenhadas. A peça passou de 500,0 cm² para 530,0 cm².',
    );
  });

  it('sem a opção, a mesma linha é recusada, e a prévia fica só na reta até o mouse', () => {
    const peca = molde(EM_C);
    expect(() => aplicarPence('pence-no-contorno', abrir(false), [peca], peca, clicar('pence-no-contorno', abrir(false), peca, cliques), ids())).toThrow(/Com “Cortar intersecções” ligado/);
    const umClique = clicar('pence-no-contorno', abrir(false), peca, [cliques[0]!]);
    expect(previaDaPence('pence-no-contorno', abrir(false), peca, umClique, cliques[1]!).novo).toEqual([ponto(150, 300), ponto(150, 0)]);
    expect(previaDaPence('pence-no-contorno', abrir(true), peca, umClique, cliques[1]!).novoFechado).toBe(true);
  });

  it('com a opção e a linha toda dentro da peça, é a pence aberta de sempre', () => {
    const peca = molde(EM_C);
    const porDentro = [noContorno(na(6, 50, 300)), noContorno(na(0, 50, 0))];
    const aberta = aplicarPence('pence-no-contorno', abrir(true), [peca], peca, clicar('pence-no-contorno', abrir(true), peca, porDentro), ids());

    expect(aberta.recado).toMatch(/^Pence aberta em “Frente”: abertura de 30,0 mm, profundidade de 100,0 mm\./);
    expect(pencesDaPeca(aberta.pecas[0]!)).toHaveLength(1);
  });

  it('a janela tem a opção e diz que a conta é leitura nossa', () => {
    const dialogo = dialogoDaPence('pence-no-contorno', abrir(true))!;
    expect(dialogo.campos.find((c) => c.id === 'cortarIntersecoes')!.inicial).toBe(true);
    expect(dialogo.nota).toMatch(/uma prega em cunha, sem vértice, com as bordas desenhadas\. O manual da referência tem as duas opções, mas não diz a conta; a que está aqui é a nossa leitura\.$/);
  });
});

describe('diálogos', () => {
  it('cada ferramenta abre com o que foi usado por último', () => {
    for (const ferramenta of TODAS) {
      const dialogo = dialogoDaPence(ferramenta, O)!;
      expect(dialogo.titulo.length).toBeGreaterThan(3);
      expect(dialogo.campos.length).toBeGreaterThan(0);
      expect(dialogo.nota).toMatch(/Depois de confirmar, clique/);
      expect(new Set(dialogo.campos.map((c) => c.id)).size).toBe(dialogo.campos.length);
    }
    const dialogo = dialogoDaPence('pence-no-contorno', com({ pence: { ...O.pence, aberturaMm: 12.5, modo: 'marcar' } }))!;
    expect(dialogo.campos.find((c) => c.id === 'abertura')!.inicial).toBe('12,5');
    expect(dialogo.campos.find((c) => c.id === 'modo')!.inicial).toBe('marcar');
  });

  it('as ferramentas que o manual da referência não descreve dizem isso na nota', () => {
    expect(dialogoDaPence('multiplas-pences', O)!.nota).toMatch(/leitura natural/);
    expect(dialogoDaPence('fechar-pence', O)!.nota).toMatch(/leitura natural/);
  });

  it('lê as opções da pence no contorno e recusa medidas que não servem', () => {
    const valores = { modo: 'abrir', abertura: 45, profundidade: 120, perpendicular: false, piquesLaterais: true, marcaNoVertice: false, acabamento: true };
    expect(lerDialogoDaPence('pence-no-contorno', O, valores).pence).toEqual({
      modo: 'abrir',
      aberturaMm: 45,
      profundidadeMm: 120,
      perpendicular: false,
      piquesLaterais: true,
      marcaNoVertice: false,
      acabamento: true,
      cortarIntersecoes: false,
    });
    expect(lerDialogoDaPence('pence-no-contorno', O, { ...valores, cortarIntersecoes: true }).pence.cortarIntersecoes).toBe(true);
    expect(() => lerDialogoDaPence('pence-no-contorno', O, { ...valores, abertura: 0 })).toThrow(/abertura/);
    // As outras ferramentas não mudam.
    expect(lerDialogoDaPence('pence-no-contorno', O, valores).pregas).toBe(O.pregas);
  });

  it('lê as opções da pence interna, do fechar e das múltiplas pences', () => {
    const interna = lerDialogoDaPence('pence-interna', O, { altura1: 50, altura2: 70, largura: 16, angulo: -15, linhaAuxiliar: false, marcas: true });
    expect(interna.interna).toEqual({ altura1Mm: 50, altura2Mm: 70, larguraMm: 16, anguloGraus: -15, linhaAuxiliar: false, marcas: true });
    expect(() => lerDialogoDaPence('pence-interna', O, { altura1: 0, altura2: 70, largura: 16, angulo: 0 })).toThrow(/alturas/);

    expect(lerDialogoDaPence('fechar-pence', O, { somenteORecorte: true }).fecharSomenteORecorte).toBe(true);
    expect(lerDialogoDaPence('fechar-pence', O, { somenteORecorte: true }).indicarPontas).toBe(false);
    expect(lerDialogoDaPence('fechar-pence', O, { somenteORecorte: false, indicarPontas: true })).toMatchObject({ fecharSomenteORecorte: false, indicarPontas: true });
    expect(lerDialogoDaPence('transferir-pence', O, {})).toEqual(O);
    expect(lerDialogoDaPence('transferir-pence', O, { indicarPontas: true }).indicarPontas).toBe(true);

    const valores = { quantidade: 4, distancia: 50, abertura: 20, profundidade: 70, modo: 'marcar', piquesLaterais: false, marcaNoVertice: true };
    expect(lerDialogoDaPence('multiplas-pences', O, valores).multiplas).toEqual({
      quantidade: 4,
      distanciaMm: 50,
      aberturaMm: 20,
      profundidadeMm: 70,
      modo: 'marcar',
      piquesLaterais: false,
      marcaNoVertice: true,
    });
    expect(() => lerDialogoDaPence('multiplas-pences', O, { ...valores, quantidade: 1 })).toThrow(/número de pences/);
    expect(() => lerDialogoDaPence('multiplas-pences', O, { ...valores, distancia: 20 })).toThrow(/maior que a abertura/);
  });

  it('lê as opções das pregas: Largura 2 e a distância podem ficar em branco', () => {
    const umaPrega = lerDialogoDaPence('pregas', O, { modo: 'dupla', quantidade: 1, largura: 25, piques: false });
    expect(umaPrega.pregas).toEqual({ modo: 'dupla', quantidade: 1, distanciaMm: O.pregas.distanciaMm, larguraMm: 25, piques: false });
    const comLargura2 = lerDialogoDaPence('pregas', O, { modo: 'simples-esquerda', quantidade: 3, distancia: 40, largura: 25, largura2: 35, piques: true });
    expect(comLargura2.pregas).toEqual({ modo: 'simples-esquerda', quantidade: 3, distanciaMm: 40, larguraMm: 25, largura2Mm: 35, piques: true });
  });

  it('pregas: com mais de uma, a distância é obrigatória', () => {
    expect(() => lerDialogoDaPence('pregas', O, { modo: 'dupla', quantidade: 2, largura: 25, piques: false })).toThrow(/distância/);
    expect(() => lerDialogoDaPence('pregas', O, { modo: 'dupla', quantidade: 0, largura: 25, piques: false })).toThrow(/número de pregas/);
    expect(() => lerDialogoDaPence('pregas', O, { modo: 'dupla', quantidade: 1, largura: 0, piques: false })).toThrow(/largura/);
  });
});

describe('uma pence já feita: abrir as medidas, mudar e apagar', () => {
  const novoId = ids();
  // Uma pence recortada no alto (40 de abertura por 100 de profundidade), feita pela ferramenta: fica registrada.
  const comRecortada = (): Molde =>
    criarPence(molde(), NO_ALTO, { aberturaMm: 40, profundidadeMm: 100, modo: 'recortar', piquesLaterais: true, marcaNoVertice: true }, novoId);
  const comInterna = (): Molde => criarPenceInterna(molde(), ponto(100, 150), O.interna, novoId);
  const sobAPence = (peca: Molde, x: number, y: number) => ({ noContorno: null, livre: ponto(x, y), pence: pencesDaPeca(peca)[0]!.id });

  it('com a ferramenta de pence ligada, o clique numa pence registrada pede as medidas dela em vez de criar outra', () => {
    const peca = comRecortada();
    const id = pencesDaPeca(peca)[0]!.id;

    expect(cliqueDePence('pence-no-contorno', O, peca, SEM_TRECHO, sobAPence(peca, 110, 250))).toEqual({ estado: SEM_TRECHO, recusa: null, editar: id });
    // Fechar e transferir continuam pedindo o vértice; a pence interna não se abre pela ferramenta do contorno, nem o contrário.
    expect(cliqueDePence('fechar-pence', O, peca, SEM_TRECHO, sobAPence(peca, 110, 250)).editar).toBeUndefined();
    expect(cliqueDePence('pence-interna', O, peca, SEM_TRECHO, sobAPence(peca, 110, 250)).editar).toBeUndefined();
    const interna = comInterna();
    expect(cliqueDePence('pence-interna', O, interna, SEM_TRECHO, sobAPence(interna, 100, 150)).editar).toBe(pencesDaPeca(interna)[0]!.id);
    expect(cliqueDePence('pence-no-contorno', O, interna, SEM_TRECHO, sobAPence(interna, 100, 150)).editar).toBeUndefined();
  });

  it('o diálogo abre com as medidas lidas da pence', () => {
    const peca = comRecortada();
    const dialogo = dialogoDeEditarPence(peca, pencesDaPeca(peca)[0]!.id)!;

    expect(dialogo.titulo).toBe('Pence recortada: medidas');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['abertura', '40'],
      ['profundidade', '100'],
      ['desvio', '0'],
      ['apagar', false],
    ]);
    const interna = comInterna();
    expect(dialogoDeEditarPence(interna, pencesDaPeca(interna)[0]!.id)!.campos.map((c) => c.id)).toEqual(['altura1', 'altura2', 'largura', 'apagar']);
    expect(dialogoDeEditarPence(peca, 'outra')).toBeNull();
  });

  it('mudar as medidas refaz a pence no lugar e diz como a área ficou', () => {
    const peca = comRecortada();
    const resultado = aplicarEdicaoDaPence([peca], peca, pencesDaPeca(peca)[0]!.id, { abertura: 60, profundidade: 50, desvio: 0, apagar: false }, novoId);

    const nova = resultado.pecas[0]!;
    expect(medidasDaPence(pencesDaPeca(nova)[0]!)).toEqual({ aberturaMm: 60, profundidadeMm: 50, desvioMm: 0 });
    expect(resultado.recado).toBe('Pence de “Frente” refeita: abertura de 60,0 mm, profundidade de 50,0 mm. A peça passou de 580,0 cm² para 585,0 cm².');
  });

  it('com desvio, a mensagem diz de quanto', () => {
    const peca = comRecortada();
    const resultado = aplicarEdicaoDaPence([peca], peca, pencesDaPeca(peca)[0]!.id, { abertura: 40, profundidade: 100, desvio: -15, apagar: false }, novoId);

    expect(resultado.recado).toMatch(/profundidade de 100,0 mm, desvio de -15,0 mm\./);
    expect(medidasDaPence(pencesDaPeca(resultado.pecas[0]!)[0]!).desvioMm).toBeCloseTo(-15, 6);
  });

  it('apagar tira a pence e devolve o contorno de antes', () => {
    const peca = comRecortada();
    const resultado = aplicarEdicaoDaPence([peca], peca, pencesDaPeca(peca)[0]!.id, { abertura: 40, profundidade: 100, desvio: 0, apagar: true }, novoId);

    expect(resultado.pecas[0]!.contorno).toEqual(RETANGULO);
    expect(resultado.recado).toBe('Pence apagada de “Frente”: o contorno voltou a ser o de antes dela. A peça passou de 580,0 cm² para 600,0 cm².');
  });

  it('a pence interna muda pelas alturas e pela largura', () => {
    const peca = comInterna();
    const resultado = aplicarEdicaoDaPence([peca], peca, pencesDaPeca(peca)[0]!.id, { altura1: 50, altura2: 30, largura: 16, apagar: false }, novoId);

    expect(resultado.recado).toBe('Pence interna de “Frente” refeita: alturas de 50,0 mm e 30,0 mm, largura de 16,0 mm.');
    expect(pencesDaPeca(resultado.pecas[0]!)).toHaveLength(1);
  });

  it('medidas que não servem dão erro, e uma pence que não está mais registrada também', () => {
    const peca = comRecortada();
    const id = pencesDaPeca(peca)[0]!.id;

    expect(() => aplicarEdicaoDaPence([peca], peca, id, { abertura: 40, profundidade: 900, desvio: 0, apagar: false }, novoId)).toThrow(/fora da peça/);
    expect(() => aplicarEdicaoDaPence([peca], peca, 'outra', { abertura: 40, profundidade: 50, desvio: 0, apagar: false }, novoId)).toThrow(/mexida à mão/);
  });

  it('a prévia marca o vértice das pences registradas e destaca a que está sob o mouse', () => {
    const peca = comRecortada();

    expect(previaDaPence('pence-no-contorno', O, peca, SEM_TRECHO, null)).toEqual({ marcas: [ponto(100, 200)] });
    expect(previaDaPence('pence-no-contorno', O, peca, SEM_TRECHO, sobAPence(peca, 110, 250))).toEqual({
      marcas: [ponto(100, 200)],
      substituido: [ponto(120, 300), ponto(100, 200), ponto(80, 300)],
    });
    // Pregas e múltiplas pences não abrem medidas: não marcam as pences.
    expect(previaDaPence('pregas', O, peca, SEM_TRECHO, null)).toEqual({ marcas: [] });
  });

  it('sem pences registradas, a instrução ainda diz da pence sem registro', () => {
    expect(instrucaoDaPence('pence-no-contorno', O, SEM_TRECHO)).toMatch(/Ou clique no vértice de uma pence que já esteja no contorno, para mudar as medidas\. Esc sai\.$/);
    expect(instrucaoDaPence('pence-interna', O, SEM_TRECHO)).toMatch(/Ou clique no losango já desenhado, para mudar as medidas\. Esc sai\.$/);
    expect(instrucaoDaPence('pence-interna', O, SEM_TRECHO, true)).toMatch(/a que não tem anel abre também, no losango já desenhado\. Esc sai\.$/);
  });

  it('a instrução avisa do clique que abre as medidas, quando a peça tem pences registradas', () => {
    expect(instrucaoDaPence('pence-no-contorno', O, SEM_TRECHO, true)).toMatch(/Ou clique numa pence já feita \(as marcadas com um anel\) para mudar as medidas dela; a que não tem anel abre também, no vértice de uma pence que já esteja no contorno\. Esc sai\.$/);
    expect(instrucaoDaPence('pence-interna', O, SEM_TRECHO, true)).toMatch(/Ou clique numa pence já feita/);
    expect(instrucaoDaPence('pence-no-contorno', O, SEM_TRECHO)).not.toMatch(/pence já feita/);
    expect(instrucaoDaPence('fechar-pence', O, SEM_TRECHO, true)).not.toMatch(/pence já feita/);
  });

  it('fechar e transferir uma pence registrada não levam o aviso do canto tratado como pence', () => {
    const peca = comRecortada();
    const vertice = na(peca.contorno.findIndex((p) => p.y === 200), 100, 200);
    const transferir = clicar('transferir-pence', O, peca, [noContorno(vertice), noContorno(na(1, 200, 200))]);

    expect(aplicarPence('transferir-pence', O, [peca], peca, transferir, novoId).recado).toBe(
      'Pence transferida em “Frente”, com o mesmo vértice e o mesmo ângulo. A área continua 580,0 cm².',
    );
  });
});

describe('a pence sem registro: o clique abre as medidas, e é aplicando que ela passa a ter registro', () => {
  const novoId = ids();
  // COM_PENCE é o retângulo com um "V" desenhado à mão no alto: não tem registro.
  const aMao = (): Molde => molde(COM_PENCE);
  const noV = (peca: Molde, ferramenta: FerramentaDePence = 'pence-no-contorno') => ({
    noContorno: VERTICE,
    livre: ponto(100, 200),
    pence: null,
    semRegistro: penceSemRegistroSobOClique(ferramenta, peca, ponto(100, 200), 6),
  });

  it('só “Pence no contorno” e “Pence interna” reconhecem, cada uma as suas', () => {
    expect(penceSemRegistroSobOClique('pence-no-contorno', aMao(), ponto(100, 200), 6)).toMatchObject({ id: ID_DA_PENCE_RECONHECIDA, tipo: 'recortada' });
    expect(penceSemRegistroSobOClique('pence-no-contorno', aMao(), ponto(100, 200), 6, 'meu-id')!.id).toBe('meu-id');
    expect(penceSemRegistroSobOClique('pence-interna', aMao(), ponto(100, 200), 6)).toBeNull();
    for (const ferramenta of ['fechar-pence', 'transferir-pence', 'multiplas-pences', 'pregas'] as const) {
      expect(penceSemRegistroSobOClique(ferramenta, aMao(), ponto(100, 200), 6)).toBeNull();
    }
  });

  it('o clique no vértice pede para reconhecer, em vez de começar outra pence ali', () => {
    const clique = cliqueDePence('pence-no-contorno', O, aMao(), SEM_TRECHO, noV(aMao()));

    expect(clique.estado).toBe(SEM_TRECHO);
    expect(clique.reconhecer).toMatchObject({ tipo: 'recortada', pontos: [ponto(120, 300), ponto(100, 200), ponto(80, 300)] });
    // Com um ponto já clicado, o clique é da pence nova, e não reconhece nada.
    const comInicio = { ...SEM_TRECHO, inicio: NO_ALTO };
    expect(cliqueDePence('pence-no-contorno', O, molde(), comInicio, { ...noV(aMao()), noContorno: null }).reconhecer).toBeUndefined();
    // A candidata que não é da ferramenta não abre nada.
    const daOutra = { ...noV(aMao()), semRegistro: { id: 'x', tipo: 'interna' as const, pontos: [] } };
    expect(cliqueDePence('pence-no-contorno', O, aMao(), SEM_TRECHO, daOutra).reconhecer).toBeUndefined();
  });

  it('a prévia destaca a pence sem registro que está sob o mouse', () => {
    expect(previaDaPence('pence-no-contorno', O, aMao(), SEM_TRECHO, noV(aMao()))).toEqual({
      marcas: [],
      substituido: [ponto(120, 300), ponto(100, 200), ponto(80, 300)],
    });
  });

  it('o diálogo avisa que a pence foi reconhecida e traz as medidas lidas do desenho', () => {
    const achada = { ...penceSemRegistroSobOClique('pence-no-contorno', aMao(), ponto(100, 200), 6)!, id: 'r1' };
    const pecaDaPence = comPenceReconhecida(aMao(), achada);
    const dialogo = dialogoDeEditarPence(pecaDaPence, 'r1', true)!;

    expect(dialogo.nota).toMatch(/^Esta pence não tinha registro .* Aplicando, ela passa a ter registro; fechando sem aplicar, nada muda\. A pence é refeita/);
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['abertura', '40'],
      ['profundidade', '100'],
      ['desvio', '0'],
      ['apagar', false],
    ]);
    // Sem o aviso, é o diálogo de sempre.
    expect(dialogoDeEditarPence(pecaDaPence, 'r1')!.nota).toMatch(/^A pence é refeita/);

    const resultado = aplicarEdicaoDaPence([aMao()], pecaDaPence, 'r1', { abertura: 50, profundidade: 100, desvio: 0, apagar: false }, novoId);
    expect(pencesDaPeca(resultado.pecas[0]!)).toHaveLength(1);
    expect(medidasDaPence(pencesDaPeca(resultado.pecas[0]!)[0]!).aberturaMm).toBeCloseTo(50, 6);
  });
});

describe('a pence aberta por pivô: medidas e fechar', () => {
  const novoId = ids();
  const aberta = (): Molde => abrirPence(molde(), NO_ALTO, na(0, 100, 0), 40, 100, true, novoId);

  it('o diálogo não pede desvio e explica o giro em torno do pivô', () => {
    const peca = aberta();
    const dialogo = dialogoDeEditarPence(peca, pencesDaPeca(peca)[0]!.id)!;

    expect(dialogo.titulo).toBe('Pence aberta por pivô: medidas');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['abertura', '40'],
      ['profundidade', '100'],
      ['apagar', false],
    ]);
    expect(dialogo.campos[2]!.rotulo).toBe('Fechar esta pence (a peça volta a ser a de antes de abrir)');
    expect(dialogo.nota).toMatch(/fecha em torno do mesmo pivô e abre de novo com a abertura nova/);
  });

  it('mudar a abertura abre de novo em torno do pivô, e a mensagem diz', () => {
    const peca = aberta();
    const resultado = aplicarEdicaoDaPence([peca], peca, pencesDaPeca(peca)[0]!.id, { abertura: 60, profundidade: 100, apagar: false }, novoId);
    const nova = resultado.pecas[0]!;
    const direta = abrirPence(molde(), NO_ALTO, na(0, 100, 0), 60, 100, true, novoId);

    expect(area(nova.contorno)).toBeCloseTo(area(direta.contorno), 6);
    expect(pivoDaPence(nova, pencesDaPeca(nova)[0]!)).not.toBeNull();
    expect(resultado.recado).toMatch(/^Pence de “Frente” aberta de novo em torno do pivô: abertura de 60,0 mm, profundidade de 100,0 mm\. A peça passou de \d+,\d cm² para \d+,\d cm²\.$/);
  });

  it('fechar devolve a peça de antes de abrir', () => {
    const peca = aberta();
    const resultado = aplicarEdicaoDaPence([peca], peca, pencesDaPeca(peca)[0]!.id, { abertura: 40, profundidade: 100, apagar: true }, novoId);

    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(60000, 6);
    expect(resultado.recado).toMatch(/^Pence fechada em “Frente”, em torno do pivô em que foi aberta: a peça voltou a ser a de antes\. A peça passou de \d+,\d cm² para 600,0 cm²\.$/);
  });
});

describe('uma prega já feita: abrir as medidas, mudar e tirar', () => {
  const novoId = ids();
  // Uma prega simples de 20 mm na linha de (100, 0) a (100, 300): a faixa dela vai de x = 100 a x = 140.
  const comPrega = (): Molde =>
    criarPregas(molde(), na(0, 100, 0), NO_ALTO, { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 20, piques: false }, null, novoId);
  const idDaPrega = (peca: Molde): string => pregasDaPeca(peca)[0]!.id;
  const dentroDaFaixa = (peca: Molde) => ({ noContorno: null, livre: ponto(120, 150), prega: idDaPrega(peca) });

  it('com “Pregas”, o clique dentro da faixa de uma prega registrada pede as medidas dela', () => {
    const peca = comPrega();

    expect(cliqueDePence('pregas', O, peca, SEM_TRECHO, dentroDaFaixa(peca))).toEqual({ estado: SEM_TRECHO, recusa: null, editarPrega: idDaPrega(peca) });
    // No contorno, o clique é o começo de outra prega; com outra ferramenta, ou com um ponto já clicado, também não abre.
    expect(cliqueDePence('pregas', O, peca, SEM_TRECHO, { ...dentroDaFaixa(peca), noContorno: na(1, 120, 0) }).editarPrega).toBeUndefined();
    expect(cliqueDePence('pence-interna', O, peca, SEM_TRECHO, dentroDaFaixa(peca)).editarPrega).toBeUndefined();
    expect(cliqueDePence('pregas', O, peca, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, dentroDaFaixa(peca)).editarPrega).toBeUndefined();
    expect(cliqueDePence('pregas', O, peca, SEM_TRECHO, { ...dentroDaFaixa(peca), prega: 'outra' }).editarPrega).toBeUndefined();
  });

  it('a prévia marca o meio de cada prega e destaca a faixa da que está sob o mouse', () => {
    const peca = comPrega();

    expect(previaDaPence('pregas', O, peca, SEM_TRECHO, null)).toEqual({ marcas: [ponto(120, 150)] });
    expect(previaDaPence('pregas', O, peca, SEM_TRECHO, dentroDaFaixa(peca))).toEqual({
      marcas: [ponto(120, 150)],
      substituido: [ponto(100, 0), ponto(100, 300), ponto(140, 300), ponto(140, 0), ponto(100, 0)],
    });
    // As ferramentas de pence não marcam as pregas.
    expect(previaDaPence('pence-no-contorno', O, peca, SEM_TRECHO, null)).toEqual({ marcas: [] });
  });

  it('o diálogo abre com o modo e as larguras lidos da prega', () => {
    const peca = comPrega();
    const dialogo = dialogoDeEditarPrega(peca, idDaPrega(peca))!;

    expect(dialogo.titulo).toBe('Prega: medidas');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['modo', 'simples-direita'],
      ['largura', '20'],
      ['largura2', '20'],
      ['apagar', false],
    ]);
    expect(dialogoDeEditarPrega(peca, 'outra')).toBeNull();
  });

  it('mudar as larguras abre a prega de novo e diz como a área ficou', () => {
    const peca = comPrega();
    const igual = aplicarEdicaoDaPrega([peca], peca, idDaPrega(peca), { modo: 'dupla', largura: 10, largura2: 10, apagar: false }, novoId);
    expect(medidasDaPrega(pregasDaPeca(igual.pecas[0]!)[0]!)).toEqual({ modo: 'dupla', larguraMm: 10, largura2Mm: 10 });
    expect(igual.recado).toBe('Prega de “Frente” aberta de novo: dupla, largura de 10,0 mm. A peça passou de 720,0 cm² para 720,0 cm².');

    const diferente = aplicarEdicaoDaPrega([peca], peca, idDaPrega(peca), { modo: 'simples-esquerda', largura: 20, largura2: 30, apagar: false }, novoId);
    expect(diferente.recado).toMatch(/^Prega de “Frente” aberta de novo: simples, larguras de 20,0 mm e 30,0 mm\. A peça passou de 720,0 cm² para 749,9 cm²\.$/);
  });

  it('tirar a prega fecha a peça de volta', () => {
    const peca = comPrega();
    const resultado = aplicarEdicaoDaPrega([peca], peca, idDaPrega(peca), { modo: 'simples-direita', largura: 20, largura2: 20, apagar: true }, novoId);

    expect(resultado.pecas[0]!.contorno).toHaveLength(4);
    expect(pregasDaPeca(resultado.pecas[0]!)).toHaveLength(0);
    expect(resultado.recado).toBe('Prega tirada de “Frente”: o lado que tinha andado voltou. A peça passou de 720,0 cm² para 600,0 cm².');
  });

  it('medidas que não servem dão erro, e a prega que não está mais registrada também', () => {
    const peca = comPrega();

    expect(() => aplicarEdicaoDaPrega([peca], peca, idDaPrega(peca), { modo: 'dupla', largura: 0, largura2: 10, apagar: false }, novoId)).toThrow(/largura/);
    expect(() => aplicarEdicaoDaPrega([peca], peca, 'outra', { modo: 'dupla', largura: 10, largura2: 10, apagar: false }, novoId)).toThrow(/mexida à mão/);
  });

  it('a instrução avisa do clique que abre as medidas, quando a peça tem pregas registradas', () => {
    expect(instrucaoDaPence('pregas', O, SEM_TRECHO, false, true)).toMatch(/Ou clique dentro de uma prega já feita \(as marcadas com um anel\) para mudar as larguras dela ou tirá-la\. Esc sai\.$/);
    expect(instrucaoDaPence('pregas', O, SEM_TRECHO)).not.toMatch(/prega já feita/);
    expect(instrucaoDaPence('pregas', O, { ...SEM_TRECHO, inicio: na(0, 50, 0) }, false, true)).not.toMatch(/prega já feita/);
  });
});

describe('“Pregas” pela reta auxiliar e o pique no vértice da pence aberta', () => {
  it('o clique numa linha interna reta faz dela a linha da prega, de borda a borda', () => {
    const peca: Molde = { ...molde(), linhasInternas: [[ponto(100, 50), ponto(100, 250)], [ponto(20, 20), ponto(40, 60), ponto(20, 100)]] };
    const clique = cliqueDePence('pregas', O, peca, SEM_TRECHO, { noContorno: null, livre: ponto(100, 150), linhaInterna: 0 });

    expect(clique.recusa).toBeNull();
    expect([clique.estado.inicio!.ponto, clique.estado.fim!.ponto]).toContainEqual(ponto(100, 0));
    expect([clique.estado.inicio!.ponto, clique.estado.fim!.ponto]).toContainEqual(ponto(100, 300));
    // Com uma prega só, as duas pontas já completam a ferramenta.
    expect(penceCompleta('pregas', O, clique.estado)).toBe(O.pregas.quantidade === 1);
  });

  it('a linha que não é reta é recusada com a explicação; no contorno, o clique começa a linha como sempre', () => {
    const peca: Molde = { ...molde(), linhasInternas: [[ponto(20, 20), ponto(40, 60), ponto(20, 100)]] };
    const torta = cliqueDePence('pregas', O, peca, SEM_TRECHO, { noContorno: null, livre: ponto(40, 60), linhaInterna: 0 });
    expect(torta.estado).toBe(SEM_TRECHO);
    expect(torta.recusa).toMatch(/precisa ser reta para servir de linha da prega/);

    const noContornoDaPeca = cliqueDePence('pregas', O, peca, SEM_TRECHO, { noContorno: na(0, 100, 0), livre: ponto(100, 0), linhaInterna: 0 });
    expect(noContornoDaPeca.estado.inicio).toEqual(na(0, 100, 0));
    expect(noContornoDaPeca.estado.fim).toBeNull();
    // As outras ferramentas não usam a linha interna.
    expect(cliqueDePence('pence-interna', O, peca, SEM_TRECHO, { noContorno: null, livre: ponto(100, 150), linhaInterna: 0 }).estado.inicio).toBeNull();
  });

  it('a instrução das pregas diz da reta auxiliar', () => {
    expect(instrucaoDaPence('pregas', O, SEM_TRECHO)).toMatch(/ou numa linha interna reta \(a reta auxiliar\), que vira a linha da prega, de borda a borda\. Esc sai\.$/);
  });

  it('“Abrir” com o pique no vértice põe a marca no vértice da pence aberta', () => {
    const opcoes = com({ pence: { ...O.pence, modo: 'abrir', marcaNoVertice: true, piquesLaterais: false } });
    const estado: TrechoEmEdicao = { inicio: NO_ALTO, fim: na(0, 100, 0), livres: [] };
    const aberta = aplicarPence('pence-no-contorno', opcoes, [molde()], molde(), estado, ids()).pecas[0]!;

    expect(aberta.marcas).toHaveLength(1);
    expect(aberta.marcas[0]!.posicao).toEqual(pencesDaPeca(aberta)[0]!.pontos[1]);
    const semMarca = aplicarPence('pence-no-contorno', com({ pence: { ...O.pence, modo: 'abrir', marcaNoVertice: false } }), [molde()], molde(), estado, ids()).pecas[0]!;
    expect(semMarca.marcas).toHaveLength(0);
  });
});

describe('“Criar acabamento” no Abrir', () => {
  const estado: TrechoEmEdicao = { inicio: NO_ALTO, fim: na(0, 100, 0), livres: [] };
  const ABRIR = { ...O.pence, modo: 'abrir' as const, aberturaMm: 40, profundidadeMm: 100, piquesLaterais: false, marcaNoVertice: false };

  it('o diálogo tem a opção, e ela é lida', () => {
    expect(dialogoDaPence('pence-no-contorno', O)!.campos.map((c) => c.id)).toContain('acabamento');
    expect(dialogoDaPence('pence-no-contorno', O)!.nota).toMatch(/Com “Criar acabamento”, a pence aberta fica desenhada, e o contorno ganha o bico que ela faz quando é dobrada/);
    expect(lerDialogoDaPence('pence-no-contorno', O, { modo: 'abrir', abertura: 40, profundidade: 100, perpendicular: true, piquesLaterais: false, marcaNoVertice: false }).pence.acabamento).toBe(false);
  });

  it('com a opção, a pence aberta fica desenhada e o contorno ganha o bico; a mensagem diz', () => {
    const resultado = aplicarPence('pence-no-contorno', com({ pence: { ...ABRIR, acabamento: true } }), [molde()], molde(), estado, ids());
    const aberta = resultado.pecas[0]!;
    const pence = pencesDaPeca(aberta)[0]!;

    expect(pence.tipo).toBe('marcada');
    expect(pence.bico).toBeDefined();
    expect(aberta.linhasInternas).toHaveLength(1);
    expect(resultado.recado).toMatch(/^Pence aberta em “Frente”, com acabamento \(desenhada, com o bico no contorno\): abertura de 40,0 mm, profundidade de 100,0 mm\. A peça passou de/);
    // As medidas dela abrem como as da pence aberta por pivô.
    expect(dialogoDeEditarPence(aberta, pence.id)!.titulo).toBe('Pence aberta por pivô: medidas');
    const mudada = aplicarEdicaoDaPence([aberta], aberta, pence.id, { abertura: 60, profundidade: 100, apagar: false }, ids()).pecas[0]!;
    expect(pencesDaPeca(mudada)[0]!.bico).toBeDefined();
  });

  it('sem a opção, ou fora do Abrir, nada de bico', () => {
    const semOpcao = aplicarPence('pence-no-contorno', com({ pence: ABRIR }), [molde()], molde(), estado, ids());
    expect(pencesDaPeca(semOpcao.pecas[0]!)[0]!.tipo).toBe('recortada');
    expect(semOpcao.recado).not.toMatch(/acabamento/);

    const recortar = com({ pence: { ...ABRIR, modo: 'recortar', acabamento: true, perpendicular: true } });
    const recortada = aplicarPence('pence-no-contorno', recortar, [molde()], molde(), { inicio: NO_ALTO, fim: null, livres: [] }, ids());
    expect(pencesDaPeca(recortada.pecas[0]!)[0]!.tipo).toBe('recortada');
    expect(recortada.recado).not.toMatch(/acabamento/);
  });
});
