import { describe, it, expect } from 'vitest';
import { area, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { definirRegra } from './graduacao';
import {
  criarMolde,
  dimensionarMolde,
  espelharMolde,
  moverPontoDoMolde,
  rotacionarMolde,
  transladarMolde,
  type DadosDeNovoMolde,
  type Molde,
} from './molde';
import {
  abrirPence,
  alterarPence,
  alterarPenceInterna,
  comPencesValidas,
  criarMultiplasPences,
  criarPence,
  criarPenceInterna,
  fecharPence,
  medidasDaPence,
  medidasDaPenceInterna,
  penceNoVertice,
  pencePerto,
  pencesDaPeca,
  removerPence,
  transferirPence,
  type OpcoesDePence,
} from './pences';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm. A aresta 2 é a de cima na conta (y = 300), percorrida de x = 200 para x = 0.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const NO_ALTO: PosicaoNoContorno = { indiceAresta: 2, ponto: ponto(100, 300) };
const RECORTAR: OpcoesDePence = { aberturaMm: 40, profundidadeMm: 100, modo: 'recortar', piquesLaterais: true, marcaNoVertice: true };
const MARCAR: OpcoesDePence = { ...RECORTAR, modo: 'marcar' };
const INTERNA = { altura1Mm: 60, altura2Mm: 40, larguraMm: 20, anguloGraus: 0, linhaAuxiliar: true, marcas: true };

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever },
    'm1',
  );
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

const recortada = (): Molde => criarPence(molde(), NO_ALTO, RECORTAR, ids());
const marcada = (): Molde => criarPence(molde(), NO_ALTO, MARCAR, ids());
const aPence = (peca: Molde) => pencesDaPeca(peca)[0]!;
const perto = (obtido: Ponto2D, esperado: Ponto2D): void => {
  expect(obtido.x).toBeCloseTo(esperado.x, 6);
  expect(obtido.y).toBeCloseTo(esperado.y, 6);
};

describe('toda pence feita por ferramenta fica registrada', () => {
  it('recortada: as pontas e o vértice, o que o recorte tirou do contorno e os piques que vieram com ela', () => {
    const peca = recortada();

    expect(peca.pences).toHaveLength(1);
    expect(aPence(peca)).toMatchObject({
      tipo: 'recortada',
      pontos: [ponto(120, 300), ponto(100, 200), ponto(80, 300)],
      removidos: [],
      pontasCriadas: [true, true],
    });
    expect(aPence(peca).piques).toEqual(peca.piques.map((q) => q.id));
    expect(aPence(peca).piques).toHaveLength(2);
    expect(medidasDaPence(aPence(peca))).toEqual({ aberturaMm: 40, profundidadeMm: 100, desvioMm: 0 });
  });

  it('marcada: o contorno não muda, e o registro guarda a linha, os piques e a marca do vértice', () => {
    const peca = marcada();

    expect(peca.contorno).toEqual(RETANGULO);
    expect(aPence(peca)).toMatchObject({ tipo: 'marcada', pontos: [ponto(120, 300), ponto(100, 200), ponto(80, 300)] });
    expect(aPence(peca).marcas).toEqual(peca.marcas.map((m) => m.id));
    expect(aPence(peca).piques).toHaveLength(2);
  });

  it('interna: os quatro cantos do losango, o eixo e as marcas', () => {
    const peca = criarPenceInterna(molde(), ponto(100, 150), INTERNA, ids());

    expect(aPence(peca)).toMatchObject({ tipo: 'interna', comEixo: true });
    expect(aPence(peca).pontos).toHaveLength(4);
    expect(aPence(peca).marcas).toHaveLength(4);
    const medidas = medidasDaPenceInterna(aPence(peca));
    expect(medidas.altura1Mm).toBeCloseTo(60, 9);
    expect(medidas.altura2Mm).toBeCloseTo(40, 9);
    expect(medidas.larguraMm).toBeCloseTo(20, 9);
  });

  it('o recorte numa curva guarda os pontos do contorno que tirou', () => {
    const comPontosNoAlto = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(110, 300), ponto(90, 300), ponto(0, 300)] });
    const peca = criarPence(comPontosNoAlto, { indiceAresta: 3, ponto: ponto(100, 300) }, RECORTAR, ids());

    expect(aPence(peca).removidos).toEqual([ponto(110, 300), ponto(90, 300)]);
    expect(removerPence(peca, aPence(peca).id).contorno).toEqual(comPontosNoAlto.contorno);
  });

  it('várias pences de uma vez, e a pence aberta por pivô, também ficam registradas', () => {
    const varias = criarMultiplasPences(molde(), NO_ALTO, 3, 50, { ...RECORTAR, aberturaMm: 20, profundidadeMm: 60 }, ids());
    expect(pencesDaPeca(varias)).toHaveLength(3);
    for (const pence of pencesDaPeca(varias)) expect(medidasDaPence(pence).profundidadeMm).toBeCloseTo(60, 6);

    const aberta = abrirPence(molde(), { indiceAresta: 2, ponto: ponto(120, 300) }, { indiceAresta: 0, ponto: ponto(120, 0) }, 30, 100, true, ids());
    expect(pencesDaPeca(aberta)).toHaveLength(1);
    expect(medidasDaPence(aPence(aberta)).aberturaMm).toBeCloseTo(30, 6);
    expect(penceNoVertice(aberta, aberta.contorno.findIndex((p) => p === aPence(aberta).pontos[1]))).not.toBeNull();
  });
});

describe('mudar as medidas de uma pence já feita', () => {
  it('recortada: é refeita no mesmo lugar, com a abertura e a profundidade novas', () => {
    const peca = recortada();
    const mudada = alterarPence(peca, aPence(peca).id, { aberturaMm: 60, profundidadeMm: 50, desvioMm: 0 }, ids());

    expect(mudada.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(130, 300), ponto(100, 250), ponto(70, 300), ponto(0, 300)]);
    expect(area(mudada.contorno)).toBeCloseTo(60000 - (60 * 50) / 2, 6);
    expect(pencesDaPeca(mudada)).toHaveLength(1);
    expect(medidasDaPence(aPence(mudada))).toEqual({ aberturaMm: 60, profundidadeMm: 50, desvioMm: 0 });
    // Os piques das pontas foram junto: são dois, nas pontas novas.
    expect(mudada.piques).toHaveLength(2);
    perto(mudada.piques[0]!.posicao, ponto(130, 300));
    perto(mudada.piques[1]!.posicao, ponto(70, 300));
  });

  it('o desvio leva o vértice para o lado da segunda ponta, sem mudar a profundidade em esquadro', () => {
    const peca = recortada();
    const mudada = alterarPence(peca, aPence(peca).id, { aberturaMm: 40, profundidadeMm: 50, desvioMm: 10 }, ids());

    // As pontas vão de x = 120 para x = 80: a segunda ponta fica do lado de x menor.
    perto(aPence(mudada).pontos[1]!, ponto(90, 250));
    const medidas = medidasDaPence(aPence(mudada));
    expect(medidas.profundidadeMm).toBeCloseTo(50, 6);
    expect(medidas.desvioMm).toBeCloseTo(10, 6);
    expect(medidas.aberturaMm).toBeCloseTo(40, 6);
  });

  it('marcada: a linha, os piques e a marca são trocados pelos da pence nova', () => {
    const peca = marcada();
    const mudada = alterarPence(peca, aPence(peca).id, { aberturaMm: 20, profundidadeMm: 80, desvioMm: 0 }, ids());

    expect(mudada.contorno).toEqual(RETANGULO);
    expect(mudada.linhasInternas).toEqual([[ponto(110, 300), ponto(100, 220), ponto(90, 300)]]);
    expect(mudada.marcas.map((m) => m.posicao)).toEqual([ponto(100, 220)]);
    expect(mudada.piques).toHaveLength(2);
    perto(mudada.piques[0]!.posicao, ponto(110, 300));
    perto(mudada.piques[1]!.posicao, ponto(90, 300));
    expect(aPence(mudada).tipo).toBe('marcada');
  });

  it('interna: o losango é refeito no mesmo centro e na mesma direção', () => {
    const peca = criarPenceInterna(molde(), ponto(100, 150), INTERNA, ids());
    const mudada = alterarPenceInterna(peca, aPence(peca).id, { altura1Mm: 30, altura2Mm: 30, larguraMm: 40 }, ids());

    expect(medidasDaPenceInterna(aPence(mudada)).larguraMm).toBeCloseTo(40, 6);
    expect(medidasDaPenceInterna(aPence(mudada)).altura1Mm).toBeCloseTo(30, 6);
    // O fio vai para +y: a ponta 1 fica acima do centro, como antes.
    perto(aPence(mudada).pontos[0]!, ponto(100, 180));
    expect(mudada.linhasInternas).toHaveLength(2);
    expect(mudada.marcas).toHaveLength(4);
  });

  it('recusa medidas que não dão uma pence, e não muda nada', () => {
    const peca = recortada();
    const id = aPence(peca).id;

    expect(() => alterarPence(peca, id, { aberturaMm: 0, profundidadeMm: 50, desvioMm: 0 }, ids())).toThrow('abertura da pence precisa ser maior que zero');
    expect(() => alterarPence(peca, id, { aberturaMm: 40, profundidadeMm: 900, desvioMm: 0 }, ids())).toThrow('fora da peça');
    expect(() => alterarPence(peca, id, { aberturaMm: 40, profundidadeMm: 50, desvioMm: Number.NaN }, ids())).toThrow('desvio do vértice');
    expect(() => alterarPence(peca, 'outra', { aberturaMm: 40, profundidadeMm: 50, desvioMm: 0 }, ids())).toThrow('mexida à mão');
    expect(() => alterarPenceInterna(peca, id, { altura1Mm: 10, altura2Mm: 10, larguraMm: 10 }, ids())).toThrow('não é interna');
  });
});

describe('apagar uma pence', () => {
  it('recortada: o contorno volta a ser o de antes do recorte, e os piques dela saem', () => {
    const peca = recortada();
    const sem = removerPence(peca, aPence(peca).id);

    expect(sem.contorno).toEqual(RETANGULO);
    expect(sem.piques).toEqual([]);
    expect('pences' in sem).toBe(false);
  });

  it('marcada e interna: saem as linhas e as marcas da pence, e só elas', () => {
    const comOutraLinha = molde({ linhasInternas: [[ponto(10, 10), ponto(60, 10)]] });
    const comMarcada = criarPence(comOutraLinha, NO_ALTO, MARCAR, ids());
    const semMarcada = removerPence(comMarcada, aPence(comMarcada).id);
    expect(semMarcada.linhasInternas).toEqual([[ponto(10, 10), ponto(60, 10)]]);
    expect(semMarcada.marcas).toEqual([]);
    expect(semMarcada.piques).toEqual([]);

    const comInterna = criarPenceInterna(comOutraLinha, ponto(100, 150), INTERNA, ids());
    expect(comInterna.linhasInternas).toHaveLength(3);
    const semInterna = removerPence(comInterna, aPence(comInterna).id);
    expect(semInterna.linhasInternas).toEqual([[ponto(10, 10), ponto(60, 10)]]);
    expect(semInterna.marcas).toEqual([]);
  });

  it('a ponta que já era um ponto do contorno não sai com a pence', () => {
    // A pence de 100 mm de abertura centrada em (100, 300): a ponta de x = 150 já era um ponto do contorno.
    const comPonto = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(150, 300), ponto(0, 300)] });
    const peca = criarPence(comPonto, { indiceAresta: 3, ponto: ponto(100, 300) }, { ...RECORTAR, aberturaMm: 100 }, ids());

    expect(aPence(peca).pontasCriadas).toEqual([false, true]);
    expect(removerPence(peca, aPence(peca).id).contorno).toEqual(comPonto.contorno);
  });

  it('das duas pences de uma peça, só a pedida sai', () => {
    const novoId = ids();
    const duas = criarPence(criarPence(molde(), NO_ALTO, RECORTAR, novoId), { indiceAresta: 0, ponto: ponto(100, 0) }, { ...RECORTAR, profundidadeMm: 60 }, novoId);
    expect(pencesDaPeca(duas)).toHaveLength(2);

    const uma = removerPence(duas, pencesDaPeca(duas)[0]!.id);
    expect(pencesDaPeca(uma)).toHaveLength(1);
    expect(medidasDaPence(aPence(uma)).profundidadeMm).toBeCloseTo(60, 6);
    expect(area(uma.contorno)).toBeCloseTo(60000 - (40 * 60) / 2, 6);
  });
});

describe('o registro só vale enquanto a pence está na peça como foi posta', () => {
  it('o contorno mudado à mão (o vértice trocado de lugar sem o registro) invalida o registro', () => {
    const peca = recortada();
    const mexida: Molde = { ...peca, contorno: peca.contorno.map((p) => (p.y === 200 ? ponto(100, 190) : p)) };

    expect(pencesDaPeca(mexida)).toEqual([]);
    expect('pences' in comPencesValidas(mexida)).toBe(false);
    expect(comPencesValidas(peca)).toBe(peca);
  });

  it('o registro vale também com o contorno guardado no outro sentido', () => {
    const peca = recortada();
    const invertida: Molde = { ...peca, contorno: [...peca.contorno].reverse() };

    expect(pencesDaPeca(invertida)).toHaveLength(1);
    const sem = removerPence(invertida, aPence(invertida).id);
    expect(sem.contorno).toHaveLength(4);
    expect(area(sem.contorno)).toBeCloseTo(60000, 6);
    const mudada = alterarPence(invertida, aPence(invertida).id, { aberturaMm: 40, profundidadeMm: 50, desvioMm: 0 }, ids());
    expect(area(mudada.contorno)).toBeCloseTo(60000 - (40 * 50) / 2, 6);
  });

  it('Mover ponto no vértice ou numa ponta leva o registro junto: a pence continua editável', () => {
    const peca = recortada();
    const i = peca.contorno.findIndex((p) => p.y === 200);
    const movida = moverPontoDoMolde(peca, i, ponto(105, 210));

    expect(pencesDaPeca(movida)).toHaveLength(1);
    expect(aPence(movida).pontos[1]).toEqual(ponto(105, 210));
    expect(medidasDaPence(aPence(movida)).profundidadeMm).toBeCloseTo(90, 6);
  });

  it('a pence acompanha a peça movida, girada, espelhada e dimensionada', () => {
    const movida = transladarMolde(recortada(), ponto(30, 40), 'm1');
    expect(aPence(movida).pontos[1]).toEqual(ponto(130, 240));

    for (const transformada of [movida, rotacionarMolde(recortada(), 90), espelharMolde(recortada(), 'm1')]) {
      expect(pencesDaPeca(transformada)).toHaveLength(1);
      const medidas = medidasDaPence(aPence(transformada));
      expect(medidas.aberturaMm).toBeCloseTo(40, 6);
      expect(medidas.profundidadeMm).toBeCloseTo(100, 6);
      // Depois da transformação, a pence ainda muda de medida no lugar.
      const mudada = alterarPence(transformada, aPence(transformada).id, { aberturaMm: 40, profundidadeMm: 50, desvioMm: 0 }, ids());
      expect(area(mudada.contorno)).toBeCloseTo(60000 - (40 * 50) / 2, 4);
    }

    const maior = dimensionarMolde(recortada(), 2, 1);
    expect(medidasDaPence(aPence(maior)).aberturaMm).toBeCloseTo(80, 6);
    expect(medidasDaPence(aPence(maior)).profundidadeMm).toBeCloseTo(100, 6);
  });

  it('em cada tamanho da graduação, a pence continua registrada', () => {
    let graduada = definirTamanhosDoMolde(recortada(), ['P', 'M', 'G'], 'M');
    const vertice = graduada.contorno.findIndex((p) => p.y === 200);
    graduada = { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, vertice, [ponto(0, 10), ponto(0, 0), ponto(0, -10)]) };

    const g = moldeDoTamanho(graduada, 2, 'g');
    expect(pencesDaPeca(g)).toHaveLength(1);
    expect(medidasDaPence(aPence(g)).profundidadeMm).toBeCloseTo(110, 6);
  });
});

describe('fechar e transferir uma pence registrada', () => {
  it('penceNoVertice e pencePerto acham a pence pelo registro', () => {
    const peca = recortada();
    const vertice = peca.contorno.findIndex((p) => p.y === 200);

    expect(penceNoVertice(peca, vertice)?.id).toBe(aPence(peca).id);
    expect(penceNoVertice(peca, 0)).toBeNull();
    // A meio caminho de uma perna, a 3 mm dela.
    expect(pencePerto(peca, ponto(113, 250), 5)?.id).toBe(aPence(peca).id);
    expect(pencePerto(peca, ponto(160, 150), 5)).toBeNull();
    expect(pencePerto(molde(), ponto(100, 250), 50)).toBeNull();
  });

  it('fechar só o recorte: a pence continua registrada, agora como marcada, e continua editável', () => {
    const peca = recortada();
    const id = aPence(peca).id;
    const fechada = fecharPence(peca, peca.contorno.findIndex((p) => p.y === 200), null);

    // O contorno passa reto de uma ponta à outra; as duas pontas continuam nele.
    expect(fechada.contorno).toHaveLength(6);
    expect(area(fechada.contorno)).toBeCloseTo(60000, 6);
    expect(aPence(fechada)).toMatchObject({ id, tipo: 'marcada' });
    const mudada = alterarPence(fechada, id, { aberturaMm: 20, profundidadeMm: 60, desvioMm: 0 }, ids());
    expect(mudada.linhasInternas).toEqual([[ponto(110, 300), ponto(100, 240), ponto(90, 300)]]);
  });

  it('fechar com pivô: a pence deixa de existir, e o registro sai', () => {
    const peca = recortada();
    const fechada = fecharPence(peca, peca.contorno.findIndex((p) => p.y === 200), { indiceAresta: 0, ponto: ponto(100, 0) });

    expect(pencesDaPeca(fechada)).toEqual([]);
    expect('pences' in fechada).toBe(false);
  });

  it('transferir: o registro passa a ser o da pence nova, com o mesmo vértice, e ela continua editável', () => {
    const peca = recortada();
    const id = aPence(peca).id;
    const transferida = transferirPence(peca, peca.contorno.findIndex((p) => p.y === 200), { indiceAresta: 1, ponto: ponto(200, 200) });

    expect(area(transferida.contorno)).toBeCloseTo(area(peca.contorno), 6);
    expect(pencesDaPeca(transferida)).toHaveLength(1);
    expect(aPence(transferida).id).toBe(id);
    perto(aPence(transferida).pontos[1]!, ponto(100, 200));
    const vertice = transferida.contorno.findIndex((p) => Math.abs(p.x - 100) < 1e-6 && Math.abs(p.y - 200) < 1e-6);
    expect(penceNoVertice(transferida, vertice)?.id).toBe(id);
    // A pence nova abre para o lado direito: as pontas dela estão em x = 200, ou perto.
    expect(Math.max(...aPence(transferida).pontos.map((p) => p.x))).toBeGreaterThan(190);
  });

  it('a pence que está no lado da peça que gira vai junto, e continua registrada', () => {
    // Uma pence no alto, à direita (x = 150), e depois outra, aberta por pivô, que gira o lado direito da peça.
    const comUma = criarPence(molde(), { indiceAresta: 2, ponto: ponto(150, 300) }, { ...RECORTAR, aberturaMm: 20, profundidadeMm: 50 }, ids());
    const comDuas = abrirPence(comUma, { indiceAresta: 0, ponto: ponto(100, 0) }, { indiceAresta: 6, ponto: ponto(100, 300) }, 20, 80, false, ids());

    expect(pencesDaPeca(comDuas)).toHaveLength(2);
    for (const pence of pencesDaPeca(comDuas)) expect(medidasDaPence(pence).aberturaMm).toBeCloseTo(20, 4);
  });
});
