import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, rotacionarMolde, type Molde } from './molde';
import { definirRegra } from './graduacao';
import { definirTamanhosDoMolde } from './tamanhosGraduados';
import { definirLinhaDeSimetria } from './anotacoes';
import { criarConfiguracaoDeEnfesto } from './enfesto';
import { executarNestingAutomatico } from './nesting';
import { contornoSeCruza, modeloDoPlano, quantidadesPorRoupa } from './modeloDoPlano';

function peca(id: string, nome: string, largura: number, comprimento: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
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

const caixa = (m: Molde) => retanguloEnvolvente(m.contorno);

describe('modeloDoPlano — os tamanhos e as peças de cada um', () => {
  // Frente graduada em P, M e G (o canto de cima, à direita, anda 10 mm por tamanho), uma etiqueta sem tamanho e um
  // bolso só do M.
  const frente = (() => {
    const g = definirTamanhosDoMolde(peca('f', 'Frente', 400, 600), ['P', 'M', 'G'], 'M');
    return { ...g, graduacao: definirRegra(g.graduacao!, g.contorno, 2, [ponto(-10, -10), ponto(0, 0), ponto(10, 10)]) };
  })();
  const etiqueta = peca('e', 'Etiqueta', 40, 60);
  const bolso = peca('b', 'Bolso', 150, 150, { tamanho: 'M' });
  const modelo = modeloDoPlano([frente, etiqueta, bolso]);

  it('os tamanhos vêm da graduação; a peça sem tamanho entra em todos, a do M só no M', () => {
    expect(modelo.tamanhos).toEqual(['P', 'M', 'G']);
    const nomes = (t: string) => modelo.pecasPorTamanho[t]!.map((p) => p.molde.nome);
    expect(nomes('P')).toEqual(['Frente', 'Etiqueta']);
    expect(nomes('M')).toEqual(['Frente', 'Etiqueta', 'Bolso']);
    expect(nomes('G')).toEqual(['Frente', 'Etiqueta']);
    expect(modelo.pecas.find((p) => p.nome === 'Etiqueta')).toMatchObject({ comum: true, tamanhos: ['P', 'M', 'G'] });
    expect(modelo.problemas).toEqual([
      { nivel: 'info', pecaId: 'e', texto: 'A peça “Etiqueta” não tem tamanho: entra igual em todos os tamanhos. Se não for comum a todos, informe o tamanho dela.' },
    ]);
  });

  it('cada tamanho com a forma dele, e todas com o canto em (0, 0)', () => {
    const frenteDo = (t: string) => caixa(modelo.pecasPorTamanho[t]!.find((p) => p.molde.nome === 'Frente')!.molde);
    // O canto anda 10 mm para dentro no P (a caixa fica igual, pelos outros cantos) e 10 mm para fora no G.
    expect([frenteDo('P').largura, frenteDo('M').largura, frenteDo('G').largura]).toEqual([400, 400, 410]);
    expect([frenteDo('P').altura, frenteDo('M').altura, frenteDo('G').altura]).toEqual([600, 600, 610]);
    const ponta = (t: string) => modelo.pecasPorTamanho[t]!.find((p) => p.molde.nome === 'Frente')!.molde.contorno[2];
    expect([ponta('P'), ponta('M'), ponta('G')]).toEqual([ponto(390, 590), ponto(400, 600), ponto(410, 610)]);
    for (const t of modelo.tamanhos) for (const p of modelo.pecasPorTamanho[t]!) expect([caixa(p.molde).minX, caixa(p.molde).minY]).toEqual([0, 0]);
  });

  it('sem tamanho nenhum no projeto, um tamanho só: Único', () => {
    const m = modeloDoPlano([peca('a', 'Frente', 100, 100), peca('b', 'Costas', 100, 100)]);
    expect(m.tamanhos).toEqual(['Único']);
    expect(m.pecasPorTamanho['Único']!.map((p) => p.pecaId)).toEqual(['a', 'b']);
    expect(m.problemas).toEqual([]);
  });
});

describe('modeloDoPlano — as peças como estão no projeto', () => {
  it('as cópias postas na mesa por um encaixe contam como uma peça, com as cópias por roupa', () => {
    const manga = peca('m', 'Manga', 200, 300, { tamanho: 'M', quantidade: 2 });
    const enfesto = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 2000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 3 });
    const naMesa = executarNestingAutomatico([manga], enfesto).pecasColocadas.map((p) => p.molde);
    expect(naMesa.map((p) => p.id)).toEqual(['m#0', 'm#1']);
    const modelo = modeloDoPlano(naMesa);
    expect(modelo.pecas).toHaveLength(1);
    expect(modelo.pecas[0]).toMatchObject({ id: 'm', idsNoProjeto: ['m#0', 'm#1'], quantidadeSugerida: 2, origemDaQuantidade: 'cópias na mesa' });
  });

  it('a peça girada depois de criada volta à orientação de origem (as rotações permitidas contam dela)', () => {
    const girada = rotacionarMolde(peca('a', 'Frente', 100, 300), 90);
    expect(caixa(girada).largura).toBeCloseTo(300, 6);
    const modelo = modeloDoPlano([girada]);
    const naOrigem = modelo.pecasPorTamanho['Único']![0]!.molde;
    expect(naOrigem.anguloDeRotacaoGraus).toBe(0);
    expect(caixa(naOrigem).largura).toBeCloseTo(100, 6);
    expect(modelo.pecas[0]).toMatchObject({ larguraMm: expect.closeTo(100, 6), comprimentoMm: expect.closeTo(300, 6) });
  });

  it('a peça com linha de simetria entra aberta (inteira)', () => {
    const metade = definirLinhaDeSimetria(peca('a', 'Costas', 200, 500), 1);
    const modelo = modeloDoPlano([metade]);
    expect(caixa(modelo.pecasPorTamanho['Único']![0]!.molde).largura).toBeCloseTo(400, 6);
    expect(modelo.pecas[0]!.abertaNaSimetria).toBe(true);
  });

  it('contorno que se cruza e peça dobrada com a metade guardada são erros, com o que fazer', () => {
    // Um contorno com área, mas com a aresta de baixo cortando a da direita.
    const cruzada = peca('x', 'Gola', 10, 10, { contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(150, 50), ponto(0, 50)] });
    expect(contornoSeCruza(cruzada.contorno)).toBe(true);
    expect(contornoSeCruza(peca('y', 'Ok', 100, 100).contorno)).toBe(false);
    const dobrada = { ...peca('d', 'Frente', 200, 300), dobraMantida: {} } as unknown as Molde;
    const modelo = modeloDoPlano([cruzada, dobrada, peca('ok', 'Costas', 100, 100)]);
    expect(modelo.problemas.map((p) => [p.nivel, p.pecaId])).toEqual([
      ['erro', 'x'],
      ['erro', 'd'],
    ]);
    expect(modelo.problemas[0]!.texto).toContain('se cruza: corrija o desenho');
    expect(modelo.problemas[1]!.texto).toContain('desdobre-a');
    expect(modelo.pecas.map((p) => p.nome)).toEqual(['Costas']);
  });

  it('medidas fora do comum e unidade presumida na importação são avisadas', () => {
    const minuscula = peca('a', 'Botão', 3, 3);
    const presumida = {
      ...peca('b', 'Frente', 400, 600),
      origemDaImportacao: { formato: 'dxf' as const, arquivo: 'frente.dxf', importadaEmIso: '2026-10-20T10:00:00.000Z', unidade: 'mm', unidadeAssumida: true, areaMm2: 240000, perimetroMm: 2000, pontos: 4 },
    };
    const textos = modeloDoPlano([minuscula, presumida]).problemas.map((p) => p.texto);
    expect(textos).toEqual([
      'A peça “Botão” mede 3 × 3 mm, fora do comum: confira a escala ou a unidade do arquivo.',
      'A unidade do arquivo de “Frente” (frente.dxf) não estava declarada; foi presumida mm. Confira uma medida conhecida.',
    ]);
  });

  it('duas peças iguais com o mesmo nome no mesmo tamanho são avisadas', () => {
    const modelo = modeloDoPlano([peca('a', 'Manga', 200, 300), peca('b', 'manga', 200, 300)]);
    expect(modelo.problemas[0]!.texto).toBe(
      '“Manga” aparece 2 vezes no tamanho Único, com a mesma forma: cada uma conta como uma peça da roupa. Se forem cópias da mesma, deixe uma e use a quantidade por roupa.',
    );
  });

  it('sem peças, não há o que planejar', () => {
    expect(modeloDoPlano([]).problemas[0]!.texto).toContain('O projeto não tem peças');
  });
});

describe('quantidadesPorRoupa', () => {
  const modelo = modeloDoPlano([peca('a', 'Frente', 100, 100, { quantidade: 1 }), { ...peca('m', 'Manga', 100, 100, { quantidade: 2 }), emPar: true }]);

  it('a sugerida vale até ser trocada', () => {
    expect(quantidadesPorRoupa(modelo, {})).toEqual({ quantidades: { a: 1, m: 2 }, erros: [] });
    expect(quantidadesPorRoupa(modelo, { a: 0 })).toEqual({ quantidades: { a: 0, m: 2 }, erros: [] });
  });

  it('em par, a quantidade é par; nada no plano é recusado', () => {
    expect(quantidadesPorRoupa(modelo, { m: 3 }).erros).toEqual(['“Manga” é cortada em pares (direita e esquerda): a quantidade por roupa precisa ser par, e está 3.']);
    expect(quantidadesPorRoupa(modelo, { a: 0, m: 0 }).erros).toEqual(['Nenhuma peça entra no plano: a quantidade por roupa de todas está 0.']);
    expect(quantidadesPorRoupa(modelo, { a: 1.5 }).erros).toEqual(['A quantidade de “Frente” por roupa precisa ser um número inteiro de 0 para cima.']);
  });
});
