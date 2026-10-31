import { retanguloEnvolvente } from '../core/geometria';
import { dimensionarMolde, transladarMolde, type Molde } from '../domain/molde';

/**
 * A proporção da impressão (ADR 0185): do tamanho da folha, por porcentagem ou por fatores de escala. Horizontal e
 * vertical são os da folha, como na tela: a horizontal é o comprimento da mesa, o y do mundo.
 */

export type ProporcaoDaImpressao = 'real' | 'folha' | 'porcentagem' | 'fatores';

export interface EscalaDaImpressao {
  readonly proporcao: ProporcaoDaImpressao;
  readonly porcentagem: number;
  readonly fatorXPorcento: number;
  readonly fatorYPorcento: number;
}

export const ESCALA_REAL: EscalaDaImpressao = { proporcao: 'real', porcentagem: 100, fatorXPorcento: 100, fatorYPorcento: 100 };

export interface FatoresDaImpressao {
  readonly horizontal: number;
  readonly vertical: number;
}

export function fatoresDaImpressao(e: EscalaDaImpressao, desenho: { readonly larguraMm: number; readonly comprimentoMm: number }, folha: { readonly largura: number; readonly altura: number }): FatoresDaImpressao {
  if (e.proporcao === 'porcentagem') return { horizontal: e.porcentagem / 100, vertical: e.porcentagem / 100 };
  if (e.proporcao === 'fatores') return { horizontal: e.fatorXPorcento / 100, vertical: e.fatorYPorcento / 100 };
  if (e.proporcao === 'folha') {
    const f = Math.min(folha.largura / desenho.comprimentoMm, folha.altura / desenho.larguraMm);
    return { horizontal: f, vertical: f };
  }
  return { horizontal: 1, vertical: 1 };
}

/** As peças na escala: cada uma muda de tamanho e o lugar dela na mesa acompanha, para o encaixe não desmanchar. */
export function pecasNaEscala(pecas: readonly Molde[], f: FatoresDaImpressao): readonly Molde[] {
  if (f.horizontal === 1 && f.vertical === 1) return pecas;
  return pecas.map((p) => {
    const c = retanguloEnvolvente(p.contorno);
    const m = dimensionarMolde(p, f.vertical, f.horizontal);
    return { ...transladarMolde(m, { x: c.minX * (f.vertical - 1), y: c.minY * (f.horizontal - 1) }, p.id), margemDeCosturaMm: p.margemDeCosturaMm * Math.min(f.vertical, f.horizontal) };
  });
}
