import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { formatarMm } from './medidas';
import type { RegraCadastrada } from './regrasDeGraduacao';
import { paraATela } from './tabelaDeGraduacao';

interface PainelDeRegrasProps {
  readonly regras: readonly RegraCadastrada[];
  readonly idInicial: string | null;
  /** Fica com a regra escolhida: os próximos cliques nos pontos do contorno a aplicam. */
  readonly onEscolher: (regra: RegraCadastrada) => void;
  readonly onExcluir: (id: string) => void;
  readonly onFechar: () => void;
}

/** A regra numa linha: os tamanhos e o que o ponto anda no maior deles. */
function resumoDaRegra(regra: RegraCadastrada): string {
  const ultimo = regra.deslocamentos.at(-1) ?? { x: 0, y: 0 };
  const naTela = paraATela(ultimo);
  return `${regra.tamanhos.join(', ')} (base ${regra.base}) — no ${regra.tamanhos.at(-1)}: DX ${formatarMm(naTela.dx)}, DY ${formatarMm(naTela.dy)}`;
}

/**
 * "Regras": escolhe uma regra de graduação do cadastro para aplicar aos pontos
 * que forem clicados. As regras são as guardadas com "Criar regra" e valem
 * pelo nome dos tamanhos.
 */
export function PainelDeRegras(props: PainelDeRegrasProps): React.JSX.Element {
  const [escolhidaId, setEscolhidaId] = useState<string | null>(
    props.regras.some((r) => r.id === props.idInicial) ? props.idInicial : (props.regras[0]?.id ?? null),
  );
  const escolhida = props.regras.find((r) => r.id === escolhidaId) ?? null;

  return (
    <Sobreposicao titulo="Regras de graduação" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao painel-de-curva-predefinida"
        onSubmit={(e) => {
          e.preventDefault();
          if (!escolhida) return;
          props.onEscolher(escolhida);
          props.onFechar();
        }}
      >
        {props.regras.length === 0 ? (
          <p className="nota-do-formulario">
            Nenhuma regra cadastrada ainda. Para guardar uma, gradue um ponto e use &ldquo;Criar regra&rdquo; nele.
          </p>
        ) : (
          <ul className="lista-de-curvas" role="radiogroup" aria-label="Regras cadastradas">
            {props.regras.map((regra) => (
              <li key={regra.id} className={regra.id === escolhidaId ? 'curva-escolhida' : undefined}>
                <label className="opcao-em-linha">
                  <input type="radio" name="regra-de-graduacao" checked={regra.id === escolhidaId} onChange={() => setEscolhidaId(regra.id)} />
                  <span>
                    <strong>{regra.nome}</strong>
                    <br />
                    <small>{resumoDaRegra(regra)}</small>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (regra.id === escolhidaId) setEscolhidaId(props.regras.find((r) => r.id !== regra.id)?.id ?? null);
                    props.onExcluir(regra.id);
                  }}
                  aria-label={`Excluir a regra ${regra.nome}`}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="nota-do-formulario">
          Depois de escolher, clique nos pontos do contorno da peça selecionada: cada um recebe a regra, pelo nome de
          cada tamanho. A regra só serve para a peça que tem todos os tamanhos dela.
        </p>

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao-primario" disabled={!escolhida}>
            Usar esta regra
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
