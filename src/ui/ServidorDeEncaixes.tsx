import { useEffect, useState } from 'react';
import { copiasDoTrabalho, ROTULO_DA_SITUACAO_NA_FILA } from '../domain/filaDeEncaixes';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import { acessoAPasta } from './pastasCompartilhadas';
import { useFilaDeEncaixes, type ApiDaFila, type WorkerDoEncaixe } from './useFilaDeEncaixes';
import { useFilaNaRede } from './useFilaNaRede';

/** O que o servidor usa do programa: a fila dele (num arquivo próprio) e o abrir ao entrar no Windows. */
export interface ApiDoServidor {
  lerFilaDoServidor(): Promise<unknown>;
  gravarFilaDoServidor(fila: unknown): Promise<boolean>;
  /** Se o servidor abre ao entrar no Windows (`null`: este sistema não deixa). */
  servidorAoLigar(): Promise<boolean | null>;
  mudarServidorAoLigar(ligar: boolean): Promise<boolean | null>;
}

interface ServidorDeEncaixesProps {
  readonly api?: ApiDoServidor;
  readonly pasta?: AcessoAPasta | null;
  readonly criarWorker?: () => WorkerDoEncaixe;
  readonly intervaloMs?: number;
}

const criarWorkerDoEncaixe = (): WorkerDoEncaixe => new Worker(new URL('../nesting.worker.ts', import.meta.url), { type: 'module' });

/**
 * O servidor de encaixes (ADR 0147): o Enfesto CAD aberto com "--servidor-de-encaixes" mostra só esta janela, que
 * atende a fila da rede (ADR 0143) — sempre, um pedido de cada vez, com a fila própria (num arquivo à parte da fila de
 * quem desenha) — e pode abrir sozinho ao entrar no Windows, numa máquina só para calcular.
 */
export function ServidorDeEncaixes(props: ServidorDeEncaixesProps): React.JSX.Element {
  const api = props.api ?? (window.enfestoCad as ApiDoServidor | undefined);
  const [apiDaFila] = useState<ApiDaFila | undefined>(() =>
    api ? { lerFilaDeEncaixes: () => api.lerFilaDoServidor(), gravarFilaDeEncaixes: (f) => api.gravarFilaDoServidor(f) } : undefined,
  );
  const [pasta] = useState(() => (props.pasta !== undefined ? props.pasta : acessoAPasta('fila')));
  const fila = useFilaDeEncaixes(apiDaFila, props.criarWorker ?? criarWorkerDoEncaixe);
  const rede = useFilaNaRede(pasta, fila, props.intervaloMs ?? 4000, undefined, { atenderSempre: true });
  const [aoLigar, setAoLigar] = useState<boolean | null>(null);

  // O título da janela (o da página cobriria o que o programa deu a ela).
  useEffect(() => {
    document.title = 'Enfesto CAD — servidor de encaixes';
  }, []);

  useEffect(() => {
    if (!api) return;
    let vivo = true;
    void api.servidorAoLigar().then((v) => {
      if (vivo) setAoLigar(v);
    });
    return () => {
      vivo = false;
    };
  }, [api]);

  const pedidos = fila.fila.trabalhos.filter((t) => t.pedidoDaRede);

  return (
    <main className="servidor-de-encaixes">
      <header>
        <h1>Servidor de encaixes</h1>
        <span className={rede.onde ? 'estado-do-servidor atendendo' : 'estado-do-servidor parado'} role="status">
          {rede.onde ? 'Atendendo a fila da rede' : 'Sem a pasta da fila: escolha a pasta'}
        </span>
      </header>
      <p className="nota-do-formulario">
        Esta estação calcula os encaixes que as outras mandam pela fila da rede (Fila de encaixes › Mandar para a rede), um de cada vez, enquanto esta janela está
        aberta. O resultado volta para a fila de quem mandou.
      </p>
      <p>
        {rede.onde ? (
          <>
            Pasta: <strong>{rede.onde}</strong>
          </>
        ) : (
          'Nenhuma pasta escolhida.'
        )}{' '}
        <button type="button" onClick={() => void rede.escolher()}>
          {rede.onde ? 'Trocar de pasta…' : 'Escolher a pasta…'}
        </button>
      </p>
      <label>
        Nome desta estação
        <input type="text" value={rede.quem} maxLength={60} onChange={(e) => rede.mudarQuem(e.target.value)} />
      </label>
      {aoLigar !== null && (
        <label className="opcao-em-linha">
          <input
            type="checkbox"
            checked={aoLigar}
            onChange={(e) => {
              if (!api) return;
              void api.mudarServidorAoLigar(e.target.checked).then((v) => setAoLigar(v));
            }}
          />
          Abrir este servidor ao entrar no Windows
        </label>
      )}
      <dl className="indicadores-da-sala-de-corte">
        <div>
          <dt>Calculados desde que abriu</dt>
          <dd>{rede.entregues}</dd>
        </div>
        <div>
          <dt>Na fila desta estação</dt>
          <dd>{pedidos.length}</dd>
        </div>
      </dl>
      {pedidos.length > 0 && (
        <ul className="pedidos-do-servidor">
          {pedidos.map((t) => (
            <li key={t.id}>
              <strong>{t.projetoNome}</strong> ({t.projetoCodigo}) · pedido de {t.pedidoDaRede!.pedidoPor} · {ROTULO_DA_SITUACAO_NA_FILA[t.situacao]}
              {fila.progresso?.id === t.id ? ` · ${fila.progresso.colocadas} / ${fila.progresso.total} peças` : ` · ${copiasDoTrabalho(t)} cópia(s) de peça`}
            </li>
          ))}
        </ul>
      )}
      {rede.mensagem && <p className="recado-da-rede">{rede.mensagem}</p>}
    </main>
  );
}
