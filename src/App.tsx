import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AreaDeDesenho, type FerramentaDeVista, type ModoDeDesenho, type PreviaNoDesenho } from './ui/AreaDeDesenho';
import { BarraDeFerramentas } from './ui/BarraDeFerramentas';
import { BarraDeVisualizacao } from './ui/BarraDeVisualizacao';
import { PainelDePecas, PainelDePropriedades, type PatchDeMolde } from './ui/PainelLateral';
import { BarraDeStatus } from './ui/BarraDeStatus';
import { Sobreposicao } from './ui/Sobreposicao';
import { PainelDeMoverCerca } from './ui/PainelDeMoverCerca';
import { PainelDeModificar } from './ui/PainelDeModificar';
import { PainelDeRedefinirPerimetro, type RedefinicaoDePerimetro } from './ui/PainelDeRedefinirPerimetro';
import { PainelDeAjuda, type ConteudoDaAjuda } from './ui/PainelDeAjuda';
import { PainelDeCostura } from './ui/PainelDeCostura';
import { PainelDeInformacoesDosMoldes } from './ui/PainelDeInformacoesDosMoldes';
import { PainelDeVariantes } from './ui/PainelDeVariantes';
import { DialogoDeCampos } from './ui/DialogoDeCampos';
import { PainelDeCurvaPredefinida } from './ui/PainelDeCurvaPredefinida';
import {
  caminhoDoTrecho,
  cliqueDeTrecho,
  comprimentoDoTrecho,
  linhaNovaDoTrecho,
  pontosDoTrecho,
  previaDoTrecho,
  SEM_TRECHO,
  trechoCompleto,
  type FerramentaDeTrecho,
  type OpcoesDoTrecho,
  type TrechoEmEdicao,
} from './ui/ferramentasDeTrecho';
import {
  aplicarBainha,
  aplicarDesdobrar,
  aplicarReta,
  aplicarUniao,
  arestaDeOutraPecaPerto,
  arestaPerto,
  cliqueDeReta,
  ehFerramentaDeReta,
  previaDaBainha,
  previaDaReta,
  previaDeDesdobrar,
  previaDeUnir,
  retaCompleta,
  type FerramentaDeMolde,
} from './ui/ferramentasDeMolde';
import {
  aplicarPence,
  cliqueDePence,
  dialogoDaPence,
  ehFerramentaDePence,
  instrucaoDaPence,
  lerDialogoDaPence,
  OPCOES_INICIAIS_DAS_PENCES,
  penceCompleta,
  previaDaPence,
  type FerramentaDePence,
  type OpcoesDasPences,
} from './ui/ferramentasDePence';
import {
  aplicarRemoverDoMolde,
  aplicarSeparar,
  aplicarTamanhos,
  aplicarUnir,
  cliqueDeGraduacao,
  dialogoDaGraduacao,
  dialogoDeTamanhos,
  ehModoDeGraduacao,
  instrucaoDaGraduacao,
  lerDialogoDaGraduacao,
  mesmosTamanhos,
  OPCOES_INICIAIS_DA_GRADUACAO,
  previaDaGraduacao,
  type FerramentaDeGraduacao,
  type OpcoesDaGraduacao,
} from './ui/ferramentasDeGraduacao';
import {
  gravarRegrasCadastradas,
  lerRegrasCadastradas,
  regraDoPonto,
  regraParaAGraduacao,
  type RegraCadastrada,
} from './ui/regrasDeGraduacao';
import { PainelDeTabelaDeGraduacao } from './ui/PainelDeTabelaDeGraduacao';
import { PainelDeRegras } from './ui/PainelDeRegras';
import { definirRegra, pontoGraduadoEm, regraDoVertice } from './domain/graduacao';
import { conferirOpcoesDeBainha, MAXIMO_DE_DOBRAS_DA_BAINHA, type OpcoesDeBainha } from './domain/bainha';
import {
  curvaDoTrecho,
  CURVAS_DE_FABRICA,
  gravarCurvasCadastradas,
  lerCurvasCadastradas,
  type CurvaCadastrada,
} from './ui/curvasCadastradas';
import { formatarMm } from './ui/medidas';
import { circulo, espiral } from './core/curvas';
import { CLIQUES_DA_COTA, cotaSobOPonto, montarCota, previaDaCota, type FerramentaDeCotaPorPontos } from './ui/cotas';
import { cotaDePerimetro } from './domain/cota';
import {
  alvoDaMedicao,
  cliqueDePerimetro,
  posicaoNoContornoPerto,
  descreverComparacao,
  descreverMedicao,
  registrarMedicao,
  resolverMedicao,
  SEM_MEDICAO,
  type EstadoDeMedicao,
  type MedicaoResolvida,
} from './ui/medicao';
import { inverterSelecao } from './domain/selecao';
import {
  aplicarZoom,
  enquadrarRetanguloDoMundo,
  passoDaGradeEmMm,
  type TransformacaoDeTela,
  type UnidadeDeRegua,
} from './ui/transformacaoDeTela';
import {
  cercaAfetaMolde,
  moverDentroDaCerca,
  pecasAlvoDaCerca,
  TODAS_AS_OPCOES_DA_CERCA,
  transladarCerca,
  type Cerca,
  type OpcoesDeMoverCerca,
} from './domain/cerca';
import {
  criarMolde,
  transladarMolde,
  adicionarPique,
  adicionarMarca,
  rotacionarMolde,
  rotacaoEhPermitida,
  rotacoesPermitidas,
  espelharMolde,
  moverVariosPontosDoMolde,
  modificarPontosDoMolde,
  redefinirComprimentoDaAresta,
  inserirPontoNoMolde,
  removerPontoDoMolde,
  chanfrarCantoDoMolde,
  arredondarCantoDoMolde,
  dimensionarMolde,
  dimensoesDoMolde,
  redefinirLinhaDeFio,
  definirMargemDeCostura,
  restaurarFormaDoMolde,
  adicionarCota,
  removerCota,
  converterCosturaEmContorno,
  substituirTrechoDoMolde,
  type Molde,
  type PontaDaAresta,
} from './domain/molde';
import {
  alturaDoDesenho,
  direcaoNaTelaDaLinhaDeFio,
  dxfParaMundo,
  importarDxf,
  type ResultadoImportacaoDxf,
} from './formats/dxf-importacao';
import { importarPdf } from './formats/pdf-importacao';
import { diagnosticarVetorPdf, descreverDiagnosticoVetorial } from './formats/pdf-diagnostico-vetorial';
import {
  contornoEmMundo,
  extrairContornosDoPdf,
  linhaDeFioSobreContorno,
  type ResultadoContornosPdf,
} from './formats/pdf-pecas-vetoriais';
import { DialogoDeImportacaoDeContornos, type ItemConfirmadoDeContorno } from './ui/DialogoDeImportacaoDeContornos';
import { gerarPdfDeEncaixe, gerarPdfDeMoldesIndividuais } from './formats/pdf-exportacao';
import { gerarPdfDeRelatorio, gerarExcelDeRelatorio } from './formats/relatorio-exportacao';
import { aproveitamentoDaMesa, gerarRelatorioDeProducao } from './domain/relatorio';
import {
  ponto,
  area,
  distancia,
  retanguloEnvolvente,
  deslocarContornoParaFora,
  type Ponto2D,
  type PosicaoNoContorno,
} from './core/geometria';
import { criarTecido, type Tecido } from './domain/tecido';
import type { ConfiguracaoDeEnfesto } from './domain/enfesto';
import { ROTULO_DO_TIPO, criarConfiguracaoDeEnfesto } from './domain/enfesto';
import { validarProjeto } from './domain/validacao';
import { sugerirPosicaoSemSobreposicao } from './domain/posicionamento';
import type { ResultadoDeNesting } from './domain/nesting';
import type { MensagemParaWorker } from './nesting.worker';
import { PainelDeTecido } from './ui/PainelDeTecido';
import { PainelDeEnfesto } from './ui/PainelDeEnfesto';
import { PainelDeNesting } from './ui/PainelDeNesting';
import { PainelDeExportacaoPdf, type OpcoesDeExportacaoEscolhidas } from './ui/PainelDeExportacaoPdf';
import { PainelDeBiblioteca } from './ui/PainelDeBiblioteca';
import { PainelDeHistorico } from './ui/PainelDeHistorico';
import { PainelDeRelatorio } from './ui/PainelDeRelatorio';
import { PainelDeNovoProjeto, type DadosDeNovoProjeto } from './ui/PainelDeNovoProjeto';
import { PainelDeDimensionar } from './ui/PainelDeDimensionar';
import {
  criarProjeto,
  registrarEvento,
  restaurarVersao,
  alterarStatus,
  renomearProjeto,
  gerarCodigoDeProjeto,
  criarVariante,
  variantesDoProjeto,
  nomeDaProximaVariante,
  type Projeto,
  type EstadoDoProjeto,
  type TipoDeEvento,
} from './domain/projeto';
import './App.css';

function proximoId(): string {
  return `peca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mesa e tecido de demonstração — sem eles o app abre com "Enfesto: não
 * configurado" e nenhuma mesa desenhada (só um fundo cinza vazio), o que
 * não mostra a mesa retangular horizontal que é uma característica
 * constante do app, não algo que só aparece depois de configurar um
 * projeto na mão. Nenhuma peça de demonstração — o projeto abre vazio,
 * pronto para o usuário desenhar as próprias peças.
 */
function enfestoDeDemonstracao(): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1500,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
  } as ConfiguracaoDeEnfesto);
}

function tecidoDeDemonstracao(): Tecido {
  return criarTecido(
    { nome: 'Tecido de demonstração', referencia: '', larguraTotalMm: 1500, larguraUtilMm: 1500 },
    'tecido-demo',
  );
}

/**
 * Tamanho da área de desenho até a primeira medida real (a área avisa o
 * tamanho de verdade assim que é montada — ver `aoMudarTamanhoDaTela`).
 */
const TAMANHO_PROVISORIO_DA_TELA = { largura: 900, altura: 600 } as const;

/** O que "Ajustar à tela" enquadra: a mesa (com enfesto configurado) e todas as peças. `null` se não houver nenhuma das duas. */
function retanguloDoDesenho(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto | null,
): { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number } | null {
  let minX = enfesto ? 0 : Infinity;
  let minY = enfesto ? 0 : Infinity;
  let maxX = enfesto ? enfesto.larguraUtilMm : -Infinity;
  let maxY = enfesto ? enfesto.comprimentoMm : -Infinity;
  for (const peca of pecas) {
    const b = retanguloEnvolvente(peca.contorno);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return Number.isFinite(minX) && Number.isFinite(maxX) ? { minX, minY, maxX, maxY } : null;
}

/** Quantas vistas "Vista anterior" guarda. */
const MAXIMO_DE_VISTAS_GUARDADAS = 50;

function mesmaVista(a: TransformacaoDeTela, b: TransformacaoDeTela): boolean {
  return a.escalaPxPorMm === b.escalaPxPorMm && a.offsetXPx === b.offsetXPx && a.offsetYPx === b.offsetYPx;
}

function empilharVista(pilha: readonly TransformacaoDeTela[], vista: TransformacaoDeTela): readonly TransformacaoDeTela[] {
  const topo = pilha.at(-1);
  if (topo && mesmaVista(topo, vista)) return pilha;
  return [...pilha, vista].slice(-MAXIMO_DE_VISTAS_GUARDADAS);
}

function mesmaCerca(a: Cerca | null, b: Cerca): boolean {
  return a !== null && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
}

/** Raio (px) em que um clique de medida acerta o contorno de uma peça — o mesmo raio de captura de vértices do desenho. */
const RAIO_DE_MEDICAO_PX = 10;
/** Um retângulo com menos disso (mm) de largura ou de altura não tem área: o segundo clique é ignorado. */
const LADO_MINIMO_DO_RETANGULO_MM = 1e-6;

/** Modos em que a barra de status mostra DX, DY, distância e ângulo a partir do último ponto clicado. */
const MODOS_COM_PONTO_DE_REFERENCIA: ReadonlySet<ModoDeDesenho> = new Set([
  'novo-molde',
  'novo-furo',
  'retangulo',
  'sentido-do-fio',
  'medir-distancia',
  'comparar-distancias',
  'cota-distancia',
  'cota-horizontal-vertical',
  'cota-angulo',
  'circulo',
]);

function ehFerramentaDeTrecho(modo: ModoDeDesenho): modo is FerramentaDeTrecho {
  return (
    modo === 'curva' ||
    modo === 'arco-2-pontos' ||
    modo === 'arco-3-pontos' ||
    modo === 'editar-pontos-de-curva' ||
    modo === 'cadastrar-curva' ||
    modo === 'curva-predefinida'
  );
}

/** Diálogo aberto por uma ferramenta de desenho, com o que ele precisa para aplicar. */
type DialogoDeFerramenta =
  | { readonly tipo: 'numero-de-pontos'; readonly inicio: PosicaoNoContorno; readonly fim: PosicaoNoContorno }
  | { readonly tipo: 'cadastrar-curva'; readonly inicio: PosicaoNoContorno; readonly fim: PosicaoNoContorno }
  | { readonly tipo: 'escolher-curva' }
  | { readonly tipo: 'espiral' }
  | { readonly tipo: 'raio-do-arco'; readonly indice: number }
  | { readonly tipo: 'bainha' }
  | { readonly tipo: 'unir' }
  | { readonly tipo: 'pence'; readonly ferramenta: FerramentaDePence }
  | { readonly tipo: 'tamanhos' }
  | { readonly tipo: 'graduacao'; readonly ferramenta: FerramentaDeGraduacao }
  | { readonly tipo: 'tabela-do-ponto'; readonly indice: number }
  | { readonly tipo: 'nome-da-regra'; readonly indice: number }
  | { readonly tipo: 'escolher-regra' };

/** Número para um campo de diálogo, com vírgula decimal. */
function paraCampo(valor: number): string {
  return String(valor).replace('.', ',');
}

type FerramentaDeMedida = 'medir-distancia' | 'medir-perimetro' | 'comparar-perimetros' | 'comparar-distancias';
type FerramentaDeCota = FerramentaDeCotaPorPontos | 'cota-perimetro';

function ehFerramentaDeCotaPorPontos(modo: ModoDeDesenho): modo is FerramentaDeCotaPorPontos {
  return modo === 'cota-distancia' || modo === 'cota-horizontal-vertical' || modo === 'cota-angulo';
}

function mesmoPonto(a: Ponto2D, b: Ponto2D): boolean {
  return a.x === b.x && a.y === b.y;
}

function novoProjetoVazio(estadoInicial: EstadoDoProjeto, nome = 'Projeto sem título'): Projeto {
  const agora = new Date().toISOString();
  const id = `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return criarProjeto(nome, id, gerarCodigoDeProjeto(agora, 1), agora, estadoInicial);
}

export default function App(): React.JSX.Element {
  const [pecas, setPecas] = useState<Molde[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [idsSelecionadosEmLote, setIdsSelecionadosEmLote] = useState<ReadonlySet<string>>(new Set());
  const [clipboard, setClipboard] = useState<Molde | null>(null);
  const [transform, setTransform] = useState<TransformacaoDeTela>(() =>
    enquadrarRetanguloDoMundo({ minX: 0, minY: 0, maxX: 1500, maxY: 3000 }, TAMANHO_PROVISORIO_DA_TELA),
  );
  const [tamanhoDaTela, setTamanhoDaTela] = useState<{ readonly largura: number; readonly altura: number }>(
    TAMANHO_PROVISORIO_DA_TELA,
  );
  const vistaInicialEnquadradaRef = useRef(false);
  const [vistasAnteriores, setVistasAnteriores] = useState<readonly TransformacaoDeTela[]>([]);
  const [vistasSeguintes, setVistasSeguintes] = useState<readonly TransformacaoDeTela[]>([]);
  const [ferramentaDeVista, setFerramentaDeVista] = useState<FerramentaDeVista | null>(null);
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [imaAtivo, setImaAtivo] = useState(false);
  const [unidadeDaRegua, setUnidadeDaRegua] = useState<UnidadeDeRegua>('cm');
  const [cursorMundo, setCursorMundo] = useState<Ponto2D | null>(null);

  const [passado, setPassado] = useState<Molde[][]>([]);
  const [futuro, setFuturo] = useState<Molde[][]>([]);

  const [mostrarListaDePecas, setMostrarListaDePecas] = useState(true);
  const [mostrarBarraDeVisualizacao, setMostrarBarraDeVisualizacao] = useState(true);

  const [cerca, setCerca] = useState<Cerca | null>(null);
  const [mostrarMoverCerca, setMostrarMoverCerca] = useState(false);
  // Fica aqui, e não no diálogo, porque o desenho destaca só os pontos das
  // categorias marcadas — o que o próximo "Mover cerca" vai mover.
  const [opcoesDaCerca, setOpcoesDaCerca] = useState<OpcoesDeMoverCerca>(TODAS_AS_OPCOES_DA_CERCA);
  // Para desfazer/refazer um "Mover cerca" levar a cerca junto com as peças:
  // a chave é a lista de peças que ficou valendo depois do movimento.
  const movimentosDeCercaRef = useRef(new WeakMap<readonly Molde[], { readonly antes: Cerca; readonly depois: Cerca }>());
  // "Modificar" com medida exata: os vértices indicados no desenho, enquanto o diálogo está aberto.
  const [pontosParaModificar, setPontosParaModificar] = useState<readonly number[] | null>(null);
  // "Redefinir perímetro": fica aqui, e não no diálogo, porque o desenho
  // destaca a aresta escolhida e a ponta que anda.
  const [redefinicaoDePerimetro, setRedefinicaoDePerimetro] = useState<RedefinicaoDePerimetro | null>(null);
  // O modo usado no último "Redefinir perímetro" vem marcado no próximo.
  const ultimoModoDeRedefinirRef = useRef<RedefinicaoDePerimetro['modo']>('uni-direcional');
  const [painelDeAjuda, setPainelDeAjuda] = useState<ConteudoDaAjuda | null>(null);
  // Pontos de restauração (aba Início): a forma guardada de cada peça, pelo
  // id. Valem enquanto o projeto está aberto; não vão para o arquivo.
  const [pontosDeRestauracao, setPontosDeRestauracao] = useState<ReadonlyMap<string, Molde>>(new Map());
  const [mostrarCostura, setMostrarCostura] = useState(false);
  const [mostrarInformacoesDosMoldes, setMostrarInformacoesDosMoldes] = useState(false);
  // Medidas da aba Conferência: só leitura, somem ao sair da ferramenta.
  const [medicao, setMedicao] = useState<EstadoDeMedicao>(SEM_MEDICAO);
  // Peça que vai guardar a cota em construção: a do primeiro clique.
  const [donoDaCota, setDonoDaCota] = useState<string | null>(null);
  const [mostrarVariantes, setMostrarVariantes] = useState(false);
  // Ferramentas de curva e arco (aba Construção): o trecho do contorno sendo
  // indicado, o diálogo que a ferramenta abriu e o recado dela na faixa
  // (o que acabou de fazer, ou por que não fez).
  const [trecho, setTrecho] = useState<TrechoEmEdicao>(SEM_TRECHO);
  const [dialogoDeFerramenta, setDialogoDeFerramenta] = useState<DialogoDeFerramenta | null>(null);
  const [recadoDaFerramenta, setRecadoDaFerramenta] = useState<string | null>(null);
  const [curvasDoUsuario, setCurvasDoUsuario] = useState<readonly CurvaCadastrada[]>(() =>
    lerCurvasCadastradas(window.localStorage),
  );
  const [curvaEscolhida, setCurvaEscolhida] = useState<{ readonly curva: CurvaCadastrada; readonly espelhar: boolean } | null>(
    null,
  );
  const [espiralPendente, setEspiralPendente] = useState<{ readonly larguraMm: number; readonly perimetroMm: number } | null>(
    null,
  );
  // Bainha e Unir (aba Produção): o que o diálogo da ferramenta deixou escolhido.
  const [opcoesDeBainha, setOpcoesDeBainha] = useState<OpcoesDeBainha>({ dobras: 1, larguraMm: 30, piques: true });
  const [unirApenasMovendo, setUnirApenasMovendo] = useState(false);
  // Pences e pregas: o que cada diálogo deixou escolhido.
  const [opcoesDasPences, setOpcoesDasPences] = useState<OpcoesDasPences>(OPCOES_INICIAIS_DAS_PENCES);
  // Graduação: as opções dos diálogos, o cadastro de regras deste computador, a
  // regra escolhida em "Regras" e a regra guardada pelo "Copiar" da tabela.
  const [opcoesDaGraduacao, setOpcoesDaGraduacao] = useState<OpcoesDaGraduacao>(OPCOES_INICIAIS_DA_GRADUACAO);
  const [regrasDoUsuario, setRegrasDoUsuario] = useState<readonly RegraCadastrada[]>(() =>
    lerRegrasCadastradas(window.localStorage),
  );
  const [regraEscolhida, setRegraEscolhida] = useState<RegraCadastrada | null>(null);
  const [regraCopiada, setRegraCopiada] = useState<RegraCadastrada | null>(null);
  // Confirmação de uma ação que não muda nada visível no desenho (guardar um
  // ponto de restauração, por exemplo). Vale enquanto as peças e a seleção
  // forem as mesmas de quando foi dada.
  const [aviso, setAviso] = useState<{
    readonly texto: string;
    readonly pecas: readonly Molde[];
    readonly selecionadoId: string | null;
  } | null>(null);

  const [modo, setModo] = useState<ModoDeDesenho>('selecionar');
  // Trocar de ferramenta desliga a Mão/Zoom por janela — o próximo clique é da
  // ferramenta nova — e dispensa o aviso da ação anterior, que senão voltaria
  // a aparecer ao sair da ferramenta.
  const [modoDaFerramentaDeVista, setModoDaFerramentaDeVista] = useState<ModoDeDesenho>(modo);
  if (modo !== modoDaFerramentaDeVista) {
    setModoDaFerramentaDeVista(modo);
    setFerramentaDeVista(null);
    if (aviso) setAviso(null);
  }
  const [pontosEmEdicao, setPontosEmEdicao] = useState<Ponto2D[]>([]);
  const [contornoPendente, setContornoPendente] = useState<Ponto2D[] | null>(null);
  const [mensagensImportacao, setMensagensImportacao] = useState<readonly string[] | null>(null);
  const [importacaoPdfPendente, setImportacaoPdfPendente] = useState<ResultadoContornosPdf | null>(null);
  const [importacaoDxfPendente, setImportacaoDxfPendente] = useState<ResultadoImportacaoDxf | null>(null);

  const [tecido, setTecido] = useState<Tecido | null>(tecidoDeDemonstracao);
  const [enfesto, setEnfesto] = useState<ConfiguracaoDeEnfesto | null>(enfestoDeDemonstracao);
  const [painelAberto, setPainelAberto] = useState<'tecido' | 'enfesto' | null>(null);
  const [mostrarValidacao, setMostrarValidacao] = useState(false);

  const workerDeNestingRef = useRef<Worker | null>(null);
  const [nestingExecutando, setNestingExecutando] = useState(false);
  const [progressoNesting, setProgressoNesting] = useState<{ colocadas: number; total: number } | null>(null);
  const [resultadoNesting, setResultadoNesting] = useState<ResultadoDeNesting | null>(null);
  const [mostrarPainelDeNesting, setMostrarPainelDeNesting] = useState(false);

  const [mostrarExportacaoPdf, setMostrarExportacaoPdf] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [mostrarDimensionar, setMostrarDimensionar] = useState(false);
  const [mostrarPropriedadesDaPeca, setMostrarPropriedadesDaPeca] = useState(false);

  const [projetoAtual, setProjetoAtual] = useState<Projeto>(() =>
    novoProjetoVazio({
      pecas: [],
      tecido: tecidoDeDemonstracao(),
      enfesto: enfestoDeDemonstracao(),
    }),
  );
  const [projetos, setProjetos] = useState<readonly Projeto[]>([]);
  const [mostrarBiblioteca, setMostrarBiblioteca] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [mostrarNovoProjeto, setMostrarNovoProjeto] = useState(false);

  const problemasDeValidacao = useMemo(() => validarProjeto(pecas, enfesto), [pecas, enfesto]);
  const aproveitamentoAtualDaMesa = useMemo(() => aproveitamentoDaMesa(pecas, enfesto), [pecas, enfesto]);
  const idsComErro = useMemo(
    () =>
      new Set(
        problemasDeValidacao.filter((p) => p.severidade === 'erro').flatMap((p) => p.pecasEnvolvidasIds),
      ),
    [problemasDeValidacao],
  );

  const persistirProjeto = useCallback((projeto: Projeto) => {
    void window.enfestoCad?.salvarProjeto(projeto).catch(() => {
      // Falha ao persistir (ex.: disco cheio) não deve travar a edição —
      // o usuário ainda tem o estado em memória e pode tentar salvar de novo.
    });
  }, []);

  const registrarEventoEPersistir = useCallback(
    (tipo: TipoDeEvento, estado: EstadoDoProjeto, descricao?: string) => {
      setProjetoAtual((atual) => {
        const atualizado = registrarEvento(atual, tipo, estado, new Date().toISOString(), descricao);
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );

  const carregarListaDeProjetos = useCallback(() => {
    void window.enfestoCad
      ?.listarProjetos()
      .then((lista) => setProjetos(lista))
      .catch(() => setProjetos([]));
  }, []);

  const aplicarMudanca = useCallback(
    (novasPecas: Molde[]) => {
      setPassado((p) => [...p, pecas]);
      setFuturo([]);
      setPecas(novasPecas);
    },
    [pecas],
  );

  // Desfazer/refazer um "Mover cerca" também devolve a cerca à posição
  // correspondente — mas só se ela ainda estiver onde o movimento a deixou
  // (uma cerca redefinida ou removida depois disso fica como está).
  const desfazer = useCallback(() => {
    const anterior = passado.at(-1);
    if (!anterior) return;
    const movimento = movimentosDeCercaRef.current.get(pecas);
    if (movimento && mesmaCerca(cerca, movimento.depois)) setCerca(movimento.antes);
    setPassado((p) => p.slice(0, -1));
    setFuturo((f) => [...f, pecas]);
    setPecas(anterior);
  }, [pecas, passado, cerca]);

  const refazer = useCallback(() => {
    const proximo = futuro.at(-1);
    if (!proximo) return;
    const movimento = movimentosDeCercaRef.current.get(proximo);
    if (movimento && mesmaCerca(cerca, movimento.antes)) setCerca(movimento.depois);
    setFuturo((f) => f.slice(0, -1));
    setPassado((p) => [...p, pecas]);
    setPecas(proximo);
  }, [pecas, futuro, cerca]);

  // Seleção única "de verdade" (limpa qualquer seleção em lote ativa) — usada
  // sempre que o usuário escolhe UMA peça de propósito (clique no canvas ou
  // na lista), para não deixar os dois modos de seleção coexistindo de forma
  // confusa.
  const selecionarUnico = useCallback((id: string | null) => {
    setSelecionadoId(id);
    setIdsSelecionadosEmLote(new Set());
  }, []);

  /** Duplo-clique numa peça (lista ou canvas): seleciona e abre o diálogo de Propriedades. */
  const abrirPropriedadesDaPeca = useCallback(
    (id: string) => {
      selecionarUnico(id);
      setMostrarPropriedadesDaPeca(true);
    },
    [selecionarUnico],
  );

  const selecionarTudo = useCallback(() => {
    if (pecas.length === 0) return;
    setIdsSelecionadosEmLote(new Set(pecas.map((p) => p.id)));
    setSelecionadoId(null);
  }, [pecas]);

  /** Caixa de seleção de cada item da lista: inclui/remove da seleção em lote, sem mexer na seleção única (`selecionadoId`). */
  const alternarSelecaoEmLote = useCallback((id: string) => {
    setIdsSelecionadosEmLote((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const excluirSelecionado = useCallback(() => {
    if (idsSelecionadosEmLote.size > 0) {
      aplicarMudanca(pecas.filter((p) => !idsSelecionadosEmLote.has(p.id)));
      setIdsSelecionadosEmLote(new Set());
      return;
    }
    if (!selecionadoId) return;
    aplicarMudanca(pecas.filter((p) => p.id !== selecionadoId));
    setSelecionadoId(null);
  }, [pecas, selecionadoId, idsSelecionadosEmLote, aplicarMudanca]);

  const duplicarSelecionado = useCallback(() => {
    if (idsSelecionadosEmLote.size > 0) {
      const copias = pecas
        .filter((p) => idsSelecionadosEmLote.has(p.id))
        .map((p) => transladarMolde(p, ponto(30, 30), proximoId()));
      if (copias.length === 0) return;
      aplicarMudanca([...pecas, ...copias]);
      setIdsSelecionadosEmLote(new Set(copias.map((c) => c.id)));
      return;
    }
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    const copia = transladarMolde(original, ponto(30, 30), proximoId());
    aplicarMudanca([...pecas, copia]);
    setSelecionadoId(copia.id);
  }, [pecas, selecionadoId, idsSelecionadosEmLote, aplicarMudanca]);

  const copiarSelecionado = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    setClipboard(original);
  }, [pecas, selecionadoId]);

  const recortarSelecionado = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    setClipboard(original);
    aplicarMudanca(pecas.filter((p) => p.id !== selecionadoId));
    setSelecionadoId(null);
  }, [pecas, selecionadoId, aplicarMudanca]);

  const colar = useCallback(() => {
    if (!clipboard) return;
    const copia = transladarMolde(clipboard, ponto(30, 30), proximoId());
    aplicarMudanca([...pecas, copia]);
    setSelecionadoId(copia.id);
    setIdsSelecionadosEmLote(new Set());
  }, [pecas, clipboard, aplicarMudanca]);

  const novoProjeto = useCallback(() => {
    if (pecas.length > 0 && !window.confirm('Começar um novo projeto descarta as peças atuais não salvas da tela (o projeto anterior continua na biblioteca, se já foi salvo). Continuar?')) {
      return;
    }
    setMostrarNovoProjeto(true);
  }, [pecas]);

  const criarNovoProjetoComDados = useCallback((dados: DadosDeNovoProjeto) => {
    const enfestoInicial = criarConfiguracaoDeEnfesto({
      tipo: 'impar',
      larguraUtilMm: dados.larguraUtilMm,
      comprimentoMm: dados.comprimentoMm,
      quantidadeDeCamadas: 1,
      margemLateralMm: 0,
      margemDeExtremidadeMm: 0,
      distanciaMinimaEntrePecasMm: 5,
    } as ConfiguracaoDeEnfesto);
    const tecidoInicial = criarTecido(
      {
        nome: dados.tecidoNome,
        referencia: '',
        larguraTotalMm: dados.tecidoLarguraMm,
        larguraUtilMm: dados.tecidoLarguraMm,
        ...(dados.tecidoGramaturaGm2 !== undefined ? { gramaturaGm2: dados.tecidoGramaturaGm2 } : {}),
        ...(dados.tecidoQuantidadeDisponivelKg !== undefined
          ? { quantidadeDisponivelKg: dados.tecidoQuantidadeDisponivelKg }
          : {}),
        ...(dados.tecidoDescricao !== undefined ? { observacoes: dados.tecidoDescricao } : {}),
      },
      `tecido-${Date.now().toString(36)}`,
    );
    setPecas([]);
    setTecido(tecidoInicial);
    setEnfesto(enfestoInicial);
    setSelecionadoId(null);
    setIdsSelecionadosEmLote(new Set());
    setModo('selecionar');
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setPassado([]);
    setFuturo([]);
    setPontosDeRestauracao(new Map());
    setMedicao(SEM_MEDICAO);
    setAviso(null);
    setCerca(null);
    setMostrarMoverCerca(false);
    setProjetoAtual(novoProjetoVazio({ pecas: [], tecido: tecidoInicial, enfesto: enfestoInicial }, dados.nome));
    setMostrarNovoProjeto(false);

    // Enquadra a mesa nova inteira na tela. Eixos trocados na tela (ver
    // comentário em ui/transformacaoDeTela.ts): comprimento ocupa a
    // horizontal, largura a vertical — a mesa sempre aparece deitada, sem
    // depender de qual das duas medidas o usuário informou maior. As vistas
    // guardadas eram da mesa anterior e deixam de valer.
    setTransform(
      enquadrarRetanguloDoMundo(
        { minX: 0, minY: 0, maxX: enfestoInicial.larguraUtilMm, maxY: enfestoInicial.comprimentoMm },
        tamanhoDaTela,
      ),
    );
    setVistasAnteriores([]);
    setVistasSeguintes([]);
  }, [tamanhoDaTela]);

  const salvarProjetoAtual = useCallback(() => {
    registrarEventoEPersistir('salvamento', { pecas, tecido, enfesto });
  }, [pecas, tecido, enfesto, registrarEventoEPersistir]);

  const salvarComo = useCallback(() => {
    const nome = window.prompt('Nome do novo projeto:', `${projetoAtual.nome} (cópia)`);
    if (!nome) return;
    const novo = novoProjetoVazio({ pecas, tecido, enfesto });
    const renomeado = renomearProjeto(novo, nome, new Date().toISOString());
    setProjetoAtual(renomeado);
    persistirProjeto(renomeado);
  }, [pecas, tecido, enfesto, projetoAtual.nome, persistirProjeto]);

  const abrirBiblioteca = useCallback(() => {
    carregarListaDeProjetos();
    setMostrarBiblioteca(true);
  }, [carregarListaDeProjetos]);

  /** Põe na tela um projeto já carregado, com tudo o que era do anterior limpo e a vista enquadrada. */
  const mostrarProjeto = useCallback(
    (projeto: Projeto) => {
      setPecas([...projeto.estadoAtual.pecas]);
      setTecido(projeto.estadoAtual.tecido);
      setEnfesto(projeto.estadoAtual.enfesto);
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set());
      // Um contorno pela metade era do projeto anterior.
      setModo('selecionar');
      setPontosEmEdicao([]);
      setContornoPendente(null);
      setPassado([]);
      setFuturo([]);
      setPontosDeRestauracao(new Map());
      setMedicao(SEM_MEDICAO);
      setAviso(null);
      setCerca(null);
      setMostrarMoverCerca(false);
      setProjetoAtual(projeto);
      setMostrarBiblioteca(false);
      // Enquadra o projeto aberto, como "Ajustar à tela". As vistas guardadas
      // eram do projeto anterior e deixam de valer.
      const retangulo = retanguloDoDesenho(projeto.estadoAtual.pecas, projeto.estadoAtual.enfesto);
      if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela));
      setVistasAnteriores([]);
      setVistasSeguintes([]);
    },
    [tamanhoDaTela],
  );

  const abrirProjeto = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (projeto) mostrarProjeto(projeto);
    },
    [projetos, mostrarProjeto],
  );

  // Variantes (aba Modelo): cópias do projeto aberto, guardadas na Biblioteca.
  const abrirVariantes = useCallback(() => {
    carregarListaDeProjetos();
    setMostrarVariantes(true);
  }, [carregarListaDeProjetos]);

  /** Salva o projeto aberto como está, para trocar de projeto sem perder o que não foi salvo. */
  const salvarAntesDeTrocar = useCallback((): Projeto => {
    const salvo = registrarEvento(projetoAtual, 'salvamento', { pecas, tecido, enfesto }, new Date().toISOString());
    persistirProjeto(salvo);
    return salvo;
  }, [projetoAtual, pecas, tecido, enfesto, persistirProjeto]);

  const criarVarianteDoProjeto = useCallback(
    (nome: string): string | null => {
      const salvo = salvarAntesDeTrocar();
      const agora = new Date().toISOString();
      const variante = criarVariante(
        salvo,
        nome,
        `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        gerarCodigoDeProjeto(agora, 1),
        agora,
        { pecas, tecido, enfesto },
      );
      persistirProjeto(variante);
      // A lista já fica certa na tela, sem esperar a releitura do disco.
      setProjetos((lista) => [...lista.filter((p) => p.id !== salvo.id), salvo, variante]);
      mostrarProjeto(variante);
      return null;
    },
    [pecas, tecido, enfesto, salvarAntesDeTrocar, persistirProjeto, mostrarProjeto],
  );

  const abrirVarianteDoProjeto = useCallback(
    (id: string) => {
      const variante = projetos.find((p) => p.id === id);
      if (!variante) return;
      const salvo = salvarAntesDeTrocar();
      setProjetos((lista) => lista.map((p) => (p.id === salvo.id ? salvo : p)));
      mostrarProjeto(variante);
    },
    [projetos, salvarAntesDeTrocar, mostrarProjeto],
  );

  const duplicarProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      const agora = new Date().toISOString();
      const copia = criarProjeto(`${projeto.nome} (cópia)`, `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, gerarCodigoDeProjeto(agora, 1), agora, projeto.estadoAtual);
      persistirProjeto(copia);
      carregarListaDeProjetos();
    },
    [projetos, persistirProjeto, carregarListaDeProjetos],
  );

  const renomearProjetoDaBiblioteca = useCallback(
    (id: string, novoNome: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto || !novoNome.trim()) return;
      const atualizado = renomearProjeto(projeto, novoNome.trim(), new Date().toISOString());
      persistirProjeto(atualizado);
      if (id === projetoAtual.id) setProjetoAtual(atualizado);
      carregarListaDeProjetos();
    },
    [projetos, projetoAtual.id, persistirProjeto, carregarListaDeProjetos],
  );

  const arquivarProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      const atualizado = alterarStatus(projeto, 'arquivado', new Date().toISOString());
      persistirProjeto(atualizado);
      if (id === projetoAtual.id) setProjetoAtual(atualizado);
      carregarListaDeProjetos();
    },
    [projetos, projetoAtual.id, persistirProjeto, carregarListaDeProjetos],
  );

  const excluirProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      if (!window.confirm(`Excluir permanentemente o projeto "${projeto.nome}"? Esta ação não pode ser desfeita.`)) {
        return;
      }
      void window.enfestoCad
        ?.excluirProjeto(id)
        .then(() => {
          carregarListaDeProjetos();
          if (id === projetoAtual.id) {
            setPecas([]);
            setTecido(null);
            setEnfesto(null);
            setSelecionadoId(null);
            setIdsSelecionadosEmLote(new Set());
            setPassado([]);
            setFuturo([]);
            setPontosDeRestauracao(new Map());
            setMedicao(SEM_MEDICAO);
            setAviso(null);
            setCerca(null);
            setMostrarMoverCerca(false);
            setProjetoAtual(novoProjetoVazio({ pecas: [], tecido: null, enfesto: null }));
          }
        })
        .catch(() => window.alert('Falha ao excluir o projeto.'));
    },
    [projetos, projetoAtual.id, carregarListaDeProjetos],
  );

  const restaurarVersaoDoHistorico = useCallback(
    (idDoEvento: string) => {
      const atualizado = restaurarVersao(projetoAtual, idDoEvento, new Date().toISOString());
      setPecas([...atualizado.estadoAtual.pecas]);
      setTecido(atualizado.estadoAtual.tecido);
      setEnfesto(atualizado.estadoAtual.enfesto);
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set());
      setPassado([]);
      setFuturo([]);
      setPontosDeRestauracao(new Map());
      setMedicao(SEM_MEDICAO);
      setAviso(null);
      setCerca(null);
      setMostrarMoverCerca(false);
      setProjetoAtual(atualizado);
      persistirProjeto(atualizado);
    },
    [projetoAtual, persistirProjeto],
  );

  // Histórico de vistas ("Vista anterior"/"Próxima vista"): cada mudança de
  // enquadramento feita pelo usuário guarda a vista de antes. A área de
  // desenho chama `guardarVista` antes de mão, roda e zoom por janela; os
  // comandos daqui passam por `mudarVistaPara`.
  const guardarVista = useCallback(() => {
    setVistasAnteriores((pilha) => empilharVista(pilha, transform));
    setVistasSeguintes([]);
  }, [transform]);

  const mudarVistaPara = useCallback(
    (nova: TransformacaoDeTela) => {
      if (mesmaVista(nova, transform)) return;
      guardarVista();
      setTransform(nova);
    },
    [transform, guardarVista],
  );

  const vistaAnterior = useCallback(() => {
    const anterior = vistasAnteriores.at(-1);
    if (!anterior) return;
    setVistasAnteriores((pilha) => pilha.slice(0, -1));
    setVistasSeguintes((pilha) => [...pilha, transform]);
    setTransform(anterior);
  }, [vistasAnteriores, transform]);

  const proximaVista = useCallback(() => {
    const proxima = vistasSeguintes.at(-1);
    if (!proxima) return;
    setVistasSeguintes((pilha) => pilha.slice(0, -1));
    setVistasAnteriores((pilha) => empilharVista(pilha, transform));
    setTransform(proxima);
  }, [vistasSeguintes, transform]);

  /** Zoom pelos botões e teclas: em torno do centro da área de desenho. */
  const zoom = useCallback(
    (fator: number) => {
      mudarVistaPara(aplicarZoom(transform, fator, { x: tamanhoDaTela.largura / 2, y: tamanhoDaTela.altura / 2 }));
    },
    [transform, tamanhoDaTela, mudarVistaPara],
  );

  const ajustarTela = useCallback(() => {
    // Sem peças nem enfesto configurados, não há nada real para enquadrar —
    // mantém o reset antigo. Com enfesto configurado, a mesa real (mesmo
    // vazia) é o retângulo de referência, para aparecer inteira e retangular
    // assim que o projeto é criado, sem precisar de "Ajustar" manual.
    const retangulo = retanguloDoDesenho(pecas, enfesto);
    mudarVistaPara(
      retangulo
        ? enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela)
        : { escalaPxPorMm: 1, offsetXPx: 80, offsetYPx: 80 },
    );
  }, [pecas, enfesto, tamanhoDaTela, mudarVistaPara]);

  // A área de desenho avisa o tamanho real assim que é montada (e a cada
  // redimensionamento). Na primeira medida de verdade, a vista inicial —
  // calculada antes, com um tamanho provisório — é refeita para esse
  // tamanho, uma vez só: depois disso, redimensionar a janela não mexe no
  // enquadramento que o usuário escolheu.
  const aoMudarTamanhoDaTela = useCallback(
    (tamanho: { readonly largura: number; readonly altura: number }) => {
      setTamanhoDaTela(tamanho);
      if (vistaInicialEnquadradaRef.current || tamanho.largura < 50 || tamanho.altura < 50) return;
      vistaInicialEnquadradaRef.current = true;
      const retangulo = retanguloDoDesenho(pecas, enfesto);
      if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanho));
    },
    [pecas, enfesto],
  );

  const pecaSelecionada = useMemo(() => pecas.find((p) => p.id === selecionadoId) ?? null, [pecas, selecionadoId]);

  const cancelarModo = useCallback(() => {
    setModo('selecionar');
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setFerramentaDeVista(null);
    setPontosParaModificar(null);
    setRedefinicaoDePerimetro(null);
    setMedicao(SEM_MEDICAO);
    setDonoDaCota(null);
    setTrecho(SEM_TRECHO);
    setDialogoDeFerramenta(null);
    setRecadoDaFerramenta(null);
  }, []);

  const alternarFerramentaDeVista = useCallback((ferramenta: FerramentaDeVista) => {
    setFerramentaDeVista((atual) => (atual === ferramenta ? null : ferramenta));
  }, []);

  /** Sem cerca: entra no modo de definir cerca (ou sai dele). Com cerca: remove a cerca. */
  const alternarDefinirCerca = useCallback(() => {
    if (cerca) {
      setCerca(null);
      setMostrarMoverCerca(false);
      return;
    }
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setModo((atual) => (atual === 'definir-cerca' ? 'selecionar' : 'definir-cerca'));
  }, [cerca]);

  const definirCerca = useCallback((nova: Cerca) => {
    setCerca(nova);
    setModo('selecionar');
  }, []);

  const alvosDaCerca = useMemo(
    () => pecasAlvoDaCerca(pecas, idsSelecionadosEmLote, selecionadoId),
    [pecas, idsSelecionadosEmLote, selecionadoId],
  );

  /** Aplica "Mover cerca"; devolve a mensagem de erro (nada muda) ou `null`. A cerca acompanha o movimento. */
  const aplicarMoverCerca = useCallback(
    (delta: Ponto2D, opcoes: OpcoesDeMoverCerca): string | null => {
      if (!cerca) return 'Defina uma cerca primeiro.';
      const alvos = new Set(alvosDaCerca.map((p) => p.id));
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) =>
          alvos.has(p.id) && cercaAfetaMolde(p, cerca, opcoes) ? moverDentroDaCerca(p, cerca, delta, opcoes) : p,
        );
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      const depois = transladarCerca(cerca, delta);
      movimentosDeCercaRef.current.set(novasPecas, { antes: cerca, depois });
      aplicarMudanca(novasPecas);
      setCerca(depois);
      return null;
    },
    [cerca, pecas, alvosDaCerca, aplicarMudanca],
  );

  const entrarModoNovoMolde = useCallback(() => {
    setModo('novo-molde');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, []);

  const entrarModoRetangulo = useCallback(() => {
    setModo('retangulo');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, []);

  const entrarModoSentidoDoFio = useCallback(() => {
    if (!selecionadoId) return;
    setModo('sentido-do-fio');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, [selecionadoId]);

  const entrarModoDeMedida = useCallback((ferramenta: FerramentaDeMedida) => {
    setModo(ferramenta);
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setMedicao(SEM_MEDICAO);
  }, []);

  /** Liga uma ferramenta de desenho da aba Construção, começando do zero. */
  const entrarModoDeConstrucao = useCallback((ferramenta: ModoDeDesenho) => {
    setModo(ferramenta);
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setTrecho(SEM_TRECHO);
    setDialogoDeFerramenta(null);
    setRecadoDaFerramenta(null);
  }, []);

  /** As ferramentas que mexem no contorno precisam de uma peça selecionada. */
  const entrarModoNaPecaSelecionada = useCallback(
    (ferramenta: FerramentaDeTrecho | 'arco-tangente') => {
      if (selecionadoId) entrarModoDeConstrucao(ferramenta);
    },
    [selecionadoId, entrarModoDeConstrucao],
  );

  /** Ferramentas da aba Produção: as que têm opções pedem-nas antes, num diálogo; as outras ligam direto. */
  const usarFerramentaDeMolde = useCallback(
    (ferramenta: FerramentaDeMolde | FerramentaDePence) => {
      if (!selecionadoId) return;
      if (ferramenta === 'bainha' || ferramenta === 'unir') setDialogoDeFerramenta({ tipo: ferramenta });
      else if (ehFerramentaDePence(ferramenta) && dialogoDaPence(ferramenta, opcoesDasPences)) {
        setDialogoDeFerramenta({ tipo: 'pence', ferramenta });
      } else entrarModoDeConstrucao(ferramenta);
    },
    [selecionadoId, opcoesDasPences, entrarModoDeConstrucao],
  );

  const entrarModoDeCota = useCallback((ferramenta: FerramentaDeCota) => {
    setModo(ferramenta);
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setDonoDaCota(null);
  }, []);

  const entrarModoNovoFuro = useCallback(() => {
    if (!selecionadoId) return;
    setModo('novo-furo');
    setPontosEmEdicao([]);
  }, [selecionadoId]);

  const entrarModoPique = useCallback(() => {
    if (!selecionadoId) return;
    setModo('pique');
  }, [selecionadoId]);

  const entrarModoMarca = useCallback(() => {
    if (!selecionadoId) return;
    setModo('marca');
  }, [selecionadoId]);

  const entrarModoMoverPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('mover-ponto');
  }, [selecionadoId]);

  const entrarModoInserirPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('inserir-ponto');
  }, [selecionadoId]);

  const entrarModoExcluirPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('excluir-ponto');
  }, [selecionadoId]);

  const entrarModoArredondarOuChanfrar = useCallback(() => {
    if (!selecionadoId) return;
    setModo('arredondar-ou-chanfrar');
  }, [selecionadoId]);

  const entrarModoModificar = useCallback(() => {
    if (!selecionadoId) return;
    setModo('modificar');
    setPontosParaModificar(null);
  }, [selecionadoId]);

  const entrarModoRedefinirPerimetro = useCallback(() => {
    if (!selecionadoId) return;
    setModo('redefinir-perimetro');
    setRedefinicaoDePerimetro(null);
  }, [selecionadoId]);

  const alterarPecaSelecionada = useCallback(
    (patch: PatchDeMolde) => {
      if (!selecionadoId) return;
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? { ...p, ...patch } : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** Diz, na faixa de mensagens, o que uma ação acabou de fazer — até a próxima mudança nas peças ou na seleção. */
  const avisar = useCallback(
    (texto: string, pecasDepois: readonly Molde[] = pecas) => setAviso({ texto, pecas: pecasDepois, selecionadoId }),
    [pecas, selecionadoId],
  );

  /** "Inverter seleção" (aba Início): passam a estar selecionadas as peças que não estavam. */
  const inverterSelecaoDePecas = useCallback(() => {
    const invertida = inverterSelecao(
      pecas.map((p) => p.id),
      { selecionadoId, idsEmLote: idsSelecionadosEmLote },
    );
    setSelecionadoId(invertida.selecionadoId);
    setIdsSelecionadosEmLote(invertida.idsEmLote);
  }, [pecas, selecionadoId, idsSelecionadosEmLote]);

  /** "Ponto de restauração": guarda a peça selecionada como está agora (troca o ponto anterior dela, se havia). */
  const criarPontoDeRestauracao = useCallback(() => {
    const peca = pecas.find((p) => p.id === selecionadoId);
    if (!peca) return;
    setPontosDeRestauracao((atual) => new Map(atual).set(peca.id, peca));
    avisar(`Ponto de restauração guardado para “${peca.nome}”. “Restaurar” devolve a peça a esta forma.`);
  }, [pecas, selecionadoId, avisar]);

  /** "Restaurar": a peça selecionada volta à forma do ponto de restauração dela, num passo de desfazer. */
  const restaurarSelecionada = useCallback(() => {
    const guardada = selecionadoId ? pontosDeRestauracao.get(selecionadoId) : undefined;
    if (!guardada) return;
    const novasPecas = pecas.map((p) => (p.id === selecionadoId ? restaurarFormaDoMolde(p, guardada) : p));
    aplicarMudanca(novasPecas);
    avisar(`“${guardada.nome}” voltou à forma do ponto de restauração.`, novasPecas);
  }, [pecas, selecionadoId, pontosDeRestauracao, aplicarMudanca, avisar]);

  // "Costura", "Remover costura" e "Converter em costura" agem nas peças
  // marcadas em lote ou, sem lote, na selecionada — a regra de Excluir.
  const alvosDeCostura = useMemo(
    () =>
      idsSelecionadosEmLote.size > 0
        ? pecas.filter((p) => idsSelecionadosEmLote.has(p.id))
        : pecas.filter((p) => p.id === selecionadoId),
    [pecas, idsSelecionadosEmLote, selecionadoId],
  );

  /** Define a margem de costura dos alvos; devolve a mensagem de erro (nada muda) ou `null`. */
  const aplicarCostura = useCallback(
    (margemMm: number): string | null => {
      const alvos = new Set(alvosDeCostura.map((p) => p.id));
      if (alvos.size === 0) return 'Selecione uma peça primeiro.';
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) => (alvos.has(p.id) ? definirMargemDeCostura(p, margemMm) : p));
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      aplicarMudanca(novasPecas);
      return null;
    },
    [pecas, alvosDeCostura, aplicarMudanca],
  );

  const removerCostura = useCallback(() => {
    const comCostura = alvosDeCostura.filter((p) => p.margemDeCosturaMm > 0);
    if (comCostura.length === 0) return;
    const ids = new Set(comCostura.map((p) => p.id));
    const novasPecas = pecas.map((p) => (ids.has(p.id) ? definirMargemDeCostura(p, 0) : p));
    aplicarMudanca(novasPecas);
    avisar(
      comCostura.length === 1
        ? `Costura removida de “${comCostura[0]!.nome}”.`
        : `Costura removida de ${comCostura.length} peças.`,
      novasPecas,
    );
  }, [pecas, alvosDeCostura, aplicarMudanca, avisar]);

  /** "Converter em contorno": a linha de corte das peças selecionadas vira o contorno, e a costura volta a zero. */
  /**
   * Ferramentas da aba Graduação. "Tabela" começa pelos tamanhos; "Unir" age
   * na hora; as que têm opções pedem-nas antes; as outras ligam direto.
   */
  const usarFerramentaDeGraduacao = useCallback(
    (ferramenta: FerramentaDeGraduacao) => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return;
      if (ferramenta === 'graduar-tabela') {
        setDialogoDeFerramenta({ tipo: 'tamanhos' });
        return;
      }
      if (ferramenta === 'unir-tamanhos') {
        try {
          const resultado = aplicarUnir(pecas, peca, idsSelecionadosEmLote);
          const novasPecas = [...resultado.pecas];
          aplicarMudanca(novasPecas);
          setIdsSelecionadosEmLote(new Set());
          avisar(resultado.recado, novasPecas);
        } catch (e) {
          avisar(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (!peca.graduacao) return;
      if (ferramenta === 'graduar-regras') setDialogoDeFerramenta({ tipo: 'escolher-regra' });
      else if (dialogoDaGraduacao(ferramenta, opcoesDaGraduacao, peca)) setDialogoDeFerramenta({ tipo: 'graduacao', ferramenta });
      else if (ehModoDeGraduacao(ferramenta)) entrarModoDeConstrucao(ferramenta);
    },
    [pecas, selecionadoId, idsSelecionadosEmLote, opcoesDaGraduacao, aplicarMudanca, avisar, entrarModoDeConstrucao],
  );

  const excluirRegraCadastrada = useCallback(
    (id: string) => {
      const novas = regrasDoUsuario.filter((r) => r.id !== id);
      gravarRegrasCadastradas(window.localStorage, novas);
      setRegrasDoUsuario(novas);
      if (regraEscolhida?.id === id) setRegraEscolhida(null);
    },
    [regrasDoUsuario, regraEscolhida],
  );

  const converterEmContorno = useCallback(() => {
    const comCostura = alvosDeCostura.filter((p) => p.margemDeCosturaMm > 0);
    if (comCostura.length === 0) return;
    const ids = new Set(comCostura.map((p) => p.id));
    const novasPecas = pecas.map((p) => (ids.has(p.id) ? converterCosturaEmContorno(p) : p));
    aplicarMudanca(novasPecas);
    avisar(
      comCostura.length === 1
        ? `A linha de corte de “${comCostura[0]!.nome}” virou o contorno; a costura voltou a zero.`
        : `A linha de corte de ${comCostura.length} peças virou o contorno; a costura voltou a zero.`,
      novasPecas,
    );
  }, [pecas, alvosDeCostura, aplicarMudanca, avisar]);

  /**
   * Põe a linha nova no lugar do trecho indicado na peça selecionada. Devolve
   * a mensagem de erro (nada muda) ou `null`. De um jeito ou de outro a
   * ferramenta volta a esperar um trecho novo.
   */
  const aplicarTrecho = useCallback(
    (ferramenta: FerramentaDeTrecho, estado: TrechoEmEdicao, opcoes: OpcoesDoTrecho = {}): string | null => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      setTrecho(SEM_TRECHO);
      if (!peca || !estado.inicio || !estado.fim) return 'Selecione uma peça e indique o trecho no contorno dela.';
      try {
        const linha = linhaNovaDoTrecho(ferramenta, peca.contorno, estado.inicio, estado.fim.ponto, estado.livres, opcoes, estado.fim);
        if (!linha) return 'Faltam pontos para montar a curva.';
        const nova = substituirTrechoDoMolde(peca, estado.inicio, estado.fim, linha.slice(1, -1));
        aplicarMudanca(pecas.map((p) => (p.id === peca.id ? nova : p)));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const curvasDisponiveis = useMemo(() => [...CURVAS_DE_FABRICA, ...curvasDoUsuario], [curvasDoUsuario]);

  /** Guarda no cadastro a forma do trecho indicado; devolve a mensagem de erro ou `null`. */
  const cadastrarCurva = useCallback(
    (nome: string, inicio: PosicaoNoContorno, fim: PosicaoNoContorno): string | null => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return 'Selecione uma peça primeiro.';
      try {
        const curva = curvaDoTrecho(proximoId(), nome, caminhoDoTrecho(peca.contorno, inicio, fim));
        const novas = [...curvasDoUsuario, curva];
        if (!gravarCurvasCadastradas(window.localStorage, novas)) return 'Não foi possível guardar a curva neste computador.';
        setCurvasDoUsuario(novas);
        setRecadoDaFerramenta(`Curva “${curva.nome}” cadastrada: está em “Pré-definida”.`);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, selecionadoId, curvasDoUsuario],
  );

  const excluirCurvaCadastrada = useCallback(
    (id: string) => {
      const novas = curvasDoUsuario.filter((c) => c.id !== id);
      gravarCurvasCadastradas(window.localStorage, novas);
      setCurvasDoUsuario(novas);
      if (curvaEscolhida?.curva.id === id) setCurvaEscolhida(null);
    },
    [curvasDoUsuario, curvaEscolhida],
  );

  const girarPecaSelecionada = useCallback(
    (anguloGraus: number) => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return;
      const anguloResultante = peca.anguloDeRotacaoGraus + anguloGraus;
      if (!rotacaoEhPermitida(peca.restricaoDeRotacao, anguloResultante)) {
        const permitidas = rotacoesPermitidas(peca.restricaoDeRotacao)
          .map((r) => `${r}°`)
          .join(', ');
        window.alert(
          `Rotação de ${anguloGraus}° não permitida para "${peca.nome}" — violaria o sentido do fio.\n` +
            `Rotações permitidas para esta peça: ${permitidas}.\n` +
            `Para permitir mais rotações, use as caixas "Permitir 180°"/"Permitir 90°/270°" nas propriedades da peça.`,
        );
        return;
      }
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? rotacionarMolde(p, anguloGraus) : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  // Ferramentas de edição de forma (aba "Manipulação", seção 5 continua
  // valendo: nada aqui reordena automaticamente sentido do fio — são ações
  // manuais e explícitas do usuário sobre a peça selecionada).
  const moverVariosPontosDaSelecionada = useCallback(
    (indices: readonly number[], delta: Ponto2D) => {
      if (!selecionadoId) return;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? moverVariosPontosDoMolde(p, indices, delta) : p)),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Modificar" com medida exata nos vértices indicados; devolve a mensagem de erro (nada muda) ou `null`. */
  const aplicarModificar = useCallback(
    (indices: readonly number[], delta: Ponto2D): string | null => {
      if (!selecionadoId) return 'Selecione uma peça primeiro.';
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) => (p.id === selecionadoId ? modificarPontosDoMolde(p, indices, delta) : p));
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      aplicarMudanca(novasPecas);
      return null;
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Redefinir perímetro" de uma aresta da peça selecionada; devolve a mensagem de erro (nada muda) ou `null`. */
  const aplicarRedefinirPerimetro = useCallback(
    (indiceAresta: number, novoComprimentoMm: number, ponta: PontaDaAresta): string | null => {
      if (!selecionadoId) return 'Selecione uma peça primeiro.';
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) =>
          p.id === selecionadoId ? redefinirComprimentoDaAresta(p, indiceAresta, novoComprimentoMm, ponta) : p,
        );
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      aplicarMudanca(novasPecas);
      return null;
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** Clique numa aresta em "Redefinir perímetro": a ponta mais perto do clique vem marcada para andar. */
  const indicarArestaParaRedefinir = useCallback((indiceAresta: number, extremidade: 'inicio' | 'fim') => {
    setRedefinicaoDePerimetro({ indiceAresta, extremidade, modo: ultimoModoDeRedefinirRef.current });
  }, []);

  const alterarRedefinicaoDePerimetro = useCallback((redefinicao: RedefinicaoDePerimetro) => {
    ultimoModoDeRedefinirRef.current = redefinicao.modo;
    setRedefinicaoDePerimetro(redefinicao);
  }, []);

  const arestaEmDestaque = useMemo<{ readonly indiceAresta: number; readonly ponta: PontaDaAresta } | null>(
    () =>
      redefinicaoDePerimetro && modo === 'redefinir-perimetro'
        ? {
            indiceAresta: redefinicaoDePerimetro.indiceAresta,
            ponta: redefinicaoDePerimetro.modo === 'bi-direcional' ? 'ambas' : redefinicaoDePerimetro.extremidade,
          }
        : null,
    [redefinicaoDePerimetro, modo],
  );

  const inserirPontoNaSelecionada = useCallback(
    (indiceAresta: number, novoPonto: Ponto2D) => {
      if (!selecionadoId) return;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? inserirPontoNoMolde(p, indiceAresta, novoPonto) : p)),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const excluirPontoDaSelecionada = useCallback(
    (indice: number) => {
      if (!selecionadoId) return;
      try {
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? removerPontoDoMolde(p, indice) : p)));
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Arredondar ou chanfrar" (um único botão, como no Audaces): pergunta qual das duas operações, depois o valor em mm. */
  const arredondarOuChanfrarVerticeDaSelecionada = useCallback(
    (indice: number) => {
      if (!selecionadoId) return;
      const escolha = window.prompt('Arredondar ou chanfrar este canto? Digite "A" para arredondar ou "C" para chanfrar:', 'A');
      if (escolha === null) return;
      const normalizado = escolha.trim().toUpperCase();
      if (normalizado !== 'A' && normalizado !== 'C') {
        window.alert('Opção inválida — digite "A" (arredondar) ou "C" (chanfrar).');
        return;
      }
      const arredondando = normalizado === 'A';
      const texto = window.prompt(arredondando ? 'Raio do arredondamento (mm):' : 'Distância do chanfro (mm):', '10');
      if (texto === null) return;
      const valorMm = Number.parseFloat(texto);
      if (!Number.isFinite(valorMm) || valorMm <= 0) {
        window.alert('Valor inválido — informe um número maior que zero.');
        return;
      }
      try {
        aplicarMudanca(
          pecas.map((p) =>
            p.id === selecionadoId
              ? arredondando
                ? arredondarCantoDoMolde(p, indice, valorMm)
                : chanfrarCantoDoMolde(p, indice, valorMm)
              : p,
          ),
        );
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const dimensionarSelecionada = useCallback(
    (fatorX: number, fatorY: number, comoCopia: boolean) => {
      const original = pecas.find((p) => p.id === selecionadoId);
      if (!original) return;
      if (comoCopia) {
        const copia = dimensionarMolde({ ...original, id: proximoId() }, fatorX, fatorY);
        aplicarMudanca([...pecas, copia]);
        setSelecionadoId(copia.id);
        return;
      }
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? dimensionarMolde(p, fatorX, fatorY) : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const espelharSelecionadaManualmente = useCallback(() => {
    if (!selecionadoId) return;
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? espelharMolde(p, p.id) : p)));
  }, [pecas, selecionadoId, aplicarMudanca]);

  /**
   * Girar em ângulo livre (diferente dos botões 90°/180°/270°, que ficam
   * bloqueados pela restrição de sentido do fio): é uma ferramenta de
   * EDIÇÃO de forma, não uma decisão de encaixe — o usuário está ajustando
   * como a peça foi desenhada, então não faz sentido validar contra
   * `restricaoDeRotacao` (que é sobre quais orientações o MOTOR de nesting
   * pode tentar a partir de como a peça já está). Por isso avisa
   * explicitamente que isto redefine o ângulo de referência da peça, em vez
   * de bloquear ou de aplicar silenciosamente.
   */
  const girarLivreSelecionada = useCallback(() => {
    if (!selecionadoId) return;
    const texto = window.prompt(
      'Ângulo de rotação livre (graus, sentido anti-horário):\n' +
        'Isto redefine a orientação de referência desta peça — confira se a linha de fio (seta vermelha) continua alinhada ao sentido correto do tecido depois de girar.',
      '0',
    );
    if (texto === null) return;
    const anguloGraus = Number.parseFloat(texto);
    if (!Number.isFinite(anguloGraus) || anguloGraus === 0) {
      if (texto.trim() !== '' && texto.trim() !== '0') window.alert('Ângulo inválido.');
      return;
    }
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? rotacionarMolde(p, anguloGraus) : p)));
  }, [pecas, selecionadoId, aplicarMudanca]);

  /**
   * Alinha as peças selecionadas em lote pela borda esquerda (mínimo X do
   * retângulo envolvente — largura da mesa, eixo vertical na tela) comum,
   * útil para organizar peças manualmente antes do encaixe automático.
   */
  const alinharSelecionadas = useCallback(() => {
    if (idsSelecionadosEmLote.size < 2) return;
    const selecionadas = pecas.filter((p) => idsSelecionadosEmLote.has(p.id));
    const minXComum = Math.min(...selecionadas.map((p) => retanguloEnvolvente(p.contorno).minX));
    aplicarMudanca(
      pecas.map((p) => {
        if (!idsSelecionadosEmLote.has(p.id)) return p;
        const minXAtual = retanguloEnvolvente(p.contorno).minX;
        const deslocamento = { x: minXComum - minXAtual, y: 0 };
        return transladarMolde(p, deslocamento, p.id);
      }),
    );
  }, [pecas, idsSelecionadosEmLote, aplicarMudanca]);

  /**
   * "Elemento paralelo": cria uma NOVA peça com o contorno deslocado
   * uniformemente (reaproveita a mesma função de deslocamento da margem de
   * costura, `deslocarContornoParaFora` — distância negativa desloca para
   * dentro). Furos/piques/marcas não são copiados para a peça nova, porque
   * suas posições absolutas ficariam incoerentes com o contorno deslocado
   * (mesmo cuidado já documentado para `dimensionarMolde`/edição de pontos).
   */
  const criarElementoParaleloDaSelecionada = useCallback(() => {
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    const texto = window.prompt(
      'Distância do elemento paralelo (mm; positivo = para fora, negativo = para dentro):',
      '10',
    );
    if (texto === null) return;
    const distanciaMm = Number.parseFloat(texto);
    if (!Number.isFinite(distanciaMm) || distanciaMm === 0) {
      window.alert('Distância inválida — informe um número diferente de zero.');
      return;
    }
    try {
      const novoContorno = deslocarContornoParaFora(original.contorno, distanciaMm);
      const novaPeca = criarMolde(
        {
          nome: `${original.nome} (paralelo)`,
          referencia: original.referencia,
          tamanho: original.tamanho,
          contorno: novoContorno,
          linhaDeFio: original.linhaDeFio,
          quantidade: original.quantidade,
          margemDeCosturaMm: original.margemDeCosturaMm,
          restricaoDeRotacao: original.restricaoDeRotacao,
        },
        proximoId(),
      );
      aplicarMudanca([...pecas, novaPeca]);
      setSelecionadoId(novaPeca.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [pecas, selecionadoId, aplicarMudanca]);

  const moverPeca = useCallback(
    (id: string, deslocamento: Ponto2D) => {
      aplicarMudanca(pecas.map((p) => (p.id === id ? transladarMolde(p, deslocamento, p.id) : p)));
    },
    [pecas, aplicarMudanca],
  );

  const sugerirPosicaoParaSelecionada = useCallback(() => {
    const peca = pecas.find((p) => p.id === selecionadoId);
    if (!peca || !enfesto) return;
    const outras = pecas.filter((p) => p.id !== selecionadoId);
    const delta = sugerirPosicaoSemSobreposicao(peca, outras, enfesto);
    if (!delta) {
      window.alert(
        'Não foi possível encontrar uma posição sem sobreposição dentro da área útil do enfesto configurado. Tente posicionar manualmente ou revise as dimensões do enfesto.',
      );
      return;
    }
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? transladarMolde(p, delta, p.id) : p)));
  }, [pecas, selecionadoId, enfesto, aplicarMudanca]);

  const abrirConfiguracaoDeNesting = useCallback(() => {
    if (!enfesto || pecas.length === 0) return;
    setResultadoNesting(null);
    setNestingExecutando(false);
    setMostrarPainelDeNesting(true);
  }, [enfesto, pecas.length]);

  const calcularNestingAutomatico = useCallback(
    (opcoesAvancadas: { limiteDeTempoMinutos?: number; aproveitamentoDesejadoPercentual?: number }) => {
      if (!enfesto || pecas.length === 0) return;
      setResultadoNesting(null);
      setProgressoNesting({ colocadas: 0, total: pecas.reduce((soma, p) => soma + p.quantidade, 0) });
      setNestingExecutando(true);

      const worker = new Worker(new URL('./nesting.worker.ts', import.meta.url), { type: 'module' });
      workerDeNestingRef.current = worker;
      worker.onmessage = (evento: MessageEvent) => {
        const mensagem = evento.data;
        if (mensagem.tipo === 'progresso') {
          setProgressoNesting({ colocadas: mensagem.colocadas, total: mensagem.total });
        } else if (mensagem.tipo === 'concluido') {
          setResultadoNesting(mensagem.resultado);
          setNestingExecutando(false);
          worker.terminate();
          workerDeNestingRef.current = null;
        }
      };
      const mensagemIniciar: MensagemParaWorker = {
        tipo: 'iniciar',
        pecas,
        enfesto,
        ...(opcoesAvancadas.limiteDeTempoMinutos !== undefined
          ? { limiteDeTempoMs: opcoesAvancadas.limiteDeTempoMinutos * 60_000 }
          : {}),
        ...(opcoesAvancadas.aproveitamentoDesejadoPercentual !== undefined
          ? { aproveitamentoDesejadoPercentual: opcoesAvancadas.aproveitamentoDesejadoPercentual }
          : {}),
      };
      worker.postMessage(mensagemIniciar);
    },
    [pecas, enfesto],
  );

  const cancelarNestingAutomatico = useCallback(() => {
    const mensagemCancelar: MensagemParaWorker = { tipo: 'cancelar' };
    workerDeNestingRef.current?.postMessage(mensagemCancelar);
  }, []);

  const fecharPainelDeNesting = useCallback(() => {
    setMostrarPainelDeNesting(false);
    setResultadoNesting(null);
  }, []);

  const aplicarResultadoNesting = useCallback(() => {
    if (!resultadoNesting) return;
    const novasPecas = resultadoNesting.pecasColocadas.map((p) => p.molde);
    aplicarMudanca(novasPecas);
    setSelecionadoId(null);
    setMostrarPainelDeNesting(false);
    setResultadoNesting(null);
    registrarEventoEPersistir(
      'execucao-de-nesting',
      { pecas: novasPecas, tecido, enfesto },
      `${resultadoNesting.pecasColocadas.length} peça(s) colocada(s), ${resultadoNesting.aproveitamentoPercentual.toFixed(1)}% de aproveitamento`,
    );
  }, [resultadoNesting, aplicarMudanca, tecido, enfesto, registrarEventoEPersistir]);

  const exportarPdf = useCallback(
    async (opcoesEscolhidas: OpcoesDeExportacaoEscolhidas) => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      setGerandoPdf(true);
      try {
        const opcoesDePagina = {
          formato: opcoesEscolhidas.formato,
          orientacao: opcoesEscolhidas.orientacao,
          margemMm: opcoesEscolhidas.margemMm,
        };
        const blob =
          opcoesEscolhidas.tipo === 'encaixe-completo' && enfesto
            ? await gerarPdfDeEncaixe(pecas, enfesto, {
                ...opcoesDePagina,
                ...(tecido?.nome !== undefined ? { tecidoNome: tecido.nome } : {}),
              })
            : await gerarPdfDeMoldesIndividuais(pecas, opcoesDePagina);
        const buffer = await blob.arrayBuffer();
        const sugestaoDeNome =
          opcoesEscolhidas.tipo === 'encaixe-completo' ? 'encaixe.pdf' : 'moldes.pdf';
        const caminhoSalvo = await api.salvarArquivo(sugestaoDeNome, buffer);
        if (caminhoSalvo) {
          setMostrarExportacaoPdf(false);
          registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Salvo em ${caminhoSalvo}`);
        }
      } catch (e) {
        window.alert(`Falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGerandoPdf(false);
      }
    },
    [pecas, enfesto, tecido, registrarEventoEPersistir],
  );

  const relatorioAtual = useMemo(
    () => gerarRelatorioDeProducao(projetoAtual, new Date().toISOString()),
    [projetoAtual, mostrarRelatorio],
  );

  const exportarRelatorio = useCallback(
    async (formato: 'pdf' | 'xlsx') => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      setGerandoRelatorio(true);
      try {
        const blob =
          formato === 'pdf'
            ? await gerarPdfDeRelatorio(relatorioAtual)
            : await gerarExcelDeRelatorio(relatorioAtual);
        const buffer = await blob.arrayBuffer();
        const sugestaoDeNome = `relatorio-${projetoAtual.codigo}.${formato}`;
        const caminhoSalvo = await api.salvarArquivo(sugestaoDeNome, buffer);
        if (caminhoSalvo) {
          setMostrarRelatorio(false);
          registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Relatório salvo em ${caminhoSalvo}`);
        }
      } catch (e) {
        window.alert(`Falha ao gerar o relatório: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGerandoRelatorio(false);
      }
    },
    [relatorioAtual, projetoAtual.codigo, pecas, tecido, enfesto, registrarEventoEPersistir],
  );

  const estadoAoVivoRef = useRef<EstadoDoProjeto>({ pecas, tecido, enfesto });
  useEffect(() => {
    estadoAoVivoRef.current = { pecas, tecido, enfesto };
  }, [pecas, tecido, enfesto]);

  // Salvamento automático (seção 11): a cada 60s, se algo mudou desde o
  // último evento registrado, grava um novo "salvamento" — cobre queda de
  // energia/travamento sem exigir um fluxo de "recuperar rascunho" à parte:
  // o estado salvo mais recente já fica disponível na Biblioteca.
  useEffect(() => {
    const intervalo = setInterval(() => {
      setProjetoAtual((atual) => {
        const mudou =
          JSON.stringify(atual.estadoAtual) !== JSON.stringify(estadoAoVivoRef.current);
        if (!mudou) return atual;
        const atualizado = registrarEvento(atual, 'salvamento', estadoAoVivoRef.current, new Date().toISOString(), 'Salvamento automático');
        persistirProjeto(atualizado);
        return atualizado;
      });
    }, 60000);
    return () => clearInterval(intervalo);
  }, [persistirProjeto]);

  const finalizarContornoEmEdicao = useCallback(() => {
    if (pontosEmEdicao.length < 3) return;
    if (area(pontosEmEdicao) <= 0) {
      window.alert('O contorno desenhado é inválido (área zero ou pontos colineares). Continue clicando ou pressione Esc para cancelar.');
      return;
    }
    if (modo === 'novo-molde') {
      setContornoPendente(pontosEmEdicao);
      setPontosEmEdicao([]);
      setModo('definir-fio');
    } else if (modo === 'novo-furo' && selecionadoId) {
      const contornoFuro = pontosEmEdicao;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? { ...p, furos: [...p.furos, contornoFuro] } : p)),
      );
      cancelarModo();
    }
  }, [pontosEmEdicao, modo, selecionadoId, pecas, aplicarMudanca, cancelarModo]);

  const onCliqueNoCanvas = useCallback(
    (mundo: Ponto2D, semCaptura: Ponto2D) => {
      if (modo === 'novo-molde' || modo === 'novo-furo') {
        // Com o ímã, um clique perto do primeiro ponto cai exatamente nele:
        // fecha o contorno (como Enter). Um clique repetido sobre o último
        // ponto não cria um vértice duplicado.
        const primeiro = pontosEmEdicao[0];
        const ultimo = pontosEmEdicao.at(-1);
        if (primeiro && pontosEmEdicao.length >= 3 && mesmoPonto(mundo, primeiro)) {
          finalizarContornoEmEdicao();
          return;
        }
        if (ultimo && mesmoPonto(mundo, ultimo)) return;
        setPontosEmEdicao((prev) => [...prev, mundo]);
        return;
      }
      if (modo === 'definir-fio') {
        if (pontosEmEdicao.length === 0) {
          setPontosEmEdicao([mundo]);
          return;
        }
        // Fio de comprimento zero não tem direção: ignora o segundo clique no mesmo lugar.
        if (mesmoPonto(mundo, pontosEmEdicao[0]!)) return;
        if (!contornoPendente) return;
        const novoMolde = criarMolde(
          {
            nome: `Molde ${pecas.length + 1}`,
            referencia: '',
            tamanho: 'M',
            contorno: contornoPendente,
            linhaDeFio: { inicio: pontosEmEdicao[0]!, fim: mundo },
          },
          proximoId(),
        );
        aplicarMudanca([...pecas, novoMolde]);
        setSelecionadoId(novoMolde.id);
        cancelarModo();
        return;
      }
      if (modo === 'retangulo') {
        const canto = pontosEmEdicao[0];
        if (!canto) {
          setPontosEmEdicao([mundo]);
          return;
        }
        // Sem largura ou sem altura não há retângulo: espera um canto oposto de verdade.
        if (
          Math.abs(mundo.x - canto.x) < LADO_MINIMO_DO_RETANGULO_MM ||
          Math.abs(mundo.y - canto.y) < LADO_MINIMO_DO_RETANGULO_MM
        ) {
          return;
        }
        // Daqui segue como no molde desenhado reta a reta: falta a linha de fio.
        setContornoPendente([canto, ponto(canto.x, mundo.y), mundo, ponto(mundo.x, canto.y)]);
        setPontosEmEdicao([]);
        setModo('definir-fio');
        return;
      }
      if (modo === 'sentido-do-fio' && selecionadoId) {
        const inicio = pontosEmEdicao[0];
        if (!inicio) {
          setPontosEmEdicao([mundo]);
          return;
        }
        // Fio de comprimento zero não tem direção: ignora o segundo clique no mesmo lugar.
        if (mesmoPonto(mundo, inicio)) return;
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? redefinirLinhaDeFio(p, inicio, mundo) : p)));
        cancelarModo();
        return;
      }
      if (modo === 'medir-distancia' || modo === 'comparar-distancias') {
        const comparar = modo === 'comparar-distancias';
        const de = pontosEmEdicao[0];
        if (!de) {
          setPontosEmEdicao([mundo]);
          // Medindo, a medida anterior some; comparando, só recomeça depois da segunda.
          setMedicao((atual) => (comparar && atual.medicoes.length < 2 ? atual : SEM_MEDICAO));
          return;
        }
        if (mesmoPonto(mundo, de)) return;
        setMedicao((atual) => registrarMedicao(atual, { tipo: 'distancia', de, ate: mundo }, comparar));
        setPontosEmEdicao([]);
        return;
      }
      if (modo === 'cota-perimetro' || ehFerramentaDeCotaPorPontos(modo)) {
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        if (pontosEmEdicao.length === 0) {
          // Um clique no número de uma cota a apaga.
          const cotaClicada = cotaSobOPonto(pecas, semCaptura, raioMm);
          if (cotaClicada) {
            aplicarMudanca(pecas.map((p) => (p.id === cotaClicada.pecaId ? removerCota(p, cotaClicada.cotaId) : p)));
            return;
          }
          // A cota fica presa a uma peça: a do primeiro clique ou, fora de todas, a selecionada.
          const dona =
            alvoDaMedicao(semCaptura, pecas, raioMm)?.peca ?? pecas.find((p) => p.id === selecionadoId) ?? null;
          if (!dona) return;
          if (modo === 'cota-perimetro') {
            aplicarMudanca(
              pecas.map((p) => (p.id === dona.id ? adicionarCota(p, cotaDePerimetro(proximoId(), semCaptura)) : p)),
            );
            return;
          }
          setDonoDaCota(dona.id);
          setPontosEmEdicao([mundo]);
          return;
        }
        if (!ehFerramentaDeCotaPorPontos(modo)) return;
        const cliques = [...pontosEmEdicao, mundo];
        if (cliques.length < CLIQUES_DA_COTA[modo]) {
          // Um ponto repetido não mede nada: espera um ponto diferente.
          if (!mesmoPonto(mundo, pontosEmEdicao.at(-1)!)) setPontosEmEdicao(cliques);
          return;
        }
        try {
          const cota = montarCota(modo, proximoId(), cliques);
          aplicarMudanca(pecas.map((p) => (p.id === donoDaCota ? adicionarCota(p, cota) : p)));
        } catch {
          // Pontos que não formam a cota (dois iguais): recomeça sem criar nada.
        }
        setPontosEmEdicao([]);
        setDonoDaCota(null);
        return;
      }
      if (modo === 'medir-perimetro' || modo === 'comparar-perimetros') {
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        setMedicao((atual) =>
          cliqueDePerimetro(
            atual,
            alvoDaMedicao(mundo, pecas, raioMm, atual.inicioDoTrecho?.pecaId ?? null),
            modo === 'comparar-perimetros',
          ),
        );
        return;
      }
      if (ehFerramentaDeTrecho(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        setRecadoDaFerramenta(null);
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const novo = cliqueDeTrecho(modo, trecho, {
          noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm),
          livre: mundo,
        });
        if (!trechoCompleto(modo, novo) || !novo.inicio || !novo.fim) {
          setTrecho(novo);
          return;
        }
        // Estas duas pedem um valor antes de aplicar: o diálogo termina o serviço.
        if (modo === 'editar-pontos-de-curva' || modo === 'cadastrar-curva') {
          setTrecho(novo);
          setDialogoDeFerramenta({
            tipo: modo === 'cadastrar-curva' ? 'cadastrar-curva' : 'numero-de-pontos',
            inicio: novo.inicio,
            fim: novo.fim,
          });
          return;
        }
        const opcoes =
          modo === 'curva-predefinida' && curvaEscolhida
            ? { forma: curvaEscolhida.curva.forma, espelhar: curvaEscolhida.espelhar }
            : {};
        setRecadoDaFerramenta(aplicarTrecho(modo, novo, opcoes));
        return;
      }
      if (ehFerramentaDeReta(modo) || modo === 'bainha') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        setRecadoDaFerramenta(null);
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const novo = cliqueDeReta(modo, trecho, {
          noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm),
          livre: semCaptura,
        });
        if (!retaCompleta(modo, novo)) {
          setTrecho(novo);
          return;
        }
        // Deu certo ou não, a ferramenta volta a esperar a primeira ponta.
        setTrecho(SEM_TRECHO);
        try {
          const resultado =
            modo === 'bainha'
              ? aplicarBainha(pecas, peca, novo, opcoesDeBainha, proximoId)
              : aplicarReta(modo, pecas, peca, novo, proximoId);
          aplicarMudanca([...resultado.pecas]);
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (ehModoDeGraduacao(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const resultado = cliqueDeGraduacao(
          modo,
          opcoesDaGraduacao,
          pecas,
          peca,
          trecho,
          { noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm), livre: semCaptura },
          { regra: regraEscolhida, novoGrupo: proximoId },
        );
        setTrecho(resultado.estado);
        setRecadoDaFerramenta(resultado.recado);
        if (resultado.pecas) aplicarMudanca([...resultado.pecas]);
        if (resultado.abrir) {
          setDialogoDeFerramenta({
            tipo: resultado.abrir.tipo === 'tabela' ? 'tabela-do-ponto' : 'nome-da-regra',
            indice: resultado.abrir.indice,
          });
        }
        return;
      }
      if (ehFerramentaDePence(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const { estado, recusa } = cliqueDePence(modo, opcoesDasPences, peca, trecho, {
          noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm),
          livre: semCaptura,
        });
        setRecadoDaFerramenta(recusa);
        if (recusa) return;
        if (!penceCompleta(modo, opcoesDasPences, estado)) {
          setTrecho(estado);
          return;
        }
        setTrecho(SEM_TRECHO);
        try {
          const resultado = aplicarPence(modo, opcoesDasPences, pecas, peca, estado, proximoId);
          aplicarMudanca([...resultado.pecas]);
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'desdobrar') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const aresta = arestaPerto(semCaptura, peca.contorno, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
        if (aresta === null) return;
        try {
          const resultado = aplicarDesdobrar(pecas, peca, aresta, proximoId);
          aplicarMudanca([...resultado.pecas]);
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'unir') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        // Primeiro a aresta da peça selecionada; depois, a da outra peça.
        if (!trecho.inicio) {
          const aresta = arestaPerto(semCaptura, peca.contorno, raioMm);
          if (aresta === null) return;
          setRecadoDaFerramenta(null);
          setTrecho({ ...SEM_TRECHO, inicio: { indiceAresta: aresta, ponto: semCaptura } });
          return;
        }
        const alvo = arestaDeOutraPecaPerto(semCaptura, pecas, peca.id, raioMm);
        if (!alvo) return;
        setTrecho(SEM_TRECHO);
        try {
          const resultado = aplicarUniao(pecas, peca, trecho.inicio.indiceAresta, alvo.peca, alvo.indiceAresta, unirApenasMovendo);
          aplicarMudanca([...resultado.pecas]);
          // A peça que foi unida deixa de existir: sai também da seleção em lote.
          if (!unirApenasMovendo) {
            setIdsSelecionadosEmLote((atual) =>
              atual.has(alvo.peca.id) ? new Set([...atual].filter((id) => id !== alvo.peca.id)) : atual,
            );
          }
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'arco-tangente') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        setRecadoDaFerramenta(null);
        const canto = posicaoNoContornoPerto(semCaptura, peca.contorno, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
        // Só um vértice serve: o arco é tangente às duas arestas que se encontram nele.
        if (canto && distancia(canto.ponto, peca.contorno[canto.indiceAresta]!) < 1e-9) {
          setDialogoDeFerramenta({ tipo: 'raio-do-arco', indice: canto.indiceAresta });
        }
        return;
      }
      if (modo === 'circulo') {
        const centro = pontosEmEdicao[0];
        if (!centro) {
          setPontosEmEdicao([mundo]);
          return;
        }
        if (mesmoPonto(mundo, centro)) return;
        // Como no retângulo: o círculo vira molde depois da linha de fio.
        setContornoPendente(circulo(centro, mundo));
        setPontosEmEdicao([]);
        setModo('definir-fio');
        return;
      }
      if (modo === 'espiral') {
        if (!espiralPendente) return;
        setContornoPendente(espiral(mundo, espiralPendente.larguraMm, espiralPendente.perimetroMm));
        setPontosEmEdicao([]);
        setModo('definir-fio');
        return;
      }
      if (modo === 'pique' && selecionadoId) {
        aplicarMudanca(
          pecas.map((p) => (p.id === selecionadoId ? adicionarPique(p, mundo, proximoId()) : p)),
        );
        return;
      }
      if (modo === 'marca' && selecionadoId) {
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? adicionarMarca(p, mundo, proximoId()) : p)));
      }
    },
    [
      modo,
      pontosEmEdicao,
      contornoPendente,
      pecas,
      selecionadoId,
      donoDaCota,
      trecho,
      curvaEscolhida,
      espiralPendente,
      opcoesDeBainha,
      unirApenasMovendo,
      opcoesDasPences,
      opcoesDaGraduacao,
      regraEscolhida,
      aplicarTrecho,
      transform.escalaPxPorMm,
      aplicarMudanca,
      cancelarModo,
      finalizarContornoEmEdicao,
    ],
  );

  const importarDxfHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Importação de arquivo só está disponível rodando dentro do aplicativo Electron (npm run dev / build), não num navegador comum.');
      return;
    }
    void api.abrirArquivoDxf().then((arquivo) => {
      if (!arquivo) return;
      const nomeBase = (arquivo.caminho.split(/[\\/]/).pop() ?? arquivo.caminho).replace(/\.dxf$/i, '');
      const resultado = importarDxf(arquivo.conteudo, nomeBase);
      const mensagens = [...resultado.avisos];
      if (resultado.unidadeAssumida) {
        mensagens.push(`Unidade do arquivo não declarada: ${resultado.unidadeDetectada}.`);
      }
      if (resultado.pecas.length === 0) {
        setMensagensImportacao(mensagens.length > 0 ? mensagens : null);
        return;
      }
      setImportacaoDxfPendente(resultado);
      setMensagensImportacao(mensagens.length > 0 ? mensagens : null);
    });
  }, []);

  const importarPdfHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Importação de arquivo só está disponível rodando dentro do aplicativo Electron (npm run dev / build), não num navegador comum.');
      return;
    }
    void api.abrirArquivoPdf().then(async (arquivo) => {
      if (!arquivo) return;
      const resultado = importarPdf(arquivo.conteudo);
      const prontas = resultado.pecas.filter((p) => p.linhaDeFio !== null);
      const semFio = resultado.pecas.filter((p) => p.linhaDeFio === null);

      const novosMoldes = prontas.map((p) =>
        criarMolde(
          {
            nome: p.nome,
            referencia: p.referencia,
            tamanho: p.tamanho,
            contorno: p.contorno,
            furos: p.furos,
            linhasInternas: p.linhasInternas,
            linhaDeFio: p.linhaDeFio!,
            margemDeCosturaMm: p.margemDeCosturaMm,
            quantidade: p.quantidade,
            piques: p.piques.map((piq) => ({ id: proximoId(), posicao: piq.posicao, indiceAresta: piq.indiceAresta })),
            marcas: p.marcas.map((m) => ({ id: proximoId(), posicao: m })),
          },
          proximoId(),
        ),
      );

      if (novosMoldes.length > 0) {
        aplicarMudanca([...pecas, ...novosMoldes]);
      }

      const mensagens = [...resultado.avisos];
      if (semFio.length > 0) {
        mensagens.push(
          `${semFio.length} peça(s) do arquivo não foram adicionadas por não terem linha de fio reconhecível: ${semFio
            .map((p) => p.nome)
            .join(', ')}. Desenhe-as manualmente com "Reta" (aba Construção), definindo o fio correto.`,
        );
      }
      if (resultado.pecas.length === 0) {
        const contornos = await extrairContornosDoPdf(arquivo.conteudo);
        if (contornos.candidatos.length > 0 && contornos.alturaPaginaPt !== null) {
          setImportacaoPdfPendente(contornos);
          const indiceGenerico = mensagens.findIndex((m) => m.startsWith("Nenhuma peça reconhecível"));
          if (indiceGenerico >= 0) mensagens.splice(indiceGenerico, 1);
        } else {
          const diagnostico = await diagnosticarVetorPdf(arquivo.conteudo);
          if (diagnostico.subcaminhos > 0) {
            const indiceGenerico = mensagens.findIndex((m) => m.startsWith("Nenhuma peça reconhecível"));
            const textoDoDiagnostico = descreverDiagnosticoVetorial(diagnostico);
            if (indiceGenerico >= 0) mensagens.splice(indiceGenerico, 1, textoDoDiagnostico);
            else mensagens.push(textoDoDiagnostico);
          }
        }
      }
      setMensagensImportacao(mensagens.length > 0 ? mensagens : null);
    });
  }, [pecas, aplicarMudanca]);

  const confirmarImportacaoDxf = useCallback(
    (itens: readonly ItemConfirmadoDeContorno[]) => {
      const pendente = importacaoDxfPendente;
      if (!pendente) return;
      try {
        const altura = alturaDoDesenho(pendente);
        const paraTela = (pontos: readonly Ponto2D[]) => pontos.map((p) => dxfParaMundo(p, altura));
        const novosMoldes = itens.map((item) => {
          const peca = pendente.pecas[Number(item.candidatoId)]!;
          const contorno = paraTela(peca.contorno);
          const fioDoArquivo = peca.linhaDeFio;
          return criarMolde(
            {
              nome: item.nome,
              referencia: '',
              tamanho: item.tamanho,
              contorno,
              furos: peca.furos.map(paraTela),
              linhasInternas: peca.linhasInternas.map(paraTela),
              // A linha exata do arquivo só vale se o usuário manteve a
              // direção dela no diálogo; se escolheu a outra, vale a escolha.
              linhaDeFio:
                fioDoArquivo && direcaoNaTelaDaLinhaDeFio(fioDoArquivo) === item.direcaoDoFio
                  ? { inicio: dxfParaMundo(fioDoArquivo.inicio, altura), fim: dxfParaMundo(fioDoArquivo.fim, altura) }
                  : linhaDeFioSobreContorno(contorno, item.direcaoDoFio),
            },
            proximoId(),
          );
        });
        // A origem do DXF é arbitrária (pode estar no meio do desenho): o
        // conjunto inteiro é deslocado para o canto útil da mesa, com o
        // mesmo deslocamento para todas as peças, sem mudar a posição
        // relativa entre elas.
        const todos = novosMoldes.flatMap((m) => m.contorno);
        const delta = ponto(
          (enfesto?.margemLateralMm ?? 0) - Math.min(...todos.map((p) => p.x)),
          (enfesto?.margemDeExtremidadeMm ?? 0) - Math.min(...todos.map((p) => p.y)),
        );
        const posicionados = novosMoldes.map((m) => transladarMolde(m, delta, m.id));
        aplicarMudanca([...pecas, ...posicionados]);
        setImportacaoDxfPendente(null);
        setMensagensImportacao([
          `${posicionados.length} peça(s) importada(s) do DXF, em ${pendente.unidadeDetectada}. O conjunto foi posicionado no canto da mesa; a posição entre as peças é a do arquivo.`,
        ]);
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        setMensagensImportacao([`Não foi possível importar: ${motivo}`]);
      }
    },
    [importacaoDxfPendente, pecas, aplicarMudanca, enfesto],
  );

  const confirmarImportacaoPdf = useCallback(
    (itens: readonly ItemConfirmadoDeContorno[]) => {
      const pendente = importacaoPdfPendente;
      if (!pendente || pendente.alturaPaginaPt === null) return;
      try {
        const novosMoldes = itens.map((item) => {
          const candidato = pendente.candidatos.find((c) => c.id === item.candidatoId);
          if (!candidato) throw new Error(`contorno ${item.candidatoId} não encontrado`);
          const contorno = contornoEmMundo(candidato, pendente.alturaPaginaPt!, item.fatorDeEscala);
          return criarMolde(
            {
              nome: item.nome,
              referencia: '',
              tamanho: item.tamanho,
              contorno,
              linhaDeFio: linhaDeFioSobreContorno(contorno, item.direcaoDoFio),
            },
            proximoId(),
          );
        });
        aplicarMudanca([...pecas, ...novosMoldes]);
        setImportacaoPdfPendente(null);
        setMensagensImportacao([
          `${novosMoldes.length} peça(s) importada(s) do PDF. Medidas no fator de escala escolhido (1 = tamanho do papel, em mm).`,
        ]);
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        setMensagensImportacao([`Não foi possível importar: ${motivo}`]);
      }
    },
    [importacaoPdfPendente, pecas, aplicarMudanca],
  );

  // Ao abrir o programa o foco fica no corpo da página, fora da janela do
  // app, e os atalhos (F1, Ctrl+O...) só valeriam depois do primeiro clique.
  // Só pega o foco se ninguém o tiver: um diálogo aberto fica com ele.
  const appShellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) appShellRef.current?.focus();
  }, []);

  const aoTeclar = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Os diálogos (Sobreposicao) já seguram as próprias teclas; isto cobre
      // uma tecla que chegue de fora deles enquanto um está aberto.
      if (e.currentTarget.querySelector('[role="dialog"][aria-modal="true"]')) return;

      if (e.key === 'F1') {
        e.preventDefault();
        setPainelDeAjuda('atalhos');
        return;
      }

      const alvoEhCampoDeTexto = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (alvoEhCampoDeTexto) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        // Primeiro desliga a Mão/Zoom por janela; a ferramenta de baixo continua.
        if (ferramentaDeVista !== null) setFerramentaDeVista(null);
        else cancelarModo();
      } else if (e.key === 'Enter' && (modo === 'novo-molde' || modo === 'novo-furo')) {
        e.preventDefault();
        finalizarContornoEmEdicao();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        refazer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicarSelecionado();
      } else if (e.key === 'Backspace' && modo === 'curva' && trecho.livres.length > 0) {
        e.preventDefault();
        setTrecho((atual) => ({ ...atual, livres: atual.livres.slice(0, -1) }));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        excluirSelecionado();
      } else if (e.key === '+' || e.key === '=') {
        zoom(1.15);
      } else if (e.key === '-') {
        zoom(1 / 1.15);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        ajustarTela();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarComo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarProjetoAtual();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        abrirBiblioteca();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        novoProjeto();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        importarDxfHandler();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (pecas.length > 0) setMostrarExportacaoPdf(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setMostrarHistorico(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selecionarTudo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copiarSelecionado();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        recortarSelecionado();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        colar();
      }
    },
    [
      modo,
      trecho.livres.length,
      ferramentaDeVista,
      cancelarModo,
      finalizarContornoEmEdicao,
      desfazer,
      refazer,
      duplicarSelecionado,
      excluirSelecionado,
      zoom,
      ajustarTela,
      salvarProjetoAtual,
      salvarComo,
      abrirBiblioteca,
      novoProjeto,
      importarDxfHandler,
      pecas.length,
      selecionarTudo,
      copiarSelecionado,
      recortarSelecionado,
      colar,
    ],
  );

  // Medidas da aba Conferência: só aparecem com uma das ferramentas dela
  // ligada, e só as que ainda valem para as peças de agora.
  const emModoDeMedida =
    modo === 'medir-distancia' ||
    modo === 'medir-perimetro' ||
    modo === 'comparar-perimetros' ||
    modo === 'comparar-distancias';
  // A cota como ficaria com o próximo clique: só quando falta o clique que a posiciona.
  const cotaEmPrevia = useMemo(
    () => (ehFerramentaDeCotaPorPontos(modo) ? previaDaCota(modo, pontosEmEdicao, cursorMundo) : null),
    [modo, pontosEmEdicao, cursorMundo],
  );
  const medicoesResolvidas = useMemo(
    () =>
      emModoDeMedida
        ? medicao.medicoes.map((m) => resolverMedicao(m, pecas)).filter((m): m is MedicaoResolvida => m !== null)
        : [],
    [emModoDeMedida, medicao, pecas],
  );
  const inicioDoTrecho = useMemo(() => {
    const inicio = emModoDeMedida ? medicao.inicioDoTrecho : null;
    if (!inicio || !pecas.some((p) => p.id === inicio.pecaId && p.contorno === inicio.contorno)) return null;
    return inicio.de.ponto;
  }, [emModoDeMedida, medicao, pecas]);

  // Prévia das ferramentas de curva e arco: o trecho que sai, a linha que entra
  // e os pontos já indicados; no círculo e na espiral, o contorno novo inteiro.
  const previaNoDesenho = useMemo<PreviaNoDesenho | null>(() => {
    if (ehFerramentaDeTrecho(modo) && pecaSelecionada) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const mouse = cursorMundo
        ? { noContorno: posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm), livre: cursorMundo }
        : null;
      const opcoes =
        modo === 'curva-predefinida' && curvaEscolhida
          ? { forma: curvaEscolhida.curva.forma, espelhar: curvaEscolhida.espelhar }
          : {};
      return previaDoTrecho(modo, pecaSelecionada.contorno, trecho, mouse, opcoes);
    }
    if (pecaSelecionada && ehModoDeGraduacao(modo)) {
      return previaDaGraduacao(modo, opcoesDaGraduacao, pecaSelecionada, trecho, cursorMundo);
    }
    if (pecaSelecionada && ehFerramentaDePence(modo)) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const mouse = cursorMundo
        ? { noContorno: posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm), livre: cursorMundo }
        : null;
      return previaDaPence(modo, opcoesDasPences, pecaSelecionada, trecho, mouse);
    }
    if (pecaSelecionada && (ehFerramentaDeReta(modo) || modo === 'bainha' || modo === 'desdobrar' || modo === 'unir')) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const contorno = pecaSelecionada.contorno;
      if (modo === 'desdobrar') return previaDeDesdobrar(pecaSelecionada, cursorMundo ? arestaPerto(cursorMundo, contorno, raioMm) : null);
      if (modo === 'unir') {
        return previaDeUnir(
          pecaSelecionada,
          trecho.inicio?.indiceAresta ?? null,
          cursorMundo ? arestaPerto(cursorMundo, contorno, raioMm) : null,
          cursorMundo ? arestaDeOutraPecaPerto(cursorMundo, pecas, pecaSelecionada.id, raioMm) : null,
        );
      }
      const mouse = cursorMundo ? { noContorno: posicaoNoContornoPerto(cursorMundo, contorno, raioMm), livre: cursorMundo } : null;
      return modo === 'bainha'
        ? previaDaBainha(pecaSelecionada, trecho, mouse, opcoesDeBainha)
        : previaDaReta(modo, pecaSelecionada, trecho, mouse);
    }
    if (modo === 'circulo' && pontosEmEdicao[0] && cursorMundo && !mesmoPonto(pontosEmEdicao[0], cursorMundo)) {
      return { novo: circulo(pontosEmEdicao[0], cursorMundo), novoFechado: true };
    }
    if (modo === 'espiral' && espiralPendente && cursorMundo) {
      return { novo: espiral(cursorMundo, espiralPendente.larguraMm, espiralPendente.perimetroMm), novoFechado: true };
    }
    return null;
  }, [
    modo,
    pecas,
    pecaSelecionada,
    trecho,
    cursorMundo,
    curvaEscolhida,
    espiralPendente,
    opcoesDeBainha,
    opcoesDasPences,
    opcoesDaGraduacao,
    pontosEmEdicao,
    transform.escalaPxPorMm,
  ]);

  /** O texto da ferramenta de curva ou arco ligada, conforme o que já foi clicado. */
  const textoDaConstrucao = ((): string | null => {
    const fim = ' Esc sai.';
    if (ehFerramentaDePence(modo)) return instrucaoDaPence(modo, opcoesDasPences, trecho);
    if (ehModoDeGraduacao(modo)) return instrucaoDaGraduacao(modo, opcoesDaGraduacao, trecho, regraEscolhida);
    switch (modo) {
      case 'curva':
        if (!trecho.inicio) return 'Curva: clique no contorno da peça selecionada, onde a curva começa.' + fim;
        return trecho.livres.length === 0
          ? 'Curva: clique nos pontos por onde a curva deve passar, fora do contorno.' + fim
          : 'Curva: mais pontos de passagem, ou clique no contorno, onde a curva termina — ela entra no lugar do trecho em destaque. Backspace desfaz o último ponto.' + fim;
      case 'arco-2-pontos':
        if (!trecho.inicio) return 'Arco por 2 pontos: clique no contorno da peça selecionada, onde o arco começa.' + fim;
        return !trecho.fim
          ? 'Arco por 2 pontos: clique no contorno, onde o arco termina.' + fim
          : 'Arco por 2 pontos: clique por onde o arco deve passar.' + fim;
      case 'arco-3-pontos':
        if (!trecho.inicio) return 'Arco por 3 pontos: clique no contorno da peça selecionada, onde o arco começa.' + fim;
        return trecho.livres.length === 0
          ? 'Arco por 3 pontos: clique por onde o arco deve passar, fora do contorno.' + fim
          : 'Arco por 3 pontos: clique no contorno, onde o arco termina (um clique fora dele troca o ponto de passagem).' + fim;
      case 'arco-tangente':
        return 'Arco tangente a 2 retas: clique num canto da peça selecionada e digite o raio.' + fim;
      case 'editar-pontos-de-curva':
        return !trecho.inicio
          ? 'Editar pontos de curva: clique no contorno da peça selecionada, no começo do trecho.' + fim
          : 'Editar pontos de curva: clique no fim do trecho — os pontos entre os dois serão redistribuídos.' + fim;
      case 'cadastrar-curva':
        return !trecho.inicio
          ? 'Cadastrar curva: clique no contorno da peça selecionada, no começo do trecho a guardar.' + fim
          : 'Cadastrar curva: clique no fim do trecho.' + fim;
      case 'curva-predefinida': {
        const nome = curvaEscolhida ? ` (“${curvaEscolhida.curva.nome}”${curvaEscolhida.espelhar ? ', espelhada' : ''})` : '';
        return !trecho.inicio
          ? `Pré-definida${nome}: clique no contorno da peça selecionada, onde a curva começa.` + fim
          : `Pré-definida${nome}: clique no contorno, onde a curva termina.` + fim;
      }
      case 'circulo':
        return pontosEmEdicao.length === 0
          ? 'Por raio: clique no centro do círculo.' + fim
          : 'Por raio: clique na borda do círculo — a distância até o centro é o raio, e a barra de status mostra a medida.' + fim;
      case 'espiral':
        return 'Espiral: clique onde o centro da espiral deve ficar.' + fim;
      case 'cortar':
        return !trecho.inicio
          ? 'Cortar: clique no contorno da peça selecionada, onde o corte começa.' + fim
          : 'Cortar: clique no contorno, onde o corte termina — a peça vira duas, pela reta tracejada.' + fim;
      case 'remover-regiao':
        if (!trecho.inicio) return 'Remover região: clique no contorno da peça selecionada, numa ponta da reta que separa a região.' + fim;
        return !trecho.fim
          ? 'Remover região: clique no contorno, na outra ponta da reta.' + fim
          : 'Remover região: clique dentro da peça, na região que deve sair (ela fica em destaque).' + fim;
      case 'dobrar':
        if (!trecho.inicio) return 'Dobrar: clique no contorno da peça selecionada, numa ponta da linha de dobra.' + fim;
        return !trecho.fim
          ? 'Dobrar: clique no contorno, na outra ponta da linha de dobra.' + fim
          : 'Dobrar: clique dentro da peça, do lado que deve ficar — o lado em destaque é o que sai.' + fim;
      case 'desdobrar':
        return 'Desdobrar: clique na aresta da peça selecionada que é a linha de dobra — a outra metade entra espelhada.' + fim;
      case 'unir': {
        const nome = unirApenasMovendo ? 'Unir (apenas mover)' : 'Unir';
        return !trecho.inicio
          ? `${nome}: clique na aresta da peça selecionada por onde as duas se juntam.` + fim
          : `${nome}: clique na aresta da outra peça — ela gira e encosta na aresta em destaque.` + fim;
      }
      case 'bainha':
        return !trecho.inicio
          ? 'Bainha: clique no contorno da peça selecionada, onde a bainha começa.' + fim
          : 'Bainha: clique no contorno, onde a bainha termina — a sobra tracejada entra no lugar do trecho em destaque.' + fim;
      default:
        return null;
    }
  })();

  // Diálogos da graduação: o das opções da ferramenta pedida e o da tabela do ponto clicado.
  const dialogoDeGraduacao =
    dialogoDeFerramenta?.tipo === 'graduacao' && pecaSelecionada
      ? dialogoDaGraduacao(dialogoDeFerramenta.ferramenta, opcoesDaGraduacao, pecaSelecionada)
      : null;
  const pontoDaGraduacao = ((): {
    readonly indice: number;
    readonly graduacao: NonNullable<Molde['graduacao']>;
    readonly regra: readonly Ponto2D[];
  } | null => {
    if (dialogoDeFerramenta?.tipo !== 'tabela-do-ponto' && dialogoDeFerramenta?.tipo !== 'nome-da-regra') return null;
    const graduacao = pecaSelecionada?.graduacao;
    const indice = dialogoDeFerramenta.indice;
    if (!pecaSelecionada || !graduacao || indice >= pecaSelecionada.contorno.length) return null;
    return { indice, graduacao, regra: regraDoVertice(graduacao, pecaSelecionada.contorno, indice) };
  })();
  const regraParaColar = ((): readonly Ponto2D[] | null => {
    if (!regraCopiada || !pontoDaGraduacao) return null;
    try {
      return regraParaAGraduacao(regraCopiada, pontoDaGraduacao.graduacao);
    } catch {
      return null;
    }
  })();

  // O diálogo de opções da ferramenta de pence ou prega que foi pedida.
  const dialogoDePence =
    dialogoDeFerramenta?.tipo === 'pence' ? dialogoDaPence(dialogoDeFerramenta.ferramenta, opcoesDasPences) : null;

  const textoDaFaixa = ((): React.ReactNode => {
    if (ferramentaDeVista === 'mao') return 'Mão: arraste para mover a vista. Esc ou um novo clique na Mão para sair.';
    if (ferramentaDeVista === 'zoom-janela') {
      return 'Zoom por janela: arraste um retângulo sobre a área a ampliar. Esc para cancelar.';
    }
    // Ferramentas de curva e arco: o recado do que a ferramenta acabou de fazer
  // (ou de por que não fez) vem antes da instrução do próximo clique.
    if (textoDaConstrucao) return recadoDaFerramenta ? `${recadoDaFerramenta} — ${textoDaConstrucao}` : textoDaConstrucao;
    switch (modo) {
      case 'novo-molde':
        return 'Clique para adicionar pontos do contorno. Enter fecha o contorno (com o Ímã ligado, clicar no primeiro ponto também fecha); Esc cancela.';
      case 'novo-furo':
        return 'Clique para adicionar pontos do furo. Enter fecha o furo (com o Ímã ligado, clicar no primeiro ponto também fecha); Esc cancela.';
      case 'retangulo':
        return pontosEmEdicao.length === 0
          ? 'Retângulo: clique no primeiro canto. Esc cancela.'
          : 'Retângulo: clique no canto oposto — as medidas dos lados aparecem no desenho e na barra de status. Esc cancela.';
      case 'definir-fio':
        return pontosEmEdicao.length === 0
          ? 'Clique no início da linha de fio.'
          : 'Clique no fim da linha de fio (a seta aponta para lá).';
      case 'sentido-do-fio':
        return pontosEmEdicao.length === 0
          ? 'Sentido do fio: clique no início da nova linha de fio da peça selecionada. Esc cancela.'
          : 'Sentido do fio: clique no fim da linha de fio (a seta aponta para lá). Esc cancela.';
      case 'definir-cerca':
        return 'Arraste de um canto ao outro para definir a cerca. Esc para cancelar.';
      case 'modificar':
        return 'Modificar: clique num ponto da peça para digitar o deslocamento exato, ou arraste-o. Para vários pontos, use Shift+clique ou um retângulo e depois clique num deles. Esc sai.';
      case 'redefinir-perimetro':
        return 'Redefinir perímetro: clique numa aresta da peça, perto da ponta que deve andar, e digite o novo comprimento. Esc sai.';
      case 'medir-distancia': {
        if (pontosEmEdicao.length > 0) return 'Distância: clique no segundo ponto. Esc sai.';
        const medida = medicoesResolvidas[0];
        return medida
          ? `${descreverMedicao(medida)} — clique para medir de novo; Esc sai.`
          : 'Distância: clique no primeiro ponto (perto de um vértice, o clique cai exatamente nele). Esc sai.';
      }
      case 'medir-perimetro': {
        if (inicioDoTrecho) {
          return 'Perímetro: clique no segundo ponto do contorno — o trecho segue a numeração dos pontos, do primeiro clique ao segundo. Esc sai.';
        }
        const medida = medicoesResolvidas[0];
        return medida
          ? `${descreverMedicao(medida)} — clique para medir de novo; Esc sai.`
          : 'Perímetro: clique dentro de uma peça para medir o perímetro dela, ou em dois pontos do contorno para medir o trecho entre eles. Esc sai.';
      }
      case 'comparar-distancias': {
        if (pontosEmEdicao.length > 0) return 'Comparar distância: clique no segundo ponto. Esc sai.';
        const [primeira, segunda] = medicoesResolvidas;
        if (primeira && segunda) return `${descreverComparacao(primeira, segunda)} — clique para comparar de novo; Esc sai.`;
        if (primeira) return `${descreverMedicao(primeira)} — agora meça a 2ª distância. Esc sai.`;
        return 'Comparar distância: meça a 1ª distância — clique em dois pontos (perto de um vértice, o clique cai exatamente nele). Esc sai.';
      }
      case 'cota-distancia':
      case 'cota-horizontal-vertical': {
        const nome = modo === 'cota-distancia' ? 'Cota distância' : 'Horizontal / Vertical';
        if (pontosEmEdicao.length === 0) {
          return `${nome}: clique no primeiro ponto, numa peça (perto de um vértice, o clique cai exatamente nele). Para apagar uma cota, clique no número dela. Esc sai.`;
        }
        if (pontosEmEdicao.length === 1) return `${nome}: clique no segundo ponto. Esc sai.`;
        return modo === 'cota-distancia'
          ? 'Cota distância: clique onde a linha de cota deve ficar. Esc sai.'
          : 'Horizontal / Vertical: clique onde a cota deve ficar — acima ou abaixo dos pontos, mede a horizontal; ao lado deles, a vertical. Esc sai.';
      }
      case 'cota-angulo':
        return [
          'Ângulo: clique num ponto de um dos lados, numa peça. Para apagar uma cota, clique no número dela. Esc sai.',
          'Ângulo: clique no vértice do ângulo. Esc sai.',
          'Ângulo: clique num ponto do outro lado. Esc sai.',
          'Ângulo: clique onde o arco da cota deve ficar. Esc sai.',
        ][Math.min(pontosEmEdicao.length, 3)]!;
      case 'cota-perimetro':
        return 'Cota perímetro: clique dentro de uma peça, onde o perímetro dela deve ficar escrito. Para apagar uma cota, clique no número dela. Esc sai.';
      case 'comparar-perimetros': {
        const [primeira, segunda] = medicoesResolvidas;
        if (inicioDoTrecho) {
          return 'Comparar perímetros: clique no segundo ponto do contorno — o trecho segue a numeração dos pontos. Esc sai.';
        }
        if (primeira && segunda) return `${descreverComparacao(primeira, segunda)} — clique para comparar de novo; Esc sai.`;
        if (primeira) return `${descreverMedicao(primeira)} — agora faça a 2ª medida. Esc sai.`;
        return 'Comparar perímetros: faça a 1ª medida — clique dentro de uma peça (perímetro inteiro) ou em dois pontos do contorno (trecho). Esc sai.';
      }
      default:
        break;
    }
    if (aviso && aviso.pecas === pecas && aviso.selecionadoId === selecionadoId) return aviso.texto;
    if (cerca) {
      return (
        <>
          Cerca ativa: &ldquo;Mover cerca&rdquo; (aba Manipulação) desloca os pontos destacados. Clique em
          &ldquo;Definir cerca&rdquo; de novo para removê-la.
        </>
      );
    }
    return null;
  })();

  return (
    <div ref={appShellRef} className="app-shell" onKeyDown={aoTeclar} tabIndex={-1}>
      <BarraDeFerramentas
        modo={modo}
        podeDesfazer={passado.length > 0}
        podeRefazer={futuro.length > 0}
        temSelecao={selecionadoId !== null || idsSelecionadosEmLote.size > 0}
        temSelecaoUnica={selecionadoId !== null}
        onNovoProjeto={novoProjeto}
        onDesfazer={desfazer}
        onRefazer={refazer}
        onDuplicar={duplicarSelecionado}
        onExcluir={excluirSelecionado}
        onSelecionarTudo={selecionarTudo}
        podeSelecionarTudo={pecas.length > 0}
        onCopiar={copiarSelecionado}
        onRecortar={recortarSelecionado}
        onColar={colar}
        podeColar={clipboard !== null}
        onZoomIn={() => zoom(1.15)}
        onZoomOut={() => zoom(1 / 1.15)}
        onAjustarTela={ajustarTela}
        onVistaAnterior={vistaAnterior}
        onProximaVista={proximaVista}
        podeVistaAnterior={vistasAnteriores.length > 0}
        podeProximaVista={vistasSeguintes.length > 0}
        mostrarGrade={mostrarGrade}
        onAlternarGrade={() => setMostrarGrade((v) => !v)}
        imaAtivo={imaAtivo}
        onAlternarIma={() => setImaAtivo((v) => !v)}
        unidadeDaRegua={unidadeDaRegua}
        onDefinirUnidadeDaRegua={setUnidadeDaRegua}
        onAbrirAtalhos={() => setPainelDeAjuda('atalhos')}
        onAbrirSobre={() => setPainelDeAjuda('sobre')}
        mostrarListaDePecas={mostrarListaDePecas}
        onAlternarListaDePecas={() => setMostrarListaDePecas((v) => !v)}
        mostrarBarraDeVisualizacao={mostrarBarraDeVisualizacao}
        onAlternarBarraDeVisualizacao={() => setMostrarBarraDeVisualizacao((v) => !v)}
        mostrarValidacao={mostrarValidacao}
        onAlternarValidacao={() => setMostrarValidacao((v) => !v)}
        onAbrirPropriedadesDaPeca={() => selecionadoId && abrirPropriedadesDaPeca(selecionadoId)}
        temCerca={cerca !== null}
        onAlternarDefinirCerca={alternarDefinirCerca}
        onMoverCerca={() => setMostrarMoverCerca(true)}
        onEntrarModoSelecionar={cancelarModo}
        onEntrarModoNovoMolde={entrarModoNovoMolde}
        onEntrarModoNovoFuro={entrarModoNovoFuro}
        onEntrarModoPique={entrarModoPique}
        onEntrarModoMarca={entrarModoMarca}
        onImportarDxf={importarDxfHandler}
        onImportarPdf={importarPdfHandler}
        onAbrirTecido={() => setPainelAberto('tecido')}
        onAbrirEnfesto={() => setPainelAberto('enfesto')}
        onSugerirPosicao={sugerirPosicaoParaSelecionada}
        podeSugerirPosicao={selecionadoId !== null && enfesto !== null}
        onNestingAutomatico={abrirConfiguracaoDeNesting}
        podeExecutarNesting={enfesto !== null && pecas.length > 0 && !nestingExecutando}
        onAbrirExportacaoPdf={() => setMostrarExportacaoPdf(true)}
        podeExportarPdf={pecas.length > 0}
        onSalvar={salvarProjetoAtual}
        onSalvarComo={salvarComo}
        onAbrirBiblioteca={abrirBiblioteca}
        onAbrirHistorico={() => setMostrarHistorico(true)}
        onAbrirRelatorio={() => setMostrarRelatorio(true)}
        onEntrarModoMoverPonto={entrarModoMoverPonto}
        onEntrarModoModificar={entrarModoModificar}
        onEntrarModoRedefinirPerimetro={entrarModoRedefinirPerimetro}
        onEntrarModoInserirPonto={entrarModoInserirPonto}
        onEntrarModoExcluirPonto={entrarModoExcluirPonto}
        onEntrarModoArredondarOuChanfrar={entrarModoArredondarOuChanfrar}
        onAbrirDimensionar={() => setMostrarDimensionar(true)}
        onEspelharManual={espelharSelecionadaManualmente}
        onGirarLivre={girarLivreSelecionada}
        onElementoParalelo={criarElementoParaleloDaSelecionada}
        onConverterEmCostura={() => setMostrarCostura(true)}
        onInverterSelecao={inverterSelecaoDePecas}
        onCriarPontoDeRestauracao={criarPontoDeRestauracao}
        onRestaurar={restaurarSelecionada}
        temPontoDeRestauracao={selecionadoId !== null && pontosDeRestauracao.has(selecionadoId)}
        onEntrarModoRetangulo={entrarModoRetangulo}
        onEntrarModoSentidoDoFio={entrarModoSentidoDoFio}
        onAbrirCostura={() => setMostrarCostura(true)}
        onRemoverCostura={removerCostura}
        podeRemoverCostura={alvosDeCostura.some((p) => p.margemDeCosturaMm > 0)}
        onEntrarModoMedirDistancia={() => entrarModoDeMedida('medir-distancia')}
        onEntrarModoMedirPerimetro={() => entrarModoDeMedida('medir-perimetro')}
        onEntrarModoCompararPerimetros={() => entrarModoDeMedida('comparar-perimetros')}
        onAbrirInformacoesDosMoldes={() => setMostrarInformacoesDosMoldes(true)}
        onEntrarModoCompararDistancias={() => entrarModoDeMedida('comparar-distancias')}
        onEntrarModoCotaDistancia={() => entrarModoDeCota('cota-distancia')}
        onEntrarModoCotaHorizontalVertical={() => entrarModoDeCota('cota-horizontal-vertical')}
        onEntrarModoCotaAngulo={() => entrarModoDeCota('cota-angulo')}
        onEntrarModoCotaPerimetro={() => entrarModoDeCota('cota-perimetro')}
        onConverterEmContorno={converterEmContorno}
        onAbrirVariantes={abrirVariantes}
        onEntrarModoCurva={() => entrarModoNaPecaSelecionada('curva')}
        onEntrarModoArco2Pontos={() => entrarModoNaPecaSelecionada('arco-2-pontos')}
        onEntrarModoArco3Pontos={() => entrarModoNaPecaSelecionada('arco-3-pontos')}
        onEntrarModoArcoTangente={() => entrarModoNaPecaSelecionada('arco-tangente')}
        onEntrarModoEditarPontosDeCurva={() => entrarModoNaPecaSelecionada('editar-pontos-de-curva')}
        onEntrarModoCadastrarCurva={() => entrarModoNaPecaSelecionada('cadastrar-curva')}
        onAbrirCurvaPredefinida={() => selecionadoId && setDialogoDeFerramenta({ tipo: 'escolher-curva' })}
        onAbrirEspiral={() => setDialogoDeFerramenta({ tipo: 'espiral' })}
        onEntrarModoCirculo={() => entrarModoDeConstrucao('circulo')}
        onUsarFerramentaDeMolde={usarFerramentaDeMolde}
        temOutraPeca={pecas.length >= 2}
        onUsarFerramentaDeGraduacao={usarFerramentaDeGraduacao}
        temGraduacao={pecaSelecionada?.graduacao !== undefined}
        temOutrasMarcadas={[...idsSelecionadosEmLote].some((id) => id !== selecionadoId)}
        onAlinhar={alinharSelecionadas}
        podeAlinhar={idsSelecionadosEmLote.size >= 2}
      />
      {painelAberto === 'tecido' && (
        <PainelDeTecido
          tecidoAtual={tecido}
          onFechar={() => setPainelAberto(null)}
          onSalvar={(t) => {
            setTecido(t);
            setPainelAberto(null);
            registrarEventoEPersistir('mudanca-de-configuracao', { pecas, tecido: t, enfesto }, `Tecido: ${t.nome}`);
          }}
        />
      )}
      {painelAberto === 'enfesto' && (
        <PainelDeEnfesto
          configAtual={enfesto}
          onFechar={() => setPainelAberto(null)}
          onSalvar={(c) => {
            setEnfesto(c);
            setPainelAberto(null);
            registrarEventoEPersistir(
              'mudanca-de-configuracao',
              { pecas, tecido, enfesto: c },
              `Enfesto: ${ROTULO_DO_TIPO[c.tipo]}`,
            );
          }}
        />
      )}
      {mostrarPainelDeNesting && (
        <PainelDeNesting
          pecas={pecas}
          executando={nestingExecutando}
          progresso={progressoNesting}
          resultado={resultadoNesting}
          onCalcular={calcularNestingAutomatico}
          onCancelar={cancelarNestingAutomatico}
          onAplicar={aplicarResultadoNesting}
          onFechar={fecharPainelDeNesting}
        />
      )}
      {mostrarExportacaoPdf && (
        <PainelDeExportacaoPdf
          podeExportarEncaixeCompleto={enfesto !== null}
          gerando={gerandoPdf}
          onExportar={(opcoes) => void exportarPdf(opcoes)}
          onFechar={() => setMostrarExportacaoPdf(false)}
        />
      )}
      {mostrarDimensionar && pecaSelecionada && (
        <PainelDeDimensionar
          larguraAtualMm={dimensoesDoMolde(pecaSelecionada).larguraMm}
          alturaAtualMm={dimensoesDoMolde(pecaSelecionada).alturaMm}
          onAplicar={(fatorX, fatorY, comoCopia) => {
            dimensionarSelecionada(fatorX, fatorY, comoCopia);
            setMostrarDimensionar(false);
          }}
          onFechar={() => setMostrarDimensionar(false)}
        />
      )}
      {mostrarBiblioteca && (
        <PainelDeBiblioteca
          projetos={projetos}
          projetoAtualId={projetoAtual.id}
          onAbrir={abrirProjeto}
          onDuplicar={duplicarProjetoDaBiblioteca}
          onRenomear={renomearProjetoDaBiblioteca}
          onArquivar={arquivarProjetoDaBiblioteca}
          onExcluir={excluirProjetoDaBiblioteca}
          onFechar={() => setMostrarBiblioteca(false)}
        />
      )}
      {mostrarHistorico && (
        <PainelDeHistorico
          projeto={projetoAtual}
          onRestaurar={(idDoEvento) => {
            restaurarVersaoDoHistorico(idDoEvento);
            setMostrarHistorico(false);
          }}
          onFechar={() => setMostrarHistorico(false)}
        />
      )}
      {mostrarRelatorio && (
        <PainelDeRelatorio
          relatorio={relatorioAtual}
          gerando={gerandoRelatorio}
          onExportarPdf={() => void exportarRelatorio('pdf')}
          onExportarExcel={() => void exportarRelatorio('xlsx')}
          onFechar={() => setMostrarRelatorio(false)}
        />
      )}
      {mostrarNovoProjeto && (
        <PainelDeNovoProjeto onCriar={criarNovoProjetoComDados} onFechar={() => setMostrarNovoProjeto(false)} />
      )}
      {mostrarMoverCerca && cerca && (
        <PainelDeMoverCerca
          cerca={cerca}
          pecas={alvosDaCerca}
          temSelecao={selecionadoId !== null || idsSelecionadosEmLote.size > 0}
          opcoes={opcoesDaCerca}
          onAlterarOpcoes={setOpcoesDaCerca}
          onAplicar={aplicarMoverCerca}
          onFechar={() => setMostrarMoverCerca(false)}
        />
      )}
      {modo === 'modificar' && pontosParaModificar && pecaSelecionada && (
        <PainelDeModificar
          peca={pecaSelecionada}
          indices={pontosParaModificar}
          onAplicar={(delta) => aplicarModificar(pontosParaModificar, delta)}
          onFechar={() => setPontosParaModificar(null)}
        />
      )}
      {modo === 'redefinir-perimetro' && redefinicaoDePerimetro && pecaSelecionada && (
        <PainelDeRedefinirPerimetro
          peca={pecaSelecionada}
          redefinicao={redefinicaoDePerimetro}
          onAlterar={alterarRedefinicaoDePerimetro}
          onAplicar={(comprimento, ponta) =>
            aplicarRedefinirPerimetro(redefinicaoDePerimetro.indiceAresta, comprimento, ponta)
          }
          onFechar={() => setRedefinicaoDePerimetro(null)}
        />
      )}
      {mostrarCostura && alvosDeCostura.length > 0 && (
        <PainelDeCostura pecas={alvosDeCostura} onAplicar={aplicarCostura} onFechar={() => setMostrarCostura(false)} />
      )}
      {mostrarInformacoesDosMoldes && (
        <PainelDeInformacoesDosMoldes
          pecas={pecas}
          selecionadoId={selecionadoId}
          onSelecionar={selecionarUnico}
          onFechar={() => setMostrarInformacoesDosMoldes(false)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'escolher-curva' && (
        <PainelDeCurvaPredefinida
          curvas={curvasDisponiveis}
          idInicial={curvaEscolhida?.curva.id ?? null}
          espelharInicial={curvaEscolhida?.espelhar ?? false}
          onEscolher={(curva, espelhar) => {
            entrarModoDeConstrucao('curva-predefinida');
            setCurvaEscolhida({ curva, espelhar });
          }}
          onExcluir={excluirCurvaCadastrada}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'numero-de-pontos' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Editar pontos de curva"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            [
              'Trecho',
              `${pontosDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)} pontos em ${formatarMm(comprimentoDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim))}`,
            ],
          ]}
          campos={[
            {
              tipo: 'inteiro',
              id: 'pontos',
              rotulo: 'Número de pontos do trecho (contando as duas pontas)',
              inicial: String(pontosDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)),
            },
          ]}
          nota="Os pontos ficam igualmente espaçados ao longo do trecho. Com menos pontos a curva fica mais simples, e a forma pode mudar um pouco."
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) =>
            aplicarTrecho(
              'editar-pontos-de-curva',
              { inicio: dialogoDeFerramenta.inicio, fim: dialogoDeFerramenta.fim, livres: [] },
              { quantidadeDePontos: Number(valores.pontos) },
            )
          }
          onFechar={() => {
            setDialogoDeFerramenta(null);
            setTrecho(SEM_TRECHO);
          }}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'cadastrar-curva' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Cadastrar curva"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            [
              'Trecho',
              `${pontosDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)} pontos em ${formatarMm(comprimentoDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim))}`,
            ],
          ]}
          campos={[{ tipo: 'texto', id: 'nome', rotulo: 'Nome da curva', inicial: '' }]}
          nota="Fica guardada só a forma do trecho, sem o tamanho: em “Pré-definida”, ela estica ou encolhe para caber entre dois pontos. O cadastro fica neste computador."
          rotuloDoBotao="Cadastrar"
          onAplicar={(valores) => cadastrarCurva(String(valores.nome), dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)}
          onFechar={() => {
            setDialogoDeFerramenta(null);
            setTrecho(SEM_TRECHO);
          }}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'espiral' && (
        <DialogoDeCampos
          titulo="Espiral"
          campos={[
            { tipo: 'medida', id: 'largura', rotulo: 'Largura da tira (mm)', inicial: String(espiralPendente?.larguraMm ?? 60) },
            {
              tipo: 'medida',
              id: 'perimetro',
              rotulo: 'Perímetro (mm): o comprimento da borda de dentro',
              inicial: String(espiralPendente?.perimetroMm ?? 1000),
            },
          ]}
          nota="É o molde em espiral do babado: uma tira enrolada, cuja borda de dentro — a que se costura esticada — mede o perímetro. Depois de confirmar, clique onde o centro da espiral deve ficar."
          rotuloDoBotao="Posicionar"
          onAplicar={(valores) => {
            const larguraMm = Number(valores.largura);
            const perimetroMm = Number(valores.perimetro);
            try {
              espiral(ponto(0, 0), larguraMm, perimetroMm);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            entrarModoDeConstrucao('espiral');
            setEspiralPendente({ larguraMm, perimetroMm });
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'bainha' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Bainha"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[
            {
              tipo: 'inteiro',
              id: 'dobras',
              rotulo: `Número de dobras (1 a ${MAXIMO_DE_DOBRAS_DA_BAINHA})`,
              inicial: String(opcoesDeBainha.dobras),
            },
            { tipo: 'medida', id: 'largura', rotulo: 'Largura de cada dobra (mm)', inicial: paraCampo(opcoesDeBainha.larguraMm) },
            {
              tipo: 'medida',
              id: 'largura2',
              rotulo: 'Largura 2 (mm): só se a outra ponta tiver largura diferente',
              inicial: opcoesDeBainha.largura2Mm === undefined ? '' : paraCampo(opcoesDeBainha.largura2Mm),
              opcional: true,
            },
            { tipo: 'caixa', id: 'piques', rotulo: 'Pique nas pontas de cada linha de dobra', inicial: opcoesDeBainha.piques },
          ]}
          nota="Depois de confirmar, clique no contorno da peça onde a bainha começa e onde termina. A sobra sai para fora da peça, as laterais copiam as costuras vizinhas (para caírem em cima delas quando a bainha dobrar), e cada linha de dobra fica como linha interna."
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            const opcoes: OpcoesDeBainha = {
              dobras: Number(valores.dobras),
              larguraMm: Number(valores.largura),
              ...(valores.largura2 === undefined ? {} : { largura2Mm: Number(valores.largura2) }),
              piques: valores.piques === true,
            };
            try {
              conferirOpcoesDeBainha(opcoes);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            entrarModoDeConstrucao('bainha');
            setOpcoesDeBainha(opcoes);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'unir' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Unir moldes"
          resumo={[['Primeira peça', pecaSelecionada.nome]]}
          campos={[
            {
              tipo: 'caixa',
              id: 'apenasMover',
              rotulo: 'Apenas mover: a outra peça encosta, mas as duas continuam separadas',
              inicial: unirApenasMovendo,
            },
          ]}
          nota="Depois de confirmar, clique na aresta desta peça por onde as duas se juntam e, em seguida, na aresta da outra peça. A outra gira e encosta, aresta com aresta, centralizada. Unidas, as duas viram uma peça só, com o nome e a linha de fio desta."
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            entrarModoDeConstrucao('unir');
            setUnirApenasMovendo(valores.apenasMover === true);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'pence' && dialogoDePence && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.ferramenta}
          titulo={dialogoDePence.titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDePence.campos}
          nota={dialogoDePence.nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            try {
              const novas = lerDialogoDaPence(dialogoDeFerramenta.ferramenta, opcoesDasPences, valores);
              entrarModoDeConstrucao(dialogoDeFerramenta.ferramenta);
              setOpcoesDasPences(novas);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'tamanhos' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Graduação: tamanhos"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeTamanhos(pecaSelecionada).campos}
          nota={dialogoDeTamanhos(pecaSelecionada).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            try {
              const comTamanhos = aplicarTamanhos(pecaSelecionada, valores);
              // Confirmar sem mudar nada não gasta um passo de desfazer.
              if (!mesmosTamanhos(pecaSelecionada, comTamanhos)) {
                aplicarMudanca(pecas.map((p) => (p.id === pecaSelecionada.id ? comTamanhos : p)));
              }
              entrarModoDeConstrucao('graduar-tabela');
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'graduacao' && dialogoDeGraduacao && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.ferramenta}
          titulo={dialogoDeGraduacao.titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeGraduacao.campos}
          nota={dialogoDeGraduacao.nota}
          rotuloDoBotao={dialogoDeGraduacao.rotuloDoBotao}
          onAplicar={(valores) => {
            const ferramenta = dialogoDeFerramenta.ferramenta;
            try {
              const novas = lerDialogoDaGraduacao(ferramenta, opcoesDaGraduacao, valores);
              // "Separar" e "Remover do molde inteiro" agem na hora; as outras ligam a ferramenta.
              const naHora =
                ferramenta === 'separar-tamanhos'
                  ? aplicarSeparar(novas, pecas, pecaSelecionada, proximoId)
                  : ferramenta === 'remover-graduacao' && novas.remover.onde === 'molde'
                    ? aplicarRemoverDoMolde(novas, pecas, pecaSelecionada)
                    : null;
              setOpcoesDaGraduacao(novas);
              if (naHora) {
                const novasPecas = [...naHora.pecas];
                aplicarMudanca(novasPecas);
                cancelarModo();
                avisar(naHora.recado, novasPecas);
              } else if (ehModoDeGraduacao(ferramenta)) {
                entrarModoDeConstrucao(ferramenta);
              }
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'escolher-regra' && (
        <PainelDeRegras
          regras={regrasDoUsuario}
          idInicial={regraEscolhida?.id ?? null}
          onEscolher={(regra) => {
            entrarModoDeConstrucao('graduar-regras');
            setRegraEscolhida(regra);
          }}
          onExcluir={excluirRegraCadastrada}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'tabela-do-ponto' && pontoDaGraduacao && pecaSelecionada && (
        <PainelDeTabelaDeGraduacao
          key={pontoDaGraduacao.indice}
          nomeDaPeca={pecaSelecionada.nome}
          numeroDoPonto={pontoDaGraduacao.indice + 1}
          graduado={pontoGraduadoEm(pontoDaGraduacao.graduacao, pecaSelecionada.contorno, pontoDaGraduacao.indice) !== null}
          emGrupo={
            pontoGraduadoEm(pontoDaGraduacao.graduacao, pecaSelecionada.contorno, pontoDaGraduacao.indice)?.grupo !== undefined
          }
          tamanhos={pontoDaGraduacao.graduacao.tamanhos}
          base={pontoDaGraduacao.graduacao.base}
          deslocamentos={pontoDaGraduacao.regra}
          copiada={regraParaColar}
          onCopiar={(deslocamentos) =>
            setRegraCopiada(regraDoPonto('copiada', 'copiada', pontoDaGraduacao.graduacao, deslocamentos))
          }
          onAplicar={(deslocamentos) => {
            try {
              const graduacao = definirRegra(pontoDaGraduacao.graduacao, pecaSelecionada.contorno, pontoDaGraduacao.indice, deslocamentos);
              aplicarMudanca(pecas.map((p) => (p.id === pecaSelecionada.id ? { ...p, graduacao } : p)));
              setRecadoDaFerramenta(`Ponto ${pontoDaGraduacao.indice + 1} graduado pela tabela.`);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'nome-da-regra' && pontoDaGraduacao && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Criar regra"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            ['Ponto', String(pontoDaGraduacao.indice + 1)],
            ['Tamanhos', pontoDaGraduacao.graduacao.tamanhos.join(', ')],
          ]}
          campos={[{ tipo: 'texto', id: 'nome', rotulo: 'Nome da regra', inicial: '' }]}
          nota="A regra guarda o que este ponto anda em cada tamanho. Fica no cadastro deste computador, em “Regras”, e vale para as peças que têm esses tamanhos."
          rotuloDoBotao="Criar regra"
          onAplicar={(valores) => {
            try {
              const regra = regraDoPonto(proximoId(), String(valores.nome), pontoDaGraduacao.graduacao, pontoDaGraduacao.regra);
              const novas = [...regrasDoUsuario, regra];
              if (!gravarRegrasCadastradas(window.localStorage, novas)) return 'Não foi possível guardar a regra neste computador.';
              setRegrasDoUsuario(novas);
              setRecadoDaFerramenta(`Regra “${regra.nome}” criada: está em “Regras”.`);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'raio-do-arco' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Arco tangente a 2 retas"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            ['Canto', `ponto ${dialogoDeFerramenta.indice + 1}`],
          ]}
          campos={[{ tipo: 'medida', id: 'raio', rotulo: 'Raio do arco (mm)', inicial: '10' }]}
          nota="O canto vira um arco tangente às duas arestas que se encontram nele. Um raio grande demais para as arestas é reduzido ao que cabe."
          rotuloDoBotao="Criar arco"
          onAplicar={(valores) => {
            const raioMm = Number(valores.raio);
            if (!(raioMm > 0)) return 'O raio precisa ser maior que zero.';
            try {
              aplicarMudanca(
                pecas.map((p) =>
                  p.id === pecaSelecionada.id ? arredondarCantoDoMolde(p, dialogoDeFerramenta.indice, raioMm) : p,
                ),
              );
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {mostrarVariantes && (
        <PainelDeVariantes
          variantes={variantesDoProjeto(projetos, projetoAtual)}
          projetoAtualId={projetoAtual.id}
          nomeSugerido={nomeDaProximaVariante(projetos, projetoAtual)}
          onCriar={criarVarianteDoProjeto}
          onAbrir={abrirVarianteDoProjeto}
          onFechar={() => setMostrarVariantes(false)}
        />
      )}
      {painelDeAjuda && <PainelDeAjuda conteudo={painelDeAjuda} onFechar={() => setPainelDeAjuda(null)} />}
      {textoDaFaixa && (
        <div className="faixa-de-instrucao" role="status">
          {textoDaFaixa}
        </div>
      )}
      {mensagensImportacao && (
        <div className="faixa-de-avisos" role="alert">
          <strong>Avisos da importação:</strong>
          <ul>
            {mensagensImportacao.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <button onClick={() => setMensagensImportacao(null)}>Dispensar</button>
        </div>
      )}
      <div className={mostrarListaDePecas ? 'corpo-principal' : 'corpo-principal sem-lista-de-pecas'}>
        {mostrarListaDePecas && (
          <PainelDePecas
            pecas={pecas}
            selecionadoId={selecionadoId}
            idsSelecionadosEmLote={idsSelecionadosEmLote}
            onSelecionar={selecionarUnico}
            onAlternarSelecaoEmLote={alternarSelecaoEmLote}
            onAbrirPropriedades={abrirPropriedadesDaPeca}
          />
        )}
        <div className="coluna-do-desenho">
          <div className="barra-de-documento">
            <span className="aba-de-documento" title="Projeto aberto">
              {projetoAtual.nome || 'Projeto sem nome'}
            </span>
            <span className="contexto-do-documento">
              <span>Tecido: {tecido ? `${tecido.nome} (${tecido.larguraUtilMm} mm úteis)` : 'não configurado'}</span>
              <span>
                Enfesto:{' '}
                {enfesto ? `${ROTULO_DO_TIPO[enfesto.tipo]}, ${enfesto.quantidadeDeCamadas} camada(s)` : 'não configurado'}
              </span>
            </span>
          </div>
          <AreaDeDesenho
            pecas={pecas}
            selecionadoId={selecionadoId}
            idsSelecionadosEmLote={idsSelecionadosEmLote}
            enfesto={enfesto}
            idsComErro={idsComErro}
            transform={transform}
            modo={modo}
            pontosEmEdicao={pontosEmEdicao}
            contornoFinalizado={contornoPendente}
            onTransformChange={setTransform}
            onSelecionar={selecionarUnico}
            onCursorMove={setCursorMundo}
            onCliqueNoCanvas={onCliqueNoCanvas}
            onMoverPeca={moverPeca}
            onAbrirPropriedades={abrirPropriedadesDaPeca}
            onMoverVariosPontos={moverVariosPontosDaSelecionada}
            onIndicarPontosParaModificar={setPontosParaModificar}
            onIndicarArestaParaRedefinir={indicarArestaParaRedefinir}
            arestaEmDestaque={arestaEmDestaque}
            onInserirPontoNoMolde={inserirPontoNaSelecionada}
            onExcluirPontoDoMolde={excluirPontoDaSelecionada}
            onArredondarOuChanfrarCanto={arredondarOuChanfrarVerticeDaSelecionada}
            cerca={cerca}
            opcoesDaCerca={opcoesDaCerca}
            onDefinirCerca={definirCerca}
            ferramentaDeVista={ferramentaDeVista}
            onZoomJanelaConcluido={() => setFerramentaDeVista(null)}
            onGuardarVista={guardarVista}
            mostrarGrade={mostrarGrade}
            imaAtivo={imaAtivo}
            unidadeDaRegua={unidadeDaRegua}
            onAlternarUnidadeDaRegua={() => setUnidadeDaRegua((u) => (u === 'cm' ? 'mm' : 'cm'))}
            onTamanhoChange={aoMudarTamanhoDaTela}
            medicoes={medicoesResolvidas}
            inicioDoTrecho={inicioDoTrecho}
            cotaEmPrevia={cotaEmPrevia}
            previa={previaNoDesenho}
          />
          {mostrarBarraDeVisualizacao && (
            <BarraDeVisualizacao
              ferramentaDeVista={ferramentaDeVista}
              onAlternarFerramentaDeVista={alternarFerramentaDeVista}
              onZoomIn={() => zoom(1.15)}
              onZoomOut={() => zoom(1 / 1.15)}
              onAjustarTela={ajustarTela}
              onVistaAnterior={vistaAnterior}
              onProximaVista={proximaVista}
              podeVistaAnterior={vistasAnteriores.length > 0}
              podeProximaVista={vistasSeguintes.length > 0}
              mostrarGrade={mostrarGrade}
              onAlternarGrade={() => setMostrarGrade((v) => !v)}
              imaAtivo={imaAtivo}
              onAlternarIma={() => setImaAtivo((v) => !v)}
              passoDaGradeMm={passoDaGradeEmMm(transform.escalaPxPorMm)}
              unidadeDaRegua={unidadeDaRegua}
            />
          )}
        </div>
      </div>
      {importacaoPdfPendente && (
        <DialogoDeImportacaoDeContornos
          titulo="Importar contornos do PDF"
          descricao="A escala é a do papel: escolha o fator abaixo."
          resumoDeDescartes={`Descartados: ${importacaoPdfPendente.descartados.borda} de borda da folha, ${importacaoPdfPendente.descartados.areaPequena} de área pequena (letras e marcas), ${importacaoPdfPendente.descartados.abertos} abertos. Curvas aproximadas por segmentos retos: ${importacaoPdfPendente.curvasAproximadas}.`}
          candidatos={importacaoPdfPendente.candidatos.map((c) => ({ id: c.id, vertices: c.vertices }))}
          mostrarEscala
          onConfirmar={confirmarImportacaoPdf}
          onCancelar={() => setImportacaoPdfPendente(null)}
        />
      )}
      {importacaoDxfPendente && (
        <DialogoDeImportacaoDeContornos
          titulo="Importar contornos do DXF"
          descricao={`Unidade do arquivo: ${importacaoDxfPendente.unidadeDetectada}.`}
          resumoDeDescartes="Linhas abertas do arquivo ficam como linhas internas das peças."
          candidatos={importacaoDxfPendente.pecas.map((p, indice) => ({
            id: String(indice),
            vertices: p.contorno.length,
            direcaoSugerida: p.linhaDeFio ? direcaoNaTelaDaLinhaDeFio(p.linhaDeFio) : undefined,
          }))}
          mostrarEscala={false}
          onConfirmar={confirmarImportacaoDxf}
          onCancelar={() => setImportacaoDxfPendente(null)}
        />
      )}
      {mostrarPropriedadesDaPeca && pecaSelecionada && (
        <Sobreposicao titulo="Propriedades da peça" onFechar={() => setMostrarPropriedadesDaPeca(false)}>
          <PainelDePropriedades peca={pecaSelecionada} onAlterar={alterarPecaSelecionada} onGirar={girarPecaSelecionada} />
        </Sobreposicao>
      )}
      {mostrarValidacao && (
        <div className="faixa-de-validacao" role="alert">
          <strong>Validação do projeto:</strong>
          {problemasDeValidacao.length === 0 ? (
            <p>Nenhum problema encontrado.</p>
          ) : (
            <ul>
              {problemasDeValidacao.map((p, i) => (
                <li
                  key={i}
                  className={`severidade-${p.severidade}`}
                  onClick={() => p.pecasEnvolvidasIds[0] && setSelecionadoId(p.pecasEnvolvidasIds[0])}
                >
                  [{p.severidade === 'erro' ? 'ERRO' : 'aviso'}] {p.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <BarraDeStatus
        cursorMundo={cursorMundo}
        transform={transform}
        totalDePecas={pecas.length}
        pecasSelecionadas={idsSelecionadosEmLote.size > 0 ? idsSelecionadosEmLote.size : selecionadoId !== null ? 1 : 0}
        problemas={problemasDeValidacao}
        onAlternarValidacao={() => setMostrarValidacao((v) => !v)}
        aproveitamentoPercentual={aproveitamentoAtualDaMesa}
        unidade={unidadeDaRegua}
        pontoReferencia={
          MODOS_COM_PONTO_DE_REFERENCIA.has(modo) && pontosEmEdicao.length > 0
            ? pontosEmEdicao[pontosEmEdicao.length - 1]!
            : null
        }
      />
    </div>
  );
}
