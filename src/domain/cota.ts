import { distancia, type Ponto2D } from '../core/geometria';

/**
 * Cota: uma medida escrita no desenho. Fica guardada na peça em que foi
 * criada e anda, gira, espelha e escala com ela (`transformarCota`). O número
 * mostrado é sempre calculado dos pontos guardados — nunca um valor digitado
 * ou congelado —, então o que está escrito é o que o desenho mede.
 *
 * Os pontos são do mundo (mm). "Horizontal" e "vertical" são os da tela, que
 * troca os eixos (ui/transformacaoDeTela.ts): a horizontal é o Y do mundo e a
 * vertical, o X.
 */
export type Cota = CotaLinear | CotaDeAngulo | CotaDePerimetro | CotaDeRaio;

/** Distância entre dois pontos, medida numa direção: a reta que os liga, a horizontal ou a vertical. */
export interface CotaLinear {
  readonly id: string;
  readonly tipo: 'linear';
  readonly de: Ponto2D;
  readonly ate: Ponto2D;
  /** Direção em que a medida é tomada (vetor unitário). */
  readonly direcao: Ponto2D;
  /** Um ponto por onde passa a linha de cota: é o que a afasta dos pontos medidos. */
  readonly posicao: Ponto2D;
}

/** Ângulo no `vertice`, entre as retas que vão dele a `de` e a `ate` (de 0° a 180°). */
export interface CotaDeAngulo {
  readonly id: string;
  readonly tipo: 'angulo';
  readonly de: Ponto2D;
  readonly vertice: Ponto2D;
  readonly ate: Ponto2D;
  /** Raio do arco que marca o ângulo no desenho. */
  readonly raioMm: number;
}

/** Perímetro da peça dona da cota, escrito em `posicao`. */
export interface CotaDePerimetro {
  readonly id: string;
  readonly tipo: 'perimetro';
  readonly posicao: Ponto2D;
}

/** Raio de um arco do contorno: a distância do `centro` ao ponto `noArco`, desenhada como um raio do círculo. */
export interface CotaDeRaio {
  readonly id: string;
  readonly tipo: 'raio';
  readonly centro: Ponto2D;
  readonly noArco: Ponto2D;
}

/** Dois pontos a menos disso (mm) são o mesmo: não há o que medir entre eles. */
const MESMO_PONTO_MM = 1e-6;
const RAIO_MINIMO_DO_ARCO_MM = 1;
const HORIZONTAL_DA_TELA: Ponto2D = { x: 0, y: 1 };
const VERTICAL_DA_TELA: Ponto2D = { x: 1, y: 0 };

function exigirPontosDiferentes(a: Ponto2D, b: Ponto2D): void {
  if (distancia(a, b) < MESMO_PONTO_MM) throw new Error('A cota precisa de dois pontos diferentes.');
}

function unitario(v: Ponto2D): Ponto2D | null {
  const comprimento = Math.hypot(v.x, v.y);
  return comprimento < MESMO_PONTO_MM ? null : { x: v.x / comprimento, y: v.y / comprimento };
}

function escalar(a: Ponto2D, b: Ponto2D): number {
  return a.x * b.x + a.y * b.y;
}

/** "Cota distância": a distância em linha reta de `de` a `ate`; `posicao` afasta a linha de cota dos pontos. */
export function cotaDeDistancia(id: string, de: Ponto2D, ate: Ponto2D, posicao: Ponto2D): CotaLinear {
  exigirPontosDiferentes(de, ate);
  return { id, tipo: 'linear', de, ate, direcao: unitario({ x: ate.x - de.x, y: ate.y - de.y })!, posicao };
}

/**
 * "Horizontal / Vertical": a distância de `de` a `ate` só na horizontal ou só
 * na vertical da tela. Quem escolhe é onde a cota é posta: acima ou abaixo
 * dos pontos, mede a horizontal; ao lado deles, a vertical. Se os pontos não
 * têm distância nenhuma na direção escolhida, vale a outra.
 */
export function cotaHorizontalOuVertical(id: string, de: Ponto2D, ate: Ponto2D, posicao: Ponto2D): CotaLinear {
  exigirPontosDiferentes(de, ate);
  const meio = { x: (de.x + ate.x) / 2, y: (de.y + ate.y) / 2 };
  const afastamentoVertical = Math.abs(posicao.x - meio.x);
  const afastamentoHorizontal = Math.abs(posicao.y - meio.y);
  let direcao = afastamentoVertical >= afastamentoHorizontal ? HORIZONTAL_DA_TELA : VERTICAL_DA_TELA;
  if (Math.abs(escalar({ x: ate.x - de.x, y: ate.y - de.y }, direcao)) < MESMO_PONTO_MM) {
    direcao = direcao === HORIZONTAL_DA_TELA ? VERTICAL_DA_TELA : HORIZONTAL_DA_TELA;
  }
  return { id, tipo: 'linear', de, ate, direcao, posicao };
}

/** "Ângulo": o ângulo no `vertice`; a distância de `posicao` ao vértice é o raio do arco desenhado. */
export function cotaDeAngulo(id: string, de: Ponto2D, vertice: Ponto2D, ate: Ponto2D, posicao: Ponto2D): CotaDeAngulo {
  if (distancia(de, vertice) < MESMO_PONTO_MM || distancia(ate, vertice) < MESMO_PONTO_MM) {
    throw new Error('O ângulo precisa de três pontos diferentes: um de cada lado e o vértice.');
  }
  return { id, tipo: 'angulo', de, vertice, ate, raioMm: Math.max(RAIO_MINIMO_DO_ARCO_MM, distancia(vertice, posicao)) };
}

export function cotaDePerimetro(id: string, posicao: Ponto2D): CotaDePerimetro {
  return { id, tipo: 'perimetro', posicao };
}

/** "Raio": do centro do arco a um ponto dele. */
export function cotaDeRaio(id: string, centro: Ponto2D, noArco: Ponto2D): CotaDeRaio {
  if (distancia(centro, noArco) < MESMO_PONTO_MM) throw new Error('O raio precisa de um centro e de um ponto do arco diferentes.');
  return { id, tipo: 'raio', centro, noArco };
}

/** O raio da cota, em mm. */
export function valorDaCotaDeRaio(cota: CotaDeRaio): number {
  return distancia(cota.centro, cota.noArco);
}

/** A medida da cota linear, em mm: quanto `de` e `ate` distam na direção dela. */
export function valorDaCotaLinear(cota: CotaLinear): number {
  return Math.abs(escalar({ x: cota.ate.x - cota.de.x, y: cota.ate.y - cota.de.y }, cota.direcao));
}

/** O ângulo da cota, em graus, de 0 a 180. */
export function valorDaCotaDeAngulo(cota: CotaDeAngulo): number {
  const u = unitario({ x: cota.de.x - cota.vertice.x, y: cota.de.y - cota.vertice.y });
  const v = unitario({ x: cota.ate.x - cota.vertice.x, y: cota.ate.y - cota.vertice.y });
  if (!u || !v) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, escalar(u, v)))) * 180) / Math.PI;
}

/**
 * Onde a cota linear é desenhada: os pés das linhas de chamada (a projeção de
 * `de` e de `ate` sobre a linha de cota) e o meio dela, onde vai o número.
 */
export function geometriaDaCotaLinear(cota: CotaLinear): {
  readonly peDe: Ponto2D;
  readonly peAte: Ponto2D;
  readonly meio: Ponto2D;
} {
  const normal = { x: -cota.direcao.y, y: cota.direcao.x };
  const ate = (p: Ponto2D): Ponto2D => {
    const t = escalar({ x: cota.posicao.x - p.x, y: cota.posicao.y - p.y }, normal);
    return { x: p.x + normal.x * t, y: p.y + normal.y * t };
  };
  const peDe = ate(cota.de);
  const peAte = ate(cota.ate);
  return { peDe, peAte, meio: { x: (peDe.x + peAte.x) / 2, y: (peDe.y + peAte.y) / 2 } };
}

/** Direção (unitária) da bissetriz do ângulo, a partir do vértice — é para onde o número fica. */
export function bissetrizDaCotaDeAngulo(cota: CotaDeAngulo): Ponto2D {
  const u = unitario({ x: cota.de.x - cota.vertice.x, y: cota.de.y - cota.vertice.y }) ?? VERTICAL_DA_TELA;
  const v = unitario({ x: cota.ate.x - cota.vertice.x, y: cota.ate.y - cota.vertice.y }) ?? u;
  // Com os dois lados opostos (180°) a soma se anula: vale a perpendicular a um deles.
  return unitario({ x: u.x + v.x, y: u.y + v.y }) ?? { x: -u.y, y: u.x };
}

/** O ponto do mundo em que o número da cota é escrito (e onde um clique a escolhe para apagar). */
export function ancoraDoRotulo(cota: Cota): Ponto2D {
  if (cota.tipo === 'perimetro') return cota.posicao;
  if (cota.tipo === 'raio') return { x: (cota.centro.x + cota.noArco.x) / 2, y: (cota.centro.y + cota.noArco.y) / 2 };
  if (cota.tipo === 'linear') return geometriaDaCotaLinear(cota).meio;
  const bissetriz = bissetrizDaCotaDeAngulo(cota);
  return { x: cota.vertice.x + bissetriz.x * cota.raioMm, y: cota.vertice.y + bissetriz.y * cota.raioMm };
}

/**
 * Leva a cota junto com a peça numa transformação afim: `ponto` transforma
 * posições e `vetor`, direções (a mesma transformação sem a translação). A
 * direção volta a ser unitária; se a transformação a anular, fica a antiga.
 */
export function transformarCota(cota: Cota, ponto: (p: Ponto2D) => Ponto2D, vetor: (v: Ponto2D) => Ponto2D): Cota {
  if (cota.tipo === 'perimetro') return { ...cota, posicao: ponto(cota.posicao) };
  if (cota.tipo === 'raio') return { ...cota, centro: ponto(cota.centro), noArco: ponto(cota.noArco) };
  if (cota.tipo === 'angulo') {
    return { ...cota, de: ponto(cota.de), vertice: ponto(cota.vertice), ate: ponto(cota.ate) };
  }
  return {
    ...cota,
    de: ponto(cota.de),
    ate: ponto(cota.ate),
    posicao: ponto(cota.posicao),
    direcao: unitario(vetor(cota.direcao)) ?? cota.direcao,
  };
}
