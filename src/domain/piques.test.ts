import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { adicionarTexto, alterarTexto } from './anotacoes';
import { desdobrarMolde } from './corteEUniao';
import { criarMolde, espelharMolde, rotacionarMolde, type FormatoDePique, type Molde, type Pique } from './molde';
import {
  conferirFormato,
  formaDosElementos,
  inserirPique,
  inserirPiqueInterno,
  marcaPerto,
  nomeDoFormato,
  PIQUE_PADRAO,
  posicaoPelaReferencia,
  proximoCodigo,
  semOsPiques,
  TIPOS_DE_PIQUE,
  tipoDePique,
  tracosDaMarca,
  tracosDoPique,
  tracosNaLinhaDeCorte,
} from './piques';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm. A aresta 0 vai de (0, 0) a (200, 0); o lado de dentro dela é o do y positivo.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const molde = (contorno: readonly Ponto2D[] = RETANGULO, margemDeCosturaMm = 0): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1'),
  margemDeCosturaMm,
});
const formato = (tipo: string, larguraMm = 4, alturaMm = 6, anguloGraus = 0): FormatoDePique => ({ tipo, larguraMm, alturaMm, anguloGraus });
/** Os mesmos pontos, em qualquer ordem: serve ao desenho simétrico, que no espelho sai com os pontos na ordem contrária. */
const mesmosPontos = (tracos: readonly (readonly Ponto2D[])[], esperados: readonly (readonly Ponto2D[])[]): void => {
  const [achados, queridos] = [tracos.flat(), esperados.flat()];
  expect(achados).toHaveLength(queridos.length);
  for (const q of queridos) expect(Math.min(...achados.map((a) => Math.hypot(a.x - q.x, a.y - q.y)))).toBeLessThan(1e-9);
};
const NA_BORDA = { indiceAresta: 0, ponto: ponto(100, 0) };
const pique = (f?: FormatoDePique, extra: Partial<Pique> = {}): Pique => ({ id: 'p', posicao: NA_BORDA.ponto, indiceAresta: 0, ...(f ? { formato: f } : {}), ...extra });
const perto = (a: Ponto2D, b: Ponto2D): void => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};
const pertoDe = (tracos: readonly (readonly Ponto2D[])[], esperados: readonly (readonly Ponto2D[])[]): void => {
  expect(tracos.map((t) => t.length)).toEqual(esperados.map((t) => t.length));
  tracos.forEach((traco, i) => traco.forEach((q, k) => perto(q, esperados[i]![k]!)));
};

describe('os formatos de pique', () => {
  it('o programa traz sete tipos, cada um com nome, descrição e traços no quadro de 1 × 1', () => {
    expect(TIPOS_DE_PIQUE.map((t) => t.id)).toEqual(['traco', 'v', 't', 'u', 'caixa', 'cruz', 'circulo']);
    for (const tipo of TIPOS_DE_PIQUE) {
      expect(tipo.nome.length).toBeGreaterThan(0);
      expect(tipo.descricao.length).toBeGreaterThan(3);
      for (const q of tipo.tracos.flat()) {
        expect(Math.abs(q.x)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(q.y).toBeGreaterThanOrEqual(-1e-9);
        expect(q.y).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    expect(tipoDePique('v')!.nome).toBe('V');
    expect(tipoDePique('nao-existe')).toBeNull();
    expect(PIQUE_PADRAO).toEqual({ tipo: 'traco', larguraMm: 4, alturaMm: 6, anguloGraus: 0 });
  });

  it('o nome do formato é o do tipo do programa, ou o do pique cadastrado', () => {
    expect(nomeDoFormato(formato('t'))).toBe('T');
    expect(nomeDoFormato(undefined)).toBe('Traço (I)');
    expect(nomeDoFormato({ ...formato('cadastrado:x'), forma: [[ponto(0, 0), ponto(0, 1)]], nome: 'Seta' })).toBe('Seta');
  });

  it('recusa o formato que não dá para desenhar', () => {
    expect(() => conferirFormato(formato('v'))).not.toThrow();
    expect(() => conferirFormato({ ...formato('meu'), forma: [[ponto(0, 0), ponto(0, 1)]] })).not.toThrow();
    expect(() => conferirFormato(formato('meu'))).toThrow('Escolha um tipo de pique da lista.');
    expect(() => conferirFormato(formato('v', 0.2))).toThrow('A largura do pique precisa ficar entre 0.5 e 200 mm.');
    expect(() => conferirFormato(formato('v', 4, 300))).toThrow('A altura do pique precisa ficar entre 0.5 e 200 mm.');
    expect(() => conferirFormato(formato('v', 4, 6, 200))).toThrow('O ângulo do pique precisa ficar entre −180° e 180°.');
    expect(() => conferirFormato(formato('v', 4, 6, Number.NaN))).toThrow(/ângulo/);
  });
});

describe('os traços do pique do contorno', () => {
  it('o pique sem formato continua sendo o traço de 6 mm de sempre, para o lado em que o contorno foi desenhado', () => {
    expect(tracosDoPique(molde(), pique())).toEqual([[ponto(100, 0), ponto(100, -6)]]);
  });

  it('com formato, nasce na borda e entra na peça — seja qual for o sentido em que o contorno está guardado', () => {
    pertoDe(tracosDoPique(molde(), pique(formato('traco'))), [[ponto(100, 0), ponto(100, 6)]]);
    pertoDe(tracosDoPique(molde(), pique(formato('v'))), [[ponto(98, 0), ponto(100, 6), ponto(102, 0)]]);
    pertoDe(tracosDoPique(molde(), pique(formato('t', 10, 8))), [
      [ponto(100, 0), ponto(100, 8)],
      [ponto(95, 8), ponto(105, 8)],
    ]);
    pertoDe(tracosDoPique(molde(), pique(formato('caixa', 10, 8))), [[ponto(95, 0), ponto(95, 8), ponto(105, 8), ponto(105, 0)]]);
    // O mesmo retângulo guardado no outro sentido: o pique da mesma borda entra na peça do mesmo jeito.
    const noOutroSentido = [...RETANGULO].reverse();
    const naMesmaBorda: Pique = { id: 'p', posicao: ponto(100, 0), indiceAresta: 2, formato: formato('traco') };
    pertoDe(tracosDoPique(molde(noOutroSentido), naMesmaBorda), [[ponto(100, 0), ponto(100, 6)]]);
  });

  it('o U e o círculo são redondos: todos os pontos do arco a meia largura do centro', () => {
    const doU = tracosDoPique(molde(), pique(formato('u', 10, 10)))[0]!;
    perto(doU[0]!, ponto(95, 0));
    perto(doU.at(-1)!, ponto(105, 0));
    // O fundo do U está à altura toda, no meio.
    expect(doU.some((q) => Math.abs(q.x - 100) < 1e-9 && Math.abs(q.y - 10) < 1e-9)).toBe(true);
    const doCirculo = tracosDoPique(molde(), pique(formato('circulo', 10, 10)))[0]!;
    for (const q of doCirculo) expect(Math.hypot(q.x - 100, q.y - 5)).toBeCloseTo(5, 9);
    perto(doCirculo[0]!, doCirculo.at(-1)!);
  });

  it('o ângulo é contado do esquadro com a borda: positivo gira no sentido anti-horário', () => {
    // O traço de 6 mm, que entrava reto para (100, 6), girado de 90°.
    pertoDe(tracosDoPique(molde(), pique(formato('traco', 4, 6, 90))), [[ponto(100, 0), ponto(94, 0)]]);
    pertoDe(tracosDoPique(molde(), pique(formato('traco', 4, 6, -90))), [[ponto(100, 0), ponto(106, 0)]]);
    const a45 = tracosDoPique(molde(), pique(formato('traco', 4, 6, 45)))[0]![1]!;
    perto(a45, ponto(100 - 6 * Math.SQRT1_2, 6 * Math.SQRT1_2));
  });
});

describe('o pique interno: a marca com formato', () => {
  it('fica centrado no ponto, de pé na tela (a altura na vertical, que é o x do mundo)', () => {
    const cruz = tracosDaMarca({ id: 'm', posicao: ponto(100, 150), formato: formato('cruz') })!;
    pertoDe(cruz, [
      [ponto(103, 150), ponto(97, 150)],
      [ponto(100, 148), ponto(100, 152)],
    ]);
    const circulo = tracosDaMarca({ id: 'm', posicao: ponto(100, 150), formato: formato('circulo', 8, 8) })![0]!;
    for (const q of circulo) expect(Math.hypot(q.x - 100, q.y - 150)).toBeCloseTo(4, 9);
  });

  it('a marca sem formato não tem traços: é o ponto de sempre', () => {
    expect(tracosDaMarca({ id: 'm', posicao: ponto(100, 150) })).toBeNull();
  });

  it('gira com a peça que gira; na peça espelhada, o ângulo do pique do contorno troca de sinal, e o do interno aponta para o lado espelhado', () => {
    const peca: Molde = { ...molde(), marcas: [{ id: 'm', posicao: ponto(100, 150), formato: formato('v', 4, 6, 30) }], piques: [pique(formato('v', 4, 6, 20))] };

    expect(rotacionarMolde(peca, 90).marcas[0]!.formato!.anguloGraus).toBe(120);
    expect(rotacionarMolde(peca, 180).marcas[0]!.formato!.anguloGraus).toBe(-150);
    // O pique do contorno acompanha a borda sozinho: o ângulo dele não muda ao girar.
    expect(rotacionarMolde(peca, 90).piques[0]!.formato!.anguloGraus).toBe(20);
    const espelhada = espelharMolde(peca, 'm2');
    // O espelho troca o x de sinal — na tela, o de cima vai para baixo: o interno a 30° passa a 150°.
    expect(espelhada.marcas[0]!.formato!.anguloGraus).toBe(150);
    expect(espelhada.piques[0]!.formato!.anguloGraus).toBe(-20);
    // O pique do contorno de um tipo do programa, sem ângulo, fica com o mesmo formato; a marca sem formato segue sem ele.
    const semAngulo: Molde = { ...molde(), piques: [pique(formato('v'))], marcas: [{ id: 'n', posicao: ponto(50, 50) }] };
    expect(espelharMolde(semAngulo, 'm2').piques[0]!.formato).toBe(semAngulo.piques[0]!.formato);
    expect('formato' in espelharMolde(semAngulo, 'm2').marcas[0]!).toBe(false);
    expect('formato' in rotacionarMolde(semAngulo, 90).marcas[0]!).toBe(false);
  });
});

describe('o desenho do pique na peça espelhada', () => {
  // Um formato cadastrado sem simetria, um L: a haste em pé na boca, e o pé para a direita, no alto.
  const EM_L = (anguloGraus: number): FormatoDePique => ({ tipo: 'cadastrado:c1', larguraMm: 10, alturaMm: 20, anguloGraus, nome: 'L', forma: [[ponto(0, 0), ponto(0, 1), ponto(0.5, 1)]] });
  const comPiques = (): Molde => ({
    ...molde(),
    piques: [pique(EM_L(15)), { id: 'q', posicao: ponto(200, 100), indiceAresta: 1, formato: formato('v', 8, 10, -25) }],
    marcas: [
      { id: 'm', posicao: ponto(100, 150), formato: EM_L(40) },
      { id: 'n', posicao: ponto(60, 200), formato: formato('u', 8, 10, 70) },
    ],
  });

  it('cada pique é a imagem no espelho do que era — o do contorno, o interno e o cadastrado, que tem direita e esquerda', () => {
    const peca = comPiques();
    // O espelho da peça: o x em torno do meio dela (100).
    const noEspelho = (q: Ponto2D): Ponto2D => ponto(200 - q.x, q.y);
    const espelhada = espelharMolde(peca, 'm2');

    // O cadastrado, ponto a ponto na ordem do desenho; o tipo do programa, que é simétrico, pelos mesmos pontos em qualquer ordem.
    pertoDe(tracosDoPique(espelhada, espelhada.piques[0]!), tracosDoPique(peca, peca.piques[0]!).map((t) => t.map(noEspelho)));
    mesmosPontos(tracosDoPique(espelhada, espelhada.piques[1]!), tracosDoPique(peca, peca.piques[1]!).map((t) => t.map(noEspelho)));
    pertoDe(tracosDaMarca(espelhada.marcas[0]!)!, tracosDaMarca(peca.marcas[0]!)!.map((t) => t.map(noEspelho)));
    mesmosPontos(tracosDaMarca(espelhada.marcas[1]!)!, tracosDaMarca(peca.marcas[1]!)!.map((t) => t.map(noEspelho)));
    // Só o desenho cadastrado leva a marca de espelhado; o tipo do programa é simétrico.
    expect(espelhada.piques.map((q) => q.formato!.espelhado)).toEqual([true, undefined]);
    expect(espelhada.marcas.map((m) => m.formato!.espelhado)).toEqual([true, undefined]);
    // Espelhada duas vezes, a peça volta a ter os formatos que tinha.
    const deVolta = espelharMolde(espelhada, 'm3');
    expect(deVolta.piques.map((q) => q.formato)).toEqual(peca.piques.map((q) => q.formato));
    expect(deVolta.marcas.map((m) => m.formato)).toEqual(peca.marcas.map((m) => m.formato));
  });

  it('o desenho cadastrado sai com a mão em que foi desenhado, seja qual for o sentido do contorno', () => {
    // O mesmo retângulo com os pontos na ordem contrária: a borda de baixo (y = 0) passa a ser a aresta 2.
    const aoContrario = [...RETANGULO].reverse();
    const esperado = [[ponto(100, 0), ponto(100, 20), ponto(105, 20)]];

    pertoDe(tracosDoPique(molde(), pique(EM_L(0))), esperado);
    pertoDe(tracosDoPique(molde(aoContrario), { ...pique(EM_L(0)), indiceAresta: 2 }), esperado);
    // Sem ângulo, o cadastrado também é espelhado com a peça: o pé passa para o outro lado.
    const espelhada = espelharMolde({ ...molde(), piques: [pique(EM_L(0))] }, 'm2');
    pertoDe(tracosDoPique(espelhada, espelhada.piques[0]!), [[ponto(100, 0), ponto(100, 20), ponto(95, 20)]]);
    // Na linha de corte, o mesmo desenho, 10 mm para fora.
    const naCostura = { ...pique(EM_L(0)), indiceAresta: 2, naCostura: 'projetado' as const };
    pertoDe(tracosNaLinhaDeCorte(molde(aoContrario, 10), naCostura)!, [[ponto(100, -10), ponto(100, 10), ponto(105, 10)]]);
  });

  it('desdobrada a peça, a cópia de cada pique é a imagem do original no espelho da dobra', () => {
    const peca: Molde = {
      ...molde(),
      piques: [{ id: 'q', posicao: ponto(200, 100), indiceAresta: 1, formato: EM_L(15) }],
      marcas: [
        { id: 'm', posicao: ponto(100, 150), formato: EM_L(40) },
        { id: 'n', posicao: ponto(60, 200), formato: formato('v', 8, 10, 30) },
        { id: 'o', posicao: ponto(30, 30) },
      ],
    };
    let n = 0;
    // A dobra é a aresta 0 (y = 0): o espelho troca o y de sinal.
    const inteira = desdobrarMolde(peca, 0, () => 'n' + ++n);
    const noEspelho = (q: Ponto2D): Ponto2D => ponto(q.x, 0 - q.y);
    const copia = <T extends { readonly posicao: Ponto2D }>(itens: readonly T[], de: Ponto2D): T => itens.find((item) => Math.hypot(item.posicao.x - de.x, item.posicao.y + de.y) < 1e-9)!;

    pertoDe(tracosDoPique(inteira, copia(inteira.piques, ponto(200, 100))), tracosDoPique(peca, peca.piques[0]!).map((t) => t.map(noEspelho)));
    pertoDe(tracosDaMarca(copia(inteira.marcas, ponto(100, 150)))!, tracosDaMarca(peca.marcas[0]!)!.map((t) => t.map(noEspelho)));
    mesmosPontos(tracosDaMarca(copia(inteira.marcas, ponto(60, 200)))!, tracosDaMarca(peca.marcas[1]!)!.map((t) => t.map(noEspelho)));
    // O bico interno a 30° passa a −30°; a marca sem formato segue sem ele.
    expect(copia(inteira.marcas, ponto(60, 200)).formato!.anguloGraus).toBeCloseTo(-30, 9);
    expect('formato' in copia(inteira.marcas, ponto(30, 30))).toBe(false);
  });
});

describe('o pique na linha de corte', () => {
  it('projetado: no ponto da linha de corte mais perto dele; estendido: seguindo o ângulo do pique', () => {
    const comMargem = molde(RETANGULO, 10);
    // A linha de corte da aresta 0 fica 10 mm para fora: em y = −10.
    pertoDe(tracosNaLinhaDeCorte(comMargem, pique(formato('traco'), { naCostura: 'projetado' }))!, [[ponto(100, -10), ponto(100, -4)]]);
    // Sem ângulo, o estendido cai no mesmo lugar.
    pertoDe(tracosNaLinhaDeCorte(comMargem, pique(formato('traco'), { naCostura: 'estendido' }))!, [[ponto(100, -10), ponto(100, -4)]]);
    // A 45°, o eixo do pique sai inclinado e encontra a linha de corte 10 mm ao lado.
    const estendido = tracosNaLinhaDeCorte(comMargem, pique(formato('traco', 4, 6, 45), { naCostura: 'estendido' }))![0]!;
    perto(estendido[0]!, ponto(110, -10));
    const projetado = tracosNaLinhaDeCorte(comMargem, pique(formato('traco', 4, 6, 45), { naCostura: 'projetado' }))![0]!;
    perto(projetado[0]!, ponto(100, -10));
  });

  it('sem margem de costura, sem a opção ou sem formato, não há o que desenhar', () => {
    expect(tracosNaLinhaDeCorte(molde(), pique(formato('traco'), { naCostura: 'projetado' }))).toBeNull();
    expect(tracosNaLinhaDeCorte(molde(RETANGULO, 10), pique(formato('traco')))).toBeNull();
    expect(tracosNaLinhaDeCorte(molde(RETANGULO, 10), pique(undefined, { naCostura: 'projetado' }))).toBeNull();
  });
});

describe('a posição pela referência', () => {
  it('parte do ponto do contorno mais perto do clique e anda a distância para o lado do clique', () => {
    // O clique em (30, 0): o ponto mais perto é o 1, em (0, 0).
    expect(posicaoPelaReferencia(RETANGULO, { indiceAresta: 0, ponto: ponto(30, 0) }, 50)).toEqual({ indiceAresta: 0, ponto: ponto(50, 0) });
    // O clique em (170, 0): o mais perto é o 2, em (200, 0), e anda-se dele para trás.
    expect(posicaoPelaReferencia(RETANGULO, { indiceAresta: 0, ponto: ponto(170, 0) }, 50).ponto).toEqual(ponto(150, 0));
    // Mais longe que a aresta: dobra o canto.
    perto(posicaoPelaReferencia(RETANGULO, { indiceAresta: 0, ponto: ponto(170, 0) }, 250).ponto, ponto(0, 50));
    expect(posicaoPelaReferencia(RETANGULO, { indiceAresta: 0, ponto: ponto(30, 0) }, 0).ponto).toEqual(ponto(0, 0));
    // Perto de um canto o clique é preso nele: quem diz o lado é o ponto clicado de verdade.
    const presoNoCanto = { indiceAresta: 1, ponto: ponto(200, 0) };
    expect(posicaoPelaReferencia(RETANGULO, presoNoCanto, 50, ponto(180, 2)).ponto).toEqual(ponto(150, 0));
    expect(posicaoPelaReferencia(RETANGULO, presoNoCanto, 50, ponto(198, 20)).ponto).toEqual(ponto(200, 50));
    // No último ponto do contorno, de onde a aresta seguinte volta ao primeiro.
    const noUltimo = { indiceAresta: 3, ponto: ponto(0, 300) };
    expect(posicaoPelaReferencia(RETANGULO, noUltimo, 50, ponto(20, 298)).ponto).toEqual(ponto(50, 300));
    expect(posicaoPelaReferencia(RETANGULO, noUltimo, 50, ponto(2, 280)).ponto).toEqual(ponto(0, 250));
    // Com o clique bem em cima do ponto, vale o sentido da aresta clicada.
    expect(posicaoPelaReferencia(RETANGULO, presoNoCanto, 50).ponto).toEqual(ponto(200, 50));
    expect(() => posicaoPelaReferencia(RETANGULO, { indiceAresta: 0, ponto: ponto(30, 0) }, -1)).toThrow('A distância do ponto de referência precisa ser zero ou mais.');
  });
});

describe('inserir piques', () => {
  it('põe o pique com o formato na borda, e leva junto o código e o jeito de ir para a costura', () => {
    const peca = inserirPique(molde(), NA_BORDA, formato('v'), 'p1', { codigo: '7', naCostura: 'estendido' });

    expect(peca.piques).toEqual([{ id: 'p1', posicao: ponto(100, 0), indiceAresta: 0, formato: formato('v'), codigo: '7', naCostura: 'estendido' }]);
    expect(peca.contorno).toEqual(RETANGULO);
    // Sem os extras, o pique só tem o formato.
    expect(Object.keys(inserirPique(molde(), NA_BORDA, formato('v'), 'p1').piques[0]!).sort()).toEqual(['formato', 'id', 'indiceAresta', 'posicao']);
    expect(() => inserirPique(molde(), NA_BORDA, formato('v', 0), 'p1')).toThrow(/largura/);
  });

  it('com “Adicionar ponto de controle”, o contorno ganha um ponto ali, e o pique fica na aresta que começa nele', () => {
    const peca = inserirPique(molde(), NA_BORDA, formato('traco'), 'p1', { pontoDeControle: true });

    expect(peca.contorno).toEqual([ponto(0, 0), ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)]);
    expect(peca.piques[0]).toMatchObject({ posicao: ponto(100, 0), indiceAresta: 1 });
    // Onde já há um ponto, não entra outro.
    const noCanto = inserirPique(molde(), { indiceAresta: 1, ponto: ponto(200, 0) }, formato('traco'), 'p1', { pontoDeControle: true });
    expect(noCanto.contorno).toEqual(RETANGULO);
    expect(noCanto.piques[0]!.indiceAresta).toBe(1);
  });

  it('com “Manter distância nos tamanhos”, na peça graduada o pique fica com zero em todos os tamanhos; na que não é, a opção não faz nada', () => {
    const graduada = definirTamanhosDoMolde(molde(), ['P', 'M', 'G'], 'M');
    const comPique = inserirPique(graduada, { indiceAresta: 0, ponto: ponto(30, 0) }, formato('traco'), 'p1', { manterDistancia: true });

    expect(comPique.piques[0]!.graduacao).toEqual({ referencia: ponto(0, 0), perimetros: [0, 0, 0] });
    expect(inserirPique(graduada, NA_BORDA, formato('traco'), 'p1').piques[0]!.graduacao).toBeUndefined();
    expect(inserirPique(molde(), NA_BORDA, formato('traco'), 'p1', { manterDistancia: true }).piques[0]!.graduacao).toBeUndefined();
  });

  it('o pique interno é uma marca com formato, e precisa ficar dentro da peça', () => {
    const peca = inserirPiqueInterno(molde(), ponto(100, 150), formato('cruz'), 'm1');

    expect(peca.marcas).toEqual([{ id: 'm1', posicao: ponto(100, 150), formato: formato('cruz') }]);
    expect(peca.piques).toEqual([]);
    expect(() => inserirPiqueInterno(molde(), ponto(300, 150), formato('cruz'), 'm1')).toThrow('O pique interno precisa ficar dentro da peça.');
    expect(() => inserirPiqueInterno(molde(), ponto(100, 150), formato('nada'), 'm1')).toThrow(/tipo de pique/);
  });
});

describe('códigos, busca e remoção', () => {
  it('o código seguinte é um a mais que o maior código numérico dos piques do projeto', () => {
    const comCodigos = (...codigos: string[]): Molde => ({ ...molde(), piques: codigos.map((codigo, i) => ({ ...pique(), id: `p${i}`, codigo })) });

    expect(proximoCodigo([molde()])).toBe('1');
    expect(proximoCodigo([comCodigos('3', 'A'), comCodigos('7', '2,5')])).toBe('8');
    expect(proximoCodigo([{ ...molde(), piques: [pique()] }])).toBe('1');
  });

  it('acha a marca mais perto do ponto, dentro do raio', () => {
    const peca: Molde = { ...molde(), marcas: [{ id: 'a', posicao: ponto(100, 150) }, { id: 'b', posicao: ponto(104, 150) }] };

    expect(marcaPerto(peca, ponto(103, 150), 5)!.id).toBe('b');
    expect(marcaPerto(peca, ponto(101, 150), 5)!.id).toBe('a');
    expect(marcaPerto(peca, ponto(120, 150), 5)).toBeNull();
  });

  it('tira os piques do contorno, os internos, ou uns e outros', () => {
    const peca: Molde = { ...molde(), piques: [pique()], marcas: [{ id: 'a', posicao: ponto(100, 150) }] };

    expect(semOsPiques(peca, { doContorno: true, internos: false })).toMatchObject({ piques: [], marcas: peca.marcas });
    expect(semOsPiques(peca, { doContorno: false, internos: true })).toMatchObject({ piques: peca.piques, marcas: [] });
    expect(semOsPiques(peca, { doContorno: true, internos: true })).toMatchObject({ piques: [], marcas: [] });
    expect(semOsPiques(peca, { doContorno: false, internos: false })).toEqual(peca);
  });
});

describe('a forma de um pique cadastrado, tirada do desenho', () => {
  it('o desenho de pé na tela vira os traços no quadro de 1 × 1, com o ponto de referência na origem', () => {
    // Um V desenhado com a ponta para cima na tela: para cima é o −x do mundo; para a direita, o y.
    // A boca vai de (100, 40) a (100, 60), e a ponta está em (70, 50). A referência é o meio da boca.
    const forma = formaDosElementos([[ponto(100, 40), ponto(70, 50), ponto(100, 60)]], ponto(100, 50));

    expect(forma).toEqual([[ponto(-0.5, 0), ponto(0, 1), ponto(0.5, 0)]]);
    // Usada como formato, desenha o mesmo V que o do programa.
    const comAForma: FormatoDePique = { tipo: 'cadastrado:x', larguraMm: 4, alturaMm: 6, anguloGraus: 0, forma, nome: 'Meu V' };
    pertoDe(tracosDoPique(molde(), pique(comAForma)), tracosDoPique(molde(), pique(formato('v'))));
  });

  it('a referência não precisa estar no meio, e várias linhas viram vários traços', () => {
    // Um "L": a haste de 20 de altura e o pé de 10 para a direita; a referência é o pé da haste.
    const forma = formaDosElementos([[ponto(100, 50), ponto(80, 50)], [ponto(80, 50), ponto(80, 60)]], ponto(100, 50));
    expect(forma).toEqual([[ponto(0, 0), ponto(0, 1)], [ponto(0, 1), ponto(1, 1)]]);
  });

  it('o traço sem largura ou sem altura fica como está nessa direção; sem tamanho nenhum, ou sem linhas, é recusado', () => {
    expect(formaDosElementos([[ponto(100, 50), ponto(70, 50)]], ponto(100, 50))).toEqual([[ponto(0, 0), ponto(0, 1)]]);
    expect(formaDosElementos([[ponto(100, 40), ponto(100, 60)]], ponto(100, 50))).toEqual([[ponto(-0.5, 0), ponto(0.5, 0)]]);
    expect(() => formaDosElementos([[ponto(100, 50), ponto(100, 50)]], ponto(100, 50))).toThrow('O desenho do pique precisa ter algum tamanho.');
    expect(() => formaDosElementos([], ponto(100, 50))).toThrow('Indique as linhas que formam o pique.');
    expect(() => formaDosElementos([[ponto(100, 50)]], ponto(100, 50))).toThrow('Indique as linhas que formam o pique.');
  });
});

describe('o texto com ângulo e âncora (o “Pique texto”)', () => {
  it('o texto posto com a pose guarda o ângulo e, se não é o meio, a âncora', () => {
    const comTexto = adicionarTexto(molde(), ponto(100, 150), ' Bolso ', 12, 't1', { anguloGraus: 30, ancora: 'inicio' });
    expect(comTexto.textos).toEqual([{ id: 't1', posicao: ponto(100, 150), texto: 'Bolso', alturaMm: 12, anguloGraus: 30, ancora: 'inicio' }]);
    expect(adicionarTexto(molde(), ponto(100, 150), 'Bolso', 12, 't1', { anguloGraus: 0, ancora: 'centro' }).textos![0]).toEqual({ id: 't1', posicao: ponto(100, 150), texto: 'Bolso', alturaMm: 12, anguloGraus: 0 });
    // Sem pose, é o texto de sempre: sem ângulo nem âncora.
    expect(Object.keys(adicionarTexto(molde(), ponto(100, 150), 'Bolso', 12, 't1').textos![0]!).sort()).toEqual(['alturaMm', 'id', 'posicao', 'texto']);
    expect(() => adicionarTexto(molde(), ponto(100, 150), 'Bolso', 12, 't1', { anguloGraus: 400, ancora: 'centro' })).toThrow('O ângulo do texto precisa ficar entre −360° e 360°.');
  });

  it('alterar com a pose troca o ângulo e a âncora; sem ela, ficam como estavam', () => {
    const comTexto = adicionarTexto(molde(), ponto(100, 150), 'Bolso', 12, 't1', { anguloGraus: 30, ancora: 'fim' });

    expect(alterarTexto(comTexto, 't1', 'Estampa', 8).textos![0]).toEqual({ id: 't1', posicao: ponto(100, 150), texto: 'Estampa', alturaMm: 8, anguloGraus: 30, ancora: 'fim' });
    expect(alterarTexto(comTexto, 't1', 'Estampa', 8, { anguloGraus: 90, ancora: 'centro' }).textos![0]).toEqual({ id: 't1', posicao: ponto(100, 150), texto: 'Estampa', alturaMm: 8, anguloGraus: 90 });
    expect(alterarTexto(comTexto, 't1', '  ', 8, { anguloGraus: 90, ancora: 'centro' }).textos).toEqual([]);
  });

  it('o texto com ângulo gira com a peça, e o ângulo troca de sinal na peça espelhada; o texto sem ângulo continua na horizontal', () => {
    const comAngulo = adicionarTexto(molde(), ponto(100, 150), 'Bolso', 12, 't1', { anguloGraus: 30, ancora: 'centro' });
    const semAngulo = adicionarTexto(molde(), ponto(100, 150), 'Bolso', 12, 't1');

    expect(rotacionarMolde(comAngulo, 90).textos![0]!.anguloGraus).toBe(120);
    expect(espelharMolde(comAngulo, 'm2').textos![0]!.anguloGraus).toBe(-30);
    expect('anguloGraus' in rotacionarMolde(semAngulo, 90).textos![0]!).toBe(false);
    expect('anguloGraus' in espelharMolde(semAngulo, 'm2').textos![0]!).toBe(false);
    // A posição vai com a peça nos dois casos.
    expect(rotacionarMolde(comAngulo, 180).textos![0]!.posicao.x).toBeCloseTo(100, 9);
  });
});
