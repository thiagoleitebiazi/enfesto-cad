import { area, distancia, type Ponto2D } from '../core/geometria';
import { secaoNaAltura, type CorpoDoManequim, type Ponto3D } from './manequim';
import { criarMolde, type Molde } from './molde';

/**
 * O desenho no corpo (ADR 0134): o contorno da roupa desenhado sobre o tronco do manequim 3D vira o pré-molde 2D. O
 * tronco é feito de elipses em cada altura; cada ponto desenhado é desenrolado — a altura vira a vertical, e o caminho
 * em volta da elipse, desde o meio da frente, vira a horizontal (com a folga pedida). O pré-molde sai colado ao corpo,
 * para ajustar: as pences, a cava e a costura vêm depois, como em qualquer peça.
 */

/** O quanto o ponto pode sair da elipse do tronco (em fração do raio) e ainda contar como do tronco. */
const TOLERANCIA_DO_TRONCO = 0.45;

/** O ângulo do ponto na elipse da altura dele: 0 no meio da frente (+z), crescendo para o lado esquerdo do corpo (+x). */
function anguloNaElipse(p: Ponto3D, a: number, b: number): number {
  return Math.atan2(p.x / a, p.z / b);
}

/** O caminho em volta da elipse (a em x, b em z) do meio da frente até o ângulo dado (negativo para o lado direito). */
export function caminhoNaElipse(a: number, b: number, angulo: number): number {
  if (angulo === 0) return 0;
  // Simpson, com um número par de pedaços.
  const n = 2 * Math.max(8, Math.ceil(Math.abs(angulo) * 20));
  const passo = angulo / n;
  const f = (t: number): number => Math.sqrt(a * a * Math.cos(t) ** 2 + b * b * Math.sin(t) ** 2);
  let soma = f(0) + f(angulo);
  for (let k = 1; k < n; k++) soma += (k % 2 === 1 ? 4 : 2) * f(k * passo);
  return (soma * passo) / 3;
}

/** A distância do ponto ao trecho de `a` a `b`. */
function distanciaAoTrecho(p: Ponto3D, a: Ponto3D, b: Ponto3D): number {
  const [dx, dy, dz] = [b.x - a.x, b.y - a.y, b.z - a.z];
  const l2 = dx * dx + dy * dy + dz * dz;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy, p.z - a.z - t * dz);
}

/**
 * O ponto é do tronco: a cabeça, os braços e as pernas não são. O corpo de verdade (ADR 0229) passa bem longe da elipse da
 * altura: o busto vai à frente dela, e o vale entre os seios, atrás. Por isso a elipse é só a referência larga, e o que separa
 * o braço é a distância ao osso dele.
 */
export function pontoNoTronco(corpo: CorpoDoManequim, p: Ponto3D): boolean {
  const s = secaoNaAltura(corpo, p.y);
  if (!s) return false;
  const r = Math.hypot(p.x / s.a, p.z / s.b);
  if (Math.abs(r - 1) > TOLERANCIA_DO_TRONCO) return false;
  for (const b of [corpo.bracos.direito, corpo.bracos.esquerdo]) {
    if (Math.min(distanciaAoTrecho(p, b.inicio, b.meio), distanciaAoTrecho(p, b.meio, b.fim)) < 1.2 * b.raio) return false;
  }
  return true;
}

/** O ponto desenrolado: a horizontal pelo caminho na elipse (com a folga), a vertical pela altura (de cima para baixo). */
export function pontoDesenrolado(corpo: CorpoDoManequim, p: Ponto3D, folgaPercentual: number, alturaDoTopo: number): Ponto2D {
  const s = secaoNaAltura(corpo, p.y);
  if (!s) throw new Error('O ponto está fora do tronco do manequim.');
  const u = caminhoNaElipse(s.a, s.b, anguloNaElipse(p, s.a, s.b)) * (1 + folgaPercentual / 100);
  // No mundo do programa, o x é a vertical (para baixo) e o y a horizontal.
  return { x: alturaDoTopo - p.y, y: u };
}

/** O pré-molde: o contorno desenhado no corpo, desenrolado, com o fio em pé no meio. */
export function preMoldeDoDesenho(corpo: CorpoDoManequim, pontos: readonly Ponto3D[], folgaPercentual: number, nome: string, id: string): Molde {
  if (pontos.length < 3) throw new Error('Desenhe pelo menos três pontos no tronco do manequim.');
  if (!(folgaPercentual >= 0 && folgaPercentual <= 50)) throw new Error('A folga vai de 0 a 50%.');
  if (pontos.some((p) => !pontoNoTronco(corpo, p))) throw new Error('Todos os pontos precisam estar no tronco (não na cabeça, nos braços ou nas pernas).');
  const topo = Math.max(...pontos.map((p) => p.y));
  const contorno = pontos.map((p) => pontoDesenrolado(corpo, p, folgaPercentual, topo)).filter((q, i, todos) => i === 0 || distancia(q, todos[i - 1]!) > 0.5);
  if (contorno.length < 3 || !(area(contorno) > 100)) throw new Error('O desenho não fecha uma área: desenhe o contorno da peça, em volta.');
  const xs = contorno.map((q) => q.x);
  const ys = contorno.map((q) => q.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const meioY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return criarMolde(
    {
      nome: nome.trim() || 'Pré-molde do corpo',
      referencia: '',
      tamanho: '',
      contorno,
      linhaDeFio: { inicio: { x: minX + (maxX - minX) * 0.15, y: meioY }, fim: { x: minX + (maxX - minX) * 0.85, y: meioY } },
      margemDeCosturaMm: 10,
    },
    id,
  );
}
