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

export interface ConfiguracaoBase {
  readonly larguraUtilMm: number;
  readonly comprimentoMm: number;
  readonly quantidadeDeCamadas: number;
  readonly margemLateralMm: number;
  readonly margemDeExtremidadeMm: number;
  /** Distância mínima exigida entre os contornos de duas peças quaisquer (seção 6). */
  readonly distanciaMinimaEntrePecasMm: number;
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
