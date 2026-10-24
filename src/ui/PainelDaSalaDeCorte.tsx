import { useMemo, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { ExecucaoDoCorteNaTela } from './ExecucaoDoPlano';
import { salvarRolo, type CadastroDeProducao, type SituacaoDaExecucao } from '../domain/cadastroDeProducao';
import { comparativoDaExecucao, planoDaExecucao, ROTULO_DA_SITUACAO } from '../domain/execucaoDoCorte';
import {
  consumoPorMalha,
  csvDasExecucoes,
  csvDoConsumoPorMalha,
  indicadoresDaSalaDeCorte,
  malhaDaExecucao,
  OPCOES_PADRAO_DAS_SUGESTOES,
  retalhosEmEstoque,
  sugestoesDeCorrecao,
} from '../domain/salaDeCorte';
import { escreverM } from '../domain/planoDeCorte';
import { numeroComVirgula } from '../core/numeros';

type Parte = 'ordens' | 'indicadores' | 'retalhos' | 'relatorios';
type Filtro = 'abertas' | 'concluida' | 'cancelada' | 'todas';
type Periodo = '7' | '30' | 'tudo';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const quando = (iso: string | undefined): string => (iso ? DATA.format(new Date(iso)) : '—');
const duracao = (min: number | null): string => (min === null ? '—' : min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`);
const sinal = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '');
const percentual = (p: number | null): string => (p === null ? '—' : `${sinal(p)}${numeroComVirgula(Math.abs(p), 1)}%`);
const ORDEM_DAS_SITUACOES: Readonly<Record<SituacaoDaExecucao, number>> = { 'em-corte': 0, liberada: 1, concluida: 2, cancelada: 3 };

/**
 * A sala de corte (ADR 0100): todas as ordens de corte do cadastro, de todos os projetos — começar e concluir daqui,
 * sem abrir o projeto —, os indicadores do período, as sugestões de correção tiradas do planejado × executado, os
 * retalhos em estoque e os relatórios (histórico para auditoria e consumo por malha para compras, em CSV).
 */
export function PainelDaSalaDeCorte(props: {
  readonly cadastro: CadastroDeProducao;
  readonly somenteLeitura: boolean;
  readonly nomeDoProjeto: (projetoId: string) => string;
  readonly agoraIso: () => string;
  readonly novoId: (prefixo: string) => string;
  /** Grava o cadastro mudado; devolve a mensagem do erro, ou `null`. */
  readonly onMudarCadastro: (novo: CadastroDeProducao) => Promise<string | null>;
  /** Abre a janela de salvar um arquivo de texto; devolve o caminho salvo, ou `null` (cancelado). */
  readonly onSalvarTexto: (sugestaoDeNome: string, conteudo: string) => Promise<string | null>;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const { cadastro } = props;
  const [parte, setParte] = useState<Parte>('ordens');
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [aberta, setAberta] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const agora = props.agoraIso();
  const desdeIso = periodo === 'tudo' ? undefined : new Date(Date.parse(agora) - Number(periodo) * 86_400_000).toISOString();
  const execucoes = useMemo(
    () =>
      cadastro.execucoes
        .filter((e) => (filtro === 'abertas' ? e.situacao === 'liberada' || e.situacao === 'em-corte' : filtro === 'todas' || e.situacao === filtro))
        .slice()
        .sort((a, b) => ORDEM_DAS_SITUACOES[a.situacao] - ORDEM_DAS_SITUACOES[b.situacao] || b.liberadaEmIso.localeCompare(a.liberadaEmIso)),
    [cadastro.execucoes, filtro],
  );
  const indicadores = indicadoresDaSalaDeCorte(cadastro, desdeIso);
  const sugestoes = sugestoesDeCorrecao(cadastro, { ...OPCOES_PADRAO_DAS_SUGESTOES, agoraIso: agora }, desdeIso);
  const retalhos = retalhosEmEstoque(cadastro);

  /** Calcula a mudança (o erro aparece na janela, sem mudar nada) e grava. */
  const mudar = async (fazer: () => CadastroDeProducao, sucesso: string): Promise<boolean> => {
    if (props.somenteLeitura) {
      setMensagem('O cadastro foi gravado por uma versão mais nova do programa: aqui ele só é mostrado, não gravado.');
      return false;
    }
    let novo: CadastroDeProducao;
    try {
      novo = fazer();
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
      return false;
    }
    const erro = await props.onMudarCadastro(novo);
    setMensagem(erro ?? sucesso);
    return erro === null;
  };

  const exportar = async (nome: string, conteudo: string): Promise<void> => {
    const caminho = await props.onSalvarTexto(nome, conteudo);
    if (caminho) setMensagem(`Salvo em ${caminho}.`);
  };

  const PARTES: ReadonlyArray<readonly [Parte, string]> = [
    ['ordens', `Ordens de corte (${indicadores.abertas.liberadas + indicadores.abertas.emCorte} abertas)`],
    ['indicadores', 'Indicadores e sugestões'],
    ['retalhos', `Retalhos (${retalhos.length})`],
    ['relatorios', 'Relatórios'],
  ];

  return (
    <Sobreposicao titulo="Sala de corte" onFechar={props.onFechar}>
      <div className="painel-da-sala-de-corte">
        <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da sala de corte">
          {PARTES.map(([id, rotulo]) => (
            <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {mensagem && (
          <p className="nota-do-formulario" role="status">
            {mensagem}
          </p>
        )}

        {parte === 'ordens' && (
          <section aria-label="Ordens de corte">
            <div className="acoes-em-linha">
              <label>
                Mostrar
                <select
                  value={filtro}
                  onChange={(e) => {
                    setFiltro(e.target.value as Filtro);
                    setAberta(null);
                  }}
                >
                  <option value="abertas">Abertas (liberadas e em corte)</option>
                  <option value="concluida">Concluídas</option>
                  <option value="cancelada">Canceladas</option>
                  <option value="todas">Todas</option>
                </select>
              </label>
            </div>
            {execucoes.length === 0 ? (
              <p className="nota-do-formulario">
                {cadastro.execucoes.length === 0
                  ? 'Nenhuma ordem de corte ainda: libere um plano confirmado para o corte (Planejamento de corte › Planos deste projeto).'
                  : 'Nenhuma ordem nesta situação.'}
              </p>
            ) : (
              <table className="tabela-de-relatorio">
                <caption>Ordens de corte</caption>
                <thead>
                  <tr>
                    <th scope="col">Ordem</th>
                    <th scope="col">Projeto</th>
                    <th scope="col">Malha</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Liberada</th>
                    <th scope="col">Operador</th>
                    <th scope="col" className="coluna-numerica">Camadas</th>
                    <th scope="col" className="coluna-numerica">Consumo</th>
                    <th scope="col" className="coluna-numerica">Desvio</th>
                    <th scope="col" className="coluna-numerica">Tempo</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {execucoes.map((e) => {
                    const c = comparativoDaExecucao(e);
                    return (
                      <FragmentoDaOrdem
                        key={e.id}
                        aberta={aberta === e.id}
                        linha={
                          <tr>
                            <td>{e.ordem}</td>
                            <td>{props.nomeDoProjeto(e.projetoId)}</td>
                            <td>{malhaDaExecucao(cadastro, e)}</td>
                            <td>
                              <span className={`situacao-da-execucao situacao-${e.situacao}`}>{ROTULO_DA_SITUACAO[e.situacao]}</span>
                            </td>
                            <td>
                              {quando(e.liberadaEmIso)} — {e.liberadaPor}
                            </td>
                            <td>{e.operador ?? '—'}</td>
                            <td className="coluna-numerica">
                              {e.camadasRealizadas ?? '—'} / {e.camadasPlanejadas}
                            </td>
                            <td className="coluna-numerica">
                              {c.consumoRealMm === null ? '—' : escreverM(c.consumoRealMm)} / {escreverM(c.consumoPlanejadoMm)}
                            </td>
                            <td className="coluna-numerica">{percentual(c.diferencaPercentual)}</td>
                            <td className="coluna-numerica">{duracao(c.duracaoMin)}</td>
                            <td>
                              <button type="button" aria-expanded={aberta === e.id} onClick={() => setAberta(aberta === e.id ? null : e.id)}>
                                {aberta === e.id ? 'Fechar' : e.situacao === 'liberada' ? 'Começar…' : e.situacao === 'em-corte' ? 'Concluir…' : 'Ver'}
                              </button>
                            </td>
                          </tr>
                        }
                        detalhe={
                          <ExecucaoDoCorteNaTela
                            semTitulo
                            paraExecutar={planoDaExecucao(e)}
                            cadastro={cadastro}
                            responsavelSugerido=""
                            agoraIso={props.agoraIso}
                            novoId={props.novoId}
                            onMudar={mudar}
                          />
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {parte === 'indicadores' && (
          <section aria-label="Indicadores e sugestões">
            <label>
              Período
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="tudo">Tudo</option>
              </select>
            </label>
            <dl className="indicadores-da-sala-de-corte">
              <div>
                <dt>Cortes concluídos</dt>
                <dd>{indicadores.cortesConcluidos}</dd>
              </div>
              <div>
                <dt>Abertas agora</dt>
                <dd>
                  {indicadores.abertas.liberadas} liberada(s), {indicadores.abertas.emCorte} em corte
                </dd>
              </div>
              <div>
                <dt>Malha cortada (real / planejada)</dt>
                <dd>
                  {escreverM(indicadores.consumoRealMm)} / {escreverM(indicadores.consumoPlanejadoMm)}
                </dd>
              </div>
              <div>
                <dt>Desvio do consumo</dt>
                <dd>{percentual(indicadores.desvioPercentual)}</dd>
              </div>
              <div>
                <dt>Camadas (realizadas / planejadas)</dt>
                <dd>
                  {indicadores.camadasRealizadas} / {indicadores.camadasPlanejadas}
                </dd>
              </div>
              <div>
                <dt>Tempo de corte (total / médio)</dt>
                <dd>
                  {duracao(indicadores.tempoTotalMin)} / {duracao(indicadores.tempoMedioMin)}
                </dd>
              </div>
              <div>
                <dt>Metros por hora de corte</dt>
                <dd>{indicadores.metrosPorHora === null ? '—' : `${numeroComVirgula(indicadores.metrosPorHora, 1)} m/h`}</dd>
              </div>
            </dl>
            {indicadores.porOperador.length > 0 && (
              <table className="tabela-de-relatorio">
                <caption>Por operador</caption>
                <thead>
                  <tr>
                    <th scope="col">Operador (informado)</th>
                    <th scope="col" className="coluna-numerica">Cortes</th>
                    <th scope="col" className="coluna-numerica">Malha cortada</th>
                    <th scope="col" className="coluna-numerica">Desvio</th>
                    <th scope="col" className="coluna-numerica">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {indicadores.porOperador.map((o) => (
                    <tr key={o.operador}>
                      <td>{o.operador}</td>
                      <td className="coluna-numerica">{o.cortes}</td>
                      <td className="coluna-numerica">{numeroComVirgula(o.metrosReais, 2)} m</td>
                      <td className="coluna-numerica">{percentual(o.desvioPercentual)}</td>
                      <td className="coluna-numerica">{duracao(o.tempoMedioMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h4>Sugestões de correção</h4>
            {sugestoes.length === 0 ? (
              <p className="nota-do-formulario">Nada a corrigir no período: o consumo está dentro da tolerância e não há ordens paradas.</p>
            ) : (
              <ul className="sugestoes-da-sala-de-corte">
                {sugestoes.map((s) => (
                  <li key={s.texto} className={`alerta-do-plano alerta-${s.nivel}`}>
                    {s.texto}
                  </li>
                ))}
              </ul>
            )}
            <p className="nota-do-formulario">
              Os números são os informados por quem operou (sem máquina ligada). A sugestão do consumo compara o consumo por camada real com o planejado,
              nos cortes concluídos do período (tolerância de {numeroComVirgula(OPCOES_PADRAO_DAS_SUGESTOES.toleranciaPercentual, 0)}%, a partir de{' '}
              {OPCOES_PADRAO_DAS_SUGESTOES.minimoDeCortes} cortes).
            </p>
          </section>
        )}

        {parte === 'retalhos' && (
          <section aria-label="Retalhos">
            {retalhos.length === 0 ? (
              <p className="nota-do-formulario">Nenhum retalho no estoque. Ao concluir um corte, marque "a sobra vira retalho" nos rolos cuja sobra foi guardada.</p>
            ) : (
              <table className="tabela-de-relatorio">
                <caption>Retalhos no estoque</caption>
                <thead>
                  <tr>
                    <th scope="col">Rolo</th>
                    <th scope="col">Malha</th>
                    <th scope="col">Lote / tonalidade</th>
                    <th scope="col" className="coluna-numerica">Saldo</th>
                    <th scope="col">Onde está</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {retalhos.map(({ rolo, malha, saldoMm }) => (
                    <tr key={rolo.id}>
                      <td>{rolo.identificacao}</td>
                      <td>{malha}</td>
                      <td>
                        {rolo.lote} / {rolo.tonalidade}
                      </td>
                      <td className="coluna-numerica">{saldoMm === null ? '—' : escreverM(saldoMm)}</td>
                      <td>{rolo.localizacao ?? '—'}</td>
                      <td>
                        <button type="button" onClick={() => void mudar(() => salvarRolo(cadastro, { ...rolo, indisponivel: true }), `Retalho ${rolo.identificacao} tirado do estoque (usado ou descartado).`)}>
                          Usado ou descartado
                        </button>{' '}
                        <button type="button" onClick={() => void mudar(() => salvarRolo(cadastro, { ...rolo, retalho: false }), `${rolo.identificacao} não é mais retalho.`)}>
                          Não é retalho
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {parte === 'relatorios' && (
          <section aria-label="Relatórios">
            <label>
              Período do consumo por malha
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="tudo">Tudo</option>
              </select>
            </label>
            <table className="tabela-de-relatorio">
              <caption>Consumo por malha (para compras)</caption>
              <thead>
                <tr>
                  <th scope="col">Malha</th>
                  <th scope="col" className="coluna-numerica">Cortes</th>
                  <th scope="col" className="coluna-numerica">Planejado</th>
                  <th scope="col" className="coluna-numerica">Real</th>
                  <th scope="col" className="coluna-numerica">Real (kg)</th>
                </tr>
              </thead>
              <tbody>
                {consumoPorMalha(cadastro, desdeIso).map((c) => (
                  <tr key={c.malha}>
                    <td>{c.malha}</td>
                    <td className="coluna-numerica">{c.cortes}</td>
                    <td className="coluna-numerica">{escreverM(c.planejadoMm)}</td>
                    <td className="coluna-numerica">{escreverM(c.realMm)}</td>
                    <td className="coluna-numerica">{c.realG === null ? '—' : `${numeroComVirgula(c.realG / 1000, 2)} kg`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="acoes-em-linha">
              <button type="button" onClick={() => void exportar('consumo-por-malha.csv', csvDoConsumoPorMalha(consumoPorMalha(cadastro, desdeIso)))}>
                Exportar o consumo por malha (CSV)
              </button>{' '}
              <button type="button" onClick={() => void exportar('historico-da-sala-de-corte.csv', csvDasExecucoes(cadastro, props.nomeDoProjeto))}>
                Exportar o histórico de todas as ordens (CSV, para auditoria)
              </button>
            </div>
            <p className="nota-do-formulario">Os arquivos CSV usam ponto e vírgula e vírgula decimal, e abrem direto numa planilha em português.</p>
          </section>
        )}
      </div>
    </Sobreposicao>
  );
}

/** Uma linha da tabela e, aberta, os controles da execução logo abaixo dela (ocupando a largura toda). */
function FragmentoDaOrdem(props: { readonly linha: React.JSX.Element; readonly detalhe: React.JSX.Element; readonly aberta: boolean }): React.JSX.Element {
  return (
    <>
      {props.linha}
      {props.aberta && (
        <tr className="detalhe-da-ordem">
          <td colSpan={11}>{props.detalhe}</td>
        </tr>
      )}
    </>
  );
}
