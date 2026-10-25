import {
  ALTURA_DA_FOLHA,
  caminhoDoTraco,
  elementosDaVista,
  geometriaDaCota,
  LARGURA_DA_FOLHA,
  ROTULO_DA_VISTA,
  rotuloDaCota,
  TRACEJADO_DO_ESTILO,
  type DesenhoTecnico,
  type CotaDoDesenho,
  type ElementoDoDesenho,
  type VistaDoDesenho,
} from '../domain/desenhoTecnico';
import type { ImagemDoModelo } from '../domain/imagens';

/**
 * O desenho técnico em SVG (ADR 0107): a frente e as costas lado a lado, com o nome de cada vista embaixo — o
 * vetor que os programas de desenho abrem. As estampas vão dentro do arquivo (a imagem em data URL). O manequim
 * de guia não sai.
 */

const ESPACO = 40;
const RODAPE = 30;

const escapar = (texto: string): string => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A cota: a linha, as setas e o rótulo (a letra no círculo, ou o texto na caixa), branco por dentro. */
function cotaEmSvg(c: CotaDoDesenho, medidas: readonly { readonly id: string }[]): string {
  const g = geometriaDaCota(c, rotuloDaCota(c, medidas));
  const r = g.rotulo;
  const seta = (s: (typeof g.setas)[number]): string => `<polygon points="${s.map((q) => `${q.x},${q.y}`).join(' ')}" fill="${c.cor}"/>`;
  const fundo =
    r.raio !== null
      ? `<circle cx="${r.centro.x}" cy="${r.centro.y}" r="${r.raio}" fill="#ffffff" stroke="${c.cor}" stroke-width="1"/>`
      : `<rect x="${r.centro.x - r.largura / 2}" y="${r.centro.y - r.altura / 2}" width="${r.largura}" height="${r.altura}" rx="3" fill="#ffffff" stroke="${c.cor}" stroke-width="1"/>`;
  return `<g class="cota"><line x1="${c.de.x}" y1="${c.de.y}" x2="${c.ate.x}" y2="${c.ate.y}" stroke="${c.cor}" stroke-width="0.8"/>${g.setas.map(seta).join('')}${fundo}<text x="${r.centro.x}" y="${r.centro.y}" font-size="${r.tamanho}" font-weight="bold" fill="${c.cor}" text-anchor="middle" dominant-baseline="central" font-family="Helvetica, Arial, sans-serif">${escapar(r.texto)}</text></g>`;
}

function elementoEmSvg(e: ElementoDoDesenho, imagens: readonly ImagemDoModelo[], medidas: readonly { readonly id: string }[]): string {
  if (e.tipo === 'traco') {
    const tracejado = TRACEJADO_DO_ESTILO[e.estilo];
    return `<path d="${caminhoDoTraco(e.pontos, e.curvo, e.fechado)}" fill="${e.fechado && e.preenchimento ? e.preenchimento : 'none'}" stroke="${e.cor}" stroke-width="${e.espessura}"${tracejado ? ` stroke-dasharray="${tracejado.join(' ')}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (e.tipo === 'texto') {
    return `<text x="${e.posicao.x}" y="${e.posicao.y}" font-size="${e.tamanho}" fill="${e.cor}" font-family="Helvetica, Arial, sans-serif">${escapar(e.texto)}</text>`;
  }
  if (e.tipo === 'cota') return cotaEmSvg(e, medidas);
  const imagem = imagens.find((i) => i.id === e.imagemId);
  if (!imagem) return '';
  const altura = e.largura * (imagem.alturaPx / imagem.larguraPx);
  const espelho = e.id.endsWith('~') ? ` translate(${2 * e.centro.x} 0) scale(-1 1)` : '';
  return `<image href="${imagem.dados}" x="${e.centro.x - e.largura / 2}" y="${e.centro.y - altura / 2}" width="${e.largura}" height="${altura}" opacity="${e.opacidade}" preserveAspectRatio="none" transform="rotate(${e.rotacaoGraus} ${e.centro.x} ${e.centro.y})${espelho}"/>`;
}

/** As vistas que têm algum elemento (as duas, se nenhuma tiver). */
export function vistasComDesenho(desenho: DesenhoTecnico): VistaDoDesenho[] {
  const com = (['frente', 'costas'] as const).filter((v) => desenho.elementos.some((e) => e.vista === v));
  return com.length > 0 ? com : ['frente', 'costas'];
}

/** O SVG das vistas; `medidas` (os pontos de medida da ficha, na ordem da tabela) dá a letra de cada cota. */
export function svgDoDesenho(desenho: DesenhoTecnico, imagens: readonly ImagemDoModelo[], titulo = '', medidas: readonly { readonly id: string }[] = []): string {
  const vistas = vistasComDesenho(desenho);
  const largura = vistas.length * LARGURA_DA_FOLHA + (vistas.length - 1) * ESPACO;
  const altura = ALTURA_DA_FOLHA + RODAPE;
  const folhas = vistas
    .map((v, i) => {
      const x = i * (LARGURA_DA_FOLHA + ESPACO);
      const elementos = elementosDaVista(desenho, v)
        .map((e) => elementoEmSvg(e, imagens, medidas))
        .filter((s) => s !== '')
        .join('\n    ');
      return `  <g transform="translate(${x} 0)">\n    ${elementos}\n    <text x="${LARGURA_DA_FOLHA / 2}" y="${ALTURA_DA_FOLHA + 20}" font-size="14" text-anchor="middle" fill="#5a6270" font-family="Helvetica, Arial, sans-serif">${ROTULO_DA_VISTA[v]}</text>\n  </g>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">\n  <title>${escapar(titulo || 'Desenho técnico')}</title>\n  <rect x="0" y="0" width="${largura}" height="${altura}" fill="#ffffff"/>\n${folhas}\n</svg>\n`;
}
