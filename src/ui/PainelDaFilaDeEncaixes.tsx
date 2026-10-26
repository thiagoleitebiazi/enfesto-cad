import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import {
  cancelarTrabalho,
  contagemDaFila,
  copiasDoTrabalho,
  descricaoDasOpcoes,
  estaPendente,
  estaTerminado,
  melhoresPorProjeto,
  moverNaFila,
  mudarPrioridade,
  pausarAFila,
  pausarTrabalho,
  podeMover,
  posicaoNaFila,
  reenfileirarTrabalho,
  relatorioDaFila,
  removerTerminados,
  removerTrabalho,
  retomarTrabalho,
  ROTULO_DA_PRIORIDADE,
  ROTULO_DA_SITUACAO_NA_FILA,
  trabalhosNaOrdem,
  type FilaDeEncaixes,
  type PrioridadeNaFila,
  type TrabalhoDeEncaixe,
} from '../domain/filaDeEncaixes';
import { numeroComVirgula } from '../core/numeros';
import type { ProgressoNaFila } from './useFilaDeEncaixes';
import type { FilaNaRedeNaTela } from './useFilaNaRede';

type Parte = 'fila' | 'relatorio';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const quando = (iso: string | undefined): string => (iso ? DATA.format(new Date(iso)) : '—');
const segundos = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : ms < 60_000 ? `${numeroComVirgula(ms / 1000, 1)} s` : `${numeroComVirgula(ms / 60_000, 1)} min`;

/**
 * A fila de encaixes (ADR 0102): os encaixes esperando a vez, o que está calculando (com o progresso), os
 * terminados com o resultado — aplicar no projeto, comparar (o melhor de cada projeto) — e o relatório de
 * eficiência. A fila roda sozinha, um encaixe de cada vez, enquanto o programa está aberto.
 */
export function PainelDaFilaDeEncaixes(props: {
  readonly fila: FilaDeEncaixes;
  readonly progresso: ProgressoNaFila | null;
  readonly avisos: readonly string[];
  readonly somenteLeitura: boolean;
  readonly projetoAbertoId: string;
  /** Se o projeto está na Biblioteca (para abrir). */
  readonly projetoExiste: (projetoId: string) => boolean;
  /** Muda a fila; a recusa vem como exceção (com o motivo). */
  readonly onMudar: (mudanca: (fila: FilaDeEncaixes) => FilaDeEncaixes) => void;
  readonly onAplicar: (id: string) => void;
  readonly onAbrirProjeto: (projetoId: string) => void;
  readonly onExportarCsv: () => void;
  readonly agoraIso: () => string;
  readonly onFechar: () => void;
  /** A fila na rede (ADR 0143); sem a pasta (fora do programa), não aparece. */
  readonly rede?: FilaNaRedeNaTela | null;
}): React.JSX.Element {
  const { fila } = props;
  const [parte, setParte] = useState<Parte>('fila');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const trabalhos = trabalhosNaOrdem(fila);
  const contagem = contagemDaFila(fila);
  const melhores = melhoresPorProjeto(fila);
  const relatorio = relatorioDaFila(fila);
  const terminados = trabalhos.filter(estaTerminado).length;

  const mudar = (mudanca: (f: FilaDeEncaixes) => FilaDeEncaixes, sucesso?: string): void => {
    try {
      props.onMudar(mudanca);
      setMensagem(sucesso ?? null);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
    }
  };

  const resumo = [
    contagem.executando > 0 ? `${contagem.executando} calculando` : null,
    contagem.aguardando > 0 ? `${contagem.aguardando} aguardando` : null,
    contagem.pausado > 0 ? `${contagem.pausado} pausado(s)` : null,
    contagem['na-rede'] > 0 ? `${contagem['na-rede']} na fila da rede` : null,
    contagem.concluido > 0 ? `${contagem.concluido} concluído(s)` : null,
    contagem.falhou > 0 ? `${contagem.falhou} com falha` : null,
    contagem.cancelado > 0 ? `${contagem.cancelado} cancelado(s)` : null,
  ].filter((x) => x !== null);

  const PARTES: ReadonlyArray<readonly [Parte, string]> = [
    ['fila', `Encaixes (${trabalhos.length})`],
    ['relatorio', 'Relatório de eficiência'],
  ];

  return (
    <Sobreposicao titulo="Fila de encaixes" onFechar={props.onFechar}>
      <div className="painel-da-fila-de-encaixes">
        <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da fila de encaixes">
          {PARTES.map(([id, rotulo]) => (
            <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
              {rotulo}
            </button>
          ))}
        </div>

        <div className={`estado-da-fila ${fila.pausada ? 'fila-pausada' : 'fila-rodando'}`} role="status">
          <strong>{fila.pausada ? 'Fila pausada' : contagem.executando > 0 ? 'Fila rodando' : 'Fila livre'}</strong>
          <span>{resumo.length === 0 ? 'nenhum encaixe na fila' : resumo.join(' · ')}</span>
          <span className="acoes-da-fila">
            <button type="button" onClick={() => mudar((f) => pausarAFila(f, !f.pausada))}>
              {fila.pausada ? 'Retomar a fila' : 'Pausar a fila'}
            </button>
            <button type="button" disabled={terminados === 0} onClick={() => mudar(removerTerminados, `${terminados} encaixe(s) terminado(s) tirado(s) da fila.`)}>
              Limpar os terminados
            </button>
            <button type="button" disabled={trabalhos.length === 0} onClick={props.onExportarCsv}>
              Exportar CSV
            </button>
          </span>
        </div>
        <p className="nota-do-formulario">
          Os encaixes são calculados um de cada vez, em segundo plano, enquanto o programa está aberto: dá para continuar
          desenhando ou abrir outro projeto. Cada um usa as peças e a mesa de quando entrou na fila (pelo Nesting
          automático › Pôr na fila). Pausar a fila deixa terminar o que está calculando; pausar um encaixe no meio faz ele
          recomeçar do início ao ser retomado — o mesmo se o programa for fechado no meio.
        </p>
        {props.rede && <FilaDaRede rede={props.rede} />}
        {props.somenteLeitura && <p className="mensagem-de-erro">A fila foi gravada por uma versão mais nova do programa: as mudanças aqui não são gravadas.</p>}
        {props.avisos.length > 0 && (
          <ul className="avisos-da-fila">
            {props.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        {mensagem && (
          <p className="nota-do-formulario" role="alert">
            {mensagem}
          </p>
        )}

        {parte === 'fila' &&
          (trabalhos.length === 0 ? (
            <p className="nota-do-formulario">
              A fila está vazia. Para pôr um encaixe nela: Encaixe › Nesting automático, escolha as opções e clique em “Pôr na fila”.
            </p>
          ) : (
            <table className="tabela-de-relatorio tabela-da-fila">
              <caption>Encaixes na fila</caption>
              <thead>
                <tr>
                  <th scope="col">Vez</th>
                  <th scope="col">Projeto</th>
                  <th scope="col">Opções</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Prioridade</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {trabalhos.map((t) => (
                  <LinhaDoTrabalho
                    key={t.id}
                    trabalho={t}
                    fila={fila}
                    progresso={props.progresso?.id === t.id ? props.progresso : null}
                    melhor={melhores.has(t.id)}
                    aberto={t.projetoId === props.projetoAbertoId}
                    projetoExiste={props.projetoExiste(t.projetoId)}
                    mudar={mudar}
                    agoraIso={props.agoraIso}
                    onAplicar={() => props.onAplicar(t.id)}
                    onAbrirProjeto={() => props.onAbrirProjeto(t.projetoId)}
                    rede={props.rede ?? null}
                  />
                ))}
              </tbody>
            </table>
          ))}

        {parte === 'relatorio' && (
          <section aria-label="Relatório de eficiência">
            <dl className="indicadores-da-sala-de-corte">
              <div>
                <dt>Encaixes concluídos</dt>
                <dd>{relatorio.concluidos}</dd>
              </div>
              <div>
                <dt>Com peças de fora</dt>
                <dd>{relatorio.comPecasDeFora}</dd>
              </div>
              <div>
                <dt>Com falha</dt>
                <dd>{relatorio.falharam}</dd>
              </div>
              <div>
                <dt>Aproveitamento médio</dt>
                <dd>{relatorio.aproveitamentoMedio === null ? '—' : `${numeroComVirgula(relatorio.aproveitamentoMedio, 1)}%`}</dd>
              </div>
              <div>
                <dt>Melhor aproveitamento</dt>
                <dd>{relatorio.melhorAproveitamento === null ? '—' : `${numeroComVirgula(relatorio.melhorAproveitamento, 1)}%`}</dd>
              </div>
              <div>
                <dt>Comprimento somado</dt>
                <dd>{numeroComVirgula(relatorio.comprimentoTotalMm / 1000, 2)} m</dd>
              </div>
              <div>
                <dt>Tempo de cálculo (total / médio)</dt>
                <dd>
                  {segundos(relatorio.tempoTotalMs)} / {relatorio.tempoMedioMs === null ? '—' : segundos(relatorio.tempoMedioMs)}
                </dd>
              </div>
            </dl>
            <p className="nota-do-formulario">
              O aproveitamento é a área das peças ÷ (largura útil × comprimento usado) de cada encaixe; a média dá o mesmo peso
              a cada um. A estrela (★) marca o melhor encaixe de um projeto com mais de um concluído: primeiro o que pôs todas as
              peças, depois o de maior aproveitamento, depois o mais curto. O CSV traz todos os encaixes da fila.
            </p>
          </section>
        )}
      </div>
    </Sobreposicao>
  );
}

/** A pasta da fila na rede, o nome desta estação e se ela atende os pedidos das outras (ADR 0143). */
function FilaDaRede({ rede }: { readonly rede: FilaNaRedeNaTela }): React.JSX.Element {
  return (
    <fieldset className="grupo-de-opcoes-do-formulario fila-da-rede">
      <legend>Fila na rede</legend>
      <p className="nota-do-formulario">
        {rede.onde ? (
          <>
            Pasta: <strong>{rede.onde}</strong>.
          </>
        ) : (
          'Nenhuma pasta escolhida.'
        )}{' '}
        Uma pasta da rede que as estações usam como servidor de encaixes: “Mandar para a rede” põe um encaixe que espera a vez lá; a estação que atende a fila o
        calcula, e o resultado volta para a fila de quem mandou.
      </p>
      <p className="acoes-da-fila">
        <button type="button" onClick={() => void rede.escolher()}>
          {rede.onde ? 'Trocar de pasta…' : 'Escolher a pasta…'}
        </button>
        {rede.onde && (
          <button type="button" onClick={() => void rede.esquecer()}>
            Deixar de usar a pasta
          </button>
        )}
      </p>
      {rede.onde && (
        <>
          <label>
            Nome desta estação
            <input type="text" value={rede.quem} maxLength={60} onChange={(e) => rede.mudarQuem(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={rede.atender} onChange={(e) => rede.mudarAtender(e.target.checked)} /> Atender a fila da rede nesta estação (calcula os
            pedidos das outras, um de cada vez, enquanto o programa está aberto)
          </label>
        </>
      )}
      {rede.mensagem && (
        <p role="status" className="recado-da-rede">
          {rede.mensagem}
        </p>
      )}
    </fieldset>
  );
}

function LinhaDoTrabalho(props: {
  readonly trabalho: TrabalhoDeEncaixe;
  readonly fila: FilaDeEncaixes;
  readonly progresso: ProgressoNaFila | null;
  readonly melhor: boolean;
  /** O projeto do encaixe é o aberto na tela. */
  readonly aberto: boolean;
  readonly projetoExiste: boolean;
  readonly mudar: (mudanca: (f: FilaDeEncaixes) => FilaDeEncaixes, sucesso?: string) => void;
  readonly agoraIso: () => string;
  readonly onAplicar: () => void;
  readonly onAbrirProjeto: () => void;
  readonly rede: FilaNaRedeNaTela | null;
}): React.JSX.Element {
  const { trabalho: t, fila } = props;
  const r = t.resultado;
  const posicao = posicaoNaFila(fila, t.id);
  const total = copiasDoTrabalho(t);
  const progresso = props.progresso;
  return (
    <tr className={props.melhor ? 'trabalho-melhor' : undefined}>
      <td className="coluna-numerica">{posicao ?? '—'}</td>
      <td>
        <strong>{t.projetoNome}</strong>
        <br />
        <small>
          {t.projetoCodigo} · entrou {quando(t.criadoEmIso)}
          {props.aberto ? ' · aberto' : ''}
          {t.pedidoDaRede ? ` · pedido de ${t.pedidoDaRede.pedidoPor} pela rede` : ''}
          {t.calculadoPor ? ` · calculado por ${t.calculadoPor} na rede` : ''}
        </small>
      </td>
      <td>
        {descricaoDasOpcoes(t.opcoes)}
        <br />
        <small>
          {total} cópia(s) de peça · mesa {numeroComVirgula(t.enfesto.larguraUtilMm / 10, 1)} × {numeroComVirgula(t.enfesto.comprimentoMm / 10, 1)} cm
        </small>
      </td>
      <td>
        <span className={`situacao-da-execucao situacao-${t.situacao}`}>{ROTULO_DA_SITUACAO_NA_FILA[t.situacao]}</span>
        {t.situacao === 'executando' && (
          <div className="barra-de-progresso" aria-label="Progresso do cálculo">
            <div className="barra-de-progresso-preenchimento" style={{ width: `${progresso ? Math.round((progresso.colocadas / Math.max(1, progresso.total)) * 100) : 0}%` }} />
          </div>
        )}
        {t.situacao === 'executando' && progresso && (
          <small>
            {progresso.colocadas} / {progresso.total} peças
          </small>
        )}
        {(t.recomecos ?? 0) > 0 && estaPendente(t) && <small> recomeça do início</small>}
        {t.erro && (
          <>
            <br />
            <small className="texto-de-erro">{t.erro}</small>
          </>
        )}
      </td>
      <td>
        {estaPendente(t) ? (
          <select
            aria-label={`Prioridade de ${t.projetoNome}`}
            value={t.prioridade}
            onChange={(e) => props.mudar((f) => mudarPrioridade(f, t.id, e.target.value as PrioridadeNaFila))}
          >
            {(Object.keys(ROTULO_DA_PRIORIDADE) as PrioridadeNaFila[]).map((p) => (
              <option key={p} value={p}>
                {ROTULO_DA_PRIORIDADE[p]}
              </option>
            ))}
          </select>
        ) : (
          ROTULO_DA_PRIORIDADE[t.prioridade]
        )}
      </td>
      <td>
        {r ? (
          <>
            <strong>
              {props.melhor ? '★ ' : ''}
              {numeroComVirgula(r.aproveitamentoPercentual, 1)}%
            </strong>{' '}
            · {numeroComVirgula(r.comprimentoUtilizadoMm / 1000, 2)} m
            <br />
            <small>
              {r.pecasColocadas.length} de {r.pecasColocadas.length + r.pecasNaoColocadas.length} peças postas
              {r.pecasNaoColocadas.length > 0 ? ` · ${r.pecasNaoColocadas.length} de fora` : ''} · {segundos(r.tempoDeProcessamentoMs)}
              {r.paradaPorTempoLimite ? ' · parou no limite de tempo' : ''}
              {r.paradaPorMetaDeAproveitamento ? ' · parou na meta' : ''}
            </small>
            {t.aplicadoEmIso && (
              <>
                <br />
                <small>Aplicado {quando(t.aplicadoEmIso)}</small>
              </>
            )}
          </>
        ) : (
          '—'
        )}
      </td>
      <td>
        <span className="acoes-do-trabalho">
          {estaPendente(t) && (
            <>
              <button type="button" title="Subir na fila" aria-label={`Subir ${t.projetoNome} na fila`} disabled={!podeMover(fila, t.id, -1)} onClick={() => props.mudar((f) => moverNaFila(f, t.id, -1))}>
                ↑
              </button>
              <button type="button" title="Descer na fila" aria-label={`Descer ${t.projetoNome} na fila`} disabled={!podeMover(fila, t.id, 1)} onClick={() => props.mudar((f) => moverNaFila(f, t.id, 1))}>
                ↓
              </button>
            </>
          )}
          {(t.situacao === 'aguardando' || t.situacao === 'executando') && (
            <button type="button" onClick={() => props.mudar((f) => pausarTrabalho(f, t.id))}>
              Pausar
            </button>
          )}
          {t.situacao === 'pausado' && (
            <button type="button" onClick={() => props.mudar((f) => retomarTrabalho(f, t.id))}>
              Retomar
            </button>
          )}
          {(estaPendente(t) || t.situacao === 'executando') && (
            <button type="button" onClick={() => props.mudar((f) => cancelarTrabalho(f, t.id, props.agoraIso()))}>
              Cancelar
            </button>
          )}
          {t.situacao === 'concluido' && r && r.pecasColocadas.length > 0 && !t.pedidoDaRede && (
            <>
              {!props.aberto && props.projetoExiste && (
                <button type="button" onClick={props.onAbrirProjeto}>
                  Abrir o projeto
                </button>
              )}
              <button
                type="button"
                className={props.aberto ? 'botao-primario' : undefined}
                title={props.aberto ? 'Põe o encaixe na mesa. As peças que mudaram depois dele entram como estão agora, no lugar das de antes (Ctrl+Z desfaz).' : undefined}
                onClick={props.onAplicar}
              >
                {props.aberto ? 'Aplicar no projeto' : 'Aplicar no aberto…'}
              </button>
            </>
          )}
          {(t.situacao === 'falhou' || t.situacao === 'cancelado') && (
            <button type="button" onClick={() => props.mudar((f) => reenfileirarTrabalho(f, t.id))}>
              Pôr de novo na fila
            </button>
          )}
          {props.rede?.onde && estaPendente(t) && !t.pedidoDaRede && (
            <button type="button" title="Põe o encaixe na pasta da rede: a estação que atende a fila o calcula, e o resultado volta para cá." onClick={() => void props.rede?.mandar(t.id)}>
              Mandar para a rede
            </button>
          )}
          {t.situacao === 'na-rede' && props.rede && (
            <button type="button" onClick={() => void props.rede?.trazerDeVolta(t.id)}>
              Trazer de volta
            </button>
          )}
          {t.situacao !== 'executando' && t.situacao !== 'na-rede' && (
            <button type="button" onClick={() => props.mudar((f) => removerTrabalho(f, t.id))}>
              Remover
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}
