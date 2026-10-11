import { comprimentoDaLinha, distancia, type Ponto2D } from './geometria';

/**
 * Curvas e arcos deste programa são amostrados: viram uma sequência de pontos
 * próximos, que entra no contorno como vértices comuns. Não se guarda raio nem
 * ponto de controle — depois de criada, a curva se edita ponto a ponto, ou se
 * refaz o trecho. As funções aqui só calculam esses pontos.
 */

/** Distância aproximada (mm) entre pontos seguidos de uma curva amostrada. */
export const PASSO_DA_CURVA_MM = 6;
const MINIMO_DE_TRECHOS = 4;
const MAXIMO_DE_TRECHOS = 96;
const MESMO_PONTO_MM = 1e-6;

function trechosPara(comprimentoMm: number): number {
  return Math.max(MINIMO_DE_TRECHOS, Math.min(MAXIMO_DE_TRECHOS, Math.ceil(comprimentoMm / PASSO_DA_CURVA_MM)));
}

function semRepetidos(pontos: readonly Ponto2D[]): Ponto2D[] {
  const resultado: Ponto2D[] = [];
  for (const p of pontos) {
    if (resultado.length === 0 || distancia(resultado.at(-1)!, p) > MESMO_PONTO_MM) resultado.push(p);
  }
  return resultado;
}

function interpolar(a: Ponto2D, b: Ponto2D, ta: number, tb: number, t: number): Ponto2D {
  const k = (t - ta) / (tb - ta);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/**
 * A direção em que a curva sai de cada ponta: um vetor que aponta da ponta
 * para o lado da curva (na ponta final, de volta para ela). Sem a direção, a
 * curva sai da ponta na direção do ponto vizinho.
 */
export interface DirecoesNasPontas {
  readonly inicio?: Ponto2D | undefined;
  readonly fim?: Ponto2D | undefined;
}

/** O maior ângulo (graus) entre a direção pedida numa ponta e a reta que vai dela ao ponto vizinho. */
export const ANGULO_MAXIMO_DA_TANGENTE_GRAUS = 85;

/** Verdadeiro se a direção serve de tangente na ponta: tem comprimento e fica a até 85° da reta que vai da ponta ao vizinho. */
export function direcaoServeDeTangente(ponta: Ponto2D, vizinho: Ponto2D, direcao: Ponto2D): boolean {
  const comprimento = Math.hypot(direcao.x, direcao.y);
  const corda = distancia(ponta, vizinho);
  if (comprimento < MESMO_PONTO_MM || corda < MESMO_PONTO_MM) return false;
  const cosseno = ((vizinho.x - ponta.x) * direcao.x + (vizinho.y - ponta.y) * direcao.y) / (corda * comprimento);
  return cosseno >= Math.cos((ANGULO_MAXIMO_DA_TANGENTE_GRAUS * Math.PI) / 180) - 1e-12;
}

/**
 * O ponto fantasma de uma ponta. Sem direção pedida (ou com uma que não
 * serve), é o vizinho espelhado na ponta: a curva sai na direção dele. Com a
 * direção, é o vizinho espelhado na reta que passa pela ponta em esquadro com
 * ela — na spline centrípeta, a tangente na ponta fica no meio entre a
 * direção do fantasma e a do vizinho, e assim cai exatamente na pedida.
 */
function fantasmaDaPonta(ponta: Ponto2D, vizinho: Ponto2D, direcao: Ponto2D | undefined): Ponto2D {
  if (!direcao || !direcaoServeDeTangente(ponta, vizinho, direcao)) return { x: 2 * ponta.x - vizinho.x, y: 2 * ponta.y - vizinho.y };
  const comprimento = Math.hypot(direcao.x, direcao.y);
  const t = { x: direcao.x / comprimento, y: direcao.y / comprimento };
  const aoLongo = (vizinho.x - ponta.x) * t.x + (vizinho.y - ponta.y) * t.y;
  return { x: vizinho.x - 2 * aoLongo * t.x, y: vizinho.y - 2 * aoLongo * t.y };
}

/**
 * Curva suave que passa por todos os pontos dados, na ordem (spline de
 * Catmull-Rom centrípeta, que não faz laços nem exagera entre pontos mal
 * espaçados). Devolve a curva amostrada, do primeiro ao último ponto. Com
 * dois pontos é a reta entre eles. Com `direcoes`, a curva sai de cada ponta
 * na direção pedida (as alças de tangente).
 */
export function curvaPorPontos(pontos: readonly Ponto2D[], direcoes: DirecoesNasPontas = {}): Ponto2D[] {
  const p = semRepetidos(pontos);
  if (p.length < 3) return p;
  // Pontos fantasmas nas pontas: a curva chega e sai sem dobra, na direção do vizinho ou na pedida.
  const ext = [fantasmaDaPonta(p[0]!, p[1]!, direcoes.inicio), ...p, fantasmaDaPonta(p.at(-1)!, p.at(-2)!, direcoes.fim)];
  const curva: Ponto2D[] = [p[0]!];
  for (let i = 1; i + 2 < ext.length; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1]!, ext[i]!, ext[i + 1]!, ext[i + 2]!];
    const t0 = 0;
    const t1 = t0 + Math.sqrt(distancia(p0, p1));
    const t2 = t1 + Math.sqrt(distancia(p1, p2));
    const t3 = t2 + Math.sqrt(distancia(p2, p3));
    const trechos = trechosPara(distancia(p1, p2));
    for (let j = 1; j <= trechos; j++) {
      const t = t1 + ((t2 - t1) * j) / trechos;
      const a1 = interpolar(p0, p1, t0, t1, t);
      const a2 = interpolar(p1, p2, t1, t2, t);
      const a3 = interpolar(p2, p3, t2, t3, t);
      const b1 = interpolar(a1, a2, t0, t2, t);
      const b2 = interpolar(a2, a3, t1, t3, t);
      curva.push(j === trechos ? p2 : interpolar(b1, b2, t1, t2, t));
    }
  }
  return curva;
}

/** O círculo que passa por três pontos, ou `null` se eles estão em linha reta. */
export function circuloPorTresPontos(a: Ponto2D, b: Ponto2D, c: Ponto2D): { readonly centro: Ponto2D; readonly raio: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const escala = Math.max(distancia(a, b), distancia(b, c), distancia(a, c));
  if (Math.abs(d) < 1e-9 * Math.max(1, escala * escala)) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const centro = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { centro, raio: distancia(centro, a) };
}

/**
 * Arco de círculo de `inicio` a `fim` passando por `meio`, amostrado. Com os
 * três em linha reta não há círculo: devolve a reta de `inicio` a `fim`.
 */
export function arcoPorTresPontos(inicio: Ponto2D, meio: Ponto2D, fim: Ponto2D): Ponto2D[] {
  if (distancia(inicio, fim) < MESMO_PONTO_MM) return [inicio];
  const circulo = circuloPorTresPontos(inicio, meio, fim);
  if (!circulo) return [inicio, fim];
  const { centro, raio } = circulo;
  const angulo = (p: Ponto2D): number => Math.atan2(p.y - centro.y, p.x - centro.x);
  const antiHorario = (meio.x - inicio.x) * (fim.y - meio.y) - (meio.y - inicio.y) * (fim.x - meio.x) > 0;
  const a0 = angulo(inicio);
  let varredura = angulo(fim) - a0;
  if (antiHorario && varredura <= 0) varredura += Math.PI * 2;
  if (!antiHorario && varredura >= 0) varredura -= Math.PI * 2;
  const trechos = trechosPara(Math.abs(varredura) * raio);
  const arco: Ponto2D[] = [inicio];
  for (let j = 1; j < trechos; j++) {
    const t = a0 + (varredura * j) / trechos;
    arco.push({ x: centro.x + raio * Math.cos(t), y: centro.y + raio * Math.sin(t) });
  }
  arco.push(fim);
  return arco;
}

/**
 * Círculo amostrado, como contorno fechado; o primeiro ponto é o da direção
 * de `pontoNaBorda`. `quantosLados`: quando o círculo tem de sair com um
 * número de lados que não é o que o raio pede (o que foi dimensionado, e
 * guardou os lados que tinha).
 */
export function circulo(centro: Ponto2D, pontoNaBorda: Ponto2D, quantosLados?: number): Ponto2D[] {
  const raio = distancia(centro, pontoNaBorda);
  if (raio < MESMO_PONTO_MM) throw new Error('O círculo precisa de um raio maior que zero.');
  const a0 = Math.atan2(pontoNaBorda.y - centro.y, pontoNaBorda.x - centro.x);
  const lados = quantosLados ?? Math.max(24, Math.min(144, Math.ceil((2 * Math.PI * raio) / PASSO_DA_CURVA_MM)));
  return Array.from({ length: lados }, (_, i) => {
    const t = a0 + (2 * Math.PI * i) / lados;
    return i === 0 ? pontoNaBorda : { x: centro.x + raio * Math.cos(t), y: centro.y + raio * Math.sin(t) };
  });
}

/** Folga (mm) entre uma volta e a seguinte da espiral, para o contorno não encostar em si mesmo. */
export const FOLGA_ENTRE_VOLTAS_DA_ESPIRAL_MM = 1;

/** Comprimento de uma espiral de Arquimedes r = r0 + b·θ, de θ = 0 a `teta`. */
function comprimentoDaEspiral(r0: number, b: number, teta: number): number {
  const primitiva = (r: number): number => {
    const f = r / b;
    return (b / 2) * (f * Math.sqrt(1 + f * f) + Math.asinh(f));
  };
  return primitiva(r0 + b * teta) - primitiva(r0);
}

/**
 * Molde em espiral (o do babado): uma tira de `larguraMm` enrolada em volta
 * do `centro`, cuja borda de dentro mede `perimetroMm` — é a borda que se
 * costura esticada. A borda de dentro começa num raio igual à largura, e
 * cada volta fica afastada da anterior pela largura mais uma pequena folga.
 * Devolve o contorno fechado da tira.
 */
export function espiral(centro: Ponto2D, larguraMm: number, perimetroMm: number): Ponto2D[] {
  if (!Number.isFinite(larguraMm) || larguraMm <= 0) throw new Error('A largura da espiral precisa ser maior que zero.');
  if (!Number.isFinite(perimetroMm) || perimetroMm <= 0) throw new Error('O perímetro da espiral precisa ser maior que zero.');
  const r0 = larguraMm;
  const b = (larguraMm + FOLGA_ENTRE_VOLTAS_DA_ESPIRAL_MM) / (2 * Math.PI);
  // Ângulo final em que a borda de dentro completa o perímetro pedido (bisseção).
  let minimo = 0;
  let maximo = 1;
  while (comprimentoDaEspiral(r0, b, maximo) < perimetroMm) maximo *= 2;
  for (let i = 0; i < 80; i++) {
    const meio = (minimo + maximo) / 2;
    if (comprimentoDaEspiral(r0, b, meio) < perimetroMm) minimo = meio;
    else maximo = meio;
  }
  const tetaFinal = (minimo + maximo) / 2;
  const passos = Math.max(8, Math.min(720, Math.ceil(perimetroMm / PASSO_DA_CURVA_MM)));
  const naEspiral = (teta: number, afastamento: number): Ponto2D => {
    const r = r0 + b * teta + afastamento;
    return { x: centro.x + r * Math.cos(teta), y: centro.y + r * Math.sin(teta) };
  };
  const dentro = Array.from({ length: passos + 1 }, (_, i) => naEspiral((tetaFinal * i) / passos, 0));
  const fora = Array.from({ length: passos + 1 }, (_, i) => naEspiral((tetaFinal * (passos - i)) / passos, larguraMm));
  return [...dentro, ...fora];
}

/** O ponto que fica a `alvo` mm do início, andando sobre a linha. */
function pontoNaLinha(pontos: readonly Ponto2D[], alvo: number): Ponto2D {
  let percorrido = 0;
  for (let i = 1; i < pontos.length; i++) {
    const passo = distancia(pontos[i - 1]!, pontos[i]!);
    if (percorrido + passo >= alvo && passo > 0) {
      const k = (alvo - percorrido) / passo;
      return { x: pontos[i - 1]!.x + (pontos[i]!.x - pontos[i - 1]!.x) * k, y: pontos[i - 1]!.y + (pontos[i]!.y - pontos[i - 1]!.y) * k };
    }
    percorrido += passo;
  }
  return pontos.at(-1)!;
}

/**
 * A mesma linha com `quantidade` pontos (contando as duas pontas), igualmente
 * espaçados ao longo dela. Com menos pontos que antes a forma simplifica;
 * com mais, só ganha pontos sobre os mesmos segmentos.
 */
export function reamostrarLinha(pontos: readonly Ponto2D[], quantidade: number): Ponto2D[] {
  if (!Number.isInteger(quantidade) || quantidade < 2) throw new Error('O trecho precisa de pelo menos 2 pontos: as duas pontas.');
  if (pontos.length < 2) throw new Error('O trecho precisa de pelo menos dois pontos para ser redividido.');
  const total = comprimentoDaLinha(pontos);
  return Array.from({ length: quantidade }, (_, i) => {
    if (i === 0) return pontos[0]!;
    if (i === quantidade - 1) return pontos.at(-1)!;
    return pontoNaLinha(pontos, (total * i) / (quantidade - 1));
  });
}

/**
 * A forma de uma linha, sem tamanho nem posição: o primeiro ponto vira (0, 0)
 * e o último (1, 0). É como uma curva fica guardada no cadastro de curvas.
 */
export function normalizarCurva(pontos: readonly Ponto2D[]): Ponto2D[] {
  const inicio = pontos[0];
  const fim = pontos.at(-1);
  if (!inicio || !fim || pontos.length < 2) throw new Error('A curva precisa de pelo menos dois pontos.');
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const corda2 = dx * dx + dy * dy;
  if (corda2 < MESMO_PONTO_MM * MESMO_PONTO_MM) throw new Error('As duas pontas da curva estão no mesmo lugar: ela não tem direção.');
  return pontos.map((p, i) => {
    if (i === 0) return { x: 0, y: 0 };
    if (i === pontos.length - 1) return { x: 1, y: 0 };
    const px = p.x - inicio.x;
    const py = p.y - inicio.y;
    return { x: (px * dx + py * dy) / corda2, y: (py * dx - px * dy) / corda2 };
  });
}

/**
 * Põe uma forma normalizada (`normalizarCurva`) entre dois pontos: ela estica
 * ou encolhe por igual, e gira, até começar em `inicio` e terminar em `fim`.
 * `espelhar` vira a curva para o outro lado da reta entre os dois.
 */
export function ajustarCurvaAosExtremos(forma: readonly Ponto2D[], inicio: Ponto2D, fim: Ponto2D, espelhar = false): Ponto2D[] {
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const sinal = espelhar ? -1 : 1;
  return forma.map((p, i) => {
    if (i === 0) return inicio;
    if (i === forma.length - 1) return fim;
    return { x: inicio.x + p.x * dx - sinal * p.y * dy, y: inicio.y + p.x * dy + sinal * p.y * dx };
  });
}
