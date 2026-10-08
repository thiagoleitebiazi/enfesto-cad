/**
 * Extrai contornos fechados de um PDF de desenho vetorial qualquer, como
 * candidatos a peças, mantendo as coordenadas reais da página (em pontos,
 * origem no canto inferior esquerdo). Não lê texto (os nomes costumam estar
 * desenhados como vetor), não sabe a escala real e não sabe a direção do
 * fio: tudo isso é definido por quem importa.
 */
import type { Ponto2D } from '../core/geometria';
import { lerConteudosDeDesenho } from './pdf-fluxos';

export const PT_PARA_MM = 25.4 / 72;

const AREA_MINIMA_MM2 = 500;
const FRACAO_DA_FOLHA_QUE_E_BORDA = 0.9;
const TOLERANCIA_DE_FECHAMENTO_PT = 0.5;

export interface ContornoCandidatoPdf {
  readonly id: string;
  readonly contornoPt: readonly Ponto2D[];
  readonly vertices: number;
  readonly larguraPt: number;
  readonly alturaPt: number;
}

export interface DescartesDePdf {
  readonly borda: number;
  readonly areaPequena: number;
  readonly abertos: number;
}

export interface ResultadoContornosPdf {
  readonly candidatos: readonly ContornoCandidatoPdf[];
  readonly descartados: DescartesDePdf;
  readonly curvasAproximadas: number;
  readonly alturaPaginaPt: number | null;
}

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
        if (n.length >= 6) {
          ctm = multiplicar([n[n.length - 6]!, n[n.length - 5]!, n[n.length - 4]!, n[n.length - 3]!, n[n.length - 2]!, n[n.length - 1]!], ctm);
        }
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

export async function extrairContornosDoPdf(bytesComoLatin1: string): Promise<ResultadoContornosPdf> {
  const bytes = Uint8Array.from(bytesComoLatin1, (c) => c.charCodeAt(0) & 0xff);
  const folha = lerCaixaDaPagina(bytesComoLatin1);
  const candidatos: ContornoCandidatoPdf[] = [];
  const descartados = { borda: 0, areaPequena: 0, abertos: 0 };
  let curvasAproximadas = 0;

  if (folha === null) {
    return { candidatos, descartados, curvasAproximadas, alturaPaginaPt: null };
  }

  const areaMinimaPt2 = AREA_MINIMA_MM2 / (PT_PARA_MM * PT_PARA_MM);
  let indice = 0;

  for (const conteudo of await lerConteudosDeDesenho(bytes)) {
    const { subcaminhos, curvas } = subcaminhosDoConteudo(conteudo);
    curvasAproximadas += curvas;

    for (const sub of subcaminhos) {
      if (!ehFechado(sub)) {
        descartados.abertos++;
        continue;
      }
      let pontos = sub.pontos;
      const primeiro = pontos[0]!;
      const ultimo = pontos[pontos.length - 1]!;
      if (pontos.length > 1 && Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y) <= TOLERANCIA_DE_FECHAMENTO_PT) {
        pontos = pontos.slice(0, -1);
      }

      const xs = pontos.map((p) => p.x);
      const ys = pontos.map((p) => p.y);
      const larguraPt = Math.max(...xs) - Math.min(...xs);
      const alturaPt = Math.max(...ys) - Math.min(...ys);
      if (larguraPt >= folha.largura * FRACAO_DA_FOLHA_QUE_E_BORDA && alturaPt >= folha.altura * FRACAO_DA_FOLHA_QUE_E_BORDA) {
        descartados.borda++;
        continue;
      }
      // Peças retangulares (cós, viés, acabamentos) têm 4 vértices: o filtro é
      // só pela área, que elimina as letras desenhadas como contorno.
      if (pontos.length < 3 || areaDoPoligono(pontos) < areaMinimaPt2) {
        descartados.areaPequena++;
        continue;
      }

      indice++;
      candidatos.push({
        id: `contorno-${indice}`,
        contornoPt: pontos,
        vertices: pontos.length,
        larguraPt,
        alturaPt,
      });
    }
  }

  return { candidatos, descartados, curvasAproximadas, alturaPaginaPt: folha.altura };
}

/**
 * Converte um contorno do PDF para milímetros do mesmo modo que ele aparece
 * na página: a escala do usuário multiplica o tamanho do papel, e o eixo
 * vertical é invertido porque o PDF tem y para cima e a tela tem y para baixo.
 */
export function contornoEmMundo(candidato: ContornoCandidatoPdf, alturaPaginaPt: number, fatorDeEscala: number): Ponto2D[] {
  const k = PT_PARA_MM * fatorDeEscala;
  return candidato.contornoPt.map((p) => ({ x: (alturaPaginaPt - p.y) * k, y: p.x * k }));
}

/**
 * Linha de fio representando a direção escolhida pelo usuário, centrada na
 * caixa do contorno. Na tela, "vertical" varia o eixo x do domínio.
 */
export function linhaDeFioSobreContorno(
  contorno: readonly Ponto2D[],
  direcao: 'vertical' | 'horizontal',
): { inicio: Ponto2D; fim: Ponto2D } {
  const xs = contorno.map((p) => p.x);
  const ys = contorno.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (direcao === 'vertical') {
    const h = maxX - minX;
    return { inicio: { x: minX + h * 0.1, y: cy }, fim: { x: minX + h * 0.9, y: cy } };
  }
  const w = maxY - minY;
  return { inicio: { x: cx, y: minY + w * 0.1 }, fim: { x: cx, y: minY + w * 0.9 } };
}
