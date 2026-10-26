import { useCallback, useEffect, useState } from 'react';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import type { Projeto } from '../domain/projeto';
import {
  descricaoDaTrava,
  devolverARede,
  lerBibliotecaNaRede,
  liberarTrava,
  pegarParaEditar,
  publicarNaRede,
  ROTULO_DA_SITUACAO_NA_REDE,
  situacaoNaRede,
  travaVencida,
  type ProjetoNaRede,
} from '../domain/bibliotecaNaRede';
import { guardarNomeNaRede, lerNomeNaRede } from './nomeNaRede';

interface BibliotecaNaRedeProps {
  readonly pasta: AcessoAPasta;
  /** Os projetos deste computador. */
  readonly projetos: readonly Projeto[];
  /** O projeto como está agora (o aberto, com o que ainda não foi salvo), para publicar ou devolver. */
  readonly projetoParaEnviar: (id: string) => Projeto | null;
  /** Põe a cópia da rede na biblioteca deste computador (e na tela, se for o projeto aberto); devolve o que impediu. */
  readonly onTrazer: (projeto: Projeto) => string | null;
  readonly agoraIso: () => string;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * A biblioteca na rede (ADR 0142): a pasta que várias estações usam, os modelos dela com quem está editando cada um, e
 * as ações — publicar, pegar para editar, devolver, trazer uma cópia, liberar a trava.
 */
export function BibliotecaNaRede(props: BibliotecaNaRedeProps): React.JSX.Element {
  const { pasta } = props;
  const [onde, setOnde] = useState<string | null>(null);
  const [quem, setQuem] = useState(lerNomeNaRede);
  const [lista, setLista] = useState<readonly ProjetoNaRede[] | null>(null);
  const [avisos, setAvisos] = useState<readonly string[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [paraPublicar, setParaPublicar] = useState('');

  const recarregar = useCallback(async (): Promise<void> => {
    const lida = await lerBibliotecaNaRede(pasta);
    if (!lida) {
      setLista(null);
      setMensagem('A pasta da rede não está acessível.');
      return;
    }
    setLista(lida.projetos);
    setAvisos(lida.avisos);
  }, [pasta]);

  useEffect(() => {
    let vivo = true;
    void pasta.onde().then((caminho) => {
      if (!vivo) return;
      setOnde(caminho);
      if (caminho) void recarregar();
    });
    return () => {
      vivo = false;
    };
  }, [pasta, recarregar]);

  const mudarNome = (nome: string): void => {
    setQuem(nome);
    guardarNomeNaRede(nome);
  };

  /** Faz uma ação, mostra o resultado e relê a pasta. */
  const fazer = async (acao: () => Promise<string>): Promise<void> => {
    setOcupado(true);
    try {
      setMensagem(await acao());
      await recarregar();
    } catch (e) {
      setMensagem(`A pasta da rede falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOcupado(false);
    }
  };

  const escolher = async (): Promise<void> => {
    try {
      const caminho = await pasta.escolher();
      if (!caminho) return;
      setOnde(caminho);
      setMensagem(`Biblioteca na rede: ${caminho}.`);
      await recarregar();
    } catch (e) {
      setMensagem(`Não deu para usar essa pasta: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const esquecer = async (): Promise<void> => {
    await pasta.esquecer();
    setOnde(null);
    setLista(null);
    setAvisos([]);
    setMensagem('A biblioteca na rede deixou de ser usada neste computador (os modelos continuam na pasta).');
  };

  const locais = new Map(props.projetos.map((p) => [p.id, p]));
  const naRede = new Set((lista ?? []).map((x) => x.projeto.id));
  const publicaveis = props.projetos.filter((p) => !naRede.has(p.id) && p.status !== 'arquivado');
  const ehMinha = (x: ProjetoNaRede): boolean => x.trava !== null && x.trava.quem.trim().toLocaleLowerCase('pt-BR') === quem.trim().toLocaleLowerCase('pt-BR');

  const publicar = (id: string): Promise<void> =>
    fazer(async () => {
      const projeto = props.projetoParaEnviar(id);
      if (!projeto) return 'O projeto não está neste computador.';
      return (await publicarNaRede(pasta, projeto)) ?? `“${projeto.nome}” está na rede.`;
    });

  const pegar = (x: ProjetoNaRede): Promise<void> =>
    fazer(async () => {
      const r = await pegarParaEditar(pasta, x.projeto.id, quem, props.agoraIso());
      if ('erro' in r) return r.erro;
      const local = locais.get(r.projeto.id);
      const situacao = situacaoNaRede(local, r.projeto);
      if (situacao === 'igual') return `“${r.projeto.nome}” é seu até devolver (a cópia deste computador já é igual à da rede).`;
      if (situacao === 'local-mais-nova') return `“${r.projeto.nome}” é seu até devolver. A cópia deste computador é mais nova que a da rede e foi mantida.`;
      const erro = props.onTrazer(r.projeto);
      if (erro) return `“${r.projeto.nome}” é seu até devolver, mas a cópia da rede não foi trazida: ${erro}`;
      return `“${r.projeto.nome}” é seu até devolver: a cópia da rede está na biblioteca deste computador.`;
    });

  const devolver = (x: ProjetoNaRede): Promise<void> =>
    fazer(async () => {
      const projeto = props.projetoParaEnviar(x.projeto.id);
      if (!projeto) return 'Este computador não tem o modelo para devolver: pegue para editar de novo.';
      return (await devolverARede(pasta, projeto, quem)) ?? `“${projeto.nome}” foi devolvido à rede; a trava saiu.`;
    });

  const trazerCopia = (x: ProjetoNaRede): Promise<void> =>
    fazer(async () => {
      if (situacaoNaRede(locais.get(x.projeto.id), x.projeto) === 'local-mais-nova') return `A cópia deste computador de “${x.projeto.nome}” é mais nova que a da rede: nada foi trazido.`;
      const erro = props.onTrazer(x.projeto);
      if (erro) return `A cópia de “${x.projeto.nome}” não foi trazida: ${erro}`;
      return `Uma cópia de “${x.projeto.nome}” está na biblioteca deste computador${x.trava ? ' (para ver: quem devolve é quem está com a trava)' : ''}.`;
    });

  const liberar = (x: ProjetoNaRede): Promise<void> =>
    fazer(async () => (await liberarTrava(pasta, x.projeto.id, quem, props.agoraIso())) ?? `A trava de “${x.projeto.nome}” saiu (nada foi devolvido).`);

  return (
    <section className="biblioteca-na-rede" aria-label="Biblioteca na rede">
      <h3>Biblioteca na rede</h3>
      <p className="nota-do-formulario">
        {onde ? (
          <>
            Pasta: <strong>{onde}</strong>.
          </>
        ) : (
          'Nenhuma pasta escolhida.'
        )}{' '}
        Uma pasta da rede que várias estações usam, sem servidor: quem pega um modelo para editar fica com a trava até devolvê-lo; os outros veem quem está editando e
        podem trazer uma cópia para ver.
      </p>
      <p className="acoes-da-fila">
        <button type="button" onClick={() => void escolher()}>
          {onde ? 'Trocar de pasta…' : 'Escolher a pasta…'}
        </button>
        {onde && (
          <>
            <button type="button" disabled={ocupado} onClick={() => void fazer(async () => 'Lista relida da pasta da rede.')}>
              Atualizar
            </button>
            <button type="button" onClick={() => void esquecer()}>
              Deixar de usar a pasta
            </button>
          </>
        )}
      </p>
      {onde && (
        <>
          <label>
            Seu nome (aparece na trava)
            <input type="text" value={quem} maxLength={60} onChange={(e) => mudarNome(e.target.value)} />
          </label>
          {lista && lista.length === 0 && <p className="nota-do-formulario">Nenhum modelo na pasta da rede ainda.</p>}
          {lista && lista.length > 0 && (
            <table className="tabela-da-rede">
              <caption>Modelos na rede</caption>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Última mudança (na rede)</th>
                  <th>Comparada a este computador</th>
                  <th>Edição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((x) => {
                  const minha = ehMinha(x);
                  return (
                    <tr key={x.projeto.id} className={x.trava ? (minha ? 'travado-por-mim' : 'travado-por-outro') : undefined}>
                      <td>
                        {x.projeto.nome} <span className="codigo-do-projeto">{x.projeto.codigo}</span>
                      </td>
                      <td>{formatarData(x.projeto.modificadoEmIso)}</td>
                      <td>{ROTULO_DA_SITUACAO_NA_REDE[situacaoNaRede(locais.get(x.projeto.id), x.projeto)]}</td>
                      <td>{x.trava ? (minha ? 'Com você' : descricaoDaTrava(x.trava)) : 'Livre'}</td>
                      <td>
                        <div className="acoes-da-rede">
                          {!x.trava && (
                            <button type="button" disabled={ocupado} onClick={() => void pegar(x)}>
                              Pegar para editar
                            </button>
                          )}
                          {minha && (
                            <>
                              <button type="button" className="botao-primario" disabled={ocupado} onClick={() => void devolver(x)}>
                                Devolver à rede
                              </button>
                              <button type="button" disabled={ocupado} onClick={() => void liberar(x)}>
                                Liberar sem devolver
                              </button>
                            </>
                          )}
                          {!minha && (
                            <button type="button" disabled={ocupado} onClick={() => void trazerCopia(x)}>
                              Trazer uma cópia
                            </button>
                          )}
                          {x.trava && !minha && travaVencida(x.trava, props.agoraIso()) && (
                            <button type="button" disabled={ocupado} onClick={() => void liberar(x)}>
                              Liberar a trava esquecida
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {avisos.length > 0 && (
            <ul className="avisos-da-rede">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {publicaveis.length > 0 && (
            <p className="acoes-da-fila publicar-na-rede">
              <label>
                Publicar um modelo deste computador
                <select value={paraPublicar} onChange={(e) => setParaPublicar(e.target.value)}>
                  <option value="">Escolha…</option>
                  {publicaveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.codigo})
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={ocupado || paraPublicar === ''} onClick={() => void publicar(paraPublicar).then(() => setParaPublicar(''))}>
                Publicar na rede
              </button>
            </p>
          )}
        </>
      )}
      {mensagem && (
        <p role="status" className="recado-da-rede">
          {mensagem}
        </p>
      )}
    </section>
  );
}
