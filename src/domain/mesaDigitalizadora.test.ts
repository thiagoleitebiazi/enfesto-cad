import { describe, expect, it } from 'vitest';
import { area } from '../core/geometria';
import { criarMolde } from './molde';
import { lerRegistro, lerRegistros, MESA_VAZIA, pecaDosPontos, pontoDaMesa, tocar, type EstadoDaMesa, type RegistroDaMesa } from './mesaDigitalizadora';

const CONFIG = { linhasPorPolegada: 254, botaoNoComeco: false }; // 10 linhas por mm: as contas ficam redondas

/** Toca a sequência e devolve o estado e as peças fechadas. */
function tocarTudo(registros: readonly RegistroDaMesa[]) {
  let estado: EstadoDaMesa = MESA_VAZIA;
  const pecas = [];
  const recados: string[] = [];
  for (const r of registros) {
    const t = tocar(estado, r, CONFIG);
    estado = t.estado;
    recados.push(t.recado);
    if (t.peca) pecas.push(t.peca);
  }
  return { estado, pecas, recados };
}

describe('a mesa digitalizadora (ADR 0144)', () => {
  it('lê a linha da mesa: os números separados por vírgula, espaço ou ponto e vírgula; o botão em decimal ou hexa', () => {
    expect(lerRegistro('01000,02000,1')).toEqual({ x: 1000, y: 2000, botao: 1 });
    expect(lerRegistro('  -50 75 C ')).toEqual({ x: -50, y: 75, botao: 12 });
    expect(lerRegistro('1500;300;12')).toEqual({ x: 1500, y: 300, botao: 12 });
    expect(lerRegistro('3,1500,300', { linhasPorPolegada: 1000, botaoNoComeco: true })).toEqual({ x: 1500, y: 300, botao: 3 });
    for (const ruim of ['', 'MESA PRONTA', '100,200', '1x0,200,1', '100,200,Z']) expect(lerRegistro(ruim), ruim).toBeNull();
    expect(lerRegistros('cabeçalho\r\n0,0,1\r\n10,0,1\r\n\r\nlixo\n')).toEqual({ registros: [{ x: 0, y: 0, botao: 1 }, { x: 10, y: 0, botao: 1 }], ignoradas: 2 });
  });

  it('a escala pela resolução e os eixos: x da mesa vai para a direita do desenho, y da mesa para cima', () => {
    expect(pontoDaMesa({ x: 254, y: 0, botao: 1 }, { linhasPorPolegada: 254, botaoNoComeco: false })).toEqual({ x: 0, y: 25.4 });
    expect(pontoDaMesa({ x: 0, y: 1000, botao: 1 }, { linhasPorPolegada: 1000, botaoNoComeco: false }).x).toBeCloseTo(-25.4);
  });

  it('um retângulo de cantos, com um pique e o fio: a peça com o canto no zero, o pique na aresta certa', () => {
    // 200 × 100 mm, tocados a partir do canto de baixo à esquerda da mesa.
    const { pecas, recados, estado } = tocarTudo([
      { x: 0, y: 0, botao: 1 },
      { x: 2000, y: 0, botao: 1 },
      { x: 2000, y: 500, botao: 3 },
      { x: 2000, y: 1000, botao: 1 },
      { x: 0, y: 1000, botao: 1 },
      { x: 1000, y: 200, botao: 4 },
      { x: 1000, y: 800, botao: 4 },
      { x: 0, y: 0, botao: 5 },
    ]);
    expect(recados[2]).toBe('3º ponto (pique).');
    expect(recados.at(-1)).toBe('Peça fechada com 5 pontos e 1 pique(s).');
    expect(estado).toEqual(MESA_VAZIA);
    const peca = pecas[0]!;
    expect(peca.contorno.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [100, 0],
      [100, 200],
      [50, 200],
      [0, 200],
      [0, 0],
    ]);
    expect(peca.piques).toEqual([{ posicao: { x: 50, y: 200 }, indiceAresta: 2 }]);
    expect(peca.linhaDeFio).toEqual({ inicio: { x: 80, y: 100 }, fim: { x: 20, y: 100 } });
    // A peça entra no programa como as outras.
    const molde = criarMolde({ nome: 'Da mesa', referencia: '', tamanho: '', contorno: peca.contorno, linhaDeFio: peca.linhaDeFio, piques: peca.piques.map((q, i) => ({ id: `p${i}`, ...q })) }, 'm');
    expect(area(molde.contorno)).toBeCloseTo(20_000, 0);
  });

  it('os pontos de curva viram uma curva que passa por eles; os de canto ficam retos', () => {
    const r = pecaDosPontos({
      pontos: [
        { p: { x: 0, y: 0 }, curva: false, pique: false },
        { p: { x: 0, y: 100 }, curva: false, pique: false },
        { p: { x: 50, y: 120 }, curva: true, pique: false },
        { p: { x: 100, y: 100 }, curva: false, pique: false },
        { p: { x: 100, y: 0 }, curva: false, pique: false },
      ],
      fio: [],
    });
    if ('erro' in r) throw new Error(r.erro);
    // 2 trechos tocam o ponto de curva: 7 pontos a mais em cada.
    expect(r.contorno).toHaveLength(5 + 2 * 7);
    expect(r.contorno.some((p) => Math.abs(p.x - 50) < 1e-9 && Math.abs(p.y - 120) < 1e-9)).toBe(true);
    // Sem o fio tocado: horizontal pelo meio.
    expect(r.linhaDeFio.inicio.x).toBe(r.linhaDeFio.fim.x);
  });

  it('desfazer, o fio recomeçado, os botões sem uso e a peça que não fecha', () => {
    let t = tocar(MESA_VAZIA, { x: 0, y: 0, botao: 6 }, CONFIG);
    expect(t.recado).toBe('Não há ponto para desfazer.');
    t = tocar(t.estado, { x: 0, y: 0, botao: 1 }, CONFIG);
    t = tocar(t.estado, { x: 10, y: 0, botao: 1 }, CONFIG);
    t = tocar(t.estado, { x: 0, y: 0, botao: 6 }, CONFIG);
    expect(t.estado.pontos).toHaveLength(1);
    t = tocar(t.estado, { x: 0, y: 0, botao: 5 }, CONFIG);
    expect(t.recado).toMatch(/ao menos 3 pontos/);
    expect(t.peca).toBeUndefined();
    t = tocar(t.estado, { x: 0, y: 0, botao: 9 }, CONFIG);
    expect(t.recado).toMatch(/sem uso/);
    let f = tocar(MESA_VAZIA, { x: 0, y: 0, botao: 4 }, CONFIG);
    expect(f.recado).toMatch(/toque o fim/);
    f = tocar(f.estado, { x: 10, y: 0, botao: 4 }, CONFIG);
    f = tocar(f.estado, { x: 20, y: 0, botao: 4 }, CONFIG);
    expect(f.estado.fio).toHaveLength(1);
    const emLinha = tocarTudo([
      { x: 0, y: 0, botao: 1 },
      { x: 100, y: 0, botao: 1 },
      { x: 200, y: 0, botao: 1 },
      { x: 0, y: 0, botao: 5 },
    ]);
    expect(emLinha.recados.at(-1)).toMatch(/numa linha/);
  });
});
