import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { corDoPacote } from '../ui/visaoDasPecas';
import { MANUAL_DO_PROGRAMA, NOVIDADES_DO_PROGRAMA } from '../ui/manualDoPrograma';
import { metodoSugerido } from './metodoDeEnfesto';
import { criarMolde, type Molde } from './molde';
import { comPontoDeCasamento } from './pontosDeCasamento';
import { fazerRisco, type PecaDoRisco } from './risco';
import type { Tecido } from './tecido';

describe('a sugestão do método de enfesto (ADR 0204)', () => {
  const tecido = (extra: Partial<Tecido>): Tecido => ({ direcional: false, temPelo: false, ...extra }) as Tecido;

  it('o tubo vai como tubo', () => {
    expect(metodoSugerido([], tecido({ tipoDeTecido: 'tubular' })).tipo).toBe('tubular');
  });

  it('o tecido de um sentido só não vira', () => {
    expect(metodoSugerido([{ emPar: true }], tecido({ temPelo: true }))).toMatchObject({ tipo: 'impar' });
  });

  it('as peças em par pedem zigue-zague', () => {
    expect(metodoSugerido([{ emPar: true }], tecido({})).tipo).toBe('zigue-zague');
  });

  it('sem nada disso, ímpar', () => {
    expect(metodoSugerido([{}], null).tipo).toBe('impar');
  });
});

describe('o relacionamento simétrico (ADR 0204)', () => {
  const quadrado = (id: string): Molde =>
    criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 90) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, id);

  const posto = (relacao: 'simetrico' | 'simetrico-horizontal' | 'simetrico-vertical' | undefined): { readonly x: number; readonly y: number } => {
    const m = comPontoDeCasamento(quadrado('a'), '', ponto(20, 30), 'm', relacao).molde;
    const copia: PecaDoRisco = { pecaId: m.id, nome: m.nome, tamanho: m.tamanho, molde: m, espelhada: false };
    const r = fazerRisco([copia], { M: 1 }, { larguraMm: 1000, comprimentoMaximoMm: 3000, distanciaMm: 0, sentidoUnico: false, casamento: { rapportLarguraMm: 70, rapportComprimentoMm: 90, faseLarguraMm: 10, faseComprimentoMm: 15 } });
    if (!r.ok) throw new Error(r.motivo);
    const xs = r.pecas[0]!.contorno.map((p) => p.x);
    const ys = r.pecas[0]!.contorno.map((p) => p.y);
    return { x: Math.min(...xs) + 20, y: Math.min(...ys) + 30 };
  };
  const naFase = (v: number, rapport: number, fase: number): boolean => {
    const resto = (((v - fase) % rapport) + rapport) % rapport;
    return resto < 1e-6 || rapport - resto < 1e-6;
  };

  it('nos dois sentidos, a fase vira de lado', () => {
    const p = posto('simetrico');
    expect(naFase(p.x, 70, -10)).toBe(true);
    expect(naFase(p.y, 90, -15)).toBe(true);
  });

  it('só na horizontal, a largura fica livre', () => {
    const p = posto('simetrico-horizontal');
    expect(naFase(p.y, 90, -15)).toBe(true);
    expect(p.x).toBe(20);
  });

  it('só na vertical, o comprimento fica livre', () => {
    const p = posto('simetrico-vertical');
    expect(naFase(p.x, 70, -10)).toBe(true);
    expect(p.y).toBe(30);
  });
});

describe('as cores dos pacotes (ADR 0204)', () => {
  it('a cor escolhida vale; sem ela, a da paleta', () => {
    expect(corDoPacote(1, ['#111111', '#222222'])).toBe('#222222');
    expect(corDoPacote(1, [])).toBe(corDoPacote(1));
  });
});

describe('o manual e as novidades (ADR 0204)', () => {
  it('cada seção tem título e passos', () => {
    expect(MANUAL_DO_PROGRAMA.length).toBeGreaterThan(5);
    for (const s of MANUAL_DO_PROGRAMA) {
      expect(s.titulo).not.toBe('');
      expect(s.passos.length).toBeGreaterThan(0);
    }
    expect(NOVIDADES_DO_PROGRAMA.length).toBeGreaterThan(5);
  });
});
