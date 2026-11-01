import { useEffect, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';

export interface ReceptorLigado {
  readonly porta: number;
  readonly enderecos: readonly string[];
}

export interface ApiDoReceptor {
  readonly estado: () => Promise<ReceptorLigado | null>;
  readonly ligar: (porta: number) => Promise<ReceptorLigado | string>;
  readonly desligar: () => Promise<void>;
}

interface PainelDoReceptorProps {
  readonly api: ApiDoReceptor;
  readonly onFechar: () => void;
}

const PORTA_DOS_PLOTTERS = '9100';

/** Receber de outro programa (ADR 0222): este computador vira um plotter de rede, e as peças "plotadas" entram no projeto. */
export function PainelDoReceptor(props: PainelDoReceptorProps): React.JSX.Element {
  const { api } = props;
  const [ligado, setLigado] = useState<ReceptorLigado | null>(null);
  const [porta, setPorta] = useState(PORTA_DOS_PLOTTERS);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    void api.estado().then(setLigado);
  }, [api]);

  const ligar = (): void => {
    void api.ligar(Number(porta)).then((r) => {
      if (typeof r === 'string') setMensagem(r);
      else {
        setLigado(r);
        setMensagem('');
      }
    });
  };

  return (
    <Sobreposicao titulo="Receber de outro programa" onFechar={props.onFechar}>
      {mensagem && <p role="alert">{mensagem}</p>}
      <p>Para trazer peças de um sistema de formato fechado, sem arquivo:</p>
      <ol>
        <li>Ligue o receptor aqui.</li>
        <li>No outro computador, instale um plotter HP-GL de rede (porta TCP/IP bruta) com o endereço abaixo. Neste mesmo computador, use o endereço 127.0.0.1.</li>
        <li>No outro sistema, plote as peças nesse plotter, em escala real. Elas entram no projeto aberto.</li>
      </ol>
      <p className="nota-do-formulario">O plotter só traz a forma: linhas, piques e textos desenhados. Graduação e nomes não vêm. Se o sistema exportar DXF-AAMA ou DXF-ASTM, prefira esse arquivo: ele traz tudo.</p>
      {ligado ? (
        <>
          <p>Ligado na porta {ligado.porta}. Endereços: {ligado.enderecos.join(', ') || 'só este computador'}</p>
          <button
            type="button"
            onClick={() => {
              void api.desligar().then(() => setLigado(null));
            }}
          >
            Desligar o receptor
          </button>
        </>
      ) : (
        <>
          <label>
            Porta
            <input type="number" min="1" max="65535" value={porta} onChange={(e) => setPorta(e.target.value)} />
          </label>
          <button type="button" onClick={ligar}>
            Ligar o receptor
          </button>
        </>
      )}
    </Sobreposicao>
  );
}
