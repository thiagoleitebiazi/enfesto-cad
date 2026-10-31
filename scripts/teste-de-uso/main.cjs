/*
 * O teste de uso: abre o programa gerado (dist e dist-electron) e o usa como uma pessoa usaria — importa um DXF de
 * teste, seleciona com o retângulo e com o Ctrl/⌘+clique, arrasta o grupo, exporta o PDF, abre o planejamento, põe
 * dois encaixes na fila e aplica o melhor, põe uma peça num grupo do encaixe, faz a ficha técnica, o desenho técnico e
 * uma coleção, cria uma peça pela foto, recomenda o tamanho pelas medidas do corpo (com o guia de medidas) e veste
 * uma saia no provador 3D (costurada, caída, com o mapa de tensão, a estampa e a imagem), monta o painel de inspiração
 * e cria um croqui com a IA (por um serviço de mentira: nada sai do computador), e estampa o encaixe para a impressão
 * digital — com
 * o mouse e o teclado de verdade (pelo sistema), tirando uma foto da janela a cada passo. Roda no Mac do GitHub, na
 * montagem do instalador (.github/workflows/mac.yml), e em qualquer computador:
 *
 *   npm run build
 *   npx electron scripts/teste-de-uso/main.cjs
 *
 * As fotos e o registro (uso.txt) vão para a pasta de SAIDA_DO_TESTE (ou ./uso). Os dados ficam numa pasta
 * temporária: os projetos de quem roda o teste não são tocados. Sai com 0 se tudo conferiu, e 1 se não.
 */
const { app, BrowserWindow, dialog, net } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const SAIDA = path.resolve(process.env.SAIDA_DO_TESTE || path.join(process.cwd(), 'uso'));
const DXF = path.join(__dirname, 'molde-de-teste.dxf');
const SAIA_DXF = path.join(__dirname, 'saia-de-teste.dxf');
/** Uma pala de 30 × 20 cm cortada por duas linhas internas que se cruzam (o "Extrair todas", ADR 0128). */
const PALA_DXF = path.join(__dirname, 'pala-de-teste.dxf');
/** O arquivo que a janela de abrir devolve (o DXF de teste; a saia, na etapa do provador 3D). */
let arquivoParaAbrir = DXF;
const NO_MAC = process.platform === 'darwin';
const TECLA_DE_COMANDO = NO_MAC ? 'meta' : 'control';

fs.mkdirSync(SAIDA, { recursive: true });
const REGISTRO = path.join(SAIDA, 'uso.txt');
fs.writeFileSync(REGISTRO, '');
const log = (texto) => {
  fs.appendFileSync(REGISTRO, texto + '\n');
  console.log(texto);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** A homografia que leva os 4 pontos de `de` aos de `para` (para desenhar a foto torta do molde da foto). */
function homografiaDoTeste(de, para) {
  const a = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = de[i];
    const [u, v] = para[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    [a[c], a[piv]] = [a[piv], a[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 8; k++) a[r][k] -= f * a[c][k];
      b[r] -= f * b[c];
    }
  }
  return [...a.map((linha, i) => b[i] / linha[i]), 1];
}

function aplicarHomografiaDoTeste(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

// Uma pasta de dados só do teste, antes de o programa começar (ele lê o estado da abertura ao carregar).
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'enfesto-cad-uso-'));
app.setPath('userData', DADOS);
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [arquivoParaAbrir] });
dialog.showSaveDialog = async (opcoes) => ({ canceled: false, filePath: path.join(SAIDA, path.basename((opcoes && opcoes.defaultPath) || 'saida.pdf')) });
/**
 * O serviço de IA de mentira (ADR 0112): o pedido que iria à internet fica aqui — o teste confere o que iria (o
 * endereço, a chave no cabeçalho, as imagens de referência) e responde com uma foto da janela. Nada sai do computador.
 */
const pedidosAoServicoDeIa = [];
const buscarDeVerdade = net.fetch.bind(net);
net.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.openai.com/')) {
    const corpo = init && init.body;
    pedidosAoServicoDeIa.push({
      url: String(url),
      autorizacao: init && init.headers ? init.headers.Authorization : undefined,
      imagens: corpo && typeof corpo.getAll === 'function' ? corpo.getAll('image[]').length : 0,
      modelo: corpo && typeof corpo.get === 'function' ? corpo.get('model') : null,
    });
    const janela = BrowserWindow.getAllWindows()[0];
    const imagem = (await janela.webContents.capturePage()).resize({ width: 400 });
    return new globalThis.Response(JSON.stringify({ data: [{ b64_json: imagem.toPNG().toString('base64') }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return buscarDeVerdade(url, init);
};
require(path.join(RAIZ, 'dist-electron', 'main.js'));

let falhas = 0;
const conferir = (rotulo, condicao, detalhe = '') => {
  if (!condicao) falhas++;
  log((condicao ? 'ok    ' : 'FALHA ') + rotulo + (detalhe ? ' — ' + detalhe : ''));
};

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
  win.focus();
  await espera(1500);
  const js = (codigo) => win.webContents.executeJavaScript(codigo);
  const foto = async (nome) => {
    win.focus();
    await espera(500);
    fs.writeFileSync(path.join(SAIDA, nome), (await win.webContents.capturePage()).toPNG());
    log('      foto: ' + nome);
  };
  const tecla = async (keyCode, modifiers = []) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await espera(300);
  };
  const clicarEm = async (expressao) => {
    await js(`(() => { const e = (${expressao}); e.scrollIntoView({ block: 'center' }); })()`);
    const r = JSON.parse(await js(`JSON.stringify((${expressao}).getBoundingClientRect())`));
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    await espera(500);
  };
  const aba = (nome) => clicarEm(`Array.from(document.querySelectorAll('.ribbon-aba')).find(b => b.textContent === ${JSON.stringify(nome)})`);
  const botao = (rotulo) => clicarEm(`Array.from(document.querySelectorAll('.grupo-de-ferramentas button')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
  const janela = () => js(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.getAttribute('aria-label') : 'nenhuma'; })()`);
  const fecharJanela = () => js(`(document.querySelector('[role=dialog] .sobreposicao-fechar') || { click() {} }).click()`);
  const lista = () =>
    js(`JSON.stringify(Array.from(document.querySelectorAll('.lista-de-pecas li')).map(li => li.querySelector('.texto-do-item-de-peca').textContent.split(' (')[0] + (li.querySelector('input').checked || li.querySelector('button').classList.contains('item-selecionado') ? ' *' : '')))`).then(JSON.parse);
  const avisos = () => js(`((document.querySelector('.faixa-de-avisos') || {}).innerText || '').replace(/\\s+/g, ' ')`);
  // O projeto como está gravado (o mais recente da pasta de dados do teste), depois do Ctrl/⌘+S.
  const pecasGravadas = async () => {
    await js(`document.querySelector('.app-shell').focus()`);
    await tecla('s', [TECLA_DE_COMANDO]);
    await espera(1200);
    const pasta = path.join(DADOS, 'projetos');
    const projetos = fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')));
    return projetos.sort((a, b) => b.modificadoEmIso.localeCompare(a.modificadoEmIso))[0].estadoAtual.pecas;
  };
  const caixa = (c) => ({ minX: Math.min(...c.map((p) => p.x)), maxX: Math.max(...c.map((p) => p.x)), minY: Math.min(...c.map((p) => p.y)), maxY: Math.max(...c.map((p) => p.y)) });

  await js(`(() => { window.__errosDoTeste = []; window.addEventListener('error', (e) => window.__errosDoTeste.push(String(e.message))); window.addEventListener('unhandledrejection', (e) => window.__errosDoTeste.push(String(e.reason))); return 1; })()`);
  // Os avisos do console (os do React, por exemplo: a chave repetida numa lista, a mudança num componente que já saiu):
  // não quebram a página, mas costumam esconder um defeito. Ficam no registro, e o fim do teste confere que não houve.
  await js(`(() => { window.__avisosDoConsole = []; for (const nivel of ['error', 'warn']) { const original = console[nivel].bind(console); console[nivel] = (...args) => { window.__avisosDoConsole.push(nivel + ': ' + args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ').slice(0, 400)); original(...args); }; } return 1; })()`);
  log(`sistema: ${NO_MAC ? 'macOS' : process.platform} ${os.release()} (${process.arch}), Electron ${process.versions.electron}`);
  await foto('01-aberto.png');
  conferir('o programa abre, com a mesa e a barra de ferramentas', (await js(`!!document.querySelector('.app-shell') && !!document.querySelector('.area-de-desenho-container canvas')`)) === true);
  // A tela de início: importar e exportar à mão logo ao abrir (ADR 0096).
  const naAbertura = JSON.parse(
    await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=tabpanel] [aria-label="Importação e exportação"] button')).map(b => b.textContent.replace(/\\s+/g, ' ').trim()))`),
  );
  conferir('a tela de início tem Importar DXF, Importar PDF, Exportar DXF, Exportar PDF, Exportar PLT e Exportar ISO', naAbertura.join('|') === 'Importar DXF|Importar PDF|Importar PLT|Exportar DXF|Exportar PDF|Exportar PLT|PLT por partes|Exportar ISO (corte)', naAbertura.join(', '));

  // 1. Importar o DXF de teste: direto, com o nome do arquivo e o fio na horizontal.
  await aba('Início');
  await botao('Importar DXF');
  await espera(2500);
  conferir('importa direto, sem janela de confirmação', (await janela()) === 'nenhuma', await janela());
  // Importou sem problema: nenhuma faixa de avisos; as peças aparecem na lista, com o nome do arquivo (ADR 0095).
  const aviso = await avisos();
  conferir('sem faixa de avisos depois de importar', aviso === '', aviso.slice(0, 160));
  const nomes = await lista();
  conferir('as peças na lista, com o nome do arquivo', nomes.length === 3 && nomes.every((n) => n.startsWith('molde-de-teste-')), JSON.stringify(nomes));
  await clicarEm(`document.querySelector('.barra-de-visualizacao button[aria-label="Ajustar à tela"]')`);
  await espera(600);
  await foto('02-importado.png');
  const importadas = await pecasGravadas();
  conferir('as 3 peças, com o fio deitado (na horizontal da tela)', importadas.length === 3 && importadas.every((p) => Math.abs(p.linhaDeFio.fim.x - p.linhaDeFio.inicio.x) < 1e-6), JSON.stringify(importadas.map((p) => p.nome)));
  conferir('o pique do arquivo veio', importadas.some((p) => p.piques.length === 1));
  const todas = importadas.flatMap((p) => p.contorno);
  conferir('o conjunto a 4 mm das bordas da mesa (a margem de segurança)', Math.abs(Math.min(...todas.map((p) => p.x)) - 4) < 1e-6 && Math.abs(Math.min(...todas.map((p) => p.y)) - 4) < 1e-6);

  // A tela e o mundo: pela leitura X/Y da barra de status, com o mouse passando em cima do desenho (o evento vai
  // direto ao desenho; os cliques e os arrastos, mais abaixo, vão pelo sistema).
  const canvas = JSON.parse(await js(`JSON.stringify(document.querySelector('.area-de-desenho-container canvas').getBoundingClientRect())`));
  const lerXY = async (x, y) => {
    let anterior = null;
    for (let i = 0; i < 12; i++) {
      await js(`(() => { const c = document.querySelector('.area-de-desenho-container canvas'); const r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + ${x}, clientY: r.top + ${y}, bubbles: true })); return 1; })()`);
      await espera(250);
      const m = (await js(`document.querySelector('.barra-de-status').innerText`)).match(/X: (-?[\d.,]+) cm\s+Y: (-?[\d.,]+) cm/);
      const lido = m ? { x: Number(m[1].replace(',', '.')) * 10, y: Number(m[2].replace(',', '.')) * 10 } : null;
      if (lido && anterior && lido.x === anterior.x && lido.y === anterior.y) return lido;
      anterior = lido;
    }
    throw new Error('a leitura de X/Y da barra de status não estabilizou');
  };
  /** Do mundo (mm) para a janela (px), pelas duas leituras: a tela mostra o y do mundo na horizontal. */
  const calibrar = async () => {
    const m1 = await lerXY(150, 100);
    const m2 = await lerXY(850, 450);
    const k = (850 - 150) / (m2.y - m1.y);
    return (mundo) => ({ x: Math.round(canvas.left + 150 + (mundo.y - m1.y) * k), y: Math.round(canvas.top + 100 + (mundo.x - m1.x) * k) });
  };
  let naJanela = await calibrar();
  // A mesa inteira (3 m) cabe na tela com as peças pequenas: aproxima sobre elas com Ctrl + roda do mouse (o zoom no
  // ponto do mouse, no Windows e no Mac), para as fotos mostrarem as peças.
  const extremos = caixa(todas);
  // Primeiro a vista vai para as peças: arrastar com o botão do meio do mouse (o pan) leva o meio delas ao centro do
  // desenho; depois o zoom, no centro, aproxima sem as tirar da tela.
  const deOnde = naJanela({ x: (extremos.minX + extremos.maxX) / 2, y: (extremos.minY + extremos.maxY) / 2 });
  const meio = { x: Math.round((canvas.left + canvas.right) / 2), y: Math.round((canvas.top + canvas.bottom) / 2) };
  win.webContents.sendInputEvent({ type: 'mouseMove', x: deOnde.x, y: deOnde.y });
  await espera(100);
  win.webContents.sendInputEvent({ type: 'mouseDown', x: deOnde.x, y: deOnde.y, button: 'middle', clickCount: 1 });
  await espera(100);
  for (let i = 1; i <= 10; i++) {
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(deOnde.x + ((meio.x - deOnde.x) * i) / 10), y: Math.round(deOnde.y + ((meio.y - deOnde.y) * i) / 10), modifiers: ['middleButtonDown'] });
    await espera(50);
  }
  win.webContents.sendInputEvent({ type: 'mouseUp', x: meio.x, y: meio.y, button: 'middle', clickCount: 1 });
  await espera(400);
  naJanela = await calibrar();
  const zoomAntes = await js(`(document.querySelector('.barra-de-status').innerText.match(/Zoom: (\\d+)%/) || [])[1]`);
  const roda = (deltaY) =>
    js(`(() => { const c = document.querySelector('.area-de-desenho-container canvas'); c.dispatchEvent(new WheelEvent('wheel', { clientX: ${meio.x}, clientY: ${meio.y}, deltaY: ${deltaY}, ctrlKey: true, bubbles: true, cancelable: true })); return 1; })()`);
  // As peças e uma folga de 60 mm em volta (o retângulo de seleção começa 30 mm fora delas) têm de caber no desenho.
  const cabem = () =>
    [naJanela({ x: extremos.minX - 60, y: extremos.minY - 60 }), naJanela({ x: extremos.maxX + 60, y: extremos.maxY + 60 })].every(
      (p) => p.x > canvas.left + 20 && p.x < canvas.right - 20 && p.y > canvas.top + 20 && p.y < canvas.bottom - 20,
    );
  for (let i = 0; i < 20; i++) {
    await roda(-100);
    await espera(150);
    naJanela = await calibrar();
    if (!cabem()) {
      await roda(100);
      await espera(150);
      naJanela = await calibrar();
      break;
    }
  }
  const zoomDepois = await js(`(document.querySelector('.barra-de-status').innerText.match(/Zoom: (\\d+)%/) || [])[1]`);
  log(`      zoom: ${zoomAntes}% -> ${zoomDepois}%`);
  conferir('as peças, de perto, cabem inteiras no desenho', cabem());
  await foto('03-pecas-de-perto.png');
  const arrastar = async (de, ate, modifiers = [], fotoNoMeio = null) => {
    win.webContents.sendInputEvent({ type: 'mouseMove', x: de.x, y: de.y, modifiers });
    await espera(100);
    win.webContents.sendInputEvent({ type: 'mouseDown', x: de.x, y: de.y, button: 'left', clickCount: 1, modifiers });
    await espera(100);
    for (let i = 1; i <= 10; i++) {
      win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(de.x + ((ate.x - de.x) * i) / 10), y: Math.round(de.y + ((ate.y - de.y) * i) / 10), modifiers: [...modifiers, 'leftButtonDown'] });
      await espera(50);
    }
    if (fotoNoMeio) await foto(fotoNoMeio);
    win.webContents.sendInputEvent({ type: 'mouseUp', x: ate.x, y: ate.y, button: 'left', clickCount: 1, modifiers });
    await espera(600);
  };
  const centro = (peca) => {
    const c = caixa(peca.contorno);
    return { x: (c.minX + c.maxX) / 2, y: (c.minY + c.maxY) / 2 };
  };

  // 2. A seleção: o retângulo no vazio, o Ctrl/⌘+clique, o grupo arrastado junto.
  await tecla('Escape');
  await arrastar(naJanela({ x: extremos.minX - 30, y: extremos.minY - 30 }), naJanela({ x: extremos.maxX + 30, y: extremos.maxY + 30 }), [], '04-retangulo-de-selecao.png');
  await foto('05-tres-selecionadas.png');
  conferir('arrastar no vazio seleciona as peças dentro do retângulo', (await lista()).every((n) => n.endsWith(' *')), JSON.stringify(await lista()));
  const segunda = importadas[1];
  await arrastar(naJanela(centro(segunda)), naJanela(centro(segunda)), [TECLA_DE_COMANDO]);
  await foto('06-cmd-ou-ctrl-clique.png');
  const depoisDoCtrl = await lista();
  conferir(`${NO_MAC ? '⌘' : 'Ctrl'}+clique tira uma peça da seleção`, depoisDoCtrl.filter((n) => n.endsWith(' *')).length === 2 && !depoisDoCtrl[1].endsWith(' *'), JSON.stringify(depoisDoCtrl));
  const primeira = importadas[0];
  const antes = await pecasGravadas();
  const de = naJanela(centro(primeira));
  await arrastar(de, { x: de.x + 150, y: de.y }, [], '07-arrastando-o-grupo.png');
  const depois = await pecasGravadas();
  const andou = (i) => caixa(depois[i].contorno).minY - caixa(antes[i].contorno).minY;
  conferir('arrastar uma das selecionadas leva as duas, o mesmo tanto; a outra fica', andou(0) > 50 && Math.abs(andou(0) - andou(2)) < 1e-6 && Math.abs(andou(1)) < 1e-6, JSON.stringify([andou(0), andou(1), andou(2)]));
  await foto('08-grupo-arrastado.png');

  // 2b. O forro, a entretela e a vista (ADR 0124): a peça 1 sozinha; a vista de 30 mm pelo trecho do primeiro lado
  // dela, clicado com o mouse; a entretela na hora; as duas peças novas ao lado; e o Desfazer tira as duas.
  const naJanelaDoDialogo = (rotulo, valor) =>
    js(
      `(() => { const l = Array.from(document.querySelectorAll('[role=dialog] label')).find(x => Array.from(x.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === ${JSON.stringify(rotulo)}); const c = l.querySelector('input, select'); const p = c.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(c, ${JSON.stringify(valor)}); c.dispatchEvent(new Event(c.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
    );
  const continuar = () => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Continuar')`);
  await tecla('Escape');
  // Pela lista (no desenho, depois do arrasto, a peça 1 ficou embaixo da 2).
  await clicarEm(`Array.from(document.querySelectorAll('.lista-de-pecas li')).find(li => li.textContent.startsWith('molde-de-teste-1')).querySelector('button')`);
  await espera(300);
  await aba('Produção');
  await espera(300);
  await botao('Forro, entretela e vista');
  await espera(500);
  await naJanelaDoDialogo('Vista: a largura (mm) · Forro: quanto encurta (mm)', '30');
  await continuar();
  await espera(400);
  // A conta da posição é refeita agora: a fita da Produção não tem a altura da do Início, e a faixa de instrução da
  // ferramenta ("Vista: clique no contorno…") apareceu em cima do desenho e o empurrou para baixo.
  const desenhoAgora = JSON.parse(await js(`JSON.stringify(document.querySelector('.area-de-desenho-container canvas').getBoundingClientRect())`));
  const m1Agora = await lerXY(150, 100);
  const m2Agora = await lerXY(850, 450);
  const kAgora = (850 - 150) / (m2Agora.y - m1Agora.y);
  const naTelaAgora = (mundo) => ({ x: Math.round(desenhoAgora.left + 150 + (mundo.y - m1Agora.y) * kAgora), y: Math.round(desenhoAgora.top + 100 + (mundo.x - m1Agora.x) * kAgora) });
  const c0 = depois[0].contorno[0];
  const c1 = depois[0].contorno[1];
  for (const f of [0.25, 0.75]) {
    const p = naTelaAgora({ x: c0.x + (c1.x - c0.x) * f, y: c0.y + (c1.y - c0.y) * f });
    // Um clique (apertar e soltar no mesmo lugar, sem mexer): com o mouse andando apertado, o desenho entende arrasto.
    win.webContents.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
    await espera(100);
    win.webContents.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await espera(300);
  }
  await espera(400);
  await botao('Forro, entretela e vista');
  await espera(500);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] fieldset label')).find(l => l.textContent.trim().startsWith('Entretela')).querySelector('input')`);
  await continuar();
  await espera(600);
  await foto('08b-vista-e-entretela.png');
  const comDerivadas = await pecasGravadas();
  const vistaCriada = comDerivadas.find((p) => p.nome === 'Vista de molde-de-teste-1');
  const entretelaCriada = comDerivadas.find((p) => p.nome === 'Entretela de molde-de-teste-1');
  conferir(
    'a vista (pelo trecho clicado) e a entretela saem ao lado da peça; a entretela sem costura, no grupo "Entretela"',
    !!vistaCriada &&
      !!entretelaCriada &&
      caixa(vistaCriada.contorno).minY > caixa(depois[0].contorno).maxY &&
      entretelaCriada.margemDeCosturaMm === 0 &&
      entretelaCriada.grupoDoEncaixe === 'Entretela',
    JSON.stringify(comDerivadas.map((p) => [p.nome, p.grupoDoEncaixe || '', p.margemDeCosturaMm])),
  );
  const antesDeDesfazer = (await lista()).length;
  for (let k = 0; k < 2; k++) {
    await clicarEm(`document.querySelector('button[title="Desfazer (Ctrl+Z)"]')`);
    await espera(300);
  }
  const depoisDeDesfazer = await lista();
  conferir(
    'o Desfazer tira as duas peças novas (5 peças antes, as 3 de antes depois)',
    antesDeDesfazer === 5 && depoisDeDesfazer.length === 3 && depoisDeDesfazer.every((n) => n.startsWith('molde-de-teste-')),
    `${antesDeDesfazer} → ${JSON.stringify(depoisDeDesfazer)}`,
  );
  await aba('Início');
  await espera(300);

  // 3. Exportar o PDF das peças (tamanho real).
  await aba('Início');
  await botao('Exportar PDF');
  await espera(600);
  await js(`(() => { const s = document.querySelector('[role=dialog] select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'moldes-individuais'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await espera(300);
  await foto('09-exportar-pdf.png');
  await clicarEm(`document.querySelector('[role=dialog] .botao-primario')`);
  await espera(4000);
  const pdfs = fs.readdirSync(SAIDA).filter((f) => f.endsWith('.pdf'));
  const pdf = pdfs[0] ? fs.readFileSync(path.join(SAIDA, pdfs[0]), 'latin1') : '';
  conferir('o PDF foi gravado, com a folha na orientação da tela', pdf.startsWith('%PDF-') && pdf.includes('enfesto-cad:folha:como-a-tela'), JSON.stringify(pdfs));
  await fecharJanela();
  await espera(300);

  // 3b. Exportar o DXF, pela aba Início (ADR 0096): as 3 peças, cada uma com a linha de corte na camada CONTORNO.
  await botao('Exportar DXF');
  await espera(1500);
  const dxfs = fs.readdirSync(SAIDA).filter((f) => f.endsWith('.dxf'));
  const dxf = dxfs[0] ? fs.readFileSync(path.join(SAIDA, dxfs[0]), 'latin1') : '';
  const contornosNoDxf = dxf.split('0\r\nPOLYLINE\r\n8\r\nCONTORNO\r\n').length - 1;
  conferir('o DXF foi gravado: R12, em mm, com as 3 peças', dxf.startsWith('0\r\nSECTION') && dxf.includes('AC1009') && dxf.includes('$INSUNITS\r\n70\r\n4') && contornosNoDxf === 3, `${JSON.stringify(dxfs)} ${contornosNoDxf} contorno(s)`);

  // 3c. Exportar o PLT para o plotter (ADR 0101): HPGL, começando pelo IN e com um nome (LB) por peça.
  await botao('Exportar PLT');
  await espera(1500);
  const plts = fs.readdirSync(SAIDA).filter((f) => f.endsWith('.plt'));
  const plt = plts[0] ? fs.readFileSync(path.join(SAIDA, plts[0]), 'latin1') : '';
  const nomesNoPlt = plt.split(';LB').length - 1;
  conferir('o PLT foi gravado: HPGL, com o nome das 3 peças', plt.startsWith('IN;SP1;') && plt.trim().endsWith('PU0,0;SP0;') && nomesNoPlt >= 3, `${JSON.stringify(plts)} ${nomesNoPlt} nome(s)`);

  // 3d. Exportar o ISO para a mesa de corte (ADR 0140): o diálogo pede a velocidade e a caneta; o G-code em mm,
  // absoluto, com um comentário por peça, a caneta antes da faca em cada peça, e o fim do programa.
  await botao('Exportar ISO (corte)');
  await espera(500);
  await js(`(() => { const v = Array.from(document.querySelectorAll('[role=dialog] label')).find(l => l.textContent.includes('Velocidade de corte')).querySelector('input'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(v, '9000'); v.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] label')).find(l => l.textContent.includes('com a caneta')).querySelector('input')`);
  await foto('03d-dialogo-do-iso.png');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Salvar o ISO')`);
  await espera(1500);
  const isos = fs.readdirSync(SAIDA).filter((f) => f.endsWith('.iso'));
  const iso = isos[0] ? fs.readFileSync(path.join(SAIDA, isos[0]), 'utf8').split('\n') : [];
  const pecasNoIso = iso.filter((l) => /^\(.+\)$/.test(l) && !l.startsWith('(ENFESTO') && !l.startsWith('(T1')).length;
  const trocas = iso.filter((l) => /^T\d$/.test(l));
  conferir(
    'o ISO foi gravado: G-code em mm e absoluto, as 3 peças, a caneta (T3) antes da faca (T1), na velocidade pedida',
    iso[0] === '%' && iso.includes('G21') && iso.includes('G90') && iso.includes('M30') && pecasNoIso === 3 && trocas[0] === 'T3' && trocas.includes('T1') && iso.some((l) => l.endsWith(' F9000')) && (await js(`document.querySelectorAll('[role=dialog]').length`)) === 0,
    `${JSON.stringify(isos)} ${iso.length} linha(s), ${pecasNoIso} peça(s), ferramentas ${trocas.join(',')}`,
  );
  await aba('Encaixe');
  await espera(300);

  // 4. O planejamento de corte e o enfesto (a margem de segurança).
  await botao('Planejamento de corte');
  await espera(1200);
  conferir('abre o planejamento de corte', (await janela()) === 'Planejamento de corte', await janela());
  await foto('10-planejamento.png');

  // 4b. A troca com o ERP por uma pasta (ADR 0141): escolher a pasta (o programa cria as subpastas), o ERP deixa um
  // CSV de ordens do molde na entrada; "Trocar com o ERP agora" importa a ordem, move o arquivo para "processados" e
  // grava os cinco arquivos da saída.
  const pastaDoErp = path.join(SAIDA, 'troca-com-o-erp');
  fs.rmSync(pastaDoErp, { recursive: true, force: true });
  fs.mkdirSync(pastaDoErp, { recursive: true });
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === '2. Ordem')`);
  await espera(400);
  arquivoParaAbrir = pastaDoErp;
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Escolher a pasta…')`);
  await espera(800);
  arquivoParaAbrir = DXF;
  const subpastasDoErp = fs.readdirSync(pastaDoErp).sort().join(',');
  const notaDaTroca = await js(`(document.querySelector('[role=dialog] .troca-com-o-erp .nota-do-formulario') || {}).textContent || ''`);
  const codigoDoMolde = (notaDaTroca.match(/\(([^()]+)_ordens\.csv\)/) || [])[1] || '';
  const exemploDoCsv = await js(`(document.querySelector('[role=dialog] .exemplo-de-csv') || {}).textContent || ''`);
  fs.writeFileSync(path.join(pastaDoErp, 'entrada', `${codigoDoMolde}_ordens.csv`), exemploDoCsv.replace('OP-100', 'OP-ERP-1') + '\n');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Trocar com o ERP agora')`);
  let recadoDaTrocaComOErp = '';
  for (let i = 0; i < 20 && !recadoDaTrocaComOErp.includes('Saída para o ERP'); i++) {
    await espera(300);
    recadoDaTrocaComOErp = await js(`document.querySelector('[role=dialog]').innerText`);
  }
  await foto('10b-troca-com-o-erp.png');
  const naEntrada = fs.readdirSync(path.join(pastaDoErp, 'entrada'));
  const processados = fs.readdirSync(path.join(pastaDoErp, 'processados'));
  const naSaida = fs.readdirSync(path.join(pastaDoErp, 'saida')).sort();
  const ordensNaSaida = naSaida.includes('ordens.csv') ? fs.readFileSync(path.join(pastaDoErp, 'saida', 'ordens.csv'), 'utf8') : '';
  conferir(
    'a troca com o ERP: as subpastas criadas, a ordem do arquivo importada, o arquivo em "processados" e os cinco arquivos na saída',
    subpastasDoErp === 'com-erro,entrada,processados,saida' &&
      codigoDoMolde !== '' &&
      recadoDaTrocaComOErp.includes('1 ordem(ns) importada(s) do ERP') &&
      naEntrada.length === 0 &&
      processados.length === 1 &&
      processados[0].endsWith(`_${codigoDoMolde}_ordens.csv`) &&
      naSaida.join(',') === 'consumo-por-malha.csv,cortes.csv,movimentos-de-estoque.csv,ordens.csv,rolos.csv' &&
      ordensNaSaida.includes('OP-ERP-1;'),
    `${subpastasDoErp} | código ${codigoDoMolde} | entrada ${naEntrada.length}, processados ${JSON.stringify(processados)}, saída ${naSaida.join(',')}`,
  );
  await fecharJanela();
  await espera(300);
  await botao('Enfesto');
  await espera(600);
  const margens = await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] label')).filter(l => l.textContent.trim().startsWith('Margem')).map(l => l.querySelector('input').value))`);
  conferir('o Enfesto com as margens de 4 mm', JSON.stringify(JSON.parse(margens).map(Number)) === '[4,4]', margens);
  await foto('11-enfesto.png');
  await fecharJanela();
  await espera(300);

  // 5. A fila de encaixes (ADR 0102): dois encaixes postos na fila pelo Nesting automático (um de cada método),
  // calculados em segundo plano; a barra de status avisa; a fila mostra os dois, com a estrela no melhor; aplicar.
  const porNaFila = async (metodo) => {
    await botao('Nesting Automático');
    await espera(800);
    await js(`(() => { const s = document.querySelector('[role=dialog] select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(metodo)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await espera(300);
    await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Pôr na fila')`);
    await espera(500);
  };
  await porNaFila('grade');
  conferir('"Pôr na fila" fecha a janela do nesting', (await janela()) === 'nenhuma', await janela());
  await porNaFila('pontos-de-canto');
  const textoDaFila = () => js(`((document.querySelector('.barra-de-status .indicador-da-fila') || {}).textContent || '')`);
  let naBarra = '';
  for (let i = 0; i < 120 && !naBarra.includes('2 pronto'); i++) {
    await espera(500);
    naBarra = await textoDaFila();
  }
  conferir('a barra de status avisa os 2 encaixes prontos', naBarra === 'Fila: 2 pronto(s) para aplicar', naBarra);
  await foto('12-fila-na-barra.png');
  await clicarEm(`document.querySelector('.barra-de-status .indicador-da-fila')`);
  await espera(600);
  conferir('a barra de status abre a fila de encaixes', (await janela()) === 'Fila de encaixes', await janela());
  const linhasDaFila = JSON.parse(
    await js(`JSON.stringify(Array.from(document.querySelectorAll('.tabela-da-fila tbody tr')).map(tr => ({ texto: tr.innerText.replace(/\\s+/g, ' '), melhor: tr.classList.contains('trabalho-melhor') })))`),
  );
  conferir(
    'a fila mostra os 2 encaixes concluídos, um com a estrela de melhor',
    linhasDaFila.length === 2 && linhasDaFila.every((l) => l.texto.includes('Concluído')) && linhasDaFila.filter((l) => l.melhor).length === 1,
    JSON.stringify(linhasDaFila.map((l) => l.texto.slice(0, 150))),
  );
  await foto('13-fila-de-encaixes.png');
  await clicarEm(`document.querySelector('.tabela-da-fila tr.trabalho-melhor .botao-primario')`);
  await espera(800);
  const validacao = await js(`document.querySelector('.indicador-de-validacao').textContent`);
  const filaNaBarra = await textoDaFila();
  conferir(
    'aplicar o melhor põe o encaixe na mesa, sem erro de validação; na barra, só o outro pronto',
    (await janela()) === 'nenhuma' && !/[1-9]\d* erro/.test(validacao) && filaNaBarra === 'Fila: 1 pronto(s) para aplicar',
    `${validacao} / ${filaNaBarra}`,
  );
  const selecaoNaBarra = await js(`Array.from(document.querySelectorAll('.barra-de-status span')).map(s => s.textContent).find(t => t.startsWith('Seleção')) || ''`);
  conferir('depois de aplicar, nenhuma peça marcada', selecaoNaBarra === 'Seleção: nenhuma', selecaoNaBarra);
  await foto('14-fila-aplicada.png');
  const filaGravada = JSON.parse(fs.readFileSync(path.join(DADOS, 'fila-de-encaixes.json'), 'utf8'));
  conferir(
    'a fila ficou gravada na pasta de dados, com o aplicado marcado',
    filaGravada.trabalhos.length === 2 && filaGravada.trabalhos.filter((t) => t.aplicadoEmIso).length === 1,
    filaGravada.trabalhos.map((t) => t.situacao + (t.aplicadoEmIso ? ' (aplicado)' : '')).join(', '),
  );

  // 5b. O encaixe ligado ao molde (ADR 0125): o outro encaixe da fila foi calculado com as peças de antes. A margem de
  // costura da peça 1 muda; aplicar o outro põe a peça 1 de agora (com a margem nova) no lugar em que ele a pôs, e as
  // outras como ele as pôs. Dois Desfazer voltam ao que era.
  const outroDaFila = JSON.parse(fs.readFileSync(path.join(DADOS, 'fila-de-encaixes.json'), 'utf8')).trabalhos.find((t) => !t.aplicadoEmIso);
  const antesDaCostura = await pecasGravadas();
  await clicarEm(`Array.from(document.querySelectorAll('.lista-de-pecas li')).find(li => li.textContent.startsWith('molde-de-teste-1')).querySelector('button')`);
  await espera(300);
  await aba('Produção');
  await espera(300);
  await botao('Costura');
  await espera(500);
  const margemDeAntes = Number(antesDaCostura.find((p) => p.nome === 'molde-de-teste-1').margemDeCosturaMm);
  const margemNova = margemDeAntes + 6;
  await js(`(() => { const c = Array.from(document.querySelectorAll('[role=dialog] label')).find(l => l.textContent.trim().startsWith('Margem de costura')).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, ${JSON.stringify(String(margemNova))}); c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await espera(200);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Aplicar')`);
  await espera(500);
  await clicarEm(`document.querySelector('.barra-de-status .indicador-da-fila')`);
  await espera(600);
  await clicarEm(`Array.from(document.querySelectorAll('.tabela-da-fila tbody tr')).find(tr => !tr.innerText.includes('Aplicado')).querySelector('.botao-primario')`);
  await espera(800);
  const recadoDoLigado = await js(`((document.querySelector('.faixa-de-instrucao') || {}).textContent || '')`);
  await foto('14b-encaixe-com-o-molde-de-agora.png');
  const depoisDoLigado = await pecasGravadas();
  const mesmoContorno = (a, b) => a.length === b.length && a.every((p, k) => Math.hypot(p.x - b[k].x, p.y - b[k].y) < 0.01);
  const postaDe = (nome) => outroDaFila.resultado.pecasColocadas.find((c) => c.molde.nome === nome).molde;
  const peca1 = depoisDoLigado.find((p) => p.nome === 'molde-de-teste-1');
  conferir(
    'a peça mudada depois do encaixe entra com a margem nova, no lugar em que o encaixe a pôs; as outras como ele as pôs',
    depoisDoLigado.length === outroDaFila.resultado.pecasColocadas.length &&
      Number(peca1.margemDeCosturaMm) === margemNova &&
      depoisDoLigado.every((p) => mesmoContorno(p.contorno, postaDe(p.nome).contorno)) &&
      depoisDoLigado.filter((p) => p.nome !== 'molde-de-teste-1').every((p) => p.margemDeCosturaMm === postaDe(p.nome).margemDeCosturaMm),
    `margem ${peca1 && peca1.margemDeCosturaMm} (pedida ${margemNova}); ${depoisDoLigado.map((p) => p.nome + (mesmoContorno(p.contorno, postaDe(p.nome).contorno) ? ' no lugar' : ' FORA do lugar')).join(', ')}`,
  );
  conferir(
    'o recado diz que a peça entrou com o molde de agora',
    recadoDoLigado.startsWith('Encaixe aplicado com o molde de agora') && recadoDoLigado.includes('“molde-de-teste-1” mudou depois do encaixe'),
    recadoDoLigado.slice(0, 220),
  );
  for (let k = 0; k < 2; k++) {
    await clicarEm(`document.querySelector('button[title="Desfazer (Ctrl+Z)"]')`);
    await espera(300);
  }
  const desfeito = await pecasGravadas();
  conferir(
    'dois Desfazer voltam às peças de antes da costura',
    desfeito.length === antesDaCostura.length && desfeito.every((p, i) => p.margemDeCosturaMm === antesDaCostura[i].margemDeCosturaMm && mesmoContorno(p.contorno, antesDaCostura[i].contorno)),
    desfeito.map((p) => `${p.nome} ${p.margemDeCosturaMm}`).join(', '),
  );
  await aba('Encaixe');
  await espera(300);

  // 5c. A fila na rede (ADR 0143), com esta estação mandando e atendendo: a fila pausada, um encaixe posto nela vai
  // para a pasta ("Mandar para a rede"); com "Atender" ligado e a fila retomada, esta estação pega o pedido, calcula
  // como um encaixe dela, devolve o resultado à pasta, e o encaixe mandado termina "Concluído", calculado por ela.
  const pastaDaFila = path.join(SAIDA, 'fila-na-rede');
  fs.rmSync(pastaDaFila, { recursive: true, force: true });
  fs.mkdirSync(pastaDaFila, { recursive: true });
  const naFilaDaRede = (rotulo) => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
  await botao('Fila de encaixes');
  await espera(600);
  await naFilaDaRede('Pausar a fila');
  await espera(300);
  await fecharJanela();
  await espera(300);
  await porNaFila('grade');
  await botao('Fila de encaixes');
  await espera(600);
  arquivoParaAbrir = pastaDaFila;
  await clicarEm(`Array.from(document.querySelectorAll('.fila-da-rede button')).find(b => b.textContent.trim() === 'Escolher a pasta…')`);
  await espera(800);
  arquivoParaAbrir = DXF;
  await js(`(() => { const i = Array.from(document.querySelectorAll('.fila-da-rede label')).find(l => l.textContent.includes('Nome desta estação')).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Estação de teste'); i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await espera(200);
  await naFilaDaRede('Mandar para a rede');
  await espera(800);
  const pedidosNaPasta = fs.readdirSync(path.join(pastaDaFila, 'pedidos'));
  const linhaMandadaNaRede = await js(`(Array.from(document.querySelectorAll('.tabela-da-fila tbody tr')).find(tr => tr.innerText.includes('Na fila da rede')) || {}).innerText || ''`);
  await foto('14b-fila-na-rede-mandado.png');
  await clicarEm(`Array.from(document.querySelectorAll('.fila-da-rede label')).find(l => l.textContent.includes('Atender a fila da rede')).querySelector('input')`);
  await naFilaDaRede('Retomar a fila');
  let linhaCalculada = '';
  for (let i = 0; i < 120 && !linhaCalculada; i++) {
    await espera(500);
    linhaCalculada = await js(`(Array.from(document.querySelectorAll('.tabela-da-fila tbody tr')).find(tr => tr.innerText.includes('calculado por Estação de teste na rede')) || {}).innerText || ''`);
  }
  await espera(600);
  const sobrouNaPasta = ['pedidos', 'calculando', 'prontos'].map((s) => fs.readdirSync(path.join(pastaDaFila, s)).length);
  const pedidosDaRedeNaFila = JSON.parse(fs.readFileSync(path.join(DADOS, 'fila-de-encaixes.json'), 'utf8')).trabalhos.filter((t) => t.pedidoDaRede).length;
  await foto('14c-fila-na-rede-calculado.png');
  conferir(
    'a fila na rede: o encaixe mandado vai para a pasta, esta estação atende, calcula e devolve, e ele termina "Concluído", calculado por ela',
    pedidosNaPasta.length === 1 &&
      linhaMandadaNaRede.includes('Trazer de volta') &&
      /Concluído/.test(linhaCalculada) &&
      sobrouNaPasta.join(',') === '0,0,0' &&
      pedidosDaRedeNaFila === 0,
    `pedidos ${JSON.stringify(pedidosNaPasta)} | ${linhaMandadaNaRede.replace(/\s+/g, ' ').slice(0, 120)} | ${linhaCalculada.replace(/\s+/g, ' ').slice(0, 160)} | pasta ${sobrouNaPasta.join(',')} | pedidos da rede na fila ${pedidosDaRedeNaFila}`,
  );
  await clicarEm(`Array.from(document.querySelectorAll('.fila-da-rede label')).find(l => l.textContent.includes('Atender a fila da rede')).querySelector('input')`);
  await fecharJanela();
  await espera(300);

  // 6. Os grupos do encaixe (ADR 0103): uma peça no grupo "Entretela", pela janela do Nesting automático; calcular e
  // aplicar: o resultado diz o trecho de cada grupo, e a mesa mostra o nome do grupo e a divisa.
  await botao('Nesting Automático');
  await espera(800);
  await js(
    `(() => { const c = document.querySelector('[aria-label="Grupo de molde-de-teste-2"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, 'Entretela'); c.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await espera(400);
  const notaDosGrupos = await js(`Array.from(document.querySelectorAll('[role=dialog] .nota-do-formulario')).map(p => p.textContent).find(t => t.startsWith('Grupos:')) || ''`);
  conferir('o grupo posto na janela do nesting entra na ordem dos grupos', notaDosGrupos.includes('nesta ordem: Entretela → as sem grupo'), notaDosGrupos.slice(0, 120));
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Calcular encaixe')`);
  let trechosDosGrupos = [];
  for (let i = 0; i < 60 && trechosDosGrupos.length === 0; i++) {
    await espera(500);
    trechosDosGrupos = JSON.parse(
      await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] .trechos-dos-grupos li')).map(li => li.textContent))`),
    );
  }
  conferir(
    'o resultado diz o trecho da Entretela e o das sem grupo',
    trechosDosGrupos.length === 2 && trechosDosGrupos[0].startsWith('Entretela: de ') && trechosDosGrupos[1].startsWith('Sem grupo: de '),
    JSON.stringify(trechosDosGrupos),
  );
  await foto('15-nesting-com-grupos.png');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Aplicar ao projeto')`);
  await espera(800);
  const validacaoComGrupos = await js(`document.querySelector('.indicador-de-validacao').textContent`);
  const selosDeGrupo = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('.lista-de-pecas .grupo-da-peca')).map(s => s.textContent))`));
  conferir(
    'aplicado: a lista mostra o grupo da peça, e a validação não acusa grupos misturados',
    JSON.stringify(selosDeGrupo) === '["Entretela"]' && validacaoComGrupos === 'Validação: sem problemas',
    `${JSON.stringify(selosDeGrupo)} / ${validacaoComGrupos}`,
  );
  await foto('16-grupos-na-mesa.png');

  // 6b. O plotter de duas canetas (ADR 0115): Opções > "Plotter de duas canetas"; o PLT com a linha de corte na caneta 1,
  // o risco na 2, e o nome de cada grupo do encaixe no começo do seu trecho.
  await clicarEm(`Array.from(document.querySelectorAll('.botao-de-menu')).find(b => b.textContent.trim() === 'Opções')`);
  await clicarEm(`Array.from(document.querySelectorAll('[role=menu] .item-de-menu')).find(b => b.textContent.includes('duas canetas'))`);
  await espera(300);
  await aba('Início');
  await botao('Exportar PLT');
  await espera(1500);
  const pltsComGrupos = fs.readdirSync(SAIDA).filter((f) => f.endsWith('.plt'));
  const pltComGrupos = pltsComGrupos[0] ? fs.readFileSync(path.join(SAIDA, pltsComGrupos[0]), 'latin1') : '';
  const cortesNaCaneta1 = pltComGrupos.split(';SP1;').length - 1;
  conferir(
    'o PLT de duas canetas: o corte na 1, o risco na 2, e o nome dos dois grupos',
    pltComGrupos.includes(';SP2;') && cortesNaCaneta1 >= 3 && pltComGrupos.includes('LBEntretela\x03') && pltComGrupos.includes('LBSem grupo\x03'),
    `${cortesNaCaneta1} troca(s) para a 1 / ${pltComGrupos.split(';SP2;').length - 1} para a 2`,
  );
  await aba('Encaixe');
  await espera(300);

  // 7. A biblioteca de materiais e aviamentos (ADR 0104): Modelo > Materiais e aviamentos, um material novo pelo
  // formulário, guardado na lista e no arquivo da pasta de dados.
  const digitar = (rotulo, valor) =>
    js(
      `(() => { const l = Array.from(document.querySelectorAll('[role=dialog] label')).find(x => Array.from(x.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === ${JSON.stringify(rotulo)}); const c = l.querySelector('input, select, textarea'); const p = c.tagName === 'SELECT' ? HTMLSelectElement.prototype : c.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(c, ${JSON.stringify(valor)}); c.dispatchEvent(new Event(c.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
    );
  await aba('Modelo');
  await espera(300);
  await botao('Materiais e aviamentos');
  await espera(800);
  conferir('abre a biblioteca de materiais', (await janela()) === 'Materiais e aviamentos', await janela());
  const botaoNaJanelaDeMateriais = (texto) => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === ${JSON.stringify(texto)})`);
  await botaoNaJanelaDeMateriais('Novo material');
  await digitar('Descrição *', 'Botão de pressão 12 mm');
  await digitar('Código', 'BOT-12');
  await digitar('Preço por un (R$)', '0,35');
  await digitar('Fornecedor', 'Aviamentos do teste');
  await foto('17-material-novo.png');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Guardar')`);
  await espera(800);
  const naListaDeMateriais = await js(`((document.querySelector('[role=dialog] .tabela-de-materiais tbody tr') || {}).textContent || '')`);
  const bibliotecaGravada = JSON.parse(fs.readFileSync(path.join(DADOS, 'biblioteca-de-materiais.json'), 'utf8'));
  conferir(
    'o material novo aparece na lista (com o preço com vírgula) e fica gravado na pasta de dados',
    naListaDeMateriais.includes('BOT-12') && naListaDeMateriais.includes('R$ 0,35/un') && bibliotecaGravada.materiais.length === 1 && bibliotecaGravada.materiais[0].precoPorUnidade === 0.35,
    `${naListaDeMateriais} / ${JSON.stringify(bibliotecaGravada.materiais.map((m) => [m.codigo, m.precoPorUnidade]))}`,
  );
  await foto('18-materiais.png');

  // 7b. A planilha de materiais (ADR 0115): o colado do Excel (separado por tabulação) — o botão já cadastrado ganha a
  // cor (o mesmo preço), a linha entra como nova, e a de unidade desconhecida fica de fora, dita na prévia.
  const planilha = [
    ['Código', 'Descrição', 'Categoria', 'Unidade', 'Preço', 'Cor'],
    ['BOT-12', 'Botão de pressão 12 mm', 'Aviamento', 'un', '0,35', 'Preto'],
    ['LIN-120', 'Linha de costura 120', 'Aviamento', 'un', 'R$ 12,90', 'Branco'],
    ['ELA-30', 'Elástico 30 mm', 'Aviamento', 'rolo', '5', ''],
  ]
    .map((l) => l.join('\t'))
    .join('\n');
  await botaoNaJanelaDeMateriais('Importar planilha…');
  await js(
    `(() => { const c = document.querySelector('[role=dialog] .importacao-de-materiais textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(c, ${JSON.stringify(planilha)}); c.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await espera(300);
  const previaDaPlanilha = await js(`((document.querySelector('[role=dialog] .previa-da-importacao') || {}).innerText || '')`);
  await foto('18b-planilha-de-materiais.png');
  await clicarEm(`document.querySelector('[role=dialog] .importacao-de-materiais .botao-primario')`);
  await espera(800);
  const depoisDaPlanilha = JSON.parse(fs.readFileSync(path.join(DADOS, 'biblioteca-de-materiais.json'), 'utf8'));
  const botaoDaPlanilha = depoisDaPlanilha.materiais.find((m) => m.codigo === 'BOT-12');
  conferir(
    'a planilha colada: 1 novo, 1 atualizado (o botão ganha a cor, o preço fica), a linha de unidade "rolo" dita e de fora',
    previaDaPlanilha.includes('1 material(is) novo(s), 1 atualizado(s)') &&
      !previaDaPlanilha.includes('preço novo') &&
      previaDaPlanilha.includes('“rolo”') &&
      depoisDaPlanilha.materiais.length === 2 &&
      botaoDaPlanilha.cor === 'Preto' &&
      botaoDaPlanilha.precoPorUnidade === 0.35 &&
      depoisDaPlanilha.materiais.some((m) => m.codigo === 'LIN-120' && m.precoPorUnidade === 12.9),
    `${previaDaPlanilha.replace(/\s+/g, ' ').slice(0, 160)} / ${JSON.stringify(depoisDaPlanilha.materiais.map((m) => [m.codigo, m.precoPorUnidade, m.cor ?? '']))}`,
  );
  await fecharJanela();
  await espera(300);

  // 8. A ficha técnica e o pré-custo (ADR 0105 e 0106): Modelo > Ficha técnica; a coleção, o botão da biblioteca
  // como material (6 por peça), uma operação; o pré-custo; enviar e aprovar; o PDF; a ficha guardada no projeto.
  const noCampo = (rotulo, valor) =>
    js(
      `(() => { const c = document.querySelector('[role=dialog] [aria-label=${JSON.stringify(rotulo).replace(/"/g, '\\"')}]') || Array.from(document.querySelectorAll('[role=dialog] label')).find(x => Array.from(x.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === ${JSON.stringify(rotulo)}).querySelector('input, select, textarea'); const p = c.tagName === 'SELECT' ? HTMLSelectElement.prototype : c.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(c, ${JSON.stringify(valor)}); c.dispatchEvent(new Event(c.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`,
    );
  const botaoNaJanela = (texto) => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === ${JSON.stringify(texto)})`);
  const parteDaJanela = (texto) => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] [role=tab]')).find(b => b.textContent.trim().startsWith(${JSON.stringify(texto)}))`);
  await botao('Ficha técnica');
  await espera(1000);
  conferir('abre a ficha técnica', (await janela()) === 'Ficha técnica', await janela());
  await noCampo('Coleção', 'Verão do teste');
  await parteDaJanela('Materiais');
  await botaoNaJanela('Adicionar material');
  await noCampo('Consumo de Botão de pressão 12 mm', 'informado');
  await noCampo('Quantidade de Botão de pressão 12 mm', '6');
  await espera(300);
  await foto('19-ficha-materiais.png');
  await parteDaJanela('Operações');
  await botaoNaJanela('Adicionar operação');
  await noCampo('Operação 1', 'Pregar botões');
  await noCampo('Tempo da operação 1', '1,5');
  await parteDaJanela('Pré-custo');
  await espera(300);
  const custoNaFicha = await js(`(() => { const dt = Array.from(document.querySelectorAll('[role=dialog] dt')).find(d => d.textContent.startsWith('Custo total')); return dt ? dt.textContent + ' = ' + dt.nextElementSibling.textContent : ''; })()`);
  const faltaNoCusto = await js(`((document.querySelector('[role=dialog] .faixa-do-custo-parcial') || {}).textContent || '')`);
  conferir(
    'o pré-custo: os 6 botões a R$ 0,35 (R$ 2,10); sem o custo do minuto, sai parcial e diz o que falta',
    custoNaFicha === 'Custo total (parcial) = R$ 2,10' && faltaNoCusto.includes('Falta o custo do minuto'),
    `${custoNaFicha} / ${faltaNoCusto.slice(0, 90)}`,
  );
  await foto('20-pre-custo.png');
  await parteDaJanela('Aprovação');
  await noCampo('Responsável', 'Pessoa do teste');
  await botaoNaJanela('Enviar para aprovação');
  await botaoNaJanela('Aprovar');
  await espera(300);
  const situacaoDaFicha = await js(`((document.querySelector('[role=dialog] .cabecalho-da-ficha .situacao-da-execucao') || {}).textContent || '')`);
  conferir('enviada e aprovada: o cabeçalho diz "Aprovada · versão 1"', situacaoDaFicha === 'Aprovada · versão 1', situacaoDaFicha);
  await foto('21-ficha-aprovada.png');
  await botaoNaJanela('Exportar PDF');
  await espera(2500);
  const pdfsDaFicha = fs.readdirSync(SAIDA).filter((f) => f.startsWith('ficha-tecnica-') && f.endsWith('.pdf'));
  const pdfDaFicha = pdfsDaFicha[0] ? fs.readFileSync(path.join(SAIDA, pdfsDaFicha[0]), 'latin1') : '';
  conferir('o PDF da ficha técnica foi gravado', pdfDaFicha.startsWith('%PDF-') && pdfDaFicha.length > 3000, `${JSON.stringify(pdfsDaFicha)} ${pdfDaFicha.length} bytes`);
  await fecharJanela();
  await espera(1200);
  const projetoComFicha = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', f), 'utf8')))
    .find((p) => p.fichaTecnica);
  conferir(
    'a ficha ficou guardada no projeto: aprovada, com a coleção, o material, a operação e o histórico',
    !!projetoComFicha &&
      projetoComFicha.fichaTecnica.situacao === 'aprovada' &&
      projetoComFicha.fichaTecnica.colecao === 'Verão do teste' &&
      projetoComFicha.fichaTecnica.materiais.length === 1 &&
      projetoComFicha.fichaTecnica.operacoes[0].tempoMin === 1.5 &&
      projetoComFicha.fichaTecnica.decisoes.map((d) => d.acao).join(',') === 'enviada,aprovada',
    projetoComFicha ? JSON.stringify({ situacao: projetoComFicha.fichaTecnica.situacao, colecao: projetoComFicha.fichaTecnica.colecao, decisoes: projetoComFicha.fichaTecnica.decisoes.map((d) => d.acao) }) : 'nenhum projeto com ficha',
  );

  // 9. O desenho técnico (ADR 0107): com a ficha aprovada, só para ver; aberta a nova versão, a base da camiseta, um
  // pesponto desenhado com o mouse (aparece espelhado) e um bolso; o SVG; a prévia na ficha e o croqui no PDF.
  const pontoDaFolhaNaTela = async (fx, fy) =>
    JSON.parse(
      await js(
        `(() => { const r = document.querySelector('.folha-do-desenho').getBoundingClientRect(); const e = Math.min(r.width / 400, r.height / 500); return JSON.stringify({ x: Math.round(r.left + (r.width - 400 * e) / 2 + ${fx} * e), y: Math.round(r.top + (r.height - 500 * e) / 2 + ${fy} * e) }); })()`,
      ),
    );
  const clicarNaFolha = async (fx, fy, vezes = 1) => {
    const { x, y } = await pontoDaFolhaNaTela(fx, fy);
    for (let k = 1; k <= vezes; k++) {
      win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: k });
      win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: k });
    }
    await espera(250);
  };
  await botao('Desenho técnico');
  await espera(800);
  const avisoDoDesenho = await js(`((document.querySelector('[role=dialog] .cabecalho-da-ficha .nota-do-formulario') || {}).textContent || '')`);
  conferir('com a ficha aprovada, o desenho técnico abre só para ver', (await janela()) === 'Desenho técnico' && avisoDoDesenho.includes('só pode ser visto'), avisoDoDesenho.slice(0, 100));
  await fecharJanela();
  await espera(300);
  await botao('Ficha técnica');
  await espera(800);
  await parteDaJanela('Aprovação');
  await noCampo('Responsável', 'Pessoa do teste');
  await botaoNaJanela('Abrir nova versão');
  await espera(300);
  await fecharJanela();
  await espera(800);
  await botao('Desenho técnico');
  await espera(800);
  await botaoNaJanela('Pôr a base (frente e costas)');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] [role=toolbar] button')).find(b => b.textContent.trim() === 'Pesponto')`);
  await clicarNaFolha(124, 300);
  await clicarNaFolha(170, 300, 2);
  await noCampo('Forma', 'bolso-chapa');
  await botaoNaJanela('Pôr a forma');
  await espera(300);
  const naFolhaDoDesenho = JSON.parse(
    await js(`JSON.stringify({ tracejados: document.querySelectorAll('.folha-do-desenho path[stroke-dasharray="4 3"]').length, frente: (Array.from(document.querySelectorAll('[role=dialog] [role=tab]')).find(b => b.textContent.startsWith('Frente')) || {}).textContent })`),
  );
  conferir(
    'a base, o pesponto desenhado com o mouse (e o espelho dele) e o bolso na folha da frente',
    naFolhaDoDesenho.frente === 'Frente (6)' && naFolhaDoDesenho.tracejados >= 6,
    JSON.stringify(naFolhaDoDesenho),
  );
  await foto('22-desenho-tecnico.png');

  // 9b. O zoom e a grade da folha (ADR 0116): a roda do mouse aproxima no bolso (pelo sistema, como a mão faz), e a
  // grade aparece; o botão do zoom volta à folha inteira.
  const caixaDaFolha = () => js(`document.querySelector('.folha-do-desenho').getAttribute('viewBox')`);
  const noBolso = await pontoDaFolhaNaTela(145, 230);
  let caixaDePerto = await caixaDaFolha();
  for (const sentido of [120, -120]) {
    for (let k = 0; k < 4 && caixaDePerto === '0 0 400 500'; k++) {
      win.webContents.sendInputEvent({ type: 'mouseWheel', x: noBolso.x, y: noBolso.y, deltaX: 0, deltaY: sentido, canScroll: true });
      await espera(150);
    }
    caixaDePerto = await caixaDaFolha();
    if (caixaDePerto !== '0 0 400 500') break;
  }
  await clicarEm(`Array.from(document.querySelectorAll('[role=toolbar][aria-label="Zoom e grade"] button')).find(b => b.textContent.trim() === 'Grade')`);
  await espera(300);
  const [xDePerto, yDePerto, larguraDePerto, alturaDePerto] = caixaDePerto.split(' ').map(Number);
  const linhasDaGrade = Number(await js(`document.querySelectorAll('.folha-do-desenho .grade-da-folha line').length`));
  const zoomNaTela = await js(`document.querySelector('.controles-da-folha .zoom-da-folha').textContent`);
  conferir(
    'a roda do mouse aproxima no bolso (ele fica na janela), e a grade aparece',
    larguraDePerto < 400 && 145 > xDePerto && 145 < xDePerto + larguraDePerto && 230 > yDePerto && 230 < yDePerto + alturaDePerto && linhasDaGrade > 0,
    `viewBox ${caixaDePerto} / ${zoomNaTela} / ${linhasDaGrade} linha(s) da grade`,
  );
  await foto('22b-desenho-de-perto-com-grade.png');
  await clicarEm(`document.querySelector('.controles-da-folha .zoom-da-folha')`);
  await clicarEm(`Array.from(document.querySelectorAll('[role=toolbar][aria-label="Zoom e grade"] button')).find(b => b.textContent.trim() === 'Grade')`);
  await espera(300);
  conferir('o botão do zoom volta à folha inteira', (await caixaDaFolha()) === '0 0 400 500', await caixaDaFolha());
  await botaoNaJanela('Exportar SVG');
  await espera(1200);
  const svgs = fs.readdirSync(SAIDA).filter((f) => f.startsWith('desenho-tecnico-') && f.endsWith('.svg'));
  const svgDoDesenho = svgs[0] ? fs.readFileSync(path.join(SAIDA, svgs[0]), 'utf8') : '';
  conferir('o SVG do desenho foi gravado, com a frente e as costas', svgDoDesenho.includes('<svg') && svgDoDesenho.includes('>Frente</text>') && svgDoDesenho.includes('>Costas</text>'), `${JSON.stringify(svgs)} ${svgDoDesenho.length} letras`);
  await fecharJanela();
  await espera(1200);
  await botao('Ficha técnica');
  await espera(800);
  const previas = Number(await js(`document.querySelectorAll('[role=dialog] .previa-do-desenho svg').length`));
  conferir('a ficha (versão 2) mostra o desenho técnico na Descrição', previas === 2, `${previas} vista(s)`);
  await foto('23-ficha-com-desenho.png');
  await botaoNaJanela('Exportar PDF');
  await espera(2500);
  const pdfComDesenho = fs.readFileSync(path.join(SAIDA, fs.readdirSync(SAIDA).find((f) => f.startsWith('ficha-tecnica-') && f.endsWith('.pdf'))), 'latin1');
  // O texto do PDF (sem compressão) vem em hexadecimal: decodificado, as palavras aparecem.
  const textoDoPdf = [...pdfComDesenho.matchAll(/<([0-9a-f]+)>/g)].map((m) => String.fromCharCode(...m[1].match(/../g).map((h) => parseInt(h, 16)))).join('');
  conferir('o PDF da ficha leva o desenho técnico', textoDoPdf.includes('Desenho t') && textoDoPdf.includes('Costas'), `${pdfComDesenho.length} bytes`);
  await fecharJanela();
  await espera(1200);
  const fichaComDesenho = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', f), 'utf8')))
    .find((p) => p.fichaTecnica && p.fichaTecnica.desenho)?.fichaTecnica;
  conferir(
    'o desenho ficou guardado na ficha do projeto (versão 2, em rascunho)',
    !!fichaComDesenho && fichaComDesenho.versao === 2 && fichaComDesenho.desenho.elementos.length === 8,
    fichaComDesenho ? `versão ${fichaComDesenho.versao}, ${fichaComDesenho.desenho.elementos.length} elementos` : 'sem desenho',
  );

  // 10. As coleções (ADR 0108): uma coleção nova; um modelo ligado ao projeto aberto (o croqui aparece no cartão);
  // uma tarefa atrasada; o aviso de prazos na barra de status abre os prazos; tudo gravado em colecoes.json.
  await botao('Coleções');
  await espera(800);
  conferir('abre as coleções', (await janela()) === 'Coleções', await janela());
  await botaoNaJanela('Nova coleção');
  await noCampo('Nome da coleção *', 'Coleção do teste');
  await noCampo('Lançamento', '2027-01-15');
  await botaoNaJanela('Guardar a coleção');
  await espera(500);
  await botaoNaJanela('Novo modelo');
  await espera(500);
  await noCampo('Categoria', 'Camiseta');
  await botaoNaJanela('Guardar o modelo');
  await espera(300);
  await botaoNaJanela('Ligar o projeto aberto');
  await espera(300);
  await noCampo('Nova tarefa', 'Comprar o aviamento');
  await noCampo('Prazo da tarefa', '2026-01-02');
  await botaoNaJanela('Pôr a tarefa');
  await espera(500);
  const croquiNoModelo = Number(await js(`document.querySelectorAll('[role=dialog] .detalhe-do-modelo .previa-do-desenho svg').length`));
  conferir('o modelo ligado ao projeto aberto mostra o croqui da ficha', croquiNoModelo === 1, `${croquiNoModelo} croqui(s)`);
  await foto('24-modelo-da-colecao.png');
  await botaoNaJanela('← Voltar ao mix');
  await espera(300);
  const cartao = await js(`((document.querySelector('[role=dialog] .cartao-do-modelo') || {}).textContent || '')`);
  const croquiNoCartao = Number(await js(`document.querySelectorAll('[role=dialog] .cartao-do-modelo svg').length`));
  conferir('o mix mostra o cartão com o croqui, a categoria e a etapa', croquiNoCartao === 1 && cartao.includes('Camiseta') && cartao.includes('Criação'), cartao.slice(0, 120));
  await foto('25-mix-da-colecao.png');

  // 10b. O cartão arrastado no quadro das etapas (ADR 0118), com o mouse de verdade (pelo sistema): da Criação para a
  // Modelagem; no meio do arrasto, a Modelagem fica verde e diz "Avançar", a Produção fica apagada.
  await parteDaJanela('Etapas');
  await espera(300);
  const centroDe = async (seletor) =>
    JSON.parse(await js(`(() => { const r = document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 60)) }); })()`));
  const doCartao = await centroDe('[data-etapa="criacao"] .cartao-da-etapa .nome-do-cartao');
  const daModelagem = await centroDe('[data-etapa="modelagem"]');
  await js(`(() => { window.__alvoDoArrasto = ''; document.addEventListener('pointermove', (e) => { window.__alvoDoArrasto = String(e.target.className || e.target.tagName); }, true); return 1; })()`);
  win.webContents.sendInputEvent({ type: 'mouseDown', x: doCartao.x, y: doCartao.y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 8; k++) {
    win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: Math.round(doCartao.x + ((daModelagem.x - doCartao.x) * k) / 8),
      y: Math.round(doCartao.y + ((daModelagem.y - doCartao.y) * k) / 8),
      button: 'left',
      modifiers: ['leftButtonDown'],
    });
    await espera(60);
  }
  // Mais um passo pequeno no mesmo lugar: a coluna debaixo do mouse é a do último movimento já desenhado.
  win.webContents.sendInputEvent({ type: 'mouseMove', x: daModelagem.x + 2, y: daModelagem.y + 2, button: 'left', modifiers: ['leftButtonDown'] });
  await espera(400);
  // O sistema às vezes perde os últimos movimentos mandados de uma vez (o cartão para no meio do caminho, entre as
  // colunas): o último movimento é repetido, um pouco ao lado, até o quadro mostrar a coluna debaixo do mouse.
  for (let i = 0; i < 10 && !(await js(`document.querySelector('[data-etapa="modelagem"]').className`)).includes('destino-sob-o-cartao'); i++) {
    win.webContents.sendInputEvent({ type: 'mouseMove', x: daModelagem.x + 3 + (i % 2), y: daModelagem.y + 3, button: 'left', modifiers: ['leftButtonDown'] });
    await espera(200);
  }
  const noMeioDoArrasto = JSON.parse(
    await js(
      `JSON.stringify({ modelagem: document.querySelector('[data-etapa="modelagem"]').className, producao: document.querySelector('[data-etapa="producao"]').className, rotulo: ((document.querySelector('[data-etapa="modelagem"] .o-que-o-arrasto-faz') || {}).textContent || ''), alvo: window.__alvoDoArrasto })`,
    ),
  );
  await foto('25b-arrastando-o-cartao.png');
  win.webContents.sendInputEvent({ type: 'mouseUp', x: daModelagem.x, y: daModelagem.y, button: 'left', clickCount: 1 });
  await espera(500);
  // O teste não tem o autor nem o responsável da coleção: a janela pergunta quem decide, em vez de falhar.
  const pedidoDeQuem = await js(`((document.querySelector('[role=dialog] .pedido-de-mudanca') || {}).textContent || '')`);
  await foto('25c-quem-decide.png');
  await noCampo('Quem decide', 'Pessoa do teste');
  await botaoNaJanela('Confirmar');
  await espera(800);
  const naModelagem = await js(`((document.querySelector('[data-etapa="modelagem"] .cartao-da-etapa') || {}).textContent || '')`);
  conferir(
    'arrastar o cartão com o mouse: a Modelagem verde com "Avançar", a Produção apagada; solto, pergunta quem decide e vai para a Modelagem',
    noMeioDoArrasto.modelagem.includes('destino-sob-o-cartao') &&
      noMeioDoArrasto.rotulo === 'Avançar' &&
      noMeioDoArrasto.producao.includes('destino-invalido') &&
      pedidoDeQuem.includes('Criação → Modelagem') &&
      naModelagem.startsWith('Modelo 1'),
    `${JSON.stringify(noMeioDoArrasto)} / ${pedidoDeQuem.slice(0, 60)} / ${naModelagem.slice(0, 60)}`,
  );
  await fecharJanela();
  await espera(500);
  const prazosNaBarra = await js(`((document.querySelector('.barra-de-status .indicador-de-prazos') || {}).textContent || '')`);
  conferir('a barra de status avisa o prazo atrasado', prazosNaBarra === 'Prazos: 1 atrasado(s)', prazosNaBarra);
  await clicarEm(`document.querySelector('.barra-de-status .indicador-de-prazos')`);
  await espera(600);
  const linhaDoPrazo = await js(`((document.querySelector('[role=dialog] table tbody tr') || {}).textContent || '')`);
  conferir('o aviso abre os prazos da coleção, com a tarefa atrasada', (await janela()) === 'Coleções' && linhaDoPrazo.includes('Comprar o aviamento') && linhaDoPrazo.includes('atrasado'), linhaDoPrazo.slice(0, 120));
  await foto('26-prazos.png');
  await fecharJanela();
  await espera(300);
  const colecoesGravadas = JSON.parse(fs.readFileSync(path.join(DADOS, 'colecoes.json'), 'utf8'));
  const modeloGravado = colecoesGravadas.colecoes[0] && colecoesGravadas.colecoes[0].modelos[0];
  conferir(
    'a coleção ficou gravada: o modelo com a categoria, o projeto ligado e a tarefa',
    colecoesGravadas.colecoes.length === 1 && !!modeloGravado && modeloGravado.categoria === 'Camiseta' && !!modeloGravado.projetoId && modeloGravado.tarefas.length === 1,
    JSON.stringify(colecoesGravadas.colecoes.map((c) => ({ nome: c.nome, modelos: c.modelos.map((m) => [m.nome, m.categoria, !!m.projetoId, m.tarefas.length]) }))),
  );

  // 11. O molde da foto (ADR 0109, 0121, 0122): uma foto desenhada aqui — a placa de 140 × 190 mm fotografada torta e
  // curvada pela lente do celular, com o papel
  // de 100 × 150 mm (um furo, o traço do fio e um pique em V) — entra pelo campo de arquivo de verdade; os 4 cantos e
  // o clique dentro do molde com o mouse; as medidas e os achados; a peça criada no projeto.
  const CANTOS_DA_FOTO = [
    [60, 40],
    [520, 80],
    [560, 690],
    [30, 640],
  ];
  const h = homografiaDoTeste(
    [
      [0, 0],
      [140, 0],
      [140, 190],
      [0, 190],
    ],
    CANTOS_DA_FOTO,
  );
  // A lente do celular (ADR 0122): a foto sai curvada em barril (o ponto certo vai para mais perto do meio); as retas
  // da placa e do papel viram curvas, por isso cada lado é desenhado em muitos pedaços.
  const LENTE_DA_FOTO = { k: 0.08, cx: 300, cy: 360, raio: Math.hypot(600, 720) / 2 };
  const comLente = ([x, y]) => {
    const ux = (x - LENTE_DA_FOTO.cx) / LENTE_DA_FOTO.raio;
    const uy = (y - LENTE_DA_FOTO.cy) / LENTE_DA_FOTO.raio;
    const ru = Math.hypot(ux, uy);
    if (ru < 1e-12) return [x, y];
    let r = ru;
    for (let i = 0; i < 12; i++) r -= (r * (1 + LENTE_DA_FOTO.k * r * r) - ru) / (1 + 3 * LENTE_DA_FOTO.k * r * r);
    return [LENTE_DA_FOTO.cx + (ux * r * LENTE_DA_FOTO.raio) / ru, LENTE_DA_FOTO.cy + (uy * r * LENTE_DA_FOTO.raio) / ru];
  };
  const naFotoComLente = ([x, y]) => comLente(aplicarHomografiaDoTeste(h, x, y));
  const projetar = (pontos) =>
    pontos.flatMap(([x, y], i) => {
      const [qx, qy] = pontos[(i + 1) % pontos.length];
      return Array.from({ length: 24 }, (_, k) => naFotoComLente([x + ((qx - x) * k) / 24, y + ((qy - y) * k) / 24]));
    });
  /** Um trecho de traço de caneta de `w` mm de a até b (em mm da placa), meio traço a mais em cada ponta. */
  const trechoDeCaneta = ([ax, ay], [bx, by], w) => {
    const l = Math.hypot(bx - ax, by - ay);
    const [ux, uy] = [((bx - ax) / l) * (w / 2), ((by - ay) / l) * (w / 2)];
    const [nx, ny] = [-uy, ux];
    return [
      [ax - ux + nx, ay - uy + ny],
      [bx + ux + nx, by + uy + ny],
      [bx + ux - nx, by + uy - ny],
      [ax - ux - nx, ay - uy - ny],
    ];
  };
  const camadasDaFoto = [
    [projetar([[0, 0], [140, 0], [140, 190], [0, 190]]), 60],
    [projetar([[20, 20], [68, 20], [70, 24], [72, 20], [120, 20], [120, 170], [20, 170]]), 220],
    [projetar(Array.from({ length: 36 }, (_, i) => [50 + 4 * Math.cos((i * Math.PI) / 18), 60 + 4 * Math.sin((i * Math.PI) / 18)])), 60],
    [projetar([[69.5, 50], [70.5, 50], [70.5, 140], [69.5, 140]]), 40],
    // A pence desenhada a caneta (ADR 0121): o V de 20 mm de boca e 35 mm de fundo.
    [projetar(trechoDeCaneta([35, 120], [45, 155], 1.2)), 40],
    [projetar(trechoDeCaneta([45, 155], [55, 120], 1.2)), 40],
  ];
  await js(
    `(async () => {
      const tela = document.createElement('canvas');
      tela.width = 600;
      tela.height = 720;
      const ctx = tela.getContext('2d');
      ctx.fillStyle = 'rgb(100,100,100)';
      ctx.fillRect(0, 0, 600, 720);
      for (const [pontos, tom] of ${JSON.stringify(camadasDaFoto)}) {
        ctx.fillStyle = 'rgb(' + tom + ',' + tom + ',' + tom + ')';
        ctx.beginPath();
        pontos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fill();
      }
      const blob = await new Promise((r) => tela.toBlob(r, 'image/png'));
      const arquivo = new File([blob], 'molde-de-papel.png', { type: 'image/png' });
      const transferencia = new DataTransfer();
      transferencia.items.add(arquivo);
      const campo = document.querySelector('input[aria-label="Arquivo de imagem do modelo"]');
      campo.files = transferencia.files;
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      return 1;
    })()`,
  );
  await espera(1500);
  await aba('Produção');
  await espera(300);
  await botao('Molde da foto');
  await espera(1500);
  conferir('abre o molde da foto, com a foto trazida', (await janela()) === 'Molde da foto' && Number(await js(`document.querySelectorAll('[role=dialog] svg[aria-label="Foto para marcar os cantos"]').length`)) === 1, await janela());
  const naImagem = async (seletor, ix, iy, w, hh) =>
    JSON.parse(
      await js(
        `(() => { const r = document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect(); const e = Math.min(r.width / ${w}, r.height / ${hh}); return JSON.stringify({ x: Math.round(r.left + (r.width - ${w} * e) / 2 + ${ix} * e), y: Math.round(r.top + (r.height - ${hh} * e) / 2 + ${iy} * e) }); })()`,
      ),
    );
  const clicarNaImagem = async (seletor, ix, iy, w, hh) => {
    const { x, y } = await naImagem(seletor, ix, iy, w, hh);
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    await espera(250);
  };
  // Os cantos e, com a lente ligada, um ponto na borda de cada lado (onde a foto curva a reta), como a mão faz.
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] label')).find(l => l.textContent.includes('Corrigir a curvatura da lente')).querySelector('input')`);
  await espera(200);
  for (const canto of [[0, 0], [140, 0], [140, 190], [0, 190]]) {
    const [x, y] = naFotoComLente(canto);
    await clicarNaImagem('svg[aria-label="Foto para marcar os cantos"]', x, y, 600, 720);
  }
  for (const meio of [[70, 0], [140, 95], [70, 190], [0, 95]]) {
    const [x, y] = naFotoComLente(meio);
    await clicarNaImagem('svg[aria-label="Foto para marcar os cantos"]', x, y, 600, 720);
  }
  await noCampo('Largura da referência', '140');
  await noCampo('Altura da referência', '190');
  await espera(300);
  const resultadoDaLente = await js(`((document.querySelector('[role=dialog] .resultado-da-lente') || {}).textContent || '')`);
  const [antesDaLente, depoisDaLente] = (resultadoDaLente.match(/estavam a ([\d,]+) px da reta; corrigida, a ([\d,]+) px/) || []).slice(1).map((v) => Number(String(v).replace(',', '.')));
  conferir(
    'a lente do celular: os pontos dos lados, fora da reta dos cantos, voltam para ela (até 1,5 px)',
    antesDaLente > 3 && depoisDaLente <= 1.5,
    resultadoDaLente,
  );
  await foto('27-cantos-da-foto.png');
  await botaoNaJanela('Corrigir a lente e a perspectiva');
  await espera(1500);
  await clicarNaImagem('svg[aria-label="Foto corrigida"]', 140, 300, 280, 380);
  await espera(1200);
  const medidasDaFoto = await js(`((document.querySelector('[role=dialog] [aria-label="Medidas do molde"]') || {}).textContent || '')`);
  const larguraLida = Number((medidasDaFoto.match(/Largura × altura([\d,]+) mm/) || [])[1]?.replace(',', '.'));
  const alturaLida = Number((medidasDaFoto.match(/ × ([\d,]+) mmPer/) || [])[1]?.replace(',', '.'));
  conferir(
    'corrigida a perspectiva, o molde sai com 100 × 150 mm (até 1,5 mm), o furo, o fio e a pence (1 linha interna)',
    Math.abs(larguraLida - 100) <= 1.5 &&
      Math.abs(alturaLida - 150) <= 1.5 &&
      medidasDaFoto.includes('1 furo(s)') &&
      medidasDaFoto.includes('1 linha(s) interna(s)') &&
      medidasDaFoto.includes('fio sugerido'),
    medidasDaFoto.slice(0, 160),
  );
  await foto('28-molde-reconhecido.png');
  await noCampo('Nome', 'Frente da foto');
  await botaoNaJanela('Criar a peça');
  await espera(1200);
  const criadasDaFoto = await js(`(Array.from(document.querySelectorAll('[role=dialog] [role=status]')).map((s) => s.textContent).find((t) => t.includes('criada')) || '')`);
  conferir(
    'a peça entra na lista, e a janela fica pronta para outro molde da mesma foto',
    (await janela()) === 'Molde da foto' && criadasDaFoto.includes('Frente da foto') && (await lista()).some((n) => n.startsWith('Frente da foto')),
    `${criadasDaFoto.slice(0, 80)} / ${JSON.stringify(await lista())}`,
  );
  await fecharJanela();
  await espera(500);
  const pecaDaFoto = (await pecasGravadas()).find((p) => p.nome === 'Frente da foto');
  const caixaDaFoto = pecaDaFoto ? caixa(pecaDaFoto.contorno) : null;
  conferir(
    'no projeto: a peça de 150 × 100 mm (deitada como na foto), com o furo, o fio, o pique e a pence como linha interna (o V, 3 pontos)',
    !!caixaDaFoto &&
      Math.abs(caixaDaFoto.maxX - caixaDaFoto.minX - 150) <= 2 &&
      Math.abs(caixaDaFoto.maxY - caixaDaFoto.minY - 100) <= 2 &&
      pecaDaFoto.furos.length === 1 &&
      pecaDaFoto.piques.length >= 1 &&
      pecaDaFoto.linhasInternas.length === 1 &&
      pecaDaFoto.linhasInternas[0].length === 3,
    caixaDaFoto
      ? `${(caixaDaFoto.maxX - caixaDaFoto.minX).toFixed(1)} × ${(caixaDaFoto.maxY - caixaDaFoto.minY).toFixed(1)} mm, ${pecaDaFoto.furos.length} furo(s), ${pecaDaFoto.piques.length} pique(s), linhas internas ${JSON.stringify(pecaDaFoto.linhasInternas.map((l) => l.map((p) => [Math.round(p.x), Math.round(p.y)])))}`
      : 'sem a peça',
  );
  await foto('29-peca-da-foto.png');

  // 12. A recomendação de tamanho (ADR 0110): Modelo › Loja; sem a tabela de medidas, o aviso abre a ficha na
  // tabela, colada da planilha; as medidas do corpo dão o tamanho (e o "entre dois"); o guia salvo em HTML; a folga
  // mudada fica no projeto (as medidas da pessoa, não).
  await aba('Modelo');
  await botao('Recomendar tamanho');
  await espera(800);
  const avisoSemTabela = await js(`((document.querySelector('[role=dialog] .faixa-da-ficha-fechada') || {}).textContent || '')`);
  conferir('a recomendação sem a tabela de medidas diz o que falta', (await janela()) === 'Recomendação de tamanho' && avisoSemTabela.includes('ainda não tem os tamanhos ou os pontos de medida'), avisoSemTabela.slice(0, 120));
  await botaoNaJanela('Abrir a tabela de medidas');
  await espera(800);
  await botaoNaJanela('Colar da planilha…');
  await js(
    `(() => { const c = document.querySelector('[role=dialog] .colagem-de-medidas textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(c, ${JSON.stringify('Ponto\tP\tM\tG\tGG\tTol.\nBusto\t96\t100\t104\t110\t1\nQuadril\t98\t102\t106\t112\t1\nComprimento total\t70\t72\t74\t76\t1')}); c.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await botaoNaJanela('Colar');
  await espera(300);
  const pontosColados = Number(await js(`document.querySelectorAll('[role=dialog] .tabela-da-ficha tbody tr').length`));
  conferir('a ficha abre na tabela de medidas, e a tabela da planilha entra (3 pontos)', (await janela()) === 'Ficha técnica' && pontosColados === 3, `${await janela()} / ${pontosColados} ponto(s)`);
  await fecharJanela();
  await espera(1200);
  await botao('Recomendar tamanho');
  await espera(800);
  await noCampo('Corpo: Busto', '94');
  await noCampo('Corpo: Quadril', '98');
  await noCampo('Corpo: Comprimento total', '73');
  await espera(300);
  const naRecomendacao = JSON.parse(
    await js(
      `JSON.stringify({ grande: (document.querySelector('[role=dialog] .tamanho-grande') || {}).textContent, entre: (document.querySelector('[role=dialog] .entre-dois-tamanhos') || {}).textContent, faixa: Array.from(document.querySelectorAll('[role=dialog] .tamanho-da-faixa')).map(s => s.textContent + ':' + s.className.replace('tamanho-da-faixa ', '')), linhas: document.querySelectorAll('[role=dialog] .tabela-da-comparacao tbody tr').length })`,
    ),
  );
  conferir(
    'o corpo de 94/98/73 dá o G, "entre dois tamanhos: o M também serve (mais justo)", com a comparação dos 3 pontos',
    naRecomendacao.grande === 'G' && naRecomendacao.entre === 'Entre dois tamanhos: o M também serve (mais justo).' && naRecomendacao.faixa.includes('G:tamanho-recomendado') && naRecomendacao.faixa.includes('M:tamanho-alternativo') && naRecomendacao.linhas === 3,
    JSON.stringify(naRecomendacao),
  );
  await foto('30-recomendacao-de-tamanho.png');
  await parteDaJanela('Guia de medidas');
  await espera(300);
  const linhaDoBusto = await js(`((Array.from(document.querySelectorAll('[role=dialog] .tabela-do-guia tbody tr')).find(l => l.textContent.startsWith('Busto')) || {}).textContent || '')`);
  await botaoNaJanela('Salvar a página (HTML, para a loja virtual)');
  await espera(1200);
  const guias = fs.readdirSync(SAIDA).filter((f) => f.startsWith('guia-de-medidas-') && f.endsWith('.html'));
  const guia = guias[0] ? fs.readFileSync(path.join(SAIDA, guias[0]), 'utf8') : '';
  conferir(
    'o guia de medidas (o corpo de cada tamanho) na tela e salvo como página HTML',
    linhaDoBusto.includes('90 a 94') && guia.includes('<table>') && guia.includes('<th>Busto</th><td>86–90</td><td>90–94</td>'),
    `${linhaDoBusto} / ${JSON.stringify(guias)} ${guia.length} letras`,
  );
  await foto('31-guia-de-medidas.png');
  await parteDaJanela('Caimento');
  await noCampo('Folga de Busto', '6');
  await espera(300);
  await foto('32-caimento.png');
  // 12a. O tecido que cede (ADR 0119): com a malha com elastano, o corpo maior que o GG (busto 113, quadril 115) veste
  // o GG esticando — no tecido plano, nenhum tamanho vestiria.
  await noCampo('Tecido', 'malha-com-elastano');
  await espera(300);
  await parteDaJanela('Recomendar');
  await noCampo('Corpo: Busto', '113');
  await noCampo('Corpo: Quadril', '115');
  await espera(300);
  const comElastano = JSON.parse(
    await js(
      `JSON.stringify({ grande: (document.querySelector('[role=dialog] .tamanho-grande') || {}).textContent, titulo: ((document.querySelector('[role=dialog] .cartao-do-tamanho strong') || {}).textContent || ''), estica: document.querySelectorAll('[role=dialog] .tabela-da-comparacao td.medida-estica').length, tecido: ((document.querySelector('[role=dialog] .tecido-da-recomendacao') || {}).textContent || '') })`,
    ),
  );
  conferir(
    'na malha com elastano, o corpo de busto 113 veste o GG esticando (a célula roxa), com o tecido dito',
    comElastano.grande === 'GG' && comElastano.titulo === 'Tamanho recomendado' && comElastano.estica > 0 && comElastano.tecido.includes('Malha com elastano'),
    JSON.stringify(comElastano),
  );
  await foto('32b-malha-que-cede.png');
  await fecharJanela();
  await espera(1200);
  const projetoComCaimento = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', f), 'utf8')))
    .find((p) => p.regrasDeCaimento);
  const regraDoBusto = projetoComCaimento ? Object.entries(projetoComCaimento.regrasDeCaimento).map(([id, r]) => ({ r, nome: (projetoComCaimento.fichaTecnica.medidas.find((m) => m.id === id) || {}).nome })).find((x) => x.nome === 'Busto') : null;
  conferir(
    'a folga do busto (6 cm) ficou guardada no projeto, e as medidas da pessoa não',
    !!regraDoBusto && regraDoBusto.r.folgaCm === 6 && regraDoBusto.r.usar === true && !JSON.stringify(projetoComCaimento).includes('"corpo'),
    regraDoBusto ? JSON.stringify(regraDoBusto) : 'sem regras no projeto',
  );
  conferir(
    'o tecido da recomendação (malha com elastano, 15%) ficou guardado no projeto',
    !!projetoComCaimento && JSON.stringify(projetoComCaimento.elasticidadeDaRecomendacao) === '{"tecido":"malha-com-elastano","cedePercentual":15}',
    projetoComCaimento ? JSON.stringify(projetoComCaimento.elasticidadeDaRecomendacao) : '—',
  );
  // A tela de quem usa (1920 × 1080 a 150%: 1280 × 720): a aba Modelo, com o grupo Loja, cabe sem rolar.
  win.setBounds({ x: 0, y: 0, width: 1280, height: 720 });
  await espera(1200);
  const fitaEm1280 = JSON.parse(await js(`(() => { const c = document.querySelector('.ribbon-conteudo'); const b = Array.from(document.querySelectorAll('.grupo-de-ferramentas button')).find(x => x.textContent.trim() === 'Guia de medidas'); const r = b.getBoundingClientRect(); return JSON.stringify({ rola: c.scrollWidth - c.clientWidth, direita: Math.round(r.right), largura: window.innerWidth }); })()`));
  conferir('em 1280 × 720, a aba Modelo cabe inteira (o Guia de medidas à vista, sem rolar)', fitaEm1280.rola <= 1 && fitaEm1280.direita <= fitaEm1280.largura, JSON.stringify(fitaEm1280));
  await foto('33-modelo-em-1280.png');
  win.setBounds({ x: 0, y: 0, width: 1440, height: 900 });
  await espera(800);

  // 12b. As cotas (ADR 0117): com os pontos de medida na ficha, a ferramenta Cota no desenho técnico — dois cliques
  // fazem a cota "A" (o busto), e as propriedades mostram as medidas de cada tamanho; na ficha, a tabela de medidas
  // ganha a coluna da letra.
  await botao('Desenho técnico');
  await espera(800);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] [role=toolbar] button')).find(b => b.textContent.trim() === 'Cota')`);
  await clicarNaFolha(118, 150);
  await clicarNaFolha(282, 150);
  await espera(300);
  const naCota = JSON.parse(
    await js(
      `JSON.stringify({ letras: Array.from(document.querySelectorAll('.folha-do-desenho .cota-do-desenho text')).map(t => t.textContent), valores: ((document.querySelector('[role=dialog] .valores-da-cota') || {}).textContent || '') })`,
    ),
  );
  conferir(
    'dois cliques com a Cota fazem a cota "A" do busto; as propriedades mostram a medida de cada tamanho',
    JSON.stringify(naCota.letras) === '["A"]' && naCota.valores.startsWith('Busto (cm): P 96,0 · M 100,0'),
    JSON.stringify(naCota),
  );
  await foto('33b-cota-no-desenho.png');
  // A área para o consumo (ADR 0127): com a cota ligada ao busto, os contornos fechados (a camiseta e o bolso) medidos
  // na escala dela, e o tamanho da roupa nessa escala. O busto da ficha é a volta inteira (100 cm no M), e a cota
  // atravessa só a frente: a escala dobra, e o aviso diz que a roupa ficou grande demais.
  // A variante de cor (ADR 0136): "Marinho", vista na folha; com as áreas pintadas, a primeira cor vira marinho.
  await noCampo('Nome da variante nova', 'Marinho');
  await botaoNaJanela('Nova variante');
  await espera(300);
  const temCores = await js(`!!document.querySelector('[role=dialog] .trocas-de-cor input[type=color]')`);
  if (temCores) {
    await js(`(() => { const c = document.querySelector('[role=dialog] .trocas-de-cor input[type=color]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, '#1a237e'); c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await espera(300);
  }
  const varianteVista = await js(`(document.querySelector('[role=dialog] select[aria-label="Variante de cor vista"]') || {}).value || ''`);
  const marinhoNaFolha = await js(`!!document.querySelector('.folha-do-desenho [fill="#1a237e"]')`);
  await foto('33b2-variante-marinho.png');
  conferir(
    'a variante de cor "Marinho": vista na folha (com as áreas pintadas, a cor trocada)',
    varianteVista !== '' && (!temCores || marinhoNaFolha),
    `vista ${varianteVista ? 'Marinho' : 'original'}, ${temCores ? (marinhoNaFolha ? 'marinho na folha' : 'SEM marinho na folha') : 'sem áreas pintadas'}`,
  );
  await js(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Variante de cor vista"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ''); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await espera(200);
  const caixaDaArea = await js(`((document.querySelector('[role=dialog] .area-do-consumo') || {}).innerText || '').replace(/\\s+/g, ' ')`);
  const areaDoDesenho = Number(((caixaDaArea.match(/(\d+,\d{3}) m²/) || [])[1] || '').replace(',', '.'));
  conferir(
    'a área para o consumo: os contornos na escala da cota do busto, o tamanho da roupa nessa escala, e o aviso de grande demais (a volta do busto numa cota da frente)',
    areaDoDesenho > 0 && caixaDaArea.includes('na escala da cota de Busto') && /Nesta escala, a roupa tem \d+ × \d+ cm/.test(caixaDaArea) && caixaDaArea.includes('grande demais'),
    caixaDaArea.slice(0, 260),
  );
  await fecharJanela();
  await espera(1200);
  await botao('Ficha técnica');
  await espera(800);
  await parteDaJanela('Medidas');
  await espera(300);
  const letrasNaTabela = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] .letra-da-cota, [role=dialog] .letra-sem-cota')).map(c => c.textContent + ':' + c.className))`));
  conferir(
    'na ficha, a tabela de medidas mostra a letra de cada ponto, o busto (com cota) em destaque',
    JSON.stringify(letrasNaTabela) === '["A:letra-da-cota","B:letra-sem-cota","C:letra-sem-cota"]',
    JSON.stringify(letrasNaTabela),
  );
  await foto('33c-letras-na-tabela.png');
  // Na ficha, um tecido em m² com o consumo "Pelo desenho técnico": a mesma área, mais 15% de costura e folga, sobre
  // 80% de aproveitamento. Depois, tirado (a ficha fica como estava).
  await parteDaJanela('Materiais');
  await espera(300);
  await botaoNaJanela('Adicionar material');
  await espera(200);
  await js(`(() => { const linhas = Array.from(Array.from(document.querySelectorAll('[role=dialog] table')).find(t => (t.caption || {}).textContent === 'Materiais e aviamentos (por peça pronta)').querySelectorAll('tbody tr')); const s = linhas[linhas.length - 1].querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '__digitado__'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await espera(200);
  await noCampo('Descrição do item digitado', 'Tecido pelo desenho');
  await espera(200);
  await noCampo('Unidade de Tecido pelo desenho', 'm2');
  await noCampo('Consumo de Tecido pelo desenho', 'pelo-desenho');
  await espera(400);
  const linhaDoDesenho = await js(`(() => { const linhas = Array.from(Array.from(document.querySelectorAll('[role=dialog] table')).find(t => (t.caption || {}).textContent === 'Materiais e aviamentos (por peça pronta)').querySelectorAll('tbody tr')); return linhas[linhas.length - 1].innerText.replace(/\\s+/g, ' '); })()`);
  const consumoDoDesenho = Number(((linhaDoDesenho.match(/(\d+,\d{3}) m²/) || [])[1] || '').replace(',', '.'));
  conferir(
    'na ficha, o tecido "Pelo desenho técnico": a área do desenho + 15% ÷ 80% de aproveitamento',
    Math.abs(consumoDoDesenho - (areaDoDesenho * 1.15) / 0.8) < 0.002 && linhaDoDesenho.includes('na escala da cota de Busto'),
    `${consumoDoDesenho} m² (a área ${areaDoDesenho} m²): ${linhaDoDesenho.slice(0, 200)}`,
  );
  await foto('33d-consumo-pelo-desenho.png');
  await clicarEm(`document.querySelector('[role=dialog] button[aria-label="Remover Tecido pelo desenho"]')`);
  await espera(400);
  await fecharJanela();
  await espera(800);

  // 13. O provador 3D (ADR 0111): a saia de teste (frente e costas) importada; Conferência › Provador 3D; as peças na
  // frente e nas costas; as costuras sugeridas (as duas laterais); simular até assentar; o mapa de tensão; a foto como
  // estampa localizada; a imagem das três vistas; a montagem guardada no projeto.
  arquivoParaAbrir = SAIA_DXF;
  await aba('Início');
  await botao('Importar DXF');
  await espera(2500);
  conferir('a saia de teste entra (2 peças)', (await lista()).filter((n) => n.startsWith('saia-de-teste-')).length === 2, JSON.stringify(await lista()));
  await aba('Conferência');
  await botao('Provador 3D');
  await espera(2000);
  conferir('abre o provador 3D', (await janela()) === 'Provador 3D', await janela());
  await noCampo('Onde vai saia-de-teste-1', 'frente');
  await noCampo('Onde vai saia-de-teste-2', 'costas');
  // A peça da foto vira um bolso sobre a frente da saia (ADR 0123), 8 cm abaixo do alto dela.
  await noCampo('Onde vai Frente da foto', 'sobre-outra-peca');
  await espera(300);
  await noCampo('Distância do alto de Frente da foto', '80');
  await espera(800);
  const bolsoSobre = await js(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Sobre que peça vai Frente da foto"]'); return s ? s.selectedOptions[0].textContent : ''; })()`);
  conferir('a peça da foto vai como bolso sobre a frente da saia (escolhida sozinha)', bolsoSobre.startsWith('saia-de-teste-1'), bolsoSobre);
  await foto('34-provador-arrumado.png');
  // 13a. O fio, a trama e o viés (ADR 0120): a malha pronta estica mais na trama; as três réguas na aba Tecido.
  await parteDaJanela('Tecido');
  await espera(300);
  const reguasDoTecido = await js(`JSON.stringify(['Elasticidade no fio', 'Na trama (atravessado)', 'No viés (45°)'].map(r => (document.querySelector('[role=dialog] input[aria-label=' + JSON.stringify(r) + ']') || {}).value))`);
  conferir('a aba Tecido tem a elasticidade no fio, na trama e no viés (a malha: 70, 80, 75)', reguasDoTecido === '["70","80","75"]', reguasDoTecido);
  // O tecido sobre o próprio tecido (ADR 0146): a opção na aba Tecido, ligada por padrão (a saia simulada abaixo já usa).
  const autoColisaoLigada = await js(`(() => { const l = Array.from(document.querySelectorAll('[role=dialog] label')).find(x => x.textContent.includes('O tecido não atravessa a si mesmo')); return l ? String(l.querySelector('input').checked) : 'sem a opção'; })()`);
  conferir('a aba Tecido tem "O tecido não atravessa a si mesmo", ligado', autoColisaoLigada === 'true', autoColisaoLigada);
  await foto('34b-tecido-fio-trama-vies.png');
  await parteDaJanela('Costuras');
  await botaoNaJanela('Sugerir costuras');
  await espera(500);
  const costurasNaLista = await js(`Array.from(document.querySelectorAll('[role=dialog] .lista-de-costuras li > span')).map(s => s.textContent).join(' | ')`);
  conferir('as costuras sugeridas: as duas laterais da saia', costurasNaLista.split(' | ').length === 2 && costurasNaLista.includes('saia-de-teste-1') && costurasNaLista.includes('saia-de-teste-2'), costurasNaLista.slice(0, 200));
  await botaoNaJanela('Simular');
  let statusDoProvador = '';
  for (let i = 0; i < 90; i++) {
    await espera(500);
    statusDoProvador = await js(`((document.querySelector('[role=dialog] .status-do-provador') || {}).textContent || '')`);
    if (/^(Assentou|Parou)/.test(statusDoProvador)) break;
  }
  const aberturaDaCostura = Number((statusDoProvador.match(/maior abertura é de (\d+) mm/) || [])[1]);
  const [, deCm, ateCm] = (statusDoProvador.match(/vai de (\d+) a (\d+) cm do chão/) || []).map(Number);
  const avisoDeQueda = await js(`((document.querySelector('[role=dialog] .faixa-de-erro-do-provador') || {}).textContent || '')`);
  conferir(
    'simula até assentar: as costuras fechadas (até 6 mm) e a saia no corpo — da cintura (até 106 cm) para baixo, sem passar do quadril (o alto acima de 85 cm)',
    statusDoProvador.startsWith('Assentou') && aberturaDaCostura <= 6 && ateCm > 85 && ateCm <= 106 && deCm < ateCm && avisoDeQueda === '',
    `${statusDoProvador} ${avisoDeQueda}`,
  );
  await foto('35-provador-saia.png');
  // O brilho e a transparência (ADR 0131): só a vista muda — a saia continua assentada, sem recomeçar a simulação.
  await parteDaJanela('Tecido');
  await espera(300);
  await noCampo('Brilho', '85');
  await noCampo('Transparência', '55');
  await espera(800);
  await espera(600);
  const depoisDoBrilho = await js(`((document.querySelector('[role=dialog] .status-do-provador') || {}).textContent || '')`);
  conferir('o brilho e a transparência mudam só a vista: a saia continua assentada', depoisDoBrilho.startsWith('Assentou'), depoisDoBrilho.slice(0, 80));
  await foto('35b-saia-com-brilho-e-transparencia.png');
  await parteDaJanela('Tecido');
  await noCampo('Brilho', '0');
  await noCampo('Transparência', '0');
  await espera(300);
  // O zíper (ADR 0132): 18 cm numa lateral da saia, visto de lado; a saia continua assentada.
  await parteDaJanela('Costuras');
  await espera(300);
  await js(`(() => { const c = document.querySelector('[role=dialog] input[aria-label^="Zíper da costura"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, '18'); c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await espera(600);
  // A fita do zíper (#2f2f33) contada no desenho, em cada vista: a lateral aparece em alguma delas (o braço cobre uma).
  const pixelsDaFita = () =>
    js(`(() => { const c = document.querySelector('[role=dialog] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 47) < 10 && Math.abs(d[i + 1] - 47) < 10 && Math.abs(d[i + 2] - 51) < 10) n++; return n; })()`);
  const fitaPorVista = {};
  for (const vista of ['Frente', 'Lado', 'Costas']) {
    await botaoNaJanela(vista);
    await espera(700);
    fitaPorVista[vista] = await pixelsDaFita();
    if (fitaPorVista[vista] === Math.max(...Object.values(fitaPorVista))) await foto('35c-ziper-na-lateral.png');
  }
  const comZiper = await js(`((document.querySelector('[role=dialog] .status-do-provador') || {}).textContent || '')`);
  conferir(
    'o zíper de 18 cm na lateral da saia aparece no desenho, e a saia continua assentada',
    comZiper.startsWith('Assentou') && Math.max(...Object.values(fitaPorVista)) > 30,
    `${JSON.stringify(fitaPorVista)} pixel(s) da fita / ${comZiper.slice(0, 60)}`,
  );
  await botaoNaJanela('Frente');
  await espera(300);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] label')).find(l => l.textContent.trim() === 'Mapa de tensão').querySelector('input')`);
  await espera(800);
  const legenda = await js(`((document.querySelector('[role=dialog] .legenda-da-tensao') || {}).textContent || '')`);
  conferir('o mapa de tensão, com a legenda', legenda.includes('repuxando'), legenda);
  await foto('36-mapa-de-tensao.png');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] label')).find(l => l.textContent.trim() === 'Mapa de tensão').querySelector('input')`);
  await parteDaJanela('Peças');
  const idDaImagem = await js(`((document.querySelector('[role=dialog] select[aria-label="Estampa de saia-de-teste-1"]') || { options: [] }).options[1] || {}).value || ''`);
  await noCampo('Estampa de saia-de-teste-1', idDaImagem);
  await espera(300);
  await noCampo('Como vai a estampa de saia-de-teste-1', 'localizada');
  await noCampo('Largura da estampa de saia-de-teste-1', '220');
  await espera(1500);
  await foto('37-provador-estampa.png');
  await parteDaJanela('Imagem');
  await botaoNaJanela('Salvar frente, lado e costas (PNG)');
  await espera(2500);
  const pngs = fs.readdirSync(SAIDA).filter((f) => f.startsWith('provador-3d-') && f.endsWith('-frente-lado-costas.png'));
  const png = pngs[0] ? fs.readFileSync(path.join(SAIDA, pngs[0])) : null;
  conferir('a imagem das três vistas foi gravada (PNG, 1800 de largura)', !!png && png.length > 20000 && png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1800, `${JSON.stringify(pngs)} ${png ? png.length : 0} bytes`);
  // A resolução alta e o giro em vídeo (ADR 0139): esta vista em 2× (1440 × 1920) e uma volta inteira em WebM.
  await noCampo('Resolução da imagem', '2');
  await espera(300);
  for (const f of fs.readdirSync(SAIDA).filter((n) => n.startsWith('provador-3d-') && !n.includes('frente-lado-costas'))) fs.unlinkSync(path.join(SAIDA, f));
  await botaoNaJanela('Salvar esta vista (PNG)');
  await espera(3000);
  const pngAlta = fs.readdirSync(SAIDA).find((n) => n.startsWith('provador-3d-') && n.endsWith('.png') && !n.includes('frente-lado-costas'));
  const alta = pngAlta ? fs.readFileSync(path.join(SAIDA, pngAlta)) : null;
  await botaoNaJanela('Gravar o giro (vídeo WebM)');
  let webm = null;
  for (let i = 0; i < 40 && !webm; i++) {
    await espera(500);
    const n = fs.readdirSync(SAIDA).find((x) => x.endsWith('-giro.webm'));
    if (n && !(await js(`!!Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.startsWith('Gravando o giro'))`))) webm = fs.readFileSync(path.join(SAIDA, n));
  }
  conferir(
    'a imagem em alta (1440 × 1920) e o vídeo do giro (WebM) foram gravados',
    !!alta && alta.readUInt32BE(16) === 1440 && alta.readUInt32BE(20) === 1920 && !!webm && webm.length > 5000 && webm.readUInt32BE(0) === 0x1a45dfa3,
    `${pngAlta} ${alta ? `${alta.readUInt32BE(16)} × ${alta.readUInt32BE(20)}` : 'sem PNG'} / ${webm ? `${webm.length} bytes de vídeo` : 'sem vídeo'}`,
  );
  await fecharJanela();
  await espera(1200);
  const montagemGravada = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', f), 'utf8')))
    .find((p) => p.montagem3d)?.montagem3d;
  const posicoesGravadas = montagemGravada ? Object.values(montagemGravada.pecas).map((c) => c.posicao).filter((p) => p !== 'fora').sort() : [];
  conferir(
    'a montagem ficou no projeto: a frente, as costas e o bolso sobre a frente, as 2 costuras, a estampa localizada',
    !!montagemGravada &&
      JSON.stringify(posicoesGravadas) === '["costas","frente","sobre-outra-peca"]' &&
      Object.values(montagemGravada.pecas).some((c) => c.sobre && c.sobre.doAltoMm === 80) &&
      montagemGravada.costuras.length === 2 &&
      Object.values(montagemGravada.pecas).some((c) => c.estampa && c.estampa.modo === 'localizada'),
    montagemGravada ? `${JSON.stringify(posicoesGravadas)}, ${montagemGravada.costuras.length} costura(s)` : 'sem montagem',
  );

  // 13b. O desenho no corpo (ADR 0134): o provador aberto de novo; de frente, quatro cliques no tronco (o peito e a
  // cintura, dos dois lados do meio); "Tirar o pré-molde" põe a peça desenrolada no projeto. Fica por último no
  // provador: a peça nova muda a lista dele.
  await aba('Conferência');
  await botao('Provador 3D');
  await espera(2000);
  await botaoNaJanela('Frente');
  await espera(500);
  await parteDaJanela('Desenhar no corpo');
  await espera(300);
  const telaDoProvador = JSON.parse(await js(`JSON.stringify(document.querySelector('[role=dialog] canvas').getBoundingClientRect())`));
  for (const [fx, fy] of [[-0.04, 0.3], [0.04, 0.3], [0.04, 0.4], [-0.04, 0.4]]) {
    const x = Math.round(telaDoProvador.left + telaDoProvador.width * (0.5 + fx));
    const y = Math.round(telaDoProvador.top + telaDoProvador.height * fy);
    win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
    await espera(80);
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    await espera(250);
  }
  const pontosNoCorpo = await js(`((document.querySelector('[role=dialog] section[aria-label="Desenhar no corpo"] .resumo-do-plano') || {}).textContent || '')`);
  await foto('35d-desenho-no-corpo.png');
  // Com o provador aberto, o projeto não é gravado pelo atalho: a conferência é pela lista de peças da tela.
  const antesDoPreMolde = await lista();
  await botaoNaJanela('Tirar o pré-molde');
  await espera(800);
  const recadoDoPreMolde = await js(`((document.querySelector('[role=dialog] .controles-do-provador [role=alert]') || {}).textContent || '')`);
  const comPreMolde = await lista();
  await foto('35e-pre-molde-tirado.png');
  conferir(
    'o desenho no corpo: quatro pontos no tronco viram o pré-molde no projeto',
    pontosNoCorpo === '4 ponto(s) no corpo.' && comPreMolde.length === antesDoPreMolde.length + 1 && comPreMolde.some((n) => n.startsWith('Pré-molde do corpo')),
    `${pontosNoCorpo} / ${JSON.stringify(comPreMolde.slice(-2))} / ${recadoDoPreMolde.slice(0, 100)}`,
  );
  // A pose (ADR 0138): braços abaixados para a foto de catálogo; a roupa assenta de novo no corpo nessa pose.
  await parteDaJanela('Manequim');
  await espera(300);
  await noCampo('Pose do manequim', 'bracos-abaixados');
  await espera(600);
  await botaoNaJanela('Simular');
  let statusNaPose = '';
  for (let i = 0; i < 120; i++) {
    await espera(500);
    statusNaPose = await js(`((document.querySelector('[role=dialog] .status-do-provador') || {}).textContent || '')`);
    if (/^(Assentou|Parou)/.test(statusNaPose)) break;
  }
  await botaoNaJanela('Frente');
  await espera(600);
  await foto('35f-pose-bracos-abaixados.png');
  conferir('a pose de braços abaixados: a roupa assenta de novo no corpo', statusNaPose.startsWith('Assentou'), statusNaPose.slice(0, 90));
  await fecharJanela();
  await espera(800);

  // 14. A inspiração e a IA (ADR 0112): Modelo › Criação › Inspiração; duas imagens desenhadas na hora entram pelo
  // campo de arquivo, com as cores tiradas delas; a categoria, a nota, a paleta; a IA sem chave; a chave de teste
  // guardada cifrada (o arquivo não a mostra); o croqui com uma referência, pelo serviço de mentira (a chave só no
  // cabeçalho, a imagem como image[]); o resultado no painel como rascunho; a chave esquecida.
  await aba('Modelo');
  await botao('Inspiração');
  await espera(800);
  conferir('abre a inspiração e a IA', (await janela()) === 'Inspiração e IA', await janela());
  await js(
    `(async () => {
      const feitas = [];
      for (const [nome, cores] of [['tecido-listrado', ['#1b3a6b', '#f4f1ea']], ['botao-vermelho', ['#b3202a', '#f2d7d5']]]) {
        const tela = document.createElement('canvas');
        tela.width = 300;
        tela.height = 200;
        const ctx = tela.getContext('2d');
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = cores[i % 2];
          ctx.fillRect(i * 30, 0, 30, 200);
        }
        const blob = await new Promise((r) => tela.toBlob(r, 'image/png'));
        feitas.push(new File([blob], nome + '.png', { type: 'image/png' }));
      }
      const transferencia = new DataTransfer();
      feitas.forEach((arquivo) => transferencia.items.add(arquivo));
      const campo = document.querySelector('input[aria-label="Arquivos de imagem da inspiração"]');
      campo.files = transferencia.files;
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      return 1;
    })()`,
  );
  await espera(1500);
  const coresDoPainel = await js(`Array.from(document.querySelectorAll('[role=dialog] .cartao-da-inspiracao')).map(c => Array.from(c.querySelectorAll('.amostra-de-cor')).map(s => s.title).join(', ')).join(' | ')`);
  conferir(
    'as duas imagens entram no painel, com as cores tiradas de cada uma',
    coresDoPainel.split(' | ').length === 2 && coresDoPainel.includes('azul-marinho (#1b3a6b)') && coresDoPainel.includes('vermelho (#b3202a)'),
    coresDoPainel,
  );
  await noCampo('Categoria de tecido-listrado', 'tecido');
  await noCampo('Nota de tecido-listrado', 'listra larga, marinho e cru');
  await noCampo('Conceito do modelo (o público, a ocasião, o clima)', 'verão urbano, leve');
  await clicarEm(`document.querySelector('[role=dialog] button[aria-label="Pôr azul-marinho (#1b3a6b) na paleta"]')`);
  await espera(400);
  const naPaleta = Number(await js(`document.querySelectorAll('[role=dialog] [aria-label="Paleta do modelo"] [role=listitem]').length`));
  conferir('a paleta do modelo, pela cor da imagem', naPaleta === 1, `${naPaleta} cor(es)`);
  await foto('38-painel-de-inspiracao.png');
  await parteDaJanela('Criar com IA');
  await espera(800);
  const servicoAntes = await js(`((document.querySelector('[role=dialog] .cartao-do-servico strong') || {}).textContent || '')`);
  const gerarDesligado = await js(`(Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.startsWith('Gerar')) || {}).disabled === true`);
  conferir('sem chave: a IA não configurada, e o Gerar desligado', servicoAntes === 'IA não configurada' && gerarDesligado, servicoAntes);
  await foto('39-ia-sem-chave.png');
  const CHAVE_DE_TESTE = 'sk-teste-do-uso-0123456789abcdef';
  await noCampo('Chave do serviço', CHAVE_DE_TESTE);
  await botaoNaJanela('Guardar a chave');
  await espera(1200);
  const servicoDepois = await js(`((document.querySelector('[role=dialog] .cartao-do-servico strong') || {}).textContent || '')`);
  const avisoDaChave = await js(`((document.querySelector('[role=dialog] .aviso-da-ia') || {}).textContent || '')`);
  if (avisoDaChave.includes('não tem o cofre de senhas')) {
    // Sem o cofre do sistema (uma máquina de testes sem chaveiro), a chave não é guardada — e a geração não é testada.
    conferir('sem o cofre do sistema, a chave não é guardada (e a janela diz)', servicoDepois === 'IA não configurada' && !fs.existsSync(path.join(DADOS, 'servico-de-ia.json')), avisoDaChave);
    log('      (o cofre do sistema não funciona aqui: a geração com a IA não foi testada nesta máquina)');
  } else {
    const arquivoDaChave = path.join(DADOS, 'servico-de-ia.json');
    const noDisco = fs.existsSync(arquivoDaChave) ? fs.readFileSync(arquivoDaChave, 'utf8') : '';
    conferir(
      'a chave guardada: a IA configurada, e o arquivo não mostra a chave (cifrada pelo cofre do sistema)',
      servicoDepois === 'IA configurada: OpenAI (imagens)' && noDisco.includes('chaveCifrada') && !noDisco.includes('sk-teste-do-uso'),
      `${servicoDepois} / ${noDisco.length} letras no arquivo`,
    );
    await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] .tipo-de-geracao')).find(l => l.textContent.includes('Croqui frente e costas')).querySelector('input')`);
    await clicarEm(`document.querySelector('[role=dialog] input[aria-label="Referência: tecido-listrado"]')`);
    await noCampo('Quantas', '1');
    await espera(300);
    await botaoNaJanela('Gerar 1 imagem(ns)');
    for (let i = 0; i < 40 && Number(await js(`document.querySelectorAll('[role=dialog] .resultados-da-ia figure').length`)) === 0; i++) await espera(250);
    const resultados = Number(await js(`document.querySelectorAll('[role=dialog] .resultados-da-ia figure').length`));
    const pedidoFeito = pedidosAoServicoDeIa[0];
    conferir(
      'o croqui pedido ao serviço (de mentira): a chave só no cabeçalho, a imagem de referência junto, o resultado marcado como rascunho',
      pedidosAoServicoDeIa.length === 1 &&
        pedidoFeito.url === 'https://api.openai.com/v1/images/edits' &&
        pedidoFeito.autorizacao === `Bearer ${CHAVE_DE_TESTE}` &&
        pedidoFeito.imagens === 1 &&
        pedidoFeito.modelo === 'gpt-image-2.5-flare' &&
        resultados === 1 &&
        (await js(`((document.querySelector('[role=dialog] .resultados-da-ia .selo-de-rascunho') || {}).textContent || '')`)) === 'Rascunho da IA',
      JSON.stringify({ ...pedidoFeito, autorizacao: pedidoFeito && pedidoFeito.autorizacao ? 'Bearer …' : null, resultados }),
    );
    await botaoNaJanela('Pôr no painel');
    await espera(1200);
    await foto('40-croqui-da-ia.png');
    await botaoNaJanela('Esquecer a chave');
    await espera(800);
    const servicoNoFim = await js(`((document.querySelector('[role=dialog] .cartao-do-servico strong') || {}).textContent || '')`);
    conferir('esquecer a chave: a IA não configurada de novo, e o arquivo da chave apagado', servicoNoFim === 'IA não configurada' && !fs.existsSync(arquivoDaChave), servicoNoFim);
  }
  await parteDaJanela('Painel de inspiração');
  await espera(500);
  await foto('41-painel-com-rascunho.png');
  await fecharJanela();
  await espera(1200);
  const painelGravado = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', f), 'utf8')))
    .find((p) => p.inspiracao)?.inspiracao;
  const comRascunho = painelGravado ? painelGravado.itens.filter((i) => i.rascunhoDaIa).length : 0;
  conferir(
    'o painel ficou no projeto: o conceito, a paleta, as imagens (e o rascunho da IA, marcado)',
    !!painelGravado &&
      painelGravado.conceito === 'verão urbano, leve' &&
      JSON.stringify(painelGravado.paleta) === '["#1b3a6b"]' &&
      painelGravado.itens.some((i) => i.categoria === 'tecido' && i.nota === 'listra larga, marinho e cru') &&
      painelGravado.itens.length === 2 + comRascunho &&
      (pedidosAoServicoDeIa.length === 0 || comRascunho === 1) &&
      !JSON.stringify(painelGravado).includes('sk-teste-do-uso'),
    painelGravado ? `${painelGravado.itens.length} imagem(ns), ${comRascunho} rascunho(s)` : 'sem painel',
  );

  // 15. A estampa no encaixe (ADR 0113): Encaixe › Impressão › Estampa no encaixe; o tecido listrado do painel como a
  // estampa de todas as peças; a prévia com cada molde estampado; o PDF 1:1 (a largura do tecido, a imagem, os recortes).
  await aba('Encaixe');
  await botao('Estampa no encaixe');
  await espera(800);
  conferir('abre a estampa no encaixe', (await janela()) === 'Estampa no encaixe', await janela());
  const listrado = await js(`(Array.from(document.querySelectorAll('[role=dialog] select[aria-label="Imagem de todas as peças"] option')).find(o => o.textContent.startsWith('tecido-listrado')) || {}).value || ''`);
  await noCampo('Imagem de todas as peças', listrado);
  await espera(300);
  await noCampo('Largura da estampa de todas as peças', '150');
  await espera(800);
  const resumo = await js(`((document.querySelector('[role=dialog] .resumo-da-impressao') || {}).textContent || '')`);
  const padroesNaPrevia = Number(await js(`document.querySelectorAll('[role=dialog] .previa-da-impressao pattern').length`));
  const [, comEstampa, todasAsPecas] = (resumo.match(/^(\d+) de (\d+) peça/) || []).map(Number);
  conferir('a prévia: cada molde do encaixe estampado com o tecido listrado', comEstampa > 0 && comEstampa === todasAsPecas && padroesNaPrevia === comEstampa, `${resumo} / ${padroesNaPrevia} padrão(ões)`);
  await foto('42-estampa-no-encaixe.png');
  await botaoNaJanela('Exportar PDF para impressão (1:1)');
  await espera(3000);
  const pdfsDeImpressao = fs.readdirSync(SAIDA).filter((f) => f.startsWith('impressao-digital-') && f.endsWith('.pdf'));
  const pdfDeImpressao = pdfsDeImpressao[0] ? fs.readFileSync(path.join(SAIDA, pdfsDeImpressao[0]), 'latin1') : '';
  const larguraDoTecido = Number((resumo.match(/tecido de ([\d.]+) mm/) || [])[1]?.replace(/\./g, ''));
  const caixaDaPagina = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdfDeImpressao);
  conferir(
    'o PDF para impressão: a página na largura do tecido (1:1), a imagem, um recorte por peça estampada',
    pdfDeImpressao.startsWith('%PDF-') &&
      !!caixaDaPagina &&
      Math.abs(Number(caixaDaPagina[1]) - (larguraDoTecido * 72) / 25.4) < 0.01 &&
      pdfDeImpressao.includes('/Subtype /Image') &&
      (pdfDeImpressao.match(/W n/g) || []).length >= comEstampa,
    `${JSON.stringify(pdfsDeImpressao)} ${caixaDaPagina ? caixaDaPagina[0] : 'sem página'}, ${(pdfDeImpressao.match(/W n/g) || []).length} recorte(s)`,
  );
  await fecharJanela();
  await espera(1200);

  // 16. A biblioteca de bases aprovadas (ADR 0126): o projeto aberto aprovado como base (quem aprova, o que é), com o
  // selo verde na Biblioteca; um modelo novo desta base, aberto com as mesmas peças e dizendo de que base veio; o "Novo
  // projeto" oferece a base; e as peças da base postas no modelo, à direita das que ele tem (Ctrl+Z desfaz).
  const projetoMaisRecente = () => {
    const pasta = path.join(DADOS, 'projetos');
    return fs
      .readdirSync(pasta)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')))
      .sort((a, b) => b.modificadoEmIso.localeCompare(a.modificadoEmIso))[0];
  };
  const abrirABiblioteca = async () => {
    await clicarEm(`document.querySelector('button[title="Abrir (Ctrl+O)"]')`);
    await espera(800);
  };
  const pecasDaBaseNoDisco = await pecasGravadas();
  await abrirABiblioteca();
  conferir('abre a Biblioteca', (await janela()) === 'Biblioteca de trabalhos', await janela());
  const nomeDaBase = await js(`(document.querySelector('.lista-da-biblioteca li.item-selecionado strong') || {}).textContent || ''`);

  // A biblioteca na rede (ADR 0142): escolher a pasta, publicar o projeto aberto, pegar para editar (a trava com o
  // nome), devolver (a trava sai); depois, uma trava de outra pessoa posta na pasta aparece na linha, e o "Pegar
  // para editar" some.
  const pastaDaRede = path.join(SAIDA, 'biblioteca-na-rede');
  fs.rmSync(pastaDaRede, { recursive: true, force: true });
  fs.mkdirSync(pastaDaRede, { recursive: true });
  const naRede = (rotulo) => clicarEm(`Array.from(document.querySelectorAll('.biblioteca-na-rede button')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
  const recadoDaRede = () => js(`(document.querySelector('.biblioteca-na-rede .recado-da-rede') || {}).textContent || ''`);
  const linhaNaRede = () => js(`(() => { const tr = Array.from(document.querySelectorAll('.tabela-da-rede tbody tr')).find(tr => tr.cells[0].textContent.startsWith(${JSON.stringify(nomeDaBase)})); return tr ? tr.className + ' | ' + tr.innerText.replace(/\\s+/g, ' ') : ''; })()`);
  arquivoParaAbrir = pastaDaRede;
  await naRede('Escolher a pasta…');
  await espera(800);
  arquivoParaAbrir = DXF;
  await js(`(() => { const i = Array.from(document.querySelectorAll('.biblioteca-na-rede label')).find(l => l.textContent.includes('Seu nome')).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Teste de uso'); i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await js(`(() => { const s = document.querySelector('.biblioteca-na-rede .publicar-na-rede select'); const o = Array.from(s.options).find(o => o.textContent.startsWith(${JSON.stringify(nomeDaBase)})); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await naRede('Publicar na rede');
  await espera(800);
  const publicado = await recadoDaRede();
  await naRede('Pegar para editar');
  await espera(800);
  const travas = fs.readdirSync(path.join(pastaDaRede, 'travas'));
  const travaDoTeste = travas[0] ? JSON.parse(fs.readFileSync(path.join(pastaDaRede, 'travas', travas[0]), 'utf8')) : {};
  const linhaComATrava = await linhaNaRede();
  await foto('42b-biblioteca-na-rede-com-voce.png');
  await naRede('Devolver à rede');
  await espera(800);
  const devolvido = await recadoDaRede();
  const projetosNaRede = fs.readdirSync(path.join(pastaDaRede, 'projetos'));
  conferir(
    'a biblioteca na rede: publicar o projeto, pegar para editar (a trava com o nome) e devolver (a trava sai)',
    publicado === `“${nomeDaBase}” está na rede.` &&
      projetosNaRede.length === 1 &&
      travaDoTeste.quem === 'Teste de uso' &&
      linhaComATrava.startsWith('travado-por-mim') &&
      linhaComATrava.includes('Com você') &&
      devolvido.endsWith('foi devolvido à rede; a trava saiu.') &&
      fs.readdirSync(path.join(pastaDaRede, 'travas')).length === 0,
    `${publicado} | ${JSON.stringify(travaDoTeste)} | ${linhaComATrava.slice(0, 160)} | ${devolvido}`,
  );
  const idNaRede = projetosNaRede[0] ? projetosNaRede[0].replace(/\.json$/, '') : 'x';
  fs.writeFileSync(path.join(pastaDaRede, 'travas', `${idNaRede}.trava.json`), JSON.stringify({ quem: 'Maria', desdeIso: new Date().toISOString(), nomeDoProjeto: nomeDaBase }));
  await naRede('Atualizar');
  await espera(800);
  const linhaDeOutra = await linhaNaRede();
  const botoesDaLinha = await js(`(() => { const tr = Array.from(document.querySelectorAll('.tabela-da-rede tbody tr')).find(tr => tr.cells[0].textContent.startsWith(${JSON.stringify(nomeDaBase)})); return tr ? Array.from(tr.querySelectorAll('button')).map(b => b.textContent.trim()).join(',') : ''; })()`);
  await foto('42c-biblioteca-na-rede-travada.png');
  conferir(
    'o modelo travado por outra pessoa: a linha em âmbar diz quem, e só deixa trazer uma cópia',
    linhaDeOutra.startsWith('travado-por-outro') && linhaDeOutra.includes('Em edição por Maria desde') && botoesDaLinha === 'Trazer uma cópia',
    `${linhaDeOutra.slice(0, 160)} | ${botoesDaLinha}`,
  );
  fs.rmSync(path.join(pastaDaRede, 'travas', `${idNaRede}.trava.json`), { force: true });
  const naLinhaDaBase = (rotulo) =>
    clicarEm(`Array.from(Array.from(document.querySelectorAll('.lista-da-biblioteca li')).find(li => (li.querySelector('strong') || {}).textContent === ${JSON.stringify(nomeDaBase)}).querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})`);
  await naLinhaDaBase('Aprovar como base');
  await espera(300);
  await noCampo(`Quem aprova ${nomeDaBase} como base`, 'Teste de uso');
  await noCampo(`O que é a base ${nomeDaBase}`, 'base do teste de uso');
  await botaoNaJanela('Aprovar');
  await espera(800);
  const linhaDaBase = await js(`(() => { const li = Array.from(document.querySelectorAll('.lista-da-biblioteca li')).find(li => (li.querySelector('strong') || {}).textContent === ${JSON.stringify(nomeDaBase)}); return li ? li.className + ' | ' + li.innerText.replace(/\\s+/g, ' ') : ''; })()`);
  conferir(
    'o projeto aberto aprovado como base: o selo verde, quem aprovou e o que é',
    nomeDaBase !== '' && linhaDaBase.includes('item-de-base') && linhaDaBase.includes('Base aprovada') && linhaDaBase.includes('Aprovada por Teste de uso') && linhaDaBase.includes('base do teste de uso'),
    `${nomeDaBase}: ${linhaDaBase.slice(0, 220)}`,
  );
  await foto('43-base-aprovada.png');
  await naLinhaDaBase('Novo modelo desta base');
  await espera(300);
  await noCampo(`Nome do modelo novo da base ${nomeDaBase}`, 'Modelo da base do teste');
  await botaoNaJanela('Criar o modelo');
  await espera(1200);
  const pecasDoModelo = await pecasGravadas();
  const modeloNoDisco = projetoMaisRecente();
  conferir(
    'o modelo novo abre com as peças da base e diz de que base veio',
    (await janela()) === 'nenhuma' &&
      modeloNoDisco.nome === 'Modelo da base do teste' &&
      modeloNoDisco.feitoDaBase && modeloNoDisco.feitoDaBase.nome === nomeDaBase &&
      !modeloNoDisco.base &&
      JSON.stringify(pecasDoModelo.map((p) => p.contorno)) === JSON.stringify(pecasDaBaseNoDisco.map((p) => p.contorno)),
    `${modeloNoDisco.nome}, da base ${modeloNoDisco.feitoDaBase && modeloNoDisco.feitoDaBase.nome}, ${pecasDoModelo.length} de ${pecasDaBaseNoDisco.length} peça(s)`,
  );
  await js('window.__confirmDoTeste = window.confirm; window.confirm = () => true; 1');
  await clicarEm(`document.querySelector('button[title="Novo projeto (Ctrl+N)"]')`);
  await espera(800);
  await js('window.confirm = window.__confirmDoTeste; 1');
  const opcoesDoComeco = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] .escolha-do-comeco label')).map(l => l.textContent.trim()))`));
  conferir(
    'o "Novo projeto" oferece começar da base',
    opcoesDoComeco[0] === 'Uma mesa vazia' && opcoesDoComeco.some((o) => o.startsWith(`Da base “${nomeDaBase}”`)),
    JSON.stringify(opcoesDoComeco),
  );
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] .escolha-do-comeco label')).find(l => l.textContent.trim().startsWith('Da base')).querySelector('input')`);
  await espera(300);
  await foto('44-novo-projeto-da-base.png');
  await botaoNaJanela('Cancelar');
  await espera(400);
  await abrirABiblioteca();
  await naLinhaDaBase('Pôr as peças no aberto');
  await espera(1000);
  const comAsDaBase = await pecasGravadas();
  const caixaDe = (lista) => caixa(lista.flatMap((p) => p.contorno));
  const antigas = comAsDaBase.slice(0, pecasDoModelo.length);
  const novasDaBase = comAsDaBase.slice(pecasDoModelo.length);
  conferir(
    'as peças da base entram no modelo à direita das que ele tem, marcadas, com ids novos',
    (await janela()) === 'nenhuma' &&
      novasDaBase.length === pecasDaBaseNoDisco.length &&
      caixaDe(novasDaBase).minY > caixaDe(antigas).maxY &&
      novasDaBase.every((p) => !antigas.some((a) => a.id === p.id)),
    `${antigas.length} + ${novasDaBase.length} peça(s); as novas de ${Math.round(caixaDe(novasDaBase).minY)} mm, as de antes até ${Math.round(caixaDe(antigas).maxY)} mm`,
  );
  await foto('45-pecas-da-base-no-modelo.png');
  await clicarEm(`document.querySelector('button[title="Desfazer (Ctrl+Z)"]')`);
  await espera(400);
  conferir('o Desfazer tira as peças da base', (await pecasGravadas()).length === pecasDoModelo.length, '');

  // 17. Extrair todas (ADR 0128): a pala de teste (30 × 20 cm, cortada por duas linhas internas que se cruzam)
  // importada; com ela selecionada, "Extrair todas" faz de uma vez as quatro peças, uma por região, em fila depois das
  // que estão na mesa, e juntas elas são a pala inteira; o Desfazer as tira.
  const areaDe = (c) => Math.abs(c.reduce((s, p, i) => s + p.x * c[(i + 1) % c.length].y - c[(i + 1) % c.length].x * p.y, 0)) / 2;
  arquivoParaAbrir = PALA_DXF;
  await aba('Início');
  await botao('Importar DXF');
  await espera(2500);
  const comAPala = await pecasGravadas();
  const pala = comAPala.find((p) => p.nome.startsWith('pala-de-teste'));
  conferir('a pala de teste entra, com as duas linhas internas', !!pala && pala.linhasInternas.length === 2 && Math.abs(areaDe(pala.contorno) - 60000) < 1, pala ? `${pala.nome}: ${Math.round(areaDe(pala.contorno))} mm², ${pala.linhasInternas.length} linha(s) interna(s)` : JSON.stringify(comAPala.map((p) => p.nome)));
  await clicarEm(`Array.from(document.querySelectorAll('.lista-de-pecas li')).find(li => li.textContent.startsWith(${JSON.stringify(pala ? pala.nome : 'pala-de-teste')})).querySelector('button')`);
  await espera(300);
  await aba('Produção');
  await espera(300);
  await botao('Extrair todas');
  await espera(1000);
  const recadoDasRegioes = await js(`((document.querySelector('.faixa-de-instrucao') || {}).textContent || '')`);
  await foto('46-extrair-todas.png');
  const comAsPartes = await pecasGravadas();
  const partes = comAsPartes.filter((p) => pala && p.nome.startsWith(`${pala.nome} (`));
  const fimDasDeAntes = Math.max(...comAPala.flatMap((p) => p.contorno.map((q) => q.y)));
  conferir(
    'Extrair todas: as quatro regiões viram quatro peças, em fila depois das que estavam na mesa, e juntas são a pala inteira',
    partes.length === 4 &&
      comAsPartes.length === comAPala.length + 4 &&
      Math.abs(partes.reduce((s, p) => s + areaDe(p.contorno), 0) - 60000) < 1 &&
      partes.every((p) => Math.min(...p.contorno.map((q) => q.y)) > fimDasDeAntes) &&
      recadoDasRegioes.startsWith('4 moldes extraídos de') &&
      recadoDasRegioes.includes('juntos, cobrem a peça inteira'),
    `${partes.map((p) => `${p.nome} ${Math.round(areaDe(p.contorno))} mm²`).join(', ')} / ${recadoDasRegioes.slice(0, 120)}`,
  );
  await clicarEm(`document.querySelector('button[title="Desfazer (Ctrl+Z)"]')`);
  await espera(400);
  conferir('o Desfazer tira as quatro peças de uma vez', (await pecasGravadas()).length === comAPala.length, '');

  // 18. O ponto de casamento (ADR 0130): Marcações › Ponto de casamento. Com o mouse, o ponto principal na pala e o do
  // grupo "manga" na pala e na saia de teste; as marcas ficam nas peças com o rótulo que o risco lê ("casamento",
  // "casamento: manga"), e o desenho mostra o círculo vermelho e os losangos laranja com o nome.
  await clicarEm(`document.querySelector('button[aria-label="Ajustar à tela"]')`);
  await espera(500);
  const dentroDe = (q, c) => {
    let dentro = false;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      if (c[i].y > q.y !== c[j].y > q.y && q.x < ((c[j].x - c[i].x) * (q.y - c[i].y)) / (c[j].y - c[i].y) + c[i].x) dentro = !dentro;
    }
    return dentro;
  };
  // O ponto da peça mais longe da borda dela e das peças postas depois dela (o clique acerta a de cima): nesse zoom,
  // um pixel tem uns 6 mm, e o ponto perto da borda cai fora.
  const pontoSoDela = (peca, todas) => {
    const depoisDela = todas.slice(todas.indexOf(peca) + 1);
    const aoSegmento = (q, a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const s = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
      return Math.hypot(q.x - (a.x + s * dx), q.y - (a.y + s * dy));
    };
    const aBorda = (q, c) => Math.min(...c.map((a, i) => aoSegmento(q, a, c[(i + 1) % c.length])));
    const c = caixa(peca.contorno);
    let melhor = null;
    for (let i = 1; i < 24; i++) {
      for (let j = 1; j < 24; j++) {
        const q = { x: c.minX + ((c.maxX - c.minX) * i) / 24, y: c.minY + ((c.maxY - c.minY) * j) / 24 };
        if (!dentroDe(q, peca.contorno) || depoisDela.some((p) => dentroDe(q, p.contorno))) continue;
        const folga = Math.min(aBorda(q, peca.contorno), ...depoisDela.map((p) => aBorda(q, p.contorno)));
        if (!melhor || folga > melhor.folga) melhor = { q, folga };
      }
    }
    return melhor ? melhor.q : null;
  };
  const antesDosPontos = await pecasGravadas();
  const palaComPontos = antesDosPontos.find((p) => p.nome === 'pala-de-teste');
  const saiaComPonto = antesDosPontos.find((p) => p.nome === 'saia-de-teste-1');
  await aba('Marcações');
  await espera(300);
  // A conta da posição na tela é refeita depois de entrar na ferramenta: a faixa de instrução aparece em cima do
  // desenho e o empurra para baixo.
  let naTelaDosPontos = null;
  const calibrarOsPontos = async () => {
    const tela = JSON.parse(await js(`JSON.stringify(document.querySelector('.area-de-desenho-container canvas').getBoundingClientRect())`));
    const p1 = await lerXY(150, 100);
    const p2 = await lerXY(850, 450);
    const k = (850 - 150) / (p2.y - p1.y);
    naTelaDosPontos = (mundo) => ({ x: Math.round(tela.left + 150 + (mundo.y - p1.y) * k), y: Math.round(tela.top + 100 + (mundo.x - p1.x) * k) });
  };
  const clicarNoMundo = async (mundo) => {
    const p = naTelaDosPontos(mundo);
    win.webContents.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
    await espera(100);
    win.webContents.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await espera(400);
  };
  const pontoNaPala = palaComPontos && pontoSoDela(palaComPontos, antesDosPontos);
  const pontoNaSaia = saiaComPonto && pontoSoDela(saiaComPonto, antesDosPontos);
  const porPonto = async (grupo, ondes) => {
    await botao('Ponto de casamento');
    await espera(500);
    await noCampo('Grupo (em branco: o ponto principal, que cai na linha do desenho)', grupo);
    await botaoNaJanela('Continuar');
    await espera(400);
    await calibrarOsPontos();
    for (const onde of ondes) await clicarNoMundo(onde);
  };
  if (pontoNaPala && pontoNaSaia) {
    await porPonto('', [pontoNaPala]);
    await porPonto('Manga', [{ x: pontoNaPala.x + 50, y: pontoNaPala.y + 70 }, pontoNaSaia]);
  }
  const recadoDosPontos = await js(`((document.querySelector('.faixa-de-instrucao') || {}).textContent || '')`);
  await foto('47-pontos-de-casamento.png');
  await tecla('Escape');
  await espera(300);
  // De perto (a roda do mouse aproxima no ponto, pelo sistema): o círculo vermelho e os losangos laranja, com os nomes.
  if (pontoNaPala) {
    await calibrarOsPontos();
    const alvoDaRoda = naTelaDosPontos(pontoNaPala);
    const zoomNaBarra = async () => Number(((await js(`document.querySelector('.barra-de-status').innerText`)).match(/Zoom: (\d+)%/) || [])[1] || 0);
    const antes = await zoomNaBarra();
    let sentido = -120;
    for (let k = 0; k < 10; k++) {
      win.webContents.sendInputEvent({ type: 'mouseWheel', x: alvoDaRoda.x, y: alvoDaRoda.y, deltaX: 0, deltaY: sentido, canScroll: true });
      await espera(150);
      if (k === 0 && (await zoomNaBarra()) < antes) sentido = -sentido;
    }
    await espera(400);
    await foto('47a-pontos-de-perto.png');
  }
  const comOsPontos = await pecasGravadas();
  const rotulos = (nome) => (comOsPontos.find((p) => p.nome === nome) || { marcas: [] }).marcas.map((m) => m.rotulo).filter((r) => r && r.startsWith('casamento'));
  conferir(
    'o ponto de casamento com o mouse: o principal e o "manga" na pala, o "manga" na saia, com os rótulos que o risco lê',
    JSON.stringify(rotulos('pala-de-teste')) === '["casamento","casamento: manga"]' &&
      JSON.stringify(rotulos('saia-de-teste-1')) === '["casamento: manga"]' &&
      recadoDosPontos.startsWith('O ponto “casamento: manga” foi posto em “saia-de-teste-1”'),
    `pala ${JSON.stringify(rotulos('pala-de-teste'))}, saia ${JSON.stringify(rotulos('saia-de-teste-1'))} / ${recadoDosPontos.slice(0, 90)}`,
  );

  // 19. O componente pronto (ADR 0133): Produção › Componente pronto › Manga, com a cava de 46 cm: a peça nova entra
  // depois das da mesa, e a cabeça mede a cava mais a folga de 1,5 cm.
  const antesDoComponente = await pecasGravadas();
  await aba('Produção');
  await espera(300);
  await botao('Componente pronto');
  await espera(500);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] fieldset label')).find(l => l.textContent.trim().startsWith('Manga —')).querySelector('input')`);
  await botaoNaJanela('Continuar');
  await espera(400);
  await noCampo('Cava, frente e costas (mm)', '460');
  await botaoNaJanela('Criar');
  await espera(800);
  await foto('48-manga-pronta.png');
  const comAManga = await pecasGravadas();
  const manga = comAManga.find((p) => p.nome === 'Manga');
  const cabecaDaManga = manga ? manga.contorno.slice(0, 33).reduce((s, p, i, c) => (i === 0 ? 0 : s + Math.hypot(p.x - c[i - 1].x, p.y - c[i - 1].y)), 0) : 0;
  const fimDasDeAntes2 = Math.max(...antesDoComponente.flatMap((p) => p.contorno.map((q) => q.y)));
  conferir(
    'a manga pronta: a cabeça mede a cava (46 cm) mais a folga (1,5 cm), depois das peças da mesa',
    !!manga && comAManga.length === antesDoComponente.length + 1 && Math.abs(cabecaDaManga - 475) < 1 && Math.min(...manga.contorno.map((q) => q.y)) > fimDasDeAntes2,
    manga ? `cabeça ${cabecaDaManga.toFixed(1)} mm, ${manga.piques.length} pique(s)` : JSON.stringify(comAManga.map((p) => p.nome)),
  );

  // 20. A inclinação do fio no encaixe (ADR 0135): no painel da peça, 2° de inclinação ficam gravados na peça.
  await clicarEm(`Array.from(document.querySelectorAll('.lista-de-pecas li')).find(li => li.textContent.startsWith('Manga')).querySelector('button')`);
  await espera(400);
  await aba('Modelo');
  await botao('Propriedades');
  await espera(500);
  await js(`(() => { const c = document.querySelector('input[aria-label="Inclinação no encaixe"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(c, '2'); c.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await espera(400);
  await fecharJanela();
  await espera(300);
  const comInclinacao = (await pecasGravadas()).find((p) => p.nome === 'Manga');
  conferir(
    'a inclinação no encaixe, no painel da peça, fica gravada (2°)',
    !!comInclinacao && comInclinacao.restricaoDeRotacao.inclinacaoGraus === 2,
    comInclinacao ? JSON.stringify(comInclinacao.restricaoDeRotacao) : 'sem a manga',
  );

  // 21. Trocar um material em todos os modelos (ADR 0137): o botão de 14 mm entra no lugar do de 12 mm; a ficha (em
  // rascunho, versão 2) do projeto que o usa fica com o de 14, gravada.
  await aba('Modelo');
  await espera(300);
  await botao('Materiais e aviamentos');
  await espera(800);
  await botaoNaJanelaDeMateriais('Novo material');
  await digitar('Descrição *', 'Botão de pressão 14 mm');
  await digitar('Código', 'BOT-14');
  await digitar('Preço por un (R$)', '0,40');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Guardar')`);
  await espera(800);
  await parteDaJanela('Custos dos modelos');
  await espera(400);
  await js(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Material a trocar"]'); const o = Array.from(s.options).find(o => o.textContent.startsWith('BOT-12')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await espera(200);
  await js(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Material que entra"]'); const o = Array.from(s.options).find(o => o.textContent.startsWith('BOT-14')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await espera(200);
  const paraNaTroca = await js(`(document.querySelector('[role=dialog] select[aria-label="Material que entra"]').selectedOptions[0] || {}).textContent || ''`);
  await botaoNaJanela('Trocar nos modelos');
  await espera(1200);
  const recadoDaTroca = await js(`((document.querySelector('[role=dialog] .troca-nos-modelos [role=status]') || {}).textContent || '')`);
  await foto('49-troca-nos-modelos.png');
  await fecharJanela();
  await espera(600);
  const comFicha = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', n), 'utf8')))
    .filter((p) => p.fichaTecnica && p.fichaTecnica.materiais.some((i) => i.descricao.startsWith('Botão de pressão')));
  conferir(
    'trocar o botão de 12 mm pelo de 14 em todos os modelos: a ficha aberta fica com o de 14, gravada',
    paraNaTroca.startsWith('BOT-14') &&
      recadoDaTroca.startsWith('“Botão de pressão 12 mm” trocado por “Botão de pressão 14 mm”') &&
      comFicha.length > 0 &&
      comFicha.every((p) => p.fichaTecnica.materiais.some((i) => i.descricao === 'Botão de pressão 14 mm') && !p.fichaTecnica.materiais.some((i) => i.descricao === 'Botão de pressão 12 mm')),
    `${paraNaTroca} / ${recadoDaTroca.slice(0, 160)}`,
  );

  // 22. A mesa digitalizadora (ADR 0144): Produção › Mesa digitalizadora. "Ligar a mesa" pede a porta ao programa — a
  // lista das portas deste computador aparece (ou "nenhuma porta"), e Cancelar não liga. Depois, o registro de uma mesa
  // colado (dois retângulos tocados a 1000 linhas por polegada, o segundo com um pique) vira duas peças no desenho.
  for (let i = 0; i < 3 && (await janela()) !== 'nenhuma'; i++) {
    await fecharJanela();
    await espera(300);
  }
  const antesDaMesa = await pecasGravadas();
  await aba('Produção');
  await espera(300);
  await botao('Mesa digitalizadora');
  await espera(500);
  const abriuAMesa = (await janela()) === 'Mesa digitalizadora';
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Ligar a mesa (porta serial)…')`);
  let escolhaDaPorta = '';
  for (let i = 0; i < 20 && !escolhaDaPorta; i++) {
    await espera(250);
    escolhaDaPorta = await js(`(document.querySelector('[role=dialog] .escolha-da-porta') || {}).innerText || ''`);
  }
  await foto('49-mesa-digitalizadora-portas.png');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] .escolha-da-porta button')).find(b => b.textContent.trim() === 'Cancelar')`);
  let recadoDaMesa = '';
  for (let i = 0; i < 20 && !recadoDaMesa.includes('Nenhuma porta foi escolhida'); i++) {
    await espera(250);
    recadoDaMesa = await js(`(document.querySelector('[role=dialog] .estado-da-mesa [role=status]') || {}).textContent || ''`);
  }
  conferir(
    'a mesa digitalizadora: "Ligar a mesa" mostra as portas deste computador (ou que não há nenhuma), e Cancelar não liga',
    abriuAMesa && (escolhaDaPorta.includes('Nenhuma porta serial encontrada') || escolhaDaPorta.includes('Usar ')) && recadoDaMesa.includes('Nenhuma porta foi escolhida'),
    `${escolhaDaPorta.replace(/\s+/g, ' ').slice(0, 160)} | ${recadoDaMesa}`,
  );
  await clicarEm(`document.querySelector('[role=dialog] details summary')`);
  const registroDaMesa = ['0,0,1', '4000,0,1', '4000,2000,1', '0,2000,1', '0,0,5', '0,0,1', '2000,0,1', '2000,1000,3', '2000,2000,1', '0,2000,1', '0,0,5'].join('\n');
  await js(`(() => { const a = document.querySelector('[role=dialog] textarea[aria-label="Registro da mesa"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(a, ${JSON.stringify(registroDaMesa)}); a.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Ler o registro')`);
  await espera(800);
  await foto('50-mesa-digitalizadora-pecas.png');
  const comAsDaMesa = await pecasGravadas();
  const daMesa = comAsDaMesa.filter((p) => p.nome.startsWith('Peça da mesa '));
  const larguraDaPrimeira = daMesa[0] ? Math.max(...daMesa[0].contorno.map((q) => q.y)) - Math.min(...daMesa[0].contorno.map((q) => q.y)) : 0;
  conferir(
    'o registro da mesa colado vira duas peças no desenho: 101,6 mm de largura (4000 linhas a 1000 por polegada), a segunda com o pique',
    comAsDaMesa.length === antesDaMesa.length + 2 && daMesa.length === 2 && Math.abs(larguraDaPrimeira - 101.6) < 0.01 && daMesa[1].piques.length === 1,
    `${daMesa.map((p) => `${p.nome}: ${p.contorno.length} pontos, ${p.piques.length} pique(s)`).join('; ')} | largura ${larguraDaPrimeira.toFixed(2)} mm`,
  );
  await fecharJanela();
  await espera(300);

  // 23. Os looks da coleção (ADR 0145): um segundo modelo na coleção do teste; um look com os dois — o croqui do
  // ligado ao projeto aparece, a prancha sai em HTML com os dois cartões e o croqui, e o look fica gravado.
  await aba('Modelo');
  await espera(300);
  await botao('Coleções');
  await espera(800);
  await botaoNaJanela('Novo modelo');
  await espera(500);
  await botaoNaJanela('Guardar o modelo');
  await espera(300);
  await botaoNaJanela('← Voltar ao mix');
  await espera(300);
  await parteDaJanela('Looks');
  await espera(300);
  await noCampo('Nome do look', 'Look do teste');
  await js(`(() => { for (const c of document.querySelectorAll('[role=dialog] [aria-label="Modelos do look"] input[type=checkbox]')) c.click(); return 1; })()`);
  await espera(200);
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim().startsWith('Guardar o look'))`);
  await espera(600);
  const lookNaTela = JSON.parse(await js(`JSON.stringify((() => { const a = document.querySelector('[role=dialog] article.look-da-colecao'); return a ? { texto: a.innerText.replace(/\\s+/g, ' '), croquis: a.querySelectorAll('[data-modelo] svg').length, modelos: a.querySelectorAll('[data-modelo]').length } : null; })())`));
  await foto('51-look-da-colecao.png');
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] article.look-da-colecao button')).find(b => b.textContent.trim() === 'Salvar a prancha (HTML)')`);
  await espera(1000);
  const prancha = fs.existsSync(path.join(SAIDA, 'look-Look-do-teste.html')) ? fs.readFileSync(path.join(SAIDA, 'look-Look-do-teste.html'), 'utf8') : '';
  const looksGravados = (JSON.parse(fs.readFileSync(path.join(DADOS, 'colecoes.json'), 'utf8')).colecoes[0] || {}).looks || [];
  conferir(
    'o look da coleção: os dois modelos lado a lado (o croqui do ligado ao projeto), a prancha em HTML com os dois e o croqui, e o look gravado',
    !!lookNaTela && lookNaTela.modelos === 2 && lookNaTela.croquis >= 1 && (prancha.match(/<figure>/g) || []).length === 2 && prancha.includes('<svg') && looksGravados.length === 1 && looksGravados[0].modeloIds.length === 2,
    `${JSON.stringify(lookNaTela).slice(0, 200)} | prancha ${prancha.length} bytes | ${looksGravados.length} look(s) gravado(s)`,
  );
  await fecharJanela();
  await espera(300);

  // 24. A busca por imagem na biblioteca (ADR 0145): a foto do molde de papel (a que está no projeto) escolhida na
  // busca acha esse projeto primeiro, quase igual; os projetos sem imagem são contados.
  const comFoto = fs
    .readdirSync(path.join(DADOS, 'projetos'))
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(fs.readFileSync(path.join(DADOS, 'projetos', n), 'utf8')))
    .find((p) => Array.isArray(p.imagens) && p.imagens.length > 0);
  await abrirABiblioteca();
  await js(
    `(async () => {
      const blob = await (await fetch(${JSON.stringify(comFoto ? comFoto.imagens[0].dados : '')})).blob();
      const transferencia = new DataTransfer();
      transferencia.items.add(new File([blob], 'foto-da-vitrine.png', { type: blob.type || 'image/png' }));
      const campo = document.querySelector('input[aria-label="Imagem para buscar"]');
      campo.files = transferencia.files;
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      return 1;
    })()`,
  );
  let achados = '';
  for (let i = 0; i < 40 && !achados; i++) {
    await espera(250);
    achados = await js(`(document.querySelector('[role=dialog] .busca-por-imagem [role=status]') || {}).innerText || ''`);
  }
  await js(`(() => { const s = document.querySelector('[role=dialog] .busca-por-imagem'); if (s) s.scrollIntoView(); return 1; })()`);
  await foto('52-busca-por-imagem.png');
  const primeiroAchado = await js(`((document.querySelector('[role=dialog] .busca-por-imagem .parecidos li strong') || {}).textContent || '')`);
  conferir(
    'a busca por imagem: a foto do projeto acha esse projeto primeiro, quase igual, e conta os sem imagem',
    !!comFoto && primeiroAchado === comFoto.nome && /parecido (9\d|100)%/.test(achados) && /sem imagem ficaram de fora/.test(achados),
    `${comFoto ? comFoto.nome : 'nenhum projeto com foto'} | ${achados.replace(/\s+/g, ' ').slice(0, 220)}`,
  );
  await fecharJanela();
  await espera(300);

  // 25. O servidor de encaixes (ADR 0147): uma segunda janela no modo servidor (a que o programa abre com
  // "--servidor-de-encaixes"), com a pasta da fila da rede do passo 5c. A janela principal, que não atende, manda um
  // encaixe para a rede; o servidor pega, calcula na fila dele (num arquivo à parte) e devolve; o encaixe termina na
  // janela principal "calculado por" ele.
  await aba('Encaixe');
  await espera(300);
  await botao('Fila de encaixes');
  await espera(600);
  await naFilaDaRede('Pausar a fila');
  await espera(300);
  await fecharJanela();
  await espera(300);
  await porNaFila('grade');
  await botao('Fila de encaixes');
  await espera(600);
  await naFilaDaRede('Mandar para a rede');
  await espera(800);
  const pedidosParaOServidor = fs.readdirSync(path.join(pastaDaFila, 'pedidos')).length;
  const servidor = new BrowserWindow({
    width: 720,
    height: 560,
    show: true,
    title: 'Enfesto CAD — servidor de encaixes',
    webPreferences: { preload: path.join(RAIZ, 'dist-electron', 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  await servidor.loadURL('app://enfesto/index.html?modo=servidor');
  const noServidor = (codigo) => servidor.webContents.executeJavaScript(codigo);
  await espera(800);
  await noServidor(`(() => { const i = Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes('Nome desta estação')).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Servidor de teste'); i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  let calculadoPeloServidor = '';
  for (let i = 0; i < 120 && !calculadoPeloServidor; i++) {
    await espera(500);
    calculadoPeloServidor = await js(`(Array.from(document.querySelectorAll('.tabela-da-fila tbody tr')).find(tr => tr.innerText.includes('calculado por Servidor de teste na rede')) || {}).innerText || ''`);
  }
  const estadoDoServidor = await noServidor(`JSON.stringify({ estado: (document.querySelector('.estado-do-servidor') || {}).textContent || '', calculados: ((Array.from(document.querySelectorAll('dt')).find(d => d.textContent === 'Calculados desde que abriu') || {}).nextElementSibling || {}).textContent || '' })`);
  fs.writeFileSync(path.join(SAIDA, '53-servidor-de-encaixes.png'), (await servidor.webContents.capturePage()).toPNG());
  log('      foto: 53-servidor-de-encaixes.png');
  const filaDoServidor = fs.existsSync(path.join(DADOS, 'fila-do-servidor.json'));
  conferir(
    'o servidor de encaixes: a janela do modo servidor atende sempre, pega o encaixe mandado pela principal, calcula na fila dele (num arquivo à parte) e o devolve "calculado por" ele',
    pedidosParaOServidor === 1 && /Concluído/.test(calculadoPeloServidor) && JSON.parse(estadoDoServidor).estado === 'Atendendo a fila da rede' && JSON.parse(estadoDoServidor).calculados === '1' && filaDoServidor,
    `pedidos ${pedidosParaOServidor} | ${estadoDoServidor} | fila do servidor ${filaDoServidor} | ${calculadoPeloServidor.replace(/\s+/g, ' ').slice(0, 160)}`,
  );
  servidor.destroy();
  await naFilaDaRede('Retomar a fila');
  await espera(300);
  await fecharJanela();
  await espera(300);

  const erros = JSON.parse(await js(`JSON.stringify(window.__errosDoTeste || [])`));
  conferir('sem erro na página', erros.length === 0, JSON.stringify(erros));
  const avisosDoConsole = JSON.parse(await js(`JSON.stringify(window.__avisosDoConsole || [])`));
  for (const a of avisosDoConsole) log('      console ' + a);
  conferir('sem aviso no console', avisosDoConsole.length === 0, `${avisosDoConsole.length} aviso(s)`);
  log(`falhas: ${falhas}`);
}

app.whenReady().then(async () => {
  try {
    await principal();
  } catch (e) {
    falhas++;
    log('FALHA (exceção) ' + (e && e.stack ? e.stack : String(e)));
  }
  app.exit(falhas > 0 ? 1 : 0);
});
