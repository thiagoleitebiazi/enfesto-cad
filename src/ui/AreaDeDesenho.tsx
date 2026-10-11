import { useCallback, useEffect, useRef, useState } from 'react';
import { contornoDeCorte, transladarMolde, type Molde, type PontaDaAresta } from '../domain/molde';
import {
  bissetrizDaCotaDeAngulo,
  geometriaDaCotaLinear,
  valorDaCotaDeAngulo,
  valorDaCotaDeRaio,
  valorDaCotaLinear,
  type Cota,
} from '../domain/cota';
import { cercaEntre, pecasAlvoDaCerca, pontosMoveisNaCerca, type Cerca, type OpcoesDeMoverCerca } from '../domain/cerca';
import { contornosDosTamanhos } from '../domain/graduacao';
import { tracosDaMarca, tracosDoPique, tracosNaLinhaDeCorte } from '../domain/piques';
import { elementosDaPeca } from '../domain/linhasAuxiliares';
import { arestaDeSimetria, ondeEscreverOCodigo } from '../domain/anotacoes';
import {
  perimetro,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  retanguloEnvolvente,
  distancia,
  ponto,
  somar,
  type Ponto2D,
} from '../core/geometria';
import type { ConfiguracaoDeEnfesto } from '../domain/enfesto';
import {
  aplicarZoom,
  enquadrarRetanguloDeTela,
  mundoParaTela,
  telaParaMundo,
  passoDaGradeEmMm,
  passoDeReguaEmMm,
  subdivisoesDaRegua,
  valorDaReguaEmUnidade,
  type TransformacaoDeTela,
  type UnidadeDeRegua,
} from './transformacaoDeTela';
import { capturarComIma, pontosDeCapturaDasPecas, type TipoDeCaptura } from './ima';
import { formatarMm } from './medidas';
import type { MedicaoResolvida } from './medicao';
import type { ImagemDoModelo } from '../domain/imagens';

const ESPESSURA_REGUA_PX = 24;
const COR_FUNDO = '#dde1e6';
const COR_TECIDO = '#f4f5f7';
const COR_MESA = '#ffffff';
const COR_BORDA_MESA = '#8b93a1';
const COR_MARGEM_MESA = '#eef0f3';
const COR_CONTORNO = '#2b2f36';
const COR_CONTORNO_SELECIONADO = '#1565c0';
const COR_CONTORNO_COM_ERRO = '#c62828';
const COR_FIO = '#c62828';
const COR_LINHA_DE_CORTE = '#6b7280';
const COR_PIQUE = '#8e24aa';
const COR_MARCA = '#00838f';
/** As linhas internas que são só de construção (os elementos): claras, para não se confundirem com as do molde. */
const COR_ELEMENTO_DE_CONSTRUCAO = '#8a93a0';
const COR_EM_EDICAO = '#2e7d32';
const COR_REGUA_FUNDO = '#f7f8fa';
const COR_REGUA_TRACO = '#5a6270';
const COR_ALCA_DE_VERTICE = '#e65100';
const COR_ARESTA_EM_DESTAQUE = '#e65100';
const COR_CERCA = '#e65100';
const COR_PREENCHIMENTO_CERCA = 'rgba(230, 81, 0, 0.07)';
const COR_JANELA_DE_ZOOM = '#5a6270';
const COR_PREENCHIMENTO_JANELA_DE_ZOOM = 'rgba(90, 98, 112, 0.08)';
const COR_GRADE = 'rgba(90, 98, 112, 0.38)';
const COR_IMA = '#d81b60';
const COR_MEDICAO = '#e65100';
const COR_COTA = '#455a64';
/** Os contornos dos outros tamanhos de uma peça graduada, em volta do base. */
const COR_TAMANHO_GRADUADO = 'rgba(0, 121, 107, 0.8)';
/** A linha de simetria: traço e ponto, por cima da aresta em que a peça dobra. */
const COR_SIMETRIA = '#6a1b9a';
/** Distância (px) entre o contorno e o meio do código do pique, escrito do lado de dentro. */
const AFASTAMENTO_DO_CODIGO_DO_PIQUE_PX = 10;
/** Abaixo disso (px) um texto da peça não se lê: é desenhado nesse tamanho mínimo. */
const ALTURA_MINIMA_DO_TEXTO_PX = 7;

// Numeração de vértices: peças simples numeram todos; contornos com muitos
// pontos (curvas amostradas) só nos cantos, com espaço mínimo entre números.
const LIMITE_DE_VERTICES_SEMPRE_NUMERADOS = 40;
const GIRO_MINIMO_DE_CANTO_GRAUS = 15;
const ESPACO_MINIMO_ENTRE_NUMEROS_PX = 16;

/** Quanto a direção muda (graus) ao passar pelo vértice b, de a para c. */
function giroEmGraus(a: Ponto2D, b: Ponto2D, c: Ponto2D): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  if (nu === 0 || nv === 0) return 0;
  const cosseno = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv)));
  return (Math.acos(cosseno) * 180) / Math.PI;
}

export type ModoDeDesenho =
  | 'selecionar'
  | 'novo-molde'
  | 'novo-furo'
  | 'definir-fio'
  | 'inserir-pique'
  | 'remover-pique'
  | 'pique-texto'
  | 'multiplos-piques'
  | 'alinhar-piques'
  | 'cadastrar-pique'
  | 'alterar-pique'
  | 'linhas-auxiliares'
  | 'mover-ponto'
  | 'modificar'
  | 'inserir-ponto'
  | 'excluir-ponto'
  | 'arredondar-ou-chanfrar'
  | 'redefinir-perimetro'
  | 'definir-cerca'
  | 'retangulo'
  | 'sentido-do-fio'
  | 'medir-distancia'
  | 'medir-perimetro'
  | 'comparar-perimetros'
  | 'comparar-distancias'
  | 'cota-distancia'
  | 'cota-horizontal-vertical'
  | 'cota-angulo'
  | 'cota-perimetro'
  | 'curva'
  | 'arco-2-pontos'
  | 'arco-3-pontos'
  | 'arco-tangente'
  | 'arco-tangente-a-elemento'
  | 'arco-tangente-arco-reta'
  | 'arco-tangente-2-arcos'
  | 'cota-raio'
  | 'editar-pontos-de-curva'
  | 'cadastrar-curva'
  | 'curva-predefinida'
  | 'circulo'
  | 'espiral'
  | 'cortar'
  | 'remover-regiao'
  | 'dobrar'
  | 'desdobrar'
  | 'unir'
  | 'bainha'
  | 'pence-no-contorno'
  | 'pence-interna'
  | 'fechar-pence'
  | 'transferir-pence'
  | 'multiplas-pences'
  | 'pregas'
  | 'graduar-tabela'
  | 'graduar-automatico'
  | 'graduar-mouse'
  | 'graduar-tangente'
  | 'graduar-regras'
  | 'criar-regra'
  | 'remover-graduacao'
  | 'separar-tamanhos'
  | 'agrupar-graduacao'
  | 'deduzir-graduacao'
  | 'copiar-graduacao'
  | 'ajustar-graduacao'
  | 'graduar-curva'
  | 'reta-por-angulo'
  | 'estender-reta'
  | 'estender-ate-elemento'
  | 'estender-duas-retas'
  | 'ponto-por-intersecao'
  | 'ponto-no-centro-do-arco'
  | 'ponto-no-perimetro'
  | 'ponto-por-distancia'
  | 'extrair-molde'
  | 'mover-ponto-de-construcao'
  | 'manipulacao-rapida'
  | 'dividir-linha'
  | 'transformar-em-elementos'
  | 'copiar-elemento'
  | 'inserir-texto'
  | 'editar-texto'
  | 'linha-de-simetria'
  | 'relacionar-piques'
  | 'conferir'
  | 'calibrar-imagem';

/**
 * Ferramentas da barra de visualização (embaixo do desenho). Ficam por cima
 * do modo de desenho, sem trocá-lo: a Mão fica ligada até ser desligada (ou
 * Esc); o Zoom por janela vale para um retângulo e se desliga sozinho.
 */
export type FerramentaDeVista = 'mao' | 'zoom-janela';

const MODOS_DE_EDICAO_DE_VERTICE: ReadonlySet<ModoDeDesenho> = new Set([
  'mover-ponto',
  'modificar',
  'inserir-ponto',
  'excluir-ponto',
  'arredondar-ou-chanfrar',
  'redefinir-perimetro',
]);

/**
 * Modos que mostram as alças dos vértices da peça selecionada: os de edição
 * de vértice e as ferramentas que pedem pontos do contorno dela (curvas,
 * arcos, cortar, dobrar, unir, bainha, pences, pregas e graduação) — nestas
 * o clique segue para a ferramenta, sem agarrar o vértice.
 */
const MODOS_QUE_MOSTRAM_ALCAS: ReadonlySet<ModoDeDesenho> = new Set([
  ...MODOS_DE_EDICAO_DE_VERTICE,
  'curva',
  'arco-2-pontos',
  'arco-3-pontos',
  'arco-tangente',
  'arco-tangente-a-elemento',
  'arco-tangente-arco-reta',
  'arco-tangente-2-arcos',
  'editar-pontos-de-curva',
  'cadastrar-curva',
  'curva-predefinida',
  'cortar',
  'remover-regiao',
  'dobrar',
  'desdobrar',
  'unir',
  'bainha',
  'pence-no-contorno',
  'pence-interna',
  'fechar-pence',
  'transferir-pence',
  'multiplas-pences',
  'pregas',
  'graduar-tabela',
  'graduar-automatico',
  'graduar-mouse',
  'graduar-tangente',
  'graduar-regras',
  'criar-regra',
  'remover-graduacao',
  'separar-tamanhos',
  'agrupar-graduacao',
  'deduzir-graduacao',
  'copiar-graduacao',
  'ajustar-graduacao',
  'graduar-curva',
  'inserir-pique',
  'remover-pique',
  'pique-texto',
  'multiplos-piques',
  'alinhar-piques',
  'cadastrar-pique',
  'alterar-pique',
  'linhas-auxiliares',
]);

/**
 * Modos em que se seleciona vértices (clique, Shift+clique, retângulo) e se
 * arrasta a seleção. No "Modificar", um clique sem arrastar ainda abre a
 * medida exata para os vértices indicados.
 */
const MODOS_COM_SELECAO_DE_VERTICES: ReadonlySet<ModoDeDesenho> = new Set(['mover-ponto', 'modificar']);

/**
 * Modos em que o clique cria um ponto novo: neles o ímã prende o cursor. No
 * "Mover ponto" o ímã age no vértice arrastado (ver aoMoverMouse); arrastar a
 * peça inteira não é capturado.
 */
const MODOS_COM_IMA: ReadonlySet<ModoDeDesenho> = new Set([
  'novo-molde',
  'novo-furo',
  'definir-fio',
  'definir-cerca',
  'retangulo',
  'sentido-do-fio',
  'curva',
  'arco-2-pontos',
  'arco-3-pontos',
  'circulo',
  'espiral',
]);

/**
 * Modos de medida em que o clique cai no vértice mais próximo mesmo com o
 * ímã desligado: medir de canto a canto tem de dar o número exato. A grade
 * só prende com o ímã ligado, como nos outros modos.
 */
const MODOS_QUE_PRENDEM_NOS_VERTICES: ReadonlySet<ModoDeDesenho> = new Set([
  'medir-distancia',
  'comparar-distancias',
  'cota-distancia',
  'cota-horizontal-vertical',
  'cota-angulo',
]);

const RAIO_DE_CAPTURA_DE_VERTICE_PX = 10;
/** Abaixo disso (em px) o mouse apertado num vértice é clique, não arrasto: o vértice não sai do lugar. */
const LIMIAR_DE_ARRASTO_DE_VERTICE_PX = 3;
/** Abaixo disso (em px, na largura ou na altura) o retângulo é tratado como clique solto e ignorado. */
const TAMANHO_MINIMO_DA_CERCA_PX = 3;
const TAMANHO_MINIMO_DA_JANELA_DE_ZOOM_PX = 5;
/** Rolagens da roda separadas por menos que isso são um só gesto: guardam uma vista só no histórico. */
const PAUSA_ENTRE_GESTOS_DE_ROLAGEM_MS = 500;

/**
 * Retângulo sendo arrastado no canvas, em mm do mundo: seleção de vértices
 * (Mover ponto), definição da cerca ou zoom por janela.
 */
interface RetanguloEmDesenho {
  readonly tipo: 'selecao-de-vertices' | 'cerca' | 'zoom-janela';
  readonly inicio: Ponto2D;
  readonly atual: Ponto2D;
}

interface AreaDeDesenhoProps {
  readonly pecas: readonly Molde[];
  readonly selecionadoId: string | null;
  readonly idsSelecionadosEmLote: ReadonlySet<string>;
  readonly enfesto: ConfiguracaoDeEnfesto | null;
  readonly idsComErro: ReadonlySet<string>;
  readonly transform: TransformacaoDeTela;
  readonly modo: ModoDeDesenho;
  readonly pontosEmEdicao: readonly Ponto2D[];
  readonly contornoFinalizado: readonly Ponto2D[] | null;
  readonly onTransformChange: (t: TransformacaoDeTela) => void;
  readonly onSelecionar: (id: string | null) => void;
  readonly onCursorMove: (mundo: Ponto2D | null) => void;
  /** `mundo` é o ponto do clique, já preso pelo ímã quando vale; `semCaptura`, o ponto exato sob o mouse. */
  readonly onCliqueNoCanvas: (mundo: Ponto2D, semCaptura: Ponto2D) => void;
  readonly onMoverPeca: (id: string, deslocamento: Ponto2D) => void;
  readonly onAbrirPropriedades?: (id: string) => void;
  readonly onMoverVariosPontos?: (indices: readonly number[], delta: Ponto2D) => void;
  readonly onInserirPontoNoMolde?: (indiceAresta: number, ponto: Ponto2D) => void;
  readonly onExcluirPontoDoMolde?: (indice: number) => void;
  readonly onArredondarOuChanfrarCanto?: (indice: number) => void;
  /** "Modificar": clique sem arrastar num vértice — os vértices indicados, para digitar o deslocamento exato. */
  readonly onIndicarPontosParaModificar?: (indices: readonly number[]) => void;
  /** "Redefinir perímetro": clique numa aresta — ela e a ponta dela mais perto do clique. */
  readonly onIndicarArestaParaRedefinir?: (indiceAresta: number, extremidade: 'inicio' | 'fim') => void;
  /** Aresta escolhida no "Redefinir perímetro" (diálogo aberto) e a ponta que vai andar. */
  readonly arestaEmDestaque?: { readonly indiceAresta: number; readonly ponta: PontaDaAresta } | null;
  /** Cerca ativa (desenhada tracejada até ser desligada), ou `null`. */
  readonly cerca: Cerca | null;
  /** Categorias marcadas em "Mover cerca": só os pontos delas aparecem destacados dentro da cerca. */
  readonly opcoesDaCerca: OpcoesDeMoverCerca;
  readonly onDefinirCerca?: (cerca: Cerca) => void;
  readonly ferramentaDeVista: FerramentaDeVista | null;
  readonly onZoomJanelaConcluido?: () => void;
  /** Chamado antes de a vista mudar por mão, roda ou zoom por janela — para "Vista anterior". */
  readonly onGuardarVista?: () => void;
  readonly mostrarGrade: boolean;
  readonly imaAtivo: boolean;
  readonly unidadeDaRegua: UnidadeDeRegua;
  readonly onAlternarUnidadeDaRegua: () => void;
  /** Tamanho real da área do desenho, em px — para zoom e "Ajustar" usarem o centro e o espaço de verdade. */
  readonly onTamanhoChange?: (tamanho: { readonly largura: number; readonly altura: number }) => void;
  /** Medidas da aba Conferência a mostrar por cima do desenho. */
  readonly medicoes?: readonly MedicaoResolvida[];
  /** Primeiro ponto de um trecho de perímetro, à espera do segundo clique. */
  readonly inicioDoTrecho?: Ponto2D | null;
  /** Cota sendo posta (os pontos já clicados e o mouse), desenhada como prévia. */
  readonly cotaEmPrevia?: Cota | null;
  /** Prévia de uma ferramenta que mexe no contorno: o que entra, o que sai e os pontos já indicados. */
  readonly previa?: PreviaNoDesenho | null;
  /** Imagens do modelo, desenhadas por baixo das peças (só as que estão à mostra). */
  readonly imagens?: readonly ImagemDoModelo[];
}

/** O que uma ferramenta de contorno mostra antes de aplicar. Tudo em mm do mundo. */
export interface PreviaNoDesenho {
  /** A linha que vai entrar (tracejada, na cor de edição); fechada, quando é um contorno inteiro. */
  readonly novo?: readonly Ponto2D[] | null;
  readonly novoFechado?: boolean;
  /** O trecho do contorno que vai sair, ou que foi indicado (em destaque). */
  readonly substituido?: readonly Ponto2D[] | null;
  /** Linhas que vão entrar na peça além do contorno (tracejadas, na cor de edição). */
  readonly linhas?: readonly (readonly Ponto2D[])[];
  /** Pontos já indicados no contorno. */
  readonly marcas?: readonly Ponto2D[];
}

const SEM_MEDICOES: readonly MedicaoResolvida[] = [];
const SEM_IMAGENS: readonly ImagemDoModelo[] = [];

function traçarContorno(ctx: CanvasRenderingContext2D, contorno: readonly Ponto2D[], transform: TransformacaoDeTela): void {
  contorno.forEach((p, i) => {
    const tela = mundoParaTela(p, transform);
    if (i === 0) ctx.moveTo(tela.x, tela.y);
    else ctx.lineTo(tela.x, tela.y);
  });
  ctx.closePath();
}

/** A aresta do contorno a até `raioMm` de `p` (a mais perto), e qual ponta dela fica mais perto de `p`. */
function arestaPerto(
  p: Ponto2D,
  contorno: readonly Ponto2D[],
  raioMm: number,
): { readonly indiceAresta: number; readonly extremidade: 'inicio' | 'fim' } | null {
  const maisProximo = pontoMaisProximoNoContorno(p, contorno);
  if (maisProximo.distancia > raioMm) return null;
  const inicio = contorno[maisProximo.indiceAresta]!;
  const fim = contorno[(maisProximo.indiceAresta + 1) % contorno.length]!;
  return {
    indiceAresta: maisProximo.indiceAresta,
    extremidade: distancia(maisProximo.ponto, inicio) <= distancia(maisProximo.ponto, fim) ? 'inicio' : 'fim',
  };
}

export function AreaDeDesenho(props: AreaDeDesenhoProps): React.JSX.Element {
  const {
    pecas,
    selecionadoId,
    idsSelecionadosEmLote,
    enfesto,
    idsComErro,
    transform,
    modo,
    pontosEmEdicao,
    contornoFinalizado,
    onTransformChange,
    onSelecionar,
    onCursorMove,
    onCliqueNoCanvas,
    onMoverPeca,
    onAbrirPropriedades,
    onMoverVariosPontos,
    onInserirPontoNoMolde,
    onExcluirPontoDoMolde,
    onArredondarOuChanfrarCanto,
    onIndicarPontosParaModificar,
    onIndicarArestaParaRedefinir,
    arestaEmDestaque = null,
    cerca,
    opcoesDaCerca,
    onDefinirCerca,
    ferramentaDeVista,
    onZoomJanelaConcluido,
    onGuardarVista,
    mostrarGrade,
    imaAtivo,
    unidadeDaRegua,
    onAlternarUnidadeDaRegua,
    onTamanhoChange,
    medicoes = SEM_MEDICOES,
    inicioDoTrecho = null,
    cotaEmPrevia = null,
    previa = null,
    imagens = SEM_IMAGENS,
  } = props;
  const pecaSelecionada = pecas.find((p) => p.id === selecionadoId) ?? null;
  // O que prende o cursor agora: os vértices, com o ímã ligado ou num modo de
  // medida; a grade, só com o ímã ligado e a grade à vista.
  const modoDeMedida = MODOS_QUE_PRENDEM_NOS_VERTICES.has(modo);
  const prendeNosVertices = ferramentaDeVista === null && (modoDeMedida || (imaAtivo && MODOS_COM_IMA.has(modo)));
  const prendeNaGrade = prendeNosVertices && imaAtivo && mostrarGrade;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reguaHorizontalRef = useRef<HTMLCanvasElement | null>(null);
  const reguaVerticalRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });
  const [cursorLocal, setCursorLocal] = useState<Ponto2D | null>(null);
  // Imagens do modelo: cada uma é carregada uma vez (pelo id e pelo conteúdo),
  // e o desenho é refeito quando ela fica pronta.
  const imagensCarregadasRef = useRef(new Map<string, { readonly dados: string; readonly img: HTMLImageElement }>());
  const [imagensProntas, setImagensProntas] = useState(0);
  useEffect(() => {
    const carregadas = imagensCarregadasRef.current;
    for (const id of [...carregadas.keys()]) if (!imagens.some((i) => i.id === id)) carregadas.delete(id);
    for (const imagem of imagens) {
      if (carregadas.get(imagem.id)?.dados === imagem.dados) continue;
      const img = new Image();
      img.onload = () => setImagensProntas((n) => n + 1);
      img.src = imagem.dados;
      carregadas.set(imagem.id, { dados: imagem.dados, img });
    }
  }, [imagens]);
  const [capturaDoCursor, setCapturaDoCursor] = useState<TipoDeCaptura | null>(null);
  const panRef = useRef<{ ativo: boolean; ultimoX: number; ultimoY: number; vistaGuardada: boolean }>({
    ativo: false,
    ultimoX: 0,
    ultimoY: 0,
    vistaGuardada: false,
  });
  // Só para o cursor ("mão fechada" durante o arrasto); o arrasto em si usa panRef.
  const [panAtivo, setPanAtivo] = useState(false);
  const ultimaRolagemRef = useRef(-Infinity);
  const espacoPressionadoRef = useRef(false);
  const arrastoRef = useRef<{ id: string; ultimoMundo: Ponto2D } | null>(null);
  const [deltaDeArrasto, setDeltaDeArrasto] = useState<{ id: string; delta: Ponto2D } | null>(null);
  // Seleção de vértices nos modos "Mover ponto" e "Modificar": clique simples
  // seleciona só um e já arrasta; Shift+clique acrescenta/remove da seleção sem arrastar;
  // clique+arrasto num espaço vazio desenha um retângulo de seleção que
  // seleciona os vértices da peça dentro dele ao soltar. Não é a Cerca
  // ("Definir cerca"/"Mover cerca", `domain/cerca.ts`), que fica desenhada
  // até ser desligada e vale para todas as peças.
  const [verticesSelecionados, setVerticesSelecionados] = useState<ReadonlySet<number>>(new Set());
  // `ancora` é o vértice agarrado: é ele que o ímã prende, e os outros da
  // seleção andam o mesmo tanto.
  const arrastoDeGrupoRef = useRef<{
    indices: readonly number[];
    ancora: Ponto2D;
    inicioDoMouse: Ponto2D;
    inicioNaTela: Ponto2D;
    arrastou: boolean;
  } | null>(null);
  const [deltaDeGrupo, setDeltaDeGrupo] = useState<Ponto2D | null>(null);
  const [capturaDoArrasto, setCapturaDoArrasto] = useState<{ readonly ponto: Ponto2D; readonly tipo: TipoDeCaptura } | null>(null);
  const [retanguloEmDesenho, setRetanguloEmDesenho] = useState<RetanguloEmDesenho | null>(null);

  // Limpa a seleção de vértices ao trocar de modo ou de peça selecionada, e
  // descarta um retângulo pela metade ao trocar de modo ou de ferramenta de
  // vista — ajuste de estado durante a renderização (não num efeito, nem
  // lendo ref — só state), padrão recomendado pelo React para "resetar
  // estado quando uma prop muda".
  const [modoAnterior, setModoAnterior] = useState(modo);
  const [selecionadoIdAnterior, setSelecionadoIdAnterior] = useState(selecionadoId);
  // Se a peça selecionada ganha ou perde pontos (uma curva refeita, um desfazer), os números guardados já não são os mesmos pontos.
  const pontosDaSelecionada = pecas.find((p) => p.id === selecionadoId)?.contorno.length ?? 0;
  const [pontosDaSelecionadaAntes, setPontosDaSelecionadaAntes] = useState(pontosDaSelecionada);
  if (pontosDaSelecionadaAntes !== pontosDaSelecionada) {
    setPontosDaSelecionadaAntes(pontosDaSelecionada);
    if (verticesSelecionados.size > 0) setVerticesSelecionados(new Set());
  }
  const [ferramentaDeVistaAnterior, setFerramentaDeVistaAnterior] = useState(ferramentaDeVista);
  if (modoAnterior !== modo || selecionadoIdAnterior !== selecionadoId || ferramentaDeVistaAnterior !== ferramentaDeVista) {
    if ((modoAnterior !== modo || selecionadoIdAnterior !== selecionadoId) && verticesSelecionados.size > 0) {
      setVerticesSelecionados(new Set());
    }
    if ((modoAnterior !== modo || ferramentaDeVistaAnterior !== ferramentaDeVista) && retanguloEmDesenho) {
      setRetanguloEmDesenho(null);
    }
    setModoAnterior(modo);
    setSelecionadoIdAnterior(selecionadoId);
    setFerramentaDeVistaAnterior(ferramentaDeVista);
  }

  // O tamanho é avisado de dentro do ResizeObserver (não de um efeito sobre
  // `tamanho`), para quem usa nunca receber o valor provisório de 800 × 600:
  // a primeira chamada já é a medida real da área.
  const onTamanhoChangeRef = useRef(onTamanhoChange);
  useEffect(() => {
    onTamanhoChangeRef.current = onTamanhoChange;
  }, [onTamanhoChange]);

  useEffect(() => {
    const alvo = containerRef.current;
    if (!alvo) return;
    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[0];
      if (!entrada) return;
      const medido = { largura: entrada.contentRect.width, altura: entrada.contentRect.height };
      setTamanho(medido);
      onTamanhoChangeRef.current?.(medido);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    function aoPressionarTecla(e: KeyboardEvent): void {
      // O espaço digitado num campo de texto é texto, e não o pedido de arrastar a vista.
      const digitando = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.code === 'Space' && !digitando) espacoPressionadoRef.current = true;
    }
    function aoSoltarTecla(e: KeyboardEvent): void {
      if (e.code === 'Space') espacoPressionadoRef.current = false;
    }
    // Se a janela perde o foco com o espaço apertado (Alt+Tab, outra janela na frente), o "soltar" vai para outro
    // programa e nunca chega aqui: sem isto, o espaço ficava dado como apertado, e todo clique no desenho virava
    // arrasto da vista, até a tecla ser apertada de novo.
    function aoPerderOFoco(): void {
      espacoPressionadoRef.current = false;
      panRef.current.ativo = false;
      setPanAtivo(false);
    }
    window.addEventListener('keydown', aoPressionarTecla);
    window.addEventListener('keyup', aoSoltarTecla);
    window.addEventListener('blur', aoPerderOFoco);
    return () => {
      window.removeEventListener('keydown', aoPressionarTecla);
      window.removeEventListener('keyup', aoSoltarTecla);
      window.removeEventListener('blur', aoPerderOFoco);
    };
  }, []);

  const desenharSeta = useCallback(
    (ctx: CanvasRenderingContext2D, inicio: Ponto2D, fim: Ponto2D, cor: string): void => {
      const i = mundoParaTela(inicio, transform);
      const f = mundoParaTela(fim, transform);
      ctx.strokeStyle = cor;
      ctx.fillStyle = cor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(i.x, i.y);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      ctx.lineCap = 'butt';

      const angulo = Math.atan2(f.y - i.y, f.x - i.x);
      const tamanhoPonta = 10;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(
        f.x - tamanhoPonta * Math.cos(angulo - Math.PI / 7),
        f.y - tamanhoPonta * Math.sin(angulo - Math.PI / 7),
      );
      ctx.lineTo(
        f.x - tamanhoPonta * Math.cos(angulo + Math.PI / 7),
        f.y - tamanhoPonta * Math.sin(angulo + Math.PI / 7),
      );
      ctx.closePath();
      ctx.fill();
    },
    [transform],
  );

  // Rótulo com um pequeno fundo branco semi-opaco atrás do texto — mesmo
  // padrão de cotas de um CAD profissional, para o texto continuar legível
  // sobre o contorno/linhas da peça em vez de flutuar "pelado" sobre elas.
  const desenharRotuloComFundo = useCallback(
    (ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, cor: string): void => {
      const metrica = ctx.measureText(texto);
      const subida = metrica.actualBoundingBoxAscent || 8;
      const descida = metrica.actualBoundingBoxDescent || 2;
      const paddingX = 4;
      const paddingY = 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillRect(
        x - metrica.width / 2 - paddingX,
        y - subida - paddingY,
        metrica.width + paddingX * 2,
        subida + descida + paddingY * 2,
      );
      ctx.fillStyle = cor;
      ctx.fillText(texto, x, y);
    },
    [],
  );

  // Medida escrita ao lado de um segmento (pontos da tela), afastada dele pela
  // normal: para cima ou, se o segmento for de pé, para a direita.
  const rotularSegmento = useCallback(
    (ctx: CanvasRenderingContext2D, texto: string, a: Ponto2D, b: Ponto2D, cor: string): void => {
      const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const comprimentoPx = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let normal = { x: -(b.y - a.y) / comprimentoPx, y: (b.x - a.x) / comprimentoPx };
      if (normal.y > 0 || (normal.y === 0 && normal.x < 0)) normal = { x: -normal.x, y: -normal.y };
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const afastamento = 12 + Math.abs(normal.x) * (ctx.measureText(texto).width / 2 + 4) + Math.abs(normal.y) * 4;
      desenharRotuloComFundo(ctx, texto, meio.x + normal.x * afastamento, meio.y + normal.y * afastamento + 4, cor);
      ctx.textAlign = 'left';
    },
    [desenharRotuloComFundo],
  );

  // Uma cota no desenho. A linear tem as duas linhas de chamada, a linha de
  // cota com setas e o número ao lado dela; a de ângulo, o arco entre os dois
  // lados e o número na bissetriz; a de perímetro, só o número, onde foi posta.
  const desenharCota = useCallback(
    (ctx: CanvasRenderingContext2D, cota: Cota, perimetroDaPecaMm: number | null, cor: string): void => {
      ctx.strokeStyle = cor;
      ctx.fillStyle = cor;
      ctx.lineWidth = 1;
      ctx.font = 'bold 11px sans-serif';
      if (cota.tipo === 'perimetro') {
        if (perimetroDaPecaMm === null) return;
        const tela = mundoParaTela(cota.posicao, transform);
        ctx.textAlign = 'center';
        desenharRotuloComFundo(ctx, `Perímetro: ${formatarMm(perimetroDaPecaMm)}`, tela.x, tela.y + 4, cor);
        ctx.textAlign = 'left';
        return;
      }
      if (cota.tipo === 'raio') {
        // Um raio do círculo: do centro (marcado com uma cruz) ao ponto do arco, com a seta nele.
        const centro = mundoParaTela(cota.centro, transform);
        const noArco = mundoParaTela(cota.noArco, transform);
        ctx.beginPath();
        ctx.moveTo(centro.x - 4, centro.y);
        ctx.lineTo(centro.x + 4, centro.y);
        ctx.moveTo(centro.x, centro.y - 4);
        ctx.lineTo(centro.x, centro.y + 4);
        ctx.moveTo(centro.x, centro.y);
        ctx.lineTo(noArco.x, noArco.y);
        const comprimento = Math.hypot(noArco.x - centro.x, noArco.y - centro.y) || 1;
        const u = { x: (noArco.x - centro.x) / comprimento, y: (noArco.y - centro.y) / comprimento };
        ctx.moveTo(noArco.x - u.x * 8 - u.y * 3, noArco.y - u.y * 8 + u.x * 3);
        ctx.lineTo(noArco.x, noArco.y);
        ctx.lineTo(noArco.x - u.x * 8 + u.y * 3, noArco.y - u.y * 8 - u.x * 3);
        ctx.stroke();
        ctx.textAlign = 'center';
        desenharRotuloComFundo(ctx, `R ${formatarMm(valorDaCotaDeRaio(cota))}`, (centro.x + noArco.x) / 2, (centro.y + noArco.y) / 2 + 4, cor);
        ctx.textAlign = 'left';
        return;
      }
      if (cota.tipo === 'angulo') {
        const v = mundoParaTela(cota.vertice, transform);
        const a = mundoParaTela(cota.de, transform);
        const b = mundoParaTela(cota.ate, transform);
        const raioPx = Math.max(8, cota.raioMm * transform.escalaPxPorMm);
        const inicio = Math.atan2(a.y - v.y, a.x - v.x);
        let varredura = Math.atan2(b.y - v.y, b.x - v.x) - inicio;
        if (varredura > Math.PI) varredura -= Math.PI * 2;
        if (varredura <= -Math.PI) varredura += Math.PI * 2;
        ctx.beginPath();
        for (const fim of [a, b]) {
          const comprimento = Math.hypot(fim.x - v.x, fim.y - v.y) || 1;
          ctx.moveTo(v.x, v.y);
          ctx.lineTo(v.x + ((fim.x - v.x) / comprimento) * (raioPx + 8), v.y + ((fim.y - v.y) / comprimento) * (raioPx + 8));
        }
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(v.x, v.y, raioPx, inicio, inicio + varredura, varredura < 0);
        ctx.stroke();
        const bissetriz = bissetrizDaCotaDeAngulo(cota);
        // Eixos trocados: a direção do mundo (x, y) aponta, na tela, para (y, x).
        ctx.textAlign = 'center';
        desenharRotuloComFundo(
          ctx,
          `${valorDaCotaDeAngulo(cota).toFixed(1).replace('.', ',')}°`,
          v.x + bissetriz.y * (raioPx + 16),
          v.y + bissetriz.x * (raioPx + 16) + 4,
          cor,
        );
        ctx.textAlign = 'left';
        return;
      }
      const geometria = geometriaDaCotaLinear(cota);
      const de = mundoParaTela(cota.de, transform);
      const ate = mundoParaTela(cota.ate, transform);
      const peDe = mundoParaTela(geometria.peDe, transform);
      const peAte = mundoParaTela(geometria.peAte, transform);
      // Linhas de chamada: do ponto medido até um pouco além da linha de cota.
      ctx.beginPath();
      for (const [origem, pe] of [
        [de, peDe],
        [ate, peAte],
      ] as const) {
        const comprimento = Math.hypot(pe.x - origem.x, pe.y - origem.y);
        if (comprimento < 0.5) continue;
        ctx.moveTo(origem.x, origem.y);
        ctx.lineTo(pe.x + ((pe.x - origem.x) / comprimento) * 5, pe.y + ((pe.y - origem.y) / comprimento) * 5);
      }
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(peDe.x, peDe.y);
      ctx.lineTo(peAte.x, peAte.y);
      ctx.stroke();
      const comprimentoPx = Math.hypot(peAte.x - peDe.x, peAte.y - peDe.y);
      if (comprimentoPx > 14) {
        const ux = (peAte.x - peDe.x) / comprimentoPx;
        const uy = (peAte.y - peDe.y) / comprimentoPx;
        for (const [ponta, sentido] of [
          [peDe, 1],
          [peAte, -1],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(ponta.x, ponta.y);
          ctx.lineTo(ponta.x + (ux * 7 - uy * 2.6) * sentido, ponta.y + (uy * 7 + ux * 2.6) * sentido);
          ctx.lineTo(ponta.x + (ux * 7 + uy * 2.6) * sentido, ponta.y + (uy * 7 - ux * 2.6) * sentido);
          ctx.closePath();
          ctx.fill();
        }
      }
      rotularSegmento(ctx, formatarMm(valorDaCotaLinear(cota)), peDe, peAte, cor);
    },
    [transform, desenharRotuloComFundo, rotularSegmento],
  );

  // Desenha o canvas principal.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = tamanho.largura;
    canvas.height = tamanho.altura;

    ctx.fillStyle = COR_FUNDO;
    ctx.fillRect(0, 0, tamanho.largura, tamanho.altura);

    // Mesa real do enfesto configurado: retângulo visível (não só números na
    // régua) mostrando a área útil de verdade, sempre mais larga que alta
    // quando a mesa é horizontal — é o que torna "retangular na horizontal"
    // algo que se vê, não só se infere pelas réguas.
    if (enfesto) {
      // Retângulo externo = mesa inteira (0..larguraUtilMm x 0..comprimentoMm,
      // mesma convenção de domain/posicionamento.ts e domain/nesting.ts).
      // Preenchido com o tom "com margem"; a área de colocação de verdade
      // (descontadas as margens) fica por cima, em branco puro — a margem
      // aparece como uma faixa mais escura em volta, não uma linha invisível.
      const cantoExterno = mundoParaTela(ponto(0, 0), transform);
      const cantoExternoOposto = mundoParaTela(ponto(enfesto.larguraUtilMm, enfesto.comprimentoMm), transform);
      ctx.fillStyle = COR_MARGEM_MESA;
      ctx.fillRect(
        cantoExterno.x,
        cantoExterno.y,
        cantoExternoOposto.x - cantoExterno.x,
        cantoExternoOposto.y - cantoExterno.y,
      );

      const cantoUtil = mundoParaTela(ponto(enfesto.margemLateralMm, enfesto.margemDeExtremidadeMm), transform);
      const cantoUtilOposto = mundoParaTela(
        ponto(enfesto.larguraUtilMm - enfesto.margemLateralMm, enfesto.comprimentoMm - enfesto.margemDeExtremidadeMm),
        transform,
      );
      ctx.fillStyle = COR_MESA;
      ctx.fillRect(cantoUtil.x, cantoUtil.y, cantoUtilOposto.x - cantoUtil.x, cantoUtilOposto.y - cantoUtil.y);

      ctx.strokeStyle = COR_BORDA_MESA;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        cantoExterno.x,
        cantoExterno.y,
        cantoExternoOposto.x - cantoExterno.x,
        cantoExternoOposto.y - cantoExterno.y,
      );
    }

    // Grade de pontos em múltiplos redondos de mm (o mesmo passo em que o
    // ímã prende), por baixo das peças. Como a tela troca os eixos, a coluna
    // de pontos depende só de mundo.y e a linha só de mundo.x.
    if (mostrarGrade) {
      const passoMm = passoDaGradeEmMm(transform.escalaPxPorMm);
      const passoPx = passoMm * transform.escalaPxPorMm;
      const cantoVisivel = telaParaMundo({ x: 0, y: 0 }, transform);
      const primeiro = mundoParaTela(
        ponto(Math.ceil(cantoVisivel.x / passoMm) * passoMm, Math.ceil(cantoVisivel.y / passoMm) * passoMm),
        transform,
      );
      ctx.fillStyle = COR_GRADE;
      for (let coluna = 0; primeiro.x + coluna * passoPx <= tamanho.largura; coluna++) {
        const x = Math.round(primeiro.x + coluna * passoPx);
        for (let linha = 0; primeiro.y + linha * passoPx <= tamanho.altura; linha++) {
          ctx.fillRect(x - 1, Math.round(primeiro.y + linha * passoPx) - 1, 2, 2);
        }
      }
    }

    // Imagens do modelo, por baixo das peças: o canto de cima à esquerda em
    // `origem`, a largura correndo na horizontal da tela (o Y do mundo).
    for (const imagem of imagens) {
      const carregada = imagensCarregadasRef.current.get(imagem.id);
      if (!imagem.visivel || !carregada || !carregada.img.complete || carregada.img.naturalWidth === 0) continue;
      const canto = mundoParaTela(imagem.origem, transform);
      const pxDaTelaPorPx = imagem.mmPorPx * transform.escalaPxPorMm;
      const largura = imagem.larguraPx * pxDaTelaPorPx;
      const altura = imagem.alturaPx * pxDaTelaPorPx;
      ctx.globalAlpha = imagem.opacidade;
      ctx.drawImage(carregada.img, canto.x, canto.y, largura, altura);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COR_BORDA_MESA;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(canto.x, canto.y, largura, altura);
      ctx.setLineDash([]);
    }

    for (const pecaOriginal of pecas) {
      // Enquanto uma peça está sendo arrastada, desenha-se a versão já
      // deslocada (prévia em tempo real) sem tocar no estado real ainda —
      // o deslocamento só é confirmado (e entra no histórico) ao soltar o mouse.
      let peca =
        deltaDeArrasto && deltaDeArrasto.id === pecaOriginal.id
          ? transladarMolde(pecaOriginal, deltaDeArrasto.delta, pecaOriginal.id)
          : pecaOriginal;
      // Mesma lógica de prévia ao vivo, mas para um grupo de vértices sendo
      // arrastados juntos (modo "mover ponto") em vez da peça inteira.
      if (deltaDeGrupo && arrastoDeGrupoRef.current && pecaOriginal.id === selecionadoId) {
        const indices = new Set(arrastoDeGrupoRef.current.indices);
        peca = {
          ...peca,
          contorno: peca.contorno.map((p, i) => (indices.has(i) ? somar(p, deltaDeGrupo) : p)),
        };
      }

      // Contorno + furos num único path com regra evenodd: os furos aparecem
      // como buracos reais no preenchimento, não apenas linhas por cima.
      ctx.beginPath();
      traçarContorno(ctx, peca.contorno, transform);
      for (const furo of peca.furos) {
        traçarContorno(ctx, furo, transform);
      }
      ctx.fillStyle = peca.cor ?? COR_TECIDO;
      ctx.fill('evenodd');
      const temErro = idsComErro.has(peca.id);
      const estaSelecionada = peca.id === selecionadoId || idsSelecionadosEmLote.has(peca.id);
      ctx.strokeStyle = temErro ? COR_CONTORNO_COM_ERRO : estaSelecionada ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
      ctx.lineWidth = estaSelecionada || temErro ? 2.5 : 1.5;
      if (temErro) ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Peça graduada: os outros tamanhos, em linha fina, em volta do base.
      if (peca.graduacao) {
        const base = peca.graduacao.base;
        ctx.strokeStyle = COR_TAMANHO_GRADUADO;
        ctx.lineWidth = 1;
        contornosDosTamanhos(peca.graduacao, peca.contorno).forEach((contorno, t) => {
          if (t === base) return;
          ctx.beginPath();
          traçarContorno(ctx, contorno, transform);
          ctx.stroke();
        });
      }

      for (const furo of peca.furos) {
        ctx.beginPath();
        traçarContorno(ctx, furo, transform);
        ctx.strokeStyle = estaSelecionada ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // As linhas internas: as que fazem parte do molde, cheias; os elementos (só de construção), claros e pontilhados.
      const deConstrucao = new Set(peca.elementos ? elementosDaPeca(peca) : []);
      peca.linhasInternas.forEach((linha, numero) => {
        ctx.beginPath();
        linha.forEach((p, i) => {
          const tela = mundoParaTela(p, transform);
          if (i === 0) ctx.moveTo(tela.x, tela.y);
          else ctx.lineTo(tela.x, tela.y);
        });
        const elemento = deConstrucao.has(numero);
        ctx.strokeStyle = elemento ? COR_ELEMENTO_DE_CONSTRUCAO : COR_CONTORNO;
        ctx.lineWidth = 1;
        if (elemento) ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      if (peca.margemDeCosturaMm > 0) {
        ctx.beginPath();
        traçarContorno(ctx, contornoDeCorte(peca), transform);
        ctx.strokeStyle = COR_LINHA_DE_CORTE;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /** Traça linhas dadas em mm do mundo. */
      const tracarNoMundo = (tracos: readonly (readonly Ponto2D[])[]): void => {
        for (const traco of tracos) {
          ctx.beginPath();
          traco.forEach((q, k) => {
            const naTela = mundoParaTela(q, transform);
            if (k === 0) ctx.moveTo(naTela.x, naTela.y);
            else ctx.lineTo(naTela.x, naTela.y);
          });
          ctx.stroke();
        }
      };

      for (const pique of peca.piques) {
        // O pique pelo formato dele; na peça com margem de costura, também como ele vai para a linha de corte.
        ctx.strokeStyle = COR_PIQUE;
        ctx.lineWidth = 2;
        tracarNoMundo(tracosDoPique(peca, pique));
        tracarNoMundo(tracosNaLinhaDeCorte(peca, pique) ?? []);
        // O código de relacionamento, escrito do lado de dentro da peça, em frente ao pique:
        // assim a peça vizinha no encaixe nunca o cobre.
        if (pique.codigo) {
          const dentro = mundoParaTela(
            ondeEscreverOCodigo(peca, pique, AFASTAMENTO_DO_CODIGO_DO_PIQUE_PX / transform.escalaPxPorMm),
            transform,
          );
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = COR_PIQUE;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pique.codigo, dentro.x, dentro.y);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }

      // Linha de simetria: traço e ponto por cima da aresta em que a peça dobra.
      const simetria = arestaDeSimetria(peca);
      if (simetria !== null) {
        const de = mundoParaTela(peca.contorno[simetria]!, transform);
        const ate = mundoParaTela(peca.contorno[(simetria + 1) % peca.contorno.length]!, transform);
        ctx.beginPath();
        ctx.moveTo(de.x, de.y);
        ctx.lineTo(ate.x, ate.y);
        ctx.strokeStyle = COR_SIMETRIA;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 4, 2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const marca of peca.marcas) {
        // A marca com formato é um pique interno: desenhada pelo formato, no lugar do ponto.
        const doFormato = tracosDaMarca(marca);
        if (doFormato) {
          ctx.strokeStyle = COR_MARCA;
          ctx.lineWidth = 2;
          tracarNoMundo(doFormato);
          continue;
        }
        const p = mundoParaTela(marca.posicao, transform);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = COR_MARCA;
        ctx.fill();
      }

      const corDaPeca = estaSelecionada ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;

      // Linha de fio na cor da peça: seta nas duas pontas quando a peça pode
      // girar 180° (fio sem sentido, convenção de modelagem) e numa ponta só
      // quando não pode (fio com sentido).
      desenharSeta(ctx, peca.linhaDeFio.inicio, peca.linhaDeFio.fim, corDaPeca);
      if (peca.restricaoDeRotacao.permite180) {
        desenharSeta(ctx, peca.linhaDeFio.fim, peca.linhaDeFio.inicio, corDaPeca);
      }

      // Nome da peça escrito sobre a linha de fio, girado com ela e sempre de
      // pé para leitura.
      const inicioDoFio = mundoParaTela(peca.linhaDeFio.inicio, transform);
      const fimDoFio = mundoParaTela(peca.linhaDeFio.fim, transform);
      let anguloDoFio = Math.atan2(fimDoFio.y - inicioDoFio.y, fimDoFio.x - inicioDoFio.x);
      if (anguloDoFio > Math.PI / 2) anguloDoFio -= Math.PI;
      if (anguloDoFio < -Math.PI / 2) anguloDoFio += Math.PI;
      ctx.save();
      ctx.translate((inicioDoFio.x + fimDoFio.x) / 2, (inicioDoFio.y + fimDoFio.y) / 2);
      ctx.rotate(anguloDoFio);
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px sans-serif';
      desenharRotuloComFundo(ctx, peca.nome, 0, -7, corDaPeca);
      ctx.restore();

      // Textos da peça: centrados no ponto em que foram postos, na altura pedida.
      // Vêm depois do nome, para o que o usuário escreveu nunca ficar escondido atrás dele.
      for (const texto of peca.textos ?? []) {
        const tela = mundoParaTela(texto.posicao, transform);
        const altura = Math.max(ALTURA_MINIMA_DO_TEXTO_PX, texto.alturaMm * transform.escalaPxPorMm);
        ctx.font = `${altura}px sans-serif`;
        ctx.fillStyle = COR_CONTORNO;
        ctx.textBaseline = 'middle';
        // O "Pique texto" tem ângulo e âncora: o que fica no ponto é o começo, o meio ou o fim do texto.
        ctx.textAlign = texto.ancora === 'inicio' ? 'left' : texto.ancora === 'fim' ? 'right' : 'center';
        if (texto.anguloGraus) {
          ctx.save();
          ctx.translate(tela.x, tela.y);
          // No canvas o giro positivo é horário; o ângulo do texto é anti-horário.
          ctx.rotate((0 - texto.anguloGraus * Math.PI) / 180);
          ctx.fillText(texto.texto, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(texto.texto, tela.x, tela.y);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      // Vértices: marcador quadrado e o número real do vértice (o mesmo que
      // "Mover ponto"/"Excluir ponto" usam). Em curvas amostradas (centenas de
      // pontos), só os cantos e os pontos afastados entre si recebem número,
      // para a curva não virar uma mancha de texto. Nos modos de edição, as
      // alças de todos os vértices continuam aparecendo.
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = corDaPeca;
      const totalDeVertices = peca.contorno.length;
      let ultimoNumerado: Ponto2D | null = null;
      for (let i = 0; i < totalDeVertices; i++) {
        const atual = peca.contorno[i]!;
        const anterior = peca.contorno[(i - 1 + totalDeVertices) % totalDeVertices]!;
        const proximo = peca.contorno[(i + 1) % totalDeVertices]!;
        const ehCanto =
          totalDeVertices <= LIMITE_DE_VERTICES_SEMPRE_NUMERADOS ||
          giroEmGraus(anterior, atual, proximo) >= GIRO_MINIMO_DE_CANTO_GRAUS;
        if (!ehCanto) continue;
        const tela = mundoParaTela(atual, transform);
        if (ultimoNumerado && Math.hypot(tela.x - ultimoNumerado.x, tela.y - ultimoNumerado.y) < ESPACO_MINIMO_ENTRE_NUMEROS_PX) {
          continue;
        }
        ultimoNumerado = tela;
        ctx.fillRect(tela.x - 2, tela.y - 2, 4, 4);
        ctx.fillText(String(i + 1), tela.x + 5, tela.y - 5);
      }

      // Medida da largura na tela: só na peça selecionada, para não poluir o
      // desenho com uma cota em cada peça.
      if (estaSelecionada) {
        const bboxPeca = retanguloEnvolvente(peca.contorno);
        const margemMedidaMm = 22 / transform.escalaPxPorMm;
        const centroYMm = (bboxPeca.minY + bboxPeca.maxY) / 2;
        const linhaMedidaMm = bboxPeca.maxX + margemMedidaMm;
        const pontaEsquerda = ponto(linhaMedidaMm, bboxPeca.minY);
        const pontaDireita = ponto(linhaMedidaMm, bboxPeca.maxY);
        desenharSeta(ctx, pontaEsquerda, pontaDireita, COR_REGUA_TRACO);
        desenharSeta(ctx, pontaDireita, pontaEsquerda, COR_REGUA_TRACO);
        const posMedida = mundoParaTela(ponto(linhaMedidaMm, centroYMm), transform);
        ctx.textAlign = 'center';
        ctx.font = '10px sans-serif';
        desenharRotuloComFundo(ctx, `${(bboxPeca.maxY - bboxPeca.minY).toFixed(0)} mm`, posMedida.x, posMedida.y + 13, COR_REGUA_TRACO);
        ctx.textAlign = 'left';
      }

      // Caixa tracejada em volta da peça selecionada.
      if (peca.id === selecionadoId) {
        const caixa = retanguloEnvolvente(peca.contorno);
        const cantoA = mundoParaTela(ponto(caixa.minX, caixa.minY), transform);
        const cantoB = mundoParaTela(ponto(caixa.maxX, caixa.maxY), transform);
        const folga = 8;
        ctx.strokeStyle = COR_CONTORNO_SELECIONADO;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          Math.min(cantoA.x, cantoB.x) - folga,
          Math.min(cantoA.y, cantoB.y) - folga,
          Math.abs(cantoB.x - cantoA.x) + folga * 2,
          Math.abs(cantoB.y - cantoA.y) + folga * 2,
        );
        ctx.setLineDash([]);
      }

      // Cotas presas à peça: andam com ela (inclusive na prévia do arrasto).
      if (peca.cotas && peca.cotas.length > 0) {
        const perimetroDaPeca = perimetro(peca.contorno);
        for (const cota of peca.cotas) desenharCota(ctx, cota, perimetroDaPeca, COR_COTA);
        ctx.textAlign = 'left';
      }
    }

    // Alças nos vértices da peça selecionada, nos modos de edição de forma
    // (mover/inserir/excluir ponto, chanfrar/arredondar canto, modificar,
    // redefinir perímetro) — a mesma prévia ao vivo do grupo em arrasto já
    // foi aplicada acima. Em "Mover ponto" e "Modificar", os vértices
    // selecionados (clique, Shift+clique ou retângulo) ficam destacados numa
    // cor diferente.
    if (MODOS_QUE_MOSTRAM_ALCAS.has(modo) && pecaSelecionada) {
      const indicesEmArrasto = deltaDeGrupo && arrastoDeGrupoRef.current ? new Set(arrastoDeGrupoRef.current.indices) : null;
      const pecaParaAlcas =
        indicesEmArrasto && pecaSelecionada.id === selecionadoId
          ? {
              ...pecaSelecionada,
              contorno: pecaSelecionada.contorno.map((p, i) => (indicesEmArrasto.has(i) ? somar(p, deltaDeGrupo!) : p)),
            }
          : pecaSelecionada;
      pecaParaAlcas.contorno.forEach((p, i) => {
        const tela = mundoParaTela(p, transform);
        const selecionado =
          MODOS_COM_SELECAO_DE_VERTICES.has(modo) && (verticesSelecionados.has(i) || indicesEmArrasto?.has(i));
        ctx.beginPath();
        ctx.arc(tela.x, tela.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = selecionado ? COR_CONTORNO_SELECIONADO : COR_ALCA_DE_VERTICE;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // "Redefinir perímetro": a aresta escolhida (diálogo aberto) ou, antes do
    // clique, a que está sob o mouse fica grossa, com o comprimento atual e um
    // anel na ponta que vai andar. No bi-direcional as duas pontas ganham anel
    // e o meio, que fica parado, ganha um traço.
    if (modo === 'redefinir-perimetro' && pecaSelecionada) {
      const contorno = pecaSelecionada.contorno;
      let destaque = arestaEmDestaque;
      if (!destaque && cursorLocal && ferramentaDeVista === null) {
        const sobOMouse = arestaPerto(cursorLocal, contorno, RAIO_DE_CAPTURA_DE_VERTICE_PX / transform.escalaPxPorMm);
        destaque = sobOMouse && { indiceAresta: sobOMouse.indiceAresta, ponta: sobOMouse.extremidade };
      }
      if (destaque && destaque.indiceAresta < contorno.length) {
        const inicio = contorno[destaque.indiceAresta]!;
        const fim = contorno[(destaque.indiceAresta + 1) % contorno.length]!;
        const a = mundoParaTela(inicio, transform);
        const b = mundoParaTela(fim, transform);
        const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const comprimentoPx = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        // Normal unitária da aresta na tela, apontando para cima (ou para a direita, se a aresta for de pé).
        let normal = { x: -(b.y - a.y) / comprimentoPx, y: (b.x - a.x) / comprimentoPx };
        if (normal.y > 0 || (normal.y === 0 && normal.x < 0)) normal = { x: -normal.x, y: -normal.y };

        ctx.strokeStyle = COR_ARESTA_EM_DESTAQUE;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.lineWidth = 2;
        const pontasQueAndam = destaque.ponta === 'ambas' ? [a, b] : [destaque.ponta === 'inicio' ? a : b];
        for (const ponta of pontasQueAndam) {
          ctx.beginPath();
          ctx.arc(ponta.x, ponta.y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (destaque.ponta === 'ambas') {
          ctx.beginPath();
          ctx.moveTo(meio.x - normal.x * 8, meio.y - normal.y * 8);
          ctx.lineTo(meio.x + normal.x * 8, meio.y + normal.y * 8);
          ctx.stroke();
        }
        rotularSegmento(ctx, formatarMm(distancia(inicio, fim)), a, b, COR_ARESTA_EM_DESTAQUE);
      }
    }

    // Medidas da aba Conferência, por cima das peças: a distância com os
    // catetos tracejados (horizontal e vertical); o perímetro com o contorno
    // inteiro em destaque; o trecho com o caminho medido e os dois extremos.
    for (const medicao of medicoes) {
      ctx.strokeStyle = COR_MEDICAO;
      ctx.fillStyle = COR_MEDICAO;
      if (medicao.tipo === 'distancia') {
        const a = mundoParaTela(medicao.de, transform);
        const b = mundoParaTela(medicao.ate, transform);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        for (const p of [a, b]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        rotularSegmento(ctx, formatarMm(medicao.valorMm), a, b, COR_MEDICAO);
      } else if (medicao.tipo === 'perimetro') {
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        traçarContorno(ctx, medicao.peca.contorno, transform);
        ctx.stroke();
        ctx.lineJoin = 'miter';
        const caixa = retanguloEnvolvente(medicao.peca.contorno);
        const cantoA = mundoParaTela(ponto(caixa.minX, caixa.minY), transform);
        const cantoB = mundoParaTela(ponto(caixa.maxX, caixa.maxY), transform);
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        desenharRotuloComFundo(
          ctx,
          `Perímetro: ${formatarMm(medicao.valorMm)}`,
          (cantoA.x + cantoB.x) / 2,
          Math.min(cantoA.y, cantoB.y) - 14,
          COR_MEDICAO,
        );
        ctx.textAlign = 'left';
      } else {
        const caminho = medicao.caminho.map((p) => mundoParaTela(p, transform));
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        caminho.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = 2;
        for (const extremo of [caminho[0], caminho.at(-1)]) {
          if (!extremo) continue;
          ctx.beginPath();
          ctx.arc(extremo.x, extremo.y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        // O rótulo fica ao lado do segmento em que cai a metade do caminho.
        let percorrido = 0;
        const metade = caminho.slice(1).reduce((soma, p, i) => soma + distancia(caminho[i]!, p), 0) / 2;
        for (let i = 1; i < caminho.length; i++) {
          const passo = distancia(caminho[i - 1]!, caminho[i]!);
          if (percorrido + passo >= metade || i === caminho.length - 1) {
            rotularSegmento(ctx, formatarMm(medicao.valorMm), caminho[i - 1]!, caminho[i]!, COR_MEDICAO);
            break;
          }
          percorrido += passo;
        }
      }
    }
    if (inicioDoTrecho) {
      const tela = mundoParaTela(inicioDoTrecho, transform);
      ctx.strokeStyle = COR_MEDICAO;
      ctx.fillStyle = COR_MEDICAO;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tela.x, tela.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tela.x, tela.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cerca ativa: retângulo tracejado laranja e os pontos que "Mover cerca"
    // pode deslocar — só das peças em que ele age (seleção em lote, senão a
    // peça selecionada, senão todas). Pontos de outras peças que caem dentro
    // da cerca não são destacados, porque não vão se mover.
    if (cerca) {
      const a = mundoParaTela(ponto(cerca.minX, cerca.minY), transform);
      const b = mundoParaTela(ponto(cerca.maxX, cerca.maxY), transform);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      ctx.fillStyle = COR_PREENCHIMENTO_CERCA;
      ctx.fillRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeStyle = COR_CERCA;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      ctx.strokeRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      desenharRotuloComFundo(ctx, 'Cerca', x + 4 + ctx.measureText('Cerca').width / 2, y - 6, COR_CERCA);
      ctx.textAlign = 'left';
      ctx.fillStyle = COR_CERCA;
      for (const peca of pecasAlvoDaCerca(pecas, idsSelecionadosEmLote, selecionadoId)) {
        for (const p of pontosMoveisNaCerca(peca, cerca, opcoesDaCerca)) {
          const tela = mundoParaTela(p, transform);
          ctx.fillRect(tela.x - 3, tela.y - 3, 6, 6);
        }
      }
    }

    // Retângulo sendo arrastado: seleção de vértices (azul), cerca nova
    // (laranja) ou janela de zoom (cinza).
    if (retanguloEmDesenho) {
      const a = mundoParaTela(retanguloEmDesenho.inicio, transform);
      const b = mundoParaTela(retanguloEmDesenho.atual, transform);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const largura = Math.abs(b.x - a.x);
      const altura = Math.abs(b.y - a.y);
      if (retanguloEmDesenho.tipo === 'cerca') {
        ctx.fillStyle = COR_PREENCHIMENTO_CERCA;
        ctx.fillRect(x, y, largura, altura);
      } else if (retanguloEmDesenho.tipo === 'zoom-janela') {
        ctx.fillStyle = COR_PREENCHIMENTO_JANELA_DE_ZOOM;
        ctx.fillRect(x, y, largura, altura);
      }
      ctx.strokeStyle =
        retanguloEmDesenho.tipo === 'cerca'
          ? COR_CERCA
          : retanguloEmDesenho.tipo === 'zoom-janela'
            ? COR_JANELA_DE_ZOOM
            : COR_CONTORNO_SELECIONADO;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, largura, altura);
      ctx.setLineDash([]);
    }

    // Contorno recém-fechado, aguardando a definição da linha de fio.
    if (contornoFinalizado && contornoFinalizado.length >= 3) {
      ctx.beginPath();
      traçarContorno(ctx, contornoFinalizado, transform);
      ctx.strokeStyle = COR_EM_EDICAO;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Retângulo em construção: do primeiro canto até o mouse, com a medida de
    // cada lado (a de cima é a horizontal; a da esquerda, a vertical).
    if (modo === 'retangulo' && pontosEmEdicao.length === 1 && cursorLocal) {
      const canto = pontosEmEdicao[0]!;
      const a = mundoParaTela(canto, transform);
      const b = mundoParaTela(cursorLocal, transform);
      const esquerda = Math.min(a.x, b.x);
      const topo = Math.min(a.y, b.y);
      ctx.strokeStyle = COR_EM_EDICAO;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(esquerda, topo, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = COR_EM_EDICAO;
      ctx.fill();
      // Eixos trocados na tela: a horizontal é o Y do mundo e a vertical, o X.
      const horizontal = formatarMm(Math.abs(cursorLocal.y - canto.y));
      const vertical = formatarMm(Math.abs(cursorLocal.x - canto.x));
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      desenharRotuloComFundo(ctx, horizontal, (a.x + b.x) / 2, topo - 8, COR_EM_EDICAO);
      desenharRotuloComFundo(ctx, vertical, esquerda - 10 - ctx.measureText(vertical).width / 2, (a.y + b.y) / 2 + 4, COR_EM_EDICAO);
      ctx.textAlign = 'left';
    } else if (pontosEmEdicao.length > 0) {
      // Contorno em edição (novo molde / novo furo): linha aberta + vértices.
      // Na "Distância", é a linha do primeiro ponto até o mouse, já com a medida.
      ctx.beginPath();
      pontosEmEdicao.forEach((p, i) => {
        const tela = mundoParaTela(p, transform);
        if (i === 0) ctx.moveTo(tela.x, tela.y);
        else ctx.lineTo(tela.x, tela.y);
      });
      // Com uma cota em prévia, o mouse já está posicionando a linha de cota.
      if (cursorLocal && !cotaEmPrevia) {
        const tela = mundoParaTela(cursorLocal, transform);
        ctx.lineTo(tela.x, tela.y);
      }
      ctx.strokeStyle = COR_EM_EDICAO;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of pontosEmEdicao) {
        const tela = mundoParaTela(p, transform);
        ctx.beginPath();
        ctx.arc(tela.x, tela.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = COR_EM_EDICAO;
        ctx.fill();
      }
      if (modo === 'medir-distancia' && cursorLocal && pontosEmEdicao.length === 1) {
        rotularSegmento(
          ctx,
          formatarMm(distancia(pontosEmEdicao[0]!, cursorLocal)),
          mundoParaTela(pontosEmEdicao[0]!, transform),
          mundoParaTela(cursorLocal, transform),
          COR_EM_EDICAO,
        );
      }
    }

    if (cotaEmPrevia) desenharCota(ctx, cotaEmPrevia, null, COR_EM_EDICAO);

    // Prévia das ferramentas de contorno: o trecho que sai em destaque, a
    // linha que entra tracejada e um anel em cada ponto já indicado.
    if (previa) {
      const tracar = (pontos: readonly Ponto2D[], fechar: boolean): void => {
        ctx.beginPath();
        pontos.forEach((p, i) => {
          const tela = mundoParaTela(p, transform);
          if (i === 0) ctx.moveTo(tela.x, tela.y);
          else ctx.lineTo(tela.x, tela.y);
        });
        if (fechar) ctx.closePath();
        ctx.stroke();
      };
      ctx.lineJoin = 'round';
      if (previa.substituido && previa.substituido.length > 1) {
        ctx.strokeStyle = COR_MEDICAO;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        tracar(previa.substituido, false);
        ctx.lineCap = 'butt';
      }
      if (previa.novo && previa.novo.length > 1) {
        ctx.strokeStyle = COR_EM_EDICAO;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        tracar(previa.novo, previa.novoFechado === true);
        ctx.setLineDash([]);
      }
      if (previa.linhas && previa.linhas.length > 0) {
        ctx.strokeStyle = COR_EM_EDICAO;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        for (const linha of previa.linhas) if (linha.length > 1) tracar(linha, false);
        ctx.setLineDash([]);
      }
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = COR_MEDICAO;
      ctx.lineWidth = 2;
      for (const marca of previa.marcas ?? []) {
        const tela = mundoParaTela(marca, transform);
        ctx.beginPath();
        ctx.arc(tela.x, tela.y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Prévia da linha de fio sendo definida (primeiro clique já feito): a de
    // um molde novo ou a que "Sentido do fio" vai pôr na peça selecionada.
    if ((modo === 'definir-fio' || modo === 'sentido-do-fio') && pontosEmEdicao.length === 1 && cursorLocal) {
      desenharSeta(ctx, pontosEmEdicao[0]!, cursorLocal, COR_FIO);
    }

    // Onde o ímã prendeu: quadrado vazado num vértice, cruz num ponto da
    // grade — para o usuário ver antes de clicar ou de soltar o vértice.
    const cursorPreso =
      capturaDoCursor !== null && (capturaDoCursor === 'vertice' ? prendeNosVertices : prendeNaGrade);
    const marcaDoIma =
      capturaDoArrasto ?? (cursorPreso && capturaDoCursor && cursorLocal ? { ponto: cursorLocal, tipo: capturaDoCursor } : null);
    if (marcaDoIma) {
      const tela = mundoParaTela(marcaDoIma.ponto, transform);
      ctx.strokeStyle = COR_IMA;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (marcaDoIma.tipo === 'vertice') {
        ctx.rect(tela.x - 6, tela.y - 6, 12, 12);
      } else {
        ctx.moveTo(tela.x - 5, tela.y);
        ctx.lineTo(tela.x + 5, tela.y);
        ctx.moveTo(tela.x, tela.y - 5);
        ctx.lineTo(tela.x, tela.y + 5);
      }
      ctx.stroke();
    }
  }, [
    pecas,
    selecionadoId,
    idsSelecionadosEmLote,
    enfesto,
    idsComErro,
    transform,
    tamanho,
    desenharSeta,
    desenharRotuloComFundo,
    pontosEmEdicao,
    contornoFinalizado,
    cursorLocal,
    capturaDoCursor,
    capturaDoArrasto,
    prendeNosVertices,
    prendeNaGrade,
    ferramentaDeVista,
    modo,
    deltaDeArrasto,
    deltaDeGrupo,
    verticesSelecionados,
    retanguloEmDesenho,
    cerca,
    opcoesDaCerca,
    mostrarGrade,
    pecaSelecionada,
    arestaEmDestaque,
    rotularSegmento,
    medicoes,
    inicioDoTrecho,
    desenharCota,
    cotaEmPrevia,
    previa,
    imagens,
    imagensProntas,
  ]);

  // Desenha a régua horizontal.
  useEffect(() => {
    const canvas = reguaHorizontalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = tamanho.largura;
    canvas.height = ESPESSURA_REGUA_PX;
    ctx.fillStyle = COR_REGUA_FUNDO;
    ctx.fillRect(0, 0, tamanho.largura, ESPESSURA_REGUA_PX);
    ctx.strokeStyle = COR_REGUA_TRACO;
    ctx.fillStyle = COR_REGUA_TRACO;
    ctx.font = '10px sans-serif';
    ctx.lineWidth = 1;

    // mundo.y mapeia para tela.x (troca de eixos de transformacaoDeTela.ts) —
    // por isso a régua horizontal varre mundo.y, lendo/escrevendo o campo
    // .y de telaParaMundo/mundoParaTela, não o .x.
    const passoMm = passoDeReguaEmMm(transform.escalaPxPorMm);
    const mmInicial = telaParaMundo({ x: 0, y: 0 }, transform).y;
    const mmFinal = telaParaMundo({ x: tamanho.largura, y: 0 }, transform).y;
    // Traço maior numerado em cada passo, médio na metade e pequenos nas
    // subdivisões que couberem sem encostar uns nos outros.
    const divisoes = subdivisoesDaRegua(passoMm, transform.escalaPxPorMm);
    const subpassoMm = passoMm / divisoes;
    for (let k = Math.floor(mmInicial / subpassoMm); k * subpassoMm <= mmFinal; k++) {
      const mm = k * subpassoMm;
      const resto = ((k % divisoes) + divisoes) % divisoes;
      const ehMarca = resto === 0;
      const ehMeio = !ehMarca && divisoes % 2 === 0 && resto === divisoes / 2;
      const altura = ehMarca ? 10 : ehMeio ? 6 : 3;
      const x = Math.round(mundoParaTela({ x: 0, y: mm }, transform).x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, ESPESSURA_REGUA_PX);
      ctx.lineTo(x, ESPESSURA_REGUA_PX - altura);
      ctx.stroke();
      if (ehMarca) ctx.fillText(String(Math.round(valorDaReguaEmUnidade(mm, unidadeDaRegua))), x + 2, 10);
    }
  }, [transform, tamanho, unidadeDaRegua]);

  // Desenha a régua vertical.
  useEffect(() => {
    const canvas = reguaVerticalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = ESPESSURA_REGUA_PX;
    canvas.height = tamanho.altura;
    ctx.fillStyle = COR_REGUA_FUNDO;
    ctx.fillRect(0, 0, ESPESSURA_REGUA_PX, tamanho.altura);
    ctx.strokeStyle = COR_REGUA_TRACO;
    ctx.fillStyle = COR_REGUA_TRACO;
    ctx.font = '10px sans-serif';
    ctx.lineWidth = 1;

    // mundo.x mapeia para tela.y (troca de eixos de transformacaoDeTela.ts) —
    // por isso a régua vertical varre mundo.x, lendo/escrevendo o campo .x
    // de telaParaMundo/mundoParaTela, não o .y.
    const passoMm = passoDeReguaEmMm(transform.escalaPxPorMm);
    const mmInicial = telaParaMundo({ x: 0, y: 0 }, transform).x;
    const mmFinal = telaParaMundo({ x: 0, y: tamanho.altura }, transform).x;
    const divisoes = subdivisoesDaRegua(passoMm, transform.escalaPxPorMm);
    const subpassoMm = passoMm / divisoes;
    for (let k = Math.floor(mmInicial / subpassoMm); k * subpassoMm <= mmFinal; k++) {
      const mm = k * subpassoMm;
      const resto = ((k % divisoes) + divisoes) % divisoes;
      const ehMarca = resto === 0;
      const ehMeio = !ehMarca && divisoes % 2 === 0 && resto === divisoes / 2;
      const comprimento = ehMarca ? 10 : ehMeio ? 6 : 3;
      const y = Math.round(mundoParaTela({ x: mm, y: 0 }, transform).y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(ESPESSURA_REGUA_PX, y);
      ctx.lineTo(ESPESSURA_REGUA_PX - comprimento, y);
      ctx.stroke();
      if (ehMarca) {
        ctx.save();
        ctx.translate(10, y - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(valorDaReguaEmUnidade(mm, unidadeDaRegua))), 0, 0);
        ctx.restore();
      }
    }
  }, [transform, tamanho, unidadeDaRegua]);

  function posicaoDoMouse(e: React.MouseEvent<HTMLCanvasElement>): Ponto2D {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function* pontosDoIma(): Generator<Ponto2D> {
    yield* pontosDeCapturaDasPecas(pecas);
    yield* pontosEmEdicao;
    if (contornoFinalizado) yield* contornoFinalizado;
  }

  /** Ponto do mundo sob o mouse, já preso pelo ímã quando ele vale para o modo atual. */
  function pontoNoMundo(tela: Ponto2D): { readonly mundo: Ponto2D; readonly captura: TipoDeCaptura | null } {
    const bruto = telaParaMundo(tela, transform);
    if (!prendeNosVertices) return { mundo: bruto, captura: null };
    const capturado = capturarComIma(
      bruto,
      pontosDoIma(),
      RAIO_DE_CAPTURA_DE_VERTICE_PX / transform.escalaPxPorMm,
      prendeNaGrade ? passoDaGradeEmMm(transform.escalaPxPorMm) : null,
    );
    return { mundo: capturado.ponto, captura: capturado.tipo };
  }

  function aoDescerMouse(e: React.MouseEvent<HTMLCanvasElement>): void {
    const podePanear = e.button === 1 || (e.button === 0 && (espacoPressionadoRef.current || ferramentaDeVista === 'mao'));
    if (podePanear) {
      panRef.current = { ativo: true, ultimoX: e.clientX, ultimoY: e.clientY, vistaGuardada: false };
      setPanAtivo(true);
      return;
    }
    if (e.button !== 0) return;
    const tela = posicaoDoMouse(e);

    if (ferramentaDeVista === 'zoom-janela') {
      const inicio = telaParaMundo(tela, transform);
      setRetanguloEmDesenho({ tipo: 'zoom-janela', inicio, atual: inicio });
      return;
    }

    const { mundo } = pontoNoMundo(tela);
    const semCaptura = telaParaMundo(tela, transform);

    if (modo === 'definir-cerca') {
      setRetanguloEmDesenho({ tipo: 'cerca', inicio: mundo, atual: mundo });
      return;
    }

    if (MODOS_DE_EDICAO_DE_VERTICE.has(modo)) {
      if (!pecaSelecionada) return;

      if (modo === 'inserir-ponto') {
        const maisProximo = pontoMaisProximoNoContorno(mundo, pecaSelecionada.contorno);
        onInserirPontoNoMolde?.(maisProximo.indiceAresta, maisProximo.ponto);
        return;
      }

      const raioMm = RAIO_DE_CAPTURA_DE_VERTICE_PX / transform.escalaPxPorMm;

      if (modo === 'redefinir-perimetro') {
        const aresta = arestaPerto(mundo, pecaSelecionada.contorno, raioMm);
        if (aresta) onIndicarArestaParaRedefinir?.(aresta.indiceAresta, aresta.extremidade);
        return;
      }

      let indiceMaisProximo = -1;
      let menorDistancia = Infinity;
      pecaSelecionada.contorno.forEach((p, i) => {
        const d = distancia(mundo, p);
        if (d < menorDistancia) {
          menorDistancia = d;
          indiceMaisProximo = i;
        }
      });
      const achouVertice = indiceMaisProximo >= 0 && menorDistancia <= raioMm;

      if (MODOS_COM_SELECAO_DE_VERTICES.has(modo)) {
        if (e.shiftKey) {
          // Shift+clique: acrescenta/remove da seleção, sem arrastar —
          // monta um grupo de vértices para mover juntos depois.
          if (achouVertice) {
            setVerticesSelecionados((atual) => {
              const novo = new Set(atual);
              if (novo.has(indiceMaisProximo)) novo.delete(indiceMaisProximo);
              else novo.add(indiceMaisProximo);
              return novo;
            });
          }
          return;
        }
        if (achouVertice) {
          const jaFazParteDaSelecao = verticesSelecionados.has(indiceMaisProximo) && verticesSelecionados.size > 1;
          const indices = jaFazParteDaSelecao ? [...verticesSelecionados] : [indiceMaisProximo];
          if (!jaFazParteDaSelecao) setVerticesSelecionados(new Set([indiceMaisProximo]));
          arrastoDeGrupoRef.current = {
            indices,
            ancora: pecaSelecionada.contorno[indiceMaisProximo]!,
            inicioDoMouse: mundo,
            inicioNaTela: tela,
            arrastou: false,
          };
          setDeltaDeGrupo({ x: 0, y: 0 });
          return;
        }
        // Clique em espaço vazio: começa o retângulo de seleção de vértices.
        setVerticesSelecionados(new Set());
        setRetanguloEmDesenho({ tipo: 'selecao-de-vertices', inicio: mundo, atual: mundo });
        return;
      }

      if (!achouVertice) return;
      if (modo === 'excluir-ponto') {
        onExcluirPontoDoMolde?.(indiceMaisProximo);
      } else if (modo === 'arredondar-ou-chanfrar') {
        onArredondarOuChanfrarCanto?.(indiceMaisProximo);
      }
      return;
    }

    if (modo === 'selecionar') {
      const encontrada = [...pecas].reverse().find((p) => pontoDentroDoContorno(mundo, p.contorno));
      onSelecionar(encontrada ? encontrada.id : null);
      if (encontrada) {
        arrastoRef.current = { id: encontrada.id, ultimoMundo: mundo };
        setDeltaDeArrasto({ id: encontrada.id, delta: { x: 0, y: 0 } });
      }
      return;
    }
    onCliqueNoCanvas(mundo, semCaptura);
  }

  function aoMoverMouse(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (panRef.current.ativo) {
      const dx = e.clientX - panRef.current.ultimoX;
      const dy = e.clientY - panRef.current.ultimoY;
      if (dx === 0 && dy === 0) return;
      // A vista de antes do arrasto vai para o histórico só quando a vista
      // muda de fato — clicar sem arrastar não cria uma "vista anterior".
      if (!panRef.current.vistaGuardada) onGuardarVista?.();
      panRef.current = { ativo: true, ultimoX: e.clientX, ultimoY: e.clientY, vistaGuardada: true };
      onTransformChange({
        ...transform,
        offsetXPx: transform.offsetXPx + dx,
        offsetYPx: transform.offsetYPx + dy,
      });
      return;
    }
    const tela = posicaoDoMouse(e);
    const { mundo, captura } = pontoNoMundo(tela);
    setCursorLocal(mundo);
    setCapturaDoCursor(captura);
    onCursorMove(mundo);

    const arrastoDeGrupo = arrastoDeGrupoRef.current;
    if (arrastoDeGrupo) {
      // Um clique para escolher o vértice não o move: com o ímã na grade, um
      // tremor do mouse o levaria até o ponto da grade mais próximo.
      if (distancia(tela, arrastoDeGrupo.inicioNaTela) >= LIMIAR_DE_ARRASTO_DE_VERTICE_PX) arrastoDeGrupo.arrastou = true;
      if (arrastoDeGrupo.arrastou) {
        const alvo = somar(arrastoDeGrupo.ancora, {
          x: mundo.x - arrastoDeGrupo.inicioDoMouse.x,
          y: mundo.y - arrastoDeGrupo.inicioDoMouse.y,
        });
        // O ímã prende o vértice agarrado nos vértices das outras peças ou na
        // grade — não nos da própria peça, o que deixaria pontos repetidos
        // ou o contorno encostando em si mesmo.
        const capturado =
          imaAtivo && pecaSelecionada
            ? capturarComIma(
                alvo,
                pontosDeCapturaDasPecas(pecas.filter((p) => p.id !== pecaSelecionada.id)),
                RAIO_DE_CAPTURA_DE_VERTICE_PX / transform.escalaPxPorMm,
                mostrarGrade ? passoDaGradeEmMm(transform.escalaPxPorMm) : null,
              )
            : { ponto: alvo, tipo: null };
        setDeltaDeGrupo({ x: capturado.ponto.x - arrastoDeGrupo.ancora.x, y: capturado.ponto.y - arrastoDeGrupo.ancora.y });
        setCapturaDoArrasto(capturado.tipo ? { ponto: capturado.ponto, tipo: capturado.tipo } : null);
      }
    }

    if (retanguloEmDesenho) {
      setRetanguloEmDesenho((anterior) => (anterior ? { ...anterior, atual: mundo } : anterior));
    }

    if (arrastoRef.current) {
      const deltaPasso = { x: mundo.x - arrastoRef.current.ultimoMundo.x, y: mundo.y - arrastoRef.current.ultimoMundo.y };
      arrastoRef.current.ultimoMundo = mundo;
      setDeltaDeArrasto((atual) =>
        atual ? { id: atual.id, delta: somar(atual.delta, deltaPasso) } : atual,
      );
    }
  }

  function finalizarArrasto(): void {
    if (arrastoRef.current && deltaDeArrasto) {
      const { id, delta } = deltaDeArrasto;
      if (Math.abs(delta.x) > 1e-6 || Math.abs(delta.y) > 1e-6) {
        onMoverPeca(id, delta);
      }
    }
    arrastoRef.current = null;
    setDeltaDeArrasto(null);
  }

  /**
   * Fecha o arrasto de vértices. `soltou` é falso quando o mouse saiu do
   * desenho: aí só um arrasto de fato move os pontos. Em "Modificar", soltar
   * o botão sem ter arrastado abre a medida exata para os vértices agarrados.
   */
  function finalizarArrastoDeGrupo(soltou: boolean): void {
    const arrasto = arrastoDeGrupoRef.current;
    if (arrasto && deltaDeGrupo && (Math.abs(deltaDeGrupo.x) > 1e-6 || Math.abs(deltaDeGrupo.y) > 1e-6)) {
      onMoverVariosPontos?.(arrasto.indices, deltaDeGrupo);
    } else if (arrasto && soltou && !arrasto.arrastou && modo === 'modificar') {
      onIndicarPontosParaModificar?.(arrasto.indices);
    }
    arrastoDeGrupoRef.current = null;
    setDeltaDeGrupo(null);
    setCapturaDoArrasto(null);
  }

  /** Os vértices da peça selecionada dentro do retângulo entre `a` e `b` (mm) passam a ser a seleção de vértices. */
  function selecionarVerticesNoRetangulo(a: Ponto2D, b: Ponto2D): void {
    if (!pecaSelecionada) return;
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const dentro = new Set<number>();
    pecaSelecionada.contorno.forEach((p, i) => {
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) dentro.add(i);
    });
    setVerticesSelecionados(dentro);
  }

  /**
   * Fecha o retângulo em arrasto. `telaFinal` é onde o botão foi solto, ou
   * `null` se o mouse saiu do canvas: aí cerca e zoom por janela são
   * cancelados, e a seleção de vértices fica com o último retângulo visto.
   */
  function finalizarRetangulo(telaFinal: Ponto2D | null): void {
    const retangulo = retanguloEmDesenho;
    if (!retangulo) return;
    setRetanguloEmDesenho(null);
    const fim = telaFinal ? pontoNoMundo(telaFinal).mundo : retangulo.atual;
    if (retangulo.tipo === 'selecao-de-vertices') {
      selecionarVerticesNoRetangulo(retangulo.inicio, fim);
      return;
    }
    if (!telaFinal) return;
    const a = mundoParaTela(retangulo.inicio, transform);
    const b = mundoParaTela(fim, transform);
    const larguraPx = Math.abs(b.x - a.x);
    const alturaPx = Math.abs(b.y - a.y);
    if (retangulo.tipo === 'cerca') {
      if (larguraPx >= TAMANHO_MINIMO_DA_CERCA_PX && alturaPx >= TAMANHO_MINIMO_DA_CERCA_PX) {
        onDefinirCerca?.(cercaEntre(retangulo.inicio, fim));
      }
      return;
    }
    if (larguraPx >= TAMANHO_MINIMO_DA_JANELA_DE_ZOOM_PX && alturaPx >= TAMANHO_MINIMO_DA_JANELA_DE_ZOOM_PX) {
      onGuardarVista?.();
      onTransformChange(enquadrarRetanguloDeTela(transform, a, b, tamanho));
      onZoomJanelaConcluido?.();
    }
  }

  function encerrarPan(): void {
    panRef.current.ativo = false;
    setPanAtivo(false);
  }

  function aoSoltarMouse(e: React.MouseEvent<HTMLCanvasElement>): void {
    encerrarPan();
    finalizarArrasto();
    finalizarArrastoDeGrupo(true);
    finalizarRetangulo(posicaoDoMouse(e));
  }

  function aoSairMouse(): void {
    encerrarPan();
    finalizarArrasto();
    finalizarArrastoDeGrupo(false);
    finalizarRetangulo(null);
    setCursorLocal(null);
    setCapturaDoCursor(null);
    onCursorMove(null);
  }

  function aoRolarMouse(e: React.WheelEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    const fator = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nova = aplicarZoom(transform, fator, posicaoDoMouse(e));
    if (nova.escalaPxPorMm === transform.escalaPxPorMm) return; // já no limite de zoom
    // Uma sequência de rolagens é um gesto só: a vista de antes dela vai uma vez para o histórico.
    if (e.timeStamp - ultimaRolagemRef.current > PAUSA_ENTRE_GESTOS_DE_ROLAGEM_MS) onGuardarVista?.();
    ultimaRolagemRef.current = e.timeStamp;
    onTransformChange(nova);
  }

  function aoClicarDuasVezes(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (modo !== 'selecionar' || ferramentaDeVista !== null) return;
    const mundo = telaParaMundo(posicaoDoMouse(e), transform);
    const encontrada = [...pecas].reverse().find((p) => pontoDentroDoContorno(mundo, p.contorno));
    if (encontrada) onAbrirPropriedades?.(encontrada.id);
  }

  const cursorDoCanvas = panAtivo
    ? 'grabbing'
    : ferramentaDeVista === 'mao'
      ? 'grab'
      : ferramentaDeVista === 'zoom-janela'
        ? 'zoom-in'
        : modo === 'selecionar'
          ? 'default'
          : 'crosshair';

  return (
    <div className="area-de-desenho-grade">
      <button
        className="regua-canto"
        onClick={onAlternarUnidadeDaRegua}
        title="Clique para alternar a unidade da régua (cm/mm) — a geometria interna continua em mm"
      >
        {unidadeDaRegua}
      </button>
      <canvas ref={reguaHorizontalRef} className="regua-horizontal" />
      <canvas ref={reguaVerticalRef} className="regua-vertical" />
      <div ref={containerRef} className="area-de-desenho-container">
        <canvas
          ref={canvasRef}
          onMouseDown={aoDescerMouse}
          onMouseMove={aoMoverMouse}
          onMouseUp={aoSoltarMouse}
          onMouseLeave={aoSairMouse}
          onDoubleClick={aoClicarDuasVezes}
          onWheel={aoRolarMouse}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: cursorDoCanvas }}
        />
      </div>
    </div>
  );
}
