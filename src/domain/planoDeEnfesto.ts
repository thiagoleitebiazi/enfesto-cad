import { comprimentoDoRolo, grupoDoRolo, type MalhaDoCadastro, type RoloDeEstoque } from './cadastroDeProducao';
import { camadasParaFechar } from './composicaoDeRiscos';
import { alocarCamadas, linhasDeEmendaDoRisco } from './alocacaoDosRolos';
import { fatoresDeCompensacao, ROTULO_DA_FONTE_DO_ENCOLHIMENTO, type FatoresDeCompensacao } from './encolhimento';
import { espessurasFisicasPorCamada, ROTULO_DO_TIPO, type TipoDeEnfesto } from './enfesto';
import { escreverKg, escreverM, escreverM2, escreverRendimento, rendimentoPelaGramatura } from './planoDeCorte';
import type { RestricaoDeRotacao } from './molde';
import { escreverGrade, type GradeDoRisco, type PecaPostaNoRisco } from './risco';

/**
 * O plano de enfesto (versão 2 do cálculo): com um ou mais riscos e as camadas de cada um, calcula a mesa, os
 * enfestos, o uso dos rolos (por lote e tonalidade), o consumo, as perdas, a sobra e a produção de cada tamanho —
 * e diz tudo o que presumiu. Não decide nada sozinho: o rendimento principal, misturar lotes e aceitar uma malha
 * listrada sem casamento são decisões de quem planeja. Com um dado faltando ou impossível, não calcula.
 *
 * Termos (os mesmos da tela):
 * - folha: uma espessura de malha estendida na mesa;
 * - camada: uma passada do enfesto ao longo da mesa — 1 folha no ímpar, no zigue-zague e no ramado; 2 no par (a
 *   malha aberta dobrada ao meio na largura, como o programa define o par — ver ADR 0003) e no tubular (os dois lados
 *   do tubo). Uma camada gasta um comprimento de malha, qualquer que seja o tipo;
 * - enfesto: as camadas empilhadas na mesa e cortadas de uma vez, com o mesmo risco;
 * - risco: o desenho das peças na largura da malha, por cima do enfesto, para o corte.
 *
 * Unidades internas: mm, mm², g, g/m², mm/g (= m/kg).
 */

export const VERSAO_DO_CALCULO_DO_PLANEJAMENTO = 2;

export const DEFINICOES = {
  folha: 'Folha: uma espessura de malha estendida na mesa.',
  camada: 'Camada: uma passada do enfesto ao longo da mesa — 1 folha no ímpar, no zigue-zague e no ramado; 2 folhas no par (a malha aberta dobrada ao meio na largura) e no tubular (os dois lados do tubo).',
  enfesto: 'Enfesto: as camadas empilhadas na mesa e cortadas de uma vez, com o mesmo risco.',
  risco: 'Risco: o desenho das peças na largura da malha, que vai por cima do enfesto para o corte.',
} as const;

export interface ConfiguracaoDoPlanejamento {
  readonly margemInicialDaMesaMm: number;
  readonly margemFinalDaMesaMm: number;
  /** As pontas de cada camada (o que passa do risco no começo e no fim). */
  readonly sobraPorCamadaMm: number;
  /** O que se perde de cada rolo (o começo e o fim, a emenda do tubete). */
  readonly perdaPorRoloMm: number;
  readonly folhasPorEnfestoMax: number;
  /** A altura máxima do enfesto (precisa da espessura da folha, na malha). */
  readonly alturaMaximaDoEnfestoMm?: number;
  /** O peso máximo de um enfesto (precisa do rendimento). */
  readonly pesoMaximoDoEnfestoG?: number;
  readonly comprimentoMaximoDaMesaMm: number;
  /** A largura da mesa (física); sem ela, a área é só a do tecido. */
  readonly larguraDaMesaMm?: number;
  readonly roupasPorRiscoMax: number;
  readonly distanciaEntrePecasMm: number;
  readonly toleranciaDeRendimentoPercentual: number;
  /** O tempo da busca dos riscos (s). */
  readonly tempoDeBuscaS: number;
  /** A enfestadeira/o processo permite emendar uma camada (um rolo que acaba no meio dela continua no seguinte). */
  readonly permitirEmendas?: boolean;
  /** Quanto o rolo novo passa por cima do anterior na emenda (mm). */
  readonly sobreposicaoDaEmendaMm?: number;
}

export const CONFIGURACAO_PADRAO_DO_PLANEJAMENTO: ConfiguracaoDoPlanejamento = {
  margemInicialDaMesaMm: 100,
  margemFinalDaMesaMm: 100,
  sobraPorCamadaMm: 20,
  perdaPorRoloMm: 0,
  folhasPorEnfestoMax: 100,
  comprimentoMaximoDaMesaMm: 12_000,
  roupasPorRiscoMax: 6,
  distanciaEntrePecasMm: 3,
  toleranciaDeRendimentoPercentual: 5,
  tempoDeBuscaS: 30,
  permitirEmendas: false,
  sobreposicaoDaEmendaMm: 100,
};

export type RendimentoPrincipal = 'informado' | 'calculado';

export interface PecaNoPlano {
  readonly id: string;
  readonly nome: string;
  readonly tamanhos: readonly string[];
  readonly quantidadePorRoupa: number;
  readonly emPar: boolean;
  readonly restricao: RestricaoDeRotacao;
  readonly areaMm2: number;
}

export interface MoldeNoPlano {
  readonly projetoId: string;
  readonly codigo: string;
  readonly nome: string;
  /** A revisão registrada que tem exatamente estas peças, ou `null` (peças mudadas depois da última revisão). */
  readonly revisao: number | null;
  readonly impressaoDigital: string;
  readonly pecas: readonly PecaNoPlano[];
}

export interface OrdemNoPlano {
  readonly id?: string;
  readonly codigo: string;
  readonly produto?: string;
  readonly cor?: string;
  readonly prazo?: string;
  readonly quantidadesPorTamanho: Readonly<Record<string, number>>;
}

export interface EntradaDoPlanejamento {
  readonly molde: MoldeNoPlano;
  readonly ordem: OrdemNoPlano;
  readonly malha: MalhaDoCadastro;
  /** Os rolos escolhidos, como estavam no estoque; `null`: o material é só um peso. */
  readonly rolos: readonly RoloDeEstoque[] | null;
  readonly pesoDisponivelG?: number;
  readonly rendimentoPrincipal: RendimentoPrincipal;
  /** Decisão de quem planeja: usar rolos de lotes ou tonalidades diferentes no mesmo plano. */
  readonly misturarGrupos: boolean;
  /** Decisão de quem planeja: planejar uma malha listrada ou xadrez sem o casamento (o programa não o faz). */
  readonly aceitarPadraoSemCasamento: boolean;
  readonly tipoDeEnfesto: TipoDeEnfesto;
  /** A largura em que os riscos são feitos (a largura útil da malha, ou a do rolo mais estreito). */
  readonly larguraDoRiscoMm: number;
  /** Decisão de quem planeja: usar rolos com defeito sem posição (o plano não tem como evitá-lo). */
  readonly aceitarDefeitosSemPosicao?: boolean;
  /** Decisão de quem planeja: compensar o encolhimento da malha no risco (as peças cortadas maiores). */
  readonly compensarEncolhimento?: boolean;
  /** Do estoque: quanto de cada rolo (pelo id) já está consumido ou reservado por outros planos (mm). */
  readonly usoAnteriorDosRolosMm?: Readonly<Record<string, number>>;
}

export type OrigemDoRisco = 'gerado' | 'mesa' | 'informado';

export interface RiscoDoPlanejamento {
  readonly chave: string;
  readonly grade: GradeDoRisco;
  readonly origem: OrigemDoRisco;
  readonly comprimentoMm: number;
  /** A largura que as peças ocupam. */
  readonly larguraMm: number;
  readonly larguraDoRiscoMm: number;
  readonly areaDasPecasMm2: number | null;
  readonly eficienciaPercentual: number | null;
  /** As peças no lugar (para o desenho); vazio no risco informado à mão. */
  readonly pecas: readonly PecaPostaNoRisco[];
  /** O casamento de listras/xadrez feito no risco, e se a conferência achou todas as peças na fase. */
  readonly casamento?: { readonly rapportComprimentoMm?: number; readonly rapportLarguraMm?: number; readonly faseComprimentoMm: number; readonly faseLarguraMm: number; readonly conferido: boolean };
  /** O risco foi aumentado para compensar o encolhimento (os fatores usados). */
  readonly compensado?: { readonly comprimento: number; readonly largura: number };
}

export interface CamadasDoRisco {
  readonly chave: string;
  readonly camadas: number;
}

export interface AjustesDoPlanejamento {
  readonly camadasPorRisco?: Readonly<Record<string, number>>;
  readonly camadasPorEnfesto?: number;
  readonly comprimentoDaMesaMm?: number;
}

export interface AlertaDoPlanejamento {
  readonly nivel: 'aviso' | 'info';
  readonly texto: string;
}

export interface RiscoNoResultado {
  readonly chave: string;
  readonly grade: GradeDoRisco;
  readonly origem: OrigemDoRisco;
  readonly comprimentoMm: number;
  readonly larguraMm: number;
  readonly eficienciaPercentual: number | null;
  readonly camadas: number;
  readonly folhas: number;
  readonly consumoPorCamadaMm: number;
  readonly consumoMm: number;
  readonly camadasPorEnfestoMax: number;
  readonly enfestos: readonly number[];
  readonly comprimentoDaMesaMm: number;
}

export interface RoloNoResultado {
  readonly id: string;
  readonly identificacao: string;
  readonly grupo: string;
  readonly comprimentoMm: number;
  readonly origemDoComprimento: 'medido' | 'pelo peso';
  readonly larguraMm: number;
  /** Os riscos em que o rolo cabe (pela largura). */
  readonly serveParaRiscos: readonly string[];
  readonly perdasMm: number;
  readonly defeitosMm: number;
  /** O que já estava consumido ou reservado por outros planos (mm). */
  readonly jaUsadoMm?: number;
  /** O que se pulou por causa dos defeitos com posição (mm). */
  readonly perdaPorDefeitoMm?: number;
  readonly emendas?: number;
  readonly camadasPorRisco: Readonly<Record<string, number>>;
  readonly usadoMm: number;
  /** O que sobra do rolo (a ponta que não dá outra camada). */
  readonly sobraMm: number;
}

export interface EmendaNoResultado {
  readonly chave: string;
  readonly roloDe: string;
  readonly roloPara: string;
  /** Onde a emenda fica, medida do começo do risco (mm). */
  readonly posicaoNoRiscoMm: number;
  readonly sobreposicaoMm: number;
}

export interface EnfestoNoResultado {
  readonly numero: number;
  readonly chave: string;
  readonly camadas: number;
  readonly folhas: number;
  /** Os lotes/tonalidades das camadas (mais de um: lotes misturados no enfesto). */
  readonly grupos: readonly string[];
  readonly alturaMm: number | null;
  readonly pesoG: number | null;
}

export interface ResultadoDoPlanejamento {
  readonly rendimentoInformadoMmPorG: number | null;
  readonly rendimentoCalculadoMmPorG: number | null;
  readonly rendimentoUsadoMmPorG: number | null;
  readonly origemDoRendimento: RendimentoPrincipal | null;
  readonly divergenciaDeRendimentoPercentual: number | null;
  readonly folhasPorCamada: 1 | 2;
  readonly riscos: readonly RiscoNoResultado[];
  readonly mesa: {
    readonly comprimentoMm: number;
    readonly comprimentoSugeridoMm: number;
    readonly larguraDoTecidoMm: number;
    readonly areaDoTecidoMm2: number;
    readonly larguraDaMesaMm: number | null;
    readonly areaDaMesaMm2: number | null;
    readonly formula: string;
  };
  readonly enfestos: readonly EnfestoNoResultado[];
  readonly camadas: number;
  readonly folhas: number;
  readonly consumoMm: number;
  readonly consumoG: number | null;
  readonly pontasMm: number;
  readonly perdaDosRolosMm: number;
  readonly defeitosMm: number;
  readonly disponivelMm: number;
  readonly disponivelG: number | null;
  readonly sobraMm: number;
  readonly sobraG: number | null;
  readonly deficitMm: number;
  readonly deficitG: number | null;
  /** Alguma medida de comprimento saiu do peso (é estimativa). */
  readonly comprimentoEstimado: boolean;
  readonly pedidoPorTamanho: Readonly<Record<string, number>>;
  readonly producaoPorTamanho: Readonly<Record<string, number>>;
  readonly excedentePorTamanho: Readonly<Record<string, number>>;
  readonly faltaPorTamanho: Readonly<Record<string, number>>;
  /** Com o material que há (quando ele não dá o plano inteiro), ou `null`. */
  readonly possivelPorTamanho: Readonly<Record<string, number>> | null;
  readonly rolos: readonly RoloNoResultado[] | null;
  /** As camadas com emenda (ausente nos planos de antes das emendas). */
  readonly emendas?: readonly EmendaNoResultado[];
  /** O que se pulou por causa dos defeitos com posição (mm). */
  readonly perdaPorDefeitosMm?: number;
  /** As sobreposições das emendas (mm). */
  readonly sobreposicoesMm?: number;
  readonly materialSuficiente: boolean;
  readonly atendeAOrdem: boolean;
  readonly eficienciaMediaPercentual: number | null;
}

export type CalculoDoPlanejamento =
  | { readonly ok: true; readonly resultado: ResultadoDoPlanejamento; readonly alertas: readonly AlertaDoPlanejamento[]; readonly premissas: readonly string[] }
  | { readonly ok: false; readonly erros: readonly string[]; readonly alertas: readonly AlertaDoPlanejamento[] };

const positivo = (v: number | undefined | null): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * A largura que a malha tem na mesa: no enfesto par, a malha aberta vai dobrada ao meio (metade da largura); a
 * tubular, achatada (a largura dela já é a do tubo achatado); nos outros, aberta.
 */
export function larguraNaMesa(larguraUtilMm: number, tipo: TipoDeEnfesto, tubular: boolean): number {
  return tipo === 'par' && !tubular ? larguraUtilMm / 2 : larguraUtilMm;
}
const um = (v: number, casas = 1): string => v.toFixed(casas).replace('.', ',');

/** Reparte `camadas` em `quantos` enfestos, o mais igual possível (os primeiros com uma a mais). */
export function repartir(camadas: number, quantos: number): number[] {
  if (quantos <= 0 || camadas <= 0) return [];
  const base = Math.floor(camadas / quantos);
  const resto = camadas % quantos;
  return Array.from({ length: quantos }, (_, i) => base + (i < resto ? 1 : 0));
}

/** O que está fora do lugar na configuração (as mensagens dizem como corrigir). */
export function validarConfiguracaoDoPlanejamento(c: ConfiguracaoDoPlanejamento): string[] {
  const erros: string[] = [];
  if (!(c.margemInicialDaMesaMm >= 0 && c.margemFinalDaMesaMm >= 0 && c.sobraPorCamadaMm >= 0 && c.perdaPorRoloMm >= 0)) {
    erros.push('As margens da mesa, a sobra por camada e a perda por rolo precisam ser de 0 para cima.');
  }
  if (!Number.isInteger(c.folhasPorEnfestoMax) || c.folhasPorEnfestoMax < 1) erros.push('O limite de folhas por enfesto precisa ser um número inteiro de 1 para cima.');
  if (c.alturaMaximaDoEnfestoMm !== undefined && !positivo(c.alturaMaximaDoEnfestoMm)) erros.push('A altura máxima do enfesto precisa ser maior que zero (ou fique em branco).');
  if (c.pesoMaximoDoEnfestoG !== undefined && !positivo(c.pesoMaximoDoEnfestoG)) erros.push('O peso máximo do enfesto precisa ser maior que zero (ou fique em branco).');
  if (!positivo(c.comprimentoMaximoDaMesaMm)) erros.push('Informe o comprimento da mesa (o máximo para um enfesto).');
  if (c.larguraDaMesaMm !== undefined && !positivo(c.larguraDaMesaMm)) erros.push('A largura da mesa precisa ser maior que zero (ou fique em branco).');
  if (!Number.isInteger(c.roupasPorRiscoMax) || c.roupasPorRiscoMax < 1 || c.roupasPorRiscoMax > 20) erros.push('O limite de roupas por risco precisa ser um número inteiro de 1 a 20.');
  if (!(c.distanciaEntrePecasMm >= 0)) erros.push('A distância entre as peças precisa ser de 0 para cima.');
  if (!(c.toleranciaDeRendimentoPercentual >= 0)) erros.push('A tolerância de rendimento precisa ser de 0 para cima.');
  if (!positivo(c.tempoDeBuscaS)) erros.push('O tempo de busca dos riscos precisa ser maior que zero.');
  if (c.sobreposicaoDaEmendaMm !== undefined && !(c.sobreposicaoDaEmendaMm >= 0)) erros.push('A sobreposição da emenda precisa ser de 0 para cima (mm).');
  return erros;
}

/**
 * O plano com os riscos e as camadas dados. `riscos` são os riscos feitos (ou o da mesa, ou o informado);
 * `camadasDosRiscos`, quantas camadas de cada um (a composição). Os ajustes de quem planeja vêm em `ajustes`.
 */
export function calcularPlanejamento(
  entrada: EntradaDoPlanejamento,
  riscos: readonly RiscoDoPlanejamento[],
  camadasDosRiscos: readonly CamadasDoRisco[],
  configuracao: ConfiguracaoDoPlanejamento = CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
  ajustes: AjustesDoPlanejamento = {},
): CalculoDoPlanejamento {
  const alertas: AlertaDoPlanejamento[] = [];
  const erros: string[] = [...validarConfiguracaoDoPlanejamento(configuracao)];
  const { malha, ordem } = entrada;
  const c = configuracao;

  // ---- O que tem de estar lá.
  if (ordem.codigo.trim() === '') erros.push('Falta o código da ordem de produção.');
  const pedidos = Object.entries(ordem.quantidadesPorTamanho).filter(([, q]) => q > 0);
  if (Object.values(ordem.quantidadesPorTamanho).some((q) => !Number.isInteger(q) || q < 0)) erros.push('As quantidades da ordem precisam ser números inteiros de 0 para cima.');
  else if (pedidos.length === 0) erros.push('A ordem não tem nenhuma peça: informe a quantidade de pelo menos um tamanho.');
  const tamanhosDoMolde = new Set(entrada.molde.pecas.flatMap((p) => p.tamanhos));
  const semMolde = pedidos.map(([t]) => t).filter((t) => !tamanhosDoMolde.has(t));
  if (semMolde.length > 0) erros.push(`A ordem pede tamanho(s) que o molde não tem: ${semMolde.join(', ')}. Confira os tamanhos da ordem (ou gradue o molde).`);
  if (!positivo(malha.larguraUtilMm)) erros.push('Falta a largura útil da malha.');
  if (!positivo(entrada.larguraDoRiscoMm)) erros.push('Falta a largura do risco.');
  if (c.larguraDaMesaMm !== undefined && positivo(malha.larguraUtilMm) && (malha.larguraNominalMm ?? malha.larguraUtilMm) > c.larguraDaMesaMm) {
    erros.push(`A malha (${escreverM(malha.larguraNominalMm ?? malha.larguraUtilMm)}) é mais larga que a mesa (${escreverM(c.larguraDaMesaMm)}).`);
  }
  if (malha.padrao !== 'liso') {
    const doDesenho = malha.padrao === 'listrado' ? 'das listras' : 'do xadrez';
    const casados = riscos.length > 0 && riscos.every((r) => r.casamento?.conferido === true);
    if (casados) {
      const c0 = riscos[0]!.casamento!;
      alertas.push({
        nivel: 'info',
        texto: `Casamento automático ${doDesenho}, conferido em todas as peças: o ponto "casamento" de cada uma cai na repetição (${[c0.rapportComprimentoMm ? `${escreverM(c0.rapportComprimentoMm, 3)} no comprimento` : '', c0.rapportLarguraMm ? `${escreverM(c0.rapportLarguraMm, 3)} na largura` : ''].filter(Boolean).join(' e ')}). As camadas precisam ser estendidas com o desenho alinhado ao começo do risco e à borda (mesa de agulhas).`,
      });
    } else {
      const texto = `A malha é ${malha.padrao}, e o risco não tem o casamento automático ${doDesenho} conferido (falta a repetição e a fase no cadastro da malha, ou a marca "casamento" nas peças, ou o risco é da mesa ou informado). O risco precisa ser conferido (ou feito) à mão antes do corte.`;
      if (entrada.aceitarPadraoSemCasamento) alertas.push({ nivel: 'aviso', texto });
      else erros.push(`${texto} Para planejar assim mesmo, marque que o casamento será feito à parte.`);
    }
  }
  if (riscos.length === 0 || camadasDosRiscos.length === 0) erros.push('Não há risco no plano: gere os riscos, use o da mesa ou informe um.');
  // A compensação de encolhimento: só com a decisão, nunca duas vezes, e os riscos têm de estar compensados (ou não) de acordo.
  let fatores: FatoresDeCompensacao | null = null;
  if (entrada.compensarEncolhimento) {
    const f = fatoresDeCompensacao(malha);
    if ('erro' in f) erros.push(f.erro);
    else fatores = f;
    if (riscos.some((r) => r.origem === 'informado')) erros.push('O risco informado à mão já é a medida do corte: a compensação de encolhimento não se aplica a ele (desmarque a compensação, ou gere os riscos).');
    else if (fatores && riscos.some((r) => !r.compensado || Math.abs(r.compensado.comprimento - fatores!.comprimento) > 1e-9 || Math.abs(r.compensado.largura - fatores!.largura) > 1e-9)) {
      erros.push('Os riscos não foram compensados com o encolhimento da malha: calcule as alternativas de novo.');
    }
  } else if (riscos.some((r) => r.compensado)) {
    erros.push('Os riscos foram compensados, e o plano não pede a compensação: calcule as alternativas de novo.');
  }
  const porChave = new Map(riscos.map((r) => [r.chave, r]));
  for (const cr of camadasDosRiscos) {
    const r = porChave.get(cr.chave);
    if (!r) erros.push('Uma das composições aponta um risco que não foi feito.');
    else if (!positivo(r.comprimentoMm)) erros.push(`Falta o comprimento do risco ${escreverGrade(r.grade)}.`);
    else if (r.larguraMm > larguraNaMesa(malha.larguraUtilMm, entrada.tipoDeEnfesto, malha.tubular) + 0.5) {
      erros.push(`O risco ${escreverGrade(r.grade)} (${escreverM(r.larguraMm)} de largura) é mais largo que a malha na mesa (${escreverM(larguraNaMesa(malha.larguraUtilMm, entrada.tipoDeEnfesto, malha.tubular))}).`);
    }
  }
  if (erros.length > 0) return { ok: false, erros, alertas };

  // ---- O rendimento: o informado, o calculado pela largura e gramatura, e o que vale.
  const informado = positivo(malha.rendimentoMmPorG) ? malha.rendimentoMmPorG : null;
  const calculado = positivo(malha.gramaturaGm2) ? rendimentoPelaGramatura(malha.larguraUtilMm, malha.gramaturaGm2) : null;
  let usado: number | null = null;
  let origem: RendimentoPrincipal | null = null;
  if (informado !== null && calculado !== null) {
    origem = entrada.rendimentoPrincipal;
    usado = origem === 'informado' ? informado : calculado;
  } else if (informado !== null) {
    origem = 'informado';
    usado = informado;
  } else if (calculado !== null) {
    origem = 'calculado';
    usado = calculado;
  }
  const divergencia = informado !== null && calculado !== null ? (Math.abs(informado - calculado) / calculado) * 100 : null;
  if (divergencia !== null && divergencia > c.toleranciaDeRendimentoPercentual) {
    alertas.push({
      nivel: 'aviso',
      texto: `O rendimento informado (${escreverRendimento(informado!)}) e o calculado pela largura e gramatura (${escreverRendimento(calculado!)}) diferem ${um(divergencia)}% — acima da tolerância de ${um(c.toleranciaDeRendimentoPercentual)}%. O plano usa o ${origem === 'informado' ? 'informado' : 'calculado'}, como escolhido. Confira a gramatura, a largura ou o rendimento.`,
    });
  }

  // ---- As camadas de cada risco e a capacidade do enfesto.
  const folhasPorCamada = espessurasFisicasPorCamada(entrada.tipoDeEnfesto);
  const espessura = malha.espessuraDaFolhaMm;
  if (c.alturaMaximaDoEnfestoMm !== undefined && !positivo(espessura)) {
    alertas.push({ nivel: 'aviso', texto: 'A altura máxima do enfesto não foi aplicada: falta a espessura da folha no cadastro da malha.' });
  }
  if (c.pesoMaximoDoEnfestoG !== undefined && usado === null) {
    alertas.push({ nivel: 'aviso', texto: 'O peso máximo do enfesto não foi aplicado: falta o rendimento (ou a gramatura) para saber o peso de uma camada.' });
  }
  const linhas: { r: RiscoDoPlanejamento; camadas: number; consumo: number; cap: number }[] = [];
  for (const cr of camadasDosRiscos) {
    const r = porChave.get(cr.chave)!;
    const camadas = ajustes.camadasPorRisco?.[cr.chave] ?? cr.camadas;
    if (!Number.isInteger(camadas) || camadas < 0) return { ok: false, erros: [`As camadas do risco ${escreverGrade(r.grade)} precisam ser um número inteiro de 0 para cima.`], alertas };
    if (camadas === 0) continue;
    const consumo = r.comprimentoMm + c.sobraPorCamadaMm;
    const limites = [Math.floor(c.folhasPorEnfestoMax / folhasPorCamada)];
    if (c.alturaMaximaDoEnfestoMm !== undefined && positivo(espessura)) limites.push(Math.floor(c.alturaMaximaDoEnfestoMm / (espessura * folhasPorCamada)));
    // Uma camada gasta um comprimento de malha (dobrada ou em tubo, as duas folhas vêm do mesmo comprimento).
    if (c.pesoMaximoDoEnfestoG !== undefined && usado !== null) limites.push(Math.floor(c.pesoMaximoDoEnfestoG / (consumo / usado)));
    const cap = Math.min(...limites);
    if (cap < 1) {
      return { ok: false, erros: [`Os limites do enfesto (folhas, altura ou peso) não comportam nem uma camada de ${folhasPorCamada} folha(s) do risco ${escreverGrade(r.grade)}.`], alertas };
    }
    if (ajustes.camadasPorEnfesto !== undefined) {
      if (!Number.isInteger(ajustes.camadasPorEnfesto) || ajustes.camadasPorEnfesto < 1) return { ok: false, erros: ['As camadas por enfesto ajustadas precisam ser um número inteiro de 1 para cima.'], alertas };
      if (ajustes.camadasPorEnfesto > cap) {
        return { ok: false, erros: [`O limite é de ${cap} camadas por enfesto no risco ${escreverGrade(r.grade)}: as ${ajustes.camadasPorEnfesto} ajustadas passam dele.`], alertas };
      }
    }
    linhas.push({ r, camadas, consumo, cap: ajustes.camadasPorEnfesto ?? cap });
  }
  if (linhas.length === 0) return { ok: false, erros: ['O plano ficou sem camadas: ajuste as camadas de pelo menos um risco.'], alertas };

  // ---- A mesa.
  const comprimentoSugeridoMm = Math.max(...linhas.map((l) => l.r.comprimentoMm)) + c.margemInicialDaMesaMm + c.margemFinalDaMesaMm;
  if (comprimentoSugeridoMm > c.comprimentoMaximoDaMesaMm + 0.5) {
    return {
      ok: false,
      erros: [`O risco mais comprido, com as margens, pede ${escreverM(comprimentoSugeridoMm)} de mesa — mais que a mesa configurada (${escreverM(c.comprimentoMaximoDaMesaMm)}).`],
      alertas,
    };
  }
  let comprimentoDaMesaMm = comprimentoSugeridoMm;
  if (ajustes.comprimentoDaMesaMm !== undefined) {
    if (!(ajustes.comprimentoDaMesaMm >= comprimentoSugeridoMm - 0.5)) {
      return { ok: false, erros: [`A mesa ajustada precisa ter pelo menos ${escreverM(comprimentoSugeridoMm)} (o risco mais comprido com as margens).`], alertas };
    }
    if (ajustes.comprimentoDaMesaMm > c.comprimentoMaximoDaMesaMm + 0.5) return { ok: false, erros: [`A mesa ajustada passa do comprimento da mesa configurado (${escreverM(c.comprimentoMaximoDaMesaMm)}).`], alertas };
    comprimentoDaMesaMm = ajustes.comprimentoDaMesaMm;
  }
  const larguraDoTecidoMm = larguraNaMesa(malha.larguraUtilMm, entrada.tipoDeEnfesto, malha.tubular);

  // ---- O material: os rolos (por lote e tonalidade, ao longo do comprimento de cada um), ou o peso.
  let disponivelMm = 0;
  let perdaDosRolosMm = 0;
  let defeitosMm = 0;
  let perdaPorDefeitosMm = 0;
  let comprimentoEstimado = false;
  // Para cada camada de cada risco, os grupos dos rolos de onde ela sai (vazio, se o material não deu).
  const gruposDasCamadas = new Map<string, string[][]>();
  let rolosNoResultado: RoloNoResultado[] | null = null;
  const emendas: EmendaNoResultado[] = [];
  const ordemDosRiscos = [...linhas].sort((a, b) => b.consumo - a.consumo);
  if (entrada.rolos && entrada.rolos.length > 0) {
    const grupos = [...new Set(entrada.rolos.map(grupoDoRolo))];
    if (grupos.length > 1 && !entrada.misturarGrupos) {
      return {
        ok: false,
        erros: [
          `Os rolos escolhidos são de ${grupos.length} lotes/tonalidades diferentes (${grupos.join('; ')}): eles não são equivalentes. Escolha rolos de um grupo só (e faça outro plano para os outros), ou marque que os lotes serão misturados neste plano.`,
        ],
        alertas,
      };
    }
    if (grupos.length > 1) alertas.push({ nivel: 'aviso', texto: `Lotes/tonalidades misturados neste plano, por decisão de quem planeja: ${grupos.join('; ')}. Os enfestos que juntam lotes estão marcados.` });
    const semPosicao = entrada.rolos.filter((r) => r.defeitos.some((d) => d.posicaoMm === undefined));
    if (semPosicao.length > 0 && !entrada.aceitarDefeitosSemPosicao) {
      return {
        ok: false,
        erros: [
          `Os rolos ${semPosicao.map((r) => r.identificacao).join(', ')} têm defeito sem a posição: o plano não tem como evitá-lo, e ele pode cair numa camada. Informe a posição do defeito (no cadastro do rolo), tire o rolo, ou marque que o defeito será tratado no enfesto (o comprimento dele sai do rolo, sem garantia de que a camada não passe por ele).`,
        ],
        alertas,
      };
    }
    const comprimentos = new Map<RoloDeEstoque, { comprimentoMm: number; origem: 'medido' | 'pelo peso' }>();
    const errosDosRolos: string[] = [];
    for (const rolo of entrada.rolos) {
      const comp = comprimentoDoRolo(rolo, usado);
      if (!comp) errosDosRolos.push(`O rolo “${rolo.identificacao}” tem só o peso, e não há rendimento (informado ou pela gramatura) para saber o comprimento.`);
      else comprimentos.set(rolo, comp);
    }
    if (errosDosRolos.length > 0) return { ok: false, erros: errosDosRolos, alertas };
    // Os rolos de cada grupo juntos (o grupo com mais malha primeiro), para os enfestos saírem de um grupo só.
    const totalDoGrupo = (g: string): number => entrada.rolos!.filter((r) => grupoDoRolo(r) === g).reduce((s, r) => s + comprimentos.get(r)!.comprimentoMm, 0);
    const rolosEmOrdem = [...entrada.rolos].sort(
      (a, b) => totalDoGrupo(grupoDoRolo(b)) - totalDoGrupo(grupoDoRolo(a)) || grupoDoRolo(a).localeCompare(grupoDoRolo(b)) || comprimentos.get(b)!.comprimentoMm - comprimentos.get(a)!.comprimentoMm,
    );
    const dados = rolosEmOrdem.map((rolo) => {
      const comp = comprimentos.get(rolo)!;
      const largura = larguraNaMesa(rolo.larguraUtilMedidaMm ?? malha.larguraUtilMm, entrada.tipoDeEnfesto, malha.tubular);
      const serve = linhas.filter((l) => largura + 0.5 >= l.r.larguraMm).map((l) => l.r.chave);
      const jaUsadoMm = Math.min(comp.comprimentoMm, Math.max(0, entrada.usoAnteriorDosRolosMm?.[rolo.id] ?? 0));
      return { rolo, comp, largura, serve, jaUsadoMm };
    });
    const inuteis = dados.filter((e) => e.serve.length === 0);
    if (inuteis.length > 0) {
      return {
        ok: false,
        erros: inuteis.map(
          (e) =>
            `O rolo “${e.rolo.identificacao}” tem ${escreverM(e.largura)} de largura na mesa, menos que o risco mais estreito do plano (${escreverM(Math.min(...linhas.map((l) => l.r.larguraMm)))}): ele não serve. Tire-o da seleção, ou faça os riscos na largura dele.`,
        ),
        alertas,
      };
    }
    const esgotados = dados.filter((e) => e.jaUsadoMm >= e.comp.comprimentoMm - 0.5);
    if (esgotados.length > 0) {
      return { ok: false, erros: esgotados.map((e) => `O rolo “${e.rolo.identificacao}” já está todo consumido ou reservado por outros planos: tire-o da seleção.`), alertas };
    }
    for (const e of dados) {
      if (e.serve.length < linhas.length) {
        alertas.push({
          nivel: 'aviso',
          texto: `O rolo “${e.rolo.identificacao}” (${escreverM(e.largura)} de largura na mesa) serve só para ${e.serve.length} dos ${linhas.length} riscos: os mais largos não saem dele.`,
        });
      }
      if (e.jaUsadoMm > 0) alertas.push({ nivel: 'info', texto: `Do rolo “${e.rolo.identificacao}”, ${escreverM(e.jaUsadoMm)} já estão consumidos ou reservados por outros planos: o plano usa o resto.` });
      if (e.comp.origem === 'pelo peso') comprimentoEstimado = true;
      disponivelMm += e.comp.comprimentoMm - e.jaUsadoMm;
      perdaDosRolosMm += Math.min(e.comp.comprimentoMm - e.jaUsadoMm, c.perdaPorRoloMm);
      defeitosMm += e.rolo.defeitos.reduce((s, d) => s + d.perdaMm, 0);
    }
    if (semPosicao.length > 0) {
      alertas.push({
        nivel: 'aviso',
        texto: `Defeitos sem posição (rolos ${semPosicao.map((r) => r.identificacao).join(', ')}): o comprimento deles sai do rolo, mas eles NÃO são evitados — confira as camadas no enfesto, por decisão de quem planeja.`,
      });
    }
    // As linhas de emenda de cada risco, na camada (as pontas da camada são metade antes e metade depois do risco).
    const linhasDe = (r: RiscoDoPlanejamento): number[] | null =>
      r.pecas.length > 0 ? linhasDeEmendaDoRisco(r.pecas, r.comprimentoMm).map((y) => y + c.sobraPorCamadaMm / 2) : null;
    const alocacao = alocarCamadas(
      dados.map((e) => ({
        id: e.rolo.id,
        identificacao: e.rolo.identificacao,
        grupo: grupoDoRolo(e.rolo),
        comprimentoMm: e.comp.comprimentoMm,
        jaUsadoMm: e.jaUsadoMm,
        perdaPorRoloMm: c.perdaPorRoloMm,
        defeitosComPosicao: e.rolo.defeitos.filter((d) => d.posicaoMm !== undefined).map((d) => [d.posicaoMm!, d.posicaoMm! + d.perdaMm] as const),
        defeitosSemPosicaoMm: e.rolo.defeitos.filter((d) => d.posicaoMm === undefined).reduce((s, d) => s + d.perdaMm, 0),
        serveParaRiscos: e.serve,
      })),
      ordemDosRiscos.map((l) => ({ chave: l.r.chave, camadas: l.camadas, consumoMm: l.consumo, linhasDeEmenda: linhasDe(l.r) })),
      { permitirEmendas: c.permitirEmendas === true, sobreposicaoDaEmendaMm: c.sobreposicaoDaEmendaMm ?? 0 },
    );
    const grupoDe = new Map(dados.map((e) => [e.rolo.id, grupoDoRolo(e.rolo)]));
    for (const l of ordemDosRiscos) {
      const camadas = alocacao.camadas.filter((x) => x.chave === l.r.chave).map((x) => [...new Set(x.trechos.map((t) => grupoDe.get(t.roloId)!))]);
      while (camadas.length < l.camadas) camadas.push([]);
      gruposDasCamadas.set(l.r.chave, camadas);
    }
    for (const camada of alocacao.camadas) {
      if (!camada.emenda) continue;
      const de = dados.find((e) => e.rolo.id === camada.emenda!.roloDe)!.rolo.identificacao;
      const para = dados.find((e) => e.rolo.id === camada.emenda!.roloPara)!.rolo.identificacao;
      emendas.push({ chave: camada.chave, roloDe: de, roloPara: para, posicaoNoRiscoMm: camada.emenda.posicaoNaCamadaMm - c.sobraPorCamadaMm / 2, sobreposicaoMm: camada.emenda.sobreposicaoMm });
    }
    rolosNoResultado = dados.map((e) => {
      const uso = alocacao.porRolo.find((u) => u.roloId === e.rolo.id)!;
      perdaPorDefeitosMm += uso.perdaPorDefeitoMm;
      return {
        id: e.rolo.id,
        identificacao: e.rolo.identificacao,
        grupo: grupoDoRolo(e.rolo),
        comprimentoMm: e.comp.comprimentoMm,
        origemDoComprimento: e.comp.origem,
        larguraMm: e.largura,
        serveParaRiscos: e.serve,
        jaUsadoMm: e.jaUsadoMm,
        perdasMm: Math.min(e.comp.comprimentoMm - e.jaUsadoMm, c.perdaPorRoloMm),
        defeitosMm: e.rolo.defeitos.reduce((s, d) => s + d.perdaMm, 0),
        perdaPorDefeitoMm: uso.perdaPorDefeitoMm,
        emendas: uso.emendas,
        camadasPorRisco: uso.camadasPorRisco,
        usadoMm: uso.usadoMm,
        sobraMm: uso.pontaMm,
      };
    });
    if (comprimentoEstimado) alertas.push({ nivel: 'info', texto: 'O comprimento de algum rolo saiu do peso (peso × rendimento): é uma estimativa, não uma medida.' });
    if (perdaPorDefeitosMm > 0) alertas.push({ nivel: 'info', texto: `Os defeitos com posição foram evitados: as camadas começam depois deles (${escreverM(perdaPorDefeitosMm)} de malha pulados).` });
    if (emendas.length > 0) {
      alertas.push({
        nivel: 'aviso',
        texto: `${emendas.length} camada(s) com emenda (rolo que acaba no meio da camada, continuado no seguinte numa linha do risco sem peça cortada, com ${escreverM(c.sobreposicaoDaEmendaMm ?? 0, 3)} de sobreposição): confira as emendas no enfesto.`,
      });
    }
  } else {
    if (!positivo(entrada.pesoDisponivelG)) return { ok: false, erros: ['Falta o material: escolha os rolos, ou informe o peso disponível da malha (kg).'], alertas };
    if (usado === null) return { ok: false, erros: ['Falta o rendimento para converter o peso em metros: informe o rendimento (m/kg) ou a gramatura (g/m²) da malha.'], alertas };
    disponivelMm = entrada.pesoDisponivelG * usado;
    comprimentoEstimado = true;
    let restante = disponivelMm;
    for (const l of ordemDosRiscos) {
      const cabem = Math.min(l.camadas, Math.floor(restante / l.consumo + 1e-9));
      restante -= cabem * l.consumo;
      gruposDasCamadas.set(l.r.chave, [...Array.from({ length: cabem }, () => ['peso']), ...Array.from({ length: l.camadas - cabem }, (): string[] => [])]);
    }
    alertas.push({ nivel: 'info', texto: `O comprimento disponível saiu do peso (${escreverKg(entrada.pesoDisponivelG)} × ${escreverRendimento(usado)}): é uma estimativa.` });
  }

  // ---- Os enfestos, a produção e o consumo.
  const enfestos: EnfestoNoResultado[] = [];
  const riscosNoResultado: RiscoNoResultado[] = [];
  const tamanhos = [...new Set([...pedidos.map(([t]) => t), ...linhas.flatMap((l) => Object.keys(l.r.grade))])];
  const producao: Record<string, number> = Object.fromEntries(tamanhos.map((t) => [t, 0]));
  const possivel: Record<string, number> = Object.fromEntries(tamanhos.map((t) => [t, 0]));
  let faltouMaterial = false;
  let numero = 1;
  for (const l of linhas) {
    const reparticao = repartir(l.camadas, Math.ceil(l.camadas / l.cap));
    const grupos = gruposDasCamadas.get(l.r.chave)!;
    let inicio = 0;
    for (const n of reparticao) {
      const dele = grupos.slice(inicio, inicio + n);
      inicio += n;
      const gruposDoEnfesto = [...new Set(dele.flat().filter((g) => g !== 'peso'))];
      enfestos.push({
        numero: numero++,
        chave: l.r.chave,
        camadas: n,
        folhas: n * folhasPorCamada,
        grupos: gruposDoEnfesto,
        alturaMm: positivo(espessura) ? n * folhasPorCamada * espessura : null,
        pesoG: usado !== null ? (n * l.consumo) / usado : null,
      });
    }
    const alocadas = grupos.filter((g) => g.length > 0).length;
    if (alocadas < l.camadas) faltouMaterial = true;
    for (const t of tamanhos) {
      producao[t] = producao[t]! + l.camadas * folhasPorCamada * (l.r.grade[t] ?? 0);
      possivel[t] = possivel[t]! + alocadas * folhasPorCamada * (l.r.grade[t] ?? 0);
    }
    riscosNoResultado.push({
      chave: l.r.chave,
      grade: l.r.grade,
      origem: l.r.origem,
      comprimentoMm: l.r.comprimentoMm,
      larguraMm: l.r.larguraMm,
      eficienciaPercentual: l.r.eficienciaPercentual,
      camadas: l.camadas,
      folhas: l.camadas * folhasPorCamada,
      consumoPorCamadaMm: l.consumo,
      consumoMm: l.camadas * l.consumo,
      camadasPorEnfestoMax: l.cap,
      enfestos: reparticao,
      comprimentoDaMesaMm: l.r.comprimentoMm + c.margemInicialDaMesaMm + c.margemFinalDaMesaMm,
    });
  }
  for (const e of enfestos) {
    if (e.grupos.length > 1) alertas.push({ nivel: 'aviso', texto: `O enfesto ${e.numero} junta camadas de lotes/tonalidades diferentes (${e.grupos.join('; ')}).` });
  }
  const pedidoPorTamanho = Object.fromEntries(tamanhos.map((t) => [t, ordem.quantidadesPorTamanho[t] ?? 0]));
  const excedentePorTamanho = Object.fromEntries(tamanhos.map((t) => [t, Math.max(0, producao[t]! - pedidoPorTamanho[t]!)]));
  const faltaPorTamanho = Object.fromEntries(tamanhos.map((t) => [t, Math.max(0, pedidoPorTamanho[t]! - producao[t]!)]));
  const sobram = tamanhos.filter((t) => excedentePorTamanho[t]! > 0);
  const faltam = tamanhos.filter((t) => faltaPorTamanho[t]! > 0);
  if (faltam.length > 0) alertas.push({ nivel: 'aviso', texto: `Com as camadas do plano, a ordem não fecha: faltam ${faltam.map((t) => `${faltaPorTamanho[t]} do ${t}`).join(', ')}.` });
  if (sobram.length > 0) alertas.push({ nivel: 'info', texto: `O plano produz a mais: ${sobram.map((t) => `${excedentePorTamanho[t]} do ${t}`).join(', ')}. A ordem não foi mudada.` });
  const naoPedidos = tamanhos.filter((t) => (ordem.quantidadesPorTamanho[t] ?? 0) === 0 && producao[t]! > 0);
  if (naoPedidos.length > 0) alertas.push({ nivel: 'info', texto: `Saem peças de tamanho que a ordem não pede: ${naoPedidos.join(', ')}.` });

  const consumoMm = linhas.reduce((s, l) => s + l.camadas * l.consumo, 0);
  const pontasMm = linhas.reduce((s, l) => s + l.camadas * c.sobraPorCamadaMm, 0);
  const sobreposicoesMm = emendas.reduce((s, e) => s + e.sobreposicaoMm, 0);
  const necessarioMm = consumoMm + sobreposicoesMm + perdaDosRolosMm + (rolosNoResultado ? perdaPorDefeitosMm + defeitosSemPosicaoTotal(entrada) : defeitosMm);
  const deficitMm = faltouMaterial ? linhas.reduce((s, l) => s + (l.camadas - gruposDasCamadas.get(l.r.chave)!.filter((g) => g.length > 0).length) * l.consumo, 0) : 0;
  const sobraMm = Math.max(0, disponivelMm - necessarioMm);
  if (faltouMaterial) {
    alertas.push({
      nivel: 'aviso',
      texto:
        `O material não dá o plano inteiro: faltam ${escreverM(deficitMm)}${usado !== null ? ` (${escreverKg(deficitMm / usado)})` : ''} de camadas. ` +
        `Com o que há: ${tamanhos.map((t) => `${possivel[t]} do ${t}`).join(', ')}. A ordem não foi mudada.`,
    });
  }

  // ---- O que a malha pede do enfesto.
  if (malha.tubular !== (entrada.tipoDeEnfesto === 'tubular')) {
    alertas.push({
      nivel: 'aviso',
      texto: malha.tubular
        ? `A malha é tubular, e o enfesto é ${ROTULO_DO_TIPO[entrada.tipoDeEnfesto].toLowerCase()}: confira o tipo do enfesto (no tubular, cada camada tem duas folhas).`
        : 'O enfesto é tubular, e a malha está cadastrada como aberta: confira.',
    });
  }
  if (malha.sentidoUnico && entrada.tipoDeEnfesto === 'zigue-zague') alertas.push({ nivel: 'aviso', texto: 'A malha tem sentido (pelo ou estampa), e o enfesto zigue-zague vira o tecido a cada camada.' });
  const encolhimentos = [
    [malha.encolhimentoComprimentoPercentual, 'no comprimento'],
    [malha.encolhimentoLarguraPercentual, 'na largura'],
  ].filter(([v]) => typeof v === 'number' && v > 0) as [number, string][];
  if (fatores) {
    alertas.push({
      nivel: 'info',
      texto: `Encolhimento compensado no risco, por decisão de quem planeja${malha.fonteDoEncolhimento ? ` (valor: ${ROTULO_DA_FONTE_DO_ENCOLHIMENTO[malha.fonteDoEncolhimento].toLowerCase()})` : ''}: comprimento × ${fatores.comprimento.toFixed(4).replace('.', ',')} (${um(fatores.encolhimentoComprimentoPercentual)}%), largura × ${fatores.largura.toFixed(4).replace('.', ',')} (${um(fatores.encolhimentoLarguraPercentual)}%). As peças são cortadas maiores para ficarem na medida depois de encolher.`,
    });
  } else if (encolhimentos.length > 0) {
    const texto = encolhimentos.map(([v, onde]) => `${um(v)}% ${onde}`).join(' e ');
    alertas.push(
      malha.encolhimentoCompensadoNoMolde
        ? { nivel: 'info', texto: `Encolhimento da malha: ${texto} — já compensado no molde (cadastro da malha). O plano não aplica nada a mais.` }
        : { nivel: 'aviso', texto: `Encolhimento da malha: ${texto} — NÃO compensado no molde, e o plano não o aplica (a compensação no risco não foi pedida). As peças cortadas vão encolher.` },
    );
  }
  if (ajustes.comprimentoDaMesaMm !== undefined && comprimentoDaMesaMm > comprimentoSugeridoMm + 0.5) {
    alertas.push({ nivel: 'info', texto: `A mesa ajustada (${escreverM(comprimentoDaMesaMm)}) é maior que a sugerida (${escreverM(comprimentoSugeridoMm)}).` });
  }

  const areas = linhas.filter((l) => l.r.areaDasPecasMm2 !== null);
  const eficienciaMediaPercentual =
    areas.length === linhas.length
      ? (linhas.reduce((s, l) => s + l.camadas * l.r.areaDasPecasMm2!, 0) / linhas.reduce((s, l) => s + l.camadas * l.r.comprimentoMm * l.r.larguraDoRiscoMm, 0)) * 100
      : null;

  const premissas = [
    DEFINICOES.folha,
    DEFINICOES.camada,
    DEFINICOES.enfesto,
    ...(entrada.tipoDeEnfesto === 'par' && !malha.tubular
      ? [`No enfesto par, a malha aberta vai dobrada ao meio na largura: na mesa ela tem ${escreverM(larguraDoTecidoMm)} (metade de ${escreverM(malha.larguraUtilMm)}).`]
      : []),
    `Cada camada gasta o comprimento do risco mais ${escreverM(c.sobraPorCamadaMm, 3)} de pontas (configuração).`,
    `A mesa é o risco mais comprido mais ${escreverM(c.margemInicialDaMesaMm, 3)} no começo e ${escreverM(c.margemFinalDaMesaMm, 3)} no fim (configuração), até ${escreverM(c.comprimentoMaximoDaMesaMm)}.`,
    `Até ${c.folhasPorEnfestoMax} folhas por enfesto${c.alturaMaximaDoEnfestoMm !== undefined ? `, ${escreverM(c.alturaMaximaDoEnfestoMm, 3)} de altura` : ''}${c.pesoMaximoDoEnfestoG !== undefined ? `, ${escreverKg(c.pesoMaximoDoEnfestoG)} de peso` : ''} (configuração); as camadas de cada risco são repartidas por igual entre os enfestos dele.`,
    'O consumo é de malha: as camadas, cada uma com as pontas. As perdas dos rolos e os defeitos são contados à parte.',
    entrada.rolos && entrada.rolos.length > 0
      ? `Cada rolo dá só camadas inteiras: o fim de um rolo não se emenda no próximo (sem emendas). Cada rolo perde ${escreverM(c.perdaPorRoloMm, 3)} (configuração) e o comprimento dos defeitos informados.`
      : 'O material é um peso só (sem rolos): as perdas de rolo e os defeitos não entram.',
    'O comprimento que sai do peso é peso × rendimento — uma estimativa; o medido vale quando há.',
    fatores
      ? `O encolhimento foi compensado no risco (comprimento × ${fatores.comprimento.toFixed(4).replace('.', ',')}, largura × ${fatores.largura.toFixed(4).replace('.', ',')}): o risco foi feito na largura da malha ÷ ${fatores.largura.toFixed(4).replace('.', ',')} e aumentado, para caber nela.`
      : 'O encolhimento só é compensado no risco por decisão de quem planeja, e nunca quando o molde já está compensado (cadastro da malha).',
    'A ordem de produção nunca é mudada: falta e excedente são mostrados.',
  ];

  return {
    ok: true,
    alertas,
    premissas,
    resultado: {
      rendimentoInformadoMmPorG: informado,
      rendimentoCalculadoMmPorG: calculado,
      rendimentoUsadoMmPorG: usado,
      origemDoRendimento: origem,
      divergenciaDeRendimentoPercentual: divergencia,
      folhasPorCamada,
      riscos: riscosNoResultado,
      mesa: {
        comprimentoMm: comprimentoDaMesaMm,
        comprimentoSugeridoMm,
        larguraDoTecidoMm,
        areaDoTecidoMm2: comprimentoDaMesaMm * larguraDoTecidoMm,
        larguraDaMesaMm: c.larguraDaMesaMm ?? null,
        areaDaMesaMm2: c.larguraDaMesaMm !== undefined ? comprimentoDaMesaMm * c.larguraDaMesaMm : null,
        formula: `${escreverM(comprimentoSugeridoMm - c.margemInicialDaMesaMm - c.margemFinalDaMesaMm)} (risco mais comprido) + ${escreverM(c.margemInicialDaMesaMm, 3)} + ${escreverM(c.margemFinalDaMesaMm, 3)} (margens) = ${escreverM(comprimentoSugeridoMm)}; área do tecido na mesa = ${escreverM(comprimentoDaMesaMm)} × ${escreverM(larguraDoTecidoMm)} (largura da malha na mesa) = ${escreverM2(comprimentoDaMesaMm * larguraDoTecidoMm)}`,
      },
      enfestos,
      camadas: linhas.reduce((s, l) => s + l.camadas, 0),
      folhas: linhas.reduce((s, l) => s + l.camadas, 0) * folhasPorCamada,
      consumoMm,
      consumoG: usado !== null ? consumoMm / usado : null,
      pontasMm,
      perdaDosRolosMm,
      defeitosMm,
      disponivelMm,
      disponivelG: usado !== null ? disponivelMm / usado : null,
      sobraMm,
      sobraG: usado !== null ? sobraMm / usado : null,
      deficitMm,
      deficitG: usado !== null ? deficitMm / usado : null,
      comprimentoEstimado,
      pedidoPorTamanho,
      producaoPorTamanho: producao,
      excedentePorTamanho,
      faltaPorTamanho,
      possivelPorTamanho: faltouMaterial ? possivel : null,
      rolos: rolosNoResultado,
      emendas,
      perdaPorDefeitosMm,
      sobreposicoesMm,
      materialSuficiente: !faltouMaterial,
      atendeAOrdem: faltam.length === 0 && !faltouMaterial,
      eficienciaMediaPercentual,
    },
  };
}

/** As camadas de um risco só (o da mesa, o informado) para fechar a ordem. */
export function camadasDeUmRisco(risco: RiscoDoPlanejamento, entrada: EntradaDoPlanejamento): CamadasDoRisco[] {
  return [{ chave: risco.chave, camadas: camadasParaFechar(risco.grade, entrada.ordem.quantidadesPorTamanho, espessurasFisicasPorCamada(entrada.tipoDeEnfesto)) }];
}

// ---- As alternativas

export type Criterio = 'menor-consumo' | 'menos-enfestos' | 'equilibrada';

export const CRITERIOS: Readonly<Record<Criterio, { readonly rotulo: string; readonly explicacao: string }>> = {
  'menor-consumo': {
    rotulo: 'Menor consumo estimado',
    explicacao: 'a composição com o menor consumo total de malha (as camadas com as pontas) entre as avaliadas; no empate, a com menos enfestos.',
  },
  'menos-enfestos': {
    rotulo: 'Menos enfestos',
    explicacao: 'a composição com menos enfestos (menos vezes estender e cortar) entre as avaliadas; no empate, a de menor consumo.',
  },
  equilibrada: {
    rotulo: 'Equilibrada',
    explicacao:
      'a composição com a menor soma de consumo ÷ menor consumo e enfestos ÷ menos enfestos (pesos iguais) entre as avaliadas; no empate, a de menor consumo.',
  },
};

export interface Avaliada {
  readonly consumoMm: number;
  readonly enfestos: number;
}

/** Os índices das escolhidas por critério, entre as avaliadas (só as que calcularam). */
export function escolherAlternativas(avaliadas: readonly Avaliada[]): Readonly<Record<Criterio, number>> | null {
  if (avaliadas.length === 0) return null;
  const indices = avaliadas.map((_, i) => i);
  const menorConsumo = Math.min(...avaliadas.map((a) => a.consumoMm));
  const menosEnfestos = Math.min(...avaliadas.map((a) => a.enfestos));
  const melhor = (comparar: (a: Avaliada, b: Avaliada) => number): number => indices.reduce((m, i) => (comparar(avaliadas[i]!, avaliadas[m]!) < 0 ? i : m), 0);
  const nota = (a: Avaliada): number => a.consumoMm / menorConsumo + a.enfestos / menosEnfestos;
  return {
    'menor-consumo': melhor((a, b) => a.consumoMm - b.consumoMm || a.enfestos - b.enfestos),
    'menos-enfestos': melhor((a, b) => a.enfestos - b.enfestos || a.consumoMm - b.consumoMm),
    equilibrada: melhor((a, b) => nota(a) - nota(b) || a.consumoMm - b.consumoMm),
  };
}

/** O comprimento dos defeitos sem posição dos rolos do plano (mm). */
function defeitosSemPosicaoTotal(entrada: EntradaDoPlanejamento): number {
  return (entrada.rolos ?? []).reduce((s, r) => s + r.defeitos.filter((d) => d.posicaoMm === undefined).reduce((t, d) => t + d.perdaMm, 0), 0);
}
