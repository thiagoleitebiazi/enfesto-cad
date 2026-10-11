import { area, type Ponto2D } from '../core/geometria';
import { transladarMolde, type Molde } from '../domain/molde';

/**
 * O registro da peça no PDF: a peça inteira, como está no projeto, escrita
 * na página dela.
 *
 * O desenho da folha não diz tudo: não diz o formato dos piques, os textos
 * com ângulo, as linhas só de construção (que nem são desenhadas), a
 * graduação, a cor, a linha de simetria, as rotações permitidas, nem os
 * registros de pence, curva, prega e cunha. Com o registro, a importação
 * devolve a peça como era.
 *
 * Vai como um comentário do PDF: quem abre ou imprime o arquivo não vê nada,
 * e o desenho continua o mesmo. As posições são as da página (em mm, contadas
 * do mesmo canto que o desenho), para a importação conferir uma coisa com a
 * outra.
 *
 * Quem lê o registro trata-o como dado vindo de fora: cada campo é conferido
 * contra o que uma peça pode ter, o que não é campo de peça fica de fora, e,
 * se alguma coisa não serve, nada dele é aproveitado — a peça volta, então,
 * só pelo desenho.
 */

/** O começo da linha do registro. O número é a versão do que vem depois dele, separado por um espaço. */
const INICIO = '% enfesto-cad:peca:2';
/** O registro maior que isto (em caracteres) não é lido. */
const TAMANHO_MAXIMO = 8_000_000;
/** Quantos itens uma lista do registro pode ter. */
const MAXIMO_DE_ITENS = 20_000;
/** O texto mais comprido que um campo do registro pode ter. */
const TEXTO_MAXIMO = 2_000;

/** A linha do registro da peça, para escrever na página dela: a peça levada para as posições da página. */
export function registroDaPeca(peca: Molde, origem: Ponto2D): string {
  const naPagina = transladarMolde(peca, { x: 0 - origem.x, y: 0 - origem.y }, peca.id);
  // Só letras e números na linha: o que não é ASCII vai como \uXXXX, e o texto todo em base64.
  const json = JSON.stringify(naPagina).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return `${INICIO} ${btoa(json)}`;
}

// ---------------------------------------------------------------------------
// A leitura: tudo conferido, como dado vindo de fora
// ---------------------------------------------------------------------------

/** Lê um valor do registro: devolve-o conferido (só com o que é esperado), ou `undefined` se não serve. */
type Leitor = (valor: unknown) => unknown;

const numero: Leitor = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const positivo: Leitor = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
const naoNegativo: Leitor = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const indice: Leitor = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);
const logico: Leitor = (v) => (typeof v === 'boolean' ? v : undefined);
const texto: Leitor = (v) => (typeof v === 'string' && v.length <= TEXTO_MAXIMO ? v : undefined);
const textoPreenchido: Leitor = (v) => (typeof v === 'string' && v !== '' && v.length <= TEXTO_MAXIMO ? v : undefined);

/** Um dos valores dados, e só eles. */
function um(...valores: readonly (string | number | boolean)[]): Leitor {
  return (v) => (valores.some((valor) => valor === v) ? v : undefined);
}

/** Uma lista de itens lidos por `item`, com pelo menos `minimo` deles. */
function lista(item: Leitor, minimo = 0): Leitor {
  return (v) => {
    if (!Array.isArray(v) || v.length < minimo || v.length > MAXIMO_DE_ITENS) return undefined;
    const lidos = v.map(item);
    return lidos.some((lido) => lido === undefined) ? undefined : lidos;
  };
}

/** Exatamente dois itens. */
function par(item: Leitor): Leitor {
  const dois = lista(item, 2);
  return (v) => (Array.isArray(v) && v.length === 2 ? dois(v) : undefined);
}

/** Um objeto com os campos obrigatórios e, se vierem, os opcionais. O que não é campo dele fica de fora. */
function objeto(obrigatorios: Readonly<Record<string, Leitor>>, opcionais: Readonly<Record<string, Leitor>> = {}): Leitor {
  return (v) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
    const bruto = v as Record<string, unknown>;
    const lido: Record<string, unknown> = {};
    for (const [campo, ler] of Object.entries(obrigatorios)) {
      const valor = ler(bruto[campo]);
      if (valor === undefined) return undefined;
      lido[campo] = valor;
    }
    for (const [campo, ler] of Object.entries(opcionais)) {
      if (bruto[campo] === undefined) continue;
      const valor = ler(bruto[campo]);
      if (valor === undefined) return undefined;
      lido[campo] = valor;
    }
    return lido;
  };
}

/** O primeiro dos leitores que aceita o valor. */
function umDe(...leitores: readonly Leitor[]): Leitor {
  return (v) => {
    for (const ler of leitores) {
      const lido = ler(v);
      if (lido !== undefined) return lido;
    }
    return undefined;
  };
}

const pt = objeto({ x: numero, y: numero });
const linha = lista(pt, 1);
const fechado = lista(pt, 3);

const formato = objeto(
  { tipo: textoPreenchido, larguraMm: positivo, alturaMm: positivo, anguloGraus: numero },
  { forma: lista(lista(pt, 2), 1), nome: texto, espelhado: um(true) },
);
const pique = objeto(
  { id: textoPreenchido, posicao: pt, indiceAresta: indice },
  { formato, naCostura: um('projetado', 'estendido'), codigo: texto, graduacao: objeto({ referencia: pt, perimetros: lista(numero) }) },
);
const marca = objeto({ id: textoPreenchido, posicao: pt }, { rotulo: texto, formato, alinhamento: objeto({ deslocamentos: lista(pt) }) });
const textoDaPeca = objeto({ id: textoPreenchido, posicao: pt, texto: textoPreenchido, alturaMm: positivo }, { anguloGraus: numero, ancora: um('inicio', 'fim') });
const cota = umDe(
  objeto({ id: textoPreenchido, tipo: um('linear'), de: pt, ate: pt, direcao: pt, posicao: pt }),
  objeto({ id: textoPreenchido, tipo: um('angulo'), de: pt, vertice: pt, ate: pt, raioMm: numero }),
  objeto({ id: textoPreenchido, tipo: um('perimetro'), posicao: pt }),
  objeto({ id: textoPreenchido, tipo: um('raio'), centro: pt, noArco: pt }),
);
const graduacao = objeto({ tamanhos: lista(texto, 1), base: indice, pontos: lista(objeto({ posicao: pt, deslocamentos: lista(pt) })) });
const curva = objeto(
  { id: textoPreenchido, tipo: um('curva', 'arco', 'forma'), controles: lista(pt), pontos: lista(pt) },
  { forma: objeto({ pontos: lista(pt), espelhar: logico }), tangentes: objeto({}, { inicio: pt, fim: pt }) },
);
const figura = umDe(
  objeto({ centro: pt, eixoX: pt, eixoY: pt, tipo: um('circulo'), raioMm: numero }, { lados: numero }),
  objeto({ centro: pt, eixoX: pt, eixoY: pt, tipo: um('espiral'), larguraMm: numero, perimetroMm: numero }),
);
const pence = objeto(
  { id: textoPreenchido, tipo: um('recortada', 'marcada', 'interna'), pontos: lista(pt) },
  { removidos: lista(pt), pontasCriadas: par(logico), piques: lista(texto), marcas: lista(texto), comEixo: logico, pivo: pt, bico: pt, dobra: um(0, 2), capa: lista(pt) },
);
const prega = objeto(
  { id: textoPreenchido, modo: um('simples-direita', 'simples-esquerda', 'dupla'), parada: par(pt), movida: par(pt), linhas: lista(linha), pontasCriadas: par(logico) },
  { linhasTiradas: lista(linha), piques: lista(texto) },
);
const cunha = objeto(
  { id: textoPreenchido, travessias: lista(objeto({ parada: pt, movida: pt, criada: logico })), posicao: numero, pivo: numero, linhas: lista(linha) },
  { piques: lista(texto), comeco: pt },
);
const metadeGuardada = objeto({ de: pt, ate: pt, contorno: fechado, furos: lista(fechado), linhasInternas: lista(linha), marcas: lista(marca), piques: lista(pique) });

const molde = objeto(
  {
    id: textoPreenchido,
    nome: texto,
    referencia: texto,
    tamanho: texto,
    contorno: fechado,
    linhasInternas: lista(linha),
    furos: lista(fechado),
    piques: lista(pique),
    marcas: lista(marca),
    margemDeCosturaMm: naoNegativo,
    linhaDeFio: objeto({ inicio: pt, fim: pt }),
    quantidade: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : undefined),
    restricaoDeRotacao: objeto({ permite180: logico, permite90e270: logico }, { permiteEspelhamento: logico }),
    anguloDeRotacaoGraus: numero,
  },
  {
    cotas: lista(cota),
    graduacao,
    textos: lista(textoDaPeca),
    cor: texto,
    linhaDeSimetria: objeto({ de: pt, ate: pt }),
    dobraMantida: metadeGuardada,
    pences: lista(pence),
    curvas: lista(curva),
    pregas: lista(prega),
    cunhas: lista(cunha),
    elementos: lista(linha),
    figura,
  },
);

/** A peça lida do valor bruto, ou `null` se ele não é uma peça que sirva. */
function pecaLida(bruto: unknown): Molde | null {
  const lida = molde(bruto) as Molde | undefined;
  if (!lida) return null;
  // O que o formato dos campos não pega: o contorno sem área, e o tamanho base que não está na lista.
  if (!(area(lida.contorno) > 0)) return null;
  if (lida.graduacao && lida.graduacao.base >= lida.graduacao.tamanhos.length) return null;
  return lida;
}

/**
 * A peça escrita no registro da página (a stream dela, como texto), `null` se
 * a página não tem registro, ou `'ilegivel'` se tem e ele não serve — está
 * cortado, não é o que este programa escreve, ou tem algum campo fora do
 * esperado. Nesse caso nada dele é aproveitado.
 */
export function lerRegistroDaPagina(streamDaPagina: string): Molde | 'ilegivel' | null {
  const doRegistro = streamDaPagina.split('\n').find((l) => l.trim().startsWith(INICIO));
  if (doRegistro === undefined) return null;
  const emBase64 = doRegistro.trim().slice(INICIO.length).trim();
  if (emBase64.length > TAMANHO_MAXIMO) return 'ilegivel';
  let bruto: unknown;
  try {
    bruto = JSON.parse(atob(emBase64));
  } catch {
    return 'ilegivel';
  }
  return pecaLida(bruto) ?? 'ilegivel';
}
