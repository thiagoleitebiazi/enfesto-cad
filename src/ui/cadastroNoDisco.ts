import { CADASTRO_VAZIO, incluirMalhasAntigas, lerCadastroDeProducao, type CadastroDeProducao } from '../domain/cadastroDeProducao';
import { lerMalhas } from './malhasCadastradas';

/**
 * Onde o cadastro de produção (malhas, rolos, ordens) mora: no programa instalado, num arquivo ao lado dos
 * projetos, pelo processo principal; aberto num navegador comum (sem o processo principal), no armazenamento do
 * navegador. Na primeira vez, as malhas do cadastro antigo (do armazenamento do navegador) entram.
 */

const CHAVE_NO_NAVEGADOR = 'enfesto-cad:cadastro-de-producao';

export interface ApiDoCadastro {
  lerCadastroDeProducao(): Promise<unknown>;
  gravarCadastroDeProducao(cadastro: unknown): Promise<boolean>;
}

export interface CadastroCarregado {
  readonly cadastro: CadastroDeProducao;
  readonly avisos: readonly string[];
  /** O arquivo é de uma versão mais nova do programa: mostrar, mas não gravar por cima. */
  readonly somenteLeitura: boolean;
}

export async function carregarCadastro(api: ApiDoCadastro | undefined, armazenamento: Pick<Storage, 'getItem'> | null): Promise<CadastroCarregado> {
  let bruto: unknown = null;
  const avisos: string[] = [];
  try {
    if (api) bruto = await api.lerCadastroDeProducao();
    else bruto = JSON.parse(armazenamento?.getItem(CHAVE_NO_NAVEGADOR) ?? 'null');
  } catch {
    avisos.push('O cadastro de produção não pôde ser lido. Ao gravar, o arquivo antigo é copiado para a pasta de cópias de segurança antes.');
    bruto = null;
  }
  if (typeof bruto === 'object' && bruto !== null && typeof (bruto as Record<string, unknown>).arquivoIlegivel === 'string') {
    avisos.push(
      `O arquivo do cadastro de produção (${String((bruto as Record<string, unknown>).arquivoIlegivel)}) está quebrado: o programa começou um cadastro vazio. Ao gravar, o arquivo quebrado é copiado para a pasta de cópias de segurança antes.`,
    );
    bruto = null;
  }
  const lido = lerCadastroDeProducao(bruto);
  avisos.push(...lido.descartados);
  if (lido.maisNovo) avisos.push('O cadastro de produção foi gravado por uma versão mais nova do programa: ele aparece, mas não é gravado por esta versão (para não perder nada).');
  const antigas = armazenamento ? lerMalhas(armazenamento) : [];
  const cadastro = bruto === null && antigas.length > 0 ? incluirMalhasAntigas(CADASTRO_VAZIO, antigas) : lido.cadastro;
  return { cadastro, avisos, somenteLeitura: lido.maisNovo };
}

/** Grava o cadastro; devolve a mensagem do que impediu, ou `null`. */
export async function gravarCadastro(api: ApiDoCadastro | undefined, armazenamento: Pick<Storage, 'setItem'> | null, cadastro: CadastroDeProducao): Promise<string | null> {
  try {
    if (api) await api.gravarCadastroDeProducao(cadastro);
    else if (armazenamento) armazenamento.setItem(CHAVE_NO_NAVEGADOR, JSON.stringify(cadastro));
    else return 'Não há onde gravar o cadastro neste computador.';
    return null;
  } catch (e) {
    return `O cadastro não foi gravado: ${e instanceof Error ? e.message : String(e)}`;
  }
}
