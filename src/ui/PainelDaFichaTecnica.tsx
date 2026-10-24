import { useEffect, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { CampoDeNumero } from './CampoDeNumero';
import type { Molde } from '../domain/molde';
import {
  materiaisNaOrdem,
  precoEscrito,
  ROTULO_DA_CATEGORIA,
  ROTULO_DA_UNIDADE,
  type BibliotecaDeMateriais,
  type PadroesDeCusto,
  type UnidadeDoMaterial,
} from '../domain/materiais';
import {
  abrirNovaVersao,
  aprovarFicha,
  consumoDoItem,
  consumoEscrito,
  definirPadroesDeCustoDaFicha,
  enviarParaAprovacao,
  fichaEditavel,
  lerMedidasColadas,
  lerTamanhos,
  mudarFicha,
  pedirAlteracao,
  ROTULO_DA_ACAO_DA_FICHA,
  ROTULO_DA_SITUACAO_DA_FICHA,
  tamanhosDasPecas,
  tempoTotalDasOperacoes,
  type EncaixeParaConsumo,
  type FichaTecnica,
  type InstrucoesDaFicha,
  type ItemDeMaterial,
  type Operacao,
  type PontoDeMedida,
} from '../domain/fichaTecnica';
import { calcularPreCusto, centavos, ROTULO_DO_GRUPO_DA_LINHA, simularMeta, totaisPorGrupo, type MetaDeCusto, type PreCusto } from '../domain/preCusto';
import { numeroComVirgula } from '../core/numeros';

export type ParteDaFicha = 'descricao' | 'medidas' | 'materiais' | 'operacoes' | 'instrucoes' | 'precusto' | 'aprovacao';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const quando = (iso: string): string => DATA.format(new Date(iso));
const reais = (v: number | null): string => (v === null ? '—' : `R$ ${numeroComVirgula(centavos(v), 2)}`);
const pct = (v: number): string => `${numeroComVirgula(v, 1)}%`;

/** Troca um item da lista pelo id (ou o tira, com `null`), e move um para cima/baixo. */
function trocar<T extends { readonly id: string }>(lista: readonly T[], id: string, novo: T | null): T[] {
  return novo === null ? lista.filter((x) => x.id !== id) : lista.map((x) => (x.id === id ? novo : x));
}
function mover<T extends { readonly id: string }>(lista: readonly T[], id: string, direcao: -1 | 1): T[] {
  const i = lista.findIndex((x) => x.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return [...lista];
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j]!, nova[i]!];
  return nova;
}

/**
 * A ficha técnica do modelo (ADR 0105) e o pré-custo dele (ADR 0106). Tudo o que muda é guardado no projeto sozinho
 * (meio segundo depois da última mudança, e ao fechar). A ficha aprovada só muda abrindo nova versão.
 */
export function PainelDaFichaTecnica(props: {
  readonly ficha: FichaTecnica;
  readonly pecas: readonly Molde[];
  readonly encaixe: EncaixeParaConsumo | null;
  readonly biblioteca: BibliotecaDeMateriais;
  readonly parteInicial?: ParteDaFicha;
  readonly responsavelSugerido: string;
  readonly onGuardar: (ficha: FichaTecnica) => void;
  readonly onExportarPdf: (ficha: FichaTecnica, preCusto: PreCusto) => void;
  readonly onAbrirMateriais: () => void;
  readonly agoraIso: () => string;
  readonly novoId: () => string;
  readonly onFechar: () => void;
}): React.JSX.Element {
  const [ficha, setFicha] = useState(props.ficha);
  const [guardadaEm, setGuardadaEm] = useState<string | null>(null);
  const guardadaRef = useRef(props.ficha);
  const [parte, setParte] = useState<ParteDaFicha>(props.parteInicial ?? 'descricao');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const editavel = fichaEditavel(ficha);
  const preCusto = calcularPreCusto(ficha, props.biblioteca, props.encaixe);

  // Guarda sozinho, meio segundo depois da última mudança.
  const { onGuardar, agoraIso } = props;
  useEffect(() => {
    if (ficha === guardadaRef.current) return;
    const t = setTimeout(() => {
      guardadaRef.current = ficha;
      onGuardar(ficha);
      setGuardadaEm(new Date(agoraIso()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 500);
    return () => clearTimeout(t);
  }, [ficha, onGuardar, agoraIso]);

  const fechar = (): void => {
    if (ficha !== guardadaRef.current) props.onGuardar(ficha);
    props.onFechar();
  };

  /** Muda a ficha (o motivo de uma recusa aparece na janela). */
  const editar = (fazer: (f: FichaTecnica) => FichaTecnica): void => {
    try {
      setFicha(fazer(ficha));
      setMensagem(null);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
    }
  };
  const campo = (mudanca: Partial<FichaTecnica>): void => editar((f) => mudarFicha(f, mudanca, props.agoraIso()));

  const PARTES: ReadonlyArray<readonly [ParteDaFicha, string]> = [
    ['descricao', 'Descrição'],
    ['medidas', `Medidas (${ficha.medidas.length})`],
    ['materiais', `Materiais (${ficha.materiais.length})`],
    ['operacoes', `Operações (${ficha.operacoes.length})`],
    ['instrucoes', 'Instruções'],
    ['precusto', 'Pré-custo'],
    ['aprovacao', 'Aprovação'],
  ];

  return (
    <Sobreposicao titulo="Ficha técnica" onFechar={fechar}>
      <div className="painel-da-ficha-tecnica">
        <div className="cabecalho-da-ficha">
          <strong>
            {ficha.referencia || 'Sem referência'} — {ficha.nomeDoModelo || 'sem nome'}
          </strong>
          <span className={`situacao-da-execucao situacao-ficha-${ficha.situacao}`}>
            {ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao]} · versão {ficha.versao}
          </span>
          <span className="nota-do-formulario">{guardadaEm ? `Guardada às ${guardadaEm}` : 'Guardada no projeto a cada mudança'}</span>
          <span className="acoes-da-fila">
            <button type="button" onClick={() => props.onExportarPdf(ficha, preCusto)}>
              Exportar PDF
            </button>
          </span>
        </div>
        <div className="partes-da-sala-de-corte" role="tablist" aria-label="Partes da ficha técnica">
          {PARTES.map(([id, rotulo]) => (
            <button key={id} type="button" role="tab" aria-selected={parte === id} className={parte === id ? 'item-selecionado' : undefined} onClick={() => setParte(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {!editavel && parte !== 'aprovacao' && parte !== 'precusto' && (
          <p className="faixa-da-ficha-fechada">
            A ficha está {ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao].toLowerCase()} (versão {ficha.versao}): para mudar, abra uma nova versão na aba Aprovação.
          </p>
        )}
        {mensagem && (
          <p className="nota-do-formulario" role="alert">
            {mensagem}
          </p>
        )}

        {parte === 'descricao' && <ParteDescricao ficha={ficha} pecas={props.pecas} editavel={editavel} campo={campo} />}
        {parte === 'medidas' && <ParteMedidas ficha={ficha} editavel={editavel} campo={campo} novoId={props.novoId} setMensagem={setMensagem} />}
        {parte === 'materiais' && (
          <ParteMateriais ficha={ficha} editavel={editavel} campo={campo} biblioteca={props.biblioteca} encaixe={props.encaixe} preCusto={preCusto} novoId={props.novoId} onAbrirMateriais={props.onAbrirMateriais} />
        )}
        {parte === 'operacoes' && <ParteOperacoes ficha={ficha} editavel={editavel} campo={campo} novoId={props.novoId} preCusto={preCusto} />}
        {parte === 'instrucoes' && <ParteInstrucoes instrucoes={ficha.instrucoes} editavel={editavel} onMudar={(instrucoes) => campo({ instrucoes })} />}
        {parte === 'precusto' && (
          <PartePreCusto
            ficha={ficha}
            preCusto={preCusto}
            editavel={editavel}
            onPadroes={(padroes) => editar((f) => definirPadroesDeCustoDaFicha(f, padroes, props.agoraIso()))}
            onAbrirMateriais={props.onAbrirMateriais}
          />
        )}
        {parte === 'aprovacao' && (
          <ParteAprovacao ficha={ficha} preCusto={preCusto} responsavelSugerido={props.responsavelSugerido} agoraIso={props.agoraIso} onMudar={(f) => setFicha(f)} setMensagem={setMensagem} />
        )}
      </div>
    </Sobreposicao>
  );
}

// ---- Descrição

function ParteDescricao(props: { readonly ficha: FichaTecnica; readonly pecas: readonly Molde[]; readonly editavel: boolean; readonly campo: (m: Partial<FichaTecnica>) => void }): React.JSX.Element {
  const { ficha } = props;
  const [tamanhosTexto, setTamanhosTexto] = useState(ficha.tamanhos.join(', '));
  const doMolde = tamanhosDasPecas(props.pecas);
  const texto = (rotulo: string, chave: 'referencia' | 'nomeDoModelo' | 'colecao' | 'marca' | 'estilista' | 'modelista') => (
    <label>
      {rotulo}
      <input value={ficha[chave]} disabled={!props.editavel} onChange={(e) => props.campo({ [chave]: e.target.value })} />
    </label>
  );
  return (
    <section aria-label="Descrição">
      <form className="formulario-de-sobreposicao formulario-do-material" onSubmit={(e) => e.preventDefault()}>
        {texto('Referência', 'referencia')}
        {texto('Nome do modelo', 'nomeDoModelo')}
        {texto('Coleção', 'colecao')}
        {texto('Marca', 'marca')}
        {texto('Estilista', 'estilista')}
        {texto('Modelista', 'modelista')}
        <label>
          Descrição do produto
          <textarea rows={3} value={ficha.descricao} disabled={!props.editavel} onChange={(e) => props.campo({ descricao: e.target.value })} />
        </label>
        <label>
          Tamanhos (separados por vírgula)
          <input
            value={tamanhosTexto}
            disabled={!props.editavel}
            onChange={(e) => setTamanhosTexto(e.target.value)}
            onBlur={() => {
              const lidos = lerTamanhos(tamanhosTexto);
              setTamanhosTexto(lidos.join(', '));
              if (lidos.join('|') !== ficha.tamanhos.join('|')) props.campo({ tamanhos: lidos });
            }}
          />
        </label>
        {doMolde.length > 0 && doMolde.join('|') !== ficha.tamanhos.join('|') && (
          <p className="nota-do-formulario">
            O molde tem os tamanhos {doMolde.join(', ')}.{' '}
            <button
              type="button"
              disabled={!props.editavel}
              onClick={() => {
                setTamanhosTexto(doMolde.join(', '));
                props.campo({ tamanhos: doMolde });
              }}
            >
              Usar os tamanhos do molde
            </button>
          </p>
        )}
      </form>
    </section>
  );
}

// ---- Medidas

function ParteMedidas(props: {
  readonly ficha: FichaTecnica;
  readonly editavel: boolean;
  readonly campo: (m: Partial<FichaTecnica>) => void;
  readonly novoId: () => string;
  readonly setMensagem: (m: string | null) => void;
}): React.JSX.Element {
  const { ficha } = props;
  const [colando, setColando] = useState<string | null>(null);
  const mudarPonto = (p: PontoDeMedida): void => props.campo({ medidas: trocar(ficha.medidas, p.id, p) });
  return (
    <section aria-label="Medidas">
      {ficha.tamanhos.length === 0 && <p className="nota-do-formulario">A ficha ainda não tem tamanhos: diga quais na aba Descrição.</p>}
      {ficha.medidas.length === 0 ? (
        <p className="nota-do-formulario">Nenhum ponto de medida. Adicione um por um, ou cole a tabela de uma planilha.</p>
      ) : (
        <table className="tabela-de-relatorio tabela-da-ficha">
          <caption>Tabela de medidas (cm)</caption>
          <thead>
            <tr>
              <th scope="col">Ponto de medida</th>
              <th scope="col">Como medir</th>
              {ficha.tamanhos.map((t) => (
                <th key={t} scope="col" className="coluna-numerica">
                  {t}
                </th>
              ))}
              <th scope="col" className="coluna-numerica">
                Tol. ±
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {ficha.medidas.map((p) => (
              <tr key={p.id}>
                <td>
                  <input aria-label={`Nome do ponto ${p.nome}`} value={p.nome} disabled={!props.editavel} onChange={(e) => mudarPonto({ ...p, nome: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Como medir ${p.nome}`} value={p.comoMedir} disabled={!props.editavel} onChange={(e) => mudarPonto({ ...p, comoMedir: e.target.value })} />
                </td>
                {ficha.tamanhos.map((t) => (
                  <td key={t}>
                    <CampoDeNumero
                      className="campo-curto"
                      rotulo={`${p.nome} no ${t}`}
                      valor={p.valoresCm[t] ?? null}
                      vazioPermitido
                      desabilitado={!props.editavel}
                      onMudar={(v) => {
                        const valoresCm: Record<string, number> = { ...p.valoresCm };
                        if (v === null) delete valoresCm[t];
                        else valoresCm[t] = v;
                        mudarPonto({ ...p, valoresCm });
                      }}
                    />
                  </td>
                ))}
                <td>
                  <CampoDeNumero className="campo-curto" rotulo={`Tolerância de ${p.nome}`} valor={p.toleranciaCm} desabilitado={!props.editavel} onMudar={(v) => mudarPonto({ ...p, toleranciaCm: v ?? 0 })} />
                </td>
                <td>
                  <span className="acoes-do-trabalho">
                    <button type="button" aria-label={`Subir ${p.nome}`} disabled={!props.editavel} onClick={() => props.campo({ medidas: mover(ficha.medidas, p.id, -1) })}>
                      ↑
                    </button>
                    <button type="button" aria-label={`Descer ${p.nome}`} disabled={!props.editavel} onClick={() => props.campo({ medidas: mover(ficha.medidas, p.id, 1) })}>
                      ↓
                    </button>
                    <button type="button" aria-label={`Remover ${p.nome}`} disabled={!props.editavel} onClick={() => props.campo({ medidas: trocar(ficha.medidas, p.id, null) })}>
                      Remover
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="acoes-em-linha">
        <button type="button" disabled={!props.editavel} onClick={() => props.campo({ medidas: [...ficha.medidas, { id: props.novoId(), nome: 'Novo ponto', comoMedir: '', toleranciaCm: 0.5, valoresCm: {} }] })}>
          Adicionar ponto de medida
        </button>
        <button type="button" disabled={!props.editavel} onClick={() => setColando(colando === null ? '' : null)}>
          {colando === null ? 'Colar da planilha…' : 'Fechar a colagem'}
        </button>
      </div>
      {colando !== null && (
        <div className="colagem-de-medidas">
          <label>
            Cole a tabela (a primeira linha com os tamanhos e, se tiver, “Tol.”; uma linha por ponto)
            <textarea rows={6} value={colando} onChange={(e) => setColando(e.target.value)} placeholder={'Ponto\tP\tM\tG\tTol.\nBusto\t48\t52\t56\t1'} />
          </label>
          <button
            type="button"
            className="botao-primario"
            onClick={() => {
              const lidas = lerMedidasColadas(colando, props.novoId);
              if (lidas.pontos.length === 0) {
                props.setMensagem(lidas.erros.join(' '));
                return;
              }
              const tamanhos = [...ficha.tamanhos, ...lidas.tamanhos.filter((t) => !ficha.tamanhos.includes(t))];
              props.campo({ medidas: [...ficha.medidas, ...lidas.pontos], tamanhos });
              props.setMensagem(`${lidas.pontos.length} ponto(s) de medida colado(s).${lidas.erros.length > 0 ? ` Ficou de fora: ${lidas.erros.join(' ')}` : ''}`);
              setColando(null);
            }}
          >
            Colar
          </button>
        </div>
      )}
    </section>
  );
}

// ---- Materiais

const DIGITADO = '__digitado__';

function ParteMateriais(props: {
  readonly ficha: FichaTecnica;
  readonly editavel: boolean;
  readonly campo: (m: Partial<FichaTecnica>) => void;
  readonly biblioteca: BibliotecaDeMateriais;
  readonly encaixe: EncaixeParaConsumo | null;
  readonly preCusto: PreCusto;
  readonly novoId: () => string;
  readonly onAbrirMateriais: () => void;
}): React.JSX.Element {
  const { ficha, biblioteca } = props;
  const materiais = materiaisNaOrdem(biblioteca.materiais);
  const mudarItem = (item: ItemDeMaterial): void => props.campo({ materiais: trocar(ficha.materiais, item.id, item) });
  const adicionar = (): void => {
    const primeiro = materiais[0];
    const item: ItemDeMaterial = primeiro
      ? { id: props.novoId(), materialId: primeiro.id, descricao: primeiro.descricao, aplicacao: '', unidade: primeiro.unidade, consumo: primeiro.categoria === 'tecido' ? { tipo: 'pelo-encaixe', roupasNoEncaixe: null, perdaPercentual: 0 } : { tipo: 'informado', quantidade: 1 } }
      : { id: props.novoId(), materialId: null, descricao: 'Novo material', aplicacao: '', unidade: 'un', consumo: { tipo: 'informado', quantidade: 1 }, precoInformado: null };
    props.campo({ materiais: [...ficha.materiais, item] });
  };
  return (
    <section aria-label="Materiais">
      {biblioteca.materiais.length === 0 && (
        <p className="nota-do-formulario">
          A biblioteca de materiais está vazia: os itens podem ser digitados aqui, ou{' '}
          <button type="button" onClick={props.onAbrirMateriais}>
            cadastre os materiais na biblioteca
          </button>{' '}
          (com o preço, que passa a valer em todas as fichas).
        </p>
      )}
      {props.encaixe && (
        <p className="nota-do-formulario">
          Encaixe da mesa: {numeroComVirgula(props.encaixe.comprimentoMm / 1000, 3)} m, {props.encaixe.roupasContadas} roupa(s) contada(s) pelas peças. O consumo “pelo encaixe” divide
          o comprimento pelas roupas e soma a perda.
        </p>
      )}
      {ficha.materiais.length > 0 && (
        <table className="tabela-de-relatorio tabela-da-ficha">
          <caption>Materiais e aviamentos (por peça pronta)</caption>
          <thead>
            <tr>
              <th scope="col">Material</th>
              <th scope="col">Aplicação</th>
              <th scope="col">Consumo</th>
              <th scope="col" className="coluna-numerica">
                Por peça
              </th>
              <th scope="col" className="coluna-numerica">
                Preço
              </th>
              <th scope="col" className="coluna-numerica">
                Valor
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {ficha.materiais.map((item) => {
              const material = item.materialId ? biblioteca.materiais.find((m) => m.id === item.materialId) : undefined;
              const consumo = consumoDoItem(item, material, props.encaixe);
              const linha = props.preCusto.linhas.find((l) => l.itemId === item.id);
              return (
                <tr key={item.id}>
                  <td>
                    <select
                      aria-label={`Material de ${item.descricao}`}
                      value={item.materialId ?? DIGITADO}
                      disabled={!props.editavel}
                      onChange={(e) => {
                        if (e.target.value === DIGITADO) {
                          mudarItem({ ...item, materialId: null, precoInformado: material?.precoPorUnidade ?? null });
                          return;
                        }
                        const m = biblioteca.materiais.find((x) => x.id === e.target.value)!;
                        mudarItem({ id: item.id, materialId: m.id, descricao: m.descricao, aplicacao: item.aplicacao, unidade: m.unidade, consumo: item.consumo });
                      }}
                    >
                      {item.materialId !== null && !material && <option value={item.materialId}>{item.descricao} (saiu da biblioteca)</option>}
                      {(Object.keys(ROTULO_DA_CATEGORIA) as Array<keyof typeof ROTULO_DA_CATEGORIA>).map((c) => {
                        const daCategoria = materiais.filter((m) => m.categoria === c);
                        return daCategoria.length === 0 ? null : (
                          <optgroup key={c} label={ROTULO_DA_CATEGORIA[c]}>
                            {daCategoria.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.codigo ? `${m.codigo} — ` : ''}
                                {m.descricao}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      <option value={DIGITADO}>Digitado (fora da biblioteca)</option>
                    </select>
                    {item.materialId === null && (
                      <span className="item-digitado">
                        <input aria-label="Descrição do item digitado" value={item.descricao} disabled={!props.editavel} onChange={(e) => mudarItem({ ...item, descricao: e.target.value })} />
                        <select aria-label={`Unidade de ${item.descricao}`} value={item.unidade} disabled={!props.editavel} onChange={(e) => mudarItem({ ...item, unidade: e.target.value as UnidadeDoMaterial })}>
                          {(Object.keys(ROTULO_DA_UNIDADE) as UnidadeDoMaterial[]).map((u) => (
                            <option key={u} value={u}>
                              {ROTULO_DA_UNIDADE[u]}
                            </option>
                          ))}
                        </select>
                      </span>
                    )}
                  </td>
                  <td>
                    <input aria-label={`Aplicação de ${item.descricao}`} value={item.aplicacao} placeholder="Corpo, gola…" disabled={!props.editavel} onChange={(e) => mudarItem({ ...item, aplicacao: e.target.value })} />
                  </td>
                  <td>
                    <select
                      aria-label={`Consumo de ${item.descricao}`}
                      value={item.consumo.tipo}
                      disabled={!props.editavel}
                      onChange={(e) =>
                        mudarItem({ ...item, consumo: e.target.value === 'informado' ? { tipo: 'informado', quantidade: consumo.quantidade ?? 1 } : { tipo: 'pelo-encaixe', roupasNoEncaixe: null, perdaPercentual: 0 } })
                      }
                    >
                      <option value="informado">Informado</option>
                      <option value="pelo-encaixe">Pelo encaixe da mesa</option>
                    </select>
                    {item.consumo.tipo === 'informado' ? (
                      <CampoDeNumero
                        className="campo-curto"
                        rotulo={`Quantidade de ${item.descricao}`}
                        valor={item.consumo.quantidade}
                        desabilitado={!props.editavel}
                        onMudar={(v) => mudarItem({ ...item, consumo: { tipo: 'informado', quantidade: v ?? 0 } })}
                      />
                    ) : (
                      <span className="consumo-pelo-encaixe">
                        <CampoDeNumero
                          className="campo-curto"
                          rotulo={`Roupas no encaixe para ${item.descricao}`}
                          valor={item.consumo.roupasNoEncaixe}
                          vazioPermitido
                          placeholder={props.encaixe ? `${props.encaixe.roupasContadas}` : 'roupas'}
                          desabilitado={!props.editavel}
                          onMudar={(v) => item.consumo.tipo === 'pelo-encaixe' && mudarItem({ ...item, consumo: { ...item.consumo, roupasNoEncaixe: v === null ? null : Math.max(1, Math.round(v)) } })}
                        />
                        roupas, perda
                        <CampoDeNumero
                          className="campo-curto"
                          rotulo={`Perda de ${item.descricao}`}
                          valor={item.consumo.perdaPercentual}
                          desabilitado={!props.editavel}
                          onMudar={(v) => item.consumo.tipo === 'pelo-encaixe' && mudarItem({ ...item, consumo: { ...item.consumo, perdaPercentual: v ?? 0 } })}
                        />
                        %
                      </span>
                    )}
                  </td>
                  <td className="coluna-numerica">
                    {consumoEscrito(consumo.quantidade, item.unidade)}
                    {consumo.erro && <small className="texto-de-erro"> {consumo.erro}</small>}
                    {!consumo.erro && item.consumo.tipo === 'pelo-encaixe' && <small> {consumo.explicacao}</small>}
                  </td>
                  <td className="coluna-numerica">
                    {item.materialId === null ? (
                      <CampoDeNumero
                        className="campo-curto"
                        rotulo={`Preço de ${item.descricao}`}
                        valor={item.precoInformado ?? null}
                        vazioPermitido
                        placeholder="R$"
                        desabilitado={!props.editavel}
                        onMudar={(v) => mudarItem({ ...item, precoInformado: v })}
                      />
                    ) : material ? (
                      precoEscrito(material)
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="coluna-numerica">{reais(linha?.valor ?? null)}</td>
                  <td>
                    <span className="acoes-do-trabalho">
                      <button type="button" aria-label={`Subir ${item.descricao}`} disabled={!props.editavel} onClick={() => props.campo({ materiais: mover(ficha.materiais, item.id, -1) })}>
                        ↑
                      </button>
                      <button type="button" aria-label={`Remover ${item.descricao}`} disabled={!props.editavel} onClick={() => props.campo({ materiais: trocar(ficha.materiais, item.id, null) })}>
                        Remover
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={5}>
                Materiais por peça
              </th>
              <td className="coluna-numerica">
                <strong>{reais(props.preCusto.materiais)}</strong>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
      <div className="acoes-em-linha">
        <button type="button" disabled={!props.editavel} onClick={adicionar}>
          Adicionar material
        </button>
      </div>
    </section>
  );
}

// ---- Operações

function ParteOperacoes(props: { readonly ficha: FichaTecnica; readonly editavel: boolean; readonly campo: (m: Partial<FichaTecnica>) => void; readonly novoId: () => string; readonly preCusto: PreCusto }): React.JSX.Element {
  const { ficha } = props;
  const mudar = (o: Operacao): void => props.campo({ operacoes: trocar(ficha.operacoes, o.id, o) });
  const maquinas = [...new Set(ficha.operacoes.map((o) => o.maquina.trim()).filter((m) => m !== ''))];
  const total = tempoTotalDasOperacoes(ficha.operacoes);
  return (
    <section aria-label="Operações">
      {ficha.operacoes.length === 0 ? (
        <p className="nota-do-formulario">Nenhuma operação. A sequência operacional dá o tempo de costura, e o tempo × o custo do minuto dá a mão de obra no pré-custo.</p>
      ) : (
        <table className="tabela-de-relatorio tabela-da-ficha">
          <caption>Sequência operacional</caption>
          <thead>
            <tr>
              <th scope="col" className="coluna-numerica">
                #
              </th>
              <th scope="col">Operação</th>
              <th scope="col">Máquina</th>
              <th scope="col" className="coluna-numerica">
                Tempo (min)
              </th>
              <th scope="col">Observação</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {ficha.operacoes.map((o, i) => (
              <tr key={o.id}>
                <td className="coluna-numerica">{i + 1}</td>
                <td>
                  <input aria-label={`Operação ${i + 1}`} value={o.descricao} disabled={!props.editavel} onChange={(e) => mudar({ ...o, descricao: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Máquina da operação ${i + 1}`} list="maquinas-da-ficha" value={o.maquina} disabled={!props.editavel} onChange={(e) => mudar({ ...o, maquina: e.target.value })} />
                </td>
                <td>
                  <CampoDeNumero className="campo-curto" rotulo={`Tempo da operação ${i + 1}`} valor={o.tempoMin} desabilitado={!props.editavel} onMudar={(v) => mudar({ ...o, tempoMin: v ?? 0 })} />
                </td>
                <td>
                  <input aria-label={`Observação da operação ${i + 1}`} value={o.observacao} disabled={!props.editavel} onChange={(e) => mudar({ ...o, observacao: e.target.value })} />
                </td>
                <td>
                  <span className="acoes-do-trabalho">
                    <button type="button" aria-label={`Subir a operação ${i + 1}`} disabled={!props.editavel} onClick={() => props.campo({ operacoes: mover(ficha.operacoes, o.id, -1) })}>
                      ↑
                    </button>
                    <button type="button" aria-label={`Descer a operação ${i + 1}`} disabled={!props.editavel} onClick={() => props.campo({ operacoes: mover(ficha.operacoes, o.id, 1) })}>
                      ↓
                    </button>
                    <button type="button" aria-label={`Remover a operação ${i + 1}`} disabled={!props.editavel} onClick={() => props.campo({ operacoes: trocar(ficha.operacoes, o.id, null) })}>
                      Remover
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Tempo total por peça
              </th>
              <td className="coluna-numerica">
                <strong>{numeroComVirgula(total, 2)} min</strong>
              </td>
              <td colSpan={2}>{props.preCusto.padroes.custoDoMinuto !== null ? `mão de obra: ${reais(props.preCusto.maoDeObra)}` : 'sem o custo do minuto, a mão de obra não sai'}</td>
            </tr>
          </tfoot>
        </table>
      )}
      <datalist id="maquinas-da-ficha">
        {maquinas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="acoes-em-linha">
        <button type="button" disabled={!props.editavel} onClick={() => props.campo({ operacoes: [...ficha.operacoes, { id: props.novoId(), descricao: '', maquina: ficha.operacoes.at(-1)?.maquina ?? '', tempoMin: 0, observacao: '' }] })}>
          Adicionar operação
        </button>
      </div>
    </section>
  );
}

// ---- Instruções

function ParteInstrucoes(props: { readonly instrucoes: InstrucoesDaFicha; readonly editavel: boolean; readonly onMudar: (i: InstrucoesDaFicha) => void }): React.JSX.Element {
  const area = (rotulo: string, chave: keyof InstrucoesDaFicha) => (
    <label>
      {rotulo}
      <textarea rows={3} value={props.instrucoes[chave]} disabled={!props.editavel} onChange={(e) => props.onMudar({ ...props.instrucoes, [chave]: e.target.value })} />
    </label>
  );
  return (
    <section aria-label="Instruções">
      <form className="formulario-de-sobreposicao" onSubmit={(e) => e.preventDefault()}>
        {area('Costura (pontos, linhas, agulhas, pespontos)', 'costura')}
        {area('Acabamento (caseado, travetes, passadoria)', 'acabamento')}
        {area('Conservação (lavagem; a etiqueta)', 'conservacao')}
        {area('Embalagem (dobra, tag, saco)', 'embalagem')}
      </form>
    </section>
  );
}

// ---- Pré-custo

function PartePreCusto(props: {
  readonly ficha: FichaTecnica;
  readonly preCusto: PreCusto;
  readonly editavel: boolean;
  readonly onPadroes: (padroes: PadroesDeCusto | null) => void;
  readonly onAbrirMateriais: () => void;
}): React.JSX.Element {
  const c = props.preCusto;
  const [tipoDaMeta, setTipoDaMeta] = useState<MetaDeCusto['tipo']>('custo');
  const [valorDaMeta, setValorDaMeta] = useState<number | null>(null);
  const simulacao = valorDaMeta === null ? null : simularMeta(c, { tipo: tipoDaMeta, valor: valorDaMeta });
  const p = c.padroes;
  const padrao = (rotulo: string, chave: keyof PadroesDeCusto, vazio = false) => (
    <label>
      {rotulo}
      <CampoDeNumero
        rotulo={rotulo}
        valor={p[chave]}
        vazioPermitido={vazio}
        desabilitado={!props.editavel || c.padroesDaEmpresa}
        onMudar={(v) => props.onPadroes({ ...p, [chave]: chave === 'custoDoMinuto' ? v : (v ?? 0) })}
      />
    </label>
  );
  return (
    <section aria-label="Pré-custo">
      {!c.completo && (
        <div className="faixa-do-custo-parcial" role="status">
          <strong>Custo parcial — falta:</strong>
          <ul>
            {c.faltando.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <table className="tabela-de-relatorio tabela-da-ficha">
        <caption>Custo por peça pronta</caption>
        <thead>
          <tr>
            <th scope="col">Grupo</th>
            <th scope="col">Item</th>
            <th scope="col" className="coluna-numerica">
              Consumo
            </th>
            <th scope="col" className="coluna-numerica">
              Preço
            </th>
            <th scope="col" className="coluna-numerica">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          {c.linhas.map((l, i) => (
            <tr key={l.itemId ?? `linha-${i}`}>
              <td>{ROTULO_DO_GRUPO_DA_LINHA[l.grupo]}</td>
              <td>
                {l.descricao}
                {l.aplicacao ? <small> · {l.aplicacao}</small> : null}
              </td>
              <td className="coluna-numerica">{l.consumo}</td>
              <td className="coluna-numerica">{l.preco}</td>
              <td className="coluna-numerica">{reais(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="indicadores-da-sala-de-corte resumo-do-custo">
        {totaisPorGrupo(c).map((g) => (
          <div key={g.grupo}>
            <dt>{ROTULO_DO_GRUPO_DA_LINHA[g.grupo]}</dt>
            <dd>{reais(g.valor)}</dd>
          </div>
        ))}
        <div>
          <dt>Custo direto</dt>
          <dd>{reais(c.custoDireto)}</dd>
        </div>
        <div>
          <dt>Indiretos ({pct(p.indiretosPercentual)})</dt>
          <dd>{reais(c.indiretos)}</dd>
        </div>
        <div className="destaque-do-custo">
          <dt>Custo total{c.completo ? '' : ' (parcial)'}</dt>
          <dd>{reais(c.custoTotal)}</dd>
        </div>
        <div className="destaque-do-custo">
          <dt>Preço sugerido{c.markup !== null ? ` (markup ${numeroComVirgula(c.markup, 2)})` : ''}</dt>
          <dd>{reais(c.precoSugerido)}</dd>
        </div>
        <div>
          <dt>Do preço: impostos / comissão / margem</dt>
          <dd>
            {reais(c.impostos)} / {reais(c.comissao)} / {reais(c.margem)}
          </dd>
        </div>
        {c.custoAprovado !== null && (
          <div>
            <dt>Custo aprovado</dt>
            <dd>
              {reais(c.custoAprovado)}
              {c.custoAprovado > 0 ? ` (agora ${c.custoTotal >= c.custoAprovado ? '+' : '−'}${pct(Math.abs(((c.custoTotal - c.custoAprovado) / c.custoAprovado) * 100))})` : ''}
            </dd>
          </div>
        )}
      </dl>

      <h4>Padrões de custo</h4>
      <div className="acoes-em-linha">
        <label className="opcao-em-linha">
          <input type="radio" name="padroes-da-ficha" checked={c.padroesDaEmpresa} disabled={!props.editavel} onChange={() => props.onPadroes(null)} />
          Os da empresa
        </label>
        <label className="opcao-em-linha">
          <input type="radio" name="padroes-da-ficha" checked={!c.padroesDaEmpresa} disabled={!props.editavel} onChange={() => props.onPadroes(p)} />
          Próprios desta ficha
        </label>
        {c.padroesDaEmpresa && (
          <button type="button" onClick={props.onAbrirMateriais}>
            Mudar os da empresa…
          </button>
        )}
      </div>
      <form className="formulario-de-sobreposicao formulario-do-material" onSubmit={(e) => e.preventDefault()}>
        {padrao('Custo do minuto (R$)', 'custoDoMinuto', true)}
        {padrao('Indiretos (%)', 'indiretosPercentual')}
        {padrao('Impostos (% do preço)', 'impostosPercentual')}
        {padrao('Comissão (% do preço)', 'comissaoPercentual')}
        {padrao('Margem (% do preço)', 'margemPercentual')}
      </form>

      <h4>Simulador de meta</h4>
      <div className="acoes-em-linha">
        <label>
          Meta de
          <select value={tipoDaMeta} onChange={(e) => setTipoDaMeta(e.target.value as MetaDeCusto['tipo'])}>
            <option value="custo">custo por peça</option>
            <option value="preco">preço de venda</option>
          </select>
        </label>
        <label>
          Valor (R$)
          <CampoDeNumero rotulo="Valor da meta (R$)" valor={valorDaMeta} vazioPermitido onMudar={setValorDaMeta} />
        </label>
      </div>
      {simulacao &&
        ('erro' in simulacao ? (
          <p className="mensagem-de-erro">{simulacao.erro}</p>
        ) : (
          <div className={`resultado-da-meta ${simulacao.dentro ? 'meta-dentro' : 'meta-fora'}`} aria-label="Resultado da meta">
            <p>
              {simulacao.dentro
                ? `Dentro da meta (custo-alvo ${reais(simulacao.custoAlvo)}).`
                : `Acima da meta em ${reais(simulacao.diferenca)} (custo-alvo ${reais(simulacao.custoAlvo)}). Cada caminho abaixo, sozinho, chega lá:`}
            </p>
            <ul>
              {simulacao.caminhos.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

// ---- Aprovação

function ParteAprovacao(props: {
  readonly ficha: FichaTecnica;
  readonly preCusto: PreCusto;
  readonly responsavelSugerido: string;
  readonly agoraIso: () => string;
  readonly onMudar: (f: FichaTecnica) => void;
  readonly setMensagem: (m: string | null) => void;
}): React.JSX.Element {
  const { ficha } = props;
  const [responsavel, setResponsavel] = useState(props.responsavelSugerido);
  const [comentario, setComentario] = useState('');
  const fazer = (acao: () => FichaTecnica, sucesso: string): void => {
    try {
      props.onMudar(acao());
      setComentario('');
      props.setMensagem(sucesso);
    } catch (e) {
      props.setMensagem(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section aria-label="Aprovação">
      <form className="formulario-de-sobreposicao formulario-do-material" onSubmit={(e) => e.preventDefault()}>
        <label>
          Responsável
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </label>
        <label>
          Comentário
          <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </label>
      </form>
      <div className="acoes-em-linha">
        {fichaEditavel(ficha) && (
          <button type="button" className="botao-primario" onClick={() => fazer(() => enviarParaAprovacao(ficha, responsavel, comentario, props.agoraIso()), `Versão ${ficha.versao} enviada para aprovação.`)}>
            Enviar para aprovação
          </button>
        )}
        {ficha.situacao === 'em-aprovacao' && (
          <>
            <button
              type="button"
              className="botao-primario"
              onClick={() =>
                fazer(
                  () => aprovarFicha(ficha, responsavel, comentario, props.agoraIso(), props.preCusto.completo ? centavos(props.preCusto.custoTotal) : null),
                  props.preCusto.completo
                    ? `Versão ${ficha.versao} aprovada, com o custo de ${reais(props.preCusto.custoTotal)}.`
                    : `Versão ${ficha.versao} aprovada. O pré-custo estava parcial: a aprovação ficou sem o custo.`,
                )
              }
            >
              Aprovar
            </button>
            <button type="button" onClick={() => fazer(() => pedirAlteracao(ficha, responsavel, comentario, props.agoraIso()), `Alteração pedida na versão ${ficha.versao}.`)}>
              Pedir alteração
            </button>
          </>
        )}
        {(ficha.situacao === 'aprovada' || ficha.situacao === 'em-aprovacao') && (
          <button type="button" onClick={() => fazer(() => abrirNovaVersao(ficha, responsavel, comentario, props.agoraIso()), `Versão ${ficha.versao + 1} aberta, em rascunho.`)}>
            Abrir nova versão
          </button>
        )}
      </div>
      {ficha.decisoes.length === 0 ? (
        <p className="nota-do-formulario">Nada decidido ainda: a ficha é um rascunho. Quando estiver pronta, envie para aprovação.</p>
      ) : (
        <table className="tabela-de-relatorio tabela-da-ficha">
          <caption>Histórico da aprovação</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col" className="coluna-numerica">
                Versão
              </th>
              <th scope="col">O que foi feito</th>
              <th scope="col">Responsável</th>
              <th scope="col">Comentário</th>
              <th scope="col" className="coluna-numerica">
                Custo
              </th>
            </tr>
          </thead>
          <tbody>
            {[...ficha.decisoes].reverse().map((d) => (
              <tr key={`${d.dataIso}-${d.acao}-${d.versao}`}>
                <td>{quando(d.dataIso)}</td>
                <td className="coluna-numerica">{d.versao}</td>
                <td>{ROTULO_DA_ACAO_DA_FICHA[d.acao]}</td>
                <td>{d.responsavel}</td>
                <td>{d.comentario || '—'}</td>
                <td className="coluna-numerica">{d.custoNaHora !== undefined ? reais(d.custoNaHora) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
