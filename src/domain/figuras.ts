import { circulo, espiral } from '../core/curvas';
import { distancia, pontoMaisProximoNoContorno, type Contorno, type Ponto2D } from '../core/geometria';
import { fioDaParte } from './corteEUniao';
import { dimensionarMolde, transladarMolde, type FiguraDaPeca, type Molde } from './molde';

/**
 * As peças que são uma figura inteira feita por ferramenta — o círculo do
 * "Por raio" e a espiral — guardam as medidas com que foram feitas e onde
 * estão (`Molde.figura`). Com o registro, dá para mudar o raio, a largura ou
 * o perímetro depois, e a figura é refeita no mesmo lugar.
 *
 * O registro só vale enquanto o contorno é o da figura: mexido um ponto à
 * mão, cortada, dobrada ou dimensionada a peça, ele deixa de valer (sem erro).
 * Mover, girar e espelhar a peça levam o registro junto.
 */

/** A que distância do centro ficam os dois pontos que guardam os eixos da figura (mm). */
const BRACO_DO_EIXO_MM = 100;
/** Quanto os eixos guardados podem fugir de dois braços iguais e em esquadro (mm). */
const FOLGA_DOS_EIXOS_MM = 1e-6;
const NO_MESMO_LUGAR_MM = 1e-6;

function mesmoLugar(a: Ponto2D, b: Ponto2D): boolean {
  return distancia(a, b) <= NO_MESMO_LUGAR_MM;
}

/** O registro do círculo de centro e ponto da borda dados, como a ferramenta "Por raio" o desenha. */
export function figuraDoCirculo(centro: Ponto2D, pontoNaBorda: Ponto2D): FiguraDaPeca {
  const raioMm = distancia(centro, pontoNaBorda);
  if (!(raioMm > NO_MESMO_LUGAR_MM)) throw new Error('O círculo precisa de um raio maior que zero.');
  const ex = { x: (pontoNaBorda.x - centro.x) / raioMm, y: (pontoNaBorda.y - centro.y) / raioMm };
  return {
    tipo: 'circulo',
    raioMm,
    centro,
    eixoX: { x: centro.x + ex.x * BRACO_DO_EIXO_MM, y: centro.y + ex.y * BRACO_DO_EIXO_MM },
    eixoY: { x: centro.x - ex.y * BRACO_DO_EIXO_MM, y: centro.y + ex.x * BRACO_DO_EIXO_MM },
  };
}

/** O registro da espiral de centro, largura e perímetro dados, como a ferramenta "Espiral" a desenha. */
export function figuraDaEspiral(centro: Ponto2D, larguraMm: number, perimetroMm: number): FiguraDaPeca {
  return {
    tipo: 'espiral',
    larguraMm,
    perimetroMm,
    centro,
    eixoX: { x: centro.x + BRACO_DO_EIXO_MM, y: centro.y },
    eixoY: { x: centro.x, y: centro.y + BRACO_DO_EIXO_MM },
  };
}

/** O contorno da figura: a forma dela, feita na origem, posta no lugar pelos eixos guardados. */
export function contornoDaFigura(figura: FiguraDaPeca): Ponto2D[] {
  const origem = { x: 0, y: 0 };
  const naOrigem = figura.tipo === 'circulo' ? circulo(origem, { x: figura.raioMm, y: 0 }) : espiral(origem, figura.larguraMm, figura.perimetroMm);
  const { centro } = figura;
  const ex = { x: (figura.eixoX.x - centro.x) / BRACO_DO_EIXO_MM, y: (figura.eixoX.y - centro.y) / BRACO_DO_EIXO_MM };
  const ey = { x: (figura.eixoY.x - centro.x) / BRACO_DO_EIXO_MM, y: (figura.eixoY.y - centro.y) / BRACO_DO_EIXO_MM };
  return naOrigem.map((p) => ({ x: centro.x + ex.x * p.x + ey.x * p.y, y: centro.y + ex.y * p.x + ey.y * p.y }));
}

/** Os dois eixos guardados continuam do mesmo tamanho e em esquadro: a peça só andou, girou ou foi espelhada. */
function eixosInteiros(figura: FiguraDaPeca): boolean {
  const bx = { x: figura.eixoX.x - figura.centro.x, y: figura.eixoX.y - figura.centro.y };
  const by = { x: figura.eixoY.x - figura.centro.x, y: figura.eixoY.y - figura.centro.y };
  return (
    Math.abs(Math.hypot(bx.x, bx.y) - BRACO_DO_EIXO_MM) <= FOLGA_DOS_EIXOS_MM &&
    Math.abs(Math.hypot(by.x, by.y) - BRACO_DO_EIXO_MM) <= FOLGA_DOS_EIXOS_MM &&
    Math.abs(bx.x * by.x + bx.y * by.y) / BRACO_DO_EIXO_MM <= FOLGA_DOS_EIXOS_MM
  );
}

/** As duas voltas são a mesma: os mesmos pontos, seguidos, começando onde for e num sentido ou no outro. */
function mesmaVolta(a: Contorno, b: Contorno): boolean {
  const n = a.length;
  if (n !== b.length || n === 0) return false;
  for (let k = 0; k < n; k++) {
    if (!mesmoLugar(a[k]!, b[0]!)) continue;
    if (b.every((p, i) => mesmoLugar(a[(k + i) % n]!, p))) return true;
    if (b.every((p, i) => mesmoLugar(a[(((k - i) % n) + n) % n]!, p))) return true;
  }
  return false;
}

/** A figura registrada na peça, se o contorno ainda é o dela; senão, `null`. */
export function figuraDaPeca(molde: Molde): FiguraDaPeca | null {
  const figura = molde.figura;
  if (!figura || !eixosInteiros(figura)) return null;
  try {
    return mesmaVolta(molde.contorno, contornoDaFigura(figura)) ? figura : null;
  } catch {
    return null;
  }
}

/** A peça sem o registro de figura que deixou de valer. */
export function comFiguraValida(molde: Molde): Molde {
  if (!molde.figura || figuraDaPeca(molde)) return molde;
  const copia: { -readonly [K in keyof Molde]: Molde[K] } = { ...molde };
  delete copia.figura;
  return copia;
}

/** A peça com a figura dada registrada — se o contorno dela é mesmo o dessa figura. */
export function comFiguraRegistrada(molde: Molde, figura: FiguraDaPeca): Molde {
  return comFiguraValida({ ...molde, figura });
}

/** Os piques levados para o ponto mais próximo do contorno novo. */
function piquesNoContorno(molde: Molde, contorno: Contorno): Molde['piques'] {
  return molde.piques.map((pique) => {
    const perto = pontoMaisProximoNoContorno(pique.posicao, contorno);
    return { ...pique, posicao: perto.ponto, indiceAresta: perto.indiceAresta };
  });
}

/**
 * Muda o raio do círculo: a peça inteira cresce ou encolhe em torno do
 * centro, na mesma proporção — a linha de fio, as linhas, as marcas e os
 * piques vão junto —, e o contorno é refeito com o raio novo.
 */
export function alterarCirculo(molde: Molde, raioMm: number): Molde {
  const figura = figuraDaPeca(molde);
  if (!figura || figura.tipo !== 'circulo') throw new Error('Essa peça não é um círculo feito pelo “Por raio”, ou foi mexida depois.');
  if (!Number.isFinite(raioMm) || !(raioMm > 0)) throw new Error('O raio precisa ser maior que zero.');
  const fator = raioMm / figura.raioMm;
  const escalada = dimensionarMolde(molde, fator, fator);
  // O dimensionar cresce a partir do canto: a peça volta para o centro de antes.
  const centroEscalado = escalada.figura?.centro ?? figura.centro;
  const noLugar = transladarMolde(escalada, { x: figura.centro.x - centroEscalado.x, y: figura.centro.y - centroEscalado.y }, molde.id);
  const nova: FiguraDaPeca = { ...figura, raioMm };
  const contorno = contornoDaFigura(nova);
  return { ...noLugar, contorno, piques: piquesNoContorno(noLugar, contorno), figura: nova };
}

/**
 * Muda a largura e o perímetro da espiral: ela é refeita no mesmo centro. Os
 * piques vão para o ponto mais próximo da borda nova, e a linha de fio é
 * levada para dentro da tira se ficar de fora; o resto fica onde está.
 */
export function alterarEspiral(molde: Molde, larguraMm: number, perimetroMm: number): Molde {
  const figura = figuraDaPeca(molde);
  if (!figura || figura.tipo !== 'espiral') throw new Error('Essa peça não é uma espiral feita pela ferramenta “Espiral”, ou foi mexida depois.');
  const nova: FiguraDaPeca = { ...figura, larguraMm, perimetroMm };
  const contorno = contornoDaFigura(nova);
  return { ...molde, contorno, piques: piquesNoContorno(molde, contorno), linhaDeFio: fioDaParte(molde.linhaDeFio, contorno), figura: nova };
}
