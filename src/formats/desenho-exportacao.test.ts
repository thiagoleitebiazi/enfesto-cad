import { describe, expect, it } from 'vitest';
import { adicionarElemento, DESENHO_VAZIO, novaCota, novoTraco, tracosDaBase } from '../domain/desenhoTecnico';
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

describe('as cotas no SVG (ADR 0117)', () => {
  it('a linha, as duas setas e a letra do ponto de medida; sem ponto, o texto na caixa', () => {
    let d = adicionarElemento(DESENHO_VAZIO, novaCota('c1', 'frente', { x: 100, y: 200 }, { x: 300, y: 200 }, 'comprimento'));
    d = adicionarElemento(d, { ...novaCota('c2', 'frente', { x: 100, y: 400 }, { x: 100, y: 450 }, null), texto: 'Barra <3 cm>' });
    const svg = svgDoDesenho(d, [], '', [{ id: 'busto' }, { id: 'comprimento' }]);
    expect(svg.match(/<g class="cota">/g)).toHaveLength(2);
    expect(svg.match(/<polygon /g)).toHaveLength(4);
    expect(svg).toContain('<line x1="100" y1="200" x2="300" y2="200"');
    expect(svg).toContain('<circle cx="200" cy="200" r="8"');
    expect(svg).toMatch(/dominant-baseline="central"[^>]*>B<\/text>/);
    expect(svg).toContain('>Barra &lt;3 cm&gt;</text>');
    // Sem as medidas da ficha, a cota ligada mostra "?".
    expect(svgDoDesenho(d, [])).toMatch(/>\?<\/text>/);
  });
});
