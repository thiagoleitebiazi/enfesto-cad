/* global Buffer */
/*
 * Gera os ícones do programa (ADR 0226), com a mesma marca da barra do programa: build/icon.ico e build/icon.icns.
 * Só precisa rodar de novo se a marca mudar: npx electron scripts/icone/gerar-icones.cjs
 * O PNG de cada tamanho também sai em PREVIA_DOS_ICONES, se essa pasta for dada.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const PASTA = path.resolve(__dirname, '..', '..', 'build');
const PREVIA = process.env.PREVIA_DOS_ICONES || '';

/** A marca, igual à de BarraDeFerramentas.tsx: o teste confere que as duas não se separam. */
const MARCA = `
  <path d="M3 13.6 10 17l7-3.4" stroke="#f28c28" />
  <path d="M3 10.1 10 13.5l7-3.4" stroke="#8fb4e6" />
  <path d="M10 3 3 6.6l7 3.4 7-3.4L10 3Z" fill="#e8eef8" stroke="#e8eef8" />`;
/** O lado da marca desenhada, com a espessura do traço, no viewBox de 20 dela. */
const LADO_DA_MARCA = 15.6;

/** Em tamanho pequeno a marca ocupa mais da placa e o traço engrossa, ou as três camadas viram um borrão. */
const WINDOWS_GRANDE = { margem: 0.02, raio: 0.2, marca: 0.7, traco: 1.6, sombra: false };
const WINDOWS_PEQUENO = { margem: 0, raio: 0.17, marca: 0.84, traco: 1.75, sombra: false };
/** A grade do macOS: 824 de placa em 1024, com sombra. */
const MAC = { margem: 0.098, raio: 0.225, marca: 0.68, traco: 1.6, sombra: true };

function svgDoIcone(lado, e) {
  const inicio = lado * e.margem;
  const placa = lado - 2 * inicio;
  const escala = (placa * e.marca) / LADO_DA_MARCA;
  const deslocamento = lado / 2 - 10 * escala;
  const borda = Math.max(1, lado / 96);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17305a" /><stop offset="1" stop-color="#0f1f3a" /></linearGradient>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${lado * 0.012}" stdDeviation="${lado * 0.014}" flood-color="#000" flood-opacity="0.32" /></filter>
  </defs>
  <rect x="${inicio}" y="${inicio}" width="${placa}" height="${placa}" rx="${placa * e.raio}" fill="url(#fundo)"${e.sombra ? ' filter="url(#sombra)"' : ''} />
  <rect x="${inicio + borda / 2}" y="${inicio + borda / 2}" width="${placa - borda}" height="${placa - borda}" rx="${placa * e.raio - borda / 2}" fill="none" stroke="#fff" stroke-opacity="0.13" stroke-width="${borda}" />
  <g transform="translate(${deslocamento} ${deslocamento}) scale(${escala})" fill="none" stroke-width="${e.traco}" stroke-linecap="round" stroke-linejoin="round">${MARCA}
  </g>
</svg>`;
}

async function desenhar(janela, lado, estilo) {
  const svg = Buffer.from(svgDoIcone(lado, estilo)).toString('base64');
  const r = await janela.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,${svg}';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = ${lado};
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, ${lado}, ${lado});
    const d = x.getImageData(0, 0, ${lado}, ${lado}).data;
    let texto = '';
    for (let i = 0; i < d.length; i += 8192) texto += String.fromCharCode.apply(null, d.subarray(i, i + 8192));
    return { png: c.toDataURL('image/png').split(',')[1], rgba: btoa(texto) };
  })()`);
  return { lado, png: Buffer.from(r.png, 'base64'), rgba: Buffer.from(r.rgba, 'base64') };
}

/** Até 128, o bitmap clássico, que todo programa do Windows lê; o de 256 vai em PNG, que é como o Windows o guarda. */
function bitmapDoIco({ lado, rgba }) {
  const linhaDaMascara = Math.ceil(lado / 32) * 4;
  const bmp = Buffer.alloc(40 + lado * lado * 4 + linhaDaMascara * lado);
  bmp.writeUInt32LE(40, 0);
  bmp.writeInt32LE(lado, 4);
  bmp.writeInt32LE(lado * 2, 8);
  bmp.writeUInt16LE(1, 12);
  bmp.writeUInt16LE(32, 14);
  bmp.writeUInt32LE(lado * lado * 4 + linhaDaMascara * lado, 20);
  const inicioDaMascara = 40 + lado * lado * 4;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const de = ((lado - 1 - y) * lado + x) * 4;
      const para = 40 + (y * lado + x) * 4;
      bmp[para] = rgba[de + 2];
      bmp[para + 1] = rgba[de + 1];
      bmp[para + 2] = rgba[de];
      bmp[para + 3] = rgba[de + 3];
      if (rgba[de + 3] === 0) bmp[inicioDaMascara + y * linhaDaMascara + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return bmp;
}

function arquivoIco(imagens) {
  const corpos = imagens.map((i) => (i.lado >= 256 ? i.png : bitmapDoIco(i)));
  const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(imagens.length, 4);
  let posicao = cabecalho.length;
  imagens.forEach((img, n) => {
    const o = 6 + 16 * n;
    cabecalho[o] = img.lado >= 256 ? 0 : img.lado;
    cabecalho[o + 1] = img.lado >= 256 ? 0 : img.lado;
    cabecalho.writeUInt16LE(1, o + 4);
    cabecalho.writeUInt16LE(32, o + 6);
    cabecalho.writeUInt32LE(corpos[n].length, o + 8);
    cabecalho.writeUInt32LE(posicao, o + 12);
    posicao += corpos[n].length;
  });
  return Buffer.concat([cabecalho, ...corpos]);
}

function arquivoIcns(entradas) {
  const blocos = entradas.map(([tipo, png]) => {
    const c = Buffer.alloc(8);
    c.write(tipo, 0, 'latin1');
    c.writeUInt32BE(8 + png.length, 4);
    return Buffer.concat([c, png]);
  });
  const c = Buffer.alloc(8);
  c.write('icns', 0, 'latin1');
  c.writeUInt32BE(8 + blocos.reduce((s, b) => s + b.length, 0), 4);
  return Buffer.concat([c, ...blocos]);
}

app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'icones-do-enfesto-')));
app
  .whenReady()
  .then(async () => {
    const janela = new BrowserWindow({ show: false });
    await janela.loadURL('about:blank');
    const windows = [];
    for (const lado of [16, 20, 24, 32, 40, 48, 64, 128, 256]) windows.push(await desenhar(janela, lado, lado <= 40 ? WINDOWS_PEQUENO : WINDOWS_GRANDE));
    const mac = new Map();
    for (const lado of [32, 64, 128, 256, 512, 1024]) mac.set(lado, await desenhar(janela, lado, MAC));
    fs.mkdirSync(PASTA, { recursive: true });
    fs.writeFileSync(path.join(PASTA, 'icon.ico'), arquivoIco(windows));
    const png = (lado) => mac.get(lado).png;
    fs.writeFileSync(path.join(PASTA, 'icon.icns'), arquivoIcns([['ic11', png(32)], ['ic12', png(64)], ['ic07', png(128)], ['ic08', png(256)], ['ic13', png(256)], ['ic09', png(512)], ['ic14', png(512)], ['ic10', png(1024)]]));
    if (PREVIA) {
      fs.mkdirSync(PREVIA, { recursive: true });
      for (const i of windows) fs.writeFileSync(path.join(PREVIA, `win-${i.lado}.png`), i.png);
      fs.writeFileSync(path.join(PREVIA, 'mac-512.png'), png(512));
    }
    console.log('ícones gerados em', PASTA);
    app.quit();
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
