import { useCallback, useEffect, useRef, useState } from 'react';
import type { Molde } from '../domain/molde';
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
const COR_REGUA_FUNDO = '#dfe2e6';
const COR_REGUA_TRACO = '#5a6270';

interface AreaDeDesenhoProps {
  readonly pecas: readonly Molde[];
  readonly selecionadoId: string | null;
  readonly transform: TransformacaoDeTela;
  readonly onTransformChange: (t: TransformacaoDeTela) => void;
  readonly onSelecionar: (id: string | null) => void;
  readonly onCursorMove: (mundo: Ponto2D | null) => void;
}

export function AreaDeDesenho(props: AreaDeDesenhoProps): React.JSX.Element {
  const { pecas, selecionadoId, transform, onTransformChange, onSelecionar, onCursorMove } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reguaHorizontalRef = useRef<HTMLCanvasElement | null>(null);
  const reguaVerticalRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });
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
    (ctx: CanvasRenderingContext2D, inicio: Ponto2D, fim: Ponto2D): void => {
      const i = mundoParaTela(inicio, transform);
      const f = mundoParaTela(fim, transform);
      ctx.strokeStyle = COR_FIO;
      ctx.fillStyle = COR_FIO;
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
      ctx.beginPath();
      peca.contorno.forEach((p, i) => {
        const tela = mundoParaTela(p, transform);
        if (i === 0) ctx.moveTo(tela.x, tela.y);
        else ctx.lineTo(tela.x, tela.y);
      });
      ctx.closePath();
      ctx.fillStyle = COR_TECIDO;
      ctx.fill();
      ctx.strokeStyle = peca.id === selecionadoId ? COR_CONTORNO_SELECIONADO : COR_CONTORNO;
      ctx.lineWidth = peca.id === selecionadoId ? 2.5 : 1.5;
      ctx.stroke();

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

      desenharSeta(ctx, peca.linhaDeFio.inicio, peca.linhaDeFio.fim);
    }
  }, [pecas, selecionadoId, transform, tamanho, desenharSeta]);

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
    const encontrada = [...pecas].reverse().find((p) => pontoDentroDoContorno(mundo, p.contorno));
    onSelecionar(encontrada ? encontrada.id : null);
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
    onCursorMove(telaParaMundo(tela, transform));
  }

  function aoSoltarMouse(): void {
    panRef.current.ativo = false;
  }

  function aoSairMouse(): void {
    panRef.current.ativo = false;
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
        />
      </div>
    </div>
  );
}
