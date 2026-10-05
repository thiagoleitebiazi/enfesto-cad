/**
 * Diagnóstico de conteúdo vetorial de um PDF qualquer — não gera peças.
 * Descompacta os fluxos (FlateDecode) e conta operações de desenho e de
 * texto, para informar o que o arquivo contém quando ele não foi exportado
 * por este app e, portanto, não pode ser importado como peças.
 */

export interface DiagnosticoVetorialPdf {
  readonly paginas: number;
  readonly subcaminhos: number;
  readonly segmentosRetos: number;
  readonly segmentosCurvos: number;
  readonly blocosDeTexto: number;
  readonly larguraMm: number | null;
  readonly alturaMm: number | null;
}

const PT_PARA_MM = 25.4 / 72;
const NUMERO = '-?\\d*\\.?\\d+';

function contar(texto: string, operador: string, numerosAntes: number): number {
  const operandos = `(?:${NUMERO}\\s+){${numerosAntes}}`;
  const re = new RegExp(`(?:^|\\s)${operandos}${operador}(?=\\s|$)`, 'g');
  return (texto.match(re) || []).length;
}

async function descomprimir(bruto: Uint8Array): Promise<Uint8Array | null> {
  try {
    const copia = new Uint8Array(bruto.byteLength);
    copia.set(bruto);
    const corpo = new Response(copia).body;
    if (!corpo) return null;
    const descomprimido = corpo.pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(descomprimido).arrayBuffer());
  } catch {
    return null;
  }
}

function extrairFluxos(bytes: Uint8Array): { dicionario: string; bruto: Uint8Array }[] {
  const texto = new TextDecoder('latin1').decode(bytes);
  const inicios = [...texto.matchAll(/\d+\s+0\s+obj\b/g)].map((m) => m.index ?? 0);
  const fluxos: { dicionario: string; bruto: Uint8Array }[] = [];
  for (let i = 0; i < inicios.length; i++) {
    const inicio = inicios[i]!;
    const limite = i + 1 < inicios.length ? inicios[i + 1]! : texto.length;
    const objeto = texto.slice(inicio, limite);
    const cabecalhoDeFluxo = /(?<!end)stream\r?\n/.exec(objeto);
    if (!cabecalhoDeFluxo) continue;
    const dicionario = objeto.slice(0, cabecalhoDeFluxo.index);
    if (!dicionario.includes('<<')) continue;
    const dadosInicio = inicio + cabecalhoDeFluxo.index + cabecalhoDeFluxo[0].length;
    const fimDoBloco = texto.indexOf('endstream', dadosInicio);
    if (fimDoBloco < 0) continue;
    // O PDF costuma pôr um fim de linha antes de "endstream", que não faz
    // parte do fluxo comprimido e faz o descompressor rejeitar os dados.
    let dadosFim = fimDoBloco;
    while (dadosFim > dadosInicio && (bytes[dadosFim - 1] === 0x0a || bytes[dadosFim - 1] === 0x0d)) dadosFim--;
    fluxos.push({ dicionario, bruto: bytes.subarray(dadosInicio, dadosFim) });
  }
  return fluxos;
}

export function descreverDiagnosticoVetorial(d: DiagnosticoVetorialPdf): string {
  const segmentos = d.segmentosRetos + d.segmentosCurvos;
  const dimensoes =
    d.larguraMm !== null && d.alturaMm !== null
      ? ` de ${Math.round(d.larguraMm)} × ${Math.round(d.alturaMm)} mm (escala desconhecida, medidas em pontos do PDF)`
      : '';
  const texto =
    d.blocosDeTexto === 0
      ? 'Não há texto pesquisável: os nomes das peças estão desenhados como vetor.'
      : `Há ${d.blocosDeTexto} bloco(s) de texto.`;
  return (
    `Este PDF contém desenho vetorial: ${d.subcaminhos} caminho(s) e ${segmentos} segmento(s) ` +
    `em ${d.paginas} página(s)${dimensoes}. Não foi exportado por este app, então as peças não foram identificadas. ` +
    `${texto} Para trazer as peças, peça ao programa de origem um arquivo DXF (aceito pelo app) ` +
    `ou desenhe com "Novo Molde".`
  );
}

export async function diagnosticarVetorPdf(bytesComoLatin1: string): Promise<DiagnosticoVetorialPdf> {
  const bytes = Uint8Array.from(bytesComoLatin1, (c) => c.charCodeAt(0) & 0xff);
  const textoCru = bytesComoLatin1;
  const paginas = (textoCru.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  const caixa = textoCru.match(/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/);
  const larguraMm = caixa ? (Number(caixa[3]) - Number(caixa[1])) * PT_PARA_MM : null;
  const alturaMm = caixa ? (Number(caixa[4]) - Number(caixa[2])) * PT_PARA_MM : null;

  let subcaminhos = 0;
  let segmentosRetos = 0;
  let segmentosCurvos = 0;
  let blocosDeTexto = 0;

  for (const fluxo of extrairFluxos(bytes)) {
    // Perfis de cor (/N), imagens e fluxos de objetos/xref não são desenho.
    if (/\/N\s+\d|\/Subtype\s*\/Image|\/Type\s*\/(ObjStm|XRef)/.test(fluxo.dicionario)) continue;
    const decodificado = /FlateDecode/.test(fluxo.dicionario)
      ? await descomprimir(fluxo.bruto)
      : fluxo.bruto;
    if (!decodificado) continue;
    const conteudo = new TextDecoder('latin1').decode(decodificado);
    if (!/(^|\s)(m|l|c|re|BT)(\s|$)/.test(conteudo)) continue;

    subcaminhos += contar(conteudo, 'm', 2);
    segmentosRetos += contar(conteudo, 'l', 2) + contar(conteudo, 're', 4);
    segmentosCurvos += contar(conteudo, 'c', 6);
    blocosDeTexto += (conteudo.match(/(^|\s)BT(?=\s|$)/g) || []).length;
  }

  return {
    paginas,
    subcaminhos,
    segmentosRetos,
    segmentosCurvos,
    blocosDeTexto,
    larguraMm,
    alturaMm,
  };
}
