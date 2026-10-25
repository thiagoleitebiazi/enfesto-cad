import type { CorpoDoManequim } from './manequim';
import { distanciaAoCorpo } from './manequim';
import type { MalhaDaPeca } from './malhaDaPeca';
import { trechoDaBorda } from './malhaDaPeca';
import type { ConfiguracaoDaInstancia, Costura3D, InstanciaDaPeca, Tecido3D } from './montagem3d';
import { posicoesDeArrumacao } from './montagem3d';

/**
 * A simulação do caimento (ADR 0111): o tecido como partículas (os pontos da malha de cada peça) ligadas por
 * restrições — o estiramento (cada aresta quer o comprimento do molde), a flexão (os dois pontos opostos de cada
 * aresta interna, que resistem a dobrar) e as costuras (os pontos dos dois lados, que se juntam) — resolvidas pelo
 * método das posições com complacência (XPBD), em passos pequenos. Primeiro só a costura (sem gravidade: as peças
 * se juntam em volta do corpo); depois o caimento (com o peso). O corpo e o chão empurram o tecido para fora, com
 * atrito. É uma física simplificada: mostra o caimento e onde a peça repuxa, mas não substitui a peça-piloto.
 */

export interface PecaNaSimulacao {
  readonly chave: string;
  readonly malha: MalhaDaPeca;
  /** O primeiro ponto desta peça nas listas da simulação. */
  readonly inicio: number;
  /** O primeiro triângulo desta peça em `triangulos`. */
  readonly primeiroTriangulo: number;
}

export interface Simulacao {
  readonly corpo: CorpoDoManequim;
  readonly pecas: readonly PecaNaSimulacao[];
  /** As posições (x, y, z seguidos). */
  readonly x: Float64Array;
  readonly anterior: Float64Array;
  readonly v: Float64Array;
  /** O inverso da massa de cada ponto (1/g). */
  readonly w: Float64Array;
  /** As arestas (pares, nos números da simulação) e o comprimento de cada uma no molde. */
  readonly arestas: Uint32Array;
  readonly comprimentos: Float64Array;
  /** A complacência de cada aresta: a do tecido na direção dela, pelo ângulo com o fio da peça (ADR 0120). */
  readonly complacenciasDasArestas: Float64Array;
  readonly dobras: Uint32Array;
  readonly comprimentosDasDobras: Float64Array;
  /** As costuras: o ponto de um lado e o ponto do outro (entre `b1` e `b2`, na fração `f`); a distância de partida. */
  readonly costuraA: Uint32Array;
  readonly costuraB1: Uint32Array;
  readonly costuraB2: Uint32Array;
  readonly costuraF: Float64Array;
  readonly costuraDistancia0: Float64Array;
  /** Os triângulos (nos números da simulação) e os comprimentos das três arestas de cada um no molde. */
  readonly triangulos: Uint32Array;
  readonly ladosDosTriangulos: Float64Array;
  readonly parametros: ParametrosDoTecido;
  tempo: number;
  /** O maior movimento no último quadro (mm/s), para saber quando parou. */
  velocidadeMaxima: number;
  /** A parte dos pontos que ainda se mexe (de 0 a 1), no último quadro. */
  fracaoEmMovimento: number;
}

export interface ParametrosDoTecido {
  readonly gramasPorMm2: number;
  readonly complacenciaDoEstiramento: number;
  readonly complacenciaDaFlexao: number;
  readonly atrito: number;
  /** A distância que o tecido guarda do corpo (mm). */
  readonly espessura: number;
}

export const TEMPO_DA_COSTURA_S = 1.2;
const GRAVIDADE = 9810;
/** A maior velocidade de um ponto do tecido (mm/s). */
const VELOCIDADE_MAXIMA = 3000;
/** Quantas vezes o estiramento e as costuras são resolvidos em cada passo. */
const VOLTAS_POR_PASSO = 3;
/**
 * O atrito durante a costura, sobre o do tecido: pouco, para a peça deslizar enquanto é vestida (com o atrito todo, a
 * manga comprida ficava presa esticada e a costura de baixo do braço não fechava), mas não nada (sem atrito, a saia
 * apertada num corpo que afina para cima subia como um elástico num cone).
 */
const ATRITO_NA_COSTURA = 0.3;
/** Abaixo disto (mm/s), o ponto está parado. */
const PARADO_MM_S = 15;

/** A elasticidade de 0 a 100 na complacência da física (de 10⁻⁸, quase nada, a 10⁻³). */
const complacenciaDaElasticidade = (e: number): number => 10 ** (-8 + (5 * e) / 100);

/**
 * A elasticidade (de 0 a 100) numa direção do tecido (ADR 0120), pelo cosseno do ângulo com o fio: no fio, a do fio;
 * atravessado, a da trama; a 45°, a do viés. Entre eles, a mistura pelos pesos cos² e sen² (o fio e a trama) e
 * sen²(2θ) (o viés). Sem a trama e o viés, a mesma em toda direção.
 */
export function elasticidadeNaDirecao(t: Tecido3D, cos: number): number {
  const c2 = Math.min(1, cos * cos);
  const s2 = 1 - c2;
  const vies = 4 * c2 * s2;
  const trama = t.elasticidadeNaTrama ?? t.elasticidade;
  const noVies = t.elasticidadeNoVies ?? t.elasticidade;
  return (1 - vies) * (c2 * t.elasticidade + s2 * trama) + vies * noVies;
}

/** As propriedades do tecido (de 0 a 100) nos números da física. */
export function parametrosDoTecido(t: Tecido3D): ParametrosDoTecido {
  return {
    gramasPorMm2: t.pesoGm2 * 1e-6,
    complacenciaDoEstiramento: complacenciaDaElasticidade(t.elasticidade),
    complacenciaDaFlexao: 10 ** (-1 - (4 * t.rigidez) / 100),
    atrito: 0.1 + (0.8 * t.atrito) / 100,
    espessura: 3,
  };
}

export interface EntradaDaSimulacao {
  readonly corpo: CorpoDoManequim;
  readonly instancias: readonly InstanciaDaPeca[];
  readonly configuracoes: Readonly<Record<string, ConfiguracaoDaInstancia>>;
  readonly malhas: ReadonlyMap<string, MalhaDaPeca>;
  readonly costuras: readonly Costura3D[];
  readonly tecido: Tecido3D;
}

/** Monta a simulação: as peças postas em volta do corpo, as restrições e as costuras. */
export function montarSimulacao(e: EntradaDaSimulacao): Simulacao {
  const parametros = parametrosDoTecido(e.tecido);
  const pecas: PecaNaSimulacao[] = [];
  let totalDePontos = 0;
  let totalDeTriangulos = 0;
  for (const inst of e.instancias) {
    const malha = e.malhas.get(inst.chave);
    if (!malha) continue;
    pecas.push({ chave: inst.chave, malha, inicio: totalDePontos, primeiroTriangulo: totalDeTriangulos });
    totalDePontos += malha.pontos.length / 2;
    totalDeTriangulos += malha.triangulos.length / 3;
  }
  const x = new Float64Array(totalDePontos * 3);
  const massa = new Float64Array(totalDePontos);
  const arestas: number[] = [];
  const comprimentos: number[] = [];
  const complacenciasDasArestas: number[] = [];
  const dobras: number[] = [];
  const comprimentosDasDobras: number[] = [];
  const triangulos = new Uint32Array(totalDeTriangulos * 3);
  const ladosDosTriangulos = new Float64Array(totalDeTriangulos * 3);
  for (const p of pecas) {
    const inst = e.instancias.find((i) => i.chave === p.chave)!;
    const m = p.malha;
    const pos = posicoesDeArrumacao(e.corpo, inst, e.configuracoes[p.chave]!, m.pontos)!;
    x.set(pos, p.inicio * 3);
    const dist2d = (i: number, j: number): number => Math.hypot(m.pontos[2 * i]! - m.pontos[2 * j]!, m.pontos[2 * i + 1]! - m.pontos[2 * j + 1]!);
    for (let k = 0; k < m.triangulos.length; k += 3) {
      const a = m.triangulos[k]!;
      const b = m.triangulos[k + 1]!;
      const c = m.triangulos[k + 2]!;
      const t = p.primeiroTriangulo + k / 3;
      triangulos[3 * t] = p.inicio + a;
      triangulos[3 * t + 1] = p.inicio + b;
      triangulos[3 * t + 2] = p.inicio + c;
      ladosDosTriangulos[3 * t] = dist2d(a, b);
      ladosDosTriangulos[3 * t + 1] = dist2d(b, c);
      ladosDosTriangulos[3 * t + 2] = dist2d(c, a);
      const terco = (m.areas[k / 3]! * parametros.gramasPorMm2) / 3;
      massa[p.inicio + a] = massa[p.inicio + a]! + terco;
      massa[p.inicio + b] = massa[p.inicio + b]! + terco;
      massa[p.inicio + c] = massa[p.inicio + c]! + terco;
    }
    // O fio da peça, na malha (que está nas coordenadas do molde): a direção de cada aresta diz a elasticidade dela.
    const fio = inst.peca.linhaDeFio;
    const fioComprimento = Math.hypot(fio.fim.x - fio.inicio.x, fio.fim.y - fio.inicio.y);
    const gx = fioComprimento > 1e-9 ? (fio.fim.x - fio.inicio.x) / fioComprimento : 1;
    const gy = fioComprimento > 1e-9 ? (fio.fim.y - fio.inicio.y) / fioComprimento : 0;
    for (let k = 0; k < m.arestas.length; k += 2) {
      const i = m.arestas[k]!;
      const j = m.arestas[k + 1]!;
      const comprimento = dist2d(i, j);
      arestas.push(p.inicio + i, p.inicio + j);
      comprimentos.push(comprimento);
      const cos = comprimento > 1e-9 ? ((m.pontos[2 * j]! - m.pontos[2 * i]!) * gx + (m.pontos[2 * j + 1]! - m.pontos[2 * i + 1]!) * gy) / comprimento : 1;
      complacenciasDasArestas.push(complacenciaDaElasticidade(elasticidadeNaDirecao(e.tecido, cos)));
    }
    for (let k = 0; k < m.dobras.length; k += 2) {
      dobras.push(p.inicio + m.dobras[k]!, p.inicio + m.dobras[k + 1]!);
      comprimentosDasDobras.push(dist2d(m.dobras[k]!, m.dobras[k + 1]!));
    }
  }
  // Uma massa mínima por ponto (a quarta parte da média): o ponto de um triângulo muito fino, quase sem área, não fica
  // leve demais (a correção iria toda para ele, e a malha estouraria).
  const media = totalDePontos > 0 ? massa.reduce((s, m) => s + m, 0) / totalDePontos : 0;
  const w = new Float64Array(totalDePontos);
  for (let i = 0; i < totalDePontos; i++) w[i] = media > 0 ? 1 / Math.max(massa[i]!, media * 0.25) : 0;
  // As costuras: cada ponto de um lado com o ponto do outro na mesma fração do trecho.
  const costuraA: number[] = [];
  const costuraB1: number[] = [];
  const costuraB2: number[] = [];
  const costuraF: number[] = [];
  const costuraDistancia0: number[] = [];
  const pecaDe = (chave: string): PecaNaSimulacao | undefined => pecas.find((p) => p.chave === chave);
  const ligar = (de: { p: PecaNaSimulacao; t: ReturnType<typeof trechoDaBorda> }, para: { p: PecaNaSimulacao; t: ReturnType<typeof trechoDaBorda> }, invertida: boolean): void => {
    for (let k = 0; k < de.t.pontos.length; k++) {
      const f0 = de.t.fracoes[k]!;
      const f = invertida ? 1 - f0 : f0;
      // O segmento do outro lado em que a fração cai.
      const fr = para.t.fracoes;
      let j = 0;
      while (j < fr.length - 2 && fr[j + 1]! < f) j++;
      const span = fr[j + 1]! - fr[j]!;
      const g = span > 1e-12 ? Math.min(1, Math.max(0, (f - fr[j]!) / span)) : 0;
      const a = de.p.inicio + de.t.pontos[k]!;
      const b1 = para.p.inicio + para.t.pontos[j]!;
      const b2 = para.p.inicio + para.t.pontos[Math.min(j + 1, para.t.pontos.length - 1)]!;
      if (a === b1 || a === b2) continue;
      costuraA.push(a);
      costuraB1.push(b1);
      costuraB2.push(b2);
      costuraF.push(g);
      const bx = x[3 * b1]! * (1 - g) + x[3 * b2]! * g;
      const by = x[3 * b1 + 1]! * (1 - g) + x[3 * b2 + 1]! * g;
      const bz = x[3 * b1 + 2]! * (1 - g) + x[3 * b2 + 2]! * g;
      costuraDistancia0.push(Math.hypot(x[3 * a]! - bx, x[3 * a + 1]! - by, x[3 * a + 2]! - bz));
    }
  };
  for (const c of e.costuras) {
    const pa = pecaDe(c.a.chave);
    const pb = pecaDe(c.b.chave);
    if (!pa || !pb) continue;
    const ta = trechoDaBorda(pa.malha, c.a.de, c.a.ate);
    const tb = trechoDaBorda(pb.malha, c.b.de, c.b.ate);
    if (ta.pontos.length < 2 || tb.pontos.length < 2) continue;
    ligar({ p: pa, t: ta }, { p: pb, t: tb }, c.invertida);
    ligar({ p: pb, t: tb }, { p: pa, t: ta }, c.invertida);
  }
  return {
    corpo: e.corpo,
    pecas,
    x,
    anterior: Float64Array.from(x),
    v: new Float64Array(totalDePontos * 3),
    w,
    arestas: Uint32Array.from(arestas),
    comprimentos: Float64Array.from(comprimentos),
    complacenciasDasArestas: Float64Array.from(complacenciasDasArestas),
    dobras: Uint32Array.from(dobras),
    comprimentosDasDobras: Float64Array.from(comprimentosDasDobras),
    costuraA: Uint32Array.from(costuraA),
    costuraB1: Uint32Array.from(costuraB1),
    costuraB2: Uint32Array.from(costuraB2),
    costuraF: Float64Array.from(costuraF),
    costuraDistancia0: Float64Array.from(costuraDistancia0),
    triangulos,
    ladosDosTriangulos,
    parametros,
    tempo: 0,
    velocidadeMaxima: Infinity,
    fracaoEmMovimento: 1,
  };
}

/** As distâncias dos pares: `alfa` é a complacência sobre dt² (a mesma para todos), ou a escala de `complacencias` (uma por par). */
function resolverDistancias(x: Float64Array, w: Float64Array, pares: Uint32Array, comprimentos: Float64Array, alfa: number, complacencias: Float64Array | null = null): void {
  for (let k = 0; k < pares.length; k += 2) {
    const i = pares[k]!;
    const j = pares[k + 1]!;
    const wi = w[i]!;
    const wj = w[j]!;
    const ws = wi + wj;
    if (ws === 0) continue;
    const dx = x[3 * i]! - x[3 * j]!;
    const dy = x[3 * i + 1]! - x[3 * j + 1]!;
    const dz = x[3 * i + 2]! - x[3 * j + 2]!;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 1e-9) continue;
    const C = L - comprimentos[k / 2]!;
    const lambda = -C / (ws + (complacencias ? complacencias[k / 2]! * alfa : alfa));
    const fx = (dx / L) * lambda;
    const fy = (dy / L) * lambda;
    const fz = (dz / L) * lambda;
    x[3 * i] = x[3 * i]! + wi * fx;
    x[3 * i + 1] = x[3 * i + 1]! + wi * fy;
    x[3 * i + 2] = x[3 * i + 2]! + wi * fz;
    x[3 * j] = x[3 * j]! - wj * fx;
    x[3 * j + 1] = x[3 * j + 1]! - wj * fy;
    x[3 * j + 2] = x[3 * j + 2]! - wj * fz;
  }
}

/** Avança a simulação `segundos`, em `subpassos` passos pequenos. */
export function avancar(sim: Simulacao, segundos: number, subpassos = 10): void {
  const dt = segundos / subpassos;
  const { x, anterior, v, w, parametros: par } = sim;
  const n = w.length;
  const umSobreDt2 = 1 / (dt * dt);
  const alfaF = par.complacenciaDaFlexao / (dt * dt);
  const alfaC = 1e-8 / (dt * dt);
  const tocou = new Uint8Array(n);
  const normalDoToque = new Float64Array(3 * n);
  let maior = 0;
  let mexendo = 0;
  for (let s = 0; s < subpassos; s++) {
    const costurando = sim.tempo < TEMPO_DA_COSTURA_S;
    const g = costurando ? 0 : GRAVIDADE;
    // Na costura o ar segura mais (as peças se juntam sem sacudir).
    const amortecimento = Math.exp(-(costurando ? 12 : 1.5) * dt);
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue;
      v[3 * i] = v[3 * i]! * amortecimento;
      v[3 * i + 1] = (v[3 * i + 1]! - g * dt) * amortecimento;
      v[3 * i + 2] = v[3 * i + 2]! * amortecimento;
      anterior[3 * i] = x[3 * i]!;
      anterior[3 * i + 1] = x[3 * i + 1]!;
      anterior[3 * i + 2] = x[3 * i + 2]!;
      x[3 * i] = x[3 * i]! + v[3 * i]! * dt;
      x[3 * i + 1] = x[3 * i + 1]! + v[3 * i + 1]! * dt;
      x[3 * i + 2] = x[3 * i + 2]! + v[3 * i + 2]! * dt;
    }
    resolverDistancias(x, w, sim.dobras, sim.comprimentosDasDobras, alfaF);
    // As costuras: a distância de partida vai a zero durante a costura.
    const fracao = Math.max(0, 1 - sim.tempo / (TEMPO_DA_COSTURA_S * 0.8));
    // O estiramento e as costuras, duas vezes por passo (a colisão, que é o que custa, uma só): com uma volta só a
    // conta não chegava lá, e a camiseta pendurada pelos ombros esticava o dobro do real na costura do ombro.
    for (let volta = 0; volta < VOLTAS_POR_PASSO; volta++) {
    resolverDistancias(x, w, sim.arestas, sim.comprimentos, umSobreDt2, sim.complacenciasDasArestas);
    for (let k = 0; k < sim.costuraA.length; k++) {
      const a = sim.costuraA[k]!;
      const b1 = sim.costuraB1[k]!;
      const b2 = sim.costuraB2[k]!;
      const f = sim.costuraF[k]!;
      const wa = w[a]!;
      const w1 = w[b1]! * (1 - f) * (1 - f);
      const w2 = w[b2]! * f * f;
      const ws = wa + w1 + w2;
      if (ws === 0) continue;
      const dx = x[3 * a]! - (x[3 * b1]! * (1 - f) + x[3 * b2]! * f);
      const dy = x[3 * a + 1]! - (x[3 * b1 + 1]! * (1 - f) + x[3 * b2 + 1]! * f);
      const dz = x[3 * a + 2]! - (x[3 * b1 + 2]! * (1 - f) + x[3 * b2 + 2]! * f);
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const alvo = sim.costuraDistancia0[k]! * fracao;
      if (L < 1e-9 || L <= alvo) continue;
      const lambda = -(L - alvo) / (ws + alfaC);
      const nx = (dx / L) * lambda;
      const ny = (dy / L) * lambda;
      const nz = (dz / L) * lambda;
      x[3 * a] = x[3 * a]! + wa * nx;
      x[3 * a + 1] = x[3 * a + 1]! + wa * ny;
      x[3 * a + 2] = x[3 * a + 2]! + wa * nz;
      const k1 = w[b1]! * (1 - f);
      const k2 = w[b2]! * f;
      x[3 * b1] = x[3 * b1]! - k1 * nx;
      x[3 * b1 + 1] = x[3 * b1 + 1]! - k1 * ny;
      x[3 * b1 + 2] = x[3 * b1 + 2]! - k1 * nz;
      x[3 * b2] = x[3 * b2]! - k2 * nx;
      x[3 * b2 + 1] = x[3 * b2 + 1]! - k2 * ny;
      x[3 * b2 + 2] = x[3 * b2 + 2]! - k2 * nz;
    }
    }
    // O corpo e o chão: empurram para fora, com atrito.
    tocou.fill(0);
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue;
      let px = x[3 * i]!;
      let py = x[3 * i + 1]!;
      let pz = x[3 * i + 2]!;
      const c = distanciaAoCorpo(sim.corpo, px, py, pz);
      let nx = 0;
      let ny = 0;
      let nz = 0;
      let fundo = 0;
      if (c.d < par.espessura) {
        fundo = par.espessura - c.d;
        nx = c.nx;
        ny = c.ny;
        nz = c.nz;
      } else if (py < par.espessura) {
        fundo = par.espessura - py;
        ny = 1;
      }
      if (fundo > 0) {
        tocou[i] = 1;
        normalDoToque[3 * i] = nx;
        normalDoToque[3 * i + 1] = ny;
        normalDoToque[3 * i + 2] = nz;
        px += nx * fundo;
        py += ny * fundo;
        pz += nz * fundo;
        // O atrito: tira parte do deslizamento sobre a superfície.
        const mx = px - anterior[3 * i]!;
        const my = py - anterior[3 * i + 1]!;
        const mz = pz - anterior[3 * i + 2]!;
        const normal = mx * nx + my * ny + mz * nz;
        const tx = mx - normal * nx;
        const ty = my - normal * ny;
        const tz = mz - normal * nz;
        const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tl > 1e-12) {
          // Na costura o tecido desliza solto (como a peça que se veste): com atrito ele ficava preso esticado onde encostou.
          const corte = Math.min(1, ((costurando ? ATRITO_NA_COSTURA : 1) * par.atrito * fundo) / tl);
          px -= tx * corte;
          py -= ty * corte;
          pz -= tz * corte;
        }
        // Empurrado para fora de um pedaço do corpo, o ponto pode ter entrado no outro (na axila, entre as pernas):
        // confere de novo, até três vezes.
        for (let volta = 0; volta < 3; volta++) {
          const c2 = distanciaAoCorpo(sim.corpo, px, py, pz);
          if (c2.d >= par.espessura) break;
          px += c2.nx * (par.espessura - c2.d);
          py += c2.ny * (par.espessura - c2.d);
          pz += c2.nz * (par.espessura - c2.d);
        }
        x[3 * i] = px;
        x[3 * i + 1] = py;
        x[3 * i + 2] = pz;
      }
    }
    for (let i = 0; i < n; i++) {
      let vx = (x[3 * i]! - anterior[3 * i]!) / dt;
      let vy = (x[3 * i + 1]! - anterior[3 * i + 1]!) / dt;
      let vz = (x[3 * i + 2]! - anterior[3 * i + 2]!) / dt;
      // O empurrão do corpo não vira velocidade para fora (o tecido não quica): sem isso, na axila, entre o braço e o
      // tronco, os empurrões se somavam e lançavam o ponto longe.
      if (tocou[i]) {
        const nx = normalDoToque[3 * i]!;
        const ny = normalDoToque[3 * i + 1]!;
        const nz = normalDoToque[3 * i + 2]!;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn > 0) {
          vx -= vn * nx;
          vy -= vn * ny;
          vz -= vn * nz;
        }
      }
      // E nenhum ponto passa de 3 m/s: um tecido assentando nunca anda tão rápido.
      const rapidez = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (rapidez > VELOCIDADE_MAXIMA) {
        vx *= VELOCIDADE_MAXIMA / rapidez;
        vy *= VELOCIDADE_MAXIMA / rapidez;
        vz *= VELOCIDADE_MAXIMA / rapidez;
      }
      v[3 * i] = vx;
      v[3 * i + 1] = vy;
      v[3 * i + 2] = vz;
      if (s === subpassos - 1) {
        const r = Math.sqrt(vx * vx + vy * vy + vz * vz);
        maior = Math.max(maior, r);
        if (r >= PARADO_MM_S) mexendo++;
      }
    }
    sim.tempo += dt;
  }
  sim.velocidadeMaxima = maior;
  sim.fracaoEmMovimento = n > 0 ? mexendo / n : 0;
}

/**
 * Os botões (e os ilhoses) das peças: cada furo do molde, preso ao triângulo da malha em que o meio dele cai (para
 * acompanhar o tecido). O raio é o do furo (de 4 mm para cima).
 */
export function botoesDaSimulacao(sim: Simulacao, instancias: readonly InstanciaDaPeca[]): { triangulo: number; b1: number; b2: number; raio: number }[] {
  const botoes: { triangulo: number; b1: number; b2: number; raio: number }[] = [];
  for (const p of sim.pecas) {
    const inst = instancias.find((i) => i.chave === p.chave);
    if (!inst) continue;
    const m = p.malha;
    for (const furo of inst.peca.furos) {
      if (furo.length === 0) continue;
      const cx = furo.reduce((s, q) => s + q.x, 0) / furo.length;
      const cy = furo.reduce((s, q) => s + q.y, 0) / furo.length;
      const raio = Math.max(4, furo.reduce((s, q) => s + Math.hypot(q.x - cx, q.y - cy), 0) / furo.length);
      for (let k = 0; k < m.triangulos.length; k += 3) {
        const a = m.triangulos[k]!;
        const b = m.triangulos[k + 1]!;
        const c = m.triangulos[k + 2]!;
        const ax = m.pontos[2 * a]!;
        const ay = m.pontos[2 * a + 1]!;
        const bx = m.pontos[2 * b]! - ax;
        const by = m.pontos[2 * b + 1]! - ay;
        const qx = m.pontos[2 * c]! - ax;
        const qy = m.pontos[2 * c + 1]! - ay;
        const det = bx * qy - qx * by;
        if (Math.abs(det) < 1e-12) continue;
        const px = cx - ax;
        const py = cy - ay;
        const b1 = (px * qy - qx * py) / det;
        const b2 = (bx * py - px * by) / det;
        if (b1 >= -1e-9 && b2 >= -1e-9 && b1 + b2 <= 1 + 1e-9) {
          botoes.push({ triangulo: p.primeiroTriangulo + k / 3, b1, b2, raio });
          break;
        }
      }
    }
  }
  return botoes;
}

/** A simulação parou: passou a costura e o tecido quase não se mexe. */
export function assentou(sim: Simulacao): boolean {
  // Menos de 2% dos pontos ainda se mexendo: uns poucos tremendo numa junção (a axila) não seguram a simulação até o fim.
  return sim.tempo > TEMPO_DA_COSTURA_S + 0.5 && sim.fracaoEmMovimento < 0.02;
}

/** O quanto cada triângulo está esticado (a maior aresta: 0,05 = 5% mais comprida que no molde; negativo: encolhida). */
export function tensoes(sim: Simulacao): Float32Array {
  const T = sim.triangulos.length / 3;
  const r = new Float32Array(T);
  const x = sim.x;
  for (let t = 0; t < T; t++) {
    const a = sim.triangulos[3 * t]!;
    const b = sim.triangulos[3 * t + 1]!;
    const c = sim.triangulos[3 * t + 2]!;
    const L = (i: number, j: number): number => Math.hypot(x[3 * i]! - x[3 * j]!, x[3 * i + 1]! - x[3 * j + 1]!, x[3 * i + 2]! - x[3 * j + 2]!);
    const s1 = L(a, b) / sim.ladosDosTriangulos[3 * t]! - 1;
    const s2 = L(b, c) / sim.ladosDosTriangulos[3 * t + 1]! - 1;
    const s3 = L(c, a) / sim.ladosDosTriangulos[3 * t + 2]! - 1;
    r[t] = Math.max(s1, s2, s3);
  }
  return r;
}

/** De que altura a que altura do chão o tecido vai (mm), e as peças que escorregaram do corpo (o alto delas abaixo do gancho). */
export function alturasDoTecido(sim: Simulacao): { readonly de: number; readonly ate: number; readonly caidas: readonly string[] } {
  let de = Infinity;
  let ate = -Infinity;
  const caidas: string[] = [];
  for (const p of sim.pecas) {
    let alto = -Infinity;
    const n = p.malha.pontos.length / 2;
    for (let i = p.inicio; i < p.inicio + n; i++) {
      const y = sim.x[3 * i + 1]!;
      de = Math.min(de, y);
      ate = Math.max(ate, y);
      alto = Math.max(alto, y);
    }
    if (alto < sim.corpo.niveis.gancho) caidas.push(p.chave);
  }
  return { de: Number.isFinite(de) ? de : 0, ate: Number.isFinite(ate) ? ate : 0, caidas };
}

/** A maior distância que ainda falta fechar nas costuras (mm). */
export function aberturaDasCosturas(sim: Simulacao): number {
  let maior = 0;
  const x = sim.x;
  for (let k = 0; k < sim.costuraA.length; k++) {
    const a = sim.costuraA[k]!;
    const b1 = sim.costuraB1[k]!;
    const b2 = sim.costuraB2[k]!;
    const f = sim.costuraF[k]!;
    const d = Math.hypot(
      x[3 * a]! - (x[3 * b1]! * (1 - f) + x[3 * b2]! * f),
      x[3 * a + 1]! - (x[3 * b1 + 1]! * (1 - f) + x[3 * b2 + 1]! * f),
      x[3 * a + 2]! - (x[3 * b1 + 2]! * (1 - f) + x[3 * b2 + 2]! * f),
    );
    maior = Math.max(maior, d);
  }
  return maior;
}

/** Quanto o tecido entra no corpo no pior ponto (mm; 0: nada entra). */
export function maiorPenetracao(sim: Simulacao): number {
  let pior = 0;
  for (let i = 0; i < sim.w.length; i++) {
    const d = distanciaAoCorpo(sim.corpo, sim.x[3 * i]!, sim.x[3 * i + 1]!, sim.x[3 * i + 2]!).d;
    pior = Math.max(pior, -d);
  }
  return pior;
}
