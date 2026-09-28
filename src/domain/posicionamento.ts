import type { Molde } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import {
  contornosSeSobrepoem,
  distanciaEntreContornos,
  retanguloEnvolvente,
  transladarContorno,
  type Contorno,
  type Ponto2D,
} from '../core/geometria';

export interface LimitesDeArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Primitiva compartilhada de "primeiro encaixe" (first-fit): varre os
 * limites informados da esquerda para a direita, de cima para baixo, e
 * devolve o primeiro DESLOCAMENTO (delta a somar ao contorno normalizado
 * recebido) onde ele não se sobrepõe a nenhum dos `contornosExistentes` e
 * respeita `distanciaMinima`. Usada tanto pela sugestão semiautomática de
 * uma peça (Etapa 6) quanto pelo motor de nesting automático (Etapa 7).
 *
 * Não promete o ótimo — é um "primeiro que couber", reprodutível e barato.
 * `maxTentativas` evita travar a interface em áreas muito grandes/passo
 * muito fino; esgotado sem achar uma posição válida, devolve `null`.
 */
export function encontrarPrimeiraPosicaoValida(
  contorno: Contorno,
  contornosExistentes: readonly Contorno[],
  limites: LimitesDeArea,
  distanciaMinima: number,
  passoMm: number,
  maxTentativas: number,
): Ponto2D | null {
  const bbox = retanguloEnvolvente(contorno);
  const maxXAjustado = limites.maxX - bbox.largura;
  const maxYAjustado = limites.maxY - bbox.altura;

  if (maxXAjustado < limites.minX || maxYAjustado < limites.minY) return null;

  let tentativas = 0;
  for (let y = limites.minY; y <= maxYAjustado; y += passoMm) {
    for (let x = limites.minX; x <= maxXAjustado; x += passoMm) {
      tentativas++;
      if (tentativas > maxTentativas) return null;

      const delta = { x: x - bbox.minX, y: y - bbox.minY };
      const contornoCandidato = transladarContorno(contorno, delta);

      const valido = contornosExistentes.every((existente) => {
        if (contornosSeSobrepoem(contornoCandidato, existente)) return false;
        if (distanciaMinima > 0 && distanciaEntreContornos(contornoCandidato, existente) < distanciaMinima) {
          return false;
        }
        return true;
      });

      if (valido) return delta;
    }
  }
  return null;
}

/**
 * Heurística de posicionamento para UMA peça já existente no projeto
 * (modo semiautomático, Etapa 6): sugere onde movê-la para não sobrepor as
 * demais peças do projeto, dentro da área útil do enfesto.
 *
 * Devolve um DESLOCAMENTO (delta a somar à posição atual da peça via
 * `transladarMolde`), não uma coordenada absoluta.
 */
export function sugerirPosicaoSemSobreposicao(
  pecaAlvo: Molde,
  outrasPecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  passoMm = 10,
  maxTentativas = 20000,
): Ponto2D | null {
  const limites: LimitesDeArea = {
    minX: enfesto.margemLateralMm,
    maxX: enfesto.larguraUtilMm - enfesto.margemLateralMm,
    minY: enfesto.margemDeExtremidadeMm,
    maxY: enfesto.comprimentoMm - enfesto.margemDeExtremidadeMm,
  };
  return encontrarPrimeiraPosicaoValida(
    pecaAlvo.contorno,
    outrasPecas.map((p) => p.contorno),
    limites,
    enfesto.distanciaMinimaEntrePecasMm,
    passoMm,
    maxTentativas,
  );
}
