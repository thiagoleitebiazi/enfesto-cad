import { describe, expect, it } from 'vitest';
import { adicionarElemento, DESENHO_VAZIO, novoTraco, tracosDaBase } from '../domain/desenhoTecnico';
import type { ImagemDoModelo } from '../domain/imagens';
import { svgDoDesenho, vistasComDesenho } from './desenho-exportacao';

let n = 0;
const novoId = (): string => `s${++n}`;
const IMAGEM = { id: 'i', nome: 'Floral', dados: 'data:image/png;base64,AAAA', larguraPx: 100, alturaPx: 50 } as ImagemDoModelo;

describe('o desenho técnico em SVG', () => {
  it('as duas vistas lado a lado, com o nome embaixo; o pesponto tracejado; o espelho dentro', () => {
    const d = adicionarElemento(adicionarElemento(DESENHO_VAZIO, tracosDaBase('camiseta', novoId)), novoTraco('p', 'frente', [{ x: 120, y: 300 }, { x: 150, y: 300 }], { estilo: 'pesponto', espelhar: true }));
    const svg = svgDoDesenho(d, [], 'CAM-01 — Camiseta');
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('viewBox="0 0 840 530"');
    expect(svg).toContain('<title>CAM-01 — Camiseta</title>');
    expect(svg).toContain('>Frente</text>');
    expect(svg).toContain('>Costas</text>');
    expect(svg).toContain('stroke-dasharray="4 3"');
    // O pesponto e o espelho dele.
    expect(svg).toContain('M 120 300 L 150 300');
    expect(svg).toContain('M 280 300 L 250 300');
  });

  it('só a vista que tem desenho; o texto escapado; a estampa com a imagem dentro (e girada)', () => {
    const d = adicionarElemento(DESENHO_VAZIO, [
      { id: 't', tipo: 'texto', vista: 'costas', posicao: { x: 10, y: 20 }, texto: 'Bainha < 2 cm & pesponto', tamanho: 10, cor: '#000000' },
      { id: 'e', tipo: 'estampa', vista: 'costas', imagemId: 'i', centro: { x: 200, y: 200 }, largura: 80, rotacaoGraus: 10, opacidade: 0.5, espelhar: false },
    ]);
    expect(vistasComDesenho(d)).toEqual(['costas']);
    const svg = svgDoDesenho(d, [IMAGEM]);
    expect(svg).toContain('viewBox="0 0 400 530"');
    expect(svg).toContain('Bainha &lt; 2 cm &amp; pesponto');
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain('rotate(10 200 200)');
    expect(vistasComDesenho(DESENHO_VAZIO)).toEqual(['frente', 'costas']);
  });
});
