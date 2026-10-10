import { distancia, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import type { Molde } from './molde';
import type { Projeto } from './projeto';

/**
 * Imagens do modelo (aba Modelo > Imagens): fotos e desenhos guardados no
 * projeto e mostrados por baixo das peças. Com a escala calibrada, a foto de
 * um molde de papel serve de base para contorná-lo (Produção > Digitalizar).
 *
 * Como o resto do desenho, a imagem segue os eixos da tela: a largura dela
 * (px para a direita) corre no Y do mundo, e a altura (px para baixo), no X.
 */
export interface ImagemDoModelo {
  readonly id: string;
  readonly nome: string;
  /** A imagem em si, como data URL — já reduzida ao entrar (ver `tamanhoReduzido`). */
  readonly dados: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
  /** Onde fica, no desenho, o canto de cima à esquerda da imagem (mm). */
  readonly origem: Ponto2D;
  readonly mmPorPx: number;
  /** A escala só é de verdade depois de calibrada com uma distância conhecida. */
  readonly calibrada: boolean;
  readonly opacidade: number;
  readonly visivel: boolean;
}

export const MAXIMO_DE_IMAGENS = 4;
/** O lado maior de uma imagem guardada: acima disso ela é reduzida ao entrar, para o projeto não inchar. */
export const LADO_MAXIMO_DA_IMAGEM_PX = 2000;
/** Escala de uma imagem recém-chegada, antes de calibrar: a de uma tela comum (96 pontos por polegada). */
export const MM_POR_PX_INICIAL = 25.4 / 96;
export const OPACIDADES_DA_IMAGEM: readonly number[] = [0.25, 0.5, 0.75, 1];
export const TAMANHO_MAXIMO_DO_NOME_DA_IMAGEM = 60;
const OPACIDADE_INICIAL = 0.75;
const AFASTAMENTO_DAS_PECAS_MM = 20;
const DISTANCIA_MINIMA_DA_CALIBRACAO_MM = 1e-6;
const DISTANCIA_MAXIMA_DA_CALIBRACAO_MM = 100_000;

/** O tamanho com que a imagem é guardada: o mesmo, se couber no lado máximo; senão, reduzido na proporção. */
export function tamanhoReduzido(
  larguraPx: number,
  alturaPx: number,
  ladoMaximoPx: number = LADO_MAXIMO_DA_IMAGEM_PX,
): { readonly larguraPx: number; readonly alturaPx: number } {
  if (!(larguraPx >= 1) || !(alturaPx >= 1) || !Number.isFinite(larguraPx) || !Number.isFinite(alturaPx)) {
    throw new Error('A imagem não tem tamanho.');
  }
  const fator = Math.min(1, ladoMaximoPx / Math.max(larguraPx, alturaPx));
  return { larguraPx: Math.max(1, Math.round(larguraPx * fator)), alturaPx: Math.max(1, Math.round(alturaPx * fator)) };
}

/** O nome da imagem a partir do nome do arquivo: sem a extensão e sem passar do tamanho máximo. */
export function nomeDaImagem(nomeDoArquivo: string): string {
  const semExtensao = nomeDoArquivo.trim().replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
  return (semExtensao || 'Imagem').slice(0, TAMANHO_MAXIMO_DO_NOME_DA_IMAGEM);
}

/** Uma imagem recém-chegada: visível, na escala de tela, à espera de ser calibrada. */
export function novaImagem(id: string, nome: string, dados: string, larguraPx: number, alturaPx: number, origem: Ponto2D): ImagemDoModelo {
  if (!dados.startsWith('data:image/')) throw new Error('O arquivo não é uma imagem.');
  if (!(larguraPx >= 1) || !(alturaPx >= 1)) throw new Error('A imagem não tem tamanho.');
  return {
    id,
    nome: nomeDaImagem(nome),
    dados,
    larguraPx,
    alturaPx,
    origem,
    mmPorPx: MM_POR_PX_INICIAL,
    calibrada: false,
    opacidade: OPACIDADE_INICIAL,
    visivel: true,
  };
}

/** O retângulo que a imagem ocupa no desenho (mm): a altura dela corre no X e a largura, no Y. */
export function retanguloDaImagem(imagem: ImagemDoModelo): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
} {
  return {
    minX: imagem.origem.x,
    minY: imagem.origem.y,
    maxX: imagem.origem.x + imagem.alturaPx * imagem.mmPorPx,
    maxY: imagem.origem.y + imagem.larguraPx * imagem.mmPorPx,
  };
}

/** Onde pôr uma imagem nova: no começo da mesa, ou logo depois das peças que já estão nela, para não ficar escondida. */
export function origemParaImagemNova(pecas: readonly Molde[]): Ponto2D {
  if (pecas.length === 0) return { x: 0, y: 0 };
  const fimDasPecas = Math.max(...pecas.map((p) => retanguloEnvolvente(p.contorno).maxY));
  return { x: 0, y: fimDasPecas + AFASTAMENTO_DAS_PECAS_MM };
}

/**
 * Calibra a escala: `a` e `b` são dois pontos clicados sobre a imagem (mm do
 * desenho, na escala atual) e `distanciaRealMm`, a distância de verdade entre
 * eles. A imagem cresce ou encolhe a partir do canto de cima à esquerda, que
 * não sai do lugar: assim ela continua onde foi posta, dentro da mesa, em vez
 * de escorregar para fora em volta do ponto clicado.
 */
export function calibrarImagem(imagem: ImagemDoModelo, a: Ponto2D, b: Ponto2D, distanciaRealMm: number): ImagemDoModelo {
  const atual = distancia(a, b);
  if (!(atual > DISTANCIA_MINIMA_DA_CALIBRACAO_MM)) throw new Error('Os dois pontos da calibração estão no mesmo lugar.');
  if (!Number.isFinite(distanciaRealMm) || !(distanciaRealMm > 0) || distanciaRealMm > DISTANCIA_MAXIMA_DA_CALIBRACAO_MM) {
    throw new Error('A distância real precisa ser maior que zero (em mm).');
  }
  return { ...imagem, mmPorPx: (imagem.mmPorPx * distanciaRealMm) / atual, calibrada: true };
}

/** "529 × 397 mm · 1 px = 0,265 mm": o tamanho da imagem no desenho e a escala dela. */
export function descreverEscalaDaImagem(imagem: ImagemDoModelo): string {
  const mm = (v: number): string => v.toFixed(0);
  const escala = imagem.mmPorPx.toFixed(3).replace('.', ',');
  return `${mm(imagem.larguraPx * imagem.mmPorPx)} × ${mm(imagem.alturaPx * imagem.mmPorPx)} mm · 1 px = ${escala} mm`;
}

/** A mesma lista vazia todas as vezes, para quem compara a lista de um desenho para o outro. */
const SEM_IMAGENS: readonly ImagemDoModelo[] = [];

export function imagensDoProjeto(projeto: Projeto): readonly ImagemDoModelo[] {
  return projeto.imagens ?? SEM_IMAGENS;
}

function comImagens(projeto: Projeto, imagens: readonly ImagemDoModelo[], agoraIso: string): Projeto {
  if (imagens.length > 0) return { ...projeto, imagens, modificadoEmIso: agoraIso };
  const copia: { -readonly [K in keyof Projeto]: Projeto[K] } = { ...projeto, modificadoEmIso: agoraIso };
  delete copia.imagens;
  return copia;
}

export function adicionarImagem(projeto: Projeto, imagem: ImagemDoModelo, agoraIso: string): Projeto {
  const imagens = imagensDoProjeto(projeto);
  if (imagens.length >= MAXIMO_DE_IMAGENS) {
    throw new Error(`O projeto pode ter até ${MAXIMO_DE_IMAGENS} imagens. Remova uma antes de adicionar outra.`);
  }
  return comImagens(projeto, [...imagens, imagem], agoraIso);
}

export function removerImagem(projeto: Projeto, id: string, agoraIso: string): Projeto {
  const imagens = imagensDoProjeto(projeto);
  if (!imagens.some((i) => i.id === id)) throw new Error('Imagem não encontrada no projeto.');
  return comImagens(
    projeto,
    imagens.filter((i) => i.id !== id),
    agoraIso,
  );
}

/** Troca a imagem de mesmo id pela nova versão dela (mostrada ou não, outra opacidade, calibrada…). */
export function substituirImagem(projeto: Projeto, imagem: ImagemDoModelo, agoraIso: string): Projeto {
  const imagens = imagensDoProjeto(projeto);
  if (!imagens.some((i) => i.id === imagem.id)) throw new Error('Imagem não encontrada no projeto.');
  if (!OPACIDADES_DA_IMAGEM.includes(imagem.opacidade)) throw new Error('Opacidade fora das opções.');
  return comImagens(
    projeto,
    imagens.map((i) => (i.id === imagem.id ? imagem : i)),
    agoraIso,
  );
}

/** A imagem que o "Digitalizar" pode contornar: a primeira que está à mostra e já na escala. */
export function imagemProntaParaContornar(imagens: readonly ImagemDoModelo[]): ImagemDoModelo | null {
  return imagens.find((i) => i.visivel && i.calibrada) ?? null;
}
