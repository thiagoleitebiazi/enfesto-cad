import { useEffect, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { CampoDeNumero } from './CampoDeNumero';
import type { FichaTecnica } from '../domain/fichaTecnica';
import {
  CEDE_MAXIMO_PERCENTUAL,
  csvDoGuia,
  elasticidadeDoTecido,
  guiaDeMedidas,
  htmlDoGuia,
  recomendarTamanho,
  regraSugerida,
  regrasDaFicha,
  ROTULO_DO_TIPO_DO_PONTO,
  TECIDOS_DA_RECOMENDACAO,
  type AvaliacaoDoPonto,
  type ElasticidadeDaRecomendacao,
  type RegraDoPonto,
  type RegrasDeCaimento,
  type TecidoDaRecomendacao,
  type TipoDoPonto,
} from '../domain/recomendacaoDeTamanho';
import { numeroComVirgula } from '../core/numeros';

export type ParteDaRecomendacao = 'recomendar' | 'caimento' | 'guia';

const cm = (v: number): string => numeroComVirgula(v, 1);
const comSinal = (v: number): string => (Math.abs(v) < 0.05 ? '0' : `${v > 0 ? '+' : '−'}${cm(Math.abs(v))}`);

/** Como a medida da peça fica perto do ideal: a cor da célula da tabela de comparação. */
function classeDoPonto(p: AvaliacaoDoPonto): string {
  if (p.aperta) return 'medida-aperta';
  if (p.esticaParaVestir) return 'medida-estica';
  if (Math.abs(p.diferencaCm) <= p.toleranciaCm) return 'medida-certa';
  return p.diferencaCm < 0 ? 'medida-justa' : 'medida-folgada';
}

/**
 * A recomendação de tamanho (ADR 0110): as medidas do corpo de uma pessoa contra a tabela de medidas da ficha
 * técnica, com a folga de cada ponto (o caimento), e o guia de medidas para a loja. As medidas da pessoa ficam só
 * na janela (não vão para o projeto: são dados pessoais); a regra de caimento é guardada no projeto.
 */
export function PainelDeRecomendacaoDeTamanho(props: {
  /** A ficha técnica do projeto (`null`: ainda não feita). */
  readonly ficha: FichaTecnica | null;
  readonly regrasGuardadas: RegrasDeCaimento;
  /** O tecido da peça (quanto a volta cede no corpo), guardado no projeto (ADR 0119). */
  readonly elasticidadeGuardada: ElasticidadeDaRecomendacao;
  readonly parteInicial?: ParteDaRecomendacao;
  readonly onGuardarRegras: (regras: RegrasDeCaimento) => void;
  readonly onGuardarElasticidade: (elasticidade: ElasticidadeDaRecomendacao) => void;
  /** Abre a ficha técnica na tabela de medidas. */
  readonly onAbrirMedidas: () => void;
  readonly onSalvarTexto: (sugestaoDeNome: string, conteudo: string) => Promise<string | null>;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const ficha = props.ficha;
  const [regras, setRegras] = useState<RegrasDeCaimento>(() => (ficha ? regrasDaFicha(ficha, props.regrasGuardadas) : {}));
  const guardadasRef = useRef(regras);
  const [parte, setParte] = useState<ParteDaRecomendacao>(props.parteInicial ?? 'recomendar');
  const [corpo, setCorpo] = useState<Record<string, number>>({});
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [elasticidade, setElasticidade] = useState(props.elasticidadeGuardada);
  const mudarElasticidade = (e: ElasticidadeDaRecomendacao): void => {
    setElasticidade(e);
    props.onGuardarElasticidade(e);
  };

  // A regra mudada vai para o projeto meio segundo depois da última mudança (e ao fechar).
  const { onGuardarRegras } = props;
  useEffect(() => {
    if (regras === guardadasRef.current) return;
    const t = setTimeout(() => {
      guardadasRef.current = regras;
      onGuardarRegras(regras);
    }, 500);
    return () => clearTimeout(t);
  }, [regras, onGuardarRegras]);
  const fechar = (): void => {
    if (regras !== guardadasRef.current) props.onGuardarRegras(regras);
    props.onFechar();
  };

  const semTabela = !ficha || ficha.medidas.length === 0 || ficha.tamanhos.length === 0;
  const titulo = ficha ? `${ficha.referencia || 'Sem referência'} — ${ficha.nomeDoModelo || 'sem nome'}` : 'Sem ficha técnica';
  const PARTES: ReadonlyArray<readonly [ParteDaRecomendacao, string]> = [
    ['recomendar', 'Recomendar'],
    ['caimento', 'Caimento'],
    ['guia', 'Guia de medidas'],
  ];

  return (
    <Sobreposicao titulo="Recomendação de tamanho" onFechar={fechar}>
      <div className="painel-da-recomendacao">
        <div className="cabecalho-da-ficha cabecalho-da-recomendacao">
          <strong>{titulo}</strong>
          {ficha && <span className="nota-do-formulario">Tamanhos: {ficha.tamanhos.join(', ') || '—'}</span>}
        </div>
        {semTabela ? (
          <div className="faixa-da-ficha-fechada">
            <p>A recomendação usa a tabela de medidas da ficha técnica (a peça pronta, por tamanho). {ficha ? 'A ficha ainda não tem os tamanhos ou os pontos de medida.' : 'O projeto ainda não tem a ficha técnica.'}</p>
            <button type="button" onClick={props.onAbrirMedidas}>
              Abrir a tabela de medidas
            </button>
          </div>
        ) : (
          <>
            <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da recomendação">
              {PARTES.map(([id, rotulo]) => (
                <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
                  {rotulo}
                </button>
              ))}
            </div>
            {parte === 'recomendar' && (
              <ParteRecomendar ficha={ficha} regras={regras} elasticidade={elasticidade} corpo={corpo} setCorpo={setCorpo} onVerCaimento={() => setParte('caimento')} />
            )}
            {parte === 'caimento' && <ParteCaimento ficha={ficha} regras={regras} setRegras={setRegras} elasticidade={elasticidade} onElasticidade={mudarElasticidade} />}
            {parte === 'guia' && (
              <ParteGuia
                ficha={ficha}
                regras={regras}
                salvoEm={salvoEm}
                onSalvar={async (nome, texto) => {
                  const caminho = await props.onSalvarTexto(nome, texto);
                  if (caminho) setSalvoEm(caminho);
                }}
              />
            )}
          </>
        )}
      </div>
    </Sobreposicao>
  );
}

// ---- Recomendar

function ParteRecomendar(props: {
  readonly ficha: FichaTecnica;
  readonly regras: RegrasDeCaimento;
  readonly elasticidade: ElasticidadeDaRecomendacao;
  readonly corpo: Readonly<Record<string, number>>;
  readonly setCorpo: (c: Record<string, number>) => void;
  readonly onVerCaimento: () => void;
}): React.JSX.Element {
  const { ficha, regras, corpo, elasticidade } = props;
  const usados = ficha.medidas.filter((p) => regras[p.id]?.usar);
  const preenchidos = usados.filter((p) => (corpo[p.id] ?? 0) > 0);
  const r = preenchidos.length > 0 ? recomendarTamanho(ficha, regras, corpo, elasticidade) : null;
  const avaliacoes = new Map((r?.tamanhos ?? []).map((t) => [t.tamanho, t]));
  const classeDoTamanho = (t: string): string => {
    if (!r) return 'tamanho-neutro';
    if (t === r.recomendado) return r.tamanhos.find((x) => x.tamanho === t)?.veste ? 'tamanho-recomendado' : 'tamanho-recomendado tamanho-aperta';
    if (t === r.alternativa) return 'tamanho-alternativo';
    const a = avaliacoes.get(t);
    return a && a.pontos.length > 0 && !a.veste ? 'tamanho-aperta' : 'tamanho-neutro';
  };
  return (
    <section aria-label="Recomendar" className="partes-da-recomendacao">
      <form className="formulario-de-sobreposicao corpo-da-pessoa" onSubmit={(e) => e.preventDefault()}>
        <h4>As medidas do corpo (cm)</h4>
        {usados.length === 0 ? (
          <p className="nota-do-formulario">
            Nenhum ponto está sendo comparado.{' '}
            <button type="button" onClick={props.onVerCaimento}>
              Escolher no Caimento
            </button>
          </p>
        ) : (
          usados.map((p) => (
            <label key={p.id}>
              {p.nome}
              <CampoDeNumero
                rotulo={`Corpo: ${p.nome}`}
                valor={corpo[p.id] ?? null}
                casas={1}
                vazioPermitido
                placeholder="cm"
                onMudar={(v) => {
                  const novo = { ...corpo };
                  if (v === null || v === 0) delete novo[p.id];
                  else novo[p.id] = v;
                  props.setCorpo(novo);
                }}
              />
              <small>
                {ROTULO_DO_TIPO_DO_PONTO[regras[p.id]!.tipo]}
                {regras[p.id]!.tipo === 'circunferencia' ? ` · folga ${cm(regras[p.id]!.folgaCm)} cm` : ''}
              </small>
            </label>
          ))
        )}
        <p className={`tecido-da-recomendacao${elasticidade.cedePercentual > 0 ? ' tecido-que-cede' : ''}`}>
          Tecido: <strong>{nomeDoTecido(elasticidade)}</strong>{' '}
          <button type="button" onClick={props.onVerCaimento}>
            Mudar
          </button>
        </p>
        <button type="button" disabled={Object.keys(corpo).length === 0} onClick={() => props.setCorpo({})}>
          Limpar as medidas
        </button>
        <p className="nota-do-formulario">As medidas da pessoa não são gravadas: ficam só nesta janela.</p>
      </form>

      <div className="resultado-da-recomendacao" aria-live="polite">
        <div className="faixa-de-tamanhos" role="list" aria-label="Tamanhos">
          {ficha.tamanhos.map((t) => (
            <span key={t} role="listitem" className={`tamanho-da-faixa ${classeDoTamanho(t)}`} title={classeDoTamanho(t).includes('aperta') ? `O ${t} aperta` : undefined}>
              {t}
            </span>
          ))}
        </div>
        {!r ? (
          <p className="nota-do-formulario">Digite as medidas do corpo da pessoa para ver o tamanho.</p>
        ) : r.recomendado === null ? (
          <ul className="faixa-do-custo-parcial">
            {r.faltando.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <>
            <div className={`cartao-do-tamanho ${avaliacoes.get(r.recomendado)?.veste ? '' : 'cartao-que-aperta'}`}>
              <span className="tamanho-grande" aria-label={`Tamanho recomendado: ${r.recomendado}`}>
                {r.recomendado}
              </span>
              <div>
                <strong>{avaliacoes.get(r.recomendado)?.veste ? 'Tamanho recomendado' : 'O mais próximo (aperta)'}</strong>
                {r.alternativa ? (
                  <p className="entre-dois-tamanhos">
                    Entre dois tamanhos: o {r.alternativa} também serve ({ficha.tamanhos.indexOf(r.alternativa) < ficha.tamanhos.indexOf(r.recomendado) ? 'mais justo' : 'mais folgado'}).
                  </p>
                ) : (
                  <p>{r.explicacao[0]}</p>
                )}
              </div>
            </div>
            {r.faltando.length > 0 && (
              <ul className="faixa-do-custo-parcial">
                {r.faltando.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <table className="tabela-de-relatorio tabela-da-comparacao">
              <caption>A peça de cada tamanho contra o ideal (corpo + folga), em cm</caption>
              <thead>
                <tr>
                  <th scope="col">Ponto</th>
                  <th scope="col" className="coluna-numerica">
                    Corpo
                  </th>
                  <th scope="col" className="coluna-numerica">
                    Ideal
                  </th>
                  {ficha.tamanhos.map((t) => (
                    <th key={t} scope="col" className={`coluna-numerica ${t === r.recomendado ? 'coluna-recomendada' : ''}`}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {avaliacoes.get(r.recomendado)!.pontos.map((p) => (
                  <tr key={p.pontoId}>
                    <th scope="row">{p.nome}</th>
                    <td className="coluna-numerica">{cm(p.corpoCm)}</td>
                    <td className="coluna-numerica">{cm(p.idealCm)}</td>
                    {ficha.tamanhos.map((t) => {
                      const d = avaliacoes.get(t)?.pontos.find((x) => x.pontoId === p.pontoId);
                      return (
                        <td key={t} className={`coluna-numerica ${d ? classeDoPonto(d) : ''} ${t === r.recomendado ? 'coluna-recomendada' : ''}`}>
                          {d ? (
                            <>
                              {cm(d.pecaCm)} <small>{comSinal(d.diferencaCm)}</small>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="legenda-da-comparacao">
              <span className="medida-certa">na medida (dentro da tolerância)</span>
              <span className="medida-folgada">mais folgado</span>
              <span className="medida-justa">mais justo</span>
              {elasticidade.cedePercentual > 0 && <span className="medida-estica">veste esticando (o tecido cede)</span>}
              <span className="medida-aperta">{elasticidade.cedePercentual > 0 ? 'aperta (nem cedendo chega no corpo)' : 'aperta (menor que o corpo)'}</span>
            </p>
            <ul className="explicacao-da-recomendacao">
              {r.explicacao.slice(1).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

// ---- Caimento

/** O nome do tecido escolhido, com quanto ele cede. */
function nomeDoTecido(e: ElasticidadeDaRecomendacao): string {
  return e.tecido === 'personalizado' ? `personalizado (cede ${numeroComVirgula(e.cedePercentual, 0)}%)` : TECIDOS_DA_RECOMENDACAO[e.tecido].nome;
}

function ParteCaimento(props: {
  readonly ficha: FichaTecnica;
  readonly regras: RegrasDeCaimento;
  readonly setRegras: (r: RegrasDeCaimento) => void;
  readonly elasticidade: ElasticidadeDaRecomendacao;
  readonly onElasticidade: (e: ElasticidadeDaRecomendacao) => void;
}): React.JSX.Element {
  const { ficha, regras, elasticidade } = props;
  const mudar = (id: string, regra: RegraDoPonto): void => props.setRegras({ ...regras, [id]: regra });
  return (
    <section aria-label="Caimento">
      <fieldset className="tecido-do-caimento">
        <legend>O tecido da peça</legend>
        <label>
          Tecido
          <select
            value={elasticidade.tecido}
            onChange={(e) => {
              const tecido = e.target.value as TecidoDaRecomendacao;
              props.onElasticidade(elasticidadeDoTecido(tecido, elasticidade.cedePercentual));
            }}
          >
            {(Object.keys(TECIDOS_DA_RECOMENDACAO) as Exclude<TecidoDaRecomendacao, 'personalizado'>[]).map((t) => (
              <option key={t} value={t}>
                {TECIDOS_DA_RECOMENDACAO[t].nome}
              </option>
            ))}
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        {elasticidade.tecido === 'personalizado' && (
          <label>
            Quanto a volta cede no corpo (%)
            <CampoDeNumero
              rotulo="Quanto a volta cede no corpo (%)"
              valor={elasticidade.cedePercentual}
              casas={0}
              className="campo-curto"
              onMudar={(v) => props.onElasticidade(elasticidadeDoTecido('personalizado', v ?? 0))}
            />
          </label>
        )}
        <p className="nota-do-formulario">
          Na malha, a volta da peça (o busto, o quadril) cede no corpo: o tamanho um pouco menor que o corpo ainda veste, justo. É menos que o quanto o tecido estica na mão (até{' '}
          {CEDE_MAXIMO_PERCENTUAL}%): a peça não pode vestir esticada no limite. Os comprimentos não cedem.
        </p>
      </fieldset>
      <p className="nota-do-formulario">
        A folga é quanto a peça pronta deve ter a mais que o corpo (o caimento do modelo: justo, regular, amplo). Nos comprimentos, a medida da peça deve bater com a da pessoa. O peso diz o
        que manda na escolha (o busto numa camisa, o quadril numa calça).
      </p>
      <table className="tabela-de-relatorio tabela-da-ficha">
        <caption>As regras de caimento (guardadas no projeto)</caption>
        <thead>
          <tr>
            <th scope="col">Usar</th>
            <th scope="col">Ponto de medida</th>
            <th scope="col">Tipo</th>
            <th scope="col">Folga (cm)</th>
            <th scope="col">Peso</th>
            <th scope="col">Na tabela</th>
          </tr>
        </thead>
        <tbody>
          {ficha.medidas.map((p) => {
            const regra = regras[p.id]!;
            const valores = ficha.tamanhos.filter((t) => p.valoresCm[t] !== undefined);
            return (
              <tr key={p.id} className={regra.usar ? undefined : 'linha-fora'}>
                <td>
                  <input type="checkbox" aria-label={`Usar ${p.nome}`} checked={regra.usar} onChange={(e) => mudar(p.id, { ...regra, usar: e.target.checked })} />
                </td>
                <td>{p.nome}</td>
                <td>
                  <select aria-label={`Tipo de ${p.nome}`} value={regra.tipo} disabled={!regra.usar} onChange={(e) => mudar(p.id, { ...regra, tipo: e.target.value as TipoDoPonto })}>
                    {(Object.keys(ROTULO_DO_TIPO_DO_PONTO) as TipoDoPonto[]).map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_DO_TIPO_DO_PONTO[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <CampoDeNumero
                    rotulo={`Folga de ${p.nome}`}
                    valor={regra.folgaCm}
                    casas={1}
                    className="campo-curto"
                    desabilitado={!regra.usar}
                    onMudar={(v) => mudar(p.id, { ...regra, folgaCm: v ?? 0 })}
                  />
                </td>
                <td>
                  <select aria-label={`Peso de ${p.nome}`} value={regra.peso} disabled={!regra.usar} onChange={(e) => mudar(p.id, { ...regra, peso: Number(e.target.value) })}>
                    <option value={1}>1 (normal)</option>
                    <option value={2}>2 (manda)</option>
                    <option value={3}>3 (decide)</option>
                  </select>
                </td>
                <td>
                  <small>{valores.length > 0 ? valores.map((t) => `${t} ${cm(p.valoresCm[t]!)}`).join(' · ') : 'sem valores'}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        <button
          type="button"
          onClick={() => {
            const sugeridas: Record<string, RegraDoPonto> = {};
            for (const p of ficha.medidas) sugeridas[p.id] = regraSugerida(p.nome) ?? { usar: false, tipo: 'circunferencia', folgaCm: 4, peso: 1 };
            props.setRegras(sugeridas);
          }}
        >
          Voltar às folgas sugeridas pelo nome
        </button>
      </p>
    </section>
  );
}

// ---- O guia de medidas (para a loja)

function ParteGuia(props: {
  readonly ficha: FichaTecnica;
  readonly regras: RegrasDeCaimento;
  readonly salvoEm: string | null;
  readonly onSalvar: (nome: string, texto: string) => Promise<void>;
}): React.JSX.Element {
  const { ficha } = props;
  const faixas = guiaDeMedidas(ficha, props.regras);
  const referencia = (ficha.referencia || 'modelo').replace(/[^A-Za-z0-9._-]+/g, '-');
  const titulo = `Guia de medidas — ${ficha.nomeDoModelo || ficha.referencia || 'modelo'}`;
  return (
    <section aria-label="Guia de medidas">
      <p className="nota-do-formulario">
        A medida do corpo de cada tamanho: a peça pronta menos a folga do caimento; entre dois tamanhos, o meio do caminho. É a tabela que vai para a loja (a página do produto, a
        etiqueta, o atendimento).
      </p>
      {faixas.length === 0 ? (
        <p className="nota-do-formulario">Nenhum ponto está sendo usado (aba Caimento).</p>
      ) : (
        <table className="tabela-de-relatorio tabela-do-guia">
          <caption>{titulo} (cm do corpo)</caption>
          <thead>
            <tr>
              <th scope="col">Medida do corpo</th>
              {ficha.tamanhos.map((t) => (
                <th key={t} scope="col" className="coluna-numerica">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {faixas.map((f) => (
              <tr key={f.pontoId}>
                <th scope="row">{f.nome}</th>
                {ficha.tamanhos.map((t) => {
                  const x = f.porTamanho[t];
                  return (
                    <td key={t} className="coluna-numerica">
                      {x ? `${numeroComVirgula(x.deCm, 0)} a ${numeroComVirgula(x.ateCm, 0)}` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="acoes-da-fila">
        <button type="button" disabled={faixas.length === 0} onClick={() => void props.onSalvar(`guia-de-medidas-${referencia}.csv`, csvDoGuia(faixas, ficha.tamanhos))}>
          Salvar CSV (planilha)
        </button>
        <button type="button" disabled={faixas.length === 0} onClick={() => void props.onSalvar(`guia-de-medidas-${referencia}.html`, htmlDoGuia(titulo, faixas, ficha.tamanhos))}>
          Salvar a página (HTML, para a loja virtual)
        </button>
      </p>
      {props.salvoEm && <p className="nota-do-formulario">Salvo em {props.salvoEm}</p>}
    </section>
  );
}
