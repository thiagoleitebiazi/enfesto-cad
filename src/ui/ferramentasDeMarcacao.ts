import {
  andarNoContorno,
  area,
  areaAssinada,
  comprimentoDaLinha,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  trechoDoContorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { alinharPique, alinharPiqueInterno, type ModoDeAlinhar } from '../domain/alinharPiques';
import { adicionarTexto, alterarTexto, piquePerto, textoPerto, type PoseDoTexto } from '../domain/anotacoes';
import { ehElemento, tornarAuxiliares, tornarElementos } from '../domain/linhasAuxiliares';
import type { FormatoDePique, Marca, Molde, Pique } from '../domain/molde';
import {
  conferirFormato,
  formaDosElementos,
  inserirPique,
  inserirPiqueInterno,
  marcaPerto,
  nomeDoFormato,
  PIQUE_PADRAO,
  posicaoPelaReferencia,
  proximoCodigo,
  semOsPiques,
  TIPOS_DE_PIQUE,
  tracosDaMarca,
  tracosDoPique,
} from '../domain/piques';
import { definirGraduacaoDoPique, referenciaSugerida, removerGraduacaoDoPique } from '../domain/piquesGraduados';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { PreviaDeFerramentaDeMolde, ResultadoDeFerramentaDeMolde } from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';

/**
 * As ferramentas da aba Marcações: o que cada uma pergunta, o que cada clique
 * faz, o que o desenho mostra e o que a faixa de mensagens diz. As contas e
 * os formatos dos piques são do domínio (`piques.ts`).
 *
 * As medidas são em mm, como no resto do programa (o manual da referência as
 * dá em cm).
 */
export type FerramentaDeMarcacao =
  | 'inserir-pique'
  | 'remover-pique'
  | 'pique-texto'
  | 'multiplos-piques'
  | 'alinhar-piques'
  | 'cadastrar-pique'
  | 'substituir-piques'
  | 'alterar-pique'
  | 'linhas-auxiliares';

/** As que ficam ligadas à espera de cliques no desenho ("Substituir" age pela janela). */
export type ModoDeMarcacao = Exclude<FerramentaDeMarcacao, 'substituir-piques'>;

const MODOS: ReadonlySet<string> = new Set<ModoDeMarcacao>([
  'inserir-pique',
  'remover-pique',
  'pique-texto',
  'multiplos-piques',
  'alinhar-piques',
  'cadastrar-pique',
  'alterar-pique',
  'linhas-auxiliares',
]);

export function ehModoDeMarcacao(modo: string): modo is ModoDeMarcacao {
  return MODOS.has(modo);
}

/** Um formato de pique guardado no cadastro deste computador ("Cadastrar pique"). */
export interface PiqueCadastrado {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string;
  readonly forma: readonly (readonly Ponto2D[])[];
}

export interface OpcoesDeMarcacao {
  readonly inserir: {
    readonly formato: FormatoDePique;
    readonly sobreOContorno: boolean;
    /** A distância do ponto de referência, sobre o contorno; `null` = o pique fica onde for clicado. */
    readonly distanciaMm: number | null;
    readonly codigo: boolean;
    readonly pontoDeControle: boolean;
    readonly manterDistancia: boolean;
    readonly naCostura: 'nao' | 'projetado' | 'estendido';
    /** No pique interno: ele fica a Dx e Dy (os da tela) do ponto clicado. */
    readonly usarDxDy: boolean;
    readonly dxMm: number;
    readonly dyMm: number;
  };
  readonly remover: { readonly doContorno: boolean; readonly internos: boolean };
  readonly multiplos: {
    readonly modo: 'mouse' | 'elemento' | 'contorno';
    readonly por: 'numero' | 'perimetro';
    readonly quantidade: number;
    readonly espacoMm: number;
    readonly formato: FormatoDePique;
  };
  readonly substituir: {
    /** O tipo a substituir, ou `TODOS_OS_TIPOS`. */
    readonly de: string;
    readonly onde: 'selecionada' | 'marcadas' | 'todas';
    readonly acao: 'trocar' | 'marca' | 'remover';
    readonly formato: FormatoDePique;
    readonly distanciaMm: number;
    /** Na troca de formato e na remoção: também os piques internos (as marcas com formato) do tipo escolhido. */
    readonly internos: boolean;
  };
  /** O "Pique texto": o que escrever, a altura das letras, o ângulo e o que fica no ponto clicado. */
  readonly texto: { readonly texto: string; readonly alturaMm: number } & PoseDoTexto;
  readonly alinhar: { readonly modo: ModoDeAlinhar };
  /**
   * O "Cadastrar pique": criar um formato pelo desenho, ou alterar ou excluir um dos cadastrados (`qual`, pelo id).
   * No alterar, `redesenhar` troca também a forma (pelas linhas indicadas, como no criar), e `atualizar` leva a mudança
   * aos piques do projeto já postos com o formato.
   */
  readonly cadastrar: {
    readonly acao: 'criar' | 'alterar' | 'excluir';
    readonly qual: string;
    readonly nome: string;
    readonly descricao: string;
    readonly redesenhar: boolean;
    readonly atualizar: boolean;
  };
  /** As "Linhas auxiliares": adicionar (o elemento passa a ser do molde) ou remover (volta a ser elemento); no modo manual, o Enter confirma as linhas indicadas. */
  readonly linhas: { readonly acao: 'adicionar' | 'remover'; readonly manual: boolean };
}

export const TODOS_OS_TIPOS = 'todos-os-tipos';
/** Quantos piques uma só operação do "Múltiplos" põe, no máximo. */
export const MAXIMO_DE_PIQUES_DE_UMA_VEZ = 200;

export const OPCOES_INICIAIS_DE_MARCACAO: OpcoesDeMarcacao = {
  inserir: {
    formato: PIQUE_PADRAO,
    sobreOContorno: true,
    distanciaMm: null,
    codigo: false,
    pontoDeControle: false,
    manterDistancia: false,
    naCostura: 'nao',
    usarDxDy: false,
    dxMm: 0,
    dyMm: 0,
  },
  remover: { doContorno: false, internos: false },
  multiplos: { modo: 'contorno', por: 'numero', quantidade: 3, espacoMm: 50, formato: PIQUE_PADRAO },
  substituir: { de: TODOS_OS_TIPOS, onde: 'selecionada', acao: 'trocar', formato: { ...PIQUE_PADRAO, tipo: 'v' }, distanciaMm: 10, internos: false },
  texto: { texto: '', alturaMm: 10, anguloGraus: 0, ancora: 'centro' },
  alinhar: { modo: 'vertical' },
  cadastrar: { acao: 'criar', qual: '', nome: '', descricao: '', redesenhar: false, atualizar: false },
  linhas: { acao: 'remover', manual: false },
};

const MESMO_PONTO_MM = 1e-6;
const ESC = ' Esc sai.';

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

function trocar(pecas: readonly Molde[], id: string, nova: Molde): Molde[] {
  return pecas.map((p) => (p.id === id ? nova : p));
}

function paraCampo(valor: number): string {
  const arredondado = Math.round(valor * 100) / 100;
  return String(arredondado === 0 ? 0 : arredondado).replace('.', ',');
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** O tipo de um pique para as listas: o do formato dele; o pique sem formato é o traço. */
function tipoDo(pique: { readonly formato?: FormatoDePique }): string {
  return pique.formato?.tipo ?? 'traco';
}

// ---------------------------------------------------------------------------
// Os campos do formato, iguais em todas as janelas
// ---------------------------------------------------------------------------

const DO_CADASTRO = 'cadastrado:';

/** Os campos do formato: o tipo (os do programa e os cadastrados), a largura, a altura e o ângulo. */
function camposDoFormato(formato: FormatoDePique, cadastrados: readonly PiqueCadastrado[]): CampoDoDialogo[] {
  const opcoes = [
    ...TIPOS_DE_PIQUE.map((tipo) => ({ valor: tipo.id, rotulo: `${tipo.nome}: ${tipo.descricao}` })),
    ...cadastrados.map((c) => ({ valor: DO_CADASTRO + c.id, rotulo: `${c.nome}${c.descricao ? `: ${c.descricao}` : ''} (cadastrado)` })),
  ];
  // O formato que veio de um cadastro que já não existe continua na lista, para não ser trocado sem querer.
  if (!opcoes.some((o) => o.valor === formato.tipo)) opcoes.push({ valor: formato.tipo, rotulo: `${nomeDoFormato(formato)} (do pique)` });
  return [
    { tipo: 'escolha', id: 'tipo', rotulo: 'Pique: o tipo', opcoes, inicial: formato.tipo },
    { tipo: 'medida', id: 'largura', rotulo: 'Largura: ao longo da borda (mm)', inicial: paraCampo(formato.larguraMm) },
    { tipo: 'medida', id: 'altura', rotulo: 'Altura: para dentro da peça (mm)', inicial: paraCampo(formato.alturaMm) },
    { tipo: 'medida', id: 'angulo', rotulo: 'Ângulo (graus; 0 = em esquadro com a borda)', inicial: paraCampo(formato.anguloGraus) },
  ];
}

/** O formato lido da janela; `atual` é o que valia antes (de onde vem a forma de um pique cadastrado que saiu do cadastro). */
function formatoLido(valores: ValoresDoDialogo, cadastrados: readonly PiqueCadastrado[], atual: FormatoDePique): FormatoDePique {
  const tipo = String(valores.tipo);
  const cadastrado = tipo.startsWith(DO_CADASTRO) ? cadastrados.find((c) => DO_CADASTRO + c.id === tipo) : undefined;
  const mesmoDeAntes = tipo === atual.tipo && atual.forma ? { forma: atual.forma, ...(atual.nome ? { nome: atual.nome } : {}) } : {};
  const formato: FormatoDePique = {
    tipo,
    larguraMm: Number(valores.largura),
    alturaMm: Number(valores.altura),
    anguloGraus: Number(valores.angulo),
    ...(cadastrado ? { forma: cadastrado.forma, nome: cadastrado.nome } : mesmoDeAntes),
  };
  conferirFormato(formato);
  return formato;
}

const NOTA_DO_FORMATO =
  'O manual da referência tem a lista de tipos, a largura, a altura e o ângulo, mas não descreve os tipos nem diz de onde o ângulo é contado: os formatos e o ângulo contado do esquadro com a borda (positivo, no sentido anti-horário da tela) são a nossa leitura.';

// ---------------------------------------------------------------------------
// As janelas
// ---------------------------------------------------------------------------

export interface DialogoDeMarcacao {
  readonly titulo: string;
  readonly campos: readonly CampoDoDialogo[];
  readonly nota: string;
  readonly rotuloDoBotao: string;
}

/** Os tipos de pique que as peças dadas têm no contorno, na ordem da lista do programa. */
export function tiposEmUso(pecas: readonly Molde[]): string[] {
  // Os do contorno e os internos (as marcas com formato).
  const usados = new Set(pecas.flatMap((peca) => [...peca.piques.map(tipoDo), ...peca.marcas.filter((marca) => marca.formato).map(tipoDo)]));
  const doPrograma = TIPOS_DE_PIQUE.map((tipo) => tipo.id).filter((id) => usados.has(id));
  return [...doPrograma, ...[...usados].filter((id) => !doPrograma.includes(id))];
}

/** A janela que a ferramenta abre antes dos cliques; `null` na que liga direto. */
export function dialogoDaMarcacao(
  ferramenta: FerramentaDeMarcacao,
  opcoes: OpcoesDeMarcacao,
  pecas: readonly Molde[],
  cadastrados: readonly PiqueCadastrado[] = [],
): DialogoDeMarcacao | null {
  switch (ferramenta) {
    case 'inserir-pique': {
      const o = opcoes.inserir;
      return {
        titulo: 'Inserir pique',
        campos: [
          ...camposDoFormato(o.formato, cadastrados),
          { tipo: 'caixa', id: 'sobreOContorno', rotulo: 'Pique sobre o contorno (sem isso, é um pique interno, dentro da peça)', inicial: o.sobreOContorno },
          {
            tipo: 'medida',
            id: 'distancia',
            rotulo: 'Referência: distância do ponto do contorno mais perto do clique (mm; em branco = onde for clicado)',
            inicial: o.distanciaMm === null ? '' : paraCampo(o.distanciaMm),
            opcional: true,
          },
          { tipo: 'caixa', id: 'codigo', rotulo: 'Código: cada pique recebe o código seguinte da sequência (para o Relacionamento piques)', inicial: o.codigo },
          { tipo: 'caixa', id: 'pontoDeControle', rotulo: 'Adicionar ponto de controle: põe também um ponto no contorno, onde o pique fica', inicial: o.pontoDeControle },
          { tipo: 'caixa', id: 'manterDistancia', rotulo: 'Manter distância nos tamanhos: na peça graduada, a mesma distância do ponto de referência em todos', inicial: o.manterDistancia },
          {
            tipo: 'escolha',
            id: 'naCostura',
            rotulo: 'Pique na costura: como ele vai para a linha de corte, na peça com margem de costura',
            opcoes: [
              { valor: 'nao', rotulo: 'Não vai: fica só no contorno' },
              { valor: 'projetado', rotulo: 'Projetado: no ponto da linha de corte mais perto dele' },
              { valor: 'estendido', rotulo: 'Estendido: seguindo o ângulo do pique até a linha de corte' },
            ],
            inicial: o.naCostura,
          },
          { tipo: 'caixa', id: 'usarDxDy', rotulo: 'Dx e Dy (pique interno): o pique fica a essas distâncias do ponto clicado', inicial: o.usarDxDy },
          { tipo: 'medida', id: 'dx', rotulo: 'Dx (mm, + para a direita)', inicial: paraCampo(o.dxMm) },
          { tipo: 'medida', id: 'dy', rotulo: 'Dy (mm, + para baixo)', inicial: paraCampo(o.dyMm) },
        ],
        nota:
          'Depois de confirmar, cada clique põe um pique na peça selecionada: na borda (com “Pique sobre o contorno”) ou dentro dela. Com a distância da referência preenchida, o clique escolhe o ponto do contorno mais perto, e o pique fica a essa distância dele, para o lado do clique. Com Dx e Dy, o clique junto de um ponto do contorno parte dele. ' +
          NOTA_DO_FORMATO +
          ' O manual também não diz de onde partem o Dx e o Dy: aqui, do ponto clicado.',
        rotuloDoBotao: 'Indicar no desenho',
      };
    }
    case 'remover-pique':
      return {
        titulo: 'Remover pique',
        campos: [
          { tipo: 'caixa', id: 'doContorno', rotulo: 'Todos os piques sobre o contorno', inicial: opcoes.remover.doContorno },
          { tipo: 'caixa', id: 'internos', rotulo: 'Todos os piques internos (as marcas da peça, com ou sem formato)', inicial: opcoes.remover.internos },
        ],
        nota: 'Sem nenhuma das duas marcada, depois de confirmar clique em cima de cada pique que deve sair. Com uma delas marcada, os piques saem da peça selecionada ao confirmar.',
        rotuloDoBotao: 'Remover',
      };
    case 'multiplos-piques': {
      const o = opcoes.multiplos;
      return {
        titulo: 'Inserir múltiplos piques',
        campos: [
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'Modo',
            opcoes: [
              { valor: 'contorno', rotulo: 'Sobre o contorno: entre dois pontos da borda, no sentido horário' },
              { valor: 'mouse', rotulo: 'Pontos do mouse: piques internos, na reta entre dois pontos clicados' },
              { valor: 'elemento', rotulo: 'Elemento: piques internos, ao longo de uma linha interna' },
            ],
            inicial: o.modo,
          },
          {
            tipo: 'escolha',
            id: 'por',
            rotulo: 'Como distribuir',
            opcoes: [
              { valor: 'numero', rotulo: 'Nro. piques: essa quantidade, com espaços iguais, do começo ao fim' },
              { valor: 'perimetro', rotulo: 'Perímetro: um pique a cada tantos mm, a partir do começo' },
            ],
            inicial: o.por,
          },
          { tipo: 'inteiro', id: 'quantidade', rotulo: 'Nro. piques', inicial: String(o.quantidade) },
          { tipo: 'medida', id: 'espaco', rotulo: 'Perímetro: espaço entre um pique e outro (mm)', inicial: paraCampo(o.espacoMm) },
          ...camposDoFormato(o.formato, cadastrados),
        ],
        nota:
          'Depois de confirmar: sobre o contorno, clique na borda onde os piques começam e onde terminam (eles vão no sentido horário); nos pontos do mouse, clique os dois extremos dentro da peça; no elemento, clique na linha interna. O manual da referência dá os modos e os dois jeitos de distribuir, mas não a conta: os espaços iguais do começo ao fim e a contagem a partir do começo são a nossa leitura. ' +
          NOTA_DO_FORMATO,
        rotuloDoBotao: 'Indicar no desenho',
      };
    }
    case 'substituir-piques': {
      const o = opcoes.substituir;
      const emUso = tiposEmUso(pecas);
      return {
        titulo: 'Substituir piques',
        campos: [
          {
            tipo: 'escolha',
            id: 'de',
            rotulo: 'Piques: o tipo a substituir',
            opcoes: [
              { valor: TODOS_OS_TIPOS, rotulo: 'Todos os tipos' },
              ...emUso.map((id) => ({ valor: id, rotulo: nomeDoFormato({ ...PIQUE_PADRAO, tipo: id }) })),
            ],
            inicial: o.de === TODOS_OS_TIPOS || emUso.includes(o.de) ? o.de : TODOS_OS_TIPOS,
          },
          {
            tipo: 'escolha',
            id: 'onde',
            rotulo: 'Em quais moldes',
            opcoes: [
              { valor: 'selecionada', rotulo: 'Só na peça selecionada' },
              { valor: 'marcadas', rotulo: 'Nas peças marcadas na lista' },
              { valor: 'todas', rotulo: 'Em todas as peças' },
            ],
            inicial: o.onde,
          },
          {
            tipo: 'escolha',
            id: 'acao',
            rotulo: 'O que fazer',
            opcoes: [
              { valor: 'trocar', rotulo: 'Substituir pelo pique: mesmo lugar, formato novo' },
              { valor: 'marca', rotulo: 'Substituir por marca: o pique do contorno vira um pique interno, à distância dada' },
              { valor: 'remover', rotulo: 'Remover piques selecionados' },
            ],
            inicial: o.acao,
          },
          ...camposDoFormato(o.formato, cadastrados),
          { tipo: 'medida', id: 'distancia', rotulo: 'Distância: do pique do contorno ao pique interno que o substitui (mm)', inicial: paraCampo(o.distanciaMm) },
          { tipo: 'caixa', id: 'internos', rotulo: 'Também os piques internos do tipo escolhido (na troca de formato e na remoção)', inicial: o.internos },
        ],
        nota: 'Vale para os piques do contorno do tipo escolhido. Ao aplicar, a faixa de mensagens diz quantos foram substituídos ou removidos. O pique interno fica para dentro da peça, em esquadro com a borda. Com a última caixa marcada, a troca de formato e a remoção pegam também os piques internos — as marcas com formato; o ponto sem formato não entra. O manual da referência só fala dos piques do contorno: os internos são a nossa leitura.',
        rotuloDoBotao: 'Aplicar',
      };
    }
    case 'pique-texto': {
      const o = opcoes.texto;
      return {
        titulo: 'Inserir pique texto',
        campos: [
          { tipo: 'texto', id: 'texto', rotulo: 'Texto', inicial: o.texto },
          { tipo: 'medida', id: 'altura', rotulo: 'Altura das letras (mm)', inicial: paraCampo(o.alturaMm) },
          { tipo: 'medida', id: 'angulo', rotulo: 'Ângulo (graus; 0 = na horizontal da tela, positivo no sentido anti-horário)', inicial: paraCampo(o.anguloGraus) },
          {
            tipo: 'escolha',
            id: 'referencia',
            rotulo: 'Referência: o que fica no ponto clicado',
            opcoes: [
              { valor: 'centro', rotulo: 'O meio do texto' },
              { valor: 'inicio', rotulo: 'O começo do texto' },
              { valor: 'fim', rotulo: 'O fim do texto' },
            ],
            inicial: o.ancora,
          },
        ],
        nota: 'Depois de confirmar, cada clique dentro da peça selecionada escreve o texto ali. Ele faz parte da peça: anda, gira e sai no PDF com ela. Para mudar ou apagar um texto, use “Alterar” e clique nele. O manual da referência tem o campo “Referência” e não diz que posições ele oferece: o meio, o começo e o fim são a nossa leitura.',
        rotuloDoBotao: 'Indicar no desenho',
      };
    }
    case 'alinhar-piques':
      return {
        titulo: 'Alinhar piques',
        campos: [
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'Modo',
            opcoes: [
              { valor: 'horizontal', rotulo: 'Horizontal: a linha horizontal que passa pelo pique no tamanho base' },
              { valor: 'vertical', rotulo: 'Vertical: a linha vertical que passa pelo pique no tamanho base' },
              { valor: 'elemento', rotulo: 'Elemento: uma linha interna que cruza o contorno de todos os tamanhos' },
              { valor: 'ponto-horizontal', rotulo: 'Ponto horizontal: a linha horizontal de um ponto do contorno, em cada tamanho' },
              { valor: 'ponto-vertical', rotulo: 'Ponto vertical: a linha vertical de um ponto do contorno, em cada tamanho' },
            ],
            inicial: opcoes.alinhar.modo,
          },
        ],
        nota: 'Vale na peça graduada: em cada tamanho, o pique vai para onde a linha cruza o contorno desse tamanho — o cruzamento mais perto de onde ele estava. Depois de confirmar, clique no pique; no modo Elemento, clique em seguida na linha interna; nos modos de ponto, no ponto do contorno. O manual da referência dá os modos e os cliques, mas não a conta: essa é a nossa leitura. Nos modos de ponto ele só fala em indicar o ponto; aqui o pique é indicado antes. O pique interno também se alinha: em cada tamanho ele vai para o ponto da linha mais perto de onde estava (na horizontal e na vertical, só anda ao longo da linha que passa por ele no tamanho base), e deixa de acompanhar a peça na proporção — a janela do “Alterar” dele desfaz isso. O manual não separa os internos: também é leitura nossa.',
        rotuloDoBotao: 'Indicar no desenho',
      };
    case 'cadastrar-pique': {
      const o = opcoes.cadastrar;
      const haCadastrados = cadastrados.length > 0;
      return {
        titulo: 'Cadastrar pique',
        campos: [
          {
            tipo: 'escolha',
            id: 'acao',
            rotulo: 'O que fazer',
            opcoes: [
              { valor: 'criar', rotulo: 'Criar: um formato novo, pelas linhas que eu indicar no desenho' },
              ...(haCadastrados ? [{ valor: 'alterar', rotulo: 'Alterar: trocar o nome, a descrição ou a forma de um cadastrado' }, { valor: 'excluir', rotulo: 'Excluir um cadastrado' }] : []),
            ],
            inicial: haCadastrados ? o.acao : 'criar',
          },
          ...(haCadastrados
            ? [
                {
                  tipo: 'escolha' as const,
                  id: 'qual',
                  rotulo: 'Qual cadastrado (para alterar ou excluir)',
                  opcoes: cadastrados.map((c) => ({ valor: c.id, rotulo: `${c.nome}${c.descricao ? `: ${c.descricao}` : ''}` })),
                  inicial: cadastrados.some((c) => c.id === o.qual) ? o.qual : cadastrados[0]!.id,
                },
              ]
            : []),
          { tipo: 'texto', id: 'nome', rotulo: 'Pique: o nome do formato', inicial: o.nome, opcional: true },
          { tipo: 'texto', id: 'descricao', rotulo: 'Descrição (opcional)', inicial: o.descricao, opcional: true },
          ...(haCadastrados
            ? [
                { tipo: 'caixa' as const, id: 'redesenhar', rotulo: 'Ao alterar: redesenhar a forma — depois de confirmar, indique as linhas do desenho novo, como no Criar', inicial: o.redesenhar },
                { tipo: 'caixa' as const, id: 'atualizar', rotulo: 'Ao alterar: levar a mudança aos piques deste projeto já postos com o formato', inicial: o.atualizar },
              ]
            : []),
        ],
        nota: 'Para criar: desenhe o formato com linhas internas na peça selecionada, de pé na tela — a boca do pique embaixo, a ponta para cima. Depois de confirmar, clique em cada linha do desenho, aperte Enter e clique no ponto de referência: é o ponto do desenho que fica na borda da peça. O formato vai para a lista de tipos das outras janelas, neste computador; a largura e a altura são dadas em cada uso. Para trocar a forma de um cadastrado, escolha “Alterar” e marque “redesenhar”: o desenho novo é indicado do mesmo jeito. O pique já posto guarda a forma que tinha; com a outra caixa marcada, os deste projeto passam a ter a nova (os de outros projetos, não). Só os formatos cadastrados aqui podem ser alterados ou excluídos: os do programa são fixos. No manual da referência o nome é pedido no fim; aqui, antes.',
        rotuloDoBotao: 'Confirmar',
      };
    }
    case 'linhas-auxiliares':
      return {
        titulo: 'Linhas auxiliares',
        campos: [
          {
            tipo: 'escolha',
            id: 'acao',
            rotulo: 'Ação',
            opcoes: [
              { valor: 'adicionar', rotulo: 'Adicionar: o elemento passa a ser linha auxiliar — faz parte do molde' },
              { valor: 'remover', rotulo: 'Remover: a linha auxiliar volta a ser elemento — só de construção' },
            ],
            inicial: opcoes.linhas.acao,
          },
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'Modo',
            opcoes: [
              { valor: 'automatico', rotulo: 'Automático: cada clique numa linha já a converte' },
              { valor: 'manual', rotulo: 'Manual: clique nas linhas e confirme todas com Enter' },
            ],
            inicial: opcoes.linhas.manual ? 'manual' : 'automatico',
          },
        ],
        nota: 'A linha auxiliar faz parte do molde: sai no PDF com ele. O elemento é só de construção: continua na tela, clara e pontilhada, e serve às ferramentas que pedem um elemento (cortar, dobrar, alinhar, múltiplos piques), mas não sai no PDF. Aqui toda linha interna já nasce fazendo parte do molde — é o “Remover” que a deixa só de construção, e o “Adicionar” que a traz de volta. No programa de referência é o contrário: o elemento desenhado só passa a ser do molde com o “Adicionar”.',
        rotuloDoBotao: 'Indicar no desenho',
      };
    default:
      return null;
  }
}

/** As opções com o que a janela da ferramenta entregou. Lança erro quando um valor não serve. */
export function lerDialogoDaMarcacao(
  ferramenta: FerramentaDeMarcacao,
  opcoes: OpcoesDeMarcacao,
  valores: ValoresDoDialogo,
  cadastrados: readonly PiqueCadastrado[] = [],
): OpcoesDeMarcacao {
  switch (ferramenta) {
    case 'inserir-pique': {
      const distancia = valores.distancia === undefined ? null : Number(valores.distancia);
      if (distancia !== null && distancia < 0) throw new Error('A distância do ponto de referência precisa ser zero ou mais.');
      return {
        ...opcoes,
        inserir: {
          formato: formatoLido(valores, cadastrados, opcoes.inserir.formato),
          sobreOContorno: valores.sobreOContorno === true,
          distanciaMm: distancia,
          codigo: valores.codigo === true,
          pontoDeControle: valores.pontoDeControle === true,
          manterDistancia: valores.manterDistancia === true,
          naCostura: valores.naCostura === 'projetado' || valores.naCostura === 'estendido' ? valores.naCostura : 'nao',
          usarDxDy: valores.usarDxDy === true,
          dxMm: Number(valores.dx),
          dyMm: Number(valores.dy),
        },
      };
    }
    case 'remover-pique':
      return { ...opcoes, remover: { doContorno: valores.doContorno === true, internos: valores.internos === true } };
    case 'multiplos-piques': {
      const quantidade = Number(valores.quantidade);
      const espacoMm = Number(valores.espaco);
      const por = valores.por === 'perimetro' ? 'perimetro' : 'numero';
      if (por === 'numero' && (quantidade < 1 || quantidade > MAXIMO_DE_PIQUES_DE_UMA_VEZ)) throw new Error(`O número de piques precisa ficar entre 1 e ${MAXIMO_DE_PIQUES_DE_UMA_VEZ}.`);
      if (por === 'perimetro' && !(espacoMm > 0)) throw new Error('O espaço entre um pique e outro precisa ser maior que zero.');
      return {
        ...opcoes,
        multiplos: {
          modo: valores.modo === 'mouse' || valores.modo === 'elemento' ? valores.modo : 'contorno',
          por,
          quantidade,
          espacoMm,
          formato: formatoLido(valores, cadastrados, opcoes.multiplos.formato),
        },
      };
    }
    case 'substituir-piques': {
      const distanciaMm = Number(valores.distancia);
      const acao = valores.acao === 'marca' || valores.acao === 'remover' ? valores.acao : 'trocar';
      if (acao === 'marca' && !(distanciaMm > 0)) throw new Error('A distância do pique interno precisa ser maior que zero.');
      return {
        ...opcoes,
        substituir: {
          de: String(valores.de),
          onde: valores.onde === 'marcadas' || valores.onde === 'todas' ? valores.onde : 'selecionada',
          acao,
          formato: formatoLido(valores, cadastrados, opcoes.substituir.formato),
          distanciaMm,
          internos: valores.internos === true,
        },
      };
    }
    case 'pique-texto': {
      const texto = String(valores.texto ?? '').trim();
      if (texto === '') throw new Error('Escreva o texto.');
      const alturaMm = Number(valores.altura);
      if (!(alturaMm >= 1 && alturaMm <= 500)) throw new Error('A altura do texto precisa ficar entre 1 e 500 mm.');
      const anguloGraus = Number(valores.angulo);
      if (!Number.isFinite(anguloGraus) || Math.abs(anguloGraus) > 360) throw new Error('O ângulo do texto precisa ficar entre −360° e 360°.');
      return { ...opcoes, texto: { texto, alturaMm, anguloGraus, ancora: valores.referencia === 'inicio' || valores.referencia === 'fim' ? valores.referencia : 'centro' } };
    }
    case 'alinhar-piques': {
      const modos: readonly ModoDeAlinhar[] = ['horizontal', 'vertical', 'elemento', 'ponto-horizontal', 'ponto-vertical'];
      return { ...opcoes, alinhar: { modo: modos.find((m) => m === valores.modo) ?? 'vertical' } };
    }
    case 'cadastrar-pique': {
      const acao = valores.acao === 'alterar' || valores.acao === 'excluir' ? valores.acao : 'criar';
      const nome = valores.nome === undefined ? '' : String(valores.nome).trim();
      if (acao !== 'excluir' && nome === '') throw new Error('Dê um nome ao formato do pique.');
      if (acao !== 'criar' && !cadastrados.some((c) => c.id === valores.qual)) throw new Error('Escolha um dos formatos cadastrados.');
      if (acao !== 'excluir' && cadastrados.some((c) => c.nome.toLocaleUpperCase('pt-BR') === nome.toLocaleUpperCase('pt-BR') && (acao === 'criar' || c.id !== valores.qual))) {
        throw new Error(`Já há um formato cadastrado com o nome “${nome}”.`);
      }
      return {
        ...opcoes,
        cadastrar: {
          acao,
          qual: valores.qual === undefined ? '' : String(valores.qual),
          nome,
          descricao: valores.descricao === undefined ? '' : String(valores.descricao).trim(),
          // As duas caixas só valem no "Alterar".
          redesenhar: acao === 'alterar' && valores.redesenhar === true,
          atualizar: acao === 'alterar' && valores.atualizar === true,
        },
      };
    }
    case 'linhas-auxiliares':
      return { ...opcoes, linhas: { acao: valores.acao === 'adicionar' ? 'adicionar' : 'remover', manual: valores.modo === 'manual' } };
    default:
      return opcoes;
  }
}

// ---------------------------------------------------------------------------
// O que age pela janela: Remover todos e Substituir
// ---------------------------------------------------------------------------

/** O "Remover pique" age ao confirmar a janela: uma das caixas de "todos" está marcada. */
export function removerAgeNaHora(opcoes: OpcoesDeMarcacao): boolean {
  return opcoes.remover.doContorno || opcoes.remover.internos;
}

/** "Remover pique" com "todos": tira da peça os piques do contorno, os internos, ou uns e outros. */
export function aplicarRemoverTodos(opcoes: OpcoesDeMarcacao, pecas: readonly Molde[], peca: Molde): ResultadoDeFerramentaDeMolde {
  const { doContorno, internos } = opcoes.remover;
  const [doC, int] = [doContorno ? peca.piques.length : 0, internos ? peca.marcas.length : 0];
  if (doC + int === 0) throw new Error(`“${peca.nome}” não tem ${doContorno && internos ? 'piques' : doContorno ? 'piques no contorno' : 'piques internos'} para remover.`);
  const partes = [...(doContorno ? [plural(doC, 'pique do contorno', 'piques do contorno')] : []), ...(internos ? [plural(int, 'pique interno', 'piques internos')] : [])];
  return { pecas: trocar(pecas, peca.id, semOsPiques(peca, opcoes.remover)), recado: `Removidos de “${peca.nome}”: ${partes.join(' e ')}.` };
}

/**
 * O "Cadastrar pique" age ao confirmar a janela: excluir um cadastrado, ou
 * alterar só o nome e a descrição. ("Criar", e o alterar que redesenha a
 * forma, esperam os cliques no desenho.)
 */
export function cadastroAgeNaHora(opcoes: OpcoesDeMarcacao): boolean {
  const { acao, redesenhar } = opcoes.cadastrar;
  return acao === 'excluir' || (acao === 'alterar' && !redesenhar);
}

/** O cadastro com o formato dado: no lugar do que tem o mesmo id, ou no fim, se é novo. */
export function comOCadastrado(cadastrados: readonly PiqueCadastrado[], formato: PiqueCadastrado): PiqueCadastrado[] {
  return cadastrados.some((c) => c.id === formato.id) ? cadastrados.map((c) => (c.id === formato.id ? formato : c)) : [...cadastrados, formato];
}

/**
 * As peças com os piques — do contorno e internos — postos com o formato
 * cadastrado dado levados à forma e ao nome que ele tem agora, e quantos eram.
 * As medidas, o ângulo e o espelhamento de cada pique ficam como estão.
 */
function comOCadastradoNosPiques(pecas: readonly Molde[], cadastrado: PiqueCadastrado): { readonly pecas: Molde[]; readonly quantos: number } {
  const tipo = DO_CADASTRO + cadastrado.id;
  let quantos = 0;
  const levado = <T extends { readonly formato?: FormatoDePique }>(item: T): T => {
    if (item.formato?.tipo !== tipo) return item;
    quantos++;
    return { ...item, formato: { ...item.formato, forma: cadastrado.forma, nome: cadastrado.nome } };
  };
  const novas = pecas.map((peca) => {
    const piques = peca.piques.map(levado);
    const marcas = peca.marcas.map(levado);
    return piques.some((q, i) => q !== peca.piques[i]) || marcas.some((m, i) => m !== peca.marcas[i]) ? { ...peca, piques, marcas } : peca;
  });
  return { pecas: novas, quantos };
}

/** O que dizer dos piques do projeto depois de alterar um cadastrado: quantos foram levados à mudança, ou que ficaram como estavam. */
function ditoDosPiquesPostos(levados: number | null): string {
  if (levados === null) return 'Os piques já postos com ele continuam como estavam.';
  return levados === 0 ? 'Nenhum pique deste projeto estava posto com ele.' : `${plural(levados, 'pique deste projeto foi atualizado', 'piques deste projeto foram atualizados')}.`;
}

/**
 * "Cadastrar pique", alterar (o nome e a descrição) ou excluir: o cadastro
 * novo e o que dizer. Com "levar a mudança aos piques deste projeto", também
 * as peças, quando algum pique delas mudou.
 */
export function aplicarCadastro(
  opcoes: OpcoesDeMarcacao,
  cadastrados: readonly PiqueCadastrado[],
  pecas: readonly Molde[] = [],
): { readonly cadastrados: PiqueCadastrado[]; readonly recado: string; readonly pecas?: Molde[] } {
  const { acao, qual, nome, descricao, atualizar } = opcoes.cadastrar;
  const alvo = cadastrados.find((c) => c.id === qual);
  if (!alvo) throw new Error('Escolha um dos formatos cadastrados.');
  if (acao === 'excluir') {
    return {
      cadastrados: cadastrados.filter((c) => c.id !== qual),
      recado: `Formato de pique “${alvo.nome}” excluído do cadastro. Os piques já postos com ele continuam como estão.`,
    };
  }
  const novo: PiqueCadastrado = { ...alvo, nome, descricao };
  const levado = atualizar ? comOCadastradoNosPiques(pecas, novo) : null;
  return {
    cadastrados: comOCadastrado(cadastrados, novo),
    recado: `Formato de pique “${alvo.nome}” alterado: agora é “${nome}”${descricao ? ` (${descricao})` : ''}.` + (levado ? ` ${ditoDosPiquesPostos(levado.quantos)}` : ''),
    ...(levado && levado.quantos > 0 ? { pecas: levado.pecas } : {}),
  };
}

/** O ponto a `distanciaMm` do pique, para dentro da peça, em esquadro com a borda; `null` se esse ponto cai fora dela. */
function paraDentroDoPique(peca: Molde, pique: Pique, distanciaMm: number): Ponto2D | null {
  const n = peca.contorno.length;
  const a = peca.contorno[pique.indiceAresta % n]!;
  const b = peca.contorno[(pique.indiceAresta + 1) % n]!;
  const comprimento = distancia(a, b) || 1;
  const normal = ponto((b.y - a.y) / comprimento, (0 - (b.x - a.x)) / comprimento);
  for (const sinal of [1, -1]) {
    const candidato = ponto(pique.posicao.x + normal.x * distanciaMm * sinal, pique.posicao.y + normal.y * distanciaMm * sinal);
    if (pontoDentroDoContorno(candidato, peca.contorno)) return candidato;
  }
  return null;
}

/**
 * "Substituir piques": nos piques do contorno do tipo escolhido, das peças de
 * id dado, troca o formato, troca-os por piques internos a uma distância, ou
 * os remove. A mensagem diz quantos.
 */
export function aplicarSubstituir(opcoes: OpcoesDeMarcacao, pecas: readonly Molde[], alvos: readonly string[], novoId: () => string): ResultadoDeFerramentaDeMolde {
  const { de, acao, formato, distanciaMm } = opcoes.substituir;
  // Os internos entram na troca de formato e na remoção; "por marca" é só para os do contorno.
  const comInternos = opcoes.substituir.internos && acao !== 'marca';
  if (acao !== 'remover') conferirFormato(formato);
  if (alvos.length === 0) throw new Error('Não há peça em que substituir: selecione uma, ou marque as peças na lista.');
  let feitos = 0;
  let feitosInternos = 0;
  let semLugar = 0;
  const pecasComPique = new Set<string>();
  const novas = pecas.map((peca) => {
    if (!alvos.includes(peca.id)) return peca;
    const doTipo = (pique: { readonly formato?: FormatoDePique }): boolean => de === TODOS_OS_TIPOS || tipoDo(pique) === de;
    const escolhidos = peca.piques.filter(doTipo);
    // O pique interno é a marca com formato: o ponto sem formato não tem tipo que se troque.
    const interno = (marca: Marca): boolean => comInternos && marca.formato !== undefined && doTipo(marca);
    const internosEscolhidos = peca.marcas.filter(interno).length;
    if (escolhidos.length + internosEscolhidos === 0) return peca;
    if (acao === 'trocar') {
      feitos += escolhidos.length;
      feitosInternos += internosEscolhidos;
      pecasComPique.add(peca.id);
      return {
        ...peca,
        piques: peca.piques.map((pique) => (doTipo(pique) ? { ...pique, formato } : pique)),
        ...(internosEscolhidos > 0 ? { marcas: peca.marcas.map((marca) => (interno(marca) ? { ...marca, formato } : marca)) } : {}),
      };
    }
    if (acao === 'remover') {
      feitos += escolhidos.length;
      feitosInternos += internosEscolhidos;
      pecasComPique.add(peca.id);
      return {
        ...peca,
        piques: peca.piques.filter((pique) => !doTipo(pique)),
        ...(internosEscolhidos > 0 ? { marcas: peca.marcas.filter((marca) => !interno(marca)) } : {}),
      };
    }
    // Por marca: o pique do contorno sai, e entra um pique interno, para dentro da peça. O que não cabe dentro dela fica como está.
    const marcas: Marca[] = [];
    const saem = new Set<string>();
    for (const pique of escolhidos) {
      const dentro = paraDentroDoPique(peca, pique, distanciaMm);
      if (!dentro) {
        semLugar++;
        continue;
      }
      marcas.push({ id: novoId(), posicao: dentro, formato });
      saem.add(pique.id);
    }
    if (saem.size === 0) return peca;
    feitos += saem.size;
    pecasComPique.add(peca.id);
    return { ...peca, piques: peca.piques.filter((pique) => !saem.has(pique.id)), marcas: [...peca.marcas, ...marcas] };
  });
  const doTipoDito = de === TODOS_OS_TIPOS ? '' : ` do tipo ${nomeDoFormato({ ...PIQUE_PADRAO, tipo: de })}`;
  const total = feitos + feitosInternos;
  if (total === 0) {
    throw new Error(
      semLugar > 0
        ? `Nenhum pique substituído: a ${formatarMm(distanciaMm)} da borda, o pique interno cairia fora da peça.`
        : `Não há pique${doTipoDito} ${comInternos ? 'no contorno nem dentro' : 'no contorno'} ${alvos.length === 1 ? 'da peça escolhida' : 'das peças escolhidas'}.`,
    );
  }
  const ondeDito = pecasComPique.size === 1 ? 'em 1 peça' : `em ${pecasComPique.size} peças`;
  // Com internos na conta, a mensagem diz quantos são de cada.
  const deCada = feitosInternos > 0 ? ` (${feitos} do contorno e ${feitosInternos} ${feitosInternos === 1 ? 'interno' : 'internos'})` : '';
  const feito =
    acao === 'trocar'
      ? `${plural(total, 'pique substituído', 'piques substituídos')}${deCada}${doTipoDito} ${ondeDito}: agora ${total === 1 ? 'é' : 'são'} ${nomeDoFormato(formato)}, de ${formatarMm(formato.larguraMm)} × ${formatarMm(formato.alturaMm)}.`
      : acao === 'remover'
        ? `${plural(total, 'pique removido', 'piques removidos')}${deCada}${doTipoDito} ${ondeDito}.`
        : `${plural(feitos, 'pique do contorno substituído', 'piques do contorno substituídos')}${doTipoDito} por ${feitos === 1 ? 'pique interno' : 'piques internos'} a ${formatarMm(distanciaMm)} da borda, ${ondeDito}.`;
  return { pecas: novas, recado: feito + (semLugar > 0 ? ` ${plural(semLugar, 'ficou como estava', 'ficaram como estavam')}: o pique interno cairia fora da peça.` : '') };
}

// ---------------------------------------------------------------------------
// Alterar: a janela do pique clicado
// ---------------------------------------------------------------------------

/** A distância do ponto de número `referencia` até a posição, sobre o contorno: positiva no sentido da numeração, negativa contra ele (o caminho mais curto). */
function distanciaDaReferencia(peca: Molde, referencia: number, posicao: PosicaoNoContorno): number {
  const doPonto: PosicaoNoContorno = { indiceAresta: referencia, ponto: peca.contorno[referencia]! };
  if (distancia(doPonto.ponto, posicao.ponto) <= MESMO_PONTO_MM) return 0;
  const adiante = comprimentoDaLinha(trechoDoContorno(peca.contorno, doPonto, posicao));
  const paraTras = comprimentoDaLinha(trechoDoContorno(peca.contorno, posicao, doPonto));
  return adiante <= paraTras ? adiante : 0 - paraTras;
}

/** Onde o pique está, como posição no contorno. */
function noContornoDo(pique: Pique): PosicaoNoContorno {
  return { indiceAresta: pique.indiceAresta, ponto: pique.posicao };
}

/** O ponto do contorno mais perto do pique, andando sobre o contorno (o número dele, a partir de 0). */
function pontoMaisPertoNoContorno(peca: Molde, pique: Pique): number {
  let melhor = 0;
  let menor = Infinity;
  peca.contorno.forEach((_, i) => {
    const d = Math.abs(distanciaDaReferencia(peca, i, noContornoDo(pique)));
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  });
  return melhor;
}

/** O pique do contorno "mantém a distância": tem graduação com zero em todos os tamanhos. */
function mantemDistancia(pique: Pique): boolean {
  return pique.graduacao !== undefined && pique.graduacao.perimetros.every((valor) => valor === 0);
}

/** A janela do "Alterar" para o pique (do contorno ou interno) de id dado; `null` se ele não está mais na peça. */
export function dialogoDeAlterarPique(peca: Molde, id: string, interno: boolean, cadastrados: readonly PiqueCadastrado[] = []): DialogoDeMarcacao | null {
  const mover: CampoDoDialogo = { tipo: 'caixa', id: 'mover', rotulo: 'Indicar a posição com o mouse: depois de aplicar, o clique seguinte diz onde o pique fica', inicial: false };
  if (interno) {
    const marca = peca.marcas.find((m) => m.id === id);
    if (!marca) return null;
    return {
      titulo: 'Alterar pique interno',
      campos: [
        ...camposDoFormato(marca.formato ?? { ...PIQUE_PADRAO, tipo: 'cruz', alturaMm: PIQUE_PADRAO.larguraMm }, cadastrados),
        mover,
        // Só no pique que o "Alinhar" alinhou: desmarcada, a caixa desfaz o alinhamento.
        ...(marca.alinhamento
          ? [{ tipo: 'caixa' as const, id: 'alinhado', rotulo: 'Alinhado entre os tamanhos (desmarque para ele voltar a acompanhar a peça na proporção)', inicial: true }]
          : []),
      ],
      nota: marca.formato
        ? 'O pique interno é refeito com o formato novo, centrado no mesmo ponto.'
        : 'Esta marca ainda é só um ponto. Aplicando, ela passa a ser um pique interno com o formato escolhido, centrado no mesmo lugar.',
      rotuloDoBotao: 'Aplicar',
    };
  }
  const pique = peca.piques.find((q) => q.id === id);
  if (!pique) return null;
  const referencia = pontoMaisPertoNoContorno(peca, pique);
  return {
    titulo: 'Alterar pique',
    campos: [
      ...camposDoFormato(pique.formato ?? PIQUE_PADRAO, cadastrados),
      { tipo: 'inteiro', id: 'ponto', rotulo: `Ponto: o número do ponto de referência no contorno (1 a ${peca.contorno.length})`, inicial: String(referencia + 1) },
      {
        tipo: 'medida',
        id: 'perimetro',
        rotulo: 'Perímetro: distância desse ponto ao pique, sobre o contorno (mm; negativa = contra a numeração)',
        inicial: paraCampo(distanciaDaReferencia(peca, referencia, noContornoDo(pique))),
      },
      { tipo: 'texto', id: 'codigo', rotulo: 'Código (em branco = sem código)', inicial: pique.codigo ?? '', opcional: true },
      {
        tipo: 'escolha',
        id: 'naCostura',
        rotulo: 'Pique na costura',
        opcoes: [
          { valor: 'nao', rotulo: 'Não vai: fica só no contorno' },
          { valor: 'projetado', rotulo: 'Projetado' },
          { valor: 'estendido', rotulo: 'Estendido' },
        ],
        inicial: pique.naCostura ?? 'nao',
      },
      ...(peca.graduacao ? [{ tipo: 'caixa', id: 'manterDistancia', rotulo: 'Manter distância: a mesma distância do ponto de referência em todos os tamanhos', inicial: mantemDistancia(pique) } as const] : []),
      mover,
    ],
    nota: pique.formato
      ? 'O pique é refeito com o formato e no lugar pedidos. O lugar é dado pelo ponto de referência e pela distância dele, sobre o contorno.'
      : 'Este pique é dos de antes da aba Marcações: um traço para o lado em que o contorno foi desenhado. Aplicando, ele passa a ter formato — e a ser desenhado para dentro da peça.',
    rotuloDoBotao: 'Aplicar',
  };
}

/** A janela do "Alterar" para um texto da peça (o "Pique texto"); `null` se ele não está mais na peça. */
export function dialogoDeAlterarTexto(peca: Molde, id: string): DialogoDeMarcacao | null {
  const texto = (peca.textos ?? []).find((t) => t.id === id);
  if (!texto) return null;
  return {
    titulo: 'Alterar pique texto',
    campos: [
      { tipo: 'texto', id: 'texto', rotulo: 'Texto (em branco, apaga)', inicial: texto.texto, opcional: true },
      { tipo: 'medida', id: 'altura', rotulo: 'Altura das letras (mm)', inicial: paraCampo(texto.alturaMm) },
      { tipo: 'medida', id: 'angulo', rotulo: 'Ângulo (graus; 0 = na horizontal da tela, positivo no sentido anti-horário)', inicial: paraCampo(texto.anguloGraus ?? 0) },
      {
        tipo: 'escolha',
        id: 'referencia',
        rotulo: 'Referência: o que fica no ponto do texto',
        opcoes: [
          { valor: 'centro', rotulo: 'O meio do texto' },
          { valor: 'inicio', rotulo: 'O começo do texto' },
          { valor: 'fim', rotulo: 'O fim do texto' },
        ],
        inicial: texto.ancora ?? 'centro',
      },
    ],
    nota: 'O texto é refeito no mesmo ponto, com o que foi mudado. Deixando o texto em branco, ele é apagado.',
    rotuloDoBotao: 'Aplicar',
  };
}

/** Aplica a janela do "Alterar" no texto de id dado. Lança erro quando os valores não servem. */
export function aplicarAlteracaoDoTexto(pecas: readonly Molde[], peca: Molde, id: string, valores: ValoresDoDialogo): ResultadoDeFerramentaDeMolde {
  const escrito = valores.texto === undefined ? '' : String(valores.texto);
  const pose: PoseDoTexto = { anguloGraus: Number(valores.angulo), ancora: valores.referencia === 'inicio' || valores.referencia === 'fim' ? valores.referencia : 'centro' };
  const nova = alterarTexto(peca, id, escrito, Number(valores.altura), pose);
  return {
    pecas: trocar(pecas, peca.id, nova),
    recado: escrito.trim() === '' ? `Texto apagado de “${peca.nome}”.` : `Texto de “${peca.nome}” alterado: “${escrito.trim()}”, com ${formatarMm(Number(valores.altura))} de altura${pose.anguloGraus === 0 ? '' : `, a ${paraCampo(pose.anguloGraus)}°`}.`,
  };
}

/** O que o "Alterar" devolve: as peças e a mensagem — e, se a posição é para indicar com o mouse, que o clique seguinte é o dela. */
export interface AlteracaoDoPique extends ResultadoDeFerramentaDeMolde {
  readonly mover: boolean;
}

/** Aplica a janela do "Alterar" no pique de id dado. Lança erro quando os valores não servem. */
export function aplicarAlteracaoDoPique(
  pecas: readonly Molde[],
  peca: Molde,
  id: string,
  interno: boolean,
  valores: ValoresDoDialogo,
  cadastrados: readonly PiqueCadastrado[] = [],
): AlteracaoDoPique {
  const mover = valores.mover === true;
  if (interno) {
    const marca = peca.marcas.find((m) => m.id === id);
    if (!marca) throw new Error('Esse pique interno já não está na peça.');
    const formato = formatoLido(valores, cadastrados, marca.formato ?? PIQUE_PADRAO);
    // A caixa "alinhado" desmarcada desfaz o alinhamento entre os tamanhos: o pique volta a acompanhar a peça na proporção.
    const solto = marca.alinhamento !== undefined && valores.alinhado === false;
    const alterada = (m: Marca): Marca => {
      if (!solto) return { ...m, formato };
      const copia: { -readonly [K in keyof Marca]: Marca[K] } = { ...m, formato };
      delete copia.alinhamento;
      return copia;
    };
    const nova = { ...peca, marcas: peca.marcas.map((m) => (m.id === id ? alterada(m) : m)) };
    return {
      pecas: trocar(pecas, peca.id, nova),
      recado: `Pique interno de “${peca.nome}” alterado: ${nomeDoFormato(formato)}, de ${formatarMm(formato.larguraMm)} × ${formatarMm(formato.alturaMm)}.` + (solto ? ' Voltou a acompanhar a peça na proporção, de tamanho em tamanho.' : ''),
      mover,
    };
  }
  const pique = peca.piques.find((q) => q.id === id);
  if (!pique) throw new Error('Esse pique já não está na peça.');
  const formato = formatoLido(valores, cadastrados, pique.formato ?? PIQUE_PADRAO);
  const referencia = Number(valores.ponto) - 1;
  if (!Number.isInteger(referencia) || referencia < 0 || referencia >= peca.contorno.length) throw new Error(`O ponto de referência precisa ser um número de 1 a ${peca.contorno.length}.`);
  // A janela mostra o perímetro arredondado: sem mexer no ponto nem no perímetro, o pique fica exatamente onde estava.
  const referenciaDeAntes = pontoMaisPertoNoContorno(peca, pique);
  const noMesmoLugar = referencia === referenciaDeAntes && paraCampo(Number(valores.perimetro)) === paraCampo(distanciaDaReferencia(peca, referenciaDeAntes, noContornoDo(pique)));
  const onde = noMesmoLugar
    ? noContornoDo(pique)
    : andarNoContorno(peca.contorno, { indiceAresta: referencia, ponto: peca.contorno[referencia]! }, Number(valores.perimetro));
  const codigo = valores.codigo === undefined ? '' : String(valores.codigo).trim();
  const naCostura = valores.naCostura === 'projetado' || valores.naCostura === 'estendido' ? valores.naCostura : null;
  const semOsCamposOpcionais: { -readonly [K in keyof Pique]: Pique[K] } = { ...pique, posicao: onde.ponto, indiceAresta: onde.indiceAresta, formato };
  delete semOsCamposOpcionais.codigo;
  delete semOsCamposOpcionais.naCostura;
  const alterado: Pique = { ...semOsCamposOpcionais, ...(codigo !== '' ? { codigo } : {}), ...(naCostura ? { naCostura } : {}) };
  let nova: Molde = { ...peca, piques: peca.piques.map((q) => (q.id === id ? alterado : q)) };
  if (peca.graduacao && valores.manterDistancia !== undefined) {
    if (valores.manterDistancia === true) nova = definirGraduacaoDoPique(nova, id, referenciaSugerida(nova, alterado), peca.graduacao.tamanhos.map(() => 0));
    else if (mantemDistancia(pique)) nova = removerGraduacaoDoPique(nova, id);
  }
  const mudouDeLugar = distancia(onde.ponto, pique.posicao) > MESMO_PONTO_MM;
  return {
    pecas: trocar(pecas, peca.id, nova),
    recado: `Pique de “${peca.nome}” alterado: ${nomeDoFormato(formato)}, de ${formatarMm(formato.larguraMm)} × ${formatarMm(formato.alturaMm)}${mudouDeLugar ? `, agora a ${formatarMm(Math.abs(Number(valores.perimetro)))} do ponto ${referencia + 1}` : ''}.`,
    mover,
  };
}

// ---------------------------------------------------------------------------
// Os cliques
// ---------------------------------------------------------------------------

export interface CliqueDeMarcacao {
  readonly estado: TrechoEmEdicao;
  readonly pecas?: readonly Molde[];
  readonly recado: string | null;
  /** O clique pede a janela do "Alterar" para este pique — ou, com `texto`, para este texto. */
  readonly abrir?: { readonly id: string; readonly interno: boolean; readonly texto?: true };
  /** O clique terminou um formato novo ("Cadastrar pique"): vai para o cadastro deste computador. */
  readonly cadastrar?: PiqueCadastrado;
}

export interface ContextoDaMarcacao {
  /** O raio (mm) em que um clique pega um pique. */
  readonly raioMm: number;
  readonly novoId: () => string;
  /** A linha interna sob o clique (pelo número), se há. */
  readonly linhaInterna: number | null;
}

/** O ponto que guarda, no estado da ferramenta, uma linha interna indicada: o meio do primeiro trecho dela. */
function marcaDaLinha(linha: readonly Ponto2D[]): Ponto2D {
  return ponto((linha[0]!.x + linha[1]!.x) / 2, (linha[0]!.y + linha[1]!.y) / 2);
}

/** As linhas internas (pelo número) que as marcas dadas indicam. */
function linhasDasMarcas(peca: Molde, marcas: readonly Ponto2D[]): number[] {
  return marcas.map((marca) => peca.linhasInternas.findIndex((linha) => linha.length >= 2 && distancia(marcaDaLinha(linha), marca) <= MESMO_PONTO_MM)).filter((i) => i >= 0);
}

/**
 * O Enter do "Cadastrar pique": confirma as linhas indicadas como o desenho do
 * formato; o clique seguinte é o do ponto de referência. `null` se não há
 * linha indicada.
 */
export function confirmarLinhasDoCadastro(peca: Molde, estado: TrechoEmEdicao): { readonly estado: TrechoEmEdicao; readonly recado: string | null } | null {
  if (linhasDasMarcas(peca, estado.livres).length === 0) return null;
  return { estado: { ...SEM_TRECHO, grupos: [estado.livres] }, recado: null };
}

/**
 * "Linhas auxiliares": converte as linhas internas de número dado — as que
 * ainda não estão no estado pedido. Lança erro, sem mudar nada, se nenhuma
 * delas tem o que converter.
 */
export function aplicarLinhasAuxiliares(opcoes: OpcoesDeMarcacao, pecas: readonly Molde[], peca: Molde, indices: readonly number[]): ResultadoDeFerramentaDeMolde {
  const adicionar = opcoes.linhas.acao === 'adicionar';
  // Adicionar vale para os elementos; remover, para as linhas que fazem parte do molde.
  const alvos = indices.filter((i) => ehElemento(peca, i) === adicionar);
  if (alvos.length === 0) {
    const uma = indices.length === 1;
    throw new Error(
      adicionar
        ? `${uma ? 'Essa linha já faz' : 'Essas linhas já fazem'} parte do molde: ${uma ? 'é uma linha auxiliar' : 'são linhas auxiliares'}.`
        : `${uma ? 'Essa linha já é só um elemento' : 'Essas linhas já são só elementos'} de construção.`,
    );
  }
  const nova = adicionar ? tornarAuxiliares(peca, alvos) : tornarElementos(peca, alvos);
  const n = alvos.length;
  return {
    pecas: trocar(pecas, peca.id, nova),
    recado: adicionar
      ? `${plural(n, 'elemento', 'elementos')} de “${peca.nome}” ${n === 1 ? 'passou a ser linha auxiliar: agora faz' : 'passaram a ser linhas auxiliares: agora fazem'} parte do molde e ${n === 1 ? 'sai' : 'saem'} no PDF.`
      : `${plural(n, 'linha auxiliar', 'linhas auxiliares')} de “${peca.nome}” ${n === 1 ? 'voltou a ser elemento: continua' : 'voltaram a ser elementos: continuam'} na tela, só de construção, e não ${n === 1 ? 'sai' : 'saem'} no PDF.`,
  };
}

/** O Enter das "Linhas auxiliares" no modo manual: converte as linhas indicadas. `null` se não há nenhuma. */
export function confirmarLinhasAuxiliares(opcoes: OpcoesDeMarcacao, pecas: readonly Molde[], peca: Molde, estado: TrechoEmEdicao): CliqueDeMarcacao | null {
  const indices = linhasDasMarcas(peca, estado.livres);
  if (indices.length === 0) return null;
  try {
    const feito = aplicarLinhasAuxiliares(opcoes, pecas, peca, indices);
    return { estado: SEM_TRECHO, pecas: feito.pecas, recado: feito.recado };
  } catch (e) {
    // As linhas continuam indicadas: dá para tirar as que não servem.
    return { estado, recado: e instanceof Error ? e.message : String(e) };
  }
}

/** Por onde o texto do "Pique texto" se estende, mais ou menos: do começo ao fim dele, em mm, para a prévia. */
function extensaoDoTexto(posicao: Ponto2D, o: OpcoesDeMarcacao['texto']): Ponto2D[] {
  // Cada letra ocupa, em média, pouco mais de metade da altura.
  const comprimento = Math.max(1, o.texto.length) * o.alturaMm * 0.55;
  const rad = (o.anguloGraus * Math.PI) / 180;
  // Na tela, a direção do texto a `anguloGraus`: para a direita é o y do mundo; para cima, o −x.
  const direcao = ponto(0 - Math.sin(rad), Math.cos(rad));
  const antes = o.ancora === 'inicio' ? 0 : o.ancora === 'fim' ? comprimento : comprimento / 2;
  return [ponto(posicao.x - direcao.x * antes, posicao.y - direcao.y * antes), ponto(posicao.x + direcao.x * (comprimento - antes), posicao.y + direcao.y * (comprimento - antes))];
}

/** O ponto do contorno (pelo número) sob o clique, a até `raioMm`; `null` se o clique não está num ponto. */
function pontoDoContornoSob(peca: Molde, clique: CliqueDeTrecho, raioMm: number): number | null {
  const onde = clique.noContorno?.ponto ?? clique.livre;
  let melhor: { readonly i: number; readonly d: number } | null = null;
  peca.contorno.forEach((v, i) => {
    const d = distancia(v, onde);
    if (d <= raioMm && (!melhor || d < melhor.d)) melhor = { i, d };
  });
  return melhor ? (melhor as { readonly i: number }).i : null;
}

/** O que a mensagem do "Alinhar" diz: quanto o pique anda, sobre o contorno, em cada tamanho que não é o base. */
function ditoDoAlinhamento(peca: Molde, perimetros: readonly number[]): string {
  const graduacao = peca.graduacao!;
  const partes = graduacao.tamanhos.map((nome, t) => (t === graduacao.base ? null : `${nome} ${paraCampo(perimetros[t] ?? 0)} mm`)).filter((parte): parte is string => parte !== null);
  return `Em relação ao tamanho ${graduacao.tamanhos[graduacao.base]}, a distância dele ao ponto de referência muda: ${partes.join('; ')}.`;
}

/** O que dizer do pique interno alinhado: quanto ele fica, em cada tamanho, de onde está no base. */
function ditoDoAlinhamentoInterno(peca: Molde, deslocamentos: readonly Ponto2D[]): string {
  const graduacao = peca.graduacao!;
  if (deslocamentos.every((d) => Math.hypot(d.x, d.y) < MESMO_PONTO_MM)) return 'Fica no mesmo lugar em todos os tamanhos.';
  const partes = graduacao.tamanhos
    .map((nome, t) => (t === graduacao.base ? null : `${nome} a ${paraCampo(Math.hypot(deslocamentos[t]?.x ?? 0, deslocamentos[t]?.y ?? 0))} mm`))
    .filter((parte): parte is string => parte !== null);
  return `Contado de onde fica no tamanho ${graduacao.tamanhos[graduacao.base]}: ${partes.join('; ')}.`;
}

/** O pique sob o clique, para o "Alinhar": o do contorno ou o interno — o que estiver mais perto. */
function piqueOuInternoPerto(peca: Molde, p: Ponto2D, raioMm: number): { readonly id: string; readonly posicao: Ponto2D } | null {
  const doContorno = piquePerto(peca, p, raioMm);
  const interno = marcaPerto(peca, p, raioMm);
  if (doContorno && interno) return distancia(doContorno.posicao, p) <= distancia(interno.posicao, p) ? doContorno : interno;
  return doContorno ?? interno;
}

/** O ponto a `s` mm do começo da linha, andando sobre ela. */
function pontoNaLinha(linha: readonly Ponto2D[], s: number): Ponto2D {
  let resto = s;
  for (let i = 1; i < linha.length; i++) {
    const [a, b] = [linha[i - 1]!, linha[i]!];
    const trecho = distancia(a, b);
    if (resto <= trecho || i === linha.length - 1) {
      const f = trecho === 0 ? 0 : Math.min(1, Math.max(0, resto / trecho));
      return ponto(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    }
    resto -= trecho;
  }
  return linha[0]!;
}

/**
 * Onde os piques do "Múltiplos" ficam ao longo de uma linha: pelo número, essa
 * quantidade com espaços iguais do começo ao fim (um só fica no começo); pelo
 * perímetro, um a cada tantos mm a partir do começo.
 */
export function posicoesAoLongo(linha: readonly Ponto2D[], opcoes: OpcoesDeMarcacao['multiplos']): Ponto2D[] {
  const comprimento = comprimentoDaLinha(linha);
  if (!(comprimento > MESMO_PONTO_MM)) throw new Error('Os dois pontos precisam ser diferentes.');
  if (opcoes.por === 'numero') {
    const n = opcoes.quantidade;
    return Array.from({ length: n }, (_, k) => pontoNaLinha(linha, n === 1 ? 0 : (comprimento * k) / (n - 1)));
  }
  const quantos = Math.floor(comprimento / opcoes.espacoMm + 1e-9) + 1;
  if (quantos > MAXIMO_DE_PIQUES_DE_UMA_VEZ) throw new Error(`Com esse espaço seriam ${quantos} piques: o máximo de uma vez é ${MAXIMO_DE_PIQUES_DE_UMA_VEZ}.`);
  return Array.from({ length: quantos }, (_, k) => pontoNaLinha(linha, opcoes.espacoMm * k));
}

/** O caminho sobre o contorno de `de` a `ate`, no sentido horário de quem olha a tela. */
export function caminhoHorario(peca: Molde, de: PosicaoNoContorno, ate: PosicaoNoContorno): Ponto2D[] {
  // A tela é o mundo girado, sem espelhar: o contorno de área positiva anda no sentido anti-horário também na tela.
  return areaAssinada(peca.contorno) < 0 ? trechoDoContorno(peca.contorno, de, ate) : [...trechoDoContorno(peca.contorno, ate, de)].reverse();
}

/** Põe na peça um pique do contorno em cada posição (ou um interno, com `interno`). */
function comVariosPiques(peca: Molde, posicoes: readonly Ponto2D[], formato: FormatoDePique, interno: boolean, novoId: () => string): Molde {
  return posicoes.reduce<Molde>((m, posicao) => {
    if (interno) return inserirPiqueInterno(m, posicao, formato, novoId());
    const noContorno = pontoMaisProximoNoContorno(posicao, m.contorno);
    return inserirPique(m, { indiceAresta: noContorno.indiceAresta, ponto: noContorno.ponto }, formato, novoId());
  }, peca);
}

/** O que um clique faz com a ferramenta ligada, na peça selecionada. */
export function cliqueDeMarcacao(
  modo: ModoDeMarcacao,
  opcoes: OpcoesDeMarcacao,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  clique: CliqueDeTrecho,
  contexto: ContextoDaMarcacao,
): CliqueDeMarcacao {
  const com = (nova: Molde, recado: string, proximo: TrechoEmEdicao = SEM_TRECHO): CliqueDeMarcacao => ({ estado: proximo, pecas: trocar(pecas, peca.id, nova), recado });
  try {
    switch (modo) {
      case 'inserir-pique': {
        const o = opcoes.inserir;
        const medidas = `${nomeDoFormato(o.formato)}, de ${formatarMm(o.formato.larguraMm)} × ${formatarMm(o.formato.alturaMm)}`;
        if (!o.sobreOContorno) {
          const base = o.usarDxDy && clique.noContorno ? clique.noContorno.ponto : clique.livre;
          // Na tela, o Dx é a horizontal (o y do mundo) e o Dy, a vertical para baixo (o x do mundo).
          const onde = o.usarDxDy ? ponto(base.x + o.dyMm, base.y + o.dxMm) : base;
          return com(inserirPiqueInterno(peca, onde, o.formato, contexto.novoId()), `Pique interno (${medidas}) posto em “${peca.nome}”.`);
        }
        if (!clique.noContorno) return { estado, recado: 'Clique na borda da peça selecionada: é nela que o pique fica.' };
        const posicao = o.distanciaMm === null ? clique.noContorno : posicaoPelaReferencia(peca.contorno, clique.noContorno, o.distanciaMm, clique.livre);
        const codigo = o.codigo ? proximoCodigo(pecas) : null;
        const nova = inserirPique(peca, posicao, o.formato, contexto.novoId(), {
          ...(codigo ? { codigo } : {}),
          ...(o.naCostura !== 'nao' ? { naCostura: o.naCostura } : {}),
          pontoDeControle: o.pontoDeControle,
          manterDistancia: o.manterDistancia,
        });
        const avisos =
          (o.manterDistancia && !peca.graduacao ? ' “Manter distância nos tamanhos” só vale na peça graduada.' : '') +
          (o.naCostura !== 'nao' && !(peca.margemDeCosturaMm > 0) ? ' “Pique na costura” só aparece na peça com margem de costura.' : '');
        return com(nova, `Pique (${medidas}) posto na borda de “${peca.nome}”${codigo ? `, com o código ${codigo}` : ''}${o.pontoDeControle ? ', com um ponto no contorno' : ''}.` + avisos);
      }
      case 'remover-pique': {
        const pique = piquePerto(peca, clique.livre, contexto.raioMm);
        if (pique) return com({ ...peca, piques: peca.piques.filter((q) => q.id !== pique.id) }, `Pique removido de “${peca.nome}”.`);
        const marca = marcaPerto(peca, clique.livre, contexto.raioMm);
        if (marca) return com({ ...peca, marcas: peca.marcas.filter((m) => m.id !== marca.id) }, `Pique interno removido de “${peca.nome}”.`);
        return { estado, recado: 'Clique em cima de um pique da peça selecionada — do contorno ou interno.' };
      }
      case 'alterar-pique': {
        // Com um pique à espera da posição, o clique diz onde ele fica.
        if (estado.alvo !== undefined) {
          const daMarca = peca.marcas.find((m) => m.id === estado.alvo);
          if (daMarca) {
            if (!pontoDentroDoContorno(clique.livre, peca.contorno)) return { estado, recado: 'O pique interno precisa ficar dentro da peça: clique dentro dela.' };
            return com({ ...peca, marcas: peca.marcas.map((m) => (m.id === daMarca.id ? { ...m, posicao: clique.livre } : m)) }, `Pique interno de “${peca.nome}” levado para o ponto clicado.`);
          }
          const doPique = peca.piques.find((q) => q.id === estado.alvo);
          if (!doPique) return { estado: SEM_TRECHO, recado: 'Esse pique já não está na peça.' };
          if (!clique.noContorno) return { estado, recado: 'Clique na borda da peça: é nela que o pique fica.' };
          const { ponto: p, indiceAresta } = clique.noContorno;
          return com({ ...peca, piques: peca.piques.map((q) => (q.id === doPique.id ? { ...q, posicao: p, indiceAresta } : q)) }, `Pique de “${peca.nome}” levado para o ponto clicado.`);
        }
        const pique = piquePerto(peca, clique.livre, contexto.raioMm);
        if (pique) return { estado, recado: null, abrir: { id: pique.id, interno: false } };
        const marca = marcaPerto(peca, clique.livre, contexto.raioMm);
        if (marca) return { estado, recado: null, abrir: { id: marca.id, interno: true } };
        const texto = textoPerto(peca, clique.livre, contexto.raioMm);
        if (texto) return { estado, recado: null, abrir: { id: texto.id, interno: false, texto: true } };
        return { estado, recado: 'Clique em cima de um pique da peça selecionada — do contorno, interno ou de texto — para mudar o formato e o lugar dele.' };
      }
      case 'multiplos-piques': {
        const o = opcoes.multiplos;
        const feito = (nova: Molde, quantos: number, onde: string): CliqueDeMarcacao =>
          com(nova, `${plural(quantos, 'pique posto', 'piques postos')} em “${peca.nome}”, ${onde}: ${nomeDoFormato(o.formato)}, de ${formatarMm(o.formato.larguraMm)} × ${formatarMm(o.formato.alturaMm)}.`);
        if (o.modo === 'elemento') {
          const linha = contexto.linhaInterna === null ? undefined : peca.linhasInternas[contexto.linhaInterna];
          if (!linha || linha.length < 2) return { estado, recado: 'Clique em cima de uma linha interna da peça selecionada: os piques ficam ao longo dela.' };
          // A linha pode sair da peça: só entram os piques que caem dentro dela, e a mensagem diz quantos ficaram de fora.
          const todas = posicoesAoLongo(linha, o);
          const posicoes = todas.filter((q) => pontoDentroDoContorno(q, peca.contorno));
          if (posicoes.length === 0) throw new Error('Nenhum ponto dessa linha fica dentro da peça.');
          const deFora = todas.length - posicoes.length;
          const posto = feito(comVariosPiques(peca, posicoes, o.formato, true, contexto.novoId), posicoes.length, 'ao longo da linha interna');
          return deFora === 0 ? posto : { ...posto, recado: `${posto.recado} ${plural(deFora, 'ponto da linha cai', 'pontos da linha caem')} fora da peça e não ${deFora === 1 ? 'recebeu' : 'receberam'} pique.` };
        }
        if (o.modo === 'mouse') {
          const primeiro = estado.livres[0];
          if (!primeiro) return { estado: { ...SEM_TRECHO, livres: [clique.livre] }, recado: null };
          const posicoes = posicoesAoLongo([primeiro, clique.livre], o);
          return feito(comVariosPiques(peca, posicoes, o.formato, true, contexto.novoId), posicoes.length, 'na reta entre os dois pontos');
        }
        if (!clique.noContorno) return { estado, recado: 'Clique na borda da peça selecionada.' };
        if (!estado.inicio) return { estado: { ...SEM_TRECHO, inicio: clique.noContorno }, recado: null };
        const posicoes = posicoesAoLongo(caminhoHorario(peca, estado.inicio, clique.noContorno), o);
        return feito(comVariosPiques(peca, posicoes, o.formato, false, contexto.novoId), posicoes.length, 'na borda, no sentido horário');
      }
      case 'pique-texto': {
        const o = opcoes.texto;
        if (!pontoDentroDoContorno(clique.livre, peca.contorno)) return { estado, recado: 'Clique dentro da peça selecionada: o texto fica dentro dela.' };
        const nova = adicionarTexto(peca, clique.livre, o.texto, o.alturaMm, contexto.novoId(), { anguloGraus: o.anguloGraus, ancora: o.ancora });
        return com(nova, `Texto “${o.texto}” posto em “${peca.nome}”, com ${formatarMm(o.alturaMm)} de altura${o.anguloGraus === 0 ? '' : `, a ${paraCampo(o.anguloGraus)}°`}.`);
      }
      case 'alinhar-piques': {
        const modo = opcoes.alinhar.modo;
        const NOME: Record<ModoDeAlinhar, string> = { horizontal: 'na horizontal', vertical: 'na vertical', elemento: 'pelo elemento', 'ponto-horizontal': 'pela horizontal do ponto', 'ponto-vertical': 'pela vertical do ponto' };
        const ehDoContorno = (id: string): boolean => peca.piques.some((q) => q.id === id);
        const alinhado = (id: string, alvo: { readonly linhaInterna?: number; readonly ponto?: number } = {}): CliqueDeMarcacao => {
          const doPonto = alvo.ponto === undefined ? '' : ` ${alvo.ponto + 1}`;
          if (!ehDoContorno(id)) {
            const feito = alinharPiqueInterno(peca, id, modo, alvo);
            return com(feito.molde, `Pique interno de “${peca.nome}” alinhado ${NOME[modo]}${doPonto}. ${ditoDoAlinhamentoInterno(peca, feito.deslocamentos)}`);
          }
          const feito = alinharPique(peca, id, modo, alvo);
          return com(feito.molde, `Pique de “${peca.nome}” alinhado ${NOME[modo]}${doPonto}. ${ditoDoAlinhamento(peca, feito.perimetros)}`);
        };
        if (estado.alvo === undefined) {
          if (!peca.graduacao) return { estado, recado: 'Esta peça não tem tamanhos: o alinhamento é entre os tamanhos da graduação.' };
          const pique = piqueOuInternoPerto(peca, clique.livre, contexto.raioMm);
          if (!pique) return { estado, recado: 'Clique em cima de um pique da peça selecionada: do contorno ou interno.' };
          if (modo === 'horizontal' || modo === 'vertical') return alinhado(pique.id);
          return { estado: { ...SEM_TRECHO, alvo: pique.id }, recado: null };
        }
        if (modo === 'elemento') {
          if (contexto.linhaInterna === null) {
            return { estado, recado: ehDoContorno(estado.alvo) ? 'Clique em cima da linha interna que cruza o contorno de todos os tamanhos.' : 'Clique em cima da linha interna para onde o pique interno deve ir.' };
          }
          return alinhado(estado.alvo, { linhaInterna: contexto.linhaInterna });
        }
        const doContorno = pontoDoContornoSob(peca, clique, contexto.raioMm);
        if (doContorno === null) return { estado, recado: 'Clique em cima de um ponto do contorno: é ele que dá a linha de cada tamanho.' };
        return alinhado(estado.alvo, { ponto: doContorno });
      }
      case 'cadastrar-pique': {
        const confirmadas = linhasDasMarcas(peca, estado.grupos?.[0] ?? []);
        if (confirmadas.length > 0) {
          // O desenho está confirmado: o clique é o do ponto de referência — preso à ponta de linha mais perto, se há uma no raio.
          const linhas = confirmadas.map((i) => peca.linhasInternas[i]!);
          const pontas = linhas.flat().filter((q) => distancia(q, clique.livre) <= contexto.raioMm);
          const referencia = pontas.length > 0 ? pontas.reduce((a, b) => (distancia(a, clique.livre) <= distancia(b, clique.livre) ? a : b)) : clique.livre;
          const { acao, qual, nome, descricao, atualizar } = opcoes.cadastrar;
          const forma = formaDosElementos(linhas, referencia);
          if (acao === 'alterar') {
            // Redesenhar: o cadastrado continua o mesmo (o id dele), com a forma nova.
            const cadastrar: PiqueCadastrado = { id: qual, nome, descricao, forma };
            const levado = atualizar ? comOCadastradoNosPiques(pecas, cadastrar) : null;
            return {
              estado: SEM_TRECHO,
              recado: `Formato de pique “${nome}” redesenhado. ${ditoDosPiquesPostos(levado ? levado.quantos : null)}`,
              cadastrar,
              ...(levado && levado.quantos > 0 ? { pecas: levado.pecas } : {}),
            };
          }
          const cadastrar: PiqueCadastrado = { id: contexto.novoId(), nome, descricao, forma };
          return { estado: SEM_TRECHO, recado: `Formato de pique “${nome}” cadastrado: está na lista de tipos das janelas de pique.`, cadastrar };
        }
        const linha = contexto.linhaInterna === null ? undefined : peca.linhasInternas[contexto.linhaInterna];
        if (!linha || linha.length < 2) return { estado, recado: 'Clique em cima das linhas internas que desenham o pique; depois, Enter.' };
        const marca = marcaDaLinha(linha);
        const jaIndicada = estado.livres.some((q) => distancia(q, marca) <= MESMO_PONTO_MM);
        const livres = jaIndicada ? estado.livres.filter((q) => distancia(q, marca) > MESMO_PONTO_MM) : [...estado.livres, marca];
        return { estado: { ...SEM_TRECHO, livres }, recado: null };
      }
      case 'linhas-auxiliares': {
        const numero = contexto.linhaInterna;
        const linha = numero === null ? undefined : peca.linhasInternas[numero];
        if (numero === null || !linha || linha.length < 2) return { estado, recado: 'Clique em cima de uma linha interna da peça selecionada.' };
        if (!opcoes.linhas.manual) {
          const feito = aplicarLinhasAuxiliares(opcoes, pecas, peca, [numero]);
          return { estado: SEM_TRECHO, pecas: feito.pecas, recado: feito.recado };
        }
        // No manual, a linha entra na lista (ou sai, se já estava); o Enter converte todas.
        const marca = marcaDaLinha(linha);
        const jaIndicada = estado.livres.some((q) => distancia(q, marca) <= MESMO_PONTO_MM);
        return { estado: { ...SEM_TRECHO, livres: jaIndicada ? estado.livres.filter((q) => distancia(q, marca) > MESMO_PONTO_MM) : [...estado.livres, marca] }, recado: null };
      }
    }
  } catch (e) {
    return { estado, recado: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Prévia e instruções
// ---------------------------------------------------------------------------

/** O que o desenho mostra com a ferramenta ligada: o pique como ficaria com o clique, ou o que o clique pega. */
export function previaDaMarcacao(
  modo: ModoDeMarcacao,
  opcoes: OpcoesDeMarcacao,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  contexto: Pick<ContextoDaMarcacao, 'raioMm' | 'linhaInterna'>,
): PreviaDeFerramentaDeMolde {
  if (!mouse) return estado.inicio ? { marcas: [estado.inicio.ponto] } : {};
  try {
    switch (modo) {
      case 'inserir-pique': {
        const o = opcoes.inserir;
        if (!o.sobreOContorno) {
          const base = o.usarDxDy && mouse.noContorno ? mouse.noContorno.ponto : mouse.livre;
          const onde = o.usarDxDy ? ponto(base.x + o.dyMm, base.y + o.dxMm) : base;
          return pontoDentroDoContorno(onde, peca.contorno) ? { linhas: tracosDaMarca({ id: 'previa', posicao: onde, formato: o.formato }) ?? [] } : {};
        }
        if (!mouse.noContorno) return {};
        const posicao = o.distanciaMm === null ? mouse.noContorno : posicaoPelaReferencia(peca.contorno, mouse.noContorno, o.distanciaMm, mouse.livre);
        return { linhas: tracosDoPique(peca, { id: 'previa', posicao: posicao.ponto, indiceAresta: posicao.indiceAresta, formato: o.formato }), marcas: [posicao.ponto] };
      }
      case 'remover-pique':
      case 'alterar-pique': {
        if (modo === 'alterar-pique' && estado.alvo !== undefined) {
          const doPique = peca.piques.find((q) => q.id === estado.alvo);
          if (doPique) return mouse.noContorno ? { linhas: tracosDoPique(peca, { ...doPique, posicao: mouse.noContorno.ponto, indiceAresta: mouse.noContorno.indiceAresta }), marcas: [doPique.posicao] } : { marcas: [doPique.posicao] };
          const daMarca = peca.marcas.find((m) => m.id === estado.alvo);
          return daMarca ? { linhas: tracosDaMarca({ ...daMarca, posicao: mouse.livre }) ?? [], marcas: [daMarca.posicao] } : {};
        }
        const sob = piquePerto(peca, mouse.livre, contexto.raioMm)?.posicao ?? marcaPerto(peca, mouse.livre, contexto.raioMm)?.posicao;
        return sob ? { marcas: [sob] } : {};
      }
      case 'multiplos-piques': {
        const o = opcoes.multiplos;
        if (o.modo === 'elemento') {
          const linha = contexto.linhaInterna === null ? undefined : peca.linhasInternas[contexto.linhaInterna];
          return linha && linha.length >= 2 ? { substituido: linha, marcas: posicoesAoLongo(linha, o).filter((q) => pontoDentroDoContorno(q, peca.contorno)) } : {};
        }
        if (o.modo === 'mouse') {
          const primeiro = estado.livres[0];
          return primeiro ? { novo: [primeiro, mouse.livre], marcas: posicoesAoLongo([primeiro, mouse.livre], o) } : {};
        }
        if (!estado.inicio) return mouse.noContorno ? { marcas: [mouse.noContorno.ponto] } : {};
        if (!mouse.noContorno) return { marcas: [estado.inicio.ponto] };
        const caminho = caminhoHorario(peca, estado.inicio, mouse.noContorno);
        return { substituido: caminho, marcas: posicoesAoLongo(caminho, o) };
      }
      case 'pique-texto':
        return pontoDentroDoContorno(mouse.livre, peca.contorno) ? { novo: extensaoDoTexto(mouse.livre, opcoes.texto), marcas: [mouse.livre] } : {};
      case 'alinhar-piques': {
        // O alvo é um pique do contorno ou um interno.
        const doAlvo = peca.piques.find((q) => q.id === estado.alvo) ?? peca.marcas.find((m) => m.id === estado.alvo);
        if (!doAlvo) {
          const sob = piqueOuInternoPerto(peca, mouse.livre, contexto.raioMm);
          return sob ? { marcas: [sob.posicao] } : {};
        }
        if (opcoes.alinhar.modo === 'elemento') {
          const linha = contexto.linhaInterna === null ? undefined : peca.linhasInternas[contexto.linhaInterna];
          return linha && linha.length >= 2 ? { substituido: linha, marcas: [doAlvo.posicao] } : { marcas: [doAlvo.posicao] };
        }
        const doContorno = pontoDoContornoSob(peca, mouse, contexto.raioMm);
        return { marcas: doContorno === null ? [doAlvo.posicao] : [doAlvo.posicao, peca.contorno[doContorno]!] };
      }
      case 'cadastrar-pique': {
        const confirmadas = linhasDasMarcas(peca, estado.grupos?.[0] ?? []);
        if (confirmadas.length > 0) return { linhas: confirmadas.map((i) => peca.linhasInternas[i]!), marcas: [mouse.livre] };
        const indicadas = linhasDasMarcas(peca, estado.livres);
        const emJogo = contexto.linhaInterna !== null && !indicadas.includes(contexto.linhaInterna) ? [...indicadas, contexto.linhaInterna] : indicadas;
        return emJogo.length > 0 ? { linhas: emJogo.map((i) => peca.linhasInternas[i]!).filter((linha) => linha.length >= 2) } : {};
      }
      case 'linhas-auxiliares': {
        // As linhas já indicadas (no manual) tracejadas, e a que está sob o mouse em destaque.
        const indicadas = linhasDasMarcas(peca, estado.livres).map((i) => peca.linhasInternas[i]!);
        const sob = contexto.linhaInterna === null ? undefined : peca.linhasInternas[contexto.linhaInterna];
        return { ...(indicadas.length > 0 ? { linhas: indicadas } : {}), ...(sob && sob.length >= 2 ? { substituido: sob } : {}) };
      }
    }
  } catch {
    return estado.inicio ? { marcas: [estado.inicio.ponto] } : {};
  }
}

/** A instrução do próximo clique, para a faixa de mensagens. */
export function instrucaoDaMarcacao(modo: ModoDeMarcacao, opcoes: OpcoesDeMarcacao, estado: TrechoEmEdicao): string {
  switch (modo) {
    case 'inserir-pique': {
      const o = opcoes.inserir;
      if (!o.sobreOContorno) {
        return `Inserir pique interno (${nomeDoFormato(o.formato)}): clique dentro da peça selecionada${o.usarDxDy ? `, no ponto de onde contar o Dx de ${formatarMm(o.dxMm)} e o Dy de ${formatarMm(o.dyMm)}` : ', onde o pique deve ficar'}.` + ESC;
      }
      return (
        `Inserir pique (${nomeDoFormato(o.formato)}): clique na borda da peça selecionada${o.distanciaMm === null ? ', onde o pique deve ficar' : ` — o pique fica a ${formatarMm(o.distanciaMm)} do ponto do contorno mais perto do clique, para o lado do clique`}. O tracejado mostra.` +
        ESC
      );
    }
    case 'remover-pique':
      return 'Remover pique: clique em cima de cada pique que deve sair — do contorno ou interno. O anel mostra o que o clique pega.' + ESC;
    case 'alterar-pique':
      return estado.alvo !== undefined
        ? 'Alterar pique: clique onde o pique deve ficar — na borda, se é do contorno; dentro da peça, se é interno. O tracejado mostra.' + ESC
        : 'Alterar pique: clique em cima de um pique da peça selecionada para mudar o formato e o lugar dele.' + ESC;
    case 'multiplos-piques': {
      const o = opcoes.multiplos;
      const quantos = o.por === 'numero' ? plural(o.quantidade, 'pique', 'piques') : `um pique a cada ${formatarMm(o.espacoMm)}`;
      if (o.modo === 'elemento') return `Múltiplos piques (${quantos}): clique numa linha interna da peça selecionada — os piques ficam ao longo dela. Os anéis mostram.` + ESC;
      if (o.modo === 'mouse') {
        return (estado.livres.length === 0 ? `Múltiplos piques (${quantos}): clique dentro da peça, onde fica o primeiro.` : 'Múltiplos piques: clique onde fica o último — os anéis mostram onde cada um cai.') + ESC;
      }
      return (
        (estado.inicio
          ? 'Múltiplos piques: clique na borda, onde os piques terminam — eles vão do primeiro ponto até ali no sentido horário (o trecho em destaque).'
          : `Múltiplos piques (${quantos}): clique na borda da peça selecionada, onde os piques começam.`) + ESC
      );
    }
    case 'pique-texto':
      return `Pique texto: clique dentro da peça selecionada, onde “${opcoes.texto.texto}” deve ficar — o traço mostra por onde o texto se estende.` + ESC;
    case 'alinhar-piques': {
      const modo = opcoes.alinhar.modo;
      if (estado.alvo === undefined) return 'Alinhar piques: clique em cima de um pique da peça selecionada — do contorno ou interno.' + ESC;
      return (
        (modo === 'elemento'
          ? 'Alinhar piques: agora clique na linha interna de referência (para o pique do contorno, a que cruza o contorno de todos os tamanhos).'
          : 'Alinhar piques: agora clique no ponto do contorno que dá a linha de cada tamanho.') + ESC
      );
    }
    case 'cadastrar-pique': {
      if ((estado.grupos?.length ?? 0) > 0) return 'Cadastrar pique: desenho confirmado. Clique no ponto de referência — o ponto do desenho que fica na borda da peça.' + ESC;
      const n = estado.livres.length;
      return (
        (n === 0
          ? opcoes.cadastrar.acao === 'alterar'
            ? `Redesenhar pique “${opcoes.cadastrar.nome}”: clique nas linhas internas que desenham a forma nova, uma a uma, e aperte Enter.`
            : `Cadastrar pique “${opcoes.cadastrar.nome}”: clique nas linhas internas que desenham o formato, uma a uma, e aperte Enter.`
          : `Cadastrar pique: ${plural(n, 'linha indicada', 'linhas indicadas')} — clique nas outras, ou aperte Enter para confirmar o desenho.`) + ESC
      );
    }
    case 'linhas-auxiliares': {
      const oQue = opcoes.linhas.acao === 'adicionar' ? 'Adicionar linhas auxiliares: clique no elemento que deve passar a fazer parte do molde' : 'Remover linhas auxiliares: clique na linha que deve voltar a ser só elemento de construção';
      if (!opcoes.linhas.manual) return `${oQue} — cada clique já converte a linha.` + ESC;
      const n = estado.livres.length;
      return (n === 0 ? `${oQue}; no modo manual, indique todas e aperte Enter.` : `Linhas auxiliares: ${plural(n, 'linha indicada', 'linhas indicadas')} — clique nas outras, ou aperte Enter para converter.`) + ESC;
    }
  }
}

/** A área de uma peça em cm², para as mensagens. */
export function cm2(peca: Molde): string {
  return `${(area(peca.contorno) / 100).toFixed(1).replace('.', ',')} cm²`;
}
