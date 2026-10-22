import { area } from '../core/geometria';
import { tipoDeTecidoDaMalha } from './cadastroDeProducao';
import { ROTULO_DO_TIPO, type TipoDeEnfesto } from './enfesto';
import { linhaDeCorteDaPeca } from './molde';
import type { ModeloDoPlano } from './modeloDoPlano';
import { escreverM, escreverM2, escreverRendimento, mm2ParaM2, mmParaM } from './planoDeCorte';
import type { EntradaDoPlanejamento, ResultadoDoPlanejamento, RiscoDoPlanejamento } from './planoDeEnfesto';
import { ROTULO_DA_UNIDADE_DO_CUSTO, type CustoDoTecido, type Moeda, type TipoDeTecido } from './tecido';

/**
 * A estimativa do custo do tecido de um plano de corte: a área de cada peça e de cada roupa (por tamanho), o custo
 * direto das peças, a área e o custo do que não é aproveitado, o custo total do enfesto e o custo por unidade, com o
 * critério do rateio. Só o tecido, e só uma estimativa: nada aqui muda o plano.
 *
 * Áreas: as reais dos contornos (a linha de corte, com a costura), na forma de cada tamanho — nunca o retângulo em
 * volta da peça. Unidades internas: mm, mm², R$; o m² e o m só na conta do custo e na tela.
 *
 * O custo é o informado por metro linear (o metro da malha como é comprada: do tubo, na tubular) ou por quilo (passado
 * a metro pelo rendimento do plano). O metro vira m² pela área de malha que um metro dá — a largura na mesa vezes as
 * folhas por camada, a mesma conta que o plano usa para a produção. O tipo de tecido (ramado ou tubular) tem de
 * conferir com o enfesto; quando não confere, ou falta um dado, o custo não sai, e a estimativa diz o que falta.
 */

export const VERSAO_DA_ESTIMATIVA_DE_CUSTO = 1;

/** Abaixo desta parte da área de malha, a área das peças passar a da malha é arredondamento do contorno, não um erro. */
const TOLERANCIA_DA_AREA = 0.005;

export interface PecaNaRoupa {
  readonly pecaId: string;
  readonly nome: string;
  /** A área de uma peça: a linha de corte (com a costura), na forma deste tamanho (mm²). */
  readonly areaMm2: number;
  readonly quantidadePorRoupa: number;
  readonly emPar: boolean;
}

export interface RoupaDoTamanho {
  readonly tamanho: string;
  readonly pecas: readonly PecaNaRoupa[];
  /** A área de uma roupa: a de cada peça vezes a quantidade dela na roupa (mm²). */
  readonly areaMm2: number;
}

/**
 * As peças de uma roupa em cada tamanho do modelo: a área real de cada uma, na forma daquele tamanho, e quantas vão
 * numa roupa (o par conta as duas). A peça com 0 por roupa não entra. Os tamanhos não se misturam.
 */
export function roupasPorTamanho(modelo: ModeloDoPlano, quantidades: Readonly<Record<string, number>>): RoupaDoTamanho[] {
  return modelo.tamanhos.map((tamanho) => {
    const pecas: PecaNaRoupa[] = [];
    for (const p of modelo.pecasPorTamanho[tamanho] ?? []) {
      const quantidadePorRoupa = quantidades[p.pecaId] ?? 0;
      if (!(quantidadePorRoupa > 0)) continue;
      const doModelo = modelo.pecas.find((x) => x.id === p.pecaId);
      pecas.push({ pecaId: p.pecaId, nome: doModelo?.nome ?? p.molde.nome, areaMm2: area(linhaDeCorteDaPeca(p.molde)), quantidadePorRoupa, emPar: doModelo?.emPar ?? false });
    }
    return { tamanho, pecas, areaMm2: pecas.reduce((s, p) => s + p.areaMm2 * p.quantidadePorRoupa, 0) };
  });
}

export interface CustoDoTamanho {
  readonly tamanho: string;
  readonly pecas: readonly PecaNaRoupa[];
  /** A área de uma roupa como é cortada (mm²): a das peças, vezes o fator da compensação do encolhimento. */
  readonly areaPorUnidadeMm2: number;
  readonly unidadesProduzidas: number;
  /** A área da roupa × o custo por m² (R$). */
  readonly custoDiretoPorUnidade: number | null;
  /** O custo direto mais a parte da área não aproveitada, na proporção da área (R$). */
  readonly custoPorUnidadeComPerda: number | null;
}

export interface ParteNaoAproveitada {
  readonly rotulo: string;
  readonly areaMm2: number;
  readonly custo: number | null;
}

export interface PerdaForaDoEnfesto {
  readonly rotulo: string;
  readonly comprimentoMm: number;
  readonly custo: number | null;
}

export interface EstimativaDeCustoDoTecido {
  readonly versao: typeof VERSAO_DA_ESTIMATIVA_DE_CUSTO;
  readonly moeda: Moeda;
  readonly custoInformado: CustoDoTecido | null;
  readonly tipoDeTecido: TipoDeTecido | null;
  readonly tipoDeEnfesto: TipoDeEnfesto;
  /** O rendimento que passou o custo por quilo a metro (só no custo por quilo). */
  readonly rendimentoMmPorG: number | null;
  readonly origemDoRendimento: 'informado' | 'calculado' | null;
  readonly larguraUtilMm: number;
  readonly larguraNaMesaMm: number;
  readonly folhasPorCamada: 1 | 2;
  /** A área de malha que um metro de comprimento dá, em mm² por mm (a largura na mesa × as folhas por camada). */
  readonly larguraDeMalhaPorMetroMm: number | null;
  /** O comprimento de malha do enfesto: o consumo das camadas, com as pontas (mm). */
  readonly comprimentoMm: number;
  /** O fator da compensação do encolhimento nas áreas das peças (1: sem compensação). */
  readonly fatorDeArea: number;
  readonly porTamanho: readonly CustoDoTamanho[];
  readonly unidadesProduzidas: number;
  /** A área de todas as peças cortadas no plano (mm²); `null` sem a geometria de algum tamanho. */
  readonly areaDasPecasMm2: number | null;
  readonly areaTotalMm2: number | null;
  readonly naoAproveitada: { readonly totalMm2: number; readonly partes: readonly ParteNaoAproveitada[] } | null;
  readonly custoPorMetroLinear: number | null;
  readonly custoPorM2: number | null;
  readonly custoTotal: number | null;
  readonly custoDiretoTotal: number | null;
  readonly custoNaoAproveitado: number | null;
  readonly custoMedioPorUnidade: number | null;
  /** O que o plano gasta fora das camadas: mostrado à parte, nunca somado ao custo do enfesto. */
  readonly foraDoEnfesto: readonly PerdaForaDoEnfesto[];
  /** Por que alguma parte do custo não saiu, e como resolver (vazio: saiu tudo). */
  readonly faltas: readonly string[];
  readonly avisos: readonly string[];
  readonly premissas: readonly string[];
}

/** Reais com os centavos, como se escreve aqui: "R$ 1.234,56". */
export function escreverReais(valor: number): string {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  return `${valor < 0 ? '−' : ''}R$ ${inteiro!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

const positivo = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function estimarCustoDoTecido(dados: {
  readonly entrada: EntradaDoPlanejamento;
  readonly resultado: ResultadoDoPlanejamento;
  readonly riscos: readonly RiscoDoPlanejamento[];
  readonly roupas: readonly RoupaDoTamanho[];
}): EstimativaDeCustoDoTecido {
  const { entrada, resultado: r, riscos, roupas } = dados;
  const malha = entrada.malha;
  const custoInformado = malha.custo ?? null;
  const tipoDeTecido = tipoDeTecidoDaMalha(malha);
  const tipoDeEnfesto = entrada.tipoDeEnfesto;
  const faltas: string[] = [];
  const avisos: string[] = [];
  const premissas: string[] = [
    'Estimativa só do tecido: aviamentos, mão de obra, frete e os outros custos não entram. Não é o custo definitivo de produção.',
    'A área de cada peça é a área real do contorno (a linha de corte, com a costura), na forma de cada tamanho, em m² — não o retângulo em volta dela. Uma roupa tem as peças com a quantidade por roupa do plano (um par conta as duas peças), e os tamanhos não se misturam.',
    'O consumo é o planejado (o comprimento dos riscos mais as pontas, camada a camada), não um consumo medido: o programa não registra consumo medido por peça.',
  ];

  // As peças saem maiores quando o encolhimento é compensado no risco (o plano só aceita os riscos compensados juntos).
  const compensado = entrada.compensarEncolhimento === true && riscos.length > 0 && riscos.every((x) => x.compensado) ? riscos[0]!.compensado! : null;
  const fatorDeArea = compensado ? compensado.comprimento * compensado.largura : 1;
  if (compensado) {
    premissas.push(`Encolhimento compensado no risco: as peças saem cortadas maiores, e a área delas é a do molde × ${fatorDeArea.toFixed(4).replace('.', ',')} (comprimento × largura).`);
  }

  // ---- As roupas que o plano produz, por tamanho.
  const producao = r.producaoPorTamanho;
  const tamanhos = [...roupas.map((x) => x.tamanho), ...Object.keys(producao).filter((t) => (producao[t] ?? 0) > 0 && !roupas.some((x) => x.tamanho === t))];
  const semGeometria: string[] = [];
  const base = tamanhos.map((tamanho) => {
    const roupa = roupas.find((x) => x.tamanho === tamanho);
    const unidadesProduzidas = producao[tamanho] ?? 0;
    const areaPorUnidadeMm2 = (roupa?.areaMm2 ?? 0) * fatorDeArea;
    if (unidadesProduzidas > 0 && !positivo(areaPorUnidadeMm2)) semGeometria.push(tamanho);
    return { tamanho, pecas: roupa?.pecas ?? [], areaPorUnidadeMm2, unidadesProduzidas };
  });
  if (semGeometria.length > 0) faltas.push(`Falta a geometria das peças do(s) tamanho(s) ${semGeometria.join(', ')}: sem a área delas, a área das peças cortadas e o custo por unidade não saem.`);
  const unidadesProduzidas = base.reduce((s, t) => s + t.unidadesProduzidas, 0);
  if (unidadesProduzidas === 0) faltas.push('O plano não produz nenhuma roupa: não há por quantas unidades dividir o custo.');
  const geometriaCompleta = semGeometria.length === 0 && unidadesProduzidas > 0;
  const areaDasPecasMm2 = geometriaCompleta ? base.reduce((s, t) => s + t.unidadesProduzidas * t.areaPorUnidadeMm2, 0) : null;
  const excedente = Object.values(r.excedentePorTamanho).reduce((s, n) => s + n, 0);
  if (excedente > 0) premissas.push(`As unidades produzidas incluem as ${excedente} que passam da ordem: elas também dividem o custo.`);

  // ---- A área de malha que um metro de comprimento dá: o tipo de tecido tem de conferir com o enfesto.
  const larguraNaMesaMm = r.mesa.larguraDoTecidoMm;
  const folhasPorCamada = r.folhasPorCamada;
  const rotuloDoEnfesto = ROTULO_DO_TIPO[tipoDeEnfesto].toLowerCase();
  let larguraDeMalhaPorMetroMm: number | null = null;
  if (!positivo(malha.larguraUtilMm) || !positivo(larguraNaMesaMm)) {
    faltas.push('Falta a largura útil da malha.');
  } else if (tipoDeTecido === 'tubular' && tipoDeEnfesto !== 'tubular') {
    faltas.push(`O tecido é tubular, e o enfesto é ${rotuloDoEnfesto}: a área de um metro de malha não é certa. Use o enfesto tubular, ou confira o tipo do tecido.`);
  } else if (tipoDeTecido !== 'tubular' && tipoDeEnfesto === 'tubular') {
    faltas.push(
      tipoDeTecido === 'ramado'
        ? 'O tecido é ramado (aberto), e o enfesto é tubular: a área de um metro de malha não é certa. Confira o tipo do tecido ou o do enfesto.'
        : 'O tipo de tecido não foi informado, e o enfesto é tubular: informe se a malha é tubular ou ramada — a área de um metro de malha depende disso.',
    );
  } else {
    larguraDeMalhaPorMetroMm = larguraNaMesaMm * folhasPorCamada;
    const porMetro = `${escreverM2(larguraDeMalhaPorMetroMm * 1000)} por metro`;
    if (tipoDeTecido === 'tubular') {
      premissas.push(
        `Malha tubular no enfesto tubular: um metro de tubo tem 2 folhas de ${escreverM(larguraNaMesaMm)} (o tubo achatado, a largura útil cadastrada) — a mesma conta do plano, que tira 2 folhas por camada: ${porMetro}. A largura da malha aberta (ramada) não é presumida.`,
      );
    } else if (folhasPorCamada === 2) {
      premissas.push(`No enfesto par, a malha aberta vai dobrada ao meio: 2 folhas de ${escreverM(larguraNaMesaMm)}, a largura útil inteira (${escreverM(malha.larguraUtilMm)}): ${porMetro}.`);
    } else {
      premissas.push(`Malha aberta: um metro tem a largura útil de ${escreverM(malha.larguraUtilMm)}: ${porMetro}.`);
    }
    if (tipoDeTecido === null) premissas.push('Tipo de tecido não informado: a largura útil é tratada como a da malha aberta, como no resto do plano.');
  }

  // ---- O comprimento de malha do enfesto.
  const comprimentoMm = r.consumoMm;
  if (!positivo(comprimentoMm)) faltas.push('Falta o comprimento de malha do plano (o consumo das camadas).');

  // ---- O custo de um metro: o informado, ou o do quilo pelo rendimento.
  let custoPorMetroLinear: number | null = null;
  let rendimentoMmPorG: number | null = null;
  let origemDoRendimento: 'informado' | 'calculado' | null = null;
  if (!custoInformado) {
    faltas.push('O custo do tecido não foi informado: informe-o na malha (etapa Malha) ou no tecido do projeto (aba Encaixe > Tecido). Sem ele, o plano é o mesmo; só a estimativa de custo não sai.');
  } else if (custoInformado.unidade === 'metro-linear') {
    custoPorMetroLinear = custoInformado.valor;
    premissas.push(`Custo informado ${ROTULO_DA_UNIDADE_DO_CUSTO['metro-linear']}: ${escreverReais(custoInformado.valor)} por metro de malha como é comprada${tipoDeTecido === 'tubular' ? ' (metro de tubo)' : ''}.`);
  } else {
    rendimentoMmPorG = r.rendimentoUsadoMmPorG;
    origemDoRendimento = r.origemDoRendimento;
    if (!positivo(rendimentoMmPorG)) {
      faltas.push('O custo é por quilo, e falta o rendimento (m/kg) da malha para passar quilos a metros: informe o rendimento (ou a gramatura) da malha.');
    } else if (origemDoRendimento === 'calculado' && tipoDeTecido === 'tubular') {
      faltas.push('O custo é por quilo, a malha é tubular e o rendimento saiu da gramatura: essa conta usa uma folha só da largura, e o tubo tem duas. Informe o rendimento medido (m/kg) da malha.');
    } else {
      // m/kg e mm/g são o mesmo número: R$/kg ÷ m/kg = R$/m.
      custoPorMetroLinear = custoInformado.valor / rendimentoMmPorG;
      premissas.push(
        `Custo informado ${ROTULO_DA_UNIDADE_DO_CUSTO.kg}: ${escreverReais(custoInformado.valor)} ÷ ${escreverRendimento(rendimentoMmPorG)} (rendimento ${origemDoRendimento === 'informado' ? 'informado' : 'calculado pela largura e gramatura'}, o mesmo do plano) = ${escreverReais(custoPorMetroLinear)} por metro.`,
      );
    }
  }

  // ---- O custo por m², as áreas e os custos.
  const custoPorM2 = custoPorMetroLinear !== null && larguraDeMalhaPorMetroMm !== null ? custoPorMetroLinear / mmParaM(larguraDeMalhaPorMetroMm) : null;
  const areaTotalMm2 = larguraDeMalhaPorMetroMm !== null && positivo(comprimentoMm) ? comprimentoMm * larguraDeMalhaPorMetroMm : null;
  const emReais = (areaMm2: number): number | null => (custoPorM2 !== null ? mm2ParaM2(areaMm2) * custoPorM2 : null);
  if (custoPorM2 !== null && larguraDeMalhaPorMetroMm !== null) {
    premissas.push(
      `Custo por m² = ${escreverReais(custoPorMetroLinear!)} por metro ÷ ${escreverM2(larguraDeMalhaPorMetroMm * 1000)} de malha por metro = ${escreverReais(custoPorM2)} por m². Custo total do enfesto = ${escreverM(comprimentoMm)} de malha × ${escreverReais(custoPorMetroLinear!)} por metro (a área de malha × o custo por m²).`,
    );
  }

  let naoAproveitada: EstimativaDeCustoDoTecido['naoAproveitada'] = null;
  if (areaTotalMm2 !== null && areaDasPecasMm2 !== null) {
    const tolerancia = TOLERANCIA_DA_AREA * areaTotalMm2;
    const pontasMm2 = Math.min(r.pontasMm, comprimentoMm) * larguraDeMalhaPorMetroMm!;
    const faixaMm2 = (comprimentoMm - Math.min(r.pontasMm, comprimentoMm)) * Math.max(0, larguraNaMesaMm - entrada.larguraDoRiscoMm) * folhasPorCamada;
    const espacosMm2 = areaTotalMm2 - areaDasPecasMm2 - pontasMm2 - faixaMm2;
    if (espacosMm2 < -tolerancia) {
      avisos.push(
        `A área das peças cortadas (${escreverM2(areaDasPecasMm2)}) passa a área de malha dos riscos (${escreverM2(areaTotalMm2 - pontasMm2 - faixaMm2)}): confira o risco (um risco informado à mão mais curto ou mais estreito que as peças?). A área não aproveitada e o custo por unidade com a perda não foram calculados.`,
      );
    } else {
      const partes: ParteNaoAproveitada[] = [
        { rotulo: 'Pontas das camadas (o que passa do risco no começo e no fim)', areaMm2: pontasMm2, custo: emReais(pontasMm2) },
        ...(faixaMm2 > 0 ? [{ rotulo: 'Faixa da largura da malha fora do risco', areaMm2: faixaMm2, custo: emReais(faixaMm2) }] : []),
        { rotulo: 'Espaços entre as peças, dentro do risco', areaMm2: Math.max(0, espacosMm2), custo: emReais(Math.max(0, espacosMm2)) },
      ];
      naoAproveitada = { totalMm2: partes.reduce((s, p) => s + p.areaMm2, 0), partes };
      premissas.push(
        'Área não aproveitada = área de malha do enfesto − área das peças cortadas: as pontas das camadas, a faixa da largura fora do risco e os espaços entre as peças. É uma estimativa do que não vira peça — não é sobra reaproveitável.',
      );
    }
  }

  const custoTotal = areaTotalMm2 !== null ? emReais(areaTotalMm2) : null;
  const custoDiretoTotal = areaDasPecasMm2 !== null ? emReais(areaDasPecasMm2) : null;
  const custoNaoAproveitado = naoAproveitada ? emReais(naoAproveitada.totalMm2) : null;
  const custoMedioPorUnidade = custoTotal !== null && unidadesProduzidas > 0 ? custoTotal / unidadesProduzidas : null;
  // Por tamanho: a perda vai para as roupas na proporção da área delas; somadas, as roupas dão o custo total.
  const fatorDaPerda = naoAproveitada && custoTotal !== null && positivo(custoDiretoTotal) ? custoTotal / custoDiretoTotal : null;
  const porTamanho: CustoDoTamanho[] = base.map((t) => {
    const custoDiretoPorUnidade = positivo(t.areaPorUnidadeMm2) ? emReais(t.areaPorUnidadeMm2) : null;
    return { ...t, custoDiretoPorUnidade, custoPorUnidadeComPerda: custoDiretoPorUnidade !== null && fatorDaPerda !== null ? custoDiretoPorUnidade * fatorDaPerda : null };
  });
  if (custoTotal !== null) {
    premissas.push(
      'Rateio: o custo médio por unidade é o custo total do enfesto ÷ as unidades produzidas (o mesmo para todos os tamanhos). Por tamanho, é o custo direto da roupa mais a parte da área não aproveitada, na proporção da área das peças dela. Os dois critérios somam o custo total: a perda não é contada duas vezes.',
    );
  }

  // ---- O que o plano gasta fora das camadas: à parte.
  const foraDoEnfesto: PerdaForaDoEnfesto[] = (
    [
      ['Perda dos rolos (começo e fim de cada rolo, da configuração)', r.perdaDosRolosMm],
      ['Trechos pulados por defeitos com posição', r.perdaPorDefeitosMm ?? 0],
      ['Sobreposição das emendas', r.sobreposicoesMm ?? 0],
    ] as const
  )
    .filter(([, comprimento]) => comprimento > 0)
    .map(([rotulo, comprimento]) => ({ rotulo, comprimentoMm: comprimento, custo: custoPorMetroLinear !== null ? mmParaM(comprimento) * custoPorMetroLinear : null }));
  premissas.push('As perdas dos rolos, os trechos pulados por defeitos e as sobreposições das emendas ficam fora do custo do enfesto (mostradas à parte, sem somar). A sobra dos rolos volta para o estoque: não é custo deste plano.');
  if (!r.materialSuficiente) avisos.push('O material não dá o plano inteiro: a estimativa é do plano como foi planejado (todas as camadas).');

  return {
    versao: VERSAO_DA_ESTIMATIVA_DE_CUSTO,
    moeda: 'BRL',
    custoInformado,
    tipoDeTecido,
    tipoDeEnfesto,
    rendimentoMmPorG,
    origemDoRendimento,
    larguraUtilMm: malha.larguraUtilMm,
    larguraNaMesaMm,
    folhasPorCamada,
    larguraDeMalhaPorMetroMm,
    comprimentoMm,
    fatorDeArea,
    porTamanho,
    unidadesProduzidas,
    areaDasPecasMm2,
    areaTotalMm2,
    naoAproveitada,
    custoPorMetroLinear,
    custoPorM2,
    custoTotal,
    custoDiretoTotal,
    custoNaoAproveitado,
    custoMedioPorUnidade,
    foraDoEnfesto,
    faltas,
    avisos,
    premissas,
  };
}
