import { retanguloEnvolvente, distancia, pontoDentroDoContorno, pontoMaisProximoNoSegmento, type Ponto2D } from '../core/geometria';
import { abrirSimetrias } from './anotacoes';
import { linhaDeCorteDaPeca, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { expandirTamanhos } from './tamanhosGraduados';

/**
 * Plotar os moldes (ADR 0167), e não o encaixe: as opções de plotagem do manual da referência. Conferir a peça em papel
 * antes de encaixar, ou tirar os moldes de papel: só as selecionadas, cada tamanho separado, desdobradas, giradas 90°,
 * reorganizadas na largura do papel.
 */

export interface OpcoesDosMoldes {
  readonly ids?: ReadonlySet<string>;
  readonly tamanhosSeparados?: boolean;
  readonly desdobrar?: boolean;
  readonly girar90?: boolean;
  readonly larguraDoPapelMm: number;
  readonly distanciaMm?: number;
}

/** As peças em colunas na largura do papel, uma coluna depois da outra no comprimento. */
export function organizarPecas(pecas: readonly Molde[], larguraMm: number, distanciaMm = 20): Molde[] {
  let x = 0;
  let y = 0;
  let comprimentoDaColuna = 0;
  return pecas.map((p) => {
    const c = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    const largura = c.maxX - c.minX;
    const comprimento = c.maxY - c.minY;
    if (x > 0 && x + largura > larguraMm) {
      y += comprimentoDaColuna + distanciaMm;
      x = 0;
      comprimentoDaColuna = 0;
    }
    const posta = transladarMolde(p, { x: x - c.minX, y: y - c.minY }, p.id);
    x += largura + distanciaMm;
    comprimentoDaColuna = Math.max(comprimentoDaColuna, comprimento);
    return posta;
  });
}

export function moldesParaPlotar(pecas: readonly Molde[], o: OpcoesDosMoldes, novoId: () => string): Molde[] {
  let lista: readonly Molde[] = o.ids ? pecas.filter((p) => o.ids!.has(p.id)) : pecas;
  if (o.tamanhosSeparados) lista = expandirTamanhos(lista, novoId);
  if (o.desdobrar) lista = abrirSimetrias(lista, novoId);
  if (o.girar90) lista = lista.map((p) => rotacionarMolde(p, 90));
  return organizarPecas(lista, o.larguraDoPapelMm, o.distanciaMm ?? 20);
}

const FOLGA_DO_ZOOM_NO_ELEMENTO_MM = 20;

/** O que o "Zoom de um elemento" enquadra: a linha interna ou o furo sob o ponto, ou a peça (ADR 0181). */
export function retanguloDoElemento(pecas: readonly Molde[], p: Ponto2D, raioMm: number): ReturnType<typeof retanguloEnvolvente> | null {
  const perto = (linha: readonly Ponto2D[]): boolean => linha.some((a, i) => {
    const b = linha[i + 1];
    return b !== undefined && distancia(p, pontoMaisProximoNoSegmento(p, a, b)) <= raioMm;
  });
  for (const peca of [...pecas].reverse()) {
    const elemento = [...peca.linhasInternas, ...peca.furos].find(perto);
    if (elemento) {
      const c = retanguloEnvolvente(elemento);
      const f = FOLGA_DO_ZOOM_NO_ELEMENTO_MM;
      return retanguloEnvolvente([{ x: c.minX - f, y: c.minY - f }, { x: c.maxX + f, y: c.maxY + f }]);
    }
    if (pontoDentroDoContorno(p, peca.contorno)) return retanguloEnvolvente(peca.contorno);
  }
  return null;
}

/** A peça seguinte (ou a anterior) da lista, dando a volta; sem seleção, a primeira. */
export function moldeVizinho(pecas: readonly Molde[], id: string | null, passo: 1 | -1): Molde | null {
  if (pecas.length === 0) return null;
  const i = pecas.findIndex((p) => p.id === id);
  if (i < 0) return pecas[0]!;
  return pecas[(i + passo + pecas.length) % pecas.length]!;
}
