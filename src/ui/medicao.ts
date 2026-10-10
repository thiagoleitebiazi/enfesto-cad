import {
  comprimentoDaLinha,
  distancia,
  perimetro,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { contornoDeCorte, type Molde } from '../domain/molde';
import { formatarMm } from './medidas';

/**
 * Medidas da aba Conferência. São leituras: ficam no desenho e na faixa de
 * mensagens até a próxima medida ou até sair da ferramenta, e não mudam o
 * projeto. O trecho guarda o contorno em que foi medido: se a peça mudar
 * depois (desfazer, mover), a medida deixa de valer em vez de mostrar um
 * número que já não é o do desenho.
 */
export type Medicao =
  | { readonly tipo: 'distancia'; readonly de: Ponto2D; readonly ate: Ponto2D }
  | { readonly tipo: 'perimetro'; readonly pecaId: string }
  | {
      readonly tipo: 'trecho';
      readonly pecaId: string;
      readonly contorno: Contorno;
      readonly de: PosicaoNoContorno;
      readonly ate: PosicaoNoContorno;
    };

/** Primeiro ponto de um trecho, à espera do segundo clique no mesmo contorno. */
export interface InicioDeTrecho {
  readonly pecaId: string;
  readonly contorno: Contorno;
  readonly de: PosicaoNoContorno;
}

export interface EstadoDeMedicao {
  readonly medicoes: readonly Medicao[];
  readonly inicioDoTrecho: InicioDeTrecho | null;
}

export const SEM_MEDICAO: EstadoDeMedicao = { medicoes: [], inicioDoTrecho: null };

/** Dois cliques a menos disso (mm) são o mesmo ponto: não formam uma medida. */
const MESMO_PONTO_MM = 1e-6;

/**
 * Onde um clique perto do contorno cai sobre ele: num vértice, se houver um
 * a até `raioMm` (medir de canto a canto é o caso comum e tem de ser exato);
 * senão, no ponto mais próximo de uma aresta. `null` se o contorno está longe.
 */
export function posicaoNoContornoPerto(p: Ponto2D, contorno: Contorno, raioMm: number): PosicaoNoContorno | null {
  let indiceDoVertice = -1;
  let menorDistancia = Infinity;
  contorno.forEach((v, i) => {
    const d = distancia(p, v);
    if (d < menorDistancia) {
      menorDistancia = d;
      indiceDoVertice = i;
    }
  });
  if (indiceDoVertice >= 0 && menorDistancia <= raioMm) {
    return { indiceAresta: indiceDoVertice, ponto: contorno[indiceDoVertice]! };
  }
  const maisProximo = pontoMaisProximoNoContorno(p, contorno);
  return maisProximo.distancia <= raioMm ? { indiceAresta: maisProximo.indiceAresta, ponto: maisProximo.ponto } : null;
}

/** O que um clique das ferramentas de perímetro acertou. */
export type AlvoDeMedicao =
  | { readonly tipo: 'contorno'; readonly peca: Molde; readonly posicao: PosicaoNoContorno }
  | { readonly tipo: 'interior'; readonly peca: Molde };

/**
 * O contorno de uma peça a até `raioMm` do clique (o da peça `preferida`
 * primeiro — a do trecho em andamento —, senão o mais próximo); se nenhum,
 * a peça de cima que contém o clique; senão, nada.
 */
export function alvoDaMedicao(
  p: Ponto2D,
  pecas: readonly Molde[],
  raioMm: number,
  preferida: string | null = null,
): AlvoDeMedicao | null {
  let melhor: { readonly peca: Molde; readonly posicao: PosicaoNoContorno; readonly distancia: number } | null = null;
  for (const peca of pecas) {
    const posicao = posicaoNoContornoPerto(p, peca.contorno, raioMm);
    if (!posicao) continue;
    if (peca.id === preferida) return { tipo: 'contorno', peca, posicao };
    const d = distancia(p, posicao.ponto);
    if (!melhor || d < melhor.distancia) melhor = { peca, posicao, distancia: d };
  }
  if (melhor) return { tipo: 'contorno', peca: melhor.peca, posicao: melhor.posicao };
  const dentro = [...pecas].reverse().find((peca) => pontoDentroDoContorno(p, peca.contorno));
  return dentro ? { tipo: 'interior', peca: dentro } : null;
}

/** Guarda uma medida pronta. Comparando, ficam até duas (a terceira recomeça); medindo, só a última. */
export function registrarMedicao(estado: EstadoDeMedicao, medicao: Medicao, comparar: boolean): EstadoDeMedicao {
  const anteriores = comparar && estado.medicoes.length < 2 ? estado.medicoes : [];
  return { medicoes: [...anteriores, medicao], inicioDoTrecho: null };
}

/**
 * Clique das ferramentas "Perímetro" e "Comparar perímetros":
 * - dentro de uma peça, longe do contorno: o perímetro inteiro dela;
 * - no contorno: o primeiro ponto de um trecho e, no segundo clique sobre o
 *   mesmo contorno, o trecho do primeiro ao segundo, seguindo a numeração
 *   dos pontos.
 */
export function cliqueDePerimetro(estado: EstadoDeMedicao, alvo: AlvoDeMedicao | null, comparar: boolean): EstadoDeMedicao {
  if (!alvo) return estado;
  if (alvo.tipo === 'interior') return registrarMedicao(estado, { tipo: 'perimetro', pecaId: alvo.peca.id }, comparar);
  const inicio = estado.inicioDoTrecho;
  if (inicio && inicio.pecaId === alvo.peca.id && inicio.contorno === alvo.peca.contorno) {
    if (distancia(inicio.de.ponto, alvo.posicao.ponto) < MESMO_PONTO_MM) return estado;
    return registrarMedicao(
      estado,
      { tipo: 'trecho', pecaId: alvo.peca.id, contorno: alvo.peca.contorno, de: inicio.de, ate: alvo.posicao },
      comparar,
    );
  }
  // Começa um trecho novo. Medindo, a medida anterior some; comparando, a
  // primeira fica à espera da segunda (e uma terceira recomeça a comparação).
  return {
    medicoes: comparar && estado.medicoes.length < 2 ? estado.medicoes : [],
    inicioDoTrecho: { pecaId: alvo.peca.id, contorno: alvo.peca.contorno, de: alvo.posicao },
  };
}

/** Uma medida já calculada sobre as peças de agora, com o que o desenho e a faixa de mensagens mostram. */
export type MedicaoResolvida =
  | {
      readonly tipo: 'distancia';
      readonly de: Ponto2D;
      readonly ate: Ponto2D;
      readonly valorMm: number;
      readonly horizontalMm: number;
      readonly verticalMm: number;
      /** Na tela, a partir da horizontal para a direita, no sentido anti-horário, de 0° a 360°. */
      readonly anguloGraus: number;
    }
  | {
      readonly tipo: 'perimetro';
      readonly peca: Molde;
      readonly valorMm: number;
      /** Perímetro da linha de corte, quando a peça tem margem de costura. */
      readonly corteMm: number | null;
    }
  | {
      readonly tipo: 'trecho';
      readonly peca: Molde;
      readonly caminho: readonly Ponto2D[];
      readonly valorMm: number;
      readonly outroLadoMm: number;
      readonly perimetroMm: number;
    };

/** Calcula a medida, ou `null` se ela já não vale (a peça sumiu, ou o contorno medido mudou). */
export function resolverMedicao(medicao: Medicao, pecas: readonly Molde[]): MedicaoResolvida | null {
  if (medicao.tipo === 'distancia') {
    // Eixos trocados na tela (ui/transformacaoDeTela.ts): a horizontal é o Y
    // do mundo; a vertical é o X, que cresce para baixo.
    const horizontal = medicao.ate.y - medicao.de.y;
    const vertical = medicao.ate.x - medicao.de.x;
    const angulo = (Math.atan2(-vertical, horizontal) * 180) / Math.PI;
    return {
      tipo: 'distancia',
      de: medicao.de,
      ate: medicao.ate,
      valorMm: distancia(medicao.de, medicao.ate),
      horizontalMm: Math.abs(horizontal),
      verticalMm: Math.abs(vertical),
      anguloGraus: (angulo + 360) % 360,
    };
  }
  const peca = pecas.find((p) => p.id === medicao.pecaId);
  if (!peca) return null;
  if (medicao.tipo === 'perimetro') {
    return {
      tipo: 'perimetro',
      peca,
      valorMm: perimetro(peca.contorno),
      corteMm: peca.margemDeCosturaMm > 0 ? perimetro(contornoDeCorte(peca)) : null,
    };
  }
  if (peca.contorno !== medicao.contorno) return null;
  const caminho = trechoDoContorno(peca.contorno, medicao.de, medicao.ate);
  const valorMm = comprimentoDaLinha(caminho);
  const perimetroMm = perimetro(peca.contorno);
  return { tipo: 'trecho', peca, caminho, valorMm, outroLadoMm: perimetroMm - valorMm, perimetroMm };
}

function graus(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}°`;
}

/** A medida escrita por extenso, para a faixa de mensagens. */
export function descreverMedicao(medicao: MedicaoResolvida): string {
  if (medicao.tipo === 'distancia') {
    return `Distância: ${formatarMm(medicao.valorMm)} · horizontal ${formatarMm(medicao.horizontalMm)} · vertical ${formatarMm(medicao.verticalMm)} · ângulo ${graus(medicao.anguloGraus)}`;
  }
  if (medicao.tipo === 'perimetro') {
    const corte =
      medicao.corteMm === null
        ? ''
        : ` · linha de corte, com a costura de ${formatarMm(medicao.peca.margemDeCosturaMm)}: ${formatarMm(medicao.corteMm)}`;
    return `Perímetro de “${medicao.peca.nome}”: ${formatarMm(medicao.valorMm)}${corte}`;
  }
  return `Trecho de “${medicao.peca.nome}”: ${formatarMm(medicao.valorMm)} · pelo outro lado ${formatarMm(medicao.outroLadoMm)} · perímetro ${formatarMm(medicao.perimetroMm)}`;
}

function rotuloCurto(medicao: MedicaoResolvida): string {
  if (medicao.tipo === 'distancia') return 'distância';
  return `${medicao.tipo === 'perimetro' ? 'perímetro' : 'trecho'} de “${medicao.peca.nome}”`;
}

/** Diferenças menores que isso (mm) aparecem como "iguais": é a precisão com que as medidas são escritas. */
const DIFERENCA_VISIVEL_MM = 0.05;

/** "Comparar perímetros": as duas medidas e a diferença entre elas. */
export function descreverComparacao(primeira: MedicaoResolvida, segunda: MedicaoResolvida): string {
  const diferenca = segunda.valorMm - primeira.valorMm;
  const qualEMaior =
    Math.abs(diferenca) < DIFERENCA_VISIVEL_MM ? 'iguais' : diferenca > 0 ? 'a 2ª é maior' : 'a 1ª é maior';
  return `1ª medida: ${formatarMm(primeira.valorMm)} (${rotuloCurto(primeira)}) · 2ª medida: ${formatarMm(segunda.valorMm)} (${rotuloCurto(segunda)}) · diferença: ${formatarMm(Math.abs(diferenca))} (${qualEMaior})`;
}
