import { retanguloEnvolvente } from '../core/geometria';
import type { ConfiguracaoDeEnfesto } from '../domain/enfesto';
import { linhaDeCorteDaPeca, type Molde } from '../domain/molde';
import { tecidoDaPeca } from '../domain/tecidosDoModelo';

/**
 * O encaixe para outros programas (ADR 0201): o manual da referência exporta "Arquivo metafile" (uma imagem vetorial) e
 * "Arquivo de dados" (XML). A imagem aqui é SVG, que qualquer programa de desenho abre, e o XML traz cada peça e o
 * lugar dela. A horizontal do desenho é o comprimento da mesa, como na tela.
 */

const escapar = (texto: string): string => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number): string => String(Math.round(v * 100) / 100);

export function gerarSvgDoEncaixe(pecas: readonly Molde[], enfesto: Pick<ConfiguracaoDeEnfesto, 'larguraUtilMm' | 'comprimentoMm'> | null): string {
  const cortes = pecas.map(linhaDeCorteDaPeca);
  const caixa = cortes.length > 0 ? retanguloEnvolvente(cortes.flat()) : { maxX: 1, maxY: 1 };
  const largura = enfesto?.larguraUtilMm ?? caixa.maxX;
  const comprimento = Math.max(caixa.maxY, enfesto ? 1 : 0);
  const pontos = (linha: readonly { readonly x: number; readonly y: number }[]): string => linha.map((p) => `${n(p.y)},${n(p.x)}`).join(' ');
  const corpo = pecas.map((p, i) => {
    const partes = [
      `  <g id="${escapar(p.id)}">`,
      `    <title>${escapar(`${p.nome} ${p.tamanho}`.trim())}</title>`,
      `    <polygon points="${pontos(cortes[i]!)}" fill="${escapar(p.cor ?? 'none')}" stroke="#000" stroke-width="0.3"/>`,
      ...p.furos.map((f) => `    <polygon points="${pontos(f)}" fill="#fff" stroke="#000" stroke-width="0.2"/>`),
      ...p.linhasInternas.map((l) => `    <polyline points="${pontos(l)}" fill="none" stroke="#000" stroke-width="0.2"/>`),
      `    <polyline points="${pontos([p.linhaDeFio.inicio, p.linhaDeFio.fim])}" fill="none" stroke="#000" stroke-width="0.2" stroke-dasharray="2 1"/>`,
      '  </g>',
    ];
    return partes.join('\n');
  });
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<svg xmlns="http://www.w3.org/2000/svg" width="${n(comprimento)}mm" height="${n(largura)}mm" viewBox="0 0 ${n(comprimento)} ${n(largura)}">`, ...corpo, '</svg>', ''].join('\n');
}

export function gerarXmlDoEncaixe(dados: { readonly nome: string; readonly codigo: string; readonly pecas: readonly Molde[]; readonly enfesto: ConfiguracaoDeEnfesto | null }): string {
  const e = dados.enfesto;
  const atributosDaMesa = e ? ` tipo="${e.tipo}" larguraMm="${n(e.larguraUtilMm)}" comprimentoMm="${n(e.comprimentoMm)}" camadas="${e.quantidadeDeCamadas}"` : '';
  const linhas = dados.pecas.map((p) => {
    const c = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    return `  <peca id="${escapar(p.id)}" nome="${escapar(p.nome)}" tamanho="${escapar(p.tamanho)}" tecido="${escapar(tecidoDaPeca(p))}" quantidade="${p.quantidade}" giro="${n(p.anguloDeRotacaoGraus)}" x="${n(c.minY)}" y="${n(c.minX)}" largura="${n(c.maxY - c.minY)}" altura="${n(c.maxX - c.minX)}"/>`;
  });
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<encaixe nome="${escapar(dados.nome)}" codigo="${escapar(dados.codigo)}"${atributosDaMesa}>`, ...linhas, '</encaixe>', ''].join('\n');
}
