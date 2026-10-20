import { area, retanguloEnvolvente, transladarContorno, type Contorno, type Ponto2D } from '../core/geometria';
import { espelharMolde, linhaDeCorteDaPeca, rotacionarMolde, rotacoesNoEncaixe, type Molde } from './molde';
import type { ModeloDoPlano } from './modeloDoPlano';
import { caixaDe, encostar, FOLGA_DO_ENCOSTO_MM, lugarLivre, type Caixa, type LimitesDeArea } from './posicionamento';

/**
 * O risco do planejamento de corte: as peças de uma grade (quantas roupas de cada tamanho numa folha) postas na
 * largura do tecido, pela linha de corte de cada uma, sem se sobrepor e à distância pedida, só nas orientações que
 * cada peça permite. O risco começa em y = 0 (o começo da mesa) e o comprimento é até onde vai a última peça.
 *
 * Método (uma heurística — não promete o menor comprimento possível):
 * 1. As peças entram uma a uma, numa ordem (maior área primeiro, mais compridas primeiro, mais largas primeiro);
 * 2. cada peça vai para o primeiro lugar livre entre os "pontos de canto" das que já estão (ao lado, adiante e no
 *    começo da largura), na orientação em que ela acaba mais perto do começo da mesa;
 * 3. no lugar, a peça é encostada nas vizinhas até a distância pedida (como no encaixe automático);
 * 4. entre as ordens tentadas, fica o risco mais curto. As ordens param no limite de tempo (a primeira sempre vai
 *    até o fim).
 */

export type GradeDoRisco = Readonly<Record<string, number>>;

/** Uma cópia de peça para o risco: a peça na orientação de origem, com o canto da linha de corte em (0, 0). */
export interface PecaDoRisco {
  readonly pecaId: string;
  readonly nome: string;
  readonly tamanho: string;
  readonly molde: Molde;
  /** A cópia esquerda de um par (sai espelhada). */
  readonly espelhada: boolean;
}

export interface PecaPostaNoRisco {
  readonly pecaId: string;
  readonly nome: string;
  readonly tamanho: string;
  /** A linha de corte, no lugar (mm). */
  readonly contorno: Contorno;
  /** A linha de fio, no lugar: mostra a orientação da peça. */
  readonly fio: { readonly inicio: Ponto2D; readonly fim: Ponto2D };
  readonly anguloGraus: number;
  readonly espelhada: boolean;
}

export interface OpcoesDoRisco {
  readonly larguraMm: number;
  /** O risco não pode passar disto (o comprimento da mesa menos as margens). */
  readonly comprimentoMaximoMm: number;
  readonly distanciaMm: number;
  /** Tecido com pelo ou estampa com sentido: nenhuma peça vira 180° nem 270° (ver `rotacoesNoEncaixe`). */
  readonly sentidoUnico: boolean;
  /** Tempo para tentar outras ordens depois da primeira (ms). */
  readonly tempoLimiteMs?: number;
  readonly agora?: () => number;
}

export interface RiscoGerado {
  readonly ok: true;
  readonly grade: GradeDoRisco;
  readonly pecas: readonly PecaPostaNoRisco[];
  readonly comprimentoMm: number;
  readonly larguraOcupadaMm: number;
  readonly larguraDoRiscoMm: number;
  readonly areaDasPecasMm2: number;
  /** Área das peças ÷ (comprimento × largura do risco). */
  readonly eficienciaPercentual: number;
  readonly metodo: string;
  readonly ordensTentadas: readonly string[];
  readonly ordemEscolhida: string;
  readonly tempoMs: number;
}

export interface RiscoQueNaoSai {
  readonly ok: false;
  readonly grade: GradeDoRisco;
  readonly motivo: string;
}

export const METODO_DO_RISCO =
  'Heurística de pontos de canto com encosto (cada peça no primeiro lugar livre junto das já postas, na orientação que termina mais perto do começo da mesa), tentando várias ordens de entrada e ficando com o risco mais curto. Não é garantido que seja o menor risco possível.';

/** A grade escrita: "1 P + 2 M + 1 G". */
export function escreverGrade(grade: GradeDoRisco): string {
  const partes = Object.entries(grade).filter(([, n]) => n > 0);
  return partes.length === 0 ? '(vazia)' : partes.map(([t, n]) => `${n} ${t}`).join(' + ');
}

/** A chave da grade (para comparar e guardar): os tamanhos na ordem dada, só os que têm peças. */
export function chaveDaGrade(grade: GradeDoRisco, tamanhos: readonly string[]): string {
  return tamanhos.map((t) => `${t}:${grade[t] ?? 0}`).join('|');
}

/** As cópias das peças de uma grade: em cada tamanho, as roupas da grade vezes a quantidade de cada peça por roupa. */
export function pecasDaGrade(modelo: ModeloDoPlano, grade: GradeDoRisco, quantidadesPorRoupa: Readonly<Record<string, number>>): PecaDoRisco[] {
  const pecas: PecaDoRisco[] = [];
  for (const tamanho of modelo.tamanhos) {
    const roupas = grade[tamanho] ?? 0;
    if (roupas <= 0) continue;
    for (const { pecaId, molde } of modelo.pecasPorTamanho[tamanho] ?? []) {
      const porRoupa = quantidadesPorRoupa[pecaId] ?? 0;
      const total = roupas * porRoupa;
      for (let k = 0; k < total; k++) {
        const espelhada = molde.emPar === true && k % 2 === 1;
        pecas.push({ pecaId, nome: molde.nome, tamanho, molde, espelhada });
      }
    }
  }
  return pecas;
}

interface Orientacao {
  readonly corte: Contorno;
  readonly caixa: Caixa;
  readonly fio: { readonly inicio: Ponto2D; readonly fim: Ponto2D };
  readonly anguloGraus: number;
  readonly espelhada: boolean;
}

/** A peça com o canto da linha de corte em (0, 0): a linha de corte e o fio. */
function normalizada(molde: Molde, anguloGraus: number, espelhada: boolean): Orientacao {
  const corte = linhaDeCorteDaPeca(molde);
  const r = retanguloEnvolvente(corte);
  const d = { x: -r.minX, y: -r.minY };
  const noLugar = transladarContorno(corte, d);
  return {
    corte: noLugar,
    caixa: caixaDe(noLugar),
    fio: { inicio: { x: molde.linhaDeFio.inicio.x + d.x, y: molde.linhaDeFio.inicio.y + d.y }, fim: { x: molde.linhaDeFio.fim.x + d.x, y: molde.linhaDeFio.fim.y + d.y } },
    anguloGraus,
    espelhada,
  };
}

/** As orientações que a cópia pode ter: os ângulos permitidos e, se a peça deixa (e não é de um par), o espelho. */
function orientacoesDa(peca: PecaDoRisco, sentidoUnico: boolean): Orientacao[] {
  const base = peca.espelhada ? espelharMolde(peca.molde, peca.molde.id) : peca.molde;
  const restricao = peca.molde.restricaoDeRotacao;
  const lista: Orientacao[] = [];
  for (const angulo of rotacoesNoEncaixe(restricao, sentidoUnico)) {
    const girada = angulo === 0 ? base : rotacionarMolde(base, angulo);
    lista.push(normalizada(girada, angulo, peca.espelhada));
    if (restricao.permiteEspelhamento && !peca.molde.emPar) lista.push(normalizada(espelharMolde(girada, girada.id), angulo, !peca.espelhada));
  }
  return lista;
}

interface Posta {
  readonly corte: Contorno;
  readonly caixa: Caixa;
  readonly peca: PecaDoRisco;
  readonly orientacao: Orientacao;
  readonly delta: Ponto2D;
}

/** Uma passada: as peças na ordem dada. `null` se alguma não coube (largura ou comprimento máximo). */
function porNaOrdem(
  ordem: readonly PecaDoRisco[],
  orientacoes: Map<PecaDoRisco, Orientacao[]>,
  opcoes: OpcoesDoRisco,
): { readonly postas: Posta[] } | { readonly naoCoube: PecaDoRisco } {
  // Sem distância pedida, as peças ainda ficam a um centésimo de milímetro: o contorno guardado é arredondado no
  // centésimo, e peças coladas passariam a se sobrepor nele.
  const d = Math.max(opcoes.distanciaMm, FOLGA_DO_ENCOSTO_MM);
  // Os pontos de canto ficam à distância pedida mais a folga do encosto: exatamente na distância, as contas com
  // vírgula podiam dar um fio a menos e o lugar seria recusado. Sem distância, a folga também: bordas que se
  // tocam contam como sobrepostas.
  const afastamento = d + FOLGA_DO_ENCOSTO_MM;
  const limites: LimitesDeArea = { minX: 0, maxX: opcoes.larguraMm, minY: 0, maxY: opcoes.comprimentoMaximoMm };
  const postas: Posta[] = [];
  const cortes: Contorno[] = [];
  const caixas: Caixa[] = [];
  let pontos: Ponto2D[] = [{ x: 0, y: 0 }];
  let fimDoComprimento = 0;
  for (const peca of ordem) {
    let melhor: Posta | null = null;
    for (const o of orientacoes.get(peca)!) {
      const largura = o.caixa.maxX;
      const comprimento = o.caixa.maxY;
      if (largura > opcoes.larguraMm + 1e-9) continue;
      // Os pontos de canto e, por último, o começo da largura logo depois de tudo (sempre livre).
      const candidatos = [...pontos, { x: 0, y: postas.length === 0 ? 0 : fimDoComprimento + afastamento }];
      for (const p of candidatos) {
        if (p.x + largura > opcoes.larguraMm + 1e-9 || p.y + comprimento > opcoes.comprimentoMaximoMm + 1e-9) continue;
        const naPosicao = transladarContorno(o.corte, p);
        if (!lugarLivre(naPosicao, cortes, caixas, d, 0)) continue;
        const delta = encostar(o.corte, cortes, caixas, limites, d, Math.max(10, d * 4), p);
        const fim = delta.y + comprimento;
        if (!melhor || fim < melhor.caixa.maxY - 1e-9 || (Math.abs(fim - melhor.caixa.maxY) <= 1e-9 && delta.x < melhor.delta.x)) {
          const corte = transladarContorno(o.corte, delta);
          melhor = { corte, caixa: caixaDe(corte), peca, orientacao: o, delta };
        }
        break;
      }
    }
    if (!melhor) return { naoCoube: peca };
    postas.push(melhor);
    cortes.push(melhor.corte);
    caixas.push(melhor.caixa);
    fimDoComprimento = Math.max(fimDoComprimento, melhor.caixa.maxY);
    const c = melhor.caixa;
    pontos = [...pontos, { x: c.maxX + afastamento, y: c.minY }, { x: c.minX, y: c.maxY + afastamento }, { x: 0, y: c.maxY + afastamento }, { x: c.maxX + afastamento, y: 0 }]
      .filter((p) => p.x < opcoes.larguraMm && p.y < opcoes.comprimentoMaximoMm)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }
  return { postas };
}

const ORDENS: ReadonlyArray<readonly [string, (o: Orientacao) => number]> = [
  ['maior área primeiro', (o) => area(o.corte)],
  ['mais compridas primeiro', (o) => o.caixa.maxY],
  ['mais largas primeiro', (o) => o.caixa.maxX],
];

export function fazerRisco(pecas: readonly PecaDoRisco[], grade: GradeDoRisco, opcoes: OpcoesDoRisco): RiscoGerado | RiscoQueNaoSai {
  const agora = opcoes.agora ?? Date.now;
  const inicio = agora();
  if (!(opcoes.larguraMm > 0)) return { ok: false, grade, motivo: 'Falta a largura do risco (a largura útil da malha).' };
  if (pecas.length === 0) return { ok: false, grade, motivo: 'A grade não tem nenhuma peça.' };
  // As orientações de cada cópia (as cópias da mesma peça e do mesmo lado têm as mesmas).
  const porTipo = new Map<string, Orientacao[]>();
  const orientacoes = new Map<PecaDoRisco, Orientacao[]>();
  for (const p of pecas) {
    const chave = `${p.pecaId}|${p.tamanho}|${p.espelhada}`;
    if (!porTipo.has(chave)) porTipo.set(chave, orientacoesDa(p, opcoes.sentidoUnico));
    orientacoes.set(p, porTipo.get(chave)!);
  }
  for (const p of pecas) {
    if (!orientacoes.get(p)!.some((o) => o.caixa.maxX <= opcoes.larguraMm + 1e-9)) {
      const menor = Math.min(...orientacoes.get(p)!.map((o) => o.caixa.maxX));
      return {
        ok: false,
        grade,
        motivo: `A peça “${p.nome}” (${p.tamanho}) não cabe na largura de ${(opcoes.larguraMm / 1000).toFixed(2).replace('.', ',')} m em nenhuma das orientações que ela permite (a mais estreita ocupa ${(menor / 1000).toFixed(2).replace('.', ',')} m).`,
      };
    }
  }
  let melhor: { postas: Posta[]; ordem: string } | null = null;
  let naoCoube: PecaDoRisco | null = null;
  const tentadas: string[] = [];
  for (const [nome, medida] of ORDENS) {
    if (tentadas.length > 0 && opcoes.tempoLimiteMs !== undefined && agora() - inicio > opcoes.tempoLimiteMs) break;
    tentadas.push(nome);
    const chave = (p: PecaDoRisco): number => Math.max(...orientacoes.get(p)!.map(medida));
    // Estável: as cópias da mesma peça ficam juntas, na ordem em que vieram.
    const ordem = pecas.map((p, i) => ({ p, i, v: chave(p) })).sort((a, b) => b.v - a.v || a.i - b.i).map((x) => x.p);
    const passada = porNaOrdem(ordem, orientacoes, opcoes);
    if ('naoCoube' in passada) {
      naoCoube = passada.naoCoube;
      continue;
    }
    const comprimento = Math.max(...passada.postas.map((x) => x.caixa.maxY));
    if (!melhor || comprimento < Math.max(...melhor.postas.map((x) => x.caixa.maxY)) - 1e-6) melhor = { postas: passada.postas, ordem: nome };
  }
  if (!melhor) {
    return {
      ok: false,
      grade,
      motivo: `As peças da grade não cabem num risco de até ${(opcoes.comprimentoMaximoMm / 1000).toFixed(2).replace('.', ',')} m (a mesa menos as margens)${naoCoube ? `: “${naoCoube.nome}” (${naoCoube.tamanho}) ficou de fora` : ''}. Use uma grade com menos roupas por risco, ou uma mesa mais comprida.`,
    };
  }
  const comprimentoMm = Math.max(...melhor.postas.map((x) => x.caixa.maxY));
  const larguraOcupadaMm = Math.max(...melhor.postas.map((x) => x.caixa.maxX));
  const areaDasPecasMm2 = melhor.postas.reduce((s, x) => s + area(x.corte), 0);
  return {
    ok: true,
    grade,
    pecas: melhor.postas.map((x) => ({
      pecaId: x.peca.pecaId,
      nome: x.peca.nome,
      tamanho: x.peca.tamanho,
      contorno: x.corte.map((q) => ({ x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 })),
      fio: {
        inicio: { x: x.orientacao.fio.inicio.x + x.delta.x, y: x.orientacao.fio.inicio.y + x.delta.y },
        fim: { x: x.orientacao.fio.fim.x + x.delta.x, y: x.orientacao.fio.fim.y + x.delta.y },
      },
      anguloGraus: x.orientacao.anguloGraus,
      espelhada: x.orientacao.espelhada,
    })),
    comprimentoMm,
    larguraOcupadaMm,
    larguraDoRiscoMm: opcoes.larguraMm,
    areaDasPecasMm2,
    eficienciaPercentual: (areaDasPecasMm2 / (comprimentoMm * opcoes.larguraMm)) * 100,
    metodo: METODO_DO_RISCO,
    ordensTentadas: tentadas,
    ordemEscolhida: melhor.ordem,
    tempoMs: agora() - inicio,
  };
}
