import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LADOS_DO_WINDOWS = [16, 20, 24, 32, 40, 48, 64, 128, 256];

describe('o ícone do programa (ADR 0226)', () => {
  it('o ICO traz cada tamanho que o Windows usa, e o de 256 em PNG', () => {
    const ico = readFileSync('build/icon.ico');
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(LADOS_DO_WINDOWS.length);
    const lados = LADOS_DO_WINDOWS.map((_, n) => ico[6 + 16 * n] || 256);
    expect(lados).toEqual(LADOS_DO_WINDOWS);
    const ultimo = 6 + 16 * (LADOS_DO_WINDOWS.length - 1);
    expect(ico.toString('latin1', ico.readUInt32LE(ultimo + 12) + 1, ico.readUInt32LE(ultimo + 12) + 4)).toBe('PNG');
    expect(ico.readUInt32LE(ultimo + 12) + ico.readUInt32LE(ultimo + 8)).toBe(ico.length);
  });

  it('o ICNS vai até 1024 e diz o próprio tamanho certo', () => {
    const icns = readFileSync('build/icon.icns');
    expect(icns.toString('latin1', 0, 4)).toBe('icns');
    expect(icns.readUInt32BE(4)).toBe(icns.length);
    const tipos: string[] = [];
    for (let p = 8; p < icns.length; p += icns.readUInt32BE(p + 4)) tipos.push(icns.toString('latin1', p, p + 4));
    expect(tipos).toEqual(['ic11', 'ic12', 'ic07', 'ic08', 'ic13', 'ic09', 'ic14', 'ic10']);
  });

  it('o programa, o instalador, o desinstalador e o Mac usam esses arquivos', () => {
    const { build } = JSON.parse(readFileSync('package.json', 'utf8')) as { build: Record<string, Record<string, string>> };
    expect(build['win']!['icon']).toBe('build/icon.ico');
    expect(build['nsis']).toMatchObject({ installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico', installerHeaderIcon: 'build/icon.ico' });
    expect(build['mac']!['icon']).toBe('build/icon.icns');
    expect(build['dmg']!['icon']).toBe('build/icon.icns');
  });

  it('a marca do ícone é a mesma da barra do programa', () => {
    const tracados = (texto: string): string[] => [...texto.matchAll(/<path d="([^"]+)" (?:fill="#\w+" )?stroke="(#\w+)"/g)].map((m) => `${m[1]} ${m[2]}`);
    const doIcone = tracados(readFileSync('scripts/icone/gerar-icones.cjs', 'utf8'));
    expect(doIcone).toHaveLength(3);
    expect(tracados(readFileSync('src/ui/BarraDeFerramentas.tsx', 'utf8'))).toEqual(expect.arrayContaining(doIcone));
  });
});
