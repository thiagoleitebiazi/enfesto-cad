import { describe, expect, it } from 'vitest';
import { aprovarFicha, enviarParaAprovacao, novaFichaTecnica, type FichaTecnica } from './fichaTecnica';
import type { Material } from './materiais';
import { criarProjeto, type Projeto } from './projeto';
import { recadoDaTroca, trocarMaterialNosModelos } from './trocaDeMaterial';

const AGORA = '2026-10-26T10:00:00.000Z';
const material = (id: string, descricao: string, unidade: Material['unidade'] = 'm'): Material => ({ id, codigo: id.toUpperCase(), descricao, categoria: 'tecido', unidade, precoPorUnidade: 20, atualizadoEmIso: AGORA });
const malhaVelha = material('velha', 'Malha PV');
const malhaNova = material('nova', 'Malha PV premium');

function modelo(id: string, comMaterial: boolean, situacao: 'rascunho' | 'aprovada' = 'rascunho'): Projeto {
  let ficha: FichaTecnica = {
    ...novaFichaTecnica({ nome: id, codigo: id, pecas: [] }, AGORA),
    materiais: [
      ...(comMaterial ? [{ id: 'i1', materialId: 'velha', descricao: 'Malha PV', aplicacao: 'Corpo', unidade: 'm' as const, consumo: { tipo: 'informado' as const, quantidade: 1.2 } }] : []),
      { id: 'i2', materialId: null, descricao: 'Etiqueta', aplicacao: 'Gola', unidade: 'un' as const, consumo: { tipo: 'informado' as const, quantidade: 1 } },
    ],
  };
  if (situacao === 'aprovada') ficha = aprovarFicha(enviarParaAprovacao(ficha, 'Ana', '', AGORA), 'Bia', '', AGORA, null);
  return { ...criarProjeto(`Modelo ${id}`, id, `ENF-${id}`, AGORA, { pecas: [], tecido: null, enfesto: null }), fichaTecnica: ficha };
}

describe('trocar um material em todos os modelos (ADR 0137)', () => {
  it('os modelos com a ficha aberta trocam, com o mesmo consumo e aplicação; os aprovados ficam e são ditos', () => {
    const t = trocarMaterialNosModelos([modelo('a', true), modelo('b', false), modelo('c', true, 'aprovada')], malhaVelha, malhaNova, AGORA);
    expect(t.mudados.map((p) => p.id)).toEqual(['a']);
    const item = t.mudados[0]!.fichaTecnica!.materiais[0]!;
    expect(item).toMatchObject({ materialId: 'nova', descricao: 'Malha PV premium', aplicacao: 'Corpo', consumo: { tipo: 'informado', quantidade: 1.2 } });
    expect(t.mudados[0]!.fichaTecnica!.materiais[1]!.descricao).toBe('Etiqueta');
    expect(t.trocados).toEqual([{ nome: 'Modelo a', codigo: 'ENF-a', itens: 1 }]);
    expect(t.fechados).toEqual([{ nome: 'Modelo c', codigo: 'ENF-c' }]);
    expect(recadoDaTroca(t, malhaVelha, malhaNova)).toBe(
      '“Malha PV” trocado por “Malha PV premium” em 1 modelo(s): Modelo a (ENF-a). Com a ficha aprovada ou em aprovação, ficaram como estavam: Modelo c (ENF-c) — abra uma nova versão da ficha para trocar.',
    );
  });

  it('o mesmo material, ou outra unidade, não', () => {
    expect(() => trocarMaterialNosModelos([], malhaVelha, malhaVelha, AGORA)).toThrow('Escolha outro material');
    expect(() => trocarMaterialNosModelos([], malhaVelha, material('kg', 'Malha a quilo', 'kg'), AGORA)).toThrow('mesma unidade');
  });
});
