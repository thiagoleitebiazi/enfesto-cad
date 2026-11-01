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
const { app, BrowserWindow, dialog, shell } = require('electron');
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

/** O contraste entre duas cores "rgb(...)", pela regra da WCAG. */
function contraste(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.match(/[\d.]+/g).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

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
    if (e.level === 'error') errosDoConsole.push(String(e.message).slice(0, 220));
  });
  let caiu = '';
  win.webContents.on('render-process-gone', (_e, d) => (caiu = d.reason));

  const js = (codigo) => win.webContents.executeJavaScript(codigo);
  const prepararPagina = () => js(`(() => { window.__erros = []; window.addEventListener('error', (e) => window.__erros.push(String(e.message))); window.addEventListener('unhandledrejection', (e) => window.__erros.push(String(e.reason))); window.alert = () => undefined; window.confirm = () => true; window.prompt = () => null; })()`);
  await prepararPagina();

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
  const menu = async (rotulo, trecho) => {
    await clicarEm(`Array.from(document.querySelectorAll('.botao-de-menu')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
    await clicarEm(`Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).find(b => b.textContent.includes(${JSON.stringify(trecho)}))`);
    await espera(250);
  };
  const itensDoMenu = async (rotulo) => {
    await clicarEm(`Array.from(document.querySelectorAll('.botao-de-menu')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
    const itens = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).map(b => b.textContent.trim()))`));
    await tecla('Escape');
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
  const validacao = () => js(`(document.querySelector('.indicador-de-validacao') || {}).textContent || ''`);
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
  const etapa = async (nome, fazer) => {
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
      await selecionarPeca(i);
      await porNoCampo('Tamanho', t);
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
    conferir('a validação não acusa nada', (await validacao()) === 'Validação: sem problemas', await validacao());
  });

  await etapa('O tecido ativo', async () => {
    await selecionarPeca(1);
    await js(`(() => { const c = document.querySelector('input[list="tecidos-do-molde"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, 'Forro'); c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await espera(300);
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
    await selecionarPeca(1);
    await js(`(() => { const c = document.querySelector('input[list="tecidos-do-molde"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, ''); c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await espera(300);
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
    await menu('Visão', 'Janelas lado a lado');
    await espera(600);
    const [a, b] = [win.getBounds(), outra.getBounds()];
    conferir('lado a lado: uma ao lado da outra, sem sobrepor', a.x + a.width <= b.x + 2 || b.x + b.width <= a.x + 2, JSON.stringify([a, b]));
    await menu('Visão', 'Janelas em cascata');
    await espera(600);
    const [c, d] = [win.getBounds(), outra.getBounds()];
    conferir('em cascata: mesmo tamanho, um degrau de diferença', c.width === d.width && Math.abs(c.x - d.x) >= 16, JSON.stringify([c, d]));
    outra.destroy();
    win.setBounds({ x: 0, y: 0, width: 1440, height: 900 });
    await espera(400);
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
    const esquemas = (await itensDoMenu('Opções')).filter((i) => /^.?\s*(Cores|Escuro|Alto contraste|Claro)/i.test(i.replace(/^[✓•\s]+/, '')));
    const vistos = new Map();
    let menorContraste = Infinity;
    let pior = '';
    for (const esquema of esquemas) {
      await menu('Opções', esquema.replace(/^[✓•\s]+/, ''));
      await espera(300);
      const png = await win.webContents.capturePage();
      const { width, height } = png.getSize();
      const b = png.toBitmap();
      const pixel = (x, y) => {
        const i = (y * width + x) * 4;
        return `${b[i + 2]},${b[i + 1]},${b[i]}`;
      };
      vistos.set(esquema, `${pixel(width - 6, height - 12)}|${pixel(6, 70)}`);
      const pares = JSON.parse(
        await js(`JSON.stringify(['.barra-de-status', '.ribbon-aba', '.contexto-do-documento', '.aba-de-documento', '.lista-de-pecas'].map((s) => {
          const e = document.querySelector(s);
          if (!e) return null;
          const c = getComputedStyle(e);
          let f = e, fundo = 'rgba(0, 0, 0, 0)';
          while (f && /, 0\\)$/.test(fundo)) { fundo = getComputedStyle(f).backgroundColor; f = f.parentElement; }
          return { s, cor: c.color, fundo };
        }).filter(Boolean))`),
      );
      for (const p of pares) {
        const c = contraste(p.cor, p.fundo);
        if (c < menorContraste) {
          menorContraste = c;
          pior = `${esquema}: ${p.s}`;
        }
      }
    }
    conferir('os esquemas mudam de verdade os pixels da janela', new Set(vistos.values()).size === esquemas.length && esquemas.length >= 2, [...vistos.values()].join(' ; ').slice(0, 200));
    conferir('o texto das barras tem contraste de leitura em todos', menorContraste >= 3, `${menorContraste.toFixed(2)} em ${pior}`);
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
      const botoes = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=tabpanel] button')).map((b, i) => ({ i, t: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 50), menu: b.classList.contains('botao-de-menu'), off: b.disabled })))`));
      for (const b of botoes) {
        if (b.off || ignorar.test(b.t)) continue;
        const clicar = `(document.querySelectorAll('[role=tabpanel] button')[${b.i}] || { click() {} }).click()`;
        await js(clicar);
        await espera(90);
        if (b.menu) {
          const itens = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).map((e) => ({ t: e.textContent.trim(), off: e.disabled })))`));
          await tecla('Escape');
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
  const distintos = [...new Set(errosDoConsole)];
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
