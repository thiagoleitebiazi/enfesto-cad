import { Sobreposicao } from './Sobreposicao';
import { perimetro } from '../core/geometria';
import { dimensoesDoMolde, type Molde } from '../domain/molde';

interface PainelDeInformacoesDosMoldesProps {
  readonly pecas: readonly Molde[];
  readonly selecionadoId: string | null;
  readonly onSelecionar: (id: string) => void;
  readonly onFechar: () => void;
}

/** Número com vírgula decimal, como nos outros diálogos. */
function numero(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

/**
 * "Informações dos moldes": uma linha por peça do projeto, com as medidas
 * calculadas do contorno de agora (as mesmas do diálogo de propriedades) e o
 * total de peças a cortar. Só leitura — clicar numa linha seleciona a peça
 * no desenho, e as propriedades continuam sendo editadas no diálogo dela.
 */
export function PainelDeInformacoesDosMoldes(props: PainelDeInformacoesDosMoldesProps): React.JSX.Element {
  const linhas = props.pecas.map((peca) => ({ peca, dim: dimensoesDoMolde(peca), perimetroMm: perimetro(peca.contorno) }));
  const totalACortar = props.pecas.reduce((soma, p) => soma + p.quantidade, 0);
  const areaTotalMm2 = linhas.reduce((soma, l) => soma + l.dim.areaMm2 * l.peca.quantidade, 0);

  return (
    <Sobreposicao titulo="Informações dos moldes" onFechar={props.onFechar}>
      <div className="painel-de-informacoes-dos-moldes">
        {linhas.length === 0 ? (
          <p className="texto-vazio">Nenhuma peça no projeto.</p>
        ) : (
          <div className="rolagem-da-tabela">
            <table className="tabela-de-moldes">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Referência</th>
                  <th scope="col">Tamanho</th>
                  <th scope="col" className="coluna-numerica">
                    Qtd.
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Largura (mm)
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Altura (mm)
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Área (cm²)
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Perímetro (mm)
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Costura (mm)
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Pontos
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Piques
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Furos
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ peca, dim, perimetroMm }) => (
                  <tr
                    key={peca.id}
                    className={peca.id === props.selecionadoId ? 'linha-selecionada' : undefined}
                    aria-selected={peca.id === props.selecionadoId}
                    onClick={() => props.onSelecionar(peca.id)}
                  >
                    <th scope="row">{peca.nome}</th>
                    <td>{peca.referencia || '—'}</td>
                    <td>{peca.tamanho || '—'}</td>
                    <td className="coluna-numerica">{peca.quantidade}</td>
                    <td className="coluna-numerica">{numero(dim.larguraMm)}</td>
                    <td className="coluna-numerica">{numero(dim.alturaMm)}</td>
                    <td className="coluna-numerica">{numero(dim.areaMm2 / 100)}</td>
                    <td className="coluna-numerica">{numero(perimetroMm)}</td>
                    <td className="coluna-numerica">{numero(peca.margemDeCosturaMm)}</td>
                    <td className="coluna-numerica">{peca.contorno.length}</td>
                    <td className="coluna-numerica">{peca.piques.length}</td>
                    <td className="coluna-numerica">{peca.furos.length}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    {props.pecas.length} {props.pecas.length === 1 ? 'molde' : 'moldes'}
                  </th>
                  <td className="coluna-numerica">{totalACortar}</td>
                  <td colSpan={2} />
                  <td className="coluna-numerica">{numero(areaTotalMm2 / 100)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="nota-do-formulario">
          Largura, altura e área são as do contorno, sem a costura, como no diálogo de propriedades. Os totais contam a
          quantidade de cada molde. Clique numa linha para selecionar a peça no desenho.
        </p>
        <div className="acoes-da-sobreposicao">
          <button type="button" className="botao-primario" onClick={props.onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </Sobreposicao>
  );
}
