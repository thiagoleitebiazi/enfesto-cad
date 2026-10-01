import { contextBridge, ipcRenderer } from 'electron';
import type { Projeto } from '../src/domain/projeto';

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
};

export type EnfestoCadApi = typeof api;

contextBridge.exposeInMainWorld('enfestoCad', api);
