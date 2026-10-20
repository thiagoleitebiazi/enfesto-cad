import { chaveDaGrade, type GradeDoRisco } from './risco';

/**
 * A composição de riscos de um plano: quais grades (roupas de cada tamanho numa folha) e quantas camadas de cada
 * uma, para fechar a ordem de produção. Uma ordem nem sempre fecha com um risco só (a grade dela pode não caber
 * num risco, ou pedir camadas demais); estas composições são as candidatas, e cada uma é avaliada depois com o
 * comprimento real de cada risco.
 *
 * Geradores (heurísticos — não garantem a melhor composição possível):
 * - "grade proporcional": um risco com a proporção da ordem (40/80/40 → 1 P + 2 M + 1 G) e os múltiplos dela que
 *   caibam no limite de roupas por risco;
 * - "gulosa até N roupas por risco", para cada N de 1 ao limite: a cada passo, a grade e as camadas que produzem
 *   mais peças sem passar da ordem; o resto que não fecha sem excedente vai num último risco, com o excedente
 *   mínimo.
 */

export interface RiscoDaComposicao {
  readonly chave: string;
  readonly grade: GradeDoRisco;
  readonly camadas: number;
}

export interface Composicao {
  /** De onde veio ("grade proporcional", "gulosa até 4 roupas por risco"…). */
  readonly origem: string;
  readonly riscos: readonly RiscoDaComposicao[];
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));

/** As camadas para uma grade só fechar a ordem: em cada tamanho, o pedido ÷ (roupas da grade × folhas), para cima. */
export function camadasParaFechar(grade: GradeDoRisco, pedido: Readonly<Record<string, number>>, folhasPorCamada: number): number {
  let camadas = 0;
  for (const [tamanho, q] of Object.entries(pedido)) {
    if (q <= 0) continue;
    const porCamada = (grade[tamanho] ?? 0) * folhasPorCamada;
    if (porCamada > 0) camadas = Math.max(camadas, Math.ceil(q / porCamada));
  }
  return camadas;
}

/** Junta as camadas das grades iguais e tira as vazias. */
function juntar(riscos: ReadonlyArray<{ readonly grade: GradeDoRisco; readonly camadas: number }>, tamanhos: readonly string[]): RiscoDaComposicao[] {
  const porChave = new Map<string, RiscoDaComposicao>();
  for (const r of riscos) {
    if (r.camadas <= 0 || !Object.values(r.grade).some((n) => n > 0)) continue;
    const chave = chaveDaGrade(r.grade, tamanhos);
    const antes = porChave.get(chave);
    porChave.set(chave, { chave, grade: r.grade, camadas: (antes?.camadas ?? 0) + r.camadas });
  }
  return [...porChave.values()];
}

/** A grade proporcional à ordem (e os múltiplos dela até o limite de roupas por risco), cada uma num risco só. */
function proporcionais(pedido: Readonly<Record<string, number>>, tamanhos: readonly string[], folhas: number, maximo: number): Composicao[] {
  const pedidos = tamanhos.filter((t) => (pedido[t] ?? 0) > 0);
  if (pedidos.length === 0) return [];
  const divisor = pedidos.reduce((d, t) => mdc(d, pedido[t]!), 0);
  const base = Object.fromEntries(pedidos.map((t) => [t, pedido[t]! / divisor]));
  const roupas = pedidos.reduce((s, t) => s + base[t]!, 0);
  const lista: Composicao[] = [];
  for (let k = 1; k * roupas <= maximo; k++) {
    const grade = Object.fromEntries(pedidos.map((t) => [t, base[t]! * k]));
    lista.push({ origem: k === 1 ? 'grade proporcional à ordem' : `grade proporcional à ordem × ${k}`, riscos: juntar([{ grade, camadas: camadasParaFechar(grade, pedido, folhas) }], tamanhos) });
  }
  return lista;
}

/** Tira roupas da grade até caber no limite: sempre do tamanho com mais roupas (no empate, o de menos pedido). */
function aparar(grade: Record<string, number>, restante: Readonly<Record<string, number>>, maximo: number, tamanhos: readonly string[]): void {
  let total = tamanhos.reduce((s, t) => s + (grade[t] ?? 0), 0);
  while (total > maximo) {
    let alvo = tamanhos[0]!;
    for (const t of tamanhos) {
      const g = grade[t] ?? 0;
      const ga = grade[alvo] ?? 0;
      if (g > ga || (g === ga && g > 0 && (restante[t] ?? 0) < (restante[alvo] ?? 0))) alvo = t;
    }
    grade[alvo] = (grade[alvo] ?? 0) - 1;
    total--;
  }
}

/** A gulosa até `maximo` roupas por risco (ver o comentário do módulo). */
function gulosa(pedido: Readonly<Record<string, number>>, tamanhos: readonly string[], folhas: number, maximo: number): Composicao {
  const restante: Record<string, number> = Object.fromEntries(tamanhos.map((t) => [t, Math.max(0, pedido[t] ?? 0)]));
  const riscos: { grade: GradeDoRisco; camadas: number }[] = [];
  for (let passo = 0; passo < 100 && tamanhos.some((t) => restante[t]! > 0); passo++) {
    const maiorCamadas = Math.max(...tamanhos.map((t) => Math.floor(restante[t]! / folhas)));
    let melhor: { grade: Record<string, number>; camadas: number; pecas: number; roupas: number } | null = null;
    for (let n = maiorCamadas; n >= 1; n--) {
      const grade: Record<string, number> = Object.fromEntries(tamanhos.map((t) => [t, Math.floor(restante[t]! / (n * folhas))]));
      aparar(grade, restante, maximo, tamanhos);
      const roupas = tamanhos.reduce((s, t) => s + grade[t]!, 0);
      if (roupas === 0) continue;
      const pecas = n * folhas * roupas;
      if (!melhor || pecas > melhor.pecas || (pecas === melhor.pecas && roupas > melhor.roupas)) melhor = { grade, camadas: n, pecas, roupas };
    }
    if (!melhor) break;
    riscos.push({ grade: melhor.grade, camadas: melhor.camadas });
    for (const t of tamanhos) restante[t] = restante[t]! - melhor.camadas * folhas * melhor.grade[t]!;
  }
  // O que sobrou não fecha sem excedente (menos que uma camada de cada): uma camada a mais, em riscos de até
  // `maximo` roupas.
  const faltando = tamanhos.filter((t) => restante[t]! > 0);
  for (let i = 0; i < faltando.length; i += maximo) {
    const grade = Object.fromEntries(faltando.slice(i, i + maximo).map((t) => [t, 1]));
    riscos.push({ grade, camadas: Math.max(...Object.keys(grade).map((t) => Math.ceil(restante[t]! / folhas))) });
  }
  return { origem: `gulosa até ${maximo} roupa(s) por risco`, riscos: juntar(riscos, tamanhos) };
}

/**
 * As composições candidatas para a ordem: as proporcionais e as gulosas de 1 até `roupasPorRiscoMax` roupas por
 * risco, sem repetir composição igual.
 */
export function gerarComposicoes(
  pedido: Readonly<Record<string, number>>,
  tamanhos: readonly string[],
  folhasPorCamada: number,
  roupasPorRiscoMax: number,
): Composicao[] {
  const maximo = Math.max(1, Math.floor(roupasPorRiscoMax));
  const candidatas = [...proporcionais(pedido, tamanhos, folhasPorCamada, maximo)];
  for (let k = 1; k <= maximo; k++) candidatas.push(gulosa(pedido, tamanhos, folhasPorCamada, k));
  const vistas = new Set<string>();
  return candidatas.filter((c) => {
    const chave = c.riscos
      .map((r) => `${r.chave}×${r.camadas}`)
      .sort()
      .join(';');
    if (c.riscos.length === 0 || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/** As grades de todas as composições, sem repetir (cada uma vira um risco a fazer). */
export function gradesDasComposicoes(composicoes: readonly Composicao[]): RiscoDaComposicao[] {
  const porChave = new Map<string, RiscoDaComposicao>();
  for (const c of composicoes) for (const r of c.riscos) if (!porChave.has(r.chave)) porChave.set(r.chave, r);
  return [...porChave.values()];
}

/** A produção de cada tamanho com a composição: camadas × folhas × roupas da grade, somadas. */
export function producaoDaComposicao(riscos: readonly RiscoDaComposicao[], tamanhos: readonly string[], folhasPorCamada: number): Record<string, number> {
  return Object.fromEntries(tamanhos.map((t) => [t, riscos.reduce((s, r) => s + r.camadas * folhasPorCamada * (r.grade[t] ?? 0), 0)]));
}
