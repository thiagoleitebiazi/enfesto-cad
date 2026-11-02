import type { CampoDoCorpo, MalhaHumana } from './corpoHumano';
import { campoDoCorpo, lerCampo, malhaHumana, proporcoesDoCorpo } from './corpoHumano';
import type { FichaTecnica } from './fichaTecnica';
import type { RegrasDeCaimento } from './recomendacaoDeTamanho';
import { guiaDeMedidas } from './recomendacaoDeTamanho';

/**
 * O manequim do provador 3D (ADR 0111): as medidas, os níveis do corpo e a posição dos braços e das pernas. O tronco em
 * seções elípticas empilhadas (do gancho ao pescoço) serve para arrumar as peças em volta do corpo. O corpo que se vê e
 * em que o tecido bate é a malha humana ajustada a essas medidas (ADR 0229): o ponto que entra nele é empurrado para
 * fora pela normal da superfície. Em mm, com o y para cima, o chão em y = 0 e a frente do corpo para +z; o lado direito
 * do manequim fica em −x (quem olha de frente o vê à esquerda).
 */

export interface MedidasDoManequim {
  readonly alturaCm: number;
  readonly bustoCm: number;
  readonly cinturaCm: number;
  readonly quadrilCm: number;
  /** De uma ponta do ombro à outra, pelas costas. */
  readonly ombrosCm: number;
  readonly pescocoCm: number;
  /** A volta do braço (no alto). */
  readonly bracoCm: number;
  /** Do ombro ao punho. */
  readonly comprimentoDoBracoCm: number;
  /** Do gancho ao chão. */
  readonly entrepernaCm: number;
  /** A volta da coxa (no alto). */
  readonly coxaCm: number;
}

export type PublicoDoManequim = 'feminino' | 'masculino' | 'infantil';

export const ROTULO_DO_PUBLICO: Readonly<Record<PublicoDoManequim, string>> = {
  feminino: 'Feminino adulto',
  masculino: 'Masculino adulto',
  infantil: 'Infantil (8 anos)',
};

/** As medidas de partida de cada público (um tamanho médio). */
export const MEDIDAS_DO_PUBLICO: Readonly<Record<PublicoDoManequim, MedidasDoManequim>> = {
  feminino: { alturaCm: 165, bustoCm: 92, cinturaCm: 72, quadrilCm: 100, ombrosCm: 38, pescocoCm: 35, bracoCm: 28, comprimentoDoBracoCm: 58, entrepernaCm: 76, coxaCm: 56 },
  masculino: { alturaCm: 176, bustoCm: 100, cinturaCm: 86, quadrilCm: 100, ombrosCm: 45, pescocoCm: 39, bracoCm: 31, comprimentoDoBracoCm: 62, entrepernaCm: 80, coxaCm: 56 },
  infantil: { alturaCm: 128, bustoCm: 66, cinturaCm: 58, quadrilCm: 70, ombrosCm: 29, pescocoCm: 29, bracoCm: 20, comprimentoDoBracoCm: 42, entrepernaCm: 55, coxaCm: 40 },
};

export const ROTULO_DA_MEDIDA_DO_MANEQUIM: Readonly<Record<keyof MedidasDoManequim, string>> = {
  alturaCm: 'Altura',
  bustoCm: 'Busto (tórax)',
  cinturaCm: 'Cintura',
  quadrilCm: 'Quadril',
  ombrosCm: 'Ombro a ombro',
  pescocoCm: 'Pescoço',
  bracoCm: 'Braço (volta)',
  comprimentoDoBracoCm: 'Comprimento do braço',
  entrepernaCm: 'Entreperna',
  coxaCm: 'Coxa (volta)',
};

/** Os limites de cada medida (cm): fora deles o corpo deixa de ser um corpo. */
export const LIMITES_DA_MEDIDA: Readonly<Record<keyof MedidasDoManequim, readonly [number, number]>> = {
  alturaCm: [80, 210],
  bustoCm: [45, 160],
  cinturaCm: [40, 150],
  quadrilCm: [45, 170],
  ombrosCm: [20, 60],
  pescocoCm: [20, 55],
  bracoCm: [12, 50],
  comprimentoDoBracoCm: [25, 80],
  entrepernaCm: [30, 100],
  coxaCm: [25, 90],
};

/** As medidas dentro dos limites (o que passa fica no limite). */
export function medidasConferidas(m: MedidasDoManequim): MedidasDoManequim {
  const r = { ...m } as Record<keyof MedidasDoManequim, number>;
  for (const k of Object.keys(LIMITES_DA_MEDIDA) as (keyof MedidasDoManequim)[]) {
    const [min, max] = LIMITES_DA_MEDIDA[k];
    const v = Number.isFinite(r[k]) ? r[k] : MEDIDAS_DO_PUBLICO.feminino[k];
    r[k] = Math.min(max, Math.max(min, v));
  }
  // A entreperna não passa de metade da altura e pouco.
  r.entrepernaCm = Math.min(r.entrepernaCm, r.alturaCm * 0.52);
  return r;
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Qual medida do manequim um ponto de medida da ficha é (pelo nome); `null`: nenhuma. */
function medidaDoPonto(nome: string): keyof MedidasDoManequim | null {
  const n = semAcento(nome);
  if (/comprimento|manga|altura/.test(n)) return /entreperna/.test(n) ? 'entrepernaCm' : null;
  if (/busto|torax|peito/.test(n)) return 'bustoCm';
  if (/cintura/.test(n)) return 'cinturaCm';
  if (/quadril|bacia/.test(n)) return 'quadrilCm';
  if (/pescoco|colarinho/.test(n)) return 'pescocoCm';
  if (/biceps|braco/.test(n)) return 'bracoCm';
  if (/coxa/.test(n)) return 'coxaCm';
  if (/entreperna/.test(n)) return 'entrepernaCm';
  return null;
}

/**
 * O manequim no tamanho da ficha: as medidas do corpo de cada ponto usado na recomendação (a peça menos a folga,
 * como no guia de medidas) entram por cima das do público. Diz quais medidas vieram da ficha.
 */
export function manequimDoTamanho(
  base: MedidasDoManequim,
  ficha: Pick<FichaTecnica, 'medidas' | 'tamanhos'>,
  regras: RegrasDeCaimento,
  tamanho: string,
): { readonly medidas: MedidasDoManequim; readonly daFicha: readonly string[] } {
  const r = { ...base } as Record<keyof MedidasDoManequim, number>;
  const daFicha: string[] = [];
  for (const faixa of guiaDeMedidas(ficha, regras)) {
    const chave = medidaDoPonto(faixa.nome);
    const valor = faixa.porTamanho[tamanho];
    if (!chave || !valor) continue;
    r[chave] = Math.round(valor.idealCm * 10) / 10;
    daFicha.push(`${ROTULO_DA_MEDIDA_DO_MANEQUIM[chave]} (${faixa.nome})`);
  }
  return { medidas: medidasConferidas(r), daFicha };
}

// ---- O corpo (a geometria)

export interface Ponto3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Uma seção do tronco: a elipse na altura `y`, com a meia largura `a` (em x) e a meia profundidade `b` (em z). */
export interface SecaoDoTronco {
  readonly y: number;
  readonly a: number;
  readonly b: number;
}

export interface CorpoDoManequim {
  readonly medidas: MedidasDoManequim;
  /** A forma do corpo (ADR 0229). */
  readonly publico: PublicoDoManequim;
  readonly pose: PoseDoManequim;
  /** De 0 (na pose de vestir) a 1 (na pedida). */
  readonly fracaoDaPose: number;
  readonly alturaMm: number;
  /** De baixo para cima, do gancho ao alto do pescoço. */
  readonly tronco: readonly SecaoDoTronco[];
  /** As alturas de referência (mm), para pôr as peças. */
  readonly niveis: {
    readonly gancho: number;
    readonly quadril: number;
    readonly cintura: number;
    readonly busto: number;
    readonly axila: number;
    readonly ombro: number;
    readonly pescoco: number;
    readonly queixoDaMalha: number;
  };
  /** Os braços (o direito em −x): o ombro, o cotovelo e o punho, e o raio no alto. */
  readonly bracos: { readonly direito: BracoOuPerna; readonly esquerdo: BracoOuPerna };
  readonly pernas: { readonly direita: BracoOuPerna; readonly esquerda: BracoOuPerna };
}

export interface BracoOuPerna {
  readonly inicio: Ponto3D;
  readonly meio: Ponto3D;
  readonly fim: Ponto3D;
  readonly raio: number;
  /** Para onde a mão aponta, quando ela não segue o antebraço (a direção, com o tamanho 1). */
  readonly mao?: Ponto3D;
}

/** O perímetro de uma elipse (Ramanujan). */
export function perimetroDaElipse(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** A elipse de perímetro `perimetro` e largura `k` vezes a profundidade. */
function elipse(perimetro: number, k: number): { a: number; b: number } {
  const b = perimetro / perimetroDaElipse(k, 1);
  return { a: k * b, b };
}

const p3 = (x: number, y: number, z: number): Ponto3D => ({ x, y, z });

/**
 * A pose do manequim (ADR 0138): os braços. A de vestir é a de sempre (um pouco afastados, para as mangas caírem); as
 * outras são para as imagens de catálogo.
 */
export type PoseDoManequim = 'padrao' | 'bracos-abaixados' | 'bracos-abertos' | 'maos-na-cintura';

export const ROTULO_DA_POSE: Readonly<Record<PoseDoManequim, string>> = {
  padrao: 'Braços um pouco afastados (para vestir)',
  'bracos-abaixados': 'Braços abaixados (catálogo)',
  'bracos-abertos': 'Braços abertos',
  'maos-na-cintura': 'Mãos na cintura',
};

/** Quanto o braço sai do corpo (graus, da vertical) em cada pose. */
/** O vão entre a mão na cintura e o corpo (mm), para o pano. */
const FOLGA_DA_MAO_NO_CORPO_MM = 22;

const ABERTURA_DA_POSE: Readonly<Record<PoseDoManequim, number>> = { padrao: 15, 'bracos-abaixados': 7, 'bracos-abertos': 60, 'maos-na-cintura': 40 };

/** A forma do corpo pelas medidas, para quem só tem as medidas: a criança pela altura, o resto pela diferença do quadril. */
export const publicoDasMedidas = (m: MedidasDoManequim): PublicoDoManequim => (m.alturaCm < 150 ? 'infantil' : m.quadrilCm - m.cinturaCm >= 20 ? 'feminino' : 'masculino');

/**
 * Monta o corpo pelas medidas. `fracaoDaPose`: de 0 (os braços na pose de vestir) a 1 (na pose pedida); os valores do
 * meio são o caminho entre as duas, que a simulação percorre com a roupa já vestida (ADR 0230).
 */
export function corpoDoManequim(medidasDadas: MedidasDoManequim, pose: PoseDoManequim = 'padrao', publicoDado?: PublicoDoManequim, fracaoDaPose = 1): CorpoDoManequim {
  const m = medidasConferidas(medidasDadas);
  const publico = publicoDado ?? publicoDasMedidas(m);
  const H = m.alturaCm * 10;
  const forma = proporcoesDoCorpo(publico);
  const zEscala = H / forma.altura;
  const gancho = m.entrepernaCm * 10;
  const quadril = gancho + 0.06 * H;
  const cintura = Math.max(quadril + 0.05 * H, 0.625 * H);
  const busto = Math.max(cintura + 0.06 * H, 0.725 * H);
  const axila = busto + 0.03 * H;
  const ombro = axila + 0.06 * H;
  const pescoco = ombro + 0.025 * H;
  const pescocoAlto = pescoco + 0.035 * H;

  const sQuadril = elipse(m.quadrilCm * 10, 1.4);
  const sCintura = elipse(m.cinturaCm * 10, 1.38);
  const sBusto = elipse(m.bustoCm * 10, 1.3);
  const sAxila = elipse(m.bustoCm * 10 * 0.97, 1.45);
  const sPescoco = elipse(m.pescocoCm * 10, 1.1);
  const raioDoBraco = (m.bracoCm * 10) / (2 * Math.PI);
  const meioOmbro = (m.ombrosCm * 10) / 2;
  const aOmbro = Math.max(sAxila.a * 0.85, meioOmbro - raioDoBraco * 0.6);
  const tronco: SecaoDoTronco[] = [
    { y: gancho, a: sQuadril.a * 0.9, b: sQuadril.b * 0.92 },
    { y: quadril, ...sQuadril },
    { y: (quadril + cintura) / 2, a: (sQuadril.a + sCintura.a) / 2 * 1.02, b: (sQuadril.b + sCintura.b) / 2 * 1.02 },
    { y: cintura, ...sCintura },
    { y: (cintura + busto) / 2, a: (sCintura.a + sBusto.a) / 2, b: (sCintura.b + sBusto.b) / 2 },
    { y: busto, ...sBusto },
    { y: axila, ...sAxila },
    { y: ombro - 0.015 * H, a: aOmbro, b: sAxila.b * 0.85 },
    { y: ombro, a: aOmbro * 0.92, b: sAxila.b * 0.7 },
    { y: (ombro + pescoco) / 2, a: (aOmbro * 0.92 + sPescoco.a) / 2, b: (sAxila.b * 0.7 + sPescoco.b) / 2 },
    { y: pescoco, ...sPescoco },
    { y: pescocoAlto, a: sPescoco.a * 0.95, b: sPescoco.b * 0.95 },
  ];

  // O ombro fica onde o corpo o tem, um pouco para trás do meio do tronco; o braço relaxado cai reto dali.
  const zOmbro = forma.z.ombro * zEscala;
  const bracoNaPose = (lado: -1 | 1, poseDoBraco: PoseDoManequim): BracoOuPerna => {
    const abertura = (ABERTURA_DA_POSE[poseDoBraco] * Math.PI) / 180;
    const inicio = p3(lado * (meioOmbro - raioDoBraco * 0.75), ombro - raioDoBraco * 0.9, zOmbro);
    const d = p3(lado * Math.sin(abertura), -Math.cos(abertura), 0);
    const L = m.comprimentoDoBracoCm * 10;
    const meio = p3(inicio.x + d.x * L * 0.55, inicio.y + d.y * L * 0.55, poseDoBraco === 'maos-na-cintura' ? zOmbro - 0.1 * L : zOmbro);
    if (poseDoBraco === 'maos-na-cintura') {
      // O cotovelo vai para o lado e para trás; o antebraço volta dele para a cintura, e o punho dobra: a mão fica deitada
      // no lado do quadril, com os dedos para baixo e para a frente, afastada dele o bastante para o pano passar por baixo. Encostada
      // e apontando para dentro, ela entrava no corpo, e o pano ficava por fora dos dedos.
      const secao = { tronco } as unknown as CorpoDoManequim;
      const s = secaoNaAltura(secao, cintura)!;
      const sq = secaoNaAltura(secao, quadril)!;
      const alvo = p3(lado * (s.a + raioDoBraco * 0.62 + FOLGA_DA_MAO_NO_CORPO_MM), cintura + 0.005 * H, s.b * 0.3);
      const dx = alvo.x - meio.x;
      const dy = alvo.y - meio.y;
      const dz = alvo.z - meio.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const k = Math.min(1, (L * 0.45) / l);
      // Acompanha a linha do quadril, que abre da cintura para baixo.
      const abre = (sq.a - s.a) / Math.max(1, cintura - quadril);
      const [mx, my, mz] = [lado * 0.85 * abre, -0.85, 0.43];
      const ml = Math.hypot(mx, my, mz);
      return { inicio, meio, fim: p3(meio.x + dx * k, meio.y + dy * k, meio.z + dz * k), raio: raioDoBraco, mao: p3(mx / ml, my / ml, mz / ml) };
    }
    // O cotovelo nunca fica travado: o antebraço vem um pouco à frente.
    const fim = p3(inicio.x + d.x * L, inicio.y + d.y * L, zOmbro + 0.05 * L);
    return { inicio, meio, fim, raio: raioDoBraco };
  };
  const braco = (lado: -1 | 1): BracoOuPerna => {
    const alvo = bracoNaPose(lado, pose);
    if (fracaoDaPose >= 1 || pose === 'padrao') return alvo;
    const de = bracoNaPose(lado, 'padrao');
    const f = fracaoDaPose;
    const entre = (a: Ponto3D, b: Ponto3D): Ponto3D => p3(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
    const direcao = (q: BracoOuPerna): Ponto3D => {
      if (q.mao) return q.mao;
      const l = Math.hypot(q.fim.x - q.meio.x, q.fim.y - q.meio.y, q.fim.z - q.meio.z) || 1;
      return p3((q.fim.x - q.meio.x) / l, (q.fim.y - q.meio.y) / l, (q.fim.z - q.meio.z) / l);
    };
    const m0 = entre(direcao(de), direcao(alvo));
    const ml = Math.hypot(m0.x, m0.y, m0.z) || 1;
    return { inicio: alvo.inicio, meio: entre(de.meio, alvo.meio), fim: entre(de.fim, alvo.fim), raio: alvo.raio, mao: p3(m0.x / ml, m0.y / ml, m0.z / ml) };
  };
  const raioDaCoxa = (m.coxaCm * 10) / (2 * Math.PI);
  const perna = (lado: -1 | 1): BracoOuPerna => {
    const inicio = p3(lado * raioDaCoxa * 0.98, gancho + raioDaCoxa * 0.5, forma.z.quadril * zEscala);
    const meio = p3(lado * (raioDaCoxa * 0.98 + 10), 0.285 * H, forma.z.joelho * zEscala);
    const fim = p3(lado * (raioDaCoxa * 0.98 + 25), 0.045 * H, forma.z.tornozelo * zEscala);
    return { inicio, meio, fim, raio: raioDaCoxa };
  };
  const bracos = { direito: braco(-1), esquerdo: braco(1) };
  const pernas = { direita: perna(-1), esquerda: perna(1) };
  return {
    medidas: m,
    publico,
    pose,
    fracaoDaPose,
    alturaMm: H,
    tronco,
    niveis: { gancho, quadril, cintura, busto, axila, ombro, pescoco, queixoDaMalha: pescocoAlto },
    bracos,
    pernas,
  };
}

/** A seção do tronco na altura `y` (por interpolação), com a variação de `a` e `b` por mm de altura; `null` fora do tronco. */
export function secaoNaAltura(corpo: CorpoDoManequim, y: number): { a: number; b: number; da: number; db: number } | null {
  const t = corpo.tronco;
  if (y < t[0]!.y || y > t[t.length - 1]!.y) return null;
  for (let i = 0; i < t.length - 1; i++) {
    const s0 = t[i]!;
    const s1 = t[i + 1]!;
    if (y <= s1.y) {
      const h = s1.y - s0.y;
      const f = h > 0 ? (y - s0.y) / h : 0;
      return { a: s0.a + (s1.a - s0.a) * f, b: s0.b + (s1.b - s0.b) * f, da: h > 0 ? (s1.a - s0.a) / h : 0, db: h > 0 ? (s1.b - s0.b) / h : 0 };
    }
  }
  return null;
}

/** A maior meia largura e a maior meia profundidade do tronco entre duas alturas (o que fica abaixo do gancho não conta). */
export function semiEixosMaximosDoTronco(corpo: CorpoDoManequim, y0: number, y1: number): { readonly a: number; readonly b: number } {
  let a = 0;
  let b = 0;
  const de = Math.max(Math.min(y0, y1), corpo.tronco[0]!.y);
  const ate = Math.min(Math.max(y0, y1), corpo.tronco[corpo.tronco.length - 1]!.y);
  for (let y = de; y <= ate; y += 10) {
    const s = secaoNaAltura(corpo, y);
    if (s) {
      a = Math.max(a, s.a);
      b = Math.max(b, s.b);
    }
  }
  for (const s of corpo.tronco) {
    if (s.y >= de && s.y <= ate) {
      a = Math.max(a, s.a);
      b = Math.max(b, s.b);
    }
  }
  if (a === 0) {
    // Todo abaixo do gancho (uma barra comprida): a seção de baixo do tronco.
    a = corpo.tronco[0]!.a;
    b = corpo.tronco[0]!.b;
  }
  return { a, b };
}

/** O maior raio do tronco (a meia largura ou a meia profundidade) entre duas alturas. */
export function raioMaximoDoTronco(corpo: CorpoDoManequim, y0: number, y1: number): number {
  let r = 0;
  const de = Math.min(y0, y1);
  const ate = Math.max(y0, y1);
  for (let y = de; y <= ate; y += 10) {
    const s = secaoNaAltura(corpo, y);
    if (s) r = Math.max(r, s.a, s.b);
  }
  for (const s of corpo.tronco) if (s.y >= de && s.y <= ate) r = Math.max(r, s.a, s.b);
  return r;
}

// ---- O corpo que se vê e em que o tecido bate (ADR 0229)

interface CorpoPronto {
  readonly malha: MalhaHumana;
  campo: CampoDoCorpo | null;
}

/** Os últimos corpos feitos, pela forma, pose e medidas: ajustar a malha e medir a grade custa de meio segundo a quase um. */
const prontos = new Map<string, CorpoPronto>();
const LIMITE_DE_CORPOS_PRONTOS = 6;

function corpoPronto(corpo: CorpoDoManequim): CorpoPronto {
  const chave = JSON.stringify([corpo.publico, corpo.pose, corpo.fracaoDaPose, corpo.medidas]);
  const achado = prontos.get(chave);
  if (achado) return achado;
  const novo: CorpoPronto = { malha: malhaHumana(corpo), campo: null };
  if (prontos.size >= LIMITE_DE_CORPOS_PRONTOS) prontos.delete(prontos.keys().next().value!);
  prontos.set(chave, novo);
  return novo;
}

const camposDoCorpo = new WeakMap<CorpoDoManequim, CampoDoCorpo>();

function campoDe(corpo: CorpoDoManequim): CampoDoCorpo {
  const achado = camposDoCorpo.get(corpo);
  if (achado) return achado;
  const pronto = corpoPronto(corpo);
  pronto.campo ??= campoDoCorpo(pronto.malha);
  camposDoCorpo.set(corpo, pronto.campo);
  return pronto.campo;
}

const leitura = new Float64Array(4);

/** A leitura sem criar objeto nenhum, para a simulação, que pergunta milhões de vezes: a grade do corpo de agora. */
export const grade = (corpo: CorpoDoManequim): CampoDoCorpo => campoDe(corpo);

/** A distância do ponto à superfície do corpo, com a normal para fora: negativa dentro do corpo. */
export function distanciaAoCorpo(corpo: CorpoDoManequim, x: number, y: number, z: number): { d: number; nx: number; ny: number; nz: number } {
  lerCampo(campoDe(corpo), x, y, z, leitura);
  return { d: leitura[0]!, nx: leitura[1]!, ny: leitura[2]!, nz: leitura[3]! };
}

export interface MalhaDoCorpo {
  /** Os vértices em x, y, z seguidos. */
  readonly vertices: Float64Array;
  /** Os triângulos (três índices cada), com a frente para fora. */
  readonly triangulos: Uint32Array;
}

/** A malha de triângulos do corpo, para o desenho. */
export const malhaDoCorpo = (corpo: CorpoDoManequim): MalhaDoCorpo => corpoPronto(corpo).malha;
