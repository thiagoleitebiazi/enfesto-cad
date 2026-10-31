import { ponto, retanguloEnvolvente, type Contorno, type Ponto2D } from '../core/geometria';
import { arestaDeSimetria } from '../domain/anotacoes';
import { cantosDoContorno } from '../domain/graduacao';
import { linhasDoMolde } from '../domain/linhasAuxiliares';
import { linhaDeCorteDaPeca, type Molde } from '../domain/molde';
import { expandirTamanhos } from '../domain/tamanhosGraduados';
import { corteDoPique, mundoParaDxf } from './dxf-exportacao';

/**
 * O DXF no padrão ASTM D6673 (ADR 0166), o que os sistemas de modelagem trocam entre si: cada peça é um bloco, as
 * camadas têm número, e os atributos (nome, tamanho, quantidade) vão em textos na camada 1. Camadas usadas:
 * 1 contorno, 2 pontos de canto, 3 pontos de curva, 4 piques, 6 espelho, 7 fio, 8 linhas internas, 11 recortes internos,
 * 13 furos de marcação, 14 costura.
 *
 * Com graduação, sai um bloco por tamanho: o arquivo de regras (.RUL) não é escrito, porque o formato dele não está
 * publicado de forma que dê para conferir. Não foi testado em outro sistema: a conferência é a volta pelo importador
 * deste programa.
 */

const linha = (codigo: number, valor: string | number): string => `${codigo}\r\n${valor}\r\n`;
const n = (v: number): string => (Math.round(v * 1000) / 1000).toString();

const ponto2 = (p: Ponto2D, x = 10): string => linha(x, n(p.x)) + linha(x + 10, n(p.y)) + linha(x + 20, 0);

const polilinha = (camada: number, pontos: readonly Ponto2D[], fechada: boolean): string =>
  linha(0, 'POLYLINE') +
  linha(8, camada) +
  linha(66, 1) +
  linha(70, fechada ? 1 : 0) +
  pontos.map((p) => linha(0, 'VERTEX') + linha(8, camada) + ponto2(p)).join('') +
  linha(0, 'SEQEND') +
  linha(8, camada);

const segmento = (camada: number, a: Ponto2D, b: Ponto2D): string => linha(0, 'LINE') + linha(8, camada) + ponto2(a) + ponto2(b, 11);
const pontoDxf = (camada: number, p: Ponto2D): string => linha(0, 'POINT') + linha(8, camada) + ponto2(p);
const texto = (camada: number, p: Ponto2D, t: string): string => linha(0, 'TEXT') + linha(8, camada) + ponto2(p) + linha(40, 5) + linha(1, t);

const semQuebra = (t: string): string => t.replace(/[\r\n]+/g, ' ').trim();

function blocoDaPeca(peca: Molde, nome: string, estilo: string): string {
  const corte: Contorno = linhaDeCorteDaPeca(peca);
  const caixa = retanguloEnvolvente(corte);
  const noBloco = (p: Ponto2D): Ponto2D => {
    const q = mundoParaDxf(p, caixa.maxX);
    return ponto(q.x - caixa.minY, q.y);
  };
  const cantos = new Set(cantosDoContorno(corte));
  const atributos = [`Piece Name: ${semQuebra(peca.nome)}`, `Size: ${semQuebra(peca.tamanho) || 'Base'}`, `Quantity: ${peca.quantidade}`, `Style Name: ${semQuebra(estilo)}`];
  const simetria = arestaDeSimetria(peca);
  return (
    linha(0, 'BLOCK') +
    linha(8, 0) +
    linha(2, nome) +
    linha(70, 0) +
    ponto2(ponto(0, 0)) +
    linha(3, nome) +
    atributos.map((t, i) => texto(1, ponto(0, -8 * (i + 1)), t)).join('') +
    polilinha(1, corte.map(noBloco), true) +
    corte.map((p, i) => pontoDxf(cantos.has(i) ? 2 : 3, noBloco(p))).join('') +
    (corte !== peca.contorno ? polilinha(14, peca.contorno.map(noBloco), true) : '') +
    peca.furos.map((f) => polilinha(11, f.map(noBloco), true)).join('') +
    linhasDoMolde(peca)
      .map((l) => polilinha(8, l.map(noBloco), false))
      .join('') +
    peca.marcas.map((m) => pontoDxf(13, noBloco(m.posicao))).join('') +
    peca.piques
      .map((q) => {
        const [a, b] = corteDoPique(peca, corte, q);
        return segmento(4, noBloco(a), noBloco(b));
      })
      .join('') +
    segmento(7, noBloco(peca.linhaDeFio.inicio), noBloco(peca.linhaDeFio.fim)) +
    (simetria !== null ? segmento(6, noBloco(peca.contorno[simetria]!), noBloco(peca.contorno[(simetria + 1) % peca.contorno.length]!)) : '') +
    linha(0, 'ENDBLK') +
    linha(8, 0)
  );
}

export function gerarDxfAstm(pecas: readonly Molde[], estilo: string, novoId: () => string): string {
  const todas = expandirTamanhos(pecas, novoId);
  const nomes = todas.map((p, i) => `${i + 1}_${semQuebra(`${p.nome}_${p.tamanho}`).replace(/[^A-Za-z0-9_-]+/g, '_')}`.slice(0, 31));
  // As peças ficam uma depois da outra no desenho, para quem abrir o arquivo num programa de CAD comum.
  let x = 0;
  const insercoes = todas.map((p, i) => {
    const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    const r = linha(0, 'INSERT') + linha(8, 0) + linha(2, nomes[i]!) + ponto2(ponto(x, 0));
    x += caixa.maxY - caixa.minY + 50;
    return r;
  });
  return (
    linha(0, 'SECTION') +
    linha(2, 'HEADER') +
    linha(9, '$ACADVER') +
    linha(1, 'AC1009') +
    linha(9, '$INSUNITS') +
    linha(70, 4) +
    linha(0, 'ENDSEC') +
    linha(0, 'SECTION') +
    linha(2, 'BLOCKS') +
    todas.map((p, i) => blocoDaPeca(p, nomes[i]!, estilo)).join('') +
    linha(0, 'ENDSEC') +
    linha(0, 'SECTION') +
    linha(2, 'ENTITIES') +
    insercoes.join('') +
    linha(0, 'ENDSEC') +
    linha(0, 'EOF')
  );
}
