import type { Molde, RestricaoDeRotacao } from '../domain/molde';
import { dimensoesDoMolde, MAXIMO_DE_COPIAS_DA_PECA, rotacoesPermitidas } from '../domain/molde';
import { retanguloEnvolvente, type Contorno } from '../core/geometria';
import { numeroComVirgula } from '../core/numeros';

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

/**
 * Miniatura do contorno da peça (só o formato, sem furos/piques), na mesma
 * orientação do canvas: a tela põe mundo.y na horizontal e mundo.x na
 * vertical (ver transformacaoDeTela.ts), então a miniatura também.
 */
function MiniaturaDoMolde({ contorno }: { readonly contorno: Contorno }): React.JSX.Element {
  const bbox = retanguloEnvolvente(contorno);
  const margem = Math.max(bbox.largura, bbox.altura, 1) * 0.08;
  const viewBox = `${bbox.minY - margem} ${bbox.minX - margem} ${bbox.altura + margem * 2 || 1} ${bbox.largura + margem * 2 || 1}`;
  const pontos = contorno.map((p) => `${p.y},${p.x}`).join(' ');
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
        <>
          <p className="texto-vazio">Nenhuma peça no projeto.</p>
          <p className="texto-vazio dica-do-vazio">
            Para começar, importe um molde (aba Início › Importar DXF ou Importar PDF) ou desenhe as peças na aba
            Construção.
          </p>
        </>
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
                <span className="texto-do-item-de-peca">
                  {peca.nome} <span className="referencia">({peca.referencia || '—'}, {peca.tamanho || '—'})</span>
                </span>
                {peca.grupoDoEncaixe?.trim() && (
                  <span className="grupo-da-peca" title="Grupo no encaixe: sai junto com as outras peças do grupo">
                    {peca.grupoDoEncaixe.trim()}
                  </span>
                )}
                <MiniaturaDoMolde contorno={peca.contorno} />
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
  /** Cortar em pares (direita e esquerda); `false` tira a marca. */
  readonly emPar?: boolean;
  /** O grupo do encaixe (ADR 0103); só espaços tira o grupo. */
  readonly grupoDoEncaixe?: string;
}

interface PainelDePropriedadesProps {
  readonly peca: Molde | null;
  /** Os grupos do encaixe que as peças do projeto já usam (sugeridos no campo). */
  readonly gruposDoEncaixe?: readonly string[];
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
            max={MAXIMO_DE_COPIAS_DA_PECA}
            step={1}
            value={peca.quantidade}
            onChange={(e) => {
              const valor = Number.parseInt(e.target.value, 10);
              // Sem teto, um número enorme (um zero a mais, digitado sem querer) travava o encaixe automático.
              if (Number.isFinite(valor) && valor >= 1 && valor <= MAXIMO_DE_COPIAS_DA_PECA) props.onAlterar({ quantidade: valor });
            }}
          />
        </label>
        <label className="opcao-em-linha" title="Das cópias da peça, metade sai espelhada: uma direita e uma esquerda (a manga, o bolso de cada lado).">
          <input type="checkbox" checked={peca.emPar === true} onChange={(e) => props.onAlterar({ emPar: e.target.checked })} />
          Cortar em pares (direita e esquerda)
        </label>
        {peca.emPar && peca.quantidade % 2 === 1 && (
          <p className="nota-do-formulario" role="status">
            Em pares, a quantidade precisa ser par (2 para um par, 4 para dois pares).
          </p>
        )}
        <label title="As peças do mesmo grupo saem juntas no encaixe, num trecho só do comprimento, que pode ser cortado à parte (por exemplo, as que vão à entretela).">
          Grupo no encaixe
          <input
            type="text"
            list="grupos-do-encaixe"
            value={peca.grupoDoEncaixe ?? ''}
            placeholder="Sem grupo"
            onChange={(e) => props.onAlterar({ grupoDoEncaixe: e.target.value })}
          />
        </label>
        <datalist id="grupos-do-encaixe">
          {(props.gruposDoEncaixe ?? []).map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
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
        <dd>{numeroComVirgula(peca.anguloDeRotacaoGraus)}°</dd>
        <dt>Largura</dt>
        <dd>{numeroComVirgula(dim.larguraMm, 1)} mm</dd>
        <dt>Altura</dt>
        <dd>{numeroComVirgula(dim.alturaMm, 1)} mm</dd>
        <dt>Área</dt>
        <dd>{numeroComVirgula(dim.areaMm2 / 100, 1)} cm²</dd>
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
