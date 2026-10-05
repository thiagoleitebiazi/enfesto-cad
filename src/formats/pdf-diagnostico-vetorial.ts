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

import { lerConteudosDeDesenho } from './pdf-fluxos';

const PT_PARA_MM = 25.4 / 72;
const NUMERO = '-?\\d*\\.?\\d+';

function contar(texto: string, operador: string, numerosAntes: number): number {
  const operandos = `(?:${NUMERO}\\s+){${numerosAntes}}`;
  const re = new RegExp(`(?:^|\\s)${operandos}${operador}(?=\\s|$)`, 'g');
  return (texto.match(re) || []).length;
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

  for (const conteudo of await lerConteudosDeDesenho(bytes)) {
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
