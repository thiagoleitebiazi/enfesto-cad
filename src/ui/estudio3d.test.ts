import { describe, expect, it } from 'vitest';
import { cameraDeFrente, projecao, vistaDaProjecao } from './cena3d';
import { opacidadeDoTecido, QUALIDADE_FINAL, QUALIDADE_RAPIDA, renderizarEstudio, type FundoDoEstudio, type LoteDoEstudio, type MaterialDoEstudio, type QualidadeDoEstudio } from './estudio3d';

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

const vista = (largura = L, altura = L) => vistaDaProjecao(projecao(cameraDeFrente(ALTURA), largura, altura, ALTURA), ALTURA);
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
    const proj = projecao(cameraDeFrente(ALTURA), L, L, ALTURA);
    const pe = proj.projetar(0, 0, 250)!;
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

  it('com oclusão e sombra, um rego entre dois volumes fica mais escuro que o volume', () => {
    const a = esfera({ acabamento: 'corpo', cor: [220, 220, 220] }, 0, 200);
    const b = esfera({ acabamento: 'corpo', cor: [220, 220, 220] }, 0, 200);
    const juntos = [
      { ...a, posicoes: a.posicoes.map((v, i) => (i % 3 === 0 ? v - 200 : v)) },
      { ...b, posicoes: b.posicoes.map((v, i) => (i % 3 === 0 ? v + 200 : v)) },
    ];
    const r = render(juntos, QUALIDADE_FINAL);
    const proj = projecao(cameraDeFrente(ALTURA), L, L, ALTURA);
    const rego = proj.projetar(0, 900, 60)!;
    const volume = proj.projetar(-200, 900, 200)!;
    expect(pixel(r, Math.round(rego.sx), Math.round(rego.sy))[0]).toBeLessThan(pixel(r, Math.round(volume.sx), Math.round(volume.sy))[0]);
  });

  it('a mesma cena dá a mesma imagem (o ruído é fixo: a tela não treme parada)', () => {
    const lotes = [esfera(TECIDO)];
    expect(render(lotes, QUALIDADE_FINAL)).toEqual(render(lotes, QUALIDADE_FINAL));
  });
});
