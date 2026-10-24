import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { BIBLIOTECA_VAZIA, salvarMaterial, salvarPadroesDeCusto } from '../domain/materiais';
import { aprovarFicha, enviarParaAprovacao, mudarFicha, novaFichaTecnica } from '../domain/fichaTecnica';
import { calcularPreCusto } from '../domain/preCusto';
import { conteudoDaFichaEmPdf, gerarPdfDaFichaTecnica } from './ficha-exportacao';
import { adicionarElemento, DESENHO_VAZIO, tracosDaBase } from '../domain/desenhoTecnico';

const AGORA = '2026-10-24T17:00:00.000Z';

function exemplo() {
  let b = salvarMaterial(BIBLIOTECA_VAZIA, { id: 'b', codigo: '', descricao: 'Botão', categoria: 'aviamento', unidade: 'un', precoPorUnidade: 0.35, atualizadoEmIso: AGORA }, AGORA);
  b = salvarPadroesDeCusto(b, { custoDoMinuto: 0.5, indiretosPercentual: 10, impostosPercentual: 10, comissaoPercentual: 0, margemPercentual: 30 });
  let ficha = novaFichaTecnica({ nome: 'Camisa', codigo: 'ENF-3', pecas: [] }, AGORA);
  ficha = mudarFicha(
    ficha,
    {
      referencia: 'CAM-01',
      colecao: 'Verão 27',
      tamanhos: ['P', 'M'],
      descricao: 'Camisa de tricoline, manga curta.',
      medidas: [{ id: 'm1', nome: 'Busto', comoMedir: 'na cava', toleranciaCm: 1, valoresCm: { P: 48, M: 52.5 } }],
      materiais: [{ id: 'i1', materialId: 'b', descricao: 'Botão', aplicacao: 'Frente', unidade: 'un', consumo: { tipo: 'informado', quantidade: 7 } }],
      operacoes: [{ id: 'o1', descricao: 'Pregar botões', maquina: 'Botoneira', tempoMin: 1.25, observacao: '' }],
      instrucoes: { costura: 'Pesponto a 1 mm', acabamento: '', conservacao: 'Lavar a 30 °C', embalagem: '' },
    },
    AGORA,
  );
  ficha = aprovarFicha(enviarParaAprovacao(ficha, 'Ana', '', AGORA), 'Bruno', 'ok', AGORA, 3.38);
  return { ficha, preCusto: calcularPreCusto(ficha, b, null) };
}

describe('a ficha técnica em PDF — o conteúdo', () => {
  it('o título, os campos, as tabelas (medidas com a tolerância, materiais, operações, aprovação) e o custo, com vírgula', () => {
    const { ficha, preCusto } = exemplo();
    const c = conteudoDaFichaEmPdf(ficha, preCusto, AGORA);
    expect(c.titulo).toBe('CAM-01 — Camisa');
    expect(c.campos).toContainEqual(['Versão', '1 — Aprovada']);
    expect(c.campos).toContainEqual(['Tamanhos', 'P, M']);
    expect(c.tabelas.map((t) => t.titulo)).toEqual(['Tabela de medidas (cm)', 'Materiais e aviamentos (por peça)', 'Sequência operacional', 'Histórico da aprovação']);
    expect(c.tabelas[0]!.linhas).toEqual([['Busto (na cava)', '48,0 ± 1,0', '52,5 ± 1,0']]);
    expect(c.tabelas[1]!.linhas).toEqual([['Botão', 'Frente', '7 un', 'R$ 0,35/un', 'R$ 2,45']]);
    expect(c.tabelas[2]!.rodape).toBe('Tempo total por peça: 1,25 min');
    expect(c.tabelas[3]!.linhas[1]).toEqual([new Date(AGORA).toLocaleDateString('pt-BR'), '1', 'Aprovada', 'Bruno', 'ok', 'R$ 3,38']);
    expect(c.instrucoes).toEqual([
      ['Costura', 'Pesponto a 1 mm'],
      ['Conservação', 'Lavar a 30 °C'],
    ]);
    // 2,45 + 0,625 = 3,075 de direto; +10% = 3,3825; ÷ 60% = 5,6375.
    expect(c.custo).toContainEqual(['Custo total', 'R$ 3,38']);
    expect(c.custo).toContainEqual(['Preço sugerido (markup 1,67)', 'R$ 5,64']);
    expect(c.faltando).toEqual([]);
  });

  it('sem pré-custo nem nada preenchido: só o que há', () => {
    const vazia = novaFichaTecnica({ nome: 'X', codigo: 'ENF-4', pecas: [] }, AGORA);
    const c = conteudoDaFichaEmPdf(vazia, null, AGORA);
    expect(c.tabelas).toEqual([]);
    expect(c.custo).toEqual([]);
    expect(c.instrucoes).toEqual([]);
  });
});

describe('a ficha técnica em PDF — o arquivo', () => {
  it('é um PDF, com o desenho das peças e as tabelas', async () => {
    const { ficha, preCusto } = exemplo();
    const pecas = [criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(500, 0), ponto(500, 700), ponto(0, 700)], linhaDeFio: { inicio: ponto(10, 10), fim: ponto(10, 600) } }, 'f')];
    const blob = await gerarPdfDaFichaTecnica(ficha, preCusto, pecas, AGORA);
    const texto = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(texto.startsWith('%PDF-')).toBe(true);
    // O texto do PDF (sem compressão) vem em hexadecimal: decodificado, as palavras aparecem.
    const decodificado = [...texto.matchAll(/<([0-9a-f]+)>/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('');
    for (const palavra of ['FICHA', 'Tabela de medidas', 'Sequ', 'Hist', 'Moldes', 'Pre']) expect(decodificado).toContain(palavra);
  });
});

describe('a ficha técnica em PDF — o desenho técnico (ADR 0107)', () => {
  it('com o croqui na ficha, o PDF ganha a parte "Desenho técnico" com as vistas', async () => {
    const { ficha, preCusto } = exemplo();
    let n = 0;
    const comDesenho = { ...ficha, desenho: adicionarElemento(DESENHO_VAZIO, tracosDaBase('camiseta', () => `d${++n}`)) };
    const blob = await gerarPdfDaFichaTecnica(comDesenho, preCusto, [], AGORA, []);
    const texto = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    const decodificado = [...texto.matchAll(/<([0-9a-f]+)>/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('');
    expect(decodificado).toContain('Desenho t');
    expect(decodificado).toContain('Frente');
    expect(decodificado).toContain('Costas');
    // Sem o croqui, a parte não aparece.
    const semDesenho = await gerarPdfDaFichaTecnica(ficha, preCusto, [], AGORA, []);
    const textoSem = [...Buffer.from(await semDesenho.arrayBuffer()).toString('latin1').matchAll(/<([0-9a-f]+)>/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('');
    expect(textoSem).not.toContain('Desenho t');
  });
});
