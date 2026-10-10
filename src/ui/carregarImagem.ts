import { tamanhoReduzido } from '../domain/imagens';

const TAMANHO_MAXIMO_DO_ARQUIVO = 40 * 1024 * 1024;
const QUALIDADE_DO_JPEG = 0.82;

export interface ImagemLida {
  readonly nome: string;
  readonly dados: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
}

/**
 * Lê uma foto ou um desenho escolhido pelo usuário e devolve-o pronto para o
 * projeto: reduzido ao lado máximo e gravado como JPEG sobre fundo branco (o
 * que era transparente fica branco), para o arquivo do projeto não inchar.
 */
export async function lerImagemDoArquivo(arquivo: File): Promise<ImagemLida> {
  if (!arquivo.type.startsWith('image/')) throw new Error('O arquivo não é uma imagem. Use PNG, JPG, WEBP, BMP ou GIF.');
  if (arquivo.size > TAMANHO_MAXIMO_DO_ARQUIVO) throw new Error('A imagem passa de 40 MB. Reduza-a antes de trazer para o programa.');
  const endereco = URL.createObjectURL(arquivo);
  try {
    const original = await new Promise<HTMLImageElement>((resolver, rejeitar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rejeitar(new Error('Não foi possível ler a imagem: o arquivo está danificado ou não é uma imagem.'));
      img.src = endereco;
    });
    const { larguraPx, alturaPx } = tamanhoReduzido(original.naturalWidth, original.naturalHeight);
    const tela = document.createElement('canvas');
    tela.width = larguraPx;
    tela.height = alturaPx;
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a imagem.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, larguraPx, alturaPx);
    ctx.drawImage(original, 0, 0, larguraPx, alturaPx);
    return { nome: arquivo.name, dados: tela.toDataURL('image/jpeg', QUALIDADE_DO_JPEG), larguraPx, alturaPx };
  } finally {
    URL.revokeObjectURL(endereco);
  }
}
