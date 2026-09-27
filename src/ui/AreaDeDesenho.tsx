import { useCallback, useEffect, useRef, useState } from 'react';
import { contornoDeCorte, type Molde } from '../domain/molde';
import { pontoDentroDoContorno, type Ponto2D } from '../core/geometria';
import {
  aplicarZoom,
  mundoParaTela,
  telaParaMundo,
  passoDeReguaEmMm,
  type TransformacaoDeTela,
} from './transformacaoDeTela';

const ESPESSURA_REGUA_PX = 24;
const COR_FUNDO = '#c9cdd3';
const COR_TECIDO = '#f4f5f7';
const COR_CONTORNO = '#2b2f36';
const COR_CONTORNO_SELECIONADO = '#1565c0';
const COR_FIO = '#c62828';
const COR_LINHA_DE_CORTE = '#6b7280';
const COR_PIQUE = '#8e24aa';
const COR_MARCA = '#00838f';
const COR_EM_EDICAO = '#2e7d32';
const COR_REGUA_FUNDO = '#dfe2e6';
const COR_REGUA_TRACO = '#5a6270';

export type ModoDeDesenho = 'selecionar' | 'novo-molde' | 'novo-furo' | 'definir-fio' | 'pique' | 'marca';

interface AreaDeDesenhoProps {
  readonly pecas: readonly Molde[];
  readonly selecionadoId: string | null;
  readonly transform: TransformacaoDeTela;
  readonly modo: ModoDeDesenho;
  readonly pontosEmEdicao: readonly Ponto2D[];
  readonly contornoFinalizado: readonly Ponto2D[] | null;
  readonly onTransformChange: (t: TransformacaoDeTela) => void;
  readonly onSelecionar: (id: string | null) => void;
  readonly onCursorMove: (mundo: Ponto2D | null) => void;
  readonly onCliqueNoCanvas: (mundo: Ponto2D) => void;
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
    transform,
    modo,
    pontosEmEdicao,
    contornoFinalizado,
    onTransformChange,
    onSelecionar,
    onCursorMove,
    onCliqueNoCanvas,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reguaHorizontalRef = useRef<HTMLCanvasElement | null>(null);
  const reguaVerticalRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });
  const [cursorLocal, setCursorLocal] = useState<Ponto2D | null>(null);
  const panRef = useRef<{ ativo: boolean; ultimoX: number; ultimoY: number }>({
    ativo: false,
    ultimoX: 0,
    ultimoY: 0,
  });
  const espacoPressionadoRef = useRef(false);

  useEffect(() => {
    const alvo = containerRef.current;
    if (!alvo) return;
    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[0];
      if (!entrada) return;
      setTamanho({ largura: entrada.contentRect.width, altura: entrada.contentRect.height });
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
      ctx.beginPath();
      ctx.moveTo(i.x, i.y);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();

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

    for (const peca of pecas) {
      // Contorno + furos num único path com regra evenodd: os furos aparecem
      // como buracos reais no preenchimento, não apenas linhas por cima.
      ctx.beginPath();
      traçarContorno(ctx, peca.contorno, transform);
      for (const furo of peca.furos) {
        traçarContorno(ctx, furo, transform);
      }
      ctx.fillStyle = COR_TECIDO;
      ctx.fill('evenodd');
      ctx.strokeStyle = peca.id === selecionadoId ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
      ctx.lineWidth = peca.id === selecionadoId ? 2.5 : 1.5;
      ctx.stroke();

      for (const furo of peca.furos) {
        ctx.beginPath();
        traçarContorno(ctx, furo, transform);
        ctx.strokeStyle = peca.id === selecionadoId ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
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

      desenharSeta(ctx, peca.linhaDeFio.inicio, peca.linhaDeFio.fim, COR_FIO);
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
  }, [pecas, selecionadoId, transform, tamanho, desenharSeta, pontosEmEdicao, contornoFinalizado, cursorLocal, modo]);

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

    const passoMm = passoDeReguaEmMm(transform.escalaPxPorMm);
    const mmInicial = telaParaMundo({ x: 0, y: 0 }, transform).x;
    const mmFinal = telaParaMundo({ x: tamanho.largura, y: 0 }, transform).x;
    const primeiraMarca = Math.floor(mmInicial / passoMm) * passoMm;
    for (let mm = primeiraMarca; mm <= mmFinal; mm += passoMm) {
      const x = mundoParaTela({ x: mm, y: 0 }, transform).x;
      ctx.beginPath();
      ctx.moveTo(x, ESPESSURA_REGUA_PX);
      ctx.lineTo(x, ESPESSURA_REGUA_PX - 8);
      ctx.stroke();
      ctx.fillText(String(Math.round(mm)), x + 2, 10);
    }
  }, [transform, tamanho]);

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

    const passoMm = passoDeReguaEmMm(transform.escalaPxPorMm);
    const mmInicial = telaParaMundo({ x: 0, y: 0 }, transform).y;
    const mmFinal = telaParaMundo({ x: 0, y: tamanho.altura }, transform).y;
    const primeiraMarca = Math.floor(mmInicial / passoMm) * passoMm;
    for (let mm = primeiraMarca; mm <= mmFinal; mm += passoMm) {
      const y = mundoParaTela({ x: 0, y: mm }, transform).y;
      ctx.beginPath();
      ctx.moveTo(ESPESSURA_REGUA_PX, y);
      ctx.lineTo(ESPESSURA_REGUA_PX - 8, y);
      ctx.stroke();
      ctx.save();
      ctx.translate(10, y - 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(mm)), 0, 0);
      ctx.restore();
    }
  }, [transform, tamanho]);

  function posicaoDoMouse(e: React.MouseEvent<HTMLCanvasElement>): Ponto2D {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function aoDescerMouse(e: React.MouseEvent<HTMLCanvasElement>): void {
    const podePanear = e.button === 1 || (e.button === 0 && espacoPressionadoRef.current);
    if (podePanear) {
      panRef.current = { ativo: true, ultimoX: e.clientX, ultimoY: e.clientY };
      return;
    }
    if (e.button !== 0) return;
    const tela = posicaoDoMouse(e);
    const mundo = telaParaMundo(tela, transform);

    if (modo === 'selecionar') {
      const encontrada = [...pecas].reverse().find((p) => pontoDentroDoContorno(mundo, p.contorno));
      onSelecionar(encontrada ? encontrada.id : null);
      return;
    }
    onCliqueNoCanvas(mundo);
  }

  function aoMoverMouse(e: React.MouseEvent<HTMLCanvasElement>): void {
    if (panRef.current.ativo) {
      const dx = e.clientX - panRef.current.ultimoX;
      const dy = e.clientY - panRef.current.ultimoY;
      panRef.current = { ativo: true, ultimoX: e.clientX, ultimoY: e.clientY };
      onTransformChange({
        ...transform,
        offsetXPx: transform.offsetXPx + dx,
        offsetYPx: transform.offsetYPx + dy,
      });
      return;
    }
    const tela = posicaoDoMouse(e);
    const mundo = telaParaMundo(tela, transform);
    setCursorLocal(mundo);
    onCursorMove(mundo);
  }

  function aoSoltarMouse(): void {
    panRef.current.ativo = false;
  }

  function aoSairMouse(): void {
    panRef.current.ativo = false;
    setCursorLocal(null);
    onCursorMove(null);
  }

  function aoRolarMouse(e: React.WheelEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    const tela = posicaoDoMouse(e);
    const fator = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    onTransformChange(aplicarZoom(transform, fator, tela));
  }

  return (
    <div className="area-de-desenho-grade">
      <div className="regua-canto" />
      <canvas ref={reguaHorizontalRef} className="regua-horizontal" />
      <canvas ref={reguaVerticalRef} className="regua-vertical" />
      <div ref={containerRef} className="area-de-desenho-container">
        <canvas
          ref={canvasRef}
          onMouseDown={aoDescerMouse}
          onMouseMove={aoMoverMouse}
          onMouseUp={aoSoltarMouse}
          onMouseLeave={aoSairMouse}
          onWheel={aoRolarMouse}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: modo === 'selecionar' ? 'default' : 'crosshair' }}
        />
      </div>
    </div>
  );
}
