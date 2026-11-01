import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { gerarIso } from './iso-exportacao';
import { gerarPlt, type OpcoesDoPlt } from './plt-exportacao';

/**
 * O teste do equipamento (ADR 0217): o que nenhum simulador substitui. Uma página de medidas conhecidas sai pelo mesmo
 * caminho de um risco de verdade; quem está na máquina mede com a trena, e o programa calcula a correção.
 */

export const LADO_DO_QUADRADO_MM = 100;
/** A largura da moldura da página: cabe em qualquer plotter. */
export const LARGURA_DA_PAGINA_MM = 140;
export const COMPRIMENTO_PADRAO_DO_TESTE_MM = 1000;
const MARCA_DA_REGUA_MM = 100;

/** Mais que isto de erro não é ajuste do plotter: é medida trocada, ou a escala errada na máquina. */
const MAIOR_CORRECAO = 0.1;

export interface Calibracao {
  /** Multiplica o comprimento da mesa (o avanço do papel). */
  readonly horizontal: number;
  /** Multiplica a largura da mesa. */
  readonly vertical: number;
  readonly quandoIso: string;
}

const quadrado = (): Molde =>
  criarMolde(
    {
      nome: 'Quadrado de 100 mm',
      referencia: '',
      tamanho: '',
      quantidade: 1,
      contorno: [ponto(20, 20), ponto(20 + LADO_DO_QUADRADO_MM, 20), ponto(20 + LADO_DO_QUADRADO_MM, 20 + LADO_DO_QUADRADO_MM), ponto(20, 20 + LADO_DO_QUADRADO_MM)],
      margemDeCosturaMm: 0,
      linhaDeFio: { inicio: ponto(70, 40), fim: ponto(70, 100) },
      restricaoDeRotacao: { permite180: true, permite90e270: true },
    },
    'teste-do-equipamento',
  );

/** A página do plotter, sem a calibração: é o erro da máquina que se quer medir. */
export function paginaDeTesteDoPlotter(comprimentoMm: number, dataIso: string, opcoes: Pick<OpcoesDoPlt, 'canetas' | 'ferramentas' | 'textoComoLinha' | 'tracosDaFonte'> = {}): string {
  const linhas = [];
  for (let y = MARCA_DA_REGUA_MM; y < comprimentoMm; y += MARCA_DA_REGUA_MM) {
    linhas.push({ de: ponto(LARGURA_DA_PAGINA_MM - 12, y), ate: ponto(LARGURA_DA_PAGINA_MM, y), nome: String(y) });
  }
  return gerarPlt([quadrado()], { ...opcoes, larguraDaMesaMm: LARGURA_DA_PAGINA_MM, comprimentoDaMesaMm: comprimentoMm, linhas, cabecalho: [`Teste do plotter - ${dataIso.slice(0, 10)}`, `Moldura ${comprimentoMm} x ${LARGURA_DA_PAGINA_MM} mm`] });
}

/** O teste da mesa de corte: um quadrado de 100 mm, com a faca. Sem peça cortada de verdade: é para rodar em papel. */
export function testeDaMesaDeCorte(): string {
  return gerarIso([quadrado()], { larguraDaMesaMm: LARGURA_DA_PAGINA_MM });
}

/** A correção pelas medidas da trena. Dá erro se a medida for absurda. */
export function calibracaoDasMedidas(medido: { readonly comprimentoMm: number; readonly larguraMm: number }, comprimentoNominalMm: number, agoraIso: string): Calibracao {
  const fator = (nominal: number, real: number, nome: string): number => {
    if (!(real > 0)) throw new Error(`Escreva a medida ${nome}.`);
    const f = nominal / real;
    if (Math.abs(f - 1) > MAIOR_CORRECAO) throw new Error(`A medida ${nome} está mais de 10% longe de ${nominal} mm: confira a medida e a escala do plotter.`);
    return f;
  };
  return { horizontal: fator(comprimentoNominalMm, medido.comprimentoMm, 'do comprimento'), vertical: fator(LARGURA_DA_PAGINA_MM, medido.larguraMm, 'da largura'), quandoIso: agoraIso };
}

/** A correção lida do armazenamento: o que não for uma correção válida é ignorado. */
export function calibracaoGuardada(bruto: string | null): Calibracao | null {
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Partial<Calibracao>;
    const valido = (v: unknown): v is number => typeof v === 'number' && Math.abs(v - 1) <= MAIOR_CORRECAO;
    return valido(c.horizontal) && valido(c.vertical) ? { horizontal: c.horizontal, vertical: c.vertical, quandoIso: String(c.quandoIso ?? '') } : null;
  } catch {
    return null;
  }
}
