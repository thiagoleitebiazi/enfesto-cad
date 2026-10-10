import { describe, it, expect } from 'vitest';
import { area, ponto, type PosicaoNoContorno } from '../core/geometria';
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

describe('diálogos', () => {
  it('cada ferramenta que tem opções abre com o que foi usado por último; "Transferir pence" não pergunta nada', () => {
    expect(dialogoDaPence('transferir-pence', O)).toBeNull();
    for (const ferramenta of TODAS.filter((f) => f !== 'transferir-pence')) {
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
    const valores = { modo: 'abrir', abertura: 45, profundidade: 120, perpendicular: false, piquesLaterais: true, marcaNoVertice: false };
    expect(lerDialogoDaPence('pence-no-contorno', O, valores).pence).toEqual({
      modo: 'abrir',
      aberturaMm: 45,
      profundidadeMm: 120,
      perpendicular: false,
      piquesLaterais: true,
      marcaNoVertice: false,
    });
    expect(() => lerDialogoDaPence('pence-no-contorno', O, { ...valores, abertura: 0 })).toThrow(/abertura/);
    // As outras ferramentas não mudam.
    expect(lerDialogoDaPence('pence-no-contorno', O, valores).pregas).toBe(O.pregas);
  });

  it('lê as opções da pence interna, do fechar e das múltiplas pences', () => {
    const interna = lerDialogoDaPence('pence-interna', O, { altura1: 50, altura2: 70, largura: 16, angulo: -15, linhaAuxiliar: false, marcas: true });
    expect(interna.interna).toEqual({ altura1Mm: 50, altura2Mm: 70, larguraMm: 16, anguloGraus: -15, linhaAuxiliar: false, marcas: true });
    expect(() => lerDialogoDaPence('pence-interna', O, { altura1: 0, altura2: 70, largura: 16, angulo: 0 })).toThrow(/alturas/);

    expect(lerDialogoDaPence('fechar-pence', O, { somenteORecorte: true }).fecharSomenteORecorte).toBe(true);
    expect(lerDialogoDaPence('transferir-pence', O, {})).toBe(O);

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
