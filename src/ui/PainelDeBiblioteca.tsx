import { useMemo, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import {
  filtrarProjetos,
  ordenarPorMaisRecente,
  ROTULO_DO_STATUS,
  type Projeto,
  type StatusDoProjeto,
} from '../domain/projeto';
import { ROTULO_DO_TIPO } from '../domain/enfesto';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import { BibliotecaNaRede } from './BibliotecaNaRede';

interface PainelDeBibliotecaProps {
  readonly projetos: readonly Projeto[];
  /** O que dizer da pasta de projetos (arquivos que ficaram de fora, versões mais novas). */
  readonly avisos?: readonly string[];
  readonly projetoAtualId: string;
  readonly onAbrir: (id: string) => void;
  readonly onDuplicar: (id: string) => void;
  readonly onRenomear: (id: string, novoNome: string) => void;
  readonly onArquivar: (id: string) => void;
  readonly onExcluir: (id: string) => void;
  readonly onFechar: () => void;
  /** As bases aprovadas (ADR 0126). Cada uma devolve o erro a mostrar, ou `null` quando deu certo. */
  readonly onAprovarComoBase?: (id: string, responsavel: string, nota: string) => string | null;
  readonly onTirarDasBases?: (id: string) => void;
  readonly onNovoModeloDaBase?: (id: string, nome: string) => string | null;
  readonly onPorPecasDaBase?: (id: string) => void;
  /** A biblioteca na rede (ADR 0142); sem a pasta (fora do programa), a seção não aparece. */
  readonly pastaDaRede?: AcessoAPasta | null;
  readonly projetoParaEnviarARede?: (id: string) => Projeto | null;
  readonly onTrazerDaRede?: (projeto: Projeto) => string | null;
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** O que está sendo preenchido numa linha: o nome novo, a aprovação como base, ou o nome do modelo feito da base. */
type Formulario =
  | { readonly tipo: 'renomear'; readonly id: string }
  | { readonly tipo: 'aprovar'; readonly id: string }
  | { readonly tipo: 'modelo'; readonly id: string };

export function PainelDeBiblioteca(props: PainelDeBibliotecaProps): React.JSX.Element {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<StatusDoProjeto | 'todos'>('todos');
  const [soAsBases, setSoAsBases] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const projetosFiltrados = useMemo(
    () => ordenarPorMaisRecente(filtrarProjetos(props.projetos, busca, status)).filter((p) => !soAsBases || p.base),
    [props.projetos, busca, status, soAsBases],
  );

  const abrirFormulario = (f: Formulario, textoInicial: string): void => {
    setFormulario(f);
    setTexto(textoInicial);
    setNota('');
    setErro(null);
  };

  const confirmar = (): void => {
    if (!formulario) return;
    if (formulario.tipo === 'renomear') {
      props.onRenomear(formulario.id, texto);
      setFormulario(null);
      return;
    }
    const resultado =
      formulario.tipo === 'aprovar' ? (props.onAprovarComoBase?.(formulario.id, texto, nota) ?? null) : (props.onNovoModeloDaBase?.(formulario.id, texto) ?? null);
    if (resultado) setErro(resultado);
    else setFormulario(null);
  };

  // Enter faz o mesmo que OK; Esc, o mesmo que Cancelar — sem fechar a biblioteca, que é o que Esc faz fora daqui.
  const teclas = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setFormulario(null);
    }
  };

  const linhaDoFormulario = (p: Projeto, f: Formulario): React.JSX.Element => (
    <div className="linha-de-renomear">
      {f.tipo === 'renomear' && (
        <input type="text" aria-label={`Novo nome de ${p.nome}`} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} autoFocus />
      )}
      {f.tipo === 'aprovar' && (
        <>
          <input type="text" aria-label={`Quem aprova ${p.nome} como base`} placeholder="Quem aprova" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} autoFocus />
          <input
            type="text"
            aria-label={`O que é a base ${p.nome}`}
            placeholder="O que é (opcional): camisa social, tabela 2026…"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={teclas}
          />
        </>
      )}
      {f.tipo === 'modelo' && (
        <input type="text" aria-label={`Nome do modelo novo da base ${p.nome}`} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} autoFocus />
      )}
      <button className={f.tipo === 'renomear' ? undefined : 'botao-primario'} onClick={confirmar}>
        {f.tipo === 'aprovar' ? 'Aprovar' : f.tipo === 'modelo' ? 'Criar o modelo' : 'OK'}
      </button>
      <button onClick={() => setFormulario(null)}>Cancelar</button>
      {erro && (
        <p className="mensagem-de-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );

  return (
    <Sobreposicao titulo="Biblioteca de trabalhos" onFechar={props.onFechar}>
      {(props.avisos ?? []).map((aviso) => (
        <p key={aviso} className="nota-do-formulario" role="status">
          {aviso}
        </p>
      ))}
      <div className="painel-de-biblioteca">
        <div className="filtros-da-biblioteca">
          <input
            type="text"
            placeholder="Buscar por nome, código, tecido..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusDoProjeto | 'todos')}>
            <option value="todos">Todos os status</option>
            {(Object.keys(ROTULO_DO_STATUS) as StatusDoProjeto[]).map((s) => (
              <option key={s} value={s}>
                {ROTULO_DO_STATUS[s]}
              </option>
            ))}
          </select>
          {props.onAprovarComoBase && (
            <label className="filtro-das-bases">
              <input type="checkbox" checked={soAsBases} onChange={(e) => setSoAsBases(e.target.checked)} />
              Só as bases aprovadas
            </label>
          )}
        </div>

        {projetosFiltrados.length === 0 ? (
          <p className="texto-vazio">{soAsBases ? 'Nenhuma base aprovada: aprove um projeto com "Aprovar como base".' : 'Nenhum projeto encontrado.'}</p>
        ) : (
          <ul className="lista-da-biblioteca">
            {projetosFiltrados.map((p) => (
              <li key={p.id} className={[p.id === props.projetoAtualId ? 'item-selecionado' : '', p.base ? 'item-de-base' : ''].filter(Boolean).join(' ')}>
                {formulario?.id === p.id ? (
                  linhaDoFormulario(p, formulario)
                ) : (
                  <>
                    <div className="info-do-projeto">
                      <strong>{p.nome}</strong> <span className="referencia">({p.codigo})</span>
                      {p.base && <span className="selo selo-sucesso selo-de-base">Base aprovada</span>}
                      <div className="detalhes-do-projeto">
                        {formatarData(p.modificadoEmIso)} — {ROTULO_DO_STATUS[p.status]}
                        {p.estadoAtual.tecido ? ` — ${p.estadoAtual.tecido.nome}` : ''}
                        {p.estadoAtual.enfesto ? ` — ${ROTULO_DO_TIPO[p.estadoAtual.enfesto.tipo]}` : ''}
                        {` — ${p.estadoAtual.pecas.length} peça(s)`}
                      </div>
                      {p.base && (
                        <div className="detalhes-do-projeto detalhes-da-base">
                          Aprovada por {p.base.responsavel} em {formatarData(p.base.aprovadaEmIso)}
                          {p.base.nota ? ` — ${p.base.nota}` : ''}
                        </div>
                      )}
                      {p.feitoDaBase && (
                        <div className="detalhes-do-projeto">
                          Feito da base “{p.feitoDaBase.nome}” ({p.feitoDaBase.codigo})
                          {p.feitoDaBase.revisao !== undefined ? `, revisão ${p.feitoDaBase.revisao} do molde` : ''}
                        </div>
                      )}
                    </div>
                    <div className="acoes-do-projeto">
                      <button onClick={() => props.onAbrir(p.id)}>Abrir</button>
                      {p.base && props.onNovoModeloDaBase && (
                        <button
                          className="botao-primario"
                          title="Um projeto novo com as peças, o tecido e a mesa desta base. A base não muda."
                          onClick={() => abrirFormulario({ tipo: 'modelo', id: p.id }, `${p.nome} — modelo novo`)}
                        >
                          Novo modelo desta base
                        </button>
                      )}
                      {p.base && props.onPorPecasDaBase && p.id !== props.projetoAtualId && (
                        <button
                          title="Põe cópias das peças desta base no projeto aberto, ao lado das que ele já tem (Ctrl+Z desfaz)."
                          onClick={() => props.onPorPecasDaBase?.(p.id)}
                        >
                          Pôr as peças no aberto
                        </button>
                      )}
                      <button onClick={() => props.onDuplicar(p.id)}>Duplicar</button>
                      <button onClick={() => abrirFormulario({ tipo: 'renomear', id: p.id }, p.nome)}>Renomear</button>
                      {props.onAprovarComoBase &&
                        (p.base ? (
                          <button title="Deixa de aparecer como base. Os modelos feitos dela continuam dizendo de onde vieram." onClick={() => props.onTirarDasBases?.(p.id)}>
                            Tirar das bases
                          </button>
                        ) : (
                          <button title="Marca o molde deste projeto como base aprovada, para começar modelos novos dele." onClick={() => abrirFormulario({ tipo: 'aprovar', id: p.id }, '')}>
                            Aprovar como base
                          </button>
                        ))}
                      <button onClick={() => props.onArquivar(p.id)} disabled={p.status === 'arquivado'}>
                        Arquivar
                      </button>
                      <button onClick={() => props.onExcluir(p.id)} className="botao-perigo">
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {props.pastaDaRede && props.projetoParaEnviarARede && props.onTrazerDaRede && (
        <BibliotecaNaRede
          pasta={props.pastaDaRede}
          projetos={props.projetos}
          projetoParaEnviar={props.projetoParaEnviarARede}
          onTrazer={props.onTrazerDaRede}
          agoraIso={() => new Date().toISOString()}
        />
      )}
    </Sobreposicao>
  );
}
