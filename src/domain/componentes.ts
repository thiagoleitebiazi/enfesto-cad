import { comprimentoDaLinha, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import { criarMolde, transladarMolde, type Molde, type Pique } from './molde';

/**
 * Os componentes prontos (ADR 0133): as peças que se repetem de um modelo a outro — o bolso, o punho, o cós, a gola, a
 * manga —, feitas pelas medidas, com o fio, a costura, a dobra e os piques. A manga sai com a cabeça medida para a
 * cava: a largura é procurada até o comprimento da cabeça dar o da cava mais a folga.
 */

export type TipoDeComponente = 'bolso-chapa' | 'punho' | 'cos' | 'gola-padre' | 'manga';

export interface CampoDoComponente {
  readonly id: string;
  readonly rotulo: string;
  readonly padraoMm: number;
  /** O menor valor que faz sentido (mm); 0 aceita zero. */
  readonly minimoMm: number;
}

export interface DefinicaoDoComponente {
  readonly nome: string;
  readonly descricao: string;
  readonly campos: readonly CampoDoComponente[];
}

export const COMPONENTES: Readonly<Record<TipoDeComponente, DefinicaoDoComponente>> = {
  'bolso-chapa': {
    nome: 'Bolso chapa',
    descricao: 'O bolso pregado por fora: a largura, a altura e o bico do fundo (0: reto).',
    campos: [
      { id: 'largura', rotulo: 'Largura (mm)', padraoMm: 140, minimoMm: 20 },
      { id: 'altura', rotulo: 'Altura (mm)', padraoMm: 160, minimoMm: 20 },
      { id: 'bico', rotulo: 'Bico do fundo (mm)', padraoMm: 25, minimoMm: 0 },
    ],
  },
  punho: {
    nome: 'Punho',
    descricao: 'A volta do punho mais o transpasse, na altura acabada: corta-se o dobro, com a dobra no meio.',
    campos: [
      { id: 'volta', rotulo: 'Volta do punho (mm)', padraoMm: 230, minimoMm: 50 },
      { id: 'transpasse', rotulo: 'Transpasse (mm)', padraoMm: 20, minimoMm: 0 },
      { id: 'altura', rotulo: 'Altura acabada (mm)', padraoMm: 60, minimoMm: 10 },
    ],
  },
  cos: {
    nome: 'Cós',
    descricao: 'A cintura mais o transpasse, na altura acabada: corta-se o dobro, com a dobra no meio.',
    campos: [
      { id: 'cintura', rotulo: 'Cintura (mm)', padraoMm: 720, minimoMm: 200 },
      { id: 'transpasse', rotulo: 'Transpasse (mm)', padraoMm: 30, minimoMm: 0 },
      { id: 'altura', rotulo: 'Altura acabada (mm)', padraoMm: 40, minimoMm: 10 },
    ],
  },
  'gola-padre': {
    nome: 'Gola padre',
    descricao: 'A gola em pé: o decote inteiro (frente e costas, dos dois lados), a altura e quanto a borda de baixo sobe na frente.',
    campos: [
      { id: 'decote', rotulo: 'Decote inteiro (mm)', padraoMm: 400, minimoMm: 100 },
      { id: 'altura', rotulo: 'Altura (mm)', padraoMm: 35, minimoMm: 10 },
      { id: 'subida', rotulo: 'Subida na frente (mm)', padraoMm: 15, minimoMm: 0 },
    ],
  },
  manga: {
    nome: 'Manga',
    descricao: 'A manga básica: a cava do corpo (frente e costas), o comprimento, a boca e a altura da cabeça; a cabeça sai com o comprimento da cava mais a folga.',
    campos: [
      { id: 'cava', rotulo: 'Cava, frente e costas (mm)', padraoMm: 440, minimoMm: 200 },
      { id: 'comprimento', rotulo: 'Comprimento (mm)', padraoMm: 600, minimoMm: 100 },
      { id: 'boca', rotulo: 'Boca (mm)', padraoMm: 260, minimoMm: 80 },
      { id: 'cabeca', rotulo: 'Altura da cabeça (mm)', padraoMm: 140, minimoMm: 40 },
      { id: 'folga', rotulo: 'Folga da cabeça (mm)', padraoMm: 15, minimoMm: 0 },
    ],
  },
};

/** As medidas que faltam ganham o padrão; as abaixo do mínimo são recusadas. */
export function medidasDoComponente(tipo: TipoDeComponente, dadas: Readonly<Record<string, number | undefined>>): Record<string, number> {
  const medidas: Record<string, number> = {};
  for (const c of COMPONENTES[tipo].campos) {
    const v = dadas[c.id] ?? c.padraoMm;
    if (!Number.isFinite(v) || v < c.minimoMm) throw new Error(`${COMPONENTES[tipo].nome}: ${c.rotulo.replace(/ \(mm\)$/, '').toLowerCase()} de ${c.minimoMm} mm para cima.`);
    medidas[c.id] = v;
  }
  return medidas;
}

/** No desenho do componente, u vai para a direita e v para baixo; no mundo do programa, o x é a vertical e o y a horizontal. */
const noMundo = (u: number, v: number): Ponto2D => ({ x: v, y: u });

/** A curva de Bézier cúbica, amostrada em \`n\` pedaços (sem o primeiro ponto). */
function bezier(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], n: number): [number, number][] {
  const saida: [number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const s = 1 - t;
    saida.push([
      s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0],
      s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return saida;
}

/** A cabeça da manga de largura \`w\` e altura \`h\`: da axila esquerda (0, h) ao alto (w/2, 0) e à axila direita (w, h). */
function cabecaDaManga(w: number, h: number): [number, number][] {
  const metade = bezier([0, h], [w * 0.22, h], [w * 0.3, 0], [w / 2, 0], 16);
  const outra = [...metade].reverse().slice(1).map(([u, v]) => [w - u, v] as [number, number]);
  return [[0, h], ...metade, ...outra, [w, h]];
}

/** A largura da manga cuja cabeça (de altura \`h\`) tem o comprimento pedido: o comprimento cresce com a largura. */
export function larguraDaManga(comprimentoDaCabecaMm: number, h: number): number {
  const comprimento = (w: number): number => comprimentoDaLinha(cabecaDaManga(w, h).map(([u, v]) => ({ x: v, y: u })));
  let baixo = 1;
  let alto = comprimentoDaCabecaMm;
  if (comprimento(alto) < comprimentoDaCabecaMm) throw new Error('Manga: a cabeça não chega ao comprimento da cava com essa altura.');
  if (comprimento(baixo) > comprimentoDaCabecaMm) throw new Error('Manga: a cabeça é alta demais para essa cava (diminua a altura da cabeça).');
  for (let i = 0; i < 60; i++) {
    const meio = (baixo + alto) / 2;
    if (comprimento(meio) < comprimentoDaCabecaMm) baixo = meio;
    else alto = meio;
  }
  return (baixo + alto) / 2;
}

const pique = (id: string, u: number, v: number, indiceAresta: number): Pique => ({ id, posicao: noMundo(u, v), indiceAresta });

/** O componente na origem (o canto de cima à esquerda em 0, 0), com os ids dados por \`novoId\`. */
export function componente(tipo: TipoDeComponente, dadas: Readonly<Record<string, number | undefined>>, novoId: () => string, margemDeCosturaMm = 10): Molde {
  const m = medidasDoComponente(tipo, dadas);
  const nome = COMPONENTES[tipo].nome;
  const base = { nome, referencia: '', tamanho: '', margemDeCosturaMm };
  switch (tipo) {
    case 'bolso-chapa': {
      const { largura: l, altura: h, bico: b } = m as { largura: number; altura: number; bico: number };
      if (b >= h) throw new Error('Bolso chapa: o bico precisa ser menor que a altura.');
      const pontos: [number, number][] = b > 0 ? [[0, 0], [l, 0], [l, h - b], [l / 2, h], [0, h - b]] : [[0, 0], [l, 0], [l, h], [0, h]];
      return criarMolde({ ...base, contorno: pontos.map(([u, v]) => noMundo(u, v)), linhaDeFio: { inicio: noMundo(l / 2, h * 0.15), fim: noMundo(l / 2, h * 0.75) } }, novoId());
    }
    case 'punho':
    case 'cos': {
      const volta = tipo === 'punho' ? m.volta! : m.cintura!;
      const { transpasse: tr, altura: h } = m as { transpasse: number; altura: number };
      const c = volta + tr;
      // A dobra no meio da altura (a linha interna); os piques do transpasse e do meio, em cima e embaixo.
      return criarMolde(
        {
          ...base,
          contorno: [noMundo(0, 0), noMundo(c, 0), noMundo(c, 2 * h), noMundo(0, 2 * h)],
          linhaDeFio: { inicio: noMundo(c * 0.1, h / 2), fim: noMundo(c * 0.9, h / 2) },
          linhasInternas: [[noMundo(0, h), noMundo(c, h)]],
          piques: [
            ...(tr > 0 ? [pique(novoId(), tr, 0, 0), pique(novoId(), tr, 2 * h, 2)] : []),
            pique(novoId(), tr + volta / 2, 0, 0),
            pique(novoId(), tr + volta / 2, 2 * h, 2),
          ],
        },
        novoId(),
      );
    }
    case 'gola-padre': {
      const { decote: d, altura: h, subida: s } = m as { decote: number; altura: number; subida: number };
      if (s >= h * 3) throw new Error('Gola padre: a subida é grande demais para a altura.');
      // A borda de baixo sobe para a frente (as pontas, u = 0 e u = d); a de cima a acompanha, na altura da gola.
      const n = 12;
      const baixo: [number, number][] = [];
      for (let k = 0; k <= 2 * n; k++) {
        const u = (d * k) / (2 * n);
        const t = Math.abs(u - d / 2) / (d / 2);
        baixo.push([u, h - s * t * t]);
      }
      const cima = baixo.map(([u, v]) => [u, v - h] as [number, number]).reverse();
      return criarMolde(
        {
          ...base,
          contorno: [...cima, ...baixo].map(([u, v]) => noMundo(u, v)),
          linhaDeFio: { inicio: noMundo(d / 2, h * 0.15), fim: noMundo(d / 2, h * 0.85) },
          // O pique do meio das costas, na borda de baixo (a aresta que começa no meio dela).
          piques: [pique(novoId(), d / 2, h, 2 * n + 1 + n)],
        },
        novoId(),
      );
    }
    case 'manga': {
      const { cava, comprimento: l, boca, cabeca: hc, folga } = m as { cava: number; comprimento: number; boca: number; cabeca: number; folga: number };
      if (l <= hc + 50) throw new Error('Manga: o comprimento precisa passar a altura da cabeça em mais de 5 cm.');
      const w = larguraDaManga(cava + folga, hc);
      if (boca >= w) throw new Error(`Manga: a boca (${Math.round(boca)} mm) precisa ser menor que a largura da manga (${Math.round(w)} mm).`);
      const topo = cabecaDaManga(w, hc);
      const contorno = [...topo, [(w + boca) / 2, l], [(w - boca) / 2, l]] as [number, number][];
      return criarMolde(
        {
          ...base,
          contorno: contorno.map(([u, v]) => noMundo(u, v)),
          linhaDeFio: { inicio: noMundo(w / 2, hc * 0.6), fim: noMundo(w / 2, l * 0.9) },
          // O pique do alto da cabeça (o ombro): o ponto 16, entre as duas metades da cabeça (33 pontos).
          piques: [pique(novoId(), w / 2, 0, 16)],
        },
        novoId(),
      );
    }
  }
}

/** O componente posto depois das peças da mesa (o y do mundo), alinhado pelo alto, como as peças extraídas. */
export function componenteNoProjeto(peca: Molde, pecas: readonly Molde[], afastamentoMm = 40): Molde {
  const caixa = retanguloEnvolvente(peca.contorno);
  if (pecas.length === 0) return peca;
  const fim = Math.max(...pecas.map((p) => retanguloEnvolvente(p.contorno).maxY));
  const topo = Math.min(...pecas.map((p) => retanguloEnvolvente(p.contorno).minX));
  return transladarMolde(peca, { x: topo - caixa.minX, y: fim + afastamentoMm - caixa.minY }, peca.id);
}
