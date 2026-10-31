import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { copiasEmSequencia, incrementarGrade } from '../domain/encaixeManual';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, transladarMolde, type Molde } from '../domain/molde';
import { definirInformacoes, filtrarProjetos } from '../domain/projeto';
import { fatoresDaImpressao, ESCALA_REAL } from './escalaDaImpressao';
import { gerarSvgDoEncaixe, gerarXmlDoEncaixe } from './dados-exportacao';
import { gerarIso } from './iso-exportacao';
import { hpglDoIso } from './iso-importacao';
import { pecasDoPlt } from './plt-importacao';
import { gerarPlt } from './plt-exportacao';

const peca = (nome: string, x = 100, y = 200): Molde =>
  transladarMolde(
    criarMolde({ nome, referencia: '', tamanho: 'M', quantidade: 2, contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 500), ponto(0, 500)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 450) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, nome),
    { x, y },
    nome,
  );

const enfesto = criarConfiguracaoDeEnfesto({ tipo: 'par', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 4, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });

describe('o SVG e o XML do encaixe (ADR 0201)', () => {
  it('o SVG traz cada peça no lugar, com o comprimento na horizontal', () => {
    const svg = gerarSvgDoEncaixe([peca('Frente')], enfesto);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="700mm" height="1000mm"');
    expect(svg).toContain('points="200,100 200,400 700,400 700,100"');
    expect(svg).toContain('<title>Frente M</title>');
  });

  it('o XML traz a mesa e as peças, com o lugar de cada uma', () => {
    const xml = gerarXmlDoEncaixe({ nome: 'Camisa', codigo: 'C1', pecas: [peca('Frente')], enfesto });
    expect(xml).toContain('<encaixe nome="Camisa" codigo="C1" tipo="par" larguraMm="1000" comprimentoMm="3000" camadas="4">');
    expect(xml).toContain('nome="Frente" tamanho="M" tecido="Principal" quantidade="2" giro="0" x="200" y="100" largura="500" altura="300"');
  });

  it('escapa o que quebraria o arquivo', () => {
    const xml = gerarXmlDoEncaixe({ nome: 'A & B <1>', codigo: '"x"', pecas: [], enfesto: null });
    expect(xml).toContain('nome="A &amp; B &lt;1&gt;" codigo="&quot;x&quot;"');
  });
});

describe('importar o arquivo ISO (ADR 0201)', () => {
  it('o que sai para a mesa volta a ser a mesma peça', () => {
    const lidas = pecasDoPlt(hpglDoIso(gerarIso([peca('Frente')]))).pecas;
    expect(lidas).toHaveLength(1);
    const c = retanguloEnvolvente(lidas[0]!.contorno);
    expect(c.maxX - c.minX).toBeCloseTo(300, 0);
    expect(c.maxY - c.minY).toBeCloseTo(500, 0);
  });

  it('com a ferramenta em cima, não desenha; comentário não atrapalha', () => {
    expect(hpglDoIso('(so andar)\nG0 Z5\nG0 X10 Y10\nG0 X20 Y20')).toBe('IN;');
    expect(hpglDoIso('G0 X1 Y1\nG1 Z0\nG1 X2 Y1 F100\nG0 Z5')).toBe('IN;PU40,40;PD80,40;');
  });
});

describe('colar vários e incrementar a grade (ADR 0201)', () => {
  it('as cópias vão uma depois da outra, na direção pedida, com ids novos', () => {
    let n = 0;
    const r = copiasEmSequencia([peca('a', 0, 0)], 2, 'direita', () => `c${n++}`);
    expect(r.map((p) => p.id)).toEqual(['c0', 'c1']);
    expect(r.map((p) => retanguloEnvolvente(p.contorno).minY)).toEqual([510, 1020]);
    n = 0;
    expect(retanguloEnvolvente(copiasEmSequencia([peca('a', 0, 0)], 1, 'baixo', () => `c${n++}`)[0]!.contorno).minX).toBe(310);
  });

  it('colar incrementando soma à quantidade da peça igual, e a que não existe entra', () => {
    const r = incrementarGrade([peca('a')], [peca('a'), peca('b')]);
    expect(r.map((p) => [p.nome, p.quantidade])).toEqual([
      ['a', 4],
      ['b', 2],
    ]);
  });
});

describe('as informações do arquivo (ADR 0201)', () => {
  const projeto = { id: 'p', nome: 'Camisa', codigo: 'C1', criadoEmIso: '2026-01-01', modificadoEmIso: '2026-01-01', status: 'em-andamento', estadoAtual: { pecas: [], tecido: null, enfesto: null }, historico: [] } as unknown as Parameters<typeof definirInformacoes>[0];

  it('guarda o que foi escrito e tira o que ficou em branco', () => {
    const a = definirInformacoes(projeto, { cliente: ' Loja X ', descricao: '', palavrasChave: 'verão linho' }, '2026-02-02');
    expect(a.informacoes).toEqual({ cliente: 'Loja X', palavrasChave: 'verão linho' });
    expect(a.modificadoEmIso).toBe('2026-02-02');
    expect(definirInformacoes(a, { cliente: '', descricao: '', palavrasChave: '' }, 'x').informacoes).toBeUndefined();
  });

  it('a busca da biblioteca acha pelo cliente e pela palavra chave', () => {
    const a = definirInformacoes(projeto, { cliente: 'Loja X', descricao: '', palavrasChave: 'linho' }, 'x');
    expect(filtrarProjetos([a], 'linho', 'todos')).toHaveLength(1);
    expect(filtrarProjetos([a], 'loja x', 'todos')).toHaveLength(1);
    expect(filtrarProjetos([a], 'outra coisa', 'todos')).toHaveLength(0);
  });
});

describe('a plotagem com espelho e observação (ADR 0201)', () => {
  it('espelhar troca o lado, sem mudar o tamanho', () => {
    const normal = gerarPlt([peca('a', 0, 0), peca('b', 0, 600)]);
    const espelhado = gerarPlt([peca('a', 0, 0), peca('b', 0, 600)], { espelhar: true });
    expect(espelhado).not.toBe(normal);
    expect(espelhado.length).toBeGreaterThan(0);
  });

  it('a observação entra no cabeçalho', () => {
    expect(gerarPlt([peca('a')], { observacao: 'CORTAR PRIMEIRO' })).toContain('LBCORTAR PRIMEIRO');
  });
});

describe('a impressão ajustada a um lado (ADR 0201)', () => {
  it('à largura ou ao comprimento da folha', () => {
    const desenho = { larguraMm: 1000, comprimentoMm: 3000 };
    const folha = { largura: 300, altura: 200 };
    expect(fatoresDaImpressao({ ...ESCALA_REAL, proporcao: 'largura' }, desenho, folha).vertical).toBe(0.2);
    expect(fatoresDaImpressao({ ...ESCALA_REAL, proporcao: 'comprimento' }, desenho, folha).horizontal).toBe(0.1);
  });
});
