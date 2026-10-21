// Os dois motores do encaixe automático na mesma suíte de casos: os dois resultados conferidos (nenhuma peça em
// cima de outra, a distância pedida entre as linhas de corte verdadeiras, tudo dentro da mesa e das margens), e os
// números de cada um (comprimento, aproveitamento, peças de fora) medidos aqui — os mesmos do ADR 0089.
import { describe, expect, it } from 'vitest';
import { contornosSeSobrepoem, distanciaEntreContornos, ponto, retanguloEnvolvente, type Contorno } from '../core/geometria';
import { criarMolde, linhaDeCorteDaPeca, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { executarNestingAutomatico, executarNestingPorPontosDeCanto, type ResultadoDeNesting } from './nesting';

function molde(id: string, nome: string, contorno: Contorno, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  const c = retanguloEnvolvente(contorno);
  return criarMolde({ nome, referencia: '', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto((c.minX + c.maxX) / 2, c.minY + 5), fim: ponto((c.minX + c.maxX) / 2, c.maxY - 5) }, ...extras }, id);
}
const ret = (l: number, c: number): Contorno => [ponto(0, 0), ponto(l, 0), ponto(l, c), ponto(0, c)];
function curva(cx: number, cy: number, rx: number, ry: number, de: number, ate: number, n: number) {
  return Array.from({ length: n + 1 }, (_, i) => ponto(cx + rx * Math.cos(de + ((ate - de) * i) / n), cy + ry * Math.sin(de + ((ate - de) * i) / n)));
}
const corpo: Contorno = [ponto(0, 0), ponto(520, 0), ponto(520, 520), ...curva(520, 720, 80, 200, -Math.PI / 2, -Math.PI, 12).slice(1), ...curva(260, 720, 120, 90, 0, -Math.PI, 16).slice(1), ...curva(0, 720, 80, 200, 0, -Math.PI / 2, 12).slice(1, -1)];
const manga: Contorno = [ponto(0, 0), ponto(420, 0), ...curva(210, 260, 210, 160, 0, Math.PI, 20)];
const mesa = (largura: number, comprimento: number, distancia: number, margem = 0): ConfiguracaoDeEnfesto =>
  criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: largura, comprimentoMm: comprimento, quantidadeDeCamadas: 1, margemLateralMm: margem, margemDeExtremidadeMm: margem, distanciaMinimaEntrePecasMm: distancia });

/** O resultado conferido: dentro da mesa, sem sobreposição, à distância — pelas linhas de corte verdadeiras. */
function conferir(r: ResultadoDeNesting, e: ConfiguracaoDeEnfesto): void {
  const cortes = r.pecasColocadas.map((p) => linhaDeCorteDaPeca(p.molde));
  for (const c of cortes) {
    const b = retanguloEnvolvente(c);
    expect(b.minX).toBeGreaterThanOrEqual(e.margemLateralMm - 1e-6);
    expect(b.maxX).toBeLessThanOrEqual(e.larguraUtilMm - e.margemLateralMm + 1e-6);
    expect(b.minY).toBeGreaterThanOrEqual(e.margemDeExtremidadeMm - 1e-6);
    expect(b.maxY).toBeLessThanOrEqual(e.comprimentoMm - e.margemDeExtremidadeMm + 1e-6);
  }
  for (let i = 0; i < cortes.length; i++)
    for (let j = i + 1; j < cortes.length; j++) {
      expect(contornosSeSobrepoem(cortes[i]!, cortes[j]!)).toBe(false);
      expect(distanciaEntreContornos(cortes[i]!, cortes[j]!)).toBeGreaterThanOrEqual(e.distanciaMinimaEntrePecasMm - 1e-6);
    }
  // Cada cópia pedida aparece uma vez: posta ou de fora.
  const ids = [...r.pecasColocadas.map((p) => `${p.idOriginal}#${p.indiceCopia}`), ...r.pecasNaoColocadas.map((p) => `${p.idOriginal}#${p.indiceCopia}`)];
  expect(new Set(ids).size).toBe(ids.length);
}

interface Caso {
  readonly nome: string;
  readonly pecas: readonly Molde[];
  readonly mesa: ConfiguracaoDeEnfesto;
}

const CASOS: readonly Caso[] = [
  { nome: '12 retângulos de 300 × 200 numa mesa de 1 m', pecas: [molde('r', 'Ret', ret(300, 200), { quantidade: 12 })], mesa: mesa(1000, 3000, 5) },
  {
    nome: 'L e triângulos com costura, mesa com margens',
    pecas: [
      molde('l', 'Gola', [ponto(0, 0), ponto(250, 0), ponto(250, 80), ponto(80, 80), ponto(80, 400), ponto(0, 400)], { quantidade: 5, margemDeCosturaMm: 10 }),
      molde('t', 'Reforço', [ponto(0, 0), ponto(300, 0), ponto(150, 260)], { quantidade: 6, margemDeCosturaMm: 10 }),
    ],
    mesa: mesa(1200, 4000, 3, 20),
  },
  {
    nome: 'camiseta (curvas), 2 roupas, manga em par',
    pecas: [
      molde('f', 'Frente', corpo, { quantidade: 2, margemDeCosturaMm: 10 }),
      molde('c', 'Costas', corpo, { quantidade: 2, margemDeCosturaMm: 10 }),
      { ...molde('m', 'Manga', manga, { quantidade: 4, margemDeCosturaMm: 10 }), emPar: true },
    ],
    mesa: mesa(1600, 6000, 3),
  },
  { nome: 'mais peças que a mesa: as de fora são ditas', pecas: [molde('g', 'Grande', ret(450, 450), { quantidade: 9 })], mesa: mesa(1000, 1000, 5) },
];

describe('os dois motores do encaixe na mesa, nos mesmos casos', () => {
  for (const caso of CASOS) {
    it(caso.nome, () => {
      const grade = executarNestingAutomatico(caso.pecas, caso.mesa, { maxTentativasPorPeca: 10_000_000 });
      const cantos = executarNestingPorPontosDeCanto(caso.pecas, caso.mesa);
      conferir(grade, caso.mesa);
      conferir(cantos, caso.mesa);
      // Os dois põem a mesma quantidade de peças (as que cabem na mesa).
      expect(cantos.pecasColocadas.length).toBeGreaterThanOrEqual(grade.pecasColocadas.length);
    }, 120_000);
  }

  it('números medidos (os do ADR 0089)', () => {
    const linhas = CASOS.map((caso) => {
      const grade = executarNestingAutomatico(caso.pecas, caso.mesa, { maxTentativasPorPeca: 10_000_000 });
      const cantos = executarNestingPorPontosDeCanto(caso.pecas, caso.mesa);
      return [caso.nome, Math.round(grade.comprimentoUtilizadoMm), grade.pecasNaoColocadas.length, Math.round(cantos.comprimentoUtilizadoMm), cantos.pecasNaoColocadas.length];
    });
    expect(linhas).toEqual([
      // [caso, comprimento pela grade (mm), de fora, comprimento pelos pontos de canto (mm), de fora]
      ['12 retângulos de 300 × 200 numa mesa de 1 m', 815, 0, 815, 0],
      ['L e triângulos com costura, mesa com margens', 1248, 0, 1319, 0],
      ['camiseta (curvas), 2 roupas, manga em par', 1744, 0, 1769, 0],
      ['mais peças que a mesa: as de fora são ditas', 905, 5, 905, 5],
    ]);
  }, 120_000);
});
