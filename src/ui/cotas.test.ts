import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { cotaDeDistancia, cotaDePerimetro, valorDaCotaDeAngulo, valorDaCotaLinear } from '../domain/cota';
import { adicionarCota, criarMolde } from '../domain/molde';
import { CLIQUES_DA_COTA, cotaSobOPonto, montarCota, previaDaCota } from './cotas';

describe('montarCota', () => {
  it('cota distância: dois pontos e a posição da linha', () => {
    const cota = montarCota('cota-distancia', 'c1', [ponto(0, 0), ponto(300, 400), ponto(0, 60)]);
    expect(cota.tipo === 'linear' && valorDaCotaLinear(cota)).toBeCloseTo(500, 9);
  });

  it('horizontal / vertical: a posição escolhe o eixo', () => {
    const horizontal = montarCota('cota-horizontal-vertical', 'c1', [ponto(0, 0), ponto(300, 400), ponto(-60, 200)]);
    const vertical = montarCota('cota-horizontal-vertical', 'c2', [ponto(0, 0), ponto(300, 400), ponto(150, 480)]);
    expect(horizontal.tipo === 'linear' && valorDaCotaLinear(horizontal)).toBe(400);
    expect(vertical.tipo === 'linear' && valorDaCotaLinear(vertical)).toBe(300);
  });

  it('ângulo: um lado, o vértice, o outro lado e a posição do arco', () => {
    const cota = montarCota('cota-angulo', 'c1', [ponto(100, 0), ponto(0, 0), ponto(0, 100), ponto(30, 40)]);
    expect(cota.tipo === 'angulo' && valorDaCotaDeAngulo(cota)).toBeCloseTo(90, 9);
    expect(cota.tipo === 'angulo' && cota.raioMm).toBe(50);
  });

  it('recusa cliques a menos ou a mais, e pontos que não formam a cota', () => {
    expect(() => montarCota('cota-distancia', 'c1', [ponto(0, 0), ponto(10, 0)])).toThrow('Faltam pontos');
    expect(() => montarCota('cota-angulo', 'c1', [ponto(0, 0), ponto(10, 0), ponto(5, 5)])).toThrow('Faltam pontos');
    expect(() => montarCota('cota-distancia', 'c1', [ponto(0, 0), ponto(0, 0), ponto(5, 5)])).toThrow('dois pontos diferentes');
  });
});

describe('previaDaCota', () => {
  it('só existe quando falta apenas o clique que posiciona a cota', () => {
    expect(previaDaCota('cota-distancia', [ponto(0, 0)], ponto(50, 50))).toBeNull();
    expect(previaDaCota('cota-distancia', [ponto(0, 0), ponto(0, 100)], ponto(-30, 50))).toMatchObject({
      tipo: 'linear',
      posicao: ponto(-30, 50),
    });
    expect(previaDaCota('cota-angulo', [ponto(100, 0), ponto(0, 0)], ponto(0, 100))).toBeNull();
    expect(previaDaCota('cota-angulo', [ponto(100, 0), ponto(0, 0), ponto(0, 100)], ponto(30, 40))).toMatchObject({
      tipo: 'angulo',
      raioMm: 50,
    });
  });

  it('sem mouse sobre o desenho, ou com pontos que não formam cota, não há prévia', () => {
    expect(previaDaCota('cota-distancia', [ponto(0, 0), ponto(0, 100)], null)).toBeNull();
    expect(previaDaCota('cota-distancia', [ponto(0, 0), ponto(0, 0)], ponto(5, 5))).toBeNull();
  });

  it('cada ferramenta sabe quantos cliques pede', () => {
    expect(CLIQUES_DA_COTA).toEqual({ 'cota-distancia': 3, 'cota-horizontal-vertical': 3, 'cota-angulo': 4 });
  });
});

describe('cotaSobOPonto', () => {
  const base = criarMolde(
    {
      nome: 'Frente',
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
    },
    'frente',
  );
  // Número da cota de distância em (100, -30); o da de perímetro em (100, 150).
  const frente = adicionarCota(
    adicionarCota(base, cotaDeDistancia('largura', ponto(0, 0), ponto(200, 0), ponto(100, -30))),
    cotaDePerimetro('perimetro', ponto(100, 150)),
  );

  it('acha a cota cujo número está perto do clique', () => {
    expect(cotaSobOPonto([frente], ponto(103, -27), 10)).toEqual({ pecaId: 'frente', cotaId: 'largura' });
    expect(cotaSobOPonto([frente], ponto(96, 155), 10)).toEqual({ pecaId: 'frente', cotaId: 'perimetro' });
  });

  it('longe de qualquer número, não acha nada', () => {
    expect(cotaSobOPonto([frente], ponto(100, 60), 10)).toBeNull();
    expect(cotaSobOPonto([base], ponto(100, -30), 10)).toBeNull();
  });

  it('entre dois números ao alcance, fica com o mais próximo', () => {
    const duas = adicionarCota(frente, cotaDePerimetro('outra', ponto(100, 160)));
    expect(cotaSobOPonto([duas], ponto(100, 157), 10)?.cotaId).toBe('outra');
  });
});
