import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { estadosDosRiscos } from './encaixeDoRisco';
import { areaUtilDaMesa, criarConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, rotacionarMolde, type Molde } from './molde';
import { modeloDoPlano } from './modeloDoPlano';
import type { RiscoDoPlanejamento } from './planoDeEnfesto';
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

describe('um projeto por risco (ADR 0212)', () => {
  const base = peca();
  const modelo = modeloDoPlano([base]);
  const pecaId = modelo.pecasPorTamanho['M']![0]!.pecaId;
  const posta = (extra: Partial<PecaPostaNoRisco> = {}): PecaPostaNoRisco => ({ pecaId, nome: 'Frente', tamanho: 'M', contorno: [], fio: { inicio: ponto(0, 0), fim: ponto(0, 1) }, anguloGraus: 90, espelhada: false, deslocamentoMm: ponto(10, 20), ...extra });
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
    expect(retanguloEnvolvente(r.contorno)).toMatchObject({ minX: esperado.minX + 10, minY: esperado.minY + 20 });
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
