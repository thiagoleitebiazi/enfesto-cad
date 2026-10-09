import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import type { CurvaCadastrada } from './curvasCadastradas';

interface PainelDeCurvaPredefinidaProps {
  /** As curvas de fábrica e as cadastradas pelo usuário, nessa ordem. */
  readonly curvas: readonly CurvaCadastrada[];
  readonly idInicial: string | null;
  readonly espelharInicial: boolean;
  /** Fica com a curva escolhida: os próximos dois cliques no contorno a aplicam. */
  readonly onEscolher: (curva: CurvaCadastrada, espelhar: boolean) => void;
  readonly onExcluir: (id: string) => void;
  readonly onFechar: () => void;
}

const LARGURA_DA_MINIATURA = 96;
const ALTURA_DA_MINIATURA = 44;
const MARGEM_DA_MINIATURA = 5;

/** A forma da curva (corda de (0,0) a (1,0)) desenhada numa miniatura, centralizada e sem distorcer. */
function MiniaturaDaCurva(props: { readonly forma: CurvaCadastrada['forma'] }): React.JSX.Element {
  const ys = props.forma.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const escala = Math.min(
    LARGURA_DA_MINIATURA - 2 * MARGEM_DA_MINIATURA,
    (ALTURA_DA_MINIATURA - 2 * MARGEM_DA_MINIATURA) / Math.max(maxY - minY, 1e-6),
  );
  const x0 = (LARGURA_DA_MINIATURA - escala) / 2;
  const y0 = ALTURA_DA_MINIATURA / 2 + ((minY + maxY) / 2) * escala;
  const pontos = props.forma.map((p) => `${(x0 + p.x * escala).toFixed(1)},${(y0 - p.y * escala).toFixed(1)}`).join(' ');
  return (
    <svg
      className="miniatura-da-curva"
      width={LARGURA_DA_MINIATURA}
      height={ALTURA_DA_MINIATURA}
      viewBox={`0 0 ${LARGURA_DA_MINIATURA} ${ALTURA_DA_MINIATURA}`}
      aria-hidden="true"
    >
      <polyline points={pontos} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * "Pré-definida": escolhe uma curva do cadastro para pôr entre dois pontos do
 * contorno. A curva estica ou encolhe por igual até caber entre eles;
 * "Espelhar" a vira para o outro lado. As curvas do usuário podem ser
 * excluídas aqui; as de fábrica, não.
 */
export function PainelDeCurvaPredefinida(props: PainelDeCurvaPredefinidaProps): React.JSX.Element {
  const [escolhidaId, setEscolhidaId] = useState<string | null>(
    props.curvas.some((c) => c.id === props.idInicial) ? props.idInicial : (props.curvas[0]?.id ?? null),
  );
  const [espelhar, setEspelhar] = useState(props.espelharInicial);
  const escolhida = props.curvas.find((c) => c.id === escolhidaId) ?? null;

  return (
    <Sobreposicao titulo="Curva pré-definida" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao painel-de-curva-predefinida"
        onSubmit={(e) => {
          e.preventDefault();
          if (!escolhida) return;
          props.onEscolher(escolhida, espelhar);
          props.onFechar();
        }}
      >
        <ul className="lista-de-curvas" role="radiogroup" aria-label="Curvas cadastradas">
          {props.curvas.map((curva) => (
            <li key={curva.id} className={curva.id === escolhidaId ? 'curva-escolhida' : undefined}>
              <label className="opcao-em-linha">
                <input
                  type="radio"
                  name="curva-predefinida"
                  checked={curva.id === escolhidaId}
                  onChange={() => setEscolhidaId(curva.id)}
                />
                <MiniaturaDaCurva forma={curva.forma} />
                <span>{curva.nome}</span>
              </label>
              {!curva.deFabrica && (
                <button
                  type="button"
                  onClick={() => {
                    if (curva.id === escolhidaId) setEscolhidaId(props.curvas.find((c) => c.id !== curva.id)?.id ?? null);
                    props.onExcluir(curva.id);
                  }}
                  aria-label={`Excluir a curva ${curva.nome}`}
                >
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>

        <label className="opcao-em-linha">
          <input type="checkbox" checked={espelhar} onChange={(e) => setEspelhar(e.target.checked)} />
          Espelhar: virar a curva para o outro lado
        </label>
        <p className="nota-do-formulario">
          Depois de escolher, clique em dois pontos do contorno da peça selecionada: a curva estica ou encolhe por
          igual até caber entre eles, no lugar do trecho mais curto que os liga. Para guardar uma curva sua, use
          &ldquo;Cadastrar curva&rdquo;.
        </p>

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-primario" disabled={!escolhida}>
            Usar esta curva
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
