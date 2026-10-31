import type { EstadoDaImpressao, FilaDeImpressao } from '../domain/filaDeImpressao';
import { Sobreposicao } from './Sobreposicao';

interface PainelDaFilaDeImpressaoProps {
  readonly fila: FilaDeImpressao;
  readonly onPausar: () => void;
  readonly onMover: (id: string, passo: -1 | 1) => void;
  readonly onCancelar: (id: string) => void;
  readonly onReenviar: (id: string) => void;
  readonly onLimpar: () => void;
  readonly onFechar: () => void;
}

const ROTULO_DO_ESTADO: Readonly<Record<EstadoDaImpressao, string>> = {
  'na-fila': 'Na fila',
  enviando: 'Enviando',
  enviado: 'Enviado',
  erro: 'Erro',
  cancelado: 'Cancelado',
};

/** O gerenciador de impressão (ADR 0210): o que vai para o plotter, em que ordem, e o que deu errado. */
export function PainelDaFilaDeImpressao(props: PainelDaFilaDeImpressaoProps): React.JSX.Element {
  const { fila } = props;
  return (
    <Sobreposicao titulo="Gerenciador de impressão" onFechar={props.onFechar}>
      <p>
        <button type="button" onClick={props.onPausar}>
          {fila.pausada ? 'Continuar a fila' : 'Pausar a fila'}
        </button>{' '}
        <button type="button" onClick={props.onLimpar}>
          Limpar os concluídos
        </button>
      </p>
      {fila.trabalhos.length === 0 ? (
        <p>Nenhum risco na fila. Escolha a porta de saída e use "Enviar ao plotter".</p>
      ) : (
        <table className="tabela-de-moldes">
          <thead>
            <tr>
              <th scope="col">Risco</th>
              <th scope="col">Destino</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {fila.trabalhos.map((t) => (
              <tr key={t.id}>
                <td>{t.nome}</td>
                <td>{t.destino}</td>
                <td>{t.erro ? `${ROTULO_DO_ESTADO[t.estado]}: ${t.erro}` : ROTULO_DO_ESTADO[t.estado]}</td>
                <td>
                  {t.estado === 'na-fila' && (
                    <>
                      <button type="button" aria-label={`Subir ${t.nome}`} onClick={() => props.onMover(t.id, -1)}>
                        ↑
                      </button>
                      <button type="button" aria-label={`Descer ${t.nome}`} onClick={() => props.onMover(t.id, 1)}>
                        ↓
                      </button>
                      <button type="button" aria-label={`Cancelar ${t.nome}`} onClick={() => props.onCancelar(t.id)}>
                        Cancelar
                      </button>
                    </>
                  )}
                  {(t.estado === 'erro' || t.estado === 'cancelado') && (
                    <button type="button" aria-label={`Enviar de novo ${t.nome}`} onClick={() => props.onReenviar(t.id)}>
                      Enviar de novo
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sobreposicao>
  );
}
