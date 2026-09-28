import { describe, it, expect } from 'vitest';
import {
  criarProjeto,
  registrarEvento,
  restaurarVersao,
  alterarStatus,
  renomearProjeto,
  filtrarProjetos,
  ordenarPorMaisRecente,
  gerarCodigoDeProjeto,
  type EstadoDoProjeto,
  type Projeto,
} from './projeto';

const ESTADO_VAZIO: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };

describe('gerarCodigoDeProjeto', () => {
  it('gera um código com data e sequencial', () => {
    expect(gerarCodigoDeProjeto('2026-09-28T10:00:00.000Z', 1)).toMatch(/^ENF-\d{8}-001$/);
  });

  it('preenche o sequencial com zeros à esquerda', () => {
    expect(gerarCodigoDeProjeto('2026-01-05T00:00:00.000Z', 42)).toContain('-042');
  });
});

describe('criarProjeto', () => {
  it('começa com status em-edicao e um único evento de criação', () => {
    const projeto = criarProjeto('Meu Projeto', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    expect(projeto.status).toBe('em-edicao');
    expect(projeto.historico).toHaveLength(1);
    expect(projeto.historico[0]!.tipo).toBe('criacao');
    expect(projeto.estadoAtual).toBe(ESTADO_VAZIO);
  });
});

describe('registrarEvento', () => {
  it('adiciona um novo evento sem remover os anteriores', () => {
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    const novoEstado: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };
    const atualizado = registrarEvento(projeto, 'salvamento', novoEstado, '2026-09-28T11:00:00.000Z');
    expect(atualizado.historico).toHaveLength(2);
    expect(atualizado.historico[0]!.tipo).toBe('criacao');
    expect(atualizado.historico[1]!.tipo).toBe('salvamento');
    expect(atualizado.estadoAtual).toBe(novoEstado);
    expect(atualizado.modificadoEmIso).toBe('2026-09-28T11:00:00.000Z');
  });

  it('cada evento recebe um id único derivado da posição no histórico', () => {
    let projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    projeto = registrarEvento(projeto, 'salvamento', ESTADO_VAZIO, '2026-09-28T11:00:00.000Z');
    projeto = registrarEvento(projeto, 'salvamento', ESTADO_VAZIO, '2026-09-28T12:00:00.000Z');
    const ids = projeto.historico.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('restaurarVersao', () => {
  it('restaura o estado de um evento antigo SEM apagar o histórico', () => {
    const estadoOriginal: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };
    let projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', estadoOriginal);
    const idDoEventoOriginal = projeto.historico[0]!.id;

    const estadoModificado: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };
    projeto = registrarEvento(projeto, 'mudanca-de-moldes', estadoModificado, '2026-09-28T11:00:00.000Z');
    expect(projeto.estadoAtual).toBe(estadoModificado);

    const restaurado = restaurarVersao(projeto, idDoEventoOriginal, '2026-09-28T12:00:00.000Z');
    expect(restaurado.estadoAtual).toBe(estadoOriginal);
    // Histórico cresce (novo evento de restauração), nada é removido.
    expect(restaurado.historico).toHaveLength(3);
    expect(restaurado.historico[2]!.tipo).toBe('restauracao-de-versao');
    expect(restaurado.historico[0]).toBe(projeto.historico[0]);
    expect(restaurado.historico[1]).toBe(projeto.historico[1]);
  });

  it('lança erro para um id de evento inexistente', () => {
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    expect(() => restaurarVersao(projeto, 'id-que-nao-existe', '2026-09-28T12:00:00.000Z')).toThrow();
  });
});

describe('alterarStatus / renomearProjeto', () => {
  it('altera o status e a data de modificação', () => {
    const projeto = criarProjeto('P', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    const atualizado = alterarStatus(projeto, 'pronto-para-producao', '2026-09-28T11:00:00.000Z');
    expect(atualizado.status).toBe('pronto-para-producao');
    expect(atualizado.modificadoEmIso).toBe('2026-09-28T11:00:00.000Z');
  });

  it('renomeia sem afetar o histórico', () => {
    const projeto = criarProjeto('Nome antigo', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    const atualizado = renomearProjeto(projeto, 'Nome novo', '2026-09-28T11:00:00.000Z');
    expect(atualizado.nome).toBe('Nome novo');
    expect(atualizado.historico).toHaveLength(1);
  });
});

describe('filtrarProjetos', () => {
  function projetoDeTeste(nome: string, codigo: string, status: Projeto['status']): Projeto {
    return alterarStatus(
      criarProjeto(nome, `id-${codigo}`, codigo, '2026-09-28T10:00:00.000Z', ESTADO_VAZIO),
      status,
      '2026-09-28T10:00:00.000Z',
    );
  }

  it('filtra por nome (case-insensitive)', () => {
    const projetos = [projetoDeTeste('Camiseta Verão', 'ENF-001', 'em-edicao'), projetoDeTeste('Calça Jeans', 'ENF-002', 'em-edicao')];
    expect(filtrarProjetos(projetos, 'camiseta', 'todos')).toHaveLength(1);
    expect(filtrarProjetos(projetos, 'CALÇA', 'todos')).toHaveLength(1);
  });

  it('filtra por código', () => {
    const projetos = [projetoDeTeste('A', 'ENF-001', 'em-edicao'), projetoDeTeste('B', 'ENF-002', 'em-edicao')];
    expect(filtrarProjetos(projetos, 'ENF-002', 'todos')).toHaveLength(1);
  });

  it('filtra por status', () => {
    const projetos = [projetoDeTeste('A', 'ENF-001', 'em-edicao'), projetoDeTeste('B', 'ENF-002', 'arquivado')];
    expect(filtrarProjetos(projetos, '', 'arquivado')).toHaveLength(1);
    expect(filtrarProjetos(projetos, '', 'arquivado')[0]!.nome).toBe('B');
  });

  it('combina texto e status', () => {
    const projetos = [
      projetoDeTeste('Camiseta', 'ENF-001', 'em-edicao'),
      projetoDeTeste('Camiseta', 'ENF-002', 'arquivado'),
    ];
    expect(filtrarProjetos(projetos, 'camiseta', 'arquivado')).toHaveLength(1);
  });

  it('string vazia não filtra por texto', () => {
    const projetos = [projetoDeTeste('A', 'ENF-001', 'em-edicao'), projetoDeTeste('B', 'ENF-002', 'em-edicao')];
    expect(filtrarProjetos(projetos, '', 'todos')).toHaveLength(2);
  });
});

describe('ordenarPorMaisRecente', () => {
  it('ordena com o mais recentemente modificado primeiro', () => {
    const antigo = criarProjeto('Antigo', 'p1', 'ENF-001', '2026-09-01T10:00:00.000Z', ESTADO_VAZIO);
    const recente = criarProjeto('Recente', 'p2', 'ENF-002', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    const ordenado = ordenarPorMaisRecente([antigo, recente]);
    expect(ordenado[0]!.nome).toBe('Recente');
    expect(ordenado[1]!.nome).toBe('Antigo');
  });

  it('não modifica o array original', () => {
    const a = criarProjeto('A', 'p1', 'ENF-001', '2026-09-01T10:00:00.000Z', ESTADO_VAZIO);
    const b = criarProjeto('B', 'p2', 'ENF-002', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);
    const original = [a, b];
    ordenarPorMaisRecente(original);
    expect(original[0]).toBe(a);
  });
});
