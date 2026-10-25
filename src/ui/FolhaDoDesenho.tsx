import {
  ALTURA_DA_FOLHA,
  caminhoDoTraco,
  contornoPelaMetade,
  EIXO_DO_DESENHO,
  elementosDaVista,
  geometriaDaCota,
  LARGURA_DA_FOLHA,
  MANEQUINS,
  rotuloDaCota,
  TRACEJADO_DO_ESTILO,
  type CotaDoDesenho,
  type DesenhoTecnico,
  type ElementoDoDesenho,
  type VistaDoDesenho,
} from '../domain/desenhoTecnico';
import type { ImagemDoModelo } from '../domain/imagens';

/** Os pontos de medida da ficha, na ordem da tabela: dão a letra de cada cota. */
type MedidasDaFicha = readonly { readonly id: string }[];

/** A cota (ADR 0117): a linha, as setas e o rótulo (a letra no círculo, ou o texto na caixa). */
function CotaNaFolha(props: { readonly cota: CotaDoDesenho; readonly medidas: MedidasDaFicha }): React.JSX.Element {
  const c = props.cota;
  const g = geometriaDaCota(c, rotuloDaCota(c, props.medidas));
  const r = g.rotulo;
  return (
    <g className="cota-do-desenho">
      <line x1={c.de.x} y1={c.de.y} x2={c.ate.x} y2={c.ate.y} stroke={c.cor} strokeWidth={0.8} />
      {g.setas.map((s, i) => (
        <polygon key={i} points={s.map((q) => `${q.x},${q.y}`).join(' ')} fill={c.cor} />
      ))}
      {r.raio !== null ? (
        <circle cx={r.centro.x} cy={r.centro.y} r={r.raio} fill="#ffffff" stroke={c.cor} strokeWidth={1} />
      ) : (
        <rect x={r.centro.x - r.largura / 2} y={r.centro.y - r.altura / 2} width={r.largura} height={r.altura} rx={3} fill="#ffffff" stroke={c.cor} strokeWidth={1} />
      )}
      <text x={r.centro.x} y={r.centro.y} fontSize={r.tamanho} fontWeight="bold" fill={c.cor} textAnchor="middle" dominantBaseline="central" fontFamily="Helvetica, Arial, sans-serif">
        {r.texto}
      </text>
    </g>
  );
}

/** Um elemento do desenho em SVG (o traço, o texto, a estampa ou a cota). */
export function ElementoNaFolha(props: { readonly elemento: ElementoDoDesenho; readonly imagens: readonly ImagemDoModelo[]; readonly medidas?: MedidasDaFicha }): React.JSX.Element | null {
  const e = props.elemento;
  if (e.tipo === 'cota') return <CotaNaFolha cota={e} medidas={props.medidas ?? []} />;
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
export function FolhaDoDesenho(props: {
  readonly desenho: DesenhoTecnico;
  readonly vista: VistaDoDesenho;
  readonly imagens: readonly ImagemDoModelo[];
  readonly rotulo?: string;
  readonly comManequim?: boolean;
  /** Os pontos de medida da ficha (a letra das cotas). */
  readonly medidas?: MedidasDaFicha;
}): React.JSX.Element {
  return (
    <svg className="folha-do-desenho-pequena" viewBox={`0 0 ${LARGURA_DA_FOLHA} ${ALTURA_DA_FOLHA}`} role="img" aria-label={props.rotulo ?? `Desenho técnico — ${props.vista}`}>
      <rect x={0} y={0} width={LARGURA_DA_FOLHA} height={ALTURA_DA_FOLHA} fill="#ffffff" />
      {props.comManequim && <ManequimNaFolha manequim={props.desenho.manequim} />}
      {elementosDaVista(props.desenho, props.vista).map((e) => (
        <ElementoNaFolha key={e.id} elemento={e} imagens={props.imagens} medidas={props.medidas ?? []} />
      ))}
    </svg>
  );
}

/** O eixo do meio, tracejado (o espelho). */
export function EixoNaFolha(): React.JSX.Element {
  return <line className="eixo-do-desenho" x1={EIXO_DO_DESENHO} y1={0} x2={EIXO_DO_DESENHO} y2={ALTURA_DA_FOLHA} />;
}
