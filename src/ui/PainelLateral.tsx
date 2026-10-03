import type { Molde, RestricaoDeRotacao } from '../domain/molde';
import { dimensoesDoMolde, rotacoesPermitidas } from '../domain/molde';
import { retanguloEnvolvente, type Contorno } from '../core/geometria';

interface PainelDePecasProps {
  readonly pecas: readonly Molde[];
  readonly selecionadoId: string | null;
  readonly idsSelecionadosEmLote?: ReadonlySet<string>;
  readonly onSelecionar: (id: string) => void;
  /** Caixa de seleção de cada item: inclui/remove a peça da seleção em lote (Ctrl+A/Duplicar/Excluir/Alinhar em lote) — independente do clique na linha, que seleciona só aquela peça. */
  readonly onAlternarSelecaoEmLote?: (id: string) => void;
  /** Duplo-clique num item abre o diálogo de Propriedades da peça. */
  readonly onAbrirPropriedades?: (id: string) => void;
}

/** Miniatura do contorno da peça (só o formato, sem furos/piques) — mesma ideia das miniaturas de peça de um CAD de moldes profissional. */
function MiniaturaDoMolde({ contorno }: { readonly contorno: Contorno }): React.JSX.Element {
  const bbox = retanguloEnvolvente(contorno);
  const margem = Math.max(bbox.largura, bbox.altura, 1) * 0.12;
  const viewBox = `${bbox.minX - margem} ${bbox.minY - margem} ${bbox.largura + margem * 2 || 1} ${bbox.altura + margem * 2 || 1}`;
  const pontos = contorno.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <svg className="miniatura-de-peca" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <polygon points={pontos} />
    </svg>
  );
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
              <input
                type="checkbox"
                className="caixa-de-selecao-em-lote"
                checked={props.idsSelecionadosEmLote?.has(peca.id) ?? false}
                onChange={() => props.onAlternarSelecaoEmLote?.(peca.id)}
                aria-label={`Incluir "${peca.nome}" na seleção em lote`}
                title="Incluir/remover da seleção em lote (Ctrl+A, Duplicar, Excluir, Alinhar...)"
              />
              <button
                className={
                  peca.id === props.selecionadoId || props.idsSelecionadosEmLote?.has(peca.id)
                    ? 'item-selecionado'
                    : ''
                }
                onClick={() => props.onSelecionar(peca.id)}
                onDoubleClick={() => props.onAbrirPropriedades?.(peca.id)}
                title="Clique para selecionar — duplo-clique para abrir as propriedades"
              >
                <MiniaturaDoMolde contorno={peca.contorno} />
                <span className="texto-do-item-de-peca">
                  {peca.nome} <span className="referencia">({peca.referencia || '—'}, {peca.tamanho})</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface PatchDeMolde {
  readonly nome?: string;
  readonly referencia?: string;
  readonly tamanho?: string;
  readonly quantidade?: number;
  readonly margemDeCosturaMm?: number;
  readonly restricaoDeRotacao?: RestricaoDeRotacao;
}

interface PainelDePropriedadesProps {
  readonly peca: Molde | null;
  readonly onAlterar: (patch: PatchDeMolde) => void;
  readonly onGirar: (anguloGraus: number) => void;
}

export function PainelDePropriedades(props: PainelDePropriedadesProps): React.JSX.Element {
  if (!props.peca) {
    return <p className="texto-vazio">Selecione uma peça para ver seus dados.</p>;
  }

  const peca = props.peca;
  const dim = dimensoesDoMolde(peca);
  const rotacoes = rotacoesPermitidas(peca.restricaoDeRotacao);

  return (
    <div aria-label="Propriedades da peça selecionada">
      <form className="formulario-de-propriedades" onSubmit={(e) => e.preventDefault()}>
        <label>
          Nome
          <input type="text" value={peca.nome} onChange={(e) => props.onAlterar({ nome: e.target.value })} />
        </label>
        <label>
          Referência
          <input
            type="text"
            value={peca.referencia}
            onChange={(e) => props.onAlterar({ referencia: e.target.value })}
          />
        </label>
        <label>
          Tamanho
          <input type="text" value={peca.tamanho} onChange={(e) => props.onAlterar({ tamanho: e.target.value })} />
        </label>
        <label>
          Quantidade
          <input
            type="number"
            min={1}
            step={1}
            value={peca.quantidade}
            onChange={(e) => {
              const valor = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(valor) && valor >= 1) props.onAlterar({ quantidade: valor });
            }}
          />
        </label>
        <label>
          Margem de costura (mm)
          <input
            type="number"
            min={0}
            step={0.5}
            value={peca.margemDeCosturaMm}
            onChange={(e) => {
              const valor = Number.parseFloat(e.target.value);
              if (Number.isFinite(valor) && valor >= 0) props.onAlterar({ margemDeCosturaMm: valor });
            }}
          />
        </label>

        <fieldset className="grupo-de-rotacao">
          <legend>Rotações permitidas (sentido do fio)</legend>
          <label className="opcao-em-linha">
            <input
              type="checkbox"
              checked={peca.restricaoDeRotacao.permite180}
              onChange={(e) =>
                props.onAlterar({
                  restricaoDeRotacao: { ...peca.restricaoDeRotacao, permite180: e.target.checked },
                })
              }
            />
            Permitir 180°
          </label>
          <label className="opcao-em-linha">
            <input
              type="checkbox"
              checked={peca.restricaoDeRotacao.permite90e270}
              onChange={(e) =>
                props.onAlterar({
                  restricaoDeRotacao: { ...peca.restricaoDeRotacao, permite90e270: e.target.checked },
                })
              }
            />
            Permitir 90°/270°
          </label>
          <label className="opcao-em-linha">
            <input
              type="checkbox"
              checked={peca.restricaoDeRotacao.permiteEspelhamento ?? false}
              onChange={(e) =>
                props.onAlterar({
                  restricaoDeRotacao: { ...peca.restricaoDeRotacao, permiteEspelhamento: e.target.checked },
                })
              }
            />
            Permitir espelhamento
          </label>
        </fieldset>

        <div className="grupo-de-rotacao">
          <span className="legenda-inline">Girar peça</span>
          <div className="botoes-de-rotacao">
            <button type="button" onClick={() => props.onGirar(90)}>
              90°
            </button>
            <button type="button" onClick={() => props.onGirar(180)}>
              180°
            </button>
            <button type="button" onClick={() => props.onGirar(270)}>
              270°
            </button>
          </div>
        </div>
      </form>

      <dl className="lista-de-propriedades">
        <dt>Ângulo atual</dt>
        <dd>{peca.anguloDeRotacaoGraus}°</dd>
        <dt>Largura</dt>
        <dd>{dim.larguraMm.toFixed(1)} mm</dd>
        <dt>Altura</dt>
        <dd>{dim.alturaMm.toFixed(1)} mm</dd>
        <dt>Área</dt>
        <dd>{(dim.areaMm2 / 100).toFixed(1)} cm²</dd>
        <dt>Rotações permitidas</dt>
        <dd>{rotacoes.map((r) => `${r}°`).join(', ')}</dd>
        <dt>Espelhamento</dt>
        <dd>{peca.restricaoDeRotacao.permiteEspelhamento ? 'Permitido' : 'Não permitido'}</dd>
        <dt>Piques</dt>
        <dd>{peca.piques.length}</dd>
        <dt>Furos</dt>
        <dd>{peca.furos.length}</dd>
        <dt>Marcas</dt>
        <dd>{peca.marcas.length}</dd>
      </dl>
    </div>
  );
}
