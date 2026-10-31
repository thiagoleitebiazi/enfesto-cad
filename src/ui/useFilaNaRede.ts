import { useCallback, useEffect, useRef, useState } from 'react';
import { adicionarTrabalho, enviarParaARede, estaTerminado, receberDaRede, removerTrabalho, trazerDaRede } from '../domain/filaDeEncaixes';
import {
  arquivoDoPedido,
  buscarProntos,
  dadosDoPedido,
  devolverEsquecidos,
  devolverPedido,
  entregarPronto,
  mandarPedido,
  pedidoDoTrabalho,
  pegarOProximoPedido,
  PRONTOS_DA_FILA,
  prontoDoTrabalho,
  retirarPedido,
} from '../domain/filaNaRede';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import type { FilaNaTela } from './useFilaDeEncaixes';
import { guardarNomeNaRede, lerNomeNaRede } from './nomeNaRede';

/**
 * A fila de encaixes na rede (ADR 0143), enquanto o programa está aberto: de tempos em tempos, olha a pasta.
 * - **Os mandados daqui que voltaram prontos** terminam na fila desta estação.
 * - **Os pedidos calculados aqui** voltam para a pasta e saem desta fila.
 * - **Atendendo a fila,** com esta fila livre, pega o pedido mais antigo da pasta, que entra na fila desta estação e é
 *   calculado como os outros.
 */

export interface FilaNaRedeNaTela {
  readonly onde: string | null;
  readonly quem: string;
  readonly atender: boolean;
  readonly mensagem: string | null;
  /** Quantos pedidos de outras estações esta calculou e devolveu desde que abriu. */
  readonly entregues: number;
  readonly mudarQuem: (quem: string) => void;
  readonly mudarAtender: (atender: boolean) => void;
  readonly escolher: () => Promise<void>;
  readonly esquecer: () => Promise<void>;
  readonly mandar: (id: string) => Promise<void>;
  readonly trazerDeVolta: (id: string) => Promise<void>;
}

const CHAVE_DE_ATENDER = 'enfesto-cad:atender-a-fila-da-rede';
const agoraPadrao = (): string => new Date().toISOString();
const mensagemDe = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function atenderGuardado(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DE_ATENDER) === 'sim';
  } catch {
    return false;
  }
}

export function useFilaNaRede(
  pasta: AcessoAPasta | null,
  fila: FilaNaTela,
  intervaloMs = 4000,
  agora: () => string = agoraPadrao,
  opcoes: { readonly atenderSempre?: boolean } = {},
): FilaNaRedeNaTela {
  const [onde, setOnde] = useState<string | null>(null);
  const [quem, setQuem] = useState(lerNomeNaRede);
  const [atenderEscolhido, setAtender] = useState(atenderGuardado);
  // O servidor de encaixes (ADR 0147) atende sempre.
  const atender = opcoes.atenderSempre === true || atenderEscolhido;
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [entregues, setEntregues] = useState(0);
  // O passo de tempos em tempos lê o de agora (e não o da hora em que foi criado).
  const filaRef = useRef(fila);
  const quemRef = useRef(quem);
  const atenderRef = useRef(atender);
  const ocupadoRef = useRef(false);
  useEffect(() => {
    filaRef.current = fila;
    quemRef.current = quem;
    atenderRef.current = atender;
  }, [fila, quem, atender]);

  useEffect(() => {
    if (!pasta) return;
    let vivo = true;
    void pasta.onde().then((caminho) => {
      if (vivo) setOnde(caminho);
    });
    return () => {
      vivo = false;
    };
  }, [pasta]);

  const passo = useCallback(async (): Promise<void> => {
    if (!pasta || ocupadoRef.current || !filaRef.current.carregada || filaRef.current.somenteLeitura) return;
    ocupadoRef.current = true;
    try {
      // 1. Os mandados daqui que voltaram prontos.
      const naRede = filaRef.current.fila.trabalhos.filter((t) => t.situacao === 'na-rede').map((t) => t.id);
      for (const pronto of naRede.length > 0 ? await buscarProntos(pasta, naRede) : []) {
        filaRef.current.mudar((f) => receberDaRede(f, pronto.id, pronto));
        await pasta.apagar(PRONTOS_DA_FILA, arquivoDoPedido(pronto.id));
      }
      // 2. Os pedidos calculados aqui: o resultado volta para a pasta, e o trabalho sai desta fila.
      for (const t of filaRef.current.fila.trabalhos) {
        const pronto = prontoDoTrabalho(t, quemRef.current.trim() || 'outra estação', agora());
        if (pronto && (await entregarPronto(pasta, pronto))) {
          filaRef.current.mudar((f) => removerTrabalho(f, t.id));
          setEntregues((n) => n + 1);
          setMensagem(`Devolvido a ${t.pedidoDaRede?.pedidoPor ?? 'quem pediu'}: “${t.projetoNome}” (${t.situacao === 'concluido' ? 'calculado' : 'não calculado'}).`);
        }
      }
      // 3. Atendendo: um pedido de cada vez, com esta fila rodando e sem outro pedido da rede nela.
      const f = filaRef.current.fila;
      if (atenderRef.current && !f.pausada && !f.trabalhos.some((t) => t.pedidoDaRede && !estaTerminado(t))) {
        // Esta estação está livre: o que ainda consta em "calculando" há horas foi esquecido por quem levou (ADR 0150).
        await devolverEsquecidos(pasta, agora());
        const pedido = await pegarOProximoPedido(pasta, { quem: quemRef.current.trim() || 'outra estação', agoraIso: agora() });
        if (pedido) {
          try {
            filaRef.current.mudar((g) => adicionarTrabalho(g, dadosDoPedido(pedido), `rede-${pedido.id}`, agora()));
            setMensagem(`Calculando o pedido de ${pedido.pedidoPor} pela rede: “${pedido.projetoNome}”.`);
          } catch (e) {
            await devolverPedido(pasta, pedido.id);
            setMensagem(`O pedido de ${pedido.pedidoPor} voltou para a pasta: ${mensagemDe(e)}`);
          }
        }
      }
    } catch (e) {
      setMensagem(`A fila da rede falhou: ${mensagemDe(e)}`);
    } finally {
      ocupadoRef.current = false;
    }
  }, [pasta, agora]);

  useEffect(() => {
    if (!pasta || !onde) return;
    const relogio = setInterval(() => void passo(), intervaloMs);
    return () => clearInterval(relogio);
  }, [pasta, onde, passo, intervaloMs]);

  const mudarQuem = useCallback((nome: string) => {
    setQuem(nome);
    guardarNomeNaRede(nome);
  }, []);

  const mudarAtender = useCallback((sim: boolean) => {
    setAtender(sim);
    try {
      window.localStorage.setItem(CHAVE_DE_ATENDER, sim ? 'sim' : 'não');
    } catch {
      // Sem o armazenamento do navegador, vale até fechar o programa.
    }
  }, []);

  const escolher = useCallback(async () => {
    if (!pasta) return;
    try {
      const caminho = await pasta.escolher();
      if (!caminho) return;
      setOnde(caminho);
      setMensagem(`Fila da rede: ${caminho} (com as subpastas pedidos, calculando e prontos).`);
    } catch (e) {
      setMensagem(`Não deu para usar essa pasta: ${mensagemDe(e)}`);
    }
  }, [pasta]);

  const esquecer = useCallback(async () => {
    if (!pasta) return;
    await pasta.esquecer();
    setOnde(null);
    setMensagem('A fila da rede deixou de ser usada neste computador.');
  }, [pasta]);

  const mandar = useCallback(
    async (id: string) => {
      const t = fila.fila.trabalhos.find((x) => x.id === id);
      if (!pasta || !t) return;
      if (quem.trim() === '') {
        setMensagem('Escreva o nome desta estação (ele vai com o pedido, para se saber de onde veio).');
        return;
      }
      try {
        if (!(await mandarPedido(pasta, pedidoDoTrabalho(t, quem.trim(), agora())))) {
          setMensagem('Não deu para gravar o pedido na pasta da rede.');
          return;
        }
        fila.mudar((f) => enviarParaARede(f, id, agora()));
        setMensagem(`“${t.projetoNome}” foi para a fila da rede: a estação que atende calcula, e o encaixe volta para esta fila.`);
      } catch (e) {
        setMensagem(`A fila da rede falhou: ${mensagemDe(e)}`);
      }
    },
    [pasta, fila, quem, agora],
  );

  const trazerDeVolta = useCallback(
    async (id: string) => {
      if (!pasta) return;
      const retirado = await retirarPedido(pasta, id);
      fila.mudar((f) => trazerDaRede(f, id));
      setMensagem(
        retirado
          ? 'O encaixe voltou para esta fila (o pedido saiu da pasta).'
          : 'O encaixe voltou para esta fila; outra estação já tinha começado a calcular, e o resultado dela não entra aqui.',
      );
    },
    [pasta, fila],
  );

  return { onde, quem, atender, mensagem, entregues, mudarQuem, mudarAtender, escolher, esquecer, mandar, trazerDeVolta };
}
