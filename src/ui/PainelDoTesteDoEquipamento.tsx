import { LADO_DO_QUADRADO_MM } from '../formats/testeDoEquipamento';
import { Sobreposicao } from './Sobreposicao';

interface PainelDoTesteDoEquipamentoProps {
  /** A porta de saída; em branco, não há para onde mandar. */
  readonly destino: string;
  readonly onEnviarAMesa: () => void;
  readonly onFechar: () => void;
}

/** O teste na mesa de corte de verdade (ADR 0217). */
export function PainelDoTesteDoEquipamento(props: PainelDoTesteDoEquipamentoProps): React.JSX.Element {
  return (
    <Sobreposicao titulo="Teste da mesa de corte" onFechar={props.onFechar}>
      <p className="nota-do-formulario">O envio vai para: {props.destino || 'nenhuma porta escolhida'}. Para trocar, use Opções › Porta de saída.</p>
      <ol>
        <li>Ponha só papel na mesa, e faça o primeiro teste com a caneta no lugar da faca, se a mesa permitir.</li>
        <li>Envie o teste: a ferramenta T1 faz um quadrado de {LADO_DO_QUADRADO_MM} mm.</li>
        <li>Confira a medida, que a ferramenta sobe nos deslocamentos e que a mesa aceitou o arquivo até o fim.</li>
      </ol>
      <button type="button" disabled={props.destino === ''} title={props.destino === '' ? 'Escolha a porta de saída primeiro' : undefined} onClick={props.onEnviarAMesa}>
        Enviar o teste de corte
      </button>
    </Sobreposicao>
  );
}
