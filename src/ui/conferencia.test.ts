import { describe, it, expect } from 'vitest';
import { area, ponto, pontoDentroDoContorno, type Ponto2D } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import {
  cliqueDaConferencia,
  comprimentoMaisPerto,
  dialogoDaConferencia,
  FOLGA_DA_CONFERENCIA_MM,
  lerDialogoDaConferencia,
  OPCOES_INICIAIS_DA_CONFERENCIA,
  pontoNoComprimento,
  previaDaConferencia,
  segundaPecaEncostada,
  SEM_CONFERENCIA,
  textoDaConferencia,
  vereditoDaConferencia,
  type EstadoDaConferencia,
  type OpcoesDaConferencia,
} from './conferencia';

// Frente: 200 × 300 mm, na origem. Costas: 100 × 300 mm, a 300 mm para o lado. Manga: 100 × 240 mm.
const frente = peca('frente', 'Frente', [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)]);
const costas = peca('costas', 'Costas', [ponto(500, 0), ponto(600, 0), ponto(600, 300), ponto(500, 300)]);
const manga = peca('manga', 'Manga', [ponto(800, 0), ponto(900, 0), ponto(900, 240), ponto(800, 240)]);
const pecas = [frente, costas, manga];

function peca(id: string, nome: string, contorno: readonly Ponto2D[]): Molde {
  const meio = (contorno[0]!.x + contorno[1]!.x) / 2;
  return criarMolde({ nome, referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(meio, 50), fim: ponto(meio, 200) } }, id);
}

const O = OPCOES_INICIAIS_DA_CONFERENCIA;
const RAIO = 8;
const ids = (): (() => string) => {
  let n = 0;
  return () => `novo-${++n}`;
};
const clicar = (estado: EstadoDaConferencia, x: number, y: number, opcoes: OpcoesDaConferencia = O) =>
  cliqueDaConferencia(opcoes, pecas, estado, ponto(x, y), RAIO, ids());
/** As duas costuras indicadas: o lado direito da Frente, de cima para baixo, e o lado esquerdo da outra peça, também de cima para baixo. */
function comAsDuas(outra: Molde = costas): EstadoDaConferencia {
  const x = outra.contorno[0]!.x;
  const fim = outra.contorno[3]!.y;
  let estado = clicar(SEM_CONFERENCIA, 200, 0).estado;
  estado = clicar(estado, 200, 300).estado;
  estado = clicar(estado, x, 0).estado;
  return clicar(estado, x, fim).estado;
}

describe('pontoNoComprimento e comprimentoMaisPerto', () => {
  const L = [ponto(0, 0), ponto(100, 0), ponto(100, 50)];

  it('anda pela linha, dobrando a esquina, e para nas pontas', () => {
    expect(pontoNoComprimento(L, 40)).toEqual({ ponto: ponto(40, 0), tangente: ponto(1, 0) });
    expect(pontoNoComprimento(L, 120)).toEqual({ ponto: ponto(100, 20), tangente: ponto(0, 1) });
    expect(pontoNoComprimento(L, 999).ponto).toEqual(ponto(100, 50));
    expect(pontoNoComprimento(L, -5).ponto).toEqual(ponto(0, 0));
  });

  it('acha a que distância do começo está o ponto da linha mais perto', () => {
    expect(comprimentoMaisPerto(L, ponto(40, 7))).toEqual({ s: 40, distancia: 7 });
    expect(comprimentoMaisPerto(L, ponto(110, 30))).toEqual({ s: 130, distancia: 10 });
    expect(comprimentoMaisPerto(L, ponto(-30, 0)).s).toBe(0);
  });
});

describe('vereditoDaConferencia', () => {
  it('conferem até meio milímetro de diferença', () => {
    expect(FOLGA_DA_CONFERENCIA_MM).toBe(0.5);
    expect(vereditoDaConferencia(300, 300, 0)).toBe('As duas costuras conferem — 1ª: 300,0 mm · 2ª: 300,0 mm');
    expect(vereditoDaConferencia(300, 300.5, 0)).toMatch(/^As duas costuras conferem/);
    expect(vereditoDaConferencia(300, 299.5, 0)).toMatch(/^As duas costuras conferem/);
  });

  it('quando não conferem, diz qual sobra, de quanto e quanto isso é da menor', () => {
    expect(vereditoDaConferencia(300, 240, 0)).toBe('Não conferem: a 1ª é 60,0 mm maior (25,0%) — 1ª: 300,0 mm · 2ª: 240,0 mm');
    expect(vereditoDaConferencia(240, 300, 0)).toMatch(/^Não conferem: a 2ª é 60,0 mm maior \(25,0%\)/);
    expect(vereditoDaConferencia(300, 299.4, 0)).toMatch(/^Não conferem: a 1ª é 0,6 mm maior/);
  });

  it('o desconto sai da 1ª costura antes de comparar', () => {
    expect(vereditoDaConferencia(300, 280, 20)).toBe('As duas costuras conferem — 1ª: 300,0 mm (com 20,0 mm descontados, 280,0 mm) · 2ª: 280,0 mm');
    expect(vereditoDaConferencia(300, 300, 20)).toMatch(/^Não conferem: a 2ª é 20,0 mm maior/);
    expect(vereditoDaConferencia(300, 300, 400)).toMatch(/^O desconto é maior que a 1ª costura/);
  });
});

describe('a janela do Conferir', () => {
  it('pede o desconto e o que o clique marca, e diz o que ficou de fora', () => {
    const { campos, nota } = dialogoDaConferencia(O);

    expect(campos.map((c) => c.id)).toEqual(['descontar', 'marcar']);
    expect(nota).toMatch(/ficaram de fora “Usar costura”/);
    expect(lerDialogoDaConferencia({ descontar: 12.5, marcar: 'ponto' })).toEqual({ descontarMm: 12.5, marcar: 'ponto' });
    expect(lerDialogoDaConferencia({ descontar: 0, marcar: 'outra' })).toEqual({ descontarMm: 0, marcar: 'pique' });
    expect(() => lerDialogoDaConferencia({ descontar: -1, marcar: 'pique' })).toThrow('não pode ser negativo');
  });
});

describe('indicar as duas costuras', () => {
  it('cada costura são dois cliques no contorno da mesma peça: o começo (a referência) e o fim', () => {
    const comeco = clicar(SEM_CONFERENCIA, 203, 2);
    expect(comeco.estado.inicio).toEqual({ pecaId: 'frente', posicao: { indiceAresta: 1, ponto: ponto(200, 0) } });

    const primeira = clicar(comeco.estado, 200, 300);
    expect(primeira.estado).toEqual({ inicio: null, costuras: [{ pecaId: 'frente', pontos: [ponto(200, 0), ponto(200, 300)] }] });
    expect(primeira.pecas).toBeUndefined();
  });

  it('vale o caminho mais curto, e ele sai do ponto clicado primeiro — mesmo contra a numeração', () => {
    let estado = clicar(SEM_CONFERENCIA, 200, 300).estado;
    estado = clicar(estado, 200, 0).estado;

    expect(estado.costuras[0]!.pontos).toEqual([ponto(200, 300), ponto(200, 0)]);
  });

  it('um clique longe de qualquer contorno, noutra peça ou no mesmo ponto não vale', () => {
    expect(clicar(SEM_CONFERENCIA, 100, 150).recado).toBe('Clique no contorno de uma peça, onde a costura começa.');

    const comeco = clicar(SEM_CONFERENCIA, 200, 0).estado;
    expect(clicar(comeco, 500, 300).recado).toBe('Clique no contorno da mesma peça, onde a costura termina.');
    expect(clicar(comeco, 200, 0).recado).toBe('O fim da costura precisa ser outro ponto do contorno.');
    expect(clicar(comeco, 500, 300).estado).toBe(comeco);
  });
});

describe('andar a 2ª peça sobre a 1ª', () => {
  it('a 2ª peça encosta na costura da 1ª pelo lado de fora, com o ponto que casa em cima do ponto sob o mouse', () => {
    const estado = comAsDuas();
    const [c1, c2] = estado.costuras;

    const encostada = segundaPecaEncostada(frente, c1!.pontos, costas, c2!.pontos, 100);
    // As Costas (100 × 300) ficam à direita da Frente, coladas em x = 200, na mesma altura.
    expect(encostada.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [200, 0],
      [300, 0],
      [300, 300],
      [200, 300],
    ]);
    expect(area(encostada)).toBeCloseTo(area(costas.contorno), 6);
  });

  it('quando as duas peças estão do mesmo lado das costuras, a 2ª é virada: nunca fica em cima da 1ª', () => {
    // O lado direito das Costas (x = 600), de cima para baixo: a peça fica à esquerda dele, como a Frente da costura dela.
    let estado = clicar(SEM_CONFERENCIA, 200, 0).estado;
    estado = clicar(estado, 200, 300).estado;
    estado = clicar(estado, 600, 0).estado;
    estado = clicar(estado, 600, 300).estado;
    const [c1, c2] = estado.costuras;

    const encostada = segundaPecaEncostada(frente, c1!.pontos, costas, c2!.pontos, 150);
    expect(Math.min(...encostada.map((p) => p.x))).toBeCloseTo(200, 6);
    expect(Math.max(...encostada.map((p) => p.x))).toBeCloseTo(300, 6);
    expect(pontoDentroDoContorno(ponto(250, 150), encostada)).toBe(true);
    expect(pontoDentroDoContorno(ponto(150, 150), encostada)).toBe(false);
  });

  it('com a 2ª costura menor, ela para no fim dela e a peça desce junto com o mouse', () => {
    const estado = comAsDuas(manga);
    const [c1, c2] = estado.costuras;

    const noFim = segundaPecaEncostada(frente, c1!.pontos, manga, c2!.pontos, 290);
    // A 290 mm, a Manga (240) já acabou: o fim dela fica no ponto da Frente a 290.
    expect(Math.max(...noFim.map((p) => p.y))).toBeCloseTo(290, 6);
  });

  it('a prévia destaca a 1ª costura, mostra a 2ª e a peça encostada no ponto sob o mouse', () => {
    const estado = comAsDuas();
    const semMouse = previaDaConferencia(pecas, estado, null, RAIO);
    expect(semMouse).toEqual({ substituido: [ponto(200, 0), ponto(200, 300)], linhas: [[ponto(500, 0), ponto(500, 300)]] });

    const previa = previaDaConferencia(pecas, estado, ponto(205, 120), RAIO);
    expect(previa.marcas).toEqual([ponto(200, 120)]);
    expect(previa.novoFechado).toBe(true);
    expect(previa.novo).toHaveLength(4);
  });

  it('indicando uma costura, a prévia mostra o começo e o caminho até o mouse', () => {
    const comeco = clicar(SEM_CONFERENCIA, 200, 0).estado;

    expect(previaDaConferencia(pecas, comeco, null, RAIO)).toEqual({ marcas: [ponto(200, 0)] });
    expect(previaDaConferencia(pecas, comeco, ponto(203, 150), RAIO)).toEqual({ marcas: [ponto(200, 0)], novo: [ponto(200, 0), ponto(200, 150)] });
    expect(previaDaConferencia(pecas, SEM_CONFERENCIA, ponto(0, 0), RAIO)).toEqual({});
  });
});

describe('marcar o ponto de encontro', () => {
  it('um clique na 1ª costura marca um pique em cada peça, à mesma distância do começo de cada costura', () => {
    const resultado = clicar(comAsDuas(), 203, 120);

    const [f, c, m] = resultado.pecas!;
    expect(f!.piques.map((q) => q.posicao)).toEqual([ponto(200, 120)]);
    expect(c!.piques.map((q) => q.posicao)).toEqual([ponto(500, 120)]);
    expect(m).toBe(manga);
    expect(resultado.recado).toBe('Pique de encontro marcado nas duas costuras, a 120,0 mm do começo de cada uma.');
    expect(resultado.estado.costuras).toHaveLength(2);
  });

  it('pode marcar um ponto (marca) no lugar do pique, ou nada', () => {
    const comPonto = clicar(comAsDuas(), 200, 60, { ...O, marcar: 'ponto' });
    expect(comPonto.pecas![0]!.marcas.map((q) => q.posicao)).toEqual([ponto(200, 60)]);
    expect(comPonto.pecas![1]!.marcas.map((q) => q.posicao)).toEqual([ponto(500, 60)]);
    expect(comPonto.pecas![0]!.piques).toEqual([]);

    const semMarcar = clicar(comAsDuas(), 200, 60, { ...O, marcar: 'nada' });
    expect(semMarcar.pecas).toBeUndefined();
    expect(semMarcar.recado).toMatch(/a 60,0 mm do começo das costuras \(a marcação está desligada/);
  });

  it('longe da 1ª costura, ou depois do fim da 2ª, o clique não marca', () => {
    expect(clicar(comAsDuas(), 100, 150).recado).toBe('Clique em cima da 1ª costura (a que está em destaque) para marcar o ponto de encontro.');

    const depoisDoFim = clicar(comAsDuas(manga), 200, 280);
    expect(depoisDoFim.pecas).toBeUndefined();
    expect(depoisDoFim.recado).toBe('Nesse ponto a 2ª costura já acabou: não há ponto de encontro para marcar.');
  });
});

describe('textoDaConferencia', () => {
  it('guia os quatro cliques e termina com "Esc sai."', () => {
    let estado = SEM_CONFERENCIA;
    const textos = [textoDaConferencia(O, estado, null)];
    for (const [x, y] of [
      [200, 0],
      [200, 300],
      [500, 0],
    ] as const) {
      estado = clicar(estado, x, y).estado;
      textos.push(textoDaConferencia(O, estado, null));
    }

    expect(textos[0]).toMatch(/onde a 1ª costura começa — é o ponto de referência dela/);
    expect(textos[1]).toMatch(/onde a 1ª costura termina/);
    expect(textos[2]).toMatch(/a 1ª costura tem 300,0 mm\. Agora clique onde a 2ª costura começa/);
    expect(textos[3]).toMatch(/onde a 2ª costura termina/);
    for (const texto of textos) expect(texto.endsWith(' Esc sai.')).toBe(true);
  });

  it('com as duas, dá o veredito, onde o mouse está e o que o clique marca', () => {
    expect(textoDaConferencia(O, comAsDuas(), ponto(200, 120))).toBe(
      'As duas costuras conferem — 1ª: 300,0 mm · 2ª: 300,0 mm. Passe o mouse pela 1ª costura: a outra peça anda sobre ela. Um clique marca um pique de encontro nas duas. Atual: 120,0 mm do começo. Esc sai.',
    );
    expect(textoDaConferencia({ descontarMm: 0, marcar: 'nada' }, comAsDuas(manga), null)).toBe(
      'Não conferem: a 1ª é 60,0 mm maior (25,0%) — 1ª: 300,0 mm · 2ª: 240,0 mm. Passe o mouse pela 1ª costura: a outra peça anda sobre ela. Esc sai.',
    );
  });
});
