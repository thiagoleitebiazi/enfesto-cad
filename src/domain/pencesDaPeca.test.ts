import { describe, it, expect } from 'vitest';
import { area, ponto, pontoMaisProximoNoContorno, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
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
  comAcabamento,
  dobraDaPence,
  comPenceReconhecida,
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
  penceSemRegistroPerto,
  pivoDaPence,
  removerPence,
  semAcabamento,
  transferirPence,
  type OpcoesDePence,
} from './pences';
import { criarPregas } from './pregas';
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

describe('a pence aberta por pivô guarda o pivô', () => {
  const PIVO: PosicaoNoContorno = { indiceAresta: 0, ponto: ponto(100, 0) };
  const aberta = (aberturaMm = 40, base: Molde = molde()): Molde => abrirPence(base, NO_ALTO, PIVO, aberturaMm, 100, true, ids());
  const aDela = (peca: Molde) => pencesDaPeca(peca)[0]!;

  it('o registro tem o pivô, e ele vale enquanto está sobre o contorno', () => {
    const peca = aberta();

    expect(aDela(peca).pivo).toEqual(ponto(100, 0));
    expect(pivoDaPence(peca, aDela(peca))?.ponto).toEqual(ponto(100, 0));
    // Com o pivô fora do contorno, a pence é como as outras recortadas.
    const semPivoNoContorno = { ...peca, pences: peca.pences!.map((q) => ({ ...q, pivo: ponto(100, 50) })) };
    expect(pivoDaPence(semPivoNoContorno, aDela(semPivoNoContorno))).toBeNull();
    // A pence recortada comum não tem pivô.
    const comum = criarPence(molde(), NO_ALTO, RECORTAR, ids());
    expect(pivoDaPence(comum, pencesDaPeca(comum)[0]!)).toBeNull();
  });

  it('mudada a abertura, a peça fecha em torno do pivô e abre de novo: é a mesma de abrir direto com a medida nova', () => {
    const mudada = alterarPence(aberta(40), aDela(aberta(40)).id, { aberturaMm: 60, profundidadeMm: 80, desvioMm: 0 }, ids());
    const direta = abrirPence(molde(), NO_ALTO, PIVO, 60, 80, true, ids());

    expect(area(mudada.contorno)).toBeCloseTo(area(direta.contorno), 6);
    expect(area(mudada.contorno)).not.toBeCloseTo(area(aberta(40).contorno), 0);
    const medidas = medidasDaPence(aDela(mudada));
    expect(medidas.aberturaMm).toBeCloseTo(60, 6);
    expect(medidas.profundidadeMm).toBeCloseTo(80, 6);
    expect(medidas.desvioMm).toBeCloseTo(0, 6);
    // Continua aberta por pivô, com os dois piques das pontas (e só eles).
    expect(pivoDaPence(mudada, aDela(mudada))?.ponto).toEqual(ponto(100, 0));
    expect(mudada.piques).toHaveLength(2);
    for (const p of direta.contorno) expect(mudada.contorno.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6)).toBe(true);
  });

  it('vale também no contorno que corre no outro sentido', () => {
    const aoContrario = molde({ contorno: [...RETANGULO].reverse() });
    const peca = abrirPence(aoContrario, { indiceAresta: 0, ponto: ponto(100, 300) }, { indiceAresta: 2, ponto: ponto(100, 0) }, 40, 100, false, ids());
    const mudada = alterarPence(peca, aDela(peca).id, { aberturaMm: 60, profundidadeMm: 100, desvioMm: 0 }, ids());
    const direta = abrirPence(aoContrario, { indiceAresta: 0, ponto: ponto(100, 300) }, { indiceAresta: 2, ponto: ponto(100, 0) }, 60, 100, false, ids());

    expect(Math.abs(area(mudada.contorno))).toBeCloseTo(Math.abs(area(direta.contorno)), 6);
    expect(medidasDaPence(aDela(mudada)).aberturaMm).toBeCloseTo(60, 6);
  });

  it('apagada, a pence fecha em torno do pivô: a peça volta a ter a área de antes de abrir', () => {
    const peca = aberta();
    expect(area(peca.contorno)).toBeGreaterThan(60000);
    const fechada = removerPence(peca, aDela(peca).id);

    expect(area(fechada.contorno)).toBeCloseTo(60000, 6);
    expect('pences' in fechada).toBe(false);
    expect(fechada.piques).toHaveLength(0);
    for (const canto of RETANGULO) expect(fechada.contorno.some((q) => Math.hypot(canto.x - q.x, canto.y - q.y) < 1e-6)).toBe(true);
  });

  it('com o pivô fora do contorno, mudar as medidas refaz só o recorte, como na pence comum', () => {
    const peca = aberta();
    const semPivo = { ...peca, pences: peca.pences!.map((q) => ({ ...q, pivo: ponto(100, 50) })) };
    const mudada = alterarPence(semPivo, aDela(semPivo).id, { aberturaMm: 60, profundidadeMm: 100, desvioMm: 0 }, ids());
    const direta = abrirPence(molde(), NO_ALTO, PIVO, 60, 100, true, ids());

    expect(area(mudada.contorno)).not.toBeCloseTo(area(direta.contorno), 0);
    // As pontas andam sobre o contorno, que ali já não é reto: a abertura sai quase a pedida.
    expect(medidasDaPence(aDela(mudada)).aberturaMm).toBeCloseTo(60, 0);
  });

  it('o pivô vai junto quando o lado da peça em que ele está anda (uma prega aberta depois)', () => {
    const peca = aberta();
    // A prega corta a peça em x = 80: o lado da linha de fio (x = 50) fica, e o outro, com a pence e o pivô, anda.
    const no = (x: number, y: number): PosicaoNoContorno => {
      const perto = pontoMaisProximoNoContorno(ponto(x, y), peca.contorno);
      return { indiceAresta: perto.indiceAresta, ponto: perto.ponto };
    };
    const comPrega = criarPregas(peca, no(80, 0), no(80, 300), { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 10, piques: false }, null, ids());

    expect(aDela(comPrega).pivo).not.toEqual(ponto(100, 0));
    expect(pivoDaPence(comPrega, aDela(comPrega))).not.toBeNull();
    // E a pence continua mudando de medida em torno dele.
    const mudada = alterarPence(comPrega, aDela(comPrega).id, { aberturaMm: 60, profundidadeMm: 100, desvioMm: 0 }, ids());
    expect(medidasDaPence(aDela(mudada)).aberturaMm).toBeCloseTo(60, 6);
  });

  it('o pivô acompanha a peça transladada e o tamanho da graduação', () => {
    const levada = transladarMolde(aberta(), ponto(10, 20), 'outra');
    expect(aDela(levada).pivo).toEqual(ponto(110, 20));
    expect(pivoDaPence(levada, aDela(levada))).not.toBeNull();

    const graduada = definirTamanhosDoMolde(aberta(), ['M', 'G'], 'M');
    expect(pivoDaPence(moldeDoTamanho(graduada, 1, 'g'), aDela(moldeDoTamanho(graduada, 1, 'g')))).not.toBeNull();
  });
});

describe('a pence que não tem registro é reconhecida pelo desenho', () => {
  // O retângulo com uma pence desenhada à mão no alto: pontas em (120, 300) e (80, 300), vértice em (100, 200).
  const COM_V = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)];
  const aMao = (): Molde => molde({ contorno: COM_V });

  it('o clique no vértice do canto que entra na peça acha a pence, com as pontas que saem com ela', () => {
    const achada = penceSemRegistroPerto(aMao(), ponto(101, 202), 6, 'do-contorno', 'r1');

    expect(achada).toEqual({
      id: 'r1',
      tipo: 'recortada',
      pontos: [ponto(120, 300), ponto(100, 200), ponto(80, 300)],
      removidos: [],
      pontasCriadas: [true, true],
    });
    // O desenho não muda: só achar não registra nada.
    expect('pences' in aMao()).toBe(false);
  });

  it('registrada, ela muda de medidas e é apagada como a feita por ferramenta', () => {
    const achada = penceSemRegistroPerto(aMao(), ponto(100, 200), 6, 'do-contorno', 'r1')!;
    const registrada = comPenceReconhecida(aMao(), achada);

    expect(registrada.contorno).toEqual(COM_V);
    expect(pencesDaPeca(registrada)).toHaveLength(1);
    expect(medidasDaPence(pencesDaPeca(registrada)[0]!)).toEqual({ aberturaMm: 40, profundidadeMm: 100, desvioMm: 0 });

    const mudada = alterarPence(registrada, 'r1', { aberturaMm: 60, profundidadeMm: 80, desvioMm: 0 }, ids());
    expect(medidasDaPence(pencesDaPeca(mudada)[0]!).aberturaMm).toBeCloseTo(60, 6);
    expect(area(mudada.contorno)).toBeCloseTo(60000 - (60 * 80) / 2, 6);

    // Apagada, as pontas que estavam na reta do alto saem com ela: volta o retângulo.
    const sem = removerPence(registrada, 'r1');
    expect(sem.contorno).toHaveLength(4);
    expect(area(sem.contorno)).toBeCloseTo(60000, 6);
  });

  it('a ponta que é um canto de verdade da peça não sai com a pence', () => {
    // A segunda ponta é o canto (0, 300) da peça.
    const noCanto = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(40, 300), ponto(20, 200), ponto(0, 300)] });
    const achada = penceSemRegistroPerto(noCanto, ponto(20, 200), 6, 'do-contorno', 'r1')!;

    expect(achada.pontasCriadas).toEqual([true, false]);
    const sem = removerPence(comPenceReconhecida(noCanto, achada), 'r1');
    expect(sem.contorno).toHaveLength(4);
    expect(sem.contorno).toContainEqual(ponto(0, 300));
  });

  it('não acha nada longe do vértice, no canto aberto demais, no canto para fora e na pence que já tem registro', () => {
    // Na perna da pence, longe do vértice.
    expect(penceSemRegistroPerto(aMao(), ponto(110, 250), 6, 'do-contorno', 'r1')).toBeNull();
    // Um canto de fora da peça.
    expect(penceSemRegistroPerto(aMao(), ponto(200, 300), 6, 'do-contorno', 'r1')).toBeNull();
    // Uma entrada rasa: as pernas fazem 136° uma com a outra.
    const rasa = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(150, 300), ponto(100, 280), ponto(50, 300), ponto(0, 300)] });
    expect(penceSemRegistroPerto(rasa, ponto(100, 280), 6, 'do-contorno', 'r1')).toBeNull();
    // A pence feita por ferramenta já tem registro.
    const feita = criarPence(molde(), NO_ALTO, RECORTAR, ids());
    expect(penceSemRegistroPerto(feita, ponto(100, 200), 6, 'do-contorno', 'r1')).toBeNull();
    // E o losango não é procurado entre as pences do contorno.
    expect(penceSemRegistroPerto(aMao(), ponto(100, 200), 6, 'interna', 'r1')).toBeNull();
  });

  it('a linha interna de três pontos com as pontas no contorno é uma pence marcada', () => {
    const linha = [ponto(120, 300), ponto(100, 200), ponto(80, 300)];
    const peca = molde({ linhasInternas: [linha, [ponto(50, 50), ponto(60, 60), ponto(70, 50)]] });
    const achada = penceSemRegistroPerto(peca, ponto(111, 250), 6, 'do-contorno', 'r1');

    expect(achada).toEqual({ id: 'r1', tipo: 'marcada', pontos: linha });
    // A outra linha de três pontos não toca o contorno: não é pence.
    expect(penceSemRegistroPerto(peca, ponto(60, 60), 6, 'do-contorno', 'r1')).toBeNull();

    const registrada = comPenceReconhecida(peca, achada!);
    expect(pencesDaPeca(registrada)).toHaveLength(1);
    expect(penceSemRegistroPerto(registrada, ponto(111, 250), 6, 'do-contorno', 'r2')).toBeNull();
    const mudada = alterarPence(registrada, 'r1', { aberturaMm: 30, profundidadeMm: 100, desvioMm: 0 }, ids());
    expect(medidasDaPence(pencesDaPeca(mudada)[0]!).aberturaMm).toBeCloseTo(30, 6);
    expect(mudada.linhasInternas).toHaveLength(2);
  });

  it('a linha interna fechada de quatro lados é uma pence interna, com as pontas na diagonal mais comprida', () => {
    // Desenhado a partir de um canto do lado, e com a linha do eixo.
    const losango = [ponto(110, 150), ponto(100, 220), ponto(90, 150), ponto(100, 100), ponto(110, 150)];
    const peca = molde({ linhasInternas: [losango, [ponto(100, 100), ponto(100, 220)]] });
    const achada = penceSemRegistroPerto(peca, ponto(105, 185), 6, 'interna', 'r1')!;

    expect(achada).toEqual({ id: 'r1', tipo: 'interna', pontos: [ponto(100, 220), ponto(90, 150), ponto(100, 100), ponto(110, 150)], comEixo: true });
    expect(penceSemRegistroPerto(peca, ponto(105, 185), 6, 'do-contorno', 'r1')).toBeNull();

    const registrada = comPenceReconhecida(peca, achada);
    expect(pencesDaPeca(registrada)).toHaveLength(1);
    expect(medidasDaPenceInterna(pencesDaPeca(registrada)[0]!)).toEqual({ altura1Mm: 70, altura2Mm: 50, larguraMm: 20 });
    // Já registrada, não é achada de novo.
    expect(penceSemRegistroPerto(registrada, ponto(105, 185), 6, 'interna', 'r2')).toBeNull();

    const mudada = alterarPenceInterna(registrada, 'r1', { altura1Mm: 60, altura2Mm: 60, larguraMm: 30 }, ids());
    expect(medidasDaPenceInterna(pencesDaPeca(mudada)[0]!).larguraMm).toBeCloseTo(30, 6);
    // O losango e o eixo foram trocados pelos novos: continuam duas linhas.
    expect(mudada.linhasInternas).toHaveLength(2);
  });

  it('sem a linha do eixo, o losango reconhecido não diz que tem eixo', () => {
    const peca = molde({ linhasInternas: [[ponto(100, 100), ponto(110, 150), ponto(100, 220), ponto(90, 150), ponto(100, 100)]] });

    expect(penceSemRegistroPerto(peca, ponto(105, 125), 6, 'interna', 'r1')).toMatchObject({ pontos: [ponto(100, 100), ponto(110, 150), ponto(100, 220), ponto(90, 150)], comEixo: false });
    // Uma linha aberta de cinco pontos não é losango.
    const aberta = molde({ linhasInternas: [[ponto(100, 100), ponto(110, 150), ponto(100, 220), ponto(90, 150), ponto(95, 110)]] });
    expect(penceSemRegistroPerto(aberta, ponto(105, 125), 6, 'interna', 'r1')).toBeNull();
  });
});

describe('o pique no vértice vale para a pence recortada e para a aberta por pivô', () => {
  it('recortada: a marca fica no vértice, sai com a pence e acompanha as medidas novas', () => {
    const peca = criarPence(molde(), NO_ALTO, RECORTAR, ids());
    const pence = pencesDaPeca(peca)[0]!;

    expect(peca.marcas.map((m) => m.posicao)).toEqual([ponto(100, 200)]);
    expect(pence.marcas).toEqual([peca.marcas[0]!.id]);

    const mudada = alterarPence(peca, pence.id, { aberturaMm: 40, profundidadeMm: 80, desvioMm: 0 }, ids());
    expect(mudada.marcas).toHaveLength(1);
    expect(mudada.marcas[0]!.posicao.y).toBeCloseTo(220, 6);
    expect(removerPence(peca, pence.id).marcas).toHaveLength(0);
  });

  it('sem a opção, a pence recortada não põe marca nem a guarda no registro', () => {
    const peca = criarPence(molde(), NO_ALTO, { ...RECORTAR, marcaNoVertice: false }, ids());

    expect(peca.marcas).toHaveLength(0);
    expect(pencesDaPeca(peca)[0]!.marcas).toBeUndefined();
  });

  it('aberta por pivô: a marca vai para o vértice de agora quando a abertura muda, e sai quando a pence fecha', () => {
    const pivo: PosicaoNoContorno = { indiceAresta: 0, ponto: ponto(100, 0) };
    const peca = abrirPence(molde(), NO_ALTO, pivo, 40, 100, false, ids(), true);
    const pence = pencesDaPeca(peca)[0]!;

    expect(peca.marcas).toHaveLength(1);
    expect(peca.marcas[0]!.posicao).toEqual(pence.pontos[1]);
    const mudada = alterarPence(peca, pence.id, { aberturaMm: 60, profundidadeMm: 100, desvioMm: 0 }, ids());
    expect(mudada.marcas).toHaveLength(1);
    expect(mudada.marcas[0]!.posicao).toEqual(pencesDaPeca(mudada)[0]!.pontos[1]);
    expect(removerPence(peca, pence.id).marcas).toHaveLength(0);
    // Sem pedir, a pence aberta por pivô não põe marca.
    expect(abrirPence(molde(), NO_ALTO, pivo, 40, 100, false, ids()).marcas).toHaveLength(0);
  });
});

describe('pence com acabamento: desenhada, com o bico no contorno', () => {
  const SEM_ACESSORIOS: OpcoesDePence = { ...RECORTAR, piquesLaterais: false, marcaNoVertice: false };
  // A pence de 40 × 100 no alto: meia abertura de 20 para 100 de profundidade. O bico sobe 20 × tan(2α), com tan α = 0,2.
  const ALTURA_DO_BICO = (20 * (2 * 0.2)) / (1 - 0.2 * 0.2);
  const recortada = (): Molde => criarPence(molde(), NO_ALTO, SEM_ACESSORIOS, ids());
  const aDela = (peca: Molde) => pencesDaPeca(peca)[0]!;

  it('o recorte volta a ser tecido, as pernas ficam desenhadas e o contorno passa pelo bico', () => {
    const peca = comAcabamento(recortada(), aDela(recortada()).id);
    const pence = aDela(peca);

    expect(pence.tipo).toBe('marcada');
    expect(pence.bico!.x).toBeCloseTo(100, 9);
    expect(pence.bico!.y).toBeCloseTo(300 + ALTURA_DO_BICO, 9);
    expect(peca.contorno).toContainEqual(pence.bico);
    expect(peca.contorno).not.toContainEqual(ponto(100, 200));
    expect(peca.linhasInternas).toEqual([[ponto(120, 300), ponto(100, 200), ponto(80, 300)]]);
    // O retângulo inteiro mais o triângulo do bico.
    expect(area(peca.contorno)).toBeCloseTo(60000 + (40 * ALTURA_DO_BICO) / 2, 6);
    expect(medidasDaPence(pence)).toEqual({ aberturaMm: 40, profundidadeMm: 100, desvioMm: 0 });
  });

  it('sem o acabamento, volta a ser a pence recortada de antes', () => {
    const antes = recortada();
    const depois = semAcabamento(comAcabamento(antes, aDela(antes).id), aDela(antes).id);

    expect(depois.contorno).toEqual(antes.contorno);
    expect(depois.linhasInternas).toEqual([]);
    expect(aDela(depois).tipo).toBe('recortada');
    expect('bico' in aDela(depois)).toBe(false);
    expect(() => semAcabamento(antes, aDela(antes).id)).toThrow('não tem acabamento');
    const marcada = criarPence(molde(), NO_ALTO, MARCAR, ids());
    expect(() => comAcabamento(marcada, aDela(marcada).id)).toThrow('pence recortada do contorno');
  });

  it('com as bordas chegando com inclinações diferentes, o bico fica no meio dos dois encontros', () => {
    // À direita da pence a borda sobe (de (200, 320) a (120, 300)); à esquerda, é reta.
    const inclinada = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 320), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)] });
    const achada = penceSemRegistroPerto(inclinada, ponto(100, 200), 6, 'do-contorno', 'r1')!;
    const peca = comAcabamento(comPenceReconhecida(inclinada, achada), 'r1');

    const bico = aDela(peca).bico!;
    expect(bico.x).toBeCloseTo(100, 9);
    // Mais alto que o da borda reta dos dois lados, e mais baixo que o da borda inclinada dos dois lados.
    expect(bico.y).toBeGreaterThan(300 + ALTURA_DO_BICO);
    expect(bico.y).toBeLessThan(300 + ALTURA_DO_BICO + 20);
    // Não importa de que lado está a borda inclinada: a peça espelhada tem o bico à mesma altura.
    const espelhada = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 320)] });
    const achadaNaEspelhada = penceSemRegistroPerto(espelhada, ponto(100, 200), 6, 'do-contorno', 'r1')!;
    const bicoDaEspelhada = aDela(comAcabamento(comPenceReconhecida(espelhada, achadaNaEspelhada), 'r1')).bico!;
    expect(bicoDaEspelhada.x).toBeCloseTo(100, 9);
    expect(bicoDaEspelhada.y).toBeCloseTo(bico.y, 9);
  });

  it('com o lado da dobra, o bico é o do traçado de ofício: a borda desse lado, espelhada na perna, até a linha do meio', () => {
    // À direita de quem olha o desenho (x = 120), a borda sobe; à esquerda (x = 80), é reta. Quem olha da borda para o vértice (para baixo) tem o x = 120 à esquerda.
    const inclinada = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 320), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)] });
    const comRegistro = comPenceReconhecida(inclinada, penceSemRegistroPerto(inclinada, ponto(100, 200), 6, 'do-contorno', 'r1')!);
    const doMeio = aDela(comAcabamento(comRegistro, 'r1'));
    const paraAReta = aDela(comAcabamento(comRegistro, 'r1', 'direita'));
    const paraAInclinada = aDela(comAcabamento(comRegistro, 'r1', 'esquerda'));

    // Dobrada para o lado da borda reta, o bico é o da pence numa borda reta.
    expect(paraAReta.bico!.x).toBeCloseTo(100, 9);
    expect(paraAReta.bico!.y).toBeCloseTo(300 + ALTURA_DO_BICO, 9);
    // Dobrada para o lado da borda que sobe, o bico sobe mais; sem lado, fica no meio dos dois.
    expect(paraAInclinada.bico!.y).toBeGreaterThan(paraAReta.bico!.y + 5);
    expect(doMeio.bico!.y).toBeCloseTo((paraAReta.bico!.y + paraAInclinada.bico!.y) / 2, 9);
    // O registro guarda a ponta do lado da dobra, e lê o lado de volta.
    expect(doMeio.dobra).toBeUndefined();
    expect(dobraDaPence(doMeio)).toBe('meio');
    expect(paraAInclinada.pontos[paraAInclinada.dobra!]).toEqual(ponto(120, 300));
    expect(paraAReta.pontos[paraAReta.dobra!]).toEqual(ponto(80, 300));
    expect(dobraDaPence(paraAInclinada)).toBe('esquerda');
    expect(dobraDaPence(paraAReta)).toBe('direita');
  });

  it('sem o acabamento o lado da dobra sai do registro; mudada a pence, ela continua dobrada para o mesmo lado', () => {
    const inclinada = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 320), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)] });
    const comRegistro = comPenceReconhecida(inclinada, penceSemRegistroPerto(inclinada, ponto(100, 200), 6, 'do-contorno', 'r1')!);
    const peca = comAcabamento(comRegistro, 'r1', 'esquerda');

    expect('dobra' in aDela(semAcabamento(peca, 'r1'))).toBe(false);
    const mudada = alterarPence(peca, 'r1', { aberturaMm: 40, profundidadeMm: 60, desvioMm: 0 }, ids());
    expect(dobraDaPence(aDela(mudada))).toBe('esquerda');
    expect(aDela(mudada).pontos[aDela(mudada).dobra!]).toEqual(ponto(120, 300));
  });

  it('na peça espelhada, a esquerda e a direita trocam, e a pence continua dobrada para a mesma borda', () => {
    const inclinada = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 320), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)] });
    const comRegistro = comPenceReconhecida(inclinada, penceSemRegistroPerto(inclinada, ponto(100, 200), 6, 'do-contorno', 'r1')!);
    const espelhada = espelharMolde(comAcabamento(comRegistro, 'r1', 'esquerda'), 'm1');
    const pence = aDela(espelhada);

    expect(dobraDaPence(pence)).toBe('direita');
    // A ponta da dobra continua sendo a da borda inclinada: a que tem, ao lado, o canto mais alto da peça.
    const maisAlto = Math.max(...espelhada.contorno.map((p) => p.y));
    const cantoAlto = espelhada.contorno.find((p) => p.y === maisAlto)!;
    const [daDobra, aOutra] = [pence.pontos[pence.dobra!]!, pence.pontos[pence.dobra === 0 ? 2 : 0]!];
    expect(Math.abs(daDobra.x - cantoAlto.x)).toBeLessThan(Math.abs(aOutra.x - cantoAlto.x));
  });

  it('dobrada para o lado em que a borda se afasta da pence, o bico entra: fica para dentro da reta das pontas', () => {
    // No x = 120 a borda desce para longe da pence (vem de (200, 100)); no x = 80, é reta.
    const fugindo = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)] });
    const comRegistro = comPenceReconhecida(fugindo, penceSemRegistroPerto(fugindo, ponto(100, 200), 6, 'do-contorno', 'r1')!);
    const peca = comAcabamento(comRegistro, 'r1', 'esquerda');
    const bico = aDela(peca).bico!;

    // O bico está na linha do meio da pence, entre o vértice e a reta das pontas.
    expect(bico.x).toBeCloseTo(100, 9);
    expect(bico.y).toBeGreaterThan(200);
    expect(bico.y).toBeLessThan(300);
    // É o espelho da borda na perna: da ponta (120, 300), o bico e o ponto vizinho da borda fazem o mesmo ângulo com a perna.
    const angulo = (p: Ponto2D): number => {
      const [perna, ate] = [ponto(100 - 120, 200 - 300), ponto(p.x - 120, p.y - 300)];
      return Math.acos((perna.x * ate.x + perna.y * ate.y) / (Math.hypot(perna.x, perna.y) * Math.hypot(ate.x, ate.y)));
    };
    expect(angulo(bico)).toBeCloseTo(angulo(ponto(200, 100)), 9);
    // A peça fica menor que a da pence dobrada para o outro lado, em que o bico sai para fora.
    expect(area(peca.contorno)).toBeLessThan(area(comAcabamento(comRegistro, 'r1', 'direita').contorno));
    // Dobrada para o outro lado, o bico é o da borda reta; sem lado, o encontro para dentro não conta, e fica o da borda reta.
    expect(aDela(comAcabamento(comRegistro, 'r1', 'direita')).bico!.y).toBeCloseTo(300 + ALTURA_DO_BICO, 9);
    expect(aDela(comAcabamento(comRegistro, 'r1')).bico!.y).toBeCloseTo(300 + ALTURA_DO_BICO, 9);
  });

  it('dobrada para o lado em que a borda continua a perna, não há encontro: o contorno passa reto', () => {
    // No x = 120 a borda segue em linha com a perna da pence, de (140, 400) a (120, 300).
    const emLinha = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(140, 400), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)] });
    const comRegistro = comPenceReconhecida(emLinha, penceSemRegistroPerto(emLinha, ponto(100, 200), 6, 'do-contorno', 'r1')!);

    expect(aDela(comAcabamento(comRegistro, 'r1', 'esquerda')).bico).toEqual(ponto(100, 300));
  });

  it('com as bordas fugindo da pence, não há encontro: o contorno passa reto pelo meio das pontas', () => {
    // A pence na ponta de um bico da peça: as duas bordas vizinhas descem para longe dela.
    const emPonta = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(120, 300), ponto(100, 200), ponto(80, 300)], linhaDeFio: { inicio: ponto(100, 20), fim: ponto(100, 120) } });
    const achada = penceSemRegistroPerto(emPonta, ponto(100, 200), 6, 'do-contorno', 'r1')!;
    const peca = comAcabamento(comPenceReconhecida(emPonta, achada), 'r1');

    expect(aDela(peca).bico).toEqual(ponto(100, 300));
  });

  it('aberta por pivô com acabamento: muda de abertura e fecha em torno do pivô, sempre com o bico', () => {
    const pivo: PosicaoNoContorno = { indiceAresta: 0, ponto: ponto(100, 0) };
    const peca = abrirPence(molde(), NO_ALTO, pivo, 40, 100, true, ids(), false, true);
    const pence = aDela(peca);

    expect(pence).toMatchObject({ tipo: 'marcada', pivo: ponto(100, 0) });
    expect(pence.bico).toBeDefined();
    expect(pivoDaPence(peca, pence)).not.toBeNull();
    expect(peca.linhasInternas).toHaveLength(1);
    // Nada foi recortado: a peça ficou maior que a aberta com recorte.
    expect(area(peca.contorno)).toBeGreaterThan(area(abrirPence(molde(), NO_ALTO, pivo, 40, 100, true, ids()).contorno) + 1999);

    const mudada = alterarPence(peca, pence.id, { aberturaMm: 60, profundidadeMm: 100, desvioMm: 0 }, ids());
    const direta = abrirPence(molde(), NO_ALTO, pivo, 60, 100, true, ids(), false, true);
    expect(area(mudada.contorno)).toBeCloseTo(area(direta.contorno), 6);
    expect(aDela(mudada).bico).toBeDefined();
    expect(mudada.linhasInternas).toHaveLength(1);
    expect(mudada.piques).toHaveLength(2);

    const fechada = removerPence(mudada, aDela(mudada).id);
    expect(area(fechada.contorno)).toBeCloseTo(60000, 6);
    expect(fechada.linhasInternas).toHaveLength(0);
    expect('pences' in fechada).toBe(false);
  });

  it('o registro deixa de valer se o bico é mexido, e acompanha a peça movida', () => {
    const peca = comAcabamento(recortada(), aDela(recortada()).id);
    const bico = aDela(peca).bico!;
    const mexida = { ...peca, contorno: peca.contorno.map((p) => (p === bico || (p.x === bico.x && p.y === bico.y) ? ponto(p.x, p.y + 5) : p)) };
    expect(pencesDaPeca(mexida)).toHaveLength(0);

    const levada = transladarMolde(peca, ponto(10, 20), 'outra');
    expect(pencesDaPeca(levada)).toHaveLength(1);
    expect(aDela(levada).bico!.x).toBeCloseTo(110, 9);
    expect(area(removerPence(levada, aDela(levada).id).contorno)).toBeCloseTo(60000, 6);
  });
});

describe('as medidas digitadas são as que a pence passa a ter, também em borda curva ou em canto', () => {
  // Um contorno com o alto em arco (pontos a cada 20 mm, subindo até 30 mm no meio), como uma cintura.
  const ARCO = Array.from({ length: 11 }, (_, i) => ponto(200 - i * 20, 300 + 30 * Math.sin((Math.PI * i) / 10)));
  const comArco = (): Molde => molde({ contorno: [ponto(0, 0), ponto(200, 0), ...ARCO.slice(0, -1), ponto(0, 300)] });
  const NO_MEIO_DO_ARCO = (peca: Molde): PosicaoNoContorno => ({ indiceAresta: peca.contorno.findIndex((p) => p.x === 100 && p.y === 330), ponto: ponto(100, 330) });

  it('criada na curva, a pence tem a abertura pedida, em linha reta', () => {
    const peca = comArco();
    const comPence = criarPence(peca, NO_MEIO_DO_ARCO(peca), { ...RECORTAR, aberturaMm: 60, profundidadeMm: 80, piquesLaterais: false, marcaNoVertice: false }, ids());
    const medidas = medidasDaPence(pencesDaPeca(comPence)[0]!);

    expect(medidas.aberturaMm).toBeCloseTo(60, 5);
    expect(medidas.profundidadeMm).toBeCloseTo(80, 5);
    expect(medidas.desvioMm).toBeCloseTo(0, 5);
  });

  it('mudadas as medidas, o diálogo lê de volta exatamente as que foram digitadas — abertura, profundidade e desvio', () => {
    const peca = comArco();
    const comPence = criarPence(peca, NO_MEIO_DO_ARCO(peca), { ...RECORTAR, aberturaMm: 40, profundidadeMm: 80, piquesLaterais: false, marcaNoVertice: false }, ids());
    const mudada = alterarPence(comPence, pencesDaPeca(comPence)[0]!.id, { aberturaMm: 70, profundidadeMm: 55, desvioMm: 8 }, ids());
    const medidas = medidasDaPence(pencesDaPeca(mudada)[0]!);

    expect(medidas.aberturaMm).toBeCloseTo(70, 5);
    expect(medidas.profundidadeMm).toBeCloseTo(55, 5);
    expect(medidas.desvioMm).toBeCloseTo(8, 5);
  });

  it('num canto da peça, também', () => {
    const noCanto = criarPence(molde(), { indiceAresta: 2, ponto: ponto(200, 300) }, { ...RECORTAR, aberturaMm: 20, profundidadeMm: 60, piquesLaterais: false, marcaNoVertice: false }, ids());
    expect(medidasDaPence(pencesDaPeca(noCanto)[0]!).aberturaMm).toBeCloseTo(20, 5);

    const mudada = alterarPence(noCanto, pencesDaPeca(noCanto)[0]!.id, { aberturaMm: 30, profundidadeMm: 50, desvioMm: 0 }, ids());
    const medidas = medidasDaPence(pencesDaPeca(mudada)[0]!);
    expect(medidas.aberturaMm).toBeCloseTo(30, 5);
    expect(medidas.profundidadeMm).toBeCloseTo(50, 5);
    expect(medidas.desvioMm).toBeCloseTo(0, 5);
  });

  it('aplicar as mesmas medidas de novo não tira a pence do lugar', () => {
    const peca = comArco();
    const comPence = criarPence(peca, { indiceAresta: 3, ponto: ponto(170, 300 + 30 * Math.sin((Math.PI * 1.5) / 10)) }, { ...RECORTAR, aberturaMm: 30, profundidadeMm: 60, piquesLaterais: false, marcaNoVertice: false }, ids());
    const antes = pencesDaPeca(comPence)[0]!;
    const medidas = medidasDaPence(antes);
    const depois = pencesDaPeca(alterarPence(comPence, antes.id, medidas, ids()))[0]!;

    antes.pontos.forEach((p, i) => {
      expect(depois.pontos[i]!.x).toBeCloseTo(p.x, 5);
      expect(depois.pontos[i]!.y).toBeCloseTo(p.y, 5);
    });
  });
});
