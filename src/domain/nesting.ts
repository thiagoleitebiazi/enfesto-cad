import { rotacionarMolde, transladarMolde, rotacoesPermitidas, type Molde } from './molde';
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

    const angulos = rotacoesPermitidas(instancia.moldeNaOrigem.restricaoDeRotacao);
    let posicionada = false;

    for (const angulo of angulos) {
      const candidato = angulo === 0 ? instancia.moldeNaOrigem : rotacionarMolde(instancia.moldeNaOrigem, angulo);
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
  };
}
