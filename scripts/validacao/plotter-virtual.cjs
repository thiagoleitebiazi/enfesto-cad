/* global Buffer */
/*
 * O plotter virtual (ADR 0216): ouve numa porta, como um plotter de rede, e interpreta o que chega como a máquina faria.
 * De propósito, não usa nada do programa: as regras saem da definição do HP-GL e do ISO 6983, e o G-code passa por um
 * leitor de terceiros. Se o programa e este interpretador concordam, os dois leram a mesma coisa.
 */
const net = require('net');
const { parseStringSync } = require('gcode-parser');

/** 40 unidades por milímetro: o passo de 0,025 mm do HP-GL. */
const UNIDADES_POR_MM = 40;
/** O limite do HP-GL/2. Plotters antigos param em 32767 (82 cm): é avisado à parte. */
const MAIOR_COORDENADA = 8388607;
const LIMITE_ANTIGO = 32767;

function comandosDoHpgl(texto) {
  const comandos = [];
  let i = 0;
  let terminador = '\x03';
  while (i < texto.length) {
    const c = texto[i];
    if (c === ';' || c === '\n' || c === '\r' || c === ' ') {
      i++;
      continue;
    }
    const nome = texto.slice(i, i + 2).toUpperCase();
    i += 2;
    if (nome === 'LB') {
      const fim = texto.indexOf(terminador, i);
      if (fim < 0) {
        comandos.push({ nome, texto: texto.slice(i), semFim: true });
        break;
      }
      comandos.push({ nome, texto: texto.slice(i, fim) });
      i = fim + 1;
      continue;
    }
    if (nome === 'DT') {
      terminador = texto[i] || '\x03';
      i += 1;
      comandos.push({ nome, argumentos: [] });
      continue;
    }
    let fim = i;
    while (fim < texto.length && !/[A-Za-z;\n]/.test(texto[fim])) fim++;
    const argumentos = texto
      .slice(i, fim)
      .split(/[,\s]+/)
      .filter((a) => a !== '')
      .map(Number);
    comandos.push({ nome, argumentos });
    i = fim;
  }
  return comandos;
}

/** O risco como o plotter o faria: os traços com a caneta na ordem, em mm no papel. */
function interpretarHpgl(texto) {
  const r = { eventos: [], canetas: new Set(), desconhecidos: [], erros: [], maiorCoordenada: 0, passaDoLimiteAntigo: false };
  let x = 0;
  let y = 0;
  let descida = false;
  let caneta = 0;
  let relativo = false;
  let atual = null;
  const fechar = () => {
    if (atual && atual.pontos.length >= 2) r.eventos.push(atual);
    atual = null;
  };
  const andar = (nx, ny) => {
    for (const v of [nx, ny]) {
      if (!Number.isFinite(v)) r.erros.push(`coordenada inválida: ${v}`);
      else {
        r.maiorCoordenada = Math.max(r.maiorCoordenada, Math.abs(v));
        if (Math.abs(v) > MAIOR_COORDENADA) r.erros.push(`coordenada acima do limite: ${v}`);
        if (Math.abs(v) > LIMITE_ANTIGO) r.passaDoLimiteAntigo = true;
      }
    }
    if (descida) {
      if (caneta === 0) r.erros.push('desenho sem caneta na mão');
      if (!atual) atual = { tipo: 'traco', caneta, pontos: [{ x: x / UNIDADES_POR_MM, y: y / UNIDADES_POR_MM }] };
      atual.pontos.push({ x: nx / UNIDADES_POR_MM, y: ny / UNIDADES_POR_MM });
    }
    x = nx;
    y = ny;
  };
  const pares = (a, fazer) => {
    if (a.length % 2 !== 0) r.erros.push(`número ímpar de coordenadas: ${a.join(',')}`);
    for (let i = 0; i + 1 < a.length; i += 2) fazer(a[i], a[i + 1]);
  };
  for (const c of comandosDoHpgl(texto)) {
    switch (c.nome) {
      case 'IN':
        caneta = 0;
        break;
      case 'DT':
      case 'SI':
      case 'DI':
      case 'IW':
      case 'LT':
        break;
      case 'SP':
        fechar();
        caneta = c.argumentos[0] ?? 0;
        if (caneta > 0) r.canetas.add(caneta);
        break;
      case 'PA':
        relativo = false;
        pares(c.argumentos, andar);
        break;
      case 'PR':
        relativo = true;
        pares(c.argumentos, (dx, dy) => andar(x + dx, y + dy));
        break;
      case 'PU':
        descida = false;
        fechar();
        pares(c.argumentos, (a, b) => (relativo ? andar(x + a, y + b) : andar(a, b)));
        break;
      case 'PD':
        descida = true;
        pares(c.argumentos, (a, b) => (relativo ? andar(x + a, y + b) : andar(a, b)));
        break;
      case 'LB':
        fechar();
        if (c.semFim) r.erros.push('texto sem o terminador');
        r.eventos.push({ tipo: 'texto', caneta, texto: c.texto });
        break;
      default:
        r.desconhecidos.push(c.nome);
    }
  }
  fechar();
  if (caneta !== 0) r.erros.push('o plotter não guardou a caneta no fim');
  return r;
}

/** O ISO pela leitura de terceiros: os caminhos de cada ferramenta com ela no material (Z em 0), em mm. */
function interpretarIso(texto) {
  const r = { caminhos: [], palavras: new Set(), ferramentas: new Set(), erros: [], fim: false, milimetros: false, absoluto: false };
  let x = 0;
  let y = 0;
  let z = 5;
  let ferramenta = 0;
  let atual = null;
  const fechar = () => {
    if (atual && atual.pontos.length >= 2) r.caminhos.push(atual);
    atual = null;
  };
  for (const linha of parseStringSync(texto)) {
    const valor = (letra) => {
      const p = (linha.words || []).find((w) => w[0] === letra);
      return p ? p[1] : undefined;
    };
    const g = valor('G');
    const m = valor('M');
    const t = valor('T');
    if (g === 21) r.milimetros = true;
    if (g === 90) r.absoluto = true;
    if (m === 30) r.fim = true;
    if (t !== undefined) {
      fechar();
      ferramenta = t;
      r.ferramentas.add(t);
    }
    if (g === 0 || g === 1) {
      const nz = valor('Z');
      if (nz !== undefined) {
        z = nz;
        if (z > 0) fechar();
      }
      const nx = valor('X') ?? x;
      const ny = valor('Y') ?? y;
      if ((nx !== x || ny !== y) && z <= 0) {
        if (g === 0) r.erros.push('andou rápido com a ferramenta no material');
        if (!atual) atual = { ferramenta, pontos: [{ x, y }] };
        atual.pontos.push({ x: nx, y: ny });
      }
      x = nx;
      y = ny;
    }
  }
  fechar();
  if (z <= 0) r.erros.push('terminou com a ferramenta no material');
  return r;
}

/** Quanto a linha recebida se afasta da esperada (mm), ponto a ponto; `null` se não têm o mesmo número de pontos. */
function desvio(recebida, esperada) {
  const a = recebida[0] && recebida[recebida.length - 1] && recebida.length > esperada.length ? recebida.slice(0, esperada.length) : recebida;
  if (a.length !== esperada.length) return null;
  return Math.max(...a.map((p, i) => Math.hypot(p.x - esperada[i].x, p.y - esperada[i].y)));
}

/** O melhor encaixe da linha esperada entre as recebidas, em qualquer ponto de partida e nos dois sentidos. */
function melhorDesvio(recebidas, esperada) {
  let melhor = Infinity;
  const giros = (l) => l.map((_, i) => [...l.slice(i), ...l.slice(0, i)]);
  for (const linha of recebidas) {
    for (const opcao of [...giros(esperada), ...giros([...esperada].reverse())]) {
      const d = desvio(linha, opcao);
      if (d !== null) melhor = Math.min(melhor, d);
    }
  }
  return melhor;
}

function criarPlotterVirtual() {
  const plotter = { porta: 0, recebidos: [] };
  let servidor = null;
  plotter.ligar = (porta = 0) =>
    new Promise((resolver, rejeitar) => {
      servidor = net.createServer((conexao) => {
        const partes = [];
        conexao.on('data', (d) => partes.push(d));
        conexao.on('error', () => undefined);
        conexao.on('close', () => plotter.recebidos.push(Buffer.concat(partes).toString('latin1')));
      });
      servidor.once('error', rejeitar);
      servidor.listen(porta, '127.0.0.1', () => {
        plotter.porta = servidor.address().port;
        resolver(plotter);
      });
    });
  plotter.desligar = () => new Promise((resolver) => (servidor ? servidor.close(() => resolver()) : resolver()));
  return plotter;
}

module.exports = { UNIDADES_POR_MM, comandosDoHpgl, criarPlotterVirtual, interpretarHpgl, interpretarIso, melhorDesvio };
