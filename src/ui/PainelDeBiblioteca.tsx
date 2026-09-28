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

interface PainelDeBibliotecaProps {
  readonly projetos: readonly Projeto[];
  readonly projetoAtualId: string;
  readonly onAbrir: (id: string) => void;
  readonly onDuplicar: (id: string) => void;
  readonly onRenomear: (id: string, novoNome: string) => void;
  readonly onArquivar: (id: string) => void;
  readonly onExcluir: (id: string) => void;
  readonly onFechar: () => void;
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function PainelDeBiblioteca(props: PainelDeBibliotecaProps): React.JSX.Element {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<StatusDoProjeto | 'todos'>('todos');
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');

  const projetosFiltrados = useMemo(
    () => ordenarPorMaisRecente(filtrarProjetos(props.projetos, busca, status)),
    [props.projetos, busca, status],
  );

  return (
    <Sobreposicao titulo="Biblioteca de trabalhos" onFechar={props.onFechar}>
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
        </div>

        {projetosFiltrados.length === 0 ? (
          <p className="texto-vazio">Nenhum projeto encontrado.</p>
        ) : (
          <ul className="lista-da-biblioteca">
            {projetosFiltrados.map((p) => (
              <li key={p.id} className={p.id === props.projetoAtualId ? 'item-selecionado' : ''}>
                {renomeandoId === p.id ? (
                  <div className="linha-de-renomear">
                    <input
                      type="text"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        props.onRenomear(p.id, novoNome);
                        setRenomeandoId(null);
                      }}
                    >
                      OK
                    </button>
                    <button onClick={() => setRenomeandoId(null)}>Cancelar</button>
                  </div>
                ) : (
                  <>
                    <div className="info-do-projeto">
                      <strong>{p.nome}</strong> <span className="referencia">({p.codigo})</span>
                      <div className="detalhes-do-projeto">
                        {formatarData(p.modificadoEmIso)} — {ROTULO_DO_STATUS[p.status]}
                        {p.estadoAtual.tecido ? ` — ${p.estadoAtual.tecido.nome}` : ''}
                        {p.estadoAtual.enfesto ? ` — ${ROTULO_DO_TIPO[p.estadoAtual.enfesto.tipo]}` : ''}
                        {` — ${p.estadoAtual.pecas.length} peça(s)`}
                      </div>
                    </div>
                    <div className="acoes-do-projeto">
                      <button onClick={() => props.onAbrir(p.id)}>Abrir</button>
                      <button onClick={() => props.onDuplicar(p.id)}>Duplicar</button>
                      <button
                        onClick={() => {
                          setRenomeandoId(p.id);
                          setNovoNome(p.nome);
                        }}
                      >
                        Renomear
                      </button>
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
    </Sobreposicao>
  );
}
