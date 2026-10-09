import { useCallback, useEffect, useRef, useState } from 'react';
import { contornoDeCorte, transladarMolde, type Molde } from '../domain/molde';
import { cercaEntre, pecasAlvoDaCerca, pontosMoveisNaCerca, type Cerca } from '../domain/cerca';
import {
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
const COR_EM_EDICAO = '#2e7d32';
const COR_REGUA_FUNDO = '#f7f8fa';
const COR_REGUA_TRACO = '#5a6270';
const COR_ALCA_DE_VERTICE = '#e65100';
const COR_CERCA = '#e65100';
const COR_PREENCHIMENTO_CERCA = 'rgba(230, 81, 0, 0.07)';
const COR_JANELA_DE_ZOOM = '#5a6270';
const COR_PREENCHIMENTO_JANELA_DE_ZOOM = 'rgba(90, 98, 112, 0.08)';
const COR_GRADE = 'rgba(90, 98, 112, 0.38)';
const COR_IMA = '#d81b60';

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
  | 'pique'
  | 'marca'
  | 'mover-ponto'
  | 'inserir-ponto'
  | 'excluir-ponto'
  | 'arredondar-ou-chanfrar'
  | 'definir-cerca';

/**
 * Ferramentas da barra de visualização (embaixo do desenho). Ficam por cima
 * do modo de desenho, sem trocá-lo: a Mão fica ligada até ser desligada (ou
 * Esc); o Zoom por janela vale para um retângulo e se desliga sozinho.
 */
export type FerramentaDeVista = 'mao' | 'zoom-janela';

const MODOS_DE_EDICAO_DE_VERTICE: ReadonlySet<ModoDeDesenho> = new Set([
  'mover-ponto',
  'inserir-ponto',
  'excluir-ponto',
  'arredondar-ou-chanfrar',
]);

/** Modos em que o clique cria um ponto novo — só neles o ímã age. Arrastos (peça, vértices) não são capturados. */
const MODOS_COM_IMA: ReadonlySet<ModoDeDesenho> = new Set([
  'novo-molde',
  'novo-furo',
  'definir-fio',
  'marca',
  'definir-cerca',
]);

const RAIO_DE_CAPTURA_DE_VERTICE_PX = 10;
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
  readonly onCliqueNoCanvas: (mundo: Ponto2D) => void;
  readonly onMoverPeca: (id: string, deslocamento: Ponto2D) => void;
  readonly onAbrirPropriedades?: (id: string) => void;
  readonly onMoverVariosPontos?: (indices: readonly number[], delta: Ponto2D) => void;
  readonly onInserirPontoNoMolde?: (indiceAresta: number, ponto: Ponto2D) => void;
  readonly onExcluirPontoDoMolde?: (indice: number) => void;
  readonly onArredondarOuChanfrarCanto?: (indice: number) => void;
  /** Cerca ativa (desenhada tracejada até ser desligada), ou `null`. */
  readonly cerca: Cerca | null;
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
}

function traçarContorno(ctx: CanvasRenderingContext2D, contorno: readonly Ponto2D[], transform: TransformacaoDeTela): void {
  contorno.forEach((p, i) => {
    const tela = mundoParaTela(p, transform);
    if (i === 0) ctx.moveTo(tela.x, tela.y);
    else ctx.lineTo(tela.x, tela.y);
  });
  ctx.closePath();
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
    cerca,
    onDefinirCerca,
    ferramentaDeVista,
    onZoomJanelaConcluido,
    onGuardarVista,
    mostrarGrade,
    imaAtivo,
    unidadeDaRegua,
    onAlternarUnidadeDaRegua,
    onTamanhoChange,
  } = props;
  const pecaSelecionada = pecas.find((p) => p.id === selecionadoId) ?? null;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reguaHorizontalRef = useRef<HTMLCanvasElement | null>(null);
  const reguaVerticalRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });
  const [cursorLocal, setCursorLocal] = useState<Ponto2D | null>(null);
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
  // Seleção de vértices no modo "Mover ponto": clique simples seleciona só um
  // e já arrasta; Shift+clique acrescenta/remove da seleção sem arrastar;
  // clique+arrasto num espaço vazio desenha um retângulo de seleção que
  // seleciona os vértices da peça dentro dele ao soltar. Não é a Cerca
  // ("Definir cerca"/"Mover cerca", `domain/cerca.ts`), que fica desenhada
  // até ser desligada e vale para todas as peças.
  const [verticesSelecionados, setVerticesSelecionados] = useState<ReadonlySet<number>>(new Set());
  const arrastoDeGrupoRef = useRef<{ indices: readonly number[]; ultimoMundo: Ponto2D } | null>(null);
  const [deltaDeGrupo, setDeltaDeGrupo] = useState<Ponto2D | null>(null);
  const [retanguloEmDesenho, setRetanguloEmDesenho] = useState<RetanguloEmDesenho | null>(null);

  // Limpa a seleção de vértices ao trocar de modo ou de peça selecionada, e
  // descarta um retângulo pela metade ao trocar de modo ou de ferramenta de
  // vista — ajuste de estado durante a renderização (não num efeito, nem
  // lendo ref — só state), padrão recomendado pelo React para "resetar
  // estado quando uma prop muda".
  const [modoAnterior, setModoAnterior] = useState(modo);
  const [selecionadoIdAnterior, setSelecionadoIdAnterior] = useState(selecionadoId);
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
      if (e.code === 'Space') espacoPressionadoRef.current = true;
    }
    function aoSoltarTecla(e: KeyboardEvent): void {
      if (e.code === 'Space') espacoPressionadoRef.current = false;
    }
    window.addEventListener('keydown', aoPressionarTecla);
    window.addEventListener('keyup', aoSoltarTecla);
    return () => {
      window.removeEventListener('keydown', aoPressionarTecla);
      window.removeEventListener('keyup', aoSoltarTecla);
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
      ctx.fillStyle = COR_TECIDO;
      ctx.fill('evenodd');
      const temErro = idsComErro.has(peca.id);
      const estaSelecionada = peca.id === selecionadoId || idsSelecionadosEmLote.has(peca.id);
      ctx.strokeStyle = temErro ? COR_CONTORNO_COM_ERRO : estaSelecionada ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
      ctx.lineWidth = estaSelecionada || temErro ? 2.5 : 1.5;
      if (temErro) ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const furo of peca.furos) {
        ctx.beginPath();
        traçarContorno(ctx, furo, transform);
        ctx.strokeStyle = estaSelecionada ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const linha of peca.linhasInternas) {
        ctx.beginPath();
        linha.forEach((p, i) => {
          const tela = mundoParaTela(p, transform);
          if (i === 0) ctx.moveTo(tela.x, tela.y);
          else ctx.lineTo(tela.x, tela.y);
        });
        ctx.strokeStyle = COR_CONTORNO;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (peca.margemDeCosturaMm > 0) {
        ctx.beginPath();
        traçarContorno(ctx, contornoDeCorte(peca), transform);
        ctx.strokeStyle = COR_LINHA_DE_CORTE;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const pique of peca.piques) {
        const n = peca.contorno.length;
        const a = peca.contorno[pique.indiceAresta % n]!;
        const b = peca.contorno[(pique.indiceAresta + 1) % n]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const comprimento = Math.hypot(dx, dy) || 1;
        const normalX = dy / comprimento;
        const normalY = -dx / comprimento;
        const tamanhoMm = 6;
        const p1 = mundoParaTela(pique.posicao, transform);
        const p2 = mundoParaTela(
          { x: pique.posicao.x + normalX * tamanhoMm, y: pique.posicao.y + normalY * tamanhoMm },
          transform,
        );
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = COR_PIQUE;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const marca of peca.marcas) {
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
    }

    // Alças nos vértices da peça selecionada, nos modos de edição de forma
    // (mover/inserir/excluir ponto, chanfrar/arredondar canto) — a mesma
    // prévia ao vivo do grupo em arrasto já foi aplicada acima. No modo
    // "mover ponto", vértices selecionados (clique com Shift ou dentro da
    // cerca) ficam destacados numa cor diferente.
    if (MODOS_DE_EDICAO_DE_VERTICE.has(modo) && pecaSelecionada) {
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
        const selecionado = modo === 'mover-ponto' && (verticesSelecionados.has(i) || indicesEmArrasto?.has(i));
        ctx.beginPath();
        ctx.arc(tela.x, tela.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = selecionado ? COR_CONTORNO_SELECIONADO : COR_ALCA_DE_VERTICE;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
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
        for (const p of pontosMoveisNaCerca(peca, cerca)) {
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

    // Contorno em edição (novo molde / novo furo): linha aberta + vértices.
    if (pontosEmEdicao.length > 0) {
      ctx.beginPath();
      pontosEmEdicao.forEach((p, i) => {
        const tela = mundoParaTela(p, transform);
        if (i === 0) ctx.moveTo(tela.x, tela.y);
        else ctx.lineTo(tela.x, tela.y);
      });
      if (cursorLocal) {
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
    }

    // Prévia da linha de fio sendo definida (primeiro clique já feito).
    if (modo === 'definir-fio' && pontosEmEdicao.length === 1 && cursorLocal) {
      desenharSeta(ctx, pontosEmEdicao[0]!, cursorLocal, COR_FIO);
    }

    // Onde o ímã prendeu o cursor: quadrado vazado num vértice, cruz num
    // ponto da grade — para o usuário ver antes de clicar.
    if (capturaDoCursor && cursorLocal && imaAtivo && ferramentaDeVista === null && MODOS_COM_IMA.has(modo)) {
      const tela = mundoParaTela(cursorLocal, transform);
      ctx.strokeStyle = COR_IMA;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (capturaDoCursor === 'vertice') {
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
    imaAtivo,
    ferramentaDeVista,
    modo,
    deltaDeArrasto,
    deltaDeGrupo,
    verticesSelecionados,
    retanguloEmDesenho,
    cerca,
    mostrarGrade,
    pecaSelecionada,
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
    if (!imaAtivo || ferramentaDeVista !== null || !MODOS_COM_IMA.has(modo)) return { mundo: bruto, captura: null };
    const capturado = capturarComIma(
      bruto,
      pontosDoIma(),
      RAIO_DE_CAPTURA_DE_VERTICE_PX / transform.escalaPxPorMm,
      mostrarGrade ? passoDaGradeEmMm(transform.escalaPxPorMm) : null,
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

      if (modo === 'mover-ponto') {
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
          arrastoDeGrupoRef.current = { indices, ultimoMundo: mundo };
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
    onCliqueNoCanvas(mundo);
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

    if (arrastoDeGrupoRef.current) {
      const deltaPasso = {
        x: mundo.x - arrastoDeGrupoRef.current.ultimoMundo.x,
        y: mundo.y - arrastoDeGrupoRef.current.ultimoMundo.y,
      };
      arrastoDeGrupoRef.current.ultimoMundo = mundo;
      setDeltaDeGrupo((atual) => (atual ? somar(atual, deltaPasso) : deltaPasso));
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

  function finalizarArrastoDeGrupo(): void {
    if (arrastoDeGrupoRef.current && deltaDeGrupo) {
      const { indices } = arrastoDeGrupoRef.current;
      if (Math.abs(deltaDeGrupo.x) > 1e-6 || Math.abs(deltaDeGrupo.y) > 1e-6) {
        onMoverVariosPontos?.(indices, deltaDeGrupo);
      }
    }
    arrastoDeGrupoRef.current = null;
    setDeltaDeGrupo(null);
  }

  /** Os vértices da peça selecionada dentro do retângulo entre `a` e `b` (mm) passam a ser a seleção de "Mover ponto". */
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
    finalizarArrastoDeGrupo();
    finalizarRetangulo(posicaoDoMouse(e));
  }

  function aoSairMouse(): void {
    encerrarPan();
    finalizarArrasto();
    finalizarArrastoDeGrupo();
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
