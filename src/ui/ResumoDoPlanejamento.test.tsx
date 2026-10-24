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
import { estimarCustoDoTecido, type RoupaDoTamanho } from '../domain/custoDoTecido';
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

  it('o risco com grupos do encaixe diz o trecho de cada grupo (ADR 0103)', () => {
    const comGrupos: RiscoDoPlanejamento = {
      ...RISCO,
      blocosDosGrupos: [
        { grupo: 'Entretela', inicioMm: 0, fimMm: 1400, pecas: 1 },
        { grupo: '', inicioMm: 1500, fimMm: 3000, pecas: 1 },
      ],
    };
    mostrar(entrada({}), CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, [comGrupos]);
    expect(within(screen.getByRole('table', { name: 'Riscos' })).getAllByRole('row')[1]).toHaveTextContent('— grupos: Entretela de 0,00 m a 1,40 m; Sem grupo de 1,50 m a 3,00 m');
  });
});

describe('ResumoDoPlanejamento — o custo do tecido', () => {
  // Uma roupa de 0,5 m² no P, 0,6 m² no M e 0,7 m² no G; 3 camadas de 3,02 m = 9,06 m de malha; 12 roupas.
  const roupa = (tamanho: string, areaMm2: number): RoupaDoTamanho => ({ tamanho, areaMm2, pecas: [{ pecaId: 'f', nome: 'Frente', areaMm2, quantidadePorRoupa: 1, emPar: false }] });
  const ROUPAS = [roupa('P', 500_000), roupa('M', 600_000), roupa('G', 700_000)];

  function mostrarComCusto(malha: MalhaDoCadastro) {
    const e = entrada({ malha });
    const c = calcularPlanejamento(e, [RISCO], [{ chave: RISCO.chave, camadas: 3 }], CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
    if (!c.ok) throw new Error(c.erros.join(' | '));
    const estimativa = estimarCustoDoTecido({ entrada: e, resultado: c.resultado, riscos: [RISCO], roupas: ROUPAS });
    render(<ResumoDoPlanejamento entrada={e} configuracao={CONFIGURACAO_PADRAO_DO_PLANEJAMENTO} resultado={c.resultado} alertas={c.alertas} premissas={c.premissas} riscos={[RISCO]} tamanhos={['P', 'M', 'G']} custoDoTecido={estimativa} />);
    return screen.getByRole('region', { name: 'Custo do tecido' });
  }

  it('com o custo: os dados usados com as unidades, o custo por unidade de cada tamanho, os totais e o critério do rateio', () => {
    const custo = mostrarComCusto({ ...MALHA, tipoDeTecido: 'ramado', custo: { valor: 32, unidade: 'metro-linear', moeda: 'BRL' } });
    expect(custo).toHaveTextContent('Tipo de tecido: Ramado (aberto).');
    expect(custo).toHaveTextContent('Custo informado: R$ 32,00 por metro linear (R$/m).');
    expect(custo).toHaveTextContent('Largura: 1,60 m útil; 1,60 m na mesa × 1 folha(s) por camada = 1,60 m² de malha por metro.');
    expect(custo).toHaveTextContent('Comprimento: 9,06 m de malha');
    expect(custo).toHaveTextContent('Custo por metro: R$ 32,00; por m²: R$ 20,00.');
    const porTamanho = within(custo).getByRole('table', { name: 'Por unidade (uma roupa), por tamanho' });
    expect(within(porTamanho).getAllByRole('row')[1]).toHaveTextContent('P0,5000 m²R$ 10,00R$ 20,13');
    const enfesto = within(custo).getByRole('table', { name: 'O enfesto inteiro' });
    expect(within(enfesto).getByRole('row', { name: /Malha do enfesto/ })).toHaveTextContent('14,50 m²R$ 289,92');
    expect(within(enfesto).getByRole('row', { name: /Peças cortadas/ })).toHaveTextContent('7,20 m²R$ 144,00');
    expect(within(enfesto).getByRole('row', { name: /Área não aproveitada estimada/ })).toHaveTextContent('7,30 m²R$ 145,92');
    expect(within(enfesto).getByRole('row', { name: /Custo médio por unidade/ })).toHaveTextContent('custo total ÷ 12 unidades produzidas');
    expect(within(enfesto).getByRole('row', { name: /Custo médio por unidade/ })).toHaveTextContent('R$ 24,16');
    expect(within(custo).queryByRole('note', { name: 'O que falta para o custo' })).toBeNull();
    expect(custo).toHaveTextContent('a perda não é contada duas vezes');
  });

  it('sem o custo: "Não informado", e nada aparece como R$ 0,00 — cada valor que não saiu diz "não calculado", e o porquê', () => {
    const custo = mostrarComCusto(MALHA);
    expect(custo).toHaveTextContent('Tipo de tecido: Não informado.');
    expect(custo).toHaveTextContent('Custo informado: Não informado.');
    expect(custo).not.toHaveTextContent('R$ 0,00');
    expect(within(custo).getByRole('note', { name: 'O que falta para o custo' })).toHaveTextContent('O custo do tecido não foi informado');
    const porTamanho = within(custo).getByRole('table', { name: 'Por unidade (uma roupa), por tamanho' });
    expect(within(porTamanho).getAllByRole('row')[1]).toHaveTextContent('P0,5000 m²não calculadonão calculado3');
    // As áreas saem (são da geometria): o que não aproveita é estimado em m², sem o custo.
    const enfesto = within(custo).getByRole('table', { name: 'O enfesto inteiro' });
    expect(within(enfesto).getByRole('row', { name: /Área não aproveitada estimada/ })).toHaveTextContent('7,30 m²não calculado');
  });

  it('o plano guardado antes da estimativa diz que não a tem; sem a estimativa, a parte do custo não aparece', () => {
    const e = entrada({});
    const c = calcularPlanejamento(e, [RISCO], [{ chave: RISCO.chave, camadas: 3 }], CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
    if (!c.ok) throw new Error(c.erros.join(' | '));
    const { unmount } = render(<ResumoDoPlanejamento entrada={e} configuracao={CONFIGURACAO_PADRAO_DO_PLANEJAMENTO} resultado={c.resultado} alertas={c.alertas} premissas={c.premissas} riscos={[RISCO]} tamanhos={['P', 'M', 'G']} custoDoTecido="sem-estimativa" />);
    expect(screen.getByRole('region', { name: 'Custo do tecido' })).toHaveTextContent('Este plano é de antes da estimativa de custo do tecido');
    unmount();
    mostrar(e);
    expect(screen.queryByRole('region', { name: 'Custo do tecido' })).toBeNull();
  });
});
