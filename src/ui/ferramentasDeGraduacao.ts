import { distancia, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import {
  agruparTamanhos,
  ajustarEntre,
  alternarPontoGraduado,
  apagarRegras,
  contornoDoTamanho,
  definirRegra,
  descontarPonto,
  indiceDoTamanho,
  lerTamanhos,
  pontoGraduadoEm,
  regraComPasso,
  regraDoVertice,
  regraNaTangente,
  regraNoEixo,
  regraPeloTamanhoDeReferencia,
  regraPorPasso,
  regraProporcional,
  tamanhoDeReferencia,
  verticesGraduados,
  type EixoDaGraduacao,
  type Graduacao,
} from '../domain/graduacao';
import { piquePerto } from '../domain/anotacoes';
import { direcaoDoContornoNoPique, graduarPiqueNoContorno, referenciaDoPique } from '../domain/piquesGraduados';
import { semGraduacao, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde, separarTamanhos, separarTamanhosEm, unirTamanhos } from '../domain/tamanhosGraduados';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { PreviaDeFerramentaDeMolde, ResultadoDeFerramentaDeMolde } from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';
import { regraDoPonto, regraParaAGraduacao, type RegraCadastrada } from './regrasDeGraduacao';
import { paraATela, paraOCampo, paraOMundo } from './tabelaDeGraduacao';

/**
 * As 14 ferramentas da aba Graduação. Aqui fica o que cada uma pergunta, o
 * que cada clique faz, o que o desenho mostra e o que a faixa de mensagens
 * diz; as contas são do domínio (`graduacao.ts` e `tamanhosGraduados.ts`).
 *
 * DX e DY são os da tela (horizontal, + para a direita; vertical, + para
 * baixo), como no diálogo "Modificar".
 */
export type FerramentaDeGraduacao =
  | 'graduar-tabela'
  | 'graduar-automatico'
  | 'graduar-mouse'
  | 'graduar-tangente'
  | 'graduar-regras'
  | 'criar-regra'
  | 'remover-graduacao'
  | 'separar-tamanhos'
  | 'unir-tamanhos'
  | 'agrupar-graduacao'
  | 'deduzir-graduacao'
  | 'copiar-graduacao'
  | 'ajustar-graduacao'
  | 'graduar-curva';

/** As que ficam ligadas à espera de cliques no desenho. "Unir" age na hora; "Separar" fica ligada quando a posição das peças novas é indicada com o mouse. */
export type ModoDeGraduacao = Exclude<FerramentaDeGraduacao, 'unir-tamanhos'>;

const MODOS_DE_GRADUACAO: ReadonlySet<string> = new Set([
  'graduar-tabela',
  'graduar-automatico',
  'graduar-mouse',
  'graduar-tangente',
  'graduar-regras',
  'criar-regra',
  'remover-graduacao',
  'separar-tamanhos',
  'agrupar-graduacao',
  'deduzir-graduacao',
  'copiar-graduacao',
  'ajustar-graduacao',
  'graduar-curva',
]);

export function ehModoDeGraduacao(modo: string): modo is ModoDeGraduacao {
  return MODOS_DE_GRADUACAO.has(modo);
}

/** Sobre o que uma operação age, nos nomes da tela. */
export type EixoNaTela = 'dx-dy' | 'dx' | 'dy';

/** O que os diálogos deixaram escolhido; cada um abre com o que foi usado por último. */
export interface OpcoesDaGraduacao {
  /** `tamanho`: o nome do tamanho em que a diferença é aplicada, ou `TODOS_OS_TAMANHOS`. */
  readonly automatico: { readonly dxMm: number; readonly dyMm: number; readonly tamanho: string };
  readonly ajustar: { readonly eixo: EixoNaTela };
  /** A distância de um tamanho ao vizinho, no ponto de referência (zero empilha), e o tamanho a mexer (ou "todos"). */
  readonly agrupar: { readonly dxMm: number; readonly dyMm: number; readonly tamanho: string };
  readonly mouse: { readonly modo: 'absoluto' | 'incremental' | 'proporcional' };
  /** "Unir": todos os pontos graduados, para as curvas de cada tamanho saírem exatas. */
  readonly unir: { readonly ajustarCurvas: boolean };
  readonly tangente: {
    readonly distanciaMm: number;
    readonly inverter: boolean;
    /** A direção é sempre a da aresta no contorno base; sem isso, cada tamanho segue a aresta do tamanho vizinho. */
    readonly usarContornoBase: boolean;
    /** O nome do tamanho em que a distância é aplicada, ou `TODOS_OS_TAMANHOS`. */
    readonly tamanho: string;
    /** A distância conta de um tamanho ao vizinho; sem isso, conta a partir do base. */
    readonly incremental: boolean;
  };
  readonly remover: { readonly onde: 'pontos' | 'molde'; readonly eixo: EixoNaTela };
  readonly copiar: {
    readonly eixo: EixoNaTela;
    readonly inverterDx: boolean;
    readonly inverterDy: boolean;
    readonly destino: 'cliques' | 'todos';
  };
  /** O nome do tamanho a separar, ou "todos"; e se a posição das peças novas é indicada com o mouse (sem isso, vão para uma fila depois das que já estão na mesa). */
  readonly separar: { readonly tamanho: string; readonly indicarPosicao: boolean };
}

export const TODOS_OS_TAMANHOS = 'todos';

export const OPCOES_INICIAIS_DA_GRADUACAO: OpcoesDaGraduacao = {
  automatico: { dxMm: 10, dyMm: 0, tamanho: TODOS_OS_TAMANHOS },
  ajustar: { eixo: 'dx-dy' },
  agrupar: { dxMm: 0, dyMm: 0, tamanho: TODOS_OS_TAMANHOS },
  mouse: { modo: 'absoluto' },
  unir: { ajustarCurvas: true },
  tangente: { distanciaMm: 5, inverter: false, usarContornoBase: true, tamanho: TODOS_OS_TAMANHOS, incremental: true },
  remover: { onde: 'pontos', eixo: 'dx-dy' },
  copiar: { eixo: 'dx-dy', inverterDx: false, inverterDy: false, destino: 'cliques' },
  separar: { tamanho: TODOS_OS_TAMANHOS, indicarPosicao: true },
};

/** Dois pontos a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;
const SEM_TAMANHOS = 'Defina os tamanhos primeiro, em “Tabela”.';
const NO_PONTO = 'Clique em cima de um ponto do contorno da peça selecionada (os pontos numerados).';

const EIXO_DO_MUNDO: Record<EixoNaTela, EixoDaGraduacao> = { 'dx-dy': 'ambos', dx: 'y', dy: 'x' };
const NOME_DO_EIXO: Record<EixoNaTela, string> = { 'dx-dy': 'DX e DY', dx: 'DX', dy: 'DY' };

function lista(nomes: readonly string[]): string {
  return nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

function trocar(pecas: readonly Molde[], id: string, nova: Molde): Molde[] {
  return pecas.map((p) => (p.id === id ? nova : p));
}

function mm(valor: number): string {
  return formatarMm(Math.round(valor * 10) / 10 === 0 ? 0 : valor);
}

/** O número (a partir de 0) do ponto do contorno clicado, ou `null` se o clique não caiu em cima de um ponto. */
function verticeClicado(peca: Molde, clique: CliqueDeTrecho): number | null {
  const posicao = clique.noContorno;
  if (!posicao) return null;
  return distancia(posicao.ponto, peca.contorno[posicao.indiceAresta]!) < MESMO_PONTO_MM ? posicao.indiceAresta : null;
}

/** A regra do ponto, descrita pelo que ele anda no tamanho da ponta da graduação. */
function descreverRegra(graduacao: Graduacao, regra: readonly Ponto2D[]): string {
  const t = tamanhoDeReferencia(graduacao);
  const naTela = paraATela(regra[t] ?? { x: 0, y: 0 });
  return `no tamanho ${graduacao.tamanhos[t]}, DX ${mm(naTela.dx)} e DY ${mm(naTela.dy)}`;
}

// ---------------------------------------------------------------------------
// Tamanhos ("Tabela" começa por eles)
// ---------------------------------------------------------------------------

/** O diálogo dos tamanhos: os da peça, ou uma sugestão para a peça que ainda não tem graduação. */
export function dialogoDeTamanhos(peca: Molde): { readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  const graduacao = peca.graduacao;
  const sugestao = ['P', 'M', 'G'];
  const tamanhos = graduacao ? graduacao.tamanhos : sugestao;
  const base = graduacao ? graduacao.tamanhos[graduacao.base]! : indiceDoTamanho(sugestao, peca.tamanho) >= 0 ? peca.tamanho.trim() : 'M';
  return {
    campos: [
      { tipo: 'texto', id: 'tamanhos', rotulo: 'Tamanhos, do menor ao maior, separados por vírgula', inicial: tamanhos.join(', ') },
      { tipo: 'texto', id: 'base', rotulo: 'Tamanho base: o do contorno desenhado', inicial: base },
    ],
    nota: graduacao
      ? 'Depois de confirmar, clique num ponto do contorno para ver e mudar a graduação dele. Mudando a lista, as regras dos tamanhos que continuam ficam; um tamanho novo entra igual ao base. Trocando o base, o contorno desenhado passa a ser o desse tamanho.'
      : 'Depois de confirmar, clique num ponto do contorno para dar a graduação dele. Os cantos da peça entram como pontos graduados, ainda sem deslocamento; os pontos de curva andam na proporção dos vizinhos. O encaixe continua usando só o tamanho base: para encaixar os outros, use “Separar”.',
  };
}

/** A peça com os tamanhos do diálogo. Lança erro, com a mensagem para o diálogo, quando não servem. */
export function aplicarTamanhos(peca: Molde, valores: ValoresDoDialogo): Molde {
  return definirTamanhosDoMolde(peca, lerTamanhos(String(valores.tamanhos ?? '')), String(valores.base ?? ''));
}

/** Verdadeiro se a lista de tamanhos e o base ficaram como já estavam (confirmar não muda a peça). */
export function mesmosTamanhos(antes: Molde, depois: Molde): boolean {
  const a = antes.graduacao;
  const d = depois.graduacao;
  return a !== undefined && d !== undefined && a.base === d.base && a.tamanhos.length === d.tamanhos.length && a.tamanhos.every((t, i) => t === d.tamanhos[i]);
}

// ---------------------------------------------------------------------------
// Diálogos das ferramentas
// ---------------------------------------------------------------------------

export interface DialogoDeGraduacao {
  readonly titulo: string;
  readonly campos: readonly CampoDoDialogo[];
  readonly nota: string;
  readonly rotuloDoBotao: string;
}

const EIXOS: ReadonlyArray<{ readonly valor: EixoNaTela; readonly rotulo: string }> = [
  { valor: 'dx-dy', rotulo: 'DX e DY' },
  { valor: 'dx', rotulo: 'Apenas DX (a horizontal)' },
  { valor: 'dy', rotulo: 'Apenas DY (a vertical)' },
];
const INDICAR = 'Indicar no desenho';

/** O campo "Aplicar no tamanho": todos, ou um dos tamanhos da peça que não é o base. */
function campoDoTamanho(peca: Molde, escolhido: string): CampoDoDialogo {
  const graduacao = peca.graduacao;
  const outros = graduacao ? graduacao.tamanhos.filter((_, t) => t !== graduacao.base) : [];
  return {
    tipo: 'escolha',
    id: 'tamanho',
    rotulo: 'Aplicar no tamanho',
    opcoes: [{ valor: TODOS_OS_TAMANHOS, rotulo: 'Todos' }, ...outros.map((nome) => ({ valor: nome, rotulo: nome }))],
    inicial: outros.includes(escolhido) ? escolhido : TODOS_OS_TAMANHOS,
  };
}

/** O diálogo que a ferramenta abre antes de agir; `null` para as que não perguntam nada. */
export function dialogoDaGraduacao(ferramenta: FerramentaDeGraduacao, opcoes: OpcoesDaGraduacao, peca: Molde): DialogoDeGraduacao | null {
  switch (ferramenta) {
    case 'graduar-automatico':
      return {
        titulo: 'Graduar: automático',
        campos: [
          { tipo: 'medida', id: 'dx', rotulo: 'Diferença de DX por tamanho (mm, + para a direita)', inicial: paraOCampo(opcoes.automatico.dxMm) },
          { tipo: 'medida', id: 'dy', rotulo: 'Diferença de DY por tamanho (mm, + para baixo)', inicial: paraOCampo(opcoes.automatico.dyMm) },
          campoDoTamanho(peca, opcoes.automatico.tamanho),
        ],
        nota: 'Depois de confirmar, clique nos pontos do contorno. Em “Todos”, cada um passa a andar essa diferença a mais em cada tamanho acima do base, e a menos em cada um abaixo, no lugar da regra que tinha. Num tamanho só, só ele muda: fica com essa diferença em relação ao tamanho vizinho, do lado do base. O clique num pique gradua o pique: ele só anda sobre o contorno, então vale a parte de DX e DY na direção da borda onde ele está, e a distância dele é contada do ponto de referência (o que a tabela dele mostra: o ponto graduado mais perto). O manual da referência tem a opção e diz que ela gradua pontos e piques, mas não diz a conta; essa é a nossa leitura.',
        rotuloDoBotao: INDICAR,
      };
    case 'ajustar-graduacao':
      return {
        titulo: 'Ajustar graduação',
        campos: [{ tipo: 'escolha', id: 'eixo', rotulo: 'O que ajustar', opcoes: EIXOS, inicial: opcoes.ajustar.eixo }],
        nota: 'Depois de confirmar, clique no ponto inicial, nos pontos a ajustar e, por último, no ponto final; um segundo clique no ponto final confirma. Os pontos do meio passam a andar na proporção entre o inicial e o final, pela posição de cada um no contorno. O manual da referência dá esses passos, mas não a conta; a proporção é a nossa leitura.',
        rotuloDoBotao: INDICAR,
      };
    case 'agrupar-graduacao': {
      const graduacao = peca.graduacao;
      if (!graduacao) return null;
      const outros = graduacao.tamanhos.filter((_, t) => t !== graduacao.base);
      return {
        titulo: 'Agrupar ou desagrupar',
        campos: [
          { tipo: 'medida', id: 'dx', rotulo: 'DX ponto: distância de um tamanho ao outro, na horizontal (mm)', inicial: paraOCampo(opcoes.agrupar.dxMm) },
          { tipo: 'medida', id: 'dy', rotulo: 'DY ponto: distância de um tamanho ao outro, na vertical (mm)', inicial: paraOCampo(opcoes.agrupar.dyMm) },
          {
            tipo: 'escolha',
            id: 'tamanho',
            rotulo: 'Aplicar no tamanho',
            opcoes: [{ valor: TODOS_OS_TAMANHOS, rotulo: 'Todos' }, ...outros.map((nome) => ({ valor: nome, rotulo: nome }))],
            inicial: outros.includes(opcoes.agrupar.tamanho) ? opcoes.agrupar.tamanho : TODOS_OS_TAMANHOS,
          },
        ],
        nota: 'Depois de confirmar, clique no ponto de referência. Com DX e DY em zero, os tamanhos ficam empilhados nesse ponto (agrupados); com um valor, cada tamanho fica afastado do vizinho essa distância (desagrupados). A forma de cada tamanho não muda.',
        rotuloDoBotao: INDICAR,
      };
    }
    case 'graduar-mouse':
      return {
        titulo: 'Graduar: mouse',
        campos: [
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'O segundo clique mostra onde o ponto fica',
            opcoes: [
              { valor: 'absoluto', rotulo: 'Absoluto: no tamanho da ponta (o maior), e os outros vão por passos iguais' },
              { valor: 'incremental', rotulo: 'Incremental: no tamanho seguinte ao base, e cada tamanho anda o mesmo tanto' },
              { valor: 'proporcional', rotulo: 'Proporcional: no menor e no maior tamanho, e os do meio ficam com a parte proporcional' },
            ],
            inicial: opcoes.mouse.modo,
          },
        ],
        nota: 'Depois de confirmar, clique num ponto do contorno e, em seguida, onde ele deve ficar. No Absoluto e no Incremental, um clique; no Proporcional, dois: onde o ponto fica no menor tamanho e onde fica no maior. O desenho mostra o tamanho que está sendo indicado enquanto o mouse anda.',
        rotuloDoBotao: INDICAR,
      };
    case 'graduar-tangente':
      return {
        titulo: 'Graduar: tangente',
        campos: [
          { tipo: 'medida', id: 'distancia', rotulo: 'Distância por tamanho (mm)', inicial: paraOCampo(opcoes.tangente.distanciaMm) },
          { tipo: 'caixa', id: 'inverter', rotulo: 'Inverter sentido: pela aresta que chega ao ponto', inicial: opcoes.tangente.inverter },
          {
            tipo: 'caixa',
            id: 'usarContornoBase',
            rotulo: 'Usar contorno base: a direção é sempre a da aresta no tamanho base',
            inicial: opcoes.tangente.usarContornoBase,
          },
          campoDoTamanho(peca, opcoes.tangente.tamanho),
          { tipo: 'caixa', id: 'incremental', rotulo: 'Incremental: a distância conta de um tamanho ao vizinho (sem isso, a partir do base)', inicial: opcoes.tangente.incremental },
        ],
        nota: 'Depois de confirmar, clique nos pontos do contorno. Cada um passa a andar essa distância na direção da aresta que sai dele (a que vai para o ponto de número seguinte) — ou, invertendo, na da aresta que chega. Sem “Usar contorno base”, cada tamanho sai do vizinho na direção que a aresta tem nele: a tangente acompanha a curva dos tamanhos. O clique num pique gradua o pique: ele anda essa distância sobre o contorno, no sentido do ponto de número seguinte (ou, invertendo, do anterior), contada do ponto de referência dele (o que a tabela dele mostra: o ponto graduado mais perto). O manual da referência tem as opções e diz que a ferramenta vale para pontos e piques, mas não diz as contas; essas são a nossa leitura.',
        rotuloDoBotao: INDICAR,
      };
    case 'remover-graduacao':
      return {
        titulo: 'Remover graduação',
        campos: [
          {
            tipo: 'escolha',
            id: 'onde',
            rotulo: 'De onde',
            opcoes: [
              { valor: 'pontos', rotulo: 'Dos pontos que eu clicar' },
              { valor: 'molde', rotulo: 'Do molde inteiro' },
            ],
            inicial: opcoes.remover.onde,
          },
          { tipo: 'escolha', id: 'eixo', rotulo: 'O que apagar', opcoes: EIXOS, inicial: opcoes.remover.eixo },
        ],
        nota: 'O ponto clicado passa a ficar parado em todos os tamanhos (no que foi apagado). Do molde inteiro, com DX e DY, a peça deixa de ter graduação: ficam só o tamanho base e o contorno desenhado.',
        rotuloDoBotao: 'Continuar',
      };
    case 'copiar-graduacao':
      return {
        titulo: 'Copiar graduação',
        campos: [
          { tipo: 'escolha', id: 'eixo', rotulo: 'O que copiar', opcoes: EIXOS, inicial: opcoes.copiar.eixo },
          { tipo: 'caixa', id: 'inverterDx', rotulo: 'Inverter DX (para o ponto do lado oposto, na horizontal)', inicial: opcoes.copiar.inverterDx },
          { tipo: 'caixa', id: 'inverterDy', rotulo: 'Inverter DY (para o ponto do lado oposto, na vertical)', inicial: opcoes.copiar.inverterDy },
          {
            tipo: 'escolha',
            id: 'destino',
            rotulo: 'Para onde',
            opcoes: [
              { valor: 'cliques', rotulo: 'Para os pontos que eu clicar (um ou vários)' },
              { valor: 'todos', rotulo: 'Para todos os pontos graduados da peça' },
            ],
            inicial: opcoes.copiar.destino,
          },
        ],
        nota: 'Depois de confirmar, clique no ponto de onde copiar e, em seguida, nos pontos que devem receber a regra — desta peça ou de outra peça graduada, que precisa ter todos os tamanhos desta.',
        rotuloDoBotao: INDICAR,
      };
    case 'unir-tamanhos':
      return {
        titulo: 'Unir tamanhos',
        campos: [
          { tipo: 'caixa', id: 'ajustarCurvas', rotulo: 'Ajustar curvas: todos os pontos graduados, para as curvas de cada tamanho saírem exatas', inicial: opcoes.unir.ajustarCurvas },
        ],
        nota: 'A peça selecionada passa a ser a graduada, e as marcadas na lista viram os outros tamanhos dela. Sem “Ajustar curvas”, só os cantos ficam graduados e os pontos de curva andam na proporção: a graduação fica mais simples de mexer, mas as curvas dos outros tamanhos são só aproximadas.',
        rotuloDoBotao: 'Unir',
      };
    case 'separar-tamanhos': {
      const graduacao = peca.graduacao;
      if (!graduacao) return null;
      const outros = graduacao.tamanhos.filter((_, t) => t !== graduacao.base);
      return {
        titulo: 'Separar tamanhos',
        campos: [
          {
            tipo: 'escolha',
            id: 'tamanho',
            rotulo: 'Qual tamanho vira uma peça própria',
            opcoes: [
              { valor: TODOS_OS_TAMANHOS, rotulo: `Todos (${lista(outros)}): uma peça para cada` },
              ...outros.map((nome) => ({ valor: nome, rotulo: `Só o ${nome}` })),
            ],
            inicial: outros.includes(opcoes.separar.tamanho) ? opcoes.separar.tamanho : TODOS_OS_TAMANHOS,
          },
          { tipo: 'caixa', id: 'indicarPosicao', rotulo: 'Indicar com o mouse onde as peças separadas ficam (sem isso, vão para uma fila depois das que já estão na mesa)', inicial: opcoes.separar.indicarPosicao },
        ],
        nota: `Cada peça nova sai com o contorno e o nome do seu tamanho, sem graduação — pronta para o encaixe. Indicando a posição, depois de confirmar o desenho mostra as peças presas ao mouse: o clique põe a primeira ali (pelo canto de cima à esquerda) e as outras em fila depois dela. Esta continua graduada, no tamanho ${graduacao.tamanhos[graduacao.base]}.`,
        rotuloDoBotao: 'Separar',
      };
    }
    default:
      return null;
  }
}

/** As opções com o que o diálogo da ferramenta entregou. */
export function lerDialogoDaGraduacao(ferramenta: FerramentaDeGraduacao, opcoes: OpcoesDaGraduacao, valores: ValoresDoDialogo): OpcoesDaGraduacao {
  const numero = (id: string): number => Number(valores[id]);
  const caixa = (id: string): boolean => valores[id] === true;
  switch (ferramenta) {
    case 'graduar-automatico':
      return { ...opcoes, automatico: { dxMm: numero('dx'), dyMm: numero('dy'), tamanho: valores.tamanho === undefined ? TODOS_OS_TAMANHOS : String(valores.tamanho) } };
    case 'ajustar-graduacao':
      return { ...opcoes, ajustar: { eixo: String(valores.eixo) as EixoNaTela } };
    case 'agrupar-graduacao':
      return { ...opcoes, agrupar: { dxMm: numero('dx'), dyMm: numero('dy'), tamanho: String(valores.tamanho) } };
    case 'graduar-mouse':
      return { ...opcoes, mouse: { modo: valores.modo === 'incremental' || valores.modo === 'proporcional' ? valores.modo : 'absoluto' } };
    case 'unir-tamanhos':
      return { ...opcoes, unir: { ajustarCurvas: caixa('ajustarCurvas') } };
    case 'graduar-tangente':
      if (numero('distancia') === 0) throw new Error('A distância por tamanho precisa ser diferente de zero.');
      return {
        ...opcoes,
        tangente: {
          distanciaMm: numero('distancia'),
          inverter: caixa('inverter'),
          // Sem o campo (um diálogo antigo), vale o de sempre: pelo contorno base, em todos os tamanhos, de vizinho em vizinho.
          usarContornoBase: valores.usarContornoBase !== false,
          tamanho: valores.tamanho === undefined ? TODOS_OS_TAMANHOS : String(valores.tamanho),
          incremental: valores.incremental !== false,
        },
      };
    case 'remover-graduacao':
      return { ...opcoes, remover: { onde: valores.onde === 'molde' ? 'molde' : 'pontos', eixo: String(valores.eixo) as EixoNaTela } };
    case 'copiar-graduacao':
      return {
        ...opcoes,
        copiar: {
          eixo: String(valores.eixo) as EixoNaTela,
          inverterDx: caixa('inverterDx'),
          inverterDy: caixa('inverterDy'),
          destino: valores.destino === 'todos' ? 'todos' : 'cliques',
        },
      };
    case 'separar-tamanhos':
      return { ...opcoes, separar: { tamanho: String(valores.tamanho), indicarPosicao: valores.indicarPosicao !== false } };
    default:
      return opcoes;
  }
}

// ---------------------------------------------------------------------------
// O que age na hora: Separar, Unir e Remover do molde inteiro
// ---------------------------------------------------------------------------

/** Os tamanhos (pelo número) que o "Separar" tira da peça, pelo que a janela deixou escolhido. Lança erro se não há nenhum. */
function tamanhosASeparar(opcoes: OpcoesDaGraduacao, peca: Molde): number[] {
  const graduacao = peca.graduacao;
  if (!graduacao) throw new Error(SEM_TAMANHOS);
  const pedido = opcoes.separar.tamanho;
  const quais =
    pedido === TODOS_OS_TAMANHOS
      ? graduacao.tamanhos.map((_, t) => t).filter((t) => t !== graduacao.base)
      : [indiceDoTamanho(graduacao.tamanhos, pedido)].filter((t) => t >= 0 && t !== graduacao.base);
  if (quais.length === 0) throw new Error('Escolha um tamanho diferente do base para separar.');
  return quais;
}

/**
 * "Separar": as peças novas entram no projeto. Com `posicao` (indicada com o
 * mouse), a primeira fica ali, pelo canto de cima à esquerda, e as outras em
 * fila depois dela; sem ela, vão para depois das que já estão na mesa.
 */
export function aplicarSeparar(opcoes: OpcoesDaGraduacao, pecas: readonly Molde[], peca: Molde, novoId: () => string, posicao: Ponto2D | null = null): ResultadoDeFerramentaDeMolde {
  const quais = tamanhosASeparar(opcoes, peca);
  const graduacao = peca.graduacao!;
  // Sem posição indicada, a fila das peças novas começa depois de todas as que já estão na mesa, para não cair em cima de nenhuma.
  const fimDasPecas = Math.max(...pecas.map((p) => retanguloEnvolvente(p.contorno).maxY));
  const novas = posicao ? separarTamanhosEm(peca, quais, novoId, posicao) : separarTamanhos(peca, quais, novoId, fimDasPecas);
  const nomes = lista(quais.map((t) => graduacao.tamanhos[t]!));
  const onde = posicao ? 'onde foi indicado' : 'depois das que já estavam na mesa';
  return {
    pecas: [...pecas, ...novas],
    recado:
      novas.length === 1
        ? `Tamanho ${nomes} de “${peca.nome}” separado: é uma peça própria, posta ${onde}, pronta para o encaixe.`
        : `${novas.length} peças criadas a partir de “${peca.nome}”, nos tamanhos ${nomes}: estão em fila ${onde}, prontas para o encaixe.`,
  };
}

/** "Unir": a peça selecionada vira a graduada, e as marcadas na lista viram os outros tamanhos dela. */
export function aplicarUnir(pecas: readonly Molde[], peca: Molde, marcadas: ReadonlySet<string>, ajustarCurvas = true): ResultadoDeFerramentaDeMolde {
  const outras = pecas.filter((p) => marcadas.has(p.id) && p.id !== peca.id);
  const unida = unirTamanhos(peca, outras, ajustarCurvas);
  const graduacao = unida.graduacao!;
  const saem = new Set(outras.map((p) => p.id));
  return {
    pecas: trocar(
      pecas.filter((p) => !saem.has(p.id)),
      peca.id,
      unida,
    ),
    recado: `“${peca.nome}” agora é graduada nos tamanhos ${lista(graduacao.tamanhos)}, com o ${graduacao.tamanhos[graduacao.base]} de base. ${outras.length === 1 ? 'A peça do outro tamanho foi reunida' : `As ${outras.length} peças dos outros tamanhos foram reunidas`} nela.${
      ajustarCurvas ? '' : ` Só os ${graduacao.pontos.length} cantos ficaram graduados; os pontos de curva andam na proporção.`
    }`,
  };
}

/** "Remover graduação" do molde inteiro: com DX e DY a peça deixa de ser graduada; com um só, esse eixo é zerado em todos os pontos. */
export function aplicarRemoverDoMolde(opcoes: OpcoesDaGraduacao, pecas: readonly Molde[], peca: Molde): ResultadoDeFerramentaDeMolde {
  const graduacao = peca.graduacao;
  if (!graduacao) throw new Error(`A peça “${peca.nome}” não tem graduação.`);
  const eixo = opcoes.remover.eixo;
  if (eixo === 'dx-dy') {
    return {
      pecas: trocar(pecas, peca.id, semGraduacao(peca)),
      recado: `Graduação removida de “${peca.nome}”: ficou só o tamanho ${graduacao.tamanhos[graduacao.base]}.`,
    };
  }
  return {
    pecas: trocar(pecas, peca.id, { ...peca, graduacao: apagarRegras(graduacao, peca.contorno, null, EIXO_DO_MUNDO[eixo]) }),
    recado: `${NOME_DO_EIXO[eixo]} apagado de todos os pontos graduados de “${peca.nome}”.`,
  };
}

// ---------------------------------------------------------------------------
// Cliques no desenho
// ---------------------------------------------------------------------------

/** O que o clique pede além de mudar a peça: a tabela do ponto, o nome da regra a criar, ou a tabela de um pique. */
export type DialogoPedidoPeloClique =
  | {
      readonly tipo: 'tabela' | 'nome-da-regra';
      /** O número (a partir de 0) do ponto do contorno. */
      readonly indice: number;
    }
  | { readonly tipo: 'tabela-do-pique'; readonly id: string };

export interface CliqueDeGraduacao {
  readonly estado: TrechoEmEdicao;
  /** As peças do projeto depois do clique, quando ele mudou alguma coisa (um passo de desfazer). */
  readonly pecas?: readonly Molde[];
  /** O que dizer na faixa de mensagens: o que foi feito, ou por que o clique não serviu. */
  readonly recado: string | null;
  readonly abrir?: DialogoPedidoPeloClique;
}

/** O conjunto de regras em uso: o nome dele e a regra da vez. */
export interface ConjuntoEmUso {
  readonly nome: string;
  readonly numero: number;
  readonly total: number;
}

/** O que a ferramenta precisa além das opções: a regra escolhida em "Regras" e o raio (mm) em que um clique pega um ponto de outra peça. */
export interface ContextoDaGraduacao {
  readonly regra: RegraCadastrada | null;
  readonly raioMm?: number;
  /** Quem dá os ids das peças novas (o "Separar" com a posição indicada). */
  readonly novoId?: () => string;
}

/** Das outras peças, o ponto do contorno mais perto de `p`, a até `raioMm`. */
function pontoDeOutraPeca(pecas: readonly Molde[], excetoId: string, p: Ponto2D, raioMm: number): { readonly peca: Molde; readonly indice: number } | null {
  let melhor: { peca: Molde; indice: number; distancia: number } | null = null;
  for (const peca of pecas) {
    if (peca.id === excetoId) continue;
    peca.contorno.forEach((v, indice) => {
      const d = distancia(v, p);
      if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { peca, indice, distancia: d };
    });
  }
  return melhor ? { peca: (melhor as { peca: Molde }).peca, indice: (melhor as { indice: number }).indice } : null;
}

/** "Ajustar": os pontos já clicados depois do inicial, pelo número (a partir de 0) — o último é, por enquanto, o final. */
function clicadosNoAjuste(peca: Molde, estado: TrechoEmEdicao): number[] {
  return estado.livres.map((p) => peca.contorno.findIndex((v) => distancia(v, p) < MESMO_PONTO_MM)).filter((i) => i >= 0);
}

/**
 * No modo "Proporcional" do mouse, o que o próximo clique indica: com tamanhos
 * dos dois lados do base, primeiro o menor e depois o maior; com tamanhos de
 * um lado só, só esse.
 */
function faseDoProporcional(graduacao: Graduacao, estado: TrechoEmEdicao): 'menor-e-depois-maior' | 'maior' | 'so-menor' {
  const temMenores = graduacao.base > 0;
  const temMaiores = graduacao.base < graduacao.tamanhos.length - 1;
  if (temMenores && !temMaiores) return 'so-menor';
  return temMenores && estado.livres.length === 0 ? 'menor-e-depois-maior' : 'maior';
}

/** A regra da origem como chega ao destino em "Copiar graduação": com os sinais invertidos, se pedido. */
function regraCopiada(origem: readonly Ponto2D[], opcoes: OpcoesDaGraduacao['copiar']): Ponto2D[] {
  return origem.map((d) => {
    const naTela = paraATela(d);
    return paraOMundo({ dx: opcoes.inverterDx ? 0 - naTela.dx : naTela.dx, dy: opcoes.inverterDy ? 0 - naTela.dy : naTela.dy });
  });
}

/**
 * O que um clique faz com a ferramenta ligada. Todas agem sobre pontos do
 * contorno da peça selecionada; só o segundo clique do "Mouse" vale em
 * qualquer lugar.
 */
export function cliqueDeGraduacao(
  modo: ModoDeGraduacao,
  opcoes: OpcoesDaGraduacao,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  clique: CliqueDeTrecho,
  contexto: ContextoDaGraduacao,
): CliqueDeGraduacao {
  const graduacao = peca.graduacao;
  if (!graduacao) return { estado, recado: SEM_TAMANHOS };
  const contorno = peca.contorno;
  const com = (nova: Graduacao, recado: string, proximo: TrechoEmEdicao = estado): CliqueDeGraduacao => ({
    estado: proximo,
    pecas: trocar(pecas, peca.id, { ...peca, graduacao: nova }),
    recado,
  });

  // "Separar", com a posição indicada pelo mouse: o clique diz onde as peças novas ficam.
  if (modo === 'separar-tamanhos') {
    if (!contexto.novoId) return { estado, recado: null };
    try {
      const feito = aplicarSeparar(opcoes, pecas, peca, contexto.novoId, clique.livre);
      return { estado: SEM_TRECHO, pecas: feito.pecas, recado: feito.recado };
    } catch (e) {
      return { estado, recado: e instanceof Error ? e.message : String(e) };
    }
  }

  // O segundo clique do "Mouse": onde o ponto indicado deve ficar.
  if (modo === 'graduar-mouse' && estado.inicio) {
    const i = estado.inicio.indiceAresta;
    const anda = { x: clique.livre.x - contorno[i]!.x, y: clique.livre.y - contorno[i]!.y };
    if (Math.hypot(anda.x, anda.y) < MESMO_PONTO_MM) return { estado, recado: null };
    if (opcoes.mouse.modo === 'proporcional') {
      const fase = faseDoProporcional(graduacao, estado);
      // Com tamanhos dos dois lados do base, o primeiro clique é o do menor: fica guardado à espera do maior.
      if (fase === 'menor-e-depois-maior') return { estado: { ...estado, livres: [clique.livre] }, recado: null };
      const noMenor = fase === 'so-menor' ? anda : estado.livres[0] ? { x: estado.livres[0].x - contorno[i]!.x, y: estado.livres[0].y - contorno[i]!.y } : null;
      const regra = regraProporcional(graduacao, noMenor, fase === 'so-menor' ? null : anda);
      return com(
        definirRegra(graduacao, contorno, i, regra),
        `Ponto ${i + 1} graduado pelo mouse, na proporção: ${descreverRegra(graduacao, regra)}${
          noMenor ? `; no tamanho ${graduacao.tamanhos[0]}, DX ${mm(paraATela(noMenor).dx)} e DY ${mm(paraATela(noMenor).dy)}` : ''
        }.`,
        SEM_TRECHO,
      );
    }
    const regra = opcoes.mouse.modo === 'absoluto' ? regraPeloTamanhoDeReferencia(graduacao, anda) : regraPorPasso(graduacao, anda);
    return com(definirRegra(graduacao, contorno, i, regra), `Ponto ${i + 1} graduado pelo mouse: ${descreverRegra(graduacao, regra)}.`, SEM_TRECHO);
  }

  // "Copiar", com a origem já indicada: o clique num ponto de OUTRA peça graduada copia a regra para ela.
  if (modo === 'copiar-graduacao' && estado.inicio && !clique.noContorno && contexto.raioMm !== undefined) {
    const destino = pontoDeOutraPeca(pecas, peca.id, clique.livre, contexto.raioMm);
    if (destino) {
      const daOutra = destino.peca.graduacao;
      if (!daOutra) return { estado, recado: `“${destino.peca.nome}” ainda não tem tamanhos: defina-os nela (Tabela) antes de copiar a graduação para lá.` };
      try {
        const de = estado.inicio.indiceAresta;
        const copiada = regraDoPonto('copiada', 'copiada', graduacao, regraCopiada(regraDoVertice(graduacao, contorno, de), opcoes.copiar));
        const origem = regraParaAGraduacao({ ...copiada, nome: `do ponto ${de + 1} de “${peca.nome}”` }, daOutra);
        const regra = regraNoEixo(regraDoVertice(daOutra, destino.peca.contorno, destino.indice), origem, EIXO_DO_MUNDO[opcoes.copiar.eixo]);
        return {
          estado,
          pecas: trocar(pecas, destino.peca.id, { ...destino.peca, graduacao: definirRegra(daOutra, destino.peca.contorno, destino.indice, regra) }),
          recado: `${NOME_DO_EIXO[opcoes.copiar.eixo]} do ponto ${de + 1} de “${peca.nome}” copiado para o ponto ${destino.indice + 1} de “${destino.peca.nome}”.`,
        };
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  const i = verticeClicado(peca, clique);
  // A "Tabela" serve também para os piques: o clique num pique, fora de um ponto do contorno, abre a tabela dele.
  if (i === null && modo === 'graduar-tabela' && contexto.raioMm !== undefined) {
    const pique = piquePerto(peca, clique.livre, contexto.raioMm);
    if (pique) return { estado, recado: null, abrir: { tipo: 'tabela-do-pique', id: pique.id } };
  }
  // "Automático" e "Tangente" também graduam piques: o clique num pique, fora de um ponto do contorno, faz ele andar sobre o contorno.
  if (i === null && (modo === 'graduar-automatico' || modo === 'graduar-tangente') && contexto.raioMm !== undefined) {
    const pique = piquePerto(peca, clique.livre, contexto.raioMm);
    if (pique) {
      const doTamanho = modo === 'graduar-automatico' ? opcoes.automatico.tamanho : opcoes.tangente.tamanho;
      const qual = doTamanho === TODOS_OS_TAMANHOS ? null : indiceDoTamanho(graduacao.tamanhos, doTamanho);
      if (qual !== null && qual < 0) return { estado, recado: `A peça não tem o tamanho “${doTamanho}”: abra a ferramenta de novo e escolha outro.` };
      const noTamanho = qual === null ? '' : `, no tamanho ${doTamanho}`;
      /** De onde a distância do pique passa a ser contada: o ponto de referência que ele ficou tendo. */
      const daReferencia = (nova: Molde): string => {
        const graduado = nova.piques.find((q) => q.id === pique.id);
        const referencia = graduado ? referenciaDoPique(nova, graduado) : null;
        return referencia === null ? '' : ` A distância é contada do ponto ${referencia + 1}, a referência dele.`;
      };
      try {
        if (modo === 'graduar-automatico') {
          // O pique só anda sobre o contorno: de DX e DY, vale a parte na direção da borda onde ele está.
          const passo = paraOMundo({ dx: opcoes.automatico.dxMm, dy: opcoes.automatico.dyMm });
          const direcao = direcaoDoContornoNoPique(peca, pique);
          const andado = passo.x * direcao.x + passo.y * direcao.y;
          if (Math.abs(andado) < 0.005) {
            return { estado, recado: `O pique só anda sobre o contorno, e DX ${mm(opcoes.automatico.dxMm)} e DY ${mm(opcoes.automatico.dyMm)} não têm parte na direção da borda onde ele está: nada mudou.` };
          }
          const graduada = graduarPiqueNoContorno(peca, pique.id, andado, qual);
          return {
            estado,
            pecas: trocar(pecas, peca.id, graduada),
            recado:
              `Pique graduado${noTamanho}: anda ${mm(Math.abs(andado))} ${qual === null ? 'por tamanho' : 'em relação ao tamanho vizinho'} sobre o contorno, no sentido do ponto ${andado > 0 ? ((pique.indiceAresta + 1) % contorno.length) + 1 : pique.indiceAresta + 1} — a parte de DX ${mm(opcoes.automatico.dxMm)} e DY ${mm(opcoes.automatico.dyMm)} na direção da borda.` +
              daReferencia(graduada),
          };
        }
        const { distanciaMm, inverter, incremental } = opcoes.tangente;
        const quanto = incremental ? (qual === null ? 'por tamanho' : 'a partir do tamanho vizinho') : 'a partir do base';
        const graduada = graduarPiqueNoContorno(peca, pique.id, inverter ? 0 - distanciaMm : distanciaMm, qual, incremental);
        return {
          estado,
          pecas: trocar(pecas, peca.id, graduada),
          recado:
            `Pique graduado na tangente${noTamanho}: anda ${mm(distanciaMm)} ${quanto} sobre o contorno, no sentido do ponto ${inverter ? pique.indiceAresta + 1 : ((pique.indiceAresta + 1) % contorno.length) + 1}.` +
            daReferencia(graduada),
        };
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  if (i === null) return { estado, recado: NO_PONTO };
  const ponto = `Ponto ${i + 1}`;
  const noVertice: TrechoEmEdicao = { ...SEM_TRECHO, inicio: { indiceAresta: i, ponto: contorno[i]! } };

  switch (modo) {
    case 'graduar-tabela':
      return { estado, recado: null, abrir: { tipo: 'tabela', indice: i } };
    case 'criar-regra':
      return { estado, recado: null, abrir: { tipo: 'nome-da-regra', indice: i } };
    case 'graduar-mouse':
      return { estado: noVertice, recado: null };
    case 'graduar-automatico': {
      const { dxMm, dyMm, tamanho } = opcoes.automatico;
      const qual = tamanho === TODOS_OS_TAMANHOS ? null : indiceDoTamanho(graduacao.tamanhos, tamanho);
      if (qual !== null && qual < 0) return { estado, recado: `A peça não tem o tamanho “${tamanho}”: abra “Automático” de novo e escolha outro.` };
      try {
        const regra = regraComPasso(graduacao, regraDoVertice(graduacao, contorno, i), paraOMundo({ dx: dxMm, dy: dyMm }), qual);
        return com(
          definirRegra(graduacao, contorno, i, regra),
          qual === null
            ? `${ponto} graduado: DX ${mm(dxMm)} e DY ${mm(dyMm)} por tamanho.`
            : `${ponto} graduado no tamanho ${tamanho}: DX ${mm(dxMm)} e DY ${mm(dyMm)} em relação ao ${graduacao.tamanhos[qual > graduacao.base ? qual - 1 : qual + 1]}; os outros tamanhos ficaram como estavam.`,
        );
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'ajustar-graduacao': {
      if (!estado.inicio) return { estado: noVertice, recado: null };
      const inicial = estado.inicio.indiceAresta;
      if (i === inicial) return { estado, recado: `O ponto ${i + 1} é o inicial: clique nos pontos a ajustar e, por último, no ponto final.` };
      const clicados = clicadosNoAjuste(peca, estado);
      if (i !== clicados.at(-1)) {
        // Um ponto novo entra na fila; um que já estava nela (e não é o último) sai.
        const fila = clicados.includes(i) ? clicados.filter((v) => v !== i) : [...clicados, i];
        return { estado: { ...estado, livres: fila.map((v) => contorno[v]!) }, recado: null };
      }
      // Segundo clique no último ponto: ele é o final, e os anteriores são os ajustados.
      const ajustados = clicados.slice(0, -1);
      if (ajustados.length === 0) return { estado, recado: 'Antes do ponto final, clique em pelo menos um ponto a ajustar.' };
      try {
        const nova = ajustarEntre(graduacao, contorno, inicial, ajustados, i, EIXO_DO_MUNDO[opcoes.ajustar.eixo]);
        const quantos = ajustados.length === 1 ? `O ponto ${ajustados[0]! + 1} foi ajustado` : `${ajustados.length} pontos (${lista(ajustados.map((v) => String(v + 1)))}) foram ajustados`;
        return com(nova, `${quantos} entre o ponto ${inicial + 1} e o ponto ${i + 1} (${NOME_DO_EIXO[opcoes.ajustar.eixo]}): andam na proporção da posição deles entre os dois.`, SEM_TRECHO);
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'graduar-tangente': {
      const n = contorno.length;
      const { distanciaMm, inverter, usarContornoBase, tamanho, incremental } = opcoes.tangente;
      const vizinho = inverter ? (i - 1 + n) % n : (i + 1) % n;
      const qual = tamanho === TODOS_OS_TAMANHOS ? null : indiceDoTamanho(graduacao.tamanhos, tamanho);
      if (qual !== null && qual < 0) return { estado, recado: `A peça não tem o tamanho “${tamanho}”: abra “Tangente” de novo e escolha outro.` };
      try {
        const regra = regraNaTangente(graduacao, contorno, i, vizinho, distanciaMm, { usarContornoBase, incremental, tamanho: qual });
        const quanto = incremental ? (qual === null ? 'por tamanho' : 'a partir do tamanho vizinho') : 'a partir do base';
        return com(
          definirRegra(graduacao, contorno, i, regra),
          `${ponto} graduado na tangente${qual === null ? '' : `, no tamanho ${tamanho}`}: ${mm(distanciaMm)} ${quanto}, na direção do ponto ${vizinho + 1}${usarContornoBase || !incremental ? '' : ', seguindo a aresta de cada tamanho'}.`,
        );
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'graduar-regras': {
      if (!contexto.regra) return { estado, recado: 'Escolha antes uma regra, em “Regras”.' };
      try {
        const regra = regraParaAGraduacao(contexto.regra, graduacao);
        return com(definirRegra(graduacao, contorno, i, regra), `Regra “${contexto.regra.nome}” aplicada ao ponto ${i + 1}: ${descreverRegra(graduacao, regra)}.`);
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'remover-graduacao':
      return com(
        apagarRegras(graduacao, contorno, i, EIXO_DO_MUNDO[opcoes.remover.eixo]),
        `${NOME_DO_EIXO[opcoes.remover.eixo]} apagado do ponto ${i + 1}: ele fica parado nisso, em todos os tamanhos.`,
      );
    case 'deduzir-graduacao':
      return com(
        descontarPonto(graduacao, contorno, i),
        `${ponto} é agora o ponto fixo: a graduação dele foi descontada de todos, e os tamanhos ficam empilhados nele.`,
      );
    case 'graduar-curva': {
      const eraGraduado = pontoGraduadoEm(graduacao, contorno, i) !== null;
      return com(
        alternarPontoGraduado(graduacao, contorno, i),
        eraGraduado
          ? `${ponto} voltou a ser proporcional: anda entre os pontos graduados vizinhos.`
          : `${ponto} agora é um ponto graduado, com a regra que tinha na proporção; já pode ganhar regra própria.`,
      );
    }
    case 'agrupar-graduacao': {
      const { dxMm, dyMm, tamanho } = opcoes.agrupar;
      const qual = tamanho === TODOS_OS_TAMANHOS ? null : indiceDoTamanho(graduacao.tamanhos, tamanho);
      if (qual !== null && qual < 0) return { estado, recado: `A peça não tem o tamanho “${tamanho}”: abra “Agrupar” de novo e escolha outro.` };
      try {
        const nova = agruparTamanhos(graduacao, contorno, i, paraOMundo({ dx: dxMm, dy: dyMm }), qual);
        const quais = qual === null ? 'Os tamanhos' : `O tamanho ${tamanho}`;
        return com(
          nova,
          dxMm === 0 && dyMm === 0
            ? `${quais} ${qual === null ? 'ficaram empilhados' : 'ficou empilhado'} no ponto ${i + 1} (agrupados): ele não anda mais de um tamanho para o outro.`
            : `${quais} ${qual === null ? 'ficaram afastados' : 'ficou afastado'} a partir do ponto ${i + 1} (desagrupados): DX ${mm(dxMm)} e DY ${mm(dyMm)} de um tamanho ao vizinho.`,
        );
      } catch (e) {
        return { estado, recado: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'copiar-graduacao': {
      if (!estado.inicio) {
        if (opcoes.copiar.destino !== 'todos') return { estado: noVertice, recado: null };
        const origem = regraCopiada(regraDoVertice(graduacao, contorno, i), opcoes.copiar);
        const destinos = verticesGraduados(graduacao, contorno).filter((v) => v !== i);
        const nova = destinos.reduce(
          (g, v) => definirRegra(g, contorno, v, regraNoEixo(regraDoVertice(g, contorno, v), origem, EIXO_DO_MUNDO[opcoes.copiar.eixo])),
          graduacao,
        );
        return com(nova, `${NOME_DO_EIXO[opcoes.copiar.eixo]} do ponto ${i + 1} copiado para os outros ${destinos.length} pontos graduados.`);
      }
      const de = estado.inicio.indiceAresta;
      if (de === i) return { estado, recado: 'Clique noutro ponto: este é o de onde a regra está sendo copiada.' };
      const origem = regraCopiada(regraDoVertice(graduacao, contorno, de), opcoes.copiar);
      const regra = regraNoEixo(regraDoVertice(graduacao, contorno, i), origem, EIXO_DO_MUNDO[opcoes.copiar.eixo]);
      return com(definirRegra(graduacao, contorno, i, regra), `${NOME_DO_EIXO[opcoes.copiar.eixo]} do ponto ${de + 1} copiado para o ponto ${i + 1}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Prévia e instruções
// ---------------------------------------------------------------------------

/**
 * O que o desenho mostra com a ferramenta ligada: um anel em cada ponto
 * graduado da peça e, no "Mouse", o tamanho da ponta como ficaria com o ponto
 * indicado posto onde o mouse está.
 */
export function previaDaGraduacao(
  modo: ModoDeGraduacao,
  opcoes: OpcoesDaGraduacao,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: Ponto2D | null,
): PreviaDeFerramentaDeMolde {
  const graduacao = peca.graduacao;
  if (!graduacao) return {};
  // "Separar": as peças novas presas ao mouse, como ficariam com o clique.
  if (modo === 'separar-tamanhos') {
    if (!mouse) return {};
    try {
      const novas = separarTamanhosEm(peca, tamanhosASeparar(opcoes, peca), () => 'previa', mouse);
      return { linhas: novas.map((nova) => [...nova.contorno, nova.contorno[0]!]) };
    } catch {
      return {};
    }
  }
  const marcas = verticesGraduados(graduacao, peca.contorno).map((i) => peca.contorno[i]!);
  if (modo === 'ajustar-graduacao' && estado.inicio) {
    // A projeção: o tamanho da ponta como ficaria com os pontos já clicados ajustados (o último é o final).
    const clicados = clicadosNoAjuste(peca, estado);
    const substituido = [estado.inicio.ponto, ...estado.livres];
    if (clicados.length < 2) return { marcas, substituido };
    try {
      const ajustada = ajustarEntre(graduacao, peca.contorno, estado.inicio.indiceAresta, clicados.slice(0, -1), clicados.at(-1)!, EIXO_DO_MUNDO[opcoes.ajustar.eixo]);
      return { novo: contornoDoTamanho(ajustada, peca.contorno, tamanhoDeReferencia(graduacao)), novoFechado: true, marcas, substituido };
    } catch {
      return { marcas, substituido };
    }
  }
  if (modo !== 'graduar-mouse' || !estado.inicio || !mouse) return { marcas };
  const i = estado.inicio.indiceAresta;
  const anda = { x: mouse.x - peca.contorno[i]!.x, y: mouse.y - peca.contorno[i]!.y };
  if (Math.hypot(anda.x, anda.y) < MESMO_PONTO_MM) return { marcas };
  if (opcoes.mouse.modo === 'proporcional') {
    // O tamanho que o clique vai indicar: o menor ou o maior, com o ponto onde o mouse está.
    const fase = faseDoProporcional(graduacao, estado);
    const doMenor = fase !== 'maior';
    const guardado = estado.livres[0] ? { x: estado.livres[0].x - peca.contorno[i]!.x, y: estado.livres[0].y - peca.contorno[i]!.y } : null;
    const regraDeAgora = regraProporcional(graduacao, doMenor ? anda : guardado, doMenor ? null : anda);
    return {
      novo: contornoDoTamanho(definirRegra(graduacao, peca.contorno, i, regraDeAgora), peca.contorno, doMenor ? 0 : graduacao.tamanhos.length - 1),
      novoFechado: true,
      marcas,
    };
  }
  const regra = opcoes.mouse.modo === 'absoluto' ? regraPeloTamanhoDeReferencia(graduacao, anda) : regraPorPasso(graduacao, anda);
  const comARegra = definirRegra(graduacao, peca.contorno, i, regra);
  return { novo: contornoDoTamanho(comARegra, peca.contorno, tamanhoDeReferencia(graduacao)), novoFechado: true, marcas };
}

const ESC = ' Esc sai.';

/** A instrução do próximo clique, para a faixa de mensagens. */
export function instrucaoDaGraduacao(
  modo: ModoDeGraduacao,
  opcoes: OpcoesDaGraduacao,
  estado: TrechoEmEdicao,
  regra: RegraCadastrada | null,
  conjunto: ConjuntoEmUso | null = null,
): string {
  const numero = estado.inicio ? estado.inicio.indiceAresta + 1 : 0;
  switch (modo) {
    case 'separar-tamanhos':
      return `Separar: clique onde ${opcoes.separar.tamanho === TODOS_OS_TAMANHOS ? 'as peças separadas devem ficar (a primeira ali, pelo canto de cima à esquerda, e as outras em fila depois dela)' : `a peça do tamanho ${opcoes.separar.tamanho} deve ficar (pelo canto de cima à esquerda)`} — o tracejado mostra.` + ESC;
    case 'graduar-tabela':
      return 'Tabela: clique num ponto do contorno da peça selecionada para ver e mudar a graduação dele (os anéis marcam os pontos graduados) — ou num pique, para a tabela dele.' + ESC;
    case 'graduar-automatico':
      return (
        `Automático: clique nos pontos que devem andar DX ${mm(opcoes.automatico.dxMm)} e DY ${mm(opcoes.automatico.dyMm)} ${opcoes.automatico.tamanho === TODOS_OS_TAMANHOS ? 'por tamanho' : `no tamanho ${opcoes.automatico.tamanho}`} — ou num pique, que anda sobre o contorno a parte disso na direção da borda.` + ESC
      );
    case 'ajustar-graduacao':
      if (!estado.inicio) return `Ajustar (${NOME_DO_EIXO[opcoes.ajustar.eixo]}): clique no ponto inicial.` + ESC;
      return estado.livres.length < 2
        ? `Ajustar: a partir do ponto ${numero}, clique nos pontos a ajustar e, por último, no ponto final.` + ESC
        : `Ajustar: o tracejado mostra o tamanho da ponta com ${estado.livres.length - 1} ponto(s) ajustado(s). Clique de novo no último ponto para confirmar — ou em mais pontos; o último clicado é o final.` + ESC;
    case 'graduar-mouse':
      if (!estado.inicio) return 'Mouse: clique no ponto do contorno a graduar.' + ESC;
      if (opcoes.mouse.modo === 'proporcional') {
        return (
          (estado.livres.length === 0
            ? `Mouse (proporcional): clique onde o ponto ${numero} deve ficar no menor tamanho — ou no maior, se não há tamanho menor que o base. O tracejado mostra esse tamanho.`
            : `Mouse (proporcional): agora clique onde o ponto ${numero} deve ficar no maior tamanho — o tracejado mostra esse tamanho.`) + ESC
        );
      }
      return (
        `Mouse: clique onde o ponto ${numero} deve ficar ${opcoes.mouse.modo === 'absoluto' ? 'no tamanho da ponta' : 'no tamanho seguinte ao base'} — o tracejado mostra o tamanho da ponta.` + ESC
      );
    case 'graduar-tangente':
      return (
        `Tangente: clique nos pontos que devem andar ${mm(opcoes.tangente.distanciaMm)} ${opcoes.tangente.tamanho === TODOS_OS_TAMANHOS ? (opcoes.tangente.incremental ? 'por tamanho' : 'a partir do base') : `no tamanho ${opcoes.tangente.tamanho}`}, na direção da aresta que ${opcoes.tangente.inverter ? 'chega a' : 'sai de'} cada um — ou num pique, que anda essa distância sobre o contorno.` + ESC
      );
    case 'graduar-regras':
      if (regra && conjunto) {
        return `Regras (conjunto “${conjunto.nome}”, regra ${conjunto.numero} de ${conjunto.total}: “${regra.nome}”): clique no ponto que deve receber essa regra — o clique seguinte aplica a próxima.` + ESC;
      }
      return (regra ? `Regras (“${regra.nome}”): clique nos pontos que devem receber essa regra.` : 'Regras: escolha antes uma regra.') + ESC;
    case 'criar-regra':
      return 'Criar regra: clique no ponto cuja graduação deve ser guardada como regra.' + ESC;
    case 'remover-graduacao':
      return `Remover graduação (${NOME_DO_EIXO[opcoes.remover.eixo]}): clique nos pontos que devem ficar parados.` + ESC;
    case 'agrupar-graduacao':
      return opcoes.agrupar.dxMm === 0 && opcoes.agrupar.dyMm === 0
        ? 'Agrupar: clique no ponto de referência — os tamanhos ficam empilhados nele.' + ESC
        : `Desagrupar: clique no ponto de referência — cada tamanho fica a DX ${mm(opcoes.agrupar.dxMm)} e DY ${mm(opcoes.agrupar.dyMm)} do vizinho, a partir dele.` + ESC;
    case 'deduzir-graduacao':
      return 'Deduzir: clique no ponto que deve ficar fixo — a graduação dele é descontada de todos os pontos.' + ESC;
    case 'copiar-graduacao':
      if (!estado.inicio) return `Copiar graduação (${NOME_DO_EIXO[opcoes.copiar.eixo]}): clique no ponto de onde copiar.` + ESC;
      return `Copiar graduação: clique nos pontos que devem receber a regra do ponto ${numero}.` + ESC;
    case 'graduar-curva':
      return 'Graduar curva: clique num ponto proporcional para torná-lo graduado, ou num graduado para voltar a proporcional (os anéis marcam os graduados).' + ESC;
  }
}
