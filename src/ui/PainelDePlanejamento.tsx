import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { DesenhoDoRisco } from './DesenhoDoRisco';
import { ResumoDoPlanejamento } from './ResumoDoPlanejamento';
import { PropostaDoPlano } from './PropostaDoPlano';
import {
  configuracaoDoFormulario,
  configuracaoNoFormulario,
  lerNumero,
  MALHA_VAZIA,
  malhaDoFormulario,
  malhaDoTecido,
  malhaNoFormulario,
  noCampo,
  ORDEM_VAZIA,
  ordemDoFormulario,
  ordemNoFormulario,
  ROLO_VAZIO,
  roloDoFormulario,
  type FormularioDaConfiguracao,
  type FormularioDaMalha,
  type FormularioDaOrdem,
  type FormularioDoRolo,
} from './formularioDoPlanejamento';
import {
  casamentoDaMalha,
  estadoDoRolo,
  grupoDoRolo,
  ROTULO_DO_DEFEITO,
  lerGradeColada,
  removerRolo,
  salvarMalha,
  salvarOrdem,
  salvarRolo,
  type CadastroDeProducao,
  type OrdemDeProducao,
  type RoloDeEstoque,
  type TipoDeDefeito,
} from '../domain/cadastroDeProducao';
import { ERP_NAO_CONFIGURADO, importarOrdensCsv } from '../domain/importacaoDeOrdens';
import { trocarComOErp, type AcessoAPastaDeTroca } from '../domain/trocaComOErp';
import { csvDasEtiquetas, feixesDaOrdem, htmlDasEtiquetas } from '../domain/etiquetasDosFeixes';
import { fatoresDeCompensacao, medidasCompensadas, riscoCompensado, ROTULO_DA_FONTE_DO_ENCOLHIMENTO, type FatoresDeCompensacao, type FonteDoEncolhimento } from '../domain/encolhimento';
import { EstoqueDoPlano } from './EstoqueDoPlano';
import { ExecucaoDoPlano } from './ExecucaoDoPlano';
import { execucaoAtualDoPlano, ROTULO_DA_SITUACAO } from '../domain/execucaoDoCorte';
import { linhaDeCorteDaPeca, rotacoesPermitidas, type Molde } from '../domain/molde';
import { blocosNaMesa } from '../domain/gruposDoEncaixe';
import { modeloDoPlano, quantidadesPorRoupa } from '../domain/modeloDoPlano';
import { revisaoAtualDoMolde, type Projeto } from '../domain/projeto';
import { escreverM, riscoDaMesa } from '../domain/planoDeCorte';
import { ROTULO_DO_TIPO, type TipoDeEnfesto } from '../domain/enfesto';
import { retanguloEnvolvente } from '../core/geometria';
import { ROTULO_DA_UNIDADE_DO_CUSTO, ROTULO_DO_TIPO_DE_TECIDO, type Tecido, type TipoDeTecido, type UnidadeDoCusto } from '../domain/tecido';
import { estimarCustoDoTecido, roupasPorTamanho } from '../domain/custoDoTecido';
import {
  calcularPlanejamento,
  camadasDeUmRisco,
  CRITERIOS,
  DEFINICOES,
  larguraNaMesa,
  type AjustesDoPlanejamento,
  type CamadasDoRisco,
  type ConfiguracaoDoPlanejamento,
  type EntradaDoPlanejamento,
  type RendimentoPrincipal,
  type ResultadoDoPlanejamento,
  type RiscoDoPlanejamento,
} from '../domain/planoDeEnfesto';
import {
  ajustesRegistrados,
  copiaComoRascunho,
  ehPlanoV2,
  montarAlternativas,
  prepararBusca,
  resumoDaBusca,
  riscoGeradoNoPlano,
  ROTULO_DA_ESTRATEGIA,
  type BuscaDosRiscos,
  type EstrategiaDoPlano,
  type PedidoDeRisco,
  type PlanoDeCorteV2,
  type PlanoGuardado,
} from '../domain/planejamento';
import type { Composicao } from '../domain/composicaoDeRiscos';
import type { OpcoesDaBusca, ResultadoDaBusca } from '../domain/buscaDeRiscos';
import { chaveDaGrade, escreverGrade, METODO_DO_RISCO, ROTULO_DO_PONTO_DE_CASAMENTO, type GradeDoRisco, type RiscoGerado } from '../domain/risco';

/** Quem faz os riscos (no programa, um Web Worker; nos testes, a própria função). */
export type BuscarRiscos = (
  pedidos: readonly PedidoDeRisco[],
  opcoes: OpcoesDaBusca,
  aoProgredir: (feitos: number, total: number) => void,
) => { readonly promessa: Promise<ResultadoDaBusca>; readonly cancelar: () => void };

export interface PainelDePlanejamentoProps {
  readonly projeto: Projeto;
  readonly pecas: readonly Molde[];
  readonly tecidoDoProjeto: Tecido | null;
  readonly tipoDoEnfesto: TipoDeEnfesto;
  readonly cadastro: CadastroDeProducao;
  readonly cadastroSomenteLeitura: boolean;
  readonly avisosDoCadastro: readonly string[];
  readonly configuracaoGuardada: ConfiguracaoDoPlanejamento;
  readonly buscarRiscos: BuscarRiscos;
  readonly agoraIso: () => string;
  readonly novoId: (prefixo: string) => string;
  /** Grava o cadastro; devolve a mensagem do que impediu, ou `null`. */
  readonly onMudarCadastro: (novo: CadastroDeProducao) => Promise<string | null>;
  readonly onRegistrarRevisao: (dados: { readonly responsavel: string; readonly descricao: string; readonly impressaoDigital: string }) => string | null;
  readonly onGuardarRascunho: (plano: PlanoDeCorteV2) => string | null;
  /** Um projeto por risco do plano, na biblioteca (ADR 0212). Devolve o que dizer. */
  readonly onCriarArquivosDeEncaixe?: (plano: PlanoDeCorteV2) => Promise<string>;
  readonly onConfirmar: (plano: PlanoDeCorteV2, aplicarAoEnfesto: boolean) => string | null;
  readonly onRemoverRascunho: (id: string) => string | null;
  readonly onGuardarConfiguracao: (configuracao: ConfiguracaoDoPlanejamento) => void;
  /** A pasta de troca com o ERP (ADR 0141); sem ela (fora do programa), a troca não aparece. */
  readonly pastaDoErp?: AcessoAPastaDeTroca | null;
  /** De quanto em quanto a troca sozinha acontece (padrão: 5 minutos). */
  readonly intervaloDaTrocaMs?: number;
  /** Salva um arquivo de texto (as etiquetas dos feixes, ADR 0159); devolve o caminho. */
  readonly onSalvarTexto?: (sugestaoDeNome: string, conteudo: string) => Promise<string | null>;
  /** Os projetos da biblioteca: a troca com o ERP também importa as ordens dos outros moldes (ADR 0154). */
  readonly projetosDaBiblioteca?: readonly Projeto[];
  /** O nome de um projeto da biblioteca, para os cortes que vão ao ERP. */
  readonly nomeDoProjeto?: (projetoId: string) => string;
  /** Fecha a janela e mostra a peça (para corrigir o que falta nela). */
  readonly onAbrirPeca: (pecaId: string) => void;
  readonly onFechar: () => void;
}

type Etapa = 'molde' | 'ordem' | 'malha' | 'risco' | 'alternativas' | 'revisar' | 'planos';
const ETAPAS: ReadonlyArray<readonly [Etapa, string]> = [
  ['molde', '1. Molde'],
  ['ordem', '2. Ordem'],
  ['malha', '3. Malha e rolos'],
  ['risco', '4. Risco e enfesto'],
  ['alternativas', '5. Alternativas'],
  ['revisar', '6. Revisar e confirmar'],
  ['planos', 'Planos deste projeto'],
];

const NOVA = 'nova';
const DO_PROJETO = 'projeto';
const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const quando = (iso: string): string => DATA.format(new Date(iso));

/** A base do plano em revisão: os riscos e as camadas de cada um, e de onde vieram. */
interface Base {
  readonly estrategia: EstrategiaDoPlano;
  readonly criterio: string;
  readonly origemDaComposicao: string;
  readonly riscos: readonly RiscoDoPlanejamento[];
  readonly composicao: readonly CamadasDoRisco[];
  readonly busca: BuscaDosRiscos | null;
}

interface BuscaFeita {
  readonly assinatura: string;
  /** Os fatores da compensação de encolhimento com que os riscos foram feitos (ou `null`). */
  readonly compensacao: FatoresDeCompensacao | null;
  readonly larguraDoRiscoMm: number;
  readonly composicoes: readonly Composicao[];
  readonly grades: ReadonlyMap<string, GradeDoRisco>;
  readonly resultado: ResultadoDaBusca;
}

/** O risco das peças que estão na mesa, para o plano: o comprimento e a largura pelas linhas de corte, e o desenho. */
function riscoDaMesaNoPlano(pecas: readonly Molde[], grade: GradeDoRisco, tamanhos: readonly string[], larguraDoRiscoMm: number): RiscoDoPlanejamento | null {
  const base = riscoDaMesa(pecas);
  if (!base) return null;
  const cortes = pecas.map((p) => ({ p, corte: linhaDeCorteDaPeca(p) })).filter((x) => x.corte.length >= 3);
  const caixa = retanguloEnvolvente(cortes.flatMap((x) => x.corte));
  const levar = (q: { readonly x: number; readonly y: number }) => ({ x: q.x - caixa.minX, y: q.y - caixa.minY });
  // Os trechos dos grupos do encaixe, como as peças estão na mesa (ADR 0103).
  const blocos = blocosNaMesa(pecas);
  return {
    chave: chaveDaGrade(grade, tamanhos),
    grade,
    origem: 'mesa',
    comprimentoMm: base.comprimentoMm,
    larguraMm: base.larguraMm,
    larguraDoRiscoMm,
    areaDasPecasMm2: base.areaDasPecasMm2 ?? null,
    eficienciaPercentual: base.areaDasPecasMm2 !== undefined ? (base.areaDasPecasMm2 / (base.comprimentoMm * larguraDoRiscoMm)) * 100 : null,
    pecas: cortes.map(({ p, corte }) => ({
      pecaId: p.id,
      nome: p.nome,
      tamanho: p.tamanho,
      contorno: corte.map(levar),
      fio: { inicio: levar(p.linhaDeFio.inicio), fim: levar(p.linhaDeFio.fim) },
      anguloGraus: p.anguloDeRotacaoGraus,
      espelhada: false,
    })),
    ...(blocos.length > 0 ? { blocosDosGrupos: blocos.map((b) => ({ ...b, inicioMm: b.inicioMm - caixa.minY, fimMm: b.fimMm - caixa.minY })) } : {}),
  };
}

/** O risco feito pela busca, como entra no plano (aumentado pela compensação de encolhimento, quando ela foi pedida). */
function riscoDaBusca(busca: BuscaFeita, chave: string, risco: RiscoGerado): RiscoDoPlanejamento {
  const r = riscoGeradoNoPlano(chave, risco);
  return busca.compensacao ? riscoCompensado(r, busca.compensacao, busca.larguraDoRiscoMm) : r;
}

/** Como usar, na própria janela: o caminho do molde ao estoque, e o que é configurável. */
const COMO_USAR = [
  '1. Molde: confira as peças de cada tamanho e a quantidade por roupa; registre a revisão do molde quando as peças mudarem.',
  '2. Ordem: digite, cole a grade de uma planilha, ou importe um CSV (o formato está na etapa); guarde a ordem no cadastro.',
  '3. Malha e rolos: a malha (largura, rendimento ou gramatura, encolhimento e a fonte dele, padrão e a repetição do desenho) e o material — um peso, ou os rolos do estoque (cada defeito com a posição, a extensão e a largura afetada).',
  '4. Risco e enfesto: o tipo de enfesto, de onde vem o risco (gerado, da mesa ou informado) e a configuração; a compensação do encolhimento só entra depois de ver a prévia e confirmar.',
  '5. Alternativas: compare consumo, enfestos e excedente; o desenho mostra cada risco em escala.',
  '6. Revisar e confirmar: ajuste as camadas e a mesa (o sugerido e o escolhido ficam no plano), diga quem confirma e confirme.',
  'Planos deste projeto: o plano confirmado mostra os valores de então; nele, reserve os rolos e, depois do corte, dê a baixa. Um movimento errado se desfaz com o estorno (com o motivo), e tudo fica no histórico.',
  'Execução do corte (no plano confirmado): libere para o corte, comece e conclua com as camadas enfestadas e o consumo real de cada rolo — a baixa passa a ser a do real, a sobra pode virar retalho, e aparece o planejado × executado.',
  'Configurável (etapa 4, guardado para os próximos planos): margens da mesa, pontas por camada, perda por rolo, folhas, altura e peso máximos do enfesto, comprimento e largura da mesa, roupas por risco, distância entre as peças, tolerância de rendimento, tempo da busca, se a emenda é permitida e a sobreposição dela.',
  'O que bloqueia não deixa calcular nem confirmar (está em "Para calcular, falta" ou "Nenhuma composição calcula"); o que é aviso aparece no plano e não impede; o que é estimativa (pelo peso, pelo rendimento) é dito como estimativa.',
];

/** As limitações conhecidas, ditas na própria janela. */
const LIMITACOES = [
  'O encaixe é uma heurística (pontos de canto com encosto, três ordens de entrada): nem o menor risco nem a melhor composição são garantidos; a busca tem limite de roupas por risco e de tempo, e diz o que ficou de fora.',
  'Login: o programa não tem; o responsável é digitado e aparece como "informado".',
  'Banco de dados: não há; projetos, cadastro e estoque são arquivos deste computador (com cópia de segurança e a versão anterior para recuperar).',
  'ERP: nenhum está ligado; as ordens entram digitadas, coladas de planilha ou por CSV.',
  'Defeitos sem posição não são evitados (o plano pede a decisão); a largura afetada é registrada, mas a camada pula o trecho inteiro do defeito.',
  'Emendas só nas linhas do risco que não cortam peça (riscos gerados ou da mesa), e só se a configuração permitir.',
  'Listras e xadrez: o casamento automático alinha o ponto "casamento" de cada peça à repetição; ele precisa da repetição e da fase no cadastro da malha e das camadas estendidas com o desenho alinhado (mesa de agulhas). Casamento por mais de um ponto da peça não é feito.',
  'Encolhimento: compensado só no risco, por decisão; a peça não muda no projeto.',
  'Custo: uma estimativa só do tecido (sem aviamentos, mão de obra e outros custos), em reais, com o consumo planejado (o consumo real da execução do corte não entra nela); a malha tubular só no enfesto tubular, e a largura aberta de uma malha tubular não é presumida.',
  'Execução do corte: guarda o que quem opera informa (nomes, horas dos cliques, camadas, consumo real por rolo — não por peça); o programa não se liga a enfestadeira, faca ou plotter, e não há fila de cortes entre várias estações.',
  'Formatos de molde: DXF (polilinhas, polilinha clássica, linhas e arcos soltos, círculos, splines, blocos) e PDF vetorial, testados com arquivos sintéticos e com dois arquivos reais de outro programa de modelagem (AutoCAD 2018, em cm); a importação é direta, com o nome do arquivo e o fio na horizontal.',
];

/** Uma medida em cm, como é digitada no cadastro da malha. */
const emCm = (mm: number): string => `${(mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} cm`;

/**
 * O que falta ou não confere no plano (as mesmas mensagens das listas "falta" de cada etapa). Cada campo mostra,
 * logo abaixo dele, a mensagem que o cita pelo nome entre aspas — depois que a pessoa passou por ele, para o
 * formulário não abrir todo marcado de vermelho.
 */
const ErrosDosCampos = createContext<readonly string[]>([]);

function Campo(props: {
  readonly rotulo: string;
  readonly valor: string;
  readonly onMudar: (v: string) => void;
  readonly tipo?: string;
  readonly dica?: string;
  /** Marcado com * (a legenda fica no alto da janela). */
  readonly obrigatorio?: boolean;
}): React.JSX.Element {
  const erros = useContext(ErrosDosCampos);
  const [visitado, setVisitado] = useState(false);
  const idDoErro = useId();
  const erro = visitado ? erros.find((e) => e.includes(`"${props.rotulo}"`)) : undefined;
  return (
    <div className={props.obrigatorio ? 'campo-do-plano campo-obrigatorio' : 'campo-do-plano'}>
      <label title={props.dica}>
        <span className="rotulo-do-campo">{props.rotulo}</span>
        <input
          type={props.tipo ?? 'text'}
          inputMode={props.tipo ? undefined : 'decimal'}
          value={props.valor}
          onChange={(e) => props.onMudar(e.target.value)}
          onBlur={() => setVisitado(true)}
          aria-required={props.obrigatorio ? true : undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idDoErro : undefined}
        />
      </label>
      {erro && (
        <span id={idDoErro} className="erro-do-campo">
          {erro}
        </span>
      )}
    </div>
  );
}

function Faltas(props: { readonly titulo: string; readonly itens: readonly string[] }): React.JSX.Element | null {
  if (props.itens.length === 0) return null;
  return (
    <div role="alert" className="faltas-do-plano">
      <p>{props.titulo}</p>
      <ul>
        {props.itens.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function PainelDePlanejamento(props: PainelDePlanejamentoProps): React.JSX.Element {
  const { cadastro } = props;
  const [etapa, setEtapa] = useState<Etapa>('molde');
  const [mensagem, setMensagem] = useState<string | null>(null);

  // ---- 1. Molde
  const modelo = useMemo(() => modeloDoPlano(props.pecas), [props.pecas]);
  const revisaoAtual = revisaoAtualDoMolde(props.projeto, modelo.impressaoDigital);
  const ultimaRevisao = props.projeto.revisoesDoMolde?.at(-1) ?? null;
  const [quantidadesTexto, setQuantidadesTexto] = useState<Record<string, string>>({});
  const [revisao, setRevisao] = useState({ responsavel: props.projeto.autor ?? '', descricao: '' });
  const quantidades = useMemo(() => {
    const erros: string[] = [];
    const escolhidas: Record<string, number> = {};
    for (const p of modelo.pecas) {
      const texto = quantidadesTexto[p.id];
      if (texto === undefined) continue;
      const n = lerNumero(texto, `Quantidade por roupa de “${p.nome}”`, erros, { obrigatorio: true, inteiro: true, zeroVale: true });
      if (n !== undefined) escolhidas[p.id] = n;
    }
    const lidas = quantidadesPorRoupa(modelo, escolhidas);
    return { quantidades: lidas.quantidades, erros: [...erros, ...lidas.erros] };
  }, [modelo, quantidadesTexto]);
  const errosDoMolde = useMemo(() => [...modelo.problemas.filter((p) => p.nivel === 'erro').map((p) => p.texto), ...quantidades.erros], [modelo, quantidades]);
  // Uma roupa de cada tamanho, com a área real das peças: a base da estimativa de custo do tecido.
  const roupas = useMemo(() => roupasPorTamanho(modelo, quantidades.quantidades), [modelo, quantidades]);

  // ---- 2. Ordem
  const [ordemEscolhida, setOrdemEscolhida] = useState<string>(NOVA);
  const [formOrdem, setFormOrdem] = useState<FormularioDaOrdem>(ORDEM_VAZIA);
  const [colado, setColado] = useState('');
  const [confirmarTrocaDaOrdem, setConfirmarTrocaDaOrdem] = useState(false);
  const ordemLida = useMemo(() => ordemDoFormulario(formOrdem), [formOrdem]);
  const tamanhosForaDoMolde = Object.entries(formOrdem.quantidades)
    .filter(([t, v]) => !modelo.tamanhos.includes(t) && v.trim() !== '' && v.trim() !== '0')
    .map(([t]) => t);
  const tamanhosDaOrdem = [...modelo.tamanhos, ...Object.keys(formOrdem.quantidades).filter((t) => !modelo.tamanhos.includes(t))];

  // ---- 3. Malha e rolos
  const [malhaEscolhida, setMalhaEscolhida] = useState<string>(props.tecidoDoProjeto ? DO_PROJETO : cadastro.malhas[0]?.id ?? NOVA);
  const [formMalha, setFormMalha] = useState<FormularioDaMalha>(() =>
    props.tecidoDoProjeto ? malhaDoTecido(props.tecidoDoProjeto) : cadastro.malhas[0] ? malhaNoFormulario(cadastro.malhas[0]) : MALHA_VAZIA,
  );
  const idDaMalha = malhaEscolhida === NOVA || malhaEscolhida === DO_PROJETO ? 'malha-do-plano' : malhaEscolhida;
  const malhaLida = useMemo(() => malhaDoFormulario(formMalha, idDaMalha), [formMalha, idDaMalha]);
  const [material, setMaterial] = useState<'rolos' | 'peso'>('peso');
  const [rolosEscolhidos, setRolosEscolhidos] = useState<ReadonlySet<string>>(new Set());
  const [pesoTexto, setPesoTexto] = useState('');
  const [misturarGrupos, setMisturarGrupos] = useState(false);
  const [aceitarPadrao, setAceitarPadrao] = useState(false);
  const [rendimentoPrincipal, setRendimentoPrincipal] = useState<RendimentoPrincipal>('informado');
  const [formRolo, setFormRolo] = useState<FormularioDoRolo>(ROLO_VAZIO);
  const [aceitarDefeitos, setAceitarDefeitos] = useState(false);
  const [errosDoCsv, setErrosDoCsv] = useState<readonly string[]>([]);
  // A pasta de troca com o ERP (ADR 0141): onde está, se a troca está acontecendo e os arquivos recusados na última.
  const acessoAoErp = props.pastaDoErp ?? null;
  const [pastaDoErp, setPastaDoErp] = useState<string | null>(null);
  const [trocandoComOErp, setTrocandoComOErp] = useState(false);
  const [trocaAutomatica, setTrocaAutomatica] = useState(false);
  const [roupasPorFeixe, setRoupasPorFeixe] = useState('20');
  const [recusadosNaTroca, setRecusadosNaTroca] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!acessoAoErp) return;
    let vivo = true;
    void acessoAoErp.onde().then((caminho) => {
      if (vivo) setPastaDoErp(caminho);
    });
    return () => {
      vivo = false;
    };
  }, [acessoAoErp]);
  // O plano em edição (o rascunho aberto): as reservas dele não contam como de outro plano.
  const [planoEmEdicao, setPlanoEmEdicao] = useState<{ readonly id: string; readonly criadoEmIso: string; readonly copiaDePlanoId?: string } | null>(null);
  const [roloARemover, setRoloARemover] = useState<string | null>(null);
  const rolosDaMalha = useMemo(() => cadastro.rolos.filter((r) => r.malhaId === malhaEscolhida && !r.indisponivel), [cadastro.rolos, malhaEscolhida]);
  const rolosSelecionados = useMemo(() => rolosDaMalha.filter((r) => rolosEscolhidos.has(r.id)), [rolosDaMalha, rolosEscolhidos]);
  const pesoLido = useMemo(() => {
    const erros: string[] = [];
    const kg = lerNumero(pesoTexto, 'Peso disponível (kg)', erros, { obrigatorio: material === 'peso' });
    return { pesoG: kg === undefined ? undefined : kg * 1000, erros };
  }, [pesoTexto, material]);

  // ---- 4. Risco e enfesto
  const [tipo, setTipo] = useState<TipoDeEnfesto>(props.tipoDoEnfesto);
  const [fonte, setFonte] = useState<'gerar' | 'mesa' | 'informado'>('gerar');
  const [formConfig, setFormConfig] = useState<FormularioDaConfiguracao>(() => configuracaoNoFormulario(props.configuracaoGuardada));
  const configLida = useMemo(() => configuracaoDoFormulario(formConfig), [formConfig]);
  const [larguraDoRiscoTexto, setLarguraDoRiscoTexto] = useState('');
  const riscoDaMesaBase = useMemo(() => riscoDaMesa(props.pecas), [props.pecas]);
  const [gradeDaMesa, setGradeDaMesa] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(riscoDaMesaBase?.gradePorTamanho ?? {}).map(([t, n]) => [t, String(n)])),
  );
  const [informado, setInformado] = useState<{ comprimento: string; largura: string; grade: Record<string, string> }>({ comprimento: '', largura: '', grade: {} });
  // A compensação de encolhimento: só depois de ver a prévia e confirmar.
  const [compensar, setCompensar] = useState(false);
  const [previaDaCompensacao, setPreviaDaCompensacao] = useState(false);
  const fatores = useMemo(() => (malhaLida.malha ? fatoresDeCompensacao(malhaLida.malha) : null), [malhaLida.malha]);
  const fatoresValidos: FatoresDeCompensacao | null = fatores && !('erro' in fatores) ? fatores : null;
  // A decisão só vale quando se aplica: com a malha já compensada no molde, ou o risco informado à mão, ela não entra.
  const compensacaoEmUso: FatoresDeCompensacao | null = compensar && fonte !== 'informado' ? fatoresValidos : null;
  const casamento = useMemo(() => (malhaLida.malha && !aceitarPadrao ? casamentoDaMalha(malhaLida.malha) : null), [malhaLida.malha, aceitarPadrao]);
  const pecasSemMarcaDeCasamento = useMemo(
    () =>
      modelo.pecas
        .filter((p) => !Object.values(modelo.pecasPorTamanho).some((lista) => lista.some((x) => x.pecaId === p.id && x.molde.marcas.some((m) => (m.rotulo ?? '').toLocaleLowerCase('pt-BR').includes(ROTULO_DO_PONTO_DE_CASAMENTO)))))
        .map((p) => p.nome),
    [modelo],
  );
  const rolosComDefeitoSemPosicao = rolosSelecionados.filter((r) => r.defeitos.some((d) => d.posicaoMm === undefined));
  // Do estoque: o que cada rolo escolhido já tem consumido ou reservado por outros planos.
  const usoAnterior = useMemo(() => {
    const uso: Record<string, number> = {};
    for (const r of rolosSelecionados) {
      const e = estadoDoRolo(cadastro, r, planoEmEdicao?.id);
      if (e.inicialMm !== null && e.disponivelMm !== null && e.inicialMm - e.disponivelMm > 0) uso[r.id] = e.inicialMm - e.disponivelMm;
    }
    return uso;
  }, [rolosSelecionados, cadastro, planoEmEdicao?.id]);

  const larguraPadraoDoRiscoMm = malhaLida.malha ? larguraNaMesa(malhaLida.malha.larguraUtilMm, tipo, malhaLida.malha.tubular) : null;
  const larguraDoRisco = useMemo(() => {
    const erros: string[] = [];
    const m = lerNumero(larguraDoRiscoTexto, 'Largura do risco (m)', erros);
    return { mm: m !== undefined ? m * 1000 : larguraPadraoDoRiscoMm, erros };
  }, [larguraDoRiscoTexto, larguraPadraoDoRiscoMm]);

  const grade = (textos: Record<string, string>, nome: string, erros: string[]): GradeDoRisco => {
    const g: Record<string, number> = {};
    for (const [t, v] of Object.entries(textos)) {
      const n = lerNumero(v, `${nome}: roupas do ${t} por folha`, erros, { inteiro: true, zeroVale: true });
      if (n !== undefined && n > 0) g[t] = n;
    }
    if (erros.length === 0 && Object.keys(g).length === 0) erros.push(`${nome}: informe quantas roupas de cada tamanho uma folha dá.`);
    return g;
  };

  // ---- A entrada do cálculo, com o que falta
  const entrada = useMemo((): { readonly entrada: EntradaDoPlanejamento | null; readonly faltas: string[] } => {
    const faltas = [...errosDoMolde, ...ordemLida.erros, ...malhaLida.erros, ...configLida.erros, ...larguraDoRisco.erros];
    if (material === 'peso') faltas.push(...pesoLido.erros);
    else if (rolosSelecionados.length === 0) faltas.push('Escolha os rolos do plano (ou use o peso disponível).');
    if (larguraDoRisco.mm === null) faltas.push('Falta a largura do risco (a largura útil da malha).');
    if (faltas.length > 0 || !ordemLida.ordem || !malhaLida.malha || larguraDoRisco.mm === null) return { entrada: null, faltas };
    const ordemNoCadastro = cadastro.ordens.find((o) => o.id === ordemEscolhida);
    return {
      faltas,
      entrada: {
        molde: {
          projetoId: props.projeto.id,
          codigo: props.projeto.codigo,
          nome: props.projeto.nome,
          revisao: revisaoAtual?.numero ?? null,
          impressaoDigital: modelo.impressaoDigital,
          pecas: modelo.pecas.map((p) => ({
            id: p.id,
            nome: p.nome,
            tamanhos: p.tamanhos,
            quantidadePorRoupa: quantidades.quantidades[p.id] ?? 0,
            emPar: p.emPar,
            restricao: p.restricao,
            areaMm2: p.areaMm2,
          })),
        },
        ordem: { ...ordemLida.ordem, ...(ordemNoCadastro ? { id: ordemNoCadastro.id } : {}) },
        malha: malhaLida.malha,
        rolos: material === 'rolos' ? rolosSelecionados : null,
        ...(material === 'peso' && pesoLido.pesoG !== undefined ? { pesoDisponivelG: pesoLido.pesoG } : {}),
        rendimentoPrincipal,
        misturarGrupos,
        aceitarPadraoSemCasamento: aceitarPadrao,
        tipoDeEnfesto: tipo,
        larguraDoRiscoMm: larguraDoRisco.mm,
        ...(aceitarDefeitos && material === 'rolos' ? { aceitarDefeitosSemPosicao: true } : {}),
        ...(compensacaoEmUso ? { compensarEncolhimento: true } : {}),
        ...(material === 'rolos' && Object.keys(usoAnterior).length > 0 ? { usoAnteriorDosRolosMm: usoAnterior } : {}),
      },
    };
  }, [
    aceitarDefeitos,
    compensacaoEmUso,
    usoAnterior,
    errosDoMolde,
    ordemLida,
    malhaLida,
    configLida,
    larguraDoRisco,
    material,
    pesoLido,
    rolosSelecionados,
    cadastro.ordens,
    ordemEscolhida,
    props.projeto.id,
    props.projeto.codigo,
    props.projeto.nome,
    revisaoAtual?.numero,
    modelo,
    quantidades,
    rendimentoPrincipal,
    misturarGrupos,
    aceitarPadrao,
    tipo,
  ]);

  // ---- 5. Alternativas
  const [busca, setBusca] = useState<BuscaFeita | null>(null);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const cancelarRef = useRef<(() => void) | null>(null);
  const [escolhida, setEscolhida] = useState(0);
  const config = configLida.configuracao;
  const assinaturaAgora = JSON.stringify([
    larguraDoRisco.mm,
    config?.distanciaEntrePecasMm,
    config?.comprimentoMaximoDaMesaMm,
    config?.margemInicialDaMesaMm,
    config?.margemFinalDaMesaMm,
    config?.roupasPorRiscoMax,
    malhaLida.malha?.sentidoUnico,
    tipo,
    quantidades.quantidades,
    ordemLida.ordem?.quantidadesPorTamanho,
    modelo.impressaoDigital,
    compensacaoEmUso ? [compensacaoEmUso.comprimento, compensacaoEmUso.largura] : null,
    casamento,
  ]);
  const buscaDesatualizada = busca !== null && busca.assinatura !== assinaturaAgora;

  const errosDaFonte: string[] = [];
  const riscoUnico: RiscoDoPlanejamento | null = (() => {
    if (fonte === 'gerar' || larguraDoRisco.mm === null) return null;
    if (fonte === 'mesa') {
      const g = grade(gradeDaMesa, 'Risco da mesa', errosDaFonte);
      const r = riscoDaMesaNoPlano(props.pecas, g, modelo.tamanhos, larguraDoRisco.mm);
      if (!r) errosDaFonte.push('Não há peças na mesa para tirar o risco: use "Gerar os riscos" ou informe um risco.');
      if (errosDaFonte.length > 0 || !r) return null;
      return compensacaoEmUso ? riscoCompensado(r, compensacaoEmUso, larguraDoRisco.mm) : r;
    }
    const comprimento = lerNumero(informado.comprimento, 'Comprimento do risco (m)', errosDaFonte, { obrigatorio: true });
    // O nome é o do campo do risco informado ("Largura do risco (m)" é o outro campo da etapa, o da largura da malha).
    const largura = lerNumero(informado.largura, 'Largura ocupada do risco (m)', errosDaFonte, { obrigatorio: true });
    const g = grade(informado.grade, 'Risco informado', errosDaFonte);
    if (errosDaFonte.length > 0 || comprimento === undefined || largura === undefined) return null;
    return {
      chave: chaveDaGrade(g, modelo.tamanhos),
      grade: g,
      origem: 'informado',
      comprimentoMm: comprimento * 1000,
      larguraMm: largura * 1000,
      larguraDoRiscoMm: larguraDoRisco.mm,
      areaDasPecasMm2: null,
      eficienciaPercentual: null,
      pecas: [],
    };
  })();

  const montadas = useMemo(() => {
    if (fonte !== 'gerar' || !busca || !entrada.entrada || !config) return null;
    const feitos = new Map(busca.resultado.feitos.map((f) => [f.chave, riscoDaBusca(busca, f.chave, f.risco)]));
    const naoSairam = new Map(busca.resultado.naoSairam.map((n) => [n.chave, n.motivo]));
    return montarAlternativas(entrada.entrada, busca.composicoes, feitos, naoSairam, config);
  }, [fonte, busca, entrada.entrada, config]);
  const alternativaEscolhida = montadas?.alternativas[escolhida] ?? null;
  const riscosDaEscolhida = alternativaEscolhida && busca ? alternativaEscolhida.composicao.riscos.map((r) => riscoDaBusca(busca, r.chave, busca.resultado.feitos.find((f) => f.chave === r.chave)!.risco)) : [];
  const estimativaDeCusto = (doPlano: EntradaDoPlanejamento, resultado: ResultadoDoPlanejamento, riscos: readonly RiscoDoPlanejamento[]) =>
    estimarCustoDoTecido({ entrada: doPlano, resultado, riscos, roupas });

  const calcularAlternativas = (): void => {
    setMensagem(null);
    setEtapa('alternativas');
    if (fonte !== 'gerar' || !entrada.entrada || !config || larguraDoRisco.mm === null) return;
    const { composicoes, pedidos } = prepararBusca(modelo, quantidades.quantidades, entrada.entrada.ordem.quantidadesPorTamanho, tipo, config.roupasPorRiscoMax);
    if (pedidos.length === 0) {
      setMensagem('A ordem não pede nenhum tamanho do molde: não há risco a fazer.');
      return;
    }
    cancelarRef.current?.();
    setBusca(null);
    setProgresso({ feitos: 0, total: pedidos.length });
    const assinatura = assinaturaAgora;
    const compensacao = compensacaoEmUso;
    const larguraDaBusca = compensacao ? larguraDoRisco.mm / compensacao.largura : larguraDoRisco.mm;
    const larguraDoRiscoMm = larguraDoRisco.mm;
    const { promessa, cancelar } = props.buscarRiscos(
      pedidos,
      {
        larguraMm: larguraDaBusca,
        ...(casamento ? { casamento } : {}),
        comprimentoMaximoMm: config.comprimentoMaximoDaMesaMm - config.margemInicialDaMesaMm - config.margemFinalDaMesaMm,
        distanciaMm: config.distanciaEntrePecasMm,
        sentidoUnico: entrada.entrada.malha.sentidoUnico,
        tempoTotalMs: config.tempoDeBuscaS * 1000,
      },
      (feitos, total) => setProgresso({ feitos, total }),
    );
    cancelarRef.current = cancelar;
    promessa.then(
      (resultado) => {
        cancelarRef.current = null;
        setProgresso(null);
        setEscolhida(0);
        setBusca({ assinatura, compensacao, larguraDoRiscoMm, composicoes, grades: new Map(pedidos.map((p) => [p.chave, p.grade])), resultado });
      },
      (erro: unknown) => {
        cancelarRef.current = null;
        setProgresso(null);
        setMensagem(`A busca dos riscos parou com um erro: ${erro instanceof Error ? erro.message : String(erro)}`);
      },
    );
  };

  // A base da revisão: a alternativa escolhida, o risco da mesa ou o informado — ou o rascunho aberto.
  const [baseDoRascunho, setBaseDoRascunho] = useState<Base | null>(null);
  const base: Base | null = (() => {
    if (baseDoRascunho) return baseDoRascunho;
    if (fonte === 'gerar') {
      const alternativa = montadas?.alternativas[escolhida];
      if (!alternativa || buscaDesatualizada || !busca) return null;
      return {
        estrategia: alternativa.criterios[0]!,
        criterio: alternativa.criterios.map((c) => `${CRITERIOS[c].rotulo}: ${CRITERIOS[c].explicacao}`).join(' '),
        origemDaComposicao: alternativa.composicao.origem,
        riscos: alternativa.composicao.riscos.map((r) => riscoDaBusca(busca, r.chave, busca.resultado.feitos.find((f) => f.chave === r.chave)!.risco)),
        composicao: alternativa.composicao.riscos.map((r) => ({ chave: r.chave, camadas: r.camadas })),
        busca: resumoDaBusca(montadas!.avaliadas, busca.resultado.feitos.length, new Map(busca.resultado.naoSairam.map((n) => [n.chave, n.motivo])), busca.grades, busca.resultado.semTempo.length, busca.resultado.tempoMs),
      };
    }
    if (!riscoUnico || !entrada.entrada) return null;
    return {
      estrategia: fonte === 'mesa' ? 'risco-da-mesa' : 'risco-informado',
      criterio: fonte === 'mesa' ? 'O risco é o encaixe que está na mesa do projeto; as camadas fecham a ordem com ele.' : 'O risco foi informado à mão (comprimento, largura e grade); as camadas fecham a ordem com ele.',
      origemDaComposicao: fonte === 'mesa' ? 'risco da mesa' : 'risco informado',
      riscos: [riscoUnico],
      composicao: camadasDeUmRisco(riscoUnico, entrada.entrada),
      busca: null,
    };
  })();

  // ---- 6. Revisar
  const [ajuste, setAjuste] = useState<{ camadasPorRisco: Record<string, string>; porEnfesto: string; mesa: string }>({ camadasPorRisco: {}, porEnfesto: '', mesa: '' });
  const [responsavel, setResponsavel] = useState(props.projeto.autor ?? '');
  const [aplicarAoEnfesto, setAplicarAoEnfesto] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const ajustesLidos = useMemo((): { readonly ajustes: AjustesDoPlanejamento; readonly erros: string[] } => {
    const erros: string[] = [];
    const camadasPorRisco: Record<string, number> = {};
    for (const [chave, texto] of Object.entries(ajuste.camadasPorRisco)) {
      const n = lerNumero(texto, `Camadas do risco ${chave}`, erros, { inteiro: true, zeroVale: true });
      if (n !== undefined) camadasPorRisco[chave] = n;
    }
    const porEnfesto = lerNumero(ajuste.porEnfesto, 'Camadas por enfesto', erros, { inteiro: true });
    const mesa = lerNumero(ajuste.mesa, 'Comprimento da mesa (m)', erros);
    return {
      erros,
      ajustes: {
        ...(Object.keys(camadasPorRisco).length > 0 ? { camadasPorRisco } : {}),
        ...(porEnfesto !== undefined ? { camadasPorEnfesto: porEnfesto } : {}),
        ...(mesa !== undefined ? { comprimentoDaMesaMm: mesa * 1000 } : {}),
      },
    };
  }, [ajuste]);
  const sugerido = base && entrada.entrada && config ? calcularPlanejamento(entrada.entrada, base.riscos, base.composicao, config) : null;
  const final = base && entrada.entrada && config && ajustesLidos.erros.length === 0 ? calcularPlanejamento(entrada.entrada, base.riscos, base.composicao, config, ajustesLidos.ajustes) : null;

  const montarPlano = (): PlanoDeCorteV2 | string => {
    if (!base || !entrada.entrada || !config) return 'O plano ainda não tem o que é preciso: veja o que falta nas etapas.';
    if (ajustesLidos.erros.length > 0) return ajustesLidos.erros.join(' ');
    if (!final || !final.ok) return final && !final.ok ? final.erros.join(' ') : 'O plano não calcula.';
    if (!sugerido || !sugerido.ok) return 'O plano sugerido não calcula.';
    const agora = props.agoraIso();
    return {
      versaoDoCalculo: 2,
      id: planoEmEdicao?.id ?? props.novoId('plano'),
      criadoEmIso: planoEmEdicao?.criadoEmIso ?? agora,
      atualizadoEmIso: agora,
      situacao: 'rascunho',
      responsavel: responsavel.trim(),
      entrada: entrada.entrada,
      configuracao: config,
      estrategia: base.estrategia,
      criterio: base.criterio,
      origemDaComposicao: base.origemDaComposicao,
      riscos: base.riscos,
      composicaoSugerida: base.composicao,
      ajustes: ajustesLidos.ajustes,
      ajustesFeitos: ajustesRegistrados({
        sugerido: sugerido.resultado,
        ajustes: ajustesLidos.ajustes,
        quantidades: modelo.pecas.map((p) => ({ nome: p.nome, sugerida: p.quantidadeSugerida, escolhida: quantidades.quantidades[p.id] ?? 0 })),
        larguraDoRisco: { sugerida: larguraPadraoDoRiscoMm ?? entrada.entrada.larguraDoRiscoMm, escolhida: entrada.entrada.larguraDoRiscoMm },
      }),
      resultado: final.resultado,
      alertas: final.alertas,
      premissas: final.premissas,
      busca: base.busca,
      ...(planoEmEdicao?.copiaDePlanoId ? { copiaDePlanoId: planoEmEdicao.copiaDePlanoId } : {}),
      // A estimativa vai guardada com o plano, como saiu agora: o plano confirmado não é recalculado depois.
      custoDoTecido: estimarCustoDoTecido({ entrada: entrada.entrada, resultado: final.resultado, riscos: base.riscos, roupas }),
    };
  };

  const criarArquivosDeEncaixe = async (): Promise<void> => {
    const plano = montarPlano();
    if (typeof plano === 'string') {
      setMensagem(plano);
      return;
    }
    const texto = await props.onCriarArquivosDeEncaixe?.(plano);
    if (texto) setMensagem(texto);
  };

  const guardarRascunho = (): void => {
    const plano = montarPlano();
    if (typeof plano === 'string') {
      setMensagem(plano);
      return;
    }
    const erro = props.onGuardarRascunho(plano);
    setMensagem(erro ?? `Rascunho guardado no projeto (${quando(plano.atualizadoEmIso)}). Ele pode ser continuado depois em "Planos deste projeto".`);
    if (!erro) setPlanoEmEdicao({ id: plano.id, criadoEmIso: plano.criadoEmIso, ...(plano.copiaDePlanoId ? { copiaDePlanoId: plano.copiaDePlanoId } : {}) });
    if (config) props.onGuardarConfiguracao(config);
  };

  const confirmar = (): void => {
    const plano = montarPlano();
    if (typeof plano === 'string') {
      setMensagem(plano);
      setConfirmando(false);
      return;
    }
    if (plano.responsavel === '') {
      setMensagem('Informe o responsável pelo plano.');
      setConfirmando(false);
      return;
    }
    const erro = props.onConfirmar(plano, aplicarAoEnfesto);
    setConfirmando(false);
    if (erro) setMensagem(erro);
    if (config) props.onGuardarConfiguracao(config);
  };

  // ---- Cadastro (ordens, malhas, rolos)
  const mudarCadastro = async (mudar: () => CadastroDeProducao, sucesso: string): Promise<boolean> => {
    if (props.cadastroSomenteLeitura) {
      setMensagem('O cadastro de produção é de uma versão mais nova do programa: esta versão não grava nele.');
      return false;
    }
    let novo: CadastroDeProducao;
    try {
      novo = mudar();
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
      return false;
    }
    const erro = await props.onMudarCadastro(novo);
    setMensagem(erro ?? sucesso);
    return erro === null;
  };

  const guardarOrdem = (): void => {
    if (!ordemLida.ordem) {
      setMensagem(ordemLida.erros.join(' '));
      return;
    }
    const existente = cadastro.ordens.find((o) => o.id === ordemEscolhida);
    if (existente && !confirmarTrocaDaOrdem) {
      setConfirmarTrocaDaOrdem(true);
      return;
    }
    setConfirmarTrocaDaOrdem(false);
    const agora = props.agoraIso();
    const id = existente?.id ?? props.novoId('ordem');
    const o = ordemLida.ordem;
    const ordem: OrdemDeProducao = {
      id,
      codigo: o.codigo,
      quantidadesPorTamanho: o.quantidadesPorTamanho,
      projetoId: props.projeto.id,
      codigoDoMolde: props.projeto.codigo,
      ...(revisaoAtual ? { revisaoDoMolde: revisaoAtual.numero } : {}),
      ...(o.produto ? { produto: o.produto } : {}),
      ...(o.cor ? { cor: o.cor } : {}),
      ...(o.prazo ? { prazo: o.prazo } : {}),
      ...(formOrdem.observacoes.trim() ? { observacoes: formOrdem.observacoes.trim() } : {}),
      criadaEmIso: existente?.criadaEmIso ?? agora,
      atualizadaEmIso: agora,
    };
    void mudarCadastro(() => salvarOrdem(cadastro, ordem), `Ordem ${ordem.codigo} guardada no cadastro.`).then((ok) => ok && setOrdemEscolhida(id));
  };

  const importarCsv = async (arquivo: File): Promise<void> => {
    setErrosDoCsv([]);
    const texto = await arquivo.text();
    const r = importarOrdensCsv(texto, {
      tamanhosDoMolde: modelo.tamanhos,
      projetoId: props.projeto.id,
      codigoDoMolde: props.projeto.codigo,
      revisoes: (props.projeto.revisoesDoMolde ?? []).map((x) => x.numero),
      revisaoAtual: revisaoAtual?.numero ?? null,
      existentes: cadastro.ordens,
      agoraIso: props.agoraIso(),
      novoId: () => props.novoId('ordem'),
    });
    if (r.erros.length > 0) {
      setErrosDoCsv(r.erros);
      setMensagem(`O arquivo ${arquivo.name} não foi importado (nenhuma ordem entrou): corrija as linhas abaixo e importe de novo.`);
      return;
    }
    const ok = await mudarCadastro(() => r.ordens.reduce((c, o) => salvarOrdem(c, o), cadastro), `${r.ordens.length} ordem(ns) importada(s) de ${arquivo.name}: ${r.ordens.map((o) => o.codigo).join(', ')}.`);
    if (ok && r.ordens[0]) {
      setOrdemEscolhida(r.ordens[0].id);
      setFormOrdem(ordemNoFormulario(r.ordens[0]));
    }
  };

  const escolherAPastaDoErp = async (): Promise<void> => {
    if (!acessoAoErp) return;
    try {
      const caminho = await acessoAoErp.escolher();
      if (!caminho) return;
      setPastaDoErp(caminho);
      setMensagem(`Pasta de troca com o ERP: ${caminho} (com as subpastas entrada, processados, com-erro e saida).`);
    } catch (e) {
      setMensagem(`Não deu para usar essa pasta: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const esquecerAPastaDoErp = async (): Promise<void> => {
    if (!acessoAoErp) return;
    await acessoAoErp.esquecer();
    setPastaDoErp(null);
    setRecusadosNaTroca([]);
    setMensagem('A pasta de troca com o ERP deixou de ser usada (os arquivos dela continuam lá).');
  };

  /** A troca (ADR 0141): as ordens deste molde que estão na entrada e, depois, a saída com o cadastro de agora. */
  const trocarComOErpAgora = async (): Promise<void> => {
    if (!acessoAoErp || trocandoComOErp) return;
    if (props.cadastroSomenteLeitura) {
      setMensagem('O cadastro de produção é de uma versão mais nova do programa: esta versão não grava nele.');
      return;
    }
    setTrocandoComOErp(true);
    setRecusadosNaTroca([]);
    try {
      const r = await trocarComOErp(
        acessoAoErp,
        cadastro,
        {
          tamanhosDoMolde: modelo.tamanhos,
          projetoId: props.projeto.id,
          codigoDoMolde: props.projeto.codigo,
          revisoes: (props.projeto.revisoesDoMolde ?? []).map((x) => x.numero),
          revisaoAtual: revisaoAtual?.numero ?? null,
          agoraIso: props.agoraIso(),
          novoId: () => props.novoId('ordem'),
        },
        props.nomeDoProjeto ?? ((id) => id),
        (props.projetosDaBiblioteca ?? [])
          .filter((p) => p.id !== props.projeto.id && p.status !== 'arquivado' && p.codigo.trim() !== '')
          .map((p) => ({ tamanhosDoMolde: modeloDoPlano(p.estadoAtual.pecas).tamanhos, projetoId: p.id, codigoDoMolde: p.codigo, revisoes: (p.revisoesDoMolde ?? []).map((x) => x.numero), revisaoAtual: null })),
      );
      const ordens = r.importados.flatMap((x) => x.ordens);
      const partes = [
        r.importados.length > 0
          ? `${ordens.length} ordem(ns) importada(s) do ERP (${r.importados.map((x) => x.nome).join(', ')}): ${ordens.join(', ')}.`
          : 'Nenhum arquivo de ordens dos moldes da biblioteca na entrada.',
        r.recusados.length > 0 ? `${r.recusados.length} arquivo(s) recusado(s), movido(s) para "com-erro" com o relatório.` : '',
        r.gravados.length > 0 ? `Saída para o ERP gravada: ${r.gravados.join(', ')}.` : '',
        ...r.falhas,
      ].filter((p) => p !== '');
      setRecusadosNaTroca(r.recusados.flatMap((x) => x.erros.map((e) => `${x.nome}: ${e}`)));
      if (r.importados.length > 0) await mudarCadastro(() => r.cadastro, partes.join(' '));
      else setMensagem(partes.join(' '));
    } catch (e) {
      setMensagem(`A troca com o ERP falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTrocandoComOErp(false);
    }
  };

  /** As etiquetas dos feixes da ordem do formulário (ADR 0159): a folha para imprimir ou a lista. */
  const salvarEtiquetas = async (formato: 'html' | 'csv'): Promise<void> => {
    const ordem = ordemLida.ordem;
    if (!ordem || !props.onSalvarTexto) {
      setMensagem(`Complete a ordem antes das etiquetas: ${ordemLida.erros.join(' ')}`);
      return;
    }
    try {
      const pecas = [...new Map(props.pecas.map((p) => [p.nome, { nome: p.nome, quantidade: p.quantidade }])).values()];
      const etiquetas = feixesDaOrdem({
        ordem: ordem.codigo,
        ...(ordem.produto ? { produto: ordem.produto } : {}),
        ...(ordem.cor ? { cor: ordem.cor } : {}),
        quantidadesPorTamanho: ordem.quantidadesPorTamanho,
        pecas,
        roupasPorFeixe: Number(roupasPorFeixe),
      });
      const nome = `etiquetas-${ordem.codigo.replace(/[^A-Za-z0-9._-]+/g, '-')}.${formato}`;
      const caminho = await props.onSalvarTexto(nome, formato === 'html' ? htmlDasEtiquetas(etiquetas, pecas) : csvDasEtiquetas(etiquetas));
      if (caminho) setMensagem(`${etiquetas.length} etiqueta(s) de feixe salvas em ${caminho}.`);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
    }
  };

  // A troca sozinha (ADR 0151), enquanto a janela está aberta: o relógio chama a troca de agora.
  const trocarRef = useRef(trocarComOErpAgora);
  useEffect(() => {
    trocarRef.current = trocarComOErpAgora;
  });
  const trocaLigada = trocaAutomatica && pastaDoErp !== null;
  const intervaloDaTroca = props.intervaloDaTrocaMs ?? 5 * 60_000;
  useEffect(() => {
    if (!trocaLigada) return;
    const relogio = setInterval(() => void trocarRef.current(), intervaloDaTroca);
    return () => clearInterval(relogio);
  }, [trocaLigada, intervaloDaTroca]);

  const guardarMalha = (): void => {
    const id = malhaEscolhida === NOVA || malhaEscolhida === DO_PROJETO ? props.novoId('malha') : malhaEscolhida;
    const { malha, erros } = malhaDoFormulario(formMalha, id);
    if (!malha) {
      setMensagem(erros.join(' '));
      return;
    }
    void mudarCadastro(() => salvarMalha(cadastro, malha), `Malha “${malha.descricao}” guardada no cadastro.`).then((ok) => ok && setMalhaEscolhida(id));
  };

  const cadastrarRolo = (): void => {
    if (malhaEscolhida === NOVA || malhaEscolhida === DO_PROJETO) {
      setMensagem('Guarde a malha no cadastro antes: o rolo fica ligado a ela.');
      return;
    }
    const { rolo, erros } = roloDoFormulario(formRolo, props.novoId('rolo'), malhaEscolhida);
    if (!rolo) {
      setMensagem(erros.join(' '));
      return;
    }
    void mudarCadastro(() => salvarRolo(cadastro, rolo), `Rolo ${rolo.identificacao} cadastrado.`).then((ok) => {
      if (!ok) return;
      setFormRolo(ROLO_VAZIO);
      setRolosEscolhidos((s) => new Set([...s, rolo.id]));
    });
  };

  // ---- Planos guardados
  const [planoAberto, setPlanoAberto] = useState<string | null>(null);
  const [rascunhoARemover, setRascunhoARemover] = useState<string | null>(null);
  const planos: readonly PlanoGuardado[] = props.projeto.planosDeCorte ?? [];

  /** Põe um plano guardado na tela para continuar (o rascunho) ou como um novo a partir dele. */
  const continuar = (plano: PlanoDeCorteV2, comoNovo: boolean): void => {
    const e = plano.entrada;
    setQuantidadesTexto(Object.fromEntries(e.molde.pecas.filter((p) => modelo.pecas.some((m) => m.id === p.id)).map((p) => [p.id, String(p.quantidadePorRoupa)])));
    setOrdemEscolhida(e.ordem.id && cadastro.ordens.some((o) => o.id === e.ordem.id) ? e.ordem.id : NOVA);
    setFormOrdem({
      codigo: e.ordem.codigo,
      produto: e.ordem.produto ?? '',
      cor: e.ordem.cor ?? '',
      prazo: e.ordem.prazo ?? '',
      observacoes: '',
      quantidades: Object.fromEntries(Object.entries(e.ordem.quantidadesPorTamanho).map(([t, n]) => [t, String(n)])),
    });
    setMalhaEscolhida(cadastro.malhas.some((m) => m.id === e.malha.id) ? e.malha.id : NOVA);
    setFormMalha(malhaNoFormulario(e.malha));
    if (e.rolos && e.rolos.length > 0) {
      setMaterial('rolos');
      setRolosEscolhidos(new Set(e.rolos.map((r) => r.id)));
    } else {
      setMaterial('peso');
      setPesoTexto(noCampo(e.pesoDisponivelG === undefined ? undefined : e.pesoDisponivelG / 1000));
    }
    setMisturarGrupos(e.misturarGrupos);
    setAceitarPadrao(e.aceitarPadraoSemCasamento);
    setAceitarDefeitos(e.aceitarDefeitosSemPosicao === true);
    setCompensar(e.compensarEncolhimento === true);
    setRendimentoPrincipal(e.rendimentoPrincipal);
    setTipo(e.tipoDeEnfesto);
    setLarguraDoRiscoTexto(noCampo(e.larguraDoRiscoMm / 1000));
    setFormConfig(configuracaoNoFormulario(plano.configuracao));
    setBaseDoRascunho({
      estrategia: plano.estrategia,
      criterio: plano.criterio,
      origemDaComposicao: plano.origemDaComposicao,
      riscos: plano.riscos,
      composicao: plano.composicaoSugerida,
      busca: plano.busca,
    });
    setAjuste({
      camadasPorRisco: Object.fromEntries(Object.entries(plano.ajustes.camadasPorRisco ?? {}).map(([k, n]) => [k, String(n)])),
      porEnfesto: plano.ajustes.camadasPorEnfesto !== undefined ? String(plano.ajustes.camadasPorEnfesto) : '',
      mesa: plano.ajustes.comprimentoDaMesaMm !== undefined ? noCampo(plano.ajustes.comprimentoDaMesaMm / 1000) : '',
    });
    setResponsavel(plano.responsavel);
    if (comoNovo) {
      const copia = copiaComoRascunho(plano, props.novoId('plano'), props.agoraIso());
      setPlanoEmEdicao({ id: copia.id, criadoEmIso: copia.criadoEmIso, copiaDePlanoId: plano.id });
    } else setPlanoEmEdicao({ id: plano.id, criadoEmIso: plano.criadoEmIso, ...(plano.copiaDePlanoId ? { copiaDePlanoId: plano.copiaDePlanoId } : {}) });
    setPlanoAberto(null);
    setEtapa('revisar');
    setMensagem(
      comoNovo
        ? `Plano novo a partir do de ${quando(plano.criadoEmIso)} (o original fica como está). Os riscos são os daquele plano; para refazer com o molde de agora, calcule as alternativas de novo.`
        : `Rascunho de ${quando(plano.criadoEmIso)} aberto para continuar.`,
    );
  };

  const largarRascunho = (): void => {
    setBaseDoRascunho(null);
    setPlanoEmEdicao(null);
    setMensagem('O plano em revisão agora vem das alternativas (o rascunho guardado não mudou).');
  };

  const tamanhosDaTela = modelo.tamanhos;
  const navegar = (alvo: Etapa): void => {
    setMensagem(null);
    setConfirmando(false);
    setEtapa(alvo);
  };
  // O estado de cada etapa, pelas mesmas listas "falta" que ela mostra: só para o caminho ficar à vista.
  const estadoDasEtapas: Partial<Record<Etapa, 'completa' | 'falta'>> = {
    molde: errosDoMolde.length === 0 ? 'completa' : 'falta',
    ordem: ordemLida.erros.length === 0 && tamanhosForaDoMolde.length === 0 ? 'completa' : 'falta',
    malha: malhaLida.erros.length === 0 && (material === 'peso' ? pesoLido.erros.length === 0 : rolosSelecionados.length > 0) ? 'completa' : 'falta',
    risco: configLida.erros.length === 0 && larguraDoRisco.mm !== null && larguraDoRisco.erros.length === 0 && (fonte === 'gerar' || errosDaFonte.length === 0) ? 'completa' : 'falta',
    alternativas: base ? 'completa' : 'falta',
  };
  const errosDosCampos = [...entrada.faltas, ...errosDaFonte, ...ajustesLidos.erros];

  return (
    <Sobreposicao titulo="Planejamento de corte" onFechar={() => {
      cancelarRef.current?.();
      props.onFechar();
    }}>
      <ErrosDosCampos.Provider value={errosDosCampos}>
      <div className="painel-de-planejamento">
        <nav aria-label="Etapas do planejamento" className="etapas-do-planejamento">
          {ETAPAS.map(([id, rotulo]) => {
            const estado = estadoDasEtapas[id];
            return (
              <button
                key={id}
                type="button"
                aria-current={etapa === id ? 'step' : undefined}
                className={etapa === id ? 'etapa-atual' : undefined}
                title={estado === 'completa' ? 'Etapa com os dados completos' : estado === 'falta' ? 'Falta dado nesta etapa (a lista está nela)' : undefined}
                onClick={() => navegar(id)}
              >
                {estado && <span className={`estado-da-etapa ${estado === 'completa' ? 'etapa-completa' : 'etapa-com-falta'}`} aria-hidden="true" />}
                {rotulo}
              </button>
            );
          })}
        </nav>
        <p className="nota-do-formulario legenda-dos-obrigatorios">
          Campos com * são obrigatórios. Nas etapas: <span className="estado-da-etapa etapa-completa" aria-hidden="true" /> dados completos,{' '}
          <span className="estado-da-etapa etapa-com-falta" aria-hidden="true" /> falta dado.
        </p>
        {props.avisosDoCadastro.map((a) => (
          <p key={a} className="nota-do-formulario" role="status">
            {a}
          </p>
        ))}
        {mensagem && (
          <p className="mensagem-do-planejamento" role="status">
            {mensagem}
          </p>
        )}

        {etapa === 'molde' && (
          <section aria-label="Molde e peças">
            <p className="resumo-do-plano">
              Projeto {props.projeto.codigo} — {props.projeto.nome}. Tamanhos do molde: {modelo.tamanhos.join(', ') || '—'}.
              <br />
              {revisaoAtual
                ? `Revisão ${revisaoAtual.numero} do molde (${quando(revisaoAtual.criadaEmIso)}, registrada por ${revisaoAtual.responsavel}: ${revisaoAtual.descricao}).`
                : ultimaRevisao
                  ? `As peças mudaram depois da revisão ${ultimaRevisao.numero} (${quando(ultimaRevisao.criadaEmIso)}): o plano vai dizer "sem revisão" até uma nova ser registrada.`
                  : 'Nenhuma revisão do molde registrada ainda: registre a primeira para os planos dizerem de que molde são.'}
            </p>
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>Registrar revisão do molde</legend>
              <Campo rotulo="Quem registra" valor={revisao.responsavel} onMudar={(v) => setRevisao({ ...revisao, responsavel: v })} />
              <Campo rotulo="O que mudou" valor={revisao.descricao} onMudar={(v) => setRevisao({ ...revisao, descricao: v })} />
              <button
                type="button"
                disabled={revisaoAtual !== null}
                onClick={() => {
                  const erro = props.onRegistrarRevisao({ ...revisao, impressaoDigital: modelo.impressaoDigital });
                  setMensagem(erro ?? 'Revisão registrada (fica no histórico do projeto, com as peças de agora).');
                  if (!erro) setRevisao({ ...revisao, descricao: '' });
                }}
              >
                Registrar revisão
              </button>
            </fieldset>
            <table className="tabela-de-relatorio">
              <caption>Peças do modelo (o que vai para o encaixe)</caption>
              <thead>
                <tr>
                  <th scope="col">Peça</th>
                  <th scope="col">Tamanhos</th>
                  <th scope="col">Por roupa</th>
                  <th scope="col">Par</th>
                  <th scope="col">Grupo</th>
                  <th scope="col">Rotações permitidas</th>
                  <th scope="col">Medida (linha de corte)</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Peça</th>
                </tr>
              </thead>
              <tbody>
                {modelo.pecas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>
                      {p.tamanhos.join(', ')}
                      {p.comum ? ' (comum)' : ''}
                    </td>
                    <td>
                      <input
                        aria-label={`Quantidade por roupa de ${p.nome}`}
                        inputMode="numeric"
                        size={3}
                        value={quantidadesTexto[p.id] ?? String(p.quantidadeSugerida)}
                        onChange={(e) => setQuantidadesTexto({ ...quantidadesTexto, [p.id]: e.target.value })}
                      />
                      <span className="nota-do-formulario"> ({p.origemDaQuantidade})</span>
                    </td>
                    <td>{p.emPar ? 'sim (dir. e esq.)' : 'não'}</td>
                    <td>{p.grupo || '—'}</td>
                    <td>
                      {rotacoesPermitidas(p.restricao).join('°, ')}°{p.restricao.permiteEspelhamento && !p.emPar ? ', espelhar' : ''}{p.restricao.inclinacaoGraus ? ` (± ${String(p.restricao.inclinacaoGraus).replace('.', ',')}° de inclinação)` : ''}
                    </td>
                    <td>
                      {escreverM(p.larguraMm)} × {escreverM(p.comprimentoMm)}
                      {p.abertaNaSimetria ? ' (aberta na simetria)' : ''}
                    </td>
                    <td>
                      {p.origem ? `${p.origem.arquivo} (${p.origem.formato.toUpperCase()}, ${p.origem.unidade})` : 'desenhada'}
                      {p.alteradaDesdeAImportacao ? ' — mudada depois de importada' : ''}
                    </td>
                    <td>
                      <button type="button" onClick={() => props.onAbrirPeca(p.idsNoProjeto[0]!)}>
                        Abrir a peça
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="nota-do-formulario">
              A quantidade é por peça de roupa (2 mangas, 1 frente). Ela só vale para o plano: o projeto não muda. As peças entram no programa por DXF (polilinhas, blocos, arcos) ou PDF vetorial (Arquivo &gt; Importar), ou desenhadas.
            </p>
            {modelo.problemas.length > 0 && (
              <ul className="alertas-do-plano" aria-label="Problemas do molde">
                {modelo.problemas.map((p, i) => (
                  <li key={i} className={`alerta-do-plano alerta-${p.nivel}`}>
                    {p.texto}
                    {p.pecaId && (
                      <>
                        {' '}
                        <button type="button" onClick={() => props.onAbrirPeca(p.pecaId!)}>
                          Abrir a peça
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Faltas titulo="Para planejar, corrija:" itens={errosDoMolde} />
          </section>
        )}

        {etapa === 'ordem' && (
          <section aria-label="Ordem de produção">
            <label>
              Ordem
              <select
                value={ordemEscolhida}
                onChange={(e) => {
                  const id = e.target.value;
                  setOrdemEscolhida(id);
                  setConfirmarTrocaDaOrdem(false);
                  const o = cadastro.ordens.find((x) => x.id === id);
                  setFormOrdem(o ? ordemNoFormulario(o) : ORDEM_VAZIA);
                }}
              >
                <option value={NOVA}>Nova ordem (informar abaixo)</option>
                {cadastro.ordens.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo}
                    {o.produto ? ` — ${o.produto}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="grade-do-plano">
              <Campo obrigatorio rotulo="Código da ordem" valor={formOrdem.codigo} onMudar={(v) => setFormOrdem({ ...formOrdem, codigo: v })} />
              <Campo rotulo="Produto" valor={formOrdem.produto} onMudar={(v) => setFormOrdem({ ...formOrdem, produto: v })} />
              <Campo rotulo="Cor" valor={formOrdem.cor} onMudar={(v) => setFormOrdem({ ...formOrdem, cor: v })} />
              <Campo rotulo="Prazo" tipo="date" valor={formOrdem.prazo} onMudar={(v) => setFormOrdem({ ...formOrdem, prazo: v })} />
              <Campo rotulo="Observações" tipo="text" valor={formOrdem.observacoes} onMudar={(v) => setFormOrdem({ ...formOrdem, observacoes: v })} />
            </div>
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>Quantidade por tamanho</legend>
              {tamanhosDaOrdem.map((t) => (
                <Campo key={t} rotulo={t} valor={formOrdem.quantidades[t] ?? ''} onMudar={(v) => setFormOrdem({ ...formOrdem, quantidades: { ...formOrdem.quantidades, [t]: v } })} />
              ))}
              <p className="nota-do-formulario">
                Total: {Object.values(ordemLida.ordem?.quantidadesPorTamanho ?? {}).reduce((s, n) => s + n, 0)} peça(s) de roupa.
              </p>
            </fieldset>
            <label>
              Colar da planilha (tamanhos e quantidades)
              <textarea rows={2} value={colado} onChange={(e) => setColado(e.target.value)} placeholder={'P\tM\tG\n40\t80\t40'} />
            </label>
            <button
              type="button"
              onClick={() => {
                const lida = lerGradeColada(colado);
                if (lida.erros.length > 0) {
                  setMensagem(lida.erros.join(' '));
                  return;
                }
                setFormOrdem({ ...formOrdem, quantidades: Object.fromEntries(Object.entries(lida.quantidades).map(([t, n]) => [t, String(n)])) });
                setMensagem(`Grade lida: ${Object.entries(lida.quantidades).map(([t, n]) => `${n} ${t}`).join(', ')}.`);
              }}
            >
              Ler a grade colada
            </button>{' '}
            <button type="button" onClick={guardarOrdem}>
              {cadastro.ordens.some((o) => o.id === ordemEscolhida) ? 'Guardar as mudanças da ordem' : 'Guardar a ordem no cadastro'}
            </button>
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>Importar ordens (CSV)</legend>
              <label>
                Arquivo CSV das ordens
                <input
                  type="file"
                  accept=".csv,.txt,text/csv"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) void importarCsv(arquivo);
                    e.target.value = '';
                  }}
                />
              </label>
              <details>
                <summary>O formato do arquivo</summary>
                <p className="nota-do-formulario">
                  Uma linha de cabeçalho e uma linha por ordem, separadas por ponto e vírgula (ou vírgula, ou tabulação). Colunas: codigo (obrigatória), produto, cor, prazo (AAAA-MM-DD ou DD/MM/AAAA),
                  observacoes, molde (o código deste projeto), revisao (o número da revisão do molde); as outras colunas são os tamanhos, com a quantidade de cada um. Exemplo:
                </p>
                <pre className="exemplo-de-csv">{`codigo;produto;cor;prazo;${modelo.tamanhos.join(';')}\nOP-100;Camiseta;Azul;2026-11-30;${modelo.tamanhos.map(() => '10').join(';')}`}</pre>
                <p className="nota-do-formulario">Tudo ou nada: com um erro em qualquer linha, nenhuma ordem entra, e cada erro diz a linha. {ERP_NAO_CONFIGURADO}</p>
              </details>
              {errosDoCsv.length > 0 && <Faltas titulo="O CSV não foi importado:" itens={errosDoCsv} />}
            </fieldset>
            {props.onSalvarTexto && (
              <fieldset className="grupo-de-opcoes-do-formulario">
                <legend>Etiquetas dos feixes</legend>
                <label>
                  Roupas por feixe
                  <input type="number" min={1} step={1} value={roupasPorFeixe} onChange={(e) => setRoupasPorFeixe(e.target.value)} />
                </label>
                <p className="acoes-da-fila">
                  <button type="button" onClick={() => void salvarEtiquetas('html')}>
                    Salvar as etiquetas (HTML, para imprimir)
                  </button>
                  <button type="button" onClick={() => void salvarEtiquetas('csv')}>
                    Salvar a lista (CSV)
                  </button>
                </p>
              </fieldset>
            )}
            {acessoAoErp && (
              <fieldset className="grupo-de-opcoes-do-formulario troca-com-o-erp">
                <legend>Troca com o ERP (pasta)</legend>
                <p className="nota-do-formulario">
                  {pastaDoErp ? (
                    <>
                      Pasta: <strong>{pastaDoErp}</strong>.
                    </>
                  ) : (
                    'Nenhuma pasta escolhida.'
                  )}{' '}
                  O ERP deixa as ordens em CSV na subpasta "entrada", com o nome começando pelo código do molde ({props.projeto.codigo || 'o código'}_ordens.csv). A troca importa as deste molde e
                  as dos outros moldes da biblioteca (tudo ou nada por arquivo) e deixa em "saida" as ordens com a situação do corte, os rolos, os movimentos de estoque, os cortes e o consumo por malha.
                </p>
                <p className="acoes-da-fila">
                  <button type="button" onClick={() => void escolherAPastaDoErp()}>
                    {pastaDoErp ? 'Trocar de pasta…' : 'Escolher a pasta…'}
                  </button>
                  <button type="button" disabled={!pastaDoErp || trocandoComOErp} onClick={() => void trocarComOErpAgora()}>
                    {trocandoComOErp ? 'Trocando…' : 'Trocar com o ERP agora'}
                  </button>
                  {pastaDoErp && (
                    <button type="button" onClick={() => void esquecerAPastaDoErp()}>
                      Deixar de usar a pasta
                    </button>
                  )}
                </p>
                {pastaDoErp && (
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={trocaAutomatica} onChange={(e) => setTrocaAutomatica(e.target.checked)} />
                    Trocar sozinho a cada 5 minutos, enquanto esta janela estiver aberta
                  </label>
                )}
                {recusadosNaTroca.length > 0 && <Faltas titulo="Arquivos recusados (nenhuma ordem deles entrou):" itens={recusadosNaTroca} />}
              </fieldset>
            )}
            {confirmarTrocaDaOrdem && (
              <p role="alert" className="faltas-do-plano">
                A ordem {formOrdem.codigo} já está no cadastro: guardar troca o que está lá pelo que está na tela.{' '}
                <button type="button" onClick={guardarOrdem}>
                  Trocar a ordem no cadastro
                </button>{' '}
                <button type="button" onClick={() => setConfirmarTrocaDaOrdem(false)}>
                  Não trocar
                </button>
              </p>
            )}
            <Faltas
              titulo="Para planejar, falta:"
              itens={[...ordemLida.erros, ...(tamanhosForaDoMolde.length > 0 ? [`A ordem pede tamanho(s) que o molde não tem: ${tamanhosForaDoMolde.join(', ')}.`] : [])]}
            />
          </section>
        )}

        {etapa === 'malha' && (
          <section aria-label="Malha e rolos">
            <label>
              Malha
              <select
                value={malhaEscolhida}
                onChange={(e) => {
                  const id = e.target.value;
                  setMalhaEscolhida(id);
                  setRolosEscolhidos(new Set());
                  const m = cadastro.malhas.find((x) => x.id === id);
                  setFormMalha(m ? malhaNoFormulario(m) : id === DO_PROJETO && props.tecidoDoProjeto ? malhaDoTecido(props.tecidoDoProjeto) : MALHA_VAZIA);
                }}
              >
                {props.tecidoDoProjeto && <option value={DO_PROJETO}>O tecido do projeto ({props.tecidoDoProjeto.nome})</option>}
                {cadastro.malhas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.descricao}
                  </option>
                ))}
                <option value={NOVA}>Outra (informar abaixo)</option>
              </select>
            </label>
            <div className="grade-do-plano">
              <Campo obrigatorio rotulo="Descrição da malha" tipo="text" valor={formMalha.descricao} onMudar={(v) => setFormMalha({ ...formMalha, descricao: v })} />
              <Campo rotulo="Composição" tipo="text" valor={formMalha.composicao} onMudar={(v) => setFormMalha({ ...formMalha, composicao: v })} />
              <Campo rotulo="Título do fio" tipo="text" valor={formMalha.tituloDoFio} onMudar={(v) => setFormMalha({ ...formMalha, tituloDoFio: v })} />
              <Campo rotulo="Gramatura (g/m²)" valor={formMalha.gramatura} onMudar={(v) => setFormMalha({ ...formMalha, gramatura: v })} />
              <Campo rotulo="Largura nominal (m)" valor={formMalha.larguraNominal} onMudar={(v) => setFormMalha({ ...formMalha, larguraNominal: v })} />
              <Campo obrigatorio rotulo="Largura útil (m)" valor={formMalha.larguraUtil} onMudar={(v) => setFormMalha({ ...formMalha, larguraUtil: v })} />
              <Campo rotulo="Rendimento (m/kg)" valor={formMalha.rendimento} onMudar={(v) => setFormMalha({ ...formMalha, rendimento: v })} />
              <label>
                Tipo de tecido
                <select value={formMalha.tipoDeTecido} onChange={(e) => setFormMalha({ ...formMalha, tipoDeTecido: e.target.value as TipoDeTecido | '' })}>
                  <option value="">Não informado</option>
                  {(Object.keys(ROTULO_DO_TIPO_DE_TECIDO) as TipoDeTecido[]).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_DO_TIPO_DE_TECIDO[t]}
                    </option>
                  ))}
                </select>
              </label>
              <Campo rotulo="Custo da malha (R$, opcional)" valor={formMalha.custo} onMudar={(v) => setFormMalha({ ...formMalha, custo: v })} dica="Só para a estimativa de custo do plano. Em branco, nada muda." />
              <label>
                Unidade do custo
                <select value={formMalha.unidadeDoCusto} onChange={(e) => setFormMalha({ ...formMalha, unidadeDoCusto: e.target.value as UnidadeDoCusto | '' })}>
                  <option value="">(escolha)</option>
                  {(Object.keys(ROTULO_DA_UNIDADE_DO_CUSTO) as UnidadeDoCusto[]).map((u) => (
                    <option key={u} value={u}>
                      {ROTULO_DA_UNIDADE_DO_CUSTO[u]}
                    </option>
                  ))}
                </select>
              </label>
              <Campo rotulo="Espessura da folha (mm)" valor={formMalha.espessura} onMudar={(v) => setFormMalha({ ...formMalha, espessura: v })} />
              <Campo rotulo="Encolhimento no comprimento (%)" valor={formMalha.encolhimentoComprimento} onMudar={(v) => setFormMalha({ ...formMalha, encolhimentoComprimento: v })} />
              <Campo rotulo="Encolhimento na largura (%)" valor={formMalha.encolhimentoLargura} onMudar={(v) => setFormMalha({ ...formMalha, encolhimentoLargura: v })} />
              <Campo rotulo="Tolerância de largura (mm)" valor={formMalha.tolerancia} onMudar={(v) => setFormMalha({ ...formMalha, tolerancia: v })} />
              <label>
                Fonte do encolhimento
                <select value={formMalha.fonteDoEncolhimento} onChange={(e) => setFormMalha({ ...formMalha, fonteDoEncolhimento: e.target.value as FonteDoEncolhimento | '' })}>
                  <option value="">(não informada)</option>
                  {(Object.keys(ROTULO_DA_FONTE_DO_ENCOLHIMENTO) as FonteDoEncolhimento[]).map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_DA_FONTE_DO_ENCOLHIMENTO[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Padrão
                <select value={formMalha.padrao} onChange={(e) => setFormMalha({ ...formMalha, padrao: e.target.value as FormularioDaMalha['padrao'] })}>
                  <option value="liso">Liso</option>
                  <option value="listrado">Listrado</option>
                  <option value="xadrez">Xadrez</option>
                </select>
              </label>
            </div>
            <label className="opcao-em-linha">
              <input type="checkbox" checked={formMalha.sentidoUnico} onChange={(e) => setFormMalha({ ...formMalha, sentidoUnico: e.target.checked })} />
              Sentido único (pelo ou estampa com sentido)
            </label>
            <label className="opcao-em-linha">
              <input type="checkbox" checked={formMalha.compensadoNoMolde} onChange={(e) => setFormMalha({ ...formMalha, compensadoNoMolde: e.target.checked })} />
              O encolhimento já está compensado no molde
            </label>
            <button type="button" onClick={guardarMalha}>
              {cadastro.malhas.some((m) => m.id === malhaEscolhida) ? 'Guardar as mudanças da malha' : 'Guardar a malha no cadastro'}
            </button>
            {malhaLida.malha && malhaLida.malha.rendimentoMmPorG !== undefined && malhaLida.malha.gramaturaGm2 !== undefined && (
              <div role="radiogroup" aria-label="Rendimento principal" className="grupo-de-opcoes-do-formulario">
                <p className="nota-do-formulario">Com o rendimento e a gramatura informados, o plano usa:</p>
                <label className="opcao-em-linha">
                  <input type="radio" checked={rendimentoPrincipal === 'informado'} onChange={() => setRendimentoPrincipal('informado')} /> o rendimento informado
                </label>
                <label className="opcao-em-linha">
                  <input type="radio" checked={rendimentoPrincipal === 'calculado'} onChange={() => setRendimentoPrincipal('calculado')} /> o calculado pela largura e gramatura
                </label>
              </div>
            )}
            {formMalha.padrao !== 'liso' && (
              <div className="grade-do-plano">
                <Campo rotulo="Repetição do desenho no comprimento (cm)" valor={formMalha.rapportComprimento} onMudar={(v) => setFormMalha({ ...formMalha, rapportComprimento: v })} />
                <Campo rotulo="Fase do desenho no comprimento (cm)" valor={formMalha.faseComprimento} onMudar={(v) => setFormMalha({ ...formMalha, faseComprimento: v })} />
                <Campo rotulo="Repetição do desenho na largura (cm)" valor={formMalha.rapportLargura} onMudar={(v) => setFormMalha({ ...formMalha, rapportLargura: v })} />
                <Campo rotulo="Fase do desenho na largura (cm)" valor={formMalha.faseLargura} onMudar={(v) => setFormMalha({ ...formMalha, faseLargura: v })} />
              </div>
            )}
            {formMalha.padrao !== 'liso' && (
              <label className="opcao-em-linha">
                <input type="checkbox" checked={aceitarPadrao} onChange={(e) => setAceitarPadrao(e.target.checked)} />O casamento das listras/xadrez será feito à parte (o programa não casa)
              </label>
            )}
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>Material</legend>
              <label className="opcao-em-linha">
                <input type="radio" checked={material === 'rolos'} onChange={() => setMaterial('rolos')} /> Rolos do estoque
              </label>
              <label className="opcao-em-linha">
                <input type="radio" checked={material === 'peso'} onChange={() => setMaterial('peso')} /> Peso total (sem rolos)
              </label>
              {material === 'peso' && <Campo obrigatorio rotulo="Peso disponível (kg)" valor={pesoTexto} onMudar={setPesoTexto} />}
              {material === 'rolos' && (
                <>
                  {rolosDaMalha.length === 0 ? (
                    <p className="nota-do-formulario">Nenhum rolo desta malha no estoque{malhaEscolhida === NOVA || malhaEscolhida === DO_PROJETO ? ' (guarde a malha no cadastro para cadastrar rolos dela)' : ''}.</p>
                  ) : (
                    <table className="tabela-de-relatorio">
                      <caption>Rolos da malha no estoque</caption>
                      <thead>
                        <tr>
                          <th scope="col">Usar</th>
                          <th scope="col">Rolo</th>
                          <th scope="col">Lote · tonalidade</th>
                          <th scope="col">Peso</th>
                          <th scope="col">Comprimento medido</th>
                          <th scope="col">Largura medida</th>
                          <th scope="col">Disponível / reservado / consumido</th>
                          <th scope="col">Defeitos</th>
                          <th scope="col">Local / medição</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {rolosDaMalha.map((r: RoloDeEstoque) => (
                          <tr key={r.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Usar o rolo ${r.identificacao}`}
                                checked={rolosEscolhidos.has(r.id)}
                                onChange={(e) => {
                                  const s = new Set(rolosEscolhidos);
                                  if (e.target.checked) s.add(r.id);
                                  else s.delete(r.id);
                                  setRolosEscolhidos(s);
                                }}
                              />
                            </td>
                            <td>
                              {r.identificacao}
                              {r.retalho ? ' (retalho)' : ''}
                            </td>
                            <td>{grupoDoRolo(r)}</td>
                            <td>{r.pesoLiquidoG !== undefined ? `${noCampo(r.pesoLiquidoG / 1000, 2)} kg` : '—'}</td>
                            <td>{r.comprimentoMedidoMm !== undefined ? escreverM(r.comprimentoMedidoMm) : '— (sai do peso)'}</td>
                            <td>{r.larguraUtilMedidaMm !== undefined ? escreverM(r.larguraUtilMedidaMm) : '— (a da malha)'}</td>
                            <td>
                              {(() => {
                                const e = estadoDoRolo(cadastro, r, planoEmEdicao?.id);
                                const m = (v: number | null): string => (v === null ? '—' : escreverM(v));
                                return `${m(e.disponivelMm)} / ${escreverM(e.reservadoMm)} / ${escreverM(e.consumidoMm)}${e.origem === 'pelo peso' ? ' (estimado pelo peso)' : ''}`;
                              })()}
                            </td>
                            <td>
                              {r.defeitos.length > 0
                                ? r.defeitos
                                    .map((d) => `${d.tipo ? ROTULO_DO_DEFEITO[d.tipo] : d.descricao}: ${escreverM(d.perdaMm)}${d.posicaoMm !== undefined ? ` a ${escreverM(d.posicaoMm)} do começo` : ' (sem posição)'}${d.larguraAfetadaMm !== undefined ? `, ${(d.larguraAfetadaMm / 10).toFixed(1).replace('.', ',')} cm de largura` : ''}`)
                                    .join('; ')
                                : '—'}
                            </td>
                            <td>
                              {[r.localizacao, r.origemDaMedicao, r.dataDaMedicao?.split('-').reverse().join('/')].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td>
                              {roloARemover === r.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRoloARemover(null);
                                      void mudarCadastro(() => removerRolo(cadastro, r.id), `Rolo ${r.identificacao} tirado do estoque.`);
                                    }}
                                  >
                                    Tirar mesmo
                                  </button>{' '}
                                  <button type="button" onClick={() => setRoloARemover(null)}>
                                    Não
                                  </button>
                                </>
                              ) : (
                                <button type="button" onClick={() => setRoloARemover(r.id)}>
                                  Tirar do estoque
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={misturarGrupos} onChange={(e) => setMisturarGrupos(e.target.checked)} />
                    Misturar lotes/tonalidades neste plano (decisão de quem planeja)
                  </label>
                  {rolosComDefeitoSemPosicao.length > 0 && (
                    <label className="opcao-em-linha">
                      <input type="checkbox" checked={aceitarDefeitos} onChange={(e) => setAceitarDefeitos(e.target.checked)} />
                      Usar os rolos com defeito sem posição ({rolosComDefeitoSemPosicao.map((r) => r.identificacao).join(', ')}): o defeito NÃO é evitado e será tratado no enfesto (decisão de quem planeja)
                    </label>
                  )}
                  <details>
                    <summary>Cadastrar um rolo desta malha</summary>
                    <div className="grade-do-plano">
                      <Campo rotulo="Identificação do rolo" tipo="text" valor={formRolo.identificacao} onMudar={(v) => setFormRolo({ ...formRolo, identificacao: v })} />
                      <Campo rotulo="Peso líquido (kg)" valor={formRolo.peso} onMudar={(v) => setFormRolo({ ...formRolo, peso: v })} />
                      <Campo rotulo="Comprimento medido (m)" valor={formRolo.comprimento} onMudar={(v) => setFormRolo({ ...formRolo, comprimento: v })} />
                      <Campo rotulo="Largura útil medida (m)" valor={formRolo.largura} onMudar={(v) => setFormRolo({ ...formRolo, largura: v })} />
                      <Campo rotulo="Lote" tipo="text" valor={formRolo.lote} onMudar={(v) => setFormRolo({ ...formRolo, lote: v })} />
                      <Campo rotulo="Tonalidade" tipo="text" valor={formRolo.tonalidade} onMudar={(v) => setFormRolo({ ...formRolo, tonalidade: v })} />
                      <Campo rotulo="Defeito" tipo="text" valor={formRolo.defeito} onMudar={(v) => setFormRolo({ ...formRolo, defeito: v })} />
                      <label>
                        Tipo do defeito
                        <select value={formRolo.tipoDoDefeito} onChange={(e) => setFormRolo({ ...formRolo, tipoDoDefeito: e.target.value as TipoDeDefeito | '' })}>
                          <option value="">(não informado)</option>
                          {(Object.keys(ROTULO_DO_DEFEITO) as TipoDeDefeito[]).map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {ROTULO_DO_DEFEITO[tipo]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Campo rotulo="Extensão do defeito (m)" valor={formRolo.perdaDoDefeito} onMudar={(v) => setFormRolo({ ...formRolo, perdaDoDefeito: v })} />
                      <Campo rotulo="Posição do defeito (m, do começo do rolo)" valor={formRolo.posicaoDoDefeito} onMudar={(v) => setFormRolo({ ...formRolo, posicaoDoDefeito: v })} />
                      <Campo rotulo="Largura afetada (cm)" valor={formRolo.larguraDoDefeito} onMudar={(v) => setFormRolo({ ...formRolo, larguraDoDefeito: v })} />
                      <Campo rotulo="Localização" tipo="text" valor={formRolo.localizacao} onMudar={(v) => setFormRolo({ ...formRolo, localizacao: v })} />
                      <Campo rotulo="Origem da medição" tipo="text" valor={formRolo.origem} onMudar={(v) => setFormRolo({ ...formRolo, origem: v })} />
                      <Campo rotulo="Data da medição" tipo="date" valor={formRolo.data} onMudar={(v) => setFormRolo({ ...formRolo, data: v })} />
                    </div>
                    <button type="button" onClick={cadastrarRolo}>
                      Cadastrar o rolo
                    </button>
                  </details>
                </>
              )}
            </fieldset>
            <Faltas titulo="Para planejar, falta:" itens={[...malhaLida.erros, ...(material === 'peso' ? pesoLido.erros : rolosSelecionados.length === 0 ? ['Escolha os rolos do plano (ou use o peso disponível).'] : [])]} />
          </section>
        )}

        {etapa === 'risco' && (
          <section aria-label="Risco e enfesto">
            <label>
              Tipo de enfesto
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeEnfesto)}>
                {(Object.keys(ROTULO_DO_TIPO) as TipoDeEnfesto[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_DO_TIPO[t]}
                  </option>
                ))}
              </select>
            </label>
            <ul className="nota-do-formulario">
              <li>{DEFINICOES.folha}</li>
              <li>{DEFINICOES.camada}</li>
              <li>{DEFINICOES.enfesto}</li>
              <li>{DEFINICOES.risco}</li>
            </ul>
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>De onde vem o risco</legend>
              <label className="opcao-em-linha">
                <input type="radio" checked={fonte === 'gerar'} onChange={() => setFonte('gerar')} /> Gerar os riscos (o programa encaixa as peças do molde)
              </label>
              <label className="opcao-em-linha">
                <input type="radio" checked={fonte === 'mesa'} onChange={() => setFonte('mesa')} disabled={!riscoDaMesaBase} /> Usar o encaixe que está na mesa
              </label>
              <label className="opcao-em-linha">
                <input type="radio" checked={fonte === 'informado'} onChange={() => setFonte('informado')} /> Informar um risco existente (feito à mão ou em outro programa)
              </label>
              {fonte === 'mesa' && riscoDaMesaBase && (
                <>
                  <p className="nota-do-formulario">
                    O encaixe da mesa: {escreverM(riscoDaMesaBase.comprimentoMm)} de comprimento, {escreverM(riscoDaMesaBase.larguraMm)} de largura ocupada. Roupas de cada tamanho por folha (deduzidas pela
                    peça que menos se repete — confira):
                  </p>
                  {tamanhosDaTela.map((t) => (
                    <Campo key={t} rotulo={`Roupas do ${t} por folha`} valor={gradeDaMesa[t] ?? ''} onMudar={(v) => setGradeDaMesa({ ...gradeDaMesa, [t]: v })} />
                  ))}
                </>
              )}
              {fonte === 'informado' && (
                <>
                  <Campo obrigatorio rotulo="Comprimento do risco (m)" valor={informado.comprimento} onMudar={(v) => setInformado({ ...informado, comprimento: v })} />
                  <Campo obrigatorio rotulo="Largura ocupada do risco (m)" valor={informado.largura} onMudar={(v) => setInformado({ ...informado, largura: v })} />
                  {tamanhosDaTela.map((t) => (
                    <Campo key={t} rotulo={`Roupas do ${t} por folha`} valor={informado.grade[t] ?? ''} onMudar={(v) => setInformado({ ...informado, grade: { ...informado.grade, [t]: v } })} />
                  ))}
                  <p className="nota-do-formulario">Sem o desenho, o programa não confere o risco: o resultado depende do que foi informado.</p>
                </>
              )}
            </fieldset>
            <Campo
              rotulo="Largura do risco (m)"
              valor={larguraDoRiscoTexto}
              onMudar={setLarguraDoRiscoTexto}
              dica="Em branco, vale a largura da malha na mesa (a largura útil; no enfesto par, a metade)."
            />
            <p className="nota-do-formulario">
              {larguraPadraoDoRiscoMm !== null
                ? `Em branco, vale ${escreverM(larguraPadraoDoRiscoMm)} (a largura útil da malha${tipo === 'par' && formMalha.tipoDeTecido !== 'tubular' ? ', dobrada ao meio no enfesto par' : ''}).`
                : 'Informe a largura útil da malha (etapa 3).'}{' '}
              {material === 'rolos' && rolosSelecionados.some((r) => r.larguraUtilMedidaMm !== undefined) && (
                <button
                  type="button"
                  onClick={() => {
                    const menor = Math.min(...rolosSelecionados.filter((r) => r.larguraUtilMedidaMm !== undefined).map((r) => larguraNaMesa(r.larguraUtilMedidaMm!, tipo, formMalha.tipoDeTecido === 'tubular')));
                    setLarguraDoRiscoTexto(noCampo(menor / 1000));
                  }}
                >
                  Usar a largura do rolo mais estreito escolhido
                </button>
              )}
            </p>
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>Configuração (fica guardada neste computador)</legend>
              <div className="grade-do-plano">
                <Campo obrigatorio rotulo="Margem no começo da mesa (cm)" valor={formConfig.margemInicial} onMudar={(v) => setFormConfig({ ...formConfig, margemInicial: v })} />
                <Campo obrigatorio rotulo="Margem no fim da mesa (cm)" valor={formConfig.margemFinal} onMudar={(v) => setFormConfig({ ...formConfig, margemFinal: v })} />
                <Campo obrigatorio rotulo="Pontas por camada (cm)" valor={formConfig.sobra} onMudar={(v) => setFormConfig({ ...formConfig, sobra: v })} />
                <Campo obrigatorio rotulo="Perda por rolo (cm)" valor={formConfig.perdaPorRolo} onMudar={(v) => setFormConfig({ ...formConfig, perdaPorRolo: v })} />
                <Campo obrigatorio rotulo="Folhas por enfesto (máximo)" valor={formConfig.folhas} onMudar={(v) => setFormConfig({ ...formConfig, folhas: v })} />
                <Campo rotulo="Altura máxima do enfesto (cm)" valor={formConfig.alturaMaxima} onMudar={(v) => setFormConfig({ ...formConfig, alturaMaxima: v })} />
                <Campo rotulo="Peso máximo do enfesto (kg)" valor={formConfig.pesoMaximo} onMudar={(v) => setFormConfig({ ...formConfig, pesoMaximo: v })} />
                <Campo obrigatorio rotulo="Comprimento da mesa (m)" valor={formConfig.comprimentoDaMesa} onMudar={(v) => setFormConfig({ ...formConfig, comprimentoDaMesa: v })} />
                <Campo rotulo="Largura da mesa (m)" valor={formConfig.larguraDaMesa} onMudar={(v) => setFormConfig({ ...formConfig, larguraDaMesa: v })} />
                <Campo obrigatorio rotulo="Roupas por risco (máximo)" valor={formConfig.roupasPorRisco} onMudar={(v) => setFormConfig({ ...formConfig, roupasPorRisco: v })} />
                <Campo obrigatorio rotulo="Distância entre as peças (mm)" valor={formConfig.distancia} onMudar={(v) => setFormConfig({ ...formConfig, distancia: v })} />
                <Campo obrigatorio rotulo="Tolerância de rendimento (%)" valor={formConfig.tolerancia} onMudar={(v) => setFormConfig({ ...formConfig, tolerancia: v })} />
                <Campo obrigatorio rotulo="Tempo da busca dos riscos (s)" valor={formConfig.tempo} onMudar={(v) => setFormConfig({ ...formConfig, tempo: v })} />
                <Campo obrigatorio rotulo="Sobreposição da emenda (cm)" valor={formConfig.sobreposicaoDaEmenda} onMudar={(v) => setFormConfig({ ...formConfig, sobreposicaoDaEmenda: v })} />
              </div>
              <label className="opcao-em-linha">
                <input type="checkbox" checked={formConfig.permitirEmendas} onChange={(e) => setFormConfig({ ...formConfig, permitirEmendas: e.target.checked })} />
                A enfestadeira/o processo permite emendar uma camada (a camada que não cabe no que resta do rolo — até o fim dele ou até um defeito — continua no rolo seguinte, numa linha do risco sem peça cortada)
              </label>
            </fieldset>
            <fieldset className="grupo-de-opcoes-do-formulario">
              <legend>Encolhimento</legend>
              {!fatores || 'erro' in fatores ? (
                <p className="nota-do-formulario">{fatores && 'erro' in fatores ? fatores.erro : 'Informe a malha (etapa 3).'}</p>
              ) : fonte === 'informado' ? (
                <p className="nota-do-formulario">O risco informado à mão já é a medida do corte: a compensação não se aplica a ele.</p>
              ) : compensar ? (
                <p className="nota-do-formulario">
                  Compensação aplicada ao risco: comprimento × {fatores.comprimento.toFixed(4).replace('.', ',')}, largura × {fatores.largura.toFixed(4).replace('.', ',')}.{' '}
                  <button type="button" onClick={() => setCompensar(false)}>
                    Tirar a compensação
                  </button>
                </p>
              ) : previaDaCompensacao ? (
                <div>
                  <table className="tabela-de-relatorio">
                    <caption>Prévia: as peças antes e depois da compensação (a linha de corte)</caption>
                    <thead>
                      <tr>
                        <th scope="col">Peça</th>
                        <th scope="col">Antes (largura × comprimento)</th>
                        <th scope="col">Depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelo.pecas.map((p) => {
                        const depois = medidasCompensadas(p.larguraMm, p.comprimentoMm, fatores);
                        return (
                          <tr key={p.id}>
                            <td>{p.nome}</td>
                            <td>
                              {escreverM(p.larguraMm)} × {escreverM(p.comprimentoMm)}
                            </td>
                            <td>
                              {escreverM(depois.larguraMm)} × {escreverM(depois.comprimentoMm)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => {
                      setCompensar(true);
                      setPreviaDaCompensacao(false);
                    }}
                  >
                    Aplicar a compensação ao risco
                  </button>{' '}
                  <button type="button" onClick={() => setPreviaDaCompensacao(false)}>
                    Não compensar
                  </button>
                </div>
              ) : (
                <p className="nota-do-formulario">
                  Encolhimento da malha: {fatores.encolhimentoComprimentoPercentual.toFixed(1).replace('.', ',')}% no comprimento e {fatores.encolhimentoLarguraPercentual.toFixed(1).replace('.', ',')}% na largura, NÃO
                  compensado no molde.{' '}
                  <button type="button" onClick={() => setPreviaDaCompensacao(true)}>
                    Ver a prévia da compensação no risco
                  </button>
                </p>
              )}
            </fieldset>
            {formMalha.padrao !== 'liso' && (
              <fieldset className="grupo-de-opcoes-do-formulario">
                <legend>Listras e xadrez</legend>
                {aceitarPadrao ? (
                  <p className="nota-do-formulario">Casamento feito à parte (decisão de quem planeja): o risco não casa o desenho, e precisa ser conferido à mão.</p>
                ) : casamento ? (
                  <p className="nota-do-formulario">
                    O risco vai casar o desenho: o ponto "{ROTULO_DO_PONTO_DE_CASAMENTO}" de cada peça cai na repetição
                    {casamento.rapportComprimentoMm ? ` de ${emCm(casamento.rapportComprimentoMm)} no comprimento` : ''}
                    {casamento.rapportLarguraMm ? ` e de ${emCm(casamento.rapportLarguraMm)} na largura` : ''}; as peças não deitam. Para casar por
                    mais de um ponto, use marcas de grupo: "casamento: manga" na cava da frente e na cabeça da manga — a manga
                    cai na mesma listra que a cava, e a peça com o ponto "casamento" dá a fase do grupo.
                    {pecasSemMarcaDeCasamento.length > 0 ? ` Faltam a marca "${ROTULO_DO_PONTO_DE_CASAMENTO}" em: ${pecasSemMarcaDeCasamento.join(', ')} (aba Marcações) — sem ela, o risco não sai.` : ''}
                  </p>
                ) : (
                  <p className="nota-do-formulario">Falta a repetição do desenho no cadastro da malha (etapa 3): sem ela, o casamento não é automático — informe-a, ou marque que o casamento será feito à parte.</p>
                )}
              </fieldset>
            )}
            <Faltas titulo="Para calcular, falta:" itens={[...entrada.faltas, ...errosDaFonte]} />
            <button type="button" className="botao-primario" disabled={!entrada.entrada || errosDaFonte.length > 0} onClick={calcularAlternativas}>
              {fonte === 'gerar' ? 'Calcular as alternativas' : 'Calcular o plano'}
            </button>
          </section>
        )}

        {etapa === 'alternativas' && (
          <section aria-label="Alternativas">
            {baseDoRascunho && (
              <p className="nota-do-formulario">
                Em revisão está o plano guardado (os riscos dele).{' '}
                <button type="button" onClick={largarRascunho}>
                  Usar as alternativas daqui
                </button>
              </p>
            )}
            {fonte !== 'gerar' ? (
              base && !baseDoRascunho ? (
                <>
                  <p className="resumo-do-plano">{base.criterio}</p>
                  <DesenhoDoRisco risco={base.riscos[0]!} tamanhos={tamanhosDaTela} />
                  <button type="button" onClick={() => navegar('revisar')}>
                    Revisar e confirmar
                  </button>
                </>
              ) : (
                <Faltas titulo="Para calcular, falta:" itens={[...entrada.faltas, ...errosDaFonte]} />
              )
            ) : progresso ? (
              <p role="status">
                Fazendo os riscos: {progresso.feitos} de {progresso.total}…{' '}
                <button type="button" onClick={() => cancelarRef.current?.()}>
                  Cancelar
                </button>
              </p>
            ) : !busca ? (
              <p className="nota-do-formulario">Calcule as alternativas na etapa 4.</p>
            ) : (
              <>
                {buscaDesatualizada && (
                  <p role="alert" className="faltas-do-plano">
                    Os dados mudaram depois desta busca (molde, quantidades, ordem, largura, distância ou mesa): calcule as alternativas de novo.{' '}
                    <button type="button" onClick={calcularAlternativas}>
                      Calcular de novo
                    </button>
                  </p>
                )}
                <p className="nota-do-formulario">
                  {montadas?.avaliadas ?? 0} composição(ões) avaliada(s); {busca.resultado.feitos.length} risco(s) feito(s) em {(busca.resultado.tempoMs / 1000).toFixed(1).replace('.', ',')} s
                  {busca.resultado.naoSairam.length > 0 ? `; ${busca.resultado.naoSairam.length} não saíram` : ''}
                  {busca.resultado.semTempo.length > 0 ? `; ${busca.resultado.semTempo.length} não foram tentados (${busca.resultado.cancelada ? 'busca cancelada' : 'o tempo da busca acabou'})` : ''}. Método:{' '}
                  {METODO_DO_RISCO}
                </p>
                {montadas && montadas.errosComuns.length > 0 && <Faltas titulo="Nenhuma composição calcula:" itens={montadas.errosComuns} />}
                {montadas && montadas.alternativas.length === 0 && montadas.errosComuns.length === 0 && (
                  <Faltas titulo="Nenhuma composição saiu:" itens={montadas.descartadas.map((d) => `${d.origem}: ${d.motivo}`)} />
                )}
                {montadas && montadas.alternativas.length > 0 && (
                  <table className="tabela-de-relatorio">
                    <caption>Alternativas (escolha uma)</caption>
                    <thead>
                      <tr>
                        <th scope="col">Escolher</th>
                        <th scope="col">Critério</th>
                        <th scope="col">Riscos (roupas por folha × camadas)</th>
                        <th scope="col">Comprimento</th>
                        <th scope="col">Eficiência média</th>
                        <th scope="col">Mesa</th>
                        <th scope="col">Camadas / folhas / enfestos</th>
                        <th scope="col">Consumo</th>
                        <th scope="col">Sobra</th>
                        <th scope="col">Excedente</th>
                        <th scope="col">Material</th>
                        <th scope="col">Avisos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {montadas.alternativas.map((a, i) => {
                        const r = a.calculo.resultado;
                        const excedente = Object.values(r.excedentePorTamanho).reduce((s, n) => s + n, 0);
                        return (
                          <tr key={i}>
                            <td>
                              <input type="radio" name="alternativa" aria-label={`Escolher a alternativa ${a.criterios.map((c) => CRITERIOS[c].rotulo).join(' e ')}`} checked={escolhida === i} onChange={() => setEscolhida(i)} />
                            </td>
                            <td title={a.criterios.map((c) => CRITERIOS[c].explicacao).join(' ')}>{a.criterios.map((c) => CRITERIOS[c].rotulo).join(' · ')}</td>
                            <td>{r.riscos.map((x) => `${escreverGrade(x.grade)} × ${x.camadas}`).join('; ')}</td>
                            <td>{r.riscos.map((x) => escreverM(x.comprimentoMm)).join('; ')}</td>
                            <td>{r.eficienciaMediaPercentual !== null ? `${r.eficienciaMediaPercentual.toFixed(1).replace('.', ',')}%` : '—'}</td>
                            <td>
                              {escreverM(r.mesa.comprimentoMm)} × {escreverM(r.mesa.larguraDoTecidoMm)}
                            </td>
                            <td>
                              {r.camadas} / {r.folhas} / {r.enfestos.length}
                            </td>
                            <td>
                              {escreverM(r.consumoMm)}
                              {r.consumoG !== null ? ` (${noCampo(r.consumoG / 1000, 1)} kg)` : ''}
                            </td>
                            <td>{escreverM(r.sobraMm)}</td>
                            <td>{excedente}</td>
                            <td>{r.materialSuficiente ? 'dá' : `falta ${escreverM(r.deficitMm)}`}</td>
                            <td>{a.calculo.alertas.filter((x) => x.nivel === 'aviso').length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {montadas && montadas.descartadas.length > 0 && montadas.alternativas.length > 0 && (
                  <details>
                    <summary>Composições que ficaram de fora ({montadas.descartadas.length})</summary>
                    <ul>
                      {montadas.descartadas.map((d, i) => (
                        <li key={i}>
                          {d.origem}: {d.motivo}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {alternativaEscolhida && entrada.entrada && config && (
                  <>
                    <ResumoDoPlanejamento
                      entrada={entrada.entrada}
                      configuracao={config}
                      resultado={alternativaEscolhida.calculo.resultado}
                      alertas={alternativaEscolhida.calculo.alertas}
                      premissas={alternativaEscolhida.calculo.premissas}
                      riscos={riscosDaEscolhida}
                      tamanhos={tamanhosDaTela}
                      comDesenho
                      custoDoTecido={estimativaDeCusto(entrada.entrada, alternativaEscolhida.calculo.resultado, riscosDaEscolhida)}
                    />
                    <button type="button" className="botao-primario" disabled={buscaDesatualizada} onClick={() => navegar('revisar')}>
                      Revisar e confirmar esta alternativa
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {etapa === 'revisar' && (
          <section aria-label="Revisar e confirmar">
            {!base ? (
              <Faltas titulo="Ainda não há plano para revisar:" itens={[...entrada.faltas, ...(fonte === 'gerar' ? ['Calcule e escolha uma alternativa (etapas 4 e 5).'] : errosDaFonte)]} />
            ) : (
              <>
                <p className="resumo-do-plano">
                  {ROTULO_DA_ESTRATEGIA[base.estrategia]} — {base.criterio}
                  {baseDoRascunho && entrada.entrada && baseDoRascunho.riscos.length > 0 && planoEmEdicao && (
                    <>
                      <br />
                      Os riscos são os do plano guardado.{' '}
                      <button type="button" onClick={largarRascunho}>
                        Usar as alternativas daqui
                      </button>
                    </>
                  )}
                </p>
                <fieldset className="grupo-de-opcoes-do-formulario">
                  <legend>Ajustes (em branco, vale a sugestão)</legend>
                  {base.composicao.map((c) => {
                    const r = base.riscos.find((x) => x.chave === c.chave)!;
                    return (
                      <Campo
                        key={c.chave}
                        rotulo={`Camadas do risco ${escreverGrade(r.grade)} (sugestão: ${c.camadas})`}
                        valor={ajuste.camadasPorRisco[c.chave] ?? ''}
                        onMudar={(v) => setAjuste({ ...ajuste, camadasPorRisco: { ...ajuste.camadasPorRisco, [c.chave]: v } })}
                      />
                    );
                  })}
                  <Campo rotulo="Camadas por enfesto" valor={ajuste.porEnfesto} onMudar={(v) => setAjuste({ ...ajuste, porEnfesto: v })} />
                  <Campo rotulo="Comprimento da mesa (m)" valor={ajuste.mesa} onMudar={(v) => setAjuste({ ...ajuste, mesa: v })} />
                </fieldset>
                {sugerido?.ok && final?.ok && (
                  <p className="nota-do-formulario">
                    Sugerido: {sugerido.resultado.camadas} camada(s), {sugerido.resultado.enfestos.length} enfesto(s), {escreverM(sugerido.resultado.consumoMm)}, mesa {escreverM(sugerido.resultado.mesa.comprimentoMm)}. Final:{' '}
                    {final.resultado.camadas} camada(s), {final.resultado.enfestos.length} enfesto(s), {escreverM(final.resultado.consumoMm)}, mesa {escreverM(final.resultado.mesa.comprimentoMm)}.
                  </p>
                )}
                <Faltas titulo="O plano não calcula:" itens={[...entrada.faltas, ...ajustesLidos.erros, ...(final && !final.ok ? final.erros : [])]} />
                {final?.ok && entrada.entrada && config && (
                  <ResumoDoPlanejamento
                    entrada={entrada.entrada}
                    configuracao={config}
                    resultado={final.resultado}
                    alertas={final.alertas}
                    premissas={final.premissas}
                    riscos={base.riscos}
                    tamanhos={tamanhosDaTela}
                    custoDoTecido={estimativaDeCusto(entrada.entrada, final.resultado, base.riscos)}
                  />
                )}
                <div className="confirmacao-do-plano">
                  <Campo rotulo="Responsável (informado — o programa não tem login)" tipo="text" valor={responsavel} onMudar={setResponsavel} obrigatorio />
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={aplicarAoEnfesto} onChange={(e) => setAplicarAoEnfesto(e.target.checked)} />
                    Ajustar o enfesto do projeto ao plano (tipo, largura, mesa e camadas do maior enfesto)
                  </label>
                  <div className="acoes-em-linha">
                    <button type="button" disabled={!final?.ok} onClick={guardarRascunho}>
                      Salvar rascunho
                    </button>{' '}
                    {props.onCriarArquivosDeEncaixe && (
                      <>
                        <button type="button" disabled={!final?.ok} title="Um projeto por risco na biblioteca, com a mesa, as camadas e as peças no lugar" onClick={() => void criarArquivosDeEncaixe()}>
                          Criar arquivos de encaixe
                        </button>{' '}
                      </>
                    )}
                    <button type="button" className="botao-primario" disabled={!final?.ok} onClick={() => setConfirmando(true)}>
                      Confirmar o plano
                    </button>
                  </div>
                  {confirmando && final?.ok && (
                    <div role="alertdialog" aria-label="Confirmar o plano" className="confirmacao-pendente">
                      <p>
                        Confirmar o plano da ordem {entrada.entrada?.ordem.codigo}: {final.resultado.camadas} camada(s) em {final.resultado.enfestos.length} enfesto(s), consumo estimado de{' '}
                        {escreverM(final.resultado.consumoMm)}
                        {final.resultado.materialSuficiente ? '' : ` (o material não dá tudo: faltam ${escreverM(final.resultado.deficitMm)})`}? Confirmado, ele fica guardado como está e não muda mais.
                      </p>
                      <div className="acoes-em-linha">
                        <button type="button" className="botao-primario" onClick={confirmar}>
                          Sim, confirmar
                        </button>{' '}
                        <button type="button" onClick={() => setConfirmando(false)}>
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {etapa === 'planos' && (
          <section aria-label="Planos deste projeto">
            {planos.length === 0 ? (
              <p className="nota-do-formulario">Nenhum plano guardado neste projeto.</p>
            ) : (
              <ul className="lista-de-planos">
                {[...planos].reverse().map((p) => {
                  const v2 = ehPlanoV2(p);
                  const execucao = v2 ? execucaoAtualDoPlano(cadastro, p.id) : null;
                  const situacao =
                    (v2 ? (p.situacao === 'rascunho' ? 'Rascunho' : 'Confirmado') : 'Confirmado (1ª versão do cálculo)') +
                    (execucao ? ` · ${ROTULO_DA_SITUACAO[execucao.situacao]}` : '');
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => setPlanoAberto(planoAberto === p.id ? null : p.id)} aria-expanded={planoAberto === p.id}>
                        {situacao} — ordem {p.entrada.ordem.codigo} — {quando(p.criadoEmIso)} — {p.responsavel} (informado)
                      </button>
                      {v2 && p.situacao === 'rascunho' && (
                        <>
                          {' '}
                          <button type="button" onClick={() => continuar(p, false)}>
                            Continuar o rascunho
                          </button>{' '}
                          {rascunhoARemover === p.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRascunhoARemover(null);
                                  setMensagem(props.onRemoverRascunho(p.id) ?? 'Rascunho apagado.');
                                }}
                              >
                                Apagar mesmo
                              </button>{' '}
                              <button type="button" onClick={() => setRascunhoARemover(null)}>
                                Não apagar
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setRascunhoARemover(p.id)}>
                              Apagar o rascunho
                            </button>
                          )}
                        </>
                      )}
                      {v2 && p.situacao === 'confirmado' && (
                        <>
                          {' '}
                          <button type="button" onClick={() => continuar(p, true)}>
                            Duplicar como novo
                          </button>
                        </>
                      )}
                      {planoAberto === p.id && (
                        <div className="plano-salvo">
                          <p className="nota-do-formulario">
                            Plano de {quando(p.criadoEmIso)}, por {p.responsavel} (informado): os valores são os de então, sem recalcular.
                            {v2 && p.confirmadoEmIso ? ` Confirmado em ${quando(p.confirmadoEmIso)}.` : ''}
                            {p.substituiPlanoId ? ' Substitui um plano anterior da mesma ordem (que continua guardado).' : ''}
                            {v2 && p.copiaDePlanoId ? ' Feito a partir de outro plano.' : ''}
                          </p>
                          {p.entrada.molde.impressaoDigital !== modelo.impressaoDigital && (
                            <p className="alerta-do-plano alerta-aviso">O molde mudou depois deste plano: os valores dele não valem para as peças de agora.</p>
                          )}
                          {v2 ? (
                            <>
                              <p className="nota-do-formulario">
                                {ROTULO_DA_ESTRATEGIA[p.estrategia]} — {p.criterio}
                                {p.ajustesFeitos.length > 0 ? ` Ajustes feitos: ${p.ajustesFeitos.map((a) => `${a.campo} ${a.sugerido} → ${a.escolhido}`).join('; ')}.` : ' Sem ajustes à sugestão.'}
                                {p.busca ? ` Busca: ${p.busca.composicoesAvaliadas} composição(ões) avaliada(s), ${p.busca.riscosFeitos} risco(s) feito(s).` : ''}
                              </p>
                              <ResumoDoPlanejamento
                                entrada={p.entrada}
                                configuracao={p.configuracao}
                                resultado={p.resultado}
                                alertas={p.alertas}
                                premissas={p.premissas}
                                riscos={p.riscos}
                                tamanhos={Object.keys(p.resultado.producaoPorTamanho)}
                                comDesenho
                                custoDoTecido={p.custoDoTecido ?? 'sem-estimativa'}
                              />
                              <EstoqueDoPlano plano={p} cadastro={cadastro} responsavelSugerido={responsavel} agoraIso={props.agoraIso} novoId={props.novoId} onMudar={mudarCadastro} />
                              <ExecucaoDoPlano plano={p} cadastro={cadastro} responsavelSugerido={responsavel} agoraIso={props.agoraIso} novoId={props.novoId} onMudar={mudarCadastro} />
                            </>
                          ) : (
                            <PropostaDoPlano entrada={p.entrada} configuracao={p.configuracao} resultado={p.resultado} alertas={p.alertas} premissas={p.premissas} />
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        <details className="limitacoes-do-planejamento">
          <summary>Como usar</summary>
          <ul>
            {COMO_USAR.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
        <details className="limitacoes-do-planejamento">
          <summary>Limitações conhecidas</summary>
          <ul>
            {LIMITACOES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
        <div className="acoes-em-linha">
          {etapa !== 'planos' && etapa !== 'revisar' && (
            <button
              type="button"
              // A ação principal das primeiras etapas; da 4 em diante, a principal é a da própria etapa (calcular, revisar).
              className={etapa === 'molde' || etapa === 'ordem' || etapa === 'malha' ? 'botao-primario' : undefined}
              onClick={() => {
                const i = ETAPAS.findIndex(([id]) => id === etapa);
                const proxima = ETAPAS[i + 1]![0];
                if (proxima === 'alternativas') calcularAlternativas();
                else navegar(proxima);
              }}
            >
              Seguir
            </button>
          )}
        </div>
      </div>
      </ErrosDosCampos.Provider>
    </Sobreposicao>
  );
}
