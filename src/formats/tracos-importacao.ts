import { area, ponto, retanguloEnvolvente, type Ponto2D } from '../core/geometria';

/**
 * O leitor de traços (ADR 0157, 0225): por dentro da importação do ISO, que chega aqui como canetas descendo e subindo.
 * tem traços e textos, então as peças são deduzidas:
 * - traços abertos que, ponta com ponta, fecham uma volta são uma linha fechada: a faca sobe nos cantos para girar, e o
 *   contorno vem em pedaços (ADR 0236);
 * - a linha fechada que não está dentro de outra é o contorno de uma peça (o retângulo da mesa, com um canto na origem
 *   do papel, fica de fora);
 * - a linha fechada dentro dela é um furo; se tem mais da metade da área, é a linha de costura, que fica de fora;
 * - o traço curto de dois pontos que sai do contorno é um pique;
 * - o traço reto mais comprido dentro da peça é o fio (confira depois); os outros traços são linhas internas;
 * - o texto dentro da peça é o nome dela.
 */

interface Traco {
  readonly pontos: readonly Ponto2D[];
}

interface Texto {
  readonly p: Ponto2D;
  readonly texto: string;
}

export interface PecaDosTracos {
  readonly nome: string | null;
  readonly contorno: Ponto2D[];
  readonly furos: Ponto2D[][];
  readonly linhasInternas: Ponto2D[][];
  readonly fio: { readonly inicio: Ponto2D; readonly fim: Ponto2D } | null;
  readonly piques: ReadonlyArray<{ readonly posicao: Ponto2D; readonly indiceAresta: number }>;
}

/** Os traços (em 40 unidades por mm) e os textos do arquivo. Só os comandos de desenho contam; os outros são pulados. */
export function lerTracos(texto: string): { readonly tracos: Traco[]; readonly textos: Texto[] } {
  const tracos: Traco[] = [];
  const textos: Texto[] = [];
  let terminador = String.fromCharCode(3);
  let x = 0;
  let y = 0;
  let caneta = false;
  let relativo = false;
  let atual: Ponto2D[] = [];
  const fecharTraco = (): void => {
    if (atual.length >= 2) tracos.push({ pontos: atual });
    atual = [];
  };
  const andar = (nums: readonly number[]): void => {
    for (let k = 0; k + 1 < nums.length; k += 2) {
      x = relativo ? x + nums[k]! : nums[k]!;
      y = relativo ? y + nums[k + 1]! : nums[k + 1]!;
      if (caneta) atual.push(ponto(x, y));
    }
  };
  let i = 0;
  while (i < texto.length) {
    if (!/[A-Za-z]/.test(texto[i]!)) {
      i++;
      continue;
    }
    const comando = texto.slice(i, i + 2).toUpperCase();
    i += 2;
    if (comando === 'LB') {
      const fim = texto.indexOf(terminador, i);
      const rotulo = texto.slice(i, fim < 0 ? texto.length : fim);
      textos.push({ p: ponto(x, y), texto: rotulo.trim() });
      i = fim < 0 ? texto.length : fim + 1;
      continue;
    }
    if (comando === 'DT') {
      if (texto[i] && texto[i] !== ';') terminador = texto[i]!;
      i++;
      continue;
    }
    let fim = i;
    while (fim < texto.length && /[-+0-9.,\s]/.test(texto[fim]!)) fim++;
    const nums = texto
      .slice(i, fim)
      .split(/[\s,]+/)
      .filter((n) => n !== '')
      .map(Number)
      .filter(Number.isFinite);
    i = fim;
    if (comando === 'PU') {
      fecharTraco();
      caneta = false;
      andar(nums);
    } else if (comando === 'PD') {
      if (!caneta) atual = [ponto(x, y)];
      caneta = true;
      andar(nums);
    } else if (comando === 'PA' || comando === 'PR') {
      relativo = comando === 'PR';
      andar(nums);
    } else if (comando === 'SP') {
      fecharTraco();
      caneta = false;
    } else if (comando === 'IN') {
      fecharTraco();
      caneta = false;
      relativo = false;
      x = 0;
      y = 0;
    }
  }
  fecharTraco();
  return { tracos, textos };
}

function dentro(p: Ponto2D, poligono: readonly Ponto2D[]): boolean {
  let d = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!;
    const b = poligono[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) d = !d;
  }
  return d;
}

/** A distância de `p` ao contorno e a aresta mais perto. */
function arestaMaisPerto(p: Ponto2D, c: readonly Ponto2D[]): { readonly d: number; readonly indice: number; readonly no: Ponto2D } {
  let melhor = { d: Infinity, indice: 0, no: c[0]! };
  c.forEach((a, i) => {
    const b = c[(i + 1) % c.length]!;
    const ab2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ab2));
    const no = ponto(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
    const d = Math.hypot(p.x - no.x, p.y - no.y);
    if (d < melhor.d) melhor = { d, indice: i, no };
  });
  return melhor;
}

const FECHA_MM = 0.5;
const PIQUE_MAXIMO_MM = 20;
/** Até onde duas pontas de traços são a mesma (mm): com a compensação da lâmina, o eixo volta deslocado depois de cada giro. */
const EMENDA_MM = 6;
/** A linha que quase fecha: a menor volta que conta (mm) e o maior vão, sobre o comprimento dela. */
const MENOR_VOLTA_MM = 100;
const MAIOR_VAO_DA_VOLTA = 0.1;
/** Quantas tentativas de emenda, no máximo, num arquivo. */
const LIMITE_DE_EMENDAS = 50_000;

const distancia = (a: Ponto2D, b: Ponto2D): number => Math.hypot(a.x - b.x, a.y - b.y);
const comprimentoDe = (p: readonly Ponto2D[]): number => p.reduce((s, q, i) => (i === 0 ? 0 : s + distancia(p[i - 1]!, q)), 0);

/**
 * Os traços abertos que, ponta com ponta, dão uma volta inteira viram uma linha fechada; os outros (piques, linhas internas) ficam
 * soltos. Procura com volta atrás: no canto em que um pique sai do contorno, a primeira ponta perto pode não ser a do contorno.
 */
function emendarTracos(tracos: readonly Ponto2D[][]): { readonly voltas: Ponto2D[][]; readonly soltos: Ponto2D[][] } {
  const ordem = tracos.map((_, i) => i).sort((a, b) => comprimentoDe(tracos[b]!) - comprimentoDe(tracos[a]!));
  const usado = new Set<number>();
  const voltas: Ponto2D[][] = [];
  let tentativas = 0;
  for (const inicio of ordem) {
    if (usado.has(inicio)) continue;
    const comeco = tracos[inicio]![0]!;
    const caminho: Array<{ readonly i: number; readonly invertido: boolean }> = [{ i: inicio, invertido: false }];
    const noCaminho = new Set([inicio]);
    const andar = (fim: Ponto2D, andado: number): boolean => {
      if (++tentativas > LIMITE_DE_EMENDAS) return false;
      if (caminho.length > 1 && distancia(fim, comeco) <= EMENDA_MM && andado >= MENOR_VOLTA_MM) return true;
      for (const k of ordem) {
        if (usado.has(k) || noCaminho.has(k)) continue;
        const t = tracos[k]!;
        for (const invertido of [false, true]) {
          if (distancia(invertido ? t[t.length - 1]! : t[0]!, fim) > EMENDA_MM) continue;
          caminho.push({ i: k, invertido });
          noCaminho.add(k);
          if (andar(invertido ? t[0]! : t[t.length - 1]!, andado + comprimentoDe(t))) return true;
          caminho.pop();
          noCaminho.delete(k);
        }
      }
      return false;
    };
    const t0 = tracos[inicio]!;
    if (!andar(t0[t0.length - 1]!, comprimentoDe(t0))) continue;
    const volta: Ponto2D[] = [];
    for (const { i, invertido } of caminho) {
      usado.add(i);
      for (const q of invertido ? [...tracos[i]!].reverse() : tracos[i]!) {
        const ultimo = volta[volta.length - 1];
        if (!ultimo || distancia(ultimo, q) > FECHA_MM) volta.push(q);
      }
    }
    if (distancia(volta[0]!, volta[volta.length - 1]!) <= FECHA_MM) volta.pop();
    voltas.push(volta);
  }
  return { voltas, soltos: tracos.filter((_, i) => !usado.has(i)) };
}

/** Os traços em mm, nos eixos do desenho (o comprimento do papel no y, a largura no x, para baixo). */
/** As unidades em que o ISO importado chega: 0,025 mm. */
const UNIDADES_POR_MM = 40;

const noDesenho = (p: Ponto2D): Ponto2D => ponto(-p.y / UNIDADES_POR_MM, p.x / UNIDADES_POR_MM);

export function pecasDosTracos(texto: string): { readonly pecas: PecaDosTracos[]; readonly avisos: string[] } {
  const { tracos, textos } = lerTracos(texto);
  const avisos: string[] = [];
  const fechados: Array<{ readonly pontos: Ponto2D[]; readonly area: number; readonly naOrigem: boolean }> = [];
  const pedacos: Ponto2D[][] = [];
  for (const t of tracos) {
    const naOrigem = t.pontos.length === 5 && t.pontos.some((p) => p.x === 0 && p.y === 0);
    const p = t.pontos.map(noDesenho);
    const primeiro = p[0]!;
    const ultimo = p[p.length - 1]!;
    if (p.length >= 4 && Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y) <= FECHA_MM) {
      const pontos = p.slice(0, -1);
      fechados.push({ pontos, area: area(pontos), naOrigem });
    } else pedacos.push(p);
  }
  const emendados = emendarTracos(pedacos);
  for (const pontos of emendados.voltas) fechados.push({ pontos, area: area(pontos), naOrigem: false });
  let abertos = emendados.soltos;
  // Sem nenhuma linha fechada, a que quase fecha é a peça: um vão no contorno não pode deixar o arquivo inteiro de fora.
  if (fechados.length === 0) {
    const quaseFecham = abertos.filter((l) => l.length >= 3 && comprimentoDe(l) >= MENOR_VOLTA_MM && distancia(l[0]!, l[l.length - 1]!) <= MAIOR_VAO_DA_VOLTA * comprimentoDe(l));
    for (const pontos of quaseFecham) fechados.push({ pontos, area: area(pontos), naOrigem: false });
    abertos = abertos.filter((l) => !quaseFecham.includes(l));
  }
  fechados.sort((a, b) => b.area - a.area);
  // O retângulo com um canto na origem do papel, com outra linha fechada dentro, é a mesa.
  const semMesa = fechados.filter((f, k) => !(f.naOrigem && fechados.slice(k + 1).some((g) => dentro(g.pontos[0]!, f.pontos))));
  const pecas: Array<{ contorno: Ponto2D[]; area: number; furos: Ponto2D[][] }> = [];
  for (const f of semMesa) {
    const dona = pecas.find((p) => dentro(f.pontos[0]!, p.contorno));
    if (!dona) pecas.push({ contorno: f.pontos, area: f.area, furos: [] });
    else if (f.area <= dona.area / 2) dona.furos.push(f.pontos);
  }
  if (pecas.length === 0) avisos.push('Este arquivo não traz o desenho de nenhuma peça: nada foi importado.');
  const resultado: PecaDosTracos[] = pecas.map((p) => {
    const caixa = retanguloEnvolvente(p.contorno);
    const daPeca = abertos.filter((l) => {
      const meio = l[Math.floor(l.length / 2)]!;
      return meio.x >= caixa.minX - 1 && meio.x <= caixa.maxX + 1 && meio.y >= caixa.minY - 1 && meio.y <= caixa.maxY + 1 && l.some((q) => dentro(q, p.contorno));
    });
    const piques: Array<{ posicao: Ponto2D; indiceAresta: number }> = [];
    const internas: Ponto2D[][] = [];
    for (const l of daPeca) {
      const comprimento = Math.hypot(l[0]!.x - l[l.length - 1]!.x, l[0]!.y - l[l.length - 1]!.y);
      const pontas = [arestaMaisPerto(l[0]!, p.contorno), arestaMaisPerto(l[l.length - 1]!, p.contorno)];
      const naBorda = pontas.find((q) => q.d <= 1);
      if (l.length === 2 && comprimento <= PIQUE_MAXIMO_MM && naBorda) piques.push({ posicao: naBorda.no, indiceAresta: naBorda.indice });
      else internas.push(l);
    }
    const retas = internas.filter((l) => l.length === 2);
    const fioLinha = retas.reduce<Ponto2D[] | null>((m, l) => (m === null || Math.hypot(l[0]!.x - l[1]!.x, l[0]!.y - l[1]!.y) > Math.hypot(m[0]!.x - m[1]!.x, m[0]!.y - m[1]!.y) ? l : m), null);
    const rotulo = textos.find((t) => dentro(noDesenho(t.p), p.contorno));
    return {
      nome: rotulo?.texto || null,
      contorno: p.contorno,
      furos: p.furos,
      linhasInternas: internas.filter((l) => l !== fioLinha),
      fio: fioLinha ? { inicio: fioLinha[0]!, fim: fioLinha[1]! } : null,
      piques,
    };
  });
  return { pecas: resultado, avisos };
}
