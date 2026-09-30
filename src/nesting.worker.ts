import { executarNestingAutomatico } from './domain/nesting';
import type { Molde } from './domain/molde';
import type { ConfiguracaoDeEnfesto } from './domain/enfesto';

export interface MensagemIniciar {
  readonly tipo: 'iniciar';
  readonly pecas: readonly Molde[];
  readonly enfesto: ConfiguracaoDeEnfesto;
  readonly passoMm?: number;
  readonly limiteDeTempoMs?: number;
  readonly aproveitamentoDesejadoPercentual?: number;
}

export interface MensagemCancelar {
  readonly tipo: 'cancelar';
}

export type MensagemParaWorker = MensagemIniciar | MensagemCancelar;

let cancelado = false;

self.addEventListener('message', (evento: MessageEvent<MensagemParaWorker>) => {
  const mensagem = evento.data;

  if (mensagem.tipo === 'cancelar') {
    cancelado = true;
    return;
  }

  if (mensagem.tipo === 'iniciar') {
    cancelado = false;
    const resultado = executarNestingAutomatico(mensagem.pecas, mensagem.enfesto, {
      ...(mensagem.passoMm !== undefined ? { passoMm: mensagem.passoMm } : {}),
      ...(mensagem.limiteDeTempoMs !== undefined ? { limiteDeTempoMs: mensagem.limiteDeTempoMs } : {}),
      ...(mensagem.aproveitamentoDesejadoPercentual !== undefined
        ? { aproveitamentoDesejadoPercentual: mensagem.aproveitamentoDesejadoPercentual }
        : {}),
      deveContinuar: () => !cancelado,
      aoProgredir: (colocadas, total) => {
        self.postMessage({ tipo: 'progresso', colocadas, total });
      },
    });
    self.postMessage({ tipo: 'concluido', resultado });
  }
});
