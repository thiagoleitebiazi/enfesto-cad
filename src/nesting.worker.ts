import { comOrientacaoInicial } from './domain/encaixeManual';
import { juntarDobra, prepararDobra } from './domain/pecasNaDobra';
import { executarEmFatias, executarNestingPorPontosDeCanto, passosDoNesting, type MetodoDoNesting } from './domain/nesting';
import type { Molde } from './domain/molde';
import type { ConfiguracaoDeEnfesto } from './domain/enfesto';

export interface MensagemIniciar {
  readonly tipo: 'iniciar';
  readonly pecas: readonly Molde[];
  readonly enfesto: ConfiguracaoDeEnfesto;
  readonly passoMm?: number;
  readonly limiteDeTempoMs?: number;
  readonly aproveitamentoDesejadoPercentual?: number;
  readonly tecidoDeSentidoUnico?: boolean;
  /** Ausente: a busca em grade (o de sempre). */
  readonly metodo?: MetodoDoNesting;
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

  if (mensagem.tipo === 'iniciar' && mensagem.metodo === 'pontos-de-canto') {
    // De uma vez só (é rápido): o cancelar deste método é a janela fechar o Worker.
    try {
      const dobra = prepararDobra(mensagem.pecas.map(comOrientacaoInicial), mensagem.enfesto, mensagem.tecidoDeSentidoUnico === true);
      const resultado = executarNestingPorPontosDeCanto(dobra.resto, dobra.enfesto, {
        ...(mensagem.limiteDeTempoMs !== undefined ? { limiteDeTempoMs: mensagem.limiteDeTempoMs } : {}),
        ...(mensagem.tecidoDeSentidoUnico ? { tecidoDeSentidoUnico: true } : {}),
        aoProgredir: (colocadas, total) => self.postMessage({ tipo: 'progresso', colocadas, total }),
      });
      self.postMessage({ tipo: 'concluido', resultado: juntarDobra(resultado, dobra, mensagem.enfesto) });
    } catch (erro) {
      self.postMessage({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) });
    }
    return;
  }

  if (mensagem.tipo === 'iniciar') {
    cancelado = false;
    // Em fatias, com uma pausa entre elas: é na pausa que a mensagem "cancelar" chega e muda `cancelado`.
    const dobra = prepararDobra(mensagem.pecas.map(comOrientacaoInicial), mensagem.enfesto, mensagem.tecidoDeSentidoUnico === true);
    const passos = passosDoNesting(dobra.resto, dobra.enfesto, {
      ...(mensagem.passoMm !== undefined ? { passoMm: mensagem.passoMm } : {}),
      ...(mensagem.limiteDeTempoMs !== undefined ? { limiteDeTempoMs: mensagem.limiteDeTempoMs } : {}),
      ...(mensagem.aproveitamentoDesejadoPercentual !== undefined
        ? { aproveitamentoDesejadoPercentual: mensagem.aproveitamentoDesejadoPercentual }
        : {}),
      ...(mensagem.tecidoDeSentidoUnico ? { tecidoDeSentidoUnico: true } : {}),
      deveContinuar: () => !cancelado,
      aoProgredir: (colocadas, total) => {
        self.postMessage({ tipo: 'progresso', colocadas, total });
      },
    });
    void executarEmFatias(passos, () => new Promise((r) => setTimeout(r, 0))).then(
      (resultado) => self.postMessage({ tipo: 'concluido', resultado: juntarDobra(resultado, dobra, mensagem.enfesto) }),
      // Um erro no cálculo vai para a janela, que antes ficava em "Calculando..." para sempre.
      (erro: unknown) => self.postMessage({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) }),
    );
  }
});
