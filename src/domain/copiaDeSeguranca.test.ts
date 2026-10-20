import { describe, expect, it } from 'vitest';
import { copiaJaFeita, motivoDaCopiaDeSeguranca, nomeDaCopiaDeSeguranca } from './copiaDeSeguranca';

describe('cópia de segurança do projeto antes de gravar por cima', () => {
  it('arquivo novo (nada no disco) ou da mesma versão: não precisa', () => {
    expect(motivoDaCopiaDeSeguranca(null, 2)).toBeNull();
    expect(motivoDaCopiaDeSeguranca(JSON.stringify({ id: 'p', versaoDoFormato: 2 }), 2)).toBeNull();
  });

  it('o arquivo antigo (sem a versão, que é a 1) é copiado antes da primeira gravação no formato novo', () => {
    expect(motivoDaCopiaDeSeguranca(JSON.stringify({ id: 'p' }), 2)).toBe('v1');
    expect(motivoDaCopiaDeSeguranca(JSON.stringify({ id: 'p', versaoDoFormato: 'x' }), 2)).toBe('v1');
  });

  it('o arquivo que não dá para ler também é copiado (gravar por cima o apagaria)', () => {
    expect(motivoDaCopiaDeSeguranca('{ quebrado', 2)).toBe('ilegivel');
    expect(motivoDaCopiaDeSeguranca('[1,2]', 2)).toBe('ilegivel');
  });

  it('o nome tem o id, o motivo e a hora, sem dois-pontos', () => {
    expect(nomeDaCopiaDeSeguranca('projeto-abc', 'v1', '2026-10-20T13:45:07.123Z')).toBe('projeto-abc.v1.2026-10-20T13-45-07-123Z.json');
  });

  it('a versão antiga é copiada uma vez só; o ilegível, toda vez', () => {
    const pasta = ['projeto-abc.v1.2026-10-20T13-45-07-123Z.json', 'outro.v1.x.json'];
    expect(copiaJaFeita('projeto-abc', 'v1', pasta)).toBe(true);
    expect(copiaJaFeita('projeto-ab', 'v1', pasta)).toBe(false);
    expect(copiaJaFeita('projeto-abc', 'ilegivel', ['projeto-abc.ilegivel.1.json'])).toBe(false);
  });
});
