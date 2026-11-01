import { tamanhosDasPecas } from '../domain/fichaTecnica';
import { pecasNoTamanho } from '../domain/tamanhosGraduados';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { CampoDeNumero } from './CampoDeNumero';
import type { Molde } from '../domain/molde';
import type { FichaTecnica } from '../domain/fichaTecnica';
import type { RegrasDeCaimento } from '../domain/recomendacaoDeTamanho';
import type { ImagemDoModelo } from '../domain/imagens';
import {
  corpoDoManequim,
  LIMITES_DA_MEDIDA,
  malhaDoCorpo,
  manequimDoTamanho,
  MEDIDAS_DO_PUBLICO,
  medidasConferidas,
  ROTULO_DA_MEDIDA_DO_MANEQUIM,
  ROTULO_DO_PUBLICO,
  type CorpoDoManequim,
  type MalhaDoCorpo,
  type MedidasDoManequim,
  type PublicoDoManequim,
} from '../domain/manequim';
import {
  comprimentoDoTrecho,
  corMaisEscura,
  configuracoesDasInstancias,
  coordenadasDaFace,
  giroPelaForma,
  instanciasDasPecas,
  ladosDoContorno,
  normalizarGiro,
  malhasDasInstancias,
  problemasDaCostura,
  ROTULO_DA_ALTURA,
  ROTULO_DA_POSICAO,
  sentidoSugerido,
  sugerirCosturas,
  TECIDOS_PRONTOS,
  type AlturaDoTopo,
  type ConfiguracaoDaInstancia,
  type Costura3D,
  type InstanciaDaPeca,
  type Montagem3D,
  type PosicaoNoCorpo,
  type PresetDeTecido,
  type Tecido3D,
  COR_DE_PARTIDA,
} from '../domain/montagem3d';
import { corNaVariante, type VarianteDeCor } from '../domain/desenhoTecnico';
import { aberturaDasCosturas, alturasDoTecido, assentou, avancar, botoesDaSimulacao, ligarAutoColisao, maiorPenetracao, montarSimulacao, tensoes, TEMPO_DA_COSTURA_S, type Simulacao } from '../domain/simulacaoDoTecido';
import {
  cameraDeFrente,
  corDaTensao,
  corRgb,
  desenharCena,
  desenharSombraNoChao,
  guinadasDoGiro,
  luzDoTom,
  montarCena,
  pontoDoCorpoNaTela,
  projecao,
  TONS_DA_ESTAMPA,
  type Camera3D,
  type EstampaPronta,
  type TecidoParaDesenhar,
} from './cena3d';
import { pontoNoTronco, preMoldeDoDesenho } from '../domain/desenhoNoCorpo';
import { ROTULO_DA_POSE, type PoseDoManequim, type Ponto3D } from '../domain/manequim';
import { numeroComVirgula } from '../core/numeros';

type AbaDoProvador = 'pecas' | 'costuras' | 'manequim' | 'tecido' | 'imagem' | 'desenho';

interface EstadoDaSimulacao {
  readonly fase: 'arrumado' | 'costurando' | 'caindo' | 'assentou' | 'parado';
  readonly tempo: number;
  readonly abertura?: number;
  readonly penetracao?: number;
  readonly tensaoMaxima?: number;
  readonly tensaoMedia?: number;
  /** De que altura a que altura do chão a roupa ficou (mm). */
  readonly alturas?: { readonly de: number; readonly ate: number };
  /** Os nomes das peças que escorregaram do corpo. */
  readonly caidas?: readonly string[];
}

interface Montada {
  readonly chave: string;
  readonly sim: Simulacao;
  readonly corpo: CorpoDoManequim;
  readonly malhaDoCorpo: MalhaDoCorpo;
  readonly botoes: ReturnType<typeof botoesDaSimulacao>;
  readonly uvs: ReadonlyMap<string, Float64Array>;
}

const TEMPO_MAXIMO_S = 10;
const VISTAS: ReadonlyArray<readonly [string, number]> = [
  ['Frente', 0],
  ['Lado', -Math.PI / 2],
  ['Costas', Math.PI],
];

const pct = (v: number): string => `${numeroComVirgula(v * 100, 1)}%`;

/**
 * O provador 3D (ADR 0111): as peças do projeto montadas num manequim feito pelas medidas, costuradas e caindo pelo
 * peso, pela elasticidade e pela rigidez do tecido; as cores, as estampas e os botões; o mapa de tensão; a imagem
 * para o catálogo. A montagem (não a simulação) fica no projeto.
 */
export function PainelDoProvador3D(props: {
  readonly pecas: readonly Molde[];
  readonly montagemGuardada: Montagem3D;
  readonly ficha: FichaTecnica | null;
  readonly regrasDeCaimento: RegrasDeCaimento;
  readonly imagens: readonly ImagemDoModelo[];
  readonly nomeDoModelo: string;
  readonly onGuardar: (montagem: Montagem3D) => void;
  readonly onSalvarArquivo: (nome: string, bytes: ArrayBuffer) => Promise<string | null>;
  readonly novoId: () => string;
  readonly onFechar: () => void;
  /** O pré-molde tirado do desenho no corpo (ADR 0134) vai para o projeto. */
  readonly onCriarPeca?: (peca: Molde) => void;
}): React.JSX.Element {
  // Provar outro tamanho (ADR 0223): só muda aqui, o projeto fica como está. O manequim tem a escolha dele.
  const [tamanhoDasPecas, setTamanhoDasPecas] = useState('');
  const tamanhosDoMolde = useMemo(() => tamanhosDasPecas(props.pecas), [props.pecas]);
  const instancias = useMemo(() => instanciasDasPecas(pecasNoTamanho(props.pecas, tamanhoDasPecas)), [props.pecas, tamanhoDasPecas]);
  const [montagem, setMontagem] = useState<Montagem3D>(() => ({ ...props.montagemGuardada, pecas: configuracoesDasInstancias(instancias, props.montagemGuardada) }));
  const guardadaRef = useRef(montagem);
  const [aba, setAba] = useState<AbaDoProvador>('pecas');
  const [camera, setCamera] = useState<Camera3D>(() => cameraDeFrente(montagem.manequim.medidas.alturaCm * 10));
  const [modo, setModo] = useState<'cor' | 'tensao'>('cor');
  const [simulando, setSimulando] = useState(false);
  const [estado, setEstado] = useState<EstadoDaSimulacao>({ fase: 'arrumado', tempo: 0 });
  const [mensagem, setMensagem] = useState<string | null>(null);
  // A resolução das imagens salvas (1, 2 ou 4 vezes 600 × 900) e o giro em vídeo sendo gravado (ADR 0139).
  const [fatorDaImagem, setFatorDaImagem] = useState(1);
  const [gravandoGiro, setGravandoGiro] = useState(false);
  // O desenho no corpo (ADR 0134): os pontos clicados no tronco, a folga e o nome do pré-molde.
  const [pontosDoDesenho, setPontosDoDesenho] = useState<readonly Ponto3D[]>([]);
  const [folgaDoDesenho, setFolgaDoDesenho] = useState(4);
  const [nomeDoDesenho, setNomeDoDesenho] = useState('Pré-molde do corpo');
  const [imagensProntas, setImagensProntas] = useState<ReadonlyMap<string, HTMLImageElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const montadaRef = useRef<Montada | null>(null);
  const arrastoRef = useRef<{ x: number; y: number; camera: Camera3D } | null>(null);
  /** Cada imagem de estampa reduzida e sombreada em cada tom (feita uma vez). */
  const tonsRef = useRef(new Map<string, HTMLCanvasElement[]>());

  // A montagem mudada vai para o projeto meio segundo depois da última mudança (e ao fechar).
  const { onGuardar } = props;
  useEffect(() => {
    if (montagem === guardadaRef.current) return;
    const t = setTimeout(() => {
      guardadaRef.current = montagem;
      onGuardar(montagem);
    }, 500);
    return () => clearTimeout(t);
  }, [montagem, onGuardar]);
  const fechar = (): void => {
    if (montagem !== guardadaRef.current) props.onGuardar(montagem);
    props.onFechar();
  };

  // As imagens das estampas, carregadas uma vez.
  const imagensUsadas = useMemo(() => [...new Set(Object.values(montagem.pecas).flatMap((c) => (c.estampa ? [c.estampa.imagemId] : [])))].sort(), [montagem.pecas]);
  useEffect(() => {
    for (const id of imagensUsadas) {
      if (imagensProntas.has(id)) continue;
      const dados = props.imagens.find((i) => i.id === id);
      if (!dados) continue;
      const img = new Image();
      img.onload = () => setImagensProntas((atual) => new Map(atual).set(id, img));
      img.src = dados.dados;
    }
  }, [imagensUsadas, imagensProntas, props.imagens]);

  // O que muda a física (a simulação recomeça); as cores e as estampas não.
  const costurasValidas = montagem.costuras.filter((c) => !problemasDaCostura(c, instancias).some((p) => !p.includes('o molde mudou')));
  const chaveDaFisica = JSON.stringify([
    instancias.map((i) => [i.chave, i.assinatura]),
    montagem.manequim.medidas,
    montagem.manequim.pose ?? 'padrao',
    montagem.resolucaoMm,
    montagem.autoColisao !== false,
    tamanhoDasPecas,
    // O brilho e a transparência são só da vista, e o nome do tecido pronto não muda a física: mexer neles não
    // recomeça a simulação.
    { ...montagem.tecido, preset: undefined, brilho: undefined, transparencia: undefined },
    // O zíper é só da vista: pôr ou tirar não recomeça a simulação.
    costurasValidas.map((c) => ({ ...c, ziperMm: undefined })),
    Object.entries(montagem.pecas).map(([k, c]) => [k, c.posicao, c.alturaDoTopo, c.ajusteMm, c.desvioMm, c.girarGraus]),
  ]);
  const [chaveVista, setChaveVista] = useState(chaveDaFisica);
  if (chaveVista !== chaveDaFisica) {
    setChaveVista(chaveDaFisica);
    setSimulando(false);
    setEstado({ fase: 'arrumado', tempo: 0 });
  }

  /** A simulação da montagem de agora (refeita se a física mudou). */
  const obterMontada = useCallback((): Montada => {
    if (montadaRef.current && montadaRef.current.chave === chaveDaFisica) return montadaRef.current;
    const corpo = corpoDoManequim(montagem.manequim.medidas, montagem.manequim.pose);
    const malhas = malhasDasInstancias(instancias, montagem.pecas, montagem.resolucaoMm, costurasValidas);
    const sim = montarSimulacao({ corpo, instancias, configuracoes: montagem.pecas, malhas, costuras: costurasValidas, tecido: montagem.tecido });
    ligarAutoColisao(sim, montagem.autoColisao !== false);
    const uvs = new Map<string, Float64Array>();
    for (const p of sim.pecas) {
      const inst = instancias.find((i) => i.chave === p.chave)!;
      const face = coordenadasDaFace(inst, montagem.pecas[p.chave]!.girarGraus, p.malha.pontos);
      const uv = new Float64Array(face.u.length * 2);
      for (let i = 0; i < face.u.length; i++) {
        uv[2 * i] = face.u[i]!;
        uv[2 * i + 1] = face.v[i]!;
      }
      uvs.set(p.chave, uv);
    }
    montadaRef.current = { chave: chaveDaFisica, sim, corpo, malhaDoCorpo: malhaDoCorpo(corpo), botoes: botoesDaSimulacao(sim, instancias), uvs };
    return montadaRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave da física resume a montagem que importa aqui
  }, [chaveDaFisica]);

  /** A imagem reduzida (até 512 px) e escurecida em cada tom de luz, guardada para os próximos desenhos. */
  const tonsDaImagem = useCallback((id: string, img: HTMLImageElement): HTMLCanvasElement[] | null => {
    const prontos = tonsRef.current.get(id);
    if (prontos) return prontos;
    const escala = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const tons: HTMLCanvasElement[] = [];
    for (let tom = 0; tom < TONS_DA_ESTAMPA; tom++) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d');
      if (!cx) return null;
      cx.drawImage(img, 0, 0, w, h);
      // Escurece pelo tom: o preto por cima, com a transparência da sombra (só onde a imagem tem tinta).
      cx.globalCompositeOperation = 'source-atop';
      cx.fillStyle = `rgba(0,0,0,${(1 - luzDoTom(tom)).toFixed(3)})`;
      cx.fillRect(0, 0, w, h);
      tons.push(c);
    }
    tonsRef.current.set(id, tons);
    return tons;
  }, []);

  // A cor do modelo (ADR 0152): as variantes do desenho técnico vistas no 3D; só a vista muda, a física não.
  const desenhoDaFicha = props.ficha?.desenho ?? null;
  const variantesDeCor = desenhoDaFicha?.variantes ?? [];
  const [varianteId, setVarianteId] = useState('');
  const varianteAtual = variantesDeCor.find((v) => v.id === varianteId) ?? null;

  /** Desenha a cena no canvas dado (o da janela, ou um à parte para a imagem). */
  const desenharEm = useCallback(
    (canvas: HTMLCanvasElement, cam: Camera3D, fundo: string | null, variante: VarianteDeCor | null = varianteAtual): boolean => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const m = obterMontada();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (fundo) {
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else ctx.clearRect(0, 0, canvas.width, canvas.height);
      const proj = projecao(cam, canvas.width, canvas.height, m.corpo.alturaMm);
      const estampas = new Map<string, EstampaPronta>();
      const pecas: TecidoParaDesenhar['pecas'][number][] = [];
      for (const p of m.sim.pecas) {
        const config = montagem.pecas[p.chave]!;
        const inst = instancias.find((i) => i.chave === p.chave)!;
        const e = config.estampa;
        const img = e ? imagensProntas.get(e.imagemId) : undefined;
        const tons = e && img && img.naturalWidth > 0 ? tonsDaImagem(e.imagemId, img) : null;
        if (e && tons) {
          const padroes = tons.map((c) => ctx.createPattern(c, e.modo === 'corrida' ? 'repeat' : 'no-repeat')).filter((x): x is CanvasPattern => x !== null);
          if (padroes.length === TONS_DA_ESTAMPA) {
            const w = tons[0]!.width;
            const h = tons[0]!.height;
            const s = e.larguraMm / w;
            estampas.set(p.chave, {
              padroes,
              imagemParaFace: e.modo === 'corrida' ? [s, 0, 0, -s, 0, 0] : [s, 0, 0, -s, (-s * w) / 2, e.alturaMm + (s * h) / 2],
            });
          }
        }
        const base = {
          chave: p.chave,
          primeiroTriangulo: p.primeiroTriangulo,
          quantidade: p.malha.triangulos.length / 3,
          cor: corRgb(desenhoDaFicha ? corNaVariante(config.cor, desenhoDaFicha, variante, COR_DE_PARTIDA) : config.cor),
          espelhada: inst.espelhada,
          inicio: p.inicio,
          camada: config.posicao === 'sobre-outra-peca' ? 1 : 0,
        };
        const uv = estampas.has(p.chave) ? m.uvs.get(p.chave) : undefined;
        pecas.push(uv ? { ...base, uv } : base);
      }
      const tecido: TecidoParaDesenhar = {
        x: m.sim.x,
        triangulos: m.sim.triangulos,
        pecas,
        botoes: m.botoes,
        ...(modo === 'tensao' ? { tensoes: tensoes(m.sim) } : {}),
        ...(montagem.tecido.brilho ? { brilho: montagem.tecido.brilho } : {}),
        ...(montagem.tecido.transparencia ? { transparencia: montagem.tecido.transparencia } : {}),
        ziperes: montagem.costuras
          .filter((c) => c.ziperMm)
          .map((c) => ({ pontos: m.sim.cadeiasDasCosturas.find((x) => x.id === c.id)?.pontos ?? new Uint32Array(0), comprimentoMm: c.ziperMm! })),
      };
      desenharSombraNoChao(ctx, proj);
      desenharCena(ctx, montarCena(proj, m.malhaDoCorpo, tecido), estampas);
      // O desenho no corpo, por cima: o contorno vermelho, fechado com três pontos ou mais, e os pontos.
      const naTela = pontosDoDesenho.map((p) => proj.projetar(p.x, p.y, p.z)).filter((p): p is NonNullable<typeof p> => p !== null);
      if (naTela.length > 0) {
        ctx.strokeStyle = '#d32f2f';
        ctx.fillStyle = '#d32f2f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        naTela.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
        if (naTela.length >= 3) ctx.closePath();
        ctx.stroke();
        for (const p of naTela) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      return true;
    },
    [obterMontada, montagem.pecas, montagem.costuras, montagem.tecido.brilho, montagem.tecido.transparencia, instancias, imagensProntas, modo, tonsDaImagem, pontosDoDesenho, varianteAtual, desenhoDaFicha],
  );

  const desenhar = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(200, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    desenharEm(canvas, camera, null);
  }, [desenharEm, camera]);

  useEffect(() => {
    desenhar();
  }, [desenhar]);

  // A simulação: alguns passos de cada vez (até 14 ms), por um relógio próprio — o desenho espera a tela (que o
  // sistema pausa com a janela coberta), a física não —, e para quando o tecido assenta.
  useEffect(() => {
    if (!simulando) return;
    let parado = false;
    let relogio: ReturnType<typeof setTimeout> | undefined;
    let quadro = 0;
    const pedirDesenho = (): void => {
      if (quadro === 0) {
        quadro = requestAnimationFrame(() => {
          quadro = 0;
          desenhar();
        });
      }
    };
    const passo = (): void => {
      if (parado) return;
      const { sim } = obterMontada();
      const inicio = performance.now();
      do avancar(sim, 1 / 60, 8);
      while (performance.now() - inicio < 14 && !assentou(sim) && sim.tempo < TEMPO_MAXIMO_S);
      const fim = assentou(sim) || sim.tempo >= TEMPO_MAXIMO_S;
      if (fim) desenhar();
      else pedirDesenho();
      if (fim) {
        const t = tensoes(sim);
        let maxima = 0;
        let soma = 0;
        for (const v of t) {
          maxima = Math.max(maxima, v);
          soma += Math.max(0, v);
        }
        const alturas = alturasDoTecido(sim);
        setEstado({
          fase: assentou(sim) ? 'assentou' : 'parado',
          tempo: sim.tempo,
          abertura: aberturaDasCosturas(sim),
          penetracao: maiorPenetracao(sim),
          tensaoMaxima: maxima,
          tensaoMedia: t.length > 0 ? soma / t.length : 0,
          alturas: { de: alturas.de, ate: alturas.ate },
          caidas: alturas.caidas.map((chave) => instancias.find((i) => i.chave === chave)?.nome ?? chave),
        });
        setSimulando(false);
        return;
      }
      setEstado({ fase: sim.tempo < TEMPO_DA_COSTURA_S ? 'costurando' : 'caindo', tempo: sim.tempo });
      relogio = setTimeout(passo, 0);
    };
    relogio = setTimeout(passo, 0);
    return () => {
      parado = true;
      clearTimeout(relogio);
      cancelAnimationFrame(quadro);
    };
  }, [simulando, obterMontada, desenhar, instancias]);

  const recomecar = (): void => {
    montadaRef.current = null;
    setSimulando(false);
    setEstado({ fase: 'arrumado', tempo: 0 });
    desenhar();
  };

  const mudarPeca = (chave: string, mudanca: Partial<ConfiguracaoDaInstancia>): void =>
    setMontagem((m) => ({ ...m, pecas: { ...m.pecas, [chave]: { ...m.pecas[chave]!, ...mudanca } } }));

  /** A cartela (ADR 0152): a vista de agora na cor original e em cada variante, lado a lado, com o nome. */
  const salvarCartela = async (): Promise<void> => {
    const cores: ReadonlyArray<readonly [string, VarianteDeCor | null]> = [['Original', null], ...variantesDeCor.map((v) => [v.nome, v] as const)];
    const largura = 600 * fatorDaImagem;
    const altura = 900 * fatorDaImagem;
    const canvas = document.createElement('canvas');
    canvas.width = largura * cores.length;
    canvas.height = altura + 60 * fatorDaImagem;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setMensagem('Não foi possível gerar a imagem neste computador.');
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    cores.forEach(([nome, variante], i) => {
      const parte = document.createElement('canvas');
      parte.width = largura;
      parte.height = altura;
      desenharEm(parte, camera, '#ffffff', variante);
      ctx.drawImage(parte, i * largura, 0);
      ctx.fillStyle = '#1f2933';
      ctx.font = `600 ${22 * fatorDaImagem}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(nome, i * largura + largura / 2, altura + 38 * fatorDaImagem);
    });
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) {
      setMensagem('Não foi possível gerar a imagem neste computador.');
      return;
    }
    const caminho = await props.onSalvarArquivo(`provador-3d-${props.nomeDoModelo.replace(/[^A-Za-z0-9._-]+/g, '-')}-cartela.png`, await blob.arrayBuffer());
    setMensagem(caminho ? `Cartela salva em ${caminho}` : null);
  };

  const salvarImagem = async (todas: boolean): Promise<void> => {
    // A resolução pedida (ADR 0139): 600 × 900 por vista, vezes o fator.
    const largura = 600 * fatorDaImagem;
    const altura = 900 * fatorDaImagem;
    const canvas = document.createElement('canvas');
    canvas.width = todas ? largura * VISTAS.length : largura * 1.2;
    canvas.height = altura + 60 * fatorDaImagem;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setMensagem('Não foi possível gerar a imagem neste computador.');
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vistas = todas ? VISTAS : [['Esta vista', camera.guinada] as const];
    vistas.forEach(([nome, guinada], i) => {
      const parte = document.createElement('canvas');
      parte.width = todas ? largura : canvas.width;
      parte.height = altura;
      desenharEm(parte, { ...camera, guinada, ...(todas ? { arfagem: 0.08, distancia: cameraDeFrente(montagem.manequim.medidas.alturaCm * 10).distancia } : {}) }, '#ffffff');
      ctx.drawImage(parte, i * parte.width, 0);
      ctx.fillStyle = '#1f2933';
      ctx.font = `600 ${22 * fatorDaImagem}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(todas ? nome : props.nomeDoModelo, i * parte.width + parte.width / 2, altura + 38 * fatorDaImagem);
    });
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) {
      setMensagem('Não foi possível gerar a imagem neste computador.');
      return;
    }
    const nome = `provador-3d-${props.nomeDoModelo.replace(/[^A-Za-z0-9._-]+/g, '-')}${todas ? '-frente-lado-costas' : ''}.png`;
    const caminho = await props.onSalvarArquivo(nome, await blob.arrayBuffer());
    if (caminho) setMensagem(`Imagem salva em ${caminho}`);
  };

  /**
   * O giro em vídeo (ADR 0139): uma volta inteira do manequim, quadro a quadro, num desenho à parte, gravado pelo
   * gravador de vídeo do navegador (WebM). A vista da janela não muda.
   */
  const gravarGiro = async (): Promise<void> => {
    if (typeof MediaRecorder === 'undefined') {
      setMensagem('Este computador não grava vídeo (falta o gravador do navegador).');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 900;
    const fluxo = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(30);
    if (!fluxo) {
      setMensagem('Este computador não grava vídeo do desenho.');
      return;
    }
    const tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
    const gravador = new MediaRecorder(fluxo, { mimeType: tipo });
    const pedacos: Blob[] = [];
    gravador.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    const parou = new Promise<void>((r) => {
      gravador.onstop = () => r();
    });
    setGravandoGiro(true);
    setMensagem('Gravando o giro…');
    gravador.start();
    for (const guinada of guinadasDoGiro(camera.guinada, 90)) {
      desenharEm(canvas, { ...camera, guinada }, '#ffffff');
      await new Promise((r) => setTimeout(r, 1000 / 30));
    }
    gravador.stop();
    await parou;
    setGravandoGiro(false);
    const blob = new Blob(pedacos, { type: 'video/webm' });
    const nome = `provador-3d-${props.nomeDoModelo.replace(/[^A-Za-z0-9._-]+/g, '-')}-giro.webm`;
    const caminho = await props.onSalvarArquivo(nome, await blob.arrayBuffer());
    setMensagem(caminho ? `Vídeo do giro salvo em ${caminho}` : null);
  };

  const colocadas = instancias.filter((i) => montagem.pecas[i.chave]?.posicao !== 'fora');
  const statusDaSimulacao = (): string => {
    switch (estado.fase) {
      case 'arrumado':
        return colocadas.length === 0 ? 'Nenhuma peça no corpo: escolha onde vai cada uma (aba Peças).' : `${colocadas.length} peça(s) em volta do corpo, ${montagem.costuras.length} costura(s). Clique em Simular.`;
      case 'costurando':
        return `Costurando… ${numeroComVirgula(estado.tempo, 1)} s`;
      case 'caindo':
        return `Caindo pelo peso… ${numeroComVirgula(estado.tempo, 1)} s`;
      case 'assentou':
      case 'parado':
        return `${estado.fase === 'assentou' ? 'Assentou' : 'Parou'} em ${numeroComVirgula(estado.tempo, 1)} s. Costuras: a maior abertura é de ${numeroComVirgula(estado.abertura ?? 0, 0)} mm. Tensão: até ${pct(Math.max(0, estado.tensaoMaxima ?? 0))} (média ${pct(estado.tensaoMedia ?? 0)}). A roupa vai de ${numeroComVirgula((estado.alturas?.de ?? 0) / 10, 0)} a ${numeroComVirgula((estado.alturas?.ate ?? 0) / 10, 0)} cm do chão.`;
    }
  };

  return (
    <Sobreposicao titulo="Provador 3D" onFechar={fechar}>
      <div className="painel-do-provador">
        <div className="vista-do-provador">
          <div className="barra-do-provador" role="toolbar" aria-label="Simulação">
            <button type="button" className="botao-primario" disabled={colocadas.length === 0} onClick={() => setSimulando((s) => !s)}>
              {simulando ? 'Parar' : estado.fase === 'arrumado' ? 'Simular' : 'Continuar'}
            </button>
            <button type="button" onClick={recomecar}>
              Recomeçar
            </button>
            <span className="separador-do-provador" />
            {VISTAS.map(([nome, guinada]) => (
              <button key={nome} type="button" onClick={() => setCamera((c) => ({ ...c, guinada }))}>
                {nome}
              </button>
            ))}
            <label className="opcao-do-provador">
              <input type="checkbox" checked={modo === 'tensao'} onChange={(e) => setModo(e.target.checked ? 'tensao' : 'cor')} />
              Mapa de tensão
            </label>
          </div>
          <canvas
            ref={canvasRef}
            className="canvas-do-provador"
            aria-label="O manequim com as peças em 3D (arraste para girar, a roda aproxima)"
            onPointerDown={(e) => {
              if (aba === 'desenho') {
                // Desenhando no corpo: o clique põe um ponto no tronco (não gira a vista).
                const canvas = e.currentTarget;
                const r = canvas.getBoundingClientRect();
                const m = obterMontada();
                const proj = projecao(camera, canvas.width, canvas.height, m.corpo.alturaMm);
                const p = pontoDoCorpoNaTela(proj, m.malhaDoCorpo, ((e.clientX - r.left) * canvas.width) / Math.max(1, r.width), ((e.clientY - r.top) * canvas.height) / Math.max(1, r.height));
                if (!p || !pontoNoTronco(m.corpo, p)) {
                  setMensagem('Clique no tronco do manequim (não na cabeça, nos braços ou nas pernas). Para girar, saia da aba "Desenhar no corpo".');
                  return;
                }
                setMensagem(null);
                setPontosDoDesenho((lista) => [...lista, p]);
                return;
              }
              arrastoRef.current = { x: e.clientX, y: e.clientY, camera };
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              const a = arrastoRef.current;
              if (!a) return;
              setCamera({ ...a.camera, guinada: a.camera.guinada - (e.clientX - a.x) * 0.01, arfagem: Math.max(-1.2, Math.min(1.2, a.camera.arfagem + (e.clientY - a.y) * 0.01)) });
            }}
            onPointerUp={() => {
              arrastoRef.current = null;
            }}
            onWheel={(e) => setCamera((c) => ({ ...c, distancia: Math.max(600, Math.min(12000, c.distancia * (e.deltaY > 0 ? 1.1 : 1 / 1.1))) }))}
          />
          <p className={`status-do-provador status-${estado.fase}`} role="status">
            {statusDaSimulacao()}
          </p>
          {(estado.caidas?.length ?? 0) > 0 && (
            <p className="faixa-de-erro-do-provador" role="alert">
              {estado.caidas!.join(', ')} escorregou do corpo (o alto ficou abaixo do gancho): a volta de cima é maior que o corpo, falta uma costura, ou a peça está de cabeça para baixo
              (Peças › Girar 90°, duas vezes).
            </p>
          )}
          {(estado.penetracao ?? 0) > 5 && (
            <p className="faixa-do-custo-parcial">O tecido entra no corpo em até {numeroComVirgula(estado.penetracao ?? 0, 0)} mm: a peça pode estar pequena para o manequim, ou falta uma costura.</p>
          )}
          {modo === 'tensao' && (
            <p className="legenda-da-tensao">
              {[0, 0.04, 0.08].map((v) => (
                <span key={v} style={{ background: `rgb(${corDaTensao(v).join(',')})` }}>
                  {v === 0 ? 'folgado / no molde' : v === 0.04 ? 'esticando (4%)' : 'repuxando (8% ou mais)'}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="controles-do-provador">
          {tamanhosDoMolde.length > 1 && (
            <label>
              Tamanho das peças
              <select value={tamanhoDasPecas} onChange={(e) => setTamanhoDasPecas(e.target.value)}>
                <option value="">O do molde</option>
                {tamanhosDoMolde.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes do provador">
            {(
              [
                ['pecas', `Peças (${colocadas.length}/${instancias.length})`],
                ['costuras', `Costuras (${montagem.costuras.length})`],
                ['manequim', 'Manequim'],
                ['tecido', 'Tecido'],
                ['imagem', 'Imagem'],
                ['desenho', 'Desenhar no corpo'],
              ] as const
            ).map(([id, rotulo]) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'item-selecionado' : undefined} onClick={() => setAba(id)}>
                {rotulo}
              </button>
            ))}
          </div>
          {mensagem && (
            <p className="nota-do-formulario" role="alert">
              {mensagem}
            </p>
          )}
          {aba === 'pecas' && <PartePecas instancias={instancias} montagem={montagem} imagens={props.imagens} onMudar={mudarPeca} onTrocar={(chave, config) => setMontagem((m) => ({ ...m, pecas: { ...m.pecas, [chave]: config } }))} />}
          {aba === 'costuras' && (
            <ParteCosturas
              instancias={instancias}
              montagem={montagem}
              onMudar={(costuras) => setMontagem((m) => ({ ...m, costuras }))}
              onSugerir={() => {
                const novas = sugerirCosturas(corpoDoManequim(montagem.manequim.medidas, montagem.manequim.pose), instancias, montagem, props.novoId);
                setMensagem(novas.length > 0 ? `${novas.length} costura(s) sugerida(s): confira na lista.` : 'Nenhuma costura nova a sugerir (as que sobram se escolhem à mão).');
                if (novas.length > 0) setMontagem((m) => ({ ...m, costuras: [...m.costuras, ...novas] }));
              }}
              novoId={props.novoId}
            />
          )}
          {aba === 'manequim' && (
            <ParteManequim
              montagem={montagem}
              ficha={props.ficha}
              regras={props.regrasDeCaimento}
              onMudar={(manequim) => {
                // A pose fica quando o público ou as medidas mudam (o campo da pose a manda junto).
                setMontagem((m) => ({ ...m, manequim: { ...manequim, ...(!('pose' in manequim) && m.manequim.pose ? { pose: m.manequim.pose } : {}) } }));
                setCamera(cameraDeFrente(manequim.medidas.alturaCm * 10));
              }}
            />
          )}
          {aba === 'tecido' && (
            <ParteTecido
              tecido={montagem.tecido}
              resolucaoMm={montagem.resolucaoMm}
              autoColisao={montagem.autoColisao !== false}
              onMudar={(tecido) => setMontagem((m) => ({ ...m, tecido }))}
              onResolucao={(resolucaoMm) => setMontagem((m) => ({ ...m, resolucaoMm }))}
              onAutoColisao={(ligada) => setMontagem((m) => ({ ...m, autoColisao: ligada }))}
            />
          )}
          {aba === 'desenho' && (
            <section aria-label="Desenhar no corpo" className="secao-do-provador">
              <p className="nota-do-formulario">
                Clique no tronco do manequim, em volta da peça que você quer (de frente, de lado ou de costas — os botões de cima viram a vista). O contorno vermelho
                acompanha. "Tirar o pré-molde" desenrola o desenho: a altura fica de pé, e o caminho em volta do corpo, desde o meio da frente, fica deitado, com a
                folga pedida. O pré-molde sai colado ao corpo, para ajustar como qualquer peça.
              </p>
              <p className="resumo-do-plano">{pontosDoDesenho.length} ponto(s) no corpo.</p>
              <p className="acoes-da-fila">
                <button type="button" disabled={pontosDoDesenho.length === 0} onClick={() => setPontosDoDesenho((l) => l.slice(0, -1))}>
                  Desfazer o último ponto
                </button>
                <button type="button" disabled={pontosDoDesenho.length === 0} onClick={() => setPontosDoDesenho([])}>
                  Recomeçar o desenho
                </button>
              </p>
              <label>
                Folga (%)
                <CampoDeNumero rotulo="Folga do pré-molde" valor={folgaDoDesenho} casas={1} onMudar={(v) => v !== null && setFolgaDoDesenho(v)} />
              </label>
              <label>
                Nome da peça
                <input aria-label="Nome do pré-molde" value={nomeDoDesenho} onChange={(e) => setNomeDoDesenho(e.target.value)} />
              </label>
              <p className="acoes-da-fila">
                <button
                  type="button"
                  className="botao-primario"
                  disabled={pontosDoDesenho.length < 3 || !props.onCriarPeca}
                  onClick={() => {
                    try {
                      const peca = preMoldeDoDesenho(obterMontada().corpo, pontosDoDesenho, folgaDoDesenho, nomeDoDesenho, `pre-molde-${props.novoId()}`);
                      props.onCriarPeca?.(peca);
                      setMensagem(`“${peca.nome}” foi para o projeto, depois das peças da mesa (o desenho continua aqui).`);
                    } catch (erro) {
                      setMensagem(erro instanceof Error ? erro.message : String(erro));
                    }
                  }}
                >
                  Tirar o pré-molde
                </button>
              </p>
            </section>
          )}
          {aba === 'imagem' && (
            <section aria-label="Imagem" className="secao-do-provador">
              <p className="nota-do-formulario">A imagem do provador para o catálogo e a aprovação (PNG, fundo branco). Simule antes, para a peça já estar caída.</p>
              <label>
                Resolução
                <select aria-label="Resolução da imagem" value={fatorDaImagem} onChange={(e) => setFatorDaImagem(Number(e.target.value))}>
                  <option value={1}>Normal (600 × 900 por vista)</option>
                  <option value={2}>Alta (1200 × 1800)</option>
                  <option value={4}>Muito alta (2400 × 3600)</option>
                </select>
              </label>
              {variantesDeCor.length > 0 && (
                <label>
                  Cor do modelo
                  <select aria-label="Cor do modelo" value={varianteId} onChange={(e) => setVarianteId(e.target.value)}>
                    <option value="">Original</option>
                    {variantesDeCor.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="acoes-da-fila">
                <button type="button" onClick={() => void salvarImagem(false)}>
                  Salvar esta vista (PNG)
                </button>
                <button type="button" onClick={() => void salvarImagem(true)}>
                  Salvar frente, lado e costas (PNG)
                </button>
                <button type="button" disabled={gravandoGiro} onClick={() => void gravarGiro()}>
                  {gravandoGiro ? 'Gravando o giro…' : 'Gravar o giro (vídeo WebM)'}
                </button>
                {variantesDeCor.length > 0 && (
                  <button type="button" onClick={() => void salvarCartela()}>
                    Salvar a cartela de cores (PNG)
                  </button>
                )}
              </p>
            </section>
          )}
        </div>
      </div>
    </Sobreposicao>
  );
}

// ---- Peças

function PartePecas(props: {
  readonly instancias: readonly InstanciaDaPeca[];
  readonly montagem: Montagem3D;
  readonly imagens: readonly ImagemDoModelo[];
  readonly onMudar: (chave: string, mudanca: Partial<ConfiguracaoDaInstancia>) => void;
  readonly onTrocar: (chave: string, config: ConfiguracaoDaInstancia) => void;
}): React.JSX.Element {
  if (props.instancias.length === 0) return <p className="nota-do-formulario">O projeto não tem peças.</p>;
  return (
    <section aria-label="Peças" className="secao-do-provador lista-de-pecas-3d">
      <p className="nota-do-formulario">
        Cada peça vai a um lugar do corpo; a figura mostra como ela fica, com o alto em cima. O alto vem da forma (a ponta estreita em cima; na perna, a larga; na manga, a cabeça) — confira e gire se
        precisar. A segunda de um par (a manga esquerda) já sai espelhada.
      </p>
      {props.instancias.map((inst) => {
        const c = props.montagem.pecas[inst.chave]!;
        const fora = c.posicao === 'fora';
        const sobre = c.posicao === 'sobre-outra-peca';
        // As peças que podem ficar embaixo (as que vão ao corpo, sem ser elas mesmas de cima).
        const deBaixo = props.instancias.filter((i) => i.chave !== inst.chave && !['fora', 'sobre-outra-peca'].includes(props.montagem.pecas[i.chave]!.posicao));
        return (
          <div key={inst.chave} className={`cartao-da-peca-3d ${fora ? 'peca-fora' : ''}`}>
            <div className="titulo-da-peca-3d">
              <input type="color" aria-label={`Cor de ${inst.nome}`} value={c.cor} onChange={(e) => props.onMudar(inst.chave, { cor: e.target.value })} />
              <strong>{inst.nome}</strong>
              {!fora && <MiniaturaDaFace instancia={inst} girarGraus={c.girarGraus} cor={c.cor} />}
            </div>
            <div className="campos-da-peca-3d">
              <label>
                Onde vai
                <select
                  aria-label={`Onde vai ${inst.nome}`}
                  value={c.posicao}
                  onChange={(e) => {
                    // A posição nova pode pedir a outra ponta em cima (na perna, a larga): o alto é refeito pela forma.
                    const posicao = e.target.value as PosicaoNoCorpo;
                    if (posicao === 'sobre-outra-peca') {
                      // Sobre a frente que houver (ou a primeira no corpo), um pouco abaixo do alto, com a boca em cima.
                      const alvo = deBaixo.find((i) => props.montagem.pecas[i.chave]!.posicao === 'frente') ?? deBaixo[0];
                      const corDeBaixo = alvo ? props.montagem.pecas[alvo.chave]!.cor : null;
                      props.onMudar(inst.chave, {
                        posicao,
                        ...(alvo && !c.sobre ? { sobre: { chave: alvo.chave, doAltoMm: 60, doMeioMm: 0, bocaEmCima: true } } : {}),
                        // Na mesma cor da de baixo, o bolso sumiria nela: um tom mais escuro.
                        ...(corDeBaixo && corDeBaixo.toLowerCase() === c.cor.toLowerCase() ? { cor: corMaisEscura(c.cor) } : {}),
                      });
                    } else props.onMudar(inst.chave, posicao === 'fora' ? { posicao } : { posicao, girarGraus: giroPelaForma(inst, c.girarGraus, posicao) });
                  }}
                >
                  {(Object.keys(ROTULO_DA_POSICAO) as PosicaoNoCorpo[]).map((p) => (
                    <option key={p} value={p}>
                      {ROTULO_DA_POSICAO[p]}
                    </option>
                  ))}
                </select>
              </label>
              {sobre && (
                <>
                  <label>
                    Sobre
                    <select
                      aria-label={`Sobre que peça vai ${inst.nome}`}
                      value={c.sobre?.chave ?? ''}
                      onChange={(e) => props.onMudar(inst.chave, { sobre: { doAltoMm: 60, doMeioMm: 0, bocaEmCima: true, ...c.sobre, chave: e.target.value } })}
                    >
                      {!c.sobre && <option value="">Escolha a peça de baixo</option>}
                      {deBaixo.map((i) => (
                        <option key={i.chave} value={i.chave}>
                          {i.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  {c.sobre && (
                    <>
                      <label>
                        Do alto dela (mm)
                        <input
                          type="number"
                          step={10}
                          aria-label={`Distância do alto de ${inst.nome}`}
                          value={c.sobre.doAltoMm}
                          onChange={(e) => props.onMudar(inst.chave, { sobre: { ...c.sobre!, doAltoMm: Number(e.target.value) || 0 } })}
                        />
                      </label>
                      <label>
                        Do meio dela (mm)
                        <input
                          type="number"
                          step={10}
                          aria-label={`Distância do meio de ${inst.nome}`}
                          value={c.sobre.doMeioMm}
                          onChange={(e) => props.onMudar(inst.chave, { sobre: { ...c.sobre!, doMeioMm: Number(e.target.value) || 0 } })}
                        />
                      </label>
                      <label className="opcao-em-linha">
                        <input type="checkbox" checked={c.sobre.bocaEmCima} onChange={(e) => props.onMudar(inst.chave, { sobre: { ...c.sobre!, bocaEmCima: e.target.checked } })} />
                        A boca em cima (o bolso; sem ela, costurada em volta toda)
                      </label>
                    </>
                  )}
                  {deBaixo.length === 0 && <p className="nota-do-formulario">Ponha antes a peça de baixo no corpo (a frente, as costas).</p>}
                </>
              )}
              {!fora && !sobre && (
                <>
                  <label>
                    O topo
                    <select aria-label={`Topo de ${inst.nome}`} value={c.alturaDoTopo} onChange={(e) => props.onMudar(inst.chave, { alturaDoTopo: e.target.value as AlturaDoTopo })}>
                      {(Object.keys(ROTULO_DA_ALTURA) as AlturaDoTopo[]).map((a) => (
                        <option key={a} value={a}>
                          {ROTULO_DA_ALTURA[a]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sobe (mm)
                    <input type="number" step={10} aria-label={`Sobe ${inst.nome}`} value={c.ajusteMm} onChange={(e) => props.onMudar(inst.chave, { ajusteMm: Number(e.target.value) || 0 })} />
                  </label>
                  <label>
                    Para o lado (mm)
                    <input type="number" step={10} aria-label={`Para o lado ${inst.nome}`} value={c.desvioMm} onChange={(e) => props.onMudar(inst.chave, { desvioMm: Number(e.target.value) || 0 })} />
                  </label>
                  <div className="giro-da-peca" role="group" aria-label={`Giro de ${inst.nome}`}>
                    <span>Giro</span>
                    <button type="button" aria-label={`Girar ${inst.nome} 15° para a esquerda`} title="Girar 15° no sentido anti-horário" onClick={() => props.onMudar(inst.chave, { girarGraus: normalizarGiro(c.girarGraus + 15) })}>
                      ↺ 15°
                    </button>
                    <input
                      type="number"
                      step={5}
                      aria-label={`Giro de ${inst.nome} (graus)`}
                      value={c.girarGraus}
                      onChange={(e) => props.onMudar(inst.chave, { girarGraus: normalizarGiro(Number(e.target.value) || 0) })}
                    />
                    <button type="button" aria-label={`Girar ${inst.nome} 15° para a direita`} title="Girar 15° no sentido horário" onClick={() => props.onMudar(inst.chave, { girarGraus: normalizarGiro(c.girarGraus - 15) })}>
                      ↻ 15°
                    </button>
                    <button type="button" aria-label={`Virar ${inst.nome}`} onClick={() => props.onMudar(inst.chave, { girarGraus: normalizarGiro(c.girarGraus + 180) })}>
                      Virar 180°
                    </button>
                    <button type="button" aria-label={`Endireitar ${inst.nome} pela forma`} title="O alto pela forma da peça" onClick={() => props.onMudar(inst.chave, { girarGraus: giroPelaForma(inst, 0, c.posicao) })}>
                      Pela forma
                    </button>
                  </div>
                  <label>
                    Estampa
                    <select
                      aria-label={`Estampa de ${inst.nome}`}
                      value={c.estampa?.imagemId ?? ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id === '') {
                          const sem: { -readonly [K in keyof ConfiguracaoDaInstancia]?: ConfiguracaoDaInstancia[K] } = { ...c };
                          delete sem.estampa;
                          props.onTrocar(inst.chave, sem as ConfiguracaoDaInstancia);
                        } else props.onMudar(inst.chave, { estampa: { imagemId: id, modo: c.estampa?.modo ?? 'corrida', larguraMm: c.estampa?.larguraMm ?? 120, alturaMm: c.estampa?.alturaMm ?? 0 } });
                      }}
                    >
                      <option value="">Sem estampa (lisa)</option>
                      {props.imagens.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  {c.estampa && (
                    <>
                      <label>
                        Como
                        <select aria-label={`Como vai a estampa de ${inst.nome}`} value={c.estampa.modo} onChange={(e) => props.onMudar(inst.chave, { estampa: { ...c.estampa!, modo: e.target.value === 'localizada' ? 'localizada' : 'corrida' } })}>
                          <option value="corrida">Corrida (repete)</option>
                          <option value="localizada">Localizada (uma vez)</option>
                        </select>
                      </label>
                      <label>
                        Largura (mm)
                        <CampoDeNumero rotulo={`Largura da estampa de ${inst.nome}`} valor={c.estampa.larguraMm} casas={0} onMudar={(v) => v !== null && v >= 5 && props.onMudar(inst.chave, { estampa: { ...c.estampa!, larguraMm: v } })} />
                      </label>
                      {c.estampa.modo === 'localizada' && (
                        <label>
                          Sobe (mm)
                          <input
                            type="number"
                            step={10}
                            aria-label={`Altura da estampa de ${inst.nome}`}
                            value={c.estampa.alturaMm}
                            onChange={(e) => props.onMudar(inst.chave, { estampa: { ...c.estampa!, alturaMm: Number(e.target.value) || 0 } })}
                          />
                        </label>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      {props.imagens.length === 0 && <p className="nota-do-formulario">As estampas vêm das imagens do modelo (Modelo › Imagens).</p>}
    </section>
  );
}

/** A peça como vai no corpo, pequena: vista pela face, com o giro, e a seta do alto. */
function MiniaturaDaFace(props: { readonly instancia: InstanciaDaPeca; readonly girarGraus: number; readonly cor: string }): React.JSX.Element {
  const c = props.instancia.contorno;
  const face = coordenadasDaFace(props.instancia, props.girarGraus, Float64Array.from(c.flatMap((p) => [p.x, p.y])));
  const lado = 56;
  const escala = (lado - 8) / Math.max(face.largura, face.altura, 1);
  const pontos = Array.from(face.u, (u, i) => `${(lado / 2 + u * escala).toFixed(1)},${(lado / 2 + 4 - face.v[i]! * escala).toFixed(1)}`).join(' ');
  return (
    <svg className="miniatura-da-face" width={lado} height={lado + 6} role="img" aria-label={`${props.instancia.nome} no corpo, com o alto em cima`}>
      <path d={`M${lado / 2 - 5},7 L${lado / 2},1 L${lado / 2 + 5},7`} fill="none" stroke="#d9480f" strokeWidth={1.8} />
      <polygon points={pontos} fill={props.cor} fillOpacity={0.35} stroke={props.cor} strokeWidth={1.2} />
    </svg>
  );
}

// ---- Costuras

/** O contorno pequeno de uma peça, com os pontos para clicar e o trecho escolhido em destaque. */
function ContornoParaCostura(props: { readonly instancia: InstanciaDaPeca; readonly de: number | null; readonly ate: number | null; readonly onPonto: (i: number) => void; readonly rotulo: string }): React.JSX.Element {
  const c = props.instancia.contorno;
  // Como na tela: o y do mundo para a direita, o x para baixo.
  const xs = c.map((p) => p.y);
  const ys = c.map((p) => p.x);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const largura = Math.max(...xs) - minX || 1;
  const altura = Math.max(...ys) - minY || 1;
  const escala = Math.min(220 / largura, 220 / altura);
  const p = (i: number): [number, number] => [10 + (xs[i]! - minX) * escala, 10 + (ys[i]! - minY) * escala];
  const cantos = new Set(ladosDoContorno(c).map((l) => l.de));
  const trecho: [number, number][] = [];
  if (props.de !== null && props.ate !== null && props.de !== props.ate) for (let i = props.de; ; i = (i + 1) % c.length) {
    trecho.push(p(i));
    if (i === props.ate) break;
  }
  return (
    <svg className="contorno-para-costura" width={largura * escala + 20} height={altura * escala + 20} role="img" aria-label={props.rotulo}>
      <polygon points={c.map((_, i) => p(i).join(',')).join(' ')} fill="#eef3fa" stroke="#56606c" strokeWidth={1} />
      {trecho.length > 1 && <polyline points={trecho.map((q) => q.join(',')).join(' ')} fill="none" stroke="#d9480f" strokeWidth={4} strokeLinecap="round" />}
      {c.map((_, i) => {
        const [x, y] = p(i);
        const escolhido = i === props.de || i === props.ate;
        return (
          <g key={i} className="ponto-para-costura" onClick={() => props.onPonto(i)}>
            <title>Ponto {i}</title>
            <circle cx={x} cy={y} r={escolhido ? 6 : cantos.has(i) ? 4.5 : 3} fill={escolhido ? '#d9480f' : cantos.has(i) ? '#1b3866' : '#7f8894'} />
            {(cantos.has(i) || escolhido) && (
              <text x={x + 7} y={y - 5} fontSize={11} fill="#1d2128">
                {i}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ParteCosturas(props: {
  readonly instancias: readonly InstanciaDaPeca[];
  readonly montagem: Montagem3D;
  readonly onMudar: (c: Costura3D[]) => void;
  readonly onSugerir: () => void;
  readonly novoId: () => string;
}): React.JSX.Element {
  const colocadas = props.instancias.filter((i) => props.montagem.pecas[i.chave]?.posicao !== 'fora');
  const [lados, setLados] = useState<{ chave: string; de: number | null; ate: number | null }[]>(() => [
    { chave: colocadas[0]?.chave ?? '', de: null, ate: null },
    { chave: colocadas[1]?.chave ?? colocadas[0]?.chave ?? '', de: null, ate: null },
  ]);
  const nome = (chave: string): string => props.instancias.find((i) => i.chave === chave)?.nome ?? 'peça que não existe mais';
  const comprimento = (chave: string, de: number, ate: number): number => {
    const inst = props.instancias.find((i) => i.chave === chave);
    return inst && de < inst.contorno.length && ate < inst.contorno.length ? comprimentoDoTrecho(inst.contorno, de, ate) : 0;
  };
  const mudarLado = (k: 0 | 1, mudanca: Partial<{ chave: string; de: number | null; ate: number | null }>): void => setLados((l) => l.map((x, i) => (i === k ? { ...x, ...mudanca } : x)));
  const clicarPonto = (k: 0 | 1, ponto: number): void => {
    const l = lados[k]!;
    if (l.de === null || l.ate !== null) mudarLado(k, { de: ponto, ate: null });
    else if (ponto !== l.de) mudarLado(k, { ate: ponto });
  };
  const pronto = lados.every((l) => l.chave !== '' && l.de !== null && l.ate !== null && l.de !== l.ate);
  const costurar = (): void => {
    if (!pronto) return;
    const [a, b] = lados as [{ chave: string; de: number; ate: number }, { chave: string; de: number; ate: number }];
    const ia = props.instancias.find((i) => i.chave === a.chave)!;
    const ib = props.instancias.find((i) => i.chave === b.chave)!;
    const corpo = corpoDoManequim(props.montagem.manequim.medidas, props.montagem.manequim.pose);
    const invertida = sentidoSugerido(corpo, { inst: ia, config: props.montagem.pecas[a.chave]!, de: a.de, ate: a.ate }, { inst: ib, config: props.montagem.pecas[b.chave]!, de: b.de, ate: b.ate });
    props.onMudar([...props.montagem.costuras, { id: props.novoId(), a: { chave: a.chave, de: a.de, ate: a.ate, assinatura: ia.assinatura }, b: { chave: b.chave, de: b.de, ate: b.ate, assinatura: ib.assinatura }, invertida }]);
    setLados((l) => l.map((x) => ({ ...x, de: null, ate: null })));
  };
  return (
    <section aria-label="Costuras" className="secao-do-provador">
      <p className="acoes-da-fila">
        <button type="button" onClick={props.onSugerir} disabled={colocadas.length === 0}>
          Sugerir costuras
        </button>
        <span className="nota-do-formulario">As que a arrumação junta (as laterais, embaixo do braço) e os ombros. A cava, a gola e o resto, escolha abaixo.</span>
      </p>
      {props.montagem.costuras.length === 0 ? (
        <p className="nota-do-formulario">Nenhuma costura: as peças caem soltas.</p>
      ) : (
        <ol className="lista-de-costuras">
          {props.montagem.costuras.map((c) => {
            const problemas = problemasDaCostura(c, props.instancias);
            return (
              <li key={c.id} className={problemas.length > 0 ? 'costura-com-problema' : undefined}>
                <span>
                  <strong>{nome(c.a.chave)}</strong> {c.a.de}→{c.a.ate} ({numeroComVirgula(comprimento(c.a.chave, c.a.de, c.a.ate), 0)} mm) com <strong>{nome(c.b.chave)}</strong> {c.b.de}→{c.b.ate} (
                  {numeroComVirgula(comprimento(c.b.chave, c.b.de, c.b.ate), 0)} mm){c.invertida ? ', no sentido contrário' : ''}
                </span>
                <button type="button" onClick={() => props.onMudar(props.montagem.costuras.map((x) => (x.id === c.id ? { ...x, invertida: !x.invertida } : x)))}>
                  Inverter
                </button>
                <label className="ziper-da-costura">
                  Zíper (cm)
                  <CampoDeNumero
                    rotulo={`Zíper da costura ${nome(c.a.chave)} com ${nome(c.b.chave)}`}
                    valor={c.ziperMm ? c.ziperMm / 10 : null}
                    vazioPermitido
                    placeholder="sem"
                    onMudar={(v) => {
                      const resto = { ...c };
                      delete (resto as { ziperMm?: number }).ziperMm;
                      props.onMudar(props.montagem.costuras.map((x) => (x.id === c.id ? (v && v > 0 ? { ...resto, ziperMm: Math.min(2000, v * 10) } : resto) : x)));
                    }}
                  />
                </label>
                <button type="button" onClick={() => props.onMudar(props.montagem.costuras.filter((x) => x.id !== c.id))}>
                  Tirar
                </button>
                {problemas.map((p) => (
                  <small key={p}>{p}</small>
                ))}
              </li>
            );
          })}
        </ol>
      )}
      <h4>Nova costura: clique no ponto onde ela começa e no ponto onde acaba, nas duas peças</h4>
      {colocadas.length === 0 ? (
        <p className="nota-do-formulario">Ponha as peças no corpo primeiro (aba Peças).</p>
      ) : (
        <div className="nova-costura">
          {([0, 1] as const).map((k) => {
            const l = lados[k]!;
            const inst = props.instancias.find((i) => i.chave === l.chave);
            return (
              <div key={k} className="lado-da-nova-costura">
                <label>
                  {k === 0 ? 'Lado A' : 'Lado B'}
                  <select aria-label={`Peça do lado ${k === 0 ? 'A' : 'B'}`} value={l.chave} onChange={(e) => mudarLado(k, { chave: e.target.value, de: null, ate: null })}>
                    {colocadas.map((i) => (
                      <option key={i.chave} value={i.chave}>
                        {i.nome}
                      </option>
                    ))}
                  </select>
                </label>
                {inst && <ContornoParaCostura instancia={inst} de={l.de} ate={l.ate} onPonto={(p) => clicarPonto(k, p)} rotulo={`Contorno do lado ${k === 0 ? 'A' : 'B'}`} />}
                <div className="pontos-da-nova-costura">
                  <label>
                    Do ponto
                    <input type="number" min={0} aria-label={`Lado ${k === 0 ? 'A' : 'B'}: do ponto`} value={l.de ?? ''} onChange={(e) => mudarLado(k, { de: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label>
                    Até o ponto
                    <input type="number" min={0} aria-label={`Lado ${k === 0 ? 'A' : 'B'}: até o ponto`} value={l.ate ?? ''} onChange={(e) => mudarLado(k, { ate: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <small>{l.de !== null && l.ate !== null && l.de !== l.ate ? `${numeroComVirgula(comprimento(l.chave, l.de, l.ate), 0)} mm` : 'no sentido do contorno'}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p>
        <button type="button" className="botao-primario" disabled={!pronto} onClick={costurar}>
          Costurar
        </button>
      </p>
    </section>
  );
}

// ---- Manequim

function ParteManequim(props: {
  readonly montagem: Montagem3D;
  readonly ficha: FichaTecnica | null;
  readonly regras: RegrasDeCaimento;
  readonly onMudar: (m: Montagem3D['manequim']) => void;
}): React.JSX.Element {
  const { manequim } = props.montagem;
  const [daFicha, setDaFicha] = useState<readonly string[]>([]);
  const tamanhos = props.ficha && props.ficha.medidas.length > 0 ? props.ficha.tamanhos : [];
  const mudarMedida = (k: keyof MedidasDoManequim, v: number): void => {
    const [min, max] = LIMITES_DA_MEDIDA[k];
    if (v < min || v > max) return;
    props.onMudar({ publico: manequim.publico, medidas: medidasConferidas({ ...manequim.medidas, [k]: v }) });
  };
  return (
    <section aria-label="Manequim" className="secao-do-provador">
      <form className="formulario-de-sobreposicao campos-do-manequim" onSubmit={(e) => e.preventDefault()}>
        <label>
          Pose
          <select
            aria-label="Pose do manequim"
            value={manequim.pose ?? 'padrao'}
            onChange={(e) => {
              const pose = e.target.value as PoseDoManequim;
              props.onMudar({ ...manequim, pose });
            }}
          >
            {(Object.keys(ROTULO_DA_POSE) as PoseDoManequim[]).map((p) => (
              <option key={p} value={p}>
                {ROTULO_DA_POSE[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Público
          <select
            value={manequim.publico}
            onChange={(e) => {
              const publico = e.target.value as PublicoDoManequim;
              setDaFicha([]);
              props.onMudar({ publico, medidas: MEDIDAS_DO_PUBLICO[publico] });
            }}
          >
            {(Object.keys(ROTULO_DO_PUBLICO) as PublicoDoManequim[]).map((p) => (
              <option key={p} value={p}>
                {ROTULO_DO_PUBLICO[p]}
              </option>
            ))}
          </select>
        </label>
        {tamanhos.length > 0 && (
          <label>
            No tamanho da ficha
            <select
              value={manequim.tamanhoDaFicha ?? ''}
              onChange={(e) => {
                const t = e.target.value;
                if (t === '' || !props.ficha) {
                  props.onMudar({ publico: manequim.publico, medidas: manequim.medidas });
                  setDaFicha([]);
                  return;
                }
                const r = manequimDoTamanho(MEDIDAS_DO_PUBLICO[manequim.publico], props.ficha, props.regras, t);
                setDaFicha(r.daFicha);
                props.onMudar({ publico: manequim.publico, medidas: r.medidas, tamanhoDaFicha: t });
              }}
            >
              <option value="">—</option>
              {tamanhos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
        {(Object.keys(ROTULO_DA_MEDIDA_DO_MANEQUIM) as (keyof MedidasDoManequim)[]).map((k) => (
          <label key={k}>
            {ROTULO_DA_MEDIDA_DO_MANEQUIM[k]} (cm)
            <CampoDeNumero rotulo={`Manequim: ${ROTULO_DA_MEDIDA_DO_MANEQUIM[k]}`} valor={manequim.medidas[k]} casas={1} onMudar={(v) => v !== null && mudarMedida(k, v)} />
          </label>
        ))}
      </form>
      {daFicha.length > 0 && <p className="nota-do-formulario">Do tamanho {manequim.tamanhoDaFicha} da ficha (a peça menos a folga do caimento): {daFicha.join(', ')}.</p>}
      {tamanhos.length === 0 && <p className="nota-do-formulario">Com a tabela de medidas na ficha técnica, o manequim pode tomar as medidas de um tamanho.</p>}
    </section>
  );
}

// ---- Tecido

function ParteTecido(props: {
  readonly tecido: Tecido3D;
  readonly resolucaoMm: number;
  readonly autoColisao: boolean;
  readonly onMudar: (t: Tecido3D) => void;
  readonly onResolucao: (r: number) => void;
  readonly onAutoColisao: (ligada: boolean) => void;
}): React.JSX.Element {
  const t = props.tecido;
  const regua = (
    chave: 'elasticidade' | 'elasticidadeNaTrama' | 'elasticidadeNoVies' | 'rigidez' | 'atrito' | 'brilho' | 'transparencia',
    rotulo: string,
    de: string,
    ate: string,
  ): React.JSX.Element => {
    // A trama e o viés de um tecido guardado sem eles são os do fio (a mesma elasticidade em toda direção); sem brilho
    // nem transparência, fosco e opaco.
    const valor = t[chave] ?? (chave === 'brilho' || chave === 'transparencia' ? 0 : t.elasticidade);
    return (
    <label className={`regua-do-tecido${chave === 'elasticidadeNaTrama' || chave === 'elasticidadeNoVies' ? ' regua-da-direcao' : ''}`}>
      {rotulo}: {valor}
      <input type="range" min={0} max={100} aria-label={rotulo} value={valor} onChange={(e) => props.onMudar({ ...t, preset: 'personalizado', [chave]: Number(e.target.value) })} />
      <span className="pontas-da-regua">
        <small>{de}</small>
        <small>{ate}</small>
      </span>
    </label>
    );
  };
  return (
    <section aria-label="Tecido" className="secao-do-provador">
      <form className="formulario-de-sobreposicao campos-do-tecido" onSubmit={(e) => e.preventDefault()}>
        <label>
          Tecido pronto
          <select
            value={t.preset}
            onChange={(e) => {
              const p = e.target.value as PresetDeTecido;
              if (p !== 'personalizado') props.onMudar(TECIDOS_PRONTOS[p].tecido);
              else props.onMudar({ ...t, preset: 'personalizado' });
            }}
          >
            {(Object.keys(TECIDOS_PRONTOS) as Exclude<PresetDeTecido, 'personalizado'>[]).map((p) => (
              <option key={p} value={p}>
                {TECIDOS_PRONTOS[p].nome}
              </option>
            ))}
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        <label>
          Gramatura (g/m²)
          <CampoDeNumero rotulo="Gramatura" valor={t.pesoGm2} casas={0} onMudar={(v) => v !== null && v >= 20 && v <= 1000 && props.onMudar({ ...t, preset: 'personalizado', pesoGm2: v })} />
        </label>
        {regua('elasticidade', 'Elasticidade no fio', 'não estica', 'estica muito')}
        {regua('elasticidadeNaTrama', 'Na trama (atravessado)', 'não estica', 'estica muito')}
        {regua('elasticidadeNoVies', 'No viés (45°)', 'não cede', 'cede muito')}
        {regua('rigidez', 'Rigidez', 'mole (cai)', 'firme (arma)')}
        {regua('atrito', 'Atrito', 'escorrega', 'agarra')}
        {regua('brilho', 'Brilho', 'fosco (algodão)', 'brilha (cetim)')}
        {regua('transparencia', 'Transparência', 'opaco', 'deixa ver (voal)')}
        <label>
          Malha da simulação
          <select value={props.resolucaoMm} onChange={(e) => props.onResolucao(Number(e.target.value))}>
            <option value={30}>Rápida (30 mm)</option>
            <option value={20}>Normal (20 mm)</option>
            <option value={12}>Fina (12 mm, mais lenta)</option>
          </select>
        </label>
        <label className="opcao-em-linha">
          <input type="checkbox" checked={props.autoColisao} onChange={(e) => props.onAutoColisao(e.target.checked)} />
          O tecido não atravessa a si mesmo (a barra que dobra, uma peça sobre a outra; um pouco mais lento)
        </label>
      </form>
      <p className="nota-do-formulario">
        O fio de cada peça diz a direção: a malha estica mais na largura (a trama); o tecido plano quase não estica no fio nem na trama, mas cede no viés — a peça cortada no viés (girada 45°
        no fio) cai mais solta. É uma física simplificada: mostra o caimento e onde a peça repuxa, mas não substitui a peça-piloto.
      </p>
    </section>
  );
}
