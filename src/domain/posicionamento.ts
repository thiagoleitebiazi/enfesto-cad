import { linhaDeCorteDaPeca, transladarMolde, type Molde } from './molde';
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
 * Ao encostar a peça nas vizinhas, a distância fica pelo menos isto acima da mínima: as contas com vírgula não
 * a deixam um fio abaixo dela, e a validação não reclama da peça que o próprio encaixe pôs.
 */
export const FOLGA_DO_ENCOSTO_MM = 0.01;
/** Passos da busca que encosta a peça (dividindo o passo da grade ao meio a cada um): 10 mm / 2¹² ≈ 0,002 mm. */
const PASSOS_DO_ENCOSTO = 12;

interface Caixa {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function caixaDe(contorno: Contorno): Caixa {
  const r = retanguloEnvolvente(contorno);
  return { minX: r.minX, maxX: r.maxX, minY: r.minY, maxY: r.maxY };
}

/** As caixas estão mais longe que `d` uma da outra: os contornos dentro delas não se tocam nem chegam a `d`. */
function caixasMaisLongeQue(a: Caixa, b: Caixa, d: number): boolean {
  return a.minX - b.maxX > d || b.minX - a.maxX > d || a.minY - b.maxY > d || b.minY - a.maxY > d;
}

/** O contorno não se sobrepõe a nenhum dos existentes e fica a pelo menos `distanciaMinima` (+ `folga`) de cada um. */
function lugarLivre(
  contorno: Contorno,
  existentes: readonly Contorno[],
  caixasExistentes: readonly Caixa[],
  distanciaMinima: number,
  folga: number,
): boolean {
  const caixa = caixaDe(contorno);
  const exigida = distanciaMinima > 0 ? distanciaMinima + folga : 0;
  return existentes.every((existente, i) => {
    if (caixasMaisLongeQue(caixa, caixasExistentes[i]!, exigida)) return true;
    if (contornosSeSobrepoem(contorno, existente)) return false;
    if (distanciaMinima > 0 && distanciaEntreContornos(contorno, existente) < exigida) return false;
    return true;
  });
}

/**
 * Primitiva compartilhada de "primeiro encaixe" (first-fit): varre os
 * limites informados da esquerda para a direita, de cima para baixo, e
 * devolve o primeiro DESLOCAMENTO (delta a somar ao contorno normalizado
 * recebido) onde ele não se sobrepõe a nenhum dos `contornosExistentes` e
 * respeita `distanciaMinima`. Usada tanto pela sugestão semiautomática de
 * uma peça (Etapa 6) quanto pelo motor de nesting automático (Etapa 7).
 *
 * A varredura anda de `passoMm` em `passoMm` (10 mm), e o primeiro lugar
 * livre ficava até um passo inteiro longe das vizinhas: com 3 mm pedidos, as
 * peças ficavam a 3 a 13 mm umas das outras. Achado o lugar, a peça é
 * encostada — no comprimento, na largura e no comprimento de novo — até a
 * distância pedida (ver `encostar`).
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

  const caixasExistentes = contornosExistentes.map(caixaDe);
  let tentativas = 0;
  for (let y = limites.minY; y <= maxYAjustado; y += passoMm) {
    for (let x = limites.minX; x <= maxXAjustado; x += passoMm) {
      tentativas++;
      if (tentativas > maxTentativas) return null;

      const delta = { x: x - bbox.minX, y: y - bbox.minY };
      const contornoCandidato = transladarContorno(contorno, delta);

      if (lugarLivre(contornoCandidato, contornosExistentes, caixasExistentes, distanciaMinima, 0)) {
        return encostar(contorno, contornosExistentes, caixasExistentes, limites, distanciaMinima, passoMm, delta);
      }
    }
  }
  return null;
}

/**
 * Leva a peça, a partir de um lugar livre achado na grade, na direção do começo do comprimento (y) e da largura
 * (x), até ficar à distância mínima das vizinhas (com a `FOLGA_DO_ENCOSTO_MM`) ou no limite da área. Em cada
 * direção ela anda no máximo um passo da grade: o ponto um passo atrás é o que a varredura achou ocupado (ou o
 * limite), e o ponto certo entre os dois é achado pela metade, várias vezes. Nunca sai de um lugar livre para um
 * ocupado: se nada no caminho estiver livre, fica onde a grade a pôs.
 */
function encostar(
  contorno: Contorno,
  existentes: readonly Contorno[],
  caixasExistentes: readonly Caixa[],
  limites: LimitesDeArea,
  distanciaMinima: number,
  passoMm: number,
  delta: Ponto2D,
): Ponto2D {
  const caixa = retanguloEnvolvente(contorno);
  const livre = (d: Ponto2D): boolean =>
    lugarLivre(transladarContorno(contorno, d), existentes, caixasExistentes, distanciaMinima, FOLGA_DO_ENCOSTO_MM);
  let atual = delta;
  for (const eixo of ['y', 'x', 'y'] as const) {
    const menor = eixo === 'y' ? limites.minY - caixa.minY : limites.minX - caixa.minX;
    let ocupado = Math.max(menor, atual[eixo] - passoMm);
    let desocupado = atual[eixo];
    if (desocupado - ocupado <= 1e-9) continue;
    const em = (valor: number): Ponto2D => (eixo === 'y' ? { x: atual.x, y: valor } : { x: valor, y: atual.y });
    if (livre(em(ocupado))) {
      // Andou na outra direção e o caminho abriu: vai até o fim do passo.
      atual = em(ocupado);
      continue;
    }
    let achou = false;
    for (let i = 0; i < PASSOS_DO_ENCOSTO; i++) {
      const meio = (ocupado + desocupado) / 2;
      if (livre(em(meio))) {
        desocupado = meio;
        achou = true;
      } else {
        ocupado = meio;
      }
    }
    if (achou) atual = em(desocupado);
  }
  return atual;
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
  // Pela linha de corte: é ela que ocupa o tecido (com a costura, fica fora do contorno).
  return encontrarPrimeiraPosicaoValida(
    linhaDeCorteDaPeca(pecaAlvo),
    outrasPecas.map(linhaDeCorteDaPeca),
    limites,
    enfesto.distanciaMinimaEntrePecasMm,
    passoMm,
    maxTentativas,
  );
}

/**
 * Põe as peças que chegam de fora (de uma importação) onde não fiquem em cima
 * das que já estão no projeto, nem umas das outras: cada uma vai para o
 * primeiro lugar livre da área do enfesto. A que não cabe nela — ou todas,
 * sem enfesto configurado — vai para depois de tudo o que há, na direção do
 * comprimento, a `afastamentoMm` de distância. A peça anda inteira (com os
 * piques, as linhas e o resto); só a posição muda.
 */
export function posicionarAsQueChegam(
  novas: readonly Molde[],
  existentes: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto | null,
  afastamentoMm = 20,
): Molde[] {
  const postas: Molde[] = [];
  for (const peca of novas) {
    const outras = [...existentes, ...postas];
    const noEnfesto = enfesto ? sugerirPosicaoSemSobreposicao(peca, outras, enfesto) : null;
    if (noEnfesto) {
      postas.push(transladarMolde(peca, noEnfesto, peca.id));
      continue;
    }
    if (outras.length === 0) {
      postas.push(peca);
      continue;
    }
    // Depois de tudo: encostada no começo da largura, logo adiante da peça que vai mais longe no comprimento.
    const dela = retanguloEnvolvente(peca.contorno);
    const deTodas = retanguloEnvolvente(outras.flatMap((outra) => outra.contorno));
    postas.push(transladarMolde(peca, { x: deTodas.minX - dela.minX, y: deTodas.maxY + afastamentoMm - dela.minY }, peca.id));
  }
  return postas;
}
