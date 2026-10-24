import { describe, expect, it } from 'vitest';
import type { Ponto2D } from '../core/geometria';
import { area, pontoDentroDoContorno } from '../core/geometria';
import {
  aplicarHomografia,
  eixoPrincipal,
  encostaNaBorda,
  escalarReconhecido,
  homografia,
  limiarDeOtsu,
  mascaraDoMolde,
  medidasDoContorno,
  OPCOES_PADRAO_DO_RECONHECIMENTO,
  paraODesenho,
  piquesDoContorno,
  reconhecerMolde,
  redondeza,
  regiaoNoPonto,
  retificar,
  tonsDeCinza,
  voltasDaRegiao,
  type ImagemDePixels,
  type Quadrilatero,
} from './digitalizacao';

const pt = (x: number, y: number): Ponto2D => ({ x, y });

/** Uma imagem de um tom só. */
function imagem(largura: number, altura: number, tom: number): ImagemDePixels {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) {
    dados[i * 4] = dados[i * 4 + 1] = dados[i * 4 + 2] = tom;
    dados[i * 4 + 3] = 255;
  }
  return { largura, altura, dados };
}

/** Pinta os pixels cujo centro cai dentro do polígono (em pixels). */
function pintar(img: ImagemDePixels, poligono: readonly Ponto2D[], tom: number): void {
  for (let y = 0; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      if (pontoDentroDoContorno(pt(x + 0.5, y + 0.5), poligono)) {
        const o = (y * img.largura + x) * 4;
        img.dados[o] = img.dados[o + 1] = img.dados[o + 2] = tom;
      }
    }
  }
}

const circulo = (cx: number, cy: number, r: number, lados = 48): Ponto2D[] => Array.from({ length: lados }, (_, i) => pt(cx + r * Math.cos((2 * Math.PI * i) / lados), cy + r * Math.sin((2 * Math.PI * i) / lados)));
const retangulo = (x: number, y: number, l: number, a: number): Ponto2D[] => [pt(x, y), pt(x + l, y), pt(x + l, y + a), pt(x, y + a)];

/**
 * O molde do teste, em mm: um papel de 100 × 150 com um pique em V no lado de cima (em x = 50: 4 mm de abertura, 4 mm
 * de fundo), um furo de 8 mm de diâmetro em (30, 40) e o traço do fio de (50, 30) a (50, 120), com 1 mm de espessura.
 */
const PAPEL: Ponto2D[] = [pt(0, 0), pt(48, 0), pt(50, 4), pt(52, 0), pt(100, 0), pt(100, 150), pt(0, 150)];
const FURO = circulo(30, 40, 4);
const FIO = retangulo(49.5, 30, 1, 90);

/** O molde pintado numa imagem a `mmPorPx`, com uma margem de 20 mm, papel claro (220) sobre fundo escuro (60). */
function fotoDeCima(mmPorPx: number): ImagemDePixels {
  const margem = 20;
  const img = imagem(Math.round(140 / mmPorPx), Math.round(190 / mmPorPx), 60);
  const px = (p: Ponto2D): Ponto2D => pt((p.x + margem) / mmPorPx, (p.y + margem) / mmPorPx);
  pintar(img, PAPEL.map(px), 220);
  pintar(img, FURO.map(px), 60);
  pintar(img, FIO.map(px), 40);
  return img;
}

const opcoes = (mmPorPx: number) => ({ ...OPCOES_PADRAO_DO_RECONHECIMENTO, mmPorPx, limiar: 140 });

describe('a digitalização — a perspectiva', () => {
  it('a homografia leva os cantos aos cantos, e o meio de um quadrado ao cruzamento das diagonais', () => {
    const de: Quadrilatero = [pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)];
    const para: Quadrilatero = [pt(10, 20), pt(210, 40), pt(190, 230), pt(30, 200)];
    const h = homografia(de, para);
    de.forEach((p, i) => {
      const q = aplicarHomografia(h, p);
      expect(q.x).toBeCloseTo(para[i]!.x, 6);
      expect(q.y).toBeCloseTo(para[i]!.y, 6);
    });
    expect(() => homografia(de, [pt(0, 0), pt(1, 1), pt(2, 2), pt(3, 3)])).toThrow(/não formam um quadrilátero/);
  });

  it('retificar: o quadrado preto de uma placa fotografada torta volta ao lugar, em escala', () => {
    // Uma placa de 200 × 100 mm, fotografada em perspectiva, com um quadrado preto de 20 mm em (150, 40).
    const cantos: Quadrilatero = [pt(40, 30), pt(420, 60), pt(400, 300), pt(60, 260)];
    const h = homografia([pt(0, 0), pt(200, 0), pt(200, 100), pt(0, 100)], cantos);
    const foto = imagem(460, 340, 90);
    pintar(foto, [pt(0, 0), pt(200, 0), pt(200, 100), pt(0, 100)].map((p) => aplicarHomografia(h, p)), 230);
    pintar(foto, retangulo(150, 40, 20, 20).map((p) => aplicarHomografia(h, p)), 10);
    const plana = retificar(foto, cantos, 200, 100, 1);
    expect([plana.largura, plana.altura]).toEqual([200, 100]);
    const tom = (x: number, y: number) => plana.dados[(y * plana.largura + x) * 4]!;
    expect(tom(160, 50)).toBeLessThan(40);
    expect(tom(140, 50)).toBeGreaterThan(200);
    expect(tom(160, 70)).toBeGreaterThan(200);
    expect(tom(5, 5)).toBeGreaterThan(200);
  });
});

describe('a digitalização — a separação e o contorno', () => {
  it('o limiar de Otsu fica entre os dois tons; a máscara e a região do clique', () => {
    const img = imagem(20, 10, 50);
    pintar(img, retangulo(5, 2, 8, 5), 200);
    const cinza = tonsDeCinza(img);
    const t = limiarDeOtsu(cinza);
    expect(t).toBeGreaterThanOrEqual(50);
    expect(t).toBeLessThan(200);
    const m = mascaraDoMolde(cinza, t, false);
    const r = regiaoNoPonto(m, 20, 10, 8, 4)!;
    expect(r.reduce((s, v) => s + v, 0)).toBe(40);
    expect(encostaNaBorda(r, 20, 10)).toBe(false);
    expect(regiaoNoPonto(m, 20, 10, 1, 1)).toBeNull();
    expect(encostaNaBorda(regiaoNoPonto(mascaraDoMolde(cinza, t, true), 20, 10, 1, 1)!, 20, 10)).toBe(true);
  });

  it('o contorno pelas bordas dos pixels: um bloco de 3 × 2 tem a área 6; com um buraco, duas voltas; em diagonal não se liga', () => {
    const regiao = new Uint8Array(5 * 4);
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]]) regiao[y! * 5 + x!] = 1;
    const [volta] = voltasDaRegiao(regiao, 5, 4);
    expect(area(volta!)).toBe(6);
    expect(volta).toHaveLength(4);
    const anel = new Uint8Array(5 * 5);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) anel[y * 5 + x] = x === 2 && y === 2 ? 0 : 1;
    const voltas = voltasDaRegiao(anel, 5, 5).map((v) => area(v)).sort((a, b) => b - a);
    expect(voltas).toEqual([9, 1]);
    const diagonal = new Uint8Array([1, 0, 0, 1]);
    expect(regiaoNoPonto(diagonal, 2, 2, 0, 0)!.reduce((s, v) => s + v, 0)).toBe(1);
  });

  it('a redondeza e o eixo principal', () => {
    expect(redondeza(circulo(0, 0, 10))).toBeGreaterThan(0.95);
    expect(redondeza(retangulo(0, 0, 100, 1))).toBeLessThan(0.05);
    const eixo = eixoPrincipal(retangulo(0, 0, 100, 2))!;
    expect(eixo.comprimento).toBeCloseTo(100, 6);
    expect(eixo.espessura).toBeCloseTo(2, 6);
  });

  it('o pique em V vira um pique no meio da abertura; a saliência não', () => {
    const r = piquesDoContorno(PAPEL, { aberturaMaxMm: 12, profundidadeMinMm: 1.5, profundidadeMaxMm: 15 });
    expect(r.contorno).toHaveLength(6);
    expect(r.piques).toEqual([{ posicao: pt(50, 0), indiceAresta: 1 }]);
    const comSaliencia = [pt(0, 0), pt(48, 0), pt(50, -4), pt(52, 0), pt(100, 0), pt(100, 150), pt(0, 150)];
    expect(piquesDoContorno(comSaliencia, { aberturaMaxMm: 12, profundidadeMinMm: 1.5, profundidadeMaxMm: 15 }).piques).toEqual([]);
  });
});

describe('a digitalização — o reconhecimento inteiro', () => {
  it('foto de cima a 0,5 mm/px: o contorno de 100 × 150, o furo, o fio e o pique', () => {
    const r = reconhecerMolde(fotoDeCima(0.5), pt(60, 300), opcoes(0.5));
    if ('erro' in r) throw new Error(r.erro);
    const m = medidasDoContorno(r.contorno);
    expect(m.largura).toBeCloseTo(100, 0);
    expect(m.altura).toBeCloseTo(150, 0);
    expect(r.furos).toHaveLength(1);
    expect(area(r.furos[0]!)).toBeGreaterThan(Math.PI * 16 * 0.85);
    expect(area(r.furos[0]!)).toBeLessThan(Math.PI * 16 * 1.15);
    expect(r.fio).not.toBeNull();
    const comprimentoDoFio = Math.hypot(r.fio!.fim.x - r.fio!.inicio.x, r.fio!.fim.y - r.fio!.inicio.y);
    expect(comprimentoDoFio).toBeGreaterThan(88);
    expect(comprimentoDoFio).toBeLessThan(92);
    expect(Math.abs(r.fio!.fim.x - r.fio!.inicio.x)).toBeLessThan(1);
    expect(r.piques).toHaveLength(1);
    expect(r.piques[0]!.posicao.x).toBeCloseTo(70, 0);
    expect(r.piques[0]!.posicao.y).toBeCloseTo(20, 0);
    expect(r.avisos).toEqual([]);
  });

  it('pela foto em perspectiva: corrigida pelos cantos da placa, as medidas batem (até 1%)', () => {
    // A placa de 140 × 190 mm (o molde a 20 mm das bordas), fotografada torta; o molde pintado com os pontos projetados.
    const cantos: Quadrilatero = [pt(60, 40), pt(520, 80), pt(560, 690), pt(30, 640)];
    const h = homografia([pt(0, 0), pt(140, 0), pt(140, 190), pt(0, 190)], cantos);
    const foto = imagem(600, 720, 100);
    const projetar = (p: Ponto2D) => aplicarHomografia(h, pt(p.x + 20, p.y + 20));
    pintar(foto, [pt(0, 0), pt(140, 0), pt(140, 190), pt(0, 190)].map((p) => aplicarHomografia(h, p)), 60);
    pintar(foto, PAPEL.map(projetar), 220);
    pintar(foto, FURO.map(projetar), 60);
    pintar(foto, FIO.map(projetar), 40);
    const plana = retificar(foto, cantos, 140, 190, 0.5);
    const r = reconhecerMolde(plana, pt(60 / 0.5, 150 / 0.5), opcoes(0.5));
    if ('erro' in r) throw new Error(r.erro);
    const m = medidasDoContorno(r.contorno);
    expect(Math.abs(m.largura - 100)).toBeLessThan(1);
    expect(Math.abs(m.altura - 150)).toBeLessThan(1.5);
    expect(r.furos).toHaveLength(1);
    expect(r.fio).not.toBeNull();
  });

  it('o clique fora do molde, e a região que encosta na borda (o fundo)', () => {
    const foto = fotoDeCima(1);
    expect(reconhecerMolde(foto, pt(2, 2), opcoes(1))).toEqual({ erro: expect.stringMatching(/O clique não caiu no molde/) });
    const fundo = reconhecerMolde(foto, pt(2, 2), { ...opcoes(1), moldeEscuro: true });
    if ('erro' in fundo) throw new Error(fundo.erro);
    expect(fundo.avisos[0]).toMatch(/encosta na borda/);
  });

  it('a escala conferida e a passagem para o desenho (o x da imagem vira o y do mundo)', () => {
    const r = reconhecerMolde(fotoDeCima(1), pt(60, 100), { ...opcoes(1), sugerirFio: false, procurarPiques: false });
    if ('erro' in r) throw new Error(r.erro);
    const dobro = escalarReconhecido(r, 2);
    expect(medidasDoContorno(dobro.contorno).largura).toBeCloseTo(200, 0);
    const noDesenho = paraODesenho(r, pt(10, 500));
    const m = medidasDoContorno(noDesenho.contorno);
    expect(m.largura).toBeCloseTo(150, 0);
    expect(m.altura).toBeCloseTo(100, 0);
    expect(Math.min(...noDesenho.contorno.map((p) => p.x))).toBeCloseTo(10, 6);
    expect(Math.min(...noDesenho.contorno.map((p) => p.y))).toBeCloseTo(500, 6);
  });
});

describe('a digitalização — vários moldes na mesma foto', () => {
  it('cada clique separa o molde dele (os outros papéis da foto não entram)', () => {
    const img = imagem(300, 200, 60);
    pintar(img, retangulo(20, 20, 100, 150), 220);
    pintar(img, retangulo(160, 40, 120, 80), 220);
    const a = reconhecerMolde(img, pt(60, 100), { ...opcoes(1), sugerirFio: false });
    const b = reconhecerMolde(img, pt(200, 80), { ...opcoes(1), sugerirFio: false });
    if ('erro' in a || 'erro' in b) throw new Error('não reconheceu');
    expect([medidasDoContorno(a.contorno).largura, medidasDoContorno(a.contorno).altura]).toEqual([100, 150]);
    expect([medidasDoContorno(b.contorno).largura, medidasDoContorno(b.contorno).altura]).toEqual([120, 80]);
  });
});
