import { useCallback, useEffect, useRef, useState } from 'react';
import {
  concluirTrabalho,
  copiasDoTrabalho,
  falharTrabalho,
  FILA_VAZIA,
  iniciarTrabalho,
  lerFilaDeEncaixes,
  proximoTrabalho,
  recuperarInterrompidos,
  type FilaDeEncaixes,
  type TrabalhoDeEncaixe,
} from '../domain/filaDeEncaixes';
import type { MensagemParaWorker } from '../nesting.worker';

/**
 * Quem roda a fila de encaixes (ADR 0102): lê a fila do disco ao abrir o programa, calcula um trabalho de cada vez
 * num Web Worker (o mesmo do encaixe automático — a tela não trava), guarda o resultado e passa ao próximo da vez.
 * Cada mudança na fila é gravada na hora.
 */

export interface ApiDaFila {
  lerFilaDeEncaixes(): Promise<unknown>;
  gravarFilaDeEncaixes(fila: unknown): Promise<boolean>;
}

/** O que a fila usa de um Worker (o do encaixe; nos testes, um falso). */
export interface WorkerDoEncaixe {
  onmessage: ((evento: MessageEvent) => void) | null;
  onerror: ((evento: ErrorEvent) => void) | null;
  postMessage(mensagem: MensagemParaWorker): void;
  terminate(): void;
}

export interface ProgressoNaFila {
  readonly id: string;
  readonly colocadas: number;
  readonly total: number;
}

export interface FilaNaTela {
  readonly fila: FilaDeEncaixes;
  readonly carregada: boolean;
  /** O progresso do que está calculando (vale só enquanto o trabalho dele está "executando"). */
  readonly progresso: ProgressoNaFila | null;
  readonly avisos: readonly string[];
  /** A fila é de uma versão mais nova do programa: aparece, mas não é gravada. */
  readonly somenteLeitura: boolean;
  /** Muda a fila e grava; a exceção da mudança (o motivo de uma recusa) chega a quem chamou. */
  readonly mudar: (mudanca: (fila: FilaDeEncaixes) => FilaDeEncaixes) => void;
}

const agoraPadrao = (): string => new Date().toISOString();
const mensagemDe = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function useFilaDeEncaixes(api: ApiDaFila | undefined, criarWorker: () => WorkerDoEncaixe, agora: () => string = agoraPadrao): FilaNaTela {
  const [fila, setFila] = useState<FilaDeEncaixes>(FILA_VAZIA);
  const filaRef = useRef<FilaDeEncaixes>(FILA_VAZIA);
  const [carregada, setCarregada] = useState(false);
  const carregadaRef = useRef(false);
  const [progresso, setProgresso] = useState<ProgressoNaFila | null>(null);
  const [avisos, setAvisos] = useState<readonly string[]>([]);
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  const somenteLeituraRef = useRef(false);
  const emCursoRef = useRef<{ readonly id: string; readonly worker: WorkerDoEncaixe } | null>(null);

  const avisar = useCallback((texto: string) => setAvisos((lista) => (lista.includes(texto) ? lista : [...lista, texto])), []);

  const gravar = useCallback(
    (nova: FilaDeEncaixes) => {
      if (!api || somenteLeituraRef.current) return;
      api.gravarFilaDeEncaixes(nova).catch((e: unknown) => avisar(`A fila de encaixes não foi gravada: ${mensagemDe(e)}`));
    },
    [api, avisar],
  );

  const mudar = useCallback(
    (mudanca: (fila: FilaDeEncaixes) => FilaDeEncaixes) => {
      if (!carregadaRef.current) throw new Error('A fila de encaixes ainda está sendo lida: tente de novo em um instante.');
      const antes = filaRef.current;
      const nova = mudanca(antes);
      if (nova === antes) return;
      filaRef.current = nova;
      setFila(nova);
      gravar(nova);
    },
    [gravar],
  );

  // Ao abrir: a fila do disco; o que calculava quando o programa fechou volta para a vez e recomeça.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const novos: string[] = [];
      let bruto: unknown = null;
      try {
        if (api) bruto = await api.lerFilaDeEncaixes();
      } catch {
        novos.push('A fila de encaixes não pôde ser lida: ela começa vazia, e o arquivo antigo vai para as cópias de segurança na primeira gravação.');
      }
      const objeto = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : null;
      if (objeto && typeof objeto.recuperadoDaVersaoAnterior === 'string') {
        novos.push('O arquivo da fila de encaixes estava perdido ou quebrado: o programa abriu a versão anterior dele (a da gravação de antes).');
        bruto = objeto.conteudo;
      } else if (objeto && typeof objeto.arquivoIlegivel === 'string') {
        novos.push(`O arquivo da fila de encaixes (${objeto.arquivoIlegivel}) está quebrado: a fila começa vazia, e o arquivo quebrado vai para as cópias de segurança na primeira gravação.`);
        bruto = null;
      }
      const lida = lerFilaDeEncaixes(bruto);
      novos.push(...lida.descartados);
      if (lida.maisNovo) novos.push('A fila de encaixes foi gravada por uma versão mais nova do programa: ela aparece, mas não é gravada por esta versão.');
      if (!vivo) return;
      somenteLeituraRef.current = lida.maisNovo;
      setSomenteLeitura(lida.maisNovo);
      const recuperada = recuperarInterrompidos(lida.fila);
      filaRef.current = recuperada;
      carregadaRef.current = true;
      setFila(recuperada);
      setAvisos(novos);
      setCarregada(true);
      if (recuperada !== lida.fila) gravar(recuperada);
    })();
    return () => {
      vivo = false;
    };
  }, [api, gravar]);

  const comecar = useCallback(
    (trabalho: TrabalhoDeEncaixe) => {
      let worker: WorkerDoEncaixe;
      try {
        worker = criarWorker();
      } catch (e) {
        mudar((f) => falharTrabalho(iniciarTrabalho(f, trabalho.id, agora()), trabalho.id, `o cálculo não pôde ser iniciado: ${mensagemDe(e)}`, agora()));
        return;
      }
      emCursoRef.current = { id: trabalho.id, worker };
      setProgresso({ id: trabalho.id, colocadas: 0, total: copiasDoTrabalho(trabalho) });
      const ehOAtual = (): boolean => emCursoRef.current?.worker === worker;
      const terminar = (mudanca: (f: FilaDeEncaixes) => FilaDeEncaixes): void => {
        worker.terminate();
        if (!ehOAtual()) return;
        emCursoRef.current = null;
        mudar(mudanca);
      };
      worker.onmessage = (evento: MessageEvent) => {
        if (!ehOAtual()) return;
        const mensagem = evento.data as { tipo: string; colocadas?: number; total?: number; resultado?: unknown; mensagem?: string };
        if (mensagem.tipo === 'progresso') {
          setProgresso({ id: trabalho.id, colocadas: mensagem.colocadas ?? 0, total: mensagem.total ?? 0 });
        } else if (mensagem.tipo === 'concluido') {
          terminar((f) => concluirTrabalho(f, trabalho.id, mensagem.resultado as NonNullable<TrabalhoDeEncaixe['resultado']>, agora()));
        } else if (mensagem.tipo === 'erro') {
          terminar((f) => falharTrabalho(f, trabalho.id, mensagem.mensagem ?? 'erro desconhecido', agora()));
        }
      };
      worker.onerror = (evento: ErrorEvent) => {
        evento.preventDefault();
        if (ehOAtual()) terminar((f) => falharTrabalho(f, trabalho.id, evento.message || 'o cálculo não pôde ser iniciado.', agora()));
      };
      mudar((f) => iniciarTrabalho(f, trabalho.id, agora()));
      const o = trabalho.opcoes;
      worker.postMessage({
        tipo: 'iniciar',
        pecas: trabalho.pecas,
        enfesto: trabalho.enfesto,
        ...(o.limiteDeTempoMs !== undefined ? { limiteDeTempoMs: o.limiteDeTempoMs } : {}),
        ...(o.aproveitamentoDesejadoPercentual !== undefined ? { aproveitamentoDesejadoPercentual: o.aproveitamentoDesejadoPercentual } : {}),
        ...(o.tecidoDeSentidoUnico ? { tecidoDeSentidoUnico: true } : {}),
        ...(o.metodo !== 'grade' ? { metodo: o.metodo } : {}),
      });
    },
    [criarWorker, mudar, agora],
  );

  // A cada mudança: o que calculava e saiu de "executando" (pausado, cancelado) para; e, livre, começa o próximo.
  useEffect(() => {
    if (!carregada) return;
    const emCurso = emCursoRef.current;
    if (emCurso) {
      if (fila.trabalhos.find((t) => t.id === emCurso.id)?.situacao === 'executando') return;
      emCurso.worker.terminate();
      emCursoRef.current = null;
    }
    const proximo = proximoTrabalho(fila);
    if (proximo) comecar(proximo);
  }, [fila, carregada, comecar]);

  // O programa fechando: o cálculo em curso para (e recomeça na próxima abertura).
  useEffect(
    () => () => {
      emCursoRef.current?.worker.terminate();
      emCursoRef.current = null;
    },
    [],
  );

  const progressoValido = progresso && fila.trabalhos.some((t) => t.id === progresso.id && t.situacao === 'executando') ? progresso : null;
  return { fila, carregada, progresso: progressoValido, avisos, somenteLeitura, mudar };
}
