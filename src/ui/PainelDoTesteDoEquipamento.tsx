import { useState } from 'react';
import { numeroComVirgula } from '../core/numeros';
import { calibracaoDasMedidas, COMPRIMENTO_PADRAO_DO_TESTE_MM, LADO_DO_QUADRADO_MM, LARGURA_DA_PAGINA_MM, type Calibracao } from '../formats/testeDoEquipamento';
import { Sobreposicao } from './Sobreposicao';

interface PainelDoTesteDoEquipamentoProps {
  /** Para onde o teste vai; em branco, a pasta do plotter. */
  readonly destino: string;
  readonly calibracao: Calibracao | null;
  readonly agoraIso: () => string;
  readonly onEnviarAoPlotter: (comprimentoMm: number) => void;
  readonly onEnviarAMesa: () => void;
  readonly onCalibracao: (calibracao: Calibracao | null) => void;
  readonly onFechar: () => void;
}

const lerNumero = (texto: string): number => Number(texto.replace(',', '.'));
const emPercentual = (f: number): string => `${f >= 1 ? '+' : ''}${numeroComVirgula((f - 1) * 100, 2)}%`;

/** O teste na máquina de verdade (ADR 0217): envia, mede com a trena, e o programa corrige. */
export function PainelDoTesteDoEquipamento(props: PainelDoTesteDoEquipamentoProps): React.JSX.Element {
  const [comprimento, setComprimento] = useState(String(COMPRIMENTO_PADRAO_DO_TESTE_MM));
  const [medidoComprimento, setMedidoComprimento] = useState('');
  const [medidoLargura, setMedidoLargura] = useState('');
  const [mensagem, setMensagem] = useState('');
  const nominal = lerNumero(comprimento);
  const comprimentoValido = Number.isInteger(nominal) && nominal >= 300 && nominal <= 20000;

  const enviar = (): void => {
    if (!comprimentoValido) {
      setMensagem('O comprimento do teste vai de 300 a 20000 mm, sem casas decimais.');
      return;
    }
    props.onEnviarAoPlotter(nominal);
    setMensagem(`Página de teste enviada para ${props.destino || 'a pasta do plotter'}. Meça a moldura depois que sair.`);
  };

  const guardar = (): void => {
    try {
      const c = calibracaoDasMedidas({ comprimentoMm: lerNumero(medidoComprimento), larguraMm: lerNumero(medidoLargura) }, nominal, props.agoraIso());
      props.onCalibracao(c);
      setMensagem(`Correção guardada: ${emPercentual(c.horizontal)} no comprimento e ${emPercentual(c.vertical)} na largura. Envie a página de novo para conferir.`);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sobreposicao titulo="Teste do equipamento" onFechar={props.onFechar}>
      {mensagem && <p role="status">{mensagem}</p>}
      <p className="nota-do-formulario">O envio vai para: {props.destino || 'a pasta do plotter'}. Para trocar, use Opções › Porta de saída.</p>
      <fieldset className="grupo-de-opcoes-do-formulario">
        <legend>Plotter</legend>
        <ol>
          <li>Envie a página de teste, em papel.</li>
          <li>
            Confira: saiu uma moldura, um quadrado de {LADO_DO_QUADRADO_MM} mm, os números da régua e os nomes legíveis, com as canetas certas.
          </li>
          <li>Meça a moldura com a trena, de fora a fora, e escreva abaixo. O programa corrige todos os riscos seguintes.</li>
        </ol>
        <label>
          Comprimento do teste (mm)
          <input type="text" inputMode="numeric" value={comprimento} onChange={(e) => setComprimento(e.target.value)} />
        </label>
        <button type="button" onClick={enviar}>
          Enviar a página de teste
        </button>
        <label>
          Comprimento medido (mm, deve dar {comprimentoValido ? nominal : '—'})
          <input type="text" inputMode="decimal" value={medidoComprimento} onChange={(e) => setMedidoComprimento(e.target.value)} />
        </label>
        <label>
          Largura medida (mm, deve dar {LARGURA_DA_PAGINA_MM})
          <input type="text" inputMode="decimal" value={medidoLargura} onChange={(e) => setMedidoLargura(e.target.value)} />
        </label>
        <button type="button" disabled={!comprimentoValido} onClick={guardar}>
          Guardar a correção
        </button>{' '}
        {props.calibracao && (
          <button
            type="button"
            onClick={() => {
              props.onCalibracao(null);
              setMensagem('Correção apagada: os riscos saem na medida do arquivo.');
            }}
          >
            Apagar a correção
          </button>
        )}
        <p>{props.calibracao ? `Correção em uso: ${emPercentual(props.calibracao.horizontal)} no comprimento e ${emPercentual(props.calibracao.vertical)} na largura.` : 'Nenhuma correção em uso.'}</p>
      </fieldset>
      <fieldset className="grupo-de-opcoes-do-formulario">
        <legend>Mesa de corte</legend>
        <ol>
          <li>Ponha só papel na mesa, e faça o primeiro teste com a caneta no lugar da faca, se a mesa permitir.</li>
          <li>Envie o teste: a ferramenta T1 faz um quadrado de {LADO_DO_QUADRADO_MM} mm.</li>
          <li>Confira a medida, que a ferramenta sobe nos deslocamentos e que a mesa aceitou o arquivo até o fim.</li>
        </ol>
        <button type="button" disabled={props.destino === ''} title={props.destino === '' ? 'Escolha a porta de saída primeiro' : undefined} onClick={props.onEnviarAMesa}>
          Enviar o teste de corte
        </button>
      </fieldset>
    </Sobreposicao>
  );
}
