import { distancia, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { dobraPelaLinhaInterna, dobraPeloMeio, metadeDoMolde, type OpcoesDeDobra } from '../domain/corteEUniao';
import type { Molde } from '../domain/molde';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import { aplicarReta, type PreviaDeFerramentaDeMolde } from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';

/**
 * "Dobrar" (aba Produção): os modos de indicar a linha de dobra e as opções
 * da janela, como no manual da referência — horizontal, vertical ou em
 * relação a um elemento, "Manter dobra do molde" e "Fio no centro do molde".
 * O modo por dois pontos do contorno é nosso, a mais.
 */
export type ModoDeDobra = 'horizontal' | 'vertical' | 'elemento' | 'dois-pontos';

export interface OpcoesDeDobrar extends OpcoesDeDobra {
  readonly modo: ModoDeDobra;
}

export const OPCOES_INICIAIS_DE_DOBRAR: OpcoesDeDobrar = { modo: 'horizontal', manter: false, fioNoCentro: false };

const MODOS: ReadonlyArray<{ readonly valor: ModoDeDobra; readonly rotulo: string }> = [
  { valor: 'horizontal', rotulo: 'Horizontal: a linha de dobra deitada, pelo meio da peça' },
  { valor: 'vertical', rotulo: 'Vertical: a linha de dobra em pé, pelo meio da peça' },
  { valor: 'elemento', rotulo: 'Elemento: numa linha interna reta da peça, que eu indico' },
  { valor: 'dois-pontos', rotulo: 'Dois pontos do contorno, que eu indico' },
];

/** Dois pontos do contorno a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;

export function dialogoDeDobrar(opcoes: OpcoesDeDobrar): { readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    campos: [
      { tipo: 'escolha', id: 'modo', rotulo: 'Onde passa a linha de dobra', opcoes: MODOS, inicial: opcoes.modo },
      { tipo: 'caixa', id: 'manter', rotulo: 'Manter dobra do molde: guardar a outra metade como ela é', inicial: opcoes.manter },
      { tipo: 'caixa', id: 'fioNoCentro', rotulo: 'Fio no centro do molde, ao dobrar e ao desdobrar', inicial: opcoes.fioNoCentro },
    ],
    nota: 'Depois de confirmar, clique dentro da peça, do lado que deve ficar. Sem “Manter dobra”, o “Desdobrar” devolve a outra metade espelhada — o que você mudar na metade que ficou vale para as duas. Com “Manter dobra”, a outra metade fica guardada e volta como era: use em peças que não são simétricas. O manual da referência não diz por onde passa a linha nos modos Horizontal e Vertical; aqui, pelo meio da peça.',
  };
}

export function lerDialogoDeDobrar(valores: ValoresDoDialogo): OpcoesDeDobrar {
  const modo = MODOS.find((m) => m.valor === valores.modo)?.valor ?? 'horizontal';
  return { modo, manter: valores.manter === true, fioNoCentro: valores.fioNoCentro === true };
}

/** Um clique com a ferramenta ligada: além do que todo clique traz, a linha interna da peça que está sob ele (se há). */
export interface CliqueDeDobra extends CliqueDeTrecho {
  readonly linhaInterna: number | null;
}

/**
 * As duas pontas da linha de dobra, quando já dá para saber: nos modos
 * Horizontal e Vertical, sempre; nos outros, depois dos cliques que a
 * indicam. Lança erro quando a linha do modo não serve para esta peça.
 */
function linhaDeDobra(opcoes: OpcoesDeDobrar, peca: Molde, estado: TrechoEmEdicao): readonly [PosicaoNoContorno, PosicaoNoContorno] | null {
  if (opcoes.modo === 'horizontal' || opcoes.modo === 'vertical') return dobraPeloMeio(peca, opcoes.modo);
  return estado.inicio && estado.fim ? [estado.inicio, estado.fim] : null;
}

export interface CliqueDeDobrar {
  readonly estado: TrechoEmEdicao;
  /** As peças do projeto depois do clique, quando a dobra foi feita (um passo de desfazer). */
  readonly pecas?: readonly Molde[];
  readonly recado: string | null;
}

/** O que um clique faz com o "Dobrar" ligado: indica a linha de dobra (nos modos que pedem) e, por último, o lado que fica. */
export function cliqueDeDobrar(
  opcoes: OpcoesDeDobrar,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  clique: CliqueDeDobra,
  novoId: () => string,
): CliqueDeDobrar {
  try {
    if (opcoes.modo === 'elemento' && !estado.inicio) {
      if (clique.linhaInterna === null) return { estado, recado: 'Clique em cima de uma linha interna reta da peça: ela dá a linha de dobra.' };
      const [de, ate] = dobraPelaLinhaInterna(peca, clique.linhaInterna);
      return { estado: { ...SEM_TRECHO, inicio: de, fim: ate }, recado: null };
    }
    if (opcoes.modo === 'dois-pontos' && !estado.fim) {
      const noContorno = clique.noContorno;
      if (!noContorno) return { estado, recado: null };
      if (!estado.inicio) return { estado: { ...SEM_TRECHO, inicio: noContorno }, recado: null };
      return distancia(noContorno.ponto, estado.inicio.ponto) > MESMO_PONTO_MM ? { estado: { ...estado, fim: noContorno }, recado: null } : { estado, recado: null };
    }
    const linha = linhaDeDobra(opcoes, peca, estado);
    if (!linha) return { estado, recado: null };
    const resultado = aplicarReta('dobrar', pecas, peca, { inicio: linha[0], fim: linha[1], livres: [clique.livre] }, novoId, opcoes);
    return { estado: SEM_TRECHO, pecas: resultado.pecas, recado: resultado.recado };
  } catch (e) {
    // Deu errado: a ferramenta volta a esperar a linha de dobra.
    return { estado: SEM_TRECHO, recado: e instanceof Error ? e.message : String(e) };
  }
}

/** A prévia: a linha de dobra e, com o mouse dentro da peça, o lado que sai em destaque. */
export function previaDeDobrar(
  opcoes: OpcoesDeDobrar,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeDobra | null,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  try {
    if (opcoes.modo === 'elemento' && !estado.inicio) {
      // A linha interna sob o mouse, em destaque: é a que o clique escolhe.
      const linha = mouse && mouse.linhaInterna !== null ? peca.linhasInternas[mouse.linhaInterna] : undefined;
      return linha ? { substituido: linha } : {};
    }
    if (opcoes.modo === 'dois-pontos' && !estado.fim) {
      if (!estado.inicio) return { marcas };
      const ate = mouse?.noContorno?.ponto ?? mouse?.livre ?? null;
      return { novo: ate && distancia(ate, estado.inicio.ponto) > MESMO_PONTO_MM ? [estado.inicio.ponto, ate] : null, marcas };
    }
    const linha = linhaDeDobra(opcoes, peca, estado);
    if (!linha) return { marcas };
    const novo = [linha[0].ponto, linha[1].ponto];
    if (!mouse) return { novo, marcas };
    const queSai = metadeDoMolde(peca, linha[0], linha[1], mouse.livre, 'sai').contorno;
    return { novo, substituido: [...queSai, queSai[0]!], marcas };
  } catch {
    return { marcas };
  }
}

/** A instrução do próximo clique, para a faixa de mensagens. */
export function instrucaoDeDobrar(opcoes: OpcoesDeDobrar, estado: TrechoEmEdicao): string {
  const fim = ' Esc sai.';
  const lado = `clique dentro da peça, do lado que deve ficar — o lado em destaque é o que ${opcoes.manter ? 'fica guardado' : 'sai'}.`;
  switch (opcoes.modo) {
    case 'horizontal':
      return `Dobrar (horizontal, pelo meio): ${lado}` + fim;
    case 'vertical':
      return `Dobrar (vertical, pelo meio): ${lado}` + fim;
    case 'elemento':
      return (!estado.inicio ? 'Dobrar (elemento): clique na linha interna reta que é a linha de dobra.' : `Dobrar (elemento): ${lado}`) + fim;
    case 'dois-pontos':
      if (!estado.inicio) return 'Dobrar: clique no contorno da peça selecionada, numa ponta da linha de dobra.' + fim;
      return (!estado.fim ? 'Dobrar: clique no contorno, na outra ponta da linha de dobra.' : `Dobrar: ${lado}`) + fim;
  }
}
