import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, transladarMolde, type Molde } from './molde';
import { definirTamanhosDoMolde } from './tamanhosGraduados';
import type { Material } from './materiais';
import {
  abrirNovaVersao,
  aprovarFicha,
  consumoDoItem,
  consumoEscrito,
  encaixeParaConsumo,
  enviarParaAprovacao,
  fichaEditavel,
  lerFichaTecnica,
  lerMedidasColadas,
  lerTamanhos,
  medidaComTolerancia,
  mudarFicha,
  novaFichaTecnica,
  pedirAlteracao,
  tamanhosDasPecas,
  tempoTotalDasOperacoes,
  ultimaAprovacao,
  validarItem,
  type ItemDeMaterial,
} from './fichaTecnica';

const retangulo = (nome: string, largura: number, comprimento: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde =>
  criarMolde(
    { nome, referencia: 'REF-77', tamanho: 'M', contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, comprimento), ponto(0, comprimento)], linhaDeFio: { inicio: ponto(10, 10), fim: ponto(10, comprimento - 10) }, ...extras },
    nome.toLowerCase(),
  );

const AGORA = '2026-10-24T15:00:00.000Z';
let n = 0;
const novoId = (): string => `id${++n}`;

const TECIDO: Material = { id: 't1', codigo: 'T1', descricao: 'Malha PV', categoria: 'tecido', unidade: 'kg', precoPorUnidade: 38.9, larguraMm: 1600, gramaturaGm2: 180, atualizadoEmIso: AGORA };

describe('a ficha técnica — começar', () => {
  it('a ficha nova: a referência das peças, o nome do projeto, o autor como modelista, os tamanhos do molde', () => {
    const graduada = definirTamanhosDoMolde(retangulo('Frente', 400, 600), ['P', 'M', 'G'], 'M');
    const ficha = novaFichaTecnica({ nome: 'Camiseta básica', codigo: 'ENF-1', autor: 'Ana', pecas: [graduada, retangulo('Bolso', 100, 100, { tamanho: 'U' })] }, AGORA);
    expect(ficha).toMatchObject({ referencia: 'REF-77', nomeDoModelo: 'Camiseta básica', modelista: 'Ana', tamanhos: ['P', 'M', 'G', 'U'], versao: 1, situacao: 'rascunho', decisoes: [] });
    expect(novaFichaTecnica({ nome: 'X', codigo: 'ENF-2', pecas: [retangulo('Frente', 10, 10, { referencia: '' })] }, AGORA).referencia).toBe('ENF-2');
    expect(tamanhosDasPecas([retangulo('A', 10, 10, { tamanho: ' ' })])).toEqual([]);
  });

  it('os tamanhos de um texto, sem repetir; a medida com a tolerância', () => {
    expect(lerTamanhos('P, M; G  GG,M')).toEqual(['P', 'M', 'G', 'GG']);
    const pontoDeMedida = { id: 'b', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { M: 52 } };
    expect(medidaComTolerancia(pontoDeMedida, 'M')).toBe('52,0 ± 1,0');
    expect(medidaComTolerancia(pontoDeMedida, 'G')).toBe('—');
    expect(medidaComTolerancia({ ...pontoDeMedida, toleranciaCm: 0 }, 'M')).toBe('52,0');
  });
});

describe('a ficha técnica — a tabela de medidas colada', () => {
  it('a primeira linha diz os tamanhos e a tolerância; vírgula decimal; tabulação ou ponto e vírgula', () => {
    const colada = 'Ponto\tP\tM\tG\tTol.\nBusto\t48\t52\t56\t1\nComprimento\t68,5\t70\t71,5\t1,5\n';
    const { pontos, tamanhos, erros } = lerMedidasColadas(colada, novoId);
    expect(erros).toEqual([]);
    expect(tamanhos).toEqual(['P', 'M', 'G']);
    expect(pontos.map((p) => [p.nome, p.valoresCm, p.toleranciaCm])).toEqual([
      ['Busto', { P: 48, M: 52, G: 56 }, 1],
      ['Comprimento', { P: 68.5, M: 70, G: 71.5 }, 1.5],
    ]);
    const comComo = lerMedidasColadas('Ponto;Como medir;M\nCintura;na linha da cintura;40\n', novoId);
    expect(comComo.pontos[0]).toMatchObject({ nome: 'Cintura', comoMedir: 'na linha da cintura', valoresCm: { M: 40 } });
  });

  it('o que não é medida é dito, linha por linha', () => {
    const { erros, pontos } = lerMedidasColadas('Ponto;P;M\nBusto;48;x\n;10;11\n', novoId);
    expect(erros).toEqual(['Linha 2 (Busto), tamanho M: “x” não é uma medida.', 'Linha 3: falta o nome do ponto de medida.']);
    expect(pontos).toHaveLength(1);
    expect(lerMedidasColadas('Busto;48', novoId).erros).toHaveLength(1);
  });
});

describe('a ficha técnica — o consumo dos materiais', () => {
  // Duas frentes e duas costas de 500 × 700 na mesa (cada uma de um lado): um encaixe de 1,4 m com 2 roupas.
  const naMesa = [
    retangulo('Frente', 500, 700),
    transladarMolde(retangulo('Frente', 500, 700), { x: 520, y: 0 }, 'frente#1'),
    transladarMolde(retangulo('Costas', 500, 700), { x: 0, y: 700 }, 'costas'),
    transladarMolde(retangulo('Costas', 500, 700), { x: 520, y: 700 }, 'costas#1'),
  ];
  const encaixe = encaixeParaConsumo(naMesa, 1500)!;
  const item = (extras: Partial<ItemDeMaterial>): ItemDeMaterial => ({
    id: 'i',
    materialId: 't1',
    descricao: 'Malha PV',
    aplicacao: 'Corpo',
    unidade: 'm',
    consumo: { tipo: 'pelo-encaixe', roupasNoEncaixe: null, perdaPercentual: 0 },
    ...extras,
  });

  it('o encaixe da mesa: o comprimento e as roupas contadas pelas peças', () => {
    expect(encaixe).toEqual({ comprimentoMm: 1400, roupasContadas: 2, larguraDoTecidoMm: 1500 });
    expect(encaixeParaConsumo([], 1500)).toBeNull();
  });

  it('em metros: o comprimento ÷ as roupas, com a perda', () => {
    const c = consumoDoItem(item({ consumo: { tipo: 'pelo-encaixe', roupasNoEncaixe: null, perdaPercentual: 5 } }), TECIDO, encaixe);
    expect(c.quantidade).toBeCloseTo(0.735, 6);
    expect(c.explicacao).toBe('1,400 m ÷ 2 roupa(s) (contadas na mesa) + 5,0% de perda');
    expect(consumoDoItem(item({ consumo: { tipo: 'pelo-encaixe', roupasNoEncaixe: 4, perdaPercentual: 0 } }), TECIDO, encaixe).quantidade).toBeCloseTo(0.35, 6);
  });

  it('em quilos: pela largura e a gramatura do material; em m², pela largura', () => {
    const kg = consumoDoItem(item({ unidade: 'kg' }), TECIDO, encaixe);
    // 0,7 m × 1,6 m × 180 g/m² = 201,6 g.
    expect(kg.quantidade).toBeCloseTo(0.2016, 6);
    const m2 = consumoDoItem(item({ unidade: 'm2' }), { ...TECIDO, larguraMm: undefined } as unknown as Material, encaixe);
    expect(m2.quantidade).toBeCloseTo(0.7 * 1.5, 6); // sem a largura do material, a do enfesto
  });

  it('o que impede o consumo pelo encaixe é dito', () => {
    expect(consumoDoItem(item({}), TECIDO, null).erro).toMatch(/não há peças encaixadas/);
    expect(consumoDoItem(item({ unidade: 'kg' }), { ...TECIDO, gramaturaGm2: undefined } as unknown as Material, encaixe).erro).toMatch(/falta a gramatura/);
    expect(consumoDoItem(item({ unidade: 'un' }), TECIDO, encaixe).erro).toMatch(/só em m, cm, m², kg ou g/);
    expect(consumoDoItem(item({ unidade: 'kg' }), { ...TECIDO, larguraMm: undefined } as unknown as Material, { ...encaixe, larguraDoTecidoMm: null }).erro).toMatch(/falta a largura/);
  });

  it('o consumo informado; escrito com a unidade', () => {
    expect(consumoDoItem(item({ unidade: 'un', consumo: { tipo: 'informado', quantidade: 6 } }), undefined, null)).toEqual({ quantidade: 6, explicacao: 'informado' });
    expect(consumoEscrito(6, 'un')).toBe('6 un');
    expect(consumoEscrito(0.735, 'm')).toBe('0,735 m');
    expect(consumoEscrito(null, 'm')).toBe('—');
  });

  it('o item com número que não serve é recusado', () => {
    expect(validarItem(item({ consumo: { tipo: 'informado', quantidade: -1 } }))).toEqual(['Malha PV: o consumo precisa ser um número de 0 para cima.']);
    expect(validarItem(item({ consumo: { tipo: 'pelo-encaixe', roupasNoEncaixe: 0, perdaPercentual: 0 } }))).toHaveLength(1);
    expect(validarItem(item({ descricao: ' ' }))).toContain('O item precisa da descrição do material.');
    expect(validarItem(item({}))).toEqual([]);
  });

  it('o tempo total das operações', () => {
    expect(tempoTotalDasOperacoes([{ id: 'a', descricao: 'Fechar ombros', maquina: 'Overloque', tempoMin: 0.45, observacao: '' }, { id: 'b', descricao: 'Pregar gola', maquina: 'Reta', tempoMin: 1.2, observacao: '' }])).toBeCloseTo(1.65, 9);
  });
});

describe('a ficha técnica — a aprovação e as versões', () => {
  const base = novaFichaTecnica({ nome: 'Camiseta', codigo: 'ENF-1', pecas: [] }, AGORA);

  it('rascunho → em aprovação → aprovada (com o custo da hora); aprovada não muda sem nova versão', () => {
    expect(fichaEditavel(base)).toBe(true);
    const enviada = enviarParaAprovacao(mudarFicha(base, { colecao: 'Verão 27' }, AGORA), 'Ana', '', AGORA);
    expect(enviada.situacao).toBe('em-aprovacao');
    expect(() => mudarFicha(enviada, { colecao: 'Inverno' }, AGORA)).toThrow(/em aprovação \(versão 1\): para mudar, abra uma nova versão/);
    const aprovada = aprovarFicha(enviada, 'Bruno', 'Ok para produção', '2026-10-25T10:00:00.000Z', 23.47);
    expect(aprovada.situacao).toBe('aprovada');
    expect(ultimaAprovacao(aprovada)).toMatchObject({ responsavel: 'Bruno', versao: 1, custoNaHora: 23.47, comentario: 'Ok para produção' });
    const nova = abrirNovaVersao(aprovada, 'Ana', 'trocar o botão', '2026-10-26T10:00:00.000Z');
    expect(nova).toMatchObject({ versao: 2, situacao: 'rascunho', colecao: 'Verão 27' });
    expect(nova.decisoes.map((d) => [d.acao, d.versao])).toEqual([
      ['enviada', 1],
      ['aprovada', 1],
      ['nova-versao', 2],
    ]);
  });

  it('pedir alteração precisa do comentário; com ela, a ficha volta a mudar e vai de novo para aprovação', () => {
    const enviada = enviarParaAprovacao(base, 'Ana', '', AGORA);
    expect(() => pedirAlteracao(enviada, 'Bruno', '  ', AGORA)).toThrow(/o que precisa ser alterado/);
    const voltou = pedirAlteracao(enviada, 'Bruno', 'Aumentar a tolerância do busto', AGORA);
    expect(voltou.situacao).toBe('alteracao-pedida');
    expect(fichaEditavel(voltou)).toBe(true);
    expect(enviarParaAprovacao(mudarFicha(voltou, { descricao: 'nova' }, AGORA), 'Ana', 'feito', AGORA).situacao).toBe('em-aprovacao');
  });

  it('as recusas: sem responsável; aprovar o que não está em aprovação; nova versão do rascunho', () => {
    expect(() => enviarParaAprovacao(base, ' ', '', AGORA)).toThrow(/quem envia/);
    expect(() => aprovarFicha(base, 'Bruno', '', AGORA, null)).toThrow(/Só a ficha em aprovação/);
    expect(() => abrirNovaVersao(base, 'Ana', '', AGORA)).toThrow(/já está aberta/);
  });

  it('a leitura: ida e volta; o que não é ficha, nada; o que falta entra vazio', () => {
    const f = aprovarFicha(enviarParaAprovacao(base, 'Ana', '', AGORA), 'Bruno', '', AGORA, null);
    expect(lerFichaTecnica(JSON.parse(JSON.stringify(f)))).toEqual(f);
    expect(lerFichaTecnica({ versao: 1 })).toBeNull();
    expect(lerFichaTecnica(null)).toBeNull();
    expect(lerFichaTecnica({ versao: 3, situacao: 'rascunho', medidas: [{ id: 'x' }, 'lixo'] })).toMatchObject({ versao: 3, medidas: [], materiais: [], instrucoes: { costura: '' } });
  });
});
