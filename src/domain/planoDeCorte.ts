import type { ConfiguracaoDeEnfesto, TipoDeEnfesto } from './enfesto';
import { criarConfiguracaoDeEnfesto, espessurasFisicasPorCamada } from './enfesto';
import { linhaDeCorteDaPeca, type Molde } from './molde';
import { area, retanguloEnvolvente } from '../core/geometria';

/**
 * Planejamento de corte: a partir do molde (o risco), da ordem de produção e da malha, a mesa, as camadas, os
 * enfestos, o consumo e a sobra.
 *
 * Unidades internas, sem mistura: comprimentos em **mm**, áreas em **mm²**, massas em **g**, gramatura em
 * **g/m²** (a unidade do ramo) e rendimento em **mm/g** — que é numericamente o mesmo que **m/kg**. As
 * conversões para o que se mostra (m, kg, m²) ficam nas funções abaixo, e o arredondamento só na tela.
 *
 * Nada aqui é garantia: são estimativas a partir dos dados informados, e o resultado diz quais.
 */

export const VERSAO_DO_CALCULO = 1;

// ---- Unidades

export const mmParaM = (mm: number): number => mm / 1000;
export const mParaMm = (m: number): number => m * 1000;
export const cmParaMm = (cm: number): number => cm * 10;
export const gParaKg = (g: number): number => g / 1000;
export const kgParaG = (kg: number): number => kg * 1000;
export const mm2ParaM2 = (mm2: number): number => mm2 / 1_000_000;
/** m/kg e mm/g são o mesmo número (1 m/kg = 1000 mm / 1000 g). */
export const mPorKgParaMmPorG = (mPorKg: number): number => mPorKg;
export const mmPorGParaMPorKg = (mmPorG: number): number => mmPorG;

/** O rendimento (m/kg) que a largura útil e a gramatura dão: 1000 / (largura em m × gramatura). Em mm/g. */
export function rendimentoPelaGramatura(larguraUtilMm: number, gramaturaGm2: number): number {
  return 1_000_000 / (larguraUtilMm * gramaturaGm2);
}

// ---- Entradas

/** As configurações operacionais da fábrica: valores do sistema, que quem usa ajusta à sua mesa e à sua faca. */
export interface ConfiguracaoDoPlano {
  /** Espaço da mesa antes do risco: onde o enfesto começa (mm). */
  readonly margemInicialDaMesaMm: number;
  /** Espaço da mesa depois do risco (mm). */
  readonly margemFinalDaMesaMm: number;
  /** Tecido a mais em cada camada, além do comprimento do risco: as pontas cortadas no começo e no fim (mm). */
  readonly sobraPorCamadaMm: number;
  /** Quantas folhas de tecido a enfestadeira e a faca aceitam num enfesto (a altura do colchão). */
  readonly folhasPorEnfestoMax: number;
  /** A diferença aceita entre o rendimento informado e o calculado pela largura e gramatura (%). */
  readonly toleranciaDeRendimentoPercentual: number;
}

export const CONFIGURACAO_PADRAO_DO_PLANO: ConfiguracaoDoPlano = {
  margemInicialDaMesaMm: 100,
  margemFinalDaMesaMm: 100,
  sobraPorCamadaMm: 20,
  folhasPorEnfestoMax: 100,
  toleranciaDeRendimentoPercentual: 5,
};

/** Um rolo da malha: o comprimento medido, ou o peso (que o rendimento converte), a largura e o lote/tonalidade. */
export interface RoloDeMalha {
  readonly id: string;
  readonly lote: string;
  readonly comprimentoMm?: number;
  readonly pesoG?: number;
  /** Sem largura própria, vale a da malha. */
  readonly larguraUtilMm?: number;
}

export interface MalhaDoPlano {
  readonly descricao: string;
  readonly gramaturaGm2?: number;
  /** O rendimento informado (de fábrica ou medido), em mm/g (= m/kg). */
  readonly rendimentoMmPorG?: number;
  readonly larguraUtilMm: number;
  /** O peso disponível, sem rolos detalhados (g). */
  readonly pesoDisponivelG?: number;
  readonly tubular: boolean;
  /** Pelo ou estampa direcional: as peças não podem ser viradas. */
  readonly sentidoUnico: boolean;
  /** Encolhimento no comprimento (%), só registrado e avisado: a compensação é do molde. */
  readonly encolhimentoPercentual?: number;
  readonly rolos?: readonly RoloDeMalha[];
}

/** De onde vem o rendimento que converte peso em metros, quando os dois existem. */
export type RendimentoPrincipal = 'informado' | 'calculado';

export interface RiscoDoPlano {
  /** 'mesa': as peças posicionadas no projeto (medido); 'informado': um risco cadastrado fora, digitado. */
  readonly origem: 'mesa' | 'informado';
  readonly comprimentoMm: number;
  readonly larguraMm: number;
  /** Peças de roupa de cada tamanho que uma folha do risco dá. */
  readonly gradePorTamanho: Readonly<Record<string, number>>;
  /** A área das peças do risco (mm², pela linha de corte), quando ele vem da mesa: dá a eficiência. */
  readonly areaDasPecasMm2?: number;
}

export interface OrdemDoPlano {
  readonly codigo: string;
  readonly quantidadesPorTamanho: Readonly<Record<string, number>>;
}

export interface MoldeDoPlano {
  readonly projetoId: string;
  readonly codigo: string;
  readonly nome: string;
  /** A revisão do projeto quando o plano foi feito (os eventos do histórico). */
  readonly revisao: number;
  /** A marca das peças (ver `impressaoDigitalDoMolde`): diz, depois, se o molde mudou. */
  readonly impressaoDigital: string;
}

export interface EntradaDoPlano {
  readonly molde: MoldeDoPlano;
  readonly ordem: OrdemDoPlano;
  readonly malha: MalhaDoPlano;
  readonly rendimentoPrincipal: RendimentoPrincipal;
  readonly risco: RiscoDoPlano;
  readonly tipoDeEnfesto: TipoDeEnfesto;
}

/** O que quem planeja muda na sugestão. */
export interface AjustesDoPlano {
  readonly comprimentoDaMesaMm?: number;
  readonly camadas?: number;
  readonly camadasPorEnfesto?: number;
}

// ---- Resultado

export interface AlertaDoPlano {
  readonly nivel: 'erro' | 'aviso' | 'info';
  readonly texto: string;
}

export interface RoloNoPlano {
  readonly id: string;
  readonly lote: string;
  readonly comprimentoMm: number;
  readonly compativel: boolean;
  /** Camadas que o rolo dá inteiras. */
  readonly camadas: number;
  /** O que sobra do rolo depois dessas camadas (mm). */
  readonly pontaMm: number;
}

export interface ResultadoDoPlano {
  readonly rendimentoInformadoMmPorG: number | null;
  readonly rendimentoCalculadoMmPorG: number | null;
  readonly rendimentoUsadoMmPorG: number | null;
  readonly origemDoRendimento: RendimentoPrincipal | null;
  readonly divergenciaDeRendimentoPercentual: number | null;
  readonly consumoPorCamadaMm: number;
  readonly comprimentoDaMesaSugeridoMm: number;
  readonly comprimentoDaMesaMm: number;
  readonly larguraDaMesaMm: number;
  readonly areaDaMesaMm2: number;
  readonly folhasPorCamada: 1 | 2;
  /** As camadas que fecham a ordem com este risco. */
  readonly camadasNecessarias: number;
  /** As camadas que o material dá. */
  readonly camadasPossiveis: number;
  /** As camadas do plano (as sugeridas, ou as do ajuste). */
  readonly camadas: number;
  readonly camadasPorEnfestoMax: number;
  /** As camadas de cada enfesto. */
  readonly enfestos: readonly number[];
  readonly producaoPorTamanho: Readonly<Record<string, number>>;
  readonly faltaPorTamanho: Readonly<Record<string, number>>;
  readonly excedentePorTamanho: Readonly<Record<string, number>>;
  /** O que o material dá de cada tamanho, quando ele não fecha a ordem. */
  readonly possivelPorTamanho: Readonly<Record<string, number>> | null;
  readonly consumoMm: number;
  readonly consumoG: number | null;
  /** A parte do consumo que vira ponta cortada (a sobra por camada). */
  readonly perdaDePontasMm: number;
  readonly disponivelMm: number;
  readonly disponivelG: number | null;
  /** O que fica do material depois do plano (pode ser 0); as pontas de rolo estão dentro. */
  readonly sobraMm: number;
  readonly sobraG: number | null;
  /** O que falta de material para fechar a ordem (0 se dá). */
  readonly deficitMm: number;
  readonly deficitG: number | null;
  /** Área das peças ÷ área do risco na largura útil; só com o risco medido na mesa. */
  readonly eficienciaPercentual: number | null;
  readonly rolos: readonly RoloNoPlano[] | null;
}

export type CalculoDoPlano =
  | {
      readonly ok: true;
      readonly resultado: ResultadoDoPlano;
      readonly alertas: readonly AlertaDoPlano[];
      readonly premissas: readonly string[];
    }
  | { readonly ok: false; readonly erros: readonly string[]; readonly alertas: readonly AlertaDoPlano[] };

// ---- Escrita

const um = (valor: number, casas: number): string => valor.toFixed(casas).replace('.', ',');
export const escreverM = (mm: number, casas = 2): string => `${um(mmParaM(mm), casas)} m`;
export const escreverKg = (g: number, casas = 2): string => `${um(gParaKg(g), casas)} kg`;
export const escreverM2 = (mm2: number, casas = 2): string => `${um(mm2ParaM2(mm2), casas)} m²`;
export const escreverRendimento = (mmPorG: number): string => `${um(mmPorGParaMPorKg(mmPorG), 2)} m/kg`;

// ---- Cálculo

const positivo = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v) && v > 0;
const inteiroNaoNegativo = (v: number): boolean => Number.isInteger(v) && v >= 0;

/** Os tamanhos na ordem em que aparecem: os da ordem, e os do risco que a ordem não tem. */
function tamanhosDe(ordem: OrdemDoPlano, risco: RiscoDoPlano): string[] {
  return [...new Set([...Object.keys(ordem.quantidadesPorTamanho), ...Object.keys(risco.gradePorTamanho)])];
}

function validar(entrada: EntradaDoPlano, configuracao: ConfiguracaoDoPlano, ajustes: AjustesDoPlano): string[] {
  const erros: string[] = [];
  const { malha, risco, ordem } = entrada;
  if (!positivo(malha.larguraUtilMm)) erros.push('Falta a largura útil da malha (um número maior que zero).');
  if (!positivo(risco.comprimentoMm)) erros.push('Falta o comprimento do risco (um número maior que zero).');
  if (!positivo(risco.larguraMm)) erros.push('Falta a largura do risco (um número maior que zero).');
  if (positivo(malha.larguraUtilMm) && positivo(risco.larguraMm) && risco.larguraMm > malha.larguraUtilMm + 0.5) {
    erros.push(`O risco (${escreverM(risco.larguraMm)} de largura) é mais largo que a largura útil da malha (${escreverM(malha.larguraUtilMm)}).`);
  }
  const grade = Object.entries(risco.gradePorTamanho);
  if (grade.some(([, n]) => !inteiroNaoNegativo(n))) erros.push('As peças por folha do risco precisam ser números inteiros de 0 para cima.');
  else if (!grade.some(([, n]) => n > 0)) erros.push('O risco não tem nenhuma peça de roupa: informe quantas de cada tamanho uma folha dá.');
  if (ordem.codigo.trim() === '') erros.push('Falta o código da ordem de produção.');
  const pedidos = Object.entries(ordem.quantidadesPorTamanho);
  if (pedidos.some(([, n]) => !inteiroNaoNegativo(n))) erros.push('As quantidades da ordem precisam ser números inteiros de 0 para cima.');
  else if (!pedidos.some(([, n]) => n > 0)) erros.push('A ordem não tem nenhuma peça: informe a quantidade de pelo menos um tamanho.');
  for (const [nome, valor] of [
    ['A gramatura', malha.gramaturaGm2],
    ['O rendimento', malha.rendimentoMmPorG],
    ['O peso disponível', malha.pesoDisponivelG],
  ] as const) {
    if (valor !== undefined && !positivo(valor)) erros.push(`${nome} da malha precisa ser um número maior que zero.`);
  }
  if (malha.encolhimentoPercentual !== undefined && !(malha.encolhimentoPercentual >= 0 && malha.encolhimentoPercentual < 50)) {
    erros.push('O encolhimento precisa ficar entre 0 e 50%.');
  }
  for (const rolo of malha.rolos ?? []) {
    if (!positivo(rolo.comprimentoMm) && !positivo(rolo.pesoG)) erros.push(`O rolo "${rolo.lote || rolo.id}" precisa do comprimento ou do peso.`);
    if (rolo.larguraUtilMm !== undefined && !positivo(rolo.larguraUtilMm)) erros.push(`A largura do rolo "${rolo.lote || rolo.id}" precisa ser maior que zero.`);
  }
  const c = configuracao;
  if (!(c.margemInicialDaMesaMm >= 0) || !(c.margemFinalDaMesaMm >= 0) || !(c.sobraPorCamadaMm >= 0)) {
    erros.push('As margens da mesa e a sobra por camada precisam ser de 0 para cima.');
  }
  if (!Number.isInteger(c.folhasPorEnfestoMax) || c.folhasPorEnfestoMax < 1) erros.push('O limite de folhas por enfesto precisa ser um número inteiro de 1 para cima.');
  if (!(c.toleranciaDeRendimentoPercentual >= 0)) erros.push('A tolerância de rendimento precisa ser de 0 para cima.');
  if (ajustes.camadas !== undefined && (!Number.isInteger(ajustes.camadas) || ajustes.camadas < 1)) erros.push('As camadas ajustadas precisam ser um número inteiro de 1 para cima.');
  if (ajustes.camadasPorEnfesto !== undefined && (!Number.isInteger(ajustes.camadasPorEnfesto) || ajustes.camadasPorEnfesto < 1)) {
    erros.push('As camadas por enfesto ajustadas precisam ser um número inteiro de 1 para cima.');
  }
  if (ajustes.comprimentoDaMesaMm !== undefined && positivo(risco.comprimentoMm) && !(ajustes.comprimentoDaMesaMm >= risco.comprimentoMm)) {
    erros.push(`A mesa ajustada precisa ter pelo menos o comprimento do risco (${escreverM(risco.comprimentoMm)}).`);
  }
  return erros;
}

/** Distribui as camadas em `quantos` enfestos, o mais igual possível (os primeiros com uma a mais, se não dividir). */
function distribuir(camadas: number, quantos: number): number[] {
  if (quantos <= 0 || camadas <= 0) return [];
  const base = Math.floor(camadas / quantos);
  const resto = camadas % quantos;
  return Array.from({ length: quantos }, (_, i) => base + (i < resto ? 1 : 0));
}

/**
 * O plano: valida, calcula e explica. Com dado obrigatório faltando ou impossível, não calcula — diz o que
 * falta. Nunca escolhe sozinho entre dois rendimentos diferentes: usa o principal e avisa da divergência.
 */
export function calcularPlanoDeCorte(
  entrada: EntradaDoPlano,
  configuracao: ConfiguracaoDoPlano = CONFIGURACAO_PADRAO_DO_PLANO,
  ajustes: AjustesDoPlano = {},
): CalculoDoPlano {
  const erros = validar(entrada, configuracao, ajustes);
  const alertas: AlertaDoPlano[] = [];
  const premissas: string[] = [];
  const { malha, risco, ordem } = entrada;
  if (erros.length > 0) return { ok: false, erros, alertas };

  // O rendimento: o informado, o calculado pela largura e gramatura, e qual vale.
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

  // O material: os rolos, ou o peso disponível.
  const consumoPorCamadaMm = risco.comprimentoMm + configuracao.sobraPorCamadaMm;
  const rolos = malha.rolos && malha.rolos.length > 0 ? malha.rolos : null;
  let disponivelMm = 0;
  let camadasPossiveis = 0;
  let rolosNoPlano: RoloNoPlano[] | null = null;
  if (rolos) {
    rolosNoPlano = [];
    for (const rolo of rolos) {
      const comprimento = positivo(rolo.comprimentoMm) ? rolo.comprimentoMm : usado !== null && positivo(rolo.pesoG) ? rolo.pesoG * usado : null;
      if (comprimento === null) {
        erros.push(`O rolo "${rolo.lote || rolo.id}" tem só o peso, e não há rendimento (informado, ou a gramatura) para saber o comprimento.`);
        continue;
      }
      const largura = rolo.larguraUtilMm ?? malha.larguraUtilMm;
      const compativel = largura + 0.5 >= risco.larguraMm;
      const camadas = compativel ? Math.floor(comprimento / consumoPorCamadaMm) : 0;
      rolosNoPlano.push({ id: rolo.id, lote: rolo.lote.trim(), comprimentoMm: comprimento, compativel, camadas, pontaMm: compativel ? comprimento - camadas * consumoPorCamadaMm : comprimento });
      if (!compativel) {
        alertas.push({ nivel: 'aviso', texto: `O rolo "${rolo.lote || rolo.id}" (${escreverM(largura)} de largura) é mais estreito que o risco (${escreverM(risco.larguraMm)}): não entra no plano.` });
      } else {
        disponivelMm += comprimento;
        camadasPossiveis += camadas;
      }
    }
    const lotes = [...new Set(rolosNoPlano.filter((r) => r.compativel && r.camadas > 0).map((r) => r.lote || '(sem lote)'))];
    if (lotes.length > 1) {
      alertas.push({
        nivel: 'aviso',
        texto: `Rolos de lotes diferentes (${lotes.join(', ')}): a tonalidade pode variar. Não misture lotes no mesmo enfesto sem conferir.`,
      });
    }
    premissas.push('Cada rolo dá só camadas inteiras: o que sobra no fim de um rolo (a ponta) não se junta ao próximo.');
  } else {
    if (!positivo(malha.pesoDisponivelG)) {
      erros.push('Falta o material disponível: informe o peso da malha (kg) ou os rolos.');
    } else if (usado === null) {
      erros.push('Falta o rendimento para converter o peso em metros: informe o rendimento (m/kg) ou a gramatura (g/m²).');
    } else {
      disponivelMm = malha.pesoDisponivelG * usado;
      camadasPossiveis = Math.floor(disponivelMm / consumoPorCamadaMm);
    }
  }
  if (erros.length > 0) return { ok: false, erros, alertas };

  if (informado !== null && calculado !== null && divergencia !== null && divergencia > configuracao.toleranciaDeRendimentoPercentual) {
    const comInformado = rolos ? null : (malha.pesoDisponivelG ?? 0) * informado;
    const comCalculado = rolos ? null : (malha.pesoDisponivelG ?? 0) * calculado;
    alertas.push({
      nivel: 'aviso',
      texto:
        `O rendimento informado (${escreverRendimento(informado)}) e o calculado pela largura e gramatura (${escreverRendimento(calculado)}) diferem ${um(divergencia, 1)}% (a tolerância é ${um(configuracao.toleranciaDeRendimentoPercentual, 1)}%). ` +
        (comInformado !== null && comCalculado !== null
          ? `Com o informado o material dá ${escreverM(comInformado)}; com o calculado, ${escreverM(comCalculado)}. `
          : '') +
        `O plano usa o ${origem === 'informado' ? 'informado' : 'calculado'}: confira a gramatura, a largura e o rendimento antes de confirmar.`,
    });
  }

  // As camadas que fecham a ordem, as que o material dá e as do plano.
  const folhasPorCamada = espessurasFisicasPorCamada(entrada.tipoDeEnfesto);
  const tamanhos = tamanhosDe(ordem, risco);
  let camadasNecessarias = 0;
  for (const tamanho of tamanhos) {
    const pedido = ordem.quantidadesPorTamanho[tamanho] ?? 0;
    const porCamada = (risco.gradePorTamanho[tamanho] ?? 0) * folhasPorCamada;
    if (pedido > 0 && porCamada === 0) {
      alertas.push({ nivel: 'aviso', texto: `O risco não tem o tamanho ${tamanho}: as ${pedido} peças dele não saem deste plano.` });
      continue;
    }
    if (pedido > 0) camadasNecessarias = Math.max(camadasNecessarias, Math.ceil(pedido / porCamada));
  }
  if (camadasNecessarias === 0) {
    return { ok: false, erros: ['Nenhum tamanho da ordem está no risco: este risco não serve para esta ordem.'], alertas };
  }
  if (camadasPossiveis < 1) {
    return {
      ok: false,
      erros: [`O material disponível (${escreverM(disponivelMm)}) não dá nem uma camada (cada uma gasta ${escreverM(consumoPorCamadaMm)}).`],
      alertas,
    };
  }
  if (ajustes.camadas !== undefined && ajustes.camadas > camadasPossiveis) {
    return { ok: false, erros: [`O material dá até ${camadasPossiveis} camadas: as ${ajustes.camadas} ajustadas não cabem nele.`], alertas };
  }
  const camadas = ajustes.camadas ?? Math.min(camadasNecessarias, camadasPossiveis);

  // Os enfestos.
  const camadasPorEnfestoMax = Math.floor(configuracao.folhasPorEnfestoMax / folhasPorCamada);
  if (camadasPorEnfestoMax < 1) {
    return { ok: false, erros: [`O limite de ${configuracao.folhasPorEnfestoMax} folha(s) por enfesto não comporta uma camada de ${folhasPorCamada} folhas.`], alertas };
  }
  if (ajustes.camadasPorEnfesto !== undefined && ajustes.camadasPorEnfesto > camadasPorEnfestoMax) {
    return {
      ok: false,
      erros: [`O limite é de ${camadasPorEnfestoMax} camadas por enfesto (${configuracao.folhasPorEnfestoMax} folhas): as ${ajustes.camadasPorEnfesto} ajustadas passam dele.`],
      alertas,
    };
  }
  const porEnfesto = ajustes.camadasPorEnfesto ?? camadasPorEnfestoMax;
  const enfestos = distribuir(camadas, Math.ceil(camadas / porEnfesto));

  // A produção, o que falta e o que sobra de cada tamanho.
  const producaoPorTamanho: Record<string, number> = {};
  const faltaPorTamanho: Record<string, number> = {};
  const excedentePorTamanho: Record<string, number> = {};
  for (const tamanho of tamanhos) {
    const produzido = camadas * (risco.gradePorTamanho[tamanho] ?? 0) * folhasPorCamada;
    const pedido = ordem.quantidadesPorTamanho[tamanho] ?? 0;
    producaoPorTamanho[tamanho] = produzido;
    faltaPorTamanho[tamanho] = Math.max(0, pedido - produzido);
    excedentePorTamanho[tamanho] = Math.max(0, produzido - pedido);
  }
  const faltam = tamanhos.filter((t) => (faltaPorTamanho[t] ?? 0) > 0);
  const sobram = tamanhos.filter((t) => (excedentePorTamanho[t] ?? 0) > 0);
  if (faltam.length > 0) {
    alertas.push({
      nivel: 'aviso',
      texto: `Com ${camadas} camada(s) a ordem não fecha: faltam ${faltam.map((t) => `${faltaPorTamanho[t]} do ${t}`).join(', ')}.`,
    });
  }
  if (sobram.length > 0) {
    alertas.push({
      nivel: 'info',
      texto: `A grade do risco produz a mais: ${sobram.map((t) => `${excedentePorTamanho[t]} do ${t}`).join(', ')}.`,
    });
  }

  // O consumo, a sobra, as perdas e o que falta de material.
  const consumoMm = camadas * consumoPorCamadaMm;
  const deficitMm = Math.max(0, camadasNecessarias * consumoPorCamadaMm - disponivelMm);
  const possivelPorTamanho =
    camadasPossiveis < camadasNecessarias
      ? Object.fromEntries(tamanhos.map((t) => [t, camadasPossiveis * (risco.gradePorTamanho[t] ?? 0) * folhasPorCamada]))
      : null;
  if (possivelPorTamanho) {
    alertas.push({
      nivel: 'aviso',
      texto:
        `O material não dá a ordem inteira: faltam ${escreverM(deficitMm)}${usado !== null ? ` (${escreverKg(deficitMm / usado)})` : ''} para as ${camadasNecessarias} camadas. ` +
        `Com o que há (${camadasPossiveis} camadas): ${tamanhos.map((t) => `${possivelPorTamanho[t]} do ${t}`).join(', ')}. A ordem não foi mudada.`,
    });
  }

  // A mesa.
  const comprimentoDaMesaSugeridoMm = risco.comprimentoMm + configuracao.margemInicialDaMesaMm + configuracao.margemFinalDaMesaMm;
  const comprimentoDaMesaMm = ajustes.comprimentoDaMesaMm ?? comprimentoDaMesaSugeridoMm;
  if (ajustes.comprimentoDaMesaMm !== undefined && ajustes.comprimentoDaMesaMm < comprimentoDaMesaSugeridoMm) {
    alertas.push({ nivel: 'aviso', texto: `A mesa ajustada (${escreverM(comprimentoDaMesaMm)}) é menor que a sugerida (${escreverM(comprimentoDaMesaSugeridoMm)}): sobra menos espaço para as margens.` });
  }

  // O que a malha pede do enfesto.
  if (malha.tubular !== (entrada.tipoDeEnfesto === 'tubular')) {
    alertas.push({
      nivel: 'aviso',
      texto: malha.tubular
        ? 'A malha é tubular, e o enfesto não: confira o tipo do enfesto (no tubular, cada camada tem duas folhas).'
        : 'O enfesto é tubular, e a malha está como aberta: confira.',
    });
  }
  if (malha.sentidoUnico && entrada.tipoDeEnfesto === 'zigue-zague') {
    alertas.push({ nivel: 'aviso', texto: 'A malha tem sentido único (pelo ou estampa), e o enfesto zigue-zague vira o tecido a cada camada.' });
  }
  if (malha.encolhimentoPercentual !== undefined && malha.encolhimentoPercentual > 0) {
    alertas.push({
      nivel: 'info',
      texto: `Encolhimento informado: ${um(malha.encolhimentoPercentual, 1)}%. Ele não foi aplicado ao risco: a compensação tem de estar no molde.`,
    });
  }
  if (camadas > camadasNecessarias) {
    alertas.push({ nivel: 'info', texto: `As ${camadas} camadas ajustadas passam das ${camadasNecessarias} que fecham a ordem.` });
  }

  const eficienciaPercentual =
    risco.origem === 'mesa' && positivo(risco.areaDasPecasMm2) ? (risco.areaDasPecasMm2 / (risco.comprimentoMm * malha.larguraUtilMm)) * 100 : null;

  premissas.push(
    `Uma camada é uma folha do risco${folhasPorCamada === 2 ? `; no enfesto ${entrada.tipoDeEnfesto === 'par' ? 'par' : 'tubular'}, cada camada tem duas folhas de tecido e dá duas peças de cada uma do risco` : ''}.`,
    `Cada camada gasta o comprimento do risco mais ${escreverM(configuracao.sobraPorCamadaMm, 3)} de sobra (as pontas): configuração do sistema.`,
    `A mesa é o risco mais ${escreverM(configuracao.margemInicialDaMesaMm, 3)} no começo e ${escreverM(configuracao.margemFinalDaMesaMm, 3)} no fim (configuração), na largura útil da malha.`,
    `Até ${configuracao.folhasPorEnfestoMax} folhas por enfesto (configuração).`,
    risco.origem === 'mesa'
      ? 'O risco é o encaixe das peças que estão na mesa do projeto (medido).'
      : 'O risco foi informado à mão: o resultado depende do comprimento e da grade informados.',
  );
  if (usado !== null) {
    premissas.push(`Peso e metros convertidos pelo rendimento ${origem === 'informado' ? 'informado' : 'calculado pela largura e gramatura'}: ${escreverRendimento(usado)}.`);
  }
  premissas.push('Valores estimados a partir dos dados informados: o consumo real depende do enfesto e do corte.');

  return {
    ok: true,
    resultado: {
      rendimentoInformadoMmPorG: informado,
      rendimentoCalculadoMmPorG: calculado,
      rendimentoUsadoMmPorG: usado,
      origemDoRendimento: origem,
      divergenciaDeRendimentoPercentual: divergencia,
      consumoPorCamadaMm,
      comprimentoDaMesaSugeridoMm,
      comprimentoDaMesaMm,
      larguraDaMesaMm: malha.larguraUtilMm,
      areaDaMesaMm2: comprimentoDaMesaMm * malha.larguraUtilMm,
      folhasPorCamada,
      camadasNecessarias,
      camadasPossiveis,
      camadas,
      camadasPorEnfestoMax,
      enfestos,
      producaoPorTamanho,
      faltaPorTamanho,
      excedentePorTamanho,
      possivelPorTamanho,
      consumoMm,
      consumoG: usado !== null ? consumoMm / usado : null,
      perdaDePontasMm: camadas * configuracao.sobraPorCamadaMm,
      disponivelMm,
      disponivelG: usado !== null ? disponivelMm / usado : null,
      sobraMm: Math.max(0, disponivelMm - consumoMm),
      sobraG: usado !== null ? Math.max(0, disponivelMm - consumoMm) / usado : null,
      deficitMm,
      deficitG: usado !== null ? deficitMm / usado : null,
      eficienciaPercentual,
      rolos: rolosNoPlano,
    },
    alertas,
    premissas,
  };
}

// ---- O risco que está na mesa

/** O nome do tamanho de uma peça sem tamanho. */
export const TAMANHO_UNICO = 'Único';

/**
 * O risco das peças posicionadas na mesa do projeto: o comprimento e a largura (pelas linhas de corte), a área
 * delas (para a eficiência) e a grade — quantas peças de roupa de cada tamanho uma folha dá. A grade é deduzida:
 * em cada tamanho, a peça que menos se repete (com a Frente, as Costas e duas Mangas do M, sai 1 do M). Quem
 * planeja confere e corrige. Sem peças, `null`.
 */
export function riscoDaMesa(pecas: readonly Molde[]): RiscoDoPlano | null {
  const cortes = pecas.map((p) => ({ peca: p, corte: linhaDeCorteDaPeca(p) })).filter((c) => c.corte.length >= 3);
  if (cortes.length === 0) return null;
  const caixa = retanguloEnvolvente(cortes.flatMap((c) => c.corte));
  const porTamanho = new Map<string, Map<string, number>>();
  for (const { peca } of cortes) {
    const tamanho = peca.tamanho.trim() === '' ? TAMANHO_UNICO : peca.tamanho.trim();
    const nomes = porTamanho.get(tamanho) ?? new Map<string, number>();
    nomes.set(peca.nome.trim(), (nomes.get(peca.nome.trim()) ?? 0) + 1);
    porTamanho.set(tamanho, nomes);
  }
  const gradePorTamanho = Object.fromEntries([...porTamanho].map(([tamanho, nomes]) => [tamanho, Math.min(...nomes.values())]));
  return {
    origem: 'mesa',
    comprimentoMm: caixa.maxY - caixa.minY,
    larguraMm: caixa.maxX - caixa.minX,
    gradePorTamanho,
    areaDasPecasMm2: cortes.reduce((soma, c) => soma + area(c.corte), 0),
  };
}

// ---- O molde e o plano guardado

/** Uma marca curta das peças (FNV-1a sobre a forma, o tamanho e a quantidade): diz se o molde mudou depois do plano. */
export function impressaoDigitalDoMolde(
  pecas: ReadonlyArray<{ readonly nome: string; readonly tamanho: string; readonly quantidade: number; readonly margemDeCosturaMm: number; readonly contorno: ReadonlyArray<{ readonly x: number; readonly y: number }> }>,
): string {
  const texto = JSON.stringify(
    pecas
      .map((p) => [p.nome, p.tamanho, p.quantidade, p.margemDeCosturaMm, p.contorno.map((q) => [Math.round(q.x * 100), Math.round(q.y * 100)])])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Um ajuste feito sobre a sugestão: o campo, o que o sistema sugeriu e o que ficou. */
export interface AjusteManual {
  readonly campo: 'comprimentoDaMesaMm' | 'camadas' | 'camadasPorEnfesto';
  readonly sugerido: number;
  readonly escolhido: number;
}

/** O plano confirmado, como foi: guardado no projeto e nunca recalculado. */
export interface PlanoDeCorte {
  readonly id: string;
  readonly criadoEmIso: string;
  readonly responsavel: string;
  readonly versaoDoCalculo: number;
  readonly entrada: EntradaDoPlano;
  readonly configuracao: ConfiguracaoDoPlano;
  readonly ajustes: readonly AjusteManual[];
  readonly resultado: ResultadoDoPlano;
  readonly alertas: readonly AlertaDoPlano[];
  readonly premissas: readonly string[];
  /** O plano anterior da mesma ordem neste projeto, que este vem substituir (ele continua guardado). */
  readonly substituiPlanoId?: string;
}

/** Os ajustes que de fato mudaram a sugestão (os iguais a ela não contam). */
export function ajustesFeitos(sugerido: ResultadoDoPlano, final: ResultadoDoPlano, ajustes: AjustesDoPlano): AjusteManual[] {
  const feitos: AjusteManual[] = [];
  if (ajustes.comprimentoDaMesaMm !== undefined && ajustes.comprimentoDaMesaMm !== sugerido.comprimentoDaMesaMm) {
    feitos.push({ campo: 'comprimentoDaMesaMm', sugerido: sugerido.comprimentoDaMesaMm, escolhido: final.comprimentoDaMesaMm });
  }
  if (ajustes.camadas !== undefined && ajustes.camadas !== sugerido.camadas) {
    feitos.push({ campo: 'camadas', sugerido: sugerido.camadas, escolhido: final.camadas });
  }
  const sugeridoPorEnfesto = Math.max(...sugerido.enfestos, 0);
  if (ajustes.camadasPorEnfesto !== undefined && ajustes.camadasPorEnfesto !== sugeridoPorEnfesto) {
    feitos.push({ campo: 'camadasPorEnfesto', sugerido: sugeridoPorEnfesto, escolhido: ajustes.camadasPorEnfesto });
  }
  return feitos;
}

/**
 * O enfesto do projeto ajustado ao plano confirmado: o tipo, a largura útil (a da malha), o comprimento da mesa e
 * as camadas do maior enfesto. As margens, a distância entre os moldes e o que é próprio do tipo (a largura do
 * tubo, o ramado) ficam como estavam. A mesa nunca fica mais curta que `alcanceDasPecasMm` (até onde vão as peças
 * que estão nela): senão, as peças posicionadas mais adiante ficariam fora da mesa.
 */
export function enfestoDoPlano(
  anterior: ConfiguracaoDeEnfesto | null,
  tipo: TipoDeEnfesto,
  resultado: ResultadoDoPlano,
  distanciaPadraoMm: number,
  alcanceDasPecasMm = 0,
): ConfiguracaoDeEnfesto {
  const base = {
    larguraUtilMm: resultado.larguraDaMesaMm,
    comprimentoMm: Math.max(resultado.comprimentoDaMesaMm, alcanceDasPecasMm),
    quantidadeDeCamadas: Math.max(1, ...resultado.enfestos),
    margemLateralMm: anterior?.margemLateralMm ?? 0,
    margemDeExtremidadeMm: anterior?.margemDeExtremidadeMm ?? 0,
    distanciaMinimaEntrePecasMm: anterior?.distanciaMinimaEntrePecasMm ?? distanciaPadraoMm,
  };
  if (tipo === 'tubular') {
    return criarConfiguracaoDeEnfesto({
      ...base,
      tipo,
      larguraDoTuboMm: Math.max(resultado.larguraDaMesaMm, anterior?.tipo === 'tubular' ? anterior.larguraDoTuboMm : 0),
    });
  }
  if (tipo === 'ramado') {
    return criarConfiguracaoDeEnfesto({
      ...base,
      tipo,
      alinhamentoDasBordas: anterior?.tipo === 'ramado' ? anterior.alinhamentoDasBordas : 'alinhado',
      sentidoDeAlimentacao: anterior?.tipo === 'ramado' ? anterior.sentidoDeAlimentacao : 'unico',
    });
  }
  return criarConfiguracaoDeEnfesto({ ...base, tipo });
}
