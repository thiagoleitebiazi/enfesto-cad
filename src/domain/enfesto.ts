import type { Contorno } from '../core/geometria';
/**
 * Tipos de enfesto (seção 4 do escopo). Cinco modalidades, cada uma com
 * configuração própria — nenhuma é tratada como equivalente a outra
 * (especialmente Ramado, que o escopo pede explicitamente para não ser
 * presumido equivalente a Tubular).
 *
 * Onde uma regra industrial dependeria de um comportamento que este projeto
 * não tem base firme para presumir (ex.: nuances específicas de "ramado"
 * além dos parâmetros que o próprio escopo lista), o parâmetro é exposto
 * como configuração em vez de embutido como lógica adivinhada — ver ADR 0003.
 */

export type TipoDeEnfesto = 'par' | 'impar' | 'zigue-zague' | 'tubular' | 'ramado';

/** A distância entre os moldes, de linha de corte a linha de corte, de um projeto novo (mm). */
export const DISTANCIA_PADRAO_ENTRE_PECAS_MM = 3;

/**
 * A margem de segurança da mesa (mm): nenhuma peça chega mais perto que isto de nenhuma borda da mesa, qualquer que
 * seja a margem configurada (pedido do usuário, ADR 0091).
 */
export const MARGEM_DE_SEGURANCA_DA_MESA_MM = 4;

/**
 * As margens que valem na mesa: as configuradas, nunca menos que a de segurança. Os projetos de antes, gravados com
 * margem zero, abrem como estão — a margem de segurança vale do mesmo jeito.
 */
export function margensDaMesa(enfesto: Pick<ConfiguracaoBase, 'margemLateralMm' | 'margemDeExtremidadeMm'>): { readonly lateralMm: number; readonly extremidadeMm: number } {
  return {
    lateralMm: Math.max(enfesto.margemLateralMm, MARGEM_DE_SEGURANCA_DA_MESA_MM),
    extremidadeMm: Math.max(enfesto.margemDeExtremidadeMm, MARGEM_DE_SEGURANCA_DA_MESA_MM),
  };
}

/** A área da mesa em que as peças podem ficar (mm): a mesa menos as margens que valem, nos quatro lados. */
export function areaUtilDaMesa(enfesto: Pick<ConfiguracaoBase, 'larguraUtilMm' | 'comprimentoMm' | 'margemLateralMm' | 'margemDeExtremidadeMm'>): {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
} {
  const { lateralMm, extremidadeMm } = margensDaMesa(enfesto);
  return { minX: lateralMm, maxX: enfesto.larguraUtilMm - lateralMm, minY: extremidadeMm, maxY: enfesto.comprimentoMm - extremidadeMm };
}

/** Uma área da mesa onde não entra peça (ADR 0160): o enfesto em escada, uma emenda, um defeito. Em mm, na mesa. */
export interface ZonaBloqueada {
  /** Na largura. */
  readonly minX: number;
  readonly maxX: number;
  /** No comprimento. */
  readonly minY: number;
  readonly maxY: number;
}

/** Um texto no risco (ADR 0165): "emenda aqui", "cortar primeiro". No comprimento e na largura da mesa, em mm. */
export interface TextoNoRisco {
  readonly x: number;
  readonly y: number;
  readonly texto: string;
}

export interface ConfiguracaoBase {
  readonly larguraUtilMm: number;
  readonly comprimentoMm: number;
  readonly quantidadeDeCamadas: number;
  readonly margemLateralMm: number;
  readonly margemDeExtremidadeMm: number;
  /** Distância mínima exigida entre os contornos de duas peças quaisquer (seção 6). */
  readonly distanciaMinimaEntrePecasMm: number;
  readonly zonasBloqueadas?: readonly ZonaBloqueada[];
  /** Os textos livres no risco (ADR 0165). */
  readonly textosNoRisco?: readonly TextoNoRisco[];
  /** A padronagem do tecido, na área de encaixe, e a cor de preenchimento das peças (ADR 0187). */
  readonly padronagem?: { readonly imagem: string; readonly comprimentoMm: number };
  readonly corDoTecido?: string;
  /** Os pontos de emenda do tecido, no comprimento (mm; ADR 0188). */
  readonly emendasMm?: readonly number[];
}

export interface ConfiguracaoPar extends ConfiguracaoBase {
  readonly tipo: 'par';
}

export interface ConfiguracaoImpar extends ConfiguracaoBase {
  readonly tipo: 'impar';
}

export interface ConfiguracaoZigueZague extends ConfiguracaoBase {
  readonly tipo: 'zigue-zague';
}

export interface ConfiguracaoTubular extends ConfiguracaoBase {
  readonly tipo: 'tubular';
  readonly larguraDoTuboMm: number;
}

export interface ConfiguracaoRamado extends ConfiguracaoBase {
  readonly tipo: 'ramado';
  readonly alinhamentoDasBordas: 'alinhado' | 'escalonado';
  readonly sentidoDeAlimentacao: 'unico' | 'alternado';
}

export type ConfiguracaoDeEnfesto =
  | ConfiguracaoPar
  | ConfiguracaoImpar
  | ConfiguracaoZigueZague
  | ConfiguracaoTubular
  | ConfiguracaoRamado;

export const ROTULO_DO_TIPO: Record<TipoDeEnfesto, string> = {
  par: 'Par',
  impar: 'Ímpar',
  'zigue-zague': 'Zigue-zague',
  tubular: 'Tubular',
  ramado: 'Ramado',
};

function validarBase(config: ConfiguracaoBase, nomeDoTipo: string): void {
  if (!Number.isFinite(config.larguraUtilMm) || config.larguraUtilMm <= 0) {
    throw new Error(`Enfesto ${nomeDoTipo}: largura útil precisa ser > 0.`);
  }
  if (!Number.isFinite(config.comprimentoMm) || config.comprimentoMm <= 0) {
    throw new Error(`Enfesto ${nomeDoTipo}: comprimento precisa ser > 0.`);
  }
  if (!Number.isInteger(config.quantidadeDeCamadas) || config.quantidadeDeCamadas < 1) {
    throw new Error(`Enfesto ${nomeDoTipo}: quantidade de camadas precisa ser um inteiro >= 1.`);
  }
  if (!Number.isFinite(config.margemLateralMm) || config.margemLateralMm < 0) {
    throw new Error(`Enfesto ${nomeDoTipo}: margem lateral precisa ser >= 0.`);
  }
  if (!Number.isFinite(config.margemDeExtremidadeMm) || config.margemDeExtremidadeMm < 0) {
    throw new Error(`Enfesto ${nomeDoTipo}: margem de extremidade precisa ser >= 0.`);
  }
  if (!Number.isFinite(config.distanciaMinimaEntrePecasMm) || config.distanciaMinimaEntrePecasMm < 0) {
    throw new Error(`Enfesto ${nomeDoTipo}: distância mínima entre peças precisa ser >= 0.`);
  }
}

export function criarConfiguracaoDeEnfesto(config: ConfiguracaoDeEnfesto): ConfiguracaoDeEnfesto {
  validarBase(config, ROTULO_DO_TIPO[config.tipo]);
  if (config.tipo === 'tubular') {
    if (!Number.isFinite(config.larguraDoTuboMm) || config.larguraDoTuboMm <= 0) {
      throw new Error('Enfesto Tubular: largura do tubo precisa ser > 0.');
    }
    if (config.larguraDoTuboMm < config.larguraUtilMm) {
      throw new Error('Enfesto Tubular: largura do tubo não pode ser menor que a largura útil declarada.');
    }
  }
  return config;
}

/**
 * Camadas de tecido físicas por camada de enfesto ("pass"). Par e Tubular
 * dobram o tecido (bolt dobrado ao meio / tubo achatado), então cada camada
 * de enfesto corresponde a 2 espessuras físicas de tecido. Os demais tipos
 * são enfesto aberto (1 espessura por camada).
 */
export function espessurasFisicasPorCamada(tipo: TipoDeEnfesto): 1 | 2 {
  return tipo === 'par' || tipo === 'tubular' ? 2 : 1;
}

/** Os pontos de emenda escritos num campo: números separados por espaço, em ordem. */
export function lerPontosDeEmenda(texto: string): number[] {
  return texto
    .split(/[\s;]+/)
    .filter((s) => s !== '')
    .map((s) => Number(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

/** O enfesto para o encaixe: cada emenda é uma faixa estreita da largura toda, que nenhuma peça atravessa. */
export function enfestoComEmendas(enfesto: ConfiguracaoDeEnfesto): ConfiguracaoDeEnfesto {
  const emendas = enfesto.emendasMm ?? [];
  if (emendas.length === 0) return enfesto;
  return { ...enfesto, zonasBloqueadas: [...(enfesto.zonasBloqueadas ?? []), ...emendas.map((e) => ({ minX: 0, maxX: enfesto.larguraUtilMm, minY: e - 1, maxY: e + 1 }))] };
}

/** Onde o tecido dobra: ao longo do comprimento, no par e no tubular; nas pontas da mesa, no zigue-zague (ADR 0180). */
export type DobraDoTecido = 'horizontal' | 'vertical';

export function dobraDoEnfesto(tipo: TipoDeEnfesto): DobraDoTecido | null {
  if (tipo === 'par' || tipo === 'tubular') return 'horizontal';
  return tipo === 'zigue-zague' ? 'vertical' : null;
}

export type OrientacaoDaCamada = 'normal' | 'invertida';

/**
 * Orientação da face do tecido na camada de índice `indice` (0-based).
 * Só o Zigue-zague alterna de verdade (é a definição do enfesto contínuo de
 * ida-e-volta sem cortar entre camadas); os demais tipos mantêm a mesma
 * face em todas as camadas.
 */
export function orientacaoDaCamada(tipo: TipoDeEnfesto, indice: number): OrientacaoDaCamada {
  if (tipo === 'zigue-zague') {
    return indice % 2 === 0 ? 'normal' : 'invertida';
  }
  return 'normal';
}

/**
 * Verdadeiro se alguma camada terá orientação invertida — usado pela seção 5
 * para alertar quando o tecido é direcional/com pelo e o tipo de enfesto
 * escolhido (zigue-zague) inverteria a face em camadas alternadas.
 */
export function enfestoInverteFaceEmAlgumaCamada(config: ConfiguracaoDeEnfesto): boolean {
  if (config.tipo !== 'zigue-zague') return false;
  for (let i = 0; i < config.quantidadeDeCamadas; i++) {
    if (orientacaoDaCamada(config.tipo, i) === 'invertida') return true;
  }
  return false;
}

export const contornoDaZona = (z: ZonaBloqueada): Contorno => [
  { x: z.minX, y: z.minY },
  { x: z.maxX, y: z.minY },
  { x: z.maxX, y: z.maxY },
  { x: z.minX, y: z.maxY },
];

/** As áreas como aparecem no formulário: uma por linha, "comprimento de, até, largura de, até" (mm). */
export const textoDasZonas = (zonas: readonly ZonaBloqueada[]): string => zonas.map((z) => `${z.minY} ${z.maxY} ${z.minX} ${z.maxX}`).join('\n');

/** Lê as áreas do formulário; lança dizendo a linha que não serve. */
export function lerZonasBloqueadas(texto: string): ZonaBloqueada[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => {
      const n = l.replace(/,/g, '.').split(/[\s;]+/).map(Number);
      if (n.length !== 4 || !n.every((v) => Number.isFinite(v) && v >= 0) || !(n[0]! < n[1]!) || !(n[2]! < n[3]!)) {
        throw new Error(`Área bloqueada "${l}": use comprimento de, até, largura de, até, em mm (ex.: 0 800 900 1500).`);
      }
      return { minY: n[0]!, maxY: n[1]!, minX: n[2]!, maxX: n[3]! };
    });
}

/** Os textos como aparecem no formulário: uma linha por texto, "comprimento largura texto" (mm). */
export const textoDosTextosNoRisco = (textos: readonly TextoNoRisco[]): string => textos.map((t) => `${t.y} ${t.x} ${t.texto}`).join('\n');

/** Lê os textos do formulário; lança dizendo a linha que não serve. */
export function lerTextosNoRisco(texto: string): TextoNoRisco[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => {
      const m = /^(\d+(?:[.,]\d+)?)[\s;]+(\d+(?:[.,]\d+)?)[\s;]+(.+)$/.exec(l);
      if (!m) throw new Error(`Texto no risco "${l}": use comprimento, largura e o texto (ex.: 1200 300 Emenda aqui).`);
      return { y: Number(m[1]!.replace(',', '.')), x: Number(m[2]!.replace(',', '.')), texto: m[3]! };
    });
}
