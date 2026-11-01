import { PIQUE_PADRAO } from '../domain/piques';
import { corDoTamanho, coresDosTamanhosGuardadas, estiloDaCosturaGuardado, guardarCoresDosTamanhos, guardarEstiloDaCostura, guardarPiquePadrao, piquePadraoGuardado, TRACOS_DA_COSTURA } from './preferencias';
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

describe('o pique padrão, o estilo da costura e as cores dos tamanhos (ADR 0182)', () => {
  const memoria = (): Pick<Storage, 'getItem' | 'setItem'> => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };

  it('o pique padrão volta como foi guardado; sem nada ou estragado, é o do programa', () => {
    const a = memoria();
    expect(piquePadraoGuardado(a)).toBe(PIQUE_PADRAO);
    guardarPiquePadrao(a, { larguraMm: 3, alturaMm: 8, anguloGraus: 15 });
    expect(piquePadraoGuardado(a)).toEqual({ ...PIQUE_PADRAO, larguraMm: 3, alturaMm: 8, anguloGraus: 15 });
    a.setItem('enfesto-cad:pique-padrao', '{quebrado');
    expect(piquePadraoGuardado(a)).toBe(PIQUE_PADRAO);
  });

  it('o estilo da costura é lembrado, e cada um tem o seu traço', () => {
    const a = memoria();
    expect(estiloDaCosturaGuardado(a)).toBe('tracejada');
    guardarEstiloDaCostura(a, 'continua');
    expect(estiloDaCosturaGuardado(a)).toBe('continua');
    expect(TRACOS_DA_COSTURA.continua).toEqual([]);
    a.setItem('enfesto-cad:estilo-da-costura', 'outra');
    expect(estiloDaCosturaGuardado(a)).toBe('tracejada');
  });

  it('a cor escolhida vale; sem ela, cada posição tem a sua da paleta', () => {
    expect(corDoTamanho('M', 0, { M: '#123456' })).toBe('#123456');
    expect(corDoTamanho('P', 0, {})).not.toBe(corDoTamanho('G', 1, {}));
    expect(corDoTamanho('P', 0, {})).toBe(corDoTamanho('Z', 7, {}));
  });

  it('as cores lembradas descartam o que não é cor', () => {
    const a = memoria();
    guardarCoresDosTamanhos(a, { P: '#112233' });
    expect(coresDosTamanhosGuardadas(a)).toEqual({ P: '#112233' });
    a.setItem('enfesto-cad:cores-dos-tamanhos', JSON.stringify({ P: '#112233', G: 'url(x)' }));
    expect(coresDosTamanhosGuardadas(a)).toEqual({ P: '#112233' });
  });
});

