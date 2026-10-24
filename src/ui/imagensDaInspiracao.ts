import { coresDaImagem, LADO_MAXIMO_DA_INSPIRACAO } from '../domain/inspiracao';

/** Uma imagem pronta para o painel de inspiração: reduzida, em JPEG, com as cores principais. */
export interface ImagemParaInspiracao {
  readonly nome: string;
  readonly dados: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
  readonly cores: readonly string[];
}

function carregar(endereco: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rejeitar(new Error('Não foi possível ler a imagem: o arquivo está danificado ou não é uma imagem.'));
    img.src = endereco;
  });
}

/** A imagem reduzida (até 640 px de lado), sobre fundo branco, em JPEG, com as cores principais. */
async function preparar(img: HTMLImageElement, nome: string): Promise<ImagemParaInspiracao> {
  const escala = Math.min(1, LADO_MAXIMO_DA_INSPIRACAO / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));
  const tela = document.createElement('canvas');
  tela.width = w;
  tela.height = h;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem neste computador.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const cores = coresDaImagem(ctx.getImageData(0, 0, w, h).data, w, h, 5);
  return { nome, dados: tela.toDataURL('image/jpeg', 0.85), larguraPx: w, alturaPx: h, cores };
}

/** Lê o arquivo escolhido para o painel. */
export async function lerImagemParaInspiracao(arquivo: File): Promise<ImagemParaInspiracao> {
  if (!arquivo.type.startsWith('image/')) throw new Error(`"${arquivo.name}" não é uma imagem (use PNG, JPG ou WEBP).`);
  if (arquivo.size > 40 * 1024 * 1024) throw new Error(`"${arquivo.name}" passa de 40 MB.`);
  const endereco = URL.createObjectURL(arquivo);
  try {
    return await preparar(await carregar(endereco), arquivo.name.replace(/\.[^.]+$/, ''));
  } finally {
    URL.revokeObjectURL(endereco);
  }
}

/** Uma imagem que já está na memória (a que a IA fez) pronta para o painel. */
export async function reduzirParaInspiracao(dados: string, nome: string): Promise<ImagemParaInspiracao> {
  return preparar(await carregar(dados), nome);
}

/** Um desenho em SVG passado para PNG (base64 sem o cabeçalho), com `largura` px, sobre fundo branco. */
export async function pngDoSvg(svg: string, largura: number): Promise<string> {
  const endereco = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await carregar(endereco);
    const proporcao = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = Math.max(1, Math.round(largura * proporcao));
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error('Não foi possível desenhar o croqui neste computador.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(img, 0, 0, tela.width, tela.height);
    return tela.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  } finally {
    URL.revokeObjectURL(endereco);
  }
}

/** Os bytes de um base64 (para salvar o PNG). */
export function bytesDoBase64(b64: string): ArrayBuffer {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}
