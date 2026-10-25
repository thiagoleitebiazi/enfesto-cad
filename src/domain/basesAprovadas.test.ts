import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { alterarStatus, criarProjeto, registrarRevisaoDoMolde, type Projeto } from './projeto';
import { aprovarComoBase, basesAprovadas, modeloDaBase, pecasDaBase, tirarDasBases } from './basesAprovadas';

const AGORA = '2026-10-25T10:00:00.000Z';

function peca(id: string, nome: string, y0: number): Molde {
  return criarMolde(
    {
      nome,
      referencia: 'BASE',
      tamanho: 'M',
      contorno: [ponto(0, y0), ponto(0, y0 + 200), ponto(500, y0 + 200), ponto(500, y0)],
      linhaDeFio: { inicio: ponto(50, y0 + 100), fim: ponto(450, y0 + 100) },
    },
    id,
  );
}

function projeto(id: string, nome: string, pecas: readonly Molde[]): Projeto {
  return criarProjeto(nome, id, `ENF-${id}`, '2026-10-01T10:00:00.000Z', { pecas, tecido: null, enfesto: null });
}

const camisa = (): Projeto => projeto('camisa', 'Camisa base', [peca('f', 'Frente', 0), peca('c', 'Costas', 260)]);

describe('a biblioteca de bases aprovadas (ADR 0126)', () => {
  it('aprovar: quem aprova e a nota ficam no projeto; sem quem aprova, ou sem peças, não', () => {
    const aprovada = aprovarComoBase(camisa(), { responsavel: ' Ana ', nota: ' camisa social, tabela 2026 ' }, AGORA);
    expect(aprovada.base).toEqual({ aprovadaEmIso: AGORA, responsavel: 'Ana', nota: 'camisa social, tabela 2026' });
    expect(aprovada.modificadoEmIso).toBe(AGORA);
    expect(() => aprovarComoBase(camisa(), { responsavel: '  ', nota: '' }, AGORA)).toThrow('Informe quem aprova a base.');
    expect(() => aprovarComoBase(projeto('v', 'Vazio', []), { responsavel: 'Ana', nota: '' }, AGORA)).toThrow('não tem peças');
    const tirada = tirarDasBases(aprovada, '2026-10-26T10:00:00.000Z');
    expect('base' in tirada).toBe(false);
    expect(tirada.modificadoEmIso).toBe('2026-10-26T10:00:00.000Z');
  });

  it('as bases para escolher: só as aprovadas e não arquivadas, pelo nome', () => {
    const calca = aprovarComoBase(projeto('calca', 'Calça base', [peca('f', 'Frente', 0)]), { responsavel: 'Bia', nota: '' }, AGORA);
    const arquivada = alterarStatus(aprovarComoBase(projeto('saia', 'Saia base', [peca('f', 'Frente', 0)]), { responsavel: 'Bia', nota: '' }, AGORA), 'arquivado', AGORA);
    const aprovada = aprovarComoBase(camisa(), { responsavel: 'Ana', nota: '' }, AGORA);
    expect(basesAprovadas([aprovada, projeto('x', 'Outro', []), arquivada, calca]).map((p) => p.nome)).toEqual(['Calça base', 'Camisa base']);
  });

  it('o modelo novo: as peças e o que vale para o modelo todo vêm da base; o histórico e a ficha ficam nela', () => {
    const comRevisao = registrarRevisaoDoMolde(camisa(), { responsavel: 'Ana', descricao: 'Primeira', impressaoDigital: 'aaaa' }, AGORA);
    const base: Projeto = {
      ...aprovarComoBase(comRevisao, { responsavel: 'Ana', nota: '' }, AGORA),
      regrasDeCaimento: { folgas: {} } as unknown as NonNullable<Projeto['regrasDeCaimento']>,
      fichaTecnica: { campos: {} } as unknown as NonNullable<Projeto['fichaTecnica']>,
    };
    const modelo = modeloDaBase(base, ' Camisa listrada ', 'm1', 'ENF-m1', '2026-10-26T09:00:00.000Z', 'aaaa');
    expect(modelo.nome).toBe('Camisa listrada');
    expect(modelo.id).toBe('m1');
    expect(modelo.estadoAtual.pecas).toEqual(base.estadoAtual.pecas);
    expect(modelo.feitoDaBase).toEqual({ id: 'camisa', nome: 'Camisa base', codigo: 'ENF-camisa', revisao: 1, emIso: '2026-10-26T09:00:00.000Z' });
    expect(modelo.historico).toHaveLength(1);
    expect(modelo.historico[0]!.descricao).toBe('Feito da base “Camisa base” (ENF-camisa), revisão 1 do molde');
    expect(modelo.regrasDeCaimento).toBe(base.regrasDeCaimento);
    expect(modelo.fichaTecnica).toBeUndefined();
    expect(modelo.base).toBeUndefined();
    expect(modelo.revisoesDoMolde).toBeUndefined();
    // As peças mudaram depois da revisão: o modelo não diz revisão.
    expect(modeloDaBase(base, 'Outra', 'm2', 'ENF-m2', AGORA, 'bbbb').feitoDaBase!.revisao).toBeUndefined();
    expect(() => modeloDaBase(camisa(), 'Outra', 'm3', 'ENF-m3', AGORA, 'aaaa')).toThrow('não é uma base aprovada');
    expect(() => modeloDaBase(base, ' ', 'm4', 'ENF-m4', AGORA, 'aaaa')).toThrow('Informe o nome do modelo novo.');
  });

  it('as peças da base no projeto aberto: ids novos, à direita das que já estão, sem cair em cima', () => {
    const base = aprovarComoBase(projeto('manga', 'Manga base', [peca('m', 'Manga', 1000)]), { responsavel: 'Ana', nota: '' }, AGORA);
    const doProjeto = [peca('f', 'Frente', 0), peca('c', 'Costas', 260)];
    let n = 0;
    const novas = pecasDaBase(base, doProjeto, () => `nova-${++n}`);
    expect(novas.map((p) => p.id)).toEqual(['nova-1']);
    expect(novas[0]!.nome).toBe('Manga');
    const caixa = retanguloEnvolvente(novas[0]!.contorno);
    expect(caixa.minY).toBe(460 + 40);
    expect(caixa.minX).toBe(0);
    // No projeto vazio, ficam onde estavam na base.
    expect(retanguloEnvolvente(pecasDaBase(base, [], () => 'x')[0]!.contorno).minY).toBe(1000);
  });
});
