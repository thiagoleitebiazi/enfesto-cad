/**
 * Extrai contornos fechados de um PDF de desenho vetorial qualquer, como
 * candidatos a peças. Não lê texto (os nomes costumam estar desenhados como
 * vetor) e não sabe a escala real: as medidas saem na escala do papel, em mm
 * (1 pt = 1/72 in), e quem importa decide a escala depois.
 */
import type { Ponto2D } from '../core/geometria';
import { lerConteudosDeDesenho } from './pdf-fluxos';

export interface PecaVetorialExtraida {
  readonly contorno: readonly Ponto2D[];
  readonly larguraMm: number;
  readonly alturaMm: number;
  readonly vertices: number;
}

export interface ResultadoPecasVetoriais {
  readonly pecas: readonly PecaVetorialExtraida[];
  readonly descartadas: number;
  readonly curvasAproximadas: number;
}

const PT_PARA_MM = 25.4 / 72;
const MINIMO_DE_VERTICES = 8;
const AREA_MINIMA_MM2 = 500;
const FRACAO_DA_FOLHA_QUE_E_BORDA = 0.9;
const TOLERANCIA_DE_FECHAMENTO_PT = 0.5;

type Matriz = readonly [number, number, number, number, number, number];
const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0];

function multiplicar(a: Matriz, b: Matriz): Matriz {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

function aplicar(m: Matriz, x: number, y: number): Ponto2D {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

interface Subcaminho {
  readonly pontos: Ponto2D[];
  fechado: boolean;
}

function areaDoPoligono(pontos: readonly Ponto2D[]): number {
  let soma = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i]!;
    const b = pontos[(i + 1) % pontos.length]!;
    soma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(soma) / 2;
}

function lerCaixaDaPagina(bytesComoLatin1: string): { largura: number; altura: number } | null {
  const caixa = bytesComoLatin1.match(/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/);
  if (!caixa) return null;
  return {
    largura: Number(caixa[3]) - Number(caixa[1]),
    altura: Number(caixa[4]) - Number(caixa[2]),
  };
}

function subcaminhosDoConteudo(conteudo: string): { subcaminhos: Subcaminho[]; curvas: number } {
  const subcaminhos: Subcaminho[] = [];
  const pilhaDeMatrizes: Matriz[] = [];
  let ctm: Matriz = IDENTIDADE;
  let atual: Subcaminho | null = null;
  let curvas = 0;
  let numeros: number[] = [];

  const fechar = (fechado: boolean) => {
    if (atual) {
      if (fechado) atual.fechado = true;
      if (atual.pontos.length >= 2) subcaminhos.push(atual);
      atual = null;
    }
  };

  for (const token of conteudo.match(/-?\d*\.?\d+|[A-Za-z'"*]+|\[|\]|\/[^\s/[\]()<>{}]*/g) || []) {
    if (/^-?\d*\.?\d+$/.test(token)) {
      numeros.push(Number(token));
      continue;
    }
    if (!/^[A-Za-z'"*]+$/.test(token)) continue;
    const n = numeros;
    numeros = [];
    switch (token) {
      case 'cm':
        if (n.length >= 6) ctm = multiplicar([n[n.length - 6]!, n[n.length - 5]!, n[n.length - 4]!, n[n.length - 3]!, n[n.length - 2]!, n[n.length - 1]!], ctm);
        break;
      case 'q':
        pilhaDeMatrizes.push(ctm);
        break;
      case 'Q':
        ctm = pilhaDeMatrizes.pop() ?? IDENTIDADE;
        break;
      case 'm':
        if (n.length >= 2) {
          fechar(false);
          atual = { pontos: [aplicar(ctm, n[n.length - 2]!, n[n.length - 1]!)], fechado: false };
        }
        break;
      case 'l':
        if (n.length >= 2 && atual) atual.pontos.push(aplicar(ctm, n[n.length - 2]!, n[n.length - 1]!));
        break;
      case 'c':
        if (n.length >= 6 && atual) {
          curvas++;
          atual.pontos.push(aplicar(ctm, n[n.length - 2]!, n[n.length - 1]!));
        }
        break;
      case 're':
        if (n.length >= 4) {
          fechar(false);
          const [x, y, w, h] = [n[n.length - 4]!, n[n.length - 3]!, n[n.length - 2]!, n[n.length - 1]!];
          subcaminhos.push({
            pontos: [aplicar(ctm, x, y), aplicar(ctm, x + w, y), aplicar(ctm, x + w, y + h), aplicar(ctm, x, y + h)],
            fechado: true,
          });
        }
        break;
      case 'h':
        fechar(true);
        break;
      case 'S':
      case 'n':
        fechar(false);
        break;
      case 's':
      case 'f':
      case 'F':
      case 'f*':
      case 'B':
      case 'B*':
      case 'b':
      case 'b*':
        fechar(true);
        break;
      default:
        break;
    }
  }
  fechar(false);
  return { subcaminhos, curvas };
}

function ehFechado(sub: Subcaminho): boolean {
  if (sub.fechado) return true;
  const primeiro = sub.pontos[0]!;
  const ultimo = sub.pontos[sub.pontos.length - 1]!;
  return Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y) <= TOLERANCIA_DE_FECHAMENTO_PT;
}

export async function extrairPecasVetoriais(bytesComoLatin1: string): Promise<ResultadoPecasVetoriais> {
  const bytes = Uint8Array.from(bytesComoLatin1, (c) => c.charCodeAt(0) & 0xff);
  const folha = lerCaixaDaPagina(bytesComoLatin1);
  const pecas: PecaVetorialExtraida[] = [];
  let descartadas = 0;
  let curvasAproximadas = 0;

  for (const conteudo of await lerConteudosDeDesenho(bytes)) {
    const { subcaminhos, curvas } = subcaminhosDoConteudo(conteudo);
    curvasAproximadas += curvas;

    for (const sub of subcaminhos) {
      if (!ehFechado(sub)) continue;
      let pontos = sub.pontos;
      const primeiro = pontos[0]!;
      const ultimo = pontos[pontos.length - 1]!;
      if (pontos.length > 1 && Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y) <= TOLERANCIA_DE_FECHAMENTO_PT) {
        pontos = pontos.slice(0, -1);
      }
      if (pontos.length < MINIMO_DE_VERTICES) {
        descartadas++;
        continue;
      }

      const xs = pontos.map((p) => p.x);
      const ys = pontos.map((p) => p.y);
      const larguraPt = Math.max(...xs) - Math.min(...xs);
      const alturaPt = Math.max(...ys) - Math.min(...ys);
      const ehBordaDaFolha =
        folha !== null && larguraPt >= folha.largura * FRACAO_DA_FOLHA_QUE_E_BORDA && alturaPt >= folha.altura * FRACAO_DA_FOLHA_QUE_E_BORDA;
      const areaMm2 = areaDoPoligono(pontos) * PT_PARA_MM * PT_PARA_MM;
      if (ehBordaDaFolha || areaMm2 < AREA_MINIMA_MM2) {
        descartadas++;
        continue;
      }

      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const contorno = pontos.map((p) => ({ x: (p.x - minX) * PT_PARA_MM, y: (p.y - minY) * PT_PARA_MM }));
      pecas.push({
        contorno,
        larguraMm: larguraPt * PT_PARA_MM,
        alturaMm: alturaPt * PT_PARA_MM,
        vertices: contorno.length,
      });
    }
  }

  return { pecas, descartadas, curvasAproximadas };
}
