import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pastaDeDadosDeSempre } from './pastaDeDados';

const DADOS = path.join('C:', 'Users', 'ana', 'AppData', 'Roaming');

describe('a pasta de dados depois da troca do nome (ADR 0238)', () => {
  it('a pasta que o Electron daria pelo nome novo volta para a de sempre: os projetos não somem', () => {
    expect(pastaDeDadosDeSempre(path.join(DADOS, 'Enfesto'), 'Enfesto', DADOS)).toBe(path.join(DADOS, 'enfesto-cad'));
  });

  it('a de sempre fica como está', () => {
    expect(pastaDeDadosDeSempre(path.join(DADOS, 'enfesto-cad'), 'enfesto-cad', DADOS)).toBeNull();
  });

  it('a escolhida por quem abre, e a dos testes, ficam como estão: o teste nunca pode cair nos dados de verdade', () => {
    expect(pastaDeDadosDeSempre(path.join('C:', 'Temp', 'enfesto-cad-uso-x1'), 'Enfesto', DADOS)).toBeNull();
    expect(pastaDeDadosDeSempre(path.join('C:', 'rascunho', 'dados'), 'Enfesto', DADOS)).toBeNull();
  });
});
