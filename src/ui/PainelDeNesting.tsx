import { Sobreposicao } from './Sobreposicao';
import type { ResultadoDeNesting } from '../domain/nesting';

interface PainelDeNestingProps {
  readonly executando: boolean;
  readonly progresso: { readonly colocadas: number; readonly total: number } | null;
  readonly resultado: ResultadoDeNesting | null;
  readonly onCancelar: () => void;
  readonly onAplicar: () => void;
  readonly onFechar: () => void;
}

export function PainelDeNesting(props: PainelDeNestingProps): React.JSX.Element {
  return (
    <Sobreposicao titulo="Nesting automático" onFechar={props.onFechar}>
      <div className="painel-de-nesting">
        {props.executando && (
          <>
            <p>
              Calculando... {props.progresso ? `${props.progresso.colocadas} / ${props.progresso.total} peças` : ''}
            </p>
            <div className="barra-de-progresso">
              <div
                className="barra-de-progresso-preenchimento"
                style={{
                  width: props.progresso
                    ? `${Math.round((props.progresso.colocadas / Math.max(1, props.progresso.total)) * 100)}%`
                    : '0%',
                }}
              />
            </div>
            <div className="acoes-da-sobreposicao">
              <button onClick={props.onCancelar}>Cancelar</button>
            </div>
          </>
        )}

        {!props.executando && props.resultado && (
          <>
            <dl className="lista-de-propriedades">
              <dt>Peças colocadas</dt>
              <dd>{props.resultado.pecasColocadas.length}</dd>
              <dt>Peças não colocadas</dt>
              <dd>{props.resultado.pecasNaoColocadas.length}</dd>
              <dt>Comprimento utilizado</dt>
              <dd>{props.resultado.comprimentoUtilizadoMm.toFixed(1)} mm</dd>
              <dt>Aproveitamento</dt>
              <dd>{props.resultado.aproveitamentoPercentual.toFixed(1)}%</dd>
              <dt>Tempo de processamento</dt>
              <dd>{props.resultado.tempoDeProcessamentoMs} ms</dd>
              {props.resultado.interrompido && (
                <>
                  <dt>Status</dt>
                  <dd>Interrompido pelo usuário (resultado parcial)</dd>
                </>
              )}
            </dl>

            {props.resultado.pecasNaoColocadas.length > 0 && (
              <div className="faixa-de-avisos" style={{ position: 'static', marginTop: 8 }}>
                <strong>Não coube na área configurada:</strong>
                <ul>
                  {props.resultado.pecasNaoColocadas.map((p, i) => (
                    <li key={i}>
                      {p.nome} (cópia {p.indiceCopia + 1})
                    </li>
                  ))}
                </ul>
                <p>Estas peças NÃO aparecerão no layout se você aplicar. Ajuste quantidade/tecido/rotações permitidas e tente de novo, ou aplique mesmo assim e desfaça (Ctrl+Z) se preferir.</p>
              </div>
            )}

            <div className="acoes-da-sobreposicao">
              <button onClick={props.onFechar}>Descartar</button>
              <button onClick={props.onAplicar} className="botao-primario" disabled={props.resultado.pecasColocadas.length === 0}>
                Aplicar ao projeto
              </button>
            </div>
          </>
        )}
      </div>
    </Sobreposicao>
  );
}
