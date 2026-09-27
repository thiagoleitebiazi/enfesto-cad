import type { Ponto2D } from '../core/geometria';
import type { TransformacaoDeTela } from './transformacaoDeTela';

interface BarraDeStatusProps {
  readonly cursorMundo: Ponto2D | null;
  readonly transform: TransformacaoDeTela;
  readonly totalDePecas: number;
  readonly temSelecao: boolean;
}

export function BarraDeStatus(props: BarraDeStatusProps): React.JSX.Element {
  const zoomPercentual = Math.round(props.transform.escalaPxPorMm * 100);
  return (
    <div className="barra-de-status">
      <span>
        {props.cursorMundo
          ? `X: ${props.cursorMundo.x.toFixed(1)} mm  Y: ${props.cursorMundo.y.toFixed(1)} mm`
          : 'X: —  Y: —'}
      </span>
      <span>Zoom: {zoomPercentual}%</span>
      <span>Peças: {props.totalDePecas}</span>
      <span>Seleção: {props.temSelecao ? '1 peça' : 'nenhuma'}</span>
      <span>Aproveitamento: — (encaixe ainda não implementado)</span>
    </div>
  );
}
