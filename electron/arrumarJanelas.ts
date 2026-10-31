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
