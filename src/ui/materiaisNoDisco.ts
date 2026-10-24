import { BIBLIOTECA_VAZIA, lerBibliotecaDeMateriais, type BibliotecaDeMateriais } from '../domain/materiais';

/**
 * Onde a biblioteca de materiais (ADR 0104) mora: no programa instalado, num arquivo da pasta de dados, pelo
 * processo principal; aberto num navegador comum (sem o processo principal), no armazenamento do navegador.
 */

const CHAVE_NO_NAVEGADOR = 'enfesto-cad:biblioteca-de-materiais';

export interface ApiDosMateriais {
  lerBibliotecaDeMateriais(): Promise<unknown>;
  gravarBibliotecaDeMateriais(biblioteca: unknown): Promise<boolean>;
}

export interface BibliotecaCarregada {
  readonly biblioteca: BibliotecaDeMateriais;
  readonly avisos: readonly string[];
  /** O arquivo é de uma versão mais nova do programa: mostrar, mas não gravar por cima. */
  readonly somenteLeitura: boolean;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export async function carregarBibliotecaDeMateriais(api: ApiDosMateriais | undefined, armazenamento: Pick<Storage, 'getItem'> | null): Promise<BibliotecaCarregada> {
  const avisos: string[] = [];
  let bruto: unknown = null;
  try {
    if (api) bruto = await api.lerBibliotecaDeMateriais();
    else bruto = JSON.parse(armazenamento?.getItem(CHAVE_NO_NAVEGADOR) ?? 'null');
  } catch {
    avisos.push('A biblioteca de materiais não pôde ser lida: ela começa vazia, e o arquivo antigo vai para as cópias de segurança na primeira gravação.');
    bruto = null;
  }
  if (ehObjeto(bruto) && typeof bruto.recuperadoDaVersaoAnterior === 'string') {
    avisos.push('O arquivo da biblioteca de materiais estava perdido ou quebrado: o programa abriu a versão anterior dele (a da gravação de antes). Confira os últimos materiais e preços.');
    bruto = bruto.conteudo;
  } else if (ehObjeto(bruto) && typeof bruto.arquivoIlegivel === 'string') {
    avisos.push(`O arquivo da biblioteca de materiais (${String(bruto.arquivoIlegivel)}) está quebrado: a biblioteca começa vazia, e o arquivo quebrado vai para as cópias de segurança na primeira gravação.`);
    bruto = null;
  }
  const lida = lerBibliotecaDeMateriais(bruto);
  avisos.push(...lida.descartados);
  if (lida.maisNova) avisos.push('A biblioteca de materiais foi gravada por uma versão mais nova do programa: ela aparece, mas não é gravada por esta versão.');
  return { biblioteca: bruto === null ? BIBLIOTECA_VAZIA : lida.biblioteca, avisos, somenteLeitura: lida.maisNova };
}

/** Grava a biblioteca; devolve a mensagem do que impediu, ou `null`. */
export async function gravarBibliotecaDeMateriais(
  api: ApiDosMateriais | undefined,
  armazenamento: Pick<Storage, 'setItem'> | null,
  biblioteca: BibliotecaDeMateriais,
): Promise<string | null> {
  try {
    if (api) await api.gravarBibliotecaDeMateriais(biblioteca);
    else if (armazenamento) armazenamento.setItem(CHAVE_NO_NAVEGADOR, JSON.stringify(biblioteca));
    else return 'Não há onde gravar a biblioteca de materiais neste computador.';
    return null;
  } catch (e) {
    return `A biblioteca de materiais não foi gravada: ${e instanceof Error ? e.message : String(e)}`;
  }
}
