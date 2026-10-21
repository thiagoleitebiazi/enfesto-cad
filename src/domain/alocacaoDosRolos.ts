/**
 * Onde cada camada sai de cada rolo, ao longo do comprimento dele. As medidas são do começo do rolo (como ele
 * entrou no estoque), em mm.
 *
 * - O que já foi usado (consumido, ou reservado por outros planos) conta a partir do começo do rolo.
 * - A perda por rolo é metade no começo e metade no fim.
 * - Um defeito com posição é um trecho proibido: a camada que passaria por ele começa depois dele (o que fica entre
 *   o fim da camada anterior e o fim do defeito é perda por defeito).
 * - Um defeito sem posição não é evitado: o comprimento dele sai do fim do rolo (e o plano avisa que ele pode cair
 *   numa camada).
 * - Emenda: só se permitida. Quando o rolo acaba no meio de uma camada, ela pode continuar no rolo seguinte, numa
 *   linha de emenda do risco (uma posição em que nenhuma peça é cortada), com a sobreposição configurada; o que
 *   sobra do rolo depois da linha é perda. Sem linhas de emenda (risco informado à mão), não há emenda.
 * - Cada camada sai inteira de um rolo, ou de dois rolos com uma emenda; nunca de três.
 */

export interface RoloParaAlocar {
  readonly id: string;
  readonly identificacao: string;
  readonly grupo: string;
  readonly comprimentoMm: number;
  readonly jaUsadoMm: number;
  readonly perdaPorRoloMm: number;
  /** Os trechos proibidos (defeitos com posição): [início, fim] do começo do rolo. */
  readonly defeitosComPosicao: ReadonlyArray<readonly [number, number]>;
  /** O comprimento dos defeitos sem posição (sai do fim do rolo). */
  readonly defeitosSemPosicaoMm: number;
  /** As chaves dos riscos em que o rolo cabe (pela largura). */
  readonly serveParaRiscos: readonly string[];
}

export interface RiscoParaAlocar {
  readonly chave: string;
  readonly camadas: number;
  /** O que uma camada gasta: o risco mais as pontas. */
  readonly consumoMm: number;
  /** As posições, a partir do começo da camada, em que dá para emendar (nenhuma peça cortada); `null`: nenhuma conhecida. */
  readonly linhasDeEmenda: readonly number[] | null;
}

export interface OpcoesDaAlocacao {
  readonly permitirEmendas: boolean;
  readonly sobreposicaoDaEmendaMm: number;
}

export interface TrechoDaCamada {
  readonly roloId: string;
  readonly inicioMm: number;
  readonly fimMm: number;
}

export interface CamadaAlocada {
  readonly chave: string;
  readonly trechos: readonly TrechoDaCamada[];
  /** A emenda da camada (quando saiu de dois rolos). */
  readonly emenda?: { readonly posicaoNaCamadaMm: number; readonly sobreposicaoMm: number; readonly roloDe: string; readonly roloPara: string };
}

export interface UsoDoRoloNaAlocacao {
  readonly roloId: string;
  readonly camadasPorRisco: Readonly<Record<string, number>>;
  /** O que as camadas usam do rolo (com as sobreposições das emendas). */
  readonly usadoMm: number;
  /** O que se perdeu pulando os defeitos com posição (o defeito e o trecho antes dele que não deu camada). */
  readonly perdaPorDefeitoMm: number;
  /** O que sobrou no fim do rolo, que não deu outra camada (nem emenda). */
  readonly pontaMm: number;
  readonly emendas: number;
}

export interface Alocacao {
  readonly camadas: readonly CamadaAlocada[];
  /** As camadas de cada risco que não couberam no material. */
  readonly faltando: Readonly<Record<string, number>>;
  readonly porRolo: readonly UsoDoRoloNaAlocacao[];
}

interface Estado {
  readonly rolo: RoloParaAlocar;
  readonly inicio: number;
  readonly fim: number;
  cursor: number;
  usado: number;
  perdaPorDefeito: number;
  emendas: number;
  readonly camadasPorRisco: Record<string, number>;
}

/** O primeiro lugar, de `desde` em diante, onde cabe um trecho de `comprimento` sem passar por um defeito; ou `null`. */
function lugarLivre(e: Estado, desde: number, comprimento: number): number | null {
  let p = Math.max(desde, e.inicio);
  for (;;) {
    if (p + comprimento > e.fim + 1e-6) return null;
    const defeito = e.rolo.defeitosComPosicao.find(([a, b]) => a < p + comprimento - 1e-9 && b > p + 1e-9);
    if (!defeito) return p;
    p = defeito[1];
  }
}

/** O trecho livre de defeito que começa em `desde` (ou depois do defeito em que ele cai): [início, fim]. */
function trechoLivre(e: Estado, desde: number): readonly [number, number] | null {
  let p = Math.max(desde, e.inicio);
  for (;;) {
    if (p >= e.fim - 1e-6) return null;
    const dentro = e.rolo.defeitosComPosicao.find(([a, b]) => a <= p + 1e-9 && b > p + 1e-9);
    if (!dentro) break;
    p = dentro[1];
  }
  const proximo = e.rolo.defeitosComPosicao.filter(([a]) => a > p + 1e-9).reduce((m, [a]) => Math.min(m, a), e.fim);
  return [p, proximo];
}

export function alocarCamadas(rolos: readonly RoloParaAlocar[], riscos: readonly RiscoParaAlocar[], opcoes: OpcoesDaAlocacao): Alocacao {
  const estados: Estado[] = rolos.map((rolo) => {
    const inicio = Math.max(rolo.jaUsadoMm, rolo.perdaPorRoloMm / 2);
    const fim = Math.max(inicio, rolo.comprimentoMm - rolo.perdaPorRoloMm / 2 - rolo.defeitosSemPosicaoMm);
    return { rolo, inicio, fim, cursor: inicio, usado: 0, perdaPorDefeito: 0, emendas: 0, camadasPorRisco: {} };
  });
  const camadas: CamadaAlocada[] = [];
  const faltando: Record<string, number> = {};
  const avancar = (e: Estado, ate: number): void => {
    // O que se pula por causa de um defeito é perda por defeito.
    if (ate > e.cursor) e.perdaPorDefeito += ate - e.cursor;
    e.cursor = ate;
  };
  for (const risco of riscos) {
    const servem = estados.filter((e) => e.rolo.serveParaRiscos.includes(risco.chave));
    let i = 0;
    for (let n = 0; n < risco.camadas; n++) {
      let alocada: CamadaAlocada | null = null;
      while (!alocada && i < servem.length) {
        const e = servem[i]!;
        const p = lugarLivre(e, e.cursor, risco.consumoMm);
        if (p !== null) {
          avancar(e, p);
          e.cursor = p + risco.consumoMm;
          e.usado += risco.consumoMm;
          e.camadasPorRisco[risco.chave] = (e.camadasPorRisco[risco.chave] ?? 0) + 1;
          alocada = { chave: risco.chave, trechos: [{ roloId: e.rolo.id, inicioMm: p, fimMm: p + risco.consumoMm }] };
          break;
        }
        // Não cabe inteira no que resta do rolo: emenda no seguinte, se permitida e se há linha de emenda.
        const trecho = trechoLivre(e, e.cursor);
        const seguinte = servem[i + 1];
        if (opcoes.permitirEmendas && risco.linhasDeEmenda && trecho && trecho[1] >= e.fim - 1e-6 && seguinte) {
          const disponivel = trecho[1] - trecho[0];
          const linha = risco.linhasDeEmenda.filter((s) => s > 0 && s <= disponivel + 1e-9).reduce((m, s) => Math.max(m, s), 0);
          if (linha > 0) {
            const resto = risco.consumoMm - linha + opcoes.sobreposicaoDaEmendaMm;
            const p2 = lugarLivre(seguinte, seguinte.cursor, resto);
            if (p2 !== null) {
              // O rolo vai até a linha de emenda; o que fica depois dela é ponta (ainda serve a uma camada mais curta).
              avancar(e, trecho[0]);
              e.usado += linha;
              e.cursor = trecho[0] + linha;
              e.emendas += 1;
              avancar(seguinte, p2);
              seguinte.cursor = p2 + resto;
              seguinte.usado += resto;
              seguinte.camadasPorRisco[risco.chave] = (seguinte.camadasPorRisco[risco.chave] ?? 0) + 1;
              alocada = {
                chave: risco.chave,
                trechos: [
                  { roloId: e.rolo.id, inicioMm: trecho[0], fimMm: trecho[0] + linha },
                  { roloId: seguinte.rolo.id, inicioMm: p2, fimMm: p2 + resto },
                ],
                emenda: { posicaoNaCamadaMm: linha, sobreposicaoMm: opcoes.sobreposicaoDaEmendaMm, roloDe: e.rolo.id, roloPara: seguinte.rolo.id },
              };
              i++;
              break;
            }
          }
        }
        i++;
      }
      if (alocada) camadas.push(alocada);
      else faltando[risco.chave] = (faltando[risco.chave] ?? 0) + 1;
    }
  }
  return {
    camadas,
    faltando,
    porRolo: estados.map((e) => ({
      roloId: e.rolo.id,
      camadasPorRisco: e.camadasPorRisco,
      usadoMm: e.usado,
      perdaPorDefeitoMm: e.perdaPorDefeito,
      pontaMm: Math.max(0, e.fim - e.cursor),
      emendas: e.emendas,
    })),
  };
}

/**
 * As linhas de emenda de um risco: as posições, ao longo dele, em que uma reta de lado a lado não corta nenhuma
 * peça (os vãos entre as peças no comprimento). Fica uma por vão, no começo dele (a primeira posição livre).
 */
export function linhasDeEmendaDoRisco(pecas: ReadonlyArray<{ readonly contorno: ReadonlyArray<{ readonly y: number }> }>, comprimentoMm: number): number[] {
  const faixas = pecas
    .map((p) => [Math.min(...p.contorno.map((q) => q.y)), Math.max(...p.contorno.map((q) => q.y))] as const)
    .sort((a, b) => a[0] - b[0]);
  const linhas: number[] = [];
  let ate = 0;
  for (const [a, b] of faixas) {
    if (a > ate + 1e-6 && ate > 0) linhas.push(ate);
    ate = Math.max(ate, b);
  }
  return linhas.filter((y) => y > 0 && y < comprimentoMm);
}
