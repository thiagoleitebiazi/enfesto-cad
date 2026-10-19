import { contextBridge, ipcRenderer } from 'electron';
import type { Projeto } from '../src/domain/projeto';
import type { Programa } from '../src/domain/programas';
import { ehAcaoDeEdicao, type AcaoDeEdicao } from '../src/ui/edicaoPeloMenu';

/** A lista de atalhos depois de um pedido, e a mensagem do que o impediu (ou `null`). */
export interface ResultadoDeProgramas {
  readonly lista: Programa[];
  readonly erro: string | null;
}

export interface ArquivoAberto {
  readonly caminho: string;
  readonly conteudo: string;
}

const api = {
  async abrirArquivoDxf(): Promise<ArquivoAberto | null> {
    return ipcRenderer.invoke('abrir-arquivo-dxf') as Promise<ArquivoAberto | null>;
  },
  async abrirArquivoPdf(): Promise<ArquivoAberto | null> {
    return ipcRenderer.invoke('abrir-arquivo-pdf') as Promise<ArquivoAberto | null>;
  },
  async salvarArquivo(sugestaoDeNome: string, conteudo: ArrayBuffer): Promise<string | null> {
    return ipcRenderer.invoke('salvar-arquivo', { sugestaoDeNome, conteudo }) as Promise<string | null>;
  },
  async listarProjetos(): Promise<Projeto[]> {
    return ipcRenderer.invoke('listar-projetos') as Promise<Projeto[]>;
  },
  async salvarProjeto(projeto: Projeto): Promise<boolean> {
    return ipcRenderer.invoke('salvar-projeto', projeto) as Promise<boolean>;
  },
  async excluirProjeto(id: string): Promise<boolean> {
    return ipcRenderer.invoke('excluir-projeto', id) as Promise<boolean>;
  },
  async listarProgramas(): Promise<Programa[]> {
    return ipcRenderer.invoke('programas-listar') as Promise<Programa[]>;
  },
  /** Abre a escolha do arquivo no sistema; `null` se o usuário desistiu. */
  async adicionarArquivoDePrograma(nome: string): Promise<ResultadoDeProgramas | null> {
    return ipcRenderer.invoke('programas-adicionar-arquivo', nome) as Promise<ResultadoDeProgramas | null>;
  },
  async adicionarEnderecoDePrograma(nome: string, endereco: string): Promise<ResultadoDeProgramas> {
    return ipcRenderer.invoke('programas-adicionar-endereco', { nome, endereco }) as Promise<ResultadoDeProgramas>;
  },
  async removerPrograma(id: string): Promise<ResultadoDeProgramas> {
    return ipcRenderer.invoke('programas-remover', id) as Promise<ResultadoDeProgramas>;
  },
  /** Abre o atalho pelo id; devolve a mensagem do erro, ou `null` se abriu. */
  async abrirPrograma(id: string): Promise<string | null> {
    return ipcRenderer.invoke('programas-abrir', id) as Promise<string | null>;
  },
  /** Avisa o processo principal de que a interface está montada e desenhando: fica no diagnóstico da abertura. */
  avisarInterfacePronta(): void {
    ipcRenderer.send('interface-pronta');
  },
  /** O menu Editar do Mac: a ação escolhida nele (⌘Z, ⌘C…). Devolve a função que para de ouvir. */
  aoEditarPeloMenu(ouvir: (acao: AcaoDeEdicao) => void): () => void {
    const ouvinte = (_evento: Electron.IpcRendererEvent, acao: unknown): void => {
      if (ehAcaoDeEdicao(acao)) ouvir(acao);
    };
    ipcRenderer.on('menu-editar', ouvinte);
    return () => {
      ipcRenderer.removeListener('menu-editar', ouvinte);
    };
  },
  /** Faz a ação no texto do campo em foco (desfazer, copiar, colar…), pelo próprio motor. */
  editarTexto(acao: AcaoDeEdicao): void {
    ipcRenderer.send('editar-texto', acao);
  },
};

export type EnfestoCadApi = typeof api;

contextBridge.exposeInMainWorld('enfestoCad', api);
