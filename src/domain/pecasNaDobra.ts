import { area, retanguloEnvolvente } from '../core/geometria';
import { arestaDeSimetria } from './anotacoes';
import { areaUtilDaMesa, type ConfiguracaoDeEnfesto, type ZonaBloqueada } from './enfesto';
import { linhaDeCorteDaPeca, rotacionarMolde, rotacoesNoEncaixe, transladarMolde, type Molde } from './molde';
import type { PecaColocada, ResultadoDeNesting } from './nesting';

/**
 * O molde dobrado na dobra do tecido (ADR 0172): no enfesto par e no tubular, o tecido vem dobrado, e a peça de simetria
 * (meia peça) tem de ir com a linha de simetria na dobra — em qualquer outro lugar, ela sairia cortada em duas. Essas
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

/** A peça girada de modo que a linha de simetria fique na borda de cima da largura, no sentido do comprimento. */
function naPosicaoDaDobra(peca: Molde, sentidoUnico: boolean): Molde | null {
  const indice = arestaDeSimetria(peca);
  if (indice === null) return null;
  for (const angulo of rotacoesNoEncaixe(peca.restricaoDeRotacao, sentidoUnico)) {
    const m = angulo === 0 ? peca : rotacionarMolde(peca, angulo);
    const a = m.contorno[indice]!;
    const b = m.contorno[(indice + 1) % m.contorno.length]!;
    const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(m));
    if (Math.abs(a.x - b.x) <= TOLERANCIA_MM && Math.abs(a.x - caixa.minX) <= TOLERANCIA_MM) return m;
  }
  return null;
}

const seCruzam = (a: ZonaBloqueada, b: ZonaBloqueada): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

export function prepararDobra(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, sentidoUnico = false): DobraPreparada {
  if (enfesto.tipo !== 'par' && enfesto.tipo !== 'tubular') return { fixas: [], resto: pecas, enfesto };
  const util = areaUtilDaMesa(enfesto);
  const bloqueadas = [...(enfesto.zonasBloqueadas ?? [])];
  const fixas: PecaColocada[] = [];
  const resto: Molde[] = [];
  let y = util.minY;
  for (const peca of pecas) {
    const orientada = naPosicaoDaDobra(peca, sentidoUnico);
    if (!orientada) {
      resto.push(peca);
      continue;
    }
    const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(orientada));
    const largura = caixa.maxX - caixa.minX;
    const comprimento = caixa.maxY - caixa.minY;
    let postas = 0;
    for (let copia = 0; copia < peca.quantidade; copia++) {
      for (let z = bloqueadas.find((b) => seCruzam(b, { minX: 0, maxX: largura, minY: y, maxY: y + comprimento })); z; z = bloqueadas.find((b) => seCruzam(b, { minX: 0, maxX: largura, minY: y, maxY: y + comprimento }))) {
        y = z.maxY + enfesto.distanciaMinimaEntrePecasMm;
      }
      if (largura > util.maxX || y + comprimento > util.maxY) break;
      const molde = transladarMolde(orientada, { x: -caixa.minX, y: y - caixa.minY }, `${peca.id}#${copia}`);
      fixas.push({ idOriginal: peca.id, indiceCopia: copia, molde });
      bloqueadas.push({ minX: 0, maxX: largura, minY: y, maxY: y + comprimento });
      y += comprimento + enfesto.distanciaMinimaEntrePecasMm;
      postas++;
    }
    if (postas < peca.quantidade) resto.push({ ...peca, quantidade: peca.quantidade - postas });
  }
  return { fixas, resto, enfesto: fixas.length > 0 ? { ...enfesto, zonasBloqueadas: bloqueadas } : enfesto };
}

/** O resultado do encaixe com as peças da dobra de volta, e as contas refeitas com elas. */
export function juntarDobra(resultado: ResultadoDeNesting, dobra: DobraPreparada, enfesto: ConfiguracaoDeEnfesto): ResultadoDeNesting {
  if (dobra.fixas.length === 0) return resultado;
  const pecasColocadas = [...dobra.fixas, ...resultado.pecasColocadas];
  const cortes = pecasColocadas.map((p) => linhaDeCorteDaPeca(p.molde));
  const comprimentoUtilizadoMm = Math.max(...cortes.map((c) => retanguloEnvolvente(c).maxY));
  const areaOcupadaMm2 = cortes.reduce((s, c) => s + area(c), 0);
  const disponivel = enfesto.larguraUtilMm * comprimentoUtilizadoMm;
  return { ...resultado, pecasColocadas, comprimentoUtilizadoMm, areaOcupadaMm2, aproveitamentoPercentual: disponivel > 0 ? (areaOcupadaMm2 / disponivel) * 100 : 0 };
}
