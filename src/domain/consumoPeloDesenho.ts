import { distancia, type Ponto2D } from '../core/geometria';
import { espelharPonto, pontosDoTraco, ROTULO_DA_VISTA, type DesenhoTecnico, type TracoDoDesenho, type VistaDoDesenho } from './desenhoTecnico';
import type { PontoDeMedida } from './fichaTecnica';
import { numeroComVirgula } from '../core/numeros';

/**
 * O consumo do tecido pelo desenho técnico (ADR 0127), antes do molde: as formas fechadas do croqui (o contorno da
 * roupa, de frente e de costas, e o dos bolsos e das golas desenhados por cima) medidas na escala que as cotas dão —
 * a cota ligada a uma medida da ficha diz quantos milímetros tem uma unidade da folha.
 */

/** A escala de uma cota: a medida, o valor dela no tamanho e os milímetros por unidade da folha que dá. */
export interface EscalaDaCota {
  readonly medida: string;
  readonly valorCm: number;
  readonly mmPorUnidade: number;
}

export interface EscalaDoDesenho {
  /** A escala usada: a do meio, entre as das cotas. */
  readonly mmPorUnidade: number;
  readonly cotas: readonly EscalaDaCota[];
  /** A maior diferença entre a escala de uma cota e a usada, em % dela (0 com uma cota só). */
  readonly diferencaPercentual: number;
}

/** A escala pelas cotas ligadas a uma medida com valor no tamanho; `null` sem nenhuma. */
export function escalaDoDesenho(desenho: DesenhoTecnico, medidas: readonly PontoDeMedida[], tamanho: string): EscalaDoDesenho | null {
  const cotas: EscalaDaCota[] = [];
  for (const e of desenho.elementos) {
    if (e.tipo !== 'cota' || e.medidaId === null) continue;
    const medida = medidas.find((m) => m.id === e.medidaId);
    const valorCm = medida?.valoresCm[tamanho];
    const comprimento = distancia(e.de, e.ate);
    if (!medida || valorCm === undefined || !(valorCm > 0) || !(comprimento > 0)) continue;
    cotas.push({ medida: medida.nome, valorCm, mmPorUnidade: (valorCm * 10) / comprimento });
  }
  if (cotas.length === 0) return null;
  const ordenadas = cotas.map((c) => c.mmPorUnidade).sort((a, b) => a - b);
  const meio = ordenadas.length % 2 === 1 ? ordenadas[(ordenadas.length - 1) / 2]! : (ordenadas[ordenadas.length / 2 - 1]! + ordenadas[ordenadas.length / 2]!) / 2;
  const diferencaPercentual = Math.max(...cotas.map((c) => (Math.abs(c.mmPorUnidade - meio) / meio) * 100));
  return { mmPorUnidade: meio, cotas, diferencaPercentual };
}

/**
 * A área da união de polígonos, por faixas: em cada faixa, os trechos de dentro de cada polígono (par ou ímpar)
 * juntados. Serve à forma espelhada, que é a união dela com o espelho (o que passa do meio não conta duas vezes).
 */
export function areaDaUniao(poligonos: readonly (readonly Ponto2D[])[], passo = 0.25): number {
  const ys = poligonos.flatMap((p) => p.map((q) => q.y));
  if (ys.length === 0) return 0;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let total = 0;
  for (let y = minY + passo / 2; y < maxY; y += passo) {
    const trechos: [number, number][] = [];
    for (const poligono of poligonos) {
      const xs: number[] = [];
      for (let i = 0; i < poligono.length; i++) {
        const a = poligono[i]!;
        const b = poligono[(i + 1) % poligono.length]!;
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) trechos.push([xs[k]!, xs[k + 1]!]);
    }
    trechos.sort((p, q) => p[0] - q[0]);
    let fim = -Infinity;
    for (const [de, ate] of trechos) {
      if (ate <= fim) continue;
      total += (ate - Math.max(de, fim)) * passo;
      fim = ate;
    }
  }
  return total;
}

/** Uma forma do croqui que entra no consumo: o contorno fechado, na vista, com a área na folha (unidades²). */
export interface FormaDoConsumo {
  readonly id: string;
  readonly vista: VistaDoDesenho;
  readonly areaNaFolha: number;
  /** A largura e a altura da forma na folha (com o espelho), em unidades. */
  readonly larguraNaFolha: number;
  readonly alturaNaFolha: number;
}

/** As formas que entram no consumo: os traços fechados de contorno; a espelhada vale com o espelho (sem repetir o meio). */
export function formasDoConsumo(desenho: DesenhoTecnico): FormaDoConsumo[] {
  return desenho.elementos
    .filter((e): e is TracoDoDesenho => e.tipo === 'traco' && e.fechado && e.estilo === 'contorno' && e.pontos.length >= 3)
    .map((t) => {
      const contorno = pontosDoTraco(t);
      const comEspelho = t.espelhar ? [...contorno, ...contorno.map(espelharPonto)] : contorno;
      const xs = comEspelho.map((p) => p.x);
      const ys = comEspelho.map((p) => p.y);
      return {
        id: t.id,
        vista: t.vista,
        areaNaFolha: areaDaUniao(t.espelhar ? [contorno, contorno.map(espelharPonto)] : [contorno]),
        larguraNaFolha: Math.max(...xs) - Math.min(...xs),
        alturaNaFolha: Math.max(...ys) - Math.min(...ys),
      };
    })
    .filter((f) => f.areaNaFolha > 0);
}

export type EstimativaPeloDesenho =
  | {
      readonly ok: true;
      /** A área das formas na roupa (mm²), sem a costura e a folga. */
      readonly areaMm2: number;
      readonly porVista: Readonly<Record<VistaDoDesenho, number>>;
      readonly escala: EscalaDoDesenho;
      readonly formas: number;
      /**
       * A maior forma do desenho nesta escala (a roupa), em mm: a largura e a altura. Para conferir de olho — a cota
       * ligada à medida errada (o busto inteiro numa cota da frente) dá uma roupa do dobro do tamanho.
       */
      readonly larguraMm: number;
      readonly alturaMm: number;
      /** Como saiu ("frente 0,412 m² + costas 0,398 m², na escala da cota de Comprimento (70 cm no M)"). */
      readonly comoSaiu: string;
    }
  | { readonly ok: false; readonly erro: string };

/** A área da roupa pelo desenho, no tamanho dado. */
export function estimativaPeloDesenho(desenho: DesenhoTecnico | undefined, medidas: readonly PontoDeMedida[], tamanho: string): EstimativaPeloDesenho {
  if (!desenho) return { ok: false, erro: 'Pelo desenho: a ficha ainda não tem o desenho técnico.' };
  const formas = formasDoConsumo(desenho);
  if (formas.length === 0) return { ok: false, erro: 'Pelo desenho: o desenho técnico não tem nenhum contorno fechado (feche o traço do contorno da roupa).' };
  const escala = escalaDoDesenho(desenho, medidas, tamanho);
  if (!escala) return { ok: false, erro: `Pelo desenho: nenhuma cota do desenho está ligada a uma medida com valor no tamanho ${tamanho} — a cota dá a escala.` };
  const mm2 = escala.mmPorUnidade * escala.mmPorUnidade;
  const porVista = { frente: 0, costas: 0 };
  for (const f of formas) porVista[f.vista] += f.areaNaFolha * mm2;
  const areaMm2 = porVista.frente + porVista.costas;
  const vistas = (Object.keys(porVista) as VistaDoDesenho[]).filter((v) => porVista[v] > 0);
  const cota = escala.cotas[0]!;
  const comoSaiu = `${vistas.map((v) => `${ROTULO_DA_VISTA[v].toLowerCase()} ${numeroComVirgula(porVista[v] / 1e6, 3)} m²`).join(' + ')}, na escala da cota de ${cota.medida} (${numeroComVirgula(cota.valorCm)} cm no ${tamanho})${escala.cotas.length > 1 ? ` e de mais ${escala.cotas.length - 1}` : ''}`;
  const maior = formas.reduce((a, b) => (b.areaNaFolha > a.areaNaFolha ? b : a));
  return {
    ok: true,
    areaMm2,
    porVista,
    escala,
    formas: formas.length,
    larguraMm: maior.larguraNaFolha * escala.mmPorUnidade,
    alturaMm: maior.alturaNaFolha * escala.mmPorUnidade,
    comoSaiu,
  };
}

/**
 * A roupa desenhada com um tamanho que nenhuma roupa tem (mais de 1,60 m, ou menos de 10 cm, de largura ou de
 * altura): a escala está errada — quase sempre a cota ligada à medida de uma volta inteira (o busto, a cintura) numa
 * cota que atravessa só a frente, o que dobra a escala. O aviso a dar; `null` quando o tamanho é de roupa.
 */
export function avisoDoTamanhoDaRoupa(e: Extract<EstimativaPeloDesenho, { ok: true }>): string | null {
  const cm = (mm: number): string => numeroComVirgula(Math.round(mm / 10));
  const tamanho = `${cm(e.larguraMm)} × ${cm(e.alturaMm)} cm`;
  if (Math.max(e.larguraMm, e.alturaMm) > 1600) {
    return `Nesta escala a roupa tem ${tamanho}: grande demais. Confira a medida da cota — a volta inteira (o busto, a cintura) numa cota que atravessa só a frente dobra a escala.`;
  }
  if (Math.min(e.larguraMm, e.alturaMm) < 100) return `Nesta escala a roupa tem ${tamanho}: pequena demais. Confira a medida da cota.`;
  return null;
}

/** O tamanho do meio da lista (o de referência do consumo, quando o item não diz outro). */
export function tamanhoDoMeio(tamanhos: readonly string[]): string | null {
  return tamanhos.length === 0 ? null : tamanhos[Math.floor((tamanhos.length - 1) / 2)]!;
}
