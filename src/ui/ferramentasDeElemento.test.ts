import { describe, it, expect } from 'vitest';
import { area, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, type DadosDeNovoMolde, type Molde } from '../domain/molde';
import {
  apagarElementoEscolhido,
  aplicarPontoPorCoordenada,
  cliqueDeElemento,
  dialogoDoElemento,
  ehModoDeElemento,
  instrucaoDoElemento,
  lerDialogoDoElemento,
  OPCOES_INICIAIS_DE_ELEMENTO,
  previaDoElemento,
  type CliqueDeElemento,
  type FerramentaDeElemento,
  type ModoDeElemento,
  type OpcoesDeElemento,
} from './ferramentasDeElemento';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const EM_PE = [ponto(100, 50), ponto(100, 150)];
const DEITADA = [ponto(20, 200), ponto(60, 200)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}, id = 'f'): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever },
    id,
  );
}

const comLinhas = (): Molde => molde({ linhasInternas: [EM_PE, DEITADA] });
const O = OPCOES_INICIAIS_DE_ELEMENTO;
const com = (parte: Partial<OpcoesDeElemento>): OpcoesDeElemento => ({ ...O, ...parte });
const solto = (x: number, y: number): CliqueDeTrecho => ({ noContorno: null, livre: ponto(x, y) });
const noContorno = (indiceAresta: number, x: number, y: number): CliqueDeTrecho => {
  const posicao: PosicaoNoContorno = { indiceAresta, ponto: ponto(x, y) };
  return { noContorno: posicao, livre: ponto(x + 1, y + 1) };
};
const RAIO = 5;

function clicar(
  modo: ModoDeElemento,
  opcoes: OpcoesDeElemento,
  peca: Molde,
  clique: CliqueDeTrecho,
  estado: TrechoEmEdicao = SEM_TRECHO,
  pecas: readonly Molde[] = [peca],
): CliqueDeElemento {
  let n = 0;
  return cliqueDeElemento(modo, opcoes, pecas, peca, estado, clique, RAIO, () => `novo-${++n}`);
}

const MODOS: readonly ModoDeElemento[] = [
  'reta-por-angulo',
  'estender-reta',
  'estender-ate-elemento',
  'estender-duas-retas',
  'ponto-por-intersecao',
  'ponto-no-centro-do-arco',
  'ponto-no-perimetro',
  'ponto-por-distancia',
  'extrair-molde',
  'mover-ponto-de-construcao',
  'manipulacao-rapida',
  'dividir-linha',
  'transformar-em-elementos',
  'copiar-elemento',
];

describe('quais ferramentas ficam ligadas à espera de cliques', () => {
  it('catorze são modos; "Por coordenada" age ao confirmar o diálogo', () => {
    for (const modo of MODOS) expect(ehModoDeElemento(modo)).toBe(true);
    for (const outra of ['ponto-por-coordenada', 'selecionar', 'cortar']) expect(ehModoDeElemento(outra)).toBe(false);
  });
});

describe('retas', () => {
  it('"Por ângulo": o clique junto do contorno começa bem em cima dele', () => {
    const resultado = clicar('reta-por-angulo', com({ porAngulo: { anguloGraus: 0, comprimentoMm: 80 } }), molde(), noContorno(3, 0, 100));
    expect(resultado.pecas![0]!.linhasInternas).toEqual([[ponto(0, 100), ponto(0, 180)]]);
    expect(resultado.recado).toBe('Reta de 80,0 mm a 0° criada em “Frente”, como linha interna.');
    expect(resultado.estado).toBe(SEM_TRECHO);
  });

  it('"Estender reta" e "Estender até elemento": perto da ponta de uma linha', () => {
    const estendida = clicar('estender-reta', com({ estender: { comprimentoMm: 30 } }), comLinhas(), solto(101, 148));
    expect(estendida.pecas![0]!.linhasInternas[0]).toEqual([ponto(100, 50), ponto(100, 180)]);
    expect(estendida.recado).toBe('Linha estendida 30,0 mm.');
    const ateABorda = clicar('estender-ate-elemento', O, comLinhas(), solto(101, 148));
    expect(ateABorda.pecas![0]!.linhasInternas[0]).toEqual([ponto(100, 50), ponto(100, 300)]);
  });

  it('longe de qualquer linha, o clique só avisa', () => {
    for (const modo of ['estender-reta', 'estender-ate-elemento', 'estender-duas-retas'] as const) {
      const resultado = clicar(modo, O, comLinhas(), solto(150, 250));
      expect(resultado.pecas).toBeUndefined();
      expect(resultado.recado).toMatch(/perto da ponta de uma linha interna/);
    }
  });

  it('"Estender duas retas": o primeiro clique guarda a linha; o segundo leva as duas ao encontro', () => {
    const primeiro = clicar('estender-duas-retas', O, comLinhas(), solto(101, 148));
    expect(primeiro.pecas).toBeUndefined();
    expect(primeiro.estado.livres).toEqual([ponto(101, 148)]);
    const segundo = clicar('estender-duas-retas', O, comLinhas(), solto(58, 201), primeiro.estado);
    expect(segundo.pecas![0]!.linhasInternas).toEqual([
      [ponto(100, 50), ponto(100, 200)],
      [ponto(20, 200), ponto(100, 200)],
    ]);
    expect(segundo.estado).toBe(SEM_TRECHO);
  });

  it('o erro do domínio vira o recado, e a ferramenta recomeça', () => {
    const primeiro = clicar('estender-duas-retas', O, comLinhas(), solto(101, 148));
    const naMesma = clicar('estender-duas-retas', O, comLinhas(), solto(101, 60), primeiro.estado);
    expect(naMesma.pecas).toBeUndefined();
    expect(naMesma.recado).toMatch(/duas linhas diferentes/);
    expect(naMesma.estado).toBe(SEM_TRECHO);
  });
});

describe('pontos', () => {
  it('"Por coordenada": a marca entra na posição digitada, ao confirmar o diálogo', () => {
    const resultado = aplicarPontoPorCoordenada(com({ coordenada: { xMm: 120, yMm: 45.5 } }), [molde()], molde(), () => 'p1');
    expect(resultado.pecas[0]!.marcas).toEqual([{ id: 'p1', posicao: ponto(120, 45.5) }]);
    expect(resultado.recado).toBe('Ponto criado em “Frente”, em X 120,0 mm e Y 45,5 mm.');
  });

  it('"Por interseção": dois cliques em dois elementos', () => {
    const primeiro = clicar('ponto-por-intersecao', O, comLinhas(), solto(101, 100));
    expect(primeiro.estado.livres).toHaveLength(1);
    const segundo = clicar('ponto-por-intersecao', O, comLinhas(), solto(40, 201), primeiro.estado);
    expect(segundo.pecas![0]!.marcas[0]!.posicao).toEqual(ponto(100, 200));
    // Uma aresta do contorno também serve de elemento.
    const comAresta = clicar('ponto-por-intersecao', O, comLinhas(), solto(100, 299), primeiro.estado);
    expect(comAresta.pecas![0]!.marcas[0]!.posicao).toEqual(ponto(100, 300));
    expect(clicar('ponto-por-intersecao', O, comLinhas(), solto(150, 150)).recado).toMatch(/aresta do contorno ou sobre uma linha interna/);
  });

  it('"No perímetro" e "No centro do arco" pedem um clique no contorno', () => {
    const noPerimetro = clicar('ponto-no-perimetro', com({ noPerimetro: { distanciaMm: 120 } }), molde(), noContorno(0, 150, 0));
    expect(noPerimetro.pecas![0]!.marcas[0]!.posicao).toEqual(ponto(200, 70));
    expect(noPerimetro.recado).toBe('Ponto criado sobre o contorno de “Frente”, a 120,0 mm do ponto clicado.');
    expect(clicar('ponto-no-perimetro', O, molde(), solto(100, 100)).recado).toBe('Clique sobre o contorno da peça selecionada.');
    // Numa reta não há centro de arco: o erro do domínio é o recado.
    expect(clicar('ponto-no-centro-do-arco', O, molde(), noContorno(0, 150, 0)).recado).toMatch(/é uma reta/);
  });

  it('"Por distância": o primeiro clique é a partida, e o segundo dá a direção', () => {
    const opcoes = com({ porDistancia: { distanciaMm: 100 } });
    const primeiro = clicar('ponto-por-distancia', opcoes, molde(), noContorno(0, 0, 0));
    expect(primeiro.estado.livres).toEqual([ponto(0, 0)]);
    const segundo = clicar('ponto-por-distancia', opcoes, molde(), solto(30, 40), primeiro.estado);
    expect(segundo.pecas![0]!.marcas[0]!.posicao.x).toBeCloseTo(60, 6);
    expect(segundo.pecas![0]!.marcas[0]!.posicao.y).toBeCloseTo(80, 6);
  });
});

describe('extrair molde', () => {
  const dividida = (): Molde => molde({ linhasInternas: [[ponto(0, 100), ponto(200, 100)]] });

  it('a região clicada vira uma peça nova, depois das que já estão na mesa; a de origem fica', () => {
    const peca = dividida();
    const resultado = clicar('extrair-molde', O, peca, solto(100, 50));
    expect(resultado.pecas).toHaveLength(2);
    expect(resultado.pecas![0]).toBe(peca);
    const nova = resultado.pecas![1]!;
    expect(nova.nome).toBe('Frente (2)');
    expect(area(nova.contorno)).toBeCloseTo(20000, 6);
    // A origem vai até y = 300: a nova começa em 320.
    expect(Math.min(...nova.contorno.map((p) => p.y))).toBeCloseTo(320, 6);
    expect(resultado.recado).toBe('Molde “Frente (2)” extraído de “Frente”: 200,0 cm², posto depois das peças que já estavam na mesa. “Frente” não mudou.');
  });

  it('sem região delimitada, o recado explica o que falta', () => {
    const resultado = clicar('extrair-molde', O, molde(), solto(100, 50));
    expect(resultado.pecas).toBeUndefined();
    expect(resultado.recado).toMatch(/Nenhuma linha interna delimita/);
  });

  it('a prévia mostra a região que viraria peça', () => {
    const previa = previaDoElemento('extrair-molde', O, [dividida()], dividida(), SEM_TRECHO, solto(100, 50), RAIO);
    expect(previa.novoFechado).toBe(true);
    expect(area(previa.novo as Ponto2D[])).toBeCloseTo(20000, 6);
    expect(previaDoElemento('extrair-molde', O, [molde()], molde(), SEM_TRECHO, solto(100, 50), RAIO)).toEqual({});
  });
});

describe('elementos da aba Manipulação', () => {
  const comMarca = (): Molde => ({ ...comLinhas(), marcas: [{ id: 'm', posicao: ponto(150, 250) }] });

  it('"Manipular pontos": clique na marca e, depois, onde ela deve ficar', () => {
    const primeiro = clicar('mover-ponto-de-construcao', O, comMarca(), solto(151, 251));
    expect(primeiro.estado.livres).toHaveLength(1);
    const segundo = clicar('mover-ponto-de-construcao', O, comMarca(), solto(120, 220), primeiro.estado);
    expect(segundo.pecas![0]!.marcas[0]!.posicao).toEqual(ponto(120, 220));
    // Uma linha não é um ponto.
    expect(clicar('mover-ponto-de-construcao', O, comMarca(), solto(101, 100)).recado).toMatch(/ponto \(marca\)/);
  });

  it('"Manipulação rápida": o elemento anda o que o mouse andou do primeiro clique ao segundo', () => {
    const primeiro = clicar('manipulacao-rapida', O, comLinhas(), solto(101, 100));
    const segundo = clicar('manipulacao-rapida', O, comLinhas(), solto(131, 90), primeiro.estado);
    expect(segundo.pecas![0]!.linhasInternas[0]).toEqual([ponto(130, 40), ponto(130, 140)]);
    expect(segundo.recado).toBe('Linha movida em “Frente”.');
    expect(clicar('manipulacao-rapida', O, comLinhas(), solto(150, 250)).recado).toMatch(/linha interna ou de um ponto/);
  });

  it('"Manipulação rápida": com um elemento escolhido, Delete apaga-o', () => {
    const peca = comMarca();
    const escolhida = clicar('manipulacao-rapida', O, peca, solto(151, 251)).estado;
    const apagado = apagarElementoEscolhido([peca], peca, escolhida, RAIO)!;
    expect(apagado.pecas[0]!.marcas).toEqual([]);
    expect(apagado.recado).toBe('Ponto apagado de “Frente”.');
    const linha = clicar('manipulacao-rapida', O, peca, solto(101, 100)).estado;
    expect(apagarElementoEscolhido([peca], peca, linha, RAIO)!.pecas[0]!.linhasInternas).toEqual([DEITADA]);
    expect(apagarElementoEscolhido([peca], peca, SEM_TRECHO, RAIO)).toBeNull();
  });

  it('"Dividir elementos": a linha clicada vira duas', () => {
    const resultado = clicar('dividir-linha', O, comLinhas(), solto(101, 90));
    expect(resultado.pecas![0]!.linhasInternas).toHaveLength(3);
    expect(resultado.recado).toBe('Linha dividida em duas, em “Frente”.');
  });

  it('"Transformar em elementos": o contorno da outra peça clicada entra como linha interna', () => {
    const frente = molde();
    const bolso = molde({ nome: 'Bolso', contorno: [ponto(50, 50), ponto(150, 50), ponto(150, 150), ponto(50, 150)] }, 'b');
    const resultado = clicar('transformar-em-elementos', O, frente, solto(100, 100), SEM_TRECHO, [frente, bolso]);
    expect(resultado.pecas![0]!.linhasInternas).toHaveLength(1);
    expect(resultado.pecas![0]!.linhasInternas[0]).toHaveLength(5);
    expect(resultado.pecas![1]).toBe(bolso);
    expect(resultado.recado).toMatch(/^O contorno de “Bolso” entrou em “Frente” como linha interna/);
    // Sem outra peça sob o clique, só avisa.
    expect(clicar('transformar-em-elementos', O, frente, solto(100, 100)).recado).toMatch(/Clique em outra peça/);
  });

  it('"Copiar ou trocar elemento": copia a linha da outra peça; trocando, ela sai de lá', () => {
    const frente = molde();
    const costas = { ...comLinhas(), id: 'c', nome: 'Costas' };
    const copiada = clicar('copiar-elemento', O, frente, solto(101, 100), SEM_TRECHO, [frente, costas]);
    expect(copiada.pecas![0]!.linhasInternas).toEqual([EM_PE]);
    expect(copiada.pecas![1]).toBe(costas);
    expect(copiada.recado).toBe('Linha de “Costas” copiada para “Frente”.');
    const trocada = clicar('copiar-elemento', com({ copiar: { modo: 'trocar' } }), frente, solto(101, 100), SEM_TRECHO, [frente, costas]);
    expect(trocada.pecas![0]!.linhasInternas).toEqual([EM_PE]);
    expect(trocada.pecas![1]!.linhasInternas).toEqual([DEITADA]);
    expect(trocada.recado).toBe('Linha de “Costas” passou para “Frente”.');
    expect(clicar('copiar-elemento', O, frente, solto(150, 250), SEM_TRECHO, [frente, costas]).recado).toMatch(/de outra peça/);
  });
});

describe('diálogos, prévia e instruções', () => {
  const COM_DIALOGO: readonly FerramentaDeElemento[] = [
    'reta-por-angulo',
    'estender-reta',
    'ponto-por-coordenada',
    'ponto-no-perimetro',
    'ponto-por-distancia',
    'copiar-elemento',
  ];

  it('seis ferramentas perguntam antes; as outras ligam direto', () => {
    for (const ferramenta of COM_DIALOGO) {
      const dialogo = dialogoDoElemento(ferramenta, O)!;
      expect(dialogo.titulo.length).toBeGreaterThan(5);
      expect(dialogo.campos.length).toBeGreaterThan(0);
    }
    for (const ferramenta of MODOS.filter((m) => !COM_DIALOGO.includes(m))) expect(dialogoDoElemento(ferramenta, O)).toBeNull();
    expect(dialogoDoElemento('ponto-por-coordenada', O)!.rotuloDoBotao).toBe('Criar ponto');
  });

  it('lê as opções e recusa as medidas que não servem', () => {
    expect(lerDialogoDoElemento('reta-por-angulo', O, { angulo: 45, comprimento: 120 }).porAngulo).toEqual({ anguloGraus: 45, comprimentoMm: 120 });
    expect(lerDialogoDoElemento('estender-reta', O, { comprimento: 15 }).estender).toEqual({ comprimentoMm: 15 });
    expect(lerDialogoDoElemento('ponto-por-coordenada', O, { x: 10, y: -5 }).coordenada).toEqual({ xMm: 10, yMm: -5 });
    expect(lerDialogoDoElemento('ponto-no-perimetro', O, { distancia: -30 }).noPerimetro).toEqual({ distanciaMm: -30 });
    expect(lerDialogoDoElemento('ponto-por-distancia', O, { distancia: 25 }).porDistancia).toEqual({ distanciaMm: 25 });
    expect(lerDialogoDoElemento('copiar-elemento', O, { modo: 'trocar' }).copiar).toEqual({ modo: 'trocar' });
    expect(() => lerDialogoDoElemento('reta-por-angulo', O, { angulo: 0, comprimento: 0 })).toThrow(/maior que zero/);
    expect(() => lerDialogoDoElemento('ponto-no-perimetro', O, { distancia: 0 })).toThrow(/diferente de zero/);
  });

  it('a prévia mostra a reta que o clique criaria, e a linha como ficaria estendida', () => {
    const reta = previaDoElemento('reta-por-angulo', com({ porAngulo: { anguloGraus: 0, comprimentoMm: 80 } }), [molde()], molde(), SEM_TRECHO, solto(100, 100), RAIO);
    expect(reta.linhas).toEqual([[ponto(100, 100), ponto(100, 180)]]);
    const peca = comLinhas();
    const estendida = previaDoElemento('estender-ate-elemento', O, [peca], peca, SEM_TRECHO, solto(101, 148), RAIO);
    expect(estendida.linhas).toEqual([[ponto(100, 50), ponto(100, 300)]]);
    // Longe de qualquer linha, nada.
    expect(previaDoElemento('estender-ate-elemento', O, [peca], peca, SEM_TRECHO, solto(150, 250), RAIO)).toEqual({ marcas: [] });
    expect(previaDoElemento('estender-ate-elemento', O, [peca], peca, SEM_TRECHO, null, RAIO)).toEqual({ marcas: [] });
  });

  it('a prévia marca o ponto que o clique criaria e o primeiro ponto já clicado', () => {
    const opcoes = com({ porDistancia: { distanciaMm: 100 } });
    const comPartida: TrechoEmEdicao = { ...SEM_TRECHO, livres: [ponto(0, 0)] };
    const previa = previaDoElemento('ponto-por-distancia', opcoes, [molde()], molde(), comPartida, solto(30, 40), RAIO);
    expect(previa.marcas).toHaveLength(2);
    expect(previa.marcas![0]).toEqual(ponto(0, 0));
    expect(previa.marcas![1]!.x).toBeCloseTo(60, 6);
  });

  it('cada ferramenta diz o próximo clique e termina com "Esc sai."', () => {
    const comPrimeiro: TrechoEmEdicao = { ...SEM_TRECHO, livres: [ponto(1, 1)] };
    for (const modo of MODOS) {
      for (const estado of [SEM_TRECHO, comPrimeiro]) {
        const texto = instrucaoDoElemento(modo, O, estado);
        expect(texto.endsWith(' Esc sai.')).toBe(true);
        expect(texto).toMatch(/clique/);
      }
    }
    expect(instrucaoDoElemento('manipulacao-rapida', O, comPrimeiro)).toMatch(/tecle Delete/);
    expect(instrucaoDoElemento('copiar-elemento', com({ copiar: { modo: 'trocar' } }), SEM_TRECHO)).toMatch(/^Trocar elemento de peça/);
  });
});
