// Primitivas geométricas do CAD. Unidade interna: milímetros (mm), sempre.
// Funções puras — nenhum estado, nenhuma dependência de UI.

export interface Ponto2D {
  readonly x: number;
  readonly y: number;
}

export function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

export function somar(a: Ponto2D, b: Ponto2D): Ponto2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtrair(a: Ponto2D, b: Ponto2D): Ponto2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function escalar(p: Ponto2D, fator: number): Ponto2D {
  return { x: p.x * fator, y: p.y * fator };
}

export function distancia(a: Ponto2D, b: Ponto2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Rotaciona `p` em torno de `centro` por `anguloGraus` (sentido anti-horário). */
export function rotacionar(p: Ponto2D, centro: Ponto2D, anguloGraus: number): Ponto2D {
  const rad = (anguloGraus * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - centro.x;
  const dy = p.y - centro.y;
  return {
    x: centro.x + dx * cos - dy * sin,
    y: centro.y + dx * sin + dy * cos,
  };
}

/** Contorno fechado: lista ordenada de vértices em mm. O último ponto não repete o primeiro. */
export type Contorno = readonly Ponto2D[];

export interface RetanguloEnvolvente {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly largura: number;
  readonly altura: number;
}

export function retanguloEnvolvente(contorno: Contorno): RetanguloEnvolvente {
  if (contorno.length === 0) {
    throw new Error('Contorno vazio não possui retângulo envolvente.');
  }
  let minX = contorno[0]!.x;
  let maxX = contorno[0]!.x;
  let minY = contorno[0]!.y;
  let maxY = contorno[0]!.y;
  for (const p of contorno) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, largura: maxX - minX, altura: maxY - minY };
}

/** Área assinada pela fórmula do sapateiro (shoelace). Positiva = sentido anti-horário. */
export function areaAssinada(contorno: Contorno): number {
  let soma = 0;
  const n = contorno.length;
  for (let i = 0; i < n; i++) {
    const atual = contorno[i]!;
    const proximo = contorno[(i + 1) % n]!;
    soma += atual.x * proximo.y - proximo.x * atual.y;
  }
  return soma / 2;
}

export function area(contorno: Contorno): number {
  return Math.abs(areaAssinada(contorno));
}

/** Teste de ponto-dentro-de-polígono por ray casting (par-ímpar). */
export function pontoDentroDoContorno(p: Ponto2D, contorno: Contorno): boolean {
  let dentro = false;
  const n = contorno.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = contorno[i]!;
    const vj = contorno[j]!;
    const intersecta =
      vi.y > p.y !== vj.y > p.y &&
      p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x;
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}

export function transladarContorno(contorno: Contorno, deslocamento: Ponto2D): Contorno {
  return contorno.map((p) => somar(p, deslocamento));
}

export function rotacionarContorno(contorno: Contorno, centro: Ponto2D, anguloGraus: number): Contorno {
  return contorno.map((p) => rotacionar(p, centro, anguloGraus));
}

/** Espelha `p` horizontalmente (inverte X) em torno da reta vertical x = centroX; Y não muda. */
export function espelharHorizontal(p: Ponto2D, centroX: number): Ponto2D {
  return { x: 2 * centroX - p.x, y: p.y };
}

export function espelharContornoHorizontal(contorno: Contorno, centroX: number): Contorno {
  return contorno.map((p) => espelharHorizontal(p, centroX));
}

/** Ponto mais próximo de `p` sobre o segmento [a, b] (projeção com grampo em [0,1]). */
export function pontoMaisProximoNoSegmento(p: Ponto2D, a: Ponto2D, b: Ponto2D): Ponto2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimentoQuadrado = dx * dx + dy * dy;
  if (comprimentoQuadrado === 0) return a;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimentoQuadrado;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

export interface PontoNoContorno {
  readonly ponto: Ponto2D;
  readonly indiceAresta: number;
  readonly distancia: number;
}

/** Encontra o ponto mais próximo de `p` sobre o perímetro do contorno (qualquer aresta). */
export function pontoMaisProximoNoContorno(p: Ponto2D, contorno: Contorno): PontoNoContorno {
  if (contorno.length < 2) {
    throw new Error('Contorno precisa de ao menos 2 pontos para ter um perímetro.');
  }
  let melhor: PontoNoContorno | null = null;
  const n = contorno.length;
  for (let i = 0; i < n; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % n]!;
    const candidato = pontoMaisProximoNoSegmento(p, a, b);
    const d = distancia(p, candidato);
    if (!melhor || d < melhor.distancia) {
      melhor = { ponto: candidato, indiceAresta: i, distancia: d };
    }
  }
  return melhor!;
}

function normalExternaDaAresta(a: Ponto2D, b: Ponto2D): Ponto2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimento = Math.hypot(dx, dy);
  if (comprimento === 0) return { x: 0, y: 0 };
  // Para um contorno de área assinada positiva, a normal externa de uma
  // aresta a->b é a rotação de -90° do vetor da aresta.
  return { x: dy / comprimento, y: -dx / comprimento };
}

function intersecaoDeRetas(p1: Ponto2D, d1: Ponto2D, p2: Ponto2D, d2: Ponto2D): Ponto2D {
  const denominador = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denominador) < 1e-9) {
    // Arestas quase paralelas (colineares): o ponto médio das origens já
    // deslocadas é uma aproximação segura, sem geração de picos.
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denominador;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

/**
 * Desloca cada aresta do contorno para fora por `distanciaMm` (deslocamento de
 * linhas + interseção nos vértices — junção em esquadria/"miter"). Usado para
 * a margem de costura (linha de corte = contorno original + esta margem).
 *
 * Limitação conhecida: em cantos reflexos muito agudos combinados com uma
 * distância grande em relação ao tamanho do contorno, o resultado pode
 * autointerseccionar-se (não há verificação/correção disso aqui).
 */
export function deslocarContornoParaFora(contorno: Contorno, distanciaMm: number): Contorno {
  if (contorno.length < 3) {
    throw new Error('Contorno precisa de ao menos 3 pontos para ser deslocado.');
  }
  const orientado = areaAssinada(contorno) >= 0 ? contorno : [...contorno].reverse();
  const n = orientado.length;
  const normais = orientado.map((p, i) => normalExternaDaAresta(p, orientado[(i + 1) % n]!));

  const resultado: Ponto2D[] = [];
  for (let i = 0; i < n; i++) {
    const iAnterior = (i - 1 + n) % n;
    const pAnterior = orientado[iAnterior]!;
    const pAtual = orientado[i]!;
    const pProximo = orientado[(i + 1) % n]!;
    const origemAnterior = somar(pAnterior, escalar(normais[iAnterior]!, distanciaMm));
    const origemAtual = somar(pAtual, escalar(normais[i]!, distanciaMm));
    resultado.push(
      intersecaoDeRetas(origemAnterior, subtrair(pAtual, pAnterior), origemAtual, subtrair(pProximo, pAtual)),
    );
  }
  return resultado;
}

const EPSILON_GEOMETRICO = 1e-6;

function orientacaoDeTresPontos(p: Ponto2D, q: Ponto2D, r: Ponto2D): -1 | 0 | 1 {
  const valor = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(valor) < EPSILON_GEOMETRICO) return 0;
  return valor > 0 ? 1 : -1;
}

function pontoNoSegmentoColinear(p: Ponto2D, q: Ponto2D, r: Ponto2D): boolean {
  return (
    r.x <= Math.max(p.x, q.x) + EPSILON_GEOMETRICO &&
    r.x >= Math.min(p.x, q.x) - EPSILON_GEOMETRICO &&
    r.y <= Math.max(p.y, q.y) + EPSILON_GEOMETRICO &&
    r.y >= Math.min(p.y, q.y) - EPSILON_GEOMETRICO
  );
}

/** Teste clássico de interseção de segmentos (orientação + casos colineares). */
export function segmentosSeIntersectam(p1: Ponto2D, q1: Ponto2D, p2: Ponto2D, q2: Ponto2D): boolean {
  const o1 = orientacaoDeTresPontos(p1, q1, p2);
  const o2 = orientacaoDeTresPontos(p1, q1, q2);
  const o3 = orientacaoDeTresPontos(p2, q2, p1);
  const o4 = orientacaoDeTresPontos(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pontoNoSegmentoColinear(p1, q1, p2)) return true;
  if (o2 === 0 && pontoNoSegmentoColinear(p1, q1, q2)) return true;
  if (o3 === 0 && pontoNoSegmentoColinear(p2, q2, p1)) return true;
  if (o4 === 0 && pontoNoSegmentoColinear(p2, q2, q1)) return true;
  return false;
}

/** Menor distância entre dois segmentos (0 se eles se cruzam ou se tocam). */
export function distanciaEntreSegmentos(p1: Ponto2D, q1: Ponto2D, p2: Ponto2D, q2: Ponto2D): number {
  if (segmentosSeIntersectam(p1, q1, p2, q2)) return 0;
  return Math.min(
    distancia(p1, pontoMaisProximoNoSegmento(p1, p2, q2)),
    distancia(q1, pontoMaisProximoNoSegmento(q1, p2, q2)),
    distancia(p2, pontoMaisProximoNoSegmento(p2, p1, q1)),
    distancia(q2, pontoMaisProximoNoSegmento(q2, p1, q1)),
  );
}

export function bboxesSeSobrepoem(a: RetanguloEnvolvente, b: RetanguloEnvolvente): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Verdadeiro se os dois contornos se sobrepõem (alguma aresta cruza a outra,
 * ou um contorno está inteiramente dentro do outro). Pré-filtro por bbox
 * para não pagar o custo O(n·m) quando os retângulos envolventes nem se
 * tocam.
 */
export function contornosSeSobrepoem(a: Contorno, b: Contorno): boolean {
  if (a.length < 2 || b.length < 2) return false;
  if (!bboxesSeSobrepoem(retanguloEnvolvente(a), retanguloEnvolvente(b))) return false;

  const n = a.length;
  const m = b.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (segmentosSeIntersectam(a[i]!, a[(i + 1) % n]!, b[j]!, b[(j + 1) % m]!)) return true;
    }
  }
  return pontoDentroDoContorno(a[0]!, b) || pontoDentroDoContorno(b[0]!, a);
}

/** Menor distância entre os perímetros de dois contornos (0 se eles se sobrepõem). */
export function distanciaEntreContornos(a: Contorno, b: Contorno): number {
  if (contornosSeSobrepoem(a, b)) return 0;
  const n = a.length;
  const m = b.length;
  let menor = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const d = distanciaEntreSegmentos(a[i]!, a[(i + 1) % n]!, b[j]!, b[(j + 1) % m]!);
      if (d < menor) menor = d;
    }
  }
  return menor;
}
