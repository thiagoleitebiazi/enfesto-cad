/**
 * Leitura de fluxos de conteúdo de um PDF arbitrário: separa os fluxos
 * comprimidos (FlateDecode) do desenho e descarta perfis de cor, imagens e
 * tabelas internas, que não são desenho.
 */

export async function descomprimir(bruto: Uint8Array): Promise<Uint8Array | null> {
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

function extrairFluxosBrutos(bytes: Uint8Array): { dicionario: string; bruto: Uint8Array }[] {
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

/** Textos decodificados dos fluxos que podem conter desenho (sem imagens, perfis de cor ou tabelas de objetos). */
export async function lerConteudosDeDesenho(bytes: Uint8Array): Promise<string[]> {
  const conteudos: string[] = [];
  for (const fluxo of extrairFluxosBrutos(bytes)) {
    if (/\/N\s+\d|\/Subtype\s*\/Image|\/Type\s*\/(ObjStm|XRef)/.test(fluxo.dicionario)) continue;
    const decodificado = /FlateDecode/.test(fluxo.dicionario) ? await descomprimir(fluxo.bruto) : fluxo.bruto;
    if (!decodificado) continue;
    conteudos.push(new TextDecoder('latin1').decode(decodificado));
  }
  return conteudos;
}
