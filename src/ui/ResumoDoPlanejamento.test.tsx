import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { MalhaDoCadastro, RoloDeEstoque } from '../domain/cadastroDeProducao';
import { RESTRICAO_PADRAO } from '../domain/molde';
import {
  calcularPlanejamento,
  CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
  type ConfiguracaoDoPlanejamento,
  type EntradaDoPlanejamento,
  type RiscoDoPlanejamento,
} from '../domain/planoDeEnfesto';
import { ResumoDoPlanejamento } from './ResumoDoPlanejamento';

afterEach(() => cleanup());

const MALHA: MalhaDoCadastro = { id: 'm1', descricao: 'Malha', larguraUtilMm: 1600, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false };
const fio = { inicio: { x: 1, y: 1 }, fim: { x: 1, y: 2 } };
// Risco de 3 m com duas peças (0–1,4 m e 1,5–3 m): a linha de emenda fica a 1,4 m do começo do risco.
const RISCO: RiscoDoPlanejamento = {
  chave: 'P:1|M:2|G:1',
  grade: { P: 1, M: 2, G: 1 },
  origem: 'gerado',
  comprimentoMm: 3000,
  larguraMm: 1550,
  larguraDoRiscoMm: 1600,
  areaDasPecasMm2: 3_600_000,
  eficienciaPercentual: 75,
  pecas: [
    { pecaId: 'a', nome: 'A', tamanho: 'M', contorno: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 1400 }, { x: 0, y: 1400 }], fio, anguloGraus: 0, espelhada: false },
    { pecaId: 'b', nome: 'B', tamanho: 'M', contorno: [{ x: 0, y: 1500 }, { x: 500, y: 1500 }, { x: 500, y: 3000 }, { x: 0, y: 3000 }], fio, anguloGraus: 0, espelhada: false },
  ],
};
const rolo = (id: string, extras: Partial<RoloDeEstoque> = {}): RoloDeEstoque => ({ id, malhaId: 'm1', identificacao: id, lote: 'L1', tonalidade: 'A', defeitos: [], unidadeDoPeso: 'kg', unidadeDoComprimento: 'm', indisponivel: false, ...extras });
const entrada = (extras: Partial<EntradaDoPlanejamento>): EntradaDoPlanejamento => ({
  molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 1, impressaoDigital: 'abc', pecas: [{ id: 'f', nome: 'Frente', tamanhos: ['P', 'M', 'G'], quantidadePorRoupa: 1, emPar: false, restricao: RESTRICAO_PADRAO, areaMm2: 900_000 }] },
  ordem: { codigo: 'OP-17', quantidadesPorTamanho: { P: 3, M: 6, G: 3 } },
  malha: MALHA,
  rolos: null,
  pesoDisponivelG: 100_000,
  rendimentoPrincipal: 'informado',
  misturarGrupos: false,
  aceitarPadraoSemCasamento: false,
  tipoDeEnfesto: 'impar',
  larguraDoRiscoMm: 1600,
  ...extras,
});

/** Calcula o plano de 3 camadas do risco e mostra o resumo (com os riscos mostrados, que podem ser outros). */
function mostrar(e: EntradaDoPlanejamento, configuracao: ConfiguracaoDoPlanejamento = CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, riscos: readonly RiscoDoPlanejamento[] = [RISCO]) {
  const c = calcularPlanejamento(e, [RISCO], [{ chave: RISCO.chave, camadas: 3 }], configuracao);
  if (!c.ok) throw new Error(c.erros.join(' | '));
  render(<ResumoDoPlanejamento entrada={e} configuracao={configuracao} resultado={c.resultado} alertas={c.alertas} premissas={c.premissas} riscos={riscos} tamanhos={['P', 'M', 'G']} />);
}

describe('ResumoDoPlanejamento — o que é novo no plano', () => {
  it('as emendas: a coluna no rolo, a tabela de onde fica cada uma, e a sobreposição nas perdas', () => {
    mostrar(entrada({ rolos: [rolo('A', { comprimentoMedidoMm: 7500 }), rolo('B', { comprimentoMedidoMm: 3000 })] }), { ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, permitirEmendas: true, sobreposicaoDaEmendaMm: 100 });
    const emendas = screen.getByRole('table', { name: 'Emendas (a camada continua no rolo seguinte)' });
    expect(within(emendas).getAllByRole('row')[1]).toHaveTextContent('AB1,40 m0,10 m');
    expect(within(screen.getByRole('table', { name: 'Rolos' })).getByRole('columnheader', { name: 'Emendas' })).toBeInTheDocument();
    expect(screen.getByText(/sobreposição das emendas 0,10 m/)).toBeInTheDocument();
  });

  it('o uso de outros planos e o trecho pulado pelo defeito com posição aparecem em colunas próprias', () => {
    mostrar(entrada({ rolos: [rolo('R1', { comprimentoMedidoMm: 20_000, defeitos: [{ descricao: 'furo', perdaMm: 480, posicaoMm: 7020, tipo: 'furo' }] })], usoAnteriorDosRolosMm: { R1: 4000 } }));
    const rolos = screen.getByRole('table', { name: 'Rolos' });
    expect(within(rolos).getByRole('columnheader', { name: 'Já usado por outros planos' })).toBeInTheDocument();
    expect(within(rolos).getByRole('columnheader', { name: 'Pulado por defeito (com posição)' })).toBeInTheDocument();
    expect(within(rolos).getAllByRole('row')[1]).toHaveTextContent('4,00 m');
    expect(within(rolos).getAllByRole('row')[1]).toHaveTextContent('0,48 m');
    expect(screen.getByText(/trechos pulados por defeitos com posição 0,48 m/)).toBeInTheDocument();
  });

  it('o plano sem nada disso (como os antigos) não ganha colunas vazias', () => {
    mostrar(entrada({ rolos: [rolo('R1', { comprimentoMedidoMm: 20_000 })] }));
    const rolos = screen.getByRole('table', { name: 'Rolos' });
    expect(within(rolos).queryByRole('columnheader', { name: 'Emendas' })).toBeNull();
    expect(within(rolos).queryByRole('columnheader', { name: 'Já usado por outros planos' })).toBeNull();
    expect(screen.queryByRole('table', { name: /Emendas/ })).toBeNull();
  });

  it('o risco compensado e o risco casado são ditos na tabela dos riscos', () => {
    const marcado: RiscoDoPlanejamento = { ...RISCO, compensado: { comprimento: 1 / 0.95, largura: 1 }, casamento: { rapportComprimentoMm: 100, faseComprimentoMm: 0, faseLarguraMm: 0, conferido: true } };
    mostrar(entrada({}), CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, [marcado]);
    expect(within(screen.getByRole('table', { name: 'Riscos' })).getAllByRole('row')[1]).toHaveTextContent('(encolhimento compensado) (desenho casado)');
  });
});
