import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { formatarMm, lerMedida } from './medidas';
import type { Ponto2D } from '../core/geometria';
import type { Molde } from '../domain/molde';
import {
  cercaAfetaMolde,
  contarDentroDaCerca,
  type Cerca,
  type CategoriaDaCerca,
  type OpcoesDeMoverCerca,
} from '../domain/cerca';

interface PainelDeMoverCercaProps {
  readonly cerca: Cerca;
  /** Peças sobre as quais o movimento age: as selecionadas, ou todas quando nada está selecionado. */
  readonly pecas: readonly Molde[];
  readonly temSelecao: boolean;
  /** O que mover. Fica fora do diálogo porque o desenho destaca só os pontos dessas categorias. */
  readonly opcoes: OpcoesDeMoverCerca;
  readonly onAlterarOpcoes: (opcoes: OpcoesDeMoverCerca) => void;
  /** Aplica o movimento; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onAplicar: (delta: Ponto2D, opcoes: OpcoesDeMoverCerca) => string | null;
  readonly onFechar: () => void;
}

const CATEGORIAS: ReadonlyArray<{ readonly id: CategoriaDaCerca; readonly rotulo: string }> = [
  { id: 'pontosDoContorno', rotulo: 'Pontos do contorno' },
  { id: 'furos', rotulo: 'Pontos dos furos' },
  { id: 'linhasInternas', rotulo: 'Pontos das linhas internas' },
  { id: 'marcas', rotulo: 'Marcas' },
  { id: 'linhaDeFio', rotulo: 'Linha de fio (só se estiver inteira na cerca)' },
];

const MAXIMO_DE_NOMES = 4;

/**
 * "Mover cerca": desloca por uma medida exata os pontos que estão dentro da
 * cerca, nas peças selecionadas (ou em todas). Horizontal e vertical são os
 * da tela — horizontal ao longo do comprimento da mesa, vertical ao longo da
 * largura. As opções dizem o que pode se mover; ao lado de cada uma, quantos
 * itens estão dentro da cerca. O desenho destaca só os pontos das opções
 * marcadas.
 */
export function PainelDeMoverCerca(props: PainelDeMoverCercaProps): React.JSX.Element {
  const { opcoes } = props;
  const [horizontal, setHorizontal] = useState('0');
  const [vertical, setVertical] = useState('0');
  const [erro, setErro] = useState<string | null>(null);

  const contagens = props.pecas.map((peca) => contarDentroDaCerca(peca, props.cerca));
  const totalPorCategoria = (categoria: CategoriaDaCerca): number =>
    contagens.reduce((soma, contagem) => soma + contagem[categoria], 0);
  const afetadas = props.pecas.filter((peca) => cercaAfetaMolde(peca, props.cerca, opcoes));
  const nomesAfetados =
    afetadas.length <= MAXIMO_DE_NOMES
      ? afetadas.map((p) => p.nome).join(', ')
      : `${afetadas
          .slice(0, MAXIMO_DE_NOMES)
          .map((p) => p.nome)
          .join(', ')} e mais ${afetadas.length - MAXIMO_DE_NOMES}`;

  function alternar(categoria: CategoriaDaCerca, marcado: boolean): void {
    props.onAlterarOpcoes({ ...opcoes, [categoria]: marcado });
    setErro(null);
  }

  function aplicar(): void {
    if (!CATEGORIAS.some((c) => opcoes[c.id])) {
      setErro('Marque pelo menos uma opção do que mover.');
      return;
    }
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
    if (afetadas.length === 0) {
      setErro('Nada dentro da cerca com essas opções — nenhuma peça mudaria.');
      return;
    }
    // Eixos trocados na tela (ver ui/transformacaoDeTela.ts): a horizontal é o
    // Y do mundo (comprimento) e a vertical é o X (largura).
    const mensagem = props.onAplicar({ x: dv, y: dh }, opcoes);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    props.onFechar();
  }

  return (
    <Sobreposicao titulo="Mover cerca" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-mover-cerca"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        <dl className="lista-de-propriedades">
          <dt>Cerca</dt>
          <dd>
            {formatarMm(props.cerca.maxY - props.cerca.minY)} × {formatarMm(props.cerca.maxX - props.cerca.minX)}{' '}
            (horizontal × vertical)
          </dd>
          <dt>{props.temSelecao ? 'Peças selecionadas' : 'Peças (nenhuma selecionada: todas)'}</dt>
          <dd>{props.pecas.length}</dd>
          <dt>Mudam com essas opções</dt>
          <dd>{afetadas.length === 0 ? 'nenhuma' : nomesAfetados}</dd>
        </dl>

        <fieldset className="grupo-de-opcoes-da-cerca">
          <legend>Mover o que está dentro da cerca</legend>
          {CATEGORIAS.map((categoria) => (
            <label key={categoria.id} className="opcao-em-linha">
              <input
                type="checkbox"
                checked={opcoes[categoria.id]}
                onChange={(e) => alternar(categoria.id, e.target.checked)}
              />
              {categoria.rotulo}
              <span className="contagem-da-cerca">({totalPorCategoria(categoria.id)})</span>
            </label>
          ))}
          <p className="nota-do-formulario">Piques acompanham a aresta em que estão.</p>
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
            Mover
          </button>
        </div>
      </form>
    </Sobreposicao>
  );
}
