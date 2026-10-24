import { useState } from 'react';
import { numeroComVirgula } from '../core/numeros';
import { numeroDoTexto } from './medidas';

/**
 * Um campo de número com vírgula decimal: o texto fica como a pessoa digita ("52," não vira "52" no meio da
 * digitação), e cada valor válido (de 0 para cima) já vai para quem usa. Em branco: `null`, se pode ficar vazio.
 */
export function CampoDeNumero(props: {
  readonly valor: number | null;
  readonly rotulo: string;
  readonly onMudar: (valor: number | null) => void;
  readonly casas?: number;
  readonly desabilitado?: boolean;
  readonly vazioPermitido?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
}): React.JSX.Element {
  const escrito = (v: number | null): string => (v === null ? '' : numeroComVirgula(v, props.casas));
  const [texto, setTexto] = useState(() => escrito(props.valor));
  const [valorVisto, setValorVisto] = useState(props.valor);
  // O valor mudou por fora (outra linha, desfazer): o campo passa a mostrá-lo — a não ser que já seja o digitado.
  if (props.valor !== valorVisto) {
    setValorVisto(props.valor);
    if (numeroDoTexto(texto) !== props.valor) setTexto(escrito(props.valor));
  }
  const lido = numeroDoTexto(texto);
  const invalido = (lido === null && !props.vazioPermitido) || (lido !== null && (Number.isNaN(lido) || lido < 0));
  return (
    <input
      aria-label={props.rotulo}
      inputMode="decimal"
      className={props.className}
      value={texto}
      placeholder={props.placeholder}
      disabled={props.desabilitado}
      aria-invalid={invalido}
      onChange={(e) => {
        setTexto(e.target.value);
        const v = numeroDoTexto(e.target.value);
        if (v === null) {
          if (props.vazioPermitido) props.onMudar(null);
          return;
        }
        if (!Number.isNaN(v) && v >= 0) props.onMudar(v);
      }}
    />
  );
}
