import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { FolhaDoDesenho } from './FolhaDoDesenho';
import type { Projeto } from '../domain/projeto';
import { lerFichaTecnica, ROTULO_DA_SITUACAO_DA_FICHA } from '../domain/fichaTecnica';
import { imagensDoProjeto } from '../domain/imagens';
import {
  adicionarComentario,
  adicionarTarefa,
  andamentoDaColecao,
  aprovarPiloto,
  avancarEtapa,
  cancelarModelo,
  colecoesNaOrdem,
  csvDasPendencias,
  csvDoMix,
  diaEscrito,
  ETAPAS,
  linhaDoTempo,
  marcarTarefa,
  novaColecao,
  novoModelo,
  pedirAlteracaoDaPiloto,
  pendenciasDePrazo,
  pessoasComPendencia,
  reabrirModelo,
  removerColecao,
  removerModelo,
  removerTarefa,
  resumoDoMix,
  revisaoDaPiloto,
  ROTULO_DA_ESTACAO,
  ROTULO_DA_ETAPA,
  salvarColecao,
  salvarModelo,
  voltarEtapa,
  type ArquivoDeColecoes,
  type Colecao,
  type Estacao,
  type EtapaDoModelo,
  type ModeloDaColecao,
  type PendenciaDePrazo,
} from '../domain/colecoes';
import { numeroComVirgula } from '../core/numeros';

export type ParteDaColecao = 'mix' | 'etapas' | 'tarefas' | 'andamento';

const situacaoDoPrazo = (dias: number): string => (dias < 0 ? `atrasado ${-dias} dia(s)` : dias === 0 ? 'hoje' : `em ${dias} dia(s)`);
const ehCor = (texto: string): boolean => /^#[0-9a-f]{6}$/i.test(texto.trim());

/**
 * A gestão de coleção (ADR 0108): as coleções, o mix de cada uma num quadro, o fluxo por etapas, as tarefas e os
 * prazos, o andamento e a linha do tempo; e o modelo, com o projeto ligado (o croqui da ficha), a aprovação da
 * peça-piloto, as tarefas, os comentários e o histórico. Cada mudança é gravada na hora.
 */
export function PainelDeColecoes(props: {
  readonly arquivo: ArquivoDeColecoes;
  readonly avisos: readonly string[];
  readonly somenteLeitura: boolean;
  readonly projetos: readonly Projeto[];
  readonly projetoAbertoId: string;
  readonly hoje: string;
  readonly responsavelSugerido: string;
  readonly parteInicial?: ParteDaColecao;
  readonly agoraIso: () => string;
  readonly novoId: () => string;
  readonly onMudar: (novo: ArquivoDeColecoes) => Promise<string | null>;
  readonly onAbrirProjeto: (projetoId: string) => void;
  readonly onSalvarTexto: (sugestaoDeNome: string, conteudo: string) => Promise<string | null>;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const { arquivo } = props;
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const lista = colecoesNaOrdem(arquivo.colecoes).filter((c) => mostrarArquivadas || !c.arquivada);
  const [escolhidaId, setEscolhidaId] = useState<string | null>(lista[0]?.id ?? null);
  const colecao = arquivo.colecoes.find((c) => c.id === escolhidaId) ?? null;
  const [parte, setParte] = useState<ParteDaColecao>(props.parteInicial ?? 'mix');
  const [editandoColecao, setEditandoColecao] = useState<Colecao | null>(null);
  const [modeloAbertoId, setModeloAbertoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const modelo = colecao?.modelos.find((m) => m.id === modeloAbertoId) ?? null;

  /** Calcula a mudança (o erro aparece na janela, sem mudar nada) e grava. */
  const mudar = async (fazer: () => ArquivoDeColecoes, sucesso: string | null = null): Promise<boolean> => {
    let novo: ArquivoDeColecoes;
    try {
      novo = fazer();
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
      return false;
    }
    const erro = await props.onMudar(novo);
    setMensagem(erro ?? sucesso);
    return erro === null;
  };
  const mudarColecao = (fazer: (c: Colecao) => Colecao, sucesso: string | null = null): Promise<boolean> =>
    mudar(() => salvarColecao(arquivo, fazer(colecao!)), sucesso);
  const mudarModelo = (fazer: (m: ModeloDaColecao) => ModeloDaColecao, sucesso: string | null = null): Promise<boolean> =>
    mudarColecao((c) => salvarModelo(c, fazer(c.modelos.find((m) => m.id === modeloAbertoId)!)), sucesso);

  const PARTES: ReadonlyArray<readonly [ParteDaColecao, string]> = [
    ['mix', `Mix (${colecao?.modelos.length ?? 0})`],
    ['etapas', 'Etapas'],
    ['tarefas', 'Tarefas e prazos'],
    ['andamento', 'Andamento'],
  ];

  return (
    <Sobreposicao titulo="Coleções" onFechar={props.onFechar}>
      <div className="painel-de-colecoes">
        <aside className="lista-de-colecoes" aria-label="Coleções">
          <button
            type="button"
            className="botao-primario"
            disabled={props.somenteLeitura}
            onClick={() => {
              setEditandoColecao(novaColecao({ nome: '', estacao: 'primavera-verao', ano: Number(props.hoje.slice(0, 4)) + 1, responsavel: props.responsavelSugerido }, props.novoId(), props.agoraIso()));
              setModeloAbertoId(null);
            }}
          >
            Nova coleção
          </button>
          <ul>
            {lista.map((c) => {
              const a = andamentoDaColecao(c, props.hoje);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={c.id === escolhidaId ? 'item-selecionado' : undefined}
                    onClick={() => {
                      setEscolhidaId(c.id);
                      setModeloAbertoId(null);
                      setEditandoColecao(null);
                    }}
                  >
                    <strong>{c.nome}</strong>
                    <small>
                      {ROTULO_DA_ESTACAO[c.estacao]} {c.ano}
                      {c.arquivada ? ' · arquivada' : ''}
                    </small>
                    <small>
                      {a.total} modelo(s){a.atrasados > 0 ? <span className="texto-de-erro"> · {a.atrasados} atrasado(s)</span> : null}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="opcao-em-linha">
            <input type="checkbox" checked={mostrarArquivadas} onChange={(e) => setMostrarArquivadas(e.target.checked)} />
            Mostrar as arquivadas
          </label>
        </aside>

        <section className="conteudo-da-colecao" aria-label="Coleção">
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
          {editandoColecao ? (
            <FormularioDaColecao
              colecao={editandoColecao}
              novoId={props.novoId}
              onCancelar={() => setEditandoColecao(null)}
              onGuardar={async (c) => {
                if (await mudar(() => salvarColecao(arquivo, c), `Coleção “${c.nome.trim()}” guardada.`)) {
                  setEditandoColecao(null);
                  setEscolhidaId(c.id);
                }
              }}
            />
          ) : !colecao ? (
            <p className="nota-do-formulario">
              Nenhuma coleção ainda. Uma coleção junta os modelos de uma estação (o mix), com as etapas de cada um, os prazos, as tarefas e a
              aprovação da peça-piloto. Clique em “Nova coleção”.
            </p>
          ) : modelo ? (
            <DetalheDoModelo
              colecao={colecao}
              modelo={modelo}
              projetos={props.projetos}
              projetoAbertoId={props.projetoAbertoId}
              hoje={props.hoje}
              responsavelSugerido={props.responsavelSugerido}
              agoraIso={props.agoraIso}
              novoId={props.novoId}
              travado={props.somenteLeitura}
              onVoltar={() => setModeloAbertoId(null)}
              onMudar={mudarModelo}
              onRemover={async () => {
                if (!window.confirm(`Tirar “${modelo.nome}” da coleção? (O projeto ligado não muda.)`)) return;
                if (await mudarColecao((c) => removerModelo(c, modelo.id), `“${modelo.nome}” saiu da coleção.`)) setModeloAbertoId(null);
              }}
              onAbrirProjeto={props.onAbrirProjeto}
            />
          ) : (
            <>
              <div className="cabecalho-da-ficha">
                <strong>{colecao.nome}</strong>
                <span>
                  {ROTULO_DA_ESTACAO[colecao.estacao]} {colecao.ano}
                </span>
                <span>
                  Lançamento: {colecao.lancamento ? `${diaEscrito(colecao.lancamento)} (${situacaoDoPrazo(andamentoDaColecao(colecao, props.hoje).diasParaOLancamento!)})` : 'sem data'}
                </span>
                {colecao.responsavel && <span>Responsável: {colecao.responsavel}</span>}
                <span className="acoes-da-fila">
                  <button type="button" disabled={props.somenteLeitura} onClick={() => setEditandoColecao(colecao)}>
                    Editar a coleção
                  </button>
                  <button
                    type="button"
                    disabled={props.somenteLeitura}
                    onClick={() => void mudarColecao((c) => ({ ...c, arquivada: !c.arquivada }), colecao.arquivada ? 'Coleção reaberta.' : 'Coleção arquivada.')}
                  >
                    {colecao.arquivada ? 'Desarquivar' : 'Arquivar'}
                  </button>
                  <button
                    type="button"
                    disabled={props.somenteLeitura}
                    onClick={() => {
                      if (window.confirm(`Apagar a coleção “${colecao.nome}” e os ${colecao.modelos.length} modelo(s) dela? (Os projetos ligados não mudam.)`)) {
                        void mudar(() => removerColecao(arquivo, colecao.id), 'Coleção apagada.').then((ok) => ok && setEscolhidaId(null));
                      }
                    }}
                  >
                    Apagar
                  </button>
                </span>
              </div>
              <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da coleção">
                {PARTES.map(([id, rotulo]) => (
                  <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
                    {rotulo}
                  </button>
                ))}
              </div>
              {parte === 'mix' && (
                <ParteMix
                  colecao={colecao}
                  projetos={props.projetos}
                  hoje={props.hoje}
                  travado={props.somenteLeitura}
                  onAbrirModelo={setModeloAbertoId}
                  onNovoModelo={async () => {
                    const m = novoModelo({ nome: `Modelo ${colecao.modelos.length + 1}`, responsavel: props.responsavelSugerido }, props.novoId());
                    if (await mudarColecao((c) => salvarModelo(c, m))) setModeloAbertoId(m.id);
                  }}
                  onExportar={() => void props.onSalvarTexto(`mix-${colecao.nome.replace(/[^A-Za-z0-9._-]+/g, '-')}.csv`, csvDoMix(colecao)).then((c) => c && setMensagem(`Salvo em ${c}.`))}
                />
              )}
              {parte === 'etapas' && (
                <ParteEtapas
                  colecao={colecao}
                  hoje={props.hoje}
                  travado={props.somenteLeitura}
                  onAbrirModelo={setModeloAbertoId}
                  onAvancar={(m) =>
                    void mudarColecao(
                      (c) => salvarModelo(c, avancarEtapa(m, { responsavel: props.responsavelSugerido || colecao.responsavel, comentario: '', agoraIso: props.agoraIso() })),
                      `“${m.nome}” foi para ${ROTULO_DA_ETAPA[ETAPAS[ETAPAS.indexOf(m.etapa) + 1]!].toLowerCase()}.`,
                    )
                  }
                />
              )}
              {parte === 'tarefas' && (
                <PartePendencias
                  colecoes={arquivo.colecoes}
                  colecao={colecao}
                  hoje={props.hoje}
                  travado={props.somenteLeitura}
                  onMarcar={(p, feita) =>
                    void mudar(() => {
                      const c = arquivo.colecoes.find((x) => x.id === p.colecaoId)!;
                      const m = c.modelos.find((x) => x.id === p.modeloId)!;
                      const tarefa = m.tarefas.find((t) => t.descricao === p.oQue && t.prazo === p.prazo && !t.feitaEmIso)!;
                      return salvarColecao(arquivo, salvarModelo(c, marcarTarefa(m, tarefa.id, feita, props.agoraIso())));
                    }, `Tarefa “${p.oQue}” feita.`)
                  }
                  onExportar={(pendencias) => void props.onSalvarTexto('prazos-e-tarefas.csv', csvDasPendencias(pendencias)).then((c) => c && setMensagem(`Salvo em ${c}.`))}
                />
              )}
              {parte === 'andamento' && <ParteAndamento colecao={colecao} hoje={props.hoje} />}
            </>
          )}
        </section>
      </div>
    </Sobreposicao>
  );
}

// ---- A coleção (nova ou mudada)

function FormularioDaColecao(props: { readonly colecao: Colecao; readonly novoId: () => string; readonly onCancelar: () => void; readonly onGuardar: (c: Colecao) => void }): React.JSX.Element {
  const [c, setC] = useState(props.colecao);
  return (
    <section aria-label="Dados da coleção">
      <form className="formulario-de-sobreposicao formulario-do-material" onSubmit={(e) => e.preventDefault()}>
        <label>
          Nome da coleção *
          <input value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} />
        </label>
        <label>
          Estação
          <select value={c.estacao} onChange={(e) => setC({ ...c, estacao: e.target.value as Estacao })}>
            {(Object.keys(ROTULO_DA_ESTACAO) as Estacao[]).map((s) => (
              <option key={s} value={s}>
                {ROTULO_DA_ESTACAO[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ano
          <input type="number" value={c.ano} onChange={(e) => setC({ ...c, ano: Number(e.target.value) })} />
        </label>
        <label>
          Lançamento
          <input type="date" value={c.lancamento} onChange={(e) => setC({ ...c, lancamento: e.target.value })} />
        </label>
        <label>
          Responsável
          <input value={c.responsavel} onChange={(e) => setC({ ...c, responsavel: e.target.value })} />
        </label>
        <label>
          Descrição
          <textarea rows={2} value={c.descricao} onChange={(e) => setC({ ...c, descricao: e.target.value })} />
        </label>
        <div className="precos-anteriores">
          <p className="legenda-inline">Marcos (datas da coleção)</p>
          {c.marcos.map((m) => (
            <div key={m.id} className="acoes-em-linha">
              <input aria-label="Nome do marco" value={m.nome} onChange={(e) => setC({ ...c, marcos: c.marcos.map((x) => (x.id === m.id ? { ...x, nome: e.target.value } : x)) })} />
              <input aria-label={`Data de ${m.nome}`} type="date" value={m.data} onChange={(e) => setC({ ...c, marcos: c.marcos.map((x) => (x.id === m.id ? { ...x, data: e.target.value } : x)) })} />
              <button type="button" onClick={() => setC({ ...c, marcos: c.marcos.filter((x) => x.id !== m.id) })}>
                Remover
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setC({ ...c, marcos: [...c.marcos, { id: props.novoId(), nome: 'Novo marco', data: c.lancamento || '' }] })}>
            Adicionar marco
          </button>
        </div>
      </form>
      <div className="acoes-da-sobreposicao">
        <button type="button" onClick={props.onCancelar}>
          Cancelar
        </button>
        <button type="button" className="botao-primario" onClick={() => props.onGuardar(c)}>
          Guardar a coleção
        </button>
      </div>
    </section>
  );
}

// ---- O mix

/** O croqui da frente da ficha do projeto ligado (ou nada). */
function CroquiDoProjeto(props: { readonly projeto: Projeto | undefined }): React.JSX.Element | null {
  const ficha = props.projeto ? lerFichaTecnica(props.projeto.fichaTecnica) : null;
  if (!ficha?.desenho || ficha.desenho.elementos.length === 0) return null;
  const vista = ficha.desenho.elementos.some((e) => e.vista === 'frente') ? 'frente' : 'costas';
  return <FolhaDoDesenho desenho={ficha.desenho} vista={vista} imagens={imagensDoProjeto(props.projeto!)} rotulo={`Croqui de ${props.projeto!.nome}`} />;
}

function CartaoDoModelo(props: { readonly modelo: ModeloDaColecao; readonly projeto: Projeto | undefined; readonly hoje: string; readonly onAbrir: () => void }): React.JSX.Element {
  const m = props.modelo;
  const atrasado = m.prazo !== '' && m.prazo < props.hoje && m.etapa !== 'producao' && m.etapa !== 'cancelado';
  return (
    <button type="button" className={`cartao-do-modelo etapa-${m.etapa}`} onClick={props.onAbrir} aria-label={`Modelo ${m.nome}`}>
      <span className="croqui-do-cartao">{props.projeto ? (CroquiDoProjeto({ projeto: props.projeto }) ?? <span className="sem-croqui">sem croqui</span>) : <span className="sem-croqui">sem projeto</span>}</span>
      <strong>{m.nome}</strong>
      <small>
        {m.referencia || 'sem referência'} · {m.categoria || 'sem categoria'}
      </small>
      {m.cores.length > 0 && (
        <span className="cores-do-modelo">
          {m.cores.map((cor) => (
            <span key={cor} className="cor-do-modelo" title={cor}>
              {ehCor(cor) && <i style={{ background: cor }} />}
              {cor}
            </span>
          ))}
        </span>
      )}
      {m.tecido && <small>{m.tecido}</small>}
      <span className={`situacao-da-execucao situacao-etapa-${m.etapa}`}>
        {ROTULO_DA_ETAPA[m.etapa]}
        {m.etapa === 'piloto' || m.etapa === 'aprovacao' ? ` · rev. ${revisaoDaPiloto(m)}` : ''}
      </span>
      <small className={atrasado ? 'texto-de-erro' : undefined}>
        {m.responsavel || 'sem responsável'} · {m.prazo ? `${diaEscrito(m.prazo)}${atrasado ? ' (atrasado)' : ''}` : 'sem prazo'}
      </small>
    </button>
  );
}

function ParteMix(props: {
  readonly colecao: Colecao;
  readonly projetos: readonly Projeto[];
  readonly hoje: string;
  readonly travado: boolean;
  readonly onAbrirModelo: (id: string) => void;
  readonly onNovoModelo: () => void;
  readonly onExportar: () => void;
}): React.JSX.Element {
  const [categoria, setCategoria] = useState('');
  const [etapa, setEtapa] = useState<EtapaDoModelo | ''>('');
  const resumo = resumoDoMix(props.colecao);
  const modelos = props.colecao.modelos.filter((m) => (!categoria || (m.categoria.trim() || 'Sem categoria') === categoria) && (!etapa || m.etapa === etapa));
  return (
    <section aria-label="Mix de produtos">
      <div className="acoes-em-linha barra-dos-materiais">
        <label>
          Categoria
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {resumo.categorias.map(([c]) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Etapa
          <select value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaDoModelo | '')}>
            <option value="">Todas</option>
            {[...ETAPAS, 'cancelado' as const].map((x) => (
              <option key={x} value={x}>
                {ROTULO_DA_ETAPA[x]}
              </option>
            ))}
          </select>
        </label>
        <span className="acoes-da-fila">
          <button type="button" className="botao-primario" disabled={props.travado} onClick={props.onNovoModelo}>
            Novo modelo
          </button>
          <button type="button" disabled={props.colecao.modelos.length === 0} onClick={props.onExportar}>
            Exportar o mix (CSV)
          </button>
        </span>
      </div>
      {props.colecao.modelos.length > 0 && (
        <dl className="resumo-do-mix">
          <div>
            <dt>Categorias</dt>
            <dd>{resumo.categorias.map(([c, n]) => `${c} (${n})`).join(' · ')}</dd>
          </div>
          <div>
            <dt>Cores</dt>
            <dd>{resumo.cores.length > 0 ? resumo.cores.map(([c, n]) => `${c} (${n})`).join(' · ') : '—'}</dd>
          </div>
          <div>
            <dt>Tecidos</dt>
            <dd>{resumo.tecidos.map(([c, n]) => `${c} (${n})`).join(' · ')}</dd>
          </div>
        </dl>
      )}
      {modelos.length === 0 ? (
        <p className="nota-do-formulario">{props.colecao.modelos.length === 0 ? 'A coleção ainda não tem modelos: “Novo modelo”.' : 'Nenhum modelo com esse filtro.'}</p>
      ) : (
        <div className="quadro-do-mix">
          {modelos.map((m) => (
            <CartaoDoModelo key={m.id} modelo={m} projeto={props.projetos.find((p) => p.id === m.projetoId)} hoje={props.hoje} onAbrir={() => props.onAbrirModelo(m.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---- As etapas (o quadro)

function ParteEtapas(props: { readonly colecao: Colecao; readonly hoje: string; readonly travado: boolean; readonly onAbrirModelo: (id: string) => void; readonly onAvancar: (m: ModeloDaColecao) => void }): React.JSX.Element {
  const colunas: EtapaDoModelo[] = [...ETAPAS, 'cancelado'];
  return (
    <section aria-label="Etapas" className="quadro-das-etapas">
      {colunas.map((etapa) => {
        const daEtapa = props.colecao.modelos.filter((m) => m.etapa === etapa);
        return (
          <div key={etapa} className={`coluna-da-etapa etapa-${etapa}`} aria-label={`Etapa ${ROTULO_DA_ETAPA[etapa]}`}>
            <h4>
              {ROTULO_DA_ETAPA[etapa]} <span>({daEtapa.length})</span>
            </h4>
            {daEtapa.map((m) => {
              const atrasado = m.prazo !== '' && m.prazo < props.hoje && etapa !== 'producao' && etapa !== 'cancelado';
              return (
                <div key={m.id} className="cartao-da-etapa">
                  <button type="button" className="nome-do-cartao" onClick={() => props.onAbrirModelo(m.id)}>
                    {m.nome}
                  </button>
                  <small className={atrasado ? 'texto-de-erro' : undefined}>
                    {m.responsavel || '—'} · {m.prazo ? diaEscrito(m.prazo) : 'sem prazo'}
                  </small>
                  {etapa !== 'producao' && etapa !== 'cancelado' && etapa !== 'aprovacao' && (
                    <button type="button" disabled={props.travado} onClick={() => props.onAvancar(m)} aria-label={`Avançar ${m.nome}`}>
                      Avançar →
                    </button>
                  )}
                  {etapa === 'aprovacao' && (
                    <button type="button" onClick={() => props.onAbrirModelo(m.id)}>
                      Aprovar a piloto…
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

// ---- Os prazos e as tarefas

function PartePendencias(props: {
  readonly colecoes: readonly Colecao[];
  readonly colecao: Colecao;
  readonly hoje: string;
  readonly travado: boolean;
  readonly onMarcar: (p: PendenciaDePrazo, feita: boolean) => void;
  readonly onExportar: (pendencias: readonly PendenciaDePrazo[]) => void;
}): React.JSX.Element {
  const [todas, setTodas] = useState(false);
  const [pessoa, setPessoa] = useState('');
  const pendencias = pendenciasDePrazo(todas ? props.colecoes : [props.colecao], props.hoje);
  const filtradas = pendencias.filter((p) => !pessoa || (p.responsavel || '(sem responsável)') === pessoa);
  return (
    <section aria-label="Tarefas e prazos">
      <div className="acoes-em-linha barra-dos-materiais">
        <label>
          Pessoa
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
            <option value="">Todas</option>
            {pessoasComPendencia(pendencias).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="opcao-em-linha">
          <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
          De todas as coleções
        </label>
        <span className="acoes-da-fila">
          <button type="button" disabled={filtradas.length === 0} onClick={() => props.onExportar(filtradas)}>
            Exportar CSV
          </button>
        </span>
      </div>
      {filtradas.length === 0 ? (
        <p className="nota-do-formulario">Nenhum prazo aberto. Os prazos são os das etapas dos modelos e os das tarefas (no modelo).</p>
      ) : (
        <table className="tabela-de-relatorio tabela-de-materiais">
          <caption>Prazos abertos</caption>
          <thead>
            <tr>
              <th scope="col">Prazo</th>
              <th scope="col">Situação</th>
              <th scope="col">Responsável</th>
              {todas && <th scope="col">Coleção</th>}
              <th scope="col">Modelo</th>
              <th scope="col">O quê</th>
              <th scope="col">Feita</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p, i) => (
              <tr key={`${p.modeloId}-${p.tipo}-${p.oQue}-${i}`} className={p.dias < 0 ? 'linha-atrasada' : undefined}>
                <td>{diaEscrito(p.prazo)}</td>
                <td className={p.dias < 0 ? 'texto-de-erro' : undefined}>{situacaoDoPrazo(p.dias)}</td>
                <td>{p.responsavel || '—'}</td>
                {todas && <td>{p.colecao}</td>}
                <td>{p.modelo}</td>
                <td>{p.tipo === 'etapa' ? `Etapa: ${p.oQue}` : p.oQue}</td>
                <td>{p.tipo === 'tarefa' ? <input type="checkbox" aria-label={`Feita: ${p.oQue}`} disabled={props.travado} checked={false} onChange={() => props.onMarcar(p, true)} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---- O andamento e a linha do tempo

function ParteAndamento(props: { readonly colecao: Colecao; readonly hoje: string }): React.JSX.Element {
  const a = andamentoDaColecao(props.colecao, props.hoje);
  const pontos = linhaDoTempo(props.colecao, props.hoje);
  const datas = [...pontos.map((p) => p.data), props.hoje].sort();
  const inicio = datas[0]!;
  const fim = datas.at(-1)!;
  const total = Math.max(1, (Date.parse(fim) - Date.parse(inicio)) / 86_400_000);
  const x = (dia: string): number => 20 + (((Date.parse(dia) - Date.parse(inicio)) / 86_400_000) / total) * 760;
  const maior = Math.max(1, ...ETAPAS.map((e) => a.porEtapa[e]));
  return (
    <section aria-label="Andamento">
      <dl className="indicadores-da-sala-de-corte">
        <div>
          <dt>Modelos</dt>
          <dd>
            {a.total - a.cancelados}
            {a.cancelados > 0 ? ` (+${a.cancelados} cancelado(s))` : ''}
          </dd>
        </div>
        <div>
          <dt>Prontos (na produção)</dt>
          <dd>{numeroComVirgula(a.prontosPercentual, 0)}%</dd>
        </div>
        <div className={a.atrasados > 0 ? 'indicador-atrasado' : undefined}>
          <dt>Prazos atrasados</dt>
          <dd>{a.atrasados}</dd>
        </div>
        <div>
          <dt>Lançamento</dt>
          <dd>{a.diasParaOLancamento === null ? 'sem data' : situacaoDoPrazo(a.diasParaOLancamento)}</dd>
        </div>
        <div>
          <dt>Tarefas (abertas / feitas)</dt>
          <dd>
            {a.tarefasAbertas} / {a.tarefasFeitas}
          </dd>
        </div>
      </dl>
      <h4>Modelos por etapa</h4>
      <div className="barras-das-etapas">
        {ETAPAS.map((e) => (
          <div key={e} className="barra-da-etapa">
            <span>{ROTULO_DA_ETAPA[e]}</span>
            <span className="trilho-da-barra">
              <span className={`preenchimento-da-barra etapa-${e}`} style={{ width: `${(a.porEtapa[e] / maior) * 100}%` }} />
            </span>
            <strong>{a.porEtapa[e]}</strong>
          </div>
        ))}
      </div>
      <h4>Linha do tempo</h4>
      {pontos.length === 0 ? (
        <p className="nota-do-formulario">Sem datas ainda: o lançamento, os marcos e os prazos dos modelos aparecem aqui.</p>
      ) : (
        <>
          <svg className="linha-do-tempo" viewBox="0 0 800 80" role="img" aria-label="Linha do tempo da coleção">
            <line x1={20} y1={40} x2={780} y2={40} className="eixo-da-linha" />
            <line x1={x(props.hoje)} y1={14} x2={x(props.hoje)} y2={66} className="hoje-na-linha" />
            <text x={x(props.hoje)} y={10} textAnchor="middle" className="rotulo-de-hoje">
              hoje
            </text>
            {pontos.map((p, i) => (
              <circle key={i} cx={x(p.data)} cy={40} r={p.tipo === 'lancamento' ? 8 : 5} className={`ponto-${p.tipo}${p.atrasado ? ' ponto-atrasado' : ''}`}>
                <title>
                  {diaEscrito(p.data)} — {p.rotulo}
                </title>
              </circle>
            ))}
          </svg>
          <ol className="lista-da-linha-do-tempo">
            {pontos.map((p, i) => (
              <li key={i} className={p.atrasado ? 'texto-de-erro' : undefined}>
                <strong>{diaEscrito(p.data)}</strong> — {p.rotulo}
                {p.tipo === 'lancamento' ? ' 🚀' : ''}
                {p.atrasado ? ' (atrasado)' : ''}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

// ---- O modelo

function DetalheDoModelo(props: {
  readonly colecao: Colecao;
  readonly modelo: ModeloDaColecao;
  readonly projetos: readonly Projeto[];
  readonly projetoAbertoId: string;
  readonly hoje: string;
  readonly responsavelSugerido: string;
  readonly agoraIso: () => string;
  readonly novoId: () => string;
  readonly travado: boolean;
  readonly onVoltar: () => void;
  readonly onMudar: (fazer: (m: ModeloDaColecao) => ModeloDaColecao, sucesso?: string | null) => Promise<boolean>;
  readonly onRemover: () => void;
  readonly onAbrirProjeto: (projetoId: string) => void;
}): React.JSX.Element {
  const m = props.modelo;
  const [dados, setDados] = useState({ nome: m.nome, referencia: m.referencia, categoria: m.categoria, cores: m.cores.join(', '), tecido: m.tecido, responsavel: m.responsavel, prazo: m.prazo });
  const [quem, setQuem] = useState(props.responsavelSugerido || m.responsavel);
  const [comentario, setComentario] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [tarefa, setTarefa] = useState({ descricao: '', responsavel: m.responsavel, prazo: '' });
  const [textoDoComentario, setTextoDoComentario] = useState('');
  const projeto = props.projetos.find((p) => p.id === m.projetoId);
  const ficha = projeto ? lerFichaTecnica(projeto.fichaTecnica) : null;
  const categorias = [...new Set(props.colecao.modelos.map((x) => x.categoria.trim()).filter((x) => x !== ''))];
  const etapa = (fazer: (x: ModeloDaColecao) => ModeloDaColecao, sucesso: string): void => {
    void props.onMudar(fazer, sucesso).then((ok) => {
      if (ok) {
        setComentario('');
        setNovoPrazo('');
      }
    });
  };
  const mudanca = { responsavel: quem, comentario, prazo: novoPrazo, agoraIso: props.agoraIso() };
  return (
    <section aria-label={`Modelo ${m.nome}`} className="detalhe-do-modelo">
      <div className="cabecalho-da-ficha">
        <button type="button" onClick={props.onVoltar}>
          ← Voltar ao mix
        </button>
        <strong>{m.nome}</strong>
        <span className={`situacao-da-execucao situacao-etapa-${m.etapa}`}>
          {ROTULO_DA_ETAPA[m.etapa]}
          {m.etapa === 'piloto' || m.etapa === 'aprovacao' ? ` · peça-piloto rev. ${revisaoDaPiloto(m)}` : ''}
        </span>
        <span className="acoes-da-fila">
          <button type="button" disabled={props.travado} onClick={props.onRemover}>
            Tirar da coleção
          </button>
        </span>
      </div>
      <div className="corpo-do-modelo">
        <div>
          <form className="formulario-de-sobreposicao formulario-do-material" onSubmit={(e) => e.preventDefault()}>
            <label>
              Nome *
              <input value={dados.nome} disabled={props.travado} onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
            </label>
            <label>
              Referência
              <input value={dados.referencia} disabled={props.travado} onChange={(e) => setDados({ ...dados, referencia: e.target.value })} />
            </label>
            <label>
              Categoria
              <input list="categorias-da-colecao" value={dados.categoria} disabled={props.travado} onChange={(e) => setDados({ ...dados, categoria: e.target.value })} />
            </label>
            <datalist id="categorias-da-colecao">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <label>
              Cores (separadas por vírgula; “#rrggbb” mostra a cor)
              <input value={dados.cores} disabled={props.travado} onChange={(e) => setDados({ ...dados, cores: e.target.value })} />
            </label>
            <label>
              Tecido
              <input value={dados.tecido} disabled={props.travado} onChange={(e) => setDados({ ...dados, tecido: e.target.value })} />
            </label>
            <label>
              Responsável
              <input value={dados.responsavel} disabled={props.travado} onChange={(e) => setDados({ ...dados, responsavel: e.target.value })} />
            </label>
            <label>
              Prazo da etapa
              <input type="date" value={dados.prazo} disabled={props.travado} onChange={(e) => setDados({ ...dados, prazo: e.target.value })} />
            </label>
          </form>
          <div className="acoes-em-linha">
            <button
              type="button"
              className="botao-primario"
              disabled={props.travado}
              onClick={() =>
                void props.onMudar(
                  (x) => ({
                    ...x,
                    nome: dados.nome.trim(),
                    referencia: dados.referencia.trim(),
                    categoria: dados.categoria.trim(),
                    cores: dados.cores.split(',').map((c) => c.trim()).filter((c) => c !== ''),
                    tecido: dados.tecido.trim(),
                    responsavel: dados.responsavel.trim(),
                    prazo: dados.prazo,
                  }),
                  'Modelo guardado.',
                )
              }
            >
              Guardar o modelo
            </button>
          </div>

          <h4>Projeto ligado (molde, encaixe, ficha e desenho)</h4>
          <div className="acoes-em-linha">
            <select
              aria-label="Projeto ligado"
              value={m.projetoId ?? ''}
              disabled={props.travado}
              onChange={(e) => void props.onMudar((x) => ({ ...x, projetoId: e.target.value || null }), e.target.value ? 'Projeto ligado ao modelo.' : 'O modelo ficou sem projeto.')}
            >
              <option value="">Nenhum</option>
              {props.projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.codigo})
                </option>
              ))}
            </select>
            {m.projetoId !== props.projetoAbertoId && (
              <button type="button" disabled={props.travado} onClick={() => void props.onMudar((x) => ({ ...x, projetoId: props.projetoAbertoId }), 'O projeto aberto foi ligado ao modelo.')}>
                Ligar o projeto aberto
              </button>
            )}
            {projeto && m.projetoId !== props.projetoAbertoId && (
              <button type="button" onClick={() => props.onAbrirProjeto(projeto.id)}>
                Abrir o projeto
              </button>
            )}
          </div>
          {projeto && (
            <div className="previa-do-desenho">
              <CroquiDoProjeto projeto={projeto} />
              <p className="nota-do-formulario">
                {ficha ? `Ficha técnica: ${ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao]}, versão ${ficha.versao}${ficha.desenho ? '' : ' (sem desenho técnico)'}.` : 'O projeto ainda não tem ficha técnica.'}{' '}
                {projeto.estadoAtual.pecas.length} peça(s) no molde.
              </p>
            </div>
          )}
        </div>

        <div>
          <h4>Etapa e peça-piloto</h4>
          <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
            <label>
              Quem decide
              <input value={quem} disabled={props.travado} onChange={(e) => setQuem(e.target.value)} />
            </label>
            <label>
              Comentário (o motivo de voltar, o que alterar na piloto)
              <textarea rows={2} value={comentario} disabled={props.travado} onChange={(e) => setComentario(e.target.value)} />
            </label>
            <label>
              Prazo da etapa seguinte
              <input type="date" value={novoPrazo} disabled={props.travado} onChange={(e) => setNovoPrazo(e.target.value)} />
            </label>
          </form>
          <div className="acoes-do-trabalho">
            {m.etapa !== 'aprovacao' && m.etapa !== 'producao' && m.etapa !== 'cancelado' && (
              <button type="button" className="botao-primario" disabled={props.travado} onClick={() => etapa((x) => avancarEtapa(x, mudanca), 'Etapa avançada.')}>
                Avançar etapa
              </button>
            )}
            {m.etapa === 'aprovacao' && (
              <>
                <button type="button" className="botao-primario" disabled={props.travado} onClick={() => etapa((x) => aprovarPiloto(x, mudanca), `Peça-piloto (rev. ${revisaoDaPiloto(m)}) aprovada: o modelo foi para a produção.`)}>
                  Aprovar a piloto
                </button>
                <button type="button" disabled={props.travado} onClick={() => etapa((x) => pedirAlteracaoDaPiloto(x, mudanca), `Alteração pedida: a piloto volta, na revisão ${revisaoDaPiloto(m) + 1}.`)}>
                  Pedir alteração
                </button>
              </>
            )}
            {m.etapa !== 'criacao' && m.etapa !== 'cancelado' && (
              <button type="button" disabled={props.travado} onClick={() => etapa((x) => voltarEtapa(x, mudanca), 'A etapa voltou.')}>
                Voltar etapa
              </button>
            )}
            {m.etapa !== 'cancelado' ? (
              <button type="button" disabled={props.travado} onClick={() => etapa((x) => cancelarModelo(x, mudanca), 'Modelo cancelado.')}>
                Cancelar o modelo
              </button>
            ) : (
              <button type="button" disabled={props.travado} onClick={() => etapa((x) => reabrirModelo(x, mudanca), 'Modelo reaberto.')}>
                Reabrir
              </button>
            )}
          </div>

          <h4>Tarefas</h4>
          {m.tarefas.length > 0 && (
            <ul className="tarefas-do-modelo">
              {m.tarefas.map((t) => (
                <li key={t.id} className={t.feitaEmIso ? 'tarefa-feita' : t.prazo && t.prazo < props.hoje ? 'texto-de-erro' : undefined}>
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={Boolean(t.feitaEmIso)} disabled={props.travado} onChange={(e) => void props.onMudar((x) => marcarTarefa(x, t.id, e.target.checked, props.agoraIso()))} />
                    {t.descricao}
                  </label>
                  <small>
                    {t.responsavel || '—'} · {t.prazo ? diaEscrito(t.prazo) : 'sem prazo'}
                  </small>
                  <button type="button" disabled={props.travado} aria-label={`Remover a tarefa ${t.descricao}`} onClick={() => void props.onMudar((x) => removerTarefa(x, t.id))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="acoes-em-linha nova-tarefa">
            <input aria-label="Nova tarefa" placeholder="Nova tarefa" value={tarefa.descricao} disabled={props.travado} onChange={(e) => setTarefa({ ...tarefa, descricao: e.target.value })} />
            <input aria-label="Responsável da tarefa" placeholder="Quem" value={tarefa.responsavel} disabled={props.travado} onChange={(e) => setTarefa({ ...tarefa, responsavel: e.target.value })} />
            <input aria-label="Prazo da tarefa" type="date" value={tarefa.prazo} disabled={props.travado} onChange={(e) => setTarefa({ ...tarefa, prazo: e.target.value })} />
            <button
              type="button"
              disabled={props.travado}
              onClick={() =>
                void props.onMudar((x) => adicionarTarefa(x, { id: props.novoId(), ...tarefa }), 'Tarefa posta.').then((ok) => ok && setTarefa({ descricao: '', responsavel: tarefa.responsavel, prazo: '' }))
              }
            >
              Pôr a tarefa
            </button>
          </div>

          <h4>Comentários</h4>
          {m.comentarios.length > 0 && (
            <ul className="comentarios-do-modelo">
              {m.comentarios.map((c, i) => (
                <li key={i}>
                  <strong>{c.autor}</strong> <small>{new Date(c.dataIso).toLocaleString('pt-BR')}</small>
                  <p>{c.texto}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="acoes-em-linha">
            <input aria-label="Novo comentário" placeholder="Comentário" value={textoDoComentario} disabled={props.travado} onChange={(e) => setTextoDoComentario(e.target.value)} />
            <button
              type="button"
              disabled={props.travado}
              onClick={() => void props.onMudar((x) => adicionarComentario(x, quem, textoDoComentario, props.agoraIso()), 'Comentário guardado.').then((ok) => ok && setTextoDoComentario(''))}
            >
              Comentar
            </button>
          </div>

          {m.historico.length > 0 && (
            <>
              <h4>Histórico</h4>
              <table className="tabela-de-relatorio tabela-de-materiais">
                <caption>Histórico das etapas</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">De → para</th>
                    <th scope="col">Quem</th>
                    <th scope="col">Comentário</th>
                  </tr>
                </thead>
                <tbody>
                  {[...m.historico].reverse().map((h, i) => (
                    <tr key={i}>
                      <td>{new Date(h.dataIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        {ROTULO_DA_ETAPA[h.de]} → {ROTULO_DA_ETAPA[h.para]}
                        {h.revisaoDaPiloto !== undefined ? ` (piloto rev. ${h.revisaoDaPiloto})` : ''}
                      </td>
                      <td>{h.responsavel}</td>
                      <td>{h.comentario || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
