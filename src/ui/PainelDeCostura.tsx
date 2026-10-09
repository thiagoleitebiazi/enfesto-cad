import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { formatarMm, lerMedida } from './medidas';
import type { Molde } from '../domain/molde';

interface PainelDeCosturaProps {
  /** Peças que recebem a costura: as marcadas em lote ou, sem lote, a selecionada. */
  readonly pecas: readonly Molde[];
  /** Aplica a margem; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onAplicar: (margemMm: number) => string | null;
  readonly onFechar: () => void;
}

const MARGEM_SUGERIDA_MM = 10;

/** A margem que as peças já têm, se for a mesma em todas e maior que zero; senão, a sugerida. */
function margemInicial(pecas: readonly Molde[]): string {
  const primeira = pecas[0]?.margemDeCosturaMm ?? 0;
  const todasIguais = pecas.every((p) => p.margemDeCosturaMm === primeira);
  return String(todasIguais && primeira > 0 ? primeira : MARGEM_SUGERIDA_MM).replace('.', ',');
}

/**
 * "Costura": a margem de costura da peça, a mesma de "Margem de costura" nas
 * propriedades. A linha de corte é o contorno afastado por essa medida, por
 * igual em toda a volta — costura só num trecho do contorno não existe aqui.
 */
export function PainelDeCostura(props: PainelDeCosturaProps): React.JSX.Element {
  const [margem, setMargem] = useState(() => margemInicial(props.pecas));
  const [erro, setErro] = useState<string | null>(null);
  const umaPeca = props.pecas.length === 1;

  function aplicar(): void {
    const valor = margem.trim() === '' ? null : lerMedida(margem);
    if (valor === null) {
      setErro('Digite a margem de costura, em mm (0 remove a costura).');
      return;
    }
    const mensagem = props.onAplicar(valor);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    props.onFechar();
  }

  return (
    <Sobreposicao titulo="Costura" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-medida-exata"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        <dl className="lista-de-propriedades">
          <dt>{umaPeca ? 'Peça' : 'Peças'}</dt>
          <dd>{umaPeca ? props.pecas[0]!.nome : `${props.pecas.length} selecionadas`}</dd>
          <dt>Costura atual</dt>
          <dd>{[...new Set(props.pecas.map((p) => formatarMm(p.margemDeCosturaMm)))].join(', ')}</dd>
        </dl>

        <label>
          Margem de costura (mm)
          <input
            type="text"
            inputMode="decimal"
            value={margem}
            onChange={(e) => {
              setMargem(e.target.value);
              setErro(null);
            }}
            autoFocus
          />
        </label>
        <p className="nota-do-formulario">
          A linha de corte (tracejada) fica afastada do contorno por essa medida, por igual em toda a volta. 0 remove a
          costura.
        </p>

        {erro && (
          <p className="mensagem-de-erro" role="alert">
            {erro}
          </p>
        )}

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-primario">
            Aplicar
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
