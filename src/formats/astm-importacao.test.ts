import { describe, expect, it } from 'vitest';
import { distancia, ponto, retanguloEnvolvente } from '../core/geometria';
import { contornosDosTamanhos } from '../domain/graduacao';
import { criarMolde, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import { ehArquivoAstm, lerAstm, moldesDoAstm } from './astm-importacao';
import { gerarDxfAstm, gerarDxfAstmComRegras } from './dxf-astm';
import { gerarRul, lerRul } from './rul';

let n = 0;
const novoId = (): string => `i${n++}`;

const peca = (nome: string): Molde =>
  criarMolde({ nome, referencia: '', tamanho: 'M', quantidade: 2, contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 500), ponto(0, 500)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 450) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, nome);

const graduada = (nome: string): Molde => {
  const g = definirTamanhosDoMolde(peca(nome), ['P', 'M', 'G'], 'M');
  return {
    ...g,
    graduacao: {
      ...g.graduacao!,
      pontos: [
        { posicao: ponto(300, 500), deslocamentos: [ponto(-10, -20), ponto(0, 0), ponto(10, 20)] },
        { posicao: ponto(300, 0), deslocamentos: [ponto(-10, 0), ponto(0, 0), ponto(10, 0)] },
        { posicao: ponto(0, 500), deslocamentos: [ponto(0, -20), ponto(0, 0), ponto(0, 20)] },
        { posicao: ponto(0, 0), deslocamentos: [ponto(0, 0), ponto(0, 0), ponto(0, 0)] },
      ],
    },
  };
};

/** Um arquivo de outro sistema, escrito à mão: contorno em dois pedaços, polilinhas, regra num ponto. */
const linhas = (...v: Array<string | number>): string => v.filter((x) => x !== '').join('\n');
const polilinha = (camada: number, pontos: ReadonlyArray<readonly [number, number]>): string =>
  linhas(0, 'POLYLINE', 8, camada, 66, 1, ...pontos.flatMap(([x, y]) => [0, 'VERTEX', 8, camada, 10, x, 20, y]), 0, 'SEQEND', 8, camada);
const texto = (camada: number, x: number, y: number, t: string): string => linhas(0, 'TEXT', 8, camada, 10, x, 20, y, 40, 0.25, 1, t);
const bloco = (nome: string, peca: string, tamanho: string, l: number, c: number, extra = ''): string =>
  linhas(
    0, 'BLOCK', 8, 0, 2, nome, 70, 64, 10, 0, 20, 0,
    texto(1, 10, 10, `Piece Name: ${peca}`),
    texto(1, 10, 20, `SIZE: ${tamanho}`),
    texto(1, 10, 30, 'Quantity: 2'),
    polilinha(1, [[0, 0], [c, 0], [c, l]]),
    polilinha(1, [[c, l], [0, l], [0, 0]]),
    linhas(0, 'LINE', 8, 7, 10, 10, 20, l / 2, 11, c - 10, 21, l / 2),
    extra,
    linhas(0, 'ENDBLK', 8, 0),
  );
const arquivo = (blocos: string, estilo: string): string => linhas(0, 'SECTION', 2, 'BLOCKS', blocos, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES', estilo, 0, 'ENDSEC', 0, 'EOF');

describe('o ASTM de outros sistemas (ADR 0207)', () => {
  it('reconhece o arquivo', () => {
    expect(ehArquivoAstm(arquivo(bloco('a', 'Frente', '36', 100, 200), ''))).toBe(true);
    expect(ehArquivoAstm('0\nSECTION\n2\nENTITIES\n0\nLINE')).toBe(false);
  });

  it('um bloco por tamanho vira uma peça graduada, com a diferença como regra', () => {
    const dxf = arquivo(bloco('a', 'Frente', '34', 90, 190) + '\n' + bloco('b', 'Frente', '36', 100, 200) + '\n' + bloco('c', 'Frente', '38', 110, 210), texto(1, 0, 0, 'Sample Size: 36') + '\n' + texto(1, 0, 0, 'Units: METRIC') + '\n' + texto(1, 0, 0, 'Style Name: Camisa'));
    const leitura = lerAstm(dxf);
    expect(leitura.tamanhoBase).toBe('36');
    expect(leitura.estilo).toBe('Camisa');
    const { moldes, avisos } = moldesDoAstm(leitura, novoId);
    expect(avisos).toEqual([]);
    expect(moldes).toHaveLength(1);
    const m = moldes[0]!;
    expect(m.tamanho).toBe('36');
    expect(m.quantidade).toBe(2);
    expect(m.graduacao?.tamanhos).toEqual(['34', '36', '38']);
    expect(m.graduacao?.base).toBe(1);
    const [p, b, g] = contornosDosTamanhos(m.graduacao!, m.contorno).map((c) => retanguloEnvolvente(c));
    expect(b!.maxY - b!.minY).toBeCloseTo(200, 6);
    expect(p!.maxY - p!.minY).toBeCloseTo(190, 6);
    expect(g!.maxX - g!.minX).toBeCloseTo(110, 6);
  });

  it('o contorno em pedaços é emendado, e polegadas viram milímetros', () => {
    const r = moldesDoAstm(lerAstm(arquivo(bloco('a', 'Frente', '36', 10, 20), texto(1, 0, 0, 'Units: ENGLISH'))), novoId);
    const c = retanguloEnvolvente(r.moldes[0]!.contorno);
    expect(r.moldes[0]!.contorno).toHaveLength(4);
    expect(c.maxY - c.minY).toBeCloseTo(508, 6);
    expect(c.maxX - c.minX).toBeCloseTo(254, 6);
  });

  it('o tamanho com outros pontos fica de fora, com aviso', () => {
    const torto = bloco('b', 'Frente', '38', 100, 200).replace('POLYLINE', 'POLYLINE');
    const outro = linhas(0, 'BLOCK', 8, 0, 2, 'c', 70, 64, 10, 0, 20, 0, texto(1, 1, 1, 'Piece Name: Frente'), texto(1, 1, 1, 'SIZE: 40'), polilinha(1, [[0, 0], [50, 0], [100, 0], [100, 100], [0, 100], [0, 0]]), 0, 'ENDBLK', 8, 0);
    const r = moldesDoAstm(lerAstm(arquivo(bloco('a', 'Frente', '36', 100, 200) + '\n' + torto + '\n' + outro, texto(1, 0, 0, 'Sample Size: 36'))), novoId);
    expect(r.moldes[0]!.graduacao?.tamanhos).toEqual(['36', '38']);
    expect(r.avisos.join()).toMatch(/tamanho 40/);
  });

  it('as camadas viram o que são: furo, linha, marca, pique, espelho e fio', () => {
    const extra = polilinha(11, [[50, 20], [80, 20], [80, 50], [50, 20]]) + '\n' + polilinha(8, [[10, 10], [60, 10]]) + '\n' + linhas(0, 'POINT', 8, 13, 10, 30, 20, 30) + '\n' + linhas(0, 'POINT', 8, 4, 10, 100, 20, 0) + '\n' + linhas(0, 'LINE', 8, 6, 10, 200, 20, 0, 11, 200, 21, 100);
    const m = moldesDoAstm(lerAstm(arquivo(bloco('a', 'Frente', '36', 100, 200, extra), '')), novoId).moldes[0]!;
    expect(m.furos).toHaveLength(1);
    expect(m.linhasInternas).toHaveLength(1);
    expect(m.marcas).toHaveLength(1);
    expect(m.piques).toHaveLength(1);
    expect(m.linhaDeSimetria).toBeDefined();
    expect(distancia(m.linhaDeFio.inicio, m.linhaDeFio.fim)).toBeCloseTo(180, 6);
  });

  it('a peça sem contorno vira aviso, e o arquivo sem peças diz por quê', () => {
    expect(lerAstm(arquivo(linhas(0, 'BLOCK', 8, 0, 2, 'a', 70, 64, 10, 0, 20, 0, texto(1, 1, 1, 'Piece Name: X'), 0, 'ENDBLK', 8, 0), '')).avisos.join()).toMatch(/camada 1/);
    expect(lerAstm(arquivo('', '')).avisos.join()).toMatch(/Nenhuma peça/);
  });
});

describe('o que este programa exporta volta igual (ADR 0207)', () => {
  it('as peças graduadas saem e voltam com os mesmos tamanhos e medidas', () => {
    const dxf = gerarDxfAstm([graduada('Frente'), graduada('Costas')], 'Camisa', novoId);
    const { moldes, avisos } = moldesDoAstm(lerAstm(dxf), novoId);
    expect(avisos).toEqual([]);
    expect(moldes.map((m) => m.nome).sort()).toEqual(['Costas', 'Frente']);
    const m = moldes.find((x) => x.nome === 'Frente')!;
    expect(m.graduacao?.tamanhos).toEqual(['P', 'M', 'G']);
    const c = contornosDosTamanhos(m.graduacao!, m.contorno).map((k) => retanguloEnvolvente(k));
    expect(c[2]!.maxX - c[2]!.minX).toBeCloseTo(310, 1);
    expect(c[2]!.maxY - c[2]!.minY).toBeCloseTo(520, 1);
    expect(c[0]!.maxX - c[0]!.minX).toBeCloseTo(290, 1);
  });
});

describe('o arquivo de regras .RUL (ADR 0207)', () => {
  const rul = ['ASTM/D13Proposal 1 Version: D 6673-04', 'AUTHOR: X', 'UNITS: METRIC', 'GRADE RULE TABLE: B9000', 'NUMBER OF SIZES: 5', 'SIZE LIST:  34 36 38 40 42', 'SAMPLE SIZE:  38', 'RULE: DELTA 1', '-4.00, 0.00  -2.00, 0.00  0.00, 0.00  2.00, 0.00', '4.00, 1.50', 'RULE: DELTA 2', '0,0 0,0 0,0 0,0', '0,0'].join('\r\n');

  it('lê o cabeçalho e as regras, em mais de uma linha', () => {
    const t = lerRul(rul);
    expect(t.nome).toBe('B9000');
    expect(t.tamanhos).toEqual(['34', '36', '38', '40', '42']);
    expect(t.tamanhoBase).toBe('38');
    expect(t.regras.get('1')).toHaveLength(5);
    expect(t.regras.get('1')![4]).toEqual({ x: 4, y: 1.5 });
  });

  it('recusa o arquivo sem tamanhos e a regra com valores a menos', () => {
    expect(() => lerRul('RULE: DELTA 1\n0,0')).toThrow(/SIZE LIST/);
    expect(() => lerRul('SIZE LIST: 1 2\nRULE: DELTA 1\n0,0')).toThrow(/regra 1/);
  });

  it('a base com "# n" e o .RUL viram a peça graduada', () => {
    const extra = texto(2, 200, 100, '# 1') + '\n' + texto(2, 0, 0, '# 2');
    const leitura = lerAstm(arquivo(bloco('a', 'Frente', '38', 100, 200, extra), texto(1, 0, 0, 'Sample Size: 38')));
    expect(moldesDoAstm(leitura, novoId).pedeRegras).toBe(true);
    const { moldes } = moldesDoAstm(leitura, novoId, lerRul(rul));
    const m = moldes[0]!;
    expect(m.graduacao?.tamanhos).toEqual(['34', '36', '38', '40', '42']);
    expect(m.graduacao?.base).toBe(2);
    expect(m.graduacao?.pontos).toHaveLength(2);
    const p = m.graduacao!.pontos.find((q) => q.deslocamentos[4]!.y !== 0)!;
    expect(p.deslocamentos[4]!.y).toBeCloseTo(4, 6);
    expect(p.deslocamentos[4]!.x).toBeCloseTo(-1.5, 6);
  });

  it('a regra que falta na tabela vira aviso', () => {
    const leitura = lerAstm(arquivo(bloco('a', 'Frente', '38', 100, 200, texto(2, 0, 0, '# 77')), ''));
    expect(moldesDoAstm(leitura, novoId, lerRul(rul)).avisos.join()).toMatch(/77/);
  });

  it('o que este programa escreve, ele lê: cantos com regra, na base', () => {
    const r = gerarRul([graduada('Frente')], 'Camisa', new Date(2026, 9, 31, 13, 59));
    expect(r.rul).toContain('CREATION DATE: 31-10-2026');
    expect(r.rul).toContain('SAMPLE SIZE: M');
    const t = lerRul(r.rul);
    expect(t.tamanhos).toEqual(['P', 'M', 'G']);
    expect(t.regras.size).toBe(4);
    const ponto3 = r.idDoPonto.get('Frente')!.get(2)!;
    expect(t.regras.get(ponto3)![2]).toEqual({ x: 20, y: -10 });
  });

  it('a peça com outra grade fica de fora, e sem graduação não há tabela', () => {
    const outra = definirTamanhosDoMolde(peca('Costas'), ['M', 'G'], 'M');
    expect(gerarRul([graduada('Frente'), outra], 'x', new Date()).deFora).toEqual(['Costas']);
    expect(() => gerarRul([peca('a')], 'x', new Date())).toThrow(/Nenhuma peça graduada/);
  });
});

describe('o par base e regras, escrito aqui (ADR 0207)', () => {
  it('a base com "# n" e o .RUL voltam como a peça graduada', () => {
    const peca = graduada('Frente');
    const r = gerarRul([peca], 'Camisa', new Date(2026, 9, 31));
    const dxf = gerarDxfAstmComRegras([peca], 'Camisa', r.idDoPonto);
    const leitura = lerAstm(dxf);
    expect(leitura.pecas).toHaveLength(1);
    expect(leitura.pecas[0]!.regras).toHaveLength(4);
    const m = moldesDoAstm(leitura, novoId, lerRul(r.rul)).moldes[0]!;
    expect(m.graduacao?.tamanhos).toEqual(['P', 'M', 'G']);
    const c = contornosDosTamanhos(m.graduacao!, m.contorno).map((k) => retanguloEnvolvente(k));
    expect(c[2]!.maxX - c[2]!.minX).toBeCloseTo(310, 1);
    expect(c[2]!.maxY - c[2]!.minY).toBeCloseTo(520, 1);
    expect(c[0]!.maxX - c[0]!.minX).toBeCloseTo(290, 1);
  });
});
