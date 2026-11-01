import type { CorpoDoManequim } from './manequim';
import { lerCampo } from './corpoHumano';
import { corpoDoManequim, distanciaAoCorpo, grade } from './manequim';
import type { MalhaDaPeca } from './malhaDaPeca';
import { trechoDaBorda } from './malhaDaPeca';
import type { ConfiguracaoDaInstancia, Costura3D, InstanciaDaPeca, Tecido3D } from './montagem3d';
import { pontosCosturadosDaPecaDeCima, pontosNaPecaDeBaixo, posicoesDeArrumacao } from './montagem3d';

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
  /** O corpo na pose pedida. */
  readonly corpo: CorpoDoManequim;
  /** O corpo de agora: veste na pose de vestir e vai aos poucos para a pedida (ADR 0230). */
  corpoAgora: CorpoDoManequim;
  /** Os corpos do caminho entre as duas poses, na ordem; vazio se a pose já é a de vestir. */
  corposDoCaminho: readonly CorpoDoManequim[];
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
  /**
   * As peças de cima (o bolso) costuradas na de baixo por dentro dela (ADR 0123): o ponto da borda da de cima e o ponto
   * da de baixo dentro de um triângulo (os três pontos e os pesos); a distância de partida.
   */
  readonly aplicacaoA: Uint32Array;
  readonly aplicacaoT: Uint32Array;
  readonly aplicacaoPesos: Float64Array;
  readonly aplicacaoDistancia0: Float64Array;
  /** Os pontos do lado A de cada costura, na ordem do trecho (nos números da simulação): onde vai o zíper (ADR 0132). */
  readonly cadeiasDasCosturas: ReadonlyArray<{ readonly id: string; readonly pontos: Uint32Array }>;
  /** A camada de cada ponto: 0 no corpo, 1 sobre outra peça (fica mais longe do corpo: por cima da de baixo). */
  readonly camada: Uint8Array;
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
/** Depois de vestir, a pose muda neste intervalo (s): com o tecido já pendurado, os braços descem por fora dele. */
export const INICIO_DA_POSE_S = 2;
export const FIM_DA_POSE_S = 3;
/** A mão anda no máximo isto (mm) de um corpo do caminho ao outro: mais, e o braço pularia o pano da manga. */
const PASSO_DA_MAO_MM = 30;
const MAIOR_NUMERO_DE_PASSOS = 14;
/** A distância de partida da peça de cima à de baixo (mm), para fora. */
const AFASTAMENTO_DA_CAMADA = 4;
const GRAVIDADE = 9810;
/** A maior velocidade de um ponto do tecido (mm/s). */
const VELOCIDADE_MAXIMA = 3000;
/** No aperto, a complacência da aresta vale tantas vezes a do esticar, e nunca menos que a mínima. */
const CEDE_AO_APERTO = 40;
const COMPLACENCIA_DO_APERTO = 2e-4;
/** O aperto (a fração do comprimento) em que a aresta começa a ceder, em que cede de todo e em que volta a resistir. */
const INICIO_DO_APERTO = 0.01;
const FIM_DO_APERTO = 0.04;
const LIMITE_DO_APERTO = 0.14;
/** O empurrão (mm/s) que tira o tecido do plano perfeito quando o peso entra: sem ele, nada faz a primeira dobra nascer. */
const EMPURRAO_DO_CAIMENTO = 60;
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
  /** O corpo na pose pedida (a roupa é vestida na de vestir e o corpo vai até ela). */
  readonly corpo: CorpoDoManequim;
  readonly instancias: readonly InstanciaDaPeca[];
  readonly configuracoes: Readonly<Record<string, ConfiguracaoDaInstancia>>;
  readonly malhas: ReadonlyMap<string, MalhaDaPeca>;
  readonly costuras: readonly Costura3D[];
  readonly tecido: Tecido3D;
}

/** Os corpos do caminho da pose de vestir à pedida, com o de vestir no começo e o pedido no fim. */
function caminhoDaPose(corpo: CorpoDoManequim): readonly CorpoDoManequim[] {
  if (corpo.pose === 'padrao') return [];
  const de = corpoDoManequim(corpo.medidas, corpo.pose, corpo.publico, 0);
  const a = de.bracos.esquerdo.fim;
  const b = corpo.bracos.esquerdo.fim;
  const passos = Math.min(MAIOR_NUMERO_DE_PASSOS, Math.max(2, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / PASSO_DA_MAO_MM)));
  const lista: CorpoDoManequim[] = [de];
  for (let k = 1; k < passos; k++) lista.push(corpoDoManequim(corpo.medidas, corpo.pose, corpo.publico, k / passos));
  lista.push(corpo);
  return lista;
}

/** Monta a simulação: as peças postas em volta do corpo, as restrições e as costuras. */
export function montarSimulacao(entrada: EntradaDaSimulacao): Simulacao {
  const corposDoCaminho = caminhoDaPose(entrada.corpo);
  // A roupa é vestida com os braços afastados: a arrumação e as contas abaixo usam esse corpo.
  const e: EntradaDaSimulacao = corposDoCaminho.length > 0 ? { ...entrada, corpo: corposDoCaminho[0]! } : entrada;
  const parametros = parametrosDoTecido(e.tecido);
  const pecas: PecaNaSimulacao[] = [];
  let totalDePontos = 0;
  let totalDeTriangulos = 0;
  // A peça de cima entra se a de baixo está no corpo (e não é ela também de cima).
  const deBaixoNoCorpo = (chave: string): boolean => {
    const c = e.configuracoes[chave];
    return !!c && c.posicao !== 'fora' && c.posicao !== 'sobre-outra-peca' && e.malhas.has(chave);
  };
  for (const inst of e.instancias) {
    const malha = e.malhas.get(inst.chave);
    if (!malha) continue;
    const config = e.configuracoes[inst.chave];
    if (config?.posicao === 'sobre-outra-peca' && !(config.sobre && deBaixoNoCorpo(config.sobre.chave))) continue;
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
  const camada = new Uint8Array(totalDePontos);
  const aplicacaoA: number[] = [];
  const aplicacaoT: number[] = [];
  const aplicacaoPesos: number[] = [];
  const aplicacaoDistancia0: number[] = [];
  // As peças no corpo primeiro; as de cima depois, sobre a de baixo já posta.
  const ordem = [...pecas].sort((a, b) => Number(e.configuracoes[a.chave]!.posicao === 'sobre-outra-peca') - Number(e.configuracoes[b.chave]!.posicao === 'sobre-outra-peca'));
  for (const p of ordem) {
    const inst = e.instancias.find((i) => i.chave === p.chave)!;
    const m = p.malha;
    const config = e.configuracoes[p.chave]!;
    if (config.posicao === 'sobre-outra-peca') {
      // A peça de cima (ADR 0123): cada ponto no lugar da de baixo onde cai, um pouco para fora do corpo.
      const sobre = config.sobre!;
      const baixo = pecas.find((q) => q.chave === sobre.chave)!;
      const instBaixo = e.instancias.find((i) => i.chave === sobre.chave)!;
      const locais = pontosNaPecaDeBaixo({ inst, girarGraus: config.girarGraus, pontos: m.pontos }, { inst: instBaixo, girarGraus: e.configuracoes[sobre.chave]!.girarGraus, malha: baixo.malha }, sobre);
      const vertices = (k: number): [number, number, number] => {
        const t = locais[k]!.triangulo;
        return [baixo.inicio + baixo.malha.triangulos[3 * t]!, baixo.inicio + baixo.malha.triangulos[3 * t + 1]!, baixo.inicio + baixo.malha.triangulos[3 * t + 2]!];
      };
      for (let k = 0; k < locais.length; k++) {
        const [i0, i1, i2] = vertices(k);
        const [b0, b1, b2] = locais[k]!.pesos;
        let px = x[3 * i0]! * b0 + x[3 * i1]! * b1 + x[3 * i2]! * b2;
        let py = x[3 * i0 + 1]! * b0 + x[3 * i1 + 1]! * b1 + x[3 * i2 + 1]! * b2;
        let pz = x[3 * i0 + 2]! * b0 + x[3 * i1 + 2]! * b1 + x[3 * i2 + 2]! * b2;
        const fora = distanciaAoCorpo(e.corpo, px, py, pz);
        px += fora.nx * AFASTAMENTO_DA_CAMADA;
        py += fora.ny * AFASTAMENTO_DA_CAMADA;
        pz += fora.nz * AFASTAMENTO_DA_CAMADA;
        x[3 * (p.inicio + k)] = px;
        x[3 * (p.inicio + k) + 1] = py;
        x[3 * (p.inicio + k) + 2] = pz;
        camada[p.inicio + k] = 1;
      }
      for (const k of pontosCosturadosDaPecaDeCima(inst, config.girarGraus, m, sobre.bocaEmCima)) {
        const [i0, i1, i2] = vertices(k);
        aplicacaoA.push(p.inicio + k);
        aplicacaoT.push(i0, i1, i2);
        aplicacaoPesos.push(...locais[k]!.pesos);
        aplicacaoDistancia0.push(AFASTAMENTO_DA_CAMADA);
      }
    } else {
      x.set(posicoesDeArrumacao(e.corpo, inst, config, m.pontos)!, p.inicio * 3);
    }
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
  const cadeiasDasCosturas: { id: string; pontos: Uint32Array }[] = [];
  /** O ponto da peça, vizinho de `ponto`, que mais entra nela a partir do trecho da costura. */
  const pontoDeDentro = (p: PecaNaSimulacao, ponto: number, trecho: ReadonlySet<number>): number | null => {
    const tri = p.malha.triangulos;
    const pts = p.malha.pontos;
    let melhor: number | null = null;
    let maior = -1;
    for (let k = 0; k < tri.length; k++) {
      if (tri[k] !== ponto) continue;
      const base = k - (k % 3);
      for (let q = base; q < base + 3; q++) {
        const o = tri[q]!;
        if (o === ponto || trecho.has(o)) continue;
        const d = Math.hypot(pts[2 * o]! - pts[2 * ponto]!, pts[2 * o + 1]! - pts[2 * ponto + 1]!);
        if (d > maior) {
          maior = d;
          melhor = o;
        }
      }
    }
    return melhor;
  };
  /**
   * A costura resiste a dobrar (ADR 0230): as duas folgas costuradas por dentro fazem dela o trecho mais firme do pano.
   * Sem isso ela era uma dobradiça solta, e a frente e as costas fechavam uma sobre a outra como um saco vazio. Cada ponto
   * do trecho ganha uma dobra entre o vizinho de dentro de um lado e o do outro, como se a peça continuasse pela costura.
   */
  const dobrarNaCostura = (a: { p: PecaNaSimulacao; t: ReturnType<typeof trechoDaBorda> }, b: { p: PecaNaSimulacao; t: ReturnType<typeof trechoDaBorda> }, invertida: boolean): void => {
    const noTrechoA = new Set(a.t.pontos);
    const noTrechoB = new Set(b.t.pontos);
    for (let k = 0; k < a.t.pontos.length; k++) {
      const f = invertida ? 1 - a.t.fracoes[k]! : a.t.fracoes[k]!;
      let j = 0;
      while (j < b.t.pontos.length - 1 && Math.abs(b.t.fracoes[j + 1]! - f) < Math.abs(b.t.fracoes[j]! - f)) j++;
      const pa = a.t.pontos[k]!;
      const pb = b.t.pontos[j]!;
      const oa = pontoDeDentro(a.p, pa, noTrechoA);
      const ob = pontoDeDentro(b.p, pb, noTrechoB);
      if (oa === null || ob === null) continue;
      const da = Math.hypot(a.p.malha.pontos[2 * oa]! - a.p.malha.pontos[2 * pa]!, a.p.malha.pontos[2 * oa + 1]! - a.p.malha.pontos[2 * pa + 1]!);
      const db = Math.hypot(b.p.malha.pontos[2 * ob]! - b.p.malha.pontos[2 * pb]!, b.p.malha.pontos[2 * ob + 1]! - b.p.malha.pontos[2 * pb + 1]!);
      dobras.push(a.p.inicio + oa, b.p.inicio + ob);
      comprimentosDasDobras.push(da + db);
    }
  };
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
    dobrarNaCostura({ p: pa, t: ta }, { p: pb, t: tb }, c.invertida);
    cadeiasDasCosturas.push({ id: c.id, pontos: Uint32Array.from(ta.pontos, (k) => pa.inicio + k) });
  }
  return {
    corpo: entrada.corpo,
    corpoAgora: e.corpo,
    corposDoCaminho,
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
    aplicacaoA: Uint32Array.from(aplicacaoA),
    aplicacaoT: Uint32Array.from(aplicacaoT),
    aplicacaoPesos: Float64Array.from(aplicacaoPesos),
    aplicacaoDistancia0: Float64Array.from(aplicacaoDistancia0),
    cadeiasDasCosturas,
    camada,
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
    const repouso = comprimentos[k / 2]!;
    const C = L - repouso;
    // O pano resiste a esticar, mas quase não resiste a ser apertado: ele enruga. Sem isso a malha trava, cada triângulo
    // defende as três arestas, e o tecido cai como papelão. A mudança é gradual: uma quina no comprimento de repouso faria
    // a aresta tremer em volta dele. Passado o limite, o encolhido volta a resistir.
    let complacencia = complacencias ? complacencias[k / 2]! * alfa : alfa;
    if (complacencias && C < 0 && C > -LIMITE_DO_APERTO * repouso) {
      const a = (-C / repouso - INICIO_DO_APERTO) / (FIM_DO_APERTO - INICIO_DO_APERTO);
      if (a > 0) {
        const macia = Math.max(complacencia * CEDE_AO_APERTO, alfa * COMPLACENCIA_DO_APERTO);
        const f = a >= 1 ? 1 : a * a * (3 - 2 * a);
        complacencia += (macia - complacencia) * f * (1 - Math.max(0, (-C / repouso - FIM_DO_APERTO) / (LIMITE_DO_APERTO - FIM_DO_APERTO)));
      }
    }
    const lambda = -C / (ws + complacencia);
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

/**
 * As peças de cima costuradas na de baixo (ADR 0123): cada ponto da borda vai ao seu ponto dentro do triângulo da de
 * baixo (a distância de partida vai a zero durante a costura); a correção se reparte entre o ponto e os três de baixo,
 * pelos pesos e pelas massas.
 */
function resolverAplicacoes(sim: Simulacao, fracao: number, alfa: number): void {
  const { x, w } = sim;
  for (let k = 0; k < sim.aplicacaoA.length; k++) {
    const a = sim.aplicacaoA[k]!;
    const i0 = sim.aplicacaoT[3 * k]!;
    const i1 = sim.aplicacaoT[3 * k + 1]!;
    const i2 = sim.aplicacaoT[3 * k + 2]!;
    const b0 = sim.aplicacaoPesos[3 * k]!;
    const b1 = sim.aplicacaoPesos[3 * k + 1]!;
    const b2 = sim.aplicacaoPesos[3 * k + 2]!;
    const ws = w[a]! + b0 * b0 * w[i0]! + b1 * b1 * w[i1]! + b2 * b2 * w[i2]!;
    if (ws === 0) continue;
    const dx = x[3 * a]! - (x[3 * i0]! * b0 + x[3 * i1]! * b1 + x[3 * i2]! * b2);
    const dy = x[3 * a + 1]! - (x[3 * i0 + 1]! * b0 + x[3 * i1 + 1]! * b1 + x[3 * i2 + 1]! * b2);
    const dz = x[3 * a + 2]! - (x[3 * i0 + 2]! * b0 + x[3 * i1 + 2]! * b1 + x[3 * i2 + 2]! * b2);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const alvo = sim.aplicacaoDistancia0[k]! * fracao;
    if (L < 1e-9 || L <= alvo) continue;
    const lambda = -(L - alvo) / (ws + alfa);
    const nx = (dx / L) * lambda;
    const ny = (dy / L) * lambda;
    const nz = (dz / L) * lambda;
    x[3 * a] = x[3 * a]! + w[a]! * nx;
    x[3 * a + 1] = x[3 * a + 1]! + w[a]! * ny;
    x[3 * a + 2] = x[3 * a + 2]! + w[a]! * nz;
    for (const [i, b] of [
      [i0, b0],
      [i1, b1],
      [i2, b2],
    ] as const) {
      const f = w[i]! * b;
      x[3 * i] = x[3 * i]! - f * nx;
      x[3 * i + 1] = x[3 * i + 1]! - f * ny;
      x[3 * i + 2] = x[3 * i + 2]! - f * nz;
    }
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
  let candidatos: Uint32Array | null = null;
  if (sim.corposDoCaminho.length > 0 && sim.tempo >= INICIO_DA_POSE_S) {
    const lista = sim.corposDoCaminho;
    const k = Math.min(lista.length - 1, Math.floor(((sim.tempo - INICIO_DA_POSE_S) / (FIM_DA_POSE_S - INICIO_DA_POSE_S)) * (lista.length - 1)));
    sim.corpoAgora = lista[k]!;
    // Chegou: os corpos do caminho (e as grades deles) não servem mais.
    if (k === lista.length - 1) sim.corposDoCaminho = [];
  }
  const campo = grade(sim.corpoAgora);
  const leitura = new Float64Array(4);
  for (let s = 0; s < subpassos; s++) {
    const costurando = sim.tempo < TEMPO_DA_COSTURA_S;
    if (!costurando && sim.tempo - dt < TEMPO_DA_COSTURA_S) {
      // Uma ondulação pela posição, sem sorteio: a mesma roupa cai sempre igual.
      for (let i = 0; i < n; i++) {
        v[3 * i] = v[3 * i]! + EMPURRAO_DO_CAIMENTO * Math.sin(0.043 * x[3 * i + 1]! + 0.11 * x[3 * i + 2]! + 1.3) * Math.sin(0.09 * x[3 * i]! + 0.7);
        v[3 * i + 2] = v[3 * i + 2]! + EMPURRAO_DO_CAIMENTO * Math.sin(0.037 * x[3 * i + 1]! + 0.13 * x[3 * i]! + 2.1) * Math.sin(0.08 * x[3 * i + 2]! + 0.4);
      }
    }
    const g = costurando ? 0 : GRAVIDADE;
    // Na costura o ar segura mais (as peças se juntam sem sacudir).
    const amortecimento = Math.exp(-(costurando ? 12 : 3) * dt);
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
    resolverAplicacoes(sim, fracao, alfaC);
    }
    // O corpo e o chão: empurram para fora, com atrito.
    tocou.fill(0);
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue;
      let px = x[3 * i]!;
      let py = x[3 * i + 1]!;
      let pz = x[3 * i + 2]!;
      lerCampo(campo, px, py, pz, leitura);
      // A peça de cima guarda o dobro: fica por cima da de baixo, que encosta no corpo.
      const espessura = par.espessura * (1 + sim.camada[i]!);
      let nx = 0;
      let ny = 0;
      let nz = 0;
      let fundo = 0;
      if (leitura[0]! < espessura) {
        fundo = espessura - leitura[0]!;
        nx = leitura[1]!;
        ny = leitura[2]!;
        nz = leitura[3]!;
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
          lerCampo(campo, px, py, pz, leitura);
          if (leitura[0]! >= espessura) break;
          px += leitura[1]! * (espessura - leitura[0]!);
          py += leitura[2]! * (espessura - leitura[0]!);
          pz += leitura[3]! * (espessura - leitura[0]!);
        }
        x[3 * i] = px;
        x[3 * i + 1] = py;
        x[3 * i + 2] = pz;
      }
    }
    // O tecido sobre o próprio tecido (ADR 0146), depois da costura (durante ela, as peças ainda se juntam): os pares
    // que podem se encostar são buscados uma vez por quadro (é o que custa) e afastados em cada passo.
    if (!costurando && !semAutoColisao.has(sim)) {
      const a = autoColisaoDaSimulacao(sim);
      candidatos ??= paresCandidatos(x, w, a);
      separarOTecido(x, w, a, candidatos, tocou, normalDoToque);
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
  // Menos de 5% dos pontos ainda se mexendo: uns poucos tremendo numa junção (a axila) não seguram a simulação até o fim.
  return sim.tempo > TEMPO_DA_COSTURA_S + 0.5 && sim.corposDoCaminho.length === 0 && sim.fracaoEmMovimento < 0.05;
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
  // E as peças de cima costuradas na de baixo (ADR 0123).
  for (let k = 0; k < sim.aplicacaoA.length; k++) {
    const a = sim.aplicacaoA[k]!;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    for (let j = 0; j < 3; j++) {
      const i = sim.aplicacaoT[3 * k + j]!;
      const b = sim.aplicacaoPesos[3 * k + j]!;
      tx += x[3 * i]! * b;
      ty += x[3 * i + 1]! * b;
      tz += x[3 * i + 2]! * b;
    }
    maior = Math.max(maior, Math.hypot(x[3 * a]! - tx, x[3 * a + 1]! - ty, x[3 * a + 2]! - tz));
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

/**
 * O tecido sobre o próprio tecido (ADR 0146): dois pontos que chegam mais perto que o raio (meio passo da malha, ao
 * menos o dobro da espessura) são afastados — a barra que dobra sobre si, a peça de trás que encosta na da frente. Não
 * contam os pares que podem chegar perto:
 * - os vizinhos no próprio molde (até 2,5 raios de distância no molde);
 * - em peças diferentes, os pontos a até 3 raios (no molde) de uma costura: a costura junta as peças ali, e as
 *   pontas (a axila, onde a manga encontra a frente e as costas) se apertam;
 * - os de camadas diferentes (o bolso costurado sobre a frente).
 */
export interface AutoColisao {
  readonly raio: number;
  readonly pecaDoPonto: Uint32Array;
  /** A posição de cada ponto no molde (x, y seguidos). */
  readonly molde: Float64Array;
  readonly pertoDaCostura: Uint8Array;
  readonly camada: Uint8Array;
}

const autoColisoes = new WeakMap<Simulacao, AutoColisao>();
const semAutoColisao = new WeakSet<Simulacao>();

/** Desliga (ou religa) o tecido sobre o próprio tecido nesta simulação: o cálculo fica mais rápido, e o tecido pode atravessar a si mesmo. */
export function ligarAutoColisao(sim: Simulacao, ligada: boolean): void {
  if (ligada) semAutoColisao.delete(sim);
  else semAutoColisao.add(sim);
}

export function autoColisaoDaSimulacao(sim: Simulacao): AutoColisao {
  const pronta = autoColisoes.get(sim);
  if (pronta) return pronta;
  const n = sim.w.length;
  const pecaDoPonto = new Uint32Array(n);
  const molde = new Float64Array(2 * n);
  sim.pecas.forEach((p, k) => {
    const m = p.malha.pontos.length / 2;
    for (let i = 0; i < m; i++) {
      pecaDoPonto[p.inicio + i] = k;
      molde[2 * (p.inicio + i)] = p.malha.pontos[2 * i]!;
      molde[2 * (p.inicio + i) + 1] = p.malha.pontos[2 * i + 1]!;
    }
  });
  const naCostura = new Uint8Array(n);
  for (const lista of [sim.costuraA, sim.costuraB1, sim.costuraB2, sim.aplicacaoA, sim.aplicacaoT]) for (const i of lista) naCostura[i] = 1;
  let soma = 0;
  for (const c of sim.comprimentos) soma += c;
  const media = sim.comprimentos.length > 0 ? soma / sim.comprimentos.length : 20;
  const raio = Math.max(2 * sim.parametros.espessura, 0.5 * media);
  // Perto da costura: a até 3 raios, no molde da própria peça, de um ponto costurado.
  const pertoDaCostura = new Uint8Array(n);
  const limite = (3 * raio) ** 2;
  sim.pecas.forEach((p) => {
    const m = p.malha.pontos.length / 2;
    const costurados: number[] = [];
    for (let i = p.inicio; i < p.inicio + m; i++) if (naCostura[i]) costurados.push(i);
    for (let i = p.inicio; i < p.inicio + m; i++) {
      for (const c of costurados) {
        const dx = molde[2 * i]! - molde[2 * c]!;
        const dy = molde[2 * i + 1]! - molde[2 * c + 1]!;
        if (dx * dx + dy * dy <= limite) {
          pertoDaCostura[i] = 1;
          break;
        }
      }
    }
  });
  const a: AutoColisao = { raio, pecaDoPonto, molde, pertoDaCostura, camada: sim.camada };
  autoColisoes.set(sim, a);
  return a;
}

function parConta(a: AutoColisao, i: number, j: number): boolean {
  if (a.camada[i] !== a.camada[j]) return false;
  if (a.pecaDoPonto[i] === a.pecaDoPonto[j]) {
    // A peça costurada nela mesma (as duas beiradas da manga, embaixo do braço): perto da costura, os dois lados se juntam.
    if (a.pertoDaCostura[i] && a.pertoDaCostura[j]) return false;
    const dx = a.molde[2 * i]! - a.molde[2 * j]!;
    const dy = a.molde[2 * i + 1]! - a.molde[2 * j + 1]!;
    return dx * dx + dy * dy > (2.5 * a.raio) ** 2;
  }
  return !a.pertoDaCostura[i] && !a.pertoDaCostura[j];
}

/** Os pares que contam e estão mais perto que `alcance`, pela grade de células desse tamanho. */
function paresPerto(
  x: Float64Array,
  w: Float64Array,
  a: AutoColisao,
  alcance: number,
  visitar: (i: number, j: number, d: number, dx: number, dy: number, dz: number) => void,
): void {
  const n = w.length;
  const h = alcance;
  const chave = (ix: number, iy: number, iz: number): number => ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) | 0;
  const celulas = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const k = chave(Math.floor(x[3 * i]! / h), Math.floor(x[3 * i + 1]! / h), Math.floor(x[3 * i + 2]! / h));
    const lista = celulas.get(k);
    if (lista) lista.push(i);
    else celulas.set(k, [i]);
  }
  const vistas = new Set<number>();
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(x[3 * i]! / h);
    const cy = Math.floor(x[3 * i + 1]! / h);
    const cz = Math.floor(x[3 * i + 2]! / h);
    vistas.clear();
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (let oz = -1; oz <= 1; oz++) {
          const k = chave(cx + ox, cy + oy, cz + oz);
          // Duas células com a mesma chave: a lista é vista uma vez só.
          if (vistas.has(k)) continue;
          vistas.add(k);
          for (const j of celulas.get(k) ?? []) {
            if (j <= i) continue;
            const dx = x[3 * i]! - x[3 * j]!;
            const dy = x[3 * i + 1]! - x[3 * j + 1]!;
            const dz = x[3 * i + 2]! - x[3 * j + 2]!;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= h * h || !parConta(a, i, j)) continue;
            visitar(i, j, Math.sqrt(d2), dx, dy, dz);
          }
        }
  }
}

/** Os pares que podem se encostar no próximo quadro: os que contam, a até 1,5 raio (a busca, que custa, é uma por quadro). */
export function paresCandidatos(x: Float64Array, w: Float64Array, a: AutoColisao): Uint32Array {
  const pares: number[] = [];
  paresPerto(x, w, a, 1.5 * a.raio, (i, j) => pares.push(i, j));
  return Uint32Array.from(pares);
}

/**
 * Afasta até o raio os pares (de `paresCandidatos`) que estão mais perto que ele; devolve quantos foram afastados. Com
 * `tocou` e `normal`, marca a direção do empurrão de cada ponto: como no corpo, ele não vira velocidade para fora (o
 * tecido não quica em si mesmo).
 */
export function separarOTecido(
  x: Float64Array,
  w: Float64Array,
  a: AutoColisao,
  pares: Uint32Array = paresCandidatos(x, w, a),
  tocou: Uint8Array | null = null,
  normal: Float64Array | null = null,
): number {
  let afastados = 0;
  const h = a.raio;
  for (let k = 0; k < pares.length; k += 2) {
    const i = pares[k]!;
    const j = pares[k + 1]!;
    const dx = x[3 * i]! - x[3 * j]!;
    const dy = x[3 * i + 1]! - x[3 * j + 1]!;
    const dz = x[3 * i + 2]! - x[3 * j + 2]!;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ws = w[i]! + w[j]!;
    if (d >= h || d < 1e-9 || ws === 0) continue;
    const c = (h - d) / (d * ws);
    x[3 * i] = x[3 * i]! + w[i]! * c * dx;
    x[3 * i + 1] = x[3 * i + 1]! + w[i]! * c * dy;
    x[3 * i + 2] = x[3 * i + 2]! + w[i]! * c * dz;
    x[3 * j] = x[3 * j]! - w[j]! * c * dx;
    x[3 * j + 1] = x[3 * j + 1]! - w[j]! * c * dy;
    x[3 * j + 2] = x[3 * j + 2]! - w[j]! * c * dz;
    if (tocou && normal) {
      for (const [p, s] of [
        [i, 1],
        [j, -1],
      ] as const) {
        tocou[p] = 1;
        normal[3 * p] = (s * dx) / d;
        normal[3 * p + 1] = (s * dy) / d;
        normal[3 * p + 2] = (s * dz) / d;
      }
    }
    afastados++;
  }
  return afastados;
}

/** Quanto o tecido entra em si mesmo no pior par (mm abaixo do raio; 0: nenhum par mais perto que o raio). */
export function maiorAutoPenetracao(sim: Simulacao): number {
  const a = autoColisaoDaSimulacao(sim);
  let pior = 0;
  paresPerto(sim.x, sim.w, a, a.raio, (_i, _j, d) => {
    pior = Math.max(pior, a.raio - d);
  });
  return pior;
}
