/* global fetch */
/*
 * O laboratório de validação (ADR 0216): usa o programa gerado, de verdade, no que os testes unitários não alcançam —
 * o cálculo em segundo plano, o bundle de produção, o processo principal, as portas, os arquivos e a tela. O que iria
 * para uma máquina vai para o plotter virtual, que interpreta tudo sozinho. Não tira fotos: confere pelo que a tela
 * mostra, pelos arquivos gravados e pelos pixels da janela.
 *
 *   npm run build
 *   npx electron scripts/validacao/main.cjs
 *
 * O resultado vai para SAIDA_DA_VALIDACAO (ou ./validacao). Os dados ficam numa pasta temporária: os projetos de quem
 * roda não são tocados. O servidor de colaboração ouve só neste computador. Sai com 0 se tudo conferiu.
 */
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { criarPlotterVirtual, interpretarHpgl, interpretarIso, melhorDesvio } = require('./plotter-virtual.cjs');
const DxfParser = require('dxf-parser');

const RAIZ = path.resolve(__dirname, '..', '..');
const SAIDA = path.resolve(process.env.SAIDA_DA_VALIDACAO || path.join(process.cwd(), 'validacao'));
const DXF = path.join(RAIZ, 'scripts', 'teste-de-uso', 'molde-de-teste.dxf');
const ARIAL = 'C:/Windows/Fonts/arial.ttf';
let arquivoParaAbrir = DXF;

fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });
const REGISTRO = path.join(SAIDA, 'validacao.txt');
const log = (t) => {
  fs.appendFileSync(REGISTRO, t + '\n');
  console.log(t);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// A janela coberta por outra para de desenhar e perde o clique simulado: quem usa clica na de cima, e isso não acontece.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'enfesto-cad-validacao-'));
app.setPath('userData', DADOS);
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [arquivoParaAbrir] });
dialog.showSaveDialog = async (o) => ({ canceled: false, filePath: path.join(SAIDA, path.basename((o && o.defaultPath) || 'saida.bin')) });
dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
shell.openExternal = async () => undefined;
shell.openPath = async () => '';

// O servidor de colaboração só ouve neste computador durante a validação: nada fica aberto na rede.
const ouvirDeVerdade = net.Server.prototype.listen;
net.Server.prototype.listen = function ouvir(...args) {
  if (args[1] === '0.0.0.0') args[1] = '127.0.0.1';
  return ouvirDeVerdade.apply(this, args);
};

/** O que o programa vê de cada janela, quando o arranjo é pedido. */
const janelasAgora = () => BrowserWindow.getAllWindows().map((j) => ({ id: j.id, vis: j.isVisible(), min: j.isMinimized(), max: j.isMaximized(), b: j.getBounds() }));
const chamadasDoArranjo = [];
const tratar = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (canal, f) =>
  tratar(canal, canal !== 'janelas-arrumar' ? f : async (e, como) => {
    chamadasDoArranjo.push({ como, antes: janelasAgora() });
    try {
      return await f(e, como);
    } catch (erro) {
      chamadasDoArranjo.push({ erro: String(erro) });
      throw erro;
    } finally {
      chamadasDoArranjo.push({ depois: janelasAgora() });
    }
  });

require(path.join(RAIZ, 'dist-electron', 'main.js'));

let falhas = 0;
let acertos = 0;
const conferir = (rotulo, condicao, detalhe = '') => {
  if (condicao) acertos++;
  else falhas++;
  log((condicao ? 'ok    ' : 'FALHA ') + rotulo + (detalhe !== '' ? ' — ' + detalhe : ''));
};

/** A distância entre duas linhas fechadas, vértice contra aresta, nos dois sentidos. */
function distancia(a, b) {
  const pontoSegmento = (p, q, r) => {
    const dx = r.x - q.x;
    const dy = r.y - q.y;
    const t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - q.x - t * dx, p.y - q.y - t * dy);
  };
  let d = Infinity;
  for (const [u, v] of [[a, b], [b, a]]) for (const p of u) for (let i = 0; i < v.length; i++) d = Math.min(d, pontoSegmento(p, v[i], v[(i + 1) % v.length]));
  return d;
}
const caixa = (c) => ({ minX: Math.min(...c.map((p) => p.x)), maxX: Math.max(...c.map((p) => p.x)), minY: Math.min(...c.map((p) => p.y)), maxY: Math.max(...c.map((p) => p.y)) });

async function principal() {
  await app.whenReady();
  let win = null;
  for (let i = 0; i < 120 && !win; i++) {
    win = BrowserWindow.getAllWindows().find((w) => w.isVisible()) || null;
    if (!win) await espera(500);
  }
  if (!win) throw new Error('a janela do programa não apareceu em 60 s');
  win.webContents.setBackgroundThrottling(false);
  win.setBounds({ x: 0, y: 0, width: 1440, height: 900 });
  await espera(1500);

  const errosDoConsole = [];
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' && !String(e.message).includes('ResizeObserver loop')) errosDoConsole.push(String(e.message).slice(0, 220));
  });
  let caiu = '';
  win.webContents.on('render-process-gone', (_e, d) => (caiu = d.reason));

  const js = (codigo) => win.webContents.executeJavaScript(codigo);
  const prepararPagina = () => js(`(() => { window.__erros = []; window.addEventListener('error', (e) => { if (!String(e.message).startsWith('ResizeObserver loop')) window.__erros.push(String(e.message)); }); window.addEventListener('unhandledrejection', (e) => window.__erros.push(String(e.reason))); window.alert = () => undefined; window.confirm = () => true; window.prompt = () => null; })()`);
  await prepararPagina();

  // Sem transições: a cor lida tem de ser a final, não uma do meio do caminho.
  await win.webContents.insertCSS('*, *::before, *::after { transition: none !important; animation: none !important; }');

  const esperarAte = async (pergunta, ms = 30000) => {
    const fim = Date.now() + ms;
    for (;;) {
      const r = await pergunta();
      if (r) return r;
      if (Date.now() > fim) return null;
      await espera(150);
    }
  };
  const tecla = async (keyCode, modifiers = []) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await espera(250);
  };
  const clicarEm = async (expressao) => {
    await js(`(() => { const e = (${expressao}); if (!e) throw new Error('não achei: ' + ${JSON.stringify(expressao.slice(0, 120))}); e.scrollIntoView({ block: 'center' }); })()`);
    const r = JSON.parse(await js(`JSON.stringify((${expressao}).getBoundingClientRect())`));
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    await espera(350);
  };
  const aba = (nome) => clicarEm(`Array.from(document.querySelectorAll('.ribbon-aba')).find(b => b.textContent === ${JSON.stringify(nome)})`);
  const botao = (rotulo) => clicarEm(`Array.from(document.querySelectorAll('.grupo-de-ferramentas button')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
  const botaoNaJanela = (texto) => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === ${JSON.stringify(texto)})`);
  const janela = () => js(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.getAttribute('aria-label') : 'nenhuma'; })()`);
  const fecharJanela = () => js(`(document.querySelector('[role=dialog] .sobreposicao-fechar') || { click() {} }).click()`);
  const abrirMenu = async (rotulo) => {
    const aberto = await js(`(document.querySelector('[role=menu]') || { getAttribute() { return ''; } }).getAttribute('aria-label')`);
    if (aberto === rotulo) return;
    await clicarEm(`Array.from(document.querySelectorAll('.botao-de-menu')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
  };
  const fecharMenu = () => js(`(() => { if (document.querySelector('[role=menu]')) document.querySelector('.botao-de-menu-aberto').click(); })()`);
  const menu = async (rotulo, trecho) => {
    await abrirMenu(rotulo);
    const itens = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).map((b) => b.textContent.trim()))`));
    if (!itens.some((i) => i.includes(trecho))) throw new Error(`"${trecho}" não está em ${rotulo}: ${itens.join(' | ').slice(0, 160)}`);
    await clicarEm(`Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).find(b => b.textContent.includes(${JSON.stringify(trecho)}))`);
    await espera(250);
  };
  const itensDoMenu = async (rotulo) => {
    await abrirMenu(rotulo);
    const itens = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).map(b => b.textContent.trim()))`));
    await fecharMenu();
    await espera(150);
    return itens;
  };
  const porNoCampo = (rotulo, valor) =>
    js(`(() => {
      const r = ${JSON.stringify(rotulo)};
      const raiz = document.querySelector('[role=dialog]') || document;
      const l = Array.from(raiz.querySelectorAll('label')).find((x) => x.textContent.trim().startsWith(r));
      const c = l && (l.querySelector('input,textarea,select') || document.getElementById(l.htmlFor));
      if (!c) throw new Error('campo não achado: ' + r);
      const proto = c.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : c.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(c, ${JSON.stringify(valor)});
      c.dispatchEvent(new Event('input', { bubbles: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  const marcarCaixa = (rotulo) => clicarEm(`Array.from((document.querySelector('[role=dialog]') || document).querySelectorAll('label')).find((x) => x.textContent.trim().startsWith(${JSON.stringify(rotulo)})).querySelector('input')`);
  const lista = () => js(`JSON.stringify(Array.from(document.querySelectorAll('.lista-de-pecas li .texto-do-item-de-peca')).map((e) => e.textContent))`).then(JSON.parse);
  const selecionarPeca = (i) => clicarEm(`document.querySelectorAll('.lista-de-pecas li .texto-do-item-de-peca')[${i}]`);
  /** A janela de propriedades da peça: dois cliques na lista. */
  const propriedades = async (i) => {
    const r = JSON.parse(await js(`JSON.stringify(document.querySelectorAll('.lista-de-pecas li .texto-do-item-de-peca')[${i}].getBoundingClientRect())`));
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    for (const clickCount of [1, 2]) {
      win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount });
      win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount });
    }
    if (!(await esperarAte(async () => (await janela()) !== 'nenhuma', 4000))) throw new Error('a janela de propriedades não abriu');
  };
  const validacao = () => js(`(document.querySelector('.indicador-de-validacao') || {}).textContent || ''`);
  /** O que a validação acusa, por extenso: abre a janela dela, lê e fecha. */
  const problemas = async () => {
    await clicarEm(`document.querySelector('.indicador-de-validacao')`);
    await espera(300);
    const texto = await js(`Array.from(document.querySelectorAll('li[class^=severidade-]')).map((l) => l.innerText).join(' | ').replace(/\\s+/g, ' ')`);
    await clicarEm(`document.querySelector('.indicador-de-validacao')`);
    return texto.slice(0, 300);
  };
  const estadoGravado = async () => {
    await js(`document.querySelector('.app-shell').focus()`);
    await tecla('s', ['control']);
    await espera(900);
    const pasta = path.join(DADOS, 'projetos');
    const projetos = fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')));
    return projetos.sort((a, b) => b.modificadoEmIso.localeCompare(a.modificadoEmIso))[0].estadoAtual;
  };
  /** O nesting pela janela, com o cálculo de verdade em segundo plano. */
  const encaixar = async (antes = async () => undefined) => {
    await aba('Encaixe');
    await botao('Nesting Automático');
    await espera(500);
    await antes();
    await botaoNaJanela('Calcular encaixe');
    const pronto = await esperarAte(() => js(`(() => { const b = Array.from(document.querySelectorAll('[role=dialog] button')).find((x) => x.textContent.trim() === 'Aplicar ao projeto'); return !!b && !b.disabled; })()`), 90000);
    if (!pronto) throw new Error('o cálculo do encaixe não terminou');
    await botaoNaJanela('Aplicar ao projeto');
    await espera(600);
  };
  // Só algumas etapas (para repetir uma sem esperar todas): SO_ETAPAS=Importar,cores
  const escolhidas = (process.env.SO_ETAPAS || '').split(',').filter((e) => e !== '');
  const etapa = async (nome, fazer) => {
    if (escolhidas.length > 0 && !escolhidas.some((e) => nome.includes(e))) return;
    log(`\n# ${nome}`);
    try {
      await fazer();
    } catch (e) {
      conferir(`${nome}: a etapa chegou ao fim`, false, e.message.slice(0, 240));
      await fecharJanela().catch(() => undefined);
    }
    const erros = JSON.parse(await js(`JSON.stringify(window.__erros.splice(0))`).catch(() => '["a página não responde"]'));
    if (erros.length > 0) conferir(`${nome}: sem erro na página`, false, erros.slice(0, 3).join(' | ').slice(0, 300));
  };

  log(`sistema: ${process.platform} ${os.release()} (${process.arch}), Electron ${process.versions.electron}`);

  await etapa('Importar', async () => {
    await aba('Início');
    await botao('Importar DXF');
    conferir('as 3 peças de teste na lista', (await esperarAte(async () => (await lista()).length === 3, 15000)) === true);
    await clicarEm(`document.querySelector('.barra-de-visualizacao button[aria-label="Ajustar à tela"]')`);
  });

  await etapa('A envolvente, no cálculo de verdade', async () => {
    await selecionarPeca(0);
    await aba('Encaixe');
    await menu('Posicionar', 'Criar envolvente');
    conferir('abre a janela da envolvente', (await janela()) === 'Configuração envolvente de grupo', await janela());
    await porNoCampo('Margem', '30');
    await botaoNaJanela('Aplicar');
    await encaixar();
    const { pecas } = await estadoGravado();
    const [a, ...resto] = [...pecas].sort((p, q) => (p.envolvente ? -1 : q.envolvente ? 1 : 0));
    conferir('só uma peça ficou com a envolvente', Boolean(a.envolvente) && resto.every((p) => !p.envolvente));
    const d = Math.min(...resto.map((p) => distancia(a.contorno, p.contorno)));
    conferir('a peça fica a 30 mm das vizinhas', d >= 29.9, `${d.toFixed(2)} mm`);
    conferir('a validação não acusa nada', (await validacao()) === 'Validação: sem problemas', await validacao());
    await selecionarPeca(0);
    await menu('Posicionar', 'Eliminar envolvente');
    const depois = await estadoGravado();
    conferir('eliminar tira a envolvente de todas', depois.pecas.every((p) => !p.envolvente));
  });

  await etapa('O grupo que anda junto', async () => {
    await js(`document.querySelector('.app-shell').focus()`);
    await tecla('a', ['control']);
    await tecla('g', ['control']);
    const antes = await estadoGravado();
    conferir('Ctrl+G põe as 3 no mesmo grupo', new Set(antes.pecas.map((p) => p.conjuntoRigido)).size === 1 && Boolean(antes.pecas[0].conjuntoRigido), String(antes.pecas[0].conjuntoRigido));
    const separacao = (l) => {
      const m = new Map(l.map((p) => [p.id.split('#')[0], p.contorno[0]]));
      const ids = [...m.keys()].sort();
      return ids.flatMap((u, i) => ids.slice(i + 1).map((v) => Math.hypot(m.get(u).x - m.get(v).x, m.get(u).y - m.get(v).y)));
    };
    await encaixar();
    const depois = await estadoGravado();
    conferir('as 3 voltam da conta', depois.pecas.length === 3, String(depois.pecas.length));
    const [s0, s1] = [separacao(antes.pecas), separacao(depois.pecas)];
    const maior = s0.length === s1.length ? Math.max(...s0.map((v, i) => Math.abs(v - s1[i]))) : Infinity;
    conferir('as distâncias entre as peças do grupo não mudam', maior < 0.01, `${maior.toFixed(4)} mm`);
    await js(`document.querySelector('.app-shell').focus()`);
    await tecla('a', ['control']);
    await tecla('u', ['control']);
    const fora = await estadoGravado();
    conferir('Ctrl+U desfaz o grupo', fora.pecas.every((p) => !p.conjuntoRigido));
  });

  await etapa('Os blocos na vertical', async () => {
    for (const [i, t] of ['P', 'M', 'G'].entries()) {
      await propriedades(i);
      await porNoCampo('Tamanho', t);
      await espera(150);
      await fecharJanela();
      await espera(150);
    }
    await encaixar(async () => {
      await marcarCaixa('Encaixar em blocos');
      await espera(200);
      await marcarCaixa('Separação completa dos blocos');
      await espera(200);
      await porNoCampo('Orientação dos blocos', 'vertical');
      await espera(200);
    });
    const { pecas, enfesto } = await estadoGravado();
    const por = (t) => caixa(pecas.filter((p) => p.tamanho === t).flatMap((p) => p.contorno));
    const [p, m, g] = ['P', 'M', 'G'].map(por);
    conferir('um bloco abaixo do outro, na ordem dos tamanhos', m.minX >= p.maxX - 0.01 && g.minX >= m.maxX - 0.01, JSON.stringify([p.minX, p.maxX, m.minX, m.maxX, g.minX, g.maxX].map(Math.round)));
    const dentro = pecas.every((q) => {
      const c = caixa(q.contorno);
      return c.minX >= 0 && c.maxX <= enfesto.larguraUtilMm && c.minY >= 0 && c.maxY <= enfesto.comprimentoMm;
    });
    conferir('tudo dentro da mesa', dentro);
    const semProblemas = (await validacao()) === 'Validação: sem problemas';
    conferir('a validação não acusa nada', semProblemas, semProblemas ? '' : await problemas());
  });

  await etapa('O tecido ativo', async () => {
    const tecidoDaPeca = async (i, nome) => {
      await propriedades(i);
      await js(`(() => { const c = document.querySelector('input[list="tecidos-do-molde"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, ${JSON.stringify(nome)}); c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await espera(250);
      await fecharJanela();
      await espera(250);
    };
    await tecidoDaPeca(1, 'Forro');
    const abas = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('.abas-de-tecido button')).map((b) => b.textContent))`));
    conferir('uma aba por tecido, mais Todos', abas.join('|') === 'Todos|Principal|Forro', abas.join('|'));
    const visivel = await js(`(() => { const a = document.querySelector('.abas-de-tecido'); if (!a) return false; const r = a.getBoundingClientRect(); return r.width > 80 && r.height > 12 && r.right <= window.innerWidth && getComputedStyle(a).visibility === 'visible'; })()`);
    conferir('as abas aparecem na janela, inteiras', visivel === true);
    await clicarEm(`Array.from(document.querySelectorAll('.abas-de-tecido button')).find((b) => b.textContent === 'Forro')`);
    await espera(300);
    conferir('com o Forro, a lista mostra só a peça dele', (await lista()).length === 1, JSON.stringify(await lista()));
    await clicarEm(`Array.from(document.querySelectorAll('.abas-de-tecido button')).find((b) => b.textContent.startsWith('Largura'))`);
    await porNoCampo('Largura útil', '900');
    await botaoNaJanela('Aplicar');
    await espera(300);
    const antes = await estadoGravado();
    conferir('a largura do tecido fica gravada', antes.enfesto.largurasPorTecido && antes.enfesto.largurasPorTecido.Forro === 900, JSON.stringify(antes.enfesto.largurasPorTecido));
    const outras = antes.pecas.filter((p) => p.tecidoDoMolde !== 'Forro');
    await encaixar();
    const depois = await estadoGravado();
    conferir('o encaixe do Forro não mexe nas peças do outro tecido', outras.every((p) => JSON.stringify(depois.pecas.find((q) => q.id === p.id).contorno) === JSON.stringify(p.contorno)));
    const forro = depois.pecas.find((p) => p.tecidoDoMolde === 'Forro');
    conferir('a peça do Forro fica nos 900 mm', Boolean(forro) && caixa(forro.contorno).maxX <= 900, forro ? String(Math.round(caixa(forro.contorno).maxX)) : 'sumiu');
    conferir('a largura geral do enfesto não muda', depois.enfesto.larguraUtilMm === antes.enfesto.larguraUtilMm, String(depois.enfesto.larguraUtilMm));
    await clicarEm(`Array.from(document.querySelectorAll('.abas-de-tecido button')).find((b) => b.textContent === 'Todos')`);
    await espera(300);
    conferir('em Todos, voltam as 3', (await lista()).length === 3);
    await tecidoDaPeca(1, '');
    await encaixar();
  });

  /** O que o plotter deve desenhar, em mm no papel: X é o comprimento da mesa, e Y sobe a partir da borda de baixo. */
  const noPapel = (contorno, altura) => contorno.map((p) => ({ x: p.y, y: altura - p.x }));
  const plotter = criarPlotterVirtual();
  await plotter.ligar();
  const enviar = async () => {
    const antes = plotter.recebidos.length;
    await aba('Encaixe');
    await menu('Opções', 'Enviar ao plotter (');
    return esperarAte(async () => plotter.recebidos.length > antes && plotter.recebidos[plotter.recebidos.length - 1], 15000);
  };
  const situacoesDaFila = () => js(`JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] tbody tr')).map((l) => l.children[2].textContent))`).then(JSON.parse);

  await etapa('O envio ao plotter pela rede', async () => {
    await aba('Encaixe');
    await menu('Opções', 'Porta de saída');
    await porNoCampo('Onde o plotter está', `localhost:${plotter.porta}`);
    await botaoNaJanela('Guardar');
    await espera(300);
    const hpgl = await enviar();
    conferir('o plotter virtual recebeu o risco', Boolean(hpgl), `${(hpgl || '').length} bytes`);
    const r = interpretarHpgl(hpgl || '');
    conferir('nenhum comando desconhecido', r.desconhecidos.length === 0, r.desconhecidos.join(','));
    conferir('nenhum erro de plotagem', r.erros.length === 0, r.erros.slice(0, 3).join(' | '));
    const { pecas, enfesto } = await estadoGravado();
    const altura = Math.max(enfesto.larguraUtilMm, ...pecas.flatMap((p) => p.contorno.map((q) => q.x)));
    const fechados = r.eventos.filter((e) => e.tipo === 'traco').map((e) => e.pontos);
    const desvios = pecas.map((p) => melhorDesvio(fechados, [...noPapel(p.contorno, altura), noPapel(p.contorno, altura)[0]].slice(0, -1).concat(noPapel(p.contorno, altura)[0])));
    conferir('cada peça sai no lugar e no tamanho, a menos de 0,05 mm', desvios.every((d) => d < 0.05), desvios.map((d) => d.toFixed(3)).join(' / '));
    const fio = pecas.map((p) => melhorDesvio(fechados, noPapel([p.linhaDeFio.inicio, p.linhaDeFio.fim], altura)));
    conferir('o fio de cada peça também', fio.every((d) => d < 0.05), fio.map((d) => d.toFixed(3)).join(' / '));
    const textos = r.eventos.filter((e) => e.tipo === 'texto').map((e) => e.texto);
    conferir('o nome das 3 peças sai no risco', pecas.every((p) => textos.some((t) => t.includes(p.nome.slice(0, 8)))), textos.slice(0, 4).join(' | '));
    log(`      maior coordenada: ${r.maiorCoordenada} (${(r.maiorCoordenada / 40).toFixed(0)} mm)${r.passaDoLimiteAntigo ? ' — passa do limite de plotters antigos' : ''}`);
    await menu('Opções', 'Gerenciador de impressão');
    conferir('o gerenciador mostra o risco como enviado', (await situacoesDaFila()).includes('Enviado'), JSON.stringify(await situacoesDaFila()));
    await fecharJanela();
  });

  await etapa('A falha no plotter e a volta', async () => {
    const porta = plotter.porta;
    await plotter.desligar();
    await aba('Encaixe');
    await menu('Opções', 'Enviar ao plotter (');
    await espera(1500);
    await menu('Opções', 'Gerenciador de impressão');
    const com = await esperarAte(async () => (await situacoesDaFila()).find((s) => s.startsWith('Erro')), 15000);
    conferir('o plotter desligado aparece como erro', Boolean(com), String(com));
    conferir('a fila pausa', (await js(`Array.from(document.querySelectorAll('[role=dialog] button')).some((b) => b.textContent.trim() === 'Continuar a fila')`)) === true);
    await plotter.ligar(porta);
    const antes = plotter.recebidos.length;
    await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find((b) => b.textContent.trim() === 'Enviar de novo')`);
    conferir('ligado de novo, o risco chega', (await esperarAte(async () => plotter.recebidos.length > antes, 15000)) === true);
    await fecharJanela();
  });

  await etapa('Os níveis de impressão', async () => {
    await aba('Encaixe');
    await menu('Opções', 'Ferramentas do plotter');
    await marcarCaixa('Usar níveis de impressão');
    await porNoCampo('Linha de corte: nível', '3');
    await porNoCampo('Nomes e textos: nível', '1');
    await botaoNaJanela('Guardar');
    await espera(300);
    const hpgl = await enviar();
    const r = interpretarHpgl(hpgl || '');
    const { pecas, enfesto } = await estadoGravado();
    const altura = Math.max(enfesto.larguraUtilMm, ...pecas.flatMap((p) => p.contorno.map((q) => q.x)));
    const indice = (contorno) => {
      const alvo = noPapel(contorno, altura);
      return r.eventos.findIndex((e) => e.tipo === 'traco' && melhorDesvio([e.pontos], [...alvo, alvo[0]]) < 0.05);
    };
    const cortes = pecas.map((p) => indice(p.contorno));
    const ultimoTexto = r.eventos.map((e) => e.tipo).lastIndexOf('texto');
    conferir('todos os nomes saem antes de qualquer corte', cortes.every((i) => i > ultimoTexto) && r.erros.length === 0, `textos até ${ultimoTexto}, cortes em ${cortes.join(',')}`);
    await menu('Opções', 'Ferramentas do plotter');
    await marcarCaixa('Usar níveis de impressão');
    await botaoNaJanela('Guardar');
    await espera(300);
  });

  await etapa('O ISO pela porta', async () => {
    await aba('Início');
    const antes = plotter.recebidos.length;
    await botao('Exportar ISO (corte)');
    await marcarCaixa('Enviar direto pela porta de saída');
    await botaoNaJanela('Salvar o ISO');
    const chegou = await esperarAte(async () => plotter.recebidos.length > antes, 15000);
    conferir('a mesa virtual recebeu o ISO', chegou === true);
    const iso = interpretarIso(plotter.recebidos[plotter.recebidos.length - 1]);
    conferir('em mm, absoluto, com o fim do programa', iso.milimetros && iso.absoluto && iso.fim, JSON.stringify({ mm: iso.milimetros, abs: iso.absoluto, fim: iso.fim }));
    conferir('o leitor de terceiros não acha erro de corte', iso.erros.length === 0, iso.erros.slice(0, 3).join(' | '));
    const { pecas, enfesto } = await estadoGravado();
    const altura = Math.max(enfesto.larguraUtilMm, ...pecas.flatMap((p) => p.contorno.map((q) => q.x)));
    const faca = iso.caminhos.filter((c) => c.ferramenta === 1).map((c) => c.pontos);
    const desvios = pecas.map((p) => {
      const alvo = noPapel(p.contorno, altura);
      return melhorDesvio(faca, [...alvo, alvo[0]]);
    });
    conferir('a faca passa em cada peça, a menos de 0,02 mm', desvios.every((d) => d < 0.02), desvios.map((d) => d.toFixed(3)).join(' / '));
  });

  await etapa('As portas que não servem', async () => {
    const destinoErrado = async (destino, texto) => {
      await aba('Encaixe');
      await menu('Opções', 'Porta de saída');
      await porNoCampo('Onde o plotter está', destino);
      await botaoNaJanela('Guardar');
      await espera(300);
      await menu('Opções', 'Enviar ao plotter (');
      await menu('Opções', 'Gerenciador de impressão');
      const achou = await esperarAte(async () => (await situacoesDaFila()).find((s) => s.includes(texto)), 8000);
      conferir(`"${destino}" é explicado`, Boolean(achou), String(achou));
      await botaoNaJanela('Continuar a fila');
      await fecharJanela();
    };
    await destinoErrado('COM99', 'A porta COM99 não existe');
    await destinoErrado('8.8.8.8', 'A porta de saída não vale');
    await aba('Encaixe');
    await menu('Opções', 'Porta de saída');
    await porNoCampo('Onde o plotter está', `localhost:${plotter.porta}`);
    await botaoNaJanela('Guardar');
    await espera(300);
  });

  await etapa('O teste do equipamento', async () => {
    await aba('Encaixe');
    await menu('Opções', 'Teste do equipamento');
    conferir('abre a janela do teste', (await janela()) === 'Teste do equipamento', await janela());
    const antes = plotter.recebidos.length;
    await botaoNaJanela('Enviar a página de teste');
    await esperarAte(async () => plotter.recebidos.length > antes, 10000);
    const pagina = interpretarHpgl(plotter.recebidos[plotter.recebidos.length - 1] || '');
    const pontos = pagina.eventos.filter((e) => e.tipo === 'traco').flatMap((e) => e.pontos);
    const c = caixa(pontos);
    conferir('a página tem a moldura de 1000 x 140 mm', Math.abs(c.maxX - c.minX - 1000) < 0.05 && Math.abs(c.maxY - c.minY - 140) < 0.05, `${(c.maxX - c.minX).toFixed(2)} x ${(c.maxY - c.minY).toFixed(2)}`);
    conferir('e o plotter entende tudo', pagina.erros.length === 0 && pagina.desconhecidos.length === 0, [...pagina.erros, ...pagina.desconhecidos].slice(0, 3).join(' | '));
    await porNoCampo('Comprimento medido', '1005');
    await porNoCampo('Largura medida', '139,3');
    await botaoNaJanela('Guardar a correção');
    const texto = await esperarAte(() => js(`(document.querySelector('[role=dialog] [role=status]') || {}).textContent || ''`), 3000);
    conferir('a correção é calculada pelas medidas', String(texto).includes('Correção guardada'), String(texto).slice(0, 90));
    await botaoNaJanela('Enviar o teste de corte');
    await espera(1200);
    const mesa = interpretarIso(plotter.recebidos[plotter.recebidos.length - 1] || '');
    conferir('a mesa virtual recebe o quadrado de 100 mm', mesa.caminhos.some((k) => k.ferramenta === 1 && Math.abs(caixa(k.pontos).maxX - caixa(k.pontos).minX - 100) < 0.01) && mesa.fim, `${mesa.caminhos.length} caminho(s)`);
    await fecharJanela();
    const { pecas, enfesto } = await estadoGravado();
    const hpgl = await enviar();
    const corrigido = interpretarHpgl(hpgl || '');
    const altura = Math.max(enfesto.larguraUtilMm, ...pecas.flatMap((p) => p.contorno.map((q) => q.x)));
    const fator = (p) => ({ x: p.x * (1000 / 1005), y: p.y * (140 / 139.3) });
    const desvios = pecas.map((p) => {
      const alvo = noPapel(p.contorno, altura).map(fator);
      return melhorDesvio(corrigido.eventos.filter((e) => e.tipo === 'traco').map((e) => e.pontos), [...alvo, alvo[0]]);
    });
    conferir('os riscos seguintes saem corrigidos', desvios.every((d) => d < 0.05), desvios.map((d) => d.toFixed(3)).join(' / '));
    await menu('Opções', 'Teste do equipamento');
    await botaoNaJanela('Apagar a correção');
    await fecharJanela();
    const hpglDepois = interpretarHpgl((await enviar()) || '');
    const alvo = noPapel(pecas[0].contorno, altura);
    conferir('apagada, o risco volta à medida do arquivo', melhorDesvio(hpglDepois.eventos.filter((e) => e.tipo === 'traco').map((e) => e.pontos), [...alvo, alvo[0]]) < 0.05);
  });

  await etapa('A fonte TrueType, no bundle de produção', async () => {
    if (!fs.existsSync(ARIAL)) {
      log('      (sem a Arial neste sistema)');
      return;
    }
    arquivoParaAbrir = ARIAL;
    await aba('Encaixe');
    await menu('Opções', 'Fonte TrueType');
    const nome = await esperarAte(async () => (await itensDoMenu('Opções')).find((i) => i.includes('arial.ttf')), 12000);
    conferir('a fonte escolhida aparece no menu', Boolean(nome), String(nome));
    const hpgl = await enviar();
    const r = interpretarHpgl(hpgl || '');
    conferir('os textos saem em linhas, sem o letreiro do plotter', !(hpgl || '').includes('LB') && r.erros.length === 0, `${r.eventos.length} traços`);
    await aba('Início');
    await botao('Exportar PDF');
    await espera(500);
    await clicarEm(`document.querySelector('[role=dialog] .botao-primario')`);
    const pdfs = await esperarAte(async () => {
      const l = fs.readdirSync(SAIDA).filter((f) => f.endsWith('.pdf'));
      return l.length > 0 ? l : null;
    }, 20000);
    await espera(800);
    const pdf = pdfs ? fs.readFileSync(path.join(SAIDA, pdfs[0]), 'latin1') : '';
    conferir('o PDF traz a fonte embutida', pdf.includes('/FontFile2') && /FontName \/[A-Z]+\+Arial/.test(pdf), pdfs ? pdfs[0] : 'sem PDF');
    await fecharJanela();
    await aba('Encaixe');
    await menu('Opções', 'Tirar a fonte TrueType');
    arquivoParaAbrir = DXF;
    const hpglDepois = await enviar();
    conferir('tirada a fonte, volta o letreiro', (hpglDepois || '').includes('LB'));
  });

  await etapa('Os arquivos para outros programas', async () => {
    await aba('Início');
    await botao('Exportar DXF');
    const dxf = await esperarAte(async () => fs.readdirSync(SAIDA).find((f) => f.endsWith('.dxf')), 10000);
    await espera(500);
    const lido = new DxfParser().parseSync(fs.readFileSync(path.join(SAIDA, dxf), 'latin1'));
    conferir('o DXF é lido por um leitor de terceiros', lido.entities.length >= 3, `${lido.entities.length} entidades`);
    await botao('Exportar ASTM');
    const astm = await esperarAte(async () => fs.readdirSync(SAIDA).find((f) => f.includes('astm')), 10000);
    await espera(500);
    const lidoAstm = new DxfParser().parseSync(fs.readFileSync(path.join(SAIDA, astm), 'latin1'));
    conferir('o ASTM também, com um bloco por peça', Object.keys(lidoAstm.blocks).filter((b) => !b.startsWith('*')).length >= 3, `${Object.keys(lidoAstm.blocks).length} blocos`);
  });

  await etapa('A emenda clicada na mesa', async () => {
    await aba('Encaixe');
    await botao('Pontos de emenda');
    await marcarCaixa('Marcar clicando na mesa');
    await botaoNaJanela('Aplicar');
    await espera(400);
    const r = JSON.parse(await js(`JSON.stringify(document.querySelector('.area-de-desenho-container canvas').getBoundingClientRect())`));
    const [x, y] = [Math.round(r.left + r.width * 0.6), Math.round(r.top + r.height * 0.5)];
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    await espera(400);
    await tecla('Escape');
    const { enfesto } = await estadoGravado();
    conferir('o clique marca a emenda', (enfesto.emendasMm || []).length === 1, JSON.stringify(enfesto.emendasMm));
    const hpgl = await enviar();
    conferir('e ela sai no risco', (hpgl || '').includes('LBEMENDA'));
    await aba('Encaixe');
    await botao('Pontos de emenda');
    await marcarCaixa('Apagar os pontos');
    await botaoNaJanela('Aplicar');
    await espera(300);
  });

  await etapa('O teclado virtual', async () => {
    await aba('Encaixe');
    await menu('Opções', 'Porta de saída');
    await js(`(() => { const c = document.querySelector('[role=dialog] input'); c.focus(); c.select(); })()`);
    await tecla('F1', ['control']);
    const apareceu = await js(`(() => { const t = document.querySelector('.teclado-virtual'); if (!t) return false; const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 12); return t.contains(e) && r.bottom <= window.innerHeight; })()`);
    conferir('Ctrl+F1 mostra o teclado, por cima do diálogo', apareceu === true);
    for (const k of ['c', 'o', 'm', '7']) await clicarEm(`document.querySelector('.teclado-virtual button[aria-label="${k}"]')`);
    const valor = await js(`document.querySelector('[role=dialog] input').value`);
    conferir('as teclas escrevem no campo, sem tirar o foco', valor === 'com7' && (await js(`document.activeElement === document.querySelector('[role=dialog] input')`)), JSON.stringify(valor));
    await tecla('F1', ['control']);
    conferir('Ctrl+F1 esconde o teclado', (await js(`!document.querySelector('.teclado-virtual')`)) === true);
    await fecharJanela();
  });

  await etapa('As janelas', async () => {
    await aba('Encaixe');
    await clicarEm(`Array.from(document.querySelectorAll('.botao-de-menu')).find((b) => b.textContent.trim() === 'Visão')`);
    await clicarEm(`Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).find((b) => b.textContent.includes('Nova janela'))`);
    const outra = await esperarAte(async () => BrowserWindow.getAllWindows().find((j) => j !== win && j.isVisible()), 30000);
    conferir('abre outra janela do programa', Boolean(outra));
    if (!outra) return;
    const voltas = 8;
    let erradas = 0;
    let primeira = '';
    for (let volta = 0; volta < voltas; volta++) {
      if (volta > 0) {
        win.maximize();
        outra.maximize();
        await espera(350);
        win.moveTop();
        win.focus();
        await espera(200);
      }
      const chamadas = chamadasDoArranjo.length;
      await menu('Visão', 'Janelas lado a lado');
      await espera(900);
      const [a, b] = [win.getBounds(), outra.getBounds()];
      if (a.x + a.width <= b.x + 2 || b.x + b.width <= a.x + 2) continue;
      erradas++;
      if (!primeira) primeira = JSON.stringify({ volta, chamou: chamadasDoArranjo.length > chamadas, a, b, ultimas: chamadasDoArranjo.slice(-3) });
    }
    conferir(`lado a lado, saindo do maximizado, ${voltas} vezes`, erradas === 0, `${erradas} errada(s) ${primeira}`.slice(0, 700));
    await menu('Visão', 'Janelas em cascata');
    await espera(600);
    const [c, d] = [win.getBounds(), outra.getBounds()];
    conferir('em cascata: mesmo tamanho, um degrau de diferença', c.width === d.width && Math.abs(c.x - d.x) >= 16, JSON.stringify([c, d]));
    outra.destroy();
    win.setBounds({ x: 0, y: 0, width: 1440, height: 900 });
    win.focus();
    await espera(800);
  });

  await etapa('A colaboração, com outra pessoa do outro lado', async () => {
    await aba('Produção').catch(() => undefined);
    let achou = await js(`Array.from(document.querySelectorAll('.grupo-de-ferramentas button')).some((b) => b.textContent.trim() === 'Colaboração')`);
    if (!achou) {
      for (const nome of JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('.ribbon-aba')).map((b) => b.textContent))`))) {
        await aba(nome);
        achou = await js(`Array.from(document.querySelectorAll('.grupo-de-ferramentas button')).some((b) => b.textContent.trim() === 'Colaboração')`);
        if (achou) break;
      }
    }
    await botao('Colaboração');
    await botaoNaJanela('Ligar o servidor');
    const chave = await esperarAte(() => js(`(document.querySelector('[role=dialog] code') || {}).textContent || ''`), 10000);
    conferir('o servidor liga e mostra a chave', Boolean(chave) && chave.length >= 24);
    const porta = Number(await js(`document.querySelector('[role=dialog] [type=number]') ? 0 : 8931`)) || 8931;
    const url = `http://127.0.0.1:${porta}`;
    await porNoCampo('Endereço', url);
    await porNoCampo('Chave', chave);
    await porNoCampo('Seu nome', 'Ana');
    await botaoNaJanela('Ligar');
    await esperarAte(() => js(`Array.from(document.querySelectorAll('[role=dialog] button')).some((b) => b.textContent.trim() === 'Enviar este projeto')`), 8000);
    await botaoNaJanela('Enviar este projeto');
    const enviado = await esperarAte(() => js(`Array.from(document.querySelectorAll('[role=dialog] [role=status]')).some((p) => p.textContent.includes('Versão 1 enviada'))`), 10000);
    conferir('o projeto vai para o servidor', enviado === true);
    const cofre = fs.readFileSync(path.join(DADOS, 'colaboracao.json'), 'utf8');
    conferir('a chave não fica aberta no disco', !cofre.includes(chave));
    // A outra pessoa: outro cliente, que só conhece o endereço e a chave.
    const outro = async (metodo, caminho, corpo) => {
      const r = await fetch(url + caminho, { method: metodo, headers: { Authorization: `Bearer ${chave}` }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
      return { status: r.status, corpo: await r.json() };
    };
    conferir('sem a chave, o servidor recusa', (await fetch(url + '/projetos')).status === 401);
    const { corpo: lista1 } = await outro('GET', '/projetos');
    const id = lista1.projetos[0].id;
    const { corpo: baixado } = await outro('GET', `/projetos/${id}`);
    const projetoDela = JSON.parse(JSON.stringify(baixado.projeto));
    const alvo = projetoDela.estado.pecas[0];
    alvo.quantidade = 7;
    const gravou = await outro('PUT', `/projetos/${id}`, { base: 1, autor: 'Bia', projeto: projetoDela });
    conferir('a outra pessoa grava a versão 2', gravou.corpo.versao === 2, JSON.stringify(gravou.corpo).slice(0, 80));
    await outro('POST', `/projetos/${id}/comentarios`, { autor: 'Bia', texto: 'Subir a cava' });
    await outro('POST', `/projetos/${id}/presenca`, { autor: 'Bia' });
    await botaoNaJanela('Atualizar com o servidor');
    const atualizado = await esperarAte(() => js(`Array.from(document.querySelectorAll('[role=dialog] [role=status]')).some((p) => p.textContent.includes('versão 2'))`), 10000);
    conferir('a mudança dela chega a este programa', atualizado === true);
    await botaoNaJanela('Enviar este projeto');
    const v3 = await esperarAte(() => js(`Array.from(document.querySelectorAll('[role=dialog] [role=status]')).some((p) => p.textContent.includes('Versão'))`), 10000);
    conferir('enviar de novo continua funcionando', Boolean(v3));
    const comentou = await esperarAte(() => js(`document.querySelector('[role=dialog]').textContent.includes('Subir a cava')`), 8000);
    conferir('o comentário dela aparece aqui', comentou === true);
    await botaoNaJanela('Aprovar');
    const aprovado = await esperarAte(async () => (await outro('GET', `/projetos/${id}`)).corpo.aprovacao, 8000);
    conferir('a aprovação chega ao servidor', Boolean(aprovado) && aprovado.autor === 'Ana', JSON.stringify(aprovado).slice(0, 90));
    await botaoNaJanela('Desligar o servidor');
    await espera(500);
    await fecharJanela();
    const { pecas } = await estadoGravado();
    conferir('a peça mudada por ela está no projeto daqui', pecas.some((p) => p.quantidade === 7));
  });

  await etapa('A vitrine, num navegador de verdade e com o código de produção', async () => {
    await aba('Modelo');
    await botao('Coleções');
    await espera(600);
    await botaoNaJanela('Nova coleção');
    await porNoCampo('Nome da coleção', 'Verão');
    await botaoNaJanela('Guardar a coleção');
    await espera(400);
    await botaoNaJanela('Novo modelo');
    await espera(400);
    await porNoCampo('Categoria', 'Camiseta');
    await botaoNaJanela('Guardar o modelo');
    await espera(300);
    await botaoNaJanela('← Voltar ao mix');
    await espera(300);
    await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] [role=tab]')).find((b) => b.textContent.trim().startsWith('Looks'))`);
    await botaoNaJanela('Salvar a vitrine (HTML)');
    const arquivo = await esperarAte(async () => fs.readdirSync(SAIDA).find((f) => f.startsWith('vitrine-')), 8000);
    conferir('a vitrine é gravada', Boolean(arquivo), String(arquivo));
    await fecharJanela();
    if (!arquivo) return;
    const pagina = new BrowserWindow({ show: false, width: 390, height: 800, webPreferences: { contextIsolation: true } });
    await pagina.loadFile(path.join(SAIDA, arquivo));
    conferir('a página abre com o produto', (await pagina.webContents.executeJavaScript(`document.querySelectorAll('[data-produto]').length`)) >= 1);
    const noCelular = await pagina.webContents.executeJavaScript(`document.documentElement.scrollWidth <= window.innerWidth`);
    conferir('no celular, sem rolagem de lado', noCelular === true);
    const escolha = await pagina.webContents.executeJavaScript(`tamanhoDaVitrine(['P', 'M'], [{ valoresCm: { P: 90, M: 96 } }], [90], FOLGA)`);
    conferir('a recomendação funciona depois da minificação', escolha === 'M', String(escolha));
    pagina.destroy();
  });

  await etapa('As cores na tela', async () => {
    await aba('Encaixe');
    /** A média da janela: pega qualquer mudança visível, não só a de um ponto. */
    const mediaDaJanela = async () => {
      // Dois quadros: a foto tem de ser do que já foi desenhado depois da troca de cores.
      await Promise.race([js(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`), espera(1500)]);
      const png = await win.webContents.capturePage();
      const { width, height } = png.getSize();
      const b = png.toBitmap();
      let [r, g, a, n] = [0, 0, 0, 0];
      for (let y = 8; y < height; y += 16) {
        for (let x = 8; x < width; x += 16) {
          const i = (y * width + x) * 4;
          r += b[i + 2];
          g += b[i + 1];
          a += b[i];
          n++;
        }
      }
      return [r, g, a].map((v) => Math.round(v / n));
    };
    /** Todo texto visível da tela: quantos ficam abaixo de 3:1 contra o fundo que está atrás dele. */
    const textosRuins = () =>
      js(`(() => {
        const lum = (c) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const pintor = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
        const cor = (t) => { pintor.clearRect(0, 0, 1, 1); pintor.fillStyle = t; pintor.fillRect(0, 0, 1, 1); const [r, g, b, a] = pintor.getImageData(0, 0, 1, 1).data; return { c: [r, g, b], a: a / 255 }; };
        const ruins = [];
        let vistos = 0;
        for (const e of document.querySelectorAll('body *')) {
          if (e.closest('canvas, svg, [aria-hidden=true]') || e.disabled) continue;
          if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '')) continue;
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || Number(s.opacity) < 0.3) continue;
          let f = e;
          let fundo = null;
          while (f) { const c = cor(getComputedStyle(f).backgroundColor); if (c.a >= 0.9) { fundo = c.c; break; } f = f.parentElement; }
          if (!fundo) continue;
          vistos++;
          const [x, y] = [lum(cor(s.color).c), lum(fundo)].sort((a, b) => b - a);
          const contraste = (x + 0.05) / (y + 0.05);
          if (contraste < 3) ruins.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' "' + e.textContent.trim().slice(0, 24) + '" ' + contraste.toFixed(1) + ' ' + cor(s.color).c.join(',') + ' em ' + fundo.join(',') + ' de ' + String(f.className).split(' ')[0]);
        }
        return JSON.stringify({ vistos, ruins: [...new Set(ruins)] });
      })()`).then(JSON.parse);
    const esquemas = ['Cores padrão', 'Cores escuras', 'Alto contraste', 'Cores areia'];
    const medias = [];
    for (const esquema of esquemas) {
      await menu('Opções', esquema);
      await espera(350);
      medias.push((await mediaDaJanela()).join(','));
      const tela = await textosRuins();
      await menu('Opções', 'Porta de saída');
      await espera(250);
      const dialogo = await textosRuins();
      await fecharJanela();
      await espera(200);
      const ruins = [...new Set([...tela.ruins, ...dialogo.ruins])];
      conferir(`${esquema}: todo texto visível legível`, ruins.length === 0, `${tela.vistos + dialogo.vistos} textos; ${ruins.slice(0, 8).join(' ; ')}`.slice(0, 420));
    }
    conferir('cada esquema muda a janela de verdade', new Set(medias).size === esquemas.length, medias.join(' ; '));
    // O tema escuro nas janelas grandes: é nelas que costuma sobrar uma cor escrita à mão.
    await menu('Opções', 'Cores escuras');
    const janelas = [
      async () => menu('Opções', 'Teste do equipamento'),
      async () => menu('Opções', 'Gerenciador de impressão'),
      async () => menu('Opções', 'Ferramentas do plotter'),
      async () => botao('Nesting Automático'),
      async () => propriedades(0),
    ];
    const ruinsNasJanelas = [];
    let lidos = 0;
    for (const abrir of janelas) {
      await abrir();
      await espera(350);
      const r = await textosRuins();
      lidos += r.vistos;
      ruinsNasJanelas.push(...r.ruins);
      await fecharJanela();
      await espera(200);
    }
    const unicos = [...new Set(ruinsNasJanelas)];
    conferir('Cores escuras: as janelas grandes também', unicos.length === 0, `${lidos} textos; ${unicos.slice(0, 10).join(' ; ')}`.slice(0, 500));
    await menu('Opções', 'Cores padrão');
  });

  await etapa('Toda a barra de ferramentas, botão por botão', async () => {
    await fecharJanela();
    const ignorar = /^(Sair|Fechar|Nova janela|Janelas )/;
    const abas = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('.ribbon-aba')).map((b) => b.textContent))`));
    let clicados = 0;
    const quebras = [];
    const limpar = async () => {
      for (let i = 0; i < 4 && (await janela()) !== 'nenhuma'; i++) await fecharJanela();
      await tecla('Escape');
    };
    const verificar = async (quem) => {
      clicados++;
      const viva = await Promise.race([js(`!!document.querySelector('.app-shell')`), espera(6000).then(() => false)]);
      const erros = viva ? JSON.parse(await js(`JSON.stringify(window.__erros.splice(0))`)) : ['a tela sumiu'];
      if (!viva || erros.length > 0) {
        quebras.push(`${quem}: ${erros[0] || ''}`.slice(0, 160));
        if (!viva) {
          win.webContents.reload();
          await espera(4000);
          await prepararPagina();
        }
      }
    };
    for (const nome of abas) {
      await js(`Array.from(document.querySelectorAll('.ribbon-aba')).find((b) => b.textContent === ${JSON.stringify(nome)}).click()`);
      await espera(150);
      // Com uma peça selecionada, as ferramentas que trabalham numa peça ficam ligadas.
      await selecionarPeca(0).catch(() => undefined);
      await espera(100);
      const botoes = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=tabpanel] button')).map((b, i) => ({ i, t: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 50), menu: b.classList.contains('botao-de-menu'), off: b.disabled })))`));
      log(`      ${nome}: ${botoes.length} botões, ${botoes.filter((b) => b.off).length} desligados`);
      for (const b of botoes) {
        if (b.off || ignorar.test(b.t)) continue;
        const clicar = `(document.querySelectorAll('[role=tabpanel] button')[${b.i}] || { click() {} }).click()`;
        await js(clicar);
        await espera(90);
        if (b.menu) {
          const itens = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).map((e) => ({ t: e.textContent.trim(), off: e.disabled })))`));
          await fecharMenu();
          for (const [k, item] of itens.entries()) {
            if (item.off || ignorar.test(item.t)) continue;
            await js(clicar);
            await espera(60);
            await js(`(document.querySelectorAll('[role=menu] .item-de-menu')[${k}] || { click() {} }).click()`);
            await espera(100);
            await verificar(`${nome} > ${b.t} > ${item.t}`);
            await limpar();
            await js(`Array.from(document.querySelectorAll('.ribbon-aba')).find((x) => x.textContent === ${JSON.stringify(nome)}).click()`);
          }
        } else {
          await verificar(`${nome} > ${b.t}`);
          await limpar();
          await js(`Array.from(document.querySelectorAll('.ribbon-aba')).find((x) => x.textContent === ${JSON.stringify(nome)}).click()`);
        }
      }
    }
    conferir('nenhum botão ou item de menu quebra a tela', quebras.length === 0, `${clicados} clicados; ${quebras.slice(0, 6).join(' || ')}`);
    conferir('o processo da tela não caiu', caiu === '', caiu);
  });

  await plotter.desligar();
  const distintos = [...new Set(errosDoConsole)].filter((m) => !/não achei|campo não achado|Script failed/.test(m));
  conferir('o console ficou sem erros', distintos.length === 0, distintos.slice(0, 4).join(' | ').slice(0, 300));
  log(`\nresultado: ${acertos} conferidos, ${falhas} falha(s)`);
  fs.writeFileSync(path.join(SAIDA, 'resumo.json'), JSON.stringify({ acertos, falhas, data: new Date().toISOString() }));
}

app.whenReady().then(async () => {
  try {
    await principal();
  } catch (e) {
    falhas++;
    log(`FALHA a validação parou: ${e.stack || e}`);
  }
  try {
    fs.rmSync(DADOS, { recursive: true, force: true });
  } catch {
    // O Windows pode segurar arquivos do Chromium até o programa fechar: a pasta é temporária.
  }
  app.exit(falhas === 0 ? 0 : 1);
});
