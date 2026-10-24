import { useCallback, useEffect, useRef, useState } from 'react';
import { COLECOES_VAZIAS, lerColecoes, type ArquivoDeColecoes } from '../domain/colecoes';

/**
 * As coleções (ADR 0108), lidas do disco ao abrir o programa (o aviso de prazos da barra de status precisa delas) e
 * gravadas a cada mudança. No programa instalado, um arquivo da pasta de dados; num navegador comum, o
 * armazenamento do navegador.
 */

const CHAVE_NO_NAVEGADOR = 'enfesto-cad:colecoes';

export interface ApiDasColecoes {
  lerColecoes(): Promise<unknown>;
  gravarColecoes(arquivo: unknown): Promise<boolean>;
}

export interface ColecoesNaTela {
  readonly arquivo: ArquivoDeColecoes;
  readonly carregadas: boolean;
  readonly avisos: readonly string[];
  readonly somenteLeitura: boolean;
  /** Grava as coleções mudadas; devolve a mensagem do erro, ou `null`. */
  readonly mudar: (novo: ArquivoDeColecoes) => Promise<string | null>;
}

const armazenamento = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function useColecoes(api: ApiDasColecoes | undefined): ColecoesNaTela {
  const [arquivo, setArquivo] = useState<ArquivoDeColecoes>(COLECOES_VAZIAS);
  const [carregadas, setCarregadas] = useState(false);
  const [avisos, setAvisos] = useState<readonly string[]>([]);
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  const somenteLeituraRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const novos: string[] = [];
      let bruto: unknown = null;
      try {
        bruto = api ? await api.lerColecoes() : JSON.parse(armazenamento()?.getItem(CHAVE_NO_NAVEGADOR) ?? 'null');
      } catch {
        novos.push('As coleções não puderam ser lidas: começam vazias, e o arquivo antigo vai para as cópias de segurança na primeira gravação.');
      }
      if (ehObjeto(bruto) && typeof bruto.recuperadoDaVersaoAnterior === 'string') {
        novos.push('O arquivo das coleções estava perdido ou quebrado: o programa abriu a versão anterior dele (a da gravação de antes).');
        bruto = bruto.conteudo;
      } else if (ehObjeto(bruto) && typeof bruto.arquivoIlegivel === 'string') {
        novos.push(`O arquivo das coleções (${String(bruto.arquivoIlegivel)}) está quebrado: começa vazio, e o arquivo quebrado vai para as cópias de segurança na primeira gravação.`);
        bruto = null;
      }
      const lido = lerColecoes(bruto);
      novos.push(...lido.descartados);
      if (lido.maisNovo) novos.push('As coleções foram gravadas por uma versão mais nova do programa: aparecem, mas não são gravadas por esta versão.');
      if (!vivo) return;
      somenteLeituraRef.current = lido.maisNovo;
      setSomenteLeitura(lido.maisNovo);
      setArquivo(lido.arquivo);
      setAvisos(novos);
      setCarregadas(true);
    })();
    return () => {
      vivo = false;
    };
  }, [api]);

  const mudar = useCallback(
    async (novo: ArquivoDeColecoes): Promise<string | null> => {
      if (somenteLeituraRef.current) return 'As coleções foram gravadas por uma versão mais nova do programa: aqui elas só são mostradas.';
      try {
        if (api) await api.gravarColecoes(novo);
        else {
          const local = armazenamento();
          if (!local) return 'Não há onde gravar as coleções neste computador.';
          local.setItem(CHAVE_NO_NAVEGADOR, JSON.stringify(novo));
        }
      } catch (e) {
        return `As coleções não foram gravadas: ${e instanceof Error ? e.message : String(e)}`;
      }
      setArquivo(novo);
      return null;
    },
    [api],
  );

  return { arquivo, carregadas, avisos, somenteLeitura, mudar };
}
