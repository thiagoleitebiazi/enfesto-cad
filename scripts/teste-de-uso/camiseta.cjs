/*
 * A camiseta sem nomes (ADR 0234): abre o programa gerado (dist e dist-electron), importa um molde de camiseta cujas peças não têm
 * nome e confere, na tela de verdade, que o provador 3D já abre com tudo no corpo e costurado, que ela assenta sem ninguém escolher
 * nada, e que a outra manga do molde pode ser escolhida. Por fim, importa um ISO cortado com faca tangencial, em que a faca sobe em
 * cada canto, e confere que as peças entram sem aviso (ADR 0236). Tira uma foto de cada passo.
 *
 *   npm run build
 *   npx electron scripts/teste-de-uso/camiseta.cjs
 *
 * CAMISETA_DXF e CAMISETA_ISO: outros arquivos no lugar dos de teste (os moldes reais não entram no repositório). As fotos e o registro
 * (camiseta.txt) vão para a pasta de SAIDA_DO_TESTE (ou ./uso). Sai com 0 se tudo conferiu, e 1 se não.
 */
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const SAIDA = path.resolve(process.env.SAIDA_DO_TESTE || path.join(process.cwd(), 'uso'));
const MOLDE = path.resolve(process.env.CAMISETA_DXF || path.join(__dirname, 'camiseta-de-teste.dxf'));
const ISO = path.resolve(process.env.CAMISETA_ISO || path.join(__dirname, 'camiseta-faca-tangencial.iso'));
let arquivoParaAbrir = MOLDE;

fs.mkdirSync(SAIDA, { recursive: true });
const REGISTRO = path.join(SAIDA, 'camiseta.txt');
fs.writeFileSync(REGISTRO, '');
const log = (texto) => {
  fs.appendFileSync(REGISTRO, texto + '\n');
  console.log(texto);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'enfesto-cad-camiseta-')));
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [arquivoParaAbrir] });
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
    await espera(400);
    fs.writeFileSync(path.join(SAIDA, nome), (await win.webContents.capturePage()).toPNG());
    log('      foto: ' + nome);
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
  const botaoNaJanela = (texto) => clicarEm(`Array.from(document.querySelectorAll('[role=dialog] button')).find(b => b.textContent.trim() === ${JSON.stringify(texto)})`);
  const status = () => js(`((document.querySelector('[role=dialog] .status-do-provador') || {}).textContent || '')`);
  const qualidade = () => js(`(document.querySelector('[role=dialog] canvas') || { dataset: {} }).dataset.qualidade || ''`);
  const fundoDaImagem = () => js(`(() => { const c = document.querySelector('[role=dialog] canvas'); return c ? c.width + 'x' + c.height : ''; })()`);
  const assentar = async () => {
    let texto = '';
    for (let i = 0; i < 240; i++) {
      await espera(500);
      texto = await status();
      if (/^(Assentou|Parou)/.test(texto)) break;
    }
    for (let i = 0; i < 60 && (await qualidade()) !== 'final'; i++) await espera(250);
    return texto;
  };

  log(`sistema: ${process.platform} ${os.release()} (${process.arch}), Electron ${process.versions.electron}`);
  await js(`(document.querySelector('[role=dialog] .sobreposicao-fechar') || { click() {} }).click()`);
  await espera(800);
  await aba('Início');
  await botao('Importar DXF');
  await espera(2500);
  const pecas = await js(`document.querySelectorAll('.lista-de-pecas li').length`);
  conferir('o molde entra com as 5 peças, sem nome', pecas === 5, String(pecas));
  await foto('camiseta-1-importada.png');
  await aba('Conferência');
  await botao('Provador 3D');
  await espera(2500);
  const aviso = await js(`((document.querySelector('[role=dialog] [role=alert]') || {}).textContent || '')`);
  conferir('o provador abre dizendo o que reconheceu', /^Reconhecido pela forma: .*Frente.*Costas.*Gola.*13 costura/.test(aviso), aviso);
  const arrumada = await status();
  conferir('a camiseta já está no corpo e costurada: 5 peças, 13 costuras', /^5 peça\(s\) em volta do corpo, 13 costura\(s\)/.test(arrumada), arrumada);
  await foto('camiseta-2-arrumada.png');
  await botaoNaJanela('Simular');
  const assentou = await assentar();
  const abertura = Number((assentou.match(/maior abertura é de (\d+) mm/) || [])[1]);
  conferir('assenta sem ninguém escolher nada, com as costuras fechadas (até 6 mm)', assentou.startsWith('Assentou') && abertura <= 6, assentou);
  conferir('a imagem fica nítida sozinha', (await qualidade()) === 'final', `${await qualidade()} ${await fundoDaImagem()}`);
  await foto('camiseta-3-vestida.png');
  const escolha = await js(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Manga do modelo"]'); return s ? JSON.stringify(Array.from(s.options).map(o => [o.value, o.textContent, o.selected])) : ''; })()`);
  const opcoes = escolha ? JSON.parse(escolha) : [];
  conferir('as duas mangas do molde viram uma escolha, e fica a curta', opcoes.length === 2 && opcoes[0][1].startsWith('Manga curta') && opcoes[0][2], escolha);
  if (opcoes.length === 2) {
    await js(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Manga do modelo"]'); const v = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; v.call(s, ${JSON.stringify(opcoes[1][0])}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await espera(800);
    await botaoNaJanela('Recomeçar');
    await espera(800);
    const trocada = await status();
    conferir('trocar a manga leva as costuras junto', /^5 peça\(s\) em volta do corpo, 13 costura\(s\)/.test(trocada), trocada);
    await botaoNaJanela('Simular');
    const comprida = await assentar();
    conferir('a manga comprida também assenta', comprida.startsWith('Assentou'), comprida);
    await foto('camiseta-4-manga-comprida.png');
  }
  await js(`(document.querySelector('[role=dialog] .sobreposicao-fechar') || { click() {} }).click()`);
  await espera(800);
  arquivoParaAbrir = ISO;
  await aba('Início');
  await botao('Importar ISO');
  await espera(2500);
  const faixa = await js(`((document.querySelector('.faixa-da-importacao') || {}).textContent || '')`);
  const depois = await js(`document.querySelectorAll('.lista-de-pecas li').length`);
  conferir('o ISO da faca tangencial entra inteiro, sem aviso', faixa === '' && depois === 10, `${depois} peça(s); aviso: "${faixa}"`);
  await foto('camiseta-5-iso-importado.png');
}

(async () => {
  try {
    await principal();
  } catch (e) {
    conferir('o teste correu até o fim', false, e instanceof Error ? e.stack || e.message : String(e));
  }
  log(`RESUMO: ${falhas} falha(s)`);
  app.exit(falhas > 0 ? 1 : 0);
})();
