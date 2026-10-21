import { describe, expect, it } from 'vitest';
import { alocarCamadas, linhasDeEmendaDoRisco, type RiscoParaAlocar, type RoloParaAlocar } from './alocacaoDosRolos';

const rolo = (id: string, comprimentoMm: number, extras: Partial<RoloParaAlocar> = {}): RoloParaAlocar => ({
  id,
  identificacao: id,
  grupo: 'L1',
  comprimentoMm,
  jaUsadoMm: 0,
  perdaPorRoloMm: 0,
  defeitosComPosicao: [],
  defeitosSemPosicaoMm: 0,
  serveParaRiscos: ['R'],
  ...extras,
});
const risco = (camadas: number, consumoMm: number, linhasDeEmenda: number[] | null = null): RiscoParaAlocar => ({ chave: 'R', camadas, consumoMm, linhasDeEmenda });
const SEM_EMENDA = { permitirEmendas: false, sobreposicaoDaEmendaMm: 100 };
const trechos = (a: ReturnType<typeof alocarCamadas>) => a.camadas.map((c) => c.trechos.map((t) => `${t.roloId}:${t.inicioMm}-${t.fimMm}`).join('+'));

describe('alocarCamadas — sem defeitos', () => {
  it('cada rolo dá camadas inteiras; a sobra do fim é ponta; o que não cabe falta', () => {
    const a = alocarCamadas([rolo('A', 10_000), rolo('B', 5000)], [risco(5, 3000)], SEM_EMENDA);
    expect(trechos(a)).toEqual(['A:0-3000', 'A:3000-6000', 'A:6000-9000', 'B:0-3000']);
    expect(a.faltando).toEqual({ R: 1 });
    expect(a.porRolo.map((r) => [r.roloId, r.camadasPorRisco.R, r.usadoMm, r.pontaMm])).toEqual([
      ['A', 3, 9000, 1000],
      ['B', 1, 3000, 2000],
    ]);
  });

  it('o já usado e a perda por rolo (metade no começo, metade no fim)', () => {
    const a = alocarCamadas([rolo('A', 10_000, { jaUsadoMm: 2000, perdaPorRoloMm: 400 })], [risco(3, 3000)], SEM_EMENDA);
    expect(trechos(a)).toEqual(['A:2000-5000', 'A:5000-8000']);
    expect(a.porRolo[0]!.pontaMm).toBe(1800);
  });

  it('o rolo que não serve ao risco (estreito) não entra', () => {
    const a = alocarCamadas([rolo('A', 10_000, { serveParaRiscos: [] }), rolo('B', 3000)], [risco(1, 3000)], SEM_EMENDA);
    expect(trechos(a)).toEqual(['B:0-3000']);
  });
});

describe('alocarCamadas — defeitos', () => {
  it('com posição: a camada que passaria pelo defeito começa depois dele; o pulo é perda por defeito', () => {
    // Defeito de 3,0 a 3,2 m: a 1ª camada (0–3 m) encosta nele sem passar; a 2ª começa em 3,2 m.
    const a = alocarCamadas([rolo('A', 10_000, { defeitosComPosicao: [[3000, 3200]] })], [risco(3, 3000)], SEM_EMENDA);
    expect(trechos(a)).toEqual(['A:0-3000', 'A:3200-6200', 'A:6200-9200']);
    expect(a.porRolo[0]).toMatchObject({ perdaPorDefeitoMm: 200, pontaMm: 800 });
  });

  it('o defeito no meio do caminho tira a camada inteira que passaria por ele', () => {
    const a = alocarCamadas([rolo('A', 10_000, { defeitosComPosicao: [[2500, 3000]] })], [risco(3, 3000)], SEM_EMENDA);
    expect(trechos(a)).toEqual(['A:3000-6000', 'A:6000-9000']);
    expect(a.faltando).toEqual({ R: 1 });
    expect(a.porRolo[0]!.perdaPorDefeitoMm).toBe(3000);
  });

  it('sem posição: o comprimento do defeito sai do fim do rolo (não é evitado)', () => {
    const a = alocarCamadas([rolo('A', 10_000, { defeitosSemPosicaoMm: 1500 })], [risco(3, 3000)], SEM_EMENDA);
    expect(trechos(a)).toEqual(['A:0-3000', 'A:3000-6000']);
    expect(a.porRolo[0]!.pontaMm).toBe(2500);
  });
});

describe('alocarCamadas — emendas', () => {
  // A com 10 m e B com 6,2 m, camadas de 4 m, linhas de emenda a 1,5 e 2,0 m da camada, sobreposição de 0,1 m.
  const rolos = [rolo('A', 10_000), rolo('B', 6200)];

  it('sem emenda: 2 camadas em A, 1 em B — falta 1', () => {
    const a = alocarCamadas(rolos, [risco(4, 4000, [1500, 2000])], SEM_EMENDA);
    expect(a.faltando).toEqual({ R: 1 });
  });

  it('com emenda: a 3ª camada vai até a linha de 2,0 m em A e continua em B com a sobreposição — as 4 cabem', () => {
    const a = alocarCamadas(rolos, [risco(4, 4000, [1500, 2000])], { permitirEmendas: true, sobreposicaoDaEmendaMm: 100 });
    expect(trechos(a)).toEqual(['A:0-4000', 'A:4000-8000', 'A:8000-10000+B:0-2100', 'B:2100-6100']);
    expect(a.camadas[2]!.emenda).toEqual({ posicaoNaCamadaMm: 2000, sobreposicaoMm: 100, roloDe: 'A', roloPara: 'B' });
    expect(a.faltando).toEqual({});
    expect(a.porRolo.map((r) => [r.roloId, r.usadoMm, r.emendas, r.pontaMm])).toEqual([
      ['A', 10_000, 1, 0],
      ['B', 6100, 0, 100],
    ]);
  });

  it('a linha de emenda é a maior que cabe no que sobra do rolo; o resto depois dela é ponta', () => {
    const a = alocarCamadas([rolo('A', 9800), rolo('B', 6200)], [risco(3, 4000, [1500, 2000])], { permitirEmendas: true, sobreposicaoDaEmendaMm: 100 });
    // Sobram 1,8 m em A: a linha de 1,5 m.
    expect(a.camadas[2]!.trechos).toEqual([
      { roloId: 'A', inicioMm: 8000, fimMm: 9500 },
      { roloId: 'B', inicioMm: 0, fimMm: 2600 },
    ]);
    expect(a.porRolo[0]!.pontaMm).toBe(300);
  });

  it('sem linhas de emenda conhecidas (risco informado à mão), não emenda', () => {
    const a = alocarCamadas(rolos, [risco(4, 4000, null)], { permitirEmendas: true, sobreposicaoDaEmendaMm: 100 });
    expect(a.camadas.some((c) => c.emenda)).toBe(false);
    expect(a.faltando).toEqual({ R: 1 });
  });
});

describe('linhasDeEmendaDoRisco', () => {
  it('as posições em que uma reta de lado a lado não corta peça: o começo de cada vão', () => {
    const peca = (de: number, ate: number) => ({ contorno: [{ y: de }, { y: ate }, { y: (de + ate) / 2 }] });
    expect(linhasDeEmendaDoRisco([peca(0, 500), peca(503, 800), peca(600, 900), peca(905, 1200)], 1200)).toEqual([500, 900]);
    expect(linhasDeEmendaDoRisco([peca(0, 500), peca(400, 1200)], 1200)).toEqual([]);
  });
});
