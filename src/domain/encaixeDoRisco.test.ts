import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { arquivoDoRisco, estadosDosRiscos } from './encaixeDoRisco';
import { areaUtilDaMesa, criarConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, linhaDeCorteDaPeca, rotacionarMolde, type Molde } from './molde';
import { modeloDoPlano } from './modeloDoPlano';
import { fazerRisco, pecasDaGrade } from './risco';
import { validarProjeto } from './validacao';
import type { RiscoDoPlanejamento } from './planoDeEnfesto';
import type { Projeto } from './projeto';
import type { PecaPostaNoRisco } from './risco';

const peca = (extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: true } }, 'frente'),
  ...extra,
});

const enfesto = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 4, margemDeExtremidadeMm: 4, distanciaMinimaEntrePecasMm: 3 });

const risco = (pecas: readonly PecaPostaNoRisco[], extra: Partial<RiscoDoPlanejamento> = {}): RiscoDoPlanejamento => ({ chave: 'r1', grade: { M: 1 }, origem: 'gerado', comprimentoMm: 500, larguraMm: 800, larguraDoRiscoMm: 900, areaDasPecasMm2: null, eficienciaPercentual: null, pecas, ...extra }) as RiscoDoPlanejamento;

const plano = (r: RiscoDoPlanejamento) => ({ riscos: [r], resultado: { riscos: [{ chave: 'r1', camadas: 12 }] }, entrada: { tipoDeEnfesto: 'impar' } }) as unknown as Parameters<typeof estadosDosRiscos>[0];

let n = 0;
const novoId = (): string => `n${n++}`;

describe('com um risco gerado de verdade (ADR 0216)', () => {
  it('as peças do projeto caem exatamente onde o risco as desenhou, sem sobrepor', () => {
    const triangulo: Molde = { ...peca(), id: 'manga', nome: 'Manga', contorno: [ponto(0, 0), ponto(180, 0), ponto(90, 240)], restricaoDeRotacao: { permite180: true, permite90e270: true }, emPar: true };
    const pecas = [peca({ quantidade: 2 }), triangulo];
    const modelo = modeloDoPlano(pecas);
    const quantidades = Object.fromEntries(pecas.map((p) => [modelo.pecas.find((m) => m.nome === p.nome)!.id, p.emPar ? 2 : 2]));
    const gerado = fazerRisco(pecasDaGrade(modelo, { M: 2 }, quantidades), { M: 2 }, { larguraMm: 800, comprimentoMaximoMm: 3000, distanciaMm: 3, sentidoUnico: false, tempoLimiteMs: 0 });
    if (!gerado.ok) throw new Error(gerado.motivo);
    expect(gerado.pecas.length).toBe(8);
    const risco = { ...gerado, chave: 'r1', origem: 'gerado', larguraMm: gerado.larguraOcupadaMm, areaDasPecasMm2: gerado.areaDasPecasMm2 } as unknown as RiscoDoPlanejamento;
    const [e] = estadosDosRiscos(plano(risco), modelo, { pecas, tecido: null, enfesto }, 3, novoId);
    expect(e!.pecas).toHaveLength(8);
    // Cada peça do projeto cai sobre a linha de corte que o risco guardou, a menos da margem: 4 mm nos dois sentidos.
    const caixaDe = (c: readonly { x: number; y: number }[], folga: number): string => {
      const k = retanguloEnvolvente(c);
      return [k.minX + folga, k.maxX + folga, k.minY + folga, k.maxY + folga].map((v) => v.toFixed(2)).join(',');
    };
    const noRisco = gerado.pecas.map((p) => caixaDe(p.contorno, 4)).sort();
    const noProjeto = e!.pecas.map((p) => caixaDe(linhaDeCorteDaPeca(p), 0)).sort();
    expect(noProjeto).toEqual(noRisco);
    const problemas = validarProjeto(e!.pecas, e!.enfesto).filter((p) => p.tipo === 'sobreposicao' || p.tipo === 'fora-dos-limites' || p.tipo === 'espacamento-insuficiente');
    expect(problemas).toEqual([]);
  });
});

describe('um projeto por risco (ADR 0212)', () => {
  const base = peca();
  const modelo = modeloDoPlano([base]);
  const pecaId = modelo.pecasPorTamanho['M']![0]!.pecaId;
  const posta = (extra: Partial<PecaPostaNoRisco> = {}): PecaPostaNoRisco => ({ pecaId, nome: 'Frente', tamanho: 'M', contorno: [], fio: { inicio: ponto(0, 0), fim: ponto(0, 1) }, anguloGraus: 90, espelhada: false, deslocamentoMm: ponto(100, 120), ...extra });
  const estado = { pecas: [base], tecido: null, enfesto };

  it('a mesa e as camadas são as do risco', () => {
    const [e] = estadosDosRiscos(plano(risco([posta()])), modelo, estado, 3, novoId);
    expect(e!.enfesto).toMatchObject({ larguraUtilMm: 900, comprimentoMm: 500, quantidadeDeCamadas: 12, tipo: 'impar' });
  });

  it('a peça fica no lugar do plano: girada e deslocada', () => {
    const [e] = estadosDosRiscos(plano(risco([posta()])), modelo, estado, 3, novoId);
    const r = e!.pecas[0]!;
    expect(r.anguloDeRotacaoGraus).toBe(90);
    expect(r.quantidade).toBe(1);
    const esperado = retanguloEnvolvente(rotacionarMolde(base, 90).contorno);
    expect(retanguloEnvolvente(r.contorno)).toMatchObject({ minX: esperado.minX + 100, minY: esperado.minY + 120 });
  });

  it('o risco encostado na borda anda para dentro da margem de segurança, com a mesa acompanhando', () => {
    const [e] = estadosDosRiscos(plano(risco([posta({ anguloGraus: 0, deslocamentoMm: ponto(0, 0) })], { larguraDoRiscoMm: 100, comprimentoMm: 200 })), modelo, estado, 3, novoId);
    const caixa = retanguloEnvolvente(e!.pecas[0]!.contorno);
    expect(caixa).toMatchObject({ minX: 4, minY: 4, maxX: 104, maxY: 204 });
    expect(e!.enfesto).toMatchObject({ larguraUtilMm: 108, comprimentoMm: 208 });
    expect(validarProjeto(e!.pecas, e!.enfesto).filter((p) => p.severidade === 'erro')).toEqual([]);
  });

  it('no tecido dobrado, a peça continua encostada na dobra', () => {
    const dobrado = { ...plano(risco([posta({ anguloGraus: 0, deslocamentoMm: ponto(0, 50) })])), entrada: { tipoDeEnfesto: 'par' } } as Parameters<typeof estadosDosRiscos>[0];
    const [e] = estadosDosRiscos(dobrado, modelo, estado, 3, novoId);
    expect(retanguloEnvolvente(e!.pecas[0]!.contorno).minX).toBe(0);
  });

  it('a peça que passa da mesa aumenta a mesa', () => {
    const [e] = estadosDosRiscos(plano(risco([posta({ deslocamentoMm: ponto(10, 600) })])), modelo, estado, 3, novoId);
    expect(e!.enfesto!.comprimentoMm).toBeGreaterThan(600);
  });

  it('o risco informado à mão fica fora da mesa, esperando o encaixe', () => {
    const [e] = estadosDosRiscos(plano(risco([])), modelo, estado, 3, novoId);
    const util = areaUtilDaMesa(e!.enfesto!);
    expect(e!.pecas).toHaveLength(1);
    expect(retanguloEnvolvente(e!.pecas[0]!.contorno).minY).toBeGreaterThanOrEqual(util.maxY);
  });

  it('o risco guardado antes do deslocamento também', () => {
    const { deslocamentoMm: _sem, ...sem } = posta();
    void _sem;
    const [e] = estadosDosRiscos(plano(risco([sem as PecaPostaNoRisco])), modelo, estado, 3, novoId);
    expect(retanguloEnvolvente(e!.pecas[0]!.contorno).minY).toBeGreaterThanOrEqual(areaUtilDaMesa(e!.enfesto!).maxY);
  });

  it('a peça em par: a cópia espelhada sai espelhada', () => {
    const par: Molde = { ...peca(), contorno: [ponto(0, 0), ponto(100, 0), ponto(0, 200)], emPar: true };
    const m = modeloDoPlano([par]);
    const id = m.pecasPorTamanho['M']![0]!.pecaId;
    const [e] = estadosDosRiscos(plano(risco([posta({ pecaId: id, anguloGraus: 0, espelhada: true, deslocamentoMm: ponto(0, 0) })])), m, { ...estado, pecas: [par] }, 3, novoId);
    expect(e!.pecas[0]!.contorno[1]).not.toEqual(par.contorno[1]);
  });
});

describe('criar de novo (ADR 0219)', () => {
  const projeto = (id: string, origemDoPlano?: Projeto['origemDoPlano']): Projeto => ({ id, ...(origemDoPlano ? { origemDoPlano } : {}) }) as Projeto;

  it('acha o projeto do mesmo risco do mesmo modelo, e só ele', () => {
    const lista = [projeto('a'), projeto('b', { projetoId: 'm', chaveDoRisco: 'r1' }), projeto('c', { projetoId: 'm', chaveDoRisco: 'r2' }), projeto('d', { projetoId: 'n', chaveDoRisco: 'r1' })];
    expect(arquivoDoRisco(lista, { projetoId: 'm', chaveDoRisco: 'r2' })?.id).toBe('c');
    expect(arquivoDoRisco(lista, { projetoId: 'm', chaveDoRisco: 'r9' })).toBeUndefined();
  });
});
