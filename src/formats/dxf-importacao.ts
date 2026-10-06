import type { Contorno, Ponto2D } from '../core/geometria';
import { area, ponto, pontoDentroDoContorno } from '../core/geometria';
import type { LinhaDeFio } from '../domain/molde';

/**
 * Importação de DXF (seção 3 do escopo). Suporta o subconjunto de entidades
 * realmente usado para intercâmbio de moldes de vestuário: LWPOLYLINE
 * (contorno/furo/linha interna), LINE (linha de fio/linha interna), CIRCLE
 * (furo circular). POLYLINE/VERTEX clássico também é lido.
 *
 * Reconhecimento de camadas no estilo AAMA/ASTM: como não há acesso a
 * arquivos reais de terceiros para validar contra um dialeto certificado,
 * isto é heurístico e melhor-esforço — nomes de camada comuns (CONTORNO/
 * OUTLINE/BOUNDARY, FURO/HOLE, FIO/GRAIN/GRAINLINE) são reconhecidos, mas
 * nenhuma conformidade formal com a especificação AAMA é reivindicada. Ver
 * MATRIZ_DE_RISCOS.md.
 */

interface ParDeCodigo {
  readonly codigo: number;
  readonly valor: string;
}

function tokenizar(conteudo: string): ParDeCodigo[] {
  const linhas = conteudo.split(/\r\n|\r|\n/).map((l) => l.trim());
  const pares: ParDeCodigo[] = [];
  for (let i = 0; i + 1 < linhas.length; i += 2) {
    const codigoTexto = linhas[i];
    const valor = linhas[i + 1];
    if (codigoTexto === undefined || codigoTexto === '') continue;
    const codigo = Number.parseInt(codigoTexto, 10);
    if (Number.isNaN(codigo)) continue;
    pares.push({ codigo, valor: valor ?? '' });
  }
  return pares;
}

const MM_POR_UNIDADE_INSUNITS: Record<number, string> = {
  1: 'polegadas',
  2: 'pés',
  4: 'milímetros',
  5: 'centímetros',
  6: 'metros',
};

const FATOR_MM_POR_UNIDADE_INSUNITS: Record<number, number> = {
  1: 25.4,
  2: 304.8,
  4: 1,
  5: 10,
  6: 1000,
};

interface EntidadeBruta {
  readonly tipo: string;
  readonly camada: string;
  readonly pontos: Ponto2D[];
  readonly fechada: boolean;
  readonly raio?: number;
}

const AMOSTRAS_POR_VAO_DA_SPLINE = 12;
// Formas menores que isto são textos/letras desenhados como contorno, não peças.
const AREA_MINIMA_DE_CONTORNO_MM2 = 500;

function deBoor(grau: number, nos: readonly number[], ctrl: readonly Ponto2D[], pesos: readonly number[], vao: number, t: number): Ponto2D {
  const d: { x: number; y: number; w: number }[] = [];
  for (let j = 0; j <= grau; j++) {
    const indice = j + vao - grau;
    const w = pesos[indice]!;
    d.push({ x: ctrl[indice]!.x * w, y: ctrl[indice]!.y * w, w });
  }
  for (let r = 1; r <= grau; r++) {
    for (let j = grau; j >= r; j--) {
      const inicio = nos[j + vao - grau]!;
      const denominador = nos[j + 1 + vao - r]! - inicio;
      const alpha = denominador === 0 ? 0 : (t - inicio) / denominador;
      const anterior = d[j - 1]!;
      const atual = d[j]!;
      d[j] = {
        x: (1 - alpha) * anterior.x + alpha * atual.x,
        y: (1 - alpha) * anterior.y + alpha * atual.y,
        w: (1 - alpha) * anterior.w + alpha * atual.w,
      };
    }
  }
  const resultado = d[grau]!;
  return ponto(resultado.x / resultado.w, resultado.y / resultado.w);
}

/**
 * Amostra a curva NURBS da entidade SPLINE do próprio arquivo: pontos de
 * controle, nós e pesos, sem trocar a curva por uma aproximação. Devolve null
 * quando os dados não são consistentes (nós a menos, poucos pontos etc.).
 */
function amostrarSpline(grau: number, nos: readonly number[], ctrl: readonly Ponto2D[], pesosLidos: readonly number[]): Ponto2D[] | null {
  const n = ctrl.length - 1;
  if (grau < 1 || n < grau || nos.length !== n + grau + 2) return null;
  const pesos = pesosLidos.length === ctrl.length ? pesosLidos : ctrl.map(() => 1);
  const pontos: Ponto2D[] = [];
  for (let vao = grau; vao <= n; vao++) {
    const t0 = nos[vao]!;
    const t1 = nos[vao + 1]!;
    if (!(t1 > t0)) continue;
    for (let s = 0; s < AMOSTRAS_POR_VAO_DA_SPLINE; s++) {
      pontos.push(deBoor(grau, nos, ctrl, pesos, vao, t0 + ((t1 - t0) * s) / AMOSTRAS_POR_VAO_DA_SPLINE));
    }
  }
  pontos.push(deBoor(grau, nos, ctrl, pesos, n, nos[n + 1]!));
  return pontos;
}

function lerEntidades(pares: ParDeCodigo[]): EntidadeBruta[] {
  const entidades: EntidadeBruta[] = [];
  let dentroDeEntities = false;
  let i = 0;

  while (i < pares.length) {
    const par = pares[i]!;
    if (par.codigo === 2 && par.valor === 'ENTITIES') {
      dentroDeEntities = true;
      i++;
      continue;
    }
    if (par.codigo === 0 && par.valor === 'ENDSEC') {
      dentroDeEntities = false;
      i++;
      continue;
    }
    if (!dentroDeEntities || par.codigo !== 0) {
      i++;
      continue;
    }

    const tipo = par.valor;
    if (tipo === 'LWPOLYLINE') {
      let camada = '0';
      let fechada = false;
      const pontos: Ponto2D[] = [];
      let xPendente: number | null = null;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 70) fechada = (Number.parseInt(p.valor, 10) & 1) === 1;
        else if (p.codigo === 10) xPendente = Number.parseFloat(p.valor);
        else if (p.codigo === 20 && xPendente !== null) {
          pontos.push(ponto(xPendente, Number.parseFloat(p.valor)));
          xPendente = null;
        }
        i++;
      }
      entidades.push({ tipo, camada, pontos, fechada });
      continue;
    }

    if (tipo === 'LINE') {
      let camada = '0';
      let x1 = 0;
      let y1 = 0;
      let x2 = 0;
      let y2 = 0;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 10) x1 = Number.parseFloat(p.valor);
        else if (p.codigo === 20) y1 = Number.parseFloat(p.valor);
        else if (p.codigo === 11) x2 = Number.parseFloat(p.valor);
        else if (p.codigo === 21) y2 = Number.parseFloat(p.valor);
        i++;
      }
      entidades.push({ tipo, camada, pontos: [ponto(x1, y1), ponto(x2, y2)], fechada: false });
      continue;
    }

    if (tipo === 'CIRCLE') {
      let camada = '0';
      let cx = 0;
      let cy = 0;
      let raio = 0;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 10) cx = Number.parseFloat(p.valor);
        else if (p.codigo === 20) cy = Number.parseFloat(p.valor);
        else if (p.codigo === 40) raio = Number.parseFloat(p.valor);
        i++;
      }
      const segmentos = 32;
      const pontos: Ponto2D[] = [];
      for (let s = 0; s < segmentos; s++) {
        const angulo = (2 * Math.PI * s) / segmentos;
        pontos.push(ponto(cx + raio * Math.cos(angulo), cy + raio * Math.sin(angulo)));
      }
      entidades.push({ tipo, camada, pontos, fechada: true, raio });
      continue;
    }

    if (tipo === 'POLYLINE') {
      let camada = '0';
      let fechada = false;
      const pontos: Ponto2D[] = [];
      i++;
      // Cabeçalho da POLYLINE: muitos exportadores declaram a camada (código
      // 8) só aqui, sem repeti-la em cada VERTEX — precisa ser lida, não só
      // pulada, ou a peça inteira perde a classificação de camada quando os
      // VERTEX não repetem o código 8.
      while (i < pares.length && pares[i]!.codigo !== 0) {
        if (pares[i]!.codigo === 8) camada = pares[i]!.valor;
        i++;
      }
      while (i < pares.length && pares[i]!.valor === 'VERTEX') {
        i++;
        let x = 0;
        let y = 0;
        while (i < pares.length && pares[i]!.codigo !== 0) {
          const p = pares[i]!;
          if (p.codigo === 8) camada = p.valor;
          else if (p.codigo === 10) x = Number.parseFloat(p.valor);
          else if (p.codigo === 20) y = Number.parseFloat(p.valor);
          i++;
        }
        pontos.push(ponto(x, y));
      }
      if (i < pares.length && pares[i]!.valor === 'SEQEND') {
        i++;
        while (i < pares.length && pares[i]!.codigo !== 0) i++;
      }
      fechada = true; // convenção adotada: POLYLINE clássica de molde é sempre fechada
      entidades.push({ tipo: 'LWPOLYLINE', camada, pontos, fechada });
      continue;
    }

    if (tipo === 'SPLINE') {
      let camada = '0';
      let flags = 0;
      let grau = 3;
      const nos: number[] = [];
      const pesos: number[] = [];
      const controle: Ponto2D[] = [];
      let xControle: number | null = null;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 70) flags = Number.parseInt(p.valor, 10);
        else if (p.codigo === 71) grau = Number.parseInt(p.valor, 10);
        else if (p.codigo === 40) nos.push(Number.parseFloat(p.valor));
        else if (p.codigo === 41) pesos.push(Number.parseFloat(p.valor));
        else if (p.codigo === 10) xControle = Number.parseFloat(p.valor);
        else if (p.codigo === 20 && xControle !== null) {
          controle.push(ponto(xControle, Number.parseFloat(p.valor)));
          xControle = null;
        }
        i++;
      }
      const amostra = amostrarSpline(grau, nos, controle, pesos);
      const fechada = (flags & 1) === 1;
      entidades.push({ tipo: 'SPLINE', camada, pontos: amostra ?? [], fechada });
      continue;
    }

    i++;
  }

  return entidades;
}

function lerUnidade(pares: ParDeCodigo[]): { fator: number; rotulo: string; assumida: boolean } {
  for (let i = 0; i < pares.length; i++) {
    if (pares[i]!.codigo === 9 && pares[i]!.valor === '$INSUNITS') {
      const seguinte = pares[i + 1];
      if (seguinte && seguinte.codigo === 70) {
        const codigo = Number.parseInt(seguinte.valor, 10);
        const fator = FATOR_MM_POR_UNIDADE_INSUNITS[codigo];
        const rotulo = MM_POR_UNIDADE_INSUNITS[codigo];
        if (fator !== undefined && rotulo !== undefined) {
          return { fator, rotulo, assumida: false };
        }
        return { fator: 1, rotulo: `desconhecida (código INSUNITS ${codigo}, assumido mm)`, assumida: true };
      }
    }
  }
  return { fator: 1, rotulo: 'não declarada no arquivo (assumido mm)', assumida: true };
}

function nomeDeCamadaContem(camada: string, ...termos: string[]): boolean {
  const c = camada.toUpperCase();
  return termos.some((t) => c.includes(t));
}

export interface PecaImportadaDxf {
  readonly nome: string;
  readonly contorno: Contorno;
  readonly furos: Contorno[];
  readonly linhasInternas: Contorno[];
  readonly linhaDeFio: LinhaDeFio | null;
}

export interface ResultadoImportacaoDxf {
  readonly pecas: PecaImportadaDxf[];
  readonly unidadeDetectada: string;
  readonly unidadeAssumida: boolean;
  readonly avisos: string[];
}

interface CaixaDeDelimitacao {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function caixaDe(pontos: readonly Ponto2D[]): CaixaDeDelimitacao {
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Borda da folha: um retângulo de 4 vértices que cobre quase todo o desenho e
 * contém outras formas fechadas. Só é reconhecido se houver de fato formas
 * dentro dele, para não descartar uma peça única.
 */
/** Forma inteira dentro de outra: caixa contida e primeiro ponto dentro do contorno externo. */
function estaDentroDe(forma: EntidadeBruta, externa: EntidadeBruta): boolean {
  const a = caixaDe(forma.pontos);
  const b = caixaDe(externa.pontos);
  const dentroDaCaixa = a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;
  return dentroDaCaixa && pontoDentroDoContorno(forma.pontos[0]!, externa.pontos);
}

function ehBordaDaFolha(entidade: EntidadeBruta, formasFechadas: readonly EntidadeBruta[]): boolean {
  if (formasFechadas.length < 3) return false;
  if (nomeDeCamadaContem(entidade.camada, 'CONTORNO', 'OUTLINE', 'BOUNDARY', 'CORTE', 'CUT')) return false;
  const caixa = caixaDe(entidade.pontos);
  const todas = formasFechadas.map((e) => caixaDe(e.pontos));
  const alcanceX = Math.max(...todas.map((c) => c.maxX)) - Math.min(...todas.map((c) => c.minX));
  const alcanceY = Math.max(...todas.map((c) => c.maxY)) - Math.min(...todas.map((c) => c.minY));
  const cobreODesenho =
    caixa.maxX - caixa.minX >= alcanceX * 0.9 && caixa.maxY - caixa.minY >= alcanceY * 0.9;
  if (!cobreODesenho) return false;
  const contidasNaoFuros = formasFechadas.filter(
    (outra) => outra !== entidade && !nomeDeCamadaContem(outra.camada, 'FURO', 'HOLE') && estaDentroDe(outra, entidade),
  );
  return contidasNaoFuros.length >= 2;
}

export function importarDxf(conteudo: string, nomeArquivoSemExtensao: string): ResultadoImportacaoDxf {
  const pares = tokenizar(conteudo);
  const unidade = lerUnidade(pares);
  const entidadesMm = lerEntidades(pares).map((e) => ({
    ...e,
    pontos: e.pontos.map((p) => ponto(p.x * unidade.fator, p.y * unidade.fator)),
  }));

  const avisos: string[] = [];

  const poligonosFechados = entidadesMm.filter((e) => e.tipo !== 'LINE' && e.pontos.length >= 3);
  const formasFechadas = poligonosFechados.filter((e) => e.fechada);
  const bordas = formasFechadas.filter((e) => ehBordaDaFolha(e, formasFechadas));
  const contornosFechados = formasFechadas.filter((e) => !bordas.includes(e));
  if (bordas.length > 0) {
    avisos.push(
      `${bordas.length} retângulo(s) que envolve(m) o desenho inteiro foi(ram) ignorado(s) como borda da folha, não como peça.`,
    );
  }
  const contornosCandidatos = contornosFechados.filter((e) =>
    nomeDeCamadaContem(e.camada, 'CONTORNO', 'OUTLINE', 'BOUNDARY', 'CORTE', 'CUT'),
  );

  let contornos = contornosCandidatos;
  if (contornos.length === 0 && contornosFechados.length > 0) {
    contornos = contornosFechados.filter(
      (e) =>
        !nomeDeCamadaContem(e.camada, 'FURO', 'HOLE') &&
        area(e.pontos) >= AREA_MINIMA_DE_CONTORNO_MM2 &&
        !contornosFechados.some((outra) => outra !== e && estaDentroDe(e, outra)),
    );
    if (contornos.length > 0) {
      avisos.push(
        `Nenhuma camada de contorno reconhecida (ex.: "CONTORNO"/"OUTLINE"); ${contornos.length} forma(s) fechada(s) de fora foram tratadas como contornos candidatos. Confirme cada uma antes de importar.`,
      );
    }
  }

  if (contornos.length === 0) {
    avisos.push('Nenhuma polilinha fechada encontrada no arquivo — nenhuma peça pôde ser importada.');
    return { pecas: [], unidadeDetectada: unidade.rotulo, unidadeAssumida: unidade.assumida, avisos };
  }

  const furosCandidatos = poligonosFechados.filter(
    (e) => !contornos.includes(e) && nomeDeCamadaContem(e.camada, 'FURO', 'HOLE'),
  );
  const internasCandidatas = poligonosFechados.filter(
    (e) => !contornos.includes(e) && !furosCandidatos.includes(e),
  );
  const linhasDeFioCandidatas = entidadesMm.filter(
    (e) => e.tipo === 'LINE' && nomeDeCamadaContem(e.camada, 'FIO', 'GRAIN'),
  );
  const outrasLinhas = entidadesMm.filter((e) => e.tipo === 'LINE' && !linhasDeFioCandidatas.includes(e));

  if (outrasLinhas.length > 0) {
    avisos.push(
      `${outrasLinhas.length} entidade(s) LINE fora de camadas de fio reconhecidas foram ignoradas (não classificadas como linha interna nem linha de fio).`,
    );
  }

  const pecas: PecaImportadaDxf[] = contornos.map((contornoEntidade, indice) => {
    const contorno = contornoEntidade.pontos;
    const furosDaPeca = furosCandidatos
      .filter((f) => f.pontos.length > 0 && pontoDentroDoContorno(f.pontos[0]!, contorno))
      .map((f) => f.pontos);
    const internasDaPeca = internasCandidatas
      .filter((linha) => linha.pontos.length > 0 && pontoDentroDoContorno(linha.pontos[0]!, contorno))
      .map((linha) => linha.pontos);
    const fioDaPeca = linhasDeFioCandidatas.find((linha) => {
      const meio = ponto((linha.pontos[0]!.x + linha.pontos[1]!.x) / 2, (linha.pontos[0]!.y + linha.pontos[1]!.y) / 2);
      return pontoDentroDoContorno(meio, contorno);
    });

    if (!fioDaPeca) {
      avisos.push(
        `Peça ${indice + 1} (camada "${contornoEntidade.camada}") não tem linha de fio reconhecível no arquivo — defina manualmente antes de finalizar a importação (regra crítica da seção 5, nunca presumida automaticamente).`,
      );
    }

    return {
      nome: contornos.length === 1 ? nomeArquivoSemExtensao : `${nomeArquivoSemExtensao}-${indice + 1}`,
      contorno,
      furos: furosDaPeca,
      linhasInternas: internasDaPeca,
      linhaDeFio: fioDaPeca ? { inicio: fioDaPeca.pontos[0]!, fim: fioDaPeca.pontos[1]! } : null,
    };
  });

  return { pecas, unidadeDetectada: unidade.rotulo, unidadeAssumida: unidade.assumida, avisos };
}
