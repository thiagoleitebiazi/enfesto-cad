import { rotacionarMolde, espelharMolde, transladarMolde, rotacoesPermitidas, type Molde } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import { area, retanguloEnvolvente, type Contorno } from '../core/geometria';
import { encontrarPrimeiraPosicaoValida, type LimitesDeArea } from './posicionamento';

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
}

interface InstanciaParaColocar {
  readonly idOriginal: string;
  readonly indiceCopia: number;
  readonly moldeNaOrigem: Molde;
  readonly areaMm2: number;
}

function construirInstancias(pecas: readonly Molde[]): InstanciaParaColocar[] {
  const instancias: InstanciaParaColocar[] = [];
  for (const peca of pecas) {
    const bbox = retanguloEnvolvente(peca.contorno);
    for (let i = 0; i < peca.quantidade; i++) {
      const moldeNaOrigem = {
        ...transladarMolde(peca, { x: -bbox.minX, y: -bbox.minY }, `${peca.id}#${i}`),
        quantidade: 1,
      };
      instancias.push({
        idOriginal: peca.id,
        indiceCopia: i,
        moldeNaOrigem,
        areaMm2: area(peca.contorno),
      });
    }
  }
  // Maior área primeiro — heurística "largest-first" clássica de nesting/bin-packing.
  return instancias.sort((a, b) => b.areaMm2 - a.areaMm2);
}

export function executarNestingAutomatico(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  opcoes: OpcoesDeNesting = {},
): ResultadoDeNesting {
  const inicio = (opcoes.agora ?? Date.now)();
  const passoMm = opcoes.passoMm ?? 10;
  const maxTentativasPorPeca = opcoes.maxTentativasPorPeca ?? 20000;

  const instancias = construirInstancias(pecas);
  const limites: LimitesDeArea = {
    minX: enfesto.margemLateralMm,
    maxX: enfesto.larguraUtilMm - enfesto.margemLateralMm,
    minY: enfesto.margemDeExtremidadeMm,
    maxY: enfesto.comprimentoMm - enfesto.margemDeExtremidadeMm,
  };

  const colocadas: PecaColocada[] = [];
  const naoColocadas: PecaNaoColocada[] = [];
  const contornosColocados: Contorno[] = [];
  let interrompido = false;
  let paradaPorTempoLimite = false;
  let paradaPorMetaDeAproveitamento = false;

  function aproveitamentoAtual(): number {
    const comprimento =
      colocadas.length === 0 ? 0 : Math.max(...colocadas.map((p) => retanguloEnvolvente(p.molde.contorno).maxY));
    const areaOcupada = colocadas.reduce((soma, p) => soma + area(p.molde.contorno), 0);
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

    const angulos = rotacoesPermitidas(instancia.moldeNaOrigem.restricaoDeRotacao);
    // Para cada ângulo permitido, tenta a orientação normal e, só se o
    // molde autorizar explicitamente (regra crítica da seção 5, nunca
    // presumida), a versão espelhada nesse mesmo ângulo — nunca inventa
    // uma orientação fora do que a peça permite, só combina as que já são
    // permitidas com o espelhamento também permitido.
    const candidatos: Molde[] = [];
    for (const angulo of angulos) {
      const base = angulo === 0 ? instancia.moldeNaOrigem : rotacionarMolde(instancia.moldeNaOrigem, angulo);
      candidatos.push(base);
      if (instancia.moldeNaOrigem.restricaoDeRotacao.permiteEspelhamento) {
        candidatos.push(espelharMolde(base, `${base.id}-espelhado`));
      }
    }

    let posicionada = false;

    for (const candidato of candidatos) {
      const delta = encontrarPrimeiraPosicaoValida(
        candidato.contorno,
        contornosColocados,
        limites,
        enfesto.distanciaMinimaEntrePecasMm,
        passoMm,
        maxTentativasPorPeca,
      );
      if (delta) {
        const moldeFinal = transladarMolde(candidato, delta, `${instancia.idOriginal}#${instancia.indiceCopia}`);
        contornosColocados.push(moldeFinal.contorno);
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
    colocadas.length === 0 ? 0 : Math.max(...colocadas.map((p) => retanguloEnvolvente(p.molde.contorno).maxY));
  const areaOcupadaMm2 = colocadas.reduce((soma, p) => soma + area(p.molde.contorno), 0);
  const areaDisponivelMm2 = enfesto.larguraUtilMm * comprimentoUtilizadoMm;
  const aproveitamentoPercentual = areaDisponivelMm2 > 0 ? (areaOcupadaMm2 / areaDisponivelMm2) * 100 : 0;

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
  };
}
