import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarTecido, type Tecido } from './tecido';
import { criarProjeto, registrarEvento } from './projeto';
import { gerarRelatorioDeProducao } from './relatorio';

function pecaRetangular(nome: string, tamanho: string, largura: number, altura: number, quantidade = 1, referencia = ''): Molde {
  return criarMolde(
    {
      nome,
      referencia,
      tamanho,
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, altura), ponto(0, altura)],
      linhaDeFio: { inicio: ponto(largura / 2, 5), fim: ponto(largura / 2, altura - 5) },
      quantidade,
    },
    nome,
  );
}

function tecidoDeTeste(): Tecido {
  return criarTecido({ nome: 'Malha PV', referencia: 'TEC-1', larguraTotalMm: 1600, larguraUtilMm: 1500 }, 't1');
}

function enfestoDeTeste(): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1000,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 5,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
  } as ConfiguracaoDeEnfesto);
}

describe('gerarRelatorioDeProducao — campos básicos', () => {
  it('reflete nome, código e status do projeto', () => {
    const projeto = criarProjeto('Camiseta Verão', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas: [],
      tecido: null,
      enfesto: null,
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T11:00:00.000Z');
    expect(relatorio.nomeDoProjeto).toBe('Camiseta Verão');
    expect(relatorio.codigoDoProjeto).toBe('ENF-001');
    expect(relatorio.status).toBe('Em edição');
    expect(relatorio.dataIso).toBe('2026-09-28T11:00:00.000Z');
  });

  it('mostra "não configurado" quando não há tecido, e null para dimensões', () => {
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas: [],
      tecido: null,
      enfesto: null,
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.tecidoNome).toBe('não configurado');
    expect(relatorio.larguraTotalMm).toBeNull();
    expect(relatorio.aproveitamentoPercentual).toBeNull();
    expect(relatorio.desperdicioPercentual).toBeNull();
    expect(relatorio.gramaturaGm2).toBeNull();
    expect(relatorio.quantidadeDisponivelKg).toBeNull();
    expect(relatorio.pesoTotalEstimadoKg).toBeNull();
    expect(relatorio.rendimentoLotes).toBeNull();
  });
});

describe('gerarRelatorioDeProducao — rendimento (gramatura e estoque de tecido)', () => {
  it('sem gramatura configurada, peso e rendimento ficam null mesmo com peças', () => {
    const pecas = [pecaRetangular('a', 'M', 1000, 1000, 1)];
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: tecidoDeTeste(),
      enfesto: enfestoDeTeste(),
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.gramaturaGm2).toBeNull();
    expect(relatorio.pesoTotalEstimadoKg).toBeNull();
    expect(relatorio.pecasPorTamanho[0]!.pesoEstimadoKg).toBeNull();
  });

  it('calcula peso estimado a partir da área real e da gramatura (1m² a 200g/m² = 0.2kg)', () => {
    // Peça de exatamente 1000x1000mm = 1 m².
    const pecas = [pecaRetangular('a', 'M', 1000, 1000, 1)];
    const tecido = criarTecido(
      { nome: 'Malha PV', referencia: 'TEC-1', larguraTotalMm: 1600, larguraUtilMm: 1500, gramaturaGm2: 200 },
      't1',
    );
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido,
      enfesto: enfestoDeTeste(),
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.gramaturaGm2).toBe(200);
    expect(relatorio.pesoTotalEstimadoKg).toBeCloseTo(0.2, 6);
    expect(relatorio.pecasPorTamanho[0]!.pesoEstimadoKg).toBeCloseTo(0.2, 6);
  });

  it('rendimentoLotes: quantos conjuntos iguais cabem no estoque informado', () => {
    // 2 peças de 1 m² cada = 2 m² no projeto; a 500 g/m² = 1kg total por lote.
    const pecas = [pecaRetangular('a', 'M', 1000, 1000, 2)];
    const tecido = criarTecido(
      {
        nome: 'Malha PV',
        referencia: 'TEC-1',
        larguraTotalMm: 1600,
        larguraUtilMm: 1500,
        gramaturaGm2: 500,
        quantidadeDisponivelKg: 4.5,
      },
      't1',
    );
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido,
      enfesto: enfestoDeTeste(),
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.pesoTotalEstimadoKg).toBeCloseTo(1, 6);
    expect(relatorio.quantidadeDisponivelKg).toBe(4.5);
    // 4.5kg de estoque / 1kg por lote = 4 lotes completos (arredondado para baixo).
    expect(relatorio.rendimentoLotes).toBe(4);
  });

  it('rendimentoLotes fica null se só a gramatura ou só o estoque estiver configurado', () => {
    const pecas = [pecaRetangular('a', 'M', 1000, 1000, 1)];
    const tecidoSoGramatura = criarTecido(
      { nome: 'T', referencia: 'R', larguraTotalMm: 1600, larguraUtilMm: 1500, gramaturaGm2: 200 },
      't1',
    );
    const projeto1 = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: tecidoSoGramatura,
      enfesto: enfestoDeTeste(),
    });
    expect(gerarRelatorioDeProducao(projeto1, '2026-09-28T10:00:00.000Z').rendimentoLotes).toBeNull();
  });
});

describe('gerarRelatorioDeProducao — peças por tamanho', () => {
  it('agrupa corretamente por tamanho, somando quantidade', () => {
    const pecas = [
      pecaRetangular('a', 'M', 100, 100, 3),
      pecaRetangular('b', 'M', 80, 80, 2),
      pecaRetangular('c', 'G', 120, 120, 5),
    ];
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: null,
      enfesto: null,
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    const porM = relatorio.pecasPorTamanho.find((l) => l.tamanho === 'M');
    const porG = relatorio.pecasPorTamanho.find((l) => l.tamanho === 'G');
    expect(porM).toEqual({ tamanho: 'M', quantidadeDeModelos: 2, quantidadeTotal: 5, pesoEstimadoKg: null });
    expect(porG).toEqual({ tamanho: 'G', quantidadeDeModelos: 1, quantidadeTotal: 5, pesoEstimadoKg: null });
  });

  it('lista ordenada alfabeticamente por tamanho', () => {
    const pecas = [pecaRetangular('a', 'P', 50, 50), pecaRetangular('b', 'M', 50, 50), pecaRetangular('c', 'G', 50, 50)];
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: null,
      enfesto: null,
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.pecasPorTamanho.map((l) => l.tamanho)).toEqual(['G', 'M', 'P']);
  });
});

describe('gerarRelatorioDeProducao — consumo e aproveitamento', () => {
  it('calcula comprimento utilizado como a maior extensão em Y das peças', () => {
    const pecas = [pecaRetangular('a', 'M', 100, 300), pecaRetangular('b', 'M', 100, 150)];
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: tecidoDeTeste(),
      enfesto: enfestoDeTeste(),
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.comprimentoUtilizadoMm).toBe(300);
  });

  it('aproveitamento + desperdício somam 100%', () => {
    const pecas = [pecaRetangular('a', 'M', 400, 400, 2)];
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: tecidoDeTeste(),
      enfesto: enfestoDeTeste(),
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.aproveitamentoPercentual).not.toBeNull();
    expect(relatorio.aproveitamentoPercentual! + relatorio.desperdicioPercentual!).toBeCloseTo(100, 6);
  });

  it('zero peças resulta em consumo zero, sem NaN/erro', () => {
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas: [],
      tecido: tecidoDeTeste(),
      enfesto: enfestoDeTeste(),
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.comprimentoUtilizadoMm).toBe(0);
    expect(relatorio.aproveitamentoPercentual).toBeNull();
  });
});

describe('gerarRelatorioDeProducao — versão do encaixe e referências', () => {
  it('conta quantas vezes o nesting automático rodou (execucao-de-nesting)', () => {
    let projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas: [],
      tecido: null,
      enfesto: null,
    });
    expect(gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z').versaoDoEncaixe).toBe(0);

    projeto = registrarEvento(projeto, 'execucao-de-nesting', projeto.estadoAtual, '2026-09-28T11:00:00.000Z');
    expect(gerarRelatorioDeProducao(projeto, '2026-09-28T11:00:00.000Z').versaoDoEncaixe).toBe(1);

    projeto = registrarEvento(projeto, 'execucao-de-nesting', projeto.estadoAtual, '2026-09-28T12:00:00.000Z');
    expect(gerarRelatorioDeProducao(projeto, '2026-09-28T12:00:00.000Z').versaoDoEncaixe).toBe(2);
  });

  it('lista referências únicas, ignorando vazias', () => {
    const pecas = [
      pecaRetangular('a', 'M', 50, 50, 1, 'REF-1'),
      pecaRetangular('b', 'M', 50, 50, 1, 'REF-1'),
      pecaRetangular('c', 'M', 50, 50, 1, 'REF-2'),
      pecaRetangular('d', 'M', 50, 50, 1, ''),
    ];
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido: null,
      enfesto: null,
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect([...relatorio.referencias].sort()).toEqual(['REF-1', 'REF-2']);
  });
});
