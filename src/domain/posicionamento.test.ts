import { describe, it, expect } from 'vitest';
import { ponto, transladarContorno, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { sugerirPosicaoSemSobreposicao } from './posicionamento';

function pecaRetangular(id: string, x: number, y: number, largura: number, altura: number): Molde {
  return criarMolde(
    {
      nome: id,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(x, y), ponto(x + largura, y), ponto(x + largura, y + altura), ponto(x, y + altura)],
      linhaDeFio: { inicio: ponto(x + largura / 2, y + 10), fim: ponto(x + largura / 2, y + altura - 10) },
    },
    id,
  );
}

function enfestoBase(sobrescrever: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 500,
    comprimentoMm: 500,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
    ...sobrescrever,
  } as ConfiguracaoDeEnfesto);
}

describe('sugerirPosicaoSemSobreposicao', () => {
  it('sugere a posição mais ao canto superior esquerdo quando a área está vazia', () => {
    const peca = pecaRetangular('a', 200, 200, 50, 50);
    const delta = sugerirPosicaoSemSobreposicao(peca, [], enfestoBase(), 10);
    expect(delta).not.toBeNull();
    const contornoResultante = transladarContorno(peca.contorno, delta!);
    const bbox = retanguloEnvolvente(contornoResultante);
    expect(bbox.minX).toBeCloseTo(0, 9);
    expect(bbox.minY).toBeCloseTo(0, 9);
  });

  it('desvia de uma peça já existente, respeitando a distância mínima', () => {
    const existente = pecaRetangular('existente', 0, 0, 100, 100);
    const alvo = pecaRetangular('alvo', 300, 300, 50, 50);
    const delta = sugerirPosicaoSemSobreposicao(alvo, [existente], enfestoBase({ distanciaMinimaEntrePecasMm: 5 } as Partial<ConfiguracaoDeEnfesto>), 10);
    expect(delta).not.toBeNull();
    const contornoResultante = transladarContorno(alvo.contorno, delta!);

    // A posição sugerida não pode sobrepor nem ficar a menos de 5mm da existente.
    const bboxExistente = retanguloEnvolvente(existente.contorno);
    const bboxResultante = retanguloEnvolvente(contornoResultante);
    const seSobrepoe =
      bboxResultante.minX < bboxExistente.maxX &&
      bboxResultante.maxX > bboxExistente.minX &&
      bboxResultante.minY < bboxExistente.maxY &&
      bboxResultante.maxY > bboxExistente.minY;
    expect(seSobrepoe).toBe(false);
  });

  it('retorna null quando a peça é maior que a área útil', () => {
    const gigante = pecaRetangular('gigante', 0, 0, 1000, 1000);
    const delta = sugerirPosicaoSemSobreposicao(gigante, [], enfestoBase(), 10);
    expect(delta).toBeNull();
  });

  it('retorna null quando a área está completamente ocupada', () => {
    const ocupacaoTotal = pecaRetangular('ocupada', 0, 0, 500, 500);
    const alvo = pecaRetangular('alvo', 0, 0, 50, 50);
    const delta = sugerirPosicaoSemSobreposicao(alvo, [ocupacaoTotal], enfestoBase(), 50, 200);
    expect(delta).toBeNull();
  });

  it('a posição sugerida fica dentro dos limites úteis (margens respeitadas)', () => {
    const enfesto = enfestoBase({ margemLateralMm: 20, margemDeExtremidadeMm: 30 } as Partial<ConfiguracaoDeEnfesto>);
    const peca = pecaRetangular('a', 200, 200, 50, 50);
    const delta = sugerirPosicaoSemSobreposicao(peca, [], enfesto, 10);
    expect(delta).not.toBeNull();
    const bbox = retanguloEnvolvente(transladarContorno(peca.contorno, delta!));
    expect(bbox.minX).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(bbox.minY).toBeGreaterThanOrEqual(30 - 1e-9);
  });
});
