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
  proximoCodigoDeProjeto,
  criarVariante,
  variantesDoProjeto,
  nomeDaProximaVariante,
  definirAutor,
  TAMANHO_MAXIMO_DO_AUTOR,
  lerProjeto,
  lerBiblioteca,
  registrarRevisaoDoMolde,
  revisaoAtualDoMolde,
  VERSAO_DO_FORMATO_DO_PROJETO,
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

describe('definirAutor', () => {
  const projeto = criarProjeto('Camisa', 'p1', 'ENF-001', '2026-09-28T10:00:00.000Z', ESTADO_VAZIO);

  it('guarda o autor sem os espaços das pontas e marca a data da mudança', () => {
    const comAutor = definirAutor(projeto, '  Maria Souza ', '2026-10-10T12:00:00.000Z');

    expect(comAutor.autor).toBe('Maria Souza');
    expect(comAutor.modificadoEmIso).toBe('2026-10-10T12:00:00.000Z');
    expect(comAutor.historico).toBe(projeto.historico);
    expect(comAutor.estadoAtual).toBe(projeto.estadoAtual);
  });

  it('em branco, o projeto fica sem o campo', () => {
    const comAutor = definirAutor(projeto, 'Maria', '2026-10-10T12:00:00.000Z');
    const semAutor = definirAutor(comAutor, '   ', '2026-10-11T12:00:00.000Z');

    expect('autor' in semAutor).toBe(false);
    expect(semAutor.modificadoEmIso).toBe('2026-10-11T12:00:00.000Z');
  });

  it('a variante do modelo leva o autor; a de um modelo sem autor fica sem o campo', () => {
    const comAutor = definirAutor(projeto, 'Maria', '2026-10-10T12:00:00.000Z');

    expect(criarVariante(comAutor, 'Camisa — variante 2', 'p2', 'ENF-002', '2026-10-11T12:00:00.000Z', ESTADO_VAZIO).autor).toBe('Maria');
    expect('autor' in criarVariante(projeto, 'Camisa — variante 2', 'p2', 'ENF-002', '2026-10-11T12:00:00.000Z', ESTADO_VAZIO)).toBe(false);
  });

  it('aceita até o tamanho máximo e recusa acima dele', () => {
    expect(definirAutor(projeto, 'a'.repeat(TAMANHO_MAXIMO_DO_AUTOR), '2026-10-10T12:00:00.000Z').autor).toHaveLength(80);
    expect(() => definirAutor(projeto, 'a'.repeat(TAMANHO_MAXIMO_DO_AUTOR + 1), '2026-10-10T12:00:00.000Z')).toThrow('até 80 caracteres');
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

describe('variantes do projeto', () => {
  const original = criarProjeto('Camisa', 'p1', 'ENF-001', '2026-10-01T10:00:00.000Z', ESTADO_VAZIO);
  const estadoDaVariante: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };
  const variante2 = criarVariante(original, 'Camisa — variante 2', 'p2', 'ENF-002', '2026-10-02T10:00:00.000Z', estadoDaVariante);
  const outro = criarProjeto('Calça', 'p9', 'ENF-009', '2026-10-01T12:00:00.000Z', ESTADO_VAZIO);

  it('a variante é um projeto novo, com histórico próprio, ligado ao original', () => {
    expect(variante2).toMatchObject({ id: 'p2', nome: 'Camisa — variante 2', varianteDe: 'p1', status: 'em-edicao' });
    expect(variante2.historico).toHaveLength(1);
    expect(variante2.estadoAtual).toBe(estadoDaVariante);
    expect(original.varianteDe).toBeUndefined();
  });

  it('a variante de uma variante continua ligada ao mesmo original', () => {
    const variante3 = criarVariante(variante2, 'Camisa — variante 3', 'p3', 'ENF-003', '2026-10-03T10:00:00.000Z', ESTADO_VAZIO);
    expect(variante3.varianteDe).toBe('p1');
  });

  it('lista a família inteira a partir de qualquer membro, da mais antiga à mais nova', () => {
    const variante3 = criarVariante(variante2, 'Camisa — variante 3', 'p3', 'ENF-003', '2026-10-03T10:00:00.000Z', ESTADO_VAZIO);
    const biblioteca = [variante3, outro, original, variante2];
    expect(variantesDoProjeto(biblioteca, original).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(variantesDoProjeto(biblioteca, variante3).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(variantesDoProjeto(biblioteca, outro).map((p) => p.id)).toEqual(['p9']);
  });

  it('o projeto aberto entra na lista como está agora, mesmo que a biblioteca tenha uma cópia antiga ou nenhuma', () => {
    const renomeado = renomearProjeto(original, 'Camisa social', '2026-10-04T10:00:00.000Z');
    expect(variantesDoProjeto([original, variante2], renomeado).map((p) => p.nome)).toEqual(['Camisa social', 'Camisa — variante 2']);
    expect(variantesDoProjeto([], original).map((p) => p.id)).toEqual(['p1']);
  });

  it('sugere o nome da próxima variante pelo nome do original e pelo tamanho da família', () => {
    expect(nomeDaProximaVariante([], original)).toBe('Camisa — variante 2');
    expect(nomeDaProximaVariante([original, variante2], variante2)).toBe('Camisa — variante 3');
  });

  it('sem o original na biblioteca, usa o nome do projeto aberto sem repetir o sufixo, e não repete um número já usado', () => {
    expect(nomeDaProximaVariante([variante2], variante2)).toBe('Camisa — variante 3');
  });
});

describe('proximoCodigoDeProjeto', () => {
  const hoje = '2026-10-17T12:00:00';
  it('o primeiro do dia é o 001', () => {
    expect(proximoCodigoDeProjeto(hoje, [])).toBe('ENF-20261017-001');
  });

  it('o seguinte ao maior do mesmo dia, sem contar os de outros dias', () => {
    expect(proximoCodigoDeProjeto(hoje, ['ENF-20261017-001', 'ENF-20261017-004', 'ENF-20261016-009'])).toBe('ENF-20261017-005');
    expect(proximoCodigoDeProjeto(hoje, ['ENF-20261016-009'])).toBe('ENF-20261017-001');
  });

  it('ignora o que não é um código do programa', () => {
    expect(proximoCodigoDeProjeto(hoje, ['ENF-20261017-xyz', 'outra coisa', 'ENF-20261017-', 'ENF-20261017-2.5'])).toBe('ENF-20261017-001');
  });

  it('o maior vale, em qualquer ordem', () => {
    expect(proximoCodigoDeProjeto(hoje, ['ENF-20261017-004', 'ENF-20261017-002'])).toBe('ENF-20261017-005');
  });
});

describe('formato do projeto: versão, migração e projetos antigos', () => {
  // Um projeto como os gravados antes da versão do formato (o de 2026-09-30, por exemplo), com um campo que esta
  // versão não conhece.
  const ANTIGO = {
    id: 'projeto-antigo',
    nome: 'Camiseta',
    codigo: 'ENF-20260930-001',
    criadoEmIso: '2026-09-30T10:00:00.000Z',
    modificadoEmIso: '2026-09-30T11:00:00.000Z',
    status: 'em-edicao',
    estadoAtual: ESTADO_VAZIO,
    historico: [{ id: 'projeto-antigo-hist-0', tipo: 'criacao', dataHoraIso: '2026-09-30T10:00:00.000Z', estado: ESTADO_VAZIO }],
    campoQueEstaVersaoNaoConhece: { a: 1 },
  };

  it('o projeto novo já sai na versão atual', () => {
    expect(criarProjeto('P', 'p1', 'ENF-1', '2026-10-20T10:00:00.000Z', ESTADO_VAZIO).versaoDoFormato).toBe(VERSAO_DO_FORMATO_DO_PROJETO);
  });

  it('o antigo abre: ganha a versão, e nada some (nem o campo desconhecido)', () => {
    const lido = lerProjeto(JSON.parse(JSON.stringify(ANTIGO)));
    if (!lido.ok) throw new Error(lido.erro);
    expect(lido).toMatchObject({ versaoLida: 1, migrado: true, maisNovo: false });
    expect(lido.projeto).toEqual({ ...ANTIGO, versaoDoFormato: 2 });
  });

  it('o da versão atual não é migrado; o de uma versão mais nova abre, marcado', () => {
    const atual = lerProjeto({ ...ANTIGO, versaoDoFormato: 2 });
    expect(atual.ok && atual.migrado).toBe(false);
    const novo = lerProjeto({ ...ANTIGO, versaoDoFormato: 3 });
    expect(novo.ok && novo.maisNovo && novo.projeto.versaoDoFormato).toBe(3);
  });

  it('o que não é projeto é recusado com o motivo', () => {
    expect(lerProjeto([1])).toEqual({ ok: false, erro: 'O arquivo não é um projeto (formato desconhecido).' });
    expect(lerProjeto({ ...ANTIGO, id: 7 })).toEqual({ ok: false, erro: 'O projeto não tem id.' });
    expect(lerProjeto({ ...ANTIGO, historico: null })).toEqual({ ok: false, erro: 'O projeto "Camiseta" não tem o histórico.' });
    expect(lerProjeto({ arquivoIlegivel: 'x.json' })).toEqual({ ok: false, erro: 'O arquivo "x.json" não pôde ser lido (está quebrado).' });
  });

  it('a biblioteca lê todos, diz o que ficou de fora e o que é de versão mais nova', () => {
    const lida = lerBiblioteca([ANTIGO, { arquivoIlegivel: 'quebrado.json' }, { ...ANTIGO, id: 'p2', nome: 'Calça', versaoDoFormato: 9 }]);
    expect(lida.projetos.map((p) => p.id)).toEqual(['projeto-antigo', 'p2']);
    expect(lida.avisos).toEqual([
      '1 arquivo(s) da pasta de projetos não puderam ser lidos e ficaram de fora (nada foi apagado): O arquivo "quebrado.json" não pôde ser lido (está quebrado).',
      'Gravado(s) por uma versão mais nova do programa: Calça. Abre, mas o que esta versão não conhece pode não aparecer.',
    ]);
  });
});

describe('revisões do molde', () => {
  const base = criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-20T10:00:00.000Z', ESTADO_VAZIO);

  it('a primeira revisão é a 1, presa a um evento do histórico com as peças de então', () => {
    const r1 = registrarRevisaoDoMolde(base, { responsavel: ' Ana ', descricao: 'Primeira revisão', impressaoDigital: 'aaaa' }, '2026-10-20T11:00:00.000Z');
    expect(r1.revisoesDoMolde).toEqual([
      { numero: 1, criadaEmIso: '2026-10-20T11:00:00.000Z', responsavel: 'Ana', descricao: 'Primeira revisão', impressaoDigital: 'aaaa', eventoId: 'p1-hist-1' },
    ]);
    expect(r1.historico.at(-1)).toMatchObject({ id: 'p1-hist-1', tipo: 'revisao-do-molde', descricao: 'Revisão 1 do molde, por Ana: Primeira revisão' });
  });

  it('sem mudança nas peças não há revisão nova; com mudança, a seguinte', () => {
    const r1 = registrarRevisaoDoMolde(base, { responsavel: 'Ana', descricao: 'Primeira', impressaoDigital: 'aaaa' }, '2026-10-20T11:00:00.000Z');
    expect(() => registrarRevisaoDoMolde(r1, { responsavel: 'Ana', descricao: 'De novo', impressaoDigital: 'aaaa' }, '2026-10-20T12:00:00.000Z')).toThrow(
      'As peças não mudaram desde a revisão 1',
    );
    const r2 = registrarRevisaoDoMolde(r1, { responsavel: 'Bruno', descricao: 'Manga mais longa', impressaoDigital: 'bbbb' }, '2026-10-20T12:00:00.000Z');
    expect(r2.revisoesDoMolde!.map((r) => r.numero)).toEqual([1, 2]);
    expect(revisaoAtualDoMolde(r2, 'bbbb')?.numero).toBe(2);
    expect(revisaoAtualDoMolde(r2, 'aaaa')?.numero).toBe(1);
    expect(revisaoAtualDoMolde(r2, 'cccc')).toBeNull();
  });

  it('sem responsável ou sem descrição, recusa', () => {
    expect(() => registrarRevisaoDoMolde(base, { responsavel: ' ', descricao: 'x', impressaoDigital: 'a' }, '2026-10-20T11:00:00.000Z')).toThrow('Informe quem');
    expect(() => registrarRevisaoDoMolde(base, { responsavel: 'Ana', descricao: '', impressaoDigital: 'a' }, '2026-10-20T11:00:00.000Z')).toThrow('Descreva a revisão');
  });
});
