import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { lerMedida } from './medidas';
import type { MalhaDoCadastro } from '../domain/cadastroDeProducao';
import {
  csvDosMateriais,
  precoEscrito,
  procurarMateriais,
  removerMaterial,
  ROTULO_DA_CATEGORIA,
  ROTULO_DA_UNIDADE,
  salvarMaterial,
  salvarPadroesDeCusto,
  trazerMalhasDoCadastro,
  type BibliotecaDeMateriais,
  type CategoriaDoMaterial,
  type Material,
  type PadroesDeCusto,
  type UnidadeDoMaterial,
} from '../domain/materiais';
import { numeroComVirgula } from '../core/numeros';

type Parte = 'materiais' | 'padroes';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const quando = (iso: string): string => DATA.format(new Date(iso));

/** O número do campo (com vírgula ou ponto); em branco, `vazio`; o texto que não é número, `NaN`. */
function numeroDoCampo<T>(texto: string, vazio: T): number | T {
  if (texto.trim() === '') return vazio;
  return lerMedida(texto) ?? Number.NaN;
}

const comVirgula = (v: number | null | undefined, casas?: number): string => (v === null || v === undefined ? '' : numeroComVirgula(v, casas));

interface FormularioDoMaterial {
  readonly id: string | null;
  readonly codigo: string;
  readonly descricao: string;
  readonly categoria: CategoriaDoMaterial;
  readonly unidade: UnidadeDoMaterial;
  readonly preco: string;
  readonly fornecedor: string;
  readonly cor: string;
  readonly composicao: string;
  readonly largura: string;
  readonly gramatura: string;
  readonly observacoes: string;
}

const FORMULARIO_NOVO: FormularioDoMaterial = {
  id: null,
  codigo: '',
  descricao: '',
  categoria: 'aviamento',
  unidade: 'un',
  preco: '',
  fornecedor: '',
  cor: '',
  composicao: '',
  largura: '',
  gramatura: '',
  observacoes: '',
};

function formularioDe(m: Material): FormularioDoMaterial {
  return {
    id: m.id,
    codigo: m.codigo,
    descricao: m.descricao,
    categoria: m.categoria,
    unidade: m.unidade,
    preco: comVirgula(m.precoPorUnidade, 2),
    fornecedor: m.fornecedor ?? '',
    cor: m.cor ?? '',
    composicao: m.composicao ?? '',
    largura: comVirgula(m.larguraMm),
    gramatura: comVirgula(m.gramaturaGm2),
    observacoes: m.observacoes ?? '',
  };
}

/**
 * A biblioteca de materiais e aviamentos (ADR 0104): procurar, cadastrar e mudar os materiais (o preço trocado
 * guarda o anterior), trazer as malhas do cadastro de produção, exportar em CSV, e os padrões de custo da empresa
 * (custo do minuto, indiretos, impostos, comissão, margem) que o pré-custo de cada modelo usa.
 */
export function PainelDeMateriais(props: {
  readonly biblioteca: BibliotecaDeMateriais;
  readonly avisos: readonly string[];
  readonly somenteLeitura: boolean;
  /** As malhas do cadastro de produção (para trazer como tecidos). */
  readonly malhasDoCadastro: readonly MalhaDoCadastro[];
  /** Os modelos (projetos) que usam o material, pelo nome — para avisar antes de remover. */
  readonly modelosQueUsam?: (materialId: string) => readonly string[];
  /** Grava a biblioteca mudada; devolve a mensagem do erro, ou `null`. */
  readonly onMudar: (nova: BibliotecaDeMateriais) => Promise<string | null>;
  readonly onSalvarTexto: (sugestaoDeNome: string, conteudo: string) => Promise<string | null>;
  readonly agoraIso: () => string;
  readonly novoId: () => string;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const { biblioteca } = props;
  const [parte, setParte] = useState<Parte>('materiais');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDoMaterial | 'todas'>('todas');
  const [formulario, setFormulario] = useState<FormularioDoMaterial | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [padroes, setPadroes] = useState(() => textosDosPadroes(biblioteca.padroesDeCusto));

  const lista = procurarMateriais(biblioteca.materiais, busca).filter((m) => categoria === 'todas' || m.categoria === categoria);
  const malhasNovas = props.malhasDoCadastro.filter((k) => !biblioteca.materiais.some((m) => m.malhaId === k.id)).length;
  const emEdicao = formulario?.id ? biblioteca.materiais.find((m) => m.id === formulario.id) : undefined;

  /** Calcula a mudança (o erro aparece na janela, sem mudar nada) e grava. */
  const mudar = async (fazer: () => BibliotecaDeMateriais, sucesso: string): Promise<boolean> => {
    if (props.somenteLeitura) {
      setMensagem('A biblioteca foi gravada por uma versão mais nova do programa: aqui ela só é mostrada, não gravada.');
      return false;
    }
    let nova: BibliotecaDeMateriais;
    try {
      nova = fazer();
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
      return false;
    }
    const erro = await props.onMudar(nova);
    setMensagem(erro ?? sucesso);
    return erro === null;
  };

  const guardarMaterial = async (): Promise<void> => {
    if (!formulario) return;
    const preco = numeroDoCampo(formulario.preco, null);
    const largura = numeroDoCampo(formulario.largura, undefined);
    const gramatura = numeroDoCampo(formulario.gramatura, undefined);
    if (Number.isNaN(preco) || Number.isNaN(largura) || Number.isNaN(gramatura)) {
      setMensagem('O preço, a largura e a gramatura precisam ser números (com vírgula ou ponto), ou ficar em branco.');
      return;
    }
    const tecido = formulario.categoria === 'tecido';
    // O material de antes (o malhaId, os preços anteriores), sem os campos que o formulário diz: em branco, eles saem.
    const antes: Partial<Record<keyof Material, unknown>> = { ...(emEdicao ?? {}) };
    for (const campo of ['fornecedor', 'cor', 'composicao', 'larguraMm', 'gramaturaGm2', 'observacoes'] as const) delete antes[campo];
    const material = {
      ...antes,
      id: formulario.id ?? props.novoId(),
      codigo: formulario.codigo,
      descricao: formulario.descricao,
      categoria: formulario.categoria,
      unidade: formulario.unidade,
      precoPorUnidade: preco,
      atualizadoEmIso: props.agoraIso(),
      ...(formulario.fornecedor.trim() ? { fornecedor: formulario.fornecedor.trim() } : {}),
      ...(formulario.cor.trim() ? { cor: formulario.cor.trim() } : {}),
      ...(tecido && formulario.composicao.trim() ? { composicao: formulario.composicao.trim() } : {}),
      ...(tecido && largura !== undefined ? { larguraMm: largura } : {}),
      ...(tecido && gramatura !== undefined ? { gramaturaGm2: gramatura } : {}),
      ...(formulario.observacoes.trim() ? { observacoes: formulario.observacoes.trim() } : {}),
    } as Material;
    if (await mudar(() => salvarMaterial(biblioteca, material, props.agoraIso()), `“${material.descricao.trim()}” guardado na biblioteca.`)) setFormulario(null);
  };

  const remover = async (m: Material): Promise<void> => {
    const usam = props.modelosQueUsam?.(m.id) ?? [];
    const aviso = usam.length > 0 ? `\n\nEle é usado na ficha técnica de: ${usam.join(', ')}. Nelas, o item fica com a descrição, sem o preço da biblioteca.` : '';
    if (!window.confirm(`Remover “${m.descricao}” da biblioteca?${aviso}`)) return;
    await mudar(() => removerMaterial(biblioteca, m.id), `“${m.descricao}” removido da biblioteca.`);
  };

  const guardarPadroes = async (): Promise<void> => {
    const lidos = padroesDosTextos(padroes);
    if (typeof lidos === 'string') {
      setMensagem(lidos);
      return;
    }
    await mudar(() => salvarPadroesDeCusto(biblioteca, lidos), 'Padrões de custo guardados: o pré-custo dos modelos passa a começar com eles.');
  };

  const PARTES: ReadonlyArray<readonly [Parte, string]> = [
    ['materiais', `Materiais (${biblioteca.materiais.length})`],
    ['padroes', 'Padrões de custo'],
  ];

  return (
    <Sobreposicao titulo="Materiais e aviamentos" onFechar={props.onFechar}>
      <div className="painel-de-materiais">
        <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da biblioteca de materiais">
          {PARTES.map(([id, rotulo]) => (
            <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {props.somenteLeitura && <p className="mensagem-de-erro">A biblioteca foi gravada por uma versão mais nova do programa: as mudanças aqui não são gravadas.</p>}
        {props.avisos.length > 0 && (
          <ul className="avisos-da-fila">
            {props.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        {mensagem && (
          <p className="nota-do-formulario" role="status">
            {mensagem}
          </p>
        )}

        {parte === 'materiais' && !formulario && (
          <section aria-label="Materiais">
            <div className="acoes-em-linha barra-dos-materiais">
              <label>
                Procurar
                <input type="search" value={busca} placeholder="Código, descrição, fornecedor, cor…" onChange={(e) => setBusca(e.target.value)} />
              </label>
              <label>
                Categoria
                <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDoMaterial | 'todas')}>
                  <option value="todas">Todas</option>
                  {(Object.keys(ROTULO_DA_CATEGORIA) as CategoriaDoMaterial[]).map((c) => (
                    <option key={c} value={c}>
                      {ROTULO_DA_CATEGORIA[c]}
                    </option>
                  ))}
                </select>
              </label>
              <span className="acoes-da-fila">
                <button type="button" className="botao-primario" onClick={() => setFormulario(FORMULARIO_NOVO)}>
                  Novo material
                </button>
                <button
                  type="button"
                  disabled={malhasNovas === 0}
                  title="As malhas do cadastro de produção (Planejamento de corte) entram como tecidos, com a largura, a gramatura e o custo"
                  onClick={() => {
                    const { biblioteca: nova, trazidas } = trazerMalhasDoCadastro(biblioteca, props.malhasDoCadastro, props.novoId, props.agoraIso());
                    void mudar(() => nova, `${trazidas} malha(s) do cadastro de produção trazida(s) como tecido.`);
                  }}
                >
                  Trazer as malhas do cadastro{malhasNovas > 0 ? ` (${malhasNovas})` : ''}
                </button>
                <button
                  type="button"
                  disabled={biblioteca.materiais.length === 0}
                  onClick={() => void props.onSalvarTexto('materiais-e-aviamentos.csv', csvDosMateriais(biblioteca.materiais)).then((c) => c && setMensagem(`Salvo em ${c}.`))}
                >
                  Exportar CSV
                </button>
              </span>
            </div>
            {lista.length === 0 ? (
              <p className="nota-do-formulario">
                {biblioteca.materiais.length === 0
                  ? 'A biblioteca está vazia. Cadastre os tecidos, aviamentos e embalagens que os modelos usam (Novo material), ou traga as malhas do cadastro de produção. Cada um com a unidade em que é comprado e o preço: é com eles que a ficha técnica calcula o custo.'
                  : 'Nenhum material com essa busca.'}
              </p>
            ) : (
              <table className="tabela-de-relatorio tabela-de-materiais">
                <caption>Materiais da biblioteca</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Categoria</th>
                    <th scope="col" className="coluna-numerica">
                      Preço
                    </th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Atualizado</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((m) => (
                    <tr key={m.id}>
                      <td>{m.codigo || '—'}</td>
                      <td>
                        {m.descricao}
                        {m.cor ? <small> · {m.cor}</small> : null}
                        {m.composicao ? <small> · {m.composicao}</small> : null}
                      </td>
                      <td>{ROTULO_DA_CATEGORIA[m.categoria]}</td>
                      <td className="coluna-numerica">{precoEscrito(m)}</td>
                      <td>{m.fornecedor ?? '—'}</td>
                      <td>{quando(m.atualizadoEmIso)}</td>
                      <td>
                        <span className="acoes-do-trabalho">
                          <button type="button" aria-label={`Editar ${m.descricao}`} onClick={() => setFormulario(formularioDe(m))}>
                            Editar
                          </button>
                          <button type="button" aria-label={`Remover ${m.descricao}`} onClick={() => void remover(m)}>
                            Remover
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {parte === 'materiais' && formulario && (
          <section aria-label={formulario.id ? 'Editar material' : 'Novo material'}>
            <form className="formulario-de-sobreposicao formulario-do-material" onSubmit={(e) => e.preventDefault()}>
              <label>
                Descrição *
                <input value={formulario.descricao} onChange={(e) => setFormulario({ ...formulario, descricao: e.target.value })} />
              </label>
              <label>
                Código
                <input value={formulario.codigo} onChange={(e) => setFormulario({ ...formulario, codigo: e.target.value })} />
              </label>
              <label>
                Categoria
                <select value={formulario.categoria} onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value as CategoriaDoMaterial })}>
                  {(Object.keys(ROTULO_DA_CATEGORIA) as CategoriaDoMaterial[]).map((c) => (
                    <option key={c} value={c}>
                      {ROTULO_DA_CATEGORIA[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unidade de compra
                <select value={formulario.unidade} onChange={(e) => setFormulario({ ...formulario, unidade: e.target.value as UnidadeDoMaterial })}>
                  {(Object.keys(ROTULO_DA_UNIDADE) as UnidadeDoMaterial[]).map((u) => (
                    <option key={u} value={u}>
                      {ROTULO_DA_UNIDADE[u]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preço por {ROTULO_DA_UNIDADE[formulario.unidade]} (R$)
                <input inputMode="decimal" value={formulario.preco} placeholder="Sem preço" onChange={(e) => setFormulario({ ...formulario, preco: e.target.value })} />
              </label>
              <label>
                Fornecedor
                <input value={formulario.fornecedor} onChange={(e) => setFormulario({ ...formulario, fornecedor: e.target.value })} />
              </label>
              <label>
                Cor
                <input value={formulario.cor} onChange={(e) => setFormulario({ ...formulario, cor: e.target.value })} />
              </label>
              {formulario.categoria === 'tecido' && (
                <>
                  <label>
                    Composição
                    <input value={formulario.composicao} placeholder="100% algodão" onChange={(e) => setFormulario({ ...formulario, composicao: e.target.value })} />
                  </label>
                  <label>
                    Largura útil (mm)
                    <input inputMode="decimal" value={formulario.largura} onChange={(e) => setFormulario({ ...formulario, largura: e.target.value })} />
                  </label>
                  <label>
                    Gramatura (g/m²)
                    <input inputMode="decimal" value={formulario.gramatura} onChange={(e) => setFormulario({ ...formulario, gramatura: e.target.value })} />
                  </label>
                  <p className="nota-do-formulario">A largura e a gramatura passam o consumo do encaixe (em metros) a quilos, para o tecido comprado por quilo.</p>
                </>
              )}
              <label>
                Observações
                <textarea rows={2} value={formulario.observacoes} onChange={(e) => setFormulario({ ...formulario, observacoes: e.target.value })} />
              </label>
              {emEdicao?.precosAnteriores && emEdicao.precosAnteriores.length > 0 && (
                <div className="precos-anteriores">
                  <p className="legenda-inline">Preços anteriores</p>
                  <ul>
                    {emEdicao.precosAnteriores.map((p) => (
                      <li key={p.ateIso}>
                        {p.precoPorUnidade === null ? 'sem preço' : `R$ ${numeroComVirgula(p.precoPorUnidade, 2)}`} — até {quando(p.ateIso)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
            <div className="acoes-da-sobreposicao">
              <button type="button" onClick={() => setFormulario(null)}>
                Cancelar
              </button>
              <button type="button" className="botao-primario" onClick={() => void guardarMaterial()}>
                Guardar
              </button>
            </div>
          </section>
        )}

        {parte === 'padroes' && (
          <section aria-label="Padrões de custo">
            <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
              <label>
                Custo do minuto de costura (R$)
                <input inputMode="decimal" value={padroes.custoDoMinuto} placeholder="Não informado" onChange={(e) => setPadroes({ ...padroes, custoDoMinuto: e.target.value })} />
              </label>
              <p className="nota-do-formulario">
                O custo da mão de obra de cada modelo é o tempo das operações (a sequência operacional da ficha) vezes o custo do
                minuto: o custo da fábrica (salários, encargos) dividido pelos minutos produtivos.
              </p>
              <label>
                Custos indiretos (% sobre materiais + mão de obra)
                <input inputMode="decimal" value={padroes.indiretos} onChange={(e) => setPadroes({ ...padroes, indiretos: e.target.value })} />
              </label>
              <label>
                Impostos (% do preço)
                <input inputMode="decimal" value={padroes.impostos} onChange={(e) => setPadroes({ ...padroes, impostos: e.target.value })} />
              </label>
              <label>
                Comissão (% do preço)
                <input inputMode="decimal" value={padroes.comissao} onChange={(e) => setPadroes({ ...padroes, comissao: e.target.value })} />
              </label>
              <label>
                Margem de lucro (% do preço)
                <input inputMode="decimal" value={padroes.margem} onChange={(e) => setPadroes({ ...padroes, margem: e.target.value })} />
              </label>
              <p className="nota-do-formulario">
                O preço sugerido é o custo dividido por (100% − impostos − comissão − margem): assim, de cada venda, saem os impostos,
                a comissão e a margem na proporção pedida. Cada modelo pode trocar estes números no pré-custo dele.
              </p>
            </form>
            <div className="acoes-da-sobreposicao">
              <button type="button" className="botao-primario" onClick={() => void guardarPadroes()}>
                Guardar os padrões
              </button>
            </div>
          </section>
        )}
      </div>
    </Sobreposicao>
  );
}

interface TextosDosPadroes {
  readonly custoDoMinuto: string;
  readonly indiretos: string;
  readonly impostos: string;
  readonly comissao: string;
  readonly margem: string;
}

function textosDosPadroes(p: PadroesDeCusto): TextosDosPadroes {
  return {
    custoDoMinuto: comVirgula(p.custoDoMinuto),
    indiretos: comVirgula(p.indiretosPercentual),
    impostos: comVirgula(p.impostosPercentual),
    comissao: comVirgula(p.comissaoPercentual),
    margem: comVirgula(p.margemPercentual),
  };
}

/** Os padrões lidos dos campos, ou a mensagem do que não é número. */
function padroesDosTextos(t: TextosDosPadroes): PadroesDeCusto | string {
  const custoDoMinuto = numeroDoCampo(t.custoDoMinuto, null);
  const percentuais = [t.indiretos, t.impostos, t.comissao, t.margem].map((v) => numeroDoCampo(v, 0));
  if (Number.isNaN(custoDoMinuto) || percentuais.some((v) => Number.isNaN(v))) return 'Os padrões de custo precisam ser números (com vírgula ou ponto).';
  const [indiretosPercentual, impostosPercentual, comissaoPercentual, margemPercentual] = percentuais as [number, number, number, number];
  return { custoDoMinuto, indiretosPercentual, impostosPercentual, comissaoPercentual, margemPercentual };
}
