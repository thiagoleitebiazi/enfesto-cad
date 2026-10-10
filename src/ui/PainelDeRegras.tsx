import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { formatarMm } from './medidas';
import { regrasDoConjunto, type ConjuntoDeRegras, type RegraCadastrada } from './regrasDeGraduacao';
import { paraATela } from './tabelaDeGraduacao';

interface PainelDeRegrasProps {
  readonly regras: readonly RegraCadastrada[];
  readonly idInicial: string | null;
  /** Fica com a regra escolhida: os próximos cliques nos pontos do contorno a aplicam. */
  readonly onEscolher: (regra: RegraCadastrada) => void;
  readonly onExcluir: (id: string) => void;
  readonly onFechar: () => void;
  /** Os conjuntos de regras cadastrados (sem a propriedade, o painel só mostra as regras). */
  readonly conjuntos?: readonly ConjuntoDeRegras[];
  /** Fica com o conjunto escolhido: cada clique num ponto aplica a regra seguinte dele. */
  readonly onEscolherConjunto?: (conjunto: ConjuntoDeRegras) => void;
  /** Cria um conjunto com as regras dadas, em ordem; devolve a mensagem de erro, ou `null`. */
  readonly onCriarConjunto?: (nome: string, regras: readonly string[]) => string | null;
  readonly onExcluirConjunto?: (id: string) => void;
}

/** A regra numa linha: os tamanhos e o que o ponto anda no maior deles. */
function resumoDaRegra(regra: RegraCadastrada): string {
  const ultimo = regra.deslocamentos.at(-1) ?? { x: 0, y: 0 };
  const naTela = paraATela(ultimo);
  const codigo = regra.codigo ? `código ${regra.codigo} — ` : '';
  return `${codigo}${regra.tamanhos.join(', ')} (base ${regra.base}) — no ${regra.tamanhos.at(-1)}: DX ${formatarMm(naTela.dx)}, DY ${formatarMm(naTela.dy)}`;
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
  const conjuntos = props.conjuntos ?? [];
  // "Tipo": uma regra, ou um conjunto de regras (várias, em ordem).
  const [tipo, setTipo] = useState<'regra' | 'conjunto'>('regra');
  const [conjuntoId, setConjuntoId] = useState<string | null>(conjuntos[0]?.id ?? null);
  // Sem um escolhido que ainda exista, vale o mais novo: o conjunto que acabou de ser criado já fica escolhido.
  const conjunto = conjuntos.find((c) => c.id === conjuntoId) ?? conjuntos.at(-1) ?? null;
  // As regras marcadas para um conjunto novo, na ordem em que foram marcadas.
  const [marcadas, setMarcadas] = useState<readonly string[]>([]);
  const [nomeDoConjunto, setNomeDoConjunto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Sobreposicao titulo="Regras de graduação" onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao painel-de-curva-predefinida"
        onSubmit={(e) => {
          e.preventDefault();
          if (tipo === 'conjunto') {
            if (!conjunto || !props.onEscolherConjunto) return;
            props.onEscolherConjunto(conjunto);
            props.onFechar();
            return;
          }
          if (!escolhida) return;
          props.onEscolher(escolhida);
          props.onFechar();
        }}
      >
        {props.onEscolherConjunto && (
          <fieldset className="opcao-em-linha">
            <legend>Tipo</legend>
            <label className="opcao-em-linha">
              <input type="radio" name="tipo-de-regra" checked={tipo === 'regra'} onChange={() => setTipo('regra')} />
              Regra
            </label>
            <label className="opcao-em-linha">
              <input type="radio" name="tipo-de-regra" checked={tipo === 'conjunto'} onChange={() => setTipo('conjunto')} />
              Conjunto de regras
            </label>
          </fieldset>
        )}
        {tipo === 'conjunto' && (
          <>
            {conjuntos.length === 0 ? (
              <p className="nota-do-formulario">Nenhum conjunto cadastrado ainda. Monte um abaixo, marcando as regras na ordem em que devem ser aplicadas.</p>
            ) : (
              <ul className="lista-de-curvas" role="radiogroup" aria-label="Conjuntos cadastrados">
                {conjuntos.map((c) => (
                  <li key={c.id} className={c.id === conjunto?.id ? 'curva-escolhida' : undefined}>
                    <label className="opcao-em-linha">
                      <input type="radio" name="conjunto-de-regras" checked={c.id === conjunto?.id} onChange={() => setConjuntoId(c.id)} />
                      <span>
                        <strong>{c.nome}</strong>
                        <br />
                        <small>
                          {regrasDoConjunto(c, props.regras)
                            .map((r, i) => `${i + 1}. ${r.nome}`)
                            .join(' · ') || 'as regras dele já não estão no cadastro'}
                        </small>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (c.id === conjunto?.id) setConjuntoId(conjuntos.find((outro) => outro.id !== c.id)?.id ?? null);
                        props.onExcluirConjunto?.(c.id);
                      }}
                      aria-label={`Excluir o conjunto ${c.nome}`}
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <fieldset>
              <legend>Novo conjunto</legend>
              <label>
                Nome do conjunto
                <input type="text" value={nomeDoConjunto} onChange={(e) => setNomeDoConjunto(e.target.value)} />
              </label>
              <ul className="lista-de-curvas" aria-label="Regras do conjunto novo">
                {props.regras.map((regra) => {
                  const ordem = marcadas.indexOf(regra.id);
                  return (
                    <li key={regra.id}>
                      <label className="opcao-em-linha">
                        <input
                          type="checkbox"
                          checked={ordem >= 0}
                          onChange={(e) => setMarcadas((atual) => (e.target.checked ? [...atual, regra.id] : atual.filter((id) => id !== regra.id)))}
                        />
                        {ordem >= 0 ? `${ordem + 1}. ` : ''}
                        {regra.nome}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => {
                  const mensagem = props.onCriarConjunto?.(nomeDoConjunto, marcadas) ?? null;
                  setErro(mensagem);
                  if (mensagem) return;
                  setMarcadas([]);
                  setNomeDoConjunto('');
                }}
              >
                Criar conjunto
              </button>
            </fieldset>
            {erro && (
              <p className="mensagem-de-erro" role="alert">
                {erro}
              </p>
            )}
            <p className="nota-do-formulario">
              Com um conjunto em uso, cada clique num ponto do contorno aplica a regra seguinte dele, na ordem; acabadas as regras, volta à primeira. O manual da
              referência fala do conjunto sem dizer como ele é aplicado: essa ordem, de clique em clique, é a nossa leitura.
            </p>
            <div className="acoes-da-sobreposicao">
              <button type="button" onClick={props.onFechar}>
                Cancelar
              </button>
              <button type="submit" className="botao-primario" disabled={!conjunto || regrasDoConjunto(conjunto, props.regras).length === 0}>
                Usar este conjunto
              </button>
            </div>
          </>
        )}
        {tipo === 'regra' && (
          <>
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
          </>
        )}
      </form>
    </Sobreposicao>
  );
}
