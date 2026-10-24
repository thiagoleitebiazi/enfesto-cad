import type { ImagemDePixels } from '../domain/digitalizacao';

/** Os pixels de uma imagem guardada no projeto (data URL), pela tela do navegador. */
export async function pixelsDaImagem(dados: string): Promise<ImagemDePixels> {
  const img = new Image();
  img.src = dados;
  await img.decode();
  const tela = document.createElement('canvas');
  tela.width = img.naturalWidth;
  tela.height = img.naturalHeight;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Não foi possível ler a imagem.');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, tela.width, tela.height);
  return { largura: d.width, altura: d.height, dados: d.data };
}

/** Os pixels como data URL (PNG), para mostrar a foto corrigida. */
export function dataUrlDosPixels(imagem: ImagemDePixels): string {
  const tela = document.createElement('canvas');
  tela.width = imagem.largura;
  tela.height = imagem.altura;
  const ctx = tela.getContext('2d');
  if (!ctx) return '';
  const dados = ctx.createImageData(imagem.largura, imagem.altura);
  dados.data.set(imagem.dados);
  ctx.putImageData(dados, 0, 0);
  return tela.toDataURL('image/png');
}
