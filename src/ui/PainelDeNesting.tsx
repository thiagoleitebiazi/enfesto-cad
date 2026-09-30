import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import type { ResultadoDeNesting } from '../domain/nesting';
import { rotacoesPermitidas, type Molde } from '../domain/molde';

export interface OpcoesAvancadasDeNesting {
  readonly limiteDeTempoMinutos?: number;
  readonly aproveitamentoDesejadoPercentual?: number;
}

interface PainelDeNestingProps {
  readonly pecas: readonly Molde[];
  readonly executando: boolean;
  readonly progresso: { readonly colocadas: number; readonly total: number } | null;
  readonly resultado: ResultadoDeNesting | null;
  readonly onCalcular: (opcoesAvancadas: OpcoesAvancadasDeNesting) => void;
  readonly onCancelar: () => void;
  readonly onAplicar: () => void;
  readonly onFechar: () => void;
}

export function PainelDeNesting(props: PainelDeNestingProps): React.JSX.Element {
  const [limiteDeTempoMinutos, setLimiteDeTempoMinutos] = useState('');
  const [aproveitamentoDesejadoPercentual, setAproveitamentoDesejadoPercentual] = useState('');

  function aoCalcular(): void {
    const minutos = Number(limiteDeTempoMinutos);
    const aproveitamento = Number(aproveitamentoDesejadoPercentual);
    props.onCalcular({
      ...(limiteDeTempoMinutos.trim() !== '' && minutos > 0 ? { limiteDeTempoMinutos: minutos } : {}),
      ...(aproveitamentoDesejadoPercentual.trim() !== '' && aproveitamento > 0
        ? { aproveitamentoDesejadoPercentual: aproveitamento }
        : {}),
    });
  }

  return (
    <Sobreposicao titulo="Nesting automático" onFechar={props.onFechar}>
      <div className="painel-de-nesting">
        {!props.executando && !props.resultado && (
          <div className="painel-de-nesting-config">
            <form
              className="formulario-de-sobreposicao painel-de-nesting-config-parametros"
              onSubmit={(e) => e.preventDefault()}
            >
              <p className="legenda-inline">Parâmetros gerais</p>
              <label>
                Limite de tempo (minutos)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={limiteDeTempoMinutos}
                  onChange={(e) => setLimiteDeTempoMinutos(e.target.value)}
                  placeholder="Sem limite"
                />
              </label>
              <label>
                Aproveitamento desejado (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={aproveitamentoDesejadoPercentual}
                  onChange={(e) => setAproveitamentoDesejadoPercentual(e.target.value)}
                  placeholder="Máximo possível"
                />
              </label>
              <p className="legenda-inline">
                O cálculo para assim que atingir o aproveitamento desejado, mesmo que ainda haja peças por
                posicionar.
              </p>
            </form>

            <div className="painel-de-nesting-config-pecas">
              <p className="legenda-inline">Peças e restrições (sentido do fio)</p>
              <table className="tabela-de-pecas-nesting">
                <thead>
                  <tr>
                    <th>Peça</th>
                    <th>Qtd</th>
                    <th>Rotação</th>
                    <th>Espelho</th>
                  </tr>
                </thead>
                <tbody>
                  {props.pecas.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{p.quantidade}</td>
                      <td>{rotacoesPermitidas(p.restricaoDeRotacao).map((r) => `${r}°`).join(', ')}</td>
                      <td>{p.restricaoDeRotacao.permiteEspelhamento ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="legenda-inline">
                Só informativo — ajuste pelo painel "Propriedades" antes de calcular, se precisar.
              </p>
            </div>

            <div className="acoes-da-sobreposicao painel-de-nesting-config-acoes">
              <button type="button" onClick={props.onFechar}>
                Cancelar
              </button>
              <button type="button" onClick={aoCalcular} className="botao-primario">
                Calcular encaixe
              </button>
            </div>
          </div>
        )}

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
              {props.resultado.paradaPorTempoLimite && (
                <>
                  <dt>Status</dt>
                  <dd>Parou por limite de tempo (resultado parcial)</dd>
                </>
              )}
              {props.resultado.paradaPorMetaDeAproveitamento && (
                <>
                  <dt>Status</dt>
                  <dd>Parou ao atingir o aproveitamento desejado</dd>
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
