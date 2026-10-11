import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, transladarMolde, type FormatoDePique, type Molde } from '../domain/molde';
import { lerRegistroDaPagina, registroDaPeca } from './pdf-registro';

// Uma peça de 200 × 300 mm. A origem da página fica em (10, 20): o registro guarda as posições contadas dela.
const ORIGEM = ponto(10, 20);
const CONTORNO = [ponto(10, 20), ponto(210, 20), ponto(210, 320), ponto(10, 320)];
const molde = (extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: CONTORNO, linhaDeFio: { inicio: ponto(60, 60), fim: ponto(60, 260) } }, 'f'),
  ...extra,
});
const EM_L: FormatoDePique = { tipo: 'cadastrado:c1', larguraMm: 10, alturaMm: 20, anguloGraus: 15, nome: 'Pé — nº 1', forma: [[ponto(0, 0), ponto(0, 1), ponto(0.5, 1)]], espelhado: true };
const DO_V: FormatoDePique = { tipo: 'v', larguraMm: 8, alturaMm: 10, anguloGraus: -30 };
/** A linha do registro lida de volta, como se viesse dentro da stream de uma página. */
const lido = (linha: string) => lerRegistroDaPagina(['q', '0 0 m', linha, 'Q'].join('\n'));
/** Uma linha de registro com o valor dado, escrito como o programa escreve. */
const comOValor = (valor: unknown): string => '% enfesto-cad:peca:2 ' + btoa(JSON.stringify(valor).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')));
/** A peça como vai para o registro: levada para as posições da página. */
const naPagina = (peca: Molde): Molde => transladarMolde(peca, ponto(0 - ORIGEM.x, 0 - ORIGEM.y), peca.id);
/** O valor bruto de uma peça boa, para estragar um campo de cada vez. */
const bruto = (peca: Molde = molde()): Record<string, unknown> => JSON.parse(JSON.stringify(naPagina(peca))) as Record<string, unknown>;

/** Uma peça com tudo o que uma peça pode ter. */
const COMPLETA = (): Molde =>
  molde({
    furos: [[ponto(100, 100), ponto(120, 100), ponto(120, 120)]],
    linhasInternas: [[ponto(30, 40), ponto(190, 40)], [ponto(30, 60), ponto(110, 60), ponto(110, 160)]],
    elementos: [[ponto(30, 60), ponto(110, 60), ponto(110, 160)]],
    piques: [
      { id: 'a', posicao: ponto(110, 20), indiceAresta: 0, formato: EM_L, naCostura: 'estendido', codigo: 'K7', graduacao: { referencia: ponto(10, 20), perimetros: [-2, 0, 2] } },
      { id: 'b', posicao: ponto(60, 20), indiceAresta: 0 },
      { id: 'c', posicao: ponto(210, 100.12345678), indiceAresta: 1, formato: DO_V, naCostura: 'projetado' },
    ],
    marcas: [
      { id: 'm', posicao: ponto(110, 170), formato: EM_L, rotulo: 'botão', alinhamento: { deslocamentos: [ponto(0, -3), ponto(0, 0), ponto(0, 3)] } },
      { id: 'n', posicao: ponto(50, 50) },
    ],
    textos: [
      { id: 't', posicao: ponto(110, 220), texto: 'Ação — 1ª', alturaMm: 12, anguloGraus: 0, ancora: 'fim' },
      { id: 'u', posicao: ponto(60, 120), texto: 'DOBRA', alturaMm: 8 },
    ],
    margemDeCosturaMm: 10,
    quantidade: 3,
    restricaoDeRotacao: { permite180: true, permite90e270: false, permiteEspelhamento: true },
    anguloDeRotacaoGraus: 90,
    cor: '#ffe0b2',
    linhaDeSimetria: { de: ponto(10, 20), ate: ponto(10, 320) },
    graduacao: { tamanhos: ['P', 'M', 'G'], base: 1, pontos: [{ posicao: ponto(210, 320), deslocamentos: [ponto(-5, -5), ponto(0, 0), ponto(5, 5)] }] },
    cotas: [
      { id: 'c1', tipo: 'linear', de: ponto(10, 20), ate: ponto(210, 20), direcao: ponto(1, 0), posicao: ponto(110, 10) },
      { id: 'c2', tipo: 'angulo', de: ponto(210, 20), vertice: ponto(10, 20), ate: ponto(10, 320), raioMm: 20 },
      { id: 'c3', tipo: 'perimetro', posicao: ponto(110, 300) },
      { id: 'c4', tipo: 'raio', centro: ponto(110, 170), noArco: ponto(130, 170) },
    ],
    dobraMantida: { de: ponto(10, 20), ate: ponto(10, 320), contorno: [ponto(10, 20), ponto(-190, 20), ponto(-190, 320), ponto(10, 320)], furos: [], linhasInternas: [[ponto(-100, 40), ponto(-100, 300)]], marcas: [{ id: 'gm', posicao: ponto(-50, 50) }], piques: [{ id: 'gp', posicao: ponto(-90, 20), indiceAresta: 0 }] },
    pences: [{ id: 'pe', tipo: 'recortada', pontos: [ponto(100, 20), ponto(110, 80), ponto(120, 20)], removidos: [ponto(110, 20)], pontasCriadas: [true, false], piques: ['a'], marcas: ['m'], comEixo: true, pivo: ponto(110, 80), bico: ponto(110, 10), dobra: 2, capa: [ponto(100, 20), ponto(110, 10), ponto(120, 20)] }],
    curvas: [{ id: 'cv', tipo: 'forma', controles: [ponto(10, 20), ponto(110, 25), ponto(210, 20)], pontos: [ponto(10, 20), ponto(210, 20)], forma: { pontos: [ponto(0, 0), ponto(1, 1)], espelhar: true }, tangentes: { inicio: ponto(20, 21) } }],
    pregas: [{ id: 'pr', modo: 'simples-direita', parada: [ponto(10, 200), ponto(210, 200)], movida: [ponto(10, 220), ponto(210, 220)], linhas: [[ponto(10, 210), ponto(210, 210)]], linhasTiradas: [[ponto(10, 205), ponto(210, 205)]], pontasCriadas: [true, true], piques: ['b'] }],
    cunhas: [{ id: 'cu', travessias: [{ parada: ponto(10, 250), movida: ponto(10, 255), criada: true }], posicao: 0.5, pivo: 1, linhas: [[ponto(10, 250), ponto(210, 250)]], piques: ['c'], comeco: ponto(10, 250) }],
    figura: { tipo: 'circulo', raioMm: 50, lados: 12, centro: ponto(110, 170), eixoX: ponto(210, 170), eixoY: ponto(110, 270) },
  });

describe('o registro da peça no PDF', () => {
  it('é uma linha só, de comentário, com letras e números', () => {
    expect(registroDaPeca(COMPLETA(), ORIGEM)).toMatch(/^% enfesto-cad:peca:2 [A-Za-z0-9+/=]+$/);
    expect(lido('1 0 0 1 0 0 cm')).toBeNull();
  });

  it('a peça com tudo o que uma peça pode ter volta igual, levada para as posições da página', () => {
    const peca = COMPLETA();

    expect(lido(registroDaPeca(peca, ORIGEM))).toEqual(naPagina(peca));
    // A outra figura, a espiral.
    const comEspiral = molde({ figura: { tipo: 'espiral', larguraMm: 30, perimetroMm: 400, centro: ponto(110, 170), eixoX: ponto(210, 170), eixoY: ponto(110, 270) } });
    expect(lido(registroDaPeca(comEspiral, ORIGEM))).toEqual(naPagina(comEspiral));
    // E a peça mais simples: só o que toda peça tem.
    expect(lido(registroDaPeca(molde(), ORIGEM))).toEqual(naPagina(molde()));
    expect(naPagina(molde()).contorno[0]).toEqual(ponto(0, 0));
  });

  it('o que não é campo de peça fica de fora', () => {
    const comSobra = { ...bruto(), outraCoisa: { x: 1 }, piques: [{ id: 'a', posicao: { x: 100, y: 0, z: 9 }, indiceAresta: 0, sobra: true }] };

    expect(lido(comOValor(comSobra))).toEqual({ ...naPagina(molde()), piques: [{ id: 'a', posicao: ponto(100, 0), indiceAresta: 0 }] });
  });

  it('o registro cortado ou que não é o que o programa escreve não é aproveitado', () => {
    const boa = registroDaPeca(COMPLETA(), ORIGEM);

    expect(lido(boa.slice(0, -9))).toBe('ilegivel');
    expect(lido(boa + '!!')).toBe('ilegivel');
    expect(lido('% enfesto-cad:peca:2')).toBe('ilegivel');
    expect(lido('% enfesto-cad:peca:2 ' + btoa('isto não é JSON'.replace(/ã|é/g, 'a')))).toBe('ilegivel');
    for (const valor of [[], 'texto', 7, null, {}]) expect(lido(comOValor(valor)), JSON.stringify(valor)).toBe('ilegivel');
  });

  it('um campo fora do esperado, em qualquer parte da peça, e nada dela é aproveitado', () => {
    const com = (mudanca: Record<string, unknown>): unknown => lido(comOValor({ ...bruto(COMPLETA()), ...mudanca }));
    const completa = bruto(COMPLETA());
    const primeiro = (campo: string): Record<string, unknown> => (completa[campo] as Record<string, unknown>[])[0]!;

    expect(com({})).not.toBe('ilegivel');
    const ruins: [string, Record<string, unknown>][] = [
      ['sem nome', { nome: undefined }],
      ['nome que não é texto', { nome: 7 }],
      ['texto comprido demais', { referencia: 'x'.repeat(2001) }],
      ['contorno com dois pontos', { contorno: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
      ['contorno sem área', { contorno: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }],
      ['ponto sem y', { contorno: [{ x: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
      ['número que não é número', { contorno: [{ x: '0', y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
      ['furo de dois pontos', { furos: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]] }],
      ['linha interna vazia', { linhasInternas: [[]] }],
      ['linhas que não são lista', { linhasInternas: {} }],
      ['margem negativa', { margemDeCosturaMm: -1 }],
      ['quantidade zero', { quantidade: 0 }],
      ['quantidade quebrada', { quantidade: 1.5 }],
      ['fio sem fim', { linhaDeFio: { inicio: { x: 0, y: 0 } } }],
      ['rotação que não é sim ou não', { restricaoDeRotacao: { permite180: 'sim', permite90e270: false } }],
      ['ângulo que não é número', { anguloDeRotacaoGraus: null }],
      ['pique sem id', { piques: [{ ...primeiro('piques'), id: '' }] }],
      ['pique numa aresta negativa', { piques: [{ ...primeiro('piques'), indiceAresta: -1 }] }],
      ['pique numa aresta quebrada', { piques: [{ ...primeiro('piques'), indiceAresta: 0.5 }] }],
      ['formato sem largura', { piques: [{ ...primeiro('piques'), formato: { tipo: 'v', larguraMm: 0, alturaMm: 6, anguloGraus: 0 } }] }],
      ['formato sem tipo', { piques: [{ ...primeiro('piques'), formato: { tipo: '', larguraMm: 4, alturaMm: 6, anguloGraus: 0 } }] }],
      ['forma com um traço de um ponto', { piques: [{ ...primeiro('piques'), formato: { tipo: 'x', larguraMm: 4, alturaMm: 6, anguloGraus: 0, forma: [[{ x: 0, y: 0 }]] } }] }],
      ['forma vazia', { piques: [{ ...primeiro('piques'), formato: { tipo: 'x', larguraMm: 4, alturaMm: 6, anguloGraus: 0, forma: [] } }] }],
      ['espelhado que não é verdadeiro', { piques: [{ ...primeiro('piques'), formato: { tipo: 'x', larguraMm: 4, alturaMm: 6, anguloGraus: 0, espelhado: false } }] }],
      ['pique na costura de outro jeito', { piques: [{ ...primeiro('piques'), naCostura: 'outro' }] }],
      ['código que não é texto', { piques: [{ ...primeiro('piques'), codigo: 5 }] }],
      ['graduação do pique sem referência', { piques: [{ ...primeiro('piques'), graduacao: { perimetros: [0] } }] }],
      ['marca sem posição', { marcas: [{ id: 'm' }] }],
      ['alinhamento que não é lista de pontos', { marcas: [{ id: 'm', posicao: { x: 1, y: 1 }, alinhamento: { deslocamentos: [1, 2] } }] }],
      ['texto vazio', { textos: [{ id: 't', posicao: { x: 1, y: 1 }, texto: '', alturaMm: 8 }] }],
      ['texto sem altura', { textos: [{ id: 't', posicao: { x: 1, y: 1 }, texto: 'A', alturaMm: 0 }] }],
      ['âncora que não existe', { textos: [{ id: 't', posicao: { x: 1, y: 1 }, texto: 'A', alturaMm: 8, ancora: 'meio' }] }],
      ['cor que não é texto', { cor: 7 }],
      ['simetria sem fim', { linhaDeSimetria: { de: { x: 0, y: 0 } } }],
      ['graduação sem tamanhos', { graduacao: { tamanhos: [], base: 0, pontos: [] } }],
      ['base fora da lista', { graduacao: { tamanhos: ['P', 'M'], base: 2, pontos: [] } }],
      ['ponto graduado sem deslocamentos', { graduacao: { tamanhos: ['P'], base: 0, pontos: [{ posicao: { x: 0, y: 0 } }] } }],
      ['cota de um tipo que não existe', { cotas: [{ id: 'c', tipo: 'outra', posicao: { x: 0, y: 0 } }] }],
      ['cota linear sem direção', { cotas: [{ id: 'c', tipo: 'linear', de: { x: 0, y: 0 }, ate: { x: 1, y: 0 }, posicao: { x: 0, y: 0 } }] }],
      ['metade guardada sem contorno', { dobraMantida: { ...(completa.dobraMantida as object), contorno: [] } }],
      ['pence de um tipo que não existe', { pences: [{ ...primeiro('pences'), tipo: 'outra' }] }],
      ['pence com três pontas criadas', { pences: [{ ...primeiro('pences'), pontasCriadas: [true, false, true] }] }],
      ['pence com dobra que não existe', { pences: [{ ...primeiro('pences'), dobra: 1 }] }],
      ['pence com pique que não é texto', { pences: [{ ...primeiro('pences'), piques: [7] }] }],
      ['curva de um tipo que não existe', { curvas: [{ ...primeiro('curvas'), tipo: 'reta' }] }],
      ['curva com tangente que não é ponto', { curvas: [{ ...primeiro('curvas'), tangentes: { inicio: 5 } }] }],
      ['tangentes que são uma lista, e não um objeto', { curvas: [{ ...primeiro('curvas'), tangentes: [] }] }],
      ['prega com um ponto só na borda parada', { pregas: [{ ...primeiro('pregas'), parada: [{ x: 0, y: 0 }] }] }],
      ['prega de um modo que não existe', { pregas: [{ ...primeiro('pregas'), modo: 'tripla' }] }],
      ['cunha com travessia sem “criada”', { cunhas: [{ ...primeiro('cunhas'), travessias: [{ parada: { x: 0, y: 0 }, movida: { x: 1, y: 1 } }] }] }],
      ['elemento que não é linha', { elementos: [7] }],
      ['figura de um tipo que não existe', { figura: { ...(completa.figura as object), tipo: 'quadrado' } }],
      ['círculo sem raio', { figura: { tipo: 'circulo', centro: { x: 0, y: 0 }, eixoX: { x: 1, y: 0 }, eixoY: { x: 0, y: 1 } } }],
    ];
    for (const [qual, mudanca] of ruins) expect(com(mudanca), qual).toBe('ilegivel');
  });

  it('uma lista grande demais não serve', () => {
    const comTantos = (quantos: number): unknown => lido(comOValor({ ...bruto(), linhasInternas: [Array.from({ length: quantos }, (_, i) => ({ x: i, y: 0 }))] }));

    expect(comTantos(20000)).not.toBe('ilegivel');
    expect(comTantos(20001)).toBe('ilegivel');
  });
});
