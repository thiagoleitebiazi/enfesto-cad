/*
 * O teste de uso: abre o programa gerado (dist e dist-electron) e o usa como uma pessoa usaria — importa um DXF de
 * teste, seleciona com o retângulo e com o Ctrl/⌘+clique, arrasta o grupo, exporta o PDF, abre o planejamento — com
 * o mouse e o teclado de verdade (pelo sistema), tirando uma foto da janela a cada passo. Roda no Mac do GitHub, na
 * montagem do instalador (.github/workflows/mac.yml), e em qualquer computador:
 *
 *   npm run build
 *   npx electron scripts/teste-de-uso/main.cjs
 *
 * As fotos e o registro (uso.txt) vão para a pasta de SAIDA_DO_TESTE (ou ./uso). Os dados ficam numa pasta
 * temporária: os projetos de quem roda o teste não são tocados. Sai com 0 se tudo conferiu, e 1 se não.
 */
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const SAIDA = path.resolve(process.env.SAIDA_DO_TESTE || path.join(process.cwd(), 'uso'));
const DXF = path.join(__dirname, 'molde-de-teste.dxf');
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

// Uma pasta de dados só do teste, antes de o programa começar (ele lê o estado da abertura ao carregar).
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'enfesto-cad-uso-'));
app.setPath('userData', DADOS);
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [DXF] });
dialog.showSaveDialog = async (opcoes) => ({ canceled: false, filePath: path.join(SAIDA, path.basename((opcoes && opcoes.defaultPath) || 'saida.pdf')) });
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
  log(`sistema: ${NO_MAC ? 'macOS' : process.platform} ${os.release()} (${process.arch}), Electron ${process.versions.electron}`);
  await foto('01-aberto.png');
  conferir('o programa abre, com a mesa e a barra de ferramentas', (await js(`!!document.querySelector('.app-shell') && !!document.querySelector('.area-de-desenho-container canvas')`)) === true);
  // A tela de início: importar e exportar à mão logo ao abrir (ADR 0096).
  const naAbertura = JSON.parse(
    await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=tabpanel] [aria-label="Importação e exportação"] button')).map(b => b.textContent.replace(/\\s+/g, ' ').trim()))`),
  );
  conferir('a tela de início tem Importar DXF, Importar PDF, Exportar DXF, Exportar PDF e Exportar PLT', naAbertura.join('|') === 'Importar DXF|Importar PDF|Exportar DXF|Exportar PDF|Exportar PLT', naAbertura.join(', '));

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
  conferir('o PLT foi gravado: HPGL, com o nome das 3 peças', plt.startsWith('IN;SP1;') && plt.trim().endsWith('PU0,0;SP0;') && nomesNoPlt === 3, `${JSON.stringify(plts)} ${nomesNoPlt} nome(s)`);
  await aba('Encaixe');
  await espera(300);

  // 4. O planejamento de corte e o enfesto (a margem de segurança).
  await botao('Planejamento de corte');
  await espera(1200);
  conferir('abre o planejamento de corte', (await janela()) === 'Planejamento de corte', await janela());
  await foto('10-planejamento.png');
  await fecharJanela();
  await espera(300);
  await botao('Enfesto');
  await espera(600);
  const margens = await js(`JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] label')).filter(l => l.textContent.trim().startsWith('Margem')).map(l => l.querySelector('input').value))`);
  conferir('o Enfesto com as margens de 4 mm', JSON.stringify(JSON.parse(margens).map(Number)) === '[4,4]', margens);
  await foto('11-enfesto.png');
  await fecharJanela();

  const erros = JSON.parse(await js(`JSON.stringify(window.__errosDoTeste || [])`));
  conferir('sem erro na página', erros.length === 0, JSON.stringify(erros));
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
