import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import {
  acaoDaTeclaDoEncaixe,
  comForaDaDobra,
  comOrientacaoInicial,
  lugarLivreMaisPerto,
  moverAteEncostar,
  moverComReferencia,
  moverParaForaDoEnfesto,
  pecaNaDobraDoTecido,
  pecasDoTamanho,
  proximoGrupo,
  voltarAoOriginal,
} from './encaixeManual';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, rotacionarMolde, rotacaoEhPermitida, rotacoesNoEncaixe, transladarMolde, type Molde } from './molde';
import { prepararDobra } from './pecasNaDobra';
import { validarProjeto } from './validacao';

const enfesto = (tipo: 'par' | 'impar' | 'zigue-zague' = 'impar'): ConfiguracaoDeEnfesto =>
  criarConfiguracaoDeEnfesto({ tipo, larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 2, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });

const quadrado = (nome: string, x = 100, y = 100, lado = 100, tamanho = 'M'): Molde =>
  transladarMolde(criarMolde({ nome, referencia: '', tamanho, quantidade: 1, contorno: [ponto(0, 0), ponto(lado, 0), ponto(lado, lado), ponto(0, lado)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(0, 0), fim: ponto(0, lado) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, nome), { x, y }, nome);

/** Meia peça com a simetria no lado de y = 0, que pode girar à vontade em ângulos retos. */
const meia = (nome: string): Molde => ({
  ...criarMolde({ nome, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 400), ponto(0, 400)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(0, 0), fim: ponto(0, 100) }, restricaoDeRotacao: { permite180: true, permite90e270: true } }, nome),
  id: nome,
  linhaDeSimetria: { de: ponto(0, 0), ate: ponto(200, 0) },
  restricaoDeRotacao: { permite180: true, permite90e270: true },
});

const tecla = (key: string, mod: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) => acaoDaTeclaDoEncaixe({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mod });

describe('as teclas do encaixe (ADR 0180)', () => {
  it('cada tecla da referência tem a sua ação', () => {
    expect(tecla('F2')).toEqual({ tipo: 'girar-livre' });
    expect(tecla('F3')).toEqual({ tipo: 'girar-180' });
    expect(tecla('F4')).toEqual({ tipo: 'espelhar' });
    expect(tecla('F5')).toEqual({ tipo: 'dobra-horizontal' });
    expect(tecla('F6')).toEqual({ tipo: 'dobra-vertical' });
    expect(tecla('F7')).toEqual({ tipo: 'meia-camada' });
    expect(tecla('F8')).toEqual({ tipo: 'original' });
    expect(tecla('F12')).toEqual({ tipo: 'sobreposicao' });
    expect(tecla('f', { ctrlKey: true })).toEqual({ tipo: 'para-fora' });
    expect(tecla('ArrowLeft')).toEqual({ tipo: 'mover', direcao: 'esquerda' });
    expect(tecla('ArrowLeft', { ctrlKey: true })).toEqual({ tipo: 'girar-esquerda' });
    expect(tecla('ArrowRight', { ctrlKey: true })).toEqual({ tipo: 'girar-direita' });
    expect(tecla('F9')).toEqual({ tipo: 'travar-horizontal' });
    expect(tecla('F10')).toEqual({ tipo: 'travar-vertical' });
    expect(tecla('F11')).toEqual({ tipo: 'so-na-dobra' });
    for (const [letra, tipo] of Object.entries({ r: 'mover-com-referencia', g: 'agrupar', u: 'desagrupar', w: 'verificar', t: 'medir', k: 'cortar', p: 'plotar', l: 'localizar' })) {
      expect(tecla(letra, { ctrlKey: true })).toEqual({ tipo });
    }
    expect(tecla('T', { ctrlKey: true, shiftKey: true })).toEqual({ tipo: 'texto' });
  });

  it('com outro modificador, ou sem Ctrl nas setas, a tecla não é do encaixe', () => {
    expect(tecla('F4', { altKey: true })).toBeNull();
    expect(tecla('F2', { shiftKey: true })).toBeNull();
    expect(tecla('ArrowUp', { ctrlKey: true })).toBeNull();
    expect(tecla('a')).toBeNull();
    expect(tecla('s', { ctrlKey: true })).toBeNull();
  });
});

describe('mover a peça pelo teclado', () => {
  it('desliza até encostar na vizinha', () => {
    const d = moverAteEncostar(quadrado('a', 100, 100), [quadrado('b', 100, 400)], enfesto(), 'direita');
    expect(d.x).toBe(0);
    expect(d.y).toBeGreaterThan(199);
    expect(d.y).toBeLessThanOrEqual(200);
  });

  it('sem vizinha, para na margem da mesa', () => {
    expect(moverAteEncostar(quadrado('a', 100, 100), [], enfesto(), 'cima')).toEqual({ x: -96, y: 0 });
  });

  it('já em cima de outra, não anda', () => {
    expect(moverAteEncostar(quadrado('a', 100, 100), [quadrado('b', 100, 100)], enfesto(), 'direita').y).toBeLessThan(1);
  });
});

describe('mover para fora do enfesto', () => {
  it('as peças vão para depois do fim da mesa, em fila, e só elas', () => {
    const pecas = [quadrado('a'), quadrado('b', 300, 300), quadrado('c', 500, 500)];
    const r = moverParaForaDoEnfesto(pecas, new Set(['a', 'b']), enfesto());
    const [a, b, c] = r.map((p) => retanguloEnvolvente(p.contorno));
    expect(a!.minY).toBe(3100);
    expect(b!.minY).toBe(3300);
    expect(c!.minY).toBe(500);
  });

  it('não cai em cima da que já está fora', () => {
    const e = enfesto();
    const fora = moverParaForaDoEnfesto([quadrado('a'), quadrado('b', 300, 300)], new Set(['a']), e);
    const r = moverParaForaDoEnfesto(fora, new Set(['b']), e);
    expect(retanguloEnvolvente(r[1]!.contorno).minY).toBe(3300);
  });
});

describe('o molde original', () => {
  it('desfaz o giro acumulado', () => {
    const p = quadrado('a');
    const girada = rotacionarMolde(rotacionarMolde(p, 90), 90);
    expect(voltarAoOriginal(girada).anguloDeRotacaoGraus).toBe(0);
    expect(voltarAoOriginal(p)).toBe(p);
  });
});

describe('a peça na dobra do tecido pelo teclado', () => {
  it('F5 leva a simetria à dobra de cima, com o y onde estava', () => {
    const girada = transladarMolde(meia('a'), { x: 300, y: 700 }, 'a');
    const r = pecaNaDobraDoTecido(girada, 'horizontal', enfesto('par'));
    expect(retanguloEnvolvente(r.contorno).minX).toBe(0);
    expect(validarProjeto([r], enfesto('par')).some((p) => p.tipo === 'fora-dos-limites')).toBe(false);
  });

  it('F6 leva a simetria ao começo do comprimento, no zigue-zague, e a validação aceita', () => {
    const girada = transladarMolde(rotacionarMolde(meia('a'), 90), { x: 300, y: 700 }, 'a');
    const r = pecaNaDobraDoTecido(girada, 'vertical', enfesto('zigue-zague'));
    expect(retanguloEnvolvente(r.contorno).minY).toBeCloseTo(0, 6);
    expect(validarProjeto([r], enfesto('zigue-zague')).some((p) => p.tipo === 'fora-dos-limites')).toBe(false);
  });

  it('diz por que não dá', () => {
    expect(() => pecaNaDobraDoTecido(meia('a'), 'horizontal', enfesto('impar'))).toThrow(/par e no tubular/);
    expect(() => pecaNaDobraDoTecido(meia('a'), 'vertical', enfesto('par'))).toThrow(/zigue-zague/);
    expect(() => pecaNaDobraDoTecido(quadrado('a'), 'horizontal', enfesto('par'))).toThrow(/simetria/);
  });

  it('no encaixe automático em zigue-zague, a meia peça vai para a dobra do começo', () => {
    const e = enfesto('zigue-zague');
    const d = prepararDobra([{ ...meia('a'), quantidade: 2 }], e);
    expect(d.fixas).toHaveLength(2);
    for (const f of d.fixas) expect(retanguloEnvolvente(f.molde.contorno).minY).toBeCloseTo(0, 6);
    const [a, b] = d.fixas.map((f) => retanguloEnvolvente(f.molde.contorno));
    expect(b!.minX).toBeGreaterThanOrEqual(a!.maxX);
  });
});

describe('a sobreposição desligada', () => {
  it('a peça solta em cima de outra vai para o lugar livre mais perto', () => {
    const d = lugarLivreMaisPerto(quadrado('a', 100, 150), [quadrado('b', 100, 100)], enfesto());
    expect(d).not.toBeNull();
    expect(Math.hypot(d!.x, d!.y)).toBeLessThanOrEqual(160);
    const nova = transladarMolde(quadrado('a', 100, 150), d!, 'a');
    expect(validarProjeto([nova, quadrado('b', 100, 100)], enfesto()).some((p) => p.tipo === 'sobreposicao')).toBe(false);
  });

  it('em lugar livre, não anda; sem nenhum no alcance, avisa com nulo', () => {
    expect(lugarLivreMaisPerto(quadrado('a'), [], enfesto())).toEqual({ x: 0, y: 0 });
    expect(lugarLivreMaisPerto(quadrado('a', 100, 100, 100), [quadrado('b', 0, 0, 3000)], enfesto(), 20, 100)).toBeNull();
  });
});

describe('as propriedades do tecido na peça', () => {
  it('giro livre: o encaixe tenta de 15 em 15 graus, e a peça aceita qualquer ângulo', () => {
    const r = { permite180: false, permite90e270: false, giroLivre: true };
    expect(rotacoesNoEncaixe(r, false)).toHaveLength(24);
    expect(rotacaoEhPermitida(r, 33)).toBe(true);
    expect(rotacoesNoEncaixe(r, true)).toEqual([0, 90]);
  });

  it('giro inicial: a peça entra girada, e o encaixe seguinte não gira de novo', () => {
    const p = { ...quadrado('a', 0, 0), contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 300), ponto(0, 300)], restricaoDeRotacao: { permite180: false, permite90e270: false, giroInicialGraus: 90 } };
    const r = comOrientacaoInicial(p);
    const c = retanguloEnvolvente(r.contorno);
    expect(c.maxX - c.minX).toBeCloseTo(300, 6);
    expect(r.anguloDeRotacaoGraus).toBe(0);
    expect(r.restricaoDeRotacao.giroInicialGraus).toBeUndefined();
    expect(comOrientacaoInicial(r)).toBe(r);
  });

  it('refletido: de cima para baixo e de lado', () => {
    const triangulo: Molde = { ...quadrado('a', 0, 0), contorno: [ponto(0, 0), ponto(100, 0), ponto(0, 200)] };
    const vertical = comOrientacaoInicial({ ...triangulo, restricaoDeRotacao: { ...triangulo.restricaoDeRotacao, refletidoVertical: true } });
    const lado = comOrientacaoInicial({ ...triangulo, restricaoDeRotacao: { ...triangulo.restricaoDeRotacao, refletidoHorizontal: true } });
    // O ponto do bico (y = 200) fica no x de baixo, na vertical; na horizontal, o y dele vira o começo.
    const bico = (m: Molde) => m.contorno[2]!;
    const caixaV = retanguloEnvolvente(vertical.contorno);
    const caixaH = retanguloEnvolvente(lado.contorno);
    expect(bico(vertical).x).toBeCloseTo(caixaV.maxX, 6);
    expect(bico(lado).y).toBeCloseTo(caixaH.minY, 6);
  });

  it('a peça sem nenhuma dessas propriedades não muda', () => {
    const p = quadrado('a');
    expect(comOrientacaoInicial(p)).toBe(p);
  });
});

describe('mover com referência', () => {
  it('a partir de onde a peça está, e só as indicadas', () => {
    const r = moverComReferencia([quadrado('a'), quadrado('b')], new Set(['a']), 'peca', 30, -10);
    expect(retanguloEnvolvente(r[0]!.contorno)).toMatchObject({ minX: 90, minY: 130 });
    expect(retanguloEnvolvente(r[1]!.contorno)).toMatchObject({ minX: 100, minY: 100 });
  });

  it('a partir da mesa, o canto do grupo vai à distância pedida, e o grupo não desmancha', () => {
    const r = moverComReferencia([quadrado('a', 100, 100), quadrado('b', 300, 400)], new Set(['a', 'b']), 'mesa', 10, 20);
    expect(retanguloEnvolvente(r[0]!.contorno)).toMatchObject({ minX: 20, minY: 10 });
    expect(retanguloEnvolvente(r[1]!.contorno)).toMatchObject({ minX: 220, minY: 310 });
  });
});

describe('agrupar e a dobra por peça', () => {
  it('o próximo grupo é o primeiro número livre', () => {
    expect(proximoGrupo([quadrado('a')])).toBe('Grupo 1');
    expect(proximoGrupo([{ ...quadrado('a'), grupoDoEncaixe: 'Grupo 1' }, { ...quadrado('b'), grupoDoEncaixe: 'Grupo 3' }])).toBe('Grupo 2');
  });

  it('F11: a peça marcada segue com as outras, e não na dobra', () => {
    const d = prepararDobra([comForaDaDobra(meia('a'), true)], enfesto('par'));
    expect(d.fixas).toEqual([]);
    expect(d.resto).toHaveLength(1);
    expect(comForaDaDobra(comForaDaDobra(meia('a'), true), false).foraDaDobra).toBeUndefined();
  });
});

describe('Alt + clique', () => {
  it('acha as peças do mesmo tamanho', () => {
    const pecas = [quadrado('a', 0, 0, 10, 'M'), quadrado('b', 0, 0, 10, 'G'), quadrado('c', 0, 0, 10, 'M')];
    expect(pecasDoTamanho(pecas, 'c')).toEqual({ tamanho: 'M', ids: ['a', 'c'] });
    expect(pecasDoTamanho(pecas, 'x')).toBeNull();
  });
});
