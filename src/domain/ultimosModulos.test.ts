import { describe, expect, it } from 'vitest';
import { corDaAreaNoEsquema, CORES_DA_AREA_PADRAO, coresDaAreaGuardadas, guardarCoresDaArea } from '../ui/preferencias';
import { CADASTRO_VAZIO, type CadastroDeProducao, type ExecucaoDoCorte, type MovimentoDeEstoque, type RoloDeEstoque } from './cadastroDeProducao';
import { reconhecerTodosOsMoldes, sementesDosMoldes, type ImagemDePixels } from './digitalizacao';
import { pedidoParaIa, PAINEL_VAZIO, recorteParaProporcao } from './inspiracao';
import { htmlDoCatalogo } from './looks';
import { csvDaPrevisao, csvDoRastreio, previsaoDeCompra, rastreioDosMateriais } from './salaDeCorte';

/** Uma imagem clara com quadrados escuros: cada um é um molde. */
function imagem(largura: number, altura: number, quadrados: ReadonlyArray<readonly [number, number, number]>): ImagemDePixels {
  const dados = new Uint8ClampedArray(largura * altura * 4).fill(255);
  for (const [x0, y0, lado] of quadrados) {
    for (let y = y0; y < y0 + lado; y++) {
      for (let x = x0; x < x0 + lado; x++) {
        const i = (y * largura + x) * 4;
        dados[i] = dados[i + 1] = dados[i + 2] = 20;
      }
    }
  }
  return { largura, altura, dados } as unknown as ImagemDePixels;
}

const opcoes = { mmPorPx: 1, limiar: 128, moldeEscuro: true, toleranciaMm: 1, procurarFuros: false, procurarPiques: false, sugerirFio: false, procurarLinhas: false };

describe('a captura em lote (ADR 0203)', () => {
  it('acha cada molde da foto, sem a sujeira nem o que encosta na borda', () => {
    const img = imagem(300, 200, [
      [20, 20, 60],
      [120, 40, 80],
      [250, 150, 3],
      [0, 100, 50],
    ]);
    expect(sementesDosMoldes(img, opcoes)).toHaveLength(2);
    expect(reconhecerTodosOsMoldes(img, opcoes)).toHaveLength(2);
  });

  it('sem molde, nada', () => {
    expect(sementesDosMoldes(imagem(50, 50, []), opcoes)).toEqual([]);
  });
});

const rolo = (id: string, comprimentoMedidoMm: number): RoloDeEstoque =>
  ({ id, malhaId: 'm', identificacao: `R-${id}`, comprimentoMedidoMm, lote: 'L1', tonalidade: 'T', defeitos: [], unidadeDoPeso: 'kg', unidadeDoComprimento: 'm', indisponivel: false }) as RoloDeEstoque;

const execucao = (situacao: ExecucaoDoCorte['situacao'], consumoPlanejadoMm: number, planoId = 'p1'): ExecucaoDoCorte =>
  ({ id: `e-${planoId}`, planoId, projetoId: 'x', ordem: 'OP-1', situacao, camadasPlanejadas: 10, consumoPlanejadoMm, malha: 'Malha A', liberadaEmIso: '2026-10-01', liberadaPor: 'Ana' }) as ExecucaoDoCorte;

const movimento = (tipo: MovimentoDeEstoque['tipo'], comprimentoMm: number, dataIso: string): MovimentoDeEstoque => ({ id: `${tipo}-${dataIso}`, tipo, roloId: 'r', planoId: 'p1', projetoId: 'x', comprimentoMm, dataIso, responsavel: 'Bia' });

const cadastro = (extra: Partial<CadastroDeProducao>): CadastroDeProducao => ({ ...CADASTRO_VAZIO, malhas: [{ id: 'm', descricao: 'Malha A', gramaturaGm2: 200, larguraUtilMm: 1000 } as unknown as CadastroDeProducao['malhas'][number]], ...extra });

describe('a rastreabilidade (ADR 0203)', () => {
  const c = cadastro({ rolos: [rolo('r', 50000)], execucoes: [execucao('concluida', 1000)], movimentos: [movimento('reserva', 1000, '2026-10-01'), movimento('baixa', 900, '2026-10-02')] });

  it('cada movimento diz o rolo, o lote, a ordem, o projeto e quem fez, do mais novo ao mais velho', () => {
    const r = rastreioDosMateriais(c, () => 'Camisa');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ rolo: 'R-r', lote: 'L1', malha: 'Malha A', movimento: 'baixa', comprimentoMm: 900, ordem: 'OP-1', projeto: 'Camisa', responsavel: 'Bia' });
  });

  it('a busca acha por rolo, lote, ordem ou projeto', () => {
    expect(rastreioDosMateriais(c, () => 'Camisa', 'op-1')).toHaveLength(2);
    expect(rastreioDosMateriais(c, () => 'Camisa', 'outra')).toHaveLength(0);
  });

  it('sai em CSV', () => {
    expect(csvDoRastreio(rastreioDosMateriais(c, () => 'Camisa'))).toContain('R-r');
  });
});

describe('a previsão de compra (ADR 0203)', () => {
  it('o que os cortes pendentes pedem, menos o saldo: só o que falta', () => {
    const c = cadastro({ rolos: [rolo('r', 3000)], execucoes: [execucao('liberada', 5000, 'a'), execucao('em-corte', 2000, 'b'), execucao('concluida', 9000, 'c')] });
    const [m] = previsaoDeCompra(c);
    expect(m).toMatchObject({ malha: 'Malha A', necessarioMm: 7000, saldoMm: 3000, faltaMm: 4000 });
    expect(m!.faltaG).toBeCloseTo(800, 6);
  });

  it('com saldo bastante, não falta; sem corte pendente, nem aparece', () => {
    expect(previsaoDeCompra(cadastro({ rolos: [rolo('r', 9000)], execucoes: [execucao('liberada', 5000)] }))[0]!.faltaMm).toBe(0);
    expect(previsaoDeCompra(cadastro({ rolos: [rolo('r', 9000)] }))).toEqual([]);
  });

  it('sai em CSV', () => {
    expect(csvDaPrevisao(previsaoDeCompra(cadastro({ execucoes: [execucao('liberada', 5000)] })))).toContain('Malha A');
  });
});

describe('o catálogo da coleção (ADR 0203)', () => {
  it('traz cada modelo, escapando o texto', () => {
    const html = htmlDoCatalogo('Verão <26>', [{ nome: 'Camisa & Cia', referencia: 'C1', categoria: 'Blusas', cores: ['Azul', 'Preto'], tecido: 'Linho', croquiSvg: '<svg></svg>' }, { nome: 'Saia', referencia: 'S1', categoria: '', cores: [], tecido: '', croquiSvg: null }]);
    expect(html).toContain('Verão &lt;26&gt;');
    expect(html).toContain('Camisa &amp; Cia');
    expect(html).toContain('<svg></svg>');
    expect(html).toContain('Azul, Preto');
    expect(html).toContain('sem croqui');
  });
});

describe('o modelo virtual da foto (ADR 0203)', () => {
  it('o pedido diz o corpo, a idade, o cabelo e a pose', () => {
    const p = pedidoParaIa('foto', PAINEL_VAZIO, { nomeDoModelo: 'Camisa', referencias: 0, modeloVirtual: { corpo: 'plus size', idade: '40 anos', cabelo: 'curto', pose: 'de lado' } });
    expect(p).toContain('Modelo virtual: corpo plus size, 40 anos, cabelo curto, pose de lado.');
  });

  it('sem nada escolhido, não muda; e só vale na foto', () => {
    expect(pedidoParaIa('foto', PAINEL_VAZIO, { nomeDoModelo: 'Camisa', referencias: 0, modeloVirtual: {} })).not.toContain('Modelo virtual');
    expect(pedidoParaIa('peca', PAINEL_VAZIO, { nomeDoModelo: 'Camisa', referencias: 0, modeloVirtual: { corpo: 'magro' } })).not.toContain('Modelo virtual');
  });

  it('o recorte para a loja fica no centro, na proporção pedida', () => {
    expect(recorteParaProporcao(1000, 1000, 3, 4)).toEqual({ x: 125, y: 0, largura: 750, altura: 1000 });
    expect(recorteParaProporcao(1000, 500, 1, 1)).toEqual({ x: 250, y: 0, largura: 500, altura: 500 });
    expect(recorteParaProporcao(600, 1000, 1, 1)).toEqual({ x: 0, y: 200, largura: 600, altura: 600 });
  });
});

describe('as cores da área de trabalho (ADR 0203)', () => {
  it('três esquemas próprios, lembrados; o padrão não tem cor própria', () => {
    const m = new Map<string, string>();
    const a = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(coresDaAreaGuardadas(a).esquema).toBe('padrao');
    guardarCoresDaArea(a, { esquema: 'user1', user1: { ...CORES_DA_AREA_PADRAO, mesa: '#ffee00' }, user2: CORES_DA_AREA_PADRAO, user3: CORES_DA_AREA_PADRAO });
    const lidas = coresDaAreaGuardadas(a);
    expect(corDaAreaNoEsquema(lidas)?.mesa).toBe('#ffee00');
    expect(corDaAreaNoEsquema({ ...lidas, esquema: 'padrao' })).toBeNull();
  });
});
