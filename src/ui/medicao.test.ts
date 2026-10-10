import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, definirMargemDeCostura, transladarMolde } from '../domain/molde';
import {
  alvoDaMedicao,
  cliqueDePerimetro,
  descreverComparacao,
  descreverConferencia,
  descreverMedicao,
  FOLGA_DA_CONFERENCIA_MM,
  posicaoNoContornoPerto,
  resolverMedicao,
  SEM_MEDICAO,
  type AlvoDeMedicao,
  type EstadoDeMedicao,
} from './medicao';

// Arestas da frente: 0 de (0,0) a (200,0); 1 até (200,300); 2 até (0,300); 3 fecha. Perímetro 1000.
const frente = criarMolde(
  {
    nome: 'Frente',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
    linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
  },
  'frente',
);
// Costas ao lado, a 100 mm de distância: de x 300 a 400. Perímetro 800.
const costas = criarMolde(
  {
    nome: 'Costas',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(300, 0), ponto(400, 0), ponto(400, 300), ponto(300, 300)],
    linhaDeFio: { inicio: ponto(350, 50), fim: ponto(350, 250) },
  },
  'costas',
);
const pecas = [frente, costas];

const noContorno = (peca: typeof frente, indiceAresta: number, x: number, y: number): AlvoDeMedicao => ({
  tipo: 'contorno',
  peca,
  posicao: { indiceAresta, ponto: ponto(x, y) },
});

describe('posicaoNoContornoPerto', () => {
  it('perto de um vértice, cai exatamente nele', () => {
    expect(posicaoNoContornoPerto(ponto(196, 4), frente.contorno, 10)).toEqual({ indiceAresta: 1, ponto: ponto(200, 0) });
  });

  it('longe dos vértices, cai no ponto mais próximo da aresta', () => {
    expect(posicaoNoContornoPerto(ponto(203, 150), frente.contorno, 10)).toEqual({ indiceAresta: 1, ponto: ponto(200, 150) });
  });

  it('longe do contorno, não acerta nada', () => {
    expect(posicaoNoContornoPerto(ponto(100, 150), frente.contorno, 10)).toBeNull();
  });
});

describe('alvoDaMedicao', () => {
  it('no meio da peça, longe do contorno: o interior dela', () => {
    expect(alvoDaMedicao(ponto(100, 150), pecas, 10)).toEqual({ tipo: 'interior', peca: frente });
  });

  it('perto do contorno: a posição sobre ele, mesmo clicando um pouco para dentro', () => {
    expect(alvoDaMedicao(ponto(195, 150), pecas, 10)).toEqual(noContorno(frente, 1, 200, 150));
  });

  it('entre duas peças, vale o contorno mais próximo', () => {
    expect(alvoDaMedicao(ponto(292, 150), pecas, 100)).toEqual(noContorno(costas, 3, 300, 150));
    expect(alvoDaMedicao(ponto(208, 150), pecas, 100)).toEqual(noContorno(frente, 1, 200, 150));
  });

  it('a peça do trecho em andamento tem preferência quando o contorno dela está ao alcance', () => {
    expect(alvoDaMedicao(ponto(292, 150), pecas, 100, 'frente')).toEqual(noContorno(frente, 1, 200, 150));
  });

  it('fora de tudo, nada', () => {
    expect(alvoDaMedicao(ponto(250, 150), pecas, 10)).toBeNull();
  });
});

describe('cliqueDePerimetro', () => {
  it('um clique dentro da peça mede o perímetro inteiro dela', () => {
    const estado = cliqueDePerimetro(SEM_MEDICAO, { tipo: 'interior', peca: frente }, false);
    expect(estado).toEqual({ medicoes: [{ tipo: 'perimetro', pecaId: 'frente' }], inicioDoTrecho: null });
  });

  it('dois cliques no mesmo contorno medem o trecho do primeiro ao segundo', () => {
    const comInicio = cliqueDePerimetro(SEM_MEDICAO, noContorno(frente, 1, 200, 0), false);
    expect(comInicio.medicoes).toEqual([]);
    expect(comInicio.inicioDoTrecho?.de.ponto).toEqual(ponto(200, 0));

    const estado = cliqueDePerimetro(comInicio, noContorno(frente, 3, 0, 300), false);

    expect(estado.inicioDoTrecho).toBeNull();
    expect(resolverMedicao(estado.medicoes[0]!, pecas)).toMatchObject({ tipo: 'trecho', valorMm: 500, outroLadoMm: 500 });
  });

  it('o segundo clique no mesmo ponto não forma um trecho', () => {
    const comInicio = cliqueDePerimetro(SEM_MEDICAO, noContorno(frente, 1, 200, 0), false);
    expect(cliqueDePerimetro(comInicio, noContorno(frente, 1, 200, 0), false)).toBe(comInicio);
  });

  it('o segundo clique noutra peça recomeça o trecho nela', () => {
    const comInicio = cliqueDePerimetro(SEM_MEDICAO, noContorno(frente, 1, 200, 0), false);
    const estado = cliqueDePerimetro(comInicio, noContorno(costas, 0, 300, 0), false);
    expect(estado.medicoes).toEqual([]);
    expect(estado.inicioDoTrecho?.pecaId).toBe('costas');
  });

  it('um clique fora de tudo não muda nada', () => {
    const comInicio = cliqueDePerimetro(SEM_MEDICAO, noContorno(frente, 1, 200, 0), false);
    expect(cliqueDePerimetro(comInicio, null, false)).toBe(comInicio);
  });

  it('medindo, uma medida nova troca a anterior', () => {
    const primeira = cliqueDePerimetro(SEM_MEDICAO, { tipo: 'interior', peca: frente }, false);
    const segunda = cliqueDePerimetro(primeira, { tipo: 'interior', peca: costas }, false);
    expect(segunda.medicoes).toEqual([{ tipo: 'perimetro', pecaId: 'costas' }]);
  });

  it('comparando, ficam duas medidas; a terceira recomeça a comparação', () => {
    let estado: EstadoDeMedicao = cliqueDePerimetro(SEM_MEDICAO, { tipo: 'interior', peca: frente }, true);
    estado = cliqueDePerimetro(estado, noContorno(costas, 0, 300, 0), true);
    expect(estado.medicoes).toHaveLength(1); // a primeira espera o fim do trecho
    estado = cliqueDePerimetro(estado, noContorno(costas, 2, 400, 300), true);
    expect(estado.medicoes.map((m) => m.tipo)).toEqual(['perimetro', 'trecho']);

    estado = cliqueDePerimetro(estado, { tipo: 'interior', peca: costas }, true);
    expect(estado.medicoes).toEqual([{ tipo: 'perimetro', pecaId: 'costas' }]);
  });
});

describe('resolverMedicao', () => {
  it('distância: horizontal e vertical são as da tela, e o ângulo vai de 0° a 360° no sentido anti-horário', () => {
    // Na tela, a horizontal é o Y do mundo e a vertical é o X (para baixo):
    // de (0,0) a (300,400) anda 400 para a direita e 300 para baixo.
    const medida = resolverMedicao({ tipo: 'distancia', de: ponto(0, 0), ate: ponto(300, 400) }, pecas);
    expect(medida).toMatchObject({ tipo: 'distancia', valorMm: 500, horizontalMm: 400, verticalMm: 300 });
    expect(medida?.tipo === 'distancia' && medida.anguloGraus).toBeCloseTo(360 - 36.8699, 3);
  });

  it('ângulos nos quatro sentidos da tela', () => {
    const angulo = (x: number, y: number): number => {
      const medida = resolverMedicao({ tipo: 'distancia', de: ponto(0, 0), ate: ponto(x, y) }, pecas);
      return medida?.tipo === 'distancia' ? medida.anguloGraus : Number.NaN;
    };
    expect(angulo(0, 100)).toBe(0); // para a direita
    expect(angulo(-100, 0)).toBe(90); // para cima
    expect(angulo(0, -100)).toBe(180); // para a esquerda
    expect(angulo(100, 0)).toBe(270); // para baixo
  });

  it('perímetro: o do contorno e, com margem de costura, o da linha de corte', () => {
    expect(resolverMedicao({ tipo: 'perimetro', pecaId: 'frente' }, pecas)).toMatchObject({ valorMm: 1000, corteMm: null });
    const comCostura = definirMargemDeCostura(frente, 10);
    expect(resolverMedicao({ tipo: 'perimetro', pecaId: 'frente' }, [comCostura])).toMatchObject({
      valorMm: 1000,
      corteMm: 1080,
    });
  });

  it('a medida deixa de valer se a peça sumiu ou se o contorno medido mudou', () => {
    const trecho = {
      tipo: 'trecho' as const,
      pecaId: 'frente',
      contorno: frente.contorno,
      de: { indiceAresta: 0, ponto: ponto(0, 0) },
      ate: { indiceAresta: 1, ponto: ponto(200, 0) },
    };
    expect(resolverMedicao(trecho, pecas)).toMatchObject({ valorMm: 200 });
    expect(resolverMedicao(trecho, [costas])).toBeNull();
    expect(resolverMedicao(trecho, [transladarMolde(frente, ponto(10, 0), 'frente')])).toBeNull();
    expect(resolverMedicao({ tipo: 'perimetro', pecaId: 'frente' }, [costas])).toBeNull();
  });
});

describe('descreverMedicao e descreverComparacao', () => {
  const resolver = (medicao: Parameters<typeof resolverMedicao>[0], lista = pecas) => resolverMedicao(medicao, lista)!;

  it('escreve a distância com horizontal, vertical e ângulo', () => {
    expect(descreverMedicao(resolver({ tipo: 'distancia', de: ponto(0, 0), ate: ponto(-300, 400) }))).toBe(
      'Distância: 500,0 mm · horizontal 400,0 mm · vertical 300,0 mm · ângulo 36,9°',
    );
  });

  it('escreve o perímetro e a linha de corte', () => {
    expect(descreverMedicao(resolver({ tipo: 'perimetro', pecaId: 'frente' }))).toBe('Perímetro de “Frente”: 1000,0 mm');
    expect(descreverMedicao(resolver({ tipo: 'perimetro', pecaId: 'frente' }, [definirMargemDeCostura(frente, 10)]))).toBe(
      'Perímetro de “Frente”: 1000,0 mm · linha de corte, com a costura de 10,0 mm: 1080,0 mm',
    );
  });

  it('escreve o trecho, o outro lado e o perímetro', () => {
    const trecho = resolver({
      tipo: 'trecho',
      pecaId: 'frente',
      contorno: frente.contorno,
      de: { indiceAresta: 0, ponto: ponto(150, 0) },
      ate: { indiceAresta: 1, ponto: ponto(200, 100) },
    });
    expect(descreverMedicao(trecho)).toBe('Trecho de “Frente”: 150,0 mm · pelo outro lado 850,0 mm · perímetro 1000,0 mm');
  });

  it('compara duas medidas e diz qual é a maior', () => {
    const daFrente = resolver({ tipo: 'perimetro', pecaId: 'frente' });
    const dasCostas = resolver({ tipo: 'perimetro', pecaId: 'costas' });
    expect(descreverComparacao(daFrente, dasCostas)).toBe(
      '1ª medida: 1000,0 mm (perímetro de “Frente”) · 2ª medida: 800,0 mm (perímetro de “Costas”) · diferença: 200,0 mm (a 1ª é maior)',
    );
    expect(descreverComparacao(dasCostas, daFrente)).toContain('diferença: 200,0 mm (a 2ª é maior)');
    expect(descreverComparacao(daFrente, daFrente)).toContain('diferença: 0,0 mm (iguais)');
  });
});

describe('descreverConferencia', () => {
  const trechoDe = (peca: typeof frente, ate: number) =>
    resolverMedicao(
      {
        tipo: 'trecho',
        pecaId: peca.id,
        contorno: peca.contorno,
        de: { indiceAresta: 1, ponto: peca.contorno[1]! },
        ate: { indiceAresta: 1, ponto: ponto(peca.contorno[1]!.x, ate) },
      },
      pecas,
    )!;

  it('duas costuras do mesmo comprimento conferem', () => {
    expect(descreverConferencia(trechoDe(frente, 300), trechoDe(costas, 300))).toBe(
      'As duas costuras conferem — 1ª: 300,0 mm (trecho de “Frente”) · 2ª: 300,0 mm (trecho de “Costas”)',
    );
  });

  it('quando não conferem, diz qual sobra, de quanto e quanto isso é da menor', () => {
    expect(descreverConferencia(trechoDe(frente, 300), trechoDe(costas, 240))).toBe(
      'Não conferem: a 1ª é 60,0 mm maior (25,0%) — 1ª: 300,0 mm (trecho de “Frente”) · 2ª: 240,0 mm (trecho de “Costas”)',
    );
    expect(descreverConferencia(trechoDe(costas, 240), trechoDe(frente, 300))).toContain('Não conferem: a 2ª é 60,0 mm maior (25,0%)');
  });

  it('a folga é de meio milímetro: até ela confere, acima dela não', () => {
    expect(FOLGA_DA_CONFERENCIA_MM).toBe(0.5);
    expect(descreverConferencia(trechoDe(frente, 300), trechoDe(costas, 299.5))).toContain('As duas costuras conferem');
    expect(descreverConferencia(trechoDe(frente, 300), trechoDe(costas, 300.5))).toContain('As duas costuras conferem');
    expect(descreverConferencia(trechoDe(frente, 300), trechoDe(costas, 299.4))).toContain('Não conferem: a 1ª é 0,6 mm maior (0,2%)');
    expect(descreverConferencia(trechoDe(frente, 300), trechoDe(costas, 300.6))).toContain('Não conferem: a 2ª é 0,6 mm maior (0,2%)');
  });
});
