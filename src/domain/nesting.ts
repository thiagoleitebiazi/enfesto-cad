import { linhaDeCorteDaPeca, rotacionarMolde, espelharMolde, transladarMolde, rotacoesNoEncaixe, type Molde } from './molde';
import { areaUtilDaMesa, contornoDaZona, type ConfiguracaoDeEnfesto } from './enfesto';
import { area, retanguloEnvolvente, type Contorno } from '../core/geometria';
import { encontrarPrimeiraPosicaoValida, type LimitesDeArea } from './posicionamento';
import { fazerRisco, moldeOrientado, type PecaDoRisco } from './risco';
import { blocosNaMesa, grupoDaPeca, indiceDoGrupo, ordemDosGrupos, type BlocoDoGrupo } from './gruposDoEncaixe';

/**
 * Motor de NESTING automático (seção 6 do escopo). Usa os contornos reais
 * dos moldes (não apenas retângulos envolventes), respeita quantidade por
 * peça, restrição de rotação por peça (nunca tenta um ângulo proibido — a
 * regra crítica do sentido do fio, seção 5, nunca é ignorada aqui) e as
 * dimensões/margens/distância mínima do enfesto configurado.
 *
 * Cada peça colocada é reconstruída via `rotacionarMolde`/`transladarMolde`
 * (as mesmas funções já usadas pela edição manual), então furos, piques,
 * marcas e margem de costura viajam junto — não são reimplementados aqui.
 *
 * Estratégia: heurística determinística "maior peça primeiro, primeiro
 * encaixe" (largest-first, first-fit) — ordena todas as cópias a colocar
 * pela área decrescente e tenta encaixar cada uma, ângulo permitido por
 * ângulo permitido, na primeira posição livre (varredura esquerda→direita,
 * cima→baixo). NÃO é o ótimo matemático — é reprodutível, geometricamente
 * válido e razoavelmente bom, como o escopo pede explicitamente para
 * priorizar. Ver ADR 0004.
 */

export interface PecaColocada {
  readonly idOriginal: string;
  readonly indiceCopia: number;
  readonly molde: Molde;
}

export interface PecaNaoColocada {
  readonly idOriginal: string;
  readonly indiceCopia: number;
  readonly nome: string;
}

export interface ResultadoDeNesting {
  readonly pecasColocadas: readonly PecaColocada[];
  readonly pecasNaoColocadas: readonly PecaNaoColocada[];
  readonly comprimentoUtilizadoMm: number;
  readonly areaOcupadaMm2: number;
  readonly aproveitamentoPercentual: number;
  readonly tempoDeProcessamentoMs: number;
  readonly interrompido: boolean;
  /** Verdadeiro se o cálculo parou por atingir `opcoes.limiteDeTempoMs` (peças restantes ficam em `pecasNaoColocadas`). */
  readonly paradaPorTempoLimite: boolean;
  /** Verdadeiro se o cálculo parou por já ter atingido `opcoes.aproveitamentoDesejadoPercentual` (peças restantes ficam em `pecasNaoColocadas`, não é uma falha). */
  readonly paradaPorMetaDeAproveitamento: boolean;
  /** Com peças em grupos (ADR 0103): o trecho do comprimento de cada grupo, na ordem. */
  readonly blocosDosGrupos?: readonly BlocoDoGrupo[];
}

export interface OpcoesDeNesting {
  readonly passoMm?: number;
  readonly maxTentativasPorPeca?: number;
  /** Chamado entre cada peça; devolver `false` interrompe o cálculo (resultado parcial, `interrompido: true`). */
  readonly deveContinuar?: () => boolean;
  /** Chamado após cada peça (colocada ou não) — para relatar progresso. */
  readonly aoProgredir?: (colocadas: number, total: number) => void;
  /** Relógio injetável (testes) — por padrão `Date.now`. */
  readonly agora?: () => number;
  /** Limite de tempo total em ms — atingido, para o cálculo com resultado parcial (não é uma rejeição de peças, é uma parada honesta). */
  readonly limiteDeTempoMs?: number;
  /** Aproveitamento (%) desejado — atingido ou ultrapassado após colocar uma peça, o cálculo para (não tenta espremer mais peças além da meta pedida). */
  readonly aproveitamentoDesejadoPercentual?: number;
  /** O tecido tem pelo ou estampa direcional: nenhuma peça é virada 180° nem 270° (ver `rotacoesNoEncaixe`). */
  readonly tecidoDeSentidoUnico?: boolean;
}

interface InstanciaParaColocar {
  readonly idOriginal: string;
  readonly indiceCopia: number;
  readonly moldeNaOrigem: Molde;
  readonly areaMm2: number;
  /** O grupo do encaixe (`''`: sem grupo). */
  readonly grupo: string;
}

function construirInstancias(pecas: readonly Molde[]): InstanciaParaColocar[] {
  const instancias: InstanciaParaColocar[] = [];
  for (const peca of pecas) {
    const bbox = retanguloEnvolvente(peca.contorno);
    for (let i = 0; i < peca.quantidade; i++) {
      const naOrigem = { ...transladarMolde(peca, { x: -bbox.minX, y: -bbox.minY }, `${peca.id}#${i}`), quantidade: 1 };
      // A peça em par: uma direita e uma esquerda — as cópias ímpares saem espelhadas (na mesma caixa).
      const moldeNaOrigem = peca.emPar && i % 2 === 1 ? espelharMolde(naOrigem, naOrigem.id) : naOrigem;
      instancias.push({
        idOriginal: peca.id,
        indiceCopia: i,
        moldeNaOrigem,
        areaMm2: area(linhaDeCorteDaPeca(peca)),
        grupo: grupoDaPeca(peca),
      });
    }
  }
  // Os grupos do encaixe na ordem (as sem grupo por último) e, em cada um, a maior área primeiro — heurística
  // "largest-first" clássica de nesting/bin-packing. Sem grupos, só a área.
  const ordem = ordemDosGrupos(pecas);
  return instancias.sort((a, b) => indiceDoGrupo(ordem, a.grupo) - indiceDoGrupo(ordem, b.grupo) || b.areaMm2 - a.areaMm2);
}

/** O encaixe inteiro, de uma vez (sem pausas): ver `passosDoNesting`. */
export function executarNestingAutomatico(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  opcoes: OpcoesDeNesting = {},
): ResultadoDeNesting {
  const passos = passosDoNesting(pecas, enfesto, opcoes);
  for (;;) {
    const passo = passos.next();
    if (passo.done) return passo.value;
  }
}

/**
 * Roda os passos do encaixe em fatias de tempo, com uma pausa entre elas. No
 * Web Worker, a pausa é o que deixa o pedido de cancelar chegar: com o cálculo
 * de uma vez só, a mensagem "cancelar" ficava na fila até o fim, e o botão
 * Cancelar não fazia nada.
 */
export async function executarEmFatias<T>(
  passos: Generator<unknown, T, void>,
  pausar: () => Promise<void>,
  fatiaMs = 30,
  agora: () => number = Date.now,
): Promise<T> {
  let comecoDaFatia = agora();
  for (;;) {
    const passo = passos.next();
    if (passo.done) return passo.value;
    if (agora() - comecoDaFatia >= fatiaMs) {
      await pausar();
      comecoDaFatia = agora();
    }
  }
}

/**
 * O encaixe peça por peça: cada `next()` tenta colocar uma peça (o valor é
 * quantas já foram tentadas) e o último devolve o resultado. `deveContinuar`
 * é consultado antes de cada peça.
 */
export function* passosDoNesting(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  opcoes: OpcoesDeNesting = {},
): Generator<number, ResultadoDeNesting, void> {
  const inicio = (opcoes.agora ?? Date.now)();
  const passoMm = opcoes.passoMm ?? 10;
  const maxTentativasPorPeca = opcoes.maxTentativasPorPeca ?? 20000;

  const instancias = construirInstancias(pecas);
  const limitesDaMesa: LimitesDeArea = areaUtilDaMesa(enfesto);
  const zonas = (enfesto.zonasBloqueadas ?? []).map(contornoDaZona);
  // Cada grupo do encaixe começa depois de tudo o que já foi posto (à distância entre as peças): os grupos ficam em
  // trechos separados do comprimento. Sem grupos, a mesa toda o tempo todo.
  let limites: LimitesDeArea = limitesDaMesa;
  let grupoAtual: string | null = null;

  const colocadas: PecaColocada[] = [];
  const naoColocadas: PecaNaoColocada[] = [];
  const contornosColocados: Contorno[] = [];
  let interrompido = false;
  let paradaPorTempoLimite = false;
  let paradaPorMetaDeAproveitamento = false;

  // O que ocupa o tecido é a linha de corte (com a costura, fica fora do contorno): é por ela que as peças
  // guardam a distância umas das outras, ficam dentro da área e entram nas contas.
  function aproveitamentoAtual(): number {
    const comprimento = contornosColocados.length === 0 ? 0 : Math.max(...contornosColocados.map((c) => retanguloEnvolvente(c).maxY));
    const areaOcupada = contornosColocados.reduce((soma, c) => soma + area(c), 0);
    const areaDisponivel = enfesto.larguraUtilMm * comprimento;
    return areaDisponivel > 0 ? (areaOcupada / areaDisponivel) * 100 : 0;
  }

  for (const instancia of instancias) {
    if (opcoes.deveContinuar && !opcoes.deveContinuar()) {
      interrompido = true;
      naoColocadas.push({
        idOriginal: instancia.idOriginal,
        indiceCopia: instancia.indiceCopia,
        nome: instancia.moldeNaOrigem.nome,
      });
      continue;
    }

    if (
      opcoes.limiteDeTempoMs !== undefined &&
      (opcoes.agora ?? Date.now)() - inicio >= opcoes.limiteDeTempoMs
    ) {
      paradaPorTempoLimite = true;
      naoColocadas.push({
        idOriginal: instancia.idOriginal,
        indiceCopia: instancia.indiceCopia,
        nome: instancia.moldeNaOrigem.nome,
      });
      continue;
    }

    if (instancia.grupo !== grupoAtual) {
      if (grupoAtual !== null && contornosColocados.length > 0) {
        const piso = Math.max(...contornosColocados.map((c) => retanguloEnvolvente(c).maxY)) + enfesto.distanciaMinimaEntrePecasMm;
        limites = { ...limitesDaMesa, minY: Math.max(limitesDaMesa.minY, piso) };
      }
      grupoAtual = instancia.grupo;
    }

    const angulos = rotacoesNoEncaixe(instancia.moldeNaOrigem.restricaoDeRotacao, opcoes.tecidoDeSentidoUnico ?? false);
    // Para cada ângulo permitido, tenta a orientação normal e, só se o
    // molde autorizar explicitamente (regra crítica da seção 5, nunca
    // presumida), a versão espelhada nesse mesmo ângulo — nunca inventa
    // uma orientação fora do que a peça permite, só combina as que já são
    // permitidas com o espelhamento também permitido.
    const candidatos: Molde[] = [];
    for (const angulo of angulos) {
      const base = angulo === 0 ? instancia.moldeNaOrigem : rotacionarMolde(instancia.moldeNaOrigem, angulo);
      candidatos.push(base);
      // Na peça em par, o lado de cada cópia já está dado: espelhar trocaria a direita pela esquerda.
      if (instancia.moldeNaOrigem.restricaoDeRotacao.permiteEspelhamento && !instancia.moldeNaOrigem.emPar) {
        candidatos.push(espelharMolde(base, `${base.id}-espelhado`));
      }
    }

    let posicionada = false;

    for (const candidato of candidatos) {
      const delta = encontrarPrimeiraPosicaoValida(
        linhaDeCorteDaPeca(candidato),
        [...zonas, ...contornosColocados],
        limites,
        enfesto.distanciaMinimaEntrePecasMm,
        passoMm,
        maxTentativasPorPeca,
      );
      if (delta) {
        const moldeFinal = transladarMolde(candidato, delta, `${instancia.idOriginal}#${instancia.indiceCopia}`);
        contornosColocados.push(linhaDeCorteDaPeca(moldeFinal));
        colocadas.push({ idOriginal: instancia.idOriginal, indiceCopia: instancia.indiceCopia, molde: moldeFinal });
        posicionada = true;
        break;
      }
    }

    if (!posicionada) {
      naoColocadas.push({
        idOriginal: instancia.idOriginal,
        indiceCopia: instancia.indiceCopia,
        nome: instancia.moldeNaOrigem.nome,
      });
    }

    opcoes.aoProgredir?.(colocadas.length + naoColocadas.length, instancias.length);
    yield colocadas.length + naoColocadas.length;

    if (
      posicionada &&
      opcoes.aproveitamentoDesejadoPercentual !== undefined &&
      aproveitamentoAtual() >= opcoes.aproveitamentoDesejadoPercentual
    ) {
      paradaPorMetaDeAproveitamento = true;
      break;
    }
  }

  // Instâncias que nunca chegaram a ser tentadas (parada por meta de
  // aproveitamento interrompe o for antes de percorrer o resto) também
  // entram em pecasNaoColocadas — resultado parcial honesto, igual à
  // parada cooperativa (deveContinuar) e ao limite de tempo.
  if (paradaPorMetaDeAproveitamento) {
    const idsJaContabilizados = new Set([
      ...colocadas.map((p) => `${p.idOriginal}#${p.indiceCopia}`),
      ...naoColocadas.map((p) => `${p.idOriginal}#${p.indiceCopia}`),
    ]);
    for (const instancia of instancias) {
      const chave = `${instancia.idOriginal}#${instancia.indiceCopia}`;
      if (!idsJaContabilizados.has(chave)) {
        naoColocadas.push({
          idOriginal: instancia.idOriginal,
          indiceCopia: instancia.indiceCopia,
          nome: instancia.moldeNaOrigem.nome,
        });
      }
    }
  }

  const comprimentoUtilizadoMm =
    contornosColocados.length === 0 ? 0 : Math.max(...contornosColocados.map((c) => retanguloEnvolvente(c).maxY));
  const areaOcupadaMm2 = contornosColocados.reduce((soma, c) => soma + area(c), 0);
  const areaDisponivelMm2 = enfesto.larguraUtilMm * comprimentoUtilizadoMm;
  const aproveitamentoPercentual = areaDisponivelMm2 > 0 ? (areaOcupadaMm2 / areaDisponivelMm2) * 100 : 0;
  const blocosDosGrupos = blocosNaMesa(colocadas.map((c) => c.molde));

  return {
    pecasColocadas: colocadas,
    pecasNaoColocadas: naoColocadas,
    comprimentoUtilizadoMm,
    areaOcupadaMm2,
    aproveitamentoPercentual,
    tempoDeProcessamentoMs: (opcoes.agora ?? Date.now)() - inicio,
    interrompido,
    paradaPorTempoLimite,
    paradaPorMetaDeAproveitamento,
    ...(blocosDosGrupos.length > 0 ? { blocosDosGrupos } : {}),
  };
}

/** O método do encaixe automático na mesa: a busca em grade (o de sempre) ou os pontos de canto (o do planejamento). */
export type MetodoDoNesting = 'grade' | 'pontos-de-canto';

/**
 * O encaixe na mesa do projeto pelo motor do planejamento de corte (pontos de canto com encosto, várias ordens de
 * entrada, curvas simplificadas com a diferença somada à distância — ver risco.ts). Entrega o mesmo resultado do
 * encaixe em grade (as peças postas, as que ficaram de fora, o comprimento e o aproveitamento), para a janela e o
 * "Aplicar" serem os mesmos. A meta de aproveitamento não vale neste método (ele põe todas as que couberem).
 */
export function executarNestingPorPontosDeCanto(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  opcoes: Pick<OpcoesDeNesting, 'deveContinuar' | 'aoProgredir' | 'agora' | 'limiteDeTempoMs' | 'tecidoDeSentidoUnico'> = {},
): ResultadoDeNesting {
  const agora = opcoes.agora ?? Date.now;
  const inicio = agora();
  const copias: PecaDoRisco[] = [];
  for (const peca of pecas) {
    for (let i = 0; i < peca.quantidade; i++) {
      copias.push({ pecaId: peca.id, nome: peca.nome, tamanho: peca.tamanho, molde: { ...peca, quantidade: 1 }, espelhada: peca.emPar === true && i % 2 === 1, copia: i });
    }
  }
  const util = areaUtilDaMesa(enfesto);
  const largura = util.maxX - util.minX;
  const comprimento = util.maxY - util.minY;
  const vazio = (motivoDeFora: readonly PecaDoRisco[], interrompido: boolean): ResultadoDeNesting => ({
    pecasColocadas: [],
    pecasNaoColocadas: motivoDeFora.map((p) => ({ idOriginal: p.pecaId, indiceCopia: p.copia ?? 0, nome: p.nome })),
    comprimentoUtilizadoMm: 0,
    areaOcupadaMm2: 0,
    aproveitamentoPercentual: 0,
    tempoDeProcessamentoMs: agora() - inicio,
    interrompido,
    paradaPorTempoLimite: false,
    paradaPorMetaDeAproveitamento: false,
  });
  if (copias.length === 0 || !(largura > 0) || !(comprimento > 0)) return vazio(copias, false);
  const risco = fazerRisco(copias, {}, {
    larguraMm: largura,
    comprimentoMaximoMm: comprimento,
    distanciaMm: enfesto.distanciaMinimaEntrePecasMm,
    sentidoUnico: opcoes.tecidoDeSentidoUnico ?? false,
    deixarDeFora: true,
    agora,
    ...(enfesto.zonasBloqueadas ? { zonasBloqueadas: enfesto.zonasBloqueadas.map((z) => ({ minX: z.minX - util.minX, maxX: z.maxX - util.minX, minY: z.minY - util.minY, maxY: z.maxY - util.minY })) } : {}),
    ...(opcoes.limiteDeTempoMs !== undefined ? { tempoLimiteMs: opcoes.limiteDeTempoMs } : {}),
    ...(opcoes.deveContinuar ? { deveParar: () => !opcoes.deveContinuar!() } : {}),
    ...(opcoes.aoProgredir ? { aoProgredir: opcoes.aoProgredir } : {}),
  });
  if (!risco.ok) return vazio(copias, risco.cancelado === true);
  const margem = { x: util.minX, y: util.minY };
  const colocadas: PecaColocada[] = risco.pecas.map((posta) => {
    const copia = copias.find((c) => c.pecaId === posta.pecaId && c.copia === posta.copia)!;
    const orientada = moldeOrientado(copia, posta);
    const d = posta.deslocamentoMm!;
    return {
      idOriginal: copia.pecaId,
      indiceCopia: copia.copia ?? 0,
      molde: transladarMolde(orientada, { x: d.x + margem.x, y: d.y + margem.y }, `${copia.pecaId}#${copia.copia ?? 0}`),
    };
  });
  const cortes = colocadas.map((c) => linhaDeCorteDaPeca(c.molde));
  const comprimentoUtilizadoMm = cortes.length === 0 ? 0 : Math.max(...cortes.map((c) => retanguloEnvolvente(c).maxY));
  const areaOcupadaMm2 = cortes.reduce((soma, c) => soma + area(c), 0);
  const areaDisponivel = enfesto.larguraUtilMm * comprimentoUtilizadoMm;
  const blocosDosGrupos = blocosNaMesa(colocadas.map((c) => c.molde));
  return {
    pecasColocadas: colocadas,
    pecasNaoColocadas: (risco.deFora ?? []).map((p) => ({ idOriginal: p.pecaId, indiceCopia: p.copia ?? 0, nome: p.nome })),
    comprimentoUtilizadoMm,
    areaOcupadaMm2,
    aproveitamentoPercentual: areaDisponivel > 0 ? (areaOcupadaMm2 / areaDisponivel) * 100 : 0,
    tempoDeProcessamentoMs: agora() - inicio,
    interrompido: false,
    paradaPorTempoLimite: false,
    paradaPorMetaDeAproveitamento: false,
    ...(blocosDosGrupos.length > 0 ? { blocosDosGrupos } : {}),
  };
}
