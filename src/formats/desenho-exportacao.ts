import {
  ALTURA_DA_FOLHA,
  caminhoDoTraco,
  elementosDaVista,
  LARGURA_DA_FOLHA,
  ROTULO_DA_VISTA,
  TRACEJADO_DO_ESTILO,
  type DesenhoTecnico,
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

function elementoEmSvg(e: ElementoDoDesenho, imagens: readonly ImagemDoModelo[]): string {
  if (e.tipo === 'traco') {
    const tracejado = TRACEJADO_DO_ESTILO[e.estilo];
    return `<path d="${caminhoDoTraco(e.pontos, e.curvo, e.fechado)}" fill="${e.fechado && e.preenchimento ? e.preenchimento : 'none'}" stroke="${e.cor}" stroke-width="${e.espessura}"${tracejado ? ` stroke-dasharray="${tracejado.join(' ')}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (e.tipo === 'texto') {
    return `<text x="${e.posicao.x}" y="${e.posicao.y}" font-size="${e.tamanho}" fill="${e.cor}" font-family="Helvetica, Arial, sans-serif">${escapar(e.texto)}</text>`;
  }
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

export function svgDoDesenho(desenho: DesenhoTecnico, imagens: readonly ImagemDoModelo[], titulo = ''): string {
  const vistas = vistasComDesenho(desenho);
  const largura = vistas.length * LARGURA_DA_FOLHA + (vistas.length - 1) * ESPACO;
  const altura = ALTURA_DA_FOLHA + RODAPE;
  const folhas = vistas
    .map((v, i) => {
      const x = i * (LARGURA_DA_FOLHA + ESPACO);
      const elementos = elementosDaVista(desenho, v)
        .map((e) => elementoEmSvg(e, imagens))
        .filter((s) => s !== '')
        .join('\n    ');
      return `  <g transform="translate(${x} 0)">\n    ${elementos}\n    <text x="${LARGURA_DA_FOLHA / 2}" y="${ALTURA_DA_FOLHA + 20}" font-size="14" text-anchor="middle" fill="#5a6270" font-family="Helvetica, Arial, sans-serif">${ROTULO_DA_VISTA[v]}</text>\n  </g>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">\n  <title>${escapar(titulo || 'Desenho técnico')}</title>\n  <rect x="0" y="0" width="${largura}" height="${altura}" fill="#ffffff"/>\n${folhas}\n</svg>\n`;
}
