import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { lerMedida } from './medidas';
import type { Ponto2D } from '../core/geometria';
import type { Molde } from '../domain/molde';

interface PainelDeModificarProps {
  readonly peca: Molde;
  /** Vértices do contorno indicados no desenho (índices a partir de 0). */
  readonly indices: readonly number[];
  /** Aplica o deslocamento; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onAplicar: (delta: Ponto2D) => string | null;
  readonly onFechar: () => void;
}

const MAXIMO_DE_NUMEROS = 10;
const NAO_CONFIRMADO = 'Ainda não disponível: o comportamento exato deste modo ainda não foi confirmado.';

/** "3", "1 e 4", "1, 2 e 5" — os números que o desenho mostra (a partir de 1); depois de 10, "e mais N". */
function listarPontos(indices: readonly number[]): string {
  const numeros = [...indices].sort((a, b) => a - b).map((i) => String(i + 1));
  if (numeros.length > MAXIMO_DE_NUMEROS) {
    return `${numeros.slice(0, MAXIMO_DE_NUMEROS).join(', ')} e mais ${numeros.length - MAXIMO_DE_NUMEROS}`;
  }
  return numeros.length <= 1 ? numeros.join('') : `${numeros.slice(0, -1).join(', ')} e ${numeros.at(-1)}`;
}

/**
 * "Modificar" com medida exata (a janela de coordenadas da ferramenta):
 * desloca os pontos do contorno indicados no desenho. Só eles andam — os
 * vizinhos ficam no lugar, como no arrasto. Horizontal e vertical são os da
 * tela, como em "Mover cerca". Os modos que também mexem nos pontos próximos
 * (Discreto, Proporcional) aparecem desligados: o comportamento deles não
 * foi confirmado.
 */
export function PainelDeModificar(props: PainelDeModificarProps): React.JSX.Element {
  const [horizontal, setHorizontal] = useState('0');
  const [vertical, setVertical] = useState('0');
  const [erro, setErro] = useState<string | null>(null);
  const umPonto = props.indices.length === 1;

  function aplicar(): void {
    const dh = lerMedida(horizontal);
    const dv = lerMedida(vertical);
    if (dh === null || dv === null) {
      setErro('Horizontal e vertical precisam ser números em mm (use 0 para não mover numa direção).');
      return;
    }
    if (dh === 0 && dv === 0) {
      setErro('Informe um deslocamento diferente de zero.');
      return;
    }
    // Eixos trocados na tela (ver ui/transformacaoDeTela.ts): a horizontal é o
    // Y do mundo (comprimento) e a vertical é o X (largura).
    const mensagem = props.onAplicar({ x: dv, y: dh });
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    props.onFechar();
  }

  return (
    <Sobreposicao titulo="Modificar" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-medida-exata"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        <dl className="lista-de-propriedades">
          <dt>Peça</dt>
          <dd>{props.peca.nome}</dd>
          <dt>{umPonto ? 'Ponto' : 'Pontos'}</dt>
          <dd>{listarPontos(props.indices)}</dd>
        </dl>

        <fieldset className="grupo-de-opcoes-do-formulario">
          <legend>Modo</legend>
          <label className="opcao-em-linha">
            <input type="radio" name="modo-de-modificar" defaultChecked />
            {umPonto ? '1 ponto: só ele anda' : `N pontos: só os ${props.indices.length} indicados andam`}
          </label>
          <label className="opcao-em-linha opcao-indisponivel" title={NAO_CONFIRMADO}>
            <input type="radio" name="modo-de-modificar" disabled />
            Discreto: leva junto os pontos próximos
          </label>
          <label className="opcao-em-linha opcao-indisponivel" title={NAO_CONFIRMADO}>
            <input type="radio" name="modo-de-modificar" disabled />
            Proporcional: move em conjunto, mantendo a proporção
          </label>
          <p className="nota-do-formulario">
            Os vizinhos ficam no lugar e as arestas até eles esticam ou encolhem; os piques acompanham a aresta em que
            estão. Discreto e Proporcional ainda não estão disponíveis: o comportamento exato deles não foi confirmado.
          </p>
        </fieldset>

        <div className="campos-de-deslocamento">
          <label>
            Horizontal (mm, + para a direita)
            <input
              type="text"
              inputMode="decimal"
              value={horizontal}
              onChange={(e) => {
                setHorizontal(e.target.value);
                setErro(null);
              }}
              autoFocus
            />
          </label>
          <label>
            Vertical (mm, + para baixo)
            <input
              type="text"
              inputMode="decimal"
              value={vertical}
              onChange={(e) => {
                setVertical(e.target.value);
                setErro(null);
              }}
            />
          </label>
        </div>

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
            Modificar
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
