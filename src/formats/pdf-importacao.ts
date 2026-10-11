import type { Contorno, Ponto2D } from '../core/geometria';
import { distancia, ponto, retanguloEnvolvente, pontoMaisProximoNoContorno } from '../core/geometria';
import { criarMolde, type LinhaDeFio, type Molde } from '../domain/molde';
import { PONTOS_POR_MM } from './pdf-exportacao';
import { lerRegistroDaPagina } from './pdf-registro';

/**
 * Importação de PDF (pedido do usuário: "extrair peças vetoriais de um PDF
 * exportado por este app"). Não é um leitor de PDF genérico — é um parser
 * escrito à mão para o formato EXATO que `formats/pdf-exportacao.ts` produz
 * (mesmo espírito do importador de DXF: hand-rolled para um formato
 * conhecido, não uma biblioteca genérica pesada). `compress:false` é
 * deliberado na exportação exatamente para isto: o stream de conteúdo fica
 * em texto puro, sem precisar descomprimir nada.
 *
 * Reconhece cada elemento pela cor + traço/preenchimento EXATOS que
 * `desenharPeca` usa (contorno em '#f4f5f7'/preto, linha de fio em
 * '#c62828', piques em '#8e24aa', marcas em '#00838f', linha de corte
 * tracejada em cinza '#555555', linhas internas tracejadas em preto) — só
 * funciona para PDFs gerados por este app; um PDF de outro programa não vai
 * ter essas cores/traços exatos e vai simplesmente não encontrar peças
 * (com aviso claro, nunca um resultado incorreto silencioso).
 *
 * A peça maior que uma folha sai em várias páginas, e cada uma traz o
 * desenho inteiro dela (a folha só mostra um pedaço, pelo recorte): a
 * primeira página basta para trazê-la de volta.
 *
 * Além do desenho, a página da peça traz o registro dela (ver
 * `pdf-registro.ts`): a peça inteira, com o que o desenho não diz. Quando
 * ele confere com o desenho, é a peça do registro que volta.
 */

const TOLERANCIA_COR = 0.01;

function coresIguais(a: readonly [number, number, number], b: readonly [number, number, number]): boolean {
  return Math.abs(a[0] - b[0]) < TOLERANCIA_COR && Math.abs(a[1] - b[1]) < TOLERANCIA_COR && Math.abs(a[2] - b[2]) < TOLERANCIA_COR;
}

const COR_CONTORNO_FILL: [number, number, number] = [0.9568627450980393, 0.9607843137254902, 0.9686274509803922];
const COR_PRETO: [number, number, number] = [0, 0, 0];
const COR_FIO: [number, number, number] = [0.7764705882352941, 0.1568627450980392, 0.1568627450980392];
const COR_PIQUE: [number, number, number] = [0.5568627450980392, 0.1411764705882353, 0.6666666666666666];
const COR_MARCA: [number, number, number] = [0, 0.5137254901960784, 0.5607843137254902];
const COR_LINHA_DE_CORTE: [number, number, number] = [0.3333333333333333, 0.3333333333333333, 0.3333333333333333];

const DASH_LINHA_INTERNA = mmParaPontosArredondado(1.5);
const DASH_LINHA_DE_CORTE = mmParaPontosArredondado(3);

function mmParaPontosArredondado(mm: number): number {
  return mm * PONTOS_POR_MM;
}

function tolerancia(a: number, b: number, margem = 0.05): boolean {
  return Math.abs(a - b) < margem;
}

function pontosParaMm(pontosPdf: readonly Ponto2D[]): Ponto2D[] {
  return pontosPdf.map((p) => ponto(p.x / PONTOS_POR_MM, p.y / PONTOS_POR_MM));
}

interface ElementoBruto {
  readonly tipo: 'contorno-e-furos' | 'linha-interna' | 'linha-de-corte' | 'fio' | 'pique' | 'marca';
  readonly subpaths: Ponto2D[][];
}

/** Faz uma única varredura sequencial da stream de uma página, reconhecendo cada elemento pela cor/traço no momento em que é pintado. */
function lerElementosDaPagina(streamDaPagina: string): ElementoBruto[] {
  const elementos: ElementoBruto[] = [];
  const linhas = streamDaPagina.split('\n');

  let subpaths: Ponto2D[][] = [];
  let atual: Ponto2D[] = [];
  let corPreenchimento: [number, number, number] | null = null;
  let corTraco: [number, number, number] | null = null;
  let dashAtual: number | null = null;

  function fecharSubpathAtual(): void {
    if (atual.length > 0) {
      subpaths.push(atual);
      atual = [];
    }
  }

  function processarPintura(comFill: boolean, comStroke: boolean): void {
    fecharSubpathAtual();
    if (subpaths.length === 0) {
      subpaths = [];
      return;
    }
    if (comFill && corPreenchimento && coresIguais(corPreenchimento, COR_CONTORNO_FILL)) {
      elementos.push({ tipo: 'contorno-e-furos', subpaths });
    } else if (comFill && corPreenchimento && coresIguais(corPreenchimento, COR_FIO)) {
      // ponta da seta do fio (triângulo preenchido) — a haste já foi capturada pelo "S"; ignorar.
    } else if (comFill && corPreenchimento && coresIguais(corPreenchimento, COR_MARCA)) {
      elementos.push({ tipo: 'marca', subpaths });
    } else if (comStroke && corTraco && coresIguais(corTraco, COR_MARCA)) {
      // O pique interno (a marca com formato) sai traçado, e não preenchido: volta como marca, no meio do desenho dele.
      elementos.push({ tipo: 'marca', subpaths });
    } else if (comStroke && corTraco && coresIguais(corTraco, COR_FIO)) {
      elementos.push({ tipo: 'fio', subpaths });
    } else if (comStroke && corTraco && coresIguais(corTraco, COR_PIQUE)) {
      elementos.push({ tipo: 'pique', subpaths });
    } else if (comStroke && corTraco && coresIguais(corTraco, COR_LINHA_DE_CORTE) && dashAtual !== null && tolerancia(dashAtual, DASH_LINHA_DE_CORTE)) {
      elementos.push({ tipo: 'linha-de-corte', subpaths });
    } else if (comStroke && corTraco && coresIguais(corTraco, COR_PRETO) && dashAtual !== null && tolerancia(dashAtual, DASH_LINHA_INTERNA)) {
      elementos.push({ tipo: 'linha-interna', subpaths });
    }
    // Qualquer outro traço preto sólido é o contorno do furo redesenhado só
    // com stroke (redundante com o que "contorno-e-furos" já capturou) —
    // ignorado de propósito, não é um elemento novo.
    subpaths = [];
  }

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trim();
    let m: RegExpMatchArray | null;

    if ((m = linha.match(/^([-\d.]+) ([-\d.]+) m$/))) {
      fecharSubpathAtual();
      atual = [ponto(Number.parseFloat(m[1]!), Number.parseFloat(m[2]!))];
    } else if ((m = linha.match(/^([-\d.]+) ([-\d.]+) l$/))) {
      atual.push(ponto(Number.parseFloat(m[1]!), Number.parseFloat(m[2]!)));
    } else if ((m = linha.match(/^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) c$/))) {
      // Curva Bézier (só usada para os círculos das marcas) — guarda só o ponto final na curva, não os de controle.
      atual.push(ponto(Number.parseFloat(m[5]!), Number.parseFloat(m[6]!)));
    } else if (linha === 'h') {
      // fecha o subpath atual — nada a fazer, o próximo "m" ou a pintura já cuidam disso.
    } else if (linha === 'B' || linha === 'b' || linha === 'B*' || linha === 'b*') {
      processarPintura(true, true);
    } else if (linha === 'f' || linha === 'F' || linha === 'f*') {
      processarPintura(true, false);
    } else if (linha === 'S' || linha === 's') {
      processarPintura(false, true);
    } else if ((m = linha.match(/^([\d.]+) ([\d.]+) ([\d.]+) scn$/))) {
      corPreenchimento = [Number.parseFloat(m[1]!), Number.parseFloat(m[2]!), Number.parseFloat(m[3]!)];
    } else if ((m = linha.match(/^([\d.]+) ([\d.]+) ([\d.]+) SCN$/))) {
      corTraco = [Number.parseFloat(m[1]!), Number.parseFloat(m[2]!), Number.parseFloat(m[3]!)];
    } else if ((m = linha.match(/^\[([\d. ]*)\] 0 d$/))) {
      const partes = m[1]!.trim();
      dashAtual = partes === '' ? null : Number.parseFloat(partes.split(' ')[0]!);
    } else if (linha === 'q') {
      // novo escopo de estado gráfico — este app sempre redefine a cor antes de pintar dentro de cada "q..Q", então não precisamos de uma pilha real.
    }
  }

  return elementos;
}

function decodificarTextoDoPdf(bytesComoLatin1: string): string {
  const grupos = [...bytesComoLatin1.matchAll(/<([0-9a-fA-F]+)>/g)].map((g) => g[1]!);
  const hex = grupos.join('');
  let resultado = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    resultado += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return resultado;
}

interface RotuloDaPagina {
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly quantidade: number;
  /** Total de páginas que esta peça ocupa (do rodapé "página N/Y") — Y > 1 significa peça ladrilhada (maior que uma folha). */
  readonly totalDePaginasDaPeca: number;
  /** Qual das páginas da peça é esta (o N do rodapé "página N/Y"). */
  readonly paginaDaPeca: number;
}

function lerRotuloDaPagina(streamDaPagina: string): RotuloDaPagina | null {
  const blocosDeTexto = [...streamDaPagina.matchAll(/BT([\s\S]*?)ET/g)].map((m) => decodificarTextoDoPdf(m[1]!));
  if (blocosDeTexto.length === 0) return null;

  // O rótulo ("nome (referência) tamanho") é escrito depois dos textos da própria peça — os códigos dos piques e os
  // textos postos nela — e é repetido no começo do rodapé da página. É, então, o bloco com esse formato com que um
  // bloco mais adiante começa; sem um assim, vale o primeiro bloco, como sempre valeu. A peça sem tamanho sai só com
  // "nome (referência)": o tamanho é a parte que pode faltar.
  const FORMATO_DO_ROTULO = /^(.*) \((.*)\) ?([^)]*)$/;
  const doRotulo = blocosDeTexto.findIndex((bloco, i) => FORMATO_DO_ROTULO.test(bloco) && blocosDeTexto.slice(i + 1).some((depois) => depois.startsWith(bloco)));
  const primeiro = blocosDeTexto[doRotulo >= 0 ? doRotulo : 0]!;
  const m = primeiro.match(FORMATO_DO_ROTULO);
  if (!m) return null;

  const nome = m[1]!;
  // "—" (travessão) vira um caractere de controle ao decodificar como Latin1
  // puro (o byte 0x97 é travessão em WinAnsiEncoding, não em Latin1) — só
  // nos importa reconhecer o placeholder de referência vazia, não decodificar acentos corretamente.
  const referenciaBruta = m[2]!;
  const referencia = referenciaBruta.length === 1 && referenciaBruta.charCodeAt(0) === 0x97 ? '' : referenciaBruta;
  const tamanho = m[3]!;

  let quantidade = 1;
  let totalDePaginasDaPeca = 1;
  let paginaDaPeca = 1;
  for (const bloco of blocosDeTexto) {
    const mq = bloco.match(/quantidade:\s*(\d+)/);
    if (mq) quantidade = Number.parseInt(mq[1]!, 10);
    const mp = bloco.match(/gina\s*(\d+)\/(\d+)/); // "página" decodificado com acento pode virar outro byte — casa só o sufixo estável "gina N/Y"
    if (mp) {
      paginaDaPeca = Number.parseInt(mp[1]!, 10);
      totalDePaginasDaPeca = Number.parseInt(mp[2]!, 10);
    }
  }

  return { nome, referencia, tamanho, quantidade, totalDePaginasDaPeca, paginaDaPeca };
}

export interface PecaImportadaPdf {
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly furos: Contorno[];
  readonly linhasInternas: Contorno[];
  readonly linhaDeFio: LinhaDeFio | null;
  readonly piques: readonly { readonly posicao: Ponto2D; readonly indiceAresta: number }[];
  readonly marcas: readonly Ponto2D[];
  readonly margemDeCosturaMm: number;
  readonly quantidade: number;
  /**
   * A peça inteira, pelo registro que este programa escreve na página dela — com o que o desenho não diz: os
   * formatos dos piques, os textos, as linhas de construção, a graduação, a cor e os registros de pence, curva e
   * prega. Só vem quando o registro foi lido e confere com o desenho; sem ela, a peça é a que o desenho mostra.
   */
  readonly molde?: Molde;
}

/** A até isto (mm) um do outro, o ponto do registro e o do desenho são o mesmo ponto. */
const MESMO_PONTO_DO_DESENHO_MM = 0.05;

/** O contorno do registro é o que o desenho mostra: os mesmos pontos, na mesma ordem. */
function mesmoContorno(doRegistro: Contorno, doDesenho: Contorno): boolean {
  return doRegistro.length === doDesenho.length && doRegistro.every((p, i) => distancia(p, doDesenho[i]!) <= MESMO_PONTO_DO_DESENHO_MM);
}

/**
 * A peça com identificadores novos — o dela e os de tudo o que ela tem —,
 * para não repetir os de outra peça do projeto. As listas que apontam para
 * piques e marcas (nas pences, pregas e cunhas) acompanham a troca.
 */
function comIdsNovos(molde: Molde, novoId: () => string): Molde {
  const novos = new Map<string, string>();
  const de = (id: string): string => {
    const jaTrocado = novos.get(id);
    if (jaTrocado !== undefined) return jaTrocado;
    const novo = novoId();
    novos.set(id, novo);
    return novo;
  };
  const comId = <T extends { readonly id: string }>(item: T): T => ({ ...item, id: de(item.id) });
  const guardada = molde.dobraMantida;
  return {
    ...molde,
    id: novoId(),
    piques: molde.piques.map(comId),
    marcas: molde.marcas.map(comId),
    ...(molde.textos ? { textos: molde.textos.map(comId) } : {}),
    ...(molde.cotas ? { cotas: molde.cotas.map(comId) } : {}),
    ...(molde.curvas ? { curvas: molde.curvas.map(comId) } : {}),
    ...(molde.pences ? { pences: molde.pences.map((p) => ({ ...comId(p), ...(p.piques ? { piques: p.piques.map(de) } : {}), ...(p.marcas ? { marcas: p.marcas.map(de) } : {}) })) } : {}),
    ...(molde.pregas ? { pregas: molde.pregas.map((p) => ({ ...comId(p), ...(p.piques ? { piques: p.piques.map(de) } : {}) })) } : {}),
    ...(molde.cunhas ? { cunhas: molde.cunhas.map((c) => ({ ...comId(c), ...(c.piques ? { piques: c.piques.map(de) } : {}) })) } : {}),
    ...(guardada ? { dobraMantida: { ...guardada, piques: guardada.piques.map(comId), marcas: guardada.marcas.map(comId) } } : {}),
  };
}

/**
 * A peça importada como um molde do projeto: a do registro do PDF, inteira,
 * quando ele veio; senão, a que o desenho mostra — o contorno, os furos, as
 * linhas internas, a linha de fio, os piques como traços e as marcas como
 * pontos. Só para a peça que tem linha de fio.
 */
export function moldeDaPecaImportada(peca: PecaImportadaPdf, novoId: () => string): Molde {
  if (peca.molde) return comIdsNovos(peca.molde, novoId);
  if (!peca.linhaDeFio) throw new Error(`A peça "${peca.nome}" não tem linha de fio.`);
  return criarMolde(
    {
      nome: peca.nome,
      referencia: peca.referencia,
      tamanho: peca.tamanho,
      contorno: peca.contorno,
      furos: peca.furos,
      linhasInternas: peca.linhasInternas,
      linhaDeFio: peca.linhaDeFio,
      margemDeCosturaMm: peca.margemDeCosturaMm,
      quantidade: peca.quantidade,
      piques: peca.piques.map((pique) => ({ id: novoId(), posicao: pique.posicao, indiceAresta: pique.indiceAresta })),
      marcas: peca.marcas.map((posicao) => ({ id: novoId(), posicao })),
    },
    novoId(),
  );
}

export interface ResultadoImportacaoPdf {
  readonly pecas: PecaImportadaPdf[];
  readonly avisos: string[];
}

export function importarPdf(bytesComoLatin1: string): ResultadoImportacaoPdf {
  const streamsDePagina = [...bytesComoLatin1.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => m[1]!);
  const avisos: string[] = [];
  const pecas: PecaImportadaPdf[] = [];

  for (const stream of streamsDePagina) {
    const rotulo = lerRotuloDaPagina(stream);
    if (!rotulo) continue; // página sem rótulo reconhecível — não é uma página de peça (ex.: só a régua/mesa de um encaixe).

    // A peça maior que uma folha sai em várias páginas. Cada uma delas traz o desenho inteiro da peça — a folha só
    // deixa aparecer o pedaço dela, pelo recorte —, deslocado para a posição da página. A primeira ("página 1/Y")
    // basta: as outras são a mesma peça de novo.
    if (rotulo.paginaDaPeca > 1) continue;

    const elementos = lerElementosDaPagina(stream);
    const blocoContorno = elementos.find((e) => e.tipo === 'contorno-e-furos');
    if (!blocoContorno) {
      avisos.push(`Peça "${rotulo.nome}": contorno não reconhecido nesta página — pulada.`);
      continue;
    }

    const contorno = pontosParaMm(blocoContorno.subpaths[0]!);
    const furos = blocoContorno.subpaths.slice(1).map((sp) => pontosParaMm(sp));

    const linhasInternas = elementos.filter((e) => e.tipo === 'linha-interna').map((e) => pontosParaMm(e.subpaths[0]!));

    const elementoFio = elementos.find((e) => e.tipo === 'fio');
    let linhaDeFio: LinhaDeFio | null = null;
    if (elementoFio) {
      const [inicio, fim] = pontosParaMm(elementoFio.subpaths[0]!);
      linhaDeFio = { inicio: inicio!, fim: fim! };
    } else {
      avisos.push(
        `Peça "${rotulo.nome}" não tem linha de fio reconhecível no PDF — defina manualmente antes de finalizar a importação (regra crítica da seção 5, nunca presumida automaticamente).`,
      );
    }

    const piques = elementos
      .filter((e) => e.tipo === 'pique')
      .map((e) => {
        const posicao = pontosParaMm(e.subpaths[0]!)[0]!;
        return { posicao, indiceAresta: pontoMaisProximoNoContorno(posicao, contorno).indiceAresta };
      });

    const marcas = elementos
      .filter((e) => e.tipo === 'marca')
      .map((e) => {
        const pontosMm = pontosParaMm(e.subpaths[0]!);
        const bbox = retanguloEnvolvente(pontosMm);
        return ponto((bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2);
      });

    const elementoLinhaDeCorte = elementos.find((e) => e.tipo === 'linha-de-corte');
    let margemDeCosturaMm = 0;
    if (elementoLinhaDeCorte) {
      const bboxCorte = retanguloEnvolvente(pontosParaMm(elementoLinhaDeCorte.subpaths[0]!));
      const bboxContorno = retanguloEnvolvente(contorno);
      margemDeCosturaMm = Math.max(
        0,
        ((bboxCorte.largura - bboxContorno.largura) + (bboxCorte.altura - bboxContorno.altura)) / 4,
      );
    }

    // O registro traz a peça inteira, com o que o desenho não diz. Só vale se descreve a peça que o desenho
    // mostra — o mesmo contorno, ponto a ponto; senão, a peça volta só pelo desenho, e o aviso diz.
    const lido = lerRegistroDaPagina(stream);
    const doRegistro = lido !== null && lido !== 'ilegivel' && mesmoContorno(lido.contorno, contorno) ? lido : null;
    const SO_PELO_DESENHO = 'ela volta só pelo desenho: os piques como traços, sem os textos, as linhas de construção, a graduação nem os outros registros.';
    if (lido === 'ilegivel') avisos.push(`Peça "${rotulo.nome}": o registro da peça neste PDF não pôde ser lido — ${SO_PELO_DESENHO}`);
    else if (lido !== null && !doRegistro) avisos.push(`Peça "${rotulo.nome}": o registro da peça neste PDF não confere com o desenho — ${SO_PELO_DESENHO}`);

    pecas.push({
      nome: rotulo.nome,
      referencia: rotulo.referencia,
      tamanho: rotulo.tamanho,
      contorno,
      furos,
      linhasInternas,
      linhaDeFio,
      piques,
      marcas,
      margemDeCosturaMm,
      quantidade: rotulo.quantidade,
      ...(doRegistro ? { molde: doRegistro } : {}),
    });
  }

  if (pecas.length === 0 && avisos.length === 0) {
    avisos.push('Nenhuma peça reconhecível neste PDF — só PDFs exportados por este app (Exportar PDF, moldes individuais) podem ser importados de volta.');
  }

  return { pecas, avisos };
}
