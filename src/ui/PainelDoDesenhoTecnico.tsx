import { useEffect, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { CampoDeNumero } from './CampoDeNumero';
import { EixoNaFolha, ElementoNaFolha, ManequimNaFolha } from './FolhaDoDesenho';
import type { Ponto2D } from '../core/geometria';
import type { ImagemDoModelo } from '../domain/imagens';
import type { PontoDeMedida } from '../domain/fichaTecnica';
import { numeroComVirgula } from '../core/numeros';
import {
  adicionarElemento,
  ALTURA_DA_FOLHA,
  BASES,
  caminhoDoTraco,
  copiarParaAOutraVista,
  duplicarElemento,
  elementoNoPonto,
  elementosDaVista,
  espelharPonto,
  FORMAS,
  LARGURA_DA_FOLHA,
  letraDaMedida,
  medidasComCota,
  moverElemento,
  mudarElemento,
  novaCota,
  novoTraco,
  proximaMedidaSemCota,
  ordemDoElemento,
  pontoPegaElemento,
  removerElemento,
  ROTULO_DA_VISTA,
  ROTULO_DO_ESTILO,
  ROTULO_DO_MANEQUIM,
  tracosDaBase,
  tracosDaForma,
  type CotaDoDesenho,
  type DesenhoTecnico,
  type ElementoDoDesenho,
  type EstiloDoTraco,
  type Manequim,
  type TracoDoDesenho,
  type VistaDoDesenho,
} from '../domain/desenhoTecnico';
import { arrastarVista, janelaDaFolha, naGrade, passoDaGrade, VISTA_INTEIRA, ZOOM_MAXIMO, zoomNoPonto, type JanelaDaFolha, type VistaDaFolha } from './vistaDaFolha';

type Ferramenta = 'selecionar' | 'reta' | 'curva' | 'costura' | 'pesponto' | 'texto' | 'cota';

const FERRAMENTAS: ReadonlyArray<readonly [Ferramenta, string, string]> = [
  ['selecionar', 'Selecionar', 'Clique num elemento para escolher; arraste para mover; arraste um ponto do traço (ou a ponta da cota) escolhido para mudá-lo'],
  ['reta', 'Reta', 'Clique os pontos; duplo clique (ou Enter) termina'],
  ['curva', 'Curva', 'Clique os pontos por onde a curva passa; duplo clique (ou Enter) termina'],
  ['costura', 'Costura', 'A linha de costura: clique os pontos; duplo clique termina'],
  ['pesponto', 'Pesponto', 'O pesponto (tracejado): clique os pontos; duplo clique termina'],
  ['texto', 'Texto', 'Clique onde o texto vai'],
  ['cota', 'Cota', 'A medida no croqui: clique as duas pontas; a cota leva a letra do próximo ponto de medida da ficha (A, B, C…)'],
];

const ESTILO_DA_FERRAMENTA: Partial<Record<Ferramenta, EstiloDoTraco>> = { reta: 'contorno', curva: 'contorno', costura: 'costura', pesponto: 'pesponto' };
const TOLERANCIA = 6;

/** Quantos pixels da tela tem uma unidade da folha, com a janela da folha encaixada no quadro (sem distorcer). */
function pixelsPorUnidade(svg: SVGSVGElement, janela: JanelaDaFolha): number {
  const r = svg.getBoundingClientRect();
  return Math.min(r.width / janela.largura, r.height / janela.altura) || 1;
}

/** O ponto da folha (0–400 × 0–500) de um clique na tela, pela janela da folha que está no quadro (o zoom). */
function pontoDaFolha(svg: SVGSVGElement, clienteX: number, clienteY: number, janela: JanelaDaFolha): Ponto2D {
  const r = svg.getBoundingClientRect();
  const escala = pixelsPorUnidade(svg, janela);
  const sobraX = (r.width - janela.largura * escala) / 2;
  const sobraY = (r.height - janela.altura * escala) / 2;
  return {
    x: Math.round((janela.x + (clienteX - r.left - sobraX) / escala) * 10) / 10,
    y: Math.round((janela.y + (clienteY - r.top - sobraY) / escala) * 10) / 10,
  };
}

/** O arrasto da vista (de perto): onde o mouse apertou e a vista de então. */
interface ArrastoDaVista {
  readonly clienteX: number;
  readonly clienteY: number;
  readonly antes: VistaDaFolha;
}

interface Arrasto {
  readonly id: string;
  /** O ponto do traço que anda (`null`: o elemento inteiro). */
  readonly indice: number | null;
  /** Arrastando o espelho: o movimento em x é ao contrário. */
  readonly noEspelho: boolean;
  readonly inicio: Ponto2D;
  readonly antes: DesenhoTecnico;
}

/**
 * O desenho técnico (ADR 0107): o croqui de frente e costas, ligado à ficha técnica. Ferramentas de traço (reta,
 * curva, costura, pesponto), texto, as bases técnicas, as formas da biblioteca, as estampas (as imagens do
 * projeto), o espelho automático, o manequim de guia, desfazer e refazer. Guardado sozinho na ficha.
 */
export function PainelDoDesenhoTecnico(props: {
  readonly desenho: DesenhoTecnico;
  /** A ficha não pode mudar (aprovada, em aprovação): o motivo; `null`: pode. */
  readonly somenteLeitura: string | null;
  readonly imagens: readonly ImagemDoModelo[];
  /** Os pontos de medida da ficha, na ordem da tabela (a letra das cotas), e os tamanhos dela. */
  readonly medidas: readonly PontoDeMedida[];
  readonly tamanhos: readonly string[];
  readonly onGuardar: (desenho: DesenhoTecnico) => void;
  readonly onExportarSvg: (desenho: DesenhoTecnico) => void;
  readonly novoId: () => string;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const [desenho, setDesenho] = useState(props.desenho);
  const guardadoRef = useRef(props.desenho);
  const [guardadoEm, setGuardadoEm] = useState<string | null>(null);
  const [passado, setPassado] = useState<readonly DesenhoTecnico[]>([]);
  const [futuro, setFuturo] = useState<readonly DesenhoTecnico[]>([]);
  const [vista, setVista] = useState<VistaDoDesenho>('frente');
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [pontos, setPontos] = useState<readonly Ponto2D[]>([]);
  const [cursor, setCursor] = useState<Ponto2D | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [espelharNovos, setEspelharNovos] = useState(true);
  const [base, setBase] = useState(Object.keys(BASES)[0]!);
  const [forma, setForma] = useState(Object.keys(FORMAS)[0]!);
  const [imagemDaEstampa, setImagemDaEstampa] = useState(props.imagens[0]?.id ?? '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  // A vista da folha (ADR 0116): o zoom e o arrasto; a grade e o ímã (os pontos param na grade).
  const [vistaDaFolha, setVistaDaFolha] = useState<VistaDaFolha>(VISTA_INTEIRA);
  const [arrastoDaVista, setArrastoDaVista] = useState<ArrastoDaVista | null>(null);
  const [grade, setGrade] = useState(false);
  const [ima, setIma] = useState(false);
  const janela = janelaDaFolha(vistaDaFolha);
  const passo = passoDaGrade(vistaDaFolha.zoom);
  /** O ponto clicado, preso na grade se o ímã está ligado. */
  const prender = (p: Ponto2D): Ponto2D => (grade && ima ? naGrade(p, passo) : p);
  /** A distância que pega um ponto ou um traço: os mesmos pixels em qualquer zoom. */
  const tolerancia = TOLERANCIA / vistaDaFolha.zoom;
  const travado = props.somenteLeitura !== null;
  const elemento = selecionado ? (desenho.elementos.find((e) => e.id === selecionado) ?? null) : null;
  const proporcao = (imagemId: string): number => {
    const i = props.imagens.find((x) => x.id === imagemId);
    return i ? i.alturaPx / i.larguraPx : 1;
  };

  // Guarda sozinho, meio segundo depois da última mudança.
  const { onGuardar } = props;
  useEffect(() => {
    if (desenho === guardadoRef.current || travado) return;
    const t = setTimeout(() => {
      guardadoRef.current = desenho;
      onGuardar(desenho);
      setGuardadoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 500);
    return () => clearTimeout(t);
  }, [desenho, onGuardar, travado]);

  // A roda do mouse aproxima e afasta em volta do ponto debaixo dele. O ouvinte é do próprio SVG, não passivo, para a
  // roda não rolar a janela junto.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const aoRolar = (ev: WheelEvent): void => {
      ev.preventDefault();
      if (ev.deltaY === 0) return;
      const fator = ev.deltaY < 0 ? 1.2 : 1 / 1.2;
      setVistaDaFolha((v) => zoomNoPonto(v, fator, pontoDaFolha(svg, ev.clientX, ev.clientY, janelaDaFolha(v))));
    };
    svg.addEventListener('wheel', aoRolar, { passive: false });
    return () => svg.removeEventListener('wheel', aoRolar);
  }, []);

  /** Uma mudança que entra no desfazer. */
  const mudar = (novo: DesenhoTecnico, antes: DesenhoTecnico = desenho): void => {
    if (travado || novo === antes) return;
    setPassado((p) => [...p.slice(-99), antes]);
    setFuturo([]);
    setDesenho(novo);
  };
  const desfazer = (): void => {
    const anterior = passado.at(-1);
    if (!anterior) return;
    setPassado(passado.slice(0, -1));
    setFuturo([desenho, ...futuro]);
    setDesenho(anterior);
    setSelecionado(null);
  };
  const refazer = (): void => {
    const seguinte = futuro[0];
    if (!seguinte) return;
    setFuturo(futuro.slice(1));
    setPassado([...passado, desenho]);
    setDesenho(seguinte);
  };

  const terminarTraco = (fechado = false): void => {
    const estilo = ESTILO_DA_FERRAMENTA[ferramenta];
    if (!estilo || pontos.length < 2) {
      setPontos([]);
      return;
    }
    const traco = novoTraco(props.novoId(), vista, pontos, { estilo, curvo: ferramenta === 'curva', fechado: fechado && pontos.length > 2, espelhar: espelharNovos });
    mudar(adicionarElemento(desenho, traco));
    setPontos([]);
    setSelecionado(traco.id);
  };

  const fechar = (): void => {
    if (desenho !== guardadoRef.current && !travado) props.onGuardar(desenho);
    props.onFechar();
  };

  /** Começa a arrastar a vista (de perto): o botão do meio, ou o vazio com Selecionar. */
  const arrastarAVista = (ev: React.PointerEvent<SVGSVGElement>): void => {
    setArrastoDaVista({ clienteX: ev.clientX, clienteY: ev.clientY, antes: vistaDaFolha });
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  };

  const aoApertar = (ev: React.PointerEvent<SVGSVGElement>): void => {
    if (!svgRef.current) return;
    if (ev.button === 1 || (travado && vistaDaFolha.zoom > 1)) {
      ev.preventDefault();
      arrastarAVista(ev);
      return;
    }
    if (travado) return;
    const clicado = pontoDaFolha(svgRef.current, ev.clientX, ev.clientY, janela);
    const p = prender(clicado);
    if (ferramenta === 'texto') {
      const texto = { id: props.novoId(), tipo: 'texto' as const, vista, posicao: p, texto: 'Texto', tamanho: 12, cor: '#1f2933' };
      mudar(adicionarElemento(desenho, texto));
      setSelecionado(texto.id);
      setFerramenta('selecionar');
      return;
    }
    if (ferramenta === 'cota') {
      // A primeira ponta; na segunda, a cota entra ligada ao próximo ponto de medida sem cota.
      const de = pontos[0];
      if (!de) {
        setPontos([p]);
        return;
      }
      setPontos([]);
      if (Math.hypot(p.x - de.x, p.y - de.y) < 4) return;
      const cota = novaCota(props.novoId(), vista, de, p, proximaMedidaSemCota(desenho, props.medidas));
      mudar(adicionarElemento(desenho, cota));
      setSelecionado(cota.id);
      return;
    }
    if (ferramenta !== 'selecionar') {
      setPontos([...pontos, p]);
      return;
    }
    // A ponta da cota escolhida?
    if (elemento?.tipo === 'cota' && elemento.vista === vista) {
      const ponta = [elemento.de, elemento.ate].findIndex((q) => Math.hypot(q.x - clicado.x, q.y - clicado.y) <= tolerancia);
      if (ponta >= 0) {
        setArrasto({ id: elemento.id, indice: ponta, noEspelho: false, inicio: clicado, antes: desenho });
        ev.currentTarget.setPointerCapture?.(ev.pointerId);
        return;
      }
    }
    // Um ponto do traço escolhido (ou do espelho dele)? (Pelo ponto clicado, não pelo preso na grade.)
    if (elemento?.tipo === 'traco' && elemento.vista === vista) {
      const noOriginal = elemento.pontos.findIndex((q) => Math.hypot(q.x - clicado.x, q.y - clicado.y) <= tolerancia);
      const noEspelho = elemento.espelhar ? elemento.pontos.findIndex((q) => Math.hypot(espelharPonto(q).x - clicado.x, q.y - clicado.y) <= tolerancia) : -1;
      if (noOriginal >= 0 || noEspelho >= 0) {
        setArrasto({ id: elemento.id, indice: noOriginal >= 0 ? noOriginal : noEspelho, noEspelho: noOriginal < 0, inicio: clicado, antes: desenho });
        ev.currentTarget.setPointerCapture?.(ev.pointerId);
        return;
      }
    }
    const id = elementoNoPonto(desenho, vista, clicado, tolerancia, proporcao);
    setSelecionado(id);
    if (id) {
      const original = desenho.elementos.find((e) => e.id === id)!;
      const noEspelho = !pontoPegaElemento(original, clicado, tolerancia, original.tipo === 'estampa' ? proporcao(original.imagemId) : 1);
      setArrasto({ id, indice: null, noEspelho, inicio: clicado, antes: desenho });
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    } else if (vistaDaFolha.zoom > 1) arrastarAVista(ev);
  };

  const aoMover = (ev: React.PointerEvent<SVGSVGElement>): void => {
    if (!svgRef.current) return;
    if (arrastoDaVista) {
      // A folha anda com o mouse: os pixels andados, em unidades da folha da vista de quando apertou.
      const escala = pixelsPorUnidade(svgRef.current, janelaDaFolha(arrastoDaVista.antes));
      setVistaDaFolha(arrastarVista(arrastoDaVista.antes, (ev.clientX - arrastoDaVista.clienteX) / escala, (ev.clientY - arrastoDaVista.clienteY) / escala));
      return;
    }
    const p = pontoDaFolha(svgRef.current, ev.clientX, ev.clientY, janela);
    setCursor(prender(p));
    if (!arrasto) return;
    let dx = (p.x - arrasto.inicio.x) * (arrasto.noEspelho ? -1 : 1);
    let dy = p.y - arrasto.inicio.y;
    // Com o ímã, o elemento inteiro anda de passo em passo da grade; o ponto do traço para num cruzamento.
    if (grade && ima && arrasto.indice === null) {
      dx = Math.round(dx / passo) * passo;
      dy = Math.round(dy / passo) * passo;
    }
    setDesenho(
      mudarElemento(arrasto.antes, arrasto.id, (e) => {
        if (arrasto.indice !== null && e.tipo === 'cota') {
          const q = arrasto.indice === 0 ? e.de : e.ate;
          const nova = prender({ x: Math.round((q.x + dx) * 10) / 10, y: Math.round((q.y + dy) * 10) / 10 });
          return arrasto.indice === 0 ? { ...e, de: nova } : { ...e, ate: nova };
        }
        if (arrasto.indice === null || e.tipo !== 'traco') return moverElemento(e, dx, dy);
        const q = e.pontos[arrasto.indice]!;
        const novo = prender({ x: Math.round((q.x + dx) * 10) / 10, y: Math.round((q.y + dy) * 10) / 10 });
        return { ...e, pontos: e.pontos.map((r, i) => (i === arrasto.indice ? novo : r)) };
      }),
    );
  };

  const aoSoltar = (): void => {
    if (arrastoDaVista) {
      setArrastoDaVista(null);
      return;
    }
    if (!arrasto) return;
    // O arrasto inteiro é uma mudança só, no desfazer (e só se andou).
    if (desenho !== arrasto.antes) {
      setPassado((p) => [...p.slice(-99), arrasto.antes]);
      setFuturo([]);
    }
    setArrasto(null);
  };

  const aoTeclar = (ev: React.KeyboardEvent): void => {
    const alvo = ev.target as HTMLElement;
    if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT') return;
    if (ev.key === 'Enter') terminarTraco();
    else if (ev.key === 'Escape') setPontos([]);
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selecionado) {
      mudar(removerElemento(desenho, selecionado));
      setSelecionado(null);
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') desfazer();
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') refazer();
    else if (ev.key === '+' || ev.key === '=') setVistaDaFolha((v) => zoomNoPonto(v, 2));
    else if (ev.key === '-') setVistaDaFolha((v) => zoomNoPonto(v, 1 / 2));
    else if (ev.key === '0') setVistaDaFolha(VISTA_INTEIRA);
  };

  const mudarSelecionado = (fazer: (e: ElementoDoDesenho) => ElementoDoDesenho): void => {
    if (selecionado) mudar(mudarElemento(desenho, selecionado, fazer));
  };
  const naVista = elementosDaVista(desenho, vista);

  return (
    <Sobreposicao titulo="Desenho técnico" onFechar={fechar}>
      <div className="painel-do-desenho-tecnico" onKeyDown={aoTeclar} tabIndex={-1}>
        <div className="cabecalho-da-ficha">
          <span className="partes-da-sala-de-corte" role="tablist" aria-label="Vistas do desenho">
            {(Object.keys(ROTULO_DA_VISTA) as VistaDoDesenho[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vista === v}
                className={vista === v ? 'item-selecionado' : undefined}
                onClick={() => {
                  setVista(v);
                  setPontos([]);
                  setSelecionado(null);
                }}
              >
                {ROTULO_DA_VISTA[v]} ({desenho.elementos.filter((e) => e.vista === v).length})
              </button>
            ))}
          </span>
          <span className="nota-do-formulario">{travado ? props.somenteLeitura : guardadoEm ? `Guardado na ficha às ${guardadoEm}` : 'Guardado na ficha técnica a cada mudança'}</span>
          <span className="acoes-da-fila">
            <button type="button" onClick={desfazer} disabled={passado.length === 0 || travado} title="Desfazer (Ctrl+Z)">
              Desfazer
            </button>
            <button type="button" onClick={refazer} disabled={futuro.length === 0 || travado} title="Refazer (Ctrl+Y)">
              Refazer
            </button>
            <button type="button" onClick={() => props.onExportarSvg(desenho)}>
              Exportar SVG
            </button>
          </span>
        </div>

        <div className="area-do-desenho-tecnico">
          <aside className="ferramentas-do-desenho" aria-label="Ferramentas do desenho">
            <div className="grade-de-ferramentas-do-desenho" role="toolbar" aria-label="Ferramentas">
              {FERRAMENTAS.map(([f, rotulo, dica]) => (
                <button
                  key={f}
                  type="button"
                  title={dica}
                  aria-pressed={ferramenta === f}
                  className={ferramenta === f ? 'item-selecionado' : undefined}
                  disabled={travado && f !== 'selecionar'}
                  onClick={() => {
                    setFerramenta(f);
                    setPontos([]);
                  }}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {pontos.length > 0 && (
              <div className="acoes-em-linha">
                <button type="button" className="botao-primario" onClick={() => terminarTraco()}>
                  Terminar
                </button>
                <button type="button" disabled={pontos.length < 3} onClick={() => terminarTraco(true)}>
                  Fechar
                </button>
                <button type="button" onClick={() => setPontos([])}>
                  Cancelar
                </button>
              </div>
            )}
            <label className="opcao-em-linha" title="O que for desenhado aparece também do outro lado do eixo">
              <input type="checkbox" checked={espelharNovos} disabled={travado} onChange={(e) => setEspelharNovos(e.target.checked)} />
              Espelhar o que desenhar
            </label>
            <label>
              Base técnica
              <select value={base} disabled={travado} onChange={(e) => setBase(e.target.value)}>
                {Object.entries(BASES).map(([chave, b]) => (
                  <option key={chave} value={chave}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={travado} onClick={() => mudar(adicionarElemento(desenho, tracosDaBase(base, props.novoId)))}>
              Pôr a base (frente e costas)
            </button>
            <label>
              Forma
              <select value={forma} disabled={travado} onChange={(e) => setForma(e.target.value)}>
                {Object.entries(FORMAS).map(([chave, f]) => (
                  <option key={chave} value={chave}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={travado}
              onClick={() => {
                // A forma espelhada entra num lado (e aparece no outro); sem espelho, no meio.
                const tracos = tracosDaForma(forma, vista, { x: espelharNovos ? 145 : 200, y: 230 }, props.novoId, espelharNovos);
                mudar(adicionarElemento(desenho, tracos));
                setSelecionado(tracos[0]?.id ?? null);
              }}
            >
              Pôr a forma
            </button>
            <label>
              Estampa (imagem do projeto)
              <select value={imagemDaEstampa} disabled={travado || props.imagens.length === 0} onChange={(e) => setImagemDaEstampa(e.target.value)}>
                {props.imagens.length === 0 && <option value="">Nenhuma imagem (Modelo › Imagens)</option>}
                {props.imagens.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={travado || !imagemDaEstampa}
              onClick={() => {
                const estampa = { id: props.novoId(), tipo: 'estampa' as const, vista, imagemId: imagemDaEstampa, centro: { x: 200, y: 200 }, largura: 80, rotacaoGraus: 0, opacidade: 1, espelhar: false };
                mudar(adicionarElemento(desenho, estampa));
                setSelecionado(estampa.id);
                setFerramenta('selecionar');
              }}
            >
              Pôr a estampa
            </button>
            <label>
              Manequim (guia)
              <select
                value={desenho.manequim ?? ''}
                disabled={travado}
                onChange={(e) => mudar({ ...desenho, manequim: e.target.value === '' ? null : (e.target.value as Manequim) })}
              >
                <option value="">Nenhum</option>
                {(Object.keys(ROTULO_DO_MANEQUIM) as Manequim[]).map((m) => (
                  <option key={m} value={m}>
                    {ROTULO_DO_MANEQUIM[m]}
                  </option>
                ))}
              </select>
            </label>
          </aside>

          <div className="quadro-da-folha">
            <svg
              ref={svgRef}
              className={`folha-do-desenho ferramenta-${ferramenta}${arrastoDaVista ? ' arrastando-a-vista' : vistaDaFolha.zoom > 1 && (ferramenta === 'selecionar' || travado) ? ' vista-de-perto' : ''}`}
              viewBox={`${janela.x} ${janela.y} ${janela.largura} ${janela.altura}`}
              role="img"
              aria-label={`Folha do desenho — ${ROTULO_DA_VISTA[vista]}`}
              onPointerDown={aoApertar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerLeave={() => setCursor(null)}
              onDoubleClick={() => terminarTraco()}
            >
              <rect x={0} y={0} width={LARGURA_DA_FOLHA} height={ALTURA_DA_FOLHA} fill="#ffffff" />
              {grade && <GradeDaFolha passo={passo} />}
              <ManequimNaFolha manequim={desenho.manequim} />
              <EixoNaFolha />
              {naVista.map((e) => (
                <ElementoNaFolha key={e.id} elemento={e} imagens={props.imagens} medidas={props.medidas} />
              ))}
              {elemento && elemento.vista === vista && <Destaque elemento={elemento} proporcao={elemento.tipo === 'estampa' ? proporcao(elemento.imagemId) : 1} zoom={vistaDaFolha.zoom} />}
              {pontos.length > 0 && (
                <path
                  className="traco-em-desenho"
                  d={caminhoDoTraco(cursor ? [...pontos, cursor] : pontos, ferramenta === 'curva', false)}
                  strokeDasharray={ferramenta === 'pesponto' ? '4 3' : undefined}
                />
              )}
              {pontos.map((q, i) => (
                <circle key={i} className="ponto-em-desenho" cx={q.x} cy={q.y} r={2.5 / vistaDaFolha.zoom} />
              ))}
            </svg>
            <div className="controles-da-folha" role="toolbar" aria-label="Zoom e grade">
              <button type="button" aria-label="Afastar" title="Afastar (−)" disabled={vistaDaFolha.zoom <= 1} onClick={() => setVistaDaFolha((v) => zoomNoPonto(v, 1 / 2))}>
                −
              </button>
              <button type="button" className="zoom-da-folha" title="Ver a folha inteira (0)" onClick={() => setVistaDaFolha(VISTA_INTEIRA)}>
                {Math.round(vistaDaFolha.zoom * 100)}%
              </button>
              <button type="button" aria-label="Aproximar" title="Aproximar (+); a roda do mouse aproxima no ponto do mouse" disabled={vistaDaFolha.zoom >= ZOOM_MAXIMO} onClick={() => setVistaDaFolha((v) => zoomNoPonto(v, 2))}>
                +
              </button>
              <button
                type="button"
                aria-pressed={grade}
                className={grade ? 'item-selecionado' : undefined}
                title={`A grade: uma linha a cada ${passo} (de perto, a cada 5), mais forte a cada 50`}
                onClick={() => setGrade(!grade)}
              >
                Grade
              </button>
              <button
                type="button"
                aria-pressed={grade && ima}
                className={grade && ima ? 'item-selecionado' : undefined}
                disabled={!grade || travado}
                title="Ímã: os pontos novos e os arrastados param no cruzamento da grade"
                onClick={() => setIma(!ima)}
              >
                Ímã
              </button>
            </div>
          </div>

          <aside className="propriedades-do-desenho" aria-label="Propriedades do elemento">
            {!elemento ? (
              <p className="nota-do-formulario">
                {travado
                  ? 'O desenho só pode ser visto.'
                  : 'Escolha um elemento (Selecionar) para mudar o estilo, a cor, o espelho ou apagar. Para desenhar: Reta, Curva, Costura ou Pesponto, clicando os pontos; duplo clique termina.'}
              </p>
            ) : (
              <Propriedades
                elemento={elemento}
                imagens={props.imagens}
                medidas={props.medidas}
                tamanhos={props.tamanhos}
                desenho={desenho}
                travado={travado}
                onMudar={mudarSelecionado}
                onDuplicar={() => {
                  const copia = duplicarElemento(elemento, props.novoId());
                  mudar(adicionarElemento(desenho, copia));
                  setSelecionado(copia.id);
                }}
                onCopiarParaAOutraVista={() => mudar(adicionarElemento(desenho, copiarParaAOutraVista(elemento, props.novoId())))}
                onOrdem={(para) => mudar(ordemDoElemento(desenho, elemento.id, para))}
                onApagar={() => {
                  mudar(removerElemento(desenho, elemento.id));
                  setSelecionado(null);
                }}
              />
            )}
          </aside>
        </div>
      </div>
    </Sobreposicao>
  );
}

/** A grade da folha (ADR 0116): uma linha a cada passo, mais forte a cada 50; fina em qualquer zoom. */
function GradeDaFolha(props: { readonly passo: number }): React.JSX.Element {
  const linhas: React.JSX.Element[] = [];
  for (let x = props.passo; x < LARGURA_DA_FOLHA; x += props.passo) {
    linhas.push(<line key={`x${x}`} className={x % 50 === 0 ? 'grade-forte' : undefined} x1={x} y1={0} x2={x} y2={ALTURA_DA_FOLHA} />);
  }
  for (let y = props.passo; y < ALTURA_DA_FOLHA; y += props.passo) {
    linhas.push(<line key={`y${y}`} className={y % 50 === 0 ? 'grade-forte' : undefined} x1={0} y1={y} x2={LARGURA_DA_FOLHA} y2={y} />);
  }
  return (
    <g className="grade-da-folha" aria-hidden="true">
      {linhas}
    </g>
  );
}

/** O realce do elemento escolhido: o traço em azul com os pontos; a caixa do texto e da estampa. */
function Destaque(props: { readonly elemento: ElementoDoDesenho; readonly proporcao: number; readonly zoom: number }): React.JSX.Element {
  const e = props.elemento;
  // Os quadradinhos dos pontos ficam do mesmo tamanho na tela em qualquer zoom.
  const lado = 6 / props.zoom;
  if (e.tipo === 'traco') {
    const espelhos = e.espelhar ? [e.pontos.map(espelharPonto)] : [];
    return (
      <g className="destaque-do-desenho">
        {[e.pontos, ...espelhos].map((pontos, k) => (
          <g key={k}>
            <path d={caminhoDoTraco(pontos, e.curvo, e.fechado)} />
            {pontos.map((q, i) => (
              <rect key={i} x={q.x - lado / 2} y={q.y - lado / 2} width={lado} height={lado} />
            ))}
          </g>
        ))}
      </g>
    );
  }
  if (e.tipo === 'texto') {
    const largura = Math.max(e.tamanho, e.texto.length * e.tamanho * 0.55);
    return <rect className="destaque-do-desenho" x={e.posicao.x - 2} y={e.posicao.y - e.tamanho - 1} width={largura + 4} height={e.tamanho * 1.25 + 2} fill="none" />;
  }
  if (e.tipo === 'cota') {
    return (
      <g className="destaque-do-desenho">
        <path d={`M ${e.de.x} ${e.de.y} L ${e.ate.x} ${e.ate.y}`} />
        {[e.de, e.ate].map((q, i) => (
          <rect key={i} x={q.x - lado / 2} y={q.y - lado / 2} width={lado} height={lado} />
        ))}
      </g>
    );
  }
  const altura = e.largura * props.proporcao;
  return (
    <rect
      className="destaque-do-desenho"
      x={e.centro.x - e.largura / 2}
      y={e.centro.y - altura / 2}
      width={e.largura}
      height={altura}
      fill="none"
      transform={`rotate(${e.rotacaoGraus} ${e.centro.x} ${e.centro.y})`}
    />
  );
}

/**
 * A cota escolhida (ADR 0117): o ponto de medida da ficha (a letra), com o valor de cada tamanho para conferir; sem
 * ponto, o texto da cota. O ponto que já tem cota em outro lugar diz onde.
 */
function PropriedadesDaCota(props: {
  readonly cota: CotaDoDesenho;
  readonly medidas: readonly PontoDeMedida[];
  readonly tamanhos: readonly string[];
  readonly desenho: DesenhoTecnico;
  readonly travado: boolean;
  readonly onMudar: (fazer: (e: ElementoDoDesenho) => ElementoDoDesenho) => void;
}): React.JSX.Element {
  const c = props.cota;
  const t = props.travado;
  const medida = c.medidaId === null ? undefined : props.medidas.find((m) => m.id === c.medidaId);
  const comOutraCota = medidasComCota({ ...props.desenho, elementos: props.desenho.elementos.filter((e) => e.id !== c.id) });
  const valores = medida
    ? props.tamanhos
        .filter((tam) => medida.valoresCm[tam] !== undefined)
        .map((tam) => `${tam} ${numeroComVirgula(medida.valoresCm[tam]!, 1)}`)
        .join(' · ')
    : '';
  return (
    <>
      <label>
        Ponto de medida
        <select
          value={medida ? medida.id : ''}
          disabled={t}
          onChange={(ev) => props.onMudar((x) => ({ ...(x as CotaDoDesenho), medidaId: ev.target.value === '' ? null : ev.target.value }))}
        >
          <option value="">Nenhum (o texto abaixo)</option>
          {props.medidas.map((m, i) => (
            <option key={m.id} value={m.id}>
              {letraDaMedida(i)} — {m.nome}
              {comOutraCota.has(m.id) ? ' (já tem cota)' : ''}
            </option>
          ))}
        </select>
      </label>
      {props.medidas.length === 0 && <p className="nota-do-formulario">A ficha ainda não tem pontos de medida (Ficha técnica › Medidas): a cota leva o texto.</p>}
      {c.medidaId !== null && !medida && <p className="nota-do-formulario">O ponto de medida desta cota saiu da tabela: escolha outro, ou escreva o texto.</p>}
      {medida ? (
        <p className="valores-da-cota">
          <strong>{medida.nome}</strong>
          {valores ? ` (cm): ${valores}` : ' — sem medida nos tamanhos'}
        </p>
      ) : (
        <label>
          Texto da cota
          <input value={c.texto} disabled={t} placeholder="Barra 3 cm" onChange={(ev) => props.onMudar((x) => ({ ...(x as CotaDoDesenho), texto: ev.target.value }))} />
        </label>
      )}
      <label>
        Cor
        <input type="color" value={c.cor} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...(x as CotaDoDesenho), cor: ev.target.value }))} />
      </label>
    </>
  );
}

function Propriedades(props: {
  readonly elemento: ElementoDoDesenho;
  readonly imagens: readonly ImagemDoModelo[];
  readonly medidas: readonly PontoDeMedida[];
  readonly tamanhos: readonly string[];
  readonly desenho: DesenhoTecnico;
  readonly travado: boolean;
  readonly onMudar: (fazer: (e: ElementoDoDesenho) => ElementoDoDesenho) => void;
  readonly onDuplicar: () => void;
  readonly onCopiarParaAOutraVista: () => void;
  readonly onOrdem: (para: 1 | -1) => void;
  readonly onApagar: () => void;
}): React.JSX.Element {
  const e = props.elemento;
  const t = props.travado;
  return (
    <form className="formulario-de-sobreposicao" onSubmit={(ev) => ev.preventDefault()}>
      <p className="legenda-inline">{e.tipo === 'traco' ? 'Traço' : e.tipo === 'texto' ? 'Texto' : e.tipo === 'cota' ? 'Cota' : 'Estampa'}</p>
      {e.tipo === 'cota' && <PropriedadesDaCota cota={e} medidas={props.medidas} tamanhos={props.tamanhos} desenho={props.desenho} travado={t} onMudar={props.onMudar} />}
      {e.tipo === 'traco' && (
        <>
          <label>
            Estilo
            <select value={e.estilo} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), estilo: ev.target.value as EstiloDoTraco }))}>
              {(Object.keys(ROTULO_DO_ESTILO) as EstiloDoTraco[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_DO_ESTILO[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cor do traço
            <input type="color" value={e.cor} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), cor: ev.target.value }))} />
          </label>
          <label>
            Espessura
            <CampoDeNumero rotulo="Espessura" valor={e.espessura} desabilitado={t} onMudar={(v) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), espessura: Math.max(0.2, v ?? 1) }))} />
          </label>
          <label className="opcao-em-linha">
            <input type="checkbox" checked={e.curvo} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), curvo: ev.target.checked }))} />
            Curvo
          </label>
          <label className="opcao-em-linha">
            <input type="checkbox" checked={e.fechado} disabled={t || e.pontos.length < 3} onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), fechado: ev.target.checked }))} />
            Fechado
          </label>
          {e.fechado && (
            <label className="opcao-em-linha">
              <input
                type="checkbox"
                checked={e.preenchimento !== null}
                disabled={t}
                onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), preenchimento: ev.target.checked ? '#e8eef7' : null }))}
              />
              Preencher
              {e.preenchimento !== null && (
                <input type="color" aria-label="Cor de dentro" value={e.preenchimento} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), preenchimento: ev.target.value }))} />
              )}
            </label>
          )}
          <label className="opcao-em-linha">
            <input type="checkbox" checked={e.espelhar} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...(x as TracoDoDesenho), espelhar: ev.target.checked }))} />
            Espelhar no outro lado
          </label>
        </>
      )}
      {e.tipo === 'texto' && (
        <>
          <label>
            Texto
            <input value={e.texto} disabled={t} autoFocus onChange={(ev) => props.onMudar((x) => ({ ...x, texto: ev.target.value }) as ElementoDoDesenho)} />
          </label>
          <label>
            Tamanho
            <CampoDeNumero rotulo="Tamanho do texto" valor={e.tamanho} desabilitado={t} onMudar={(v) => props.onMudar((x) => ({ ...x, tamanho: Math.max(4, v ?? 12) }) as ElementoDoDesenho)} />
          </label>
          <label>
            Cor
            <input type="color" value={e.cor} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...x, cor: ev.target.value }) as ElementoDoDesenho)} />
          </label>
        </>
      )}
      {e.tipo === 'estampa' && (
        <>
          <label>
            Imagem
            <select value={e.imagemId} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...x, imagemId: ev.target.value }) as ElementoDoDesenho)}>
              {props.imagens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Largura (na folha de 400)
            <CampoDeNumero rotulo="Largura da estampa" valor={e.largura} desabilitado={t} onMudar={(v) => props.onMudar((x) => ({ ...x, largura: Math.max(4, v ?? 80) }) as ElementoDoDesenho)} />
          </label>
          <label>
            Rotação (graus)
            <input
              type="number"
              aria-label="Rotação da estampa"
              value={e.rotacaoGraus}
              disabled={t}
              onChange={(ev) => props.onMudar((x) => ({ ...x, rotacaoGraus: Number(ev.target.value) || 0 }) as ElementoDoDesenho)}
            />
          </label>
          <label>
            Opacidade
            <select value={String(e.opacidade)} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...x, opacidade: Number(ev.target.value) }) as ElementoDoDesenho)}>
              {[0.25, 0.5, 0.75, 1].map((o) => (
                <option key={o} value={String(o)}>
                  {o * 100}%
                </option>
              ))}
            </select>
          </label>
          <label className="opcao-em-linha">
            <input type="checkbox" checked={e.espelhar} disabled={t} onChange={(ev) => props.onMudar((x) => ({ ...x, espelhar: ev.target.checked }) as ElementoDoDesenho)} />
            Espelhar no outro lado
          </label>
        </>
      )}
      <div className="acoes-do-trabalho">
        <button type="button" disabled={t} onClick={props.onDuplicar}>
          Duplicar
        </button>
        <button type="button" disabled={t} onClick={props.onCopiarParaAOutraVista}>
          Copiar para {e.vista === 'frente' ? 'as costas' : 'a frente'}
        </button>
        <button type="button" disabled={t} onClick={() => props.onOrdem(1)}>
          Para a frente
        </button>
        <button type="button" disabled={t} onClick={() => props.onOrdem(-1)}>
          Para trás
        </button>
        <button type="button" disabled={t} onClick={props.onApagar}>
          Apagar
        </button>
      </div>
    </form>
  );
}
