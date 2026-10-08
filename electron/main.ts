import { app, BrowserWindow, dialog, ipcMain, Menu, protocol } from 'electron';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// A interface é servida por um esquema próprio (app://) em vez de file://.
// Com file:// o Chromium trata a página como origem opaca e falha em
// carregamentos de módulos/CORS em algumas máquinas, deixando a janela
// vazia. Com um esquema privilegiado a página tem origem normal.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const DIST_DO_APP = path.join(__dirname, '../dist');
const URL_DA_INTERFACE = 'app://enfesto/index.html';
const TIPOS_DE_ARQUIVO: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const TEMPO_LIMITE_DE_CARREGAMENTO_MS = 20000;
const MAXIMO_DE_TENTATIVAS_DE_RECUPERACAO = 2;

function registrarProtocoloDoApp(): void {
  protocol.handle('app', async (requisicao) => {
    const caminhoPedido = decodeURIComponent(new URL(requisicao.url).pathname);
    const relativo = caminhoPedido === '/' ? 'index.html' : caminhoPedido.replace(/^\/+/, '');
    const absoluto = path.resolve(DIST_DO_APP, relativo);
    if (absoluto !== DIST_DO_APP && !absoluto.startsWith(DIST_DO_APP + path.sep)) {
      return new Response('Não encontrado', { status: 404 });
    }
    try {
      const conteudo = await readFile(absoluto);
      return new Response(conteudo, {
        headers: { 'content-type': TIPOS_DE_ARQUIVO[path.extname(absoluto)] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response('Não encontrado', { status: 404 });
    }
  });
}

// Desliga a aceleração por GPU. Sem isso, em máquinas com driver de vídeo
// incompatível/desatualizado, GPU virtualizada (VM) ou acesso via área de
// trabalho remota, o compositor do Chromium falha silenciosamente e a
// janela abre completamente preta (sem nem o fundo padrão da página) —
// sintoma relatado por um usuário real após instalar em outro computador.
// Renderização por software é mais lenta, mas esta é uma aplicação 2D
// (Canvas, sem WebGL/3D), então o custo é baixo frente ao ganho de
// compatibilidade. Precisa ser chamado antes de `app.whenReady()`.
app.disableHardwareAcceleration();

/**
 * Diagnóstico local: quando a janela não renderiza na máquina de alguém, o
 * dev não tem como reproduzir — grava em <userData>/diagnostico.log o estado
 * da GPU e os eventos de carregamento/falha, para a pessoa poder enviar o
 * arquivo. Nunca sai da máquina sozinho.
 */
function registrarDiagnostico(mensagem: string): void {
  try {
    const arquivo = path.join(app.getPath('userData'), 'diagnostico.log');
    appendFileSync(arquivo, `${new Date().toISOString()} ${mensagem}\n`, 'utf-8');
  } catch {
    // Diagnóstico nunca pode derrubar o app.
  }
}

function criarJanelaPrincipal(): void {
  const janela = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#e8e9eb',
    title: 'Enfesto CAD',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janela.maximize();

  registrarDiagnostico(
    `inicio versao=${app.getVersion()} plataforma=${process.platform} arch=${process.arch} ` +
      `exe=${process.execPath} gpu=${JSON.stringify(app.getGPUFeatureStatus())}`,
  );

  let carregou = false;
  let tentativas = 0;
  let vigia: NodeJS.Timeout | undefined;

  const armarVigia = (): void => {
    clearTimeout(vigia);
    vigia = setTimeout(() => {
      if (!carregou) recuperar('sem did-finish-load no tempo limite');
    }, TEMPO_LIMITE_DE_CARREGAMENTO_MS);
  };

  const recuperar = (motivo: string): void => {
    if (janela.isDestroyed()) return;
    registrarDiagnostico(`recuperacao motivo=${motivo} tentativa=${tentativas + 1}`);
    if (tentativas >= MAXIMO_DE_TENTATIVAS_DE_RECUPERACAO) {
      dialog.showErrorBox(
        'Enfesto CAD não conseguiu mostrar a tela',
        `A interface não carregou depois de ${tentativas + 1} tentativas.\n\n` +
          `Envie este arquivo para o suporte:\n${path.join(app.getPath('userData'), 'diagnostico.log')}`,
      );
      return;
    }
    tentativas += 1;
    carregou = false;
    janela.webContents.reload();
    armarVigia();
  };

  janela.webContents.on('did-finish-load', () => {
    carregou = true;
    clearTimeout(vigia);
    registrarDiagnostico('did-finish-load');
  });
  janela.webContents.on('did-fail-load', (_e, codigo, descricao, url) => {
    registrarDiagnostico(`did-fail-load codigo=${codigo} descricao=${descricao} url=${url}`);
  });
  janela.webContents.on('render-process-gone', (_e, detalhes) => {
    registrarDiagnostico(`render-process-gone motivo=${detalhes.reason} codigo=${detalhes.exitCode}`);
    recuperar(`render-process-gone ${detalhes.reason}`);
  });
  janela.webContents.on('console-message', (evento) => {
    if (evento.level === 'error') registrarDiagnostico(`console-erro ${evento.message}`);
  });
  janela.once('closed', () => clearTimeout(vigia));

  armarVigia();
  const destino = VITE_DEV_SERVER_URL ?? URL_DA_INTERFACE;
  janela.loadURL(destino).catch((erro: Error) => {
    recuperar(`loadURL falhou: ${erro.message}`);
  });
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
  // Sem a barra de menu padrão do Electron (File/Edit/View/Window, em inglês):
  // os comandos do app ficam todos na faixa de abas. No Windows, copiar/colar
  // em campos de texto continua funcionando, porque é tratado pelo Chromium.
  Menu.setApplicationMenu(null);
  registrarProtocoloDoApp();
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
