/* global Buffer */
/*
 * A mesa de corte virtual (ADR 0216, 0225): ouve numa porta, como uma máquina de rede, e interpreta o G-code que chega.
 * De propósito, não usa nada do programa: as regras saem do ISO 6983, e o G-code passa por um leitor de terceiros. Se o
 * programa e este interpretador concordam, os dois leram a mesma coisa.
 */
const net = require('net');
const { parseStringSync } = require('gcode-parser');

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

function criarMesaVirtual() {
  const mesa = { porta: 0, recebidos: [] };
  let servidor = null;
  mesa.ligar = (porta = 0) =>
    new Promise((resolver, rejeitar) => {
      servidor = net.createServer((conexao) => {
        const partes = [];
        conexao.on('data', (d) => partes.push(d));
        conexao.on('error', () => undefined);
        conexao.on('close', () => mesa.recebidos.push(Buffer.concat(partes).toString('latin1')));
      });
      servidor.once('error', rejeitar);
      servidor.listen(porta, '127.0.0.1', () => {
        mesa.porta = servidor.address().port;
        resolver(mesa);
      });
    });
  mesa.desligar = () => new Promise((resolver) => (servidor ? servidor.close(() => resolver()) : resolver()));
  return mesa;
}

module.exports = { criarMesaVirtual, interpretarIso, melhorDesvio };
