import { describe, expect, it } from 'vitest';
import { ehCampoDeDigitar } from './campoDeDigitar';

function campo(tipo: string): HTMLInputElement {
  const i = document.createElement('input');
  i.type = tipo;
  return i;
}

describe('ehCampoDeDigitar', () => {
  it.each(['text', 'number', 'search', 'email', 'password'])('o campo "%s" recebe texto', (tipo) => {
    expect(ehCampoDeDigitar(campo(tipo))).toBe(true);
  });

  it.each(['checkbox', 'radio', 'button', 'range', 'color', 'file'])('o "%s" não recebe texto: os atalhos valem', (tipo) => {
    expect(ehCampoDeDigitar(campo(tipo))).toBe(false);
  });

  it('a área de texto e a lista de escolha recebem o que se digita', () => {
    expect(ehCampoDeDigitar(document.createElement('textarea'))).toBe(true);
    expect(ehCampoDeDigitar(document.createElement('select'))).toBe(true);
  });

  it('um botão, o corpo da página ou nada não recebem texto', () => {
    expect(ehCampoDeDigitar(document.createElement('button'))).toBe(false);
    expect(ehCampoDeDigitar(document.body)).toBe(false);
    expect(ehCampoDeDigitar(null)).toBe(false);
  });
});
