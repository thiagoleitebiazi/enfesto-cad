import { FOLGA_FORA_DA_PECA_MM } from '../domain/linhasSoltas';

/**
 * A folga das linhas internas na validação: quanto uma linha pode passar da
 * borda da peça sem ser apontada. Quem escolhe é quem usa o programa, no
 * campo da faixa de validação. Fica no armazenamento local deste computador,
 * como os cadastros: vale para todos os projetos abertos nele.
 */
const CHAVE = 'enfesto-cad:folga-fora-da-peca';

/** A maior folga que o campo aceita (mm). */
export const FOLGA_MAXIMA_MM = 100;

function ehFolga(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= FOLGA_MAXIMA_MM;
}

/** O número escrito no campo — com vírgula ou ponto, de 0 a 100 mm —, ou `null` se o que está escrito não é isso. */
export function folgaDigitada(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  const valor = Number(limpo);
  return ehFolga(valor) ? valor : null;
}

/** A folga como aparece no campo: com vírgula. */
export function folgaEscrita(mm: number): string {
  return String(mm).replace('.', ',');
}

/** A folga guardada neste computador. O que não dá para ler vale como a folga padrão: ela nunca impede o programa de abrir. */
export function lerFolgaForaDaPeca(armazenamento: Pick<Storage, 'getItem'>): number {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? 'null');
    return ehFolga(lido) ? lido : FOLGA_FORA_DA_PECA_MM;
  } catch {
    return FOLGA_FORA_DA_PECA_MM;
  }
}

/** Guarda a folga. Devolve `false` se não deu para gravar. */
export function gravarFolgaForaDaPeca(armazenamento: Pick<Storage, 'setItem'>, mm: number): boolean {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(mm));
    return true;
  } catch {
    return false;
  }
}
