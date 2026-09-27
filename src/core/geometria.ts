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
