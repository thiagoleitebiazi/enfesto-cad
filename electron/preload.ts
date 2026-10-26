import { contextBridge, ipcRenderer } from 'electron';
import type { Projeto } from '../src/domain/projeto';
import type { Programa } from '../src/domain/programas';
import { ehAcaoDeEdicao, type AcaoDeEdicao } from '../src/ui/edicaoPeloMenu';
import type { EstadoDaIa } from './chaveDaIa';
import type { ArquivoNaPasta, TipoDePasta } from './pastasCompartilhadas';
import type { PedidoDeImagem, RespostaDaIa } from '../src/domain/servicoDeIa';

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
  /** O conteúdo de cada arquivo da pasta de projetos, como está no disco: ler com `lerBiblioteca`. */
  async listarProjetos(): Promise<unknown[]> {
    return ipcRenderer.invoke('listar-projetos') as Promise<unknown[]>;
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
  /** O cadastro de produção como está no disco (`null`: ainda não existe). Ler com `lerCadastroDeProducao`. */
  async lerCadastroDeProducao(): Promise<unknown> {
    return ipcRenderer.invoke('cadastro-ler') as Promise<unknown>;
  },
  /** Grava o cadastro de produção inteiro (o processo principal confere antes). */
  async gravarCadastroDeProducao(cadastro: unknown): Promise<boolean> {
    return ipcRenderer.invoke('cadastro-gravar', cadastro) as Promise<boolean>;
  },
  /** A fila de encaixes como está no disco (`null`: ainda não existe). Ler com `lerFilaDeEncaixes`. */
  async lerFilaDeEncaixes(): Promise<unknown> {
    return ipcRenderer.invoke('fila-ler') as Promise<unknown>;
  },
  /** Grava a fila de encaixes inteira (o processo principal confere antes). */
  async gravarFilaDeEncaixes(fila: unknown): Promise<boolean> {
    return ipcRenderer.invoke('fila-gravar', fila) as Promise<boolean>;
  },
  /** A biblioteca de materiais e aviamentos como está no disco (`null`: ainda não existe). Ler com `lerBibliotecaDeMateriais`. */
  async lerBibliotecaDeMateriais(): Promise<unknown> {
    return ipcRenderer.invoke('materiais-ler') as Promise<unknown>;
  },
  /** As coleções como estão no disco (`null`: ainda não existem). Ler com `lerColecoes`. */
  async lerColecoes(): Promise<unknown> {
    return ipcRenderer.invoke('colecoes-ler') as Promise<unknown>;
  },
  /** Grava as coleções inteiras (o processo principal confere antes). */
  async gravarColecoes(arquivo: unknown): Promise<boolean> {
    return ipcRenderer.invoke('colecoes-gravar', arquivo) as Promise<boolean>;
  },
  /** Grava a biblioteca de materiais inteira (o processo principal confere antes). */
  async gravarBibliotecaDeMateriais(biblioteca: unknown): Promise<boolean> {
    return ipcRenderer.invoke('materiais-gravar', biblioteca) as Promise<boolean>;
  },
  /** As pastas compartilhadas (ADR 0141): escolher, saber onde está e trocar arquivos nela, só pelo nome. */
  async escolherPasta(tipo: TipoDePasta): Promise<string | null> {
    return ipcRenderer.invoke('pasta-escolher', tipo) as Promise<string | null>;
  },
  async ondeEstaAPasta(tipo: TipoDePasta): Promise<string | null> {
    return ipcRenderer.invoke('pasta-onde', tipo) as Promise<string | null>;
  },
  async esquecerPasta(tipo: TipoDePasta): Promise<boolean> {
    return ipcRenderer.invoke('pasta-esquecer', tipo) as Promise<boolean>;
  },
  async listarNaPasta(tipo: TipoDePasta, subpasta: string): Promise<ArquivoNaPasta[] | null> {
    return ipcRenderer.invoke('pasta-listar', { tipo, subpasta }) as Promise<ArquivoNaPasta[] | null>;
  },
  async lerNaPasta(tipo: TipoDePasta, subpasta: string, nome: string): Promise<string | null> {
    return ipcRenderer.invoke('pasta-ler', { tipo, subpasta, nome }) as Promise<string | null>;
  },
  async gravarNaPasta(tipo: TipoDePasta, subpasta: string, nome: string, texto: string): Promise<boolean> {
    return ipcRenderer.invoke('pasta-gravar', { tipo, subpasta, nome, texto }) as Promise<boolean>;
  },
  async moverNaPasta(tipo: TipoDePasta, subpasta: string, nome: string, para: string, novoNome?: string): Promise<boolean> {
    return ipcRenderer.invoke('pasta-mover', { tipo, subpasta, nome, para, novoNome }) as Promise<boolean>;
  },
  async criarNaPastaSeNaoExiste(tipo: TipoDePasta, subpasta: string, nome: string, texto: string): Promise<boolean> {
    return ipcRenderer.invoke('pasta-criar-se-nao-existe', { tipo, subpasta, nome, texto }) as Promise<boolean>;
  },
  async apagarNaPasta(tipo: TipoDePasta, subpasta: string, nome: string): Promise<boolean> {
    return ipcRenderer.invoke('pasta-apagar', { tipo, subpasta, nome }) as Promise<boolean>;
  },
  /** O serviço de IA: se há chave guardada (nunca a chave), o serviço e o modelo. */
  async estadoDaIa(): Promise<EstadoDaIa> {
    return ipcRenderer.invoke('ia-estado') as Promise<EstadoDaIa>;
  },
  /** Guarda a chave, cifrada pelo cofre do sistema; devolve o motivo de não guardar, ou `null`. */
  async guardarChaveDaIa(chave: string, modelo: string): Promise<string | null> {
    return ipcRenderer.invoke('ia-guardar-chave', { chave, modelo }) as Promise<string | null>;
  },
  async mudarModeloDaIa(modelo: string): Promise<string | null> {
    return ipcRenderer.invoke('ia-mudar-modelo', modelo) as Promise<string | null>;
  },
  async esquecerChaveDaIa(): Promise<boolean> {
    return ipcRenderer.invoke('ia-esquecer-chave') as Promise<boolean>;
  },
  /** Manda o pedido ao serviço (com a chave guardada); as imagens em base64, ou o erro. */
  async gerarImagensComIa(pedido: PedidoDeImagem): Promise<RespostaDaIa & { readonly modelo?: string }> {
    return ipcRenderer.invoke('ia-gerar', pedido) as Promise<RespostaDaIa & { readonly modelo?: string }>;
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
  /** A mesa digitalizadora (ADR 0144): a lista das portas seriais, quando a janela pede uma. Devolve a função que para de ouvir. */
  aoEscolherPortaSerial(ouvir: (portas: ReadonlyArray<{ readonly id: string; readonly nome: string }>) => void): () => void {
    const ouvinte = (_evento: Electron.IpcRendererEvent, portas: unknown): void => {
      if (Array.isArray(portas)) ouvir(portas.filter((p): p is { id: string; nome: string } => typeof p?.id === 'string' && typeof p?.nome === 'string'));
    };
    ipcRenderer.on('escolher-porta-serial', ouvinte);
    return () => {
      ipcRenderer.removeListener('escolher-porta-serial', ouvinte);
    };
  },
  /** A porta escolhida (vazia: cancelar). */
  escolherPortaSerial(id: string): void {
    ipcRenderer.send('porta-serial-escolhida', id);
  },
  /** Faz a ação no texto do campo em foco (desfazer, copiar, colar…), pelo próprio motor. */
  editarTexto(acao: AcaoDeEdicao): void {
    ipcRenderer.send('editar-texto', acao);
  },
};

export type EnfestoCadApi = typeof api;

contextBridge.exposeInMainWorld('enfestoCad', api);
