import { area, retanguloEnvolvente } from '../core/geometria';
import { arestaDeSimetria } from './anotacoes';
import { areaUtilDaMesa, dobraDoEnfesto, type ConfiguracaoDeEnfesto, type DobraDoTecido, type ZonaBloqueada } from './enfesto';
import { linhaDeCorteDaPeca, rotacionarMolde, rotacoesNoEncaixe, transladarMolde, type Molde } from './molde';
import type { PecaColocada, ResultadoDeNesting } from './nesting';

/**
 * O molde dobrado na dobra do tecido (ADR 0172): no enfesto par e no tubular, o tecido vem dobrado, e a peça de simetria
 * (meia peça) tem de ir com a linha de simetria na dobra — em qualquer outro lugar, ela sairia cortada em duas. No
 * zigue-zague, o tecido dobra nas pontas da mesa, e a peça vai na do começo (ADR 0180). Essas
 * peças entram primeiro, uma depois da outra, encostadas na borda da dobra (o começo da largura, sem a margem de
 * segurança: a 4 mm da dobra a peça sairia em duas), giradas só no que a restrição delas deixa; as outras se encaixam em volta, como numa área bloqueada. A peça que não dá para pôr na dobra
 * (a rotação não deixa, ou acabou a mesa) segue com as outras, como antes.
 */

export interface DobraPreparada {
  readonly fixas: readonly PecaColocada[];
  readonly resto: readonly Molde[];
  /** O enfesto com o lugar das peças fixas bloqueado. */
  readonly enfesto: ConfiguracaoDeEnfesto;
}

const TOLERANCIA_MM = 1;

/** A peça girada de modo que a linha de simetria fique na borda da dobra: a de cima (horizontal) ou a do começo do comprimento (vertical). */
export function naPosicaoDaDobra(peca: Molde, sentidoUnico: boolean, dobra: DobraDoTecido = 'horizontal', inferior = false): Molde | null {
  const indice = arestaDeSimetria(peca);
  if (indice === null) return null;
  const eixo = dobra === 'horizontal' ? 'x' : 'y';
  for (const angulo of rotacoesNoEncaixe(peca.restricaoDeRotacao, sentidoUnico)) {
    const m = angulo === 0 ? peca : rotacionarMolde(peca, angulo);
    const a = m.contorno[indice]!;
    const b = m.contorno[(indice + 1) % m.contorno.length]!;
    const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(m));
    const borda = dobra === 'vertical' ? caixa.minY : inferior ? caixa.maxX : caixa.minX;
    if (Math.abs(a[eixo] - b[eixo]) <= TOLERANCIA_MM && Math.abs(a[eixo] - borda) <= TOLERANCIA_MM) return m;
  }
  return null;
}

const seCruzam = (a: ZonaBloqueada, b: ZonaBloqueada): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

export function prepararDobra(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, sentidoUnico = false): DobraPreparada {
  const dobra = dobraDoEnfesto(enfesto.tipo);
  if (!dobra) return { fixas: [], resto: pecas, enfesto };
  const horizontal = dobra === 'horizontal';
  const inferior = horizontal && enfesto.dobraInferior === true;
  const util = areaUtilDaMesa(enfesto);
  const bloqueadas = [...(enfesto.zonasBloqueadas ?? [])];
  const fixas: PecaColocada[] = [];
  const resto: Molde[] = [];
  // Anda-se ao longo da dobra: no comprimento, na horizontal; na largura, na vertical.
  let s = horizontal ? util.minY : util.minX;
  const fim = horizontal ? util.maxY : util.maxX;
  const fundo = horizontal ? util.maxX : util.maxY;
  for (const peca of pecas) {
    const orientada = peca.foraDaDobra ? null : naPosicaoDaDobra(peca, sentidoUnico, dobra, inferior);
    if (!orientada) {
      resto.push(peca);
      continue;
    }
    const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(orientada));
    const largura = caixa.maxX - caixa.minX;
    const comprimento = caixa.maxY - caixa.minY;
    const zona = (inicio: number): ZonaBloqueada =>
      horizontal
        ? { minX: inferior ? enfesto.larguraUtilMm - largura : 0, maxX: inferior ? enfesto.larguraUtilMm : largura, minY: inicio, maxY: inicio + comprimento }
        : { minX: inicio, maxX: inicio + largura, minY: 0, maxY: comprimento };
    let postas = 0;
    for (let copia = 0; copia < peca.quantidade; copia++) {
      for (let z = bloqueadas.find((b) => seCruzam(b, zona(s))); z; z = bloqueadas.find((b) => seCruzam(b, zona(s)))) {
        s = (horizontal ? z.maxY : z.maxX) + enfesto.distanciaMinimaEntrePecasMm;
      }
      if ((horizontal ? largura : comprimento) > fundo || s + (horizontal ? comprimento : largura) > fim) break;
      const molde = transladarMolde(orientada, horizontal ? { x: (inferior ? enfesto.larguraUtilMm - largura : 0) - caixa.minX, y: s - caixa.minY } : { x: s - caixa.minX, y: -caixa.minY }, `${peca.id}#${copia}`);
      fixas.push({ idOriginal: peca.id, indiceCopia: copia, molde });
      bloqueadas.push(zona(s));
      s += (horizontal ? comprimento : largura) + enfesto.distanciaMinimaEntrePecasMm;
      postas++;
    }
    if (postas < peca.quantidade) resto.push({ ...peca, quantidade: peca.quantidade - postas });
  }
  return { fixas, resto, enfesto: fixas.length > 0 ? { ...enfesto, zonasBloqueadas: bloqueadas } : enfesto };
}

/** O resultado do encaixe com as peças da dobra de volta, e as contas refeitas com elas. */
export function juntarDobra(resultado: ResultadoDeNesting, dobra: DobraPreparada, enfesto: ConfiguracaoDeEnfesto): ResultadoDeNesting {
  if (dobra.fixas.length === 0) return resultado;
  return comContasRefeitas(resultado, [...dobra.fixas, ...resultado.pecasColocadas], enfesto);
}

/** O resultado com estas peças, e o comprimento, a área e o aproveitamento contados de novo. */
export function comContasRefeitas(resultado: ResultadoDeNesting, pecasColocadas: readonly PecaColocada[], enfesto: Pick<ConfiguracaoDeEnfesto, 'larguraUtilMm'>): ResultadoDeNesting {
  const cortes = pecasColocadas.map((p) => linhaDeCorteDaPeca(p.molde));
  const comprimentoUtilizadoMm = Math.max(...cortes.map((c) => retanguloEnvolvente(c).maxY));
  const areaOcupadaMm2 = cortes.reduce((s, c) => s + area(c), 0);
  const disponivel = enfesto.larguraUtilMm * comprimentoUtilizadoMm;
  return { ...resultado, pecasColocadas, comprimentoUtilizadoMm, areaOcupadaMm2, aproveitamentoPercentual: disponivel > 0 ? (areaOcupadaMm2 / disponivel) * 100 : 0 };
}
