import { describe, expect, it } from 'vitest';
import { area, distancia, ponto, type Ponto2D } from '../core/geometria';
import { criarMolde, espelharMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { executarNestingAutomatico, type PecaColocada } from './nesting';
import { encaixeComOMoldeDeAgora, movimentoDaPeca } from './encaixeAtualizado';

/** Uma peça em L (sem simetria: o espelho e o giro mudam o desenho). */
function pecaEmL(id: string, nome: string, sobrescrever: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome,
      referencia: 'REF',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(0, 100), ponto(60, 100), ponto(60, 40), ponto(200, 40), ponto(200, 0)],
      linhaDeFio: { inicio: ponto(20, 20), fim: ponto(180, 20) },
      piques: [{ id: 'p1', posicao: ponto(200, 20), indiceAresta: 4 }],
      ...sobrescrever,
    },
    id,
  );
}

/** Como o encaixe põe uma peça: na origem, espelhada ou não, girada, e levada ao lugar. */
function posta(peca: Molde, indiceCopia: number, espelhar: boolean, anguloGraus: number, lugar: Ponto2D): PecaColocada {
  let m = transladarMolde(peca, { x: -3, y: -7 }, `${peca.id}#${indiceCopia}`);
  if (espelhar) m = espelharMolde(m, m.id);
  if (anguloGraus !== 0) m = rotacionarMolde(m, anguloGraus);
  return { idOriginal: peca.id, indiceCopia, molde: { ...transladarMolde(m, lugar, m.id), quantidade: 1 } };
}

const pertoDe = (a: Ponto2D, b: Ponto2D): boolean => distancia(a, b) < 1e-6;

/** A frente com o bico (o ponto 4) puxado 30 mm para baixo: a peça mudou de forma. */
const comOBicoPuxado = (m: Molde): Molde => ({ ...m, contorno: m.contorno.map((p, k) => (k === 4 ? ponto(p.x + 30, p.y) : p)) });

describe('o encaixe com o molde de agora (ADR 0125)', () => {
  it('acha o movimento do encaixe: o giro, o espelho e o lugar', () => {
    const frente = pecaEmL('f', 'Frente');
    for (const espelhar of [false, true]) {
      for (const angulo of [0, 90, 180, 270]) {
        const p = posta(frente, 0, espelhar, angulo, ponto(500, 300)).molde;
        const mov = movimentoDaPeca(frente, p)!;
        expect(mov.espelhar).toBe(espelhar);
        frente.contorno.forEach((q, k) => expect(pertoDe(mov.levar(q), p.contorno[k]!)).toBe(true));
        expect(pertoDe(mov.levar(frente.linhaDeFio.inicio), p.linhaDeFio.inicio)).toBe(true);
      }
    }
    // Outro contorno não é um movimento do encaixe.
    expect(movimentoDaPeca(frente, comOBicoPuxado(frente))).toBeNull();
  });

  it('a peça que mudou entra no lugar dela, com o mesmo giro e espelho; a que não mudou fica como estava', () => {
    const frente = pecaEmL('f', 'Frente');
    const costas = pecaEmL('c', 'Costas');
    const colocadas = [posta(frente, 0, true, 90, ponto(400, 120)), posta(costas, 0, false, 180, ponto(100, 600))];
    const agora = [comOBicoPuxado(frente), costas];
    const r = encaixeComOMoldeDeAgora(colocadas, [frente, costas], agora);
    expect(r.atualizadas).toEqual(['Frente']);
    expect(r.foraDoProjeto).toEqual([]);
    expect(r.foraDoEncaixe).toEqual([]);
    expect(r.comoNoEncaixe).toEqual([]);
    // As costas não mudaram: as mesmas do encaixe.
    expect(r.pecas[1]).toBe(colocadas[1]!.molde);
    // A frente: cada ponto que não mudou no mesmo lugar; o bico, 30 mm adiante, na direção que o encaixe deu.
    const nova = r.pecas[0]!;
    const antiga = colocadas[0]!.molde;
    expect(nova.id).toBe('f#0');
    expect(nova.quantidade).toBe(1);
    nova.contorno.forEach((q, k) => {
      if (k !== 4) expect(pertoDe(q, antiga.contorno[k]!)).toBe(true);
    });
    expect(distancia(nova.contorno[4]!, antiga.contorno[4]!)).toBeCloseTo(30, 6);
    expect(area(nova.contorno)).toBeCloseTo(area(comOBicoPuxado(frente).contorno), 6);
    // O pique e o fio não foram mexidos: ficam onde estavam na peça posta.
    expect(pertoDe(nova.piques[0]!.posicao, antiga.piques[0]!.posicao)).toBe(true);
    expect(pertoDe(nova.linhaDeFio.fim, antiga.linhaDeFio.fim)).toBe(true);
    // O giro acumulado é o que o encaixe deu.
    expect(nova.anguloDeRotacaoGraus).toBe(antiga.anguloDeRotacaoGraus);
  });

  it('a peça que só andou no projeto (ou não mudou) fica como o encaixe a pôs', () => {
    const frente = pecaEmL('f', 'Frente');
    const colocadas = [posta(frente, 0, false, 270, ponto(300, 300))];
    const andou = transladarMolde(frente, { x: 77, y: -15 }, 'f');
    const r = encaixeComOMoldeDeAgora(colocadas, [frente], [andou]);
    expect(r.atualizadas).toEqual([]);
    expect(r.pecas[0]).toBe(colocadas[0]!.molde);
  });

  it('a peça mexida no projeto depois do encaixe (andada, girada, espelhada) e mudada entra no mesmo lugar', () => {
    const frente = pecaEmL('f', 'Frente');
    const colocadas = [posta(frente, 0, true, 90, ponto(400, 120))];
    const noLugar = encaixeComOMoldeDeAgora(colocadas, [frente], [comOBicoPuxado(frente)]).pecas[0]!;
    const mexidas = [
      transladarMolde(comOBicoPuxado(frente), { x: 50, y: 80 }, 'f'),
      transladarMolde(rotacionarMolde(comOBicoPuxado(frente), 90), { x: -20, y: 300 }, 'f'),
      espelharMolde(rotacionarMolde(comOBicoPuxado(frente), 180), 'f'),
    ];
    for (const mexida of mexidas) {
      const r = encaixeComOMoldeDeAgora(colocadas, [frente], [mexida]);
      expect(r.atualizadas).toEqual(['Frente']);
      r.pecas[0]!.contorno.forEach((q, k) => expect(pertoDe(q, noLugar.contorno[k]!)).toBe(true));
      expect(pertoDe(r.pecas[0]!.linhaDeFio.inicio, noLugar.linhaDeFio.inicio)).toBe(true);
      expect(r.pecas[0]!.anguloDeRotacaoGraus).toBe(colocadas[0]!.molde.anguloDeRotacaoGraus);
    }
    // Só mexida (girada e andada), sem mudar: fica como o encaixe a pôs.
    const soMexida = transladarMolde(rotacionarMolde(frente, 270), { x: 10, y: 10 }, 'f');
    expect(encaixeComOMoldeDeAgora(colocadas, [frente], [soMexida]).pecas[0]).toBe(colocadas[0]!.molde);
  });

  it('um pique novo entra na peça posta, no lugar certo', () => {
    const frente = pecaEmL('f', 'Frente');
    const colocadas = [posta(frente, 0, true, 180, ponto(250, 250))];
    const comPique = { ...frente, piques: [...frente.piques, { id: 'p2', posicao: ponto(0, 50), indiceAresta: 0 }] };
    const r = encaixeComOMoldeDeAgora(colocadas, [frente], [comPique]);
    expect(r.atualizadas).toEqual(['Frente']);
    const mov = movimentoDaPeca(frente, colocadas[0]!.molde)!;
    expect(pertoDe(r.pecas[0]!.piques[1]!.posicao, mov.levar(ponto(0, 50)))).toBe(true);
    r.pecas[0]!.contorno.forEach((q, k) => expect(pertoDe(q, colocadas[0]!.molde.contorno[k]!)).toBe(true));
  });

  it('a peça apagada sai da mesa; a cópia a menos também; a nova e a cópia a mais são ditas', () => {
    const frente = pecaEmL('f', 'Frente', { quantidade: 2 });
    const costas = pecaEmL('c', 'Costas');
    const colocadas = [posta(frente, 0, false, 0, ponto(0, 0)), posta(frente, 1, false, 0, ponto(0, 300)), posta(costas, 0, false, 0, ponto(0, 600))];
    const manga = pecaEmL('m', 'Manga', { quantidade: 2 });
    const r = encaixeComOMoldeDeAgora(colocadas, [frente, costas], [{ ...frente, quantidade: 1 }, manga]);
    expect(r.pecas.map((p) => p.id)).toEqual(['f#0']);
    expect(r.foraDoProjeto).toEqual(['Frente (cópia 2)', 'Costas']);
    expect(r.foraDoEncaixe).toEqual(['Manga']);
    expect(r.novas).toEqual([manga]);
    const mais = encaixeComOMoldeDeAgora(colocadas, [frente, costas], [{ ...frente, quantidade: 4 }, costas]);
    expect(mais.foraDoEncaixe).toEqual(['Frente (2 cópias a mais)']);
  });

  it('com todos os tamanhos (ids novos), acha a peça pelo nome e o tamanho; o nome repetido fica como no encaixe', () => {
    const m = pecaEmL('f', 'Frente');
    const g = pecaEmL('t1', 'Frente', { tamanho: 'G' });
    const colocadas = [posta(m, 0, false, 0, ponto(0, 0)), posta(g, 0, false, 90, ponto(0, 300))];
    // Preparado de novo agora: o tamanho G ganha outro id.
    const gAgora = { ...comOBicoPuxado(g), id: 't9' };
    const r = encaixeComOMoldeDeAgora(colocadas, [m, g], [m, gAgora]);
    expect(r.atualizadas).toEqual(['Frente']);
    expect(r.pecas[1]!.id).toBe('t1#0');
    expect(distancia(r.pecas[1]!.contorno[4]!, colocadas[1]!.molde.contorno[4]!)).toBeCloseTo(30, 6);
    // Duas peças "Frente" G agora: não dá para saber qual é a do encaixe.
    const duas = encaixeComOMoldeDeAgora(colocadas, [m, g], [m, gAgora, { ...gAgora, id: 't10' }]);
    expect(duas.comoNoEncaixe).toEqual(['Frente']);
    expect(duas.pecas[1]).toBe(colocadas[1]!.molde);
    expect(duas.foraDoEncaixe).toEqual([]);
  });

  it('no encaixe de verdade (com par espelhado e giros), a peça mudada ocupa o lugar de cada cópia', () => {
    const enfesto: ConfiguracaoDeEnfesto = criarConfiguracaoDeEnfesto({
      tipo: 'impar',
      larguraUtilMm: 600,
      comprimentoMm: 3000,
      quantidadeDeCamadas: 1,
      margemLateralMm: 0,
      margemDeExtremidadeMm: 0,
      distanciaMinimaEntrePecasMm: 5,
    } as ConfiguracaoDeEnfesto);
    const livre = { permite180: true, permite90e270: true, permiteEspelhamento: false };
    const manga = { ...pecaEmL('m', 'Manga', { quantidade: 2, restricaoDeRotacao: livre }), emPar: true as const };
    const frente = pecaEmL('f', 'Frente', { restricaoDeRotacao: livre });
    const resultado = executarNestingAutomatico([manga, frente], enfesto);
    expect(resultado.pecasColocadas).toHaveLength(3);
    const agora = [comOBicoPuxado(manga), frente];
    const r = encaixeComOMoldeDeAgora(resultado.pecasColocadas, [manga, frente], agora);
    expect(r.atualizadas).toEqual(['Manga']);
    resultado.pecasColocadas.forEach((c, i) => {
      const nova = r.pecas[i]!;
      expect(nova.id).toBe(c.molde.id);
      const mudou = c.idOriginal === 'm';
      nova.contorno.forEach((q, k) => {
        if (!mudou || k !== 4) expect(pertoDe(q, c.molde.contorno[k]!)).toBe(true);
      });
      if (mudou) expect(distancia(nova.contorno[4]!, c.molde.contorno[4]!)).toBeCloseTo(30, 6);
    });
    // As duas mangas: uma direita e uma esquerda, como no encaixe.
    const [m0, m1] = r.pecas.filter((p) => p.id.startsWith('m#')).map((p) => movimentoDaPeca(comOBicoPuxado(manga), p)!.espelhar);
    expect(m0).not.toBe(m1);
  });
});
