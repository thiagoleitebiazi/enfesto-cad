import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function criarJanelaPrincipal(): void {
  const janela = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#e8e9eb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    janela.loadURL(VITE_DEV_SERVER_URL);
  } else {
    janela.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('abrir-arquivo-dxf', async () => {
  const resultado = await dialog.showOpenDialog({
    title: 'Importar DXF',
    filters: [{ name: 'DXF', extensions: ['dxf'] }],
    properties: ['openFile'],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  const caminho = resultado.filePaths[0]!;
  const conteudo = await readFile(caminho, 'utf-8');
  return { caminho, conteudo };
});

ipcMain.handle('abrir-arquivo-pdf', async () => {
  const resultado = await dialog.showOpenDialog({
    title: 'Importar PDF',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  const caminho = resultado.filePaths[0]!;
  // PDF é binário — lido como Buffer e convertido para latin1 (1 byte = 1
  // char code), igual ao texto do PDF quando `compress:false` na exportação
  // (ver formats/pdf-importacao.ts). Nunca 'utf-8' aqui: corromperia bytes >127.
  const bytes = await readFile(caminho);
  return { caminho, conteudo: bytes.toString('latin1') };
});

ipcMain.handle(
  'salvar-arquivo',
  async (_evento, opcoes: { sugestaoDeNome: string; conteudo: ArrayBuffer }) => {
    const extensao = path.extname(opcoes.sugestaoDeNome).replace(/^\./, '') || 'txt';
    const NOMES_POR_EXTENSAO: Record<string, string> = {
      pdf: 'PDF',
      xlsx: 'Excel',
    };
    const resultado = await dialog.showSaveDialog({
      title: 'Salvar arquivo',
      defaultPath: opcoes.sugestaoDeNome,
      filters: [{ name: NOMES_POR_EXTENSAO[extensao] ?? extensao.toUpperCase(), extensions: [extensao] }],
    });
    if (resultado.canceled || !resultado.filePath) return null;
    await writeFile(resultado.filePath, Buffer.from(opcoes.conteudo));
    return resultado.filePath;
  },
);

/**
 * Biblioteca permanente de trabalhos (seção 9): cada projeto vira um
 * arquivo JSON em <userData>/projetos/<id>.json — sobrevive a fechar e
 * reabrir o app (nenhum servidor, nenhum banco de dados, ADR 0010 do
 * moda-cad continua valendo aqui: local-first).
 */
function diretorioDeProjetos(): string {
  return path.join(app.getPath('userData'), 'projetos');
}

async function garantirDiretorioDeProjetos(): Promise<string> {
  const dir = diretorioDeProjetos();
  await mkdir(dir, { recursive: true });
  return dir;
}

ipcMain.handle('listar-projetos', async () => {
  const dir = await garantirDiretorioDeProjetos();
  const arquivos = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const projetos: unknown[] = [];
  for (const arquivo of arquivos) {
    try {
      const conteudo = await readFile(path.join(dir, arquivo), 'utf-8');
      projetos.push(JSON.parse(conteudo));
    } catch {
      // Arquivo corrompido/ilegível: ignora silenciosamente na listagem em
      // vez de derrubar a biblioteca inteira — mas não apaga nada.
    }
  }
  return projetos;
});

ipcMain.handle('salvar-projeto', async (_evento, projeto: { id: string }) => {
  const dir = await garantirDiretorioDeProjetos();
  await writeFile(path.join(dir, `${projeto.id}.json`), JSON.stringify(projeto, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('excluir-projeto', async (_evento, id: string) => {
  const dir = await garantirDiretorioDeProjetos();
  await unlink(path.join(dir, `${id}.json`));
  return true;
});

app.whenReady().then(() => {
  criarJanelaPrincipal();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      criarJanelaPrincipal();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
