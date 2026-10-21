import type { MalhaDoCadastro, OrdemDeProducao, RoloDeEstoque, TipoDeDefeito } from '../domain/cadastroDeProducao';
import type { FonteDoEncolhimento } from '../domain/encolhimento';
import type { ConfiguracaoDoPlanejamento, OrdemNoPlano } from '../domain/planoDeEnfesto';
import type { PadraoDoTecido, Tecido } from '../domain/tecido';
import { lerMedida } from './medidas';

/**
 * Os formulários do planejamento de corte: o que se digita na tela (em m, cm, kg, %, com vírgula) e o que vai para
 * o cálculo (em mm e g). Cada leitura diz o campo que falta ou não é número, com a unidade.
 */

/** O número com vírgula para o campo. */
export const noCampo = (valor: number | undefined | null, casas = 3): string => (valor === undefined || valor === null ? '' : String(Number(valor.toFixed(casas))).replace('.', ','));

interface RegrasDoNumero {
  readonly obrigatorio?: boolean;
  readonly inteiro?: boolean;
  /** Zero vale (de 0 para cima); senão, só maior que zero. */
  readonly zeroVale?: boolean;
}

/** Lê um campo numérico: vazio é ausente (ou erro, se obrigatório); o que não é número vira um erro com o nome do campo. */
export function lerNumero(texto: string, nome: string, erros: string[], regras: RegrasDoNumero = {}): number | undefined {
  if (texto.trim() === '') {
    if (regras.obrigatorio) erros.push(`Preencha "${nome}".`);
    return undefined;
  }
  const valor = lerMedida(texto);
  if (valor === null) {
    erros.push(`"${nome}" precisa ser um número.`);
    return undefined;
  }
  if (regras.inteiro && !Number.isInteger(valor)) {
    erros.push(`"${nome}" precisa ser um número inteiro.`);
    return undefined;
  }
  if (regras.zeroVale ? valor < 0 : valor <= 0) {
    erros.push(`"${nome}" precisa ser ${regras.zeroVale ? 'de 0 para cima' : 'maior que zero'}.`);
    return undefined;
  }
  return valor;
}

const mm = (m: number | undefined): number | undefined => (m === undefined ? undefined : Math.round(m * 1000 * 1000) / 1000);
const deCm = (cm: number | undefined): number | undefined => (cm === undefined ? undefined : cm * 10);

// ---- Malha

export interface FormularioDaMalha {
  readonly descricao: string;
  readonly composicao: string;
  readonly tituloDoFio: string;
  readonly gramatura: string;
  readonly larguraNominal: string;
  readonly larguraUtil: string;
  readonly rendimento: string;
  readonly tubular: boolean;
  readonly sentidoUnico: boolean;
  readonly padrao: PadraoDoTecido;
  readonly encolhimentoComprimento: string;
  readonly encolhimentoLargura: string;
  readonly compensadoNoMolde: boolean;
  readonly fonteDoEncolhimento: FonteDoEncolhimento | '';
  readonly rapportComprimento: string;
  readonly rapportLargura: string;
  readonly faseComprimento: string;
  readonly faseLargura: string;
  readonly espessura: string;
  readonly tolerancia: string;
  readonly observacoes: string;
}

export const MALHA_VAZIA: FormularioDaMalha = {
  descricao: '',
  composicao: '',
  tituloDoFio: '',
  gramatura: '',
  larguraNominal: '',
  larguraUtil: '',
  rendimento: '',
  tubular: false,
  sentidoUnico: false,
  padrao: 'liso',
  encolhimentoComprimento: '',
  encolhimentoLargura: '',
  compensadoNoMolde: false,
  fonteDoEncolhimento: '',
  rapportComprimento: '',
  rapportLargura: '',
  faseComprimento: '',
  faseLargura: '',
  espessura: '',
  tolerancia: '',
  observacoes: '',
};

export function malhaNoFormulario(m: MalhaDoCadastro): FormularioDaMalha {
  return {
    descricao: m.descricao,
    composicao: m.composicao ?? '',
    tituloDoFio: m.tituloDoFio ?? '',
    gramatura: noCampo(m.gramaturaGm2),
    larguraNominal: noCampo(m.larguraNominalMm === undefined ? undefined : m.larguraNominalMm / 1000),
    larguraUtil: noCampo(m.larguraUtilMm / 1000),
    rendimento: noCampo(m.rendimentoMmPorG),
    tubular: m.tubular,
    sentidoUnico: m.sentidoUnico,
    padrao: m.padrao,
    encolhimentoComprimento: noCampo(m.encolhimentoComprimentoPercentual),
    encolhimentoLargura: noCampo(m.encolhimentoLarguraPercentual),
    compensadoNoMolde: m.encolhimentoCompensadoNoMolde,
    fonteDoEncolhimento: m.fonteDoEncolhimento ?? '',
    rapportComprimento: noCampo(m.rapportComprimentoMm === undefined ? undefined : m.rapportComprimentoMm / 10),
    rapportLargura: noCampo(m.rapportLarguraMm === undefined ? undefined : m.rapportLarguraMm / 10),
    faseComprimento: noCampo(m.faseComprimentoMm === undefined ? undefined : m.faseComprimentoMm / 10),
    faseLargura: noCampo(m.faseLarguraMm === undefined ? undefined : m.faseLarguraMm / 10),
    espessura: noCampo(m.espessuraDaFolhaMm),
    tolerancia: noCampo(m.toleranciaDeLarguraMm),
    observacoes: m.observacoes ?? '',
  };
}

/** A malha a partir do tecido do projeto (aba Tecido): o que ele tem. O rendimento não está lá. */
export function malhaDoTecido(tecido: Tecido): FormularioDaMalha {
  return {
    ...MALHA_VAZIA,
    descricao: tecido.nome || tecido.referencia,
    composicao: tecido.composicao ?? '',
    gramatura: noCampo(tecido.gramaturaGm2),
    larguraNominal: noCampo(tecido.larguraTotalMm / 1000),
    larguraUtil: noCampo(tecido.larguraUtilMm / 1000),
    sentidoUnico: tecido.direcional || tecido.temPelo,
    padrao: tecido.padrao,
    observacoes: tecido.observacoes ?? '',
  };
}

export function malhaDoFormulario(f: FormularioDaMalha, id: string): { readonly malha: MalhaDoCadastro | null; readonly erros: string[] } {
  const erros: string[] = [];
  if (f.descricao.trim() === '') erros.push('Preencha "Descrição da malha".');
  const larguraUtil = lerNumero(f.larguraUtil, 'Largura útil (m)', erros, { obrigatorio: true });
  const larguraNominal = lerNumero(f.larguraNominal, 'Largura nominal (m)', erros);
  const gramatura = lerNumero(f.gramatura, 'Gramatura (g/m²)', erros);
  const rendimento = lerNumero(f.rendimento, 'Rendimento (m/kg)', erros);
  const encolhimentoComprimento = lerNumero(f.encolhimentoComprimento, 'Encolhimento no comprimento (%)', erros, { zeroVale: true });
  const encolhimentoLargura = lerNumero(f.encolhimentoLargura, 'Encolhimento na largura (%)', erros, { zeroVale: true });
  const espessura = lerNumero(f.espessura, 'Espessura da folha (mm)', erros);
  const tolerancia = lerNumero(f.tolerancia, 'Tolerância de largura (mm)', erros, { zeroVale: true });
  const rapportComprimento = lerNumero(f.rapportComprimento, 'Repetição do desenho no comprimento (cm)', erros);
  const rapportLargura = lerNumero(f.rapportLargura, 'Repetição do desenho na largura (cm)', erros);
  const faseComprimento = lerNumero(f.faseComprimento, 'Fase do desenho no comprimento (cm)', erros, { zeroVale: true });
  const faseLargura = lerNumero(f.faseLargura, 'Fase do desenho na largura (cm)', erros, { zeroVale: true });
  if (erros.length > 0 || larguraUtil === undefined) return { malha: null, erros };
  const texto = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const opcionais = {
    composicao: texto(f.composicao),
    tituloDoFio: texto(f.tituloDoFio),
    gramaturaGm2: gramatura,
    larguraNominalMm: mm(larguraNominal),
    rendimentoMmPorG: rendimento,
    encolhimentoComprimentoPercentual: encolhimentoComprimento,
    encolhimentoLarguraPercentual: encolhimentoLargura,
    espessuraDaFolhaMm: espessura,
    toleranciaDeLarguraMm: tolerancia,
    observacoes: texto(f.observacoes),
    fonteDoEncolhimento: f.fonteDoEncolhimento === '' ? undefined : f.fonteDoEncolhimento,
    rapportComprimentoMm: deCm(rapportComprimento),
    rapportLarguraMm: deCm(rapportLargura),
    faseComprimentoMm: deCm(faseComprimento),
    faseLarguraMm: deCm(faseLargura),
  };
  const malha: MalhaDoCadastro = {
    id,
    descricao: f.descricao.trim(),
    larguraUtilMm: mm(larguraUtil)!,
    tubular: f.tubular,
    sentidoUnico: f.sentidoUnico,
    padrao: f.padrao,
    encolhimentoCompensadoNoMolde: f.compensadoNoMolde,
    ...Object.fromEntries(Object.entries(opcionais).filter(([, v]) => v !== undefined)),
  };
  return { malha, erros };
}

// ---- Rolo

export interface FormularioDoRolo {
  readonly identificacao: string;
  readonly peso: string;
  readonly comprimento: string;
  readonly largura: string;
  readonly lote: string;
  readonly tonalidade: string;
  readonly defeito: string;
  readonly perdaDoDefeito: string;
  readonly posicaoDoDefeito: string;
  readonly larguraDoDefeito: string;
  readonly tipoDoDefeito: TipoDeDefeito | '';
  readonly localizacao: string;
  readonly origem: string;
  readonly data: string;
}

export const ROLO_VAZIO: FormularioDoRolo = {
  identificacao: '',
  peso: '',
  comprimento: '',
  largura: '',
  lote: '',
  tonalidade: '',
  defeito: '',
  perdaDoDefeito: '',
  posicaoDoDefeito: '',
  larguraDoDefeito: '',
  tipoDoDefeito: '',
  localizacao: '',
  origem: '',
  data: '',
};

export function roloDoFormulario(f: FormularioDoRolo, id: string, malhaId: string): { readonly rolo: RoloDeEstoque | null; readonly erros: string[] } {
  const erros: string[] = [];
  if (f.identificacao.trim() === '') erros.push('Preencha "Identificação do rolo".');
  const peso = lerNumero(f.peso, 'Peso líquido (kg)', erros);
  const comprimento = lerNumero(f.comprimento, 'Comprimento medido (m)', erros);
  const largura = lerNumero(f.largura, 'Largura útil medida (m)', erros);
  const perda = lerNumero(f.perdaDoDefeito, 'Extensão do defeito (m)', erros, { zeroVale: true });
  const posicao = lerNumero(f.posicaoDoDefeito, 'Posição do defeito (m, do começo do rolo)', erros, { zeroVale: true });
  const larguraDoDefeito = lerNumero(f.larguraDoDefeito, 'Largura afetada (cm)', erros);
  if (peso === undefined && comprimento === undefined && erros.length === 0) erros.push('Informe o peso líquido (kg) ou o comprimento medido (m) do rolo.');
  if (f.defeito.trim() !== '' && perda === undefined) erros.push('Informe a extensão do defeito no comprimento do rolo (m).');
  if (f.data.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(f.data.trim())) erros.push('"Data da medição" precisa ser uma data.');
  if (erros.length > 0) return { rolo: null, erros };
  const texto = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const opcionais = {
    pesoLiquidoG: peso === undefined ? undefined : peso * 1000,
    comprimentoMedidoMm: mm(comprimento),
    larguraUtilMedidaMm: mm(largura),
    localizacao: texto(f.localizacao),
    origemDaMedicao: texto(f.origem),
    dataDaMedicao: texto(f.data),
  };
  return {
    rolo: {
      id,
      malhaId,
      identificacao: f.identificacao.trim(),
      lote: f.lote.trim(),
      tonalidade: f.tonalidade.trim(),
      defeitos:
        f.defeito.trim() !== '' && perda !== undefined
          ? [
              {
                descricao: f.defeito.trim(),
                perdaMm: mm(perda)!,
                ...(posicao !== undefined ? { posicaoMm: mm(posicao)! } : {}),
                ...(larguraDoDefeito !== undefined ? { larguraAfetadaMm: deCm(larguraDoDefeito)! } : {}),
                ...(f.tipoDoDefeito !== '' ? { tipo: f.tipoDoDefeito } : {}),
              },
            ]
          : [],
      unidadeDoPeso: 'kg',
      unidadeDoComprimento: 'm',
      indisponivel: false,
      ...Object.fromEntries(Object.entries(opcionais).filter(([, v]) => v !== undefined)),
    },
    erros,
  };
}

// ---- Ordem

export interface FormularioDaOrdem {
  readonly codigo: string;
  readonly produto: string;
  readonly cor: string;
  readonly prazo: string;
  readonly observacoes: string;
  readonly quantidades: Readonly<Record<string, string>>;
}

export const ORDEM_VAZIA: FormularioDaOrdem = { codigo: '', produto: '', cor: '', prazo: '', observacoes: '', quantidades: {} };

export function ordemNoFormulario(o: OrdemDeProducao): FormularioDaOrdem {
  return {
    codigo: o.codigo,
    produto: o.produto ?? '',
    cor: o.cor ?? '',
    prazo: o.prazo ?? '',
    observacoes: o.observacoes ?? '',
    quantidades: Object.fromEntries(Object.entries(o.quantidadesPorTamanho).map(([t, n]) => [t, String(n)])),
  };
}

export function ordemDoFormulario(f: FormularioDaOrdem): { readonly ordem: OrdemNoPlano | null; readonly erros: string[] } {
  const erros: string[] = [];
  if (f.codigo.trim() === '') erros.push('Preencha "Código da ordem".');
  const quantidades: Record<string, number> = {};
  for (const [tamanho, texto] of Object.entries(f.quantidades)) {
    if (texto.trim() === '') continue;
    const n = lerNumero(texto, `Quantidade do ${tamanho}`, erros, { inteiro: true, zeroVale: true });
    if (n !== undefined) quantidades[tamanho] = n;
  }
  if (erros.length === 0 && !Object.values(quantidades).some((n) => n > 0)) erros.push('Informe a quantidade de pelo menos um tamanho.');
  if (f.prazo.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(f.prazo.trim())) erros.push('"Prazo" precisa ser uma data.');
  if (erros.length > 0) return { ordem: null, erros };
  const texto = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const opcionais = { produto: texto(f.produto), cor: texto(f.cor), prazo: texto(f.prazo) };
  return {
    ordem: { codigo: f.codigo.trim(), quantidadesPorTamanho: quantidades, ...Object.fromEntries(Object.entries(opcionais).filter(([, v]) => v !== undefined)) },
    erros,
  };
}

// ---- Configuração

export interface FormularioDaConfiguracao {
  readonly margemInicial: string;
  readonly margemFinal: string;
  readonly sobra: string;
  readonly perdaPorRolo: string;
  readonly folhas: string;
  readonly alturaMaxima: string;
  readonly pesoMaximo: string;
  readonly comprimentoDaMesa: string;
  readonly larguraDaMesa: string;
  readonly roupasPorRisco: string;
  readonly distancia: string;
  readonly tolerancia: string;
  readonly tempo: string;
  readonly permitirEmendas: boolean;
  readonly sobreposicaoDaEmenda: string;
}

export function configuracaoNoFormulario(c: ConfiguracaoDoPlanejamento): FormularioDaConfiguracao {
  return {
    margemInicial: noCampo(c.margemInicialDaMesaMm / 10),
    margemFinal: noCampo(c.margemFinalDaMesaMm / 10),
    sobra: noCampo(c.sobraPorCamadaMm / 10),
    perdaPorRolo: noCampo(c.perdaPorRoloMm / 10),
    folhas: String(c.folhasPorEnfestoMax),
    alturaMaxima: noCampo(c.alturaMaximaDoEnfestoMm === undefined ? undefined : c.alturaMaximaDoEnfestoMm / 10),
    pesoMaximo: noCampo(c.pesoMaximoDoEnfestoG === undefined ? undefined : c.pesoMaximoDoEnfestoG / 1000),
    comprimentoDaMesa: noCampo(c.comprimentoMaximoDaMesaMm / 1000),
    larguraDaMesa: noCampo(c.larguraDaMesaMm === undefined ? undefined : c.larguraDaMesaMm / 1000),
    roupasPorRisco: String(c.roupasPorRiscoMax),
    distancia: noCampo(c.distanciaEntrePecasMm),
    tolerancia: noCampo(c.toleranciaDeRendimentoPercentual),
    tempo: noCampo(c.tempoDeBuscaS),
    permitirEmendas: c.permitirEmendas === true,
    sobreposicaoDaEmenda: noCampo((c.sobreposicaoDaEmendaMm ?? 0) / 10),
  };
}

export function configuracaoDoFormulario(f: FormularioDaConfiguracao): { readonly configuracao: ConfiguracaoDoPlanejamento | null; readonly erros: string[] } {
  const erros: string[] = [];
  const zero = { obrigatorio: true, zeroVale: true };
  const margemInicial = lerNumero(f.margemInicial, 'Margem no começo da mesa (cm)', erros, zero);
  const margemFinal = lerNumero(f.margemFinal, 'Margem no fim da mesa (cm)', erros, zero);
  const sobra = lerNumero(f.sobra, 'Pontas por camada (cm)', erros, zero);
  const perdaPorRolo = lerNumero(f.perdaPorRolo, 'Perda por rolo (cm)', erros, zero);
  const folhas = lerNumero(f.folhas, 'Folhas por enfesto (máximo)', erros, { obrigatorio: true, inteiro: true });
  const alturaMaxima = lerNumero(f.alturaMaxima, 'Altura máxima do enfesto (cm)', erros);
  const pesoMaximo = lerNumero(f.pesoMaximo, 'Peso máximo do enfesto (kg)', erros);
  const comprimentoDaMesa = lerNumero(f.comprimentoDaMesa, 'Comprimento da mesa (m)', erros, { obrigatorio: true });
  const larguraDaMesa = lerNumero(f.larguraDaMesa, 'Largura da mesa (m)', erros);
  const roupasPorRisco = lerNumero(f.roupasPorRisco, 'Roupas por risco (máximo)', erros, { obrigatorio: true, inteiro: true });
  const distancia = lerNumero(f.distancia, 'Distância entre as peças (mm)', erros, zero);
  const tolerancia = lerNumero(f.tolerancia, 'Tolerância de rendimento (%)', erros, zero);
  const tempo = lerNumero(f.tempo, 'Tempo da busca dos riscos (s)', erros, { obrigatorio: true });
  const sobreposicao = lerNumero(f.sobreposicaoDaEmenda, 'Sobreposição da emenda (cm)', erros, zero);
  if (erros.length > 0) return { configuracao: null, erros };
  return {
    configuracao: {
      margemInicialDaMesaMm: deCm(margemInicial)!,
      margemFinalDaMesaMm: deCm(margemFinal)!,
      sobraPorCamadaMm: deCm(sobra)!,
      perdaPorRoloMm: deCm(perdaPorRolo)!,
      folhasPorEnfestoMax: folhas!,
      ...(alturaMaxima !== undefined ? { alturaMaximaDoEnfestoMm: deCm(alturaMaxima)! } : {}),
      ...(pesoMaximo !== undefined ? { pesoMaximoDoEnfestoG: pesoMaximo * 1000 } : {}),
      comprimentoMaximoDaMesaMm: mm(comprimentoDaMesa)!,
      ...(larguraDaMesa !== undefined ? { larguraDaMesaMm: mm(larguraDaMesa)! } : {}),
      roupasPorRiscoMax: roupasPorRisco!,
      distanciaEntrePecasMm: distancia!,
      toleranciaDeRendimentoPercentual: tolerancia!,
      tempoDeBuscaS: tempo!,
      permitirEmendas: f.permitirEmendas,
      sobreposicaoDaEmendaMm: deCm(sobreposicao)!,
    },
    erros,
  };
}
