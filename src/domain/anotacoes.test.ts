import { describe, it, expect } from 'vitest';
import { area, ponto } from '../core/geometria';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';
import { definirRegra } from './graduacao';
import { criarMolde, espelharMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import {
  abrirSimetrias,
  adicionarTexto,
  alterarTexto,
  arestaDeSimetria,
  CORES_DE_PECA,
  definirCodigoDoPique,
  definirCor,
  definirLinhaDeSimetria,
  ondeEscreverOCodigo,
  piquePerto,
  piquesComOCodigo,
  textoPerto,
} from './anotacoes';

// Meia frente: arestas 0 de (0,0) a (200,0); 1 até (200,300); 2 até (0,300); 3 fecha, de (0,300) a (0,0).
function meiaFrente(id = 'frente'): Molde {
  return criarMolde(
    {
      nome: 'Frente',
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
    },
    id,
  );
}

const comPique = (molde: Molde, id: string, x: number, y: number, indiceAresta: number): Molde => ({
  ...molde,
  piques: [...molde.piques, { id, posicao: ponto(x, y), indiceAresta }],
});

let contador = 0;
const novoId = (): string => `novo-${++contador}`;

describe('definirCor', () => {
  it('guarda uma cor da paleta, e null volta à cor padrão sem deixar o campo', () => {
    const azul = definirCor(meiaFrente(), CORES_DE_PECA[0]!.valor);
    expect(azul.cor).toBe('#d6e6fb');

    const semCor = definirCor(azul, null);
    expect('cor' in semCor).toBe(false);
    expect(semCor).toEqual(meiaFrente());
  });

  it('recusa uma cor que não é da paleta', () => {
    expect(() => definirCor(meiaFrente(), '#000000')).toThrow('Cor fora da paleta.');
  });

  it('as cores da paleta são todas diferentes e claras (o contorno escuro continua legível)', () => {
    expect(new Set(CORES_DE_PECA.map((c) => c.valor)).size).toBe(CORES_DE_PECA.length);
    for (const cor of CORES_DE_PECA) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.valor.slice(i, i + 2), 16));
      expect(Math.min(r!, g!, b!), cor.nome).toBeGreaterThanOrEqual(0xc8);
    }
  });
});

describe('textos da peça', () => {
  it('adicionarTexto prende o texto à peça, sem os espaços das pontas', () => {
    const peca = adicionarTexto(meiaFrente(), ponto(100, 150), '  DOBRA  ', 12, 't1');

    expect(peca.textos).toEqual([{ id: 't1', posicao: ponto(100, 150), texto: 'DOBRA', alturaMm: 12 }]);
  });

  it('recusa texto vazio e altura fora da faixa', () => {
    expect(() => adicionarTexto(meiaFrente(), ponto(0, 0), '   ', 10, 't')).toThrow('Escreva o texto.');
    expect(() => adicionarTexto(meiaFrente(), ponto(0, 0), 'A', 0.5, 't')).toThrow('entre 1 e 500 mm');
    expect(() => adicionarTexto(meiaFrente(), ponto(0, 0), 'A', 501, 't')).toThrow('entre 1 e 500 mm');
    expect(() => adicionarTexto(meiaFrente(), ponto(0, 0), 'A', Number.NaN, 't')).toThrow('entre 1 e 500 mm');
    expect(adicionarTexto(meiaFrente(), ponto(0, 0), 'A', 1, 't').textos).toHaveLength(1);
    expect(adicionarTexto(meiaFrente(), ponto(0, 0), 'A', 500, 't').textos).toHaveLength(1);
  });

  it('alterarTexto troca só o texto pedido; em branco, apaga-o', () => {
    const peca = adicionarTexto(adicionarTexto(meiaFrente(), ponto(50, 50), 'um', 10, 't1'), ponto(150, 250), 'dois', 10, 't2');

    const alterada = alterarTexto(peca, 't2', 'DOIS', 20);
    expect(alterada.textos).toEqual([
      { id: 't1', posicao: ponto(50, 50), texto: 'um', alturaMm: 10 },
      { id: 't2', posicao: ponto(150, 250), texto: 'DOIS', alturaMm: 20 },
    ]);

    // Em branco apaga, mesmo com a altura inválida: o que vale é o texto ter sumido.
    expect(alterarTexto(peca, 't1', '  ', Number.NaN).textos).toEqual([{ id: 't2', posicao: ponto(150, 250), texto: 'dois', alturaMm: 10 }]);
    expect(() => alterarTexto(peca, 't9', 'x', 10)).toThrow('Texto não encontrado na peça.');
    expect(() => alterarTexto(peca, 't1', 'x', 0)).toThrow('entre 1 e 500 mm');
  });

  it('textoPerto acha o texto mais próximo do clique, dentro do raio ou da altura das letras', () => {
    const peca = adicionarTexto(adicionarTexto(meiaFrente(), ponto(50, 50), 'um', 10, 't1'), ponto(150, 250), 'grande', 40, 't2');

    expect(textoPerto(peca, ponto(53, 54), 6)?.id).toBe('t1');
    expect(textoPerto(peca, ponto(60, 60), 6)).toBeNull();
    // O texto grande é acertado até a altura das letras, mesmo com o raio pequeno.
    expect(textoPerto(peca, ponto(150, 285), 6)?.id).toBe('t2');
    expect(textoPerto(peca, ponto(150, 295), 6)).toBeNull();
    expect(textoPerto(meiaFrente(), ponto(50, 50), 6)).toBeNull();
  });

  it('o texto anda, gira e espelha com a peça', () => {
    const peca = adicionarTexto(meiaFrente(), ponto(50, 100), 'A', 10, 't1');

    expect(transladarMolde(peca, ponto(10, 20), 'f2').textos![0]!.posicao).toEqual(ponto(60, 120));

    const girada = rotacionarMolde(peca, 180).textos![0]!.posicao;
    expect(girada.x).toBeCloseTo(150, 9);
    expect(girada.y).toBeCloseTo(200, 9);

    expect(espelharMolde(peca, 'f4').textos![0]!.posicao.x).toBeCloseTo(150, 9);
    expect(espelharMolde(peca, 'f4').textos![0]!.posicao.y).toBeCloseTo(100, 9);
  });
});

describe('linha de simetria', () => {
  it('marca a aresta pelas duas pontas, e marcar de novo tira a marca', () => {
    const marcada = definirLinhaDeSimetria(meiaFrente(), 3);

    expect(marcada.linhaDeSimetria).toEqual({ de: ponto(0, 300), ate: ponto(0, 0) });
    expect(arestaDeSimetria(marcada)).toBe(3);

    const desmarcada = definirLinhaDeSimetria(marcada, 3);
    expect('linhaDeSimetria' in desmarcada).toBe(false);
    expect(arestaDeSimetria(desmarcada)).toBeNull();
  });

  it('marcar outra aresta troca a linha de lugar', () => {
    const trocada = definirLinhaDeSimetria(definirLinhaDeSimetria(meiaFrente(), 3), 1);

    expect(arestaDeSimetria(trocada)).toBe(1);
    expect(trocada.linhaDeSimetria).toEqual({ de: ponto(200, 0), ate: ponto(200, 300) });
  });

  it('recusa a aresta em que a peça não pode ser desdobrada', () => {
    // Um "L": a aresta do degrau deixa peça dos dois lados da reta dela.
    const emL = criarMolde(
      {
        nome: 'L',
        referencia: 'R',
        tamanho: 'M',
        contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)],
        linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) },
      },
      'l',
    );

    expect(() => definirLinhaDeSimetria(emL, 3)).toThrow();
    expect(arestaDeSimetria(definirLinhaDeSimetria(emL, 5))).toBe(5);
  });

  it('a marca acompanha a peça movida, e deixa de valer se a aresta sumir do contorno', () => {
    const marcada = definirLinhaDeSimetria(meiaFrente(), 3);

    const movida = transladarMolde(marcada, ponto(40, 500), 'f2');
    expect(arestaDeSimetria(movida)).toBe(3);
    expect(movida.linhaDeSimetria).toEqual({ de: ponto(40, 800), ate: ponto(40, 500) });

    // O ponto (0,0) foi puxado: a aresta marcada já não existe.
    const editada: Molde = { ...marcada, contorno: [ponto(-20, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)] };
    expect(arestaDeSimetria(editada)).toBeNull();
  });

  it('acha a aresta mesmo com o contorno guardado no outro sentido', () => {
    const marcada = definirLinhaDeSimetria(meiaFrente(), 3);
    const invertida: Molde = { ...marcada, contorno: [...marcada.contorno].reverse() };

    // Invertido: (0,300), (200,300), (200,0), (0,0) — a aresta de (0,0) a (0,300) é a 3.
    expect(arestaDeSimetria(invertida)).toBe(3);
  });

  it('abrirSimetrias desdobra só as peças marcadas: a inteira tem o dobro da área e fica sem a marca', () => {
    const marcada = definirLinhaDeSimetria(meiaFrente('a'), 3);
    const comum = transladarMolde(meiaFrente('b'), ponto(0, 400), 'b');

    const [aberta, igual] = abrirSimetrias([marcada, comum], novoId);

    expect(igual).toBe(comum);
    expect(area(aberta!.contorno)).toBeCloseTo(2 * 200 * 300, 6);
    expect(Math.min(...aberta!.contorno.map((p) => p.x))).toBeCloseTo(-200, 9);
    expect(Math.max(...aberta!.contorno.map((p) => p.x))).toBeCloseTo(200, 9);
    expect(aberta!.linhaDeSimetria).toBeUndefined();
    expect(aberta!.nome).toBe('Frente');
  });

  it('em cada tamanho da graduação, a linha de simetria continua sobre a aresta', () => {
    let graduada = definirTamanhosDoMolde(definirLinhaDeSimetria(meiaFrente(), 3), ['P', 'M', 'G'], 'M');
    // O canto (200,300) cresce 10 mm em cada eixo por tamanho; a aresta de simetria (x = 0) estica junto.
    graduada = { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, 2, [ponto(-10, -10), ponto(0, 0), ponto(10, 10)]) };
    graduada = { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, 3, [ponto(0, -10), ponto(0, 0), ponto(0, 10)]) };

    const g = moldeDoTamanho(graduada, 2, 'g');

    expect(arestaDeSimetria(g)).toBe(3);
    expect(g.linhaDeSimetria!.de.y).toBeCloseTo(310, 9);
    const [aberta] = abrirSimetrias([g], novoId);
    expect(area(aberta!.contorno)).toBeCloseTo(2 * area(g.contorno), 6);
  });
});

describe('código dos piques', () => {
  const frente = comPique(comPique(meiaFrente('f'), 'p1', 200, 100, 1), 'p2', 200, 200, 1);
  const costas = comPique(transladarMolde(meiaFrente('c'), ponto(0, 400), 'c'), 'p3', 200, 500, 1);

  it('piquePerto acha o pique mais próximo dentro do raio', () => {
    expect(piquePerto(frente, ponto(203, 104), 8)?.id).toBe('p1');
    expect(piquePerto(frente, ponto(200, 160), 60)?.id).toBe('p2');
    expect(piquePerto(frente, ponto(200, 150), 8)).toBeNull();
    expect(piquePerto(meiaFrente(), ponto(200, 100), 8)).toBeNull();
  });

  it('dá o código a um pique só, sem os espaços das pontas; em branco, tira o campo', () => {
    const codificada = definirCodigoDoPique(frente, 'p2', ' A ');

    expect(codificada.piques).toEqual([
      { id: 'p1', posicao: ponto(200, 100), indiceAresta: 1 },
      { id: 'p2', posicao: ponto(200, 200), indiceAresta: 1, codigo: 'A' },
    ]);
    expect(definirCodigoDoPique(codificada, 'p2', '').piques).toEqual(frente.piques);
    expect('codigo' in definirCodigoDoPique(codificada, 'p2', '  ').piques[1]!).toBe(false);
  });

  it('recusa pique que não é da peça e código comprido demais', () => {
    expect(() => definirCodigoDoPique(frente, 'p3', 'A')).toThrow('Pique não encontrado na peça.');
    expect(() => definirCodigoDoPique(frente, 'p1', '123456789')).toThrow('até 8 caracteres');
    expect(definirCodigoDoPique(frente, 'p1', '12345678').piques[0]!.codigo).toBe('12345678');
  });

  it('piquesComOCodigo diz em que peças o código aparece, e quantas vezes', () => {
    const f = definirCodigoDoPique(definirCodigoDoPique(frente, 'p1', 'A'), 'p2', 'B');
    const c = definirCodigoDoPique(costas, 'p3', 'A');

    expect(piquesComOCodigo([f, c], 'A').map((r) => [r.peca.id, r.quantos])).toEqual([
      ['f', 1],
      ['c', 1],
    ]);
    expect(piquesComOCodigo([f, c], ' B ').map((r) => [r.peca.id, r.quantos])).toEqual([['f', 1]]);
    expect(piquesComOCodigo([f, c], 'C')).toEqual([]);
    expect(piquesComOCodigo([f, c], '')).toEqual([]);
  });

  it('o código é escrito do lado de dentro da peça, seja qual for o sentido do contorno', () => {
    // Pique no meio da aresta x = 200: dentro é para o lado de x menor.
    expect(ondeEscreverOCodigo(frente, frente.piques[0]!, 10)).toEqual(ponto(190, 100));

    const noOutroSentido: Molde = {
      ...frente,
      // (0,300), (200,300), (200,0), (0,0): a aresta de x = 200 passa a ser a 1, percorrida ao contrário.
      contorno: [...frente.contorno].reverse(),
      piques: [{ id: 'p1', posicao: ponto(200, 100), indiceAresta: 1 }],
    };
    expect(ondeEscreverOCodigo(noOutroSentido, noOutroSentido.piques[0]!, 10)).toEqual(ponto(190, 100));
  });

  it('o código vai junto quando a peça é movida', () => {
    const movida = transladarMolde(definirCodigoDoPique(frente, 'p1', 'A'), ponto(5, 5), 'f2');

    expect(movida.piques[0]).toMatchObject({ posicao: ponto(205, 105), codigo: 'A' });
  });
});
