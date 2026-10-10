import { comprimentoDaLinha, distancia, pontoDentroDoContorno, pontoMaisProximoNoContorno, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { adicionarMarca, adicionarPique, type Molde } from '../domain/molde';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { PreviaDeFerramentaDeMolde } from './ferramentasDeMolde';
import { caminhoDoTrecho } from './ferramentasDeTrecho';
import { posicaoNoContornoPerto } from './medicao';
import { formatarMm } from './medidas';

/**
 * "Conferir" (aba Conferência): confere duas costuras que vão ser unidas,
 * como no manual da referência. Indicadas as duas — cada uma do ponto de
 * referência até o fim —, a segunda peça anda sobre a costura da primeira,
 * como se estivesse sendo costurada, e um clique marca o ponto de encontro
 * nas duas.
 */

/** Uma costura indicada: a peça e o caminho no contorno dela, do ponto de referência ao fim. */
export interface CosturaIndicada {
  readonly pecaId: string;
  readonly pontos: readonly Ponto2D[];
}

export interface EstadoDaConferencia {
  /** O começo (a referência) da costura que está sendo indicada, à espera do fim. */
  readonly inicio: { readonly pecaId: string; readonly posicao: PosicaoNoContorno } | null;
  /** As costuras já indicadas: nenhuma, a 1ª ou as duas. */
  readonly costuras: readonly CosturaIndicada[];
}

export const SEM_CONFERENCIA: EstadoDaConferencia = { inicio: null, costuras: [] };

export interface OpcoesDaConferencia {
  /** "Descontar": quanto a 1ª costura encolhe ao costurar (mm). */
  readonly descontarMm: number;
  /** O que o clique deixa no ponto de encontro: um pique em cada peça, um ponto (marca), ou nada. */
  readonly marcar: 'pique' | 'ponto' | 'nada';
}

export const OPCOES_INICIAIS_DA_CONFERENCIA: OpcoesDaConferencia = { descontarMm: 0, marcar: 'pique' };

/** Até esta diferença (mm) duas costuras conferem: é menos do que se corta ou se costura com precisão. */
export const FOLGA_DA_CONFERENCIA_MM = 0.5;
const MESMO_PONTO_MM = 1e-6;
/** Quanto (mm) para o lado da costura se olha para saber de que lado fica a peça. */
const PASSO_PARA_O_LADO_MM = 0.05;

export function dialogoDaConferencia(opcoes: OpcoesDaConferencia): { readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    campos: [
      {
        tipo: 'medida',
        id: 'descontar',
        rotulo: 'Descontar da 1ª costura (mm): o que ela encolhe ao costurar',
        inicial: String(opcoes.descontarMm).replace('.', ','),
      },
      {
        tipo: 'escolha',
        id: 'marcar',
        rotulo: 'O clique no ponto de encontro',
        opcoes: [
          { valor: 'pique', rotulo: 'Marca um pique em cada peça' },
          { valor: 'ponto', rotulo: 'Marca um ponto (marca) em cada peça' },
          { valor: 'nada', rotulo: 'Não marca nada: só confere' },
        ],
        inicial: opcoes.marcar,
      },
    ],
    nota: 'Depois de confirmar, indique a 1ª costura com dois cliques no contorno — o começo, que é o ponto de referência, e o fim — e a 2ª do mesmo jeito, começando pelo ponto que casa com o começo da 1ª. Vale o caminho mais curto entre os dois pontos. Depois, passe o mouse pela 1ª costura: a outra peça anda sobre ela, como se estivesse sendo costurada. Da referência ficaram de fora “Usar costura” (conferir pela linha de corte) e digitar o valor de “Atual”.',
  };
}

export function lerDialogoDaConferencia(valores: ValoresDoDialogo): OpcoesDaConferencia {
  const descontarMm = Number(valores.descontar);
  if (!Number.isFinite(descontarMm) || descontarMm < 0) throw new Error('O desconto não pode ser negativo.');
  const marcar = valores.marcar === 'ponto' || valores.marcar === 'nada' ? valores.marcar : 'pique';
  return { descontarMm, marcar };
}

/** O ponto da linha a `s` mm do começo dela (dentro dos limites da linha) e a direção em que ela segue ali. */
export function pontoNoComprimento(linha: readonly Ponto2D[], s: number): { readonly ponto: Ponto2D; readonly tangente: Ponto2D } {
  let resto = Math.max(0, s);
  let ultimo: { ponto: Ponto2D; tangente: Ponto2D } | null = null;
  for (let i = 1; i < linha.length; i++) {
    const a = linha[i - 1]!;
    const b = linha[i]!;
    const d = distancia(a, b);
    if (d < MESMO_PONTO_MM) continue;
    const tangente = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    if (resto <= d) return { ponto: { x: a.x + tangente.x * resto, y: a.y + tangente.y * resto }, tangente };
    resto -= d;
    ultimo = { ponto: b, tangente };
  }
  return ultimo ?? { ponto: linha[0] ?? { x: 0, y: 0 }, tangente: { x: 1, y: 0 } };
}

/** O ponto da linha mais perto de `p`: a quantos mm do começo dela ele está, e a que distância de `p`. */
export function comprimentoMaisPerto(linha: readonly Ponto2D[], p: Ponto2D): { readonly s: number; readonly distancia: number } {
  let melhor = { s: 0, distancia: Infinity };
  let andado = 0;
  for (let i = 1; i < linha.length; i++) {
    const a = linha[i - 1]!;
    const b = linha[i]!;
    const d = distancia(a, b);
    if (d < MESMO_PONTO_MM) continue;
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (d * d)));
    const longe = distancia(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (longe < melhor.distancia) melhor = { s: andado + t * d, distancia: longe };
    andado += d;
  }
  return melhor;
}

/**
 * O contorno da 2ª peça posto para costurar na 1ª: o ponto da 2ª costura a
 * `s` mm do começo fica em cima do ponto da 1ª a `s` mm, as duas costuras
 * seguem na mesma direção ali, e as peças ficam de lados opostos da costura.
 */
export function segundaPecaEncostada(
  primeira: Molde,
  costura1: readonly Ponto2D[],
  segunda: Molde,
  costura2: readonly Ponto2D[],
  s: number,
): Ponto2D[] {
  const em1 = pontoNoComprimento(costura1, s);
  const em2 = pontoNoComprimento(costura2, s);
  const pecaAEsquerda = (peca: Molde, em: { ponto: Ponto2D; tangente: Ponto2D }): boolean =>
    pontoDentroDoContorno({ x: em.ponto.x - em.tangente.y * PASSO_PARA_O_LADO_MM, y: em.ponto.y + em.tangente.x * PASSO_PARA_O_LADO_MM }, peca.contorno);
  // Girando a 2ª até as costuras seguirem na mesma direção, as peças ficam do mesmo lado se estavam do mesmo lado
  // de cada costura: aí a 2ª é virada (espelhada na costura), como o tecido que se põe direito com direito.
  const virar = pecaAEsquerda(primeira, em1) === pecaAEsquerda(segunda, em2);
  const cos = em2.tangente.x * em1.tangente.x + em2.tangente.y * em1.tangente.y;
  const sen = em2.tangente.x * em1.tangente.y - em2.tangente.y * em1.tangente.x;
  return segunda.contorno.map((q) => {
    const dx = q.x - em2.ponto.x;
    const dy = q.y - em2.ponto.y;
    let x = dx * cos - dy * sen;
    let y = dx * sen + dy * cos;
    if (virar) {
      const aoLongo = x * em1.tangente.x + y * em1.tangente.y;
      x = 2 * aoLongo * em1.tangente.x - x;
      y = 2 * aoLongo * em1.tangente.y - y;
    }
    return { x: em1.ponto.x + x, y: em1.ponto.y + y };
  });
}

/** O veredito sobre as duas costuras: conferem, ou uma sobra em relação à outra, e de quanto (em mm e em % da menor). */
export function vereditoDaConferencia(comprimento1Mm: number, comprimento2Mm: number, descontarMm: number): string {
  const util1 = comprimento1Mm - descontarMm;
  const descontado = descontarMm > 0 ? ` (com ${formatarMm(descontarMm)} descontados, ${formatarMm(util1)})` : '';
  const medidas = `1ª: ${formatarMm(comprimento1Mm)}${descontado} · 2ª: ${formatarMm(comprimento2Mm)}`;
  if (!(util1 > 0)) return `O desconto é maior que a 1ª costura — ${medidas}`;
  const diferenca = comprimento2Mm - util1;
  if (Math.abs(diferenca) <= FOLGA_DA_CONFERENCIA_MM) return `As duas costuras conferem — ${medidas}`;
  const porcento = ` (${((Math.abs(diferenca) / Math.min(util1, comprimento2Mm)) * 100).toFixed(1).replace('.', ',')}%)`;
  return `Não conferem: a ${diferenca > 0 ? '2ª' : '1ª'} é ${formatarMm(Math.abs(diferenca))} maior${porcento} — ${medidas}`;
}

/** O contorno mais perto do ponto, a até `raioMm`: a peça e a posição nele (presa ao ponto do contorno, se há um perto). */
function contornoPerto(
  pecas: readonly Molde[],
  p: Ponto2D,
  raioMm: number,
  soNaPeca: string | null,
): { readonly pecaId: string; readonly posicao: PosicaoNoContorno } | null {
  let melhor: { peca: Molde; distancia: number } | null = null;
  for (const peca of pecas) {
    if (soNaPeca !== null && peca.id !== soNaPeca) continue;
    const d = pontoMaisProximoNoContorno(p, peca.contorno).distancia;
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { peca, distancia: d };
  }
  if (!melhor) return null;
  const posicao = posicaoNoContornoPerto(p, melhor.peca.contorno, raioMm);
  return posicao ? { pecaId: melhor.peca.id, posicao } : null;
}

export interface CliqueDaConferencia {
  readonly estado: EstadoDaConferencia;
  /** As peças do projeto depois do clique, quando ele marcou o ponto de encontro (um passo de desfazer). */
  readonly pecas?: readonly Molde[];
  readonly recado: string | null;
}

/** O que um clique faz: indica as costuras (começo e fim de cada uma) e, com as duas indicadas, marca o ponto de encontro. */
export function cliqueDaConferencia(
  opcoes: OpcoesDaConferencia,
  pecas: readonly Molde[],
  estado: EstadoDaConferencia,
  p: Ponto2D,
  raioMm: number,
  novoId: () => string,
): CliqueDaConferencia {
  const [costura1, costura2] = estado.costuras;
  if (!costura1 || !costura2) {
    const perto = contornoPerto(pecas, p, raioMm, estado.inicio?.pecaId ?? null);
    if (!perto) {
      return { estado, recado: estado.inicio ? 'Clique no contorno da mesma peça, onde a costura termina.' : 'Clique no contorno de uma peça, onde a costura começa.' };
    }
    if (!estado.inicio) return { estado: { ...estado, inicio: perto }, recado: null };
    if (distancia(perto.posicao.ponto, estado.inicio.posicao.ponto) < MESMO_PONTO_MM) {
      return { estado, recado: 'O fim da costura precisa ser outro ponto do contorno.' };
    }
    const peca = pecas.find((q) => q.id === perto.pecaId)!;
    const pontos = caminhoDoTrecho(peca.contorno, estado.inicio.posicao, perto.posicao);
    return { estado: { inicio: null, costuras: [...estado.costuras, { pecaId: peca.id, pontos }] }, recado: null };
  }

  const onde = comprimentoMaisPerto(costura1.pontos, p);
  if (onde.distancia > raioMm) return { estado, recado: 'Clique em cima da 1ª costura (a que está em destaque) para marcar o ponto de encontro.' };
  if (opcoes.marcar === 'nada') return { estado, recado: `Ponto de encontro a ${formatarMm(onde.s)} do começo das costuras (a marcação está desligada: nada foi marcado).` };
  if (onde.s > comprimentoDaLinha(costura2.pontos) + FOLGA_DA_CONFERENCIA_MM) {
    return { estado, recado: 'Nesse ponto a 2ª costura já acabou: não há ponto de encontro para marcar.' };
  }
  const marcar = (peca: Molde, ponto: Ponto2D): Molde => (opcoes.marcar === 'pique' ? adicionarPique(peca, ponto, novoId()) : adicionarMarca(peca, ponto, novoId()));
  const naPrimeira = pontoNoComprimento(costura1.pontos, onde.s).ponto;
  const naSegunda = pontoNoComprimento(costura2.pontos, onde.s).ponto;
  const novas = pecas
    .map((peca) => (peca.id === costura1.pecaId ? marcar(peca, naPrimeira) : peca))
    .map((peca) => (peca.id === costura2.pecaId ? marcar(peca, naSegunda) : peca));
  return {
    estado,
    pecas: novas,
    recado: `${opcoes.marcar === 'pique' ? 'Pique' : 'Ponto'} de encontro marcado nas duas costuras, a ${formatarMm(onde.s)} do começo de cada uma.`,
  };
}

/** A prévia: as costuras indicadas e, com as duas postas, a 2ª peça encostada na 1ª no ponto sob o mouse. */
export function previaDaConferencia(pecas: readonly Molde[], estado: EstadoDaConferencia, mouse: Ponto2D | null, raioMm: number): PreviaDeFerramentaDeMolde {
  const [costura1, costura2] = estado.costuras;
  if (!costura1 || !costura2) {
    const base: PreviaDeFerramentaDeMolde = costura1 ? { substituido: costura1.pontos } : {};
    if (!estado.inicio) return base;
    const marcas = [estado.inicio.posicao.ponto];
    const peca = pecas.find((q) => q.id === estado.inicio!.pecaId);
    const sobOMouse = mouse && peca ? posicaoNoContornoPerto(mouse, peca.contorno, raioMm) : null;
    if (!peca || !sobOMouse || distancia(sobOMouse.ponto, estado.inicio.posicao.ponto) < MESMO_PONTO_MM) return { ...base, marcas };
    return { ...base, marcas, novo: caminhoDoTrecho(peca.contorno, estado.inicio.posicao, sobOMouse) };
  }
  const base: PreviaDeFerramentaDeMolde = { substituido: costura1.pontos, linhas: [costura2.pontos] };
  const primeira = pecas.find((q) => q.id === costura1.pecaId);
  const segunda = pecas.find((q) => q.id === costura2.pecaId);
  if (!mouse || !primeira || !segunda) return base;
  const { s } = comprimentoMaisPerto(costura1.pontos, mouse);
  return {
    ...base,
    novo: segundaPecaEncostada(primeira, costura1.pontos, segunda, costura2.pontos, s),
    novoFechado: true,
    marcas: [pontoNoComprimento(costura1.pontos, s).ponto],
  };
}

/** O texto da faixa de mensagens: o próximo clique ou, com as duas costuras, o veredito e onde o mouse está. */
export function textoDaConferencia(opcoes: OpcoesDaConferencia, estado: EstadoDaConferencia, mouse: Ponto2D | null): string {
  const fim = ' Esc sai.';
  const [costura1, costura2] = estado.costuras;
  if (!costura1) {
    return (
      (estado.inicio
        ? 'Conferir: clique onde a 1ª costura termina, no contorno da mesma peça.'
        : 'Conferir: clique no contorno de uma peça, onde a 1ª costura começa — é o ponto de referência dela.') + fim
    );
  }
  const comprimento1 = comprimentoDaLinha(costura1.pontos);
  if (!costura2) {
    return (
      `Conferir: a 1ª costura tem ${formatarMm(comprimento1)}. ` +
      (estado.inicio
        ? 'Clique onde a 2ª costura termina, no contorno da mesma peça.'
        : 'Agora clique onde a 2ª costura começa — o ponto que casa com o começo da 1ª.') +
      fim
    );
  }
  const comprimento2 = comprimentoDaLinha(costura2.pontos);
  const veredito = vereditoDaConferencia(comprimento1, comprimento2, opcoes.descontarMm);
  const atual = mouse ? ` Atual: ${formatarMm(Math.min(comprimentoMaisPerto(costura1.pontos, mouse).s, comprimento1))} do começo.` : '';
  const clique = opcoes.marcar === 'nada' ? '' : ` Um clique marca ${opcoes.marcar === 'pique' ? 'um pique' : 'um ponto'} de encontro nas duas.`;
  return `${veredito}. Passe o mouse pela 1ª costura: a outra peça anda sobre ela.${clique}${atual}` + fim;
}
