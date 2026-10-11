import { area, distancia, type Ponto2D } from '../core/geometria';
import { alterarCirculo, alterarEspiral, figuraDaPeca } from '../domain/figuras';
import type { FiguraDaPeca, Molde } from '../domain/molde';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { ResultadoDeFerramentaDeMolde } from './ferramentasDeMolde';
import { formatarMm } from './medidas';

/**
 * O círculo do "Por raio" e a espiral, depois de feitos: com a ferramenta
 * ligada, o clique no centro de um deles (marcado com um anel) abre as
 * medidas, e a figura é refeita no mesmo lugar.
 */
export type TipoDeFigura = FiguraDaPeca['tipo'];

function paraCampo(valor: number): string {
  return String(Math.round(valor * 100) / 100).replace('.', ',');
}

function cm2(areaMm2: number): string {
  return `${(areaMm2 / 100).toFixed(1).replace('.', ',')} cm²`;
}

/** Os centros das figuras desse tipo que continuam registradas nas peças: é onde se clica para mudar as medidas. */
export function centrosDasFiguras(pecas: readonly Molde[], tipo: TipoDeFigura): Ponto2D[] {
  return pecas.flatMap((peca) => {
    const figura = figuraDaPeca(peca);
    return figura && figura.tipo === tipo ? [figura.centro] : [];
  });
}

/** A peça cuja figura desse tipo tem o centro a até `raioMm` do ponto (a de centro mais próximo), ou `null`. */
export function figuraSobOClique(pecas: readonly Molde[], p: Ponto2D, raioMm: number, tipo: TipoDeFigura): Molde | null {
  let melhor: { peca: Molde; distancia: number } | null = null;
  for (const peca of pecas) {
    const figura = figuraDaPeca(peca);
    if (!figura || figura.tipo !== tipo) continue;
    const d = distancia(p, figura.centro);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { peca, distancia: d };
  }
  return melhor ? melhor.peca : null;
}

/** O que a instrução da ferramenta acrescenta quando há figuras desse tipo para mudar. */
export function avisoDasFiguras(pecas: readonly Molde[], tipo: TipoDeFigura): string {
  if (centrosDasFiguras(pecas, tipo).length === 0) return '';
  return tipo === 'circulo'
    ? ' Ou clique no centro de um círculo já feito (o anel) para mudar o raio dele.'
    : ' Ou clique no centro de uma espiral já feita (o anel) para mudar a largura e o perímetro dela.';
}

/** O diálogo das medidas da figura; `null` se a peça já não é a figura que foi feita. */
export function dialogoDaFigura(peca: Molde): { readonly titulo: string; readonly campos: readonly CampoDoDialogo[]; readonly nota: string } | null {
  const figura = figuraDaPeca(peca);
  if (!figura) return null;
  if (figura.tipo === 'circulo') {
    return {
      titulo: 'Círculo: medidas',
      campos: [{ tipo: 'medida', id: 'raio', rotulo: 'Raio (mm)', inicial: paraCampo(figura.raioMm) }],
      nota: 'O círculo é refeito com o raio novo, no mesmo centro. O que está na peça — a linha de fio, as linhas, as marcas e os piques — cresce ou encolhe junto, na mesma proporção. O registro do círculo vale enquanto o contorno não é mexido à mão nem cortado; dimensionada a peça por igual nos dois sentidos, ele continua valendo, com o raio novo (com fatores diferentes, o círculo vira outra coisa, e o registro deixa de valer).',
    };
  }
  return {
    titulo: 'Espiral: medidas',
    campos: [
      { tipo: 'medida', id: 'largura', rotulo: 'Largura da tira (mm)', inicial: paraCampo(figura.larguraMm) },
      { tipo: 'medida', id: 'perimetro', rotulo: 'Perímetro (mm): o comprimento da borda de dentro', inicial: paraCampo(figura.perimetroMm) },
    ],
    nota: 'A espiral é refeita no mesmo centro, com as medidas novas. Os piques vão para o ponto mais próximo da borda nova, e a linha de fio é levada para dentro da tira se ficar de fora; o resto que estiver desenhado na peça não muda de lugar. O registro da espiral vale enquanto o contorno não é mexido à mão, cortado nem dimensionado.',
  };
}

/** Aplica o diálogo das medidas na figura. Lança erro, sem mudar nada, quando as medidas não servem. */
export function aplicarDialogoDaFigura(pecas: readonly Molde[], peca: Molde, valores: ValoresDoDialogo): ResultadoDeFerramentaDeMolde {
  const figura = figuraDaPeca(peca);
  if (!figura) throw new Error('Essa peça foi mexida depois de feita e já não pode ser mudada pelas medidas.');
  const trocar = (nova: Molde): Molde[] => pecas.map((q) => (q.id === peca.id ? nova : q));
  const areas = (nova: Molde): string => `A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(nova.contorno))}.`;
  if (figura.tipo === 'circulo') {
    const raioMm = Number(valores.raio);
    const nova = alterarCirculo(peca, raioMm);
    return { pecas: trocar(nova), recado: `Círculo “${peca.nome}” refeito: o raio passou de ${formatarMm(figura.raioMm)} para ${formatarMm(raioMm)}. ${areas(nova)}` };
  }
  const larguraMm = Number(valores.largura);
  const perimetroMm = Number(valores.perimetro);
  const nova = alterarEspiral(peca, larguraMm, perimetroMm);
  return {
    pecas: trocar(nova),
    recado: `Espiral “${peca.nome}” refeita: largura de ${formatarMm(larguraMm)} e perímetro de ${formatarMm(perimetroMm)} (eram ${formatarMm(figura.larguraMm)} e ${formatarMm(figura.perimetroMm)}). ${areas(nova)}`,
  };
}
