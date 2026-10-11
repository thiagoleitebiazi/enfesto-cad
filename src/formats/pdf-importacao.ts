import type { Contorno, Ponto2D } from '../core/geometria';
import { distancia, ponto, retanguloEnvolvente, pontoMaisProximoNoContorno } from '../core/geometria';
import { criarMolde, type FormatoDePique, type LinhaDeFio, type Molde } from '../domain/molde';
import { PONTOS_POR_MM } from './pdf-exportacao';
import { lerRegistroDaPagina, type TextoDoRegistro } from './pdf-registro';

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
 * Limitação conhecida, documentada em vez de escondida: peças maiores que
 * uma folha (exportadas ladrilhadas em várias páginas) não são
 * reconstruídas automaticamente — a peça inteira não está em nenhuma
 * página isolada, e tentar costurar os fragmentos de volta é um problema
 * bem mais difícil que decidimos não resolver nesta primeira versão.
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
  for (const bloco of blocosDeTexto) {
    const mq = bloco.match(/quantidade:\s*(\d+)/);
    if (mq) quantidade = Number.parseInt(mq[1]!, 10);
    const mp = bloco.match(/gina\s*\d+\/(\d+)/); // "página" decodificado com acento pode virar outro byte — casa só o sufixo estável "gina N/Y"
    if (mp) totalDePaginasDaPeca = Number.parseInt(mp[1]!, 10);
  }

  return { nome, referencia, tamanho, quantidade, totalDePaginasDaPeca };
}

export interface PecaImportadaPdf {
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly furos: Contorno[];
  readonly linhasInternas: Contorno[];
  readonly linhaDeFio: LinhaDeFio | null;
  /** Os piques do contorno. O formato, o "pique na costura" e o código vêm do registro da peça no PDF, quando ele existe. */
  readonly piques: readonly {
    readonly posicao: Ponto2D;
    readonly indiceAresta: number;
    readonly formato?: FormatoDePique;
    readonly naCostura?: 'projetado' | 'estendido';
    readonly codigo?: string;
  }[];
  readonly marcas: readonly Ponto2D[];
  /** O formato de cada marca (na ordem de `marcas`; `null` no ponto sem formato), quando o registro do PDF os traz. */
  readonly formatosDasMarcas?: readonly (FormatoDePique | null)[];
  /** Os textos da peça, pelo registro do PDF. */
  readonly textos?: readonly TextoDoRegistro[];
  /** As linhas só de construção, pelo registro do PDF: não são desenhadas na folha, e já estão em `linhasInternas`. */
  readonly elementos?: readonly Contorno[];
  readonly margemDeCosturaMm: number;
  readonly quantidade: number;
}

/** A até isto (mm) da posição desenhada, o pique do registro é o mesmo pique. */
const MESMO_PIQUE_MM = 0.05;

/**
 * A peça importada como um molde do projeto, com o que o registro do PDF
 * trouxe: os formatos dos piques, os textos e as linhas de construção. Só
 * para a peça que tem linha de fio.
 */
export function moldeDaPecaImportada(peca: PecaImportadaPdf, novoId: () => string): Molde {
  if (!peca.linhaDeFio) throw new Error(`A peça "${peca.nome}" não tem linha de fio.`);
  const molde = criarMolde(
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
      piques: peca.piques.map((pique) => ({
        id: novoId(),
        posicao: pique.posicao,
        indiceAresta: pique.indiceAresta,
        ...(pique.formato ? { formato: pique.formato } : {}),
        ...(pique.naCostura ? { naCostura: pique.naCostura } : {}),
        ...(pique.codigo ? { codigo: pique.codigo } : {}),
      })),
      marcas: peca.marcas.map((posicao, i) => {
        const formato = peca.formatosDasMarcas?.[i];
        return { id: novoId(), posicao, ...(formato ? { formato } : {}) };
      }),
    },
    novoId(),
  );
  const textos = (peca.textos ?? []).map((texto) => ({ id: novoId(), ...texto }));
  return { ...molde, ...(textos.length > 0 ? { textos } : {}), ...(peca.elementos && peca.elementos.length > 0 ? { elementos: peca.elementos } : {}) };
}

export interface ResultadoImportacaoPdf {
  readonly pecas: PecaImportadaPdf[];
  readonly avisos: string[];
}

export function importarPdf(bytesComoLatin1: string): ResultadoImportacaoPdf {
  const streamsDePagina = [...bytesComoLatin1.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => m[1]!);
  const avisos: string[] = [];
  const pecas: PecaImportadaPdf[] = [];
  const pecasLadrilhadasJaAvisadas = new Set<string>();

  for (const stream of streamsDePagina) {
    const rotulo = lerRotuloDaPagina(stream);
    if (!rotulo) continue; // página sem rótulo reconhecível — não é uma página de peça (ex.: só a régua/mesa de um encaixe).

    if (rotulo.totalDePaginasDaPeca > 1) {
      if (pecasLadrilhadasJaAvisadas.has(rotulo.nome)) continue;
      pecasLadrilhadasJaAvisadas.add(rotulo.nome);
      // Peça maior que uma folha (ladrilhada em várias páginas) — sinal
      // direto do próprio rodapé ("página N/Y", Y>1), não uma heurística de
      // adjacência. Reconstrução automática não é suportada (ver docstring
      // do módulo): cada página só tem um FRAGMENTO recortado da peça, e
      // reconstituir o resto exigiria costurar geometria entre páginas —
      // melhor avisar do que impor um contorno incompleto como se fosse a peça inteira.
      avisos.push(
        `Peça "${rotulo.nome}" foi exportada em ${rotulo.totalDePaginasDaPeca} páginas (maior que uma folha) — importação automática de peças ladrilhadas não é suportada. Desenhe-a manualmente com "Novo Molde".`,
      );
      continue;
    }

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

    // O registro da peça diz o que o desenho não diz: os formatos, os textos e as linhas de construção.
    const lido = lerRegistroDaPagina(stream);
    if (lido === 'ilegivel') {
      avisos.push(`Peça "${rotulo.nome}": o registro das marcações deste PDF não pôde ser lido — a peça volta só pelo desenho: os piques como traços, sem os textos nem as linhas de construção.`);
    }
    const registro = lido !== null && lido !== 'ilegivel' ? lido : null;
    const piquesComOFormato = piques.map((pique) => {
      const doRegistro = registro?.piques.find((r) => distancia(r.posicao, pique.posicao) <= MESMO_PIQUE_MM);
      if (!doRegistro) return pique;
      return {
        ...pique,
        ...(doRegistro.formato ? { formato: doRegistro.formato } : {}),
        ...(doRegistro.naCostura ? { naCostura: doRegistro.naCostura } : {}),
        ...(doRegistro.codigo ? { codigo: doRegistro.codigo } : {}),
      };
    });
    // As marcas vêm do registro quando ele conta as mesmas que o desenho mostra: é ele que sabe onde o pique interno está de verdade.
    const marcasDoRegistro = registro && registro.marcas.length > 0 && registro.marcas.length === marcas.length ? registro.marcas : null;
    const deConstrucao = registro?.elementos ?? [];

    pecas.push({
      nome: rotulo.nome,
      referencia: rotulo.referencia,
      tamanho: rotulo.tamanho,
      contorno,
      furos,
      linhasInternas: [...linhasInternas, ...deConstrucao],
      linhaDeFio,
      piques: piquesComOFormato,
      marcas: marcasDoRegistro ? marcasDoRegistro.map((m) => m.posicao) : marcas,
      ...(marcasDoRegistro ? { formatosDasMarcas: marcasDoRegistro.map((m) => m.formato ?? null) } : {}),
      ...(registro && registro.textos.length > 0 ? { textos: registro.textos } : {}),
      ...(deConstrucao.length > 0 ? { elementos: deConstrucao } : {}),
      margemDeCosturaMm,
      quantidade: rotulo.quantidade,
    });
  }

  if (pecas.length === 0 && avisos.length === 0) {
    avisos.push('Nenhuma peça reconhecível neste PDF — só PDFs exportados por este app (Exportar PDF, moldes individuais) podem ser importados de volta.');
  }

  return { pecas, avisos };
}
