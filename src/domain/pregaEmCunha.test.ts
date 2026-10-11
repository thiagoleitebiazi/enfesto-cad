import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, pontoMaisProximoNoContorno, rotacionar, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { adicionarMarca, adicionarPique, criarMolde, espelharMolde, rotacionarMolde, transladarMolde, type DadosDeNovoMolde, type Molde } from './molde';
import {
  aberturaDaCunha,
  abrirPelasIntersecoes,
  alterarCunha,
  comCunhasValidas,
  cunhaPerto,
  cunhasDaPeca,
  faixasDaCunha,
  fecharCunha,
} from './penceComIntersecoes';
import { abrirPence } from './pences';
import { criarPregas } from './pregas';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// Um "C" de 200 × 300 mm, anti-horário: a haste é x de 0 a 100; os dois braços vão até x = 200.
const EM_C = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200), ponto(200, 300), ponto(0, 300)];
// Um "E" de 200 × 500 mm: a haste e três braços de 100 × 100.
const EM_E = [
  ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200),
  ponto(200, 300), ponto(100, 300), ponto(100, 400), ponto(200, 400), ponto(200, 500), ponto(0, 500),
];
// A linha em pé em x = 150: entra pelo braço de cima, sai, atravessa o recorte por fora e entra no braço de baixo.
const POSICAO: PosicaoNoContorno = { indiceAresta: 6, ponto: ponto(150, 300) };
const PIVO: PosicaoNoContorno = { indiceAresta: 0, ponto: ponto(150, 0) };
// O giro que abre 30 mm a 300 mm do pivô.
const GRAUS = (2 * Math.asin(30 / 600) * 180) / Math.PI;

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  // A linha de fio na haste: ela fica, e as pontas dos braços giram.
  return criarMolde({ nome: 'Gola', referencia: 'REF-001', tamanho: 'M', contorno: EM_C, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever }, 'm1');
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

const perto = (a: Ponto2D, b: Ponto2D): boolean => distancia(a, b) < 1e-6;
const girado = (p: Ponto2D): Ponto2D => rotacionar(p, PIVO.ponto, -GRAUS);
const aberta = (piques = false, peca = molde()): Molde => abrirPelasIntersecoes(peca, POSICAO, PIVO, 30, piques, ids())!;
const aDela = (peca: Molde) => cunhasDaPeca(peca)[0]!;
/** O contorno é o mesmo, ponto a ponto, na mesma ordem. */
const mesmoContorno = (contorno: readonly Ponto2D[], esperado: readonly Ponto2D[]): boolean => contorno.length === esperado.length && contorno.every((p, i) => perto(p, esperado[i]!));

describe('a prega em cunha do “Cortar intersecções” fica registrada', () => {
  it('guarda onde a reta atravessava o contorno, na ordem dele, com a ponta que ficou e a que girou', () => {
    const peca = aberta();
    const cunha = aDela(peca);

    expect(peca.cunhas).toHaveLength(1);
    expect(cunha.travessias).toHaveLength(4);
    [ponto(150, 0), ponto(150, 100), ponto(150, 200), ponto(150, 300)].forEach((p, k) => {
      expect(perto(cunha.travessias[k]!.parada, p)).toBe(true);
      expect(perto(cunha.travessias[k]!.movida, girado(p))).toBe(true);
    });
    // O pivô é a primeira travessia do contorno e não saiu do lugar; a posição é a última.
    expect(cunha.pivo).toBe(0);
    expect(cunha.posicao).toBe(3);
    expect(cunha.travessias[0]!.movida).toEqual(cunha.travessias[0]!.parada);
    // Nenhuma das quatro era um ponto do contorno.
    expect(cunha.travessias.map((x) => x.criada)).toEqual([true, true, true, true]);
    expect(cunha.linhas).toEqual(peca.linhasInternas);
    expect(aberturaDaCunha(cunha)).toBeCloseTo(30, 9);
    expect('piques' in cunha).toBe(false);
    // Pela ferramenta de pence, também.
    expect(cunhasDaPeca(abrirPence(molde(), POSICAO, PIVO, 30, 80, false, ids(), false, false, true))).toHaveLength(1);
  });

  it('com piques, o registro sabe quais são os dela; o id do registro vem depois dos deles', () => {
    const peca = aberta(true);

    expect(aDela(peca).piques).toEqual(['novo-1', 'novo-2']);
    expect(aDela(peca).id).toBe('novo-3');
    expect(peca.piques.map((q) => q.id)).toEqual(['novo-1', 'novo-2']);
  });

  it('os trechos abertos: uma faixa para cada, e a do pivô é um triângulo', () => {
    const peca = aberta();
    const faixas = faixasDaCunha(peca, aDela(peca));

    expect(faixas).toHaveLength(2);
    expect(faixas.map((f) => f.length).sort()).toEqual([3, 4]);
    // O tecido novo é o das faixas.
    expect(faixas.reduce((soma, f) => soma + area(f), 0)).toBeCloseTo(area(peca.contorno) - 50000, 6);
  });

  it('cunhaPerto acha a prega dentro de um trecho aberto, e só aí', () => {
    const peca = aberta();
    const id = aDela(peca).id;

    // No braço de cima, a abertura vai de x = 150 até uns 178 em y = 280; no de baixo, até uns 155 em y = 50.
    expect(cunhaPerto(peca, ponto(160, 280), 0)?.id).toBe(id);
    expect(cunhaPerto(peca, ponto(152, 50), 0)?.id).toBe(id);
    // Na haste, no braço que girou e no vão entre os braços (fora da peça), não.
    expect(cunhaPerto(peca, ponto(50, 150), 0)).toBeNull();
    expect(cunhaPerto(peca, ponto(195, 250), 0)).toBeNull();
    expect(cunhaPerto(peca, ponto(155, 150), 0)).toBeNull();
    // Com raio, vale chegar perto da borda.
    expect(cunhaPerto(peca, ponto(147, 250), 5)?.id).toBe(id);
    expect(cunhaPerto(peca, ponto(147, 250), 1)).toBeNull();
  });
});

describe('fechar a prega em cunha', () => {
  it('a peça volta a ser a de antes: o contorno ponto a ponto, sem as bordas desenhadas, sem os piques e sem o registro', () => {
    const peca = aberta(true);
    const fechada = fecharCunha(peca, aDela(peca).id);

    expect(mesmoContorno(fechada.contorno, EM_C)).toBe(true);
    expect(area(fechada.contorno)).toBeCloseTo(50000, 6);
    expect(fechada.linhasInternas).toEqual([]);
    expect(fechada.piques).toEqual([]);
    expect('cunhas' in fechada).toBe(false);
  });

  it('o que tinha girado com as pontas dos braços volta com elas; o que estava na haste nem se mexe', () => {
    let peca = adicionarMarca(molde(), ponto(180, 250), 'no-braco-de-cima');
    peca = adicionarMarca(peca, ponto(180, 50), 'no-braco-de-baixo');
    peca = adicionarMarca(peca, ponto(50, 150), 'na-haste');
    peca = adicionarPique(peca, ponto(200, 250), 'pique-do-braco');
    peca = adicionarPique(peca, ponto(0, 150), 'pique-da-haste');
    peca = { ...peca, linhasInternas: [[ponto(160, 220), ponto(190, 280)], [ponto(20, 20), ponto(80, 20)]] };
    const comPrega = aberta(false, peca);
    const fechada = fecharCunha(comPrega, aDela(comPrega).id);
    const marca = (id: string): Ponto2D => fechada.marcas.find((m) => m.id === id)!.posicao;
    const pique = (id: string): Ponto2D => fechada.piques.find((q) => q.id === id)!.posicao;

    expect(perto(marca('no-braco-de-cima'), ponto(180, 250))).toBe(true);
    expect(perto(marca('no-braco-de-baixo'), ponto(180, 50))).toBe(true);
    expect(marca('na-haste')).toEqual(ponto(50, 150));
    expect(perto(pique('pique-do-braco'), ponto(200, 250))).toBe(true);
    expect(pique('pique-da-haste')).toEqual(ponto(0, 150));
    expect(fechada.linhasInternas).toHaveLength(2);
    expect(perto(fechada.linhasInternas[0]![0]!, ponto(160, 220))).toBe(true);
    expect(perto(fechada.linhasInternas[0]![1]!, ponto(190, 280))).toBe(true);
    expect(fechada.linhasInternas[1]).toEqual([ponto(20, 20), ponto(80, 20)]);
  });

  it('quando é a haste que gira (a linha de fio num braço), fecha do mesmo jeito', () => {
    const peca = aberta(false, molde({ linhaDeFio: { inicio: ponto(175, 220), fim: ponto(175, 280) } }));
    // As pontas dos braços ficaram onde estavam.
    expect(peca.contorno.some((p) => perto(p, ponto(200, 300)))).toBe(true);
    const fechada = fecharCunha(peca, aDela(peca).id);

    expect(fechada.contorno).toHaveLength(8);
    EM_C.forEach((p) => expect(fechada.contorno.some((q) => perto(p, q))).toBe(true));
    expect(area(fechada.contorno)).toBeCloseTo(50000, 6);
  });

  it('com o contorno começando na ponta de um braço, os trechos abertos são os da reta, e não os da ordem do contorno', () => {
    // O mesmo "C", numerado a partir de (200, 100); a linha de fio no braço de cima: é a haste que gira.
    const dePonta = [...EM_C.slice(2), ...EM_C.slice(0, 2)];
    const peca = abrirPelasIntersecoes(molde({ contorno: dePonta, linhaDeFio: { inicio: ponto(175, 220), fim: ponto(175, 280) } }), { indiceAresta: 4, ponto: ponto(150, 300) }, { indiceAresta: 6, ponto: ponto(150, 0) }, 30, false, ids())!;
    // No contorno aberto, as travessias vêm na ordem (150, 100), (150, 200), (150, 300), (150, 0): as duas primeiras não são um trecho aberto.
    expect(peca.contorno[0]).toEqual(ponto(200, 100));
    const faixas = faixasDaCunha(peca, aDela(peca));
    expect(faixas.reduce((soma, f) => soma + area(f), 0)).toBeCloseTo(area(peca.contorno) - 50000, 6);
    const fechada = fecharCunha(peca, aDela(peca).id);

    expect(mesmoContorno(fechada.contorno, dePonta)).toBe(true);
  });

  it('a numeração dos pontos volta a começar onde começava, mesmo que esse ponto tenha girado', () => {
    // O "C" numerado a partir de (200, 100), a ponta do braço de baixo; a linha de fio na haste: as pontas dos braços giram.
    const dePonta = [...EM_C.slice(2), ...EM_C.slice(0, 2)];
    const peca = abrirPelasIntersecoes(molde({ contorno: dePonta }), { indiceAresta: 4, ponto: ponto(150, 300) }, { indiceAresta: 6, ponto: ponto(150, 0) }, 30, false, ids())!;
    // Aberta, a numeração começa no primeiro ponto que não saiu do lugar; o registro guarda onde ela começava.
    expect(peca.contorno[0]).toEqual(ponto(100, 100));
    expect(aDela(peca).comeco).toEqual(ponto(200, 100));

    expect(mesmoContorno(fecharCunha(peca, aDela(peca).id).contorno, dePonta)).toBe(true);
    // Movida a peça, o começo vai junto.
    const levada = transladarMolde(peca, ponto(10, 20), 'outra');
    expect(mesmoContorno(fecharCunha(levada, aDela(levada).id).contorno, dePonta.map((p) => ponto(p.x + 10, p.y + 20)))).toBe(true);
    // O registro de antes de o começo ser guardado fecha do mesmo jeito, começando pelo ponto de menor número que ficou.
    const semComeco = { ...peca, cunhas: peca.cunhas!.map(({ comeco: _, ...resto }) => resto) };
    const fechada = fecharCunha(semComeco, aDela(semComeco).id);
    expect(fechada.contorno[0]).toEqual(ponto(100, 100));
    expect(fechada.contorno).toHaveLength(8);
  });

  it('num "E", os três trechos abertos fecham juntos', () => {
    const noE = abrirPelasIntersecoes(molde({ contorno: EM_E }), { indiceAresta: 10, ponto: ponto(150, 500) }, PIVO, 30, false, ids())!;
    expect(aDela(noE).travessias).toHaveLength(6);
    expect(faixasDaCunha(noE, aDela(noE))).toHaveLength(3);
    const fechada = fecharCunha(noE, aDela(noE).id);

    expect(mesmoContorno(fechada.contorno, EM_E)).toBe(true);
    expect(fechada.linhasInternas).toEqual([]);
  });

  it('a ponta que já era um ponto do contorno fica nele depois de fechar', () => {
    // O contorno já tem um ponto em (150, 300), a posição da pence.
    const comPonto = [...EM_C.slice(0, 7), ponto(150, 300), EM_C[7]!];
    const peca = abrirPelasIntersecoes(molde({ contorno: comPonto }), { indiceAresta: 7, ponto: ponto(150, 300) }, PIVO, 30, false, ids())!;
    expect(aDela(peca).travessias.map((x) => x.criada)).toEqual([true, true, true, false]);
    const fechada = fecharCunha(peca, aDela(peca).id);

    expect(mesmoContorno(fechada.contorno, comPonto)).toBe(true);
  });

  it('mexida à mão, a prega deixa de ter registro: não fecha, e o registro sai na limpeza', () => {
    const peca = aberta();
    const cunha = aDela(peca);
    const umaPonta = cunha.travessias[2]!.movida;
    const comPontaMexida = { ...peca, contorno: peca.contorno.map((p) => (perto(p, umaPonta) ? ponto(p.x + 1, p.y) : p)) };
    const semUmaBorda = { ...peca, linhasInternas: peca.linhasInternas.slice(1) };

    expect(cunhasDaPeca(comPontaMexida)).toEqual([]);
    expect(cunhasDaPeca(semUmaBorda)).toEqual([]);
    expect(() => fecharCunha(comPontaMexida, cunha.id)).toThrow('mexida à mão');
    expect('cunhas' in comCunhasValidas(comPontaMexida)).toBe(false);
    expect(comCunhasValidas(peca)).toBe(peca);
    expect(comCunhasValidas(molde())).toEqual(molde());
  });
});

describe('mudar a abertura da prega em cunha', () => {
  it('fecha e abre de novo pela mesma reta, em torno do mesmo pivô, com a abertura nova', () => {
    const peca = aberta(true);
    const mudada = alterarCunha(peca, aDela(peca).id, 50, ids());
    const direta = abrirPelasIntersecoes(molde(), POSICAO, PIVO, 50, true, ids())!;

    expect(mesmoContorno(mudada.contorno, direta.contorno)).toBe(true);
    expect(cunhasDaPeca(mudada)).toHaveLength(1);
    expect(aberturaDaCunha(aDela(mudada))).toBeCloseTo(50, 9);
    expect(mudada.linhasInternas).toHaveLength(4);
    // Continua com os dois piques, e só eles.
    expect(mudada.piques).toHaveLength(2);
    expect(aDela(mudada).piques).toHaveLength(2);
  });

  it('recusa a abertura que não serve', () => {
    const peca = aberta();
    const id = aDela(peca).id;

    expect(() => alterarCunha(peca, id, 0, ids())).toThrow('maior que zero');
    expect(() => alterarCunha(peca, id, Number.NaN, ids())).toThrow('maior que zero');
    expect(() => alterarCunha(peca, id, 300, ids())).toThrow('grande demais');
    expect(() => alterarCunha(peca, 'outra', 40, ids())).toThrow('mexida à mão');
  });
});

describe('o registro da prega em cunha acompanha a peça', () => {
  it('movida, girada ou espelhada, a prega continua registrada e fecha', () => {
    const peca = aberta();
    for (const levada of [transladarMolde(peca, ponto(10, 20), 'outra'), rotacionarMolde(peca, 37), espelharMolde(peca, 'm1')]) {
      expect(cunhasDaPeca(levada)).toHaveLength(1);
      expect(aberturaDaCunha(aDela(levada))).toBeCloseTo(30, 6);
      const fechada = fecharCunha(levada, aDela(levada).id);
      expect(fechada.contorno).toHaveLength(8);
      expect(area(fechada.contorno)).toBeCloseTo(50000, 5);
    }
  });

  it('nos tamanhos da graduação, também', () => {
    const peca = aberta();
    const g = moldeDoTamanho(definirTamanhosDoMolde(peca, ['M', 'G'], 'M'), 1, 'g');

    expect(cunhasDaPeca(g)).toHaveLength(1);
  });

  it('uma prega aberta depois ao comprido da haste: a prega em cunha continua registrada, ande o lado dela ou o outro', () => {
    const aoComprido = (peca: Molde): Molde => {
      const noContorno = (p: Ponto2D): PosicaoNoContorno => {
        const perto = pontoMaisProximoNoContorno(p, peca.contorno);
        return { indiceAresta: perto.indiceAresta, ponto: perto.ponto };
      };
      return criarPregas(peca, noContorno(ponto(50, 0)), noContorno(ponto(50, 300)), { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 10, piques: false }, null, ids());
    };
    // Com a linha de fio em x = 25, anda o lado dos braços, com a prega em cunha inteira; em x = 75, anda a tira da esquerda.
    for (const x of [25, 75]) {
      const peca = aberta(false, molde({ linhaDeFio: { inicio: ponto(x, 50), fim: ponto(x, 250) } }));
      const comPrega = aoComprido(peca);
      expect(area(comPrega.contorno)).toBeGreaterThan(area(peca.contorno) + 1000);
      expect(cunhasDaPeca(comPrega)).toHaveLength(1);
      expect(aberturaDaCunha(aDela(comPrega))).toBeCloseTo(30, 6);
      // As bordas desenhadas da cunha foram com ela: cada uma continua indo de uma travessia a outra.
      const pontas = aDela(comPrega).travessias.flatMap((t) => [t.parada, t.movida]);
      for (const linha of aDela(comPrega).linhas) for (const p of linha) expect(pontas.some((q) => perto(p, q))).toBe(true);
      // Andou o lado dos braços (20 mm, a prega simples de 10) ou não andou nada dela.
      expect(aDela(comPrega).travessias[0]!.parada.x).toBeCloseTo(x === 25 ? 170 : 150, 6);
      // E fecha: sai só o tecido que ela tinha aberto.
      const fechada = fecharCunha(comPrega, aDela(comPrega).id);
      expect(area(fechada.contorno)).toBeCloseTo(area(comPrega.contorno) - (area(peca.contorno) - 50000), 5);
    }
  });

  it('se um lado da peça anda sozinho depois (uma prega atravessando a haste), o registro deixa de valer', () => {
    const peca = aberta();
    const comPrega = criarPregas(
      peca,
      { indiceAresta: peca.contorno.findIndex((p) => perto(p, ponto(0, 300))), ponto: ponto(0, 150) },
      { indiceAresta: peca.contorno.findIndex((p) => perto(p, ponto(100, 100))), ponto: ponto(100, 150) },
      { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 10, piques: false },
      null,
      ids(),
    );

    // Metade das pontas da cunha andou com a prega: a que girou já não é a parada girada em torno do pivô.
    expect(comPrega.cunhas).toHaveLength(1);
    expect(cunhasDaPeca(comPrega)).toEqual([]);
  });
});
