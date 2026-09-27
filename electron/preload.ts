import { contextBridge, ipcRenderer } from 'electron';

export interface ArquivoAberto {
  readonly caminho: string;
  readonly conteudo: string;
}

const api = {
  async abrirArquivoDxf(): Promise<ArquivoAberto | null> {
    return ipcRenderer.invoke('abrir-arquivo-dxf') as Promise<ArquivoAberto | null>;
  },
};

export type EnfestoCadApi = typeof api;

contextBridge.exposeInMainWorld('enfestoCad', api);
