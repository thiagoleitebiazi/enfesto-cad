import type { Ponto2D } from '../core/geometria';
import type { TransformacaoDeTela } from './transformacaoDeTela';
import type { ProblemaDeValidacao } from '../domain/validacao';

interface BarraDeStatusProps {
  readonly cursorMundo: Ponto2D | null;
  readonly transform: TransformacaoDeTela;
  readonly totalDePecas: number;
  readonly temSelecao: boolean;
  readonly problemas: readonly ProblemaDeValidacao[];
  readonly onAlternarValidacao: () => void;
}

export function BarraDeStatus(props: BarraDeStatusProps): React.JSX.Element {
  const zoomPercentual = Math.round(props.transform.escalaPxPorMm * 100);
  const erros = props.problemas.filter((p) => p.severidade === 'erro').length;
  const avisos = props.problemas.filter((p) => p.severidade === 'aviso').length;

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
      <button
        className={`indicador-de-validacao ${erros > 0 ? 'tem-erro' : avisos > 0 ? 'tem-aviso' : ''}`}
        onClick={props.onAlternarValidacao}
      >
        Validação: {erros === 0 && avisos === 0 ? 'sem problemas' : `${erros} erro(s), ${avisos} aviso(s)`}
      </button>
    </div>
  );
}
