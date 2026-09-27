import type { Molde } from '../domain/molde';
import { dimensoesDoMolde, rotacoesPermitidas } from '../domain/molde';

interface PainelDePecasProps {
  readonly pecas: readonly Molde[];
  readonly selecionadoId: string | null;
  readonly onSelecionar: (id: string) => void;
}

export function PainelDePecas(props: PainelDePecasProps): React.JSX.Element {
  return (
    <section className="painel-lateral" aria-label="Peças do projeto">
      <h2>Peças</h2>
      {props.pecas.length === 0 ? (
        <p className="texto-vazio">Nenhuma peça no projeto.</p>
      ) : (
        <ul className="lista-de-pecas">
          {props.pecas.map((peca) => (
            <li key={peca.id}>
              <button
                className={peca.id === props.selecionadoId ? 'item-selecionado' : ''}
                onClick={() => props.onSelecionar(peca.id)}
              >
                {peca.nome} <span className="referencia">({peca.referencia}, {peca.tamanho})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface PainelDePropriedadesProps {
  readonly peca: Molde | null;
}

export function PainelDePropriedades(props: PainelDePropriedadesProps): React.JSX.Element {
  if (!props.peca) {
    return (
      <section className="painel-lateral" aria-label="Propriedades da peça selecionada">
        <h2>Propriedades</h2>
        <p className="texto-vazio">Selecione uma peça para ver seus dados.</p>
      </section>
    );
  }

  const dim = dimensoesDoMolde(props.peca);
  const rotacoes = rotacoesPermitidas(props.peca.restricaoDeRotacao);

  return (
    <section className="painel-lateral" aria-label="Propriedades da peça selecionada">
      <h2>Propriedades</h2>
      <dl className="lista-de-propriedades">
        <dt>Nome</dt>
        <dd>{props.peca.nome}</dd>
        <dt>Referência</dt>
        <dd>{props.peca.referencia}</dd>
        <dt>Tamanho</dt>
        <dd>{props.peca.tamanho}</dd>
        <dt>Quantidade</dt>
        <dd>{props.peca.quantidade}</dd>
        <dt>Largura</dt>
        <dd>{dim.larguraMm.toFixed(1)} mm</dd>
        <dt>Altura</dt>
        <dd>{dim.alturaMm.toFixed(1)} mm</dd>
        <dt>Área</dt>
        <dd>{(dim.areaMm2 / 100).toFixed(1)} cm²</dd>
        <dt>Rotações permitidas</dt>
        <dd>{rotacoes.map((r) => `${r}°`).join(', ')}</dd>
      </dl>
    </section>
  );
}
