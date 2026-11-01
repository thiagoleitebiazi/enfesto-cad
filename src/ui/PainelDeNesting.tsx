import { lerBlocos, type ConfiguracaoDeBlocos } from '../domain/ocupacaoNoEncaixe';
import { TODOS_EM_TRECHOS, tecidosDoModelo } from '../domain/tecidosDoModelo';
import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import type { MetodoDoNesting, ResultadoDeNesting } from '../domain/nesting';
import { arestaDeSimetria } from '../domain/anotacoes';
import { rotacoesNoEncaixe, type Molde } from '../domain/molde';
import { numeroComVirgula } from '../core/numeros';
import { lerMedida } from './medidas';
import { grupoDaPeca, nomeDoBloco, ordemDosGrupos } from '../domain/gruposDoEncaixe';

export interface OpcoesAvancadasDeNesting {
  readonly limiteDeTempoMinutos?: number;
  readonly aproveitamentoDesejadoPercentual?: number;
  /** Cada tamanho das peças graduadas entra no encaixe como uma peça própria (só vem quando há peças graduadas). */
  readonly todosOsTamanhos?: boolean;
  /** Quantas vezes cada tamanho entra (ADR 0186): só vem quando não é uma de cada. */
  readonly gradeDeCorte?: Readonly<Record<string, number>>;
  /** As peças com linha de simetria entram no encaixe abertas, inteiras (só vem quando há peças assim). */
  readonly abrirSimetrias?: boolean;
  /** A distância entre os moldes (mm), de linha de corte a linha de corte: passa a ser a do enfesto. */
  readonly distanciaEntreMoldesMm: number;
  /** O método: só vem quando não é o de sempre (a busca em grade). */
  readonly metodo?: MetodoDoNesting;
  /** "Gerar encaixe para": um tecido só, ou todos num trecho para cada (ADR 0194). */
  readonly tecido?: string;
  /** As grades de cada tecido, para lembrar na próxima vez. */
  readonly gradesDoModelo?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Os blocos, e metade dos pacotes virada (ADR 0208). */
  readonly blocos?: ConfiguracaoDeBlocos;
  readonly manterOrientacaoDosPacotes?: boolean;
  /** As opções do encaixe avançado (ADR 0195). */
  readonly manterSelecionadas?: boolean;
  readonly somenteNaMesa?: boolean;
  readonly usarEspelhamento?: boolean;
  readonly compactar?: boolean;
  readonly dobraInferior?: boolean;
}

interface PainelDeNestingProps {
  readonly pecas: readonly Molde[];
  /** O tecido ativo na mesa: o encaixe é dele (ADR 0209). */
  readonly tecidoAtivo?: string;
  /** A distância entre os moldes configurada no enfesto (mm): o campo começa com ela. */
  readonly distanciaEntreMoldesMm: number;
  /** O tecido de sentido único (pelo, estampa direcional): o encaixe não vira as peças. */
  readonly sentidoDoTecido?: { readonly nome: string; readonly sentido: string } | null;
  /** As grades de corte do modelo, por tecido, as últimas usadas (ADR 0186, 0194). */
  readonly gradesIniciais?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Quantas peças estão selecionadas: elas podem ficar no lugar. */
  readonly quantasSelecionadas?: number;
  /** O enfesto tem dobra no sentido do comprimento (par ou tubular), e de que lado ela está. */
  readonly temDobra?: boolean;
  readonly dobraInferior?: boolean;
  readonly executando: boolean;
  readonly progresso: { readonly colocadas: number; readonly total: number } | null;
  readonly resultado: ResultadoDeNesting | null;
  readonly onCalcular: (opcoesAvancadas: OpcoesAvancadasDeNesting) => void;
  /** Põe o encaixe com estas opções na fila de encaixes (ADR 0102), para ser calculado em segundo plano. */
  readonly onPorNaFila?: (opcoesAvancadas: OpcoesAvancadasDeNesting) => void;
  /** Muda o grupo do encaixe de uma peça (ADR 0103); sem isto, a coluna só mostra. */
  readonly onAlterarGrupo?: (pecaId: string, grupo: string) => void;
  readonly onCancelar: () => void;
  readonly onAplicar: () => void;
  readonly onFechar: () => void;
}

export function PainelDeNesting(props: PainelDeNestingProps): React.JSX.Element {
  const [limiteDeTempoMinutos, setLimiteDeTempoMinutos] = useState('');
  const [aproveitamentoDesejadoPercentual, setAproveitamentoDesejadoPercentual] = useState('');
  // A distância entre os moldes fica aqui, onde se pede o encaixe (antes, só no diálogo do Enfesto).
  const [distanciaEntreMoldes, setDistanciaEntreMoldes] = useState(() => String(props.distanciaEntreMoldesMm).replace('.', ','));
  const distanciaLida = lerMedida(distanciaEntreMoldes);
  const erroDaDistancia =
    distanciaEntreMoldes.trim() === '' || distanciaLida === null || distanciaLida < 0 ? 'A distância entre os moldes precisa ser um número de 0 mm para cima.' : null;
  const temGraduadas = props.pecas.some((p) => p.graduacao !== undefined);
  const [todosOsTamanhos, setTodosOsTamanhos] = useState(true);
  const tamanhosDaGrade = [...new Set(props.pecas.flatMap((p) => p.graduacao?.tamanhos ?? []))];
  const tecidos = tecidosDoModelo(props.pecas);
  const [tecidoDoEncaixe, setTecidoDoEncaixe] = useState(props.tecidoAtivo ?? '');
  const gradeEscrita = (chave: string): Readonly<Record<string, string>> => Object.fromEntries(tamanhosDaGrade.map((t) => [t, String(props.gradesIniciais?.[chave]?.[t] ?? props.gradesIniciais?.['']?.[t] ?? 1)]));
  const [grades, setGrades] = useState<Readonly<Record<string, Readonly<Record<string, string>>>>>({});
  const grade = grades[tecidoDoEncaixe] ?? gradeEscrita(tecidoDoEncaixe);
  const setGrade = (mudar: (g: Readonly<Record<string, string>>) => Readonly<Record<string, string>>): void => setGrades((todas) => ({ ...todas, [tecidoDoEncaixe]: mudar(grade) }));
  const [manterSelecionadas, setManterSelecionadas] = useState(false);
  const [somenteNaMesa, setSomenteNaMesa] = useState(false);
  const [usarEspelhamento, setUsarEspelhamento] = useState(false);
  const [compactar, setCompactar] = useState(false);
  const [emBlocos, setEmBlocos] = useState(false);
  const [separacaoCompleta, setSeparacaoCompleta] = useState(false);
  const [blocosEscritos, setBlocosEscritos] = useState('');
  const [blocosVerticais, setBlocosVerticais] = useState(false);
  const [manterPacotes, setManterPacotes] = useState(false);
  const [dobraInferior, setDobraInferior] = useState(props.dobraInferior === true);
  const temSimetria = props.pecas.some((p) => arestaDeSimetria(p) !== null);
  const [abrirSimetrias, setAbrirSimetrias] = useState(true);
  const [metodo, setMetodo] = useState<MetodoDoNesting>('grade');
  const grupos = ordemDosGrupos(props.pecas);
  /** Os tamanhos com que a peça entra no encaixe: todos os da graduação, só o base, ou o dela. */
  const tamanhosDa = (p: Molde): string => {
    if (!p.graduacao) return p.tamanho.trim() === '' ? '—' : p.tamanho;
    return todosOsTamanhos ? p.graduacao.tamanhos.join(', ') : p.graduacao.tamanhos[p.graduacao.base]!;
  };

  /** As opções escolhidas na janela (`null` com a distância errada). */
  function opcoesEscolhidas(): OpcoesAvancadasDeNesting | null {
    if (erroDaDistancia !== null || distanciaLida === null) return null;
    const minutos = Number(limiteDeTempoMinutos);
    const aproveitamento = Number(aproveitamentoDesejadoPercentual);
    const lida = (g: Readonly<Record<string, string>>): Readonly<Record<string, number>> => Object.fromEntries(tamanhosDaGrade.map((t) => [t, Math.max(0, Math.round(Number(g[t] ?? 1)) || 0)]));
    const gradeLida = lida(grade);
    const gradesDoModelo = Object.fromEntries(Object.entries({ ...grades, [tecidoDoEncaixe]: grade }).map(([chave, g]) => [chave, lida(g)]));
    return {
      ...(limiteDeTempoMinutos.trim() !== '' && minutos > 0 ? { limiteDeTempoMinutos: minutos } : {}),
      ...(aproveitamentoDesejadoPercentual.trim() !== '' && aproveitamento > 0
        ? { aproveitamentoDesejadoPercentual: aproveitamento }
        : {}),
      ...(temGraduadas ? { todosOsTamanhos } : {}),
      ...(temGraduadas && todosOsTamanhos && Object.values(gradeLida).some((n) => n !== 1) ? { gradeDeCorte: gradeLida } : {}),
      ...(temSimetria ? { abrirSimetrias } : {}),
      distanciaEntreMoldesMm: distanciaLida,
      ...(metodo !== 'grade' ? { metodo } : {}),
      ...(tecidoDoEncaixe !== '' ? { tecido: tecidoDoEncaixe } : {}),
      ...(Object.keys(grades).length > 0 ? { gradesDoModelo } : {}),
      ...(manterSelecionadas ? { manterSelecionadas } : {}),
      ...(somenteNaMesa ? { somenteNaMesa } : {}),
      ...(usarEspelhamento ? { usarEspelhamento } : {}),
      ...(compactar ? { compactar } : {}),
      ...(emBlocos ? { blocos: { separacaoCompleta, blocos: lerBlocos(blocosEscritos), vertical: blocosVerticais && !props.temDobra } } : {}),
      ...(manterPacotes ? { manterOrientacaoDosPacotes: true } : {}),
      ...(props.temDobra ? { dobraInferior } : {}),
    };
  }

  function aoCalcular(): void {
    const opcoes = opcoesEscolhidas();
    if (opcoes) props.onCalcular(opcoes);
  }

  function aoPorNaFila(): void {
    const opcoes = opcoesEscolhidas();
    if (opcoes) props.onPorNaFila?.(opcoes);
  }

  return (
    <Sobreposicao titulo="Nesting automático" onFechar={props.onFechar}>
      <div className="painel-de-nesting">
        {!props.executando && !props.resultado && (
          <div className="painel-de-nesting-config">
            <form
              className="formulario-de-sobreposicao painel-de-nesting-config-parametros"
              onSubmit={(e) => e.preventDefault()}
            >
              <p className="legenda-inline">Parâmetros gerais</p>
              <label>
                Método do encaixe
                <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoDoNesting)}>
                  <option value="grade">Busca em grade (o de sempre)</option>
                  <option value="pontos-de-canto">Pontos de canto (o do planejamento de corte)</option>
                </select>
              </label>
              <p className="nota-do-formulario">
                {metodo === 'grade'
                  ? 'Procura o primeiro lugar livre numa grade de 10 mm, até 20 000 posições por peça: em mesas longas (mais de uns 2,4 m numa largura de 1,6 m), as peças que passam disso ficam de fora.'
                  : 'Põe cada peça junto das já postas, testa três ordens de entrada e fica com o encaixe mais curto; mais rápido, e sem o limite de posições. A meta de aproveitamento não vale neste método. Nenhum dos dois métodos garante o menor encaixe possível.'}
              </p>
              <label>
                Distância entre os moldes (mm)
                <input
                  type="text"
                  inputMode="decimal"
                  value={distanciaEntreMoldes}
                  aria-invalid={erroDaDistancia !== null}
                  onChange={(e) => setDistanciaEntreMoldes(e.target.value)}
                />
              </label>
              {erroDaDistancia && (
                <p className="mensagem-de-erro" role="alert">
                  {erroDaDistancia}
                </p>
              )}
              <p className="nota-do-formulario">
                Medida de linha de corte a linha de corte: cada molde é encostado nos vizinhos até essa distância. Fica
                guardada no enfesto do projeto.
              </p>
              <label>
                Limite de tempo (minutos)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={limiteDeTempoMinutos}
                  onChange={(e) => setLimiteDeTempoMinutos(e.target.value)}
                  placeholder="Sem limite"
                />
              </label>
              <label>
                Aproveitamento desejado (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={aproveitamentoDesejadoPercentual}
                  onChange={(e) => setAproveitamentoDesejadoPercentual(e.target.value)}
                  placeholder="Máximo possível"
                />
              </label>
              <p className="nota-do-formulario">
                O cálculo para assim que atingir o aproveitamento desejado, mesmo que ainda haja peças por
                posicionar.
              </p>
              {tecidos.length > 1 && !props.tecidoAtivo && (
                <label>
                  Gerar encaixe para
                  <select value={tecidoDoEncaixe} onChange={(e) => setTecidoDoEncaixe(e.target.value)}>
                    <option value="">Todos os tecidos, juntos</option>
                    <option value={TODOS_EM_TRECHOS}>Todos os tecidos, um trecho para cada</option>
                    {tecidos.map((t) => (
                      <option key={t} value={t}>
                        Só {t}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(props.quantasSelecionadas ?? 0) > 0 && (
                <label className="opcao-em-linha" title="Manter peças encaixadas: as selecionadas ficam onde estão, e as outras se encaixam em volta">
                  <input type="checkbox" checked={manterSelecionadas} onChange={(e) => setManterSelecionadas(e.target.checked)} />
                  Manter no lugar as {props.quantasSelecionadas} peças selecionadas
                </label>
              )}
              <label className="opcao-em-linha" title="As peças que estão depois do fim da mesa ficam fora deste encaixe">
                <input type="checkbox" checked={somenteNaMesa} onChange={(e) => setSomenteNaMesa(e.target.checked)} />
                Usar somente as peças que estão na mesa
              </label>
              <label className="opcao-em-linha" title="Todas as peças podem sair espelhadas neste encaixe">
                <input type="checkbox" checked={usarEspelhamento} onChange={(e) => setUsarEspelhamento(e.target.checked)} />
                Usar espelhamento de peças
              </label>
              <label className="opcao-em-linha" title="No fim, as peças andam para o começo da mesa até encostar">
                <input type="checkbox" checked={compactar} onChange={(e) => setCompactar(e.target.checked)} />
                Compactar
              </label>
              <label className="opcao-em-linha" title="Intercala a grade: um pacote a 0°, o seguinte a 180°">
                <input type="checkbox" checked={manterPacotes} onChange={(e) => setManterPacotes(e.target.checked)} />
                Manter orientação dos pacotes
              </label>
              <label className="opcao-em-linha">
                <input type="checkbox" checked={emBlocos} onChange={(e) => setEmBlocos(e.target.checked)} />
                Encaixar em blocos
              </label>
              {emBlocos && (
                <fieldset className="grupo-de-opcoes-do-formulario">
                  <legend>Configuração dos blocos</legend>
                  <label className="opcao-em-linha" title="Cada tamanho é um bloco, em ordem crescente">
                    <input type="checkbox" checked={separacaoCompleta} onChange={(e) => setSeparacaoCompleta(e.target.checked)} />
                    Separação completa dos blocos
                  </label>
                  {!separacaoCompleta && (
                    <label>
                      Tamanhos de cada bloco, separados por ponto e vírgula
                      <input type="text" value={blocosEscritos} placeholder="P M; G GG" onChange={(e) => setBlocosEscritos(e.target.value)} />
                    </label>
                  )}
                  <label>
                    Orientação dos blocos
                    <select value={blocosVerticais ? 'vertical' : 'horizontal'} onChange={(e) => setBlocosVerticais(e.target.value === 'vertical')}>
                      <option value="horizontal">Horizontal: um depois do outro no comprimento</option>
                      <option value="vertical" disabled={props.temDobra}>
                        {props.temDobra ? 'Vertical: não vale com o tecido dobrado' : 'Vertical: um abaixo do outro na largura'}
                      </option>
                    </select>
                  </label>
                </fieldset>
              )}
              {props.temDobra && (
                <label>
                  Dobra do tecido
                  <select value={dobraInferior ? 'inferior' : 'superior'} onChange={(e) => setDobraInferior(e.target.value === 'inferior')}>
                    <option value="superior">Superior</option>
                    <option value="inferior">Inferior</option>
                  </select>
                </label>
              )}
              {temSimetria && (
                <>
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={abrirSimetrias} onChange={(e) => setAbrirSimetrias(e.target.checked)} />
                    Abrir as peças com linha de simetria
                  </label>
                  <p className="nota-do-formulario">
                    {abrirSimetrias
                      ? 'A peça dobrada entra no encaixe aberta, inteira. Ao aplicar, passa a ser a peça inteira (Ctrl+Z desfaz).'
                      : 'A peça com linha de simetria entra como está desenhada: meia peça.'}
                  </p>
                </>
              )}
              {temGraduadas && (
                <>
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={todosOsTamanhos} onChange={(e) => setTodosOsTamanhos(e.target.checked)} />
                    Encaixar todos os tamanhos das peças graduadas
                  </label>
                  <p className="nota-do-formulario">
                    {todosOsTamanhos
                      ? 'Cada tamanho entra como uma peça própria. Ao aplicar o encaixe, as peças graduadas passam a ser essas peças, sem graduação (Ctrl+Z desfaz).'
                      : 'Só o tamanho base de cada peça graduada entra no encaixe.'}
                  </p>
                  {todosOsTamanhos && (
                    <fieldset className="grupo-de-opcoes-do-formulario">
                      <legend>Grade de corte</legend>
                      {tamanhosDaGrade.map((t) => (
                        <label key={t} className="opcao-em-linha">
                          {t}
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Grade de corte do tamanho ${t}`}
                            className="campo-curto"
                            value={grade[t] ?? '1'}
                            onChange={(e) => setGrade((g) => ({ ...g, [t]: e.target.value }))}
                          />
                        </label>
                      ))}
                      <p className="nota-do-formulario">Quantas vezes cada tamanho entra no risco; zero tira o tamanho.</p>
                      {tecidos.length > 1 && (
                        <button type="button" onClick={() => setGrades(Object.fromEntries(['', TODOS_EM_TRECHOS, ...tecidos].map((c) => [c, grade])))}>
                          Aplicar para modelo
                        </button>
                      )}
                    </fieldset>
                  )}
                </>
              )}
            </form>

            <div className="painel-de-nesting-config-pecas">
              <p className="legenda-inline">Peças e restrições (sentido do fio)</p>
              <table className="tabela-de-pecas-nesting">
                <thead>
                  <tr>
                    <th>Peça</th>
                    <th>Tamanho</th>
                    <th>Qtd</th>
                    <th>Rotação</th>
                    <th>Espelho</th>
                    <th>Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {props.pecas.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{tamanhosDa(p)}</td>
                      <td>{p.quantidade}</td>
                      <td>{rotacoesNoEncaixe(p.restricaoDeRotacao, Boolean(props.sentidoDoTecido)).map((r) => `${r}°`).join(', ')}</td>
                      <td>{p.restricaoDeRotacao.permiteEspelhamento ? 'Sim' : 'Não'}</td>
                      <td>
                        {props.onAlterarGrupo ? (
                          <input
                            type="text"
                            className="campo-do-grupo"
                            list="grupos-do-encaixe-no-nesting"
                            aria-label={`Grupo de ${p.nome}`}
                            placeholder="—"
                            value={p.grupoDoEncaixe ?? ''}
                            onChange={(e) => props.onAlterarGrupo?.(p.id, e.target.value)}
                          />
                        ) : (
                          grupoDaPeca(p) || '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="grupos-do-encaixe-no-nesting">
                {grupos.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <p className="nota-do-formulario">
                {grupos.length === 0
                  ? 'Grupo: as peças com o mesmo grupo (por exemplo, “Entretela”) saem juntas, num trecho só do comprimento, que pode ser cortado à parte. Sem grupo, o encaixe é o de sempre.'
                  : `Grupos: as peças de cada grupo saem juntas, num trecho só do comprimento, nesta ordem: ${[...grupos, ...(props.pecas.some((p) => grupoDaPeca(p) === '') ? ['as sem grupo'] : [])].join(' → ')}. A ordem é a da lista de peças.`}
              </p>
              <p className="nota-do-formulario">
                {props.onAlterarGrupo ? 'O grupo se muda aqui; as outras colunas, pelo painel "Propriedades" antes de calcular.' : 'Só informativo — ajuste pelo painel "Propriedades" antes de calcular, se precisar.'}
              </p>
              {props.sentidoDoTecido && (
                <p className="nota-do-formulario">
                  O tecido “{props.sentidoDoTecido.nome}” {props.sentidoDoTecido.sentido}: o encaixe não vira peças 180° nem 270°,
                  para todas ficarem no mesmo sentido.
                </p>
              )}
            </div>

            <div className="acoes-da-sobreposicao painel-de-nesting-config-acoes">
              <button type="button" onClick={props.onFechar}>
                Cancelar
              </button>
              {props.onPorNaFila && (
                <button
                  type="button"
                  onClick={aoPorNaFila}
                  disabled={erroDaDistancia !== null}
                  title="Põe este encaixe, com estas opções, na fila de encaixes: ele é calculado em segundo plano, um de cada vez, enquanto você continua trabalhando (Encaixe › Fila de encaixes)"
                >
                  Pôr na fila
                </button>
              )}
              <button type="button" onClick={aoCalcular} className="botao-primario" disabled={erroDaDistancia !== null}>
                Calcular encaixe
              </button>
            </div>
          </div>
        )}

        {props.executando && (
          <>
            <p>
              Calculando... {props.progresso ? `${props.progresso.colocadas} / ${props.progresso.total} peças` : ''}
            </p>
            <div className="barra-de-progresso">
              <div
                className="barra-de-progresso-preenchimento"
                style={{
                  width: props.progresso
                    ? `${Math.round((props.progresso.colocadas / Math.max(1, props.progresso.total)) * 100)}%`
                    : '0%',
                }}
              />
            </div>
            <div className="acoes-da-sobreposicao">
              <button onClick={props.onCancelar}>Cancelar</button>
            </div>
          </>
        )}

        {!props.executando && props.resultado && (
          <>
            <dl className="lista-de-propriedades">
              <dt>Peças colocadas</dt>
              <dd>{props.resultado.pecasColocadas.length}</dd>
              <dt>Peças não colocadas</dt>
              <dd>{props.resultado.pecasNaoColocadas.length}</dd>
              <dt>Comprimento utilizado</dt>
              <dd>{numeroComVirgula(props.resultado.comprimentoUtilizadoMm, 1)} mm</dd>
              <dt>Aproveitamento</dt>
              <dd>{numeroComVirgula(props.resultado.aproveitamentoPercentual, 1)}%</dd>
              <dt>Tempo de processamento</dt>
              <dd>{props.resultado.tempoDeProcessamentoMs} ms</dd>
              {props.resultado.blocosDosGrupos && (
                <>
                  <dt>Trechos dos grupos</dt>
                  <dd>
                    <ul className="trechos-dos-grupos">
                      {props.resultado.blocosDosGrupos.map((b) => (
                        <li key={b.grupo}>
                          {nomeDoBloco(b)}: de {numeroComVirgula(b.inicioMm, 1)} a {numeroComVirgula(b.fimMm, 1)} mm ({b.pecas} peça(s))
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
              {props.resultado.interrompido && (
                <>
                  <dt>Status</dt>
                  <dd>Interrompido pelo usuário (resultado parcial)</dd>
                </>
              )}
              {props.resultado.paradaPorTempoLimite && (
                <>
                  <dt>Status</dt>
                  <dd>Parou por limite de tempo (resultado parcial)</dd>
                </>
              )}
              {props.resultado.paradaPorMetaDeAproveitamento && (
                <>
                  <dt>Status</dt>
                  <dd>Parou ao atingir o aproveitamento desejado</dd>
                </>
              )}
            </dl>

            {props.resultado.pecasNaoColocadas.length > 0 && (
              <div className="faixa-de-avisos" style={{ position: 'static', marginTop: 8 }}>
                <strong>Não coube na área configurada:</strong>
                <ul>
                  {props.resultado.pecasNaoColocadas.map((p, i) => (
                    <li key={i}>
                      {p.nome} (cópia {p.indiceCopia + 1})
                    </li>
                  ))}
                </ul>
                <p>Estas peças NÃO aparecerão no layout se você aplicar. Ajuste quantidade/tecido/rotações permitidas e tente de novo, ou aplique mesmo assim e desfaça (Ctrl+Z) se preferir.</p>
              </div>
            )}

            <div className="acoes-da-sobreposicao">
              <button onClick={props.onFechar}>Descartar</button>
              <button onClick={props.onAplicar} className="botao-primario" disabled={props.resultado.pecasColocadas.length === 0}>
                Aplicar ao projeto
              </button>
            </div>
          </>
        )}
      </div>
    </Sobreposicao>
  );
}
