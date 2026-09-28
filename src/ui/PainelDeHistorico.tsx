import { Sobreposicao } from './Sobreposicao';
import { ROTULO_DO_EVENTO, type Projeto } from '../domain/projeto';

interface PainelDeHistoricoProps {
  readonly projeto: Projeto;
  readonly onRestaurar: (idDoEvento: string) => void;
  readonly onFechar: () => void;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export function PainelDeHistorico(props: PainelDeHistoricoProps): React.JSX.Element {
  const eventosDoMaisRecenteParaOMaisAntigo = [...props.projeto.historico].reverse();

  return (
    <Sobreposicao titulo={`Histórico — ${props.projeto.nome}`} onFechar={props.onFechar}>
      <ul className="lista-de-historico">
        {eventosDoMaisRecenteParaOMaisAntigo.map((evento, indice) => (
          <li key={evento.id}>
            <div>
              <strong>{ROTULO_DO_EVENTO[evento.tipo]}</strong>
              <span className="data-do-evento"> — {formatarData(evento.dataHoraIso)}</span>
            </div>
            {evento.descricao && <div className="descricao-do-evento">{evento.descricao}</div>}
            <div className="detalhes-do-evento">{evento.estado.pecas.length} peça(s) neste momento</div>
            {indice !== 0 && (
              <button onClick={() => props.onRestaurar(evento.id)} className="botao-restaurar">
                Restaurar esta versão
              </button>
            )}
          </li>
        ))}
      </ul>
    </Sobreposicao>
  );
}
