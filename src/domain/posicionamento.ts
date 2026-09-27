import type { Molde } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import { contornosSeSobrepoem, distanciaEntreContornos, retanguloEnvolvente, transladarContorno, type Ponto2D } from '../core/geometria';

/**
 * Heurística de posicionamento "primeiro encaixe" (first-fit): varre a área
 * útil do enfesto da esquerda para a direita, de cima para baixo, e devolve
 * a primeira posição onde a peça não se sobrepõe a nenhuma outra e respeita
 * a distância mínima configurada. Usada pelo modo semiautomático (Etapa 6,
 * sugestão de posição para UMA peça de cada vez) e reaproveitável pelo
 * motor de nesting automático (Etapa 7) como bloco de construção.
 *
 * Não promete o ótimo — é um "primeiro que couber", reprodutível e barato.
 * Por segurança de desempenho, o número de posições candidatas testadas é
 * limitado (`maxTentativas`); se esgotado sem achar uma posição válida,
 * devolve `null` em vez de travar a interface.
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
  const bboxAlvo = retanguloEnvolvente(pecaAlvo.contorno);
  const minX = enfesto.margemLateralMm;
  const maxX = enfesto.larguraUtilMm - enfesto.margemLateralMm - bboxAlvo.largura;
  const minY = enfesto.margemDeExtremidadeMm;
  const maxY = enfesto.comprimentoMm - enfesto.margemDeExtremidadeMm - bboxAlvo.altura;

  if (maxX < minX || maxY < minY) return null;

  const distanciaMinima = enfesto.distanciaMinimaEntrePecasMm;
  let tentativas = 0;

  for (let y = minY; y <= maxY; y += passoMm) {
    for (let x = minX; x <= maxX; x += passoMm) {
      tentativas++;
      if (tentativas > maxTentativas) return null;

      const delta = { x: x - bboxAlvo.minX, y: y - bboxAlvo.minY };
      const contornoCandidato = transladarContorno(pecaAlvo.contorno, delta);

      const valido = outrasPecas.every((outra) => {
        if (contornosSeSobrepoem(contornoCandidato, outra.contorno)) return false;
        if (distanciaMinima > 0 && distanciaEntreContornos(contornoCandidato, outra.contorno) < distanciaMinima) {
          return false;
        }
        return true;
      });

      if (valido) return delta;
    }
  }
  return null;
}
