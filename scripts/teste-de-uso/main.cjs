/*
 * O teste de uso: abre o programa gerado (dist e dist-electron) e o usa como uma pessoa usaria — importa um DXF de
 * teste, seleciona com o retângulo e com o Ctrl/⌘+clique, arrasta o grupo, exporta o PDF, abre o planejamento, põe
 * dois encaixes na fila e aplica o melhor, põe uma peça num grupo do encaixe, faz a ficha técnica, o desenho técnico e
 * uma coleção — com
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
  await clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === 'Novo material')`);
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
