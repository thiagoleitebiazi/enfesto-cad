import { distancia, anguloEmGraus, type Ponto2D } from '../core/geometria';
import { valorDaReguaEmUnidade, type TransformacaoDeTela, type UnidadeDeRegua } from './transformacaoDeTela';
import type { ProblemaDeValidacao } from '../domain/validacao';

interface BarraDeStatusProps {
  readonly cursorMundo: Ponto2D | null;
  readonly transform: TransformacaoDeTela;
  readonly totalDePecas: number;
  readonly temSelecao: boolean;
  readonly problemas: readonly ProblemaDeValidacao[];
  readonly onAlternarValidacao: () => void;
  /** Último ponto confirmado durante uma construção em andamento (Novo Molde/Furo) — habilita a leitura de DX/DY/distância/ângulo relativa a ele. */
  readonly pontoReferencia?: Ponto2D | null;
  /** Aproveitamento físico da mesa em %, ou null quando não há enfesto ou peças. */
  readonly aproveitamentoPercentual?: number | null;
  /** Unidade escolhida no canto das réguas: as medidas da barra seguem a mesma. */
  readonly unidade: UnidadeDeRegua;
}

/** Medida em mm escrita na unidade das réguas; em cm, duas casas dão a mesma precisão de 0,1 mm. */
function medida(mm: number, unidade: UnidadeDeRegua): string {
  return unidade === 'cm' ? `${valorDaReguaEmUnidade(mm, 'cm').toFixed(2)} cm` : `${mm.toFixed(1)} mm`;
}

export function BarraDeStatus(props: BarraDeStatusProps): React.JSX.Element {
  const zoomPercentual = Math.round(props.transform.escalaPxPorMm * 100);
  const erros = props.problemas.filter((p) => p.severidade === 'erro').length;
  const avisos = props.problemas.filter((p) => p.severidade === 'aviso').length;
  const referencia =
    props.pontoReferencia && props.cursorMundo
      ? {
          dx: props.cursorMundo.x - props.pontoReferencia.x,
          dy: props.cursorMundo.y - props.pontoReferencia.y,
          distancia: distancia(props.pontoReferencia, props.cursorMundo),
          angulo: anguloEmGraus(props.pontoReferencia, props.cursorMundo),
        }
      : null;

  return (
    <div className="barra-de-status">
      <span>
        {props.cursorMundo
          ? `X: ${medida(props.cursorMundo.x, props.unidade)}  Y: ${medida(props.cursorMundo.y, props.unidade)}`
          : 'X: —  Y: —'}
      </span>
      {referencia && (
        <span>
          DX: {medida(referencia.dx, props.unidade)}  DY: {medida(referencia.dy, props.unidade)}  Dist:{' '}
          {medida(referencia.distancia, props.unidade)}  Âng: {referencia.angulo.toFixed(1)}°
        </span>
      )}
      <span>Zoom: {zoomPercentual}%</span>
      <span>Peças: {props.totalDePecas}</span>
      <span>Seleção: {props.temSelecao ? '1 peça' : 'nenhuma'}</span>
      <span title="Área das peças na mesa ÷ (largura útil × comprimento usado)">
        Aproveitamento da mesa:{' '}
        {props.aproveitamentoPercentual != null ? `${props.aproveitamentoPercentual.toFixed(1)}%` : '—'}
      </span>
      <button
        className={`indicador-de-validacao ${erros > 0 ? 'tem-erro' : avisos > 0 ? 'tem-aviso' : ''}`}
        onClick={props.onAlternarValidacao}
      >
        Validação: {erros === 0 && avisos === 0 ? 'sem problemas' : `${erros} erro(s), ${avisos} aviso(s)`}
      </button>
    </div>
  );
}
