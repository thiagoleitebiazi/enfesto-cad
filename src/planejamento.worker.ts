import { executarBusca, type OpcoesDaBusca } from './domain/buscaDeRiscos';
import type { PedidoDeRisco } from './domain/planejamento';

export interface MensagemIniciarBusca {
  readonly tipo: 'iniciar';
  readonly pedidos: readonly PedidoDeRisco[];
  readonly opcoes: OpcoesDaBusca;
}

export type MensagemParaABusca = MensagemIniciarBusca | { readonly tipo: 'cancelar' };

let cancelada = false;

self.addEventListener('message', (evento: MessageEvent<MensagemParaABusca>) => {
  const mensagem = evento.data;
  if (mensagem.tipo === 'cancelar') {
    cancelada = true;
    return;
  }
  cancelada = false;
  void executarBusca(mensagem.pedidos, mensagem.opcoes, {
    aoProgredir: (feitos, total) => self.postMessage({ tipo: 'progresso', feitos, total }),
    deveParar: () => cancelada,
    // A pausa entre um risco e outro deixa chegar o pedido de cancelar.
    pausar: () => new Promise((r) => setTimeout(r, 0)),
  }).then(
    (resultado) => self.postMessage({ tipo: 'concluido', resultado }),
    (erro: unknown) => self.postMessage({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) }),
  );
});
