import type { TipoDeEnfesto } from './enfesto';
import type { Molde } from './molde';
import { sentidoUnicoDoTecido, type Tecido } from './tecido';

export interface SugestaoDoEnfesto {
  readonly tipo: TipoDeEnfesto;
  readonly motivo: string;
}

/**
 * A sugestão do método de enfesto (ADR 0204): a referência diz que o encaixe "sugere o método de enfesto mais
 * eficiente". Aqui são as regras da prática do corte, sem calcular cada método: o tubo só se enfesta como tubo; o tecido
 * de um sentido só não pode virar a cada camada; as peças em par saem do zigue-zague sem precisar de dois riscos.
 */
export function metodoSugerido(pecas: readonly Pick<Molde, 'emPar'>[], tecido: Tecido | null): SugestaoDoEnfesto {
  if (tecido?.tipoDeTecido === 'tubular') return { tipo: 'tubular', motivo: 'o tecido é tubular' };
  const sentido = sentidoUnicoDoTecido(tecido);
  if (sentido) return { tipo: 'impar', motivo: `o tecido ${sentido}: as camadas não podem virar` };
  if (pecas.some((p) => p.emPar)) return { tipo: 'zigue-zague', motivo: 'há peças em par: as camadas viradas dão direita e esquerda, e o tecido não é cortado nas pontas' };
  return { tipo: 'impar', motivo: 'o tecido não tem sentido e as peças não vão em par' };
}
