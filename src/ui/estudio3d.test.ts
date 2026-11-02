import { describe, expect, it } from 'vitest';
import { cameraDeFrente, projecao, vistaDaProjecao } from './cena3d';
import { mapaDaPeca } from './lotesDoTecido';
import { franzidoDaCostura, peNaInclinacao } from './estudio3d';
import { enfraquece, faixasDaImagem, opacidadeDoTecido, QUALIDADE_FINAL, QUALIDADE_RAPIDA, renderizarEstudio, type FundoDoEstudio, type LoteDoEstudio, type MaterialDoEstudio, type QualidadeDoEstudio } from './estudio3d';

const ALTURA = 1700;
const L = 160;

/** Uma esfera de 30 cm na altura do peito: tem faces em todas as direções. */
function esfera(material: MaterialDoEstudio, cz = 0, raio = 300, extra: Partial<LoteDoEstudio> = {}): LoteDoEstudio {
  const p: number[] = [];
  const n: number[] = [];
  const uv: number[] = [];
  const t: number[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const a = (Math.PI * i) / N;
      const f = (2 * Math.PI * j) / N;
      const [x, y, z] = [Math.sin(a) * Math.sin(f), Math.cos(a), Math.sin(a) * Math.cos(f)];
      p.push(raio * x, 900 + raio * y, cz + raio * z);
      n.push(x, y, z);
      uv.push(raio * f, raio * a);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j;
      t.push(a, a + N + 1, a + N + 2, a, a + N + 2, a + 1);
    }
  }
  return { posicoes: Float32Array.from(p), normais: Float32Array.from(n), uv: Float32Array.from(uv), indices: Uint32Array.from(t), material, ...extra };
}

const vista = (largura = L, altura = L) => vistaDaProjecao(projecao(cameraDeFrente(ALTURA), largura, altura), ALTURA);
const render = (lotes: readonly LoteDoEstudio[], q: QualidadeDoEstudio = QUALIDADE_RAPIDA, fundo: FundoDoEstudio = 'estudio') => renderizarEstudio(vista(), lotes, q, fundo);
const pixel = (rgba: Uint8ClampedArray, x: number, y: number): [number, number, number] => [rgba[4 * (y * L + x)]!, rgba[4 * (y * L + x) + 1]!, rgba[4 * (y * L + x) + 2]!];
/** O ponto mais claro no meio da imagem, onde só há a esfera. */
const brilhoMaximo = (rgba: Uint8ClampedArray): number => {
  let m = 0;
  for (let y = Math.round(L * 0.38); y < L * 0.58; y++) {
    for (let x = Math.round(L * 0.4); x < L * 0.6; x++) m = Math.max(m, ...pixel(rgba, x, y));
  }
  return m;
};

const TECIDO: MaterialDoEstudio = { acabamento: 'tecido', cor: [60, 90, 160], trama: 'plana' };
const MEIO = L / 2;

describe('o estúdio: a imagem calculada ponto a ponto (ADR 0228)', () => {
  it('a esfera aparece no meio com a cor do tecido, e o fundo fica em volta', () => {
    const rgba = render([esfera(TECIDO)]);
    const [r, g, b] = pixel(rgba, MEIO, Math.round(L * 0.48));
    // A cor continua sendo a escolhida: azul, com o vermelho e o verde na mesma ordem.
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    const canto = pixel(rgba, 3, 3);
    expect(Math.min(...canto)).toBeGreaterThan(190);
  });

  it('a esfera da frente esconde a de trás, em qualquer ordem dos lotes', () => {
    const frente = esfera({ acabamento: 'corpo', cor: [200, 30, 30] }, 300, 150);
    const atras = esfera({ acabamento: 'corpo', cor: [30, 200, 30] }, -300, 300);
    for (const lotes of [[frente, atras], [atras, frente]]) {
      const [r, g] = pixel(render(lotes), MEIO, Math.round(L * 0.48));
      expect(r).toBeGreaterThan(g);
    }
  });

  it('no fundo branco, longe da figura, o pixel é branco de verdade; perto dos pés, a sombra escurece o chão', () => {
    const rgba = render([esfera(TECIDO, 0, 150)], QUALIDADE_RAPIDA, 'branco');
    expect(pixel(rgba, 2, 2)).toEqual([255, 255, 255]);
    // Com um corpo que toca o chão, ele deixa uma sombra de contato em volta.
    const noChao: LoteDoEstudio = { ...esfera(TECIDO, 0, 150), posicoes: esfera(TECIDO, 0, 150).posicoes.map((v, i) => (i % 3 === 1 ? v - 760 : v)) };
    const comSombra = render([noChao], QUALIDADE_RAPIDA, 'branco');
    const proj = projecao(cameraDeFrente(ALTURA), L, L);
    const pe = proj.projetar(190, 0, 0)!;
    expect(pixel(comSombra, Math.round(pe.sx), Math.round(pe.sy))[0]).toBeLessThan(250);
  });

  it('mais brilho: o reflexo fica mais forte; pintado pela tensão, nenhum reflexo do tecido', () => {
    const fosco = brilhoMaximo(render([esfera(TECIDO)]));
    const lustroso = brilhoMaximo(render([esfera({ ...TECIDO, brilho: 1 })]));
    expect(lustroso).toBeGreaterThan(fosco);
    const pintado: LoteDoEstudio = esfera({ ...TECIDO, brilho: 1 }, 0, 300, { coresDosTriangulos: new Uint8Array(40 * 40 * 2 * 3).fill(120) });
    expect(brilhoMaximo(render([pintado]))).toBeLessThan(lustroso);
  });

  it('o cetim tem a luz esticada na direção do fio: difere do tecido liso de mesmo brilho', () => {
    const liso = render([esfera({ ...TECIDO, brilho: 0.8 })], QUALIDADE_FINAL);
    const cetim = render([esfera({ ...TECIDO, brilho: 0.8, trama: 'cetim' })], QUALIDADE_FINAL);
    let diferenca = 0;
    for (let i = 0; i < liso.length; i += 4) diferenca += Math.abs(liso[i]! - cetim[i]!);
    expect(diferenca).toBeGreaterThan(500);
  });

  it('a transparência: o corpo aparece através do pano; o mais transparente guarda 15% da cor', () => {
    expect(opacidadeDoTecido(0)).toBe(1);
    expect(opacidadeDoTecido(1)).toBeCloseTo(0.15, 9);
    // Pouca transparência quase não aparece: o pano fino sobre o corpo não vira uma película.
    expect(opacidadeDoTecido(0.1)).toBeGreaterThan(0.96);
    const corpo = esfera({ acabamento: 'corpo', cor: [240, 240, 240] }, -40, 200);
    const pano = esfera({ ...TECIDO, cor: [20, 20, 20] }, 0, 300);
    const opaco = pixel(render([corpo, pano]), MEIO, Math.round(L * 0.48));
    const fino = pixel(render([corpo, esfera({ ...TECIDO, cor: [20, 20, 20], transparencia: 0.8 }, 0, 300)]), MEIO, Math.round(L * 0.48));
    expect(fino[0]).toBeGreaterThan(opaco[0] + 20);
  });

  it('a estampa vai pela face da peça: a corrida repete, com a cor da imagem', () => {
    const rgba = new Uint8ClampedArray(4 * 4).fill(255);
    for (let i = 0; i < 4; i++) {
      rgba[4 * i] = 250;
      rgba[4 * i + 1] = 20;
      rgba[4 * i + 2] = 20;
    }
    const estampa = { largura: 2, altura: 2, rgba, larguraMm: 200, modo: 'corrida' as const, alturaMm: 0 };
    const [r, , b] = pixel(render([esfera({ ...TECIDO, estampa })]), MEIO, Math.round(L * 0.48));
    expect(r).toBeGreaterThan(b);
  });

  it('a oclusão escurece o rego entre dois volumes', () => {
    const a = esfera({ acabamento: 'corpo', cor: [220, 220, 220] }, 0, 200);
    const b = esfera({ acabamento: 'corpo', cor: [220, 220, 220] }, 0, 200);
    const juntos = [
      { ...a, posicoes: a.posicoes.map((v, i) => (i % 3 === 0 ? v - 200 : v)) },
      { ...b, posicoes: b.posicoes.map((v, i) => (i % 3 === 0 ? v + 200 : v)) },
    ];
    const com = render(juntos, QUALIDADE_FINAL);
    const sem = render(juntos, { ...QUALIDADE_FINAL, amostrasDeOclusao: 0 });
    const rego = projecao(cameraDeFrente(ALTURA), L, L).projetar(0, 900, 60)!;
    expect(pixel(com, Math.round(rego.sx), Math.round(rego.sy))[0]).toBeLessThan(pixel(sem, Math.round(rego.sx), Math.round(rego.sy))[0]);
  });

  it('a costura faz um sulco no pano; a barra livre leva o pesponto, que aparece de perto', () => {
    // Um pano de 400 mm em pé, de frente para a câmera, que enche a imagem. O contorno é o retângulo dele.
    const pano = (material: MaterialDoEstudio): LoteDoEstudio => {
      const p: number[] = [];
      const uv: number[] = [];
      const t: number[] = [];
      const N = 40;
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          p.push(-200 + 10 * i, 700 + 10 * j, 100);
          uv.push(-200 + 10 * i, 700 + 10 * j);
        }
      }
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const a = j * (N + 1) + i;
          t.push(a, a + 1, a + N + 2, a, a + N + 2, a + N + 1);
        }
      }
      return { posicoes: Float32Array.from(p), normais: new Float32Array(p.length).map((_, i) => (i % 3 === 2 ? 1 : 0)), uv: Float32Array.from(uv), indices: Uint32Array.from(t), material };
    };
    const contorno = [-200, 700, 200, 700, 200, 1100, -200, 1100];
    // O lado de baixo livre (o primeiro) e o da direita costurado (o segundo).
    const mapa = mapaDaPeca(contorno, [0, 1, 0, 0]);
    const camera = { ...cameraDeFrente(ALTURA), arfagem: 0, distancia: 600, alvo: { x: 170, y: 760, z: 100 } };
    const LADO = 320;
    const proj = projecao(camera, LADO, LADO);
    const imagem = (m: MaterialDoEstudio): Uint8ClampedArray => renderizarEstudio(vistaDaProjecao(proj, ALTURA), [pano(m)], QUALIDADE_FINAL);
    const ponto = (x: number, y: number): number => {
      const q = proj.projetar(x, y, 100)!;
      return Math.round(q.sy) * LADO + Math.round(q.sx);
    };
    const base = { acabamento: 'tecido', cor: [170, 150, 110] } as const;
    const liso = imagem(base);
    const com = imagem({ ...base, mapa });
    const media = (r: Uint8ClampedArray, x: number, y: number): number => r[4 * ponto(x, y)]!;
    // Na costura, um sulco escuro; longe das bordas, nada muda.
    expect(media(com, 198.5, 800)).toBeLessThan(media(liso, 198.5, 800) - 8);
    expect(Math.abs(media(com, 100, 800) - media(liso, 100, 800))).toBeLessThan(4);
    // A borda livre: a linha do pesponto, a 15 mm dela, muda o pano ali.
    let mudou = 0;
    for (let x = 60; x < 170; x += 2) mudou += Math.abs(media(com, x, 715) - media(liso, x, 715));
    expect(mudou).toBeGreaterThan(100);
  });

  it('o pano apertado enruga no desenho; sem aperto, nada muda', () => {
    const lote = esfera(TECIDO, 0, 300);
    const pontos = lote.posicoes.length / 3;
    const rugas = new Float32Array(pontos * 2);
    for (let i = 0; i < pontos; i++) rugas[2 * i] = 1;
    const liso = render([lote], QUALIDADE_FINAL);
    const semAperto = render([{ ...lote, rugas: new Float32Array(pontos * 2), material: { ...TECIDO, rugaMm: 12 } }], QUALIDADE_FINAL);
    const apertado = render([{ ...lote, rugas, material: { ...TECIDO, rugaMm: 12 } }], QUALIDADE_FINAL);
    expect(semAperto).toEqual(liso);
    let diferenca = 0;
    for (let i = 0; i < liso.length; i += 4) diferenca += Math.abs(liso[i]! - apertado[i]!);
    expect(diferenca).toBeGreaterThan(300);
  });

  it('a trama só aparece com folga: perto do tamanho do pixel ela viraria ondas na imagem', () => {
    expect(enfraquece(1, 0.2)).toBe(1);
    expect(enfraquece(1, 0.25)).toBe(1);
    expect(enfraquece(1, 0.4)).toBeCloseTo(0.4, 9);
    expect(enfraquece(1, 0.5)).toBe(0);
    expect(enfraquece(1, 2)).toBe(0);
  });

  it('dividida em faixas, a imagem sai igual à inteira, ponto a ponto, sem emendas', () => {
    const lotes = [esfera({ acabamento: 'corpo', cor: [200, 190, 180] }, 0, 260), esfera(TECIDO, 120, 170)];
    const inteira = render(lotes, QUALIDADE_FINAL);
    const faixas = faixasDaImagem(L, 3);
    expect(faixas[0]!.de).toBe(0);
    expect(faixas[2]!.ate).toBe(L);
    expect(faixas[1]!.de).toBe(faixas[0]!.ate);
    const junta = new Uint8ClampedArray(inteira.length);
    for (const f of faixas) {
      const parte = renderizarEstudio(vista(), lotes, QUALIDADE_FINAL, 'estudio', f);
      expect(parte.length).toBe((f.ate - f.de) * L * 4);
      junta.set(parte, f.de * L * 4);
    }
    expect(junta).toEqual(inteira);
  });

  it('as faixas nunca passam do número de linhas, e cobrem todas', () => {
    expect(faixasDaImagem(3, 8)).toHaveLength(3);
    expect(faixasDaImagem(100, 1)).toEqual([{ de: 0, ate: 100 }]);
  });

  it('uma superfície curva não faz sombra em si mesma: a imagem rápida coincide com a final, sem degraus', () => {
    const lotes = [esfera({ acabamento: 'corpo', cor: [214, 208, 200] }, 0, 300)];
    const rapida = render(lotes);
    const final = render(lotes, QUALIDADE_FINAL);
    // No meio da esfera, a mesma luz nas duas: a sombra só entra onde há mesmo quem a faça.
    const y = Math.round(L * 0.46);
    for (let x = Math.round(L * 0.4); x < L * 0.6; x++) expect(Math.abs(pixel(rapida, x, y)[0] - pixel(final, x, y)[0])).toBeLessThan(5);
  });

  it('a mesma cena dá a mesma imagem (o ruído é fixo: a tela não treme parada)', () => {
    const lotes = [esfera(TECIDO)];
    expect(render(lotes, QUALIDADE_FINAL)).toEqual(render(lotes, QUALIDADE_FINAL));
  });
});

describe('a trama no pano de lado (ADR 0235)', () => {
  it('quanto mais de lado, mais pano num pixel: a trama apaga antes de virar pontilhado', () => {
    expect(peNaInclinacao(0.2, 1)).toBeCloseTo(0.2, 9);
    expect(peNaInclinacao(0.2, -0.5)).toBeCloseTo(0.4, 9);
    expect(enfraquece(1, peNaInclinacao(0.2, 0.3))).toBeLessThan(enfraquece(1, peNaInclinacao(0.2, 1)));
    expect(Number.isFinite(peNaInclinacao(0.2, 0))).toBe(true);
  });
});

describe('o franzido ao lado da costura (ADR 0234)', () => {
  it('não repete: uma onda de 7 em 7 mm parecia uma fileira de pontinhos de perto', () => {
    let soma = 0;
    let maior = 0;
    for (let s = 0; s < 700; s++) {
      soma += Math.abs(franzidoDaCostura(s) - franzidoDaCostura(s + 7));
      maior = Math.max(maior, Math.abs(franzidoDaCostura(s)));
    }
    expect(soma / 700).toBeGreaterThan(0.3);
    expect(maior).toBeLessThanOrEqual(1);
  });
});
