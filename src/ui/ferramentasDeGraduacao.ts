import { distancia, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import {
  agruparPonto,
  alternarPontoGraduado,
  apagarRegras,
  contornoDoTamanho,
  definirRegra,
  descontarPonto,
  indiceDoTamanho,
  lerTamanhos,
  pontoGraduadoEm,
  regraDoVertice,
  regraNoEixo,
  regraPeloTamanhoDeReferencia,
  regraPorPasso,
  somarRegras,
  tamanhoDeReferencia,
  verticesGraduados,
  type EixoDaGraduacao,
  type Graduacao,
} from '../domain/graduacao';
import { semGraduacao, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde, separarTamanhos, unirTamanhos } from '../domain/tamanhosGraduados';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { PreviaDeFerramentaDeMolde, ResultadoDeFerramentaDeMolde } from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';
import { regraParaAGraduacao, type RegraCadastrada } from './regrasDeGraduacao';
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

/** As que ficam ligadas à espera de cliques no desenho; "Separar" e "Unir" agem na hora. */
export type ModoDeGraduacao = Exclude<FerramentaDeGraduacao, 'separar-tamanhos' | 'unir-tamanhos'>;

const MODOS_DE_GRADUACAO: ReadonlySet<string> = new Set([
  'graduar-tabela',
  'graduar-automatico',
  'graduar-mouse',
  'graduar-tangente',
  'graduar-regras',
  'criar-regra',
  'remover-graduacao',
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
  readonly automatico: { readonly dxMm: number; readonly dyMm: number };
  readonly ajustar: { readonly dxMm: number; readonly dyMm: number };
  readonly mouse: { readonly modo: 'absoluto' | 'incremental' };
  readonly tangente: { readonly distanciaMm: number; readonly inverter: boolean };
  readonly remover: { readonly onde: 'pontos' | 'molde'; readonly eixo: EixoNaTela };
  readonly copiar: {
    readonly eixo: EixoNaTela;
    readonly inverterDx: boolean;
    readonly inverterDy: boolean;
    readonly destino: 'cliques' | 'todos';
  };
  /** O nome do tamanho a separar, ou "todos". */
  readonly separar: { readonly tamanho: string };
}

export const TODOS_OS_TAMANHOS = 'todos';

export const OPCOES_INICIAIS_DA_GRADUACAO: OpcoesDaGraduacao = {
  automatico: { dxMm: 10, dyMm: 0 },
  ajustar: { dxMm: 0, dyMm: 0 },
  mouse: { modo: 'absoluto' },
  tangente: { distanciaMm: 5, inverter: false },
  remover: { onde: 'pontos', eixo: 'dx-dy' },
  copiar: { eixo: 'dx-dy', inverterDx: false, inverterDy: false, destino: 'cliques' },
  separar: { tamanho: TODOS_OS_TAMANHOS },
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

/** O diálogo que a ferramenta abre antes de agir; `null` para as que não perguntam nada. */
export function dialogoDaGraduacao(ferramenta: FerramentaDeGraduacao, opcoes: OpcoesDaGraduacao, peca: Molde): DialogoDeGraduacao | null {
  switch (ferramenta) {
    case 'graduar-automatico':
      return {
        titulo: 'Graduar: automático',
        campos: [
          { tipo: 'medida', id: 'dx', rotulo: 'Diferença de DX por tamanho (mm, + para a direita)', inicial: paraOCampo(opcoes.automatico.dxMm) },
          { tipo: 'medida', id: 'dy', rotulo: 'Diferença de DY por tamanho (mm, + para baixo)', inicial: paraOCampo(opcoes.automatico.dyMm) },
        ],
        nota: 'Depois de confirmar, clique nos pontos do contorno. Cada um passa a andar essa diferença a mais em cada tamanho acima do base, e a menos em cada um abaixo, no lugar da regra que tinha.',
        rotuloDoBotao: INDICAR,
      };
    case 'ajustar-graduacao':
      return {
        titulo: 'Ajustar graduação',
        campos: [
          { tipo: 'medida', id: 'dx', rotulo: 'Acréscimo de DX por tamanho (mm, + para a direita)', inicial: paraOCampo(opcoes.ajustar.dxMm) },
          { tipo: 'medida', id: 'dy', rotulo: 'Acréscimo de DY por tamanho (mm, + para baixo)', inicial: paraOCampo(opcoes.ajustar.dyMm) },
        ],
        nota: 'Depois de confirmar, clique nos pontos do contorno. O acréscimo é somado à regra que o ponto já tem (para mexer só no DX, deixe o DY em zero). O manual da referência não descreve a construção desta ferramenta; esta é a leitura natural.',
        rotuloDoBotao: INDICAR,
      };
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
            ],
            inicial: opcoes.mouse.modo,
          },
        ],
        nota: 'Depois de confirmar, clique num ponto do contorno e, em seguida, onde ele deve ficar. O desenho mostra o tamanho da ponta enquanto o mouse anda. O modo “Proporcional” da referência não existe aqui: os pontos de curva já andam sempre na proporção dos vizinhos.',
        rotuloDoBotao: INDICAR,
      };
    case 'graduar-tangente':
      return {
        titulo: 'Graduar: tangente',
        campos: [
          { tipo: 'medida', id: 'distancia', rotulo: 'Distância por tamanho (mm)', inicial: paraOCampo(opcoes.tangente.distanciaMm) },
          { tipo: 'caixa', id: 'inverter', rotulo: 'Inverter sentido: pela aresta que chega ao ponto', inicial: opcoes.tangente.inverter },
        ],
        nota: 'Depois de confirmar, clique nos pontos do contorno. Cada um passa a andar essa distância por tamanho na direção da aresta que sai dele (a que vai para o ponto de número seguinte), no contorno base — ou, invertendo, na da aresta que chega.',
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
        nota: 'Depois de confirmar, clique no ponto de onde copiar e, em seguida, nos pontos que devem receber a regra.',
        rotuloDoBotao: INDICAR,
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
        ],
        nota: `As peças novas ficam em fila depois das que já estão na mesa, cada uma com o contorno e o nome do seu tamanho, sem graduação — prontas para o encaixe. Esta continua graduada, no tamanho ${graduacao.tamanhos[graduacao.base]}.`,
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
      return { ...opcoes, automatico: { dxMm: numero('dx'), dyMm: numero('dy') } };
    case 'ajustar-graduacao':
      if (numero('dx') === 0 && numero('dy') === 0) throw new Error('Informe um acréscimo de DX ou de DY diferente de zero.');
      return { ...opcoes, ajustar: { dxMm: numero('dx'), dyMm: numero('dy') } };
    case 'graduar-mouse':
      return { ...opcoes, mouse: { modo: valores.modo === 'incremental' ? 'incremental' : 'absoluto' } };
    case 'graduar-tangente':
      if (numero('distancia') === 0) throw new Error('A distância por tamanho precisa ser diferente de zero.');
      return { ...opcoes, tangente: { distanciaMm: numero('distancia'), inverter: caixa('inverter') } };
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
      return { ...opcoes, separar: { tamanho: String(valores.tamanho) } };
    default:
      return opcoes;
  }
}

// ---------------------------------------------------------------------------
// O que age na hora: Separar, Unir e Remover do molde inteiro
// ---------------------------------------------------------------------------

/** "Separar": as peças novas entram no projeto, ao lado da graduada. */
export function aplicarSeparar(opcoes: OpcoesDaGraduacao, pecas: readonly Molde[], peca: Molde, novoId: () => string): ResultadoDeFerramentaDeMolde {
  const graduacao = peca.graduacao;
  if (!graduacao) throw new Error(SEM_TAMANHOS);
  const pedido = opcoes.separar.tamanho;
  const quais =
    pedido === TODOS_OS_TAMANHOS
      ? graduacao.tamanhos.map((_, t) => t).filter((t) => t !== graduacao.base)
      : [indiceDoTamanho(graduacao.tamanhos, pedido)].filter((t) => t >= 0 && t !== graduacao.base);
  if (quais.length === 0) throw new Error('Escolha um tamanho diferente do base para separar.');
  // A fila das peças novas começa depois de todas as que já estão na mesa, para não cair em cima de nenhuma.
  const fimDasPecas = Math.max(...pecas.map((p) => retanguloEnvolvente(p.contorno).maxY));
  const novas = separarTamanhos(peca, quais, novoId, fimDasPecas);
  const nomes = lista(quais.map((t) => graduacao.tamanhos[t]!));
  return {
    pecas: [...pecas, ...novas],
    recado:
      novas.length === 1
        ? `Tamanho ${nomes} de “${peca.nome}” separado: é uma peça própria, posta depois das que já estavam na mesa, pronta para o encaixe.`
        : `${novas.length} peças criadas a partir de “${peca.nome}”, nos tamanhos ${nomes}: estão em fila depois das que já estavam na mesa, prontas para o encaixe.`,
  };
}

/** "Unir": a peça selecionada vira a graduada, e as marcadas na lista viram os outros tamanhos dela. */
export function aplicarUnir(pecas: readonly Molde[], peca: Molde, marcadas: ReadonlySet<string>): ResultadoDeFerramentaDeMolde {
  const outras = pecas.filter((p) => marcadas.has(p.id) && p.id !== peca.id);
  const unida = unirTamanhos(peca, outras);
  const graduacao = unida.graduacao!;
  const saem = new Set(outras.map((p) => p.id));
  return {
    pecas: trocar(
      pecas.filter((p) => !saem.has(p.id)),
      peca.id,
      unida,
    ),
    recado: `“${peca.nome}” agora é graduada nos tamanhos ${lista(graduacao.tamanhos)}, com o ${graduacao.tamanhos[graduacao.base]} de base. ${outras.length === 1 ? 'A peça do outro tamanho foi reunida' : `As ${outras.length} peças dos outros tamanhos foram reunidas`} nela.`,
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

/** O que o clique pede além de mudar a peça: a tabela do ponto, ou o nome da regra a criar. */
export interface DialogoPedidoPeloClique {
  readonly tipo: 'tabela' | 'nome-da-regra';
  /** O número (a partir de 0) do ponto do contorno. */
  readonly indice: number;
}

export interface CliqueDeGraduacao {
  readonly estado: TrechoEmEdicao;
  /** As peças do projeto depois do clique, quando ele mudou alguma coisa (um passo de desfazer). */
  readonly pecas?: readonly Molde[];
  /** O que dizer na faixa de mensagens: o que foi feito, ou por que o clique não serviu. */
  readonly recado: string | null;
  readonly abrir?: DialogoPedidoPeloClique;
}

/** O que a ferramenta precisa além das opções: a regra escolhida em "Regras" e quem dá nome aos grupos. */
export interface ContextoDaGraduacao {
  readonly regra: RegraCadastrada | null;
  readonly novoGrupo: () => string;
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

  // O segundo clique do "Mouse": onde o ponto indicado deve ficar.
  if (modo === 'graduar-mouse' && estado.inicio) {
    const i = estado.inicio.indiceAresta;
    const anda = { x: clique.livre.x - contorno[i]!.x, y: clique.livre.y - contorno[i]!.y };
    if (Math.hypot(anda.x, anda.y) < MESMO_PONTO_MM) return { estado, recado: null };
    const regra = opcoes.mouse.modo === 'absoluto' ? regraPeloTamanhoDeReferencia(graduacao, anda) : regraPorPasso(graduacao, anda);
    return com(definirRegra(graduacao, contorno, i, regra), `Ponto ${i + 1} graduado pelo mouse: ${descreverRegra(graduacao, regra)}.`, SEM_TRECHO);
  }

  const i = verticeClicado(peca, clique);
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
      const regra = regraPorPasso(graduacao, paraOMundo({ dx: opcoes.automatico.dxMm, dy: opcoes.automatico.dyMm }));
      return com(definirRegra(graduacao, contorno, i, regra), `${ponto} graduado: DX ${mm(opcoes.automatico.dxMm)} e DY ${mm(opcoes.automatico.dyMm)} por tamanho.`);
    }
    case 'ajustar-graduacao': {
      const acrescimo = regraPorPasso(graduacao, paraOMundo({ dx: opcoes.ajustar.dxMm, dy: opcoes.ajustar.dyMm }));
      const regra = somarRegras(regraDoVertice(graduacao, contorno, i), acrescimo);
      return com(definirRegra(graduacao, contorno, i, regra), `${ponto} ajustado: agora anda, ${descreverRegra(graduacao, regra)}.`);
    }
    case 'graduar-tangente': {
      const n = contorno.length;
      const vizinho = contorno[opcoes.tangente.inverter ? (i - 1 + n) % n : (i + 1) % n]!;
      const comprimento = distancia(contorno[i]!, vizinho);
      if (comprimento < MESMO_PONTO_MM) return { estado, recado: 'Essa aresta não tem comprimento: não dá a direção da tangente.' };
      const k = opcoes.tangente.distanciaMm / comprimento;
      const regra = regraPorPasso(graduacao, { x: (vizinho.x - contorno[i]!.x) * k, y: (vizinho.y - contorno[i]!.y) * k });
      return com(
        definirRegra(graduacao, contorno, i, regra),
        `${ponto} graduado na tangente: ${mm(opcoes.tangente.distanciaMm)} por tamanho, na direção do ponto ${(opcoes.tangente.inverter ? (i - 1 + n) % n : (i + 1) % n) + 1}.`,
      );
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
      if (!estado.inicio) return { estado: noVertice, recado: null };
      const referencia = estado.inicio.indiceAresta;
      try {
        const { graduacao: nova, agrupou } = agruparPonto(graduacao, contorno, referencia, i, contexto.novoGrupo);
        return com(
          nova,
          agrupou
            ? `${ponto} agrupado com o ponto ${referencia + 1}: recebeu a regra dele, e os dois passam a ser graduados juntos.`
            : `${ponto} saiu do grupo do ponto ${referencia + 1}: fica com a regra, mas passa a ser graduado sozinho.`,
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
  const marcas = verticesGraduados(graduacao, peca.contorno).map((i) => peca.contorno[i]!);
  if (modo !== 'graduar-mouse' || !estado.inicio || !mouse) return { marcas };
  const i = estado.inicio.indiceAresta;
  const anda = { x: mouse.x - peca.contorno[i]!.x, y: mouse.y - peca.contorno[i]!.y };
  if (Math.hypot(anda.x, anda.y) < MESMO_PONTO_MM) return { marcas };
  const regra = opcoes.mouse.modo === 'absoluto' ? regraPeloTamanhoDeReferencia(graduacao, anda) : regraPorPasso(graduacao, anda);
  const comARegra = definirRegra(graduacao, peca.contorno, i, regra);
  return { novo: contornoDoTamanho(comARegra, peca.contorno, tamanhoDeReferencia(graduacao)), novoFechado: true, marcas };
}

const ESC = ' Esc sai.';

/** A instrução do próximo clique, para a faixa de mensagens. */
export function instrucaoDaGraduacao(modo: ModoDeGraduacao, opcoes: OpcoesDaGraduacao, estado: TrechoEmEdicao, regra: RegraCadastrada | null): string {
  const numero = estado.inicio ? estado.inicio.indiceAresta + 1 : 0;
  switch (modo) {
    case 'graduar-tabela':
      return 'Tabela: clique num ponto do contorno da peça selecionada para ver e mudar a graduação dele (os anéis marcam os pontos graduados).' + ESC;
    case 'graduar-automatico':
      return `Automático: clique nos pontos que devem andar DX ${mm(opcoes.automatico.dxMm)} e DY ${mm(opcoes.automatico.dyMm)} por tamanho.` + ESC;
    case 'ajustar-graduacao':
      return `Ajustar: clique nos pontos que devem ganhar DX ${mm(opcoes.ajustar.dxMm)} e DY ${mm(opcoes.ajustar.dyMm)} por tamanho, além do que já andam.` + ESC;
    case 'graduar-mouse':
      return !estado.inicio
        ? 'Mouse: clique no ponto do contorno a graduar.' + ESC
        : `Mouse: clique onde o ponto ${numero} deve ficar ${opcoes.mouse.modo === 'absoluto' ? 'no tamanho da ponta' : 'no tamanho seguinte ao base'} — o tracejado mostra o tamanho da ponta.` + ESC;
    case 'graduar-tangente':
      return `Tangente: clique nos pontos que devem andar ${mm(opcoes.tangente.distanciaMm)} por tamanho, na direção da aresta que ${opcoes.tangente.inverter ? 'chega a' : 'sai de'} cada um.` + ESC;
    case 'graduar-regras':
      return (regra ? `Regras (“${regra.nome}”): clique nos pontos que devem receber essa regra.` : 'Regras: escolha antes uma regra.') + ESC;
    case 'criar-regra':
      return 'Criar regra: clique no ponto cuja graduação deve ser guardada como regra.' + ESC;
    case 'remover-graduacao':
      return `Remover graduação (${NOME_DO_EIXO[opcoes.remover.eixo]}): clique nos pontos que devem ficar parados.` + ESC;
    case 'agrupar-graduacao':
      return !estado.inicio
        ? 'Agrupar: clique no ponto de referência — o que dá a regra ao grupo.' + ESC
        : `Agrupar: clique nos pontos que entram no grupo do ponto ${numero} (um clique num ponto do grupo tira-o dele).` + ESC;
    case 'deduzir-graduacao':
      return 'Deduzir: clique no ponto que deve ficar fixo — a graduação dele é descontada de todos os pontos.' + ESC;
    case 'copiar-graduacao':
      if (!estado.inicio) return `Copiar graduação (${NOME_DO_EIXO[opcoes.copiar.eixo]}): clique no ponto de onde copiar.` + ESC;
      return `Copiar graduação: clique nos pontos que devem receber a regra do ponto ${numero}.` + ESC;
    case 'graduar-curva':
      return 'Graduar curva: clique num ponto proporcional para torná-lo graduado, ou num graduado para voltar a proporcional (os anéis marcam os graduados).' + ESC;
  }
}
