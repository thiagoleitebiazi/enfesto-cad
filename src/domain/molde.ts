import type { Contorno, Ponto2D } from '../core/geometria';
import { retanguloEnvolvente, area } from '../core/geometria';

/**
 * Regra crítica (seção 5 do escopo): por padrão nenhuma rotação que altere a
 * orientação em relação ao fio é permitida. 180° e 90°/270° são liberados
 * apenas quando o usuário autoriza explicitamente, por molde.
 */
export interface RestricaoDeRotacao {
  readonly permite180: boolean;
  readonly permite90e270: boolean;
}

export const RESTRICAO_PADRAO: RestricaoDeRotacao = {
  permite180: false,
  permite90e270: false,
};

/** Seta do sentido do fio: de `inicio` para `fim`, em mm no espaço do molde. */
export interface LinhaDeFio {
  readonly inicio: Ponto2D;
  readonly fim: Ponto2D;
}

export interface Molde {
  readonly id: string;
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly linhasInternas: readonly Contorno[];
  readonly linhaDeFio: LinhaDeFio;
  readonly quantidade: number;
  readonly restricaoDeRotacao: RestricaoDeRotacao;
}

export interface DadosDeNovoMolde {
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly linhaDeFio: LinhaDeFio;
  readonly quantidade?: number;
  readonly linhasInternas?: readonly Contorno[];
  readonly restricaoDeRotacao?: RestricaoDeRotacao;
}

/** Constrói um molde válido ou lança erro — usar apenas com dados já conferidos (ex.: vindos de importação já validada). */
export function criarMolde(dados: DadosDeNovoMolde, id: string): Molde {
  if (dados.contorno.length < 3) {
    throw new Error(`Molde "${dados.nome}" precisa de um contorno com ao menos 3 pontos.`);
  }
  if (area(dados.contorno) <= 0) {
    throw new Error(`Molde "${dados.nome}" possui contorno degenerado (área zero).`);
  }
  if (!Number.isFinite(dados.quantidade ?? 1) || (dados.quantidade ?? 1) < 1) {
    throw new Error(`Molde "${dados.nome}" precisa de quantidade >= 1.`);
  }
  return {
    id,
    nome: dados.nome,
    referencia: dados.referencia,
    tamanho: dados.tamanho,
    contorno: dados.contorno,
    linhasInternas: dados.linhasInternas ?? [],
    linhaDeFio: dados.linhaDeFio,
    quantidade: dados.quantidade ?? 1,
    restricaoDeRotacao: dados.restricaoDeRotacao ?? RESTRICAO_PADRAO,
  };
}

export interface DimensoesDoMolde {
  readonly larguraMm: number;
  readonly alturaMm: number;
  readonly areaMm2: number;
}

export function dimensoesDoMolde(molde: Molde): DimensoesDoMolde {
  const bbox = retanguloEnvolvente(molde.contorno);
  return { larguraMm: bbox.largura, alturaMm: bbox.altura, areaMm2: area(molde.contorno) };
}

/** Ângulo da seta do fio em graus, 0° = apontando para +x (direita), sentido anti-horário positivo. */
export function anguloDaLinhaDeFio(fio: LinhaDeFio): number {
  const dx = fio.fim.x - fio.inicio.x;
  const dy = fio.fim.y - fio.inicio.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function normalizarAngulo(anguloGraus: number): number {
  const normalizado = anguloGraus % 360;
  return normalizado < 0 ? normalizado + 360 : normalizado;
}

/** Lista as rotações (em graus, relativas à orientação original) que a restrição do molde permite. */
export function rotacoesPermitidas(restricao: RestricaoDeRotacao): readonly number[] {
  const permitidas = [0];
  if (restricao.permite180) permitidas.push(180);
  if (restricao.permite90e270) permitidas.push(90, 270);
  return permitidas.sort((a, b) => a - b);
}

/** Verdadeiro se `anguloGraus` (rotação proposta, qualquer valor) corresponde a uma das rotações permitidas. */
export function rotacaoEhPermitida(restricao: RestricaoDeRotacao, anguloGraus: number): boolean {
  const alvo = normalizarAngulo(anguloGraus);
  return rotacoesPermitidas(restricao).some((permitida) => Math.abs(permitida - alvo) < 1e-6);
}
