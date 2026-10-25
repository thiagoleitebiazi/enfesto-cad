import { describe, expect, it } from 'vitest';
import { area, ponto, pontoDentroDoContorno, type Contorno, type Ponto2D } from '../core/geometria';
import { contornoDeCorte, criarMolde, type Molde } from '../domain/molde';
import { definirLinhaDeSimetria } from '../domain/anotacoes';
import { CAMADAS_DO_DXF, codificarDxf, corteDoPique, gerarDxf, mundoParaDxf, PIQUE_PARA_DENTRO_MM, PIQUE_PARA_FORA_MM } from './dxf-exportacao';
import { dxfParaMundo, importarDxf } from './dxf-importacao';
import { moldesDoDxf } from './importacaoDireta';

/** Uma frente de 200 × 300 mm, com furo, linha interna aberta, o fio deitado na tela e um pique na aresta x = 10. */
function frente(extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome: 'Frente',
      referencia: 'REF-1',
      tamanho: 'M',
      contorno: [ponto(10, 20), ponto(210, 20), ponto(210, 320), ponto(10, 320)],
      furos: [[ponto(100, 100), ponto(120, 100), ponto(120, 120), ponto(100, 120)]],
      linhasInternas: [[ponto(50, 60), ponto(80, 150), ponto(60, 250)]],
      linhaDeFio: { inicio: ponto(110, 40), fim: ponto(110, 300) },
      piques: [{ id: 'p1', posicao: ponto(10, 170), indiceAresta: 3 }],
      ...extras,
    },
    'f',
  );
}

let proximo = 0;
const novoId = (): string => `id-${++proximo}`;

/** O arquivo de volta pela importação do programa, já no mundo (como a tela mostra). */
function deVolta(texto: string): Molde[] {
  return moldesDoDxf(importarDxf(texto, 'exportado'), novoId).moldes;
}

/** Cada ponto de `esperados`, deslocado de `d`, tem um igual em `obtidos` (a ordem do contorno pode mudar). */
function mesmosPontos(obtidos: readonly Ponto2D[], esperados: readonly Ponto2D[], d: Ponto2D): void {
  expect(obtidos).toHaveLength(esperados.length);
  for (const e of esperados) {
    expect(obtidos.some((o) => Math.abs(o.x - (e.x + d.x)) < 1e-6 && Math.abs(o.y - (e.y + d.y)) < 1e-6), `${e.x},${e.y}`).toBe(true);
  }
}

describe('gerarDxf — o arquivo', () => {
  it('é um DXF R12 em milímetros, com as camadas declaradas, e termina em EOF', () => {
    const texto = gerarDxf([frente()]);
    expect(texto.startsWith('0\r\nSECTION\r\n2\r\nHEADER\r\n')).toBe(true);
    expect(texto).toContain('9\r\n$ACADVER\r\n1\r\nAC1009\r\n');
    expect(texto).toContain('9\r\n$INSUNITS\r\n70\r\n4\r\n');
    for (const camada of Object.values(CAMADAS_DO_DXF)) expect(texto).toContain(`0\r\nLAYER\r\n2\r\n${camada.nome}\r\n`);
    expect(texto.endsWith('0\r\nEOF\r\n')).toBe(true);
    // Ponto decimal (é o formato do arquivo, não a tela), e nenhum número escrito em notação científica.
    expect(texto).not.toMatch(/\d,\d/);
    expect(texto).not.toMatch(/\de[+-]?\d/i);

    const lido = importarDxf(texto, 'exportado');
    expect(lido.unidadeDetectada).toBe('milímetros');
    expect(lido.unidadeAssumida).toBe(false);
  });

  it('o x do arquivo é a horizontal da tela e o y sobe a partir da largura da mesa — o inverso da importação', () => {
    expect(mundoParaDxf(ponto(10, 20), 1500)).toEqual(ponto(20, 1490));
    const p = ponto(37.5, 812.25);
    const ida = mundoParaDxf(p, 1500);
    expect(dxfParaMundo(ida, 1500).x).toBeCloseTo(p.x, 9);
    expect(dxfParaMundo(ida, 1500).y).toBeCloseTo(p.y, 9);
    // Com a mesa, o primeiro ponto do contorno sai contado da borda dela.
    expect(gerarDxf([frente()], { larguraDaMesaMm: 1500 })).toContain('0\r\nVERTEX\r\n8\r\nCONTORNO\r\n10\r\n20\r\n20\r\n1490\r\n');
  });

  it('o nome da peça e os textos saem em Windows-1252: os acentos do português ficam certos no arquivo', () => {
    const peca = { ...frente({ nome: 'Calça', referencia: '' }), textos: [{ id: 't', posicao: ponto(150, 200), texto: 'Bolso', alturaMm: 8, anguloGraus: 90, ancora: 'inicio' as const }] };
    const texto = gerarDxf([peca]);
    expect(texto).toContain('1\r\nCalça (—) M\r\n');
    expect(texto).toMatch(/0\r\nTEXT\r\n8\r\nTEXTO\r\n(?:.*\r\n)*?40\r\n8\r\n1\r\nBolso\r\n50\r\n90\r\n72\r\n0\r\n/);
    const bytes = codificarDxf('Calça (—) M “ok” ✓');
    expect([...bytes]).toEqual([0x43, 0x61, 0x6c, 0xe7, 0x61, 0x20, 0x28, 0x97, 0x29, 0x20, 0x4d, 0x20, 0x93, 0x6f, 0x6b, 0x94, 0x20, 0x3f]);
  });
});

describe('gerarDxf — volta pela importação com a mesma forma', () => {
  it('contorno, furo, linha interna aberta, fio (com o sentido) e pique', () => {
    const original = frente();
    const [lida, ...outras] = deVolta(gerarDxf([original]));
    expect(outras).toEqual([]);
    // A importação conta o y do arquivo a partir do desenho, e a peça chega 10 mm mais perto da borda (x = 10 → 0).
    const d = ponto(-10, 0);
    mesmosPontos(lida!.contorno, original.contorno, d);
    expect(lida!.furos).toHaveLength(1);
    mesmosPontos(lida!.furos[0]!, original.furos[0]!, d);
    expect(lida!.linhasInternas).toHaveLength(1);
    expect(lida!.linhasInternas[0]!.map((p) => [p.x, p.y])).toEqual(original.linhasInternas[0]!.map((p) => [p.x + d.x, p.y + d.y]));
    expect(lida!.linhaDeFio.inicio.x).toBeCloseTo(100, 6);
    expect(lida!.linhaDeFio.inicio.y).toBeCloseTo(40, 6);
    expect(lida!.linhaDeFio.fim.y).toBeCloseTo(300, 6);
    expect(lida!.piques).toHaveLength(1);
    expect(lida!.piques[0]!.posicao.x).toBeCloseTo(0, 6);
    expect(lida!.piques[0]!.posicao.y).toBeCloseTo(170, 6);
  });

  it('com margem de costura: a linha de corte é o contorno do arquivo, e a costura vem como linha interna', () => {
    const original = frente({ margemDeCosturaMm: 10 });
    const texto = gerarDxf([original]);
    expect(texto).toContain('0\r\nPOLYLINE\r\n8\r\nCOSTURA\r\n');
    const [lida] = deVolta(texto);
    expect(area(lida!.contorno)).toBeCloseTo(area(contornoDeCorte(original)), 3);
    expect(lida!.linhasInternas.some((linha) => Math.abs(area(linha) - area(original.contorno)) < 1e-3)).toBe(true);
    // O pique continua na linha de corte (10 mm para fora da aresta x = 10 → x = 0, e a peça chega encostada: x = 0).
    expect(lida!.piques).toHaveLength(1);
    expect(lida!.piques[0]!.posicao.x).toBeCloseTo(0, 6);
    expect(lida!.piques[0]!.posicao.y).toBeCloseTo(170, 6);
  });

  it('a linha interna que começa na borda continua na peça, e não vira pique', () => {
    const original = frente({ linhasInternas: [[ponto(10, 100), ponto(25, 100)]] });
    const [lida] = deVolta(gerarDxf([original]));
    expect(lida!.linhasInternas).toHaveLength(1);
    expect(lida!.piques).toHaveLength(1);
  });

  it('a linha de simetria, as marcas e os textos saem no arquivo, e não viram peça, linha interna nem pique ao voltar', () => {
    const comTudo = {
      ...definirLinhaDeSimetria(frente(), 1),
      marcas: [{ id: 'm', posicao: ponto(150, 150) }],
      textos: [{ id: 't', posicao: ponto(150, 200), texto: 'Bolso', alturaMm: 8 }],
    };
    const texto = gerarDxf([comTudo]);
    expect(texto).toContain('0\r\nLINE\r\n8\r\nSIMETRIA\r\n');
    expect(texto).toContain('0\r\nPOINT\r\n8\r\nMARCAS\r\n');
    const lidas = deVolta(texto);
    expect(lidas).toHaveLength(1);
    expect(lidas[0]!.linhasInternas).toHaveLength(1);
    expect(lidas[0]!.piques).toHaveLength(1);
  });

  it('várias peças: cada uma volta como peça, com as posições de uma em relação à outra', () => {
    const a = frente();
    const b = criarMolde(
      { nome: 'Costas', referencia: '', tamanho: 'M', contorno: [ponto(10, 400), ponto(210, 400), ponto(210, 600), ponto(10, 600)], linhaDeFio: { inicio: ponto(110, 420), fim: ponto(110, 580) } },
      'c',
    );
    const lidas = deVolta(gerarDxf([a, b], { larguraDaMesaMm: 1500 }));
    expect(lidas).toHaveLength(2);
    const minimoY = (c: Contorno): number => Math.min(...c.map((p) => p.y));
    expect(lidas.map((m) => minimoY(m.contorno)).sort((x, y) => x - y)).toEqual([20, 400]);
  });
});

describe('corteDoPique — o pique atravessa a linha de corte', () => {
  it('um pouco para fora e o traço de sempre para dentro, qualquer que seja o sentido do contorno', () => {
    for (const contorno of [frente().contorno, [...frente().contorno].reverse()]) {
      const indice = contorno.findIndex((p, i) => p.x === 10 && contorno[(i + 1) % contorno.length]!.x === 10);
      const peca = frente({ contorno, piques: [{ id: 'p', posicao: ponto(10, 170), indiceAresta: indice }] });
      const [fora, dentro] = corteDoPique(peca, peca.contorno, peca.piques[0]!);
      expect(pontoDentroDoContorno(fora, peca.contorno)).toBe(false);
      expect(pontoDentroDoContorno(dentro, peca.contorno)).toBe(true);
      expect(fora.x).toBeCloseTo(10 - PIQUE_PARA_FORA_MM, 9);
      expect(dentro.x).toBeCloseTo(10 + PIQUE_PARA_DENTRO_MM, 9);
    }
  });
});

describe('gerarDxf — os grupos do encaixe (ADR 0115)', () => {
  it('a divisa entre os trechos na camada GRUPOS, atravessando a mesa, e o nome de cada trecho', () => {
    const entretela = { ...frente(), id: 'e', grupoDoEncaixe: 'Entretela' };
    const caixa = entretela.contorno.reduce((m, p) => Math.max(m, p.y), 0);
    const outra = { ...frente(), id: 'o', contorno: frente().contorno.map((p) => ponto(p.x, p.y + caixa + 100)) };
    const dxf = gerarDxf([entretela, outra], { larguraDaMesaMm: 1500 });
    const linhas = dxf.split('\r\n');
    const camadasDosObjetos = linhas.filter((_, i) => linhas[i - 1] === '8');
    expect(camadasDosObjetos.filter((c) => c === 'GRUPOS')).toHaveLength(3);
    expect(dxf).toContain('\r\nEntretela\r\n');
    expect(dxf).toContain('\r\nSem grupo\r\n');
    expect(CAMADAS_DO_DXF.grupos.nome).toBe('GRUPOS');
  });
});
