/** As janelas do programa arrumadas na tela (ADR 0211). */

export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const PASSO_DA_CASCATA = 32;

/** Uma sobre a outra, descendo em degraus: todas do mesmo tamanho, sem sair da área. */
export function emCascata(quantas: number, area: Retangulo): Retangulo[] {
  const recuo = PASSO_DA_CASCATA * Math.max(0, quantas - 1);
  const passo = recuo > area.width / 2 || recuo > area.height / 2 ? Math.floor(Math.min(area.width, area.height) / 2 / Math.max(1, quantas - 1)) : PASSO_DA_CASCATA;
  const total = passo * Math.max(0, quantas - 1);
  return Array.from({ length: quantas }, (_, i) => ({ x: area.x + i * passo, y: area.y + i * passo, width: area.width - total, height: area.height - total }));
}

/** Em colunas e linhas, ocupando a área toda; a última linha divide o que sobrou. */
export function ladoALado(quantas: number, area: Retangulo): Retangulo[] {
  const colunas = Math.ceil(Math.sqrt(quantas));
  const linhas = Math.ceil(quantas / colunas);
  const altura = Math.floor(area.height / linhas);
  return Array.from({ length: quantas }, (_, i) => {
    const linha = Math.floor(i / colunas);
    const naLinha = linha === linhas - 1 ? quantas - colunas * (linhas - 1) : colunas;
    const largura = Math.floor(area.width / naLinha);
    return { x: area.x + (i % colunas) * largura, y: area.y + linha * altura, width: largura, height: altura };
  });
}

export interface JanelaArrumavel {
  isDestroyed(): boolean;
  isMaximized(): boolean;
  isMinimized(): boolean;
  unmaximize(): void;
  restore(): void;
  getBounds(): Retangulo;
  setBounds(lugar: Retangulo): void;
  getMinimumSize(): number[];
  setMinimumSize(largura: number, altura: number): void;
}

const TENTATIVAS_DO_ARRANJO = 8;
const ESPERA_DO_ARRANJO_MS = 150;
/** A escala da tela arredonda o tamanho: alguns pixels de diferença não são erro. */
const FOLGA_DO_ARRANJO_PX = 8;

function estaNoLugar(janela: JanelaArrumavel, lugar: Retangulo): boolean {
  const b = janela.getBounds();
  return !janela.isMaximized() && !janela.isMinimized() && [b.x - lugar.x, b.y - lugar.y, b.width - lugar.width, b.height - lugar.height].every((d) => Math.abs(d) <= FOLGA_DO_ARRANJO_PX);
}

/**
 * Põe a janela no lugar e confere. O Windows pode ignorar o pedido, quando a janela ainda está saindo do maximizado: só
 * o lugar em que ela ficou diz se deu certo. Devolve `false` se ela não foi para lá depois de todas as tentativas.
 */
export async function porNoLugar(janela: JanelaArrumavel, lugar: Retangulo, esperar: (ms: number) => Promise<void>): Promise<boolean> {
  // Em telas de 1280, duas janelas lado a lado têm menos que o mínimo de uma: o mínimo cede, ou elas se sobrepõem.
  const [larguraMinima = 0, alturaMinima = 0] = janela.getMinimumSize();
  janela.setMinimumSize(Math.min(larguraMinima, lugar.width), Math.min(alturaMinima, lugar.height));
  for (let i = 0; i < TENTATIVAS_DO_ARRANJO; i++) {
    if (janela.isDestroyed()) return true;
    if (janela.isMinimized() || janela.isMaximized()) {
      if (janela.isMinimized()) janela.restore();
      else janela.unmaximize();
      await esperar(ESPERA_DO_ARRANJO_MS);
      if (janela.isDestroyed()) return true;
    }
    janela.setBounds(lugar);
    await esperar(ESPERA_DO_ARRANJO_MS);
    if (janela.isDestroyed() || estaNoLugar(janela, lugar)) return true;
  }
  return false;
}
