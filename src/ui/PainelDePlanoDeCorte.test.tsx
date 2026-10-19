import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PainelDePlanoDeCorte, type PlanoAConfirmar } from './PainelDePlanoDeCorte';
import { calcularPlanoDeCorte, CONFIGURACAO_PADRAO_DO_PLANO, VERSAO_DO_CALCULO, type PlanoDeCorte, type RiscoDoPlano } from '../domain/planoDeCorte';
import type { MalhaCadastrada } from './malhasCadastradas';

afterEach(() => cleanup());

const MOLDE = { projetoId: 'p1', codigo: 'ENF-20261019-001', nome: 'Camiseta', revisao: 4, impressaoDigital: 'aaaa1111' };
const RISCO_DA_MESA: RiscoDoPlano = { origem: 'mesa', comprimentoMm: 3000, larguraMm: 1550, gradePorTamanho: { P: 1, M: 2, G: 1 }, areaDasPecasMm2: 3_600_000 };
const ALGODAO: MalhaCadastrada = { id: 'm1', descricao: 'Malha algodão 30/1', gramaturaGm2: 310, rendimentoMmPorG: 4, larguraUtilMm: 1600, tubular: false, sentidoUnico: false };

function abrir(extras: Partial<Parameters<typeof PainelDePlanoDeCorte>[0]> = {}) {
  const onConfirmar = vi.fn<(p: PlanoAConfirmar) => string | null>(() => null);
  const onCadastrarMalha = vi.fn(() => null);
  render(
    <PainelDePlanoDeCorte
      molde={MOLDE}
      tamanhosDoMolde={['P', 'M', 'G']}
      riscoDaMesa={RISCO_DA_MESA}
      tecidoDoProjeto={null}
      tipoDoEnfesto="impar"
      responsavelSugerido="Ana"
      planosSalvos={[]}
      malhasCadastradas={[ALGODAO]}
      configuracaoGuardada={CONFIGURACAO_PADRAO_DO_PLANO}
      onCadastrarMalha={onCadastrarMalha}
      onConfirmar={onConfirmar}
      onFechar={() => {}}
      {...extras}
    />,
  );
  return { onConfirmar, onCadastrarMalha };
}

const escrever = (rotulo: string | RegExp, valor: string, dentro: HTMLElement = document.body) =>
  fireEvent.change(within(dentro).getByLabelText(rotulo), { target: { value: valor } });
const ordem = () => screen.getByRole('group', { name: 'Ordem de produção' });

function preencherOCaso() {
  escrever('Código da ordem', 'OP-17');
  escrever('P', '40', ordem());
  escrever('M', '80', ordem());
  escrever('G', '40', ordem());
  fireEvent.change(screen.getByLabelText('Malha'), { target: { value: 'm1' } });
  escrever('Peso disponível (kg)', '200');
}

describe('PainelDePlanoDeCorte', () => {
  it('sem a ordem e sem a malha, não calcula: diz o que falta, e o Confirmar fica desligado', () => {
    abrir();
    const faltas = screen.getByRole('alert');
    expect(faltas).toHaveTextContent('Ainda não dá para calcular');
    expect(faltas).toHaveTextContent('Preencha "Largura útil (m)"');
    expect(screen.getByRole('button', { name: 'Confirmar o plano' })).toBeDisabled();
  });

  it('com o risco da mesa, a ordem e a malha do cadastro, a proposta aparece com a mesa, as camadas e a eficiência', () => {
    abrir();
    preencherOCaso();
    const proposta = screen.getByRole('region', { name: 'Proposta' });
    // 3 m de risco + 10 cm + 10 cm de margens (configuração padrão), na largura de 1,60 m.
    expect(proposta).toHaveTextContent('Mesa sugerida: 3,20 m × 1,60 m = 5,12 m²');
    expect(proposta).toHaveTextContent('40 camada(s) no total');
    expect(proposta).toHaveTextContent('Malha: Malha algodão 30/1 — gramatura 310 g/m² — rendimento informado 4,00 m/kg');
    expect(proposta).toHaveTextContent('Eficiência do encaixe75,0%');
    // A divergência entre o informado e o calculado é avisada, e a escolha do principal aparece.
    expect(proposta).toHaveTextContent('diferem');
    expect(screen.getByRole('radiogroup', { name: 'Rendimento principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar o plano' })).toBeEnabled();
  });

  it('confirma com as unidades internas (mm, g), os ajustes e o responsável', () => {
    const { onConfirmar } = abrir();
    preencherOCaso();
    escrever('Camadas', '30', screen.getByRole('group', { name: 'Ajustes (em branco, vale a sugestão)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    const pedido = onConfirmar.mock.calls[0]![0];
    expect(pedido.responsavel).toBe('Ana');
    expect(pedido.aplicarAoEnfesto).toBe(true);
    expect(pedido.ajustes).toEqual({ camadas: 30 });
    expect(pedido.entrada.malha).toMatchObject({ larguraUtilMm: 1600, gramaturaGm2: 310, rendimentoMmPorG: 4, pesoDisponivelG: 200_000 });
    expect(pedido.entrada.ordem).toEqual({ codigo: 'OP-17', quantidadesPorTamanho: { P: 40, M: 80, G: 40 } });
    expect(pedido.entrada.risco).toEqual(RISCO_DA_MESA);
    expect(pedido.configuracao).toEqual(CONFIGURACAO_PADRAO_DO_PLANO);
  });

  it('sem responsável, não confirma', () => {
    const { onConfirmar } = abrir({ responsavelSugerido: '' });
    preencherOCaso();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.getByText('Informe o responsável pelo plano.')).toBeInTheDocument();
  });

  it('a largura em centímetros é convertida; o risco informado à mão pede o comprimento', () => {
    const { onConfirmar } = abrir({ riscoDaMesa: null, malhasCadastradas: [] });
    expect(screen.getByLabelText(/As peças na mesa/)).toBeDisabled();
    escrever('Código da ordem', 'OP-9');
    escrever('P', '10', ordem());
    escrever('P', '1', screen.getByRole('group', { name: 'Molde e risco' }));
    escrever('Descrição / composição', 'Moletom');
    fireEvent.change(screen.getByLabelText('Unidade da largura útil'), { target: { value: 'cm' } });
    escrever('Largura útil (cm)', '180');
    escrever('Rendimento (m/kg)', '2,5');
    escrever('Peso disponível (kg)', '50');
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha "Comprimento do risco (m)"');
    escrever('Comprimento do risco (m)', '1,2');
    escrever('Largura do risco (m)', '1,7');
    expect(screen.getByRole('region', { name: 'Proposta' })).toHaveTextContent('o resultado depende do comprimento e da grade informados');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    expect(onConfirmar.mock.calls[0]![0].entrada.malha.larguraUtilMm).toBe(1800);
    expect(onConfirmar.mock.calls[0]![0].entrada.risco).toMatchObject({ origem: 'informado', comprimentoMm: 1200, larguraMm: 1700 });
  });

  it('o erro de quem confirma (ao guardar) aparece na janela', () => {
    abrir({ onConfirmar: () => 'Não deu para guardar.' });
    preencherOCaso();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    expect(screen.getByText('Não deu para guardar.')).toBeInTheDocument();
  });

  it('os planos salvos aparecem como foram, e avisam quando o molde mudou depois deles', () => {
    const entrada = {
      molde: { ...MOLDE, revisao: 2, impressaoDigital: 'bbbb2222' },
      ordem: { codigo: 'OP-1', quantidadesPorTamanho: { P: 10 } },
      malha: { descricao: 'Malha antiga', larguraUtilMm: 1600, rendimentoMmPorG: 3, pesoDisponivelG: 100_000, tubular: false, sentidoUnico: false },
      rendimentoPrincipal: 'informado' as const,
      risco: RISCO_DA_MESA,
      tipoDeEnfesto: 'impar' as const,
    };
    const calculo = calcularPlanoDeCorte(entrada);
    if (!calculo.ok) throw new Error('não calculou');
    const salvo: PlanoDeCorte = {
      id: 'plano-1',
      criadoEmIso: '2026-10-10T12:00:00.000Z',
      responsavel: 'Bruno',
      versaoDoCalculo: VERSAO_DO_CALCULO,
      entrada,
      configuracao: CONFIGURACAO_PADRAO_DO_PLANO,
      ajustes: [{ campo: 'camadas', sugerido: 10, escolhido: 8 }],
      resultado: calculo.resultado,
      alertas: calculo.alertas,
      premissas: calculo.premissas,
    };
    abrir({ planosSalvos: [salvo] });
    fireEvent.click(screen.getByRole('button', { name: /ordem OP-1/ }));
    expect(screen.getByText(/os valores são os de então, sem recalcular/)).toHaveTextContent('Ajustes feitos: camadas 10 → 8');
    expect(screen.getByText(/O molde mudou depois deste plano \(revisão 2 → 4\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Malha: Malha antiga/)).toHaveLength(1);
  });

  it('guarda a malha informada no cadastro', () => {
    const { onCadastrarMalha } = abrir({ malhasCadastradas: [] });
    escrever('Descrição / composição', 'Ribana');
    escrever('Largura útil (m)', '0,9');
    escrever('Gramatura (g/m²)', '280');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a malha no cadastro' }));
    expect(onCadastrarMalha).toHaveBeenCalledWith({ descricao: 'Ribana', larguraUtilMm: 900, gramaturaGm2: 280, tubular: false, sentidoUnico: false });
    expect(screen.getByText('Malha “Ribana” guardada no cadastro deste computador.')).toBeInTheDocument();
  });
});
