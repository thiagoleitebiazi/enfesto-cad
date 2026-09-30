import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';

interface PainelDeDimensionarProps {
  readonly larguraAtualMm: number;
  readonly alturaAtualMm: number;
  readonly onAplicar: (fatorX: number, fatorY: number, comoCopia: boolean) => void;
  readonly onFechar: () => void;
}

/**
 * "Dimensionar" (inspirado no Audaces Moldes Avançado): escala a peça por
 * fatores X/Y independentes, com prévia em mm do tamanho resultante — mesma
 * ideia dos campos "Fator X"/"Fator Y"/"DX"/"DY" do Audaces, adaptada para
 * mm (unidade interna deste app em todos os outros lugares) em vez de cm.
 */
export function PainelDeDimensionar(props: PainelDeDimensionarProps): React.JSX.Element {
  const [fatorX, setFatorX] = useState('1');
  const [fatorY, setFatorY] = useState('1');
  const [comoCopia, setComoCopia] = useState(false);

  const fx = Number.parseFloat(fatorX);
  const fy = Number.parseFloat(fatorY);
  const fatoresValidos = Number.isFinite(fx) && fx > 0 && Number.isFinite(fy) && fy > 0;

  function aplicar(): void {
    if (!fatoresValidos) {
      window.alert('Fator X e Fator Y precisam ser números maiores que zero.');
      return;
    }
    props.onAplicar(fx, fy, comoCopia);
  }

  return (
    <Sobreposicao titulo="Dimensionar" onFechar={props.onFechar}>
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        <label>
          Fator X
          <input type="number" min={0} step={0.01} value={fatorX} onChange={(e) => setFatorX(e.target.value)} autoFocus />
        </label>
        <label>
          Fator Y
          <input type="number" min={0} step={0.01} value={fatorY} onChange={(e) => setFatorY(e.target.value)} />
        </label>

        <dl className="lista-de-propriedades">
          <dt>Largura atual</dt>
          <dd>{props.larguraAtualMm.toFixed(1)} mm</dd>
          <dt>Altura atual</dt>
          <dd>{props.alturaAtualMm.toFixed(1)} mm</dd>
          <dt>Nova largura</dt>
          <dd>{fatoresValidos ? (props.larguraAtualMm * fx).toFixed(1) : '—'} mm</dd>
          <dt>Nova altura</dt>
          <dd>{fatoresValidos ? (props.alturaAtualMm * fy).toFixed(1) : '—'} mm</dd>
        </dl>

        <label className="opcao-em-linha">
          <input type="checkbox" checked={comoCopia} onChange={(e) => setComoCopia(e.target.checked)} />
          Fazer cópia (mantém a peça original intacta)
        </label>

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="button" onClick={aplicar} className="botao-primario">
            Aplicar
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
