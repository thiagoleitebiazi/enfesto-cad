import { describe, it, expect } from 'vitest';
import { contornosSeSobrepoem, ponto, transladarContorno, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { posicionarAsQueChegam, sugerirPosicaoSemSobreposicao } from './posicionamento';

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

describe('posicionarAsQueChegam: as peças importadas não ficam em cima das que já estão no projeto', () => {
  const emCimaDeAlguma = (pecas: readonly Molde[]): boolean => pecas.some((a, i) => pecas.some((b, j) => j > i && contornosSeSobrepoem(a.contorno, b.contorno)));
  const canto = (peca: Molde) => ({ x: retanguloEnvolvente(peca.contorno).minX, y: retanguloEnvolvente(peca.contorno).minY });

  it('a peça que chegaria em cima de outra vai para o primeiro lugar livre do enfesto, inteira', () => {
    const existente = pecaRetangular('a', 0, 0, 100, 100);
    // Chega na mesma posição da que já existe, com um pique na borda.
    const chegando: Molde = { ...pecaRetangular('b', 0, 0, 100, 100), piques: [{ id: 'p', posicao: ponto(50, 0), indiceAresta: 0 }] };
    const [posta] = posicionarAsQueChegam([chegando], [existente], enfestoBase());

    expect(posta!.id).toBe('b');
    // O primeiro lugar livre, varrendo a largura: logo ao lado da que já existe, à distância mínima do enfesto (5 mm).
    expect(canto(posta!)).toEqual({ x: 110, y: 0 });
    expect(emCimaDeAlguma([existente, posta!])).toBe(false);
    const bbox = retanguloEnvolvente(posta!.contorno);
    expect(bbox.minX).toBeGreaterThanOrEqual(0);
    expect(bbox.maxX).toBeLessThanOrEqual(500);
    expect(bbox.maxY).toBeLessThanOrEqual(500);
    // O pique andou com a peça: continua no meio da primeira aresta.
    expect(posta!.piques[0]!.posicao).toEqual(ponto(canto(posta!).x + 50, canto(posta!).y));
    expect(posta!.linhaDeFio.inicio).toEqual(ponto(canto(posta!).x + 50, canto(posta!).y + 10));
  });

  it('as que chegam juntas também não ficam umas em cima das outras', () => {
    const postas = posicionarAsQueChegam([pecaRetangular('b', 0, 0, 100, 100), pecaRetangular('c', 0, 0, 100, 100), pecaRetangular('d', 0, 0, 100, 100)], [pecaRetangular('a', 0, 0, 100, 100)], enfestoBase());

    expect(postas.map((p) => p.id)).toEqual(['b', 'c', 'd']);
    expect(emCimaDeAlguma([pecaRetangular('a', 0, 0, 100, 100), ...postas])).toBe(false);
  });

  it('a que não cabe no enfesto vai para depois de tudo, no comprimento, a 20 mm', () => {
    const existente = pecaRetangular('a', 30, 40, 100, 100);
    // Maior que o enfesto de 500 × 500: não há lugar para ela lá dentro.
    const [posta] = posicionarAsQueChegam([pecaRetangular('b', 7, 9, 600, 100)], [existente], enfestoBase());

    expect(canto(posta!)).toEqual({ x: 30, y: 160 });
    expect(emCimaDeAlguma([existente, posta!])).toBe(false);
    // Outro afastamento.
    expect(canto(posicionarAsQueChegam([pecaRetangular('b', 7, 9, 600, 100)], [existente], enfestoBase(), 50)[0]!)).toEqual({ x: 30, y: 190 });
  });

  it('sem enfesto configurado: a primeira de um projeto vazio fica onde veio; as outras, depois de tudo', () => {
    const postas = posicionarAsQueChegam([pecaRetangular('b', 5, 5, 100, 100), pecaRetangular('c', 5, 5, 100, 80)], [], null);

    expect(postas[0]).toEqual(pecaRetangular('b', 5, 5, 100, 100));
    expect(canto(postas[1]!)).toEqual({ x: 5, y: 125 });
    expect(posicionarAsQueChegam([], [pecaRetangular('a', 0, 0, 10, 10)], null)).toEqual([]);
  });
});
