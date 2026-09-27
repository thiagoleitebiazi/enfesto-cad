import type { Molde } from './molde';
import { rotacaoEhPermitida } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import { area, contornosSeSobrepoem, distanciaEntreContornos, retanguloEnvolvente } from '../core/geometria';

/**
 * Módulo independente de validação geométrica (seção 7 do escopo). Opera só
 * sobre dados de domínio (Molde[], ConfiguracaoDeEnfesto) — nada de UI.
 * Tolerâncias são parâmetros explícitos, nunca hardcoded sem como ajustar.
 */

export type TipoDeProblema =
  | 'contorno-invalido'
  | 'sobreposicao'
  | 'fora-dos-limites'
  | 'espacamento-insuficiente'
  | 'rotacao-proibida'
  | 'escala-suspeita';

export type SeveridadeDoProblema = 'erro' | 'aviso';

export interface ProblemaDeValidacao {
  readonly tipo: TipoDeProblema;
  readonly severidade: SeveridadeDoProblema;
  readonly mensagem: string;
  readonly pecasEnvolvidasIds: readonly string[];
}

export interface ToleranciasDeValidacao {
  /** Peças com maior dimensão abaixo disto disparam aviso de escala suspeita (mm). */
  readonly dimensaoMinimaPlausivelMm: number;
  /** Peças com maior dimensão acima disto disparam aviso de escala suspeita (mm). */
  readonly dimensaoMaximaPlausivelMm: number;
}

export const TOLERANCIAS_PADRAO: ToleranciasDeValidacao = {
  dimensaoMinimaPlausivelMm: 5,
  dimensaoMaximaPlausivelMm: 10000,
};

function validarContornosIndividuais(pecas: readonly Molde[]): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  for (const peca of pecas) {
    if (peca.contorno.length < 3 || area(peca.contorno) <= 0) {
      problemas.push({
        tipo: 'contorno-invalido',
        severidade: 'erro',
        mensagem: `Peça "${peca.nome}": contorno inválido (menos de 3 pontos ou área zero).`,
        pecasEnvolvidasIds: [peca.id],
      });
    }
    peca.furos.forEach((furo, indice) => {
      if (furo.length < 3 || area(furo) <= 0) {
        problemas.push({
          tipo: 'contorno-invalido',
          severidade: 'erro',
          mensagem: `Peça "${peca.nome}": furo #${indice + 1} inválido (menos de 3 pontos ou área zero).`,
          pecasEnvolvidasIds: [peca.id],
        });
      }
    });
  }
  return problemas;
}

function validarSobreposicaoEEspacamento(
  pecas: readonly Molde[],
  distanciaMinimaMm: number,
): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  for (let i = 0; i < pecas.length; i++) {
    for (let j = i + 1; j < pecas.length; j++) {
      const a = pecas[i]!;
      const b = pecas[j]!;
      if (contornosSeSobrepoem(a.contorno, b.contorno)) {
        problemas.push({
          tipo: 'sobreposicao',
          severidade: 'erro',
          mensagem: `Peças "${a.nome}" e "${b.nome}" se sobrepõem.`,
          pecasEnvolvidasIds: [a.id, b.id],
        });
        continue;
      }
      if (distanciaMinimaMm > 0) {
        const d = distanciaEntreContornos(a.contorno, b.contorno);
        if (d < distanciaMinimaMm) {
          problemas.push({
            tipo: 'espacamento-insuficiente',
            severidade: 'erro',
            mensagem: `Peças "${a.nome}" e "${b.nome}" estão a ${d.toFixed(1)} mm uma da outra, abaixo do mínimo exigido (${distanciaMinimaMm} mm).`,
            pecasEnvolvidasIds: [a.id, b.id],
          });
        }
      }
    }
  }
  return problemas;
}

function validarLimitesDoTecido(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  const minX = enfesto.margemLateralMm;
  const maxX = enfesto.larguraUtilMm - enfesto.margemLateralMm;
  const minY = enfesto.margemDeExtremidadeMm;
  const maxY = enfesto.comprimentoMm - enfesto.margemDeExtremidadeMm;

  for (const peca of pecas) {
    if (peca.contorno.length === 0) continue;
    const bbox = retanguloEnvolvente(peca.contorno);
    if (bbox.minX < minX || bbox.maxX > maxX || bbox.minY < minY || bbox.maxY > maxY) {
      problemas.push({
        tipo: 'fora-dos-limites',
        severidade: 'erro',
        mensagem: `Peça "${peca.nome}" está fora da área útil do enfesto (limites: X [${minX}, ${maxX}] mm, Y [${minY}, ${maxY}] mm).`,
        pecasEnvolvidasIds: [peca.id],
      });
    }
  }
  return problemas;
}

function validarRotacoes(pecas: readonly Molde[]): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  for (const peca of pecas) {
    if (!rotacaoEhPermitida(peca.restricaoDeRotacao, peca.anguloDeRotacaoGraus)) {
      problemas.push({
        tipo: 'rotacao-proibida',
        severidade: 'erro',
        mensagem: `Peça "${peca.nome}" está rotacionada ${peca.anguloDeRotacaoGraus}°, que não é uma orientação permitida para o sentido do fio desta peça.`,
        pecasEnvolvidasIds: [peca.id],
      });
    }
  }
  return problemas;
}

function validarEscala(pecas: readonly Molde[], tolerancias: ToleranciasDeValidacao): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  for (const peca of pecas) {
    if (peca.contorno.length === 0) continue;
    const bbox = retanguloEnvolvente(peca.contorno);
    const maiorDimensao = Math.max(bbox.largura, bbox.altura);
    if (maiorDimensao < tolerancias.dimensaoMinimaPlausivelMm) {
      problemas.push({
        tipo: 'escala-suspeita',
        severidade: 'aviso',
        mensagem: `Peça "${peca.nome}" tem apenas ${maiorDimensao.toFixed(1)} mm na maior dimensão — possível problema de escala/unidade.`,
        pecasEnvolvidasIds: [peca.id],
      });
    } else if (maiorDimensao > tolerancias.dimensaoMaximaPlausivelMm) {
      problemas.push({
        tipo: 'escala-suspeita',
        severidade: 'aviso',
        mensagem: `Peça "${peca.nome}" tem ${maiorDimensao.toFixed(0)} mm na maior dimensão — possível problema de escala/unidade.`,
        pecasEnvolvidasIds: [peca.id],
      });
    }
  }
  return problemas;
}

export function validarProjeto(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto | null,
  tolerancias: ToleranciasDeValidacao = TOLERANCIAS_PADRAO,
): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [
    ...validarContornosIndividuais(pecas),
    ...validarSobreposicaoEEspacamento(pecas, enfesto?.distanciaMinimaEntrePecasMm ?? 0),
    ...validarRotacoes(pecas),
    ...validarEscala(pecas, tolerancias),
  ];
  if (enfesto) {
    problemas.push(...validarLimitesDoTecido(pecas, enfesto));
  }
  return problemas;
}

export function projetoTemErrosCriticos(problemas: readonly ProblemaDeValidacao[]): boolean {
  return problemas.some((p) => p.severidade === 'erro');
}
