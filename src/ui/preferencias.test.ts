import { afterEach, describe, expect, it } from 'vitest';
import { aplicarEsquema, aplicarPerfil, combinacaoDaTecla, esquemaGuardado, perfilAtual, restaurarPadroes } from './preferencias';

afterEach(() => window.localStorage.clear());

const tecla = (key: string, o: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...o });

describe('o perfil (ADR 0176)', () => {
  it('salva só as preferências do programa; carregar troca as de agora; o que não é perfil é recusado', () => {
    const a = window.localStorage;
    a.setItem('enfesto-cad:favoritos', '[1]');
    a.setItem('outro-programa', 'x');
    const perfil = perfilAtual(a);
    expect(perfil).not.toContain('outro-programa');
    a.setItem('enfesto-cad:nome-na-rede', 'Ana');
    expect(aplicarPerfil(a, perfil)).toBe(1);
    expect(a.getItem('enfesto-cad:favoritos')).toBe('[1]');
    expect(a.getItem('enfesto-cad:nome-na-rede')).toBeNull();
    expect(a.getItem('outro-programa')).toBe('x');
    expect(() => aplicarPerfil(a, '{"x":1}')).toThrow(/não é um perfil/);
    expect(() => aplicarPerfil(a, 'quebrado')).toThrow(/não é um perfil/);
    expect(a.getItem('enfesto-cad:favoritos')).toBe('[1]');
  });

  it('restaurar os padrões tira só as do programa', () => {
    const a = window.localStorage;
    a.setItem('enfesto-cad:favoritos', '[1]');
    a.setItem('outro-programa', 'x');
    restaurarPadroes(a);
    expect(a.length).toBe(1);
  });
});

describe('as teclas de atalho (ADR 0175)', () => {
  it('só com Ctrl, Alt ou uma tecla F; a letra em maiúscula; o Cmd do Mac conta como Ctrl', () => {
    expect(combinacaoDaTecla(tecla('k', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+K');
    expect(combinacaoDaTecla(tecla('p', { altKey: true }))).toBe('Alt+P');
    expect(combinacaoDaTecla(tecla('F7'))).toBe('F7');
    expect(combinacaoDaTecla(tecla('k', { metaKey: true }))).toBe('Ctrl+K');
    expect(combinacaoDaTecla(tecla('k'))).toBeNull();
    expect(combinacaoDaTecla(tecla('Control', { ctrlKey: true }))).toBeNull();
  });
});

describe('o esquema de cores (ADR 0177)', () => {
  it('fica na raiz e guardado; o desconhecido volta ao padrão', () => {
    const a = window.localStorage;
    const raiz = document.createElement('html');
    expect(esquemaGuardado(a)).toBe('padrao');
    aplicarEsquema('escuro', a, raiz);
    expect(raiz.dataset.esquema).toBe('escuro');
    expect(esquemaGuardado(a)).toBe('escuro');
    a.setItem('enfesto-cad:esquema-de-cores', 'roxo');
    expect(esquemaGuardado(a)).toBe('padrao');
  });
});
