import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import type { ResultadoDeNesting } from '../domain/nesting';
import { arestaDeSimetria } from '../domain/anotacoes';
import { rotacoesNoEncaixe, type Molde } from '../domain/molde';
import { lerMedida } from './medidas';

export interface OpcoesAvancadasDeNesting {
  readonly limiteDeTempoMinutos?: number;
  readonly aproveitamentoDesejadoPercentual?: number;
  /** Cada tamanho das peças graduadas entra no encaixe como uma peça própria (só vem quando há peças graduadas). */
  readonly todosOsTamanhos?: boolean;
  /** As peças com linha de simetria entram no encaixe abertas, inteiras (só vem quando há peças assim). */
  readonly abrirSimetrias?: boolean;
  /** A distância entre os moldes (mm), de linha de corte a linha de corte: passa a ser a do enfesto. */
  readonly distanciaEntreMoldesMm: number;
}

interface PainelDeNestingProps {
  readonly pecas: readonly Molde[];
  /** A distância entre os moldes configurada no enfesto (mm): o campo começa com ela. */
  readonly distanciaEntreMoldesMm: number;
  /** O tecido de sentido único (pelo, estampa direcional): o encaixe não vira as peças. */
  readonly sentidoDoTecido?: { readonly nome: string; readonly sentido: string } | null;
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
  // A distância entre os moldes fica aqui, onde se pede o encaixe (antes, só no diálogo do Enfesto).
  const [distanciaEntreMoldes, setDistanciaEntreMoldes] = useState(() => String(props.distanciaEntreMoldesMm).replace('.', ','));
  const distanciaLida = lerMedida(distanciaEntreMoldes);
  const erroDaDistancia =
    distanciaEntreMoldes.trim() === '' || distanciaLida === null || distanciaLida < 0 ? 'A distância entre os moldes precisa ser um número de 0 mm para cima.' : null;
  const temGraduadas = props.pecas.some((p) => p.graduacao !== undefined);
  const [todosOsTamanhos, setTodosOsTamanhos] = useState(true);
  const temSimetria = props.pecas.some((p) => arestaDeSimetria(p) !== null);
  const [abrirSimetrias, setAbrirSimetrias] = useState(true);
  /** Os tamanhos com que a peça entra no encaixe: todos os da graduação, só o base, ou o dela. */
  const tamanhosDa = (p: Molde): string => {
    if (!p.graduacao) return p.tamanho.trim() === '' ? '—' : p.tamanho;
    return todosOsTamanhos ? p.graduacao.tamanhos.join(', ') : p.graduacao.tamanhos[p.graduacao.base]!;
  };

  function aoCalcular(): void {
    if (erroDaDistancia !== null || distanciaLida === null) return;
    const minutos = Number(limiteDeTempoMinutos);
    const aproveitamento = Number(aproveitamentoDesejadoPercentual);
    props.onCalcular({
      ...(limiteDeTempoMinutos.trim() !== '' && minutos > 0 ? { limiteDeTempoMinutos: minutos } : {}),
      ...(aproveitamentoDesejadoPercentual.trim() !== '' && aproveitamento > 0
        ? { aproveitamentoDesejadoPercentual: aproveitamento }
        : {}),
      ...(temGraduadas ? { todosOsTamanhos } : {}),
      ...(temSimetria ? { abrirSimetrias } : {}),
      distanciaEntreMoldesMm: distanciaLida,
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
                Distância entre os moldes (mm)
                <input
                  type="text"
                  inputMode="decimal"
                  value={distanciaEntreMoldes}
                  aria-invalid={erroDaDistancia !== null}
                  onChange={(e) => setDistanciaEntreMoldes(e.target.value)}
                />
              </label>
              {erroDaDistancia && (
                <p className="mensagem-de-erro" role="alert">
                  {erroDaDistancia}
                </p>
              )}
              <p className="nota-do-formulario">
                Medida de linha de corte a linha de corte: cada molde é encostado nos vizinhos até essa distância. Fica
                guardada no enfesto do projeto.
              </p>
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
              {temSimetria && (
                <>
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={abrirSimetrias} onChange={(e) => setAbrirSimetrias(e.target.checked)} />
                    Abrir as peças com linha de simetria
                  </label>
                  <p className="legenda-inline">
                    {abrirSimetrias
                      ? 'A peça dobrada entra no encaixe aberta, inteira. Ao aplicar, passa a ser a peça inteira (Ctrl+Z desfaz).'
                      : 'A peça com linha de simetria entra como está desenhada: meia peça.'}
                  </p>
                </>
              )}
              {temGraduadas && (
                <>
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={todosOsTamanhos} onChange={(e) => setTodosOsTamanhos(e.target.checked)} />
                    Encaixar todos os tamanhos das peças graduadas
                  </label>
                  <p className="legenda-inline">
                    {todosOsTamanhos
                      ? 'Cada tamanho entra como uma peça própria. Ao aplicar o encaixe, as peças graduadas passam a ser essas peças, sem graduação (Ctrl+Z desfaz).'
                      : 'Só o tamanho base de cada peça graduada entra no encaixe.'}
                  </p>
                </>
              )}
            </form>

            <div className="painel-de-nesting-config-pecas">
              <p className="legenda-inline">Peças e restrições (sentido do fio)</p>
              <table className="tabela-de-pecas-nesting">
                <thead>
                  <tr>
                    <th>Peça</th>
                    <th>Tamanho</th>
                    <th>Qtd</th>
                    <th>Rotação</th>
                    <th>Espelho</th>
                  </tr>
                </thead>
                <tbody>
                  {props.pecas.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{tamanhosDa(p)}</td>
                      <td>{p.quantidade}</td>
                      <td>{rotacoesNoEncaixe(p.restricaoDeRotacao, Boolean(props.sentidoDoTecido)).map((r) => `${r}°`).join(', ')}</td>
                      <td>{p.restricaoDeRotacao.permiteEspelhamento ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="legenda-inline">
                Só informativo — ajuste pelo painel "Propriedades" antes de calcular, se precisar.
              </p>
              {props.sentidoDoTecido && (
                <p className="legenda-inline">
                  O tecido “{props.sentidoDoTecido.nome}” {props.sentidoDoTecido.sentido}: o encaixe não vira peças 180° nem 270°,
                  para todas ficarem no mesmo sentido.
                </p>
              )}
            </div>

            <div className="acoes-da-sobreposicao painel-de-nesting-config-acoes">
              <button type="button" onClick={props.onFechar}>
                Cancelar
              </button>
              <button type="button" onClick={aoCalcular} className="botao-primario" disabled={erroDaDistancia !== null}>
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
