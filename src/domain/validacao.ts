import type { Molde } from './molde';
import { rotacaoEhPermitida } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import { FOLGA_FORA_DA_PECA_MM, linhasQueSaem, linhasSoltas, type LinhaDeFora } from './linhasSoltas';
import {
  area,
  bboxesSeSobrepoem,
  contornosSeSobrepoem,
  distancia,
  distanciaEntreContornos,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  retanguloEnvolvente,
  trechosLongeDaBorda,
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
  /**
   * Quanto uma linha interna pode passar da borda da peça sem contar como
   * fora dela (mm): o que sobra de um traço que acaba na borda.
   */
  readonly folgaForaDaPecaMm: number;
}

export const TOLERANCIAS_PADRAO: ToleranciasDeValidacao = {
  dimensaoMinimaPlausivelMm: 5,
  dimensaoMaximaPlausivelMm: 10000,
  folgaNosLimitesMm: 1e-6,
  folgaForaDaPecaMm: FOLGA_FORA_DA_PECA_MM,
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

/** Folga da conta (mm): o ponto a menos disto da borda conta como em cima dela, mesmo com a fundura 0. */
const POEIRA_DE_CONTA_MM = 1e-9;

/**
 * A borda de `a` entra em `b` mais fundo que `funduraMm`: algum trecho dela
 * está dentro de `b`, a mais de `funduraMm` da borda dele. A conta é exata,
 * e não por pontos de amostra: os trechos de cada lado de `a` que ficam a
 * mais de `funduraMm` da borda de `b` estão, cada um, de um lado só dela —
 * e basta ver de que lado.
 */
function bordaEntra(a: Contorno, b: Contorno, funduraMm: number): boolean {
  const caixaDeB = retanguloEnvolvente(b);
  for (let i = 0; i < a.length; i++) {
    const [p, q] = [a[i]!, a[(i + 1) % a.length]!];
    // O lado que não chega à caixa de `b` não entra nele: é o caso de quase todos, e sai aqui.
    if (!bboxesSeSobrepoem(retanguloEnvolvente([p, q]), caixaDeB)) continue;
    for (const [de, ate] of trechosLongeDaBorda(p, q, b, funduraMm + POEIRA_DE_CONTA_MM)) {
      const meio = (de + ate) / 2;
      if (pontoDentroDoContorno({ x: p.x + (q.x - p.x) * meio, y: p.y + (q.y - p.y) * meio }, b)) return true;
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
 * outro mais fundo que `funduraMm` (conta exata), ou quando um ponto bem de
 * dentro de um está dentro do outro a mais disso (a mesma peça duas vezes no
 * mesmo lugar: as bordas correm juntas, nenhuma entra na outra, e os
 * interiores são o mesmo).
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

/** A distância como a lista a diz: com uma casa abaixo de 10 mm, e em milímetros inteiros daí para cima. */
function emMilimetros(mm: number): string {
  return mm < 10 ? mm.toFixed(1) : mm.toFixed(0);
}

/** No aviso de uma linha só: diz que ela é da metade que a dobra guarda — a que não aparece no desenho. */
function daDobra(linhas: readonly LinhaDeFora[]): string {
  return linhas.every((linha) => linha.naMetadeGuardada) ? ' da metade guardada pela dobra' : '';
}

/** No aviso de várias linhas: diz quantas delas são da metade que a dobra guarda. */
function quantasNaDobra(linhas: readonly LinhaDeFora[]): string {
  const quantas = linhas.filter((linha) => linha.naMetadeGuardada).length;
  return quantas === 0 ? '' : `; ${quantas} na metade guardada pela dobra`;
}

/**
 * As peças com linha interna fora delas, para lá da folga: a que sai da peça
 * (tem parte dentro) e a solta (não tem: está fora, ou corre pela borda e
 * sai). É aviso, e a faixa da validação oferece tirá-las — ou, da que sai,
 * tirar só o que está fora. Entram as linhas da metade que a dobra guarda.
 */
function validarLinhasSoltas(pecas: readonly Molde[], folgaMm: number): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  for (const peca of pecas) {
    // A linha que tem parte na peça e parte fora dela: uma moldura, o contorno de outra peça, um traço que passou da borda.
    const saem = linhasQueSaem(peca, folgaMm);
    if (saem.length > 0) {
      const ateOnde = Math.max(...saem.map((linha) => linha.distanciaMm));
      problemas.push({
        tipo: 'linha-que-sai',
        severidade: 'aviso',
        mensagem:
          saem.length === 1
            ? `Peça "${peca.nome}": uma linha interna${daDobra(saem)} sai da peça e vai até ${emMilimetros(ateOnde)} mm para fora da borda — pode ser sobra de desenho ou de importação (uma moldura, o contorno de outra peça).`
            : `Peça "${peca.nome}": ${saem.length} linhas internas saem da peça (a que vai mais longe, até ${emMilimetros(ateOnde)} mm para fora da borda${quantasNaDobra(saem)}) — podem ser sobra de desenho ou de importação.`,
        pecasEnvolvidasIds: [peca.id],
      });
    }
    const soltas = linhasSoltas(peca, folgaMm);
    if (soltas.length === 0) continue;
    const maisLonge = Math.max(...soltas.map((solta) => solta.distanciaMm));
    problemas.push({
      tipo: 'linha-solta',
      severidade: 'aviso',
      mensagem:
        soltas.length === 1
          ? `Peça "${peca.nome}": uma linha interna${daDobra(soltas)} está fora da peça, até ${emMilimetros(maisLonge)} mm da borda — sobra de desenho ou de importação.`
          : `Peça "${peca.nome}": ${soltas.length} linhas internas estão fora da peça (a mais afastada, até ${emMilimetros(maisLonge)} mm da borda${quantasNaDobra(soltas)}) — sobra de desenho ou de importação.`,
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
    ...validarLinhasSoltas(pecas, tolerancias.folgaForaDaPecaMm),
  ];
  if (enfesto) {
    problemas.push(...validarLimitesDoTecido(pecas, enfesto, tolerancias.folgaNosLimitesMm));
  }
  return problemas;
}

export function projetoTemErrosCriticos(problemas: readonly ProblemaDeValidacao[]): boolean {
  return problemas.some((p) => p.severidade === 'erro');
}
