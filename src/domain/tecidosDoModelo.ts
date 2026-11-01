import { retanguloEnvolvente } from '../core/geometria';
import type { AjusteDoTecido, ConfiguracaoDeEnfesto } from './enfesto';
import { moverParaForaDoEnfesto } from './encaixeManual';
import { comGrupoDoEncaixe } from './gruposDoEncaixe';
import { linhaDeCorteDaPeca, rotacionarMolde, type Molde } from './molde';

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
  /** Com o tecido ativo (ADR 0209), os outros tecidos têm o encaixe deles: ficam onde estão. */
  readonly manterOutrosTecidos?: boolean;
}

export interface PecasDoEncaixe {
  readonly paraEncaixar: readonly Molde[];
  readonly fixas: readonly Molde[];
  /** As que não entram neste encaixe: saem da mesa quando ele for aplicado. */
  readonly foraDoEncaixe: readonly Molde[];
  /** As dos outros tecidos, que ficam como estão. */
  readonly deOutrosTecidos: readonly Molde[];
}

export const estaNaMesa = (peca: Molde, enfesto: Pick<ConfiguracaoDeEnfesto, 'comprimentoMm'>): boolean => retanguloEnvolvente(linhaDeCorteDaPeca(peca)).minY < enfesto.comprimentoMm;

export function separarParaOEncaixe(pecas: readonly Molde[], escolha: EscolhaDoEncaixe, enfesto: Pick<ConfiguracaoDeEnfesto, 'comprimentoMm'>): PecasDoEncaixe {
  const fixas = pecas.filter((p) => escolha.idsFixos?.has(p.id));
  const resto = pecas.filter((p) => !escolha.idsFixos?.has(p.id));
  const entra = (p: Molde): boolean => !p.naoUsar && (escolha.tecido === undefined || tecidoDaPeca(p) === escolha.tecido) && (!escolha.somenteNaMesa || estaNaMesa(p, enfesto));
  const deOutro = (p: Molde): boolean => escolha.manterOutrosTecidos === true && escolha.tecido !== undefined && tecidoDaPeca(p) !== escolha.tecido;
  return { paraEncaixar: resto.filter(entra), fixas, foraDoEncaixe: resto.filter((p) => !entra(p) && !deOutro(p)), deOutrosTecidos: resto.filter(deOutro) };
}

/** O que vai para o risco: a peça deixada depois do fim da mesa está fora do encaixe, e não sai (ADR 0218). */
export function pecasDoRisco(pecas: readonly Molde[], enfesto: Pick<ConfiguracaoDeEnfesto, 'comprimentoMm'> | null): readonly Molde[] {
  return enfesto ? pecas.filter((p) => estaNaMesa(p, enfesto)) : pecas;
}

/** As peças do tecido ativo (ADR 0209): em branco, todas. */
export function pecasDoTecido(pecas: readonly Molde[], tecido: string): readonly Molde[] {
  return tecido === '' ? pecas : pecas.filter((p) => tecidoDaPeca(p) === tecido);
}

/** A mesa do tecido: o mesmo enfesto, com a largura dele e o que mais for próprio dele. */
export function enfestoDoTecido(enfesto: ConfiguracaoDeEnfesto, tecido: string): ConfiguracaoDeEnfesto {
  const largura = enfesto.largurasPorTecido?.[tecido];
  const ajuste = enfesto.ajustesPorTecido?.[tecido];
  if ((largura === undefined || largura === enfesto.larguraUtilMm) && !ajuste) return enfesto;
  return { ...enfesto, ...(largura !== undefined ? { larguraUtilMm: largura } : {}), ...ajuste };
}

/** Grava o que mudou na mesa à vista: na do tecido ativo, ou na do projeto, se forem todos (ADR 0221). */
export function comAjusteDoTecido(enfesto: ConfiguracaoDeEnfesto, tecido: string, ajuste: AjusteDoTecido): ConfiguracaoDeEnfesto {
  if (tecido === '') return { ...enfesto, ...ajuste };
  return { ...enfesto, ajustesPorTecido: { ...enfesto.ajustesPorTecido, [tecido]: { ...enfesto.ajustesPorTecido?.[tecido], ...ajuste } } };
}

export function comLarguraDoTecido(enfesto: ConfiguracaoDeEnfesto, tecido: string, larguraMm: number): ConfiguracaoDeEnfesto {
  return { ...enfesto, largurasPorTecido: { ...enfesto.largurasPorTecido, [tecido]: larguraMm } };
}

/** As peças mudadas numa ferramenta do tecido ativo, de volta na lista inteira. */
export function comPecasMudadas(pecas: readonly Molde[], mudadas: readonly Molde[]): Molde[] {
  const porId = new Map(mudadas.map((p) => [p.id, p]));
  return pecas.map((p) => porId.get(p.id) ?? p);
}

/** O enfesto com as peças fixas no caminho: o encaixe contorna a forma de cada uma, e pode usar os vãos dela (ADR 0221). */
export function enfestoComFixas(enfesto: ConfiguracaoDeEnfesto, fixas: readonly Molde[]): ConfiguracaoDeEnfesto {
  if (fixas.length === 0) return enfesto;
  return { ...enfesto, obstaculos: [...(enfesto.obstaculos ?? []), ...fixas.map((p) => linhaDeCorteDaPeca(p))] };
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

export type SentidoNoEncaixe = 'por-tamanho' | 'por-pacote';

const virada = (p: Molde): Molde => ({ ...rotacionarMolde(p, 180), anguloDeRotacaoGraus: p.anguloDeRotacaoGraus });

/**
 * "Sentido por tamanho" e "Sentido por pacote" (ADR 0202): no tecido de um sentido só, cada tamanho (ou cada pacote)
 * pode ir num sentido, desde que fique todo nele. Aqui uma parte já entra virada, e o encaixe segue sem girar 180°.
 */
export function comSentidoAlternado(pecas: readonly Molde[], modo: SentidoNoEncaixe, novoId: () => string): Molde[] {
  if (modo === 'por-tamanho') {
    const tamanhos = [...new Set(pecas.map((p) => p.tamanho))];
    return pecas.map((p) => (tamanhos.indexOf(p.tamanho) % 2 === 1 ? virada(p) : p));
  }
  return pecas.flatMap((p) => {
    const metade = Math.floor(p.quantidade / 2);
    if (metade === 0) return [p];
    return [{ ...p, quantidade: p.quantidade - metade }, { ...virada(p), id: novoId(), quantidade: metade }];
  });
}
