import { describe, expect, it } from 'vitest';
import { area, areaAssinada, contornosSeSobrepoem, distanciaEntreContornos, ponto, retanguloEnvolvente, type Contorno } from '../core/geometria';
import { criarMolde, type Molde, type RestricaoDeRotacao } from './molde';
import { modeloDoPlano } from './modeloDoPlano';
import { chaveDaGrade, conferirCasamento, escreverGrade, fazerRisco, grupoDaMarcaDeCasamento, linhaDeCorteVerdadeira, orientacoesDoRisco, pecasDaGrade, type PecaDoRisco, type RiscoGerado } from './risco';

function retangulo(id: string, nome: string, largura: number, comprimento: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome,
      referencia: '',
      tamanho: '',
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, comprimento), ponto(0, comprimento)],
      linhaDeFio: { inicio: ponto(largura / 2, 10), fim: ponto(largura / 2, comprimento - 10) },
      ...extras,
    },
    id,
  );
}

const copia = (molde: Molde, extras: Partial<PecaDoRisco> = {}): PecaDoRisco => ({ pecaId: molde.id, nome: molde.nome, tamanho: 'M', molde, espelhada: false, ...extras });
const opcoes = { larguraMm: 1000, comprimentoMaximoMm: 5000, distanciaMm: 3, sentidoUnico: false };

function gerado(r: ReturnType<typeof fazerRisco>): RiscoGerado {
  if (!r.ok) throw new Error(r.motivo);
  return r;
}

/** Nenhuma peça em cima de outra, todas à distância pedida, dentro da largura e do comprimento. */
function conferirGeometria(r: RiscoGerado, distancia: number): void {
  for (const p of r.pecas) {
    const c = retanguloEnvolvente(p.contorno);
    expect(c.minX).toBeGreaterThanOrEqual(-1e-6);
    expect(c.maxX).toBeLessThanOrEqual(r.larguraDoRiscoMm + 1e-6);
    expect(c.minY).toBeGreaterThanOrEqual(-1e-6);
    expect(c.maxY).toBeLessThanOrEqual(r.comprimentoMm + 1e-6);
  }
  for (let i = 0; i < r.pecas.length; i++) {
    for (let j = i + 1; j < r.pecas.length; j++) {
      const a = r.pecas[i]!.contorno;
      const b = r.pecas[j]!.contorno;
      expect(contornosSeSobrepoem(a, b)).toBe(false);
      expect(distanciaEntreContornos(a, b)).toBeGreaterThanOrEqual(distancia - 0.02);
    }
  }
}

describe('fazerRisco — retângulos, com o resultado calculável', () => {
  it('quatro peças de 400 × 300 numa largura de 1 m: duas por fileira, 2 fileiras — 600 mm mais a distância', () => {
    const p = retangulo('a', 'Frente', 400, 300);
    const r = gerado(fazerRisco([copia(p), copia(p), copia(p), copia(p)], { M: 1 }, opcoes));
    // Duas fileiras de 300 mm com 3 mm (mais a folga de 0,01 mm do encosto) entre elas.
    expect(r.comprimentoMm).toBeCloseTo(603.01, 2);
    expect(r.larguraOcupadaMm).toBeCloseTo(803.01, 2);
    expect(r.areaDasPecasMm2).toBeCloseTo(4 * 400 * 300, 6);
    expect(r.eficienciaPercentual).toBeCloseTo(((4 * 400 * 300) / (603.01 * 1000)) * 100, 2);
    conferirGeometria(r, 3);
  });

  it('sem distância, as peças encostam (a uns centésimos de milímetro, para não se sobreporem no arredondamento)', () => {
    const p = retangulo('a', 'Frente', 400, 300);
    const r = gerado(fazerRisco([copia(p), copia(p), copia(p), copia(p)], { M: 1 }, { ...opcoes, distanciaMm: 0 }));
    expect(r.comprimentoMm).toBeGreaterThan(600);
    expect(r.comprimentoMm).toBeLessThan(600.05);
    conferirGeometria(r, 0);
  });

  it('a peça mais larga que o risco, sem poder girar, não sai — e o motivo diz qual', () => {
    const larga = retangulo('a', 'Saia', 1100, 300);
    const r = fazerRisco([copia(larga)], { M: 1 }, opcoes);
    expect(r).toEqual({
      ok: false,
      grade: { M: 1 },
      motivo: 'A peça “Saia” (M) não cabe na largura de 1,00 m em nenhuma das orientações que ela permite (a mais estreita ocupa 1,10 m).',
    });
  });

  it('com 90°/270° permitidos, a peça larga entra deitada; sem, nunca é girada', () => {
    const giro: RestricaoDeRotacao = { permite180: false, permite90e270: true };
    const r = gerado(fazerRisco([copia(retangulo('a', 'Saia', 1100, 300, { restricaoDeRotacao: giro }))], { M: 1 }, opcoes));
    expect([90, 270]).toContain(r.pecas[0]!.anguloGraus);
    const presas = Array.from({ length: 6 }, () => copia(retangulo('b', 'Frente', 300, 500)));
    expect(gerado(fazerRisco(presas, { M: 1 }, opcoes)).pecas.every((p) => p.anguloGraus === 0)).toBe(true);
  });

  it('tecido com sentido: a peça que podia virar 180° não vira', () => {
    const vira = retangulo('a', 'Frente', 300, 500, { restricaoDeRotacao: { permite180: true, permite90e270: false } });
    const pecas = Array.from({ length: 5 }, () => copia(vira));
    expect(gerado(fazerRisco(pecas, { M: 1 }, { ...opcoes, sentidoUnico: true })).pecas.every((p) => p.anguloGraus === 0)).toBe(true);
  });

  it('o risco que passa do comprimento máximo (a mesa) não sai, e o motivo diz o que fazer', () => {
    const p = retangulo('a', 'Frente', 600, 400);
    const r = fazerRisco(Array.from({ length: 4 }, () => copia(p)), { M: 4 }, { ...opcoes, comprimentoMaximoMm: 1000 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('não cabem num risco de até 1,00 m (a mesa menos as margens)');
    expect(!r.ok && r.motivo).toContain('Use uma grade com menos roupas por risco, ou uma mesa mais comprida.');
  });
});

describe('fazerRisco — formas irregulares', () => {
  const L: Contorno = [ponto(0, 0), ponto(250, 0), ponto(250, 80), ponto(80, 80), ponto(80, 400), ponto(0, 400)];
  const triangulo: Contorno = [ponto(0, 0), ponto(300, 0), ponto(150, 260)];
  const comCostura = (id: string, nome: string, contorno: Contorno) => retangulo(id, nome, 1, 1, { contorno, margemDeCosturaMm: 10 });

  it('nenhuma sobreposição, a distância pedida entre as linhas de corte, tudo dentro da largura', () => {
    const pecas = [
      ...Array.from({ length: 5 }, () => copia(comCostura('l', 'Gola', L))),
      ...Array.from({ length: 6 }, () => copia(comCostura('t', 'Reforço', triangulo))),
      ...Array.from({ length: 3 }, () => copia(retangulo('r', 'Bolso', 180, 220))),
    ];
    const r = gerado(fazerRisco(pecas, { M: 1 }, { ...opcoes, distanciaMm: 5 }));
    expect(r.pecas).toHaveLength(14);
    conferirGeometria(r, 5);
    // A área é a das linhas de corte (com a costura, maior que a do contorno).
    expect(r.areaDasPecasMm2).toBeGreaterThan(5 * area(L) + 6 * area(triangulo) + 3 * 180 * 220);
  });

  it('da peça em par, metade das cópias sai espelhada (o sentido do contorno troca)', () => {
    // Sem costura: a linha de corte é o próprio contorno, e o sentido dele mostra o lado.
    const manga = { ...retangulo('m', 'Manga', 1, 1, { contorno: L }), emPar: true as const };
    const pecas = [copia(manga), copia(manga, { espelhada: true }), copia(manga), copia(manga, { espelhada: true })];
    const r = gerado(fazerRisco(pecas, { M: 2 }, opcoes));
    const sinal = Math.sign(areaAssinada(L));
    expect(r.pecas.map((p) => Math.sign(areaAssinada(p.contorno))).sort()).toEqual([-sinal, -sinal, sinal, sinal].sort());
    expect(r.pecas.filter((p) => p.espelhada)).toHaveLength(2);
  });

  it('as ordens tentadas param no limite de tempo (a primeira vai até o fim)', () => {
    let relogio = 0;
    const r = gerado(fazerRisco([copia(retangulo('a', 'Frente', 300, 300))], { M: 1 }, { ...opcoes, tempoLimiteMs: 10, agora: () => (relogio += 100) }));
    expect(r.ordensTentadas).toEqual(['maior área primeiro']);
    const todas = gerado(fazerRisco([copia(retangulo('a', 'Frente', 300, 300))], { M: 1 }, opcoes));
    expect(todas.ordensTentadas).toEqual(['maior área primeiro', 'mais compridas primeiro', 'mais largas primeiro']);
  });
});

describe('pecasDaGrade', () => {
  it('em cada tamanho, as roupas da grade vezes as peças por roupa; do par, uma em cada duas espelhada', () => {
    const frente = retangulo('f', 'Frente', 400, 600, { tamanho: 'P' });
    const frenteM = retangulo('fm', 'Frente', 420, 620, { tamanho: 'M' });
    const manga = { ...retangulo('m', 'Manga', 200, 300, { tamanho: 'M', quantidade: 2 }), emPar: true as const };
    const modelo = modeloDoPlano([frente, frenteM, manga]);
    const pecas = pecasDaGrade(modelo, { P: 1, M: 2 }, { f: 1, fm: 1, m: 2 });
    expect(pecas.map((p) => `${p.tamanho} ${p.nome}${p.espelhada ? ' (esq.)' : ''}`)).toEqual([
      'P Frente',
      'M Frente',
      'M Frente',
      'M Manga',
      'M Manga (esq.)',
      'M Manga',
      'M Manga (esq.)',
    ]);
  });

  it('escreve e identifica a grade', () => {
    expect(escreverGrade({ P: 1, M: 2, G: 0 })).toBe('1 P + 2 M');
    expect(chaveDaGrade({ M: 2, P: 1 }, ['P', 'M', 'G'])).toBe('P:1|M:2|G:0');
  });
});

describe('orientacoesDoRisco', () => {
  const livre = { permite180: true, permite90e270: true, permiteEspelhamento: true };
  const p = retangulo('a', 'Manga', 100, 200, { restricaoDeRotacao: livre });

  it('com tudo permitido, os 4 ângulos, cada um também espelhado', () => {
    expect(orientacoesDoRisco(copia(p), false)).toHaveLength(8);
  });

  it('a peça em par não ganha o espelho (o lado de cada cópia já está dado), mesmo podendo espelhar', () => {
    const par = { ...p, emPar: true as const };
    expect(orientacoesDoRisco(copia(par), false).every((o) => !o.espelhada)).toBe(true);
    expect(orientacoesDoRisco(copia(par, { espelhada: true }), false).every((o) => o.espelhada)).toBe(true);
  });

  it('tecido com sentido único: nenhuma orientação de 180° nem de 270°', () => {
    expect(new Set(orientacoesDoRisco(copia(p), true).map((o) => o.anguloGraus))).toEqual(new Set([0, 90]));
  });
});

describe('fazerRisco — a escolha entre as ordens de entrada', () => {
  function curva(cx: number, cy: number, rx: number, ry: number, de: number, ate: number, n: number) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = de + ((ate - de) * i) / n;
      return ponto(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    });
  }
  // Uma camiseta (frente e costas com cava e decote, manga em par, gola): as ordens dão comprimentos diferentes.
  const corpo: Contorno = [ponto(0, 0), ponto(520, 0), ponto(520, 520), ...curva(520, 720, 80, 200, -Math.PI / 2, -Math.PI, 12).slice(1), ...curva(260, 720, 120, 90, 0, -Math.PI, 16).slice(1), ...curva(0, 720, 80, 200, 0, -Math.PI / 2, 12).slice(1, -1)];
  const manga: Contorno = [ponto(0, 0), ponto(420, 0), ...curva(210, 260, 210, 160, 0, Math.PI, 20)];
  const com = (id: string, nome: string, contorno: Contorno) => retangulo(id, nome, 1, 1, { contorno, margemDeCosturaMm: 10 });
  const mangaEmPar = { ...com('m', 'Manga', manga), emPar: true as const };
  const pecas: PecaDoRisco[] = [];
  for (let roupa = 0; roupa < 6; roupa++) {
    pecas.push(copia(com('f', 'Frente', corpo)), copia(com('c', 'Costas', corpo)), copia(mangaEmPar), copia(mangaEmPar, { espelhada: true }), copia(com('g', 'Gola', [ponto(0, 0), ponto(480, 0), ponto(480, 60), ponto(0, 60)])));
  }
  const grandes = { ...opcoes, larguraMm: 1600, comprimentoMaximoMm: 12_000 };

  it('fica o risco mais curto entre as ordens tentadas (e diz qual foi)', () => {
    const nomes = ['maior área primeiro', 'mais compridas primeiro', 'mais largas primeiro'];
    const porOrdem = nomes.map((ordem) => gerado(fazerRisco(pecas, { M: 6 }, { ...grandes, ordens: [ordem] })).comprimentoMm);
    expect(new Set(porOrdem.map((c) => c.toFixed(1))).size, porOrdem.join(' / ')).toBeGreaterThan(1);
    const todas = gerado(fazerRisco(pecas, { M: 6 }, grandes));
    expect(todas.comprimentoMm).toBeCloseTo(Math.min(...porOrdem), 6);
    expect(todas.ordemEscolhida).toBe(nomes[porOrdem.indexOf(Math.min(...porOrdem))]);
    conferirGeometria(todas, 3);
  });
});

describe('fazerRisco — curvas simplificadas para as contas', () => {
  it('a diferença da simplificação entra na distância: com curvas, as peças ficam a pelo menos a pedida + 0,4 mm', () => {
    const circulo = Array.from({ length: 400 }, (_, i) => ponto(100 + 100 * Math.cos((2 * Math.PI * i) / 400), 100 + 100 * Math.sin((2 * Math.PI * i) / 400)));
    const disco = retangulo('d', 'Disco', 1, 1, { contorno: circulo, linhaDeFio: { inicio: ponto(100, 20), fim: ponto(100, 180) } });
    const r = gerado(fazerRisco(Array.from({ length: 8 }, () => copia(disco)), { M: 8 }, { ...opcoes, larguraMm: 700 }));
    // Os contornos guardados são os simplificados (bem menos que 400 pontos).
    expect(r.pecas[0]!.contorno.length).toBeLessThan(80);
    let menor = Infinity;
    for (let i = 0; i < r.pecas.length; i++) for (let j = i + 1; j < r.pecas.length; j++) menor = Math.min(menor, distanciaEntreContornos(r.pecas[i]!.contorno, r.pecas[j]!.contorno));
    expect(menor).toBeGreaterThanOrEqual(3 + 0.4 - 0.02);
    expect(menor).toBeLessThan(3 + 0.4 + 1);
  });
});

describe('fazerRisco — a distância verdadeira (sem simplificar)', () => {
  it('entre as linhas de corte verdadeiras das peças curvas, nunca menos que a distância pedida', () => {
    const circulo = Array.from({ length: 180 }, (_, i) => ponto(120 + 120 * Math.cos((2 * Math.PI * i) / 180), 90 + 90 * Math.sin((2 * Math.PI * i) / 180)));
    const L = [ponto(0, 0), ponto(250, 0), ponto(250, 80), ponto(80, 80), ponto(80, 400), ponto(0, 400)];
    const oval = retangulo('o', 'Oval', 1, 1, { contorno: circulo, margemDeCosturaMm: 7, linhaDeFio: { inicio: ponto(120, 20), fim: ponto(120, 160) }, restricaoDeRotacao: { permite180: true, permite90e270: true } });
    const gola = retangulo('l', 'Gola', 1, 1, { contorno: L, margemDeCosturaMm: 10 });
    const pecas = [...Array.from({ length: 7 }, () => copia(oval)), ...Array.from({ length: 4 }, () => copia(gola))];
    for (const distancia of [0, 3, 8]) {
      const r = gerado(fazerRisco(pecas, { M: 1 }, { ...opcoes, distanciaMm: distancia, larguraMm: 900 }));
      const verdadeiras = r.pecas.map((p, i) => linhaDeCorteVerdadeira(pecas.find((q) => q.pecaId === p.pecaId)!, r.pecas[i]!));
      let menor = Infinity;
      for (let i = 0; i < verdadeiras.length; i++)
        for (let j = i + 1; j < verdadeiras.length; j++) {
          expect(contornosSeSobrepoem(verdadeiras[i]!, verdadeiras[j]!)).toBe(false);
          menor = Math.min(menor, distanciaEntreContornos(verdadeiras[i]!, verdadeiras[j]!));
        }
      expect(menor).toBeGreaterThanOrEqual(distancia);
      // E a peça verdadeira fica dentro da largura.
      for (const v of verdadeiras) expect(retanguloEnvolvente(v).maxX).toBeLessThanOrEqual(900 + 1e-6);
    }
  }, 60_000);
});

describe('fazerRisco — cancelar', () => {
  it('cancelado no meio, o risco não sai e diz que foi cancelado', () => {
    let chamadas = 0;
    const r = fazerRisco(Array.from({ length: 6 }, () => copia(retangulo('a', 'Frente', 300, 300))), { M: 6 }, { ...opcoes, deveParar: () => ++chamadas > 3 });
    expect(r).toEqual({ ok: false, grade: { M: 6 }, motivo: 'A busca foi cancelada.', cancelado: true });
  });
});

describe('fazerRisco — casamento de listras e xadrez', () => {
  // Retângulo de 200 × 300 com a marca "casamento" a (50, 70) da peça.
  const marcada = (extras: Partial<Parameters<typeof criarMolde>[0]> = {}) =>
    retangulo('c', 'Frente', 200, 300, { marcas: [{ id: 'k', posicao: ponto(50, 70), rotulo: 'Casamento' }], ...extras });

  it('listras no comprimento (repetição de 100 mm, fase 30): o ponto de cada peça cai numa listra, e a conferência confirma', () => {
    const casamento = { rapportComprimentoMm: 100, faseComprimentoMm: 30, faseLarguraMm: 0 };
    const r = gerado(fazerRisco(Array.from({ length: 6 }, () => copia(marcada())), { M: 6 }, { ...opcoes, casamento }));
    for (const p of r.pecas) {
      const resto = (((p.pontoDeCasamento!.y - 30) % 100) + 100) % 100;
      expect(Math.min(resto, 100 - resto)).toBeLessThan(1e-6);
    }
    expect(r.casamento).toEqual({ ...casamento, conferido: true });
    expect(conferirCasamento(r.pecas, casamento)).toEqual([]);
    conferirGeometria(r, 3);
  });

  it('xadrez (repetição nas duas direções): o ponto cai no cruzamento das linhas', () => {
    const casamento = { rapportComprimentoMm: 120, rapportLarguraMm: 80, faseComprimentoMm: 10, faseLarguraMm: 20 };
    const r = gerado(fazerRisco(Array.from({ length: 5 }, () => copia(marcada())), { M: 5 }, { ...opcoes, casamento }));
    for (const p of r.pecas) {
      expect((((p.pontoDeCasamento!.y - 10) % 120) + 120) % 120).toBeCloseTo(0, 6);
      expect((((p.pontoDeCasamento!.x - 20) % 80) + 80) % 80).toBeCloseTo(0, 6);
    }
    expect(r.casamento?.conferido).toBe(true);
  });

  it('com casamento, a peça não deita (90°/270° viraria as listras), mesmo podendo', () => {
    const giro = marcada({ restricaoDeRotacao: { permite180: true, permite90e270: true } });
    const r = gerado(fazerRisco(Array.from({ length: 4 }, () => copia(giro)), { M: 4 }, { ...opcoes, casamento: { rapportComprimentoMm: 100, faseComprimentoMm: 0, faseLarguraMm: 0 } }));
    expect(r.pecas.every((p) => p.anguloGraus === 0 || p.anguloGraus === 180)).toBe(true);
  });

  it('sem a marca "casamento" numa peça, ou sem repetição, não sai — e diz o que falta', () => {
    const semMarca = fazerRisco([copia(marcada()), copia(retangulo('s', 'Bolso', 100, 100))], { M: 1 }, { ...opcoes, casamento: { rapportComprimentoMm: 100, faseComprimentoMm: 0, faseLarguraMm: 0 } });
    expect(!semMarca.ok && semMarca.motivo).toContain('Faltam em: Bolso');
    const semRepeticao = fazerRisco([copia(marcada())], { M: 1 }, { ...opcoes, casamento: { faseComprimentoMm: 0, faseLarguraMm: 0 } });
    expect(!semRepeticao.ok && semRepeticao.motivo).toBe('O casamento precisa da repetição do desenho (rapport) no comprimento ou na largura, maior que zero.');
  });

  describe('por mais de um ponto: os grupos "casamento: nome" (ADR 0129)', () => {
    // A frente (200 × 300) com o ponto principal em (50, 70) e o da cava ("casamento: manga") em (150, 233): 163 mm
    // depois no comprimento. A manga (100 × 150) só com o ponto da cabeça ("casamento: manga") em (20, 40).
    const frente = () =>
      retangulo('f', 'Frente', 200, 300, {
        marcas: [
          { id: 'k', posicao: ponto(50, 70), rotulo: 'casamento' },
          { id: 'm', posicao: ponto(150, 233), rotulo: 'Casamento: manga' },
        ],
      });
    const manga = () => retangulo('m', 'Manga', 100, 150, { marcas: [{ id: 'k', posicao: ponto(20, 40), rotulo: 'casamento - manga' }] });
    const casamento = { rapportComprimentoMm: 100, faseComprimentoMm: 30, faseLarguraMm: 0 };
    const resto = (v: number, fase: number): number => {
      const r = (((v - fase) % 100) + 100) % 100;
      return Math.min(r, 100 - r);
    };

    it('a manga casa com a listra da cava da frente, não com a fase do tecido', () => {
      // A manga vem primeiro na lista: o risco põe a frente antes (ela dá a fase do grupo).
      const r = gerado(fazerRisco([copia(manga()), copia(manga()), copia(frente())], { M: 1 }, { ...opcoes, casamento }));
      const f = r.pecas.find((p) => p.nome === 'Frente')!;
      expect(resto(f.pontoDeCasamento!.y, 30)).toBeLessThan(1e-6);
      // A cava cai 163 mm depois do ponto principal: na fase 93 (mod 100), não na 30.
      expect(resto(f.pontosDeCasamento!['manga']!.y, 93)).toBeLessThan(1e-6);
      const mangas = r.pecas.filter((p) => p.nome === 'Manga');
      expect(mangas).toHaveLength(2);
      for (const m of mangas) {
        expect(m.pontoDeCasamento).toBeUndefined();
        expect(resto(m.pontosDeCasamento!['manga']!.y, 93)).toBeLessThan(1e-6);
      }
      expect(r.casamento?.conferido).toBe(true);
      conferirGeometria(r, 3);
    });

    it('a peça só com o ponto de um grupo basta para o risco sair; sem marca nenhuma, não', () => {
      expect(fazerRisco([copia(manga())], { M: 1 }, { ...opcoes, casamento }).ok).toBe(true);
      const semMarca = fazerRisco([copia(manga()), copia(retangulo('b', 'Bolso', 80, 80))], { M: 1 }, { ...opcoes, casamento });
      expect(!semMarca.ok && semMarca.motivo).toContain('Faltam em: Bolso');
    });

    it('o rótulo diz o grupo: "casamento" e "ponto de casamento" são o principal; "casamento: nome", o grupo', () => {
      expect(grupoDaMarcaDeCasamento('Casamento')).toBe('');
      expect(grupoDaMarcaDeCasamento('Ponto de casamento')).toBe('');
      expect(grupoDaMarcaDeCasamento('casamento: Manga ')).toBe('manga');
      expect(grupoDaMarcaDeCasamento('Casamento — bolso do peito')).toBe('bolso do peito');
      expect(grupoDaMarcaDeCasamento('Piquete')).toBeNull();
      expect(grupoDaMarcaDeCasamento(undefined)).toBeNull();
    });

    it('a conferência acha o ponto do grupo fora da listra do mesmo grupo na outra peça', () => {
      const base = { tamanho: 'M', contorno: [], fio: { inicio: ponto(0, 0), fim: ponto(0, 1) }, anguloGraus: 0, espelhada: false };
      const f = { ...base, pecaId: 'f', nome: 'Frente', pontoDeCasamento: ponto(10, 130), pontosDeCasamento: { manga: ponto(10, 293) } };
      const naListra = { ...base, pecaId: 'm', nome: 'Manga', pontosDeCasamento: { manga: ponto(500, 493) } };
      const fora = { ...naListra, pontosDeCasamento: { manga: ponto(500, 450) } };
      expect(conferirCasamento([f, naListra], casamento)).toEqual([]);
      expect(conferirCasamento([f, fora], casamento)).toEqual(['Manga (M), no ponto “casamento: manga”']);
    });
  });

  it('a conferência acha a peça fora da fase', () => {
    const posta = { pecaId: 'x', nome: 'Frente', tamanho: 'M', contorno: [], fio: { inicio: ponto(0, 0), fim: ponto(0, 1) }, anguloGraus: 0, espelhada: false, pontoDeCasamento: ponto(10, 145) };
    expect(conferirCasamento([posta], { rapportComprimentoMm: 100, faseComprimentoMm: 30, faseLarguraMm: 0 })).toEqual(['Frente (M)']);
    expect(conferirCasamento([{ ...posta, pontoDeCasamento: ponto(10, 230) }], { rapportComprimentoMm: 100, faseComprimentoMm: 30, faseLarguraMm: 0 })).toEqual([]);
  });
});
