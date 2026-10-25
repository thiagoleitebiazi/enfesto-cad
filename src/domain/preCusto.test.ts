import { describe, expect, it } from 'vitest';
import { BIBLIOTECA_VAZIA, salvarMaterial, salvarPadroesDeCusto, type BibliotecaDeMateriais, type Material } from './materiais';
import { aprovarFicha, definirPadroesDeCustoDaFicha, enviarParaAprovacao, mudarFicha, novaFichaTecnica, type EncaixeParaConsumo, type FichaTecnica } from './fichaTecnica';
import { calcularPreCusto, csvDosCustosDosModelos, custosDosModelos, preCustoPorTamanho, simularMeta, totaisPorGrupo, type PreCusto } from './preCusto';
import { definirRegra, iniciarGraduacao, regraPorPasso } from './graduacao';
import { criarProjeto } from './projeto';
import { ponto } from '../core/geometria';
import { criarMolde } from './molde';

const AGORA = '2026-10-24T16:00:00.000Z';
const material = (m: Partial<Material> & Pick<Material, 'id' | 'descricao' | 'categoria' | 'unidade' | 'precoPorUnidade'>): Material => ({ codigo: '', atualizadoEmIso: AGORA, ...m });

/** Malha a R$ 40/kg (1,6 m × 200 g/m²), botão a R$ 0,30, etiqueta a R$ 0,15, saco a R$ 0,40; minuto a R$ 0,50; 10% de indiretos. */
function biblioteca(): BibliotecaDeMateriais {
  let b = BIBLIOTECA_VAZIA;
  b = salvarMaterial(b, material({ id: 'malha', descricao: 'Malha PV', categoria: 'tecido', unidade: 'kg', precoPorUnidade: 40, larguraMm: 1600, gramaturaGm2: 200 }), AGORA);
  b = salvarMaterial(b, material({ id: 'botao', descricao: 'Botão', categoria: 'aviamento', unidade: 'un', precoPorUnidade: 0.3 }), AGORA);
  b = salvarMaterial(b, material({ id: 'etiqueta', descricao: 'Etiqueta', categoria: 'aviamento', unidade: 'un', precoPorUnidade: 0.15 }), AGORA);
  b = salvarMaterial(b, material({ id: 'saco', descricao: 'Saco plástico', categoria: 'embalagem', unidade: 'un', precoPorUnidade: 0.4 }), AGORA);
  return salvarPadroesDeCusto(b, { custoDoMinuto: 0.5, indiretosPercentual: 10, impostosPercentual: 10, comissaoPercentual: 5, margemPercentual: 25 });
}

/** Um encaixe de 1,25 m com 1 roupa: 1,25 m × 1,6 m × 200 g = 400 g de malha (R$ 16,00). */
const ENCAIXE: EncaixeParaConsumo = { comprimentoMm: 1250, roupasContadas: 1, larguraDoTecidoMm: 1600 };

function ficha(): FichaTecnica {
  const f = novaFichaTecnica({ nome: 'Camisa polo', codigo: 'ENF-9', pecas: [] }, AGORA);
  return mudarFicha(
    f,
    {
      materiais: [
        { id: 'i1', materialId: 'malha', descricao: 'Malha PV', aplicacao: 'Corpo', unidade: 'kg', consumo: { tipo: 'pelo-encaixe', roupasNoEncaixe: null, perdaPercentual: 0 } },
        { id: 'i2', materialId: 'botao', descricao: 'Botão', aplicacao: 'Carcela', unidade: 'un', consumo: { tipo: 'informado', quantidade: 3 } },
        { id: 'i3', materialId: 'etiqueta', descricao: 'Etiqueta', aplicacao: 'Gola', unidade: 'un', consumo: { tipo: 'informado', quantidade: 1 } },
        { id: 'i4', materialId: 'saco', descricao: 'Saco plástico', aplicacao: 'Embalagem', unidade: 'un', consumo: { tipo: 'informado', quantidade: 1 } },
      ],
      operacoes: [
        { id: 'o1', descricao: 'Fechar ombros', maquina: 'Overloque', tempoMin: 1.5, observacao: '' },
        { id: 'o2', descricao: 'Pregar gola', maquina: 'Reta', tempoMin: 4.5, observacao: '' },
      ],
    },
    AGORA,
  );
}

describe('o pré-custo', () => {
  it('materiais (consumo × preço), mão de obra (tempo × minuto), indiretos, custo total e o preço pelo markup', () => {
    const c = calcularPreCusto(ficha(), biblioteca(), ENCAIXE);
    // Materiais: 16,00 + 0,90 + 0,15 + 0,40 = 17,45; mão de obra: 6 min × 0,50 = 3,00; direto 20,45; indiretos 2,045.
    expect(c.materiais).toBeCloseTo(17.45, 6);
    expect(c.tempoMin).toBe(6);
    expect(c.maoDeObra).toBeCloseTo(3, 6);
    expect(c.custoDireto).toBeCloseTo(20.45, 6);
    expect(c.indiretos).toBeCloseTo(2.045, 6);
    expect(c.custoTotal).toBeCloseTo(22.495, 6);
    // Preço = 22,495 ÷ (1 − 40%) = 37,49; o que sai dele: 10% impostos, 5% comissão, 25% margem.
    expect(c.precoSugerido).toBeCloseTo(37.4917, 3);
    expect(c.markup).toBeCloseTo(1 / 0.6, 6);
    expect(c.margem).toBeCloseTo(37.4917 * 0.25, 3);
    expect(c.completo).toBe(true);
    expect(c.faltando).toEqual([]);
    expect(c.padroesDaEmpresa).toBe(true);
    expect(totaisPorGrupo(c).map((g) => [g.grupo, g.valor === null ? null : Math.round(g.valor * 100) / 100])).toEqual([
      ['tecido', 16],
      ['aviamento', 1.05],
      ['embalagem', 0.4],
      ['mao-de-obra', 3],
    ]);
    expect(c.linhas[0]).toMatchObject({ consumo: '0,400 kg', preco: 'R$ 40,00/kg', origemDoPreco: 'biblioteca' });
    expect(c.linhas.at(-1)).toMatchObject({ grupo: 'mao-de-obra', consumo: '6,00 min', preco: 'R$ 0,50/min' });
  });

  it('o preço da biblioteca mudado muda o custo (o de todos os modelos que usam o material)', () => {
    const b = salvarMaterial(biblioteca(), { ...biblioteca().materiais.find((m) => m.id === 'malha')!, precoPorUnidade: 45 }, '2026-11-01T10:00:00.000Z');
    expect(calcularPreCusto(ficha(), b, ENCAIXE).materiais).toBeCloseTo(19.45, 6);
  });

  it('o que falta não vira zero: o custo sai parcial e a lista diz o quê', () => {
    const semPreco = salvarMaterial(biblioteca(), { ...biblioteca().materiais.find((m) => m.id === 'botao')!, precoPorUnidade: null }, AGORA);
    const semMinuto = salvarPadroesDeCusto(semPreco, { ...semPreco.padroesDeCusto, custoDoMinuto: null });
    const c = calcularPreCusto(ficha(), semMinuto, null);
    expect(c.completo).toBe(false);
    expect(c.faltando).toEqual([
      'Malha PV: Pelo encaixe: não há peças encaixadas na mesa.',
      'Botão: sem preço na biblioteca.',
      'Falta o custo do minuto de costura (Materiais e aviamentos › Padrões de custo, ou o pré-custo desta ficha).',
    ]);
    expect(c.custoTotal).toBeCloseTo((0.15 + 0.4) * 1.1, 6);
    // A mão de obra sem o custo do minuto não sai como R$ 0,00: o grupo fica sem valor.
    expect(totaisPorGrupo(c).find((g) => g.grupo === 'mao-de-obra')!.valor).toBeNull();
  });

  it('o material que saiu da biblioteca, o item digitado com o preço, a unidade que não confere', () => {
    const f = mudarFicha(
      ficha(),
      {
        materiais: [
          { id: 'x', materialId: 'sumiu', descricao: 'Zíper', aplicacao: '', unidade: 'un', consumo: { tipo: 'informado', quantidade: 1 } },
          { id: 'y', materialId: null, descricao: 'Linha de pesponto', aplicacao: '', unidade: 'm', consumo: { tipo: 'informado', quantidade: 120 }, precoInformado: 0.002 },
          { id: 'z', materialId: 'malha', descricao: 'Malha PV', aplicacao: '', unidade: 'm', consumo: { tipo: 'informado', quantidade: 1 } },
        ],
      },
      AGORA,
    );
    const c = calcularPreCusto(f, biblioteca(), ENCAIXE);
    expect(c.linhas.map((l) => [l.origemDoPreco, l.valor === null ? null : Math.round(l.valor * 1000) / 1000])).toEqual([
      ['material removido', null],
      ['informado', 0.24],
      ['biblioteca', null],
      ['padrões', 3],
    ]);
    expect(c.faltando).toEqual(['Zíper: o material saiu da biblioteca (escolha outro, ou digite o preço).', 'Malha PV: o item está em m e o preço da biblioteca é por kg.']);
  });

  it('os padrões próprios da ficha valem no lugar dos da empresa', () => {
    const f = definirPadroesDeCustoDaFicha(ficha(), { custoDoMinuto: 1, indiretosPercentual: 0, impostosPercentual: 0, comissaoPercentual: 0, margemPercentual: 50 }, AGORA);
    const c = calcularPreCusto(f, biblioteca(), ENCAIXE);
    expect(c.padroesDaEmpresa).toBe(false);
    expect(c.custoTotal).toBeCloseTo(17.45 + 6, 6);
    expect(c.precoSugerido).toBeCloseTo((17.45 + 6) * 2, 6);
    expect(calcularPreCusto(definirPadroesDeCustoDaFicha(f, null, AGORA), biblioteca(), ENCAIXE).padroesDaEmpresa).toBe(true);
    expect(() => definirPadroesDeCustoDaFicha(f, { custoDoMinuto: 1, indiretosPercentual: 0, impostosPercentual: 50, comissaoPercentual: 0, margemPercentual: 50 }, AGORA)).toThrow(/abaixo de 100%/);
  });

  it('o custo aprovado fica para comparar', () => {
    const aprovada = aprovarFicha(enviarParaAprovacao(ficha(), 'Ana', '', AGORA), 'Bruno', '', AGORA, 21);
    expect(calcularPreCusto(aprovada, biblioteca(), ENCAIXE).custoAprovado).toBe(21);
  });
});

describe('o simulador de meta', () => {
  const custo = (): PreCusto => calcularPreCusto(ficha(), biblioteca(), ENCAIXE);

  it('dentro da meta de custo: o que sobra', () => {
    expect(simularMeta(custo(), { tipo: 'custo', valor: 25 })).toEqual({ custoAlvo: 25, diferenca: expect.closeTo(-2.505, 6), dentro: true, caminhos: ['Dentro da meta: sobram R$ 2,51 por peça.'] });
  });

  it('acima da meta de custo: cada caminho sozinho — o tempo, o preço ou o consumo do maior material, os indiretos', () => {
    const s = simularMeta(custo(), { tipo: 'custo', valor: 21.395 });
    if ('erro' in s) throw new Error(s.erro);
    // Falta R$ 1,10, que é R$ 1,00 do custo direto (os indiretos de 10% caem junto).
    expect(s.diferenca).toBeCloseTo(1.1, 6);
    expect(s.caminhos).toEqual([
      'Reduzir o tempo de costura em 2,00 min (de 6,00 para 4,00 min).',
      '“Malha PV”: baixar o preço de R$ 40,00 para R$ 37,50/kg (−6,2%), ou o consumo de 0,400 para 0,375 kg.',
      '“Botão” custa R$ 0,90 por peça: nem sem ele chega.',
      'Baixar os custos indiretos de 10,0% para 4,6%.',
    ]);
  });

  it('a meta de preço: o custo que dá aquele preço, e a margem possível', () => {
    const s = simularMeta(custo(), { tipo: 'preco', valor: 34.99 });
    if ('erro' in s) throw new Error(s.erro);
    expect(s.custoAlvo).toBeCloseTo(34.99 * 0.6, 6);
    expect(s.dentro).toBe(false);
    expect(s.caminhos.at(-1)).toBe('Ou manter o custo e vender a R$ 34,99 com a margem de 20,7% (hoje 25,0%).');
    const folgada = simularMeta(custo(), { tipo: 'preco', valor: 50 });
    if ('erro' in folgada) throw new Error(folgada.erro);
    expect(folgada.caminhos).toEqual(['Dentro da meta: sobram R$ 7,51 por peça.', 'Com o preço de R$ 50,00, a margem pode ir a 40,0% (hoje 25,0%).']);
    expect(simularMeta(custo(), { tipo: 'preco', valor: 0 })).toEqual({ erro: 'A meta precisa ser um valor maior que zero (R$).' });
  });
});

describe('o custo de todos os modelos', () => {
  it('cada projeto com ficha, com os preços de agora; o aprovado e a diferença; o CSV', () => {
    const peca = criarMolde({ nome: 'Frente', referencia: 'R1', tamanho: 'M', contorno: [ponto(0, 0), ponto(500, 0), ponto(500, 1250), ponto(0, 1250)], linhaDeFio: { inicio: ponto(10, 10), fim: ponto(10, 1000) } }, 'f');
    const enfesto = { tipo: 'impar', larguraUtilMm: 1600, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 } as never;
    const aprovada = aprovarFicha(enviarParaAprovacao(ficha(), 'Ana', '', AGORA), 'Bruno', '', AGORA, 20);
    const comFicha = { ...criarProjeto('Camisa polo', 'p1', 'ENF-9', AGORA, { pecas: [peca], tecido: null, enfesto }), fichaTecnica: aprovada };
    const semFicha = criarProjeto('Bermuda', 'p2', 'ENF-10', AGORA, { pecas: [], tecido: null, enfesto: null });
    const custos = custosDosModelos([semFicha, comFicha], biblioteca());
    expect(custos).toHaveLength(1);
    expect(custos[0]).toMatchObject({ projetoId: 'p1', versao: 1, situacao: 'aprovada', completo: true, custoAprovado: 20, materiaisIds: ['malha', 'botao', 'etiqueta', 'saco'] });
    expect(custos[0]!.custoAtual).toBeCloseTo(22.495, 6);
    expect(custos[0]!.diferencaPercentual).toBeCloseTo(12.475, 3);
    const linhas = csvDosCustosDosModelos(custos).trim().split('\r\n');
    expect(linhas[1]!.split(';')).toEqual(['Camisa polo', 'ENF-9', 'ENF-9', '1', '22,50', 'sim', '37,49', '20,00', '12,5']);
  });
});

describe('o custo por tamanho (ADR 0115)', () => {
  /** Uma peça de 300 × 200 mm graduada em P, M e G (base M): o lado de 200 cresce 20 mm por tamanho. */
  function pecaGraduada() {
    const contorno = [ponto(0, 0), ponto(0, 200), ponto(300, 200), ponto(300, 0)];
    let g = iniciarGraduacao(contorno, ['P', 'M', 'G'], 1);
    for (const i of [1, 2]) g = definirRegra(g, contorno, i, regraPorPasso(g, ponto(0, 20)));
    return { ...criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 100), fim: ponto(250, 100) } }, 'f'), graduacao: g };
  }

  it('a área de cada tamanho pela graduação; o tecido acompanha a área (P −10%, G +10%); aviamentos, embalagem e mão de obra iguais', () => {
    const peca = pecaGraduada();
    const f = mudarFicha(ficha(), { tamanhos: ['P', 'M', 'G'] }, AGORA);
    const porTamanho = preCustoPorTamanho(f, biblioteca(), ENCAIXE, [peca]);
    expect(porTamanho.map((t) => [t.tamanho, +t.areaM2.toFixed(4), +t.fatorDoTecido.toFixed(4)])).toEqual([
      ['P', 0.054, 0.9],
      ['M', 0.06, 1],
      ['G', 0.066, 1.1],
    ]);
    const medio = calcularPreCusto(f, biblioteca(), ENCAIXE);
    // A malha (R$ 16,00 na média) vira 14,40 e 17,60; o resto (1,45 de aviamentos e saco, 3,00 de mão de obra) igual.
    const malha = (t: (typeof porTamanho)[number]) => t.preCusto.linhas.find((l) => l.itemId === 'i1')!.valor!;
    expect(porTamanho.map(malha).map((v) => +v.toFixed(2))).toEqual([14.4, 16, 17.6]);
    expect(porTamanho[1]!.preCusto.custoTotal).toBeCloseTo(medio.custoTotal, 6);
    expect(porTamanho[2]!.preCusto.custoTotal).toBeCloseTo((17.6 + 1.45 + 3) * 1.1, 6);
    expect(porTamanho[0]!.preCusto.linhas.find((l) => l.itemId === 'i2')!.valor).toBeCloseTo(0.9, 6);
  });

  it('sem graduação (as áreas iguais) ou com um tamanho só: nada', () => {
    const semGraduacao = { ...pecaGraduada(), graduacao: undefined };
    expect(preCustoPorTamanho(mudarFicha(ficha(), { tamanhos: ['P', 'M'] }, AGORA), biblioteca(), ENCAIXE, [semGraduacao as never])).toEqual([]);
    expect(preCustoPorTamanho(mudarFicha(ficha(), { tamanhos: ['M'] }, AGORA), biblioteca(), ENCAIXE, [pecaGraduada()])).toEqual([]);
  });
});
