import type { Contorno, Ponto2D } from '../core/geometria';
import {
  retanguloEnvolvente,
  area,
  pontoMaisProximoNoContorno,
  deslocarContornoParaFora,
  transladarContorno,
  rotacionarContorno,
  rotacionar,
  espelharContornoHorizontal,
  espelharHorizontal,
  somar,
  distancia,
  moverPontoDoContorno,
  substituirTrechoDoContorno,
  trechoMaisCurto,
  type PosicaoNoContorno,
  inserirPontoNoContorno,
  removerPontoDoContorno,
  escalarContorno,
  escalarPonto,
  chanfrarCantoDoContorno,
  arredondarCantoDoContorno,
} from '../core/geometria';
import { transformarCota, type Cota } from './cota';
import { curvasAcompanhando } from './filaDeCurva';
import { graduacaoComOsPontosMovidos, transformarGraduacao, type Graduacao } from './graduacao';

/**
 * Regra crítica (seção 5 do escopo): por padrão nenhuma rotação OU
 * espelhamento que altere a orientação em relação ao fio é permitida. 180°,
 * 90°/270° e espelhamento são liberados apenas quando o usuário autoriza
 * explicitamente, por molde — espelhar uma peça cortada de tecido
 * direcional/com pelo inverte o desenho/sentido do pelo fisicamente, exatamente
 * o mesmo tipo de erro que a rotação proibida evita.
 */
export interface RestricaoDeRotacao {
  readonly permite180: boolean;
  readonly permite90e270: boolean;
  /** Permite usar a versão espelhada (imagem de espelho) da peça — nunca presumido, mesmo padrão da rotação. */
  readonly permiteEspelhamento?: boolean;
}

export const RESTRICAO_PADRAO: RestricaoDeRotacao = {
  permite180: false,
  permite90e270: false,
  permiteEspelhamento: false,
};

/** Seta do sentido do fio: de `inicio` para `fim`, em mm no espaço do molde. */
export interface LinhaDeFio {
  readonly inicio: Ponto2D;
  readonly fim: Ponto2D;
}

/**
 * O formato de um pique: o tipo (um dos do programa, ou um cadastrado, que
 * traz a forma e o nome dele) e as medidas. O que cada tipo desenha está em
 * `piques.ts`.
 */
export interface FormatoDePique {
  readonly tipo: string;
  /** Ao longo da borda (mm). */
  readonly larguraMm: number;
  /** Para dentro da peça (mm). */
  readonly alturaMm: number;
  /** Graus: 0 = em esquadro com a borda (no pique interno, de pé na tela); positivo gira no sentido anti-horário da tela. */
  readonly anguloGraus: number;
  /** No pique cadastrado: os traços dele, no quadro de 1 × 1 (x de −0,5 a 0,5 ao longo da borda; y de 0 a 1 para dentro). */
  readonly forma?: readonly (readonly Ponto2D[])[];
  /** No pique cadastrado: o nome que ele tem no cadastro. */
  readonly nome?: string;
  /** No pique cadastrado: o desenho vai espelhado (a direita dele vira esquerda) — é como ele fica na peça espelhada. */
  readonly espelhado?: true;
}

/** O formato com o ângulo dado e, no pique cadastrado, o desenho espelhado (ou de volta ao que era, se já estava). */
function formatoNoEspelho(formato: FormatoDePique, anguloGraus: number): FormatoDePique {
  const { espelhado, ...resto } = formato;
  return { ...resto, anguloGraus, ...(formato.forma && !espelhado ? { espelhado: true as const } : {}) };
}

/**
 * O pique do contorno na peça espelhada: o ângulo, contado do esquadro com a
 * borda, troca de sinal, e o desenho cadastrado é espelhado. O pique de um
 * tipo do programa, sem ângulo, fica como está: é simétrico.
 */
export function piqueNoEspelho<T extends { readonly formato?: FormatoDePique }>(item: T): T {
  const formato = item.formato;
  if (!formato || (formato.anguloGraus === 0 && !formato.forma)) return item;
  return { ...item, formato: formatoNoEspelho(formato, 0 - formato.anguloGraus) };
}

/**
 * O pique interno (a marca com formato) espelhado numa reta que faz
 * `direcaoDaRetaGraus` com o eixo x: o ângulo dele, que é contado da tela,
 * passa a ser o dobro da direção da reta menos o que era — o bico que apontava
 * para um lado passa a apontar para o lado espelhado —, e o desenho cadastrado
 * é espelhado.
 */
export function marcaNoEspelho<T extends { readonly formato?: FormatoDePique }>(item: T, direcaoDaRetaGraus: number): T {
  const formato = item.formato;
  if (!formato) return item;
  return { ...item, formato: formatoNoEspelho(formato, normalizarAnguloDoFormato(2 * direcaoDaRetaGraus - formato.anguloGraus)) };
}

/** Pique (marcação de corte) na aresta indicada do contorno. Sem formato, é um pequeno traço em esquadro com a borda. */
export interface Pique {
  readonly id: string;
  readonly posicao: Ponto2D;
  readonly indiceAresta: number;
  /** O desenho e as medidas do pique (aba Marcações). */
  readonly formato?: FormatoDePique;
  /** Como o pique vai para a linha de corte na peça com margem de costura: no ponto mais perto dela, ou seguindo o ângulo dele. */
  readonly naCostura?: 'projetado' | 'estendido';
  /** Código de relacionamento: piques de peças diferentes com o mesmo código se encontram na costura. */
  readonly codigo?: string;
  /** A graduação do pique (a "tabela dos piques"); sem ela, ele fica na mesma proporção da aresta em cada tamanho. */
  readonly graduacao?: GraduacaoDoPique;
}

/** Como um pique anda de um tamanho para o outro: a uma distância certa de um ponto de referência, medida sobre o contorno. */
export interface GraduacaoDoPique {
  /** O ponto do contorno (no tamanho base) a partir do qual a distância do pique é contada. Vale enquanto for um ponto do contorno. */
  readonly referencia: Ponto2D;
  /** Quanto essa distância muda em cada tamanho (mm), na ordem dos tamanhos da peça; no base é zero. */
  readonly perimetros: readonly number[];
}

/** O pique com a posição dele — e a referência da graduação, se tem — levada por `f`. */
export function piqueLevado(pique: Pique, f: (p: Ponto2D) => Ponto2D): Pique {
  return {
    ...pique,
    posicao: f(pique.posicao),
    ...(pique.graduacao ? { graduacao: { ...pique.graduacao, referencia: f(pique.graduacao.referencia) } } : {}),
  };
}

/** Um texto escrito sobre a peça, centrado em `posicao`, com a altura das letras em mm. */
export interface TextoDaPeca {
  readonly id: string;
  readonly posicao: Ponto2D;
  readonly texto: string;
  readonly alturaMm: number;
  /** O "Pique texto": graus em que o texto está inclinado na tela (0 = na horizontal; positivo, no sentido anti-horário). Sem ele, o texto fica sempre na horizontal. */
  readonly anguloGraus?: number;
  /** O "Pique texto": o que fica em `posicao` — o começo ou o fim do texto. Sem ela, o meio. */
  readonly ancora?: 'inicio' | 'fim';
}

/** O texto com o ângulo dele mudado por `f` (o texto sem ângulo — sempre na horizontal — fica como está). */
function textoComAngulo(texto: TextoDaPeca, f: (graus: number) => number): TextoDaPeca {
  return texto.anguloGraus === undefined ? texto : { ...texto, anguloGraus: f(texto.anguloGraus) };
}

/** Marca de referência/alinhamento (ex.: ponto de casa de botão, marca de dobra). Com formato, é um pique interno. */
export interface Marca {
  readonly id: string;
  readonly posicao: Ponto2D;
  readonly rotulo?: string;
  /** O desenho e as medidas do pique interno, centrado na posição (aba Marcações). */
  readonly formato?: FormatoDePique;
}

/**
 * Uma curva ou um arco feito por ferramenta, guardado pelos pontos por onde
 * passa. Com o registro, dá para mexer num desses pontos depois e ter a curva
 * refeita por ele.
 */
export interface CurvaDaPeca {
  readonly id: string;
  /** Curva: passa por todos os pontos. Arco: de círculo, por três. Forma: a curva pré-definida, posta entre as duas pontas. */
  readonly tipo: 'curva' | 'arco' | 'forma';
  /** Por onde a curva passa: a ponta inicial, os pontos de passagem e a ponta final (o arco tem um só ponto de passagem; a forma, nenhum). */
  readonly controles: readonly Ponto2D[];
  /** Forma: a curva pré-definida como está no cadastro (de (0, 0) a (1, 0)) e se entrou espelhada. */
  readonly forma?: { readonly pontos: readonly Ponto2D[]; readonly espelhar: boolean };
  /** Os pontos do contorno que a curva gerou, de uma ponta à outra. O registro vale enquanto forem pontos seguidos do contorno. */
  readonly pontos: readonly Ponto2D[];
  /**
   * Curva: as alças de tangente postas nas pontas (o ponto de cada uma). A
   * curva sai da ponta na direção da alça; o comprimento dela não conta. Sem a
   * alça, sai na direção do ponto de passagem vizinho.
   */
  readonly tangentes?: TangentesDaCurva;
}

/**
 * A peça que é uma figura inteira feita por ferramenta (o círculo do "Por
 * raio", a espiral): as medidas com que foi feita e onde está — o centro e
 * os dois pontos a 100 mm dele que guardam os eixos em que foi desenhada, e
 * que andam, giram e são espelhados com a peça. O registro só vale enquanto
 * o contorno é o da figura.
 */
export type FiguraDaPeca = {
  readonly centro: Ponto2D;
  readonly eixoX: Ponto2D;
  readonly eixoY: Ponto2D;
} & (
  | {
      readonly tipo: 'circulo';
      readonly raioMm: number;
      /** Quantos lados o contorno tem, quando não é o número que o raio daria: o círculo foi dimensionado por igual, e ficou com os lados que tinha. */
      readonly lados?: number;
    }
  | { readonly tipo: 'espiral'; readonly larguraMm: number; readonly perimetroMm: number }
);

/** As alças de tangente de uma curva: a da ponta inicial e a da final, cada uma só se foi posta. */
export interface TangentesDaCurva {
  readonly inicio?: Ponto2D;
  readonly fim?: Ponto2D;
}

/** O registro da curva com todos os pontos dele levados pela função dada (a peça andou, girou, foi espelhada…). */
export function curvaLevada(curva: CurvaDaPeca, levar: (p: Ponto2D) => Ponto2D): CurvaDaPeca {
  const { inicio, fim } = curva.tangentes ?? {};
  return {
    ...curva,
    controles: curva.controles.map(levar),
    pontos: curva.pontos.map(levar),
    ...(curva.tangentes ? { tangentes: { ...(inicio ? { inicio: levar(inicio) } : {}), ...(fim ? { fim: levar(fim) } : {}) } } : {}),
  };
}

/**
 * Uma pence feita por ferramenta, guardada pelos pontos dela. Com o registro,
 * dá para mudar as medidas depois, apagar a pence e fechá-la ou transferi-la
 * sem adivinhar qual canto do contorno é a pence. O registro só vale enquanto
 * os pontos dele continuam na peça como foram postos.
 */
export interface PenceDaPeca {
  readonly id: string;
  /** Recortada: o "V" faz parte do contorno. Marcada: é uma linha interna. Interna: o losango desenhado no meio da peça. */
  readonly tipo: 'recortada' | 'marcada' | 'interna';
  /** Recortada e marcada: ponta, vértice e ponta. Interna: os quatro cantos do losango (ponta 1, lado, ponta 2, lado). */
  readonly pontos: readonly Ponto2D[];
  /** Recortada: os pontos do contorno que o recorte tirou, de uma ponta à outra (nenhum, numa aresta reta). */
  readonly removidos?: readonly Ponto2D[];
  /** Recortada: cada ponta foi posta no contorno pelo recorte (não era um ponto dele)? Apagada a pence, a ponta posta por ela sai junto. */
  readonly pontasCriadas?: readonly [boolean, boolean];
  /** Os piques e as marcas que a ferramenta pôs junto com a pence: saem e voltam com ela quando as medidas mudam. */
  readonly piques?: readonly string[];
  readonly marcas?: readonly string[];
  /** Interna: tem também a linha do eixo, de ponta a ponta. */
  readonly comEixo?: boolean;
  /** Recortada, aberta por pivô: o ponto do contorno em torno do qual a peça girou para abrir. Com ele, a pence fecha e abre de novo pelo mesmo giro. */
  readonly pivo?: Ponto2D;
  /**
   * Marcada, com acabamento: o bico que o contorno ganhou entre as duas pontas
   * (o que a pence faz na borda quando é dobrada). Com ele, a pence não foi
   * recortada: fica desenhada, e o contorno passa pelo bico.
   */
  readonly bico?: Ponto2D;
  /**
   * Com acabamento: a ponta (0 ou 2, em `pontos`) para o lado da qual a pence
   * é dobrada na costura — o bico é o dessa dobra. Sem o campo, o bico fica no
   * meio do das duas dobras possíveis.
   */
  readonly dobra?: 0 | 2;
  /**
   * Com acabamento dobrado para um lado, numa borda que não é reta: todos os
   * pontos que o contorno ganhou entre as duas pontas, da primeira para a
   * segunda (o bico é um deles). Sem o campo, o contorno passa só pelo bico.
   */
  readonly capa?: readonly Ponto2D[];
}

/** O registro da pence com todos os pontos dele levados pela função dada (a peça andou, girou, foi espelhada…). */
export function penceLevada(pence: PenceDaPeca, levar: (p: Ponto2D) => Ponto2D): PenceDaPeca {
  return {
    ...pence,
    pontos: pence.pontos.map(levar),
    ...(pence.removidos ? { removidos: pence.removidos.map(levar) } : {}),
    ...(pence.pivo ? { pivo: levar(pence.pivo) } : {}),
    ...(pence.bico ? { bico: levar(pence.bico) } : {}),
    ...(pence.capa ? { capa: pence.capa.map(levar) } : {}),
  };
}

/**
 * Uma prega aberta por ferramenta, guardada pelas duas bordas da abertura e
 * pelas linhas que desenhou. Com o registro, dá para mudar as larguras depois
 * e para tirar a prega, fechando a peça de volta. O registro só vale enquanto
 * as bordas e as linhas continuam na peça como foram postas.
 */
export interface PregaDaPeca {
  readonly id: string;
  readonly modo: 'simples-direita' | 'simples-esquerda' | 'dupla';
  /** A borda da abertura do lado que ficou parado: as duas pontas da linha da prega. */
  readonly parada: readonly [Ponto2D, Ponto2D];
  /** A borda do lado que andou: as mesmas duas pontas, levadas pela abertura. Cada uma é vizinha, no contorno, da ponta parada dela. */
  readonly movida: readonly [Ponto2D, Ponto2D];
  /** As linhas internas que a prega desenhou: as de dobra e as setas. */
  readonly linhas: readonly Contorno[];
  /** As linhas internas que estavam em cima da linha da prega e saíram quando ela abriu (a reta auxiliar, uma linha de centro): voltam quando a prega é tirada. */
  readonly linhasTiradas?: readonly Contorno[];
  /** Cada ponta da linha da prega foi posta no contorno por ela (não era um ponto dele)? Tirada a prega, a ponta posta por ela sai junto. */
  readonly pontasCriadas: readonly [boolean, boolean];
  /** Os piques que a ferramenta pôs junto com a prega. */
  readonly piques?: readonly string[];
}

/** Um ponto em que a reta da prega em cunha atravessava o contorno da peça. */
export interface TravessiaDaCunha {
  /** Onde ficou a ponta do lado que não se moveu. */
  readonly parada: Ponto2D;
  /** Onde foi parar a ponta do lado que girou; no pivô, é o mesmo ponto. Fora dele, é vizinha da parada no contorno. */
  readonly movida: Ponto2D;
  /** A ponta foi posta no contorno pela abertura (não era um ponto dele)? Fechada a prega, sai junto. */
  readonly criada: boolean;
}

/**
 * Uma prega em cunha, aberta pela pence por pivô com "Cortar intersecções": a
 * peça foi cortada em todos os trechos da reta da posição ao pivô que estavam
 * dentro dela, e um lado girou em torno do pivô. Guardada pelos pontos em que
 * a reta atravessava o contorno, para fechar a peça de volta ou mudar a
 * abertura depois. O registro só vale enquanto esses pontos e as linhas
 * continuam na peça como foram postos.
 */
export interface CunhaDaPeca {
  readonly id: string;
  /** As travessias da reta, na ordem do contorno. */
  readonly travessias: readonly TravessiaDaCunha[];
  /** Qual das travessias é a posição da pence (onde a abertura é a pedida). */
  readonly posicao: number;
  /** Qual é o pivô. */
  readonly pivo: number;
  /** As linhas internas que a abertura desenhou: as duas bordas de cada trecho aberto. */
  readonly linhas: readonly Contorno[];
  /** Os piques postos nas duas pontas da abertura, se foram pedidos. */
  readonly piques?: readonly string[];
  /** O primeiro ponto do contorno de antes de abrir, onde ele estava: fechada a prega, a numeração dos pontos volta a começar nele. */
  readonly comeco?: Ponto2D;
}

/**
 * A metade que o "Dobrar" tirou da peça com "Manter dobra do molde" ligado:
 * fica guardada, fora do desenho, para o "Desdobrar" trazê-la de volta como
 * era — em vez de espelhar a metade que ficou.
 */
export interface MetadeGuardada {
  /** As duas pontas da dobra. A metade só encaixa enquanto as duas forem pontos seguidos do contorno. */
  readonly de: Ponto2D;
  readonly ate: Ponto2D;
  /** O contorno fechado da metade guardada; a dobra é uma das arestas dele. */
  readonly contorno: Contorno;
  readonly furos: readonly Contorno[];
  readonly linhasInternas: readonly Contorno[];
  readonly marcas: readonly Marca[];
  readonly piques: readonly Pique[];
}

export interface Molde {
  readonly id: string;
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly linhasInternas: readonly Contorno[];
  readonly furos: readonly Contorno[];
  readonly piques: readonly Pique[];
  readonly marcas: readonly Marca[];
  readonly margemDeCosturaMm: number;
  readonly linhaDeFio: LinhaDeFio;
  readonly quantidade: number;
  readonly restricaoDeRotacao: RestricaoDeRotacao;
  /** Rotação acumulada em relação à orientação original (criação/importação), normalizada em [0, 360). */
  readonly anguloDeRotacaoGraus: number;
  /** Cotas presas à peça (aba Conferência). Ausente em peças sem cota e em projetos antigos. */
  readonly cotas?: readonly Cota[];
  /**
   * Graduação (aba Graduação): os tamanhos e a regra dos pontos graduados. O
   * `contorno` é o do tamanho base; o encaixe, a validação e a exportação só
   * olham para ele. Ausente em peças sem graduação.
   */
  readonly graduacao?: Graduacao;
  /** Textos escritos sobre a peça (aba Construção). */
  readonly textos?: readonly TextoDaPeca[];
  /** Cor de fundo da peça no desenho (aba Início); ausente, vale a cor padrão. */
  readonly cor?: string;
  /**
   * Linha de simetria (aba Produção): a aresta em que a peça é dobrada, guardada
   * pelas duas pontas. Só vale enquanto as duas forem pontos seguidos do contorno.
   */
  readonly linhaDeSimetria?: { readonly de: Ponto2D; readonly ate: Ponto2D };
  /** A outra metade de uma peça dobrada com "Manter dobra do molde" (aba Produção > Dobrar). */
  readonly dobraMantida?: MetadeGuardada;
  /** As pences feitas pelas ferramentas de pence (aba Produção), para mudar as medidas depois. */
  readonly pences?: readonly PenceDaPeca[];
  /** As curvas e os arcos feitos pelas ferramentas da aba Construção, para mexer nos pontos de passagem depois. */
  readonly curvas?: readonly CurvaDaPeca[];
  /** As pregas abertas por ferramenta, com as bordas e as linhas delas (para mudar as larguras e tirar depois). */
  readonly pregas?: readonly PregaDaPeca[];
  /** As pregas em cunha abertas com "Cortar intersecções" (aba Produção > Pence no contorno > Abrir), para fechar ou mudar a abertura depois. */
  readonly cunhas?: readonly CunhaDaPeca[];
  /**
   * As linhas internas que são só de construção (os "elementos" da aba Marcações > Linhas auxiliares): ficam na tela e
   * servem às ferramentas, mas não fazem parte do molde. Cada uma é guardada pelos pontos dela; ver `linhasAuxiliares.ts`.
   */
  readonly elementos?: readonly Contorno[];
  /** A figura que a peça é, quando foi feita inteira por ferramenta (o círculo do "Por raio", a espiral): para mudar as medidas depois. */
  readonly figura?: FiguraDaPeca;
}

export interface DadosDeNovoMolde {
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly linhaDeFio: LinhaDeFio;
  readonly quantidade?: number;
  readonly linhasInternas?: readonly Contorno[];
  readonly furos?: readonly Contorno[];
  readonly piques?: readonly Pique[];
  readonly marcas?: readonly Marca[];
  readonly margemDeCosturaMm?: number;
  readonly restricaoDeRotacao?: RestricaoDeRotacao;
}

/** Constrói um molde válido ou lança erro — usar apenas com dados já conferidos (ex.: vindos de importação já validada). */
export function criarMolde(dados: DadosDeNovoMolde, id: string): Molde {
  if (dados.contorno.length < 3) {
    throw new Error(`Molde "${dados.nome}" precisa de um contorno com ao menos 3 pontos.`);
  }
  if (area(dados.contorno) <= 0) {
    throw new Error(`Molde "${dados.nome}" possui contorno degenerado (área zero).`);
  }
  if (!Number.isFinite(dados.quantidade ?? 1) || (dados.quantidade ?? 1) < 1) {
    throw new Error(`Molde "${dados.nome}" precisa de quantidade >= 1.`);
  }
  for (const furo of dados.furos ?? []) {
    if (furo.length < 3) {
      throw new Error(`Molde "${dados.nome}" tem um furo com menos de 3 pontos.`);
    }
    if (area(furo) <= 0) {
      throw new Error(`Molde "${dados.nome}" tem um furo com contorno degenerado (área zero).`);
    }
  }
  const margem = dados.margemDeCosturaMm ?? 0;
  if (!Number.isFinite(margem) || margem < 0) {
    throw new Error(`Molde "${dados.nome}" precisa de margem de costura >= 0.`);
  }
  return {
    id,
    nome: dados.nome,
    referencia: dados.referencia,
    tamanho: dados.tamanho,
    contorno: dados.contorno,
    linhasInternas: dados.linhasInternas ?? [],
    furos: dados.furos ?? [],
    piques: dados.piques ?? [],
    marcas: dados.marcas ?? [],
    margemDeCosturaMm: margem,
    linhaDeFio: dados.linhaDeFio,
    quantidade: dados.quantidade ?? 1,
    restricaoDeRotacao: dados.restricaoDeRotacao ?? RESTRICAO_PADRAO,
    anguloDeRotacaoGraus: 0,
  };
}

/** Adiciona um pique na aresta do contorno mais próxima de `posicaoClicada`. */
export function adicionarPique(molde: Molde, posicaoClicada: Ponto2D, id: string): Molde {
  const encontrado = pontoMaisProximoNoContorno(posicaoClicada, molde.contorno);
  const novoPique: Pique = { id, posicao: encontrado.ponto, indiceAresta: encontrado.indiceAresta };
  return { ...molde, piques: [...molde.piques, novoPique] };
}

export function removerPique(molde: Molde, piqueId: string): Molde {
  return { ...molde, piques: molde.piques.filter((p) => p.id !== piqueId) };
}

export function adicionarMarca(molde: Molde, posicao: Ponto2D, id: string, rotulo?: string): Molde {
  const marca: Marca = rotulo === undefined ? { id, posicao } : { id, posicao, rotulo };
  return { ...molde, marcas: [...molde.marcas, marca] };
}

export function removerMarca(molde: Molde, marcaId: string): Molde {
  return { ...molde, marcas: molde.marcas.filter((m) => m.id !== marcaId) };
}

const ORIGEM: Ponto2D = { x: 0, y: 0 };

/** O ângulo de um formato trazido para o intervalo de −180° a 180°. */
function normalizarAnguloDoFormato(graus: number): number {
  const voltas = ((graus % 360) + 360) % 360;
  return voltas > 180 ? voltas - 360 : voltas;
}

/**
 * As cotas da peça levadas por uma transformação afim (`ponto` para posições,
 * `vetor` para direções). Devolve o campo `cotas` pronto para espalhar no
 * molde novo, ou nada quando a peça não tem cotas.
 */
function cotasTransformadas(
  molde: Molde,
  ponto: (p: Ponto2D) => Ponto2D,
  vetor: (v: Ponto2D) => Ponto2D,
): { readonly cotas?: readonly Cota[] } {
  return molde.cotas ? { cotas: molde.cotas.map((c) => transformarCota(c, ponto, vetor)) } : {};
}

/** A graduação da peça levada por uma transformação afim, pronta para espalhar no molde novo (ou nada, sem graduação). */
function graduacaoTransformada(
  molde: Molde,
  ponto: (p: Ponto2D) => Ponto2D,
  vetor: (v: Ponto2D) => Ponto2D,
): { readonly graduacao?: Graduacao } {
  return molde.graduacao ? { graduacao: transformarGraduacao(molde.graduacao, ponto, vetor) } : {};
}

/**
 * As pences depois que pontos do contorno mudaram de lugar (mesma quantidade
 * de pontos, mesma ordem): cada ponto de pence que estava em cima de um ponto
 * do contorno acompanha-o.
 */
export function pencesComOsPontosMovidos(pences: readonly PenceDaPeca[], contornoAntigo: Contorno, contornoNovo: Contorno): readonly PenceDaPeca[] {
  if (contornoAntigo === contornoNovo || contornoAntigo.length !== contornoNovo.length) return pences;
  const levar = (p: Ponto2D): Ponto2D => {
    const i = contornoAntigo.findIndex((v) => Math.abs(v.x - p.x) <= 1e-9 && Math.abs(v.y - p.y) <= 1e-9);
    return i >= 0 ? contornoNovo[i]! : p;
  };
  return pences.map((pence) =>
    pence.tipo === 'recortada' ? { ...pence, pontos: pence.pontos.map(levar), ...(pence.pivo ? { pivo: levar(pence.pivo) } : {}) } : pence,
  );
}

/**
 * A peça depois de pontos do contorno mudarem de lugar, com as curvas
 * registradas acompanhando: a que andou inteira anda junto, e a que teve só
 * as pontas movidas é refeita entre as pontas de agora (o contorno ganha a
 * curva nova, e os piques que estavam sobre a antiga saem).
 */
export function comAsCurvasAcompanhando(antes: Molde, depois: Molde): Molde {
  if (!antes.curvas) return depois;
  const { contorno, curvas } = curvasAcompanhando(antes.curvas, antes.contorno, depois.contorno);
  if (curvas === antes.curvas) return depois;
  if (contorno === depois.contorno) return { ...depois, curvas };
  return { ...depois, contorno, curvas, piques: piquesQueFicamNoContorno(depois.piques, contorno) };
}

/** A graduação e as pences acompanhando os pontos do contorno que mudaram de lugar (mesma quantidade de pontos). */
function acompanhandoOsPontos(molde: Molde, contornoNovo: Contorno): { readonly graduacao?: Graduacao; readonly pences?: readonly PenceDaPeca[] } {
  return {
    ...(molde.graduacao ? { graduacao: graduacaoComOsPontosMovidos(molde.graduacao, molde.contorno, contornoNovo) } : {}),
    ...(molde.pences ? { pences: pencesComOsPontosMovidos(molde.pences, molde.contorno, contornoNovo) } : {}),
  };
}

/** A peça sem um dos campos que podem faltar (a cor, a graduação, a linha de simetria…). */
export function semCampo(
  molde: Molde,
  campo: 'graduacao' | 'cor' | 'linhaDeSimetria' | 'textos' | 'dobraMantida' | 'pences' | 'curvas' | 'pregas' | 'cunhas' | 'elementos',
): Molde {
  const copia: { -readonly [K in keyof Molde]: Molde[K] } = { ...molde };
  delete copia[campo];
  return copia;
}

/** A peça sem graduação: fica só o tamanho base, como uma peça comum. */
export function semGraduacao(molde: Molde): Molde {
  return semCampo(molde, 'graduacao');
}

/** As pregas registradas com os pontos delas levados por `ponto`. */
export function pregasLevadas(pregas: readonly PregaDaPeca[], ponto: (p: Ponto2D) => Ponto2D): readonly PregaDaPeca[] {
  return pregas.map((prega) => ({
    ...prega,
    parada: [ponto(prega.parada[0]), ponto(prega.parada[1])],
    movida: [ponto(prega.movida[0]), ponto(prega.movida[1])],
    linhas: prega.linhas.map((linha) => linha.map(ponto)),
    ...(prega.linhasTiradas ? { linhasTiradas: prega.linhasTiradas.map((linha) => linha.map(ponto)) } : {}),
  }));
}

/** As pregas em cunha registradas com os pontos delas levados por `ponto`. */
export function cunhasLevadas(cunhas: readonly CunhaDaPeca[], ponto: (p: Ponto2D) => Ponto2D): readonly CunhaDaPeca[] {
  return cunhas.map((cunha) => ({
    ...cunha,
    travessias: cunha.travessias.map((x) => ({ ...x, parada: ponto(x.parada), movida: ponto(x.movida) })),
    linhas: cunha.linhas.map((linha) => linha.map(ponto)),
    ...(cunha.comeco ? { comeco: ponto(cunha.comeco) } : {}),
  }));
}

/** Os textos, a linha de simetria, a metade guardada, as pences, as curvas e as pregas da peça levados por uma transformação, prontos para espalhar no molde novo. */
function anotacoesTransformadas(
  molde: Molde,
  ponto: (p: Ponto2D) => Ponto2D,
): {
  readonly textos?: readonly TextoDaPeca[];
  readonly linhaDeSimetria?: { readonly de: Ponto2D; readonly ate: Ponto2D };
  readonly dobraMantida?: MetadeGuardada;
  readonly pences?: readonly PenceDaPeca[];
  readonly curvas?: readonly CurvaDaPeca[];
  readonly pregas?: readonly PregaDaPeca[];
  readonly cunhas?: readonly CunhaDaPeca[];
  readonly elementos?: readonly Contorno[];
  readonly figura?: FiguraDaPeca;
} {
  const guardada = molde.dobraMantida;
  const figura = molde.figura;
  return {
    ...(figura ? { figura: { ...figura, centro: ponto(figura.centro), eixoX: ponto(figura.eixoX), eixoY: ponto(figura.eixoY) } } : {}),
    ...(molde.pregas ? { pregas: pregasLevadas(molde.pregas, ponto) } : {}),
    ...(molde.cunhas ? { cunhas: cunhasLevadas(molde.cunhas, ponto) } : {}),
    ...(molde.curvas
      ? { curvas: molde.curvas.map((curva) => curvaLevada(curva, ponto)) }
      : {}),
    ...(molde.pences ? { pences: molde.pences.map((pence) => penceLevada(pence, ponto)) } : {}),
    ...(molde.textos ? { textos: molde.textos.map((t) => ({ ...t, posicao: ponto(t.posicao) })) } : {}),
    ...(molde.elementos ? { elementos: molde.elementos.map((linha) => linha.map(ponto)) } : {}),
    ...(molde.linhaDeSimetria ? { linhaDeSimetria: { de: ponto(molde.linhaDeSimetria.de), ate: ponto(molde.linhaDeSimetria.ate) } } : {}),
    ...(guardada
      ? {
          dobraMantida: {
            de: ponto(guardada.de),
            ate: ponto(guardada.ate),
            contorno: guardada.contorno.map(ponto),
            furos: guardada.furos.map((f) => f.map(ponto)),
            linhasInternas: guardada.linhasInternas.map((l) => l.map(ponto)),
            marcas: guardada.marcas.map((m) => ({ ...m, posicao: ponto(m.posicao) })),
            piques: guardada.piques.map((q) => ({ ...q, posicao: ponto(q.posicao) })),
          },
        }
      : {}),
  };
}

/** Prende uma cota à peça. */
export function adicionarCota(molde: Molde, cota: Cota): Molde {
  return { ...molde, cotas: [...(molde.cotas ?? []), cota] };
}

/** Tira a cota da peça. */
export function removerCota(molde: Molde, cotaId: string): Molde {
  return { ...molde, cotas: (molde.cotas ?? []).filter((c) => c.id !== cotaId) };
}

/**
 * Linha de corte real: o contorno da peça já considerando a margem de
 * costura (seção 8 do escopo — o PDF deve distinguir linha de corte de
 * linha de costura). Sem margem configurada, corte e contorno coincidem.
 */
export function contornoDeCorte(molde: Molde): Contorno {
  if (molde.margemDeCosturaMm <= 0) return molde.contorno;
  return deslocarContornoParaFora(molde.contorno, molde.margemDeCosturaMm);
}

/** Translada um molde inteiro (contorno, furos, linhas internas, piques, marcas e linha de fio) por `deslocamento`. */
export function transladarMolde(molde: Molde, deslocamento: Ponto2D, novoId: string): Molde {
  return {
    ...molde,
    id: novoId,
    contorno: transladarContorno(molde.contorno, deslocamento),
    linhasInternas: molde.linhasInternas.map((l) => transladarContorno(l, deslocamento)),
    furos: molde.furos.map((f) => transladarContorno(f, deslocamento)),
    piques: molde.piques.map((p) => piqueLevado(p, (q) => somar(q, deslocamento))),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: somar(m.posicao, deslocamento) })),
    linhaDeFio: {
      inicio: somar(molde.linhaDeFio.inicio, deslocamento),
      fim: somar(molde.linhaDeFio.fim, deslocamento),
    },
    ...cotasTransformadas(
      molde,
      (p) => somar(p, deslocamento),
      (v) => v,
    ),
    ...graduacaoTransformada(
      molde,
      (p) => somar(p, deslocamento),
      (v) => v,
    ),
    ...anotacoesTransformadas(molde, (p) => somar(p, deslocamento)),
  };
}

/**
 * Rotaciona um molde inteiro por `anguloGraus` em torno do centro do seu
 * retângulo envolvente. Esta função é pura geometria — NÃO verifica se a
 * rotação é permitida pela `restricaoDeRotacao` do molde; quem chama (a UI)
 * deve checar `rotacaoEhPermitida` antes e recusar/alertar se não for (regra
 * crítica da seção 5 — nunca ignorada).
 */
export function rotacionarMolde(molde: Molde, anguloGraus: number): Molde {
  const centro = retanguloEnvolvente(molde.contorno);
  const pivo = { x: (centro.minX + centro.maxX) / 2, y: (centro.minY + centro.maxY) / 2 };
  return {
    ...molde,
    contorno: rotacionarContorno(molde.contorno, pivo, anguloGraus),
    linhasInternas: molde.linhasInternas.map((l) => rotacionarContorno(l, pivo, anguloGraus)),
    furos: molde.furos.map((f) => rotacionarContorno(f, pivo, anguloGraus)),
    piques: molde.piques.map((p) => piqueLevado(p, (q) => rotacionar(q, pivo, anguloGraus))),
    // O pique interno gira junto: o ângulo dele é contado da tela. (O do contorno acompanha a borda sozinho.)
    marcas: molde.marcas.map((m) => ({
      ...m,
      posicao: rotacionar(m.posicao, pivo, anguloGraus),
      ...(m.formato ? { formato: { ...m.formato, anguloGraus: normalizarAnguloDoFormato(m.formato.anguloGraus + anguloGraus) } } : {}),
    })),
    linhaDeFio: {
      inicio: rotacionar(molde.linhaDeFio.inicio, pivo, anguloGraus),
      fim: rotacionar(molde.linhaDeFio.fim, pivo, anguloGraus),
    },
    anguloDeRotacaoGraus: normalizarAngulo(molde.anguloDeRotacaoGraus + anguloGraus),
    ...cotasTransformadas(
      molde,
      (p) => rotacionar(p, pivo, anguloGraus),
      (v) => rotacionar(v, ORIGEM, anguloGraus),
    ),
    ...graduacaoTransformada(
      molde,
      (p) => rotacionar(p, pivo, anguloGraus),
      (v) => rotacionar(v, ORIGEM, anguloGraus),
    ),
    ...anotacoesTransformadas(molde, (p) => rotacionar(p, pivo, anguloGraus)),
    // O texto com ângulo (o "Pique texto") gira com a peça.
    ...(molde.textos
      ? { textos: molde.textos.map((t) => textoComAngulo({ ...t, posicao: rotacionar(t.posicao, pivo, anguloGraus) }, (graus) => normalizarAnguloDoFormato(graus + anguloGraus))) }
      : {}),
  };
}

/**
 * Espelha um molde inteiro horizontalmente (imagem de espelho) em torno do
 * centro do seu retângulo envolvente. Assim como `rotacionarMolde`, é pura
 * geometria — NÃO verifica `restricaoDeRotacao.permiteEspelhamento`; quem
 * chama deve checar antes (regra crítica da seção 5, nunca ignorada).
 */
export function espelharMolde(molde: Molde, novoId: string): Molde {
  const centro = retanguloEnvolvente(molde.contorno);
  const centroX = (centro.minX + centro.maxX) / 2;
  return {
    ...molde,
    id: novoId,
    contorno: espelharContornoHorizontal(molde.contorno, centroX),
    linhasInternas: molde.linhasInternas.map((l) => espelharContornoHorizontal(l, centroX)),
    furos: molde.furos.map((f) => espelharContornoHorizontal(f, centroX)),
    piques: molde.piques.map((p) => piqueNoEspelho(piqueLevado(p, (q) => espelharHorizontal(q, centroX)))),
    // O espelho troca o x de sinal: é uma reta em pé no mundo, a 90° do eixo x.
    marcas: molde.marcas.map((m) => marcaNoEspelho({ ...m, posicao: espelharHorizontal(m.posicao, centroX) }, 90)),
    linhaDeFio: {
      inicio: espelharHorizontal(molde.linhaDeFio.inicio, centroX),
      fim: espelharHorizontal(molde.linhaDeFio.fim, centroX),
    },
    ...cotasTransformadas(
      molde,
      (p) => espelharHorizontal(p, centroX),
      (v) => ({ x: -v.x, y: v.y }),
    ),
    ...graduacaoTransformada(
      molde,
      (p) => espelharHorizontal(p, centroX),
      (v) => ({ x: -v.x, y: v.y }),
    ),
    ...anotacoesTransformadas(molde, (p) => espelharHorizontal(p, centroX)),
    // Na peça espelhada, o ângulo do texto troca de sinal (as letras não são espelhadas).
    ...(molde.textos
      ? { textos: molde.textos.map((t) => textoComAngulo({ ...t, posicao: espelharHorizontal(t.posicao, centroX) }, (graus) => (graus === 0 ? 0 : 0 - graus))) }
      : {}),
  };
}

/**
 * Ferramentas de edição de forma (aba "Manipulação"): edição de vértices e
 * transformações manuais de uma peça já desenhada. Curvas e arcos entram
 * como pontos do contorno (ADR 0037), e a graduação de tamanhos fica em
 * `graduacao.ts` (ADR 0040).
 *
 * Nota sobre piques nas funções de edição de contorno abaixo: um pique
 * (`Pique.indiceAresta`) referencia a aresta do contorno pelo índice. Editar
 * o contorno (inserir/remover/arredondar/chanfrar um vértice) muda quantas
 * arestas existem e o que cada índice significa. Quando a edição é
 * inequívoca (índice bem depois do ponto editado), o índice só é ajustado
 * (+n ou -n); quando a aresta afetada é exatamente uma das que mudou de
 * forma, o pique é descartado em vez de adivinhado — mais seguro que deixar
 * um pique silenciosamente na posição errada. Quando só se MOVEM vértices
 * (a quantidade não muda), a aresta continua a mesma e o pique acompanha
 * na mesma proporção (`reancorarPiques`).
 */

/**
 * Mantém cada pique sobre a sua aresta depois que vértices do contorno
 * mudaram de lugar (mesma quantidade de vértices, mesma ordem). O pique
 * conserva a proporção ao longo da aresta: se estava a 30 % do caminho entre
 * os vértices i e i+1, continua a 30 % entre as posições novas. Arestas cujas
 * duas pontas não se moveram ficam intocadas — sem deriva de ponto flutuante.
 */
export function reancorarPiques(piques: readonly Pique[], contornoAntigo: Contorno, contornoNovo: Contorno): readonly Pique[] {
  if (contornoAntigo === contornoNovo || contornoAntigo.length !== contornoNovo.length) return piques;
  const n = contornoAntigo.length;
  // A referência da graduação de um pique é um ponto do contorno: acompanha-o quando ele muda de lugar.
  const comAReferencia = (pique: Pique): Pique => {
    const referencia = pique.graduacao?.referencia;
    if (!referencia) return pique;
    const r = contornoAntigo.findIndex((v) => Math.abs(v.x - referencia.x) <= 1e-9 && Math.abs(v.y - referencia.y) <= 1e-9);
    const nova = r >= 0 ? contornoNovo[r]! : referencia;
    return nova.x === referencia.x && nova.y === referencia.y ? pique : { ...pique, graduacao: { ...pique.graduacao!, referencia: nova } };
  };
  return piques.map((original) => {
    const pique = comAReferencia(original);
    const i = pique.indiceAresta;
    const j = (i + 1) % n;
    const a = contornoAntigo[i];
    const b = contornoAntigo[j];
    const novoA = contornoNovo[i];
    const novoB = contornoNovo[j];
    if (!a || !b || !novoA || !novoB) return pique;
    if (a.x === novoA.x && a.y === novoA.y && b.x === novoB.x && b.y === novoB.y) return pique;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const comprimentoQuadrado = dx * dx + dy * dy;
    const t =
      comprimentoQuadrado === 0
        ? 0
        : Math.max(0, Math.min(1, ((pique.posicao.x - a.x) * dx + (pique.posicao.y - a.y) * dy) / comprimentoQuadrado));
    return { ...pique, posicao: { x: novoA.x + (novoB.x - novoA.x) * t, y: novoA.y + (novoB.y - novoA.y) * t } };
  });
}

/** Move o vértice `indice` do contorno. Furos/linhas internas/fio não mudam; piques das duas arestas vizinhas acompanham (`reancorarPiques`). */
export function moverPontoDoMolde(molde: Molde, indice: number, novaPosicao: Ponto2D): Molde {
  const contorno = moverPontoDoContorno(molde.contorno, indice, novaPosicao);
  return comAsCurvasAcompanhando(molde, {
    ...molde,
    contorno,
    piques: reancorarPiques(molde.piques, molde.contorno, contorno),
    ...acompanhandoOsPontos(molde, contorno),
  });
}

/**
 * Move vários vértices do contorno juntos, pelo mesmo deslocamento — a
 * seleção múltipla de vértices da ferramenta "Mover ponto" (Shift+clique ou
 * retângulo de seleção). Não confundir com a Cerca (`domain/cerca.ts`), que
 * delimita uma área e move tudo o que estiver dentro dela, de várias peças.
 */
export function moverVariosPontosDoMolde(molde: Molde, indices: readonly number[], delta: Ponto2D): Molde {
  const indicesSet = new Set(indices);
  const contorno = molde.contorno.map((p, i) => (indicesSet.has(i) ? somar(p, delta) : p));
  return comAsCurvasAcompanhando(molde, {
    ...molde,
    contorno,
    piques: reancorarPiques(molde.piques, molde.contorno, contorno),
    ...acompanhandoOsPontos(molde, contorno),
  });
}

/** Abaixo disso (mm²) o contorno conta como sem área — a mesma tolerância da Cerca. */
const AREA_MINIMA_DO_CONTORNO_MM2 = 1e-6;
/** Tolerância (mm) das medidas ao longo de uma aresta: abaixo disso é zero. */
const TOLERANCIA_NA_ARESTA_MM = 1e-6;

function exigirContornoComArea(molde: Molde, comOQue: string): Molde {
  if (!(area(molde.contorno) > AREA_MINIMA_DO_CONTORNO_MM2)) {
    throw new Error(`O contorno da peça "${molde.nome}" ficaria sem área ${comOQue}.`);
  }
  return molde;
}

/**
 * "Modificar" pela janela de coordenadas: desloca os vértices `indices` por
 * `delta`, como `moverVariosPontosDoMolde` (só eles andam; os vizinhos ficam
 * no lugar), mas recusa com erro a medida que deixaria o contorno sem área —
 * digitando não há a prévia do arrasto para mostrar o problema antes.
 */
export function modificarPontosDoMolde(molde: Molde, indices: readonly number[], delta: Ponto2D): Molde {
  if (indices.length === 0) throw new Error('Indique pelo menos um ponto do contorno.');
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= molde.contorno.length)) {
    throw new Error('Ponto fora do contorno da peça.');
  }
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw new Error('Deslocamento inválido.');
  return exigirContornoComArea(moverVariosPontosDoMolde(molde, indices, delta), 'com esse deslocamento');
}

/**
 * Qual ponta anda no "Redefinir perímetro": a do início da aresta (o vértice
 * i), a do fim (i+1) — uni-direcional — ou as duas, bi-direcional.
 */
export type PontaDaAresta = 'inicio' | 'fim' | 'ambas';

/**
 * "Redefinir perímetro" de uma aresta reta: a aresta `indiceAresta` (do
 * vértice i ao i+1) passa a medir `novoComprimentoMm`, sem mudar de direção.
 * Uni-direcional ('inicio' ou 'fim'): só aquela ponta anda, a outra fica no
 * lugar. Bi-direcional ('ambas'): cada ponta anda metade da diferença e o
 * meio da aresta fica no lugar. As arestas vizinhas dividem o vértice que
 * andou e mudam junto, com os piques delas na mesma proporção
 * (`reancorarPiques`).
 *
 * Os piques da própria aresta não andam: a reta dela continua a mesma, só as
 * pontas mudam, então um pique marcado a 30 mm do ponto parado continua a
 * 30 mm dele. Se a aresta encolher a ponto de deixar um pique para fora, a
 * medida é recusada — mais seguro que mover ou apagar o pique sem avisar.
 * Também é recusada medida não positiva, aresta sem comprimento (não há
 * direção) e contorno que ficaria sem área.
 */
export function redefinirComprimentoDaAresta(
  molde: Molde,
  indiceAresta: number,
  novoComprimentoMm: number,
  ponta: PontaDaAresta,
): Molde {
  const n = molde.contorno.length;
  if (!Number.isInteger(indiceAresta) || indiceAresta < 0 || indiceAresta >= n) {
    throw new Error('Aresta fora do contorno da peça.');
  }
  if (!Number.isFinite(novoComprimentoMm) || novoComprimentoMm <= 0) {
    throw new Error('O novo comprimento precisa ser maior que zero.');
  }
  const indiceDoFim = (indiceAresta + 1) % n;
  const a = molde.contorno[indiceAresta]!;
  const b = molde.contorno[indiceDoFim]!;
  const comprimentoAtual = distancia(a, b);
  if (comprimentoAtual <= TOLERANCIA_NA_ARESTA_MM) {
    throw new Error('Essa aresta não tem comprimento, então não tem direção para crescer ou encolher.');
  }
  const direcao = { x: (b.x - a.x) / comprimentoAtual, y: (b.y - a.y) / comprimentoAtual };
  const aoLongo = (origem: Ponto2D, mm: number): Ponto2D => ({ x: origem.x + direcao.x * mm, y: origem.y + direcao.y * mm });
  const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const novoInicio =
    ponta === 'fim' ? a : ponta === 'inicio' ? aoLongo(b, -novoComprimentoMm) : aoLongo(meio, -novoComprimentoMm / 2);
  const novoFim = ponta === 'inicio' ? b : ponta === 'fim' ? aoLongo(a, novoComprimentoMm) : aoLongo(meio, novoComprimentoMm / 2);
  const contorno = molde.contorno.map((p, i) => (i === indiceAresta ? novoInicio : i === indiceDoFim ? novoFim : p));

  const reancorados = reancorarPiques(molde.piques, molde.contorno, contorno);
  const piques = molde.piques.map((pique, k) => {
    if (pique.indiceAresta !== indiceAresta) return reancorados[k]!;
    const posicaoNaAresta =
      (pique.posicao.x - novoInicio.x) * direcao.x + (pique.posicao.y - novoInicio.y) * direcao.y;
    if (posicaoNaAresta < -TOLERANCIA_NA_ARESTA_MM || posicaoNaAresta > novoComprimentoMm + TOLERANCIA_NA_ARESTA_MM) {
      throw new Error(
        'Um pique dessa aresta ficaria fora dela com esse comprimento. Exclua o pique antes, ou use um comprimento maior.',
      );
    }
    return pique;
  });
  return exigirContornoComArea(
    comAsCurvasAcompanhando(molde, { ...molde, contorno, piques, ...acompanhandoOsPontos(molde, contorno) }),
    'com esse comprimento',
  );
}

/** Insere um novo vértice na aresta `indiceAresta` (entre esse vértice e o próximo). */
export function inserirPontoNoMolde(molde: Molde, indiceAresta: number, novoPonto: Ponto2D): Molde {
  return {
    ...molde,
    contorno: inserirPontoNoContorno(molde.contorno, indiceAresta, novoPonto),
    piques: molde.piques.map((p) => (p.indiceAresta > indiceAresta ? { ...p, indiceAresta: p.indiceAresta + 1 } : p)),
  };
}

/** Remove o vértice `indice`. Lança erro se o contorno ficaria com menos de 3 pontos. */
export function removerPontoDoMolde(molde: Molde, indice: number): Molde {
  if (molde.contorno.length <= 3) {
    throw new Error('O contorno precisa de ao menos 3 pontos — não é possível remover mais vértices.');
  }
  const arestaAnterior = (indice - 1 + molde.contorno.length) % molde.contorno.length;
  return {
    ...molde,
    contorno: removerPontoDoContorno(molde.contorno, indice),
    piques: molde.piques
      .filter((p) => p.indiceAresta !== indice && p.indiceAresta !== arestaAnterior)
      .map((p) => (p.indiceAresta > indice ? { ...p, indiceAresta: p.indiceAresta - 1 } : p)),
  };
}

/** Corta o canto vivo do vértice `indice` (chanfro reto de `distanciaMm`). */
export function chanfrarCantoDoMolde(molde: Molde, indice: number, distanciaMm: number): Molde {
  const arestaAnterior = (indice - 1 + molde.contorno.length) % molde.contorno.length;
  return {
    ...molde,
    contorno: chanfrarCantoDoContorno(molde.contorno, indice, distanciaMm),
    piques: molde.piques
      .filter((p) => p.indiceAresta !== indice && p.indiceAresta !== arestaAnterior)
      .map((p) => (p.indiceAresta > indice ? { ...p, indiceAresta: p.indiceAresta + 1 } : p)),
  };
}

/**
 * Arredonda o canto do vértice `indice` (arco tesselado de raio `raioMm`).
 * Com `idDoArco`, o arco fica registrado na peça, com o ponto do meio dele
 * como ponto de passagem.
 */
export function arredondarCantoDoMolde(molde: Molde, indice: number, raioMm: number, idDoArco?: string): Molde {
  const arestaAnterior = (indice - 1 + molde.contorno.length) % molde.contorno.length;
  const contornoAntes = molde.contorno.length;
  const novoContorno = arredondarCantoDoContorno(molde.contorno, indice, raioMm);
  const delta = novoContorno.length - contornoAntes;
  // O canto deu lugar aos pontos do arco, de um ponto de tangência ao outro.
  const arco = delta > 0 ? novoContorno.slice(indice, indice + delta + 1) : [];
  return {
    ...molde,
    contorno: novoContorno,
    piques: molde.piques
      .filter((p) => p.indiceAresta !== indice && p.indiceAresta !== arestaAnterior)
      .map((p) => (p.indiceAresta > indice ? { ...p, indiceAresta: p.indiceAresta + delta } : p)),
    ...(idDoArco !== undefined && arco.length >= 3 ? { curvas: [...(molde.curvas ?? []), arcoRegistrado(idDoArco, arco)] } : {}),
  };
}

/** O registro de um arco de círculo já amostrado: as pontas e o ponto do meio dele como ponto de passagem. */
export function arcoRegistrado(id: string, pontos: readonly Ponto2D[]): CurvaDaPeca {
  return { id, tipo: 'arco', controles: [pontos[0]!, pontos[Math.floor(pontos.length / 2)]!, pontos.at(-1)!], pontos };
}

/**
 * Escala a peça por `fatorX`/`fatorY` (independentes), mantendo o canto
 * superior esquerdo do retângulo envolvente fixo — mesma referência visual
 * do "Dimensionar" da referência (DX/DY mostram o novo tamanho resultante).
 */
export function dimensionarMolde(molde: Molde, fatorX: number, fatorY: number): Molde {
  if (!Number.isFinite(fatorX) || fatorX <= 0 || !Number.isFinite(fatorY) || fatorY <= 0) {
    throw new Error('Fatores de dimensionamento precisam ser maiores que zero.');
  }
  const bbox = retanguloEnvolvente(molde.contorno);
  const origem = { x: bbox.minX, y: bbox.minY };
  return {
    ...molde,
    contorno: escalarContorno(molde.contorno, origem, fatorX, fatorY),
    linhasInternas: molde.linhasInternas.map((l) => escalarContorno(l, origem, fatorX, fatorY)),
    furos: molde.furos.map((f) => escalarContorno(f, origem, fatorX, fatorY)),
    piques: molde.piques.map((p) => piqueLevado(p, (q) => escalarPonto(q, origem, fatorX, fatorY))),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: escalarPonto(m.posicao, origem, fatorX, fatorY) })),
    linhaDeFio: {
      inicio: escalarPonto(molde.linhaDeFio.inicio, origem, fatorX, fatorY),
      fim: escalarPonto(molde.linhaDeFio.fim, origem, fatorX, fatorY),
    },
    ...cotasTransformadas(
      molde,
      (p) => escalarPonto(p, origem, fatorX, fatorY),
      (v) => ({ x: v.x * fatorX, y: v.y * fatorY }),
    ),
    ...graduacaoTransformada(
      molde,
      (p) => escalarPonto(p, origem, fatorX, fatorY),
      (v) => ({ x: v.x * fatorX, y: v.y * fatorY }),
    ),
    ...anotacoesTransformadas(molde, (p) => escalarPonto(p, origem, fatorX, fatorY)),
    ...circuloDimensionado(molde, origem, fatorX, fatorY),
  };
}

/**
 * O registro do círculo depois do "Dimensionar" por igual nos dois sentidos:
 * ele continua sendo um círculo, com o raio novo e os lados que o contorno
 * tem. Com fatores diferentes vira uma elipse, e a espiral não é a mesma
 * espiral com outras medidas (o vão entre as voltas é fixo): nesses casos
 * nada sai daqui, e o registro deixa de valer.
 */
function circuloDimensionado(molde: Molde, origem: Ponto2D, fatorX: number, fatorY: number): { readonly figura?: FiguraDaPeca } {
  const figura = molde.figura;
  if (!figura || figura.tipo !== 'circulo' || Math.abs(fatorX - fatorY) > 1e-12) return {};
  const centro = escalarPonto(figura.centro, origem, fatorX, fatorY);
  // Os pontos dos eixos guardam só a direção: vão com o centro, sem esticar.
  const comOCentro = (p: Ponto2D): Ponto2D => ({ x: centro.x + (p.x - figura.centro.x), y: centro.y + (p.y - figura.centro.y) });
  return { figura: { tipo: 'circulo', raioMm: figura.raioMm * fatorX, lados: molde.contorno.length, centro, eixoX: comOCentro(figura.eixoX), eixoY: comOCentro(figura.eixoY) } };
}

/** Um pique a menos disso (mm) do contorno novo continua sendo um pique dele. */
const TOLERANCIA_DE_PIQUE_NO_CONTORNO_MM = 1e-6;

/**
 * Os piques que continuam sobre o contorno depois de um trecho dele ser
 * trocado: os das arestas que não mudaram ficam (com o índice de aresta
 * acertado), e os do trecho trocado saem — a mesma regra das outras edições
 * de forma: melhor perder um pique do que deixá-lo num lugar adivinhado.
 */
export function piquesQueFicamNoContorno(piques: readonly Pique[], contorno: Contorno): readonly Pique[] {
  return piques.flatMap((pique) => {
    const maisProximo = pontoMaisProximoNoContorno(pique.posicao, contorno);
    return maisProximo.distancia <= TOLERANCIA_DE_PIQUE_NO_CONTORNO_MM
      ? [{ ...pique, posicao: maisProximo.ponto, indiceAresta: maisProximo.indiceAresta }]
      : [];
  });
}

/**
 * Troca um trecho do contorno — o mais curto dos dois caminhos entre `a` e
 * `b` — por um caminho novo, dado de `a` para `b` sem os extremos
 * (`miolo`). É a base das curvas e dos arcos: uma curva é um miolo de pontos
 * próximos. Recusa a troca que deixaria o contorno sem área.
 */
export function substituirTrechoDoMolde(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  miolo: readonly Ponto2D[],
): Molde {
  const { de, ate, invertido } = trechoMaisCurto(molde.contorno, a, b);
  const contorno = substituirTrechoDoContorno(molde.contorno, de, ate, invertido ? [...miolo].reverse() : miolo);
  if (contorno.length < 3) throw new Error(`O contorno da peça "${molde.nome}" ficaria sem área com essa mudança.`);
  return exigirContornoComArea(
    { ...molde, contorno, piques: piquesQueFicamNoContorno(molde.piques, contorno) },
    'com essa mudança',
  );
}

/** Abaixo disso (mm) os dois pontos da linha de fio contam como um só, e a seta não tem direção. */
const COMPRIMENTO_MINIMO_DO_FIO_MM = 1e-6;

/**
 * "Sentido do fio": troca a linha de fio da peça pela seta de `inicio` a
 * `fim`. Só a linha muda: a peça não gira, e as rotações permitidas
 * (`restricaoDeRotacao`) continuam contadas a partir da posição atual dela.
 */
export function redefinirLinhaDeFio(molde: Molde, inicio: Ponto2D, fim: Ponto2D): Molde {
  if (![inicio.x, inicio.y, fim.x, fim.y].every(Number.isFinite)) {
    throw new Error('Linha de fio inválida.');
  }
  if (distancia(inicio, fim) < COMPRIMENTO_MINIMO_DO_FIO_MM) {
    throw new Error('A linha de fio precisa de dois pontos diferentes: o início e o fim da seta.');
  }
  return { ...molde, linhaDeFio: { inicio, fim } };
}

/** "Costura": define a margem de costura da peça inteira (0 remove a costura). */
export function definirMargemDeCostura(molde: Molde, margemMm: number): Molde {
  if (!Number.isFinite(margemMm) || margemMm < 0) {
    throw new Error('A margem de costura precisa ser um número maior ou igual a zero.');
  }
  return { ...molde, margemDeCosturaMm: margemMm };
}

/**
 * "Restaurar": a peça volta à forma guardada no ponto de restauração —
 * contorno, furos, linhas internas, piques, marcas, linha de fio, margem de
 * costura e giro, no lugar em que estavam. O que identifica a peça (nome,
 * referência, tamanho, quantidade e rotações permitidas) fica como está hoje.
 */
export function restaurarFormaDoMolde(atual: Molde, pontoDeRestauracao: Molde): Molde {
  return {
    ...pontoDeRestauracao,
    id: atual.id,
    nome: atual.nome,
    referencia: atual.referencia,
    tamanho: atual.tamanho,
    quantidade: atual.quantidade,
    restricaoDeRotacao: atual.restricaoDeRotacao,
    ...(atual.cotas ? { cotas: atual.cotas } : {}),
  };
}

/**
 * "Converter em contorno": a linha de corte (o contorno afastado pela margem
 * de costura) passa a ser o contorno da peça, e a margem volta a zero. É o
 * caminho inverso de dar costura a um contorno. Cada pique vai para o ponto
 * mais próximo do contorno novo.
 */
export function converterCosturaEmContorno(molde: Molde): Molde {
  if (!(molde.margemDeCosturaMm > 0)) {
    throw new Error(`A peça "${molde.nome}" não tem costura para converter em contorno.`);
  }
  const contorno = contornoDeCorte(molde);
  return {
    ...molde,
    contorno,
    margemDeCosturaMm: 0,
    piques: molde.piques.map((p) => {
      const maisProximo = pontoMaisProximoNoContorno(p.posicao, contorno);
      return { ...p, posicao: maisProximo.ponto, indiceAresta: maisProximo.indiceAresta };
    }),
  };
}

export interface DimensoesDoMolde {
  readonly larguraMm: number;
  readonly alturaMm: number;
  readonly areaMm2: number;
}

export function dimensoesDoMolde(molde: Molde): DimensoesDoMolde {
  const bbox = retanguloEnvolvente(molde.contorno);
  return { larguraMm: bbox.largura, alturaMm: bbox.altura, areaMm2: area(molde.contorno) };
}

/** Ângulo da seta do fio em graus, 0° = apontando para +x (direita), sentido anti-horário positivo. */
export function anguloDaLinhaDeFio(fio: LinhaDeFio): number {
  const dx = fio.fim.x - fio.inicio.x;
  const dy = fio.fim.y - fio.inicio.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function normalizarAngulo(anguloGraus: number): number {
  const normalizado = anguloGraus % 360;
  return normalizado < 0 ? normalizado + 360 : normalizado;
}

/** Lista as rotações (em graus, relativas à orientação original) que a restrição do molde permite. */
export function rotacoesPermitidas(restricao: RestricaoDeRotacao): readonly number[] {
  const permitidas = [0];
  if (restricao.permite180) permitidas.push(180);
  if (restricao.permite90e270) permitidas.push(90, 270);
  return permitidas.sort((a, b) => a - b);
}

/** Verdadeiro se `anguloGraus` (rotação proposta, qualquer valor) corresponde a uma das rotações permitidas. */
export function rotacaoEhPermitida(restricao: RestricaoDeRotacao, anguloGraus: number): boolean {
  const alvo = normalizarAngulo(anguloGraus);
  return rotacoesPermitidas(restricao).some((permitida) => Math.abs(permitida - alvo) < 1e-6);
}
