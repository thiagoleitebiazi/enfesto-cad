import { lerQuantidades, textoDasQuantidades } from './visaoDasPecas';
import type { EstiloDeLinha, Molde, RestricaoDeRotacao } from '../domain/molde';
import { dimensoesDoMolde, fioNoAngulo, INCLINACAO_MAXIMA_GRAUS, MAXIMO_DE_COPIAS_DA_PECA, rotacoesPermitidas } from '../domain/molde';
import { fioNoCentro } from '../domain/corteEUniao';
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
  /** Os pontos CAM (ADR 0173); `null` volta ao normal. */
  readonly corteNaMesa?: Exclude<Molde['corteNaMesa'], undefined>;
  /** A peça em ½ camada (ADR 0180). */
  readonly meiaCamada?: boolean;
  /** O tecido do molde (ADR 0194). */
  readonly tecidoDoMolde?: string;
  /** A folga no encaixe, a quantidade por tamanho e o tamanho do texto (ADR 0202). */
  readonly folgaNoEncaixeMm?: number;
  readonly quantidadePorTamanho?: Readonly<Record<string, number>>;
  readonly alturaDoTextoMm?: number;
  /** A descrição, e se a peça entra no encaixe (ADR 0199, 0200). */
  readonly descricao?: string;
  readonly usarNoEncaixe?: boolean;
  /** O fio (ADR 0190) e as linhas do desenho (ADR 0192). */
  readonly linhaDeFio?: Molde['linhaDeFio'];
  readonly linhaDoDesenho?: Exclude<Molde['linhaDoDesenho'], undefined>;
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
          <label className="opcao-em-linha">
            Corte na mesa
            <select
              aria-label="Corte na mesa"
              title="Os pontos CAM: por onde a faca da mesa de corte entra e sai da peça, no arquivo ISO"
              value={peca.corteNaMesa?.tipo ?? ''}
              onChange={(e) => props.onAlterar({ corteNaMesa: e.target.value === '' ? null : { entrada: peca.corteNaMesa?.entrada ?? 0, ...(peca.corteNaMesa?.saida !== undefined ? { saida: peca.corteNaMesa.saida } : {}), tipo: e.target.value as 'completo' | 'semi-corte' } })}
            >
              <option value="">Normal</option>
              <option value="completo">Completo (de uma vez)</option>
              <option value="semi-corte">Semi-corte (em duas etapas)</option>
            </select>
          </label>
          {peca.corteNaMesa && (
            <>
              <label className="opcao-em-linha">
                Ponto de entrada
                <input
                  type="number"
                  min={1}
                  max={peca.contorno.length}
                  aria-label="Ponto de entrada da faca"
                  className="campo-curto"
                  value={peca.corteNaMesa.entrada + 1}
                  onChange={(e) => {
                    const v = Math.round(Number(e.target.value)) - 1;
                    if (v >= 0 && v < peca.contorno.length) props.onAlterar({ corteNaMesa: { ...peca.corteNaMesa!, entrada: v } });
                  }}
                />
              </label>
              {peca.corteNaMesa.tipo === 'semi-corte' && (
                <label className="opcao-em-linha">
                  Ponto de saída
                  <input
                    type="number"
                    min={1}
                    max={peca.contorno.length}
                    aria-label="Ponto de saída da faca"
                    className="campo-curto"
                    value={(peca.corteNaMesa.saida ?? peca.corteNaMesa.entrada) + 1}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value)) - 1;
                      if (v >= 0 && v < peca.contorno.length) props.onAlterar({ corteNaMesa: { ...peca.corteNaMesa!, saida: v } });
                    }}
                  />
                </label>
              )}
            </>
          )}
          <label className="opcao-em-linha">
            Inclinação no encaixe (°, até {INCLINACAO_MAXIMA_GRAUS})
            <input
              type="number"
              min={0}
              max={INCLINACAO_MAXIMA_GRAUS}
              step={0.5}
              aria-label="Inclinação no encaixe"
              title="O quanto o fio tolera: no encaixe, a peça pode girar até isso para cada lado de cada rotação permitida, para caber melhor"
              className="campo-curto"
              value={peca.restricaoDeRotacao.inclinacaoGraus ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                props.onAlterar({ restricaoDeRotacao: { ...peca.restricaoDeRotacao, inclinacaoGraus: Math.min(INCLINACAO_MAXIMA_GRAUS, Math.max(0, v)) } });
              }}
            />
          </label>
          <label className="opcao-em-linha" title="No encaixe, a peça pode girar em qualquer ângulo, de 15 em 15 graus: o fio deixa de valer">
            <input
              type="checkbox"
              checked={peca.restricaoDeRotacao.giroLivre ?? false}
              onChange={(e) => props.onAlterar({ restricaoDeRotacao: { ...peca.restricaoDeRotacao, giroLivre: e.target.checked } })}
            />
            Giro livre
          </label>
          <label className="opcao-em-linha">
            Giro inicial (°)
            <input
              type="number"
              min={-360}
              max={360}
              step={1}
              aria-label="Giro inicial"
              title="O ângulo de que a peça parte no próximo encaixe; depois de encaixada, já fica assim"
              className="campo-curto"
              value={peca.restricaoDeRotacao.giroInicialGraus ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) props.onAlterar({ restricaoDeRotacao: { ...peca.restricaoDeRotacao, giroInicialGraus: v } });
              }}
            />
          </label>
          <label className="opcao-em-linha" title="A peça entra espelhada de lado no próximo encaixe">
            <input
              type="checkbox"
              checked={peca.restricaoDeRotacao.refletidoHorizontal ?? false}
              onChange={(e) => props.onAlterar({ restricaoDeRotacao: { ...peca.restricaoDeRotacao, refletidoHorizontal: e.target.checked } })}
            />
            Refletido na horizontal
          </label>
          <label className="opcao-em-linha" title="A peça entra espelhada de cima para baixo no próximo encaixe">
            <input
              type="checkbox"
              checked={peca.restricaoDeRotacao.refletidoVertical ?? false}
              onChange={(e) => props.onAlterar({ restricaoDeRotacao: { ...peca.restricaoDeRotacao, refletidoVertical: e.target.checked } })}
            />
            Refletido na vertical
          </label>
          <label className="opcao-em-linha" title="No tecido dobrado, a peça é cortada numa camada só (F7)">
            <input type="checkbox" checked={peca.meiaCamada === true} onChange={(e) => props.onAlterar({ meiaCamada: e.target.checked })} />
            ½ camada
          </label>
        </fieldset>

        <label>
          Descrição
          <input type="text" value={peca.descricao ?? ''} onChange={(e) => props.onAlterar({ descricao: e.target.value })} />
        </label>
        <label className="opcao-em-linha" title="Desligado, a peça fica fora do encaixe, sem sair do projeto">
          <input type="checkbox" checked={!peca.naoUsar} onChange={(e) => props.onAlterar({ usarNoEncaixe: e.target.checked })} />
          Usar no encaixe
        </label>
        <label title="Uma margem de segurança em volta desta peça, no encaixe automático: nenhuma outra chega mais perto">
          Margem em volta no encaixe (mm)
          <input
            type="number"
            min={0}
            step={1}
            value={peca.folgaNoEncaixeMm ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0) props.onAlterar({ folgaNoEncaixeMm: v });
            }}
          />
        </label>
        {peca.graduacao && (
          <label title="A quantidade própria de cada tamanho, por cima da quantidade da peça; zero tira o tamanho do encaixe">
            Quantidade por tamanho
            <input key={peca.id} type="text" defaultValue={textoDasQuantidades(peca.quantidadePorTamanho)} placeholder="P:2 M:1" onBlur={(e) => props.onAlterar({ quantidadePorTamanho: lerQuantidades(e.target.value) })} />
          </label>
        )}
        <label title="A altura do nome da peça no plotter">
          Tamanho do texto (mm)
          <input
            type="number"
            min={0}
            step={1}
            value={peca.alturaDoTextoMm ?? 5}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > 0) props.onAlterar({ alturaDoTextoMm: v });
            }}
          />
        </label>
        <label title="O tecido em que a peça é cortada: o encaixe pode gerar um tecido por vez">
          Tecido do molde
          <input list="tecidos-do-molde" value={peca.tecidoDoMolde ?? ''} placeholder="Principal" onChange={(e) => props.onAlterar({ tecidoDoMolde: e.target.value })} />
          <datalist id="tecidos-do-molde">
            <option value="Principal" />
            <option value="Contraste" />
            <option value="Forro" />
            <option value="Entretela" />
          </datalist>
        </label>

        <fieldset className="grupo-de-rotacao">
          <legend>Fio e linhas do desenho</legend>
          <label className="opcao-em-linha">
            Ângulo do fio (°)
            <input
              type="number"
              step={1}
              aria-label="Ângulo do fio"
              title="0 aponta para a direita e 90 para cima. A peça não gira"
              className="campo-curto"
              value={Math.round((Math.atan2(peca.linhaDeFio.inicio.x - peca.linhaDeFio.fim.x, peca.linhaDeFio.fim.y - peca.linhaDeFio.inicio.y) * 1800) / Math.PI) / 10}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value.trim() !== '' && Number.isFinite(v)) props.onAlterar({ linhaDeFio: fioNoAngulo(peca, v).linhaDeFio });
              }}
            />
          </label>
          <button type="button" onClick={() => props.onAlterar({ linhaDeFio: fioNoCentro(peca.linhaDeFio, peca.contorno) })}>
            Fio no centro
          </button>
          <label className="opcao-em-linha">
            <input type="color" aria-label="Cor das linhas" value={peca.linhaDoDesenho?.cor ?? '#1f2933'} onChange={(e) => props.onAlterar({ linhaDoDesenho: { ...peca.linhaDoDesenho, cor: e.target.value } })} />
            Cor das linhas
          </label>
          <label className="opcao-em-linha">
            Estilo das linhas
            <select aria-label="Estilo das linhas" value={peca.linhaDoDesenho?.estilo ?? 'continua'} onChange={(e) => props.onAlterar({ linhaDoDesenho: { ...peca.linhaDoDesenho, estilo: e.target.value as EstiloDeLinha } })}>
              <option value="continua">Contínua</option>
              <option value="tracejada">Tracejada</option>
              <option value="pontilhada">Pontilhada</option>
            </select>
          </label>
          <label className="opcao-em-linha">
            Peso das linhas
            <input
              type="number"
              min={0.5}
              max={6}
              step={0.5}
              aria-label="Peso das linhas"
              className="campo-curto"
              value={peca.linhaDoDesenho?.peso ?? 1}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) props.onAlterar({ linhaDoDesenho: { ...peca.linhaDoDesenho, peso: Math.min(6, v) } });
              }}
            />
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
