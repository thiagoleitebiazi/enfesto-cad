import { useCallback, useEffect, useState } from 'react';
import { atualizarDoServidor, enviarProjeto, type PedidoAoServidor, type ProjetoCompartilhado } from '../domain/colaboracao';
import type { EstadoDoProjeto } from '../domain/projeto';
import { Sobreposicao } from './Sobreposicao';

export interface ServidorLigado {
  readonly porta: number;
  readonly chave: string;
  readonly enderecos: readonly string[];
}

export interface EstadoDaColaboracao {
  readonly url: string;
  readonly nome: string;
  readonly conectado: boolean;
  readonly servidor: ServidorLigado | null;
}

export interface ApiDaColaboracao {
  readonly estado: () => Promise<EstadoDaColaboracao>;
  readonly conectar: (url: string, chave: string, nome: string) => Promise<string | null>;
  readonly pedir: PedidoAoServidor;
  readonly servir: (porta: number | null) => Promise<ServidorLigado | string | null>;
}

interface Aprovacao {
  readonly situacao: 'aprovado' | 'reprovado';
  readonly autor: string;
  readonly nota: string;
}

interface ItemDoServidor {
  readonly id: string;
  readonly nome: string;
  readonly codigo: string;
  readonly versao: number;
  readonly autor: string;
  readonly aprovacao: Aprovacao | null;
}

interface DetalheDoProjeto {
  readonly versao: number;
  readonly comentarios: readonly { readonly id: number; readonly autor: string; readonly texto: string }[];
  readonly aprovacao: Aprovacao | null;
  readonly presentes: readonly string[];
}

interface PainelDeColaboracaoProps {
  readonly api: ApiDaColaboracao;
  readonly projeto: ProjetoCompartilhado;
  /** A versão do servidor de onde este projeto partiu; 0: ainda não foi enviado daqui. */
  readonly versaoBase: number;
  readonly onVersao: (id: string, versao: number) => void;
  readonly onEstado: (estado: EstadoDoProjeto) => void;
  readonly onBaixar: (projeto: ProjetoCompartilhado, versao: number) => void;
  readonly onFechar: () => void;
}

/** De quanto em quanto o painel avisa que está no projeto e vê quem mais está. */
const INTERVALO_DA_PRESENCA_MS = 20_000;
const PORTA_PADRAO = '8931';

const textoDaAprovacao = (a: Aprovacao): string => `${a.situacao === 'aprovado' ? 'Aprovado' : 'Reprovado'} por ${a.autor}${a.nota ? `: ${a.nota}` : ''}`;

/** A colaboração (ADR 0214): o servidor da empresa, o projeto aberto nele, os comentários e a aprovação. */
export function PainelDeColaboracao(props: PainelDeColaboracaoProps): React.JSX.Element {
  const { api, projeto } = props;
  const [conexao, setConexao] = useState<EstadoDaColaboracao | null>(null);
  const [url, setUrl] = useState('');
  const [chave, setChave] = useState('');
  const [nome, setNome] = useState('');
  const [porta, setPorta] = useState(PORTA_PADRAO);
  const [lista, setLista] = useState<readonly ItemDoServidor[]>([]);
  const [detalhe, setDetalhe] = useState<DetalheDoProjeto | null>(null);
  const [comentario, setComentario] = useState('');
  const [nota, setNota] = useState('');
  const [mensagem, setMensagem] = useState('');

  const atualizar = useCallback(
    async (autor: string): Promise<void> => {
      const r = await api.pedir('GET', '/projetos');
      if (r.status !== 200) {
        setMensagem(r.status === 401 ? 'O servidor não aceitou a chave.' : 'O servidor não respondeu como devia.');
        return;
      }
      const projetos = (r.corpo as { projetos: readonly ItemDoServidor[] }).projetos;
      setLista(projetos);
      if (!projetos.some((p) => p.id === projeto.id)) {
        setDetalhe(null);
        return;
      }
      if (autor !== '') await api.pedir('POST', `/projetos/${projeto.id}/presenca`, { autor });
      const d = await api.pedir('GET', `/projetos/${projeto.id}`);
      if (d.status === 200) setDetalhe(d.corpo as DetalheDoProjeto);
    },
    [api, projeto.id],
  );

  const sinalizar = useCallback(
    (fazer: () => Promise<void>) => {
      fazer().catch((e: unknown) => setMensagem(e instanceof Error ? e.message : 'O servidor não pôde ser alcançado.'));
    },
    [],
  );

  useEffect(() => {
    let vivo = true;
    let autor = '';
    const passo = (): void => sinalizar(() => atualizar(autor));
    void api.estado().then((estado) => {
      if (!vivo) return;
      setConexao(estado);
      setUrl(estado.url);
      setNome(estado.nome);
      autor = estado.nome;
      if (estado.conectado) passo();
    });
    const relogio = setInterval(() => {
      if (autor !== '') passo();
    }, INTERVALO_DA_PRESENCA_MS);
    return () => {
      vivo = false;
      clearInterval(relogio);
    };
  }, [api, atualizar, sinalizar]);

  const conectar = (): void =>
    sinalizar(async () => {
      const erro = await api.conectar(url, chave, nome);
      if (erro) {
        setMensagem(erro);
        return;
      }
      setChave('');
      setConexao(await api.estado());
      setMensagem('Ligado ao servidor.');
      await atualizar(nome);
    });

  const ligarServidor = (ligar: boolean): void =>
    sinalizar(async () => {
      const r = await api.servir(ligar ? Number(porta) : null);
      if (typeof r === 'string') {
        setMensagem(r);
        return;
      }
      setConexao(await api.estado());
      setMensagem(r ? 'Servidor ligado neste computador.' : 'Servidor desligado.');
    });

  const dizerConflitos = (conflitos: readonly string[], inicio: string): string => (conflitos.length > 0 ? `${inicio} Mudado dos dois lados, ficou como no servidor: ${conflitos.join(', ')}.` : inicio);

  const enviar = (): void =>
    sinalizar(async () => {
      const r = await enviarProjeto(api.pedir, projeto, props.versaoBase, nome);
      props.onVersao(projeto.id, r.versao);
      props.onEstado(r.estado);
      setMensagem(dizerConflitos(r.conflitos, `Versão ${r.versao} enviada.`));
      await atualizar(nome);
    });

  const atualizarDaqui = (): void =>
    sinalizar(async () => {
      const r = await atualizarDoServidor(api.pedir, projeto, props.versaoBase);
      props.onVersao(projeto.id, r.versao);
      props.onEstado(r.estado);
      setMensagem(dizerConflitos(r.conflitos, `Atualizado com a versão ${r.versao}.`));
    });

  const baixar = (id: string): void =>
    sinalizar(async () => {
      const r = await api.pedir('GET', `/projetos/${id}`);
      if (r.status !== 200) {
        setMensagem('Este projeto não pôde ser baixado.');
        return;
      }
      const { projeto: baixado, versao } = r.corpo as { projeto: Omit<ProjetoCompartilhado, 'id'>; versao: number };
      props.onBaixar({ ...baixado, id }, versao);
      setMensagem(`“${baixado.nome}” está na biblioteca.`);
    });

  const comentar = (): void =>
    sinalizar(async () => {
      await api.pedir('POST', `/projetos/${projeto.id}/comentarios`, { autor: nome, texto: comentario });
      setComentario('');
      await atualizar(nome);
    });

  const aprovar = (situacao: Aprovacao['situacao']): void =>
    sinalizar(async () => {
      await api.pedir('POST', `/projetos/${projeto.id}/aprovacao`, { autor: nome, situacao, nota });
      setNota('');
      await atualizar(nome);
    });

  const servidor = conexao?.servidor ?? null;
  return (
    <Sobreposicao titulo="Colaboração" onFechar={props.onFechar}>
      {mensagem && <p role="status">{mensagem}</p>}
      <fieldset className="grupo-de-opcoes-do-formulario">
        <legend>Ligar a um servidor</legend>
        <label>
          Endereço
          <input type="url" value={url} placeholder="http://192.168.0.10:8931" onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Chave
          <input type="password" value={chave} autoComplete="off" placeholder={conexao?.conectado ? 'guardada: só escreva para trocar' : ''} onChange={(e) => setChave(e.target.value)} />
        </label>
        <label>
          Seu nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <button type="button" onClick={conectar}>
          Ligar
        </button>
      </fieldset>
      <fieldset className="grupo-de-opcoes-do-formulario">
        <legend>Este computador como servidor</legend>
        {servidor ? (
          <>
            <p>Endereços: {servidor.enderecos.join(', ') || `porta ${servidor.porta}`}</p>
            <p>
              Chave para os outros: <code>{servidor.chave}</code>
            </p>
            <p className="nota-do-formulario">A conexão não é cifrada: use só na rede da empresa. Para usar pela internet, ponha um proxy com HTTPS na frente.</p>
            <button type="button" onClick={() => ligarServidor(false)}>
              Desligar o servidor
            </button>
          </>
        ) : (
          <>
            <label>
              Porta
              <input type="number" min="1024" max="65535" value={porta} onChange={(e) => setPorta(e.target.value)} />
            </label>
            <p className="nota-do-formulario">O Windows pode pedir licença para abrir a porta. Quem tiver o endereço e a chave vê e muda os projetos deste servidor.</p>
            <button type="button" onClick={() => ligarServidor(true)}>
              Ligar o servidor
            </button>
          </>
        )}
      </fieldset>
      {conexao?.conectado && (
        <>
          <h3>
            {projeto.nome} {detalhe ? `(versão ${detalhe.versao} no servidor)` : '(ainda não está no servidor)'}
          </h3>
          <p>
            <button type="button" disabled={nome.trim() === ''} onClick={enviar}>
              Enviar este projeto
            </button>{' '}
            {detalhe && (
              <button type="button" onClick={atualizarDaqui}>
                Atualizar com o servidor
              </button>
            )}
          </p>
          {detalhe && (
            <>
              {detalhe.presentes.length > 0 && <p>Neste projeto agora: {detalhe.presentes.join(', ')}</p>}
              <p>{detalhe.aprovacao ? textoDaAprovacao(detalhe.aprovacao) : 'Sem aprovação nesta versão.'}</p>
              <label>
                Nota da aprovação
                <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} />
              </label>
              <button type="button" disabled={nome.trim() === ''} onClick={() => aprovar('aprovado')}>
                Aprovar
              </button>{' '}
              <button type="button" disabled={nome.trim() === ''} onClick={() => aprovar('reprovado')}>
                Reprovar
              </button>
              <h4>Comentários</h4>
              {detalhe.comentarios.length === 0 && <p>Nenhum comentário.</p>}
              <ul>
                {detalhe.comentarios.map((c) => (
                  <li key={c.id}>
                    <strong>{c.autor}:</strong> {c.texto}
                  </li>
                ))}
              </ul>
              <label>
                Novo comentário
                <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
              </label>
              <button type="button" disabled={nome.trim() === '' || comentario.trim() === ''} onClick={comentar}>
                Comentar
              </button>
            </>
          )}
          <h3>Projetos no servidor</h3>
          {lista.length === 0 ? (
            <p>Nenhum projeto ainda.</p>
          ) : (
            <table className="tabela-de-moldes">
              <thead>
                <tr>
                  <th scope="col">Projeto</th>
                  <th scope="col">Versão</th>
                  <th scope="col">Enviado por</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.versao}</td>
                    <td>{p.autor}</td>
                    <td>{p.aprovacao ? textoDaAprovacao(p.aprovacao) : '—'}</td>
                    <td>
                      <button type="button" aria-label={`Baixar ${p.nome}`} onClick={() => baixar(p.id)}>
                        Baixar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Sobreposicao>
  );
}
