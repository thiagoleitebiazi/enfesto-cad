import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, protocol, shell } from 'electron';
import { execFile } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  MODOS_DE_ABERTURA,
  NOME_DO_MODO,
  abertura,
  aoCancelar,
  aoFalhar,
  aoFechar,
  aoMostrarATela,
  aoResponderSeAbriuDireito,
  argumentosParaReabrir,
  devePerguntarSeAbriuDireito,
  fotoEstaPreta,
  lerEstado,
  lerLinhaDeComando,
  opcoesDoModo,
  prazosDeAbertura,
  type EstadoDaAbertura,
  type FalhaDeAbertura,
  type ModoDeAbertura,
} from '../src/domain/abertura';
import { criarFilaDeGravacao, gravarSemCorromper, idDeProjetoValido } from './gravacao';
import { adicionarPrograma, enderecoValido, lerProgramas, novoPrograma, removerPrograma, type Programa } from '../src/domain/programas';

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

/**
 * Diagnóstico local: quando a janela não renderiza na máquina de alguém, o
 * dev não tem como reproduzir — grava em <userData>/diagnostico.log o que
 * aconteceu na abertura (o modo, o computador, cada passo com o tempo em que
 * se deu, as falhas), para a pessoa poder enviar o arquivo. Nunca sai da
 * máquina sozinho.
 */
const INICIO_MS = Date.now();
const TAMANHO_MAXIMO_DO_DIAGNOSTICO = 512 * 1024;
let diagnosticoConferido = false;

function arquivoDeDiagnostico(): string {
  return path.join(app.getPath('userData'), 'diagnostico.log');
}

function registrarDiagnostico(mensagem: string): void {
  try {
    const arquivo = arquivoDeDiagnostico();
    if (!diagnosticoConferido) {
      diagnosticoConferido = true;
      mkdirSync(app.getPath('userData'), { recursive: true });
      // O arquivo não cresce sem fim: passado do tamanho, o que havia vira o "anterior" (um só).
      try {
        if (statSync(arquivo).size > TAMANHO_MAXIMO_DO_DIAGNOSTICO) renameSync(arquivo, path.join(app.getPath('userData'), 'diagnostico-anterior.log'));
      } catch {
        // Sem arquivo ainda.
      }
    }
    appendFileSync(arquivo, `${new Date().toISOString()} +${Date.now() - INICIO_MS}ms ${mensagem}\n`, 'utf-8');
  } catch {
    // Diagnóstico nunca pode derrubar o app.
  }
}

/** O mesmo erro de console repetido não enche o diagnóstico: cada mensagem é gravada três vezes, no máximo. */
const errosDeConsoleVistos = new Map<string, number>();
function registrarErroDeConsole(mensagem: string): void {
  const vezes = (errosDeConsoleVistos.get(mensagem) ?? 0) + 1;
  errosDeConsoleVistos.set(mensagem, vezes);
  if (vezes <= 3) registrarDiagnostico(`console-erro ${mensagem}${vezes === 3 ? ' (repetido: não é mais gravado nesta sessão)' : ''}`);
}

/**
 * A abertura (ver `src/domain/abertura.ts`): o estado guardado neste
 * computador diz em que modo abrir; o modo liga as opções do motor, que só
 * valem se postas antes do `ready`.
 */
function arquivoDaAbertura(): string {
  return path.join(app.getPath('userData'), 'abertura.json');
}

function lerEstadoGuardado(): EstadoDaAbertura {
  let texto: string | null = null;
  try {
    texto = readFileSync(arquivoDaAbertura(), 'utf-8');
  } catch {
    // Sem arquivo ainda: vale o estado inicial.
  }
  return lerEstado(texto, app.getVersion());
}

function guardarEstado(estado: EstadoDaAbertura): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(arquivoDaAbertura(), JSON.stringify(estado), 'utf-8');
  } catch {
    // Sem conseguir gravar, o programa abre do mesmo jeito: só não lembra do modo.
  }
}

// Uma instância só: abrir o programa de novo enquanto ele ainda está abrindo (a janela só aparece depois de desenhada)
// não começa outra abertura por cima da primeira.
const instanciaUnica = app.requestSingleInstanceLock();

const pedidoDeAbertura = lerLinhaDeComando(process.argv);
let estadoDaAbertura: EstadoDaAbertura = lerEstadoGuardado();
let modoDaSessao: ModoDeAbertura = estadoDaAbertura.modo;

if (instanciaUnica) {
  const comeco = abertura(estadoDaAbertura, pedidoDeAbertura);
  estadoDaAbertura = comeco.estado;
  modoDaSessao = comeco.modo;
  guardarEstado(estadoDaAbertura);

  const opcoes = opcoesDoModo(modoDaSessao);
  // Desenhar por software: sem isso, em máquinas com driver de vídeo incompatível ou desatualizado, GPU virtualizada
  // (VM) ou área de trabalho remota, o compositor do Chromium pode falhar e a janela abrir preta. É uma aplicação 2D
  // (Canvas, sem WebGL/3D): o custo é baixo. Precisa ser chamado antes de `app.whenReady()`.
  if (opcoes.semAceleracao) app.disableHardwareAcceleration();
  for (const opcao of opcoes.opcoes) app.commandLine.appendSwitch(opcao);
  const jaDesligados = app.commandLine.getSwitchValue('disable-features');
  app.commandLine.appendSwitch('disable-features', [...(jaDesligados === '' ? [] : jaDesligados.split(',')), ...opcoes.recursosDesligados].join(','));
}

/** Quem reage à queda do processo de vídeo enquanto a tela ainda não apareceu (a janela, se houver uma abrindo). */
let aoCairOProcessoDeVideo: ((motivo: string) => void) | null = null;

/** Reabre o programa em outro modo de abertura, no lugar desta instância. */
function reabrirEm(modo: ModoDeAbertura, tentados: readonly ModoDeAbertura[]): void {
  registrarDiagnostico(`reabrindo modo=${modo} tentados=${tentados.join(',')}`);
  app.releaseSingleInstanceLock();
  app.relaunch({ args: argumentosParaReabrir(process.argv.slice(1), modo, tentados) });
  app.exit(0);
}

/** Os antivírus que o Windows conhece neste computador (só é perguntado quando a tela não aparece em modo nenhum). */
function antivirusDoComputador(): Promise<string> {
  return new Promise((resolver) => {
    if (process.platform !== 'win32') {
      resolver('não perguntado');
      return;
    }
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', "(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct | ForEach-Object { $_.displayName }) -join '; '"],
      { timeout: 8000, windowsHide: true },
      (erro, saida) => resolver(erro ? 'não foi possível saber' : saida.trim() || 'nenhum informado pelo Windows'),
    );
  });
}

/** O fim do diagnóstico gravado, para a pessoa copiar e mandar. */
function fimDoDiagnostico(): string {
  try {
    return readFileSync(arquivoDeDiagnostico(), 'utf-8').split('\n').slice(-80).join('\n');
  } catch {
    return '(sem diagnóstico gravado)';
  }
}

/**
 * A tela não apareceu em nenhum modo: diz isso por uma caixa do próprio
 * Windows — que não depende do motor de tela —, com o que fazer e com o
 * diagnóstico à mão. A janela é mostrada como está, para a caixa ficar
 * presa a ela: assim o programa aparece na barra de tarefas, e a caixa não
 * fica perdida atrás das outras janelas. Depois encerra.
 */
async function avisarQueNaoAbriu(motivo: string, tentados: readonly ModoDeAbertura[], janela: BrowserWindow): Promise<void> {
  const antivirus = await antivirusDoComputador();
  const resumo = `Windows ${os.release()}, ${os.arch()}; antivírus: ${antivirus}; modos tentados: ${tentados.map((m) => NOME_DO_MODO[m]).join(', ')}; último motivo: ${motivo}.`;
  registrarDiagnostico(`nao-abriu ${resumo}`);
  if (!janela.isDestroyed()) janela.show();
  for (;;) {
    const opcoes: Electron.MessageBoxOptions = {
      type: 'error',
      title: 'Enfesto CAD',
      message: 'O Enfesto CAD não conseguiu mostrar a tela neste computador',
      detail:
        `O programa tentou abrir de ${tentados.length} modos diferentes, e em nenhum a tela apareceu.\n\n` +
        'O mais comum é um antivírus ou outro programa de segurança estar impedindo. Tente, nesta ordem:\n' +
        '1. Pôr o Enfesto CAD nas exceções do antivírus e abrir de novo.\n' +
        '2. Reiniciar o computador e abrir de novo.\n\n' +
        'Se continuar, use "Copiar o diagnóstico" e cole numa mensagem para quem lhe passou o programa: ele diz o que aconteceu neste computador.\n\n' +
        `Resumo: ${resumo}`,
      buttons: ['Copiar o diagnóstico', 'Abrir a pasta do diagnóstico', 'Fechar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    };
    const resposta = await (janela.isDestroyed() ? dialog.showMessageBox(opcoes) : dialog.showMessageBox(janela, opcoes));
    if (resposta.response === 0) clipboard.writeText(`Enfesto CAD ${app.getVersion()} — a tela não apareceu.\n${resumo}\n\n${fimDoDiagnostico()}`);
    else if (resposta.response === 1) shell.showItemInFolder(arquivoDeDiagnostico());
    else break;
  }
  app.exit(0);
}

function criarJanelaPrincipal(): void {
  const janela = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    // A janela só aparece depois de desenhada e conferida: quem usa o programa nunca vê uma janela preta à espera.
    show: false,
    backgroundColor: '#e8e9eb',
    title: 'Enfesto CAD',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const prazos = prazosDeAbertura(process.env.ENFESTO_CAD_PRAZO_DE_ABERTURA_S);
  const tentados = pedidoDeAbertura.tentados;
  registrarDiagnostico(
    `inicio versao=${app.getVersion()} modo=${modoDaSessao} tentados=${tentados.join(',') || '-'} guardado=${JSON.stringify(estadoDaAbertura)} ` +
      `plataforma=${process.platform} windows=${os.release()} arch=${process.arch} cpu="${os.cpus()[0]?.model ?? '?'}" nucleos=${os.cpus().length} ` +
      `memoriaMB=${Math.round(os.totalmem() / 1048576)} livreMB=${Math.round(os.freemem() / 1048576)} idioma=${app.getLocale()} ` +
      `exe=${process.execPath} gpu=${JSON.stringify(app.getGPUFeatureStatus())}`,
  );

  // ---- A abertura: da janela criada até a tela desenhada, conferida e mostrada.
  let navegou = false;
  let mostradaEm: number | null = null;
  let desistiu = false;
  let conferindo = false;
  let prontaParaMostrar = false;
  let fotosSemResposta = 0;
  let ultimaFotoPreta = false;
  const relogios: { pagina?: NodeJS.Timeout; pintura?: NodeJS.Timeout; aviso?: NodeJS.Timeout; conferencia?: NodeJS.Timeout } = {};
  const aviso = new AbortController();

  const pararRelogios = (): void => {
    for (const relogio of Object.values(relogios)) clearTimeout(relogio);
  };

  /** A abertura neste modo falhou: o programa reabre no modo seguinte, ou, acabados os modos, diz que não abriu. */
  const falhar = (falha: FalhaDeAbertura, motivo: string): void => {
    if (desistiu || mostradaEm !== null) return;
    desistiu = true;
    pararRelogios();
    aviso.abort();
    registrarDiagnostico(`abertura-falhou modo=${modoDaSessao} lado=${falha} motivo=${motivo}`);
    const resultado = aoFalhar(estadoDaAbertura, modoDaSessao, falha, tentados);
    estadoDaAbertura = resultado.estado;
    guardarEstado(estadoDaAbertura);
    if (resultado.proximo !== null) reabrirEm(resultado.proximo, [...tentados, modoDaSessao]);
    else void avisarQueNaoAbriu(motivo, [...tentados, modoDaSessao], janela);
  };

  const cancelar = (): void => {
    if (desistiu || mostradaEm !== null) return;
    desistiu = true;
    pararRelogios();
    registrarDiagnostico('abertura-cancelada');
    estadoDaAbertura = aoCancelar(estadoDaAbertura);
    guardarEstado(estadoDaAbertura);
    app.exit(0);
  };

  const mostrar = (conferida: boolean): void => {
    if (desistiu || mostradaEm !== null || janela.isDestroyed()) return;
    mostradaEm = Date.now();
    pararRelogios();
    aviso.abort();
    aoCairOProcessoDeVideo = null;
    estadoDaAbertura = aoMostrarATela(estadoDaAbertura, modoDaSessao);
    guardarEstado(estadoDaAbertura);
    janela.maximize();
    janela.show();
    janela.focus();
    registrarDiagnostico(`tela-mostrada modo=${modoDaSessao} conferida=${conferida}`);
  };

  /**
   * Confere, por uma foto da página, se o vídeo desenhou de verdade. Foto
   * clara: a janela aparece. Foto preta: é a tela preta — a conferência se
   * repete até o prazo do desenho, que dá a abertura como falha. Sem foto
   * (a página ainda não desenhou, ou o motor não respondeu), espera e
   * repete; mas, se a página já avisou que desenhou e a foto não vem duas
   * vezes, a janela aparece sem conferir: não dá para afirmar que está preta.
   */
  const conferirDesenho = async (): Promise<void> => {
    if (desistiu || mostradaEm !== null || conferindo || janela.isDestroyed()) return;
    conferindo = true;
    let pontos: Buffer | null = null;
    try {
      const imagem = await Promise.race([janela.webContents.capturePage(), new Promise<null>((resolver) => setTimeout(() => resolver(null), 3000))]);
      pontos = imagem && !imagem.isEmpty() ? imagem.toBitmap() : null;
    } catch {
      pontos = null;
    }
    conferindo = false;
    if (desistiu || mostradaEm !== null) return;
    if (pontos === null) {
      if (prontaParaMostrar) fotosSemResposta += 1;
      registrarDiagnostico(`foto-sem-resposta desenhou=${prontaParaMostrar} vez=${fotosSemResposta}`);
      if (fotosSemResposta >= 2) {
        mostrar(false);
        return;
      }
    } else if (nativeTheme.shouldUseHighContrastColors || nativeTheme.inForcedColorsMode || !fotoEstaPreta(pontos, pontos.length / 4, 1)) {
      // (No alto contraste do Windows a página fica escura de propósito: lá, a foto preta não quer dizer tela preta.)
      mostrar(true);
      return;
    } else if (!ultimaFotoPreta) {
      ultimaFotoPreta = true;
      registrarDiagnostico('foto-preta');
    }
    relogios.conferencia = setTimeout(() => void conferirDesenho(), 700);
  };

  const mostrarAviso = (): void => {
    if (desistiu || mostradaEm !== null) return;
    registrarDiagnostico('aviso-de-demora');
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Enfesto CAD',
        message: 'Abrindo o Enfesto CAD…',
        detail:
          tentados.length === 0
            ? 'Neste computador a abertura está demorando mais que o normal. Aguarde: se a tela não aparecer, o programa tenta sozinho outro modo de abertura.'
            : `A tela não apareceu no modo anterior. Tentando outro modo de abertura (${NOME_DO_MODO[modoDaSessao]}, tentativa ${tentados.length + 1} de ${MODOS_DE_ABERTURA.length}). Aguarde.`,
        buttons: ['Cancelar a abertura'],
        noLink: true,
        signal: aviso.signal,
      })
      .then((resposta) => {
        // Fechada pelo próprio programa (a tela apareceu, ou ele vai reabrir), a caixa responde como cancelada: só o clique conta.
        if (!aviso.signal.aborted && resposta.response === 0) cancelar();
      });
  };

  aoCairOProcessoDeVideo = (motivo) => falhar('video', `o processo de vídeo caiu (${motivo})`);
  relogios.pagina = setTimeout(() => falhar('pagina', `a página não começou a carregar em ${Math.round(prazos.paginaMs / 1000)} s`), prazos.paginaMs);
  // Na continuação de uma abertura que falhou, o aviso vem logo: a pessoa já esperou o modo anterior.
  relogios.aviso = setTimeout(mostrarAviso, tentados.length === 0 ? prazos.avisoMs : 300);

  janela.webContents.on('did-navigate', () => {
    if (navegou) return;
    navegou = true;
    clearTimeout(relogios.pagina);
    registrarDiagnostico('pagina-comecou-a-carregar');
    relogios.pintura = setTimeout(
      () => falhar('video', ultimaFotoPreta ? 'a página carregou, mas a foto dela está preta' : `a página carregou, mas nada foi desenhado em ${Math.round(prazos.pinturaMs / 1000)} s`),
      prazos.pinturaMs,
    );
  });
  janela.once('ready-to-show', () => {
    prontaParaMostrar = true;
    registrarDiagnostico('pronta-para-mostrar');
    void conferirDesenho();
  });

  // ---- Depois de aberta: a página que para de responder ou cai é recarregada (ADR 0026).
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
          `Envie este arquivo para o suporte:\n${arquivoDeDiagnostico()}`,
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
    void conferirDesenho();
  });
  janela.webContents.on('did-fail-load', (_e, codigo, descricao, url, noQuadroPrincipal) => {
    registrarDiagnostico(`did-fail-load codigo=${codigo} descricao=${descricao} url=${url}`);
    // -3 é a navegação interrompida por outra (um recarregamento): não é a página que não existe.
    if (noQuadroPrincipal && codigo !== -3) falhar('pagina', `a página não carregou (${codigo} ${descricao})`);
  });
  janela.webContents.on('render-process-gone', (_e, detalhes) => {
    registrarDiagnostico(`render-process-gone motivo=${detalhes.reason} codigo=${detalhes.exitCode}`);
    if (mostradaEm === null) falhar('pagina', `o processo da página caiu (${detalhes.reason}, código ${detalhes.exitCode})`);
    else recuperar(`render-process-gone ${detalhes.reason}`);
  });
  janela.webContents.on('console-message', (evento) => {
    if (evento.level === 'error') registrarErroDeConsole(evento.message);
  });
  janela.on('unresponsive', () => registrarDiagnostico('janela-nao-responde'));
  janela.once('closed', () => {
    clearTimeout(vigia);
    pararRelogios();
    aoCairOProcessoDeVideo = null;
    if (mostradaEm !== null) {
      estadoDaAbertura = aoFechar(estadoDaAbertura, (Date.now() - mostradaEm) / 1000);
      guardarEstado(estadoDaAbertura);
    }
  });

  const destino = VITE_DEV_SERVER_URL ?? URL_DA_INTERFACE;
  janela.loadURL(destino).catch((erro: Error) => {
    registrarDiagnostico(`loadURL falhou: ${erro.message}`);
    if (mostradaEm !== null) recuperar(`loadURL falhou: ${erro.message}`);
  });
}

// A interface avisa quando está montada e desenhando: fica no diagnóstico, com o tempo que levou.
ipcMain.on('interface-pronta', () => registrarDiagnostico('interface-pronta'));

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

// Um salvamento de cada vez por projeto, e cada um gravado sem deixar o arquivo pela metade.
const filaDeGravacao = criarFilaDeGravacao();

ipcMain.handle('salvar-projeto', async (_evento, projeto: { id: string }) => {
  if (!idDeProjetoValido(projeto?.id)) throw new Error('Projeto sem um código válido para virar nome de arquivo.');
  const dir = await garantirDiretorioDeProjetos();
  const conteudo = JSON.stringify(projeto, null, 2);
  await filaDeGravacao(projeto.id, () => gravarSemCorromper(path.join(dir, `${projeto.id}.json`), conteudo));
  return true;
});

ipcMain.handle('excluir-projeto', async (_evento, id: string) => {
  if (!idDeProjetoValido(id)) throw new Error('Código de projeto inválido.');
  const dir = await garantirDiretorioDeProjetos();
  await filaDeGravacao(id, () => unlink(path.join(dir, `${id}.json`)));
  return true;
});

/**
 * Atalhos para outros programas (aba Início > Programas). A lista mora aqui,
 * no processo principal, em <userData>/programas.json: a interface só pede
 * "abra o atalho tal", pelo id — nunca manda um caminho para abrir. Um
 * arquivo só entra na lista pela janela de escolha do sistema, e um endereço,
 * só se for http ou https.
 */
function arquivoDeProgramas(): string {
  return path.join(app.getPath('userData'), 'programas.json');
}

async function lerListaDeProgramas(): Promise<Programa[]> {
  try {
    return lerProgramas(JSON.parse(await readFile(arquivoDeProgramas(), 'utf-8')));
  } catch {
    // Sem arquivo ainda, ou ilegível: começa da lista vazia.
    return [];
  }
}

async function gravarListaDeProgramas(lista: readonly Programa[]): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true });
  await gravarSemCorromper(arquivoDeProgramas(), JSON.stringify(lista, null, 2));
}

function novoIdDePrograma(): string {
  return `programa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A lista depois da mudança, ou a de antes com a mensagem do que impediu. */
async function mudarProgramas(mudar: (lista: Programa[]) => Programa[]): Promise<{ lista: Programa[]; erro: string | null }> {
  const lista = await lerListaDeProgramas();
  try {
    const nova = mudar(lista);
    await gravarListaDeProgramas(nova);
    return { lista: nova, erro: null };
  } catch (e) {
    return { lista, erro: e instanceof Error ? e.message : String(e) };
  }
}

ipcMain.handle('programas-listar', () => lerListaDeProgramas());

ipcMain.handle('programas-adicionar-arquivo', async (_evento, nome: unknown) => {
  const resultado = await dialog.showOpenDialog({
    title: 'Escolher o programa ou o arquivo do atalho',
    properties: ['openFile'],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  const alvo = resultado.filePaths[0]!;
  return mudarProgramas((lista) => adicionarPrograma(lista, novoPrograma(novoIdDePrograma(), String(nome ?? ''), 'arquivo', alvo)));
});

ipcMain.handle('programas-adicionar-endereco', (_evento, dados: { nome?: unknown; endereco?: unknown }) =>
  mudarProgramas((lista) =>
    adicionarPrograma(lista, novoPrograma(novoIdDePrograma(), String(dados?.nome ?? ''), 'endereco', String(dados?.endereco ?? ''))),
  ),
);

ipcMain.handle('programas-remover', (_evento, id: unknown) => mudarProgramas((lista) => removerPrograma(lista, String(id))));

/** Abre o atalho; devolve a mensagem do erro, ou `null` se abriu. */
ipcMain.handle('programas-abrir', async (_evento, id: unknown) => {
  const programa = (await lerListaDeProgramas()).find((p) => p.id === id);
  if (!programa) return 'Atalho não encontrado.';
  try {
    if (programa.tipo === 'endereco') {
      await shell.openExternal(enderecoValido(programa.alvo));
      return null;
    }
    if (!path.isAbsolute(programa.alvo)) return 'O caminho do atalho não é válido. Remova-o e cadastre de novo.';
    const erro = await shell.openPath(programa.alvo);
    return erro === '' ? null : `Não foi possível abrir “${programa.nome}”: ${erro}`;
  } catch (e) {
    return `Não foi possível abrir “${programa.nome}”: ${e instanceof Error ? e.message : String(e)}`;
  }
});

/**
 * Fechado logo depois de abrir, duas vezes seguidas: pode ser a janela preta
 * que o programa não tem como ver (o motor desenha, e a janela não mostra).
 * Pergunta, por uma caixa do próprio Windows; se a resposta é que ficou
 * preta, reabre no modo seguinte. Devolve `true` se o programa vai reabrir.
 */
async function perguntarSeAbriuDireito(): Promise<boolean> {
  if (pedidoDeAbertura.modo !== null || !devePerguntarSeAbriuDireito(estadoDaAbertura)) return false;
  const resposta = await dialog.showMessageBox({
    type: 'question',
    title: 'Enfesto CAD',
    message: 'A janela do Enfesto CAD abriu direito da última vez?',
    detail: 'O programa foi fechado logo depois de abrir, duas vezes seguidas. Se a janela ficou preta ou vazia, ele passa a abrir em outro modo.',
    buttons: ['Sim, abriu direito', 'Não, ficou preta ou vazia'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  const abriu = resposta.response === 0;
  registrarDiagnostico(`pergunta-se-abriu-direito resposta=${abriu ? 'sim' : 'nao'}`);
  estadoDaAbertura = aoResponderSeAbriuDireito(estadoDaAbertura, abriu);
  guardarEstado(estadoDaAbertura);
  if (abriu) return false;
  reabrirEm(estadoDaAbertura.modo, []);
  return true;
}

if (!instanciaUnica) {
  // O programa já está aberto (ou abrindo): esta segunda instância sai, e a primeira traz a janela dela para a frente.
  app.exit(0);
} else {
  process.on('uncaughtException', (erro) => {
    registrarDiagnostico(`erro-no-processo-principal ${erro.stack ?? erro.message}`);
    dialog.showErrorBox('Enfesto CAD', `Aconteceu um erro no programa:\n\n${erro.message}\n\nO que aconteceu ficou gravado em:\n${arquivoDeDiagnostico()}`);
  });

  app.on('child-process-gone', (_e, detalhes) => {
    registrarDiagnostico(`child-process-gone tipo=${detalhes.type} motivo=${detalhes.reason} codigo=${detalhes.exitCode}${detalhes.serviceName ? ` servico=${detalhes.serviceName}` : ''}`);
    if (detalhes.type === 'GPU') aoCairOProcessoDeVideo?.(`${detalhes.reason}, código ${detalhes.exitCode}`);
  });

  app.on('second-instance', () => {
    const janela = BrowserWindow.getAllWindows()[0];
    if (!janela || !janela.isVisible()) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  });

  app.whenReady().then(async () => {
    // Sem a barra de menu padrão do Electron (File/Edit/View/Window, em inglês):
    // os comandos do app ficam todos na faixa de abas. No Windows, copiar/colar
    // em campos de texto continua funcionando, porque é tratado pelo Chromium.
    Menu.setApplicationMenu(null);
    registrarProtocoloDoApp();
    if (await perguntarSeAbriuDireito()) return;
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
}
