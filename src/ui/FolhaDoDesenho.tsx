import {
  ALTURA_DA_FOLHA,
  caminhoDoTraco,
  contornoPelaMetade,
  EIXO_DO_DESENHO,
  elementosDaVista,
  LARGURA_DA_FOLHA,
  MANEQUINS,
  TRACEJADO_DO_ESTILO,
  type DesenhoTecnico,
  type ElementoDoDesenho,
  type VistaDoDesenho,
} from '../domain/desenhoTecnico';
import type { ImagemDoModelo } from '../domain/imagens';

/** Um elemento do desenho em SVG (o traço, o texto ou a estampa). */
export function ElementoNaFolha(props: { readonly elemento: ElementoDoDesenho; readonly imagens: readonly ImagemDoModelo[] }): React.JSX.Element | null {
  const e = props.elemento;
  if (e.tipo === 'traco') {
    const tracejado = TRACEJADO_DO_ESTILO[e.estilo];
    return (
      <path
        d={caminhoDoTraco(e.pontos, e.curvo, e.fechado)}
        fill={e.fechado && e.preenchimento ? e.preenchimento : 'none'}
        stroke={e.cor}
        strokeWidth={e.espessura}
        strokeDasharray={tracejado ? tracejado.join(' ') : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  }
  if (e.tipo === 'texto') {
    return (
      <text x={e.posicao.x} y={e.posicao.y} fontSize={e.tamanho} fill={e.cor} fontFamily="Helvetica, Arial, sans-serif">
        {e.texto}
      </text>
    );
  }
  const imagem = props.imagens.find((i) => i.id === e.imagemId);
  if (!imagem) return null;
  const altura = e.largura * (imagem.alturaPx / imagem.larguraPx);
  const espelhada = e.id.endsWith('~');
  return (
    <image
      href={imagem.dados}
      x={e.centro.x - e.largura / 2}
      y={e.centro.y - altura / 2}
      width={e.largura}
      height={altura}
      opacity={e.opacidade}
      preserveAspectRatio="none"
      transform={`rotate(${e.rotacaoGraus} ${e.centro.x} ${e.centro.y})${espelhada ? ` translate(${2 * e.centro.x} 0) scale(-1 1)` : ''}`}
    />
  );
}

/** O manequim de guia, cinza-claro. */
export function ManequimNaFolha(props: { readonly manequim: DesenhoTecnico['manequim'] }): React.JSX.Element | null {
  if (!props.manequim) return null;
  const m = MANEQUINS[props.manequim];
  return (
    <g className="manequim-do-desenho" aria-hidden="true">
      <path d={caminhoDoTraco(contornoPelaMetade(m.corpo), true, true)} />
      <path d={caminhoDoTraco(m.cabeca, true, true)} />
    </g>
  );
}

/** A folha de uma vista, só para ver (a ficha técnica, a prévia). */
export function FolhaDoDesenho(props: { readonly desenho: DesenhoTecnico; readonly vista: VistaDoDesenho; readonly imagens: readonly ImagemDoModelo[]; readonly rotulo?: string; readonly comManequim?: boolean }): React.JSX.Element {
  return (
    <svg className="folha-do-desenho-pequena" viewBox={`0 0 ${LARGURA_DA_FOLHA} ${ALTURA_DA_FOLHA}`} role="img" aria-label={props.rotulo ?? `Desenho técnico — ${props.vista}`}>
      <rect x={0} y={0} width={LARGURA_DA_FOLHA} height={ALTURA_DA_FOLHA} fill="#ffffff" />
      {props.comManequim && <ManequimNaFolha manequim={props.desenho.manequim} />}
      {elementosDaVista(props.desenho, props.vista).map((e) => (
        <ElementoNaFolha key={e.id} elemento={e} imagens={props.imagens} />
      ))}
    </svg>
  );
}

/** O eixo do meio, tracejado (o espelho). */
export function EixoNaFolha(): React.JSX.Element {
  return <line className="eixo-do-desenho" x1={EIXO_DO_DESENHO} y1={0} x2={EIXO_DO_DESENHO} y2={ALTURA_DA_FOLHA} />;
}
