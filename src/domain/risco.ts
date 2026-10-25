import { area, distancia, retanguloEnvolvente, simplificarContorno, transladarContorno, type Contorno, type Ponto2D } from '../core/geometria';
import { espelharMolde, linhaDeCorteDaPeca, rotacionarMolde, rotacoesNoEncaixe, type Molde } from './molde';
import type { ModeloDoPlano } from './modeloDoPlano';
import { caixaDe, encostar, FOLGA_DO_ENCOSTO_MM, lugarLivre, type Caixa, type LimitesDeArea } from './posicionamento';
import { blocosDasPostas, grupoDaPeca, indiceDoGrupo, ordemDosGrupos, type BlocoDoGrupo } from './gruposDoEncaixe';

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
  /** O número da cópia (para quem precisa saber qual cópia ficou onde, como o encaixe na mesa). */
  readonly copia?: number;
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
  /**
   * Quanto a peça (na orientação dela: o par espelhado, o giro e o espelho) andou até o lugar: a linha de corte
   * verdadeira (sem simplificar) fica em `linhaDeCorteVerdadeira`. Ausente nos planos guardados antes dele.
   */
  readonly deslocamentoMm?: Ponto2D;
  /** O ponto de casamento da peça (a marca "casamento"), no lugar — quando o risco casa listras ou xadrez. */
  readonly pontoDeCasamento?: Ponto2D;
  /** Os pontos de casamento dos grupos ("casamento: manga"), no lugar, pelo nome do grupo (ADR 0129). */
  readonly pontosDeCasamento?: Readonly<Record<string, Ponto2D>>;
  readonly copia?: number;
}

/**
 * O casamento de listras e xadrez: a repetição do desenho (o rapport) no comprimento e/ou na largura, e onde a linha
 * de referência dele cai (a fase), medida do começo do risco e da borda da malha. Cada peça precisa da marca
 * "casamento" (um ponto que tem de cair numa linha do desenho); com o casamento, ela só vai para os lugares em que
 * esse ponto fica na fase, e só gira 0° ou 180° (90° viraria as listras).
 */
export interface Casamento {
  readonly rapportComprimentoMm?: number;
  readonly rapportLarguraMm?: number;
  readonly faseComprimentoMm: number;
  readonly faseLarguraMm: number;
}

/** A marca que diz o ponto de casamento da peça: a que tem "casamento" no rótulo. */
export const ROTULO_DO_PONTO_DE_CASAMENTO = 'casamento';

/**
 * O grupo de uma marca de casamento, pelo rótulo (ADR 0129):
 * - "casamento" (ou "ponto de casamento"): o ponto principal da peça, que cai na linha do desenho (a fase do tecido) —
 *   o grupo `''`;
 * - "casamento: manga" (ou "casamento - manga"): o ponto do grupo "manga", que cai na mesma listra (a mesma fase) que
 *   o ponto "casamento: manga" das outras peças — a manga com a cava da frente, o bolso com o peito.
 * `null`: a marca não é de casamento.
 */
export function grupoDaMarcaDeCasamento(rotulo: string | undefined): string | null {
  const r = (rotulo ?? '').trim().toLocaleLowerCase('pt-BR');
  if (!r.includes(ROTULO_DO_PONTO_DE_CASAMENTO)) return null;
  const doGrupo = /casamento\s*[:\-–—]\s*(.+)$/.exec(r);
  return doGrupo ? doGrupo[1]!.trim() : '';
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
  /** Só estas ordens de entrada (pelo nome); sem isto, todas. */
  readonly ordens?: readonly string[];
  /** Casar listras/xadrez (ver `Casamento`). */
  readonly casamento?: Casamento;
  /** Consultado antes de cada peça: `true` cancela o risco. */
  readonly deveParar?: () => boolean;
  /** O que não couber fica de fora (e é dito), em vez de o risco não sair — para o encaixe na mesa do projeto. */
  readonly deixarDeFora?: boolean;
  /** Chamado a cada peça posta (na primeira ordem de entrada), para mostrar o andamento. */
  readonly aoProgredir?: (postas: number, total: number) => void;
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
  /** Com `deixarDeFora`: as cópias que não couberam. */
  readonly deFora?: ReadonlyArray<{ readonly pecaId: string; readonly nome: string; readonly tamanho: string; readonly copia?: number }>;
  /** O casamento usado, e se a conferência depois de posto achou todas as peças na fase. */
  readonly casamento?: Casamento & { readonly conferido: boolean };
  /** Com peças em grupos do encaixe (ADR 0103): o trecho do comprimento de cada grupo, na ordem. */
  readonly blocosDosGrupos?: readonly BlocoDoGrupo[];
}

export interface RiscoQueNaoSai {
  readonly ok: false;
  readonly grade: GradeDoRisco;
  readonly motivo: string;
  /** O risco não saiu porque a busca foi cancelada (não por não caber). */
  readonly cancelado?: true;
}

export const METODO_DO_RISCO =
  'Heurística de pontos de canto com encosto (cada peça no primeiro lugar livre junto das já postas, na orientação que termina mais perto do começo da mesa), tentando várias ordens de entrada e ficando com o risco mais curto. As curvas são simplificadas para as contas (até 0,2 mm da linha de corte verdadeira) e essa diferença é somada à distância entre as peças: a distância verdadeira nunca fica abaixo da pedida (com curvas, fica até 0,4 mm acima). Não é garantido que seja o menor risco possível.';

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
  /** Quanto a linha de corte simplificada pode se afastar da verdadeira (0 se nada foi simplificado). */
  readonly desvioMm: number;
  /** O quanto a peça orientada andou para ter o canto em (0, 0). */
  readonly deslocamento: Ponto2D;
  /** O ponto de casamento (a marca "casamento"), com a peça no canto; `null` sem a marca. */
  readonly ref: Ponto2D | null;
  /** Os pontos dos grupos de casamento ("casamento: manga"), com a peça no canto, pelo nome do grupo. */
  readonly refs: ReadonlyMap<string, Ponto2D>;
}

/**
 * As curvas da linha de corte são simplificadas para as contas de colisão (até esta distância do original); a
 * diferença é somada à distância exigida entre as peças, para a distância verdadeira nunca ficar abaixo da pedida.
 */
export const TOLERANCIA_DA_SIMPLIFICACAO_MM = 0.2;

/** A peça com o canto da linha de corte em (0, 0): a linha de corte e o fio. */
function normalizada(molde: Molde, anguloGraus: number, espelhada: boolean): Orientacao {
  const original = linhaDeCorteDaPeca(molde);
  const corte = simplificarContorno(original, TOLERANCIA_DA_SIMPLIFICACAO_MM);
  const semRepetidos = original.filter((p, i) => distancia(p, original[(i + 1) % original.length]!) > 1e-9).length;
  const r = retanguloEnvolvente(corte);
  const d = { x: -r.minX, y: -r.minY };
  const noLugar = transladarContorno(corte, d);
  return {
    corte: noLugar,
    caixa: caixaDe(noLugar),
    fio: { inicio: { x: molde.linhaDeFio.inicio.x + d.x, y: molde.linhaDeFio.inicio.y + d.y }, fim: { x: molde.linhaDeFio.fim.x + d.x, y: molde.linhaDeFio.fim.y + d.y } },
    anguloGraus,
    espelhada,
    desvioMm: corte.length < semRepetidos ? TOLERANCIA_DA_SIMPLIFICACAO_MM : 0,
    deslocamento: d,
    ...marcasDeCasamento(molde, d),
  };
}

/** O ponto principal de casamento e os dos grupos, levados por `d`. */
function marcasDeCasamento(molde: Molde, d: Ponto2D): { readonly ref: Ponto2D | null; readonly refs: ReadonlyMap<string, Ponto2D> } {
  let ref: Ponto2D | null = null;
  const refs = new Map<string, Ponto2D>();
  for (const m of molde.marcas) {
    const grupo = grupoDaMarcaDeCasamento(m.rotulo);
    const ponto = { x: m.posicao.x + d.x, y: m.posicao.y + d.y };
    if (grupo === '' && !ref) ref = ponto;
    else if (grupo && !refs.has(grupo)) refs.set(grupo, ponto);
  }
  return { ref, refs };
}

/**
 * Onde a peça tem de cair para casar: o ponto dela e a fase em que ele cai.
 * - o ponto principal ("casamento") cai na fase do tecido;
 * - sem ele, o ponto de um grupo que já tem fase (dada pela primeira peça posta com esse grupo) cai nela;
 * - sem nenhum dos dois, o ponto do primeiro grupo cai na fase do tecido, e a peça dá a fase do grupo.
 */
function alvoDoCasamento(o: Orientacao, c: Casamento, fasesDosGrupos: ReadonlyMap<string, Ponto2D>): { readonly ref: Ponto2D; readonly fase: Ponto2D } | null {
  const doTecido = { x: c.faseLarguraMm, y: c.faseComprimentoMm };
  if (o.ref) return { ref: o.ref, fase: doTecido };
  for (const [grupo, ponto] of o.refs) {
    const fase = fasesDosGrupos.get(grupo);
    if (fase) return { ref: ponto, fase };
  }
  const primeiro = [...o.refs.values()][0];
  return primeiro ? { ref: primeiro, fase: doTecido } : null;
}

/** A primeira posição `v` ou adiante em que o ponto `ref` (da peça no canto) cai na fase da repetição. */
function naFase(v: number, ref: number, rapport: number | undefined, fase: number): number {
  if (!rapport || !(rapport > 0)) return v;
  const resto = (((fase - (v + ref)) % rapport) + rapport) % rapport;
  return v + (resto < 1e-9 || rapport - resto < 1e-9 ? 0 : resto);
}

/** As orientações que a cópia pode ter no risco (o ângulo e se sai espelhada), na ordem em que são tentadas. */
export function orientacoesDoRisco(peca: PecaDoRisco, sentidoUnico: boolean): Array<{ readonly anguloGraus: number; readonly espelhada: boolean }> {
  return orientacoesDa(peca, sentidoUnico).map((o) => ({ anguloGraus: o.anguloGraus, espelhada: o.espelhada }));
}

/** As orientações que a cópia pode ter: os ângulos permitidos e, se a peça deixa (e não é de um par), o espelho. */
function orientacoesDa(peca: PecaDoRisco, sentidoUnico: boolean, comCasamento = false): Orientacao[] {
  const base = peca.espelhada ? espelharMolde(peca.molde, peca.molde.id) : peca.molde;
  const restricao = peca.molde.restricaoDeRotacao;
  const lista: Orientacao[] = [];
  // Com casamento, só 0° e 180°: deitada, a peça teria as listras no outro sentido.
  for (const angulo of rotacoesNoEncaixe(restricao, sentidoUnico).filter((a) => !comCasamento || a === 0 || a === 180)) {
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
  folgaDaSimplificacaoMm: number,
  primeira = false,
): { readonly postas: Posta[]; readonly deFora: PecaDoRisco[] } | { readonly naoCoube: PecaDoRisco } | { readonly cancelado: true } {
  // Sem distância pedida, as peças ainda ficam a um centésimo de milímetro: o contorno guardado é arredondado no
  // centésimo, e peças coladas passariam a se sobrepor nele.
  const d = Math.max(opcoes.distanciaMm, FOLGA_DO_ENCOSTO_MM) + folgaDaSimplificacaoMm;
  // Os pontos de canto ficam à distância pedida mais a folga do encosto: exatamente na distância, as contas com
  // vírgula podiam dar um fio a menos e o lugar seria recusado. Sem distância, a folga também: bordas que se
  // tocam contam como sobrepostas.
  const afastamento = d + FOLGA_DO_ENCOSTO_MM;
  let limites: LimitesDeArea = { minX: 0, maxX: opcoes.larguraMm, minY: 0, maxY: opcoes.comprimentoMaximoMm };
  // Os grupos do encaixe (ADR 0103) vêm um depois do outro na ordem: cada grupo novo começa depois de tudo o que já
  // foi posto (o piso), e nenhuma peça dele volta para o trecho do grupo de antes.
  let piso = 0;
  let grupoAtual: string | null = null;
  const postas: Posta[] = [];
  const cortes: Contorno[] = [];
  const caixas: Caixa[] = [];
  let pontos: Ponto2D[] = [{ x: 0, y: 0 }];
  let fimDoComprimento = 0;
  const casar = opcoes.casamento;
  // A fase de cada grupo de casamento: o lugar do ponto do grupo na primeira peça posta que o tem (ADR 0129).
  const fasesDosGrupos = new Map<string, Ponto2D>();
  const deFora: PecaDoRisco[] = [];
  for (const peca of ordem) {
    if (opcoes.deveParar?.()) return { cancelado: true };
    const grupo = grupoDaPeca(peca.molde);
    if (grupo !== grupoAtual) {
      if (grupoAtual !== null && postas.length > 0) {
        piso = fimDoComprimento + afastamento;
        limites = { ...limites, minY: piso };
        pontos = [{ x: 0, y: piso }];
      }
      grupoAtual = grupo;
    }
    let melhor: Posta | null = null;
    for (const o of orientacoes.get(peca)!) {
      const largura = o.caixa.maxX;
      const comprimento = o.caixa.maxY;
      if (largura > opcoes.larguraMm + 1e-9) continue;
      // Os pontos de canto e, por último, o começo da largura logo depois de tudo (sempre livre).
      const candidatos = [...pontos, { x: 0, y: postas.length === 0 ? 0 : fimDoComprimento + afastamento }];
      for (const p of candidatos) {
        if (p.x + largura > opcoes.larguraMm + 1e-9 || p.y + comprimento > opcoes.comprimentoMaximoMm + 1e-9) continue;
        let delta: Ponto2D | null = null;
        const alvo = casar ? alvoDoCasamento(o, casar, fasesDosGrupos) : null;
        if (casar && alvo) {
          // Com casamento: só as posições em que o ponto da peça cai na fase; sem encostar (andaria para fora dela).
          let x = naFase(p.x, alvo.ref.x, casar.rapportLarguraMm, alvo.fase.x);
          if (x + largura > opcoes.larguraMm + 1e-9) x = naFase(0, alvo.ref.x, casar.rapportLarguraMm, alvo.fase.x);
          if (x + largura > opcoes.larguraMm + 1e-9) continue;
          const y0 = naFase(p.y, alvo.ref.y, casar.rapportComprimentoMm, alvo.fase.y);
          for (let k = 0; k < 4 && !delta; k++) {
            const y = y0 + k * (casar.rapportComprimentoMm ?? 0);
            if (y + comprimento > opcoes.comprimentoMaximoMm + 1e-9) break;
            if (lugarLivre(transladarContorno(o.corte, { x, y }), cortes, caixas, d, FOLGA_DO_ENCOSTO_MM)) delta = { x, y };
            if (!casar.rapportComprimentoMm) break;
          }
          if (!delta) continue;
        } else {
          const naPosicao = transladarContorno(o.corte, p);
          if (!lugarLivre(naPosicao, cortes, caixas, d, 0)) continue;
          delta = encostar(o.corte, cortes, caixas, limites, d, Math.max(10, d * 4), p);
        }
        const fim = delta.y + comprimento;
        if (!melhor || fim < melhor.caixa.maxY - 1e-9 || (Math.abs(fim - melhor.caixa.maxY) <= 1e-9 && delta.x < melhor.delta.x)) {
          const corte = transladarContorno(o.corte, delta);
          melhor = { corte, caixa: caixaDe(corte), peca, orientacao: o, delta };
        }
        break;
      }
    }
    if (!melhor) {
      if (!opcoes.deixarDeFora) return { naoCoube: peca };
      deFora.push(peca);
      continue;
    }
    postas.push(melhor);
    for (const [grupo, ponto] of melhor.orientacao.refs) {
      if (!fasesDosGrupos.has(grupo)) fasesDosGrupos.set(grupo, { x: ponto.x + melhor.delta.x, y: ponto.y + melhor.delta.y });
    }
    if (primeira) opcoes.aoProgredir?.(postas.length + deFora.length, ordem.length);
    cortes.push(melhor.corte);
    caixas.push(melhor.caixa);
    fimDoComprimento = Math.max(fimDoComprimento, melhor.caixa.maxY);
    const c = melhor.caixa;
    pontos = [...pontos, { x: c.maxX + afastamento, y: c.minY }, { x: c.minX, y: c.maxY + afastamento }, { x: 0, y: c.maxY + afastamento }, { x: c.maxX + afastamento, y: piso }]
      .filter((p) => p.x < opcoes.larguraMm && p.y < opcoes.comprimentoMaximoMm)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }
  return { postas, deFora };
}

const ORDENS: ReadonlyArray<readonly [string, (o: Orientacao) => number]> = [
  ['maior área primeiro', (o) => area(o.corte)],
  ['mais compridas primeiro', (o) => o.caixa.maxY],
  ['mais largas primeiro', (o) => o.caixa.maxX],
];

export function fazerRisco(todasAsPecas: readonly PecaDoRisco[], grade: GradeDoRisco, opcoes: OpcoesDoRisco): RiscoGerado | RiscoQueNaoSai {
  let pecas = todasAsPecas;
  const agora = opcoes.agora ?? Date.now;
  const inicio = agora();
  if (!(opcoes.larguraMm > 0)) return { ok: false, grade, motivo: 'Falta a largura do risco (a largura útil da malha).' };
  if (pecas.length === 0) return { ok: false, grade, motivo: 'A grade não tem nenhuma peça.' };
  // As orientações de cada cópia (as cópias da mesma peça e do mesmo lado têm as mesmas).
  const porTipo = new Map<string, Orientacao[]>();
  const orientacoes = new Map<PecaDoRisco, Orientacao[]>();
  for (const p of pecas) {
    const chave = `${p.pecaId}|${p.tamanho}|${p.espelhada}`;
    if (!porTipo.has(chave)) porTipo.set(chave, orientacoesDa(p, opcoes.sentidoUnico, opcoes.casamento !== undefined));
    orientacoes.set(p, porTipo.get(chave)!);
  }
  if (opcoes.casamento) {
    const semMarca = [...new Set(pecas.filter((p) => orientacoes.get(p)!.some((o) => o.ref === null && o.refs.size === 0)).map((p) => p.nome))];
    if (semMarca.length > 0) {
      return {
        ok: false,
        grade,
        motivo: `Para casar as listras/xadrez, cada peça precisa da marca "${ROTULO_DO_PONTO_DE_CASAMENTO}" (o ponto que cai numa linha do desenho). Faltam em: ${semMarca.join(', ')}. Ponha a marca (aba Marcações), ou planeje com o casamento feito à parte.`,
      };
    }
    if (!casamentoValido(opcoes.casamento)) return { ok: false, grade, motivo: 'O casamento precisa da repetição do desenho (rapport) no comprimento ou na largura, maior que zero.' };
  }
  const largasDemais = pecas.filter((p) => !orientacoes.get(p)!.some((o) => o.caixa.maxX <= opcoes.larguraMm + 1e-9));
  if (opcoes.deixarDeFora && largasDemais.length > 0) pecas = pecas.filter((p) => !largasDemais.includes(p));
  for (const p of opcoes.deixarDeFora ? [] : pecas) {
    if (!orientacoes.get(p)!.some((o) => o.caixa.maxX <= opcoes.larguraMm + 1e-9)) {
      const menor = Math.min(...orientacoes.get(p)!.map((o) => o.caixa.maxX));
      return {
        ok: false,
        grade,
        motivo: `A peça “${p.nome}” (${p.tamanho}) não cabe na largura de ${(opcoes.larguraMm / 1000).toFixed(2).replace('.', ',')} m em nenhuma das orientações que ela permite (a mais estreita ocupa ${(menor / 1000).toFixed(2).replace('.', ',')} m).`,
      };
    }
  }
  // As duas peças vizinhas podem estar simplificadas: a diferença das duas entra na distância.
  const folgaDaSimplificacao = 2 * Math.max(0, ...[...orientacoes.values()].flat().map((o) => o.desvioMm));
  const gruposDoRisco = ordemDosGrupos(pecas.map((p) => p.molde));
  let melhor: { postas: Posta[]; deFora: PecaDoRisco[]; ordem: string } | null = null;
  let naoCoube: PecaDoRisco | null = null;
  const tentadas: string[] = [];
  for (const [nome, medida] of ORDENS.filter(([n]) => !opcoes.ordens || opcoes.ordens.includes(n))) {
    if (tentadas.length > 0 && opcoes.tempoLimiteMs !== undefined && agora() - inicio > opcoes.tempoLimiteMs) break;
    tentadas.push(nome);
    const chave = (p: PecaDoRisco): number => Math.max(...orientacoes.get(p)!.map(medida));
    // Estável: as cópias da mesma peça ficam juntas, na ordem em que vieram.
    // Os grupos do encaixe na ordem (as sem grupo por último); em cada grupo, a medida desta ordem de entrada.
    // Com casamento, as peças só com pontos de grupo ("casamento: manga") vêm depois das que têm o ponto principal:
    // a fase de cada grupo sai da peça que cai na linha do desenho (a frente), e a manga casa com ela (ADR 0129).
    const soComGrupos = (p: PecaDoRisco): number => (opcoes.casamento && orientacoes.get(p)!.every((o) => o.ref === null) ? 1 : 0);
    const ordem = pecas
      .map((p, i) => ({ p, i, g: indiceDoGrupo(gruposDoRisco, grupoDaPeca(p.molde)), s: soComGrupos(p), v: chave(p) }))
      .sort((a, b) => a.g - b.g || a.s - b.s || b.v - a.v || a.i - b.i)
      .map((x) => x.p);
    const passada = porNaOrdem(ordem, orientacoes, opcoes, folgaDaSimplificacao, tentadas.length === 1);
    if ('cancelado' in passada) return { ok: false, grade, motivo: 'A busca foi cancelada.', cancelado: true };
    if ('naoCoube' in passada) {
      naoCoube = passada.naoCoube;
      continue;
    }
    if (passada.postas.length === 0) continue;
    const comprimento = Math.max(...passada.postas.map((x) => x.caixa.maxY));
    // Fica a que deixa menos de fora e, entre essas, a mais curta.
    if (
      !melhor ||
      passada.deFora.length < melhor.deFora.length ||
      (passada.deFora.length === melhor.deFora.length && comprimento < Math.max(...melhor.postas.map((x) => x.caixa.maxY)) - 1e-6)
    ) {
      melhor = { postas: passada.postas, deFora: passada.deFora, ordem: nome };
    }
  }
  if (!melhor) {
    return {
      ok: false,
      grade,
      motivo: `As peças da grade não cabem num risco de até ${(opcoes.comprimentoMaximoMm / 1000).toFixed(2).replace('.', ',')} m (a mesa menos as margens)${naoCoube ? `: “${naoCoube.nome}” (${naoCoube.tamanho}) ficou de fora` : ''}. Use uma grade com menos roupas por risco, ou uma mesa mais comprida.`,
    };
  }
  // As medidas são arredondadas no centésimo, como o contorno guardado: assim ele nunca passa delas.
  const noCentesimo = (v: number): number => Math.round(v * 100) / 100;
  const comprimentoMm = noCentesimo(Math.max(...melhor.postas.map((x) => x.caixa.maxY)));
  const larguraOcupadaMm = noCentesimo(Math.max(...melhor.postas.map((x) => x.caixa.maxX)));
  const areaDasPecasMm2 = melhor.postas.reduce((s, x) => s + area(x.corte), 0);
  const blocosDosGrupos = blocosDasPostas(
    melhor.postas.map((x) => ({ grupo: grupoDaPeca(x.peca.molde), corte: x.corte })),
    gruposDoRisco,
  );
  const saida: PecaPostaNoRisco[] = melhor.postas.map((x) => ({
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
      deslocamentoMm: { x: x.orientacao.deslocamento.x + x.delta.x, y: x.orientacao.deslocamento.y + x.delta.y },
      ...(x.peca.copia !== undefined ? { copia: x.peca.copia } : {}),
      ...(opcoes.casamento && x.orientacao.ref ? { pontoDeCasamento: { x: x.orientacao.ref.x + x.delta.x, y: x.orientacao.ref.y + x.delta.y } } : {}),
      ...(opcoes.casamento && x.orientacao.refs.size > 0
        ? { pontosDeCasamento: Object.fromEntries([...x.orientacao.refs].map(([g, q]) => [g, { x: q.x + x.delta.x, y: q.y + x.delta.y }])) }
        : {}),
  }));
  return {
    ok: true,
    grade,
    pecas: saida,
    comprimentoMm,
    larguraOcupadaMm,
    larguraDoRiscoMm: opcoes.larguraMm,
    areaDasPecasMm2,
    eficienciaPercentual: (areaDasPecasMm2 / (comprimentoMm * opcoes.larguraMm)) * 100,
    metodo: METODO_DO_RISCO,
    ordensTentadas: tentadas,
    ordemEscolhida: melhor.ordem,
    tempoMs: agora() - inicio,
    ...(opcoes.casamento ? { casamento: { ...opcoes.casamento, conferido: conferirCasamento(saida, opcoes.casamento).length === 0 } } : {}),
    ...(opcoes.deixarDeFora
      ? { deFora: [...largasDemais, ...melhor.deFora].map((p) => ({ pecaId: p.pecaId, nome: p.nome, tamanho: p.tamanho, ...(p.copia !== undefined ? { copia: p.copia } : {}) })) }
      : {}),
    ...(blocosDosGrupos.length > 0 ? { blocosDosGrupos } : {}),
  };
}

function casamentoValido(c: Casamento): boolean {
  const ok = (v: number | undefined): boolean => v === undefined || v > 0;
  return ok(c.rapportComprimentoMm) && ok(c.rapportLarguraMm) && (c.rapportComprimentoMm !== undefined || c.rapportLarguraMm !== undefined);
}

/**
 * As peças fora da fase: o ponto principal fora das linhas do desenho, ou o ponto de um grupo ("casamento: manga") fora
 * da listra do mesmo grupo nas outras peças (a do primeiro). O nome de cada uma (e o grupo). Vazio: tudo casado.
 */
export function conferirCasamento(pecas: readonly PecaPostaNoRisco[], c: Casamento): string[] {
  const fora = (v: number, rapport: number | undefined, fase: number): boolean => {
    if (!rapport) return false;
    const resto = (((v - fase) % rapport) + rapport) % rapport;
    return Math.min(resto, rapport - resto) > 0.01;
  };
  const foraDoPonto = (q: Ponto2D, fase: Ponto2D): boolean => fora(q.y, c.rapportComprimentoMm, fase.y) || fora(q.x, c.rapportLarguraMm, fase.x);
  const doTecido = { x: c.faseLarguraMm, y: c.faseComprimentoMm };
  const fasesDosGrupos = new Map<string, Ponto2D>();
  const saida: string[] = [];
  for (const p of pecas) {
    const grupos = Object.entries(p.pontosDeCasamento ?? {});
    if ((!p.pontoDeCasamento && grupos.length === 0) || (p.pontoDeCasamento && foraDoPonto(p.pontoDeCasamento, doTecido))) saida.push(`${p.nome} (${p.tamanho})`);
    for (const [grupo, q] of grupos) {
      const fase = fasesDosGrupos.get(grupo);
      if (!fase) fasesDosGrupos.set(grupo, q);
      else if (foraDoPonto(q, fase)) saida.push(`${p.nome} (${p.tamanho}), no ponto “casamento: ${grupo}”`);
    }
  }
  return saida;
}

/**
 * A linha de corte verdadeira (sem simplificar) de uma peça posta no risco: a peça como veio, levada à orientação
 * dela (o par espelhado, o giro, o espelho) e ao lugar. Serve para conferir a distância de verdade entre as peças.
 */
export function linhaDeCorteVerdadeira(peca: PecaDoRisco, posta: PecaPostaNoRisco): Contorno {
  const orientada = moldeOrientado(peca, posta);
  if (!posta.deslocamentoMm) throw new Error('Esta peça foi guardada antes do deslocamento ser registrado.');
  return transladarContorno(linhaDeCorteDaPeca(orientada), posta.deslocamentoMm);
}

/** A peça na orientação em que ficou no risco (o par espelhado, o giro, o espelho), ainda sem ir para o lugar. */
export function moldeOrientado(peca: PecaDoRisco, posta: Pick<PecaPostaNoRisco, 'anguloGraus' | 'espelhada'>): Molde {
  const base = peca.espelhada ? espelharMolde(peca.molde, peca.molde.id) : peca.molde;
  const girada = posta.anguloGraus === 0 ? base : rotacionarMolde(base, posta.anguloGraus);
  return posta.espelhada !== peca.espelhada ? espelharMolde(girada, girada.id) : girada;
}
