import { describe, expect, it } from 'vitest';
import {
  CADASTRO_VAZIO,
  comprimentoDoRolo,
  darBaixaDoPlano,
  estadoDoRolo,
  estornarMovimento,
  movimentosDoPlano,
  reservarPlano,
  grupoDoRolo,
  incluirMalhasAntigas,
  lerCadastroDeProducao,
  lerGradeColada,
  removerMalha,
  removerOrdem,
  removerRolo,
  salvarMalha,
  salvarOrdem,
  salvarRolo,
  tipoDeTecidoDaMalha,
  validarMalha,
  validarOrdem,
  validarRolo,
  VERSAO_DO_CADASTRO,
  type CadastroDeProducao,
  type MalhaDoCadastro,
  type OrdemDeProducao,
  type RoloDeEstoque,
} from './cadastroDeProducao';

const MALHA: MalhaDoCadastro = {
  id: 'm1',
  descricao: 'Malha algodão 30/1',
  gramaturaGm2: 160,
  larguraNominalMm: 1800,
  larguraUtilMm: 1700,
  rendimentoMmPorG: 3.6,
  tubular: false,
  sentidoUnico: false,
  padrao: 'liso',
  encolhimentoCompensadoNoMolde: false,
};

const ROLO: RoloDeEstoque = {
  id: 'r1',
  malhaId: 'm1',
  identificacao: 'R-001',
  pesoLiquidoG: 25_000,
  lote: 'L10',
  tonalidade: 'A',
  defeitos: [],
  unidadeDoPeso: 'kg',
  unidadeDoComprimento: 'm',
  indisponivel: false,
};

const ORDEM: OrdemDeProducao = {
  id: 'o1',
  codigo: 'OP-100',
  quantidadesPorTamanho: { P: 10, M: 20, G: 10 },
  criadaEmIso: '2026-10-20T10:00:00.000Z',
  atualizadaEmIso: '2026-10-20T10:00:00.000Z',
};

function semPeso(r: RoloDeEstoque): RoloDeEstoque {
  const copia: { -readonly [K in keyof RoloDeEstoque]?: RoloDeEstoque[K] } = { ...r };
  delete copia.pesoLiquidoG;
  return copia as RoloDeEstoque;
}

const COM_MALHA: CadastroDeProducao = salvarMalha(CADASTRO_VAZIO, MALHA);

describe('lerCadastroDeProducao', () => {
  it('sem arquivo, o cadastro vazio; um cadastro gravado volta igual', () => {
    expect(lerCadastroDeProducao(null)).toEqual({ cadastro: CADASTRO_VAZIO, descartados: [], maisNovo: false });
    const cheio = salvarOrdem(salvarRolo(COM_MALHA, ROLO), ORDEM);
    const lido = lerCadastroDeProducao(JSON.parse(JSON.stringify(cheio)));
    expect(lido.cadastro).toEqual(cheio);
    expect(lido.descartados).toEqual([]);
  });

  it('o registro inválido fica de fora, com o motivo; o resto entra', () => {
    const lido = lerCadastroDeProducao({
      versaoDoFormato: 1,
      malhas: [MALHA, { ...MALHA, id: 'm2', larguraUtilMm: -5 }],
      rolos: [ROLO, { ...ROLO, id: 'r2', pesoLiquidoG: undefined }],
      ordens: 'nada',
    });
    expect(lido.cadastro.malhas.map((m) => m.id)).toEqual(['m1']);
    expect(lido.cadastro.rolos.map((r) => r.id)).toEqual(['r1']);
    expect(lido.cadastro.ordens).toEqual([]);
    expect(lido.descartados).toEqual([
      '1 registro(s) de malhas com dados inválidos ficaram de fora.',
      '1 registro(s) de rolos com dados inválidos ficaram de fora.',
      'A lista de ordens não pôde ser lida.',
    ]);
  });

  it('um arquivo de versão mais nova é lido, e marcado', () => {
    expect(lerCadastroDeProducao({ versaoDoFormato: VERSAO_DO_CADASTRO + 1, malhas: [MALHA] }).maisNovo).toBe(true);
  });

  it('o que não é um cadastro não derruba nada', () => {
    expect(lerCadastroDeProducao([1, 2]).cadastro).toEqual(CADASTRO_VAZIO);
    expect(lerCadastroDeProducao('texto').descartados).toHaveLength(1);
  });
});

describe('malhas', () => {
  it('a largura útil acima da nominal, valores zerados e encolhimento absurdo são recusados, com o que corrigir', () => {
    const erros = validarMalha({ ...MALHA, larguraUtilMm: 1900, gramaturaGm2: 0, encolhimentoComprimentoPercentual: 60 }, []);
    expect(erros).toEqual([
      'A largura útil não pode passar da largura nominal: confira as duas.',
      'A gramatura precisa ser maior que zero (g/m²).',
      'O encolhimento no comprimento precisa ficar entre 0 e 50%.',
    ]);
  });

  it('a mesma descrição (sem diferença de maiúsculas) não entra duas vezes; a malha editada troca a antiga', () => {
    expect(() => salvarMalha(COM_MALHA, { ...MALHA, id: 'm2', descricao: ' MALHA ALGODÃO 30/1 ' })).toThrow('Já há uma malha “MALHA ALGODÃO 30/1”');
    const editada = salvarMalha(COM_MALHA, { ...MALHA, larguraUtilMm: 1650 });
    expect(editada.malhas).toHaveLength(1);
    expect(editada.malhas[0]!.larguraUtilMm).toBe(1650);
  });

  it('a malha com rolos no estoque não sai do cadastro', () => {
    const comRolo = salvarRolo(COM_MALHA, ROLO);
    expect(() => removerMalha(comRolo, 'm1')).toThrow('Há 1 rolo(s) desta malha no estoque');
    expect(removerMalha(removerRolo(comRolo, 'r1'), 'm1').malhas).toEqual([]);
  });

  it('as malhas do cadastro antigo entram uma vez, sem a compensação do encolhimento presumida', () => {
    const antigas = [
      { id: 'a1', descricao: 'Ribana', larguraUtilMm: 900, tubular: true, sentidoUnico: false, encolhimentoPercentual: 4 },
      { id: 'a2', descricao: 'malha algodão 30/1', larguraUtilMm: 1600, tubular: false, sentidoUnico: false },
    ];
    const depois = incluirMalhasAntigas(COM_MALHA, antigas);
    expect(depois.malhas.map((m) => m.descricao)).toEqual(['Malha algodão 30/1', 'Ribana']);
    expect(depois.malhas[1]).toMatchObject({ encolhimentoComprimentoPercentual: 4, encolhimentoCompensadoNoMolde: false, padrao: 'liso' });
    expect(incluirMalhasAntigas(depois, antigas)).toEqual(depois);
  });
});

describe('malhas — o tipo de tecido e o custo (opcionais)', () => {
  const custo = { valor: 41.9, unidade: 'kg', moeda: 'BRL' } as const;

  it('a malha de antes, sem o tipo e sem o custo, abre igual; a marcada como tubular é tubular, a outra não está informada', () => {
    const lido = lerCadastroDeProducao(JSON.parse(JSON.stringify({ versaoDoFormato: 2, malhas: [MALHA, { ...MALHA, id: 'm2', descricao: 'Ribana', tubular: true }] })));
    expect(lido.descartados).toEqual([]);
    expect(lido.cadastro.malhas[0]).toEqual(MALHA);
    expect(lido.cadastro.malhas.map(tipoDeTecidoDaMalha)).toEqual([null, 'tubular']);
  });

  it('com o tipo e o custo, guarda e volta igual', () => {
    const malha: MalhaDoCadastro = { ...MALHA, tipoDeTecido: 'ramado', custo };
    expect(validarMalha(malha, [])).toEqual([]);
    const cadastro = salvarMalha(CADASTRO_VAZIO, malha);
    expect(lerCadastroDeProducao(JSON.parse(JSON.stringify(cadastro))).cadastro).toEqual(cadastro);
    expect(tipoDeTecidoDaMalha(malha)).toBe('ramado');
  });

  it('o custo negativo, com mais de 2 casas, ou o tipo que não confere com o tubular são recusados ao salvar', () => {
    expect(validarMalha({ ...MALHA, custo: { ...custo, valor: -1 } }, [])).toEqual(['O custo do tecido não pode ser negativo.']);
    expect(validarMalha({ ...MALHA, custo: { ...custo, valor: 1.234 } }, [])).toEqual(['O custo do tecido pode ter no máximo 2 casas decimais (os centavos).']);
    expect(validarMalha({ ...MALHA, tipoDeTecido: 'tubular' }, [])).toEqual(['O tipo de tecido é ramado ou tubular, e precisa conferir com a malha tubular.']);
  });

  it('no arquivo, a malha com o custo ou o tipo estragado fica de fora (dito), e as outras entram', () => {
    const lido = lerCadastroDeProducao({
      versaoDoFormato: 2,
      malhas: [
        { ...MALHA, custo: { valor: 'caro', unidade: 'kg', moeda: 'BRL' } },
        { ...MALHA, id: 'm3', descricao: 'Outra', tipoDeTecido: 'tubular', tubular: false },
        { ...MALHA, id: 'm4', descricao: 'Boa', tipoDeTecido: 'tubular', tubular: true, custo },
      ],
    });
    expect(lido.cadastro.malhas.map((m) => m.id)).toEqual(['m4']);
    expect(lido.descartados).toEqual(['2 registro(s) de malhas com dados inválidos ficaram de fora.']);
  });
});

describe('rolos', () => {
  it('precisa da malha, da identificação e do peso ou do comprimento', () => {
    expect(validarRolo({ ...semPeso(ROLO), malhaId: 'x', identificacao: ' ' }, COM_MALHA)).toEqual([
      'Escolha a malha do rolo (ela precisa estar no cadastro).',
      'Informe a identificação do rolo (a etiqueta).',
      'Informe o peso líquido ou o comprimento medido do rolo (pelo menos um, maior que zero).',
    ]);
  });

  it('a mesma etiqueta não se repete na mesma malha; defeito sem descrição é recusado', () => {
    const comRolo = salvarRolo(COM_MALHA, ROLO);
    expect(() => salvarRolo(comRolo, { ...ROLO, id: 'r2', identificacao: 'r-001' })).toThrow('Já há um rolo “r-001” desta malha');
    expect(validarRolo({ ...ROLO, defeitos: [{ descricao: '', perdaMm: 300 }] }, COM_MALHA)).toContain(
      'Cada defeito precisa da descrição e da perda (de 0 mm para cima).',
    );
  });

  it('o comprimento: o medido; sem ele, peso × rendimento, como estimativa; sem rendimento, não há como saber', () => {
    expect(comprimentoDoRolo({ comprimentoMedidoMm: 90_000, pesoLiquidoG: 25_000 }, 3.6)).toEqual({ comprimentoMm: 90_000, origem: 'medido' });
    // 25 kg × 3,6 m/kg = 90 m.
    expect(comprimentoDoRolo({ pesoLiquidoG: 25_000 }, 3.6)).toEqual({ comprimentoMm: 90_000, origem: 'pelo peso' });
    expect(comprimentoDoRolo({ pesoLiquidoG: 25_000 }, null)).toBeNull();
  });

  it('o grupo é o lote com a tonalidade; sem eles, fica dito', () => {
    expect(grupoDoRolo(ROLO)).toBe('L10 · A');
    expect(grupoDoRolo({ lote: ' ', tonalidade: '' })).toBe('(sem lote) · (sem tonalidade)');
  });
});

describe('ordens', () => {
  it('código, quantidades inteiras, ao menos um tamanho, prazo como data', () => {
    expect(validarOrdem({ ...ORDEM, codigo: '', quantidadesPorTamanho: { P: 0 }, prazo: '20/10/2026' }, [])).toEqual([
      'Informe o código da ordem de produção.',
      'Informe a quantidade de pelo menos um tamanho.',
      'O prazo precisa ser uma data (dia/mês/ano).',
    ]);
    expect(validarOrdem({ ...ORDEM, quantidadesPorTamanho: { P: 2.5 } }, [])).toEqual(['As quantidades precisam ser números inteiros de 0 para cima.']);
  });

  it('o código não se repete; a ordem sai do cadastro', () => {
    const comOrdem = salvarOrdem(CADASTRO_VAZIO, ORDEM);
    expect(() => salvarOrdem(comOrdem, { ...ORDEM, id: 'o2', codigo: 'op-100' })).toThrow('Já há uma ordem “op-100”');
    expect(removerOrdem(comOrdem, 'o1').ordens).toEqual([]);
  });
});

describe('lerGradeColada', () => {
  it('duas linhas: os tamanhos e as quantidades', () => {
    expect(lerGradeColada('P\tM\tG\n10\t20\t15\n')).toEqual({ quantidades: { P: 10, M: 20, G: 15 }, erros: [] });
    expect(lerGradeColada('P M\n4 6')).toEqual({ quantidades: { P: 4, M: 6 }, erros: [] });
    expect(lerGradeColada('36;38;40\n5;10;5')).toEqual({ quantidades: { 36: 5, 38: 10, 40: 5 }, erros: [] });
  });

  it('um tamanho por linha', () => {
    expect(lerGradeColada('P;40\nM;80\nG;40')).toEqual({ quantidades: { P: 40, M: 80, G: 40 }, erros: [] });
    expect(lerGradeColada('36;10\n38;20')).toEqual({ quantidades: { 36: 10, 38: 20 }, erros: [] });
  });

  it('o ambíguo, o quebrado e o repetido dizem o que houve', () => {
    expect(lerGradeColada('36 38\n10 20').erros[0]).toContain('a grade fica ambígua');
    expect(lerGradeColada('P;10,5').erros).toEqual(['A quantidade do tamanho P (“10,5”) não é um número inteiro.']);
    expect(lerGradeColada('P;1\nP;2').erros).toEqual(['O tamanho P aparece duas vezes.']);
    expect(lerGradeColada(' ').erros).toEqual(['Nada foi colado.']);
  });
});

describe('estoque: reserva, baixa e estorno (cada um, um movimento; nada é apagado)', () => {
  // Malha a 4 m/kg; R1 com 50 m medidos; R2 só com o peso (10 kg → 40 m, estimado).
  const malha = { ...MALHA, rendimentoMmPorG: 4 };
  const base = salvarRolo(
    salvarRolo(salvarMalha(CADASTRO_VAZIO, malha), { ...ROLO, id: 'r1', identificacao: 'R1', comprimentoMedidoMm: 50_000 }),
    { ...ROLO, id: 'r2', identificacao: 'R2', pesoLiquidoG: 10_000 },
  );
  let n = 0;
  const dados = (planoId: string) => ({ planoId, projetoId: 'p1', responsavel: 'Ana', agoraIso: '2026-10-21T10:00:00.000Z', novoId: () => `mov-${++n}` });

  it('o estado do rolo: inicial (medido ou estimado), reservado, consumido, saldo e disponível', () => {
    expect(estadoDoRolo(base, base.rolos[1]!)).toMatchObject({ inicialMm: 40_000, origem: 'pelo peso', consumidoMm: 0, reservadoMm: 0, saldoFisicoMm: 40_000, disponivelMm: 40_000 });
  });

  it('reservar: sai do disponível e fica no saldo; repetir não reserva de novo', () => {
    const r = reservarPlano(base, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A'));
    expect(r.feitos).toEqual(['R1']);
    expect(r.cadastro.movimentos[0]).toMatchObject({ tipo: 'reserva', roloId: 'r1', planoId: 'A', comprimentoMm: 30_000, pesoG: 7500, responsavel: 'Ana' });
    expect(estadoDoRolo(r.cadastro, r.cadastro.rolos[0]!)).toMatchObject({ reservadoMm: 30_000, saldoFisicoMm: 50_000, disponivelMm: 20_000 });
    const denovo = reservarPlano(r.cadastro, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A'));
    expect(denovo).toMatchObject({ feitos: [], jaFeitos: ['R1'] });
    expect(denovo.cadastro.movimentos).toHaveLength(1);
  });

  it('a reserva de outro plano conta: o que passa do disponível é recusado, e nada entra (tudo ou nada)', () => {
    const a = reservarPlano(base, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A')).cadastro;
    expect(estadoDoRolo(a, a.rolos[0]!, 'A').disponivelMm).toBe(50_000);
    expect(() => reservarPlano(a, [{ roloId: 'r2', comprimentoMm: 1000 }, { roloId: 'r1', comprimentoMm: 25_000 }], dados('B'))).toThrow(
      'O rolo R1 tem 20,00 m disponíveis, menos que os 25,00 m do plano.',
    );
  });

  it('a baixa tira do saldo e a reserva do mesmo plano deixa de valer; repetir não baixa duas vezes', () => {
    const reservado = reservarPlano(base, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A')).cadastro;
    const baixado = darBaixaDoPlano(reservado, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A'));
    expect(estadoDoRolo(baixado.cadastro, baixado.cadastro.rolos[0]!)).toMatchObject({ consumidoMm: 30_000, reservadoMm: 0, saldoFisicoMm: 20_000, disponivelMm: 20_000 });
    const denovo = darBaixaDoPlano(baixado.cadastro, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A'));
    expect(denovo.jaFeitos).toEqual(['R1']);
    expect(estadoDoRolo(denovo.cadastro, denovo.cadastro.rolos[0]!).consumidoMm).toBe(30_000);
    // Depois da baixa, reservar o mesmo plano de novo não faz nada.
    expect(reservarPlano(denovo.cadastro, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A')).jaFeitos).toEqual(['R1']);
  });

  it('o estorno desfaz com outro movimento (o histórico fica); não se estorna duas vezes; pede motivo', () => {
    const baixado = darBaixaDoPlano(base, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A')).cadastro;
    const baixa = baixado.movimentos[0]!;
    expect(() => estornarMovimento(baixado, baixa.id, { responsavel: 'Ana', motivo: ' ', agoraIso: 'x', novoId: () => 'e' })).toThrow('Diga o motivo do estorno.');
    const estornado = estornarMovimento(baixado, baixa.id, { responsavel: 'Bruno', motivo: 'corte cancelado', agoraIso: '2026-10-21T11:00:00.000Z', novoId: () => 'e1' });
    expect(estornado.movimentos).toHaveLength(2);
    expect(estornado.movimentos[1]).toMatchObject({ tipo: 'estorno', estornaId: baixa.id, comprimentoMm: 30_000, responsavel: 'Bruno', motivo: 'corte cancelado' });
    expect(estadoDoRolo(estornado, estornado.rolos[0]!)).toMatchObject({ consumidoMm: 0, saldoFisicoMm: 50_000 });
    expect(() => estornarMovimento(estornado, baixa.id, { responsavel: 'Ana', motivo: 'x', agoraIso: 'x', novoId: () => 'e2' })).toThrow('já foi estornado');
    expect(() => estornarMovimento(estornado, 'e1', { responsavel: 'Ana', motivo: 'x', agoraIso: 'x', novoId: () => 'e3' })).toThrow('Um estorno não se estorna');
    expect(movimentosDoPlano(estornado, 'A').map((m) => [m.tipo, m.ativo, m.estornado])).toEqual([
      ['baixa', false, true],
      ['estorno', false, false],
    ]);
    // Estornada a baixa, a operação pode ser feita de novo.
    expect(darBaixaDoPlano(estornado, [{ roloId: 'r1', comprimentoMm: 30_000 }], dados('A')).feitos).toEqual(['R1']);
  });

  it('sem responsável, nenhum movimento', () => {
    expect(() => reservarPlano(base, [{ roloId: 'r1', comprimentoMm: 1 }], { ...dados('A'), responsavel: ' ' })).toThrow('Informe quem está fazendo o movimento de estoque.');
  });

  it('o cadastro da versão 1 abre com o histórico vazio; o movimento inválido fica de fora, dito', () => {
    const v1 = { versaoDoFormato: 1, malhas: [MALHA], rolos: [], ordens: [] };
    expect(lerCadastroDeProducao(v1).cadastro.movimentos).toEqual([]);
    const ruim = lerCadastroDeProducao({ ...v1, movimentos: [{ id: 'm', tipo: 'estorno', roloId: 'r', planoId: 'p', projetoId: 'x', comprimentoMm: 1, dataIso: 'x', responsavel: 'a' }] });
    expect(ruim.descartados).toEqual(['1 registro(s) de movimentos de estoque com dados inválidos ficaram de fora.']);
  });

  it('defeito com posição: fora do rolo e largura zero são recusados', () => {
    const comMedida = { ...ROLO, comprimentoMedidoMm: 10_000 };
    expect(validarRolo({ ...comMedida, defeitos: [{ descricao: 'furo', perdaMm: 500, posicaoMm: 9800 }] }, COM_MALHA)).toContain(
      'Um defeito passa do fim do rolo (posição + extensão maior que o comprimento medido): confira.',
    );
    expect(validarRolo({ ...comMedida, defeitos: [{ descricao: 'furo', perdaMm: 100, posicaoMm: 2000, larguraAfetadaMm: 0 }] }, COM_MALHA)).toContain('A largura afetada de um defeito precisa ser maior que zero.');
    expect(validarRolo({ ...comMedida, defeitos: [{ descricao: 'furo', perdaMm: 100, posicaoMm: 2000, larguraAfetadaMm: 30, tipo: 'furo' }] }, COM_MALHA)).toEqual([]);
  });
});
