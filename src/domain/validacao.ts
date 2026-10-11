import type { Molde } from './molde';
import { rotacaoEhPermitida } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import { linhasQueSaem, linhasSoltas } from './linhasSoltas';
import {
  area,
  bboxesSeSobrepoem,
  contornosSeSobrepoem,
  distancia,
  distanciaEntreContornos,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  retanguloEnvolvente,
  type Contorno,
  type Ponto2D,
} from '../core/geometria';

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
  | 'escala-suspeita'
  | 'linha-solta'
  | 'linha-que-sai';

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
  /**
   * Quanto uma peça pode passar da área útil sem contar como fora dela (mm).
   * É só para o ruído das contas: girar e deslocar um lado da peça (pences,
   * pregas) pode deixar um ponto a um bilionésimo de milímetro da borda.
   */
  readonly folgaNosLimitesMm: number;
}

export const TOLERANCIAS_PADRAO: ToleranciasDeValidacao = {
  dimensaoMinimaPlausivelMm: 5,
  dimensaoMaximaPlausivelMm: 10000,
  folgaNosLimitesMm: 1e-6,
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

/**
 * Até que fundura (mm) uma peça pode entrar na outra sem as duas contarem
 * como sobrepostas. As posições que vêm do encaixe, ou de levar uma peça até
 * a vizinha, deixam as bordas juntas com um erro de conta de centésimos de
 * milímetro: uma entra na outra, mas isso é encostar. É meio décimo de
 * milímetro — abaixo do que o corte distingue.
 */
export const FUNDURA_MINIMA_DA_SOBREPOSICAO_MM = 0.05;

/** A fundura (mm) do ponto dentro do contorno: a distância dele à borda. Fora do contorno, 0. */
function fundura(p: Ponto2D, contorno: Contorno): number {
  return pontoDentroDoContorno(p, contorno) ? distancia(p, pontoMaisProximoNoContorno(p, contorno).ponto) : 0;
}

/** Em que altura do segmento p–q (de 0 a 1) ele cruza o segmento a–b; `null` se não cruza, ou se os dois correm paralelos. */
function ondeCruza(p: Ponto2D, q: Ponto2D, a: Ponto2D, b: Ponto2D): number | null {
  const [rx, ry, sx, sy] = [q.x - p.x, q.y - p.y, b.x - a.x, b.y - a.y];
  const denominador = rx * sy - ry * sx;
  if (denominador === 0) return null;
  const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / denominador;
  const u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / denominador;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/**
 * A borda de `a` entra em `b` mais fundo que `funduraMm`: algum ponto dela —
 * um canto, ou um ponto de um trecho de lado entre dois cruzamentos com a
 * borda de `b` — está dentro de `b`, a mais de `funduraMm` da borda dele.
 */
function bordaEntra(a: Contorno, b: Contorno, funduraMm: number): boolean {
  const caixaDeB = retanguloEnvolvente(b);
  for (let i = 0; i < a.length; i++) {
    const [p, q] = [a[i]!, a[(i + 1) % a.length]!];
    // O lado que não chega à caixa de `b` não entra nele: é o caso de quase todos, e sai aqui.
    if (!bboxesSeSobrepoem(retanguloEnvolvente([p, q]), caixaDeB)) continue;
    const cortes = [0, 1];
    for (let j = 0; j < b.length; j++) {
      const t = ondeCruza(p, q, b[j]!, b[(j + 1) % b.length]!);
      if (t !== null) cortes.push(t);
    }
    cortes.sort((m, n) => m - n);
    for (let k = 1; k < cortes.length; k++) {
      // O começo do trecho (no primeiro, o canto) e três pontos ao longo dele.
      for (const fracao of [0, 0.25, 0.5, 0.75]) {
        const t = cortes[k - 1]! + (cortes[k]! - cortes[k - 1]!) * fracao;
        if (fundura({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }, b) > funduraMm) return true;
      }
    }
  }
  return false;
}

/**
 * Um ponto bem de dentro do contorno: em três alturas da caixa dele, o meio
 * de cada vão de dentro — e, desses, o de maior fundura. `null` no contorno
 * sem área.
 */
function pontoDeDentro(contorno: Contorno): Ponto2D | null {
  const caixa = retanguloEnvolvente(contorno);
  let melhor: Ponto2D | null = null;
  let funduraDoMelhor = 0;
  for (const fracao of [0.25, 0.5, 0.75]) {
    const y = caixa.minY + (caixa.maxY - caixa.minY) * fracao;
    const xs: number[] = [];
    contorno.forEach((p, i) => {
      const q = contorno[(i + 1) % contorno.length]!;
      if (p.y > y !== q.y > y) xs.push(p.x + ((q.x - p.x) * (y - p.y)) / (q.y - p.y));
    });
    xs.sort((m, n) => m - n);
    for (let k = 1; k < xs.length; k += 2) {
      const candidato = { x: (xs[k - 1]! + xs[k]!) / 2, y };
      const funduraDele = fundura(candidato, contorno);
      if (funduraDele > funduraDoMelhor) [melhor, funduraDoMelhor] = [candidato, funduraDele];
    }
  }
  return melhor;
}

/**
 * Os interiores dos dois contornos têm parte em comum — o que é diferente de
 * as bordas só se tocarem. Há parte em comum quando a borda de um entra no
 * outro mais fundo que `funduraMm`, ou quando um ponto bem de dentro de um
 * está dentro do outro a mais disso (a mesma peça duas vezes no mesmo lugar:
 * as bordas correm juntas, nenhuma entra na outra, e os interiores são o
 * mesmo).
 */
export function interioresSeSobrepoem(a: Contorno, b: Contorno, funduraMm = FUNDURA_MINIMA_DA_SOBREPOSICAO_MM): boolean {
  if (bordaEntra(a, b, funduraMm) || bordaEntra(b, a, funduraMm)) return true;
  const deDentroEntra = (contorno: Contorno, outro: Contorno): boolean => {
    const deDentro = pontoDeDentro(contorno);
    return deDentro !== null && fundura(deDentro, outro) > funduraMm;
  };
  return deDentroEntra(a, b) || deDentroEntra(b, a);
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
      // As bordas se tocam ou se cruzam. Só é sobreposição se os interiores têm parte em comum: duas peças borda com
      // borda — as duas partes de um corte, por exemplo — estão encostadas, a 0 mm uma da outra, e não sobrepostas.
      const seTocam = contornosSeSobrepoem(a.contorno, b.contorno);
      if (seTocam && interioresSeSobrepoem(a.contorno, b.contorno)) {
        problemas.push({
          tipo: 'sobreposicao',
          severidade: 'erro',
          mensagem: `Peças "${a.nome}" e "${b.nome}" se sobrepõem.`,
          pecasEnvolvidasIds: [a.id, b.id],
        });
        continue;
      }
      if (distanciaMinimaMm > 0) {
        const d = seTocam ? 0 : distanciaEntreContornos(a.contorno, b.contorno);
        if (d < distanciaMinimaMm) {
          problemas.push({
            tipo: 'espacamento-insuficiente',
            severidade: 'erro',
            mensagem: seTocam
              ? `Peças "${a.nome}" e "${b.nome}" estão encostadas uma na outra; o mínimo exigido entre peças é de ${distanciaMinimaMm} mm.`
              : `Peças "${a.nome}" e "${b.nome}" estão a ${d.toFixed(1)} mm uma da outra, abaixo do mínimo exigido (${distanciaMinimaMm} mm).`,
            pecasEnvolvidasIds: [a.id, b.id],
          });
        }
      }
    }
  }
  return problemas;
}

function validarLimitesDoTecido(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, folgaMm: number): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  const minX = enfesto.margemLateralMm;
  const maxX = enfesto.larguraUtilMm - enfesto.margemLateralMm;
  const minY = enfesto.margemDeExtremidadeMm;
  const maxY = enfesto.comprimentoMm - enfesto.margemDeExtremidadeMm;

  for (const peca of pecas) {
    if (peca.contorno.length === 0) continue;
    const bbox = retanguloEnvolvente(peca.contorno);
    if (bbox.minX < minX - folgaMm || bbox.maxX > maxX + folgaMm || bbox.minY < minY - folgaMm || bbox.maxY > maxY + folgaMm) {
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

/** As peças com linha interna solta (inteira do lado de fora, longe do contorno) ou que sai da peça para bem longe. É aviso, e a faixa da validação oferece tirá-las. */
function validarLinhasSoltas(pecas: readonly Molde[]): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  for (const peca of pecas) {
    // A linha que tem parte na peça e vai para bem longe dela: uma moldura, o contorno de outra peça.
    const saem = linhasQueSaem(peca);
    if (saem.length > 0) {
      const ateOnde = Math.max(...saem.map((linha) => linha.distanciaMm));
      problemas.push({
        tipo: 'linha-que-sai',
        severidade: 'aviso',
        mensagem:
          saem.length === 1
            ? `Peça "${peca.nome}": uma linha interna sai da peça e vai até ${ateOnde.toFixed(0)} mm para fora do contorno — pode ser sobra de desenho ou de importação (uma moldura, o contorno de outra peça).`
            : `Peça "${peca.nome}": ${saem.length} linhas internas saem da peça (a que vai mais longe, até ${ateOnde.toFixed(0)} mm para fora do contorno) — podem ser sobra de desenho ou de importação.`,
        pecasEnvolvidasIds: [peca.id],
      });
    }
    const soltas = linhasSoltas(peca);
    if (soltas.length === 0) continue;
    const maisLonge = Math.max(...soltas.map((solta) => solta.distanciaMm));
    problemas.push({
      tipo: 'linha-solta',
      severidade: 'aviso',
      mensagem:
        soltas.length === 1
          ? `Peça "${peca.nome}": uma linha interna está solta, fora da peça, a ${maisLonge.toFixed(0)} mm do contorno — sobra de desenho ou de importação.`
          : `Peça "${peca.nome}": ${soltas.length} linhas internas estão soltas, fora da peça (a mais afastada, a ${maisLonge.toFixed(0)} mm do contorno) — sobra de desenho ou de importação.`,
      pecasEnvolvidasIds: [peca.id],
    });
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
    ...validarLinhasSoltas(pecas),
  ];
  if (enfesto) {
    problemas.push(...validarLimitesDoTecido(pecas, enfesto, tolerancias.folgaNosLimitesMm));
  }
  return problemas;
}

export function projetoTemErrosCriticos(problemas: readonly ProblemaDeValidacao[]): boolean {
  return problemas.some((p) => p.severidade === 'erro');
}
