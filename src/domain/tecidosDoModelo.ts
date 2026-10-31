import { retanguloEnvolvente } from '../core/geometria';
import { areaUtilDaMesa, type ConfiguracaoDeEnfesto, type ZonaBloqueada } from './enfesto';
import { moverParaForaDoEnfesto } from './encaixeManual';
import { comGrupoDoEncaixe } from './gruposDoEncaixe';
import { linhaDeCorteDaPeca, type Molde } from './molde';

/**
 * Os tecidos de um modelo (ADR 0194): no manual do encaixe da referência, cada molde diz o tecido dele (principal,
 * contraste, forro, entretela), e o encaixe automático gera um tecido por vez, ou todos. As outras peças saem da mesa
 * enquanto isso, e as que se pediu para manter ficam onde estão, como áreas que o encaixe não usa.
 */

export const TECIDO_PRINCIPAL = 'Principal';

/** Na janela do encaixe: todos os tecidos no mesmo risco, cada um num trecho. */
export const TODOS_EM_TRECHOS = '*trechos';

export const tecidoDaPeca = (peca: Molde): string => peca.tecidoDoMolde?.trim() || TECIDO_PRINCIPAL;

/** Os tecidos das peças, na ordem em que aparecem, com o principal na frente. */
export function tecidosDoModelo(pecas: readonly Molde[]): string[] {
  const nomes = [...new Set(pecas.map(tecidoDaPeca))];
  return nomes.includes(TECIDO_PRINCIPAL) ? [TECIDO_PRINCIPAL, ...nomes.filter((n) => n !== TECIDO_PRINCIPAL)] : nomes;
}

export interface EscolhaDoEncaixe {
  /** Só um tecido; ausente, todos. */
  readonly tecido?: string;
  /** "Manter peças encaixadas": estas ficam onde estão. */
  readonly idsFixos?: ReadonlySet<string>;
  /** "Usar somente peças encaixadas": as que estão fora da mesa não entram. */
  readonly somenteNaMesa?: boolean;
}

export interface PecasDoEncaixe {
  readonly paraEncaixar: readonly Molde[];
  readonly fixas: readonly Molde[];
  /** As que não entram neste encaixe: saem da mesa quando ele for aplicado. */
  readonly foraDoEncaixe: readonly Molde[];
}

const estaNaMesa = (peca: Molde, enfesto: Pick<ConfiguracaoDeEnfesto, 'comprimentoMm'>): boolean => retanguloEnvolvente(linhaDeCorteDaPeca(peca)).minY < enfesto.comprimentoMm;

export function separarParaOEncaixe(pecas: readonly Molde[], escolha: EscolhaDoEncaixe, enfesto: Pick<ConfiguracaoDeEnfesto, 'comprimentoMm'>): PecasDoEncaixe {
  const fixas = pecas.filter((p) => escolha.idsFixos?.has(p.id));
  const resto = pecas.filter((p) => !escolha.idsFixos?.has(p.id));
  const entra = (p: Molde): boolean => (escolha.tecido === undefined || tecidoDaPeca(p) === escolha.tecido) && (!escolha.somenteNaMesa || estaNaMesa(p, enfesto));
  return { paraEncaixar: resto.filter(entra), fixas, foraDoEncaixe: resto.filter((p) => !entra(p)) };
}

/** O enfesto com o lugar das peças fixas bloqueado: a caixa de cada uma. */
export function enfestoComFixas(enfesto: ConfiguracaoDeEnfesto, fixas: readonly Molde[]): ConfiguracaoDeEnfesto {
  if (fixas.length === 0) return enfesto;
  const zonas: ZonaBloqueada[] = fixas.map((p) => {
    const c = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    return { minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY };
  });
  return { ...enfesto, zonasBloqueadas: [...(enfesto.zonasBloqueadas ?? []), ...zonas] };
}

/** Todos os tecidos no mesmo risco: cada um vira um grupo do encaixe, e sai num trecho da mesa. */
export function comUmTrechoPorTecido(pecas: readonly Molde[]): Molde[] {
  return pecas.map((p) => comGrupoDoEncaixe(p, tecidoDaPeca(p)));
}

/** "Usar espelhamento de peças": todas podem sair espelhadas neste encaixe. */
export function comEspelhamentoPermitido(pecas: readonly Molde[]): Molde[] {
  return pecas.map((p) => ({ ...p, restricaoDeRotacao: { ...p.restricaoDeRotacao, permiteEspelhamento: true } }));
}

/** As peças do encaixe, as fixas no lugar delas, e as que não entraram, depois do fim da mesa. */
export function juntarAoEncaixe(colocadas: readonly Molde[], fixas: readonly Molde[], foraDoEncaixe: readonly Molde[], enfesto: ConfiguracaoDeEnfesto | null): Molde[] {
  const todas = [...colocadas, ...fixas, ...foraDoEncaixe];
  if (foraDoEncaixe.length === 0 || !enfesto) return todas;
  return moverParaForaDoEnfesto(todas, new Set(foraDoEncaixe.map((p) => p.id)), enfesto);
}

/** Quanto da largura as peças têm a ocupar: serve à conferência de que a mesa comporta o tecido escolhido. */
export function larguraUtilDoEncaixe(enfesto: ConfiguracaoDeEnfesto): number {
  const u = areaUtilDaMesa(enfesto);
  return u.maxX - u.minX;
}
