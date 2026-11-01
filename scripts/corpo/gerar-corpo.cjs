// Gera src/domain/corpoHumano.dados.ts a partir dos arquivos do corpo aberto do MakeHuman (CC0, ADR 0229):
//   node scripts/corpo/gerar-corpo.cjs <pasta>
// A pasta tem, de https://github.com/makehumancommunity/makehuman (makehuman/data):
//   3dobjs/base.obj, rigs/default_weights.mhw, rigs/default.mhskel e
//   targets/macrodetails/caucasian-{female,male}-{young,child}.target
// Só o resultado fica no repositório. Fica de fora tudo o que não é o corpo: língua, dentes, cílios, cabelo e as caixas
// das juntas (estas só dão a posição das articulações).
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');

const pasta = process.argv[2];
if (!pasta) throw new Error('falta a pasta com os arquivos do corpo aberto');
const ler = (n) => fs.readFileSync(path.join(pasta, n), 'utf8');

// O OBJ: os pontos e as faces por grupo.
const pontos = [];
const faces = new Map();
let grupo = '';
for (const l of ler('base.obj').split(/\r?\n/)) {
  if (l.startsWith('v ')) {
    const p = l.split(/\s+/);
    pontos.push([+p[1], +p[2], +p[3]]);
  } else if (l.startsWith('g ')) grupo = l.slice(2).trim();
  else if (l.startsWith('f ')) {
    const f = l.trim().split(/\s+/).slice(1).map((s) => parseInt(s.split('/')[0], 10) - 1);
    if (f.length !== 4) throw new Error('face que não é quadrada');
    if (!faces.has(grupo)) faces.set(grupo, []);
    faces.get(grupo).push(f);
  }
}

// O corpo e os olhos: sem o globo, a órbita ficaria aberta.
const quadrados = [...faces.get('body'), ...faces.get('helper-l-eye'), ...faces.get('helper-r-eye')];
const novoNumero = new Map();
const usados = [];
for (let i = 0; i < 13380; i++) {
  novoNumero.set(i, usados.length);
  usados.push(i);
}
for (const f of quadrados) {
  for (const i of f) {
    if (!novoNumero.has(i)) {
      novoNumero.set(i, usados.length);
      usados.push(i);
    }
  }
}
const n = usados.length;

const alvo = (nome) => {
  const d = new Float64Array(pontos.length * 3);
  for (const l of ler(`${nome}.target`).split(/\r?\n/)) {
    if (!l || l.startsWith('#')) continue;
    const p = l.trim().split(/\s+/);
    const i = +p[0];
    d[3 * i] = +p[1];
    d[3 * i + 1] = +p[2];
    d[3 * i + 2] = +p[3];
  }
  return d;
};
const feminino = alvo('caucasian-female-young');
const masculino = alvo('caucasian-male-young');
const menina = alvo('caucasian-female-child');
const menino = alvo('caucasian-male-child');
const infantil = feminino.map((_, i) => (menina[i] + menino[i]) / 2);
const FORMAS = { feminino, masculino, infantil };

// Em décimos de mm (o arquivo é em decímetros).
const emInt16 = (v) => {
  const r = Math.round(v * 1000);
  if (r < -32768 || r > 32767) throw new Error('fora do Int16');
  return r;
};
const base64 = (tipado) => Buffer.from(tipado.buffer, tipado.byteOffset, tipado.byteLength).toString('base64');

const base = new Int16Array(n * 3);
usados.forEach((v, i) => {
  for (let k = 0; k < 3; k++) base[3 * i + k] = emInt16(pontos[v][k]);
});
const faceNova = new Uint16Array(quadrados.length * 4);
quadrados.forEach((f, q) => f.forEach((i, k) => (faceNova[4 * q + k] = novoNumero.get(i))));

const formas = {};
for (const [nome, d] of Object.entries(FORMAS)) {
  const a = new Int16Array(n * 3);
  usados.forEach((v, i) => {
    for (let k = 0; k < 3; k++) a[3 * i + k] = emInt16(d[3 * v + k]);
  });
  formas[nome] = base64(a);
}

// As juntas, em mm: a média dos oito cantos da caixa de cada uma, em cada forma.
const esqueleto = JSON.parse(ler('default.mhskel'));
const JUNTAS = {
  ombro: 'upperarm01.L____head',
  cotovelo: 'lowerarm01.L____head',
  punho: 'wrist.L____head',
  quadril: 'upperleg01.L____head',
  joelho: 'lowerleg01.L____head',
  tornozelo: 'foot.L____head',
  pescoco: 'neck01____head',
  cabeca: 'head____head',
};
const juntas = {};
for (const [nome, d] of Object.entries(FORMAS)) {
  juntas[nome] = {};
  for (const [j, ref] of Object.entries(JUNTAS)) {
    const cantos = esqueleto.joints[ref];
    if (!cantos) throw new Error(`sem a junta ${ref}`);
    const m = [0, 1, 2].map((k) => (cantos.reduce((s, i) => s + pontos[i][k] + d[3 * i + k], 0) / cantos.length) * 100);
    juntas[nome][j] = m.map((x) => Math.round(x * 10) / 10);
  }
}

// Os pesos: cada ponto com até três grupos. 0 é o tronco; de 1 a 6, o lado esquerdo; de 7 a 12, o direito.
const GRUPOS = [
  [/^upperarm0[12]\./, 1],
  [/^lowerarm0[12]\./, 2],
  [/^(wrist|finger|metacarpal)/, 3],
  [/^upperleg0[12]\./, 4],
  [/^lowerleg0[12]\./, 5],
  [/^(foot|toe)/, 6],
];
const grupoDoOsso = (osso) => {
  for (const [re, g] of GRUPOS) if (re.test(osso)) return osso.endsWith('.R') ? g + 6 : g;
  return 0;
};
const { weights } = JSON.parse(ler('default_weights.mhw'));
const porPonto = new Map();
for (const [osso, lista] of Object.entries(weights)) {
  const g = grupoDoOsso(osso);
  for (const [v, peso] of lista) {
    if (!novoNumero.has(v)) continue;
    const i = novoNumero.get(v);
    if (!porPonto.has(i)) porPonto.set(i, new Map());
    const m = porPonto.get(i);
    m.set(g, (m.get(g) ?? 0) + peso);
  }
}
const pesos = new Uint8Array(n * 6);
let semPeso = 0;
for (let i = 0; i < n; i++) {
  const m = porPonto.get(i);
  if (!m) {
    semPeso++;
    pesos[6 * i + 3] = 255;
    continue;
  }
  const lista = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const soma = lista.reduce((s, [, p]) => s + p, 0);
  let resto = 255;
  lista.forEach(([g, p], k) => {
    const v = k === lista.length - 1 ? resto : Math.round((p / soma) * 255);
    pesos[6 * i + k] = g;
    pesos[6 * i + 3 + k] = v;
    resto -= v;
  });
}

const fatias = (s) => s.match(/.{1,4000}/g).map((p) => `  '${p}',`).join('\n');
const saida = `// Gerado por scripts/corpo/gerar-corpo.cjs: não edite à mão.
// O corpo aberto do MakeHuman, liberado pelos autores em CC0 1.0 (domínio público): a malha, as formas e os pesos.
// Copyright dos autores até a liberação: Data Collection AB, Joel Palmius, Jonas Hauquier, Manuel Bastioni (ADR 0229).
export const PONTOS_DO_CORPO = ${n};
export const FACES_DO_CORPO = ${quadrados.length};
export const JUNTAS_DO_CORPO = ${JSON.stringify(juntas)} as const;
export const BASE_DO_CORPO = [
${fatias(base64(base))}
].join('');
export const QUADRADOS_DO_CORPO = [
${fatias(base64(faceNova))}
].join('');
export const PESOS_DO_CORPO = [
${fatias(base64(pesos))}
].join('');
export const FORMAS_DO_CORPO = {
${Object.entries(formas).map(([nome, b]) => `  ${nome}: [\n${fatias(b)}\n  ].join(''),`).join('\n')}
} as const;
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'src', 'domain', 'corpoHumano.dados.ts'), saida);
console.log(JSON.stringify({ n, faces: quadrados.length, semPeso, kb: Math.round(saida.length / 1024) }));
console.log(JSON.stringify(juntas));
