import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, rotacionarMolde, type Molde } from './molde';
import { MEDIDAS_DO_PUBLICO } from './manequim';
import { camisetaSemNomes, pecaDeManga, pecaDeTronco } from './camisetaDeTeste';
import { comAManga, configuracoesDoProvador, formasDasPecas, mangasDoProvador, montagemDoProvador, pecasDoProvador } from './formaDasPecas';
import { comprimentoDoTrecho, corpoDaMontagem, descansoDaGola, instanciasDasPecas, lerMontagem3d, malhasDasInstancias, MONTAGEM_VAZIA, posicoesDeArrumacao, TECIDOS_PRONTOS, type InstanciaDaPeca, type Montagem3D } from './montagem3d';
import { aberturaDasCosturas, assentou, avancar, maiorPenetracao, montarSimulacao } from './simulacaoDoTecido';

const MASCULINO: Montagem3D = { ...MONTAGEM_VAZIA, manequim: { publico: 'masculino', medidas: MEDIDAS_DO_PUBLICO.masculino } };

let contador = 0;
const novoId = (): string => `c${++contador}`;
const naPosicao = (m: Montagem3D, instancias: readonly InstanciaDaPeca[], posicao: string): InstanciaDaPeca[] => instancias.filter((i) => m.pecas[i.chave]?.posicao === posicao);
const preparar = (pecas: readonly Molde[]): { instancias: InstanciaDaPeca[]; montagem: Montagem3D; reconhecidas: string[] } => {
  const instancias = instanciasDasPecas(pecasDoProvador(pecas));
  return { instancias, ...montagemDoProvador(instancias, MASCULINO, novoId) };
};

describe('as peças pela forma (ADR 0234)', () => {
  it('peças sem nome vão ao corpo: o decote mais fundo é a frente, a curva para fora é a manga, a tira é a gola', () => {
    const { instancias, montagem, reconhecidas } = preparar(camisetaSemNomes());
    expect(naPosicao(montagem, instancias, 'frente').map((i) => i.peca.id)).toEqual(['p2']);
    expect(naPosicao(montagem, instancias, 'costas').map((i) => i.peca.id)).toEqual(['p1']);
    expect(naPosicao(montagem, instancias, 'gola').map((i) => i.peca.id)).toEqual(['p5']);
    expect(naPosicao(montagem, instancias, 'manga-direita')).toHaveLength(1);
    expect(naPosicao(montagem, instancias, 'manga-esquerda')).toHaveLength(1);
    expect(reconhecidas).toHaveLength(5);
  });

  it('a peça deitada de outro jeito também: o decote diz qual é o alto, e a manga inclinada acha o eixo dela', () => {
    const [costas, frente, comprida, curta, gola] = camisetaSemNomes() as [Molde, Molde, Molde, Molde, Molde];
    const { instancias, montagem } = preparar([rotacionarMolde(costas, 90), rotacionarMolde(frente, 180), rotacionarMolde(comprida, 35), rotacionarMolde(curta, 200), rotacionarMolde(gola, 90)]);
    expect(naPosicao(montagem, instancias, 'frente').map((i) => i.peca.id)).toEqual(['p2']);
    expect(naPosicao(montagem, instancias, 'costas').map((i) => i.peca.id)).toEqual(['p1']);
    expect(naPosicao(montagem, instancias, 'manga-direita').map((i) => i.peca.id)).toEqual(['p4']);
    expect(naPosicao(montagem, instancias, 'gola').map((i) => i.peca.id)).toEqual(['p5']);
  });

  it('já sai costurada: laterais, ombros, embaixo do braço, cavas e gola', () => {
    const { montagem } = preparar(camisetaSemNomes());
    expect(montagem.costuras).toHaveLength(13);
  });

  it('sem peça de tronco nada é afirmado: duas saias continuam fora, e a quantidade não muda', () => {
    const saia = (id: string): Molde => criarMolde({ nome: id, referencia: '', tamanho: '', contorno: [ponto(0, 80), ponto(0, 480), ponto(550, 560), ponto(550, 0)], linhaDeFio: { inicio: ponto(50, 280), fim: ponto(500, 280) } }, id);
    const pecas = [saia('a'), saia('b')];
    const { instancias, montagem, reconhecidas } = preparar(pecas);
    expect(reconhecidas).toEqual([]);
    expect(montagem.costuras).toEqual([]);
    expect(instancias.map((i) => montagem.pecas[i.chave]!.posicao)).toEqual(['fora', 'fora']);
    expect(formasDasPecas(instancias).size).toBe(0);
  });

  it('o nome e o que está guardado mandam: a forma só preenche o que ficou fora', () => {
    const [costas, frente, , curta, gola] = camisetaSemNomes() as [Molde, Molde, Molde, Molde, Molde];
    // A peça de decote raso, chamada de frente de propósito: fica frente.
    const pecas = [{ ...costas, nome: 'Frente' }, frente, curta, gola];
    const instancias = instanciasDasPecas(pecasDoProvador(pecas));
    const { pecas: config } = configuracoesDoProvador(instancias, MASCULINO);
    expect(config['p1#0']!.posicao).toBe('frente');
    expect(config['p2#0']!.posicao).toBe('costas');
    const guardada = { ...MASCULINO, pecas: { 'p2#0': { ...config['p2#0']!, posicao: 'fora' as const } } };
    expect(configuracoesDoProvador(instancias, guardada).pecas['p2#0']!.posicao).toBe('fora');
  });
});

describe('a manga no provador', () => {
  it('o arquivo traz uma de cada: vira um par, a segunda espelhada', () => {
    const { instancias } = preparar(camisetaSemNomes());
    const curtas = instancias.filter((i) => i.peca.id === 'p4');
    expect(curtas.map((i) => i.espelhada)).toEqual([false, true]);
  });

  it('duas mangas iguais são a direita e a esquerda: nenhuma dobra', () => {
    const { instancias, montagem } = preparar([pecaDeTronco('p1', 25), pecaDeTronco('p2', 85), pecaDeManga('m1', 250, 400), pecaDeManga('m2', 250, 400)]);
    expect(instancias.filter((i) => i.peca.id.startsWith('m'))).toHaveLength(2);
    expect(naPosicao(montagem, instancias, 'manga-direita').map((i) => i.peca.id)).toEqual(['m1']);
    expect(naPosicao(montagem, instancias, 'manga-esquerda').map((i) => i.peca.id)).toEqual(['m2']);
  });

  it('comprimentos diferentes são opções: fica a curta, e trocar leva as costuras junto', () => {
    const { instancias, montagem } = preparar(camisetaSemNomes());
    const opcoes = mangasDoProvador(instancias);
    expect(opcoes.map((o) => o.rotulo)).toEqual(['Manga curta (p4)', 'Manga comprida (p3)']);
    expect(naPosicao(montagem, instancias, 'manga-direita').map((i) => i.peca.id)).toEqual(['p4']);
    const trocada = comAManga(instancias, montagem, 'p3', novoId);
    expect(naPosicao(trocada, instancias, 'manga-direita').map((i) => i.peca.id)).toEqual(['p3']);
    expect(naPosicao(trocada, instancias, 'manga-esquerda').map((i) => i.peca.id)).toEqual(['p3']);
    expect(instancias.filter((i) => i.peca.id === 'p4').every((i) => trocada.pecas[i.chave]!.posicao === 'fora')).toBe(true);
    const chaves = trocada.costuras.flatMap((c) => [c.a.chave, c.b.chave]);
    expect(chaves.some((c) => c.startsWith('p4'))).toBe(false);
    expect(trocada.costuras).toHaveLength(montagem.costuras.length);
  });

  it('a folga da barra do punho sai: as orelhas ficariam de fora, como abas', () => {
    const com = instanciasDasPecas(pecasDoProvador(camisetaSemNomes())).find((i) => i.peca.id === 'p4')!;
    const xs = com.contorno.map((p) => p.x);
    // O comprimento acabado, sem os 26 mm da folga; no molde a peça vai de −205 a 250 + 26.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(Math.max(...pecaDeManga('x', 250, 400, 26).contorno.map((p) => p.x)) - Math.min(...pecaDeManga('x', 250, 400, 26).contorno.map((p) => p.x)) - 20);
  });

  it('o punho que fecha é um chanfro, não uma folga: fica como está', () => {
    const chanfrada = pecaDeManga('p3', 250, 400);
    const contorno = chanfrada.contorno;
    const n = contorno.length;
    const [a, b] = [contorno[n - 2]!, contorno[n - 1]!];
    const comChanfro = { ...chanfrada, contorno: [...contorno.slice(0, n - 2), ponto(a.x - 20, a.y - 15), ponto(a.x, a.y - 35), ponto(b.x, b.y + 35), ponto(b.x - 20, b.y + 15)] };
    const pronta = instanciasDasPecas(pecasDoProvador([pecaDeTronco('p1', 25), pecaDeTronco('p2', 85), comChanfro])).find((i) => i.peca.id === 'p3')!;
    const fundo = Math.max(...pronta.contorno.map((p) => p.x));
    expect(fundo).toBeCloseTo(Math.max(...comChanfro.contorno.map((p) => p.x)), 6);
  });
});

describe('a gola no provador', () => {
  const pronta = (): { instancias: InstanciaDaPeca[]; gola: InstanciaDaPeca; montagem: Montagem3D } => {
    const { instancias, montagem } = preparar(camisetaSemNomes());
    return { instancias, montagem, gola: instancias.find((i) => i.peca.id === 'p5')! };
  };

  it('dobrada ao meio no comprido e esticada até o decote', () => {
    const { gola, montagem, instancias } = pronta();
    const ys = gola.contorno.map((p) => p.y);
    const xs = gola.contorno.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30, 3);
    const decote = montagem.costuras
      .filter((c) => c.a.chave === gola.chave && c.b.chave !== gola.chave)
      .reduce((s, c) => s + comprimentoDoTrecho(instancias.find((i) => i.chave === c.b.chave)!.contorno, c.b.de, c.b.ate), 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.98 * decote, 0);
  });

  it('vai com o decote da frente e o das costas, na proporção deles, e fecha nela mesma', () => {
    const { gola, montagem, instancias } = pronta();
    const dela = montagem.costuras.filter((c) => c.a.chave === gola.chave);
    expect(dela).toHaveLength(3);
    const [frente, costas] = [dela.find((c) => montagem.pecas[c.b.chave]?.posicao === 'frente')!, dela.find((c) => montagem.pecas[c.b.chave]?.posicao === 'costas')!];
    const razao = (c: typeof frente): number => comprimentoDoTrecho(gola.contorno, c.a.de, c.a.ate) / comprimentoDoTrecho(instancias.find((i) => i.chave === c.b.chave)!.contorno, c.b.de, c.b.ate);
    expect(razao(frente)).toBeCloseTo(razao(costas), 1);
    expect(dela.some((c) => c.b.chave === gola.chave)).toBe(true);
  });

  it('o comprimento descansa menos na dobra que na beira do decote: é ela que aperta o pescoço', () => {
    const { gola, montagem } = pronta();
    const config = montagem.pecas[gola.chave]!;
    const pontos = new Float64Array(gola.contorno.flatMap((p) => [p.x, p.y]));
    const d = descansoDaGola(gola, config.girarGraus, pontos);
    const [baixo, alto]: number[][] = [[], []];
    for (let i = 0; i < d.length; i += 2) (d[i + 1]! < 0 ? baixo! : alto!).push(d[i]!);
    const largura = (l: number[]): number => Math.max(...l) - Math.min(...l);
    expect(largura(alto!)).toBeLessThan(largura(baixo!) * 0.95);
    expect(largura(alto!)).toBeGreaterThan(largura(baixo!) * 0.8);
  });

  it('começa num anel fechado acima dos ombros, com a frente na parte dela', () => {
    const { gola, montagem } = pronta();
    const corpo = corpoDaMontagem(montagem);
    const config = montagem.pecas[gola.chave]!;
    expect(config.costasDaGola).toBeGreaterThan(0.1);
    expect(config.costasDaGola).toBeLessThan(0.5);
    const pontos = new Float64Array(gola.contorno.flatMap((p) => [p.x, p.y]));
    const x = posicoesDeArrumacao(corpo, gola, config, pontos)!;
    for (let i = 1; i < x.length; i += 3) expect(x[i]!).toBeGreaterThan(corpo.niveis.pescoco);
    // A primeira e a última volta se encontram: o anel fecha.
    const ys = gola.contorno.map((p) => p.y);
    const canto = (y: number): number => gola.contorno.findIndex((p, i) => p.y === y && gola.contorno[i]!.x === Math.min(...gola.contorno.map((q) => q.x)));
    const [a, b] = [canto(Math.min(...ys)), canto(Math.max(...ys))];
    expect(Math.hypot(x[3 * a]! - x[3 * b]!, x[3 * a + 2]! - x[3 * b + 2]!)).toBeLessThan(1);
  });

  it('a posição e a divisão da gola voltam do arquivo', () => {
    const { gola, montagem } = pronta();
    const lida = lerMontagem3d(JSON.parse(JSON.stringify(montagem)));
    expect(lida.pecas[gola.chave]!.posicao).toBe('gola');
    expect(lida.pecas[gola.chave]!.costasDaGola).toBeCloseTo(montagem.pecas[gola.chave]!.costasDaGola!, 6);
  });

  it('a camiseta inteira costura e assenta, com a gola em volta do pescoço', () => {
    const { instancias, montagem, gola } = pronta();
    const corpo = corpoDaMontagem(montagem);
    const malhas = malhasDasInstancias(instancias, montagem.pecas, 20, montagem.costuras);
    const sim = montarSimulacao({ corpo, instancias, configuracoes: montagem.pecas, malhas, costuras: montagem.costuras, tecido: TECIDOS_PRONTOS.malha.tecido });
    let q = 0;
    while (q < 240 && !(q > 90 && assentou(sim))) {
      avancar(sim, 1 / 60, 8);
      q++;
    }
    expect(aberturaDasCosturas(sim)).toBeLessThan(6);
    expect(maiorPenetracao(sim)).toBeLessThan(2);
    const p = sim.pecas.find((k) => k.chave === gola.chave)!;
    let maisBaixo = Infinity;
    for (let i = 0; i < p.malha.pontos.length / 2; i++) maisBaixo = Math.min(maisBaixo, sim.x[3 * (p.inicio + i) + 1]!);
    expect(maisBaixo).toBeGreaterThan(corpo.niveis.busto);
  }, 60_000);
});
