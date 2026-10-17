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

/** Um INSERT: o bloco `nome` posto no desenho, com o ponto de inserção, a escala e o giro. */
interface InsercaoDeBloco {
  readonly nome: string;
  readonly camada: string;
  readonly ponto: Ponto2D;
  readonly escalaX: number;
  readonly escalaY: number;
  readonly rotacaoGraus: number;
}

/** Um BLOCK da seção BLOCKS: o ponto-base e o que ele desenha (inclusive outros blocos inseridos nele). */
interface Bloco {
  readonly base: Ponto2D;
  readonly entidades: readonly EntidadeBruta[];
  readonly insercoes: readonly InsercaoDeBloco[];
}

/** Passo máximo, em graus, entre dois pontos de um arco lido do arquivo. */
const GRAUS_POR_PONTO_DO_ARCO = 5;
/** Blocos dentro de blocos: além disto, o arquivo é tratado como circular (um bloco que insere a si mesmo). */
const PROFUNDIDADE_MAXIMA_DE_BLOCOS = 8;

/** Os pontos de dentro de um arco (sem as duas pontas), de `angulo0` varrendo `varredura` radianos em volta de `centro`. */
function pontosDoArco(centro: Ponto2D, raio: number, angulo0: number, varredura: number): Ponto2D[] {
  const passos = Math.max(2, Math.ceil(Math.abs(varredura) / ((GRAUS_POR_PONTO_DO_ARCO * Math.PI) / 180)));
  const pontos: Ponto2D[] = [];
  for (let k = 1; k < passos; k++) {
    const angulo = angulo0 + (varredura * k) / passos;
    pontos.push(ponto(centro.x + raio * Math.cos(angulo), centro.y + raio * Math.sin(angulo)));
  }
  return pontos;
}

/**
 * O trecho entre dois vértices de polilinha com "bulge" (código 42) é um arco: o bulge é a tangente de um
 * quarto do ângulo do arco e, positivo, o arco gira no sentido anti-horário. Devolve os pontos de dentro do
 * arco. Antes o bulge era ignorado, e o arco (um decote, uma cava) virava a reta entre os dois vértices.
 */
function arcoDoBulge(a: Ponto2D, b: Ponto2D, bulge: number): Ponto2D[] {
  const cx = b.x - a.x;
  const cy = b.y - a.y;
  const d = Math.hypot(cx, cy);
  if (bulge === 0 || !Number.isFinite(bulge) || d === 0) return [];
  const angulo = 4 * Math.atan(bulge);
  const raio = d / (2 * Math.abs(Math.sin(angulo / 2)));
  // O centro fica na perpendicular ao meio da corda, à esquerda dela quando o arco é anti-horário.
  const h = d / 2 / Math.tan(angulo / 2);
  const centro = ponto((a.x + b.x) / 2 - (cy / d) * h, (a.y + b.y) / 2 + (cx / d) * h);
  return pontosDoArco(centro, raio, Math.atan2(a.y - centro.y, a.x - centro.x), angulo);
}

/** Os vértices de uma polilinha, com os arcos dos bulges entre eles. */
function comOsArcos(vertices: readonly Ponto2D[], bulges: readonly number[], fechada: boolean): Ponto2D[] {
  if (!bulges.some((b) => b !== 0)) return [...vertices];
  const pontos: Ponto2D[] = [];
  vertices.forEach((v, i) => {
    pontos.push(v);
    const proximo = i + 1 < vertices.length ? vertices[i + 1] : fechada ? vertices[0] : undefined;
    if (proximo) pontos.push(...arcoDoBulge(v, proximo, bulges[i] ?? 0));
  });
  return pontos;
}

/** O começo e o fim (o ENDSEC) de uma seção do arquivo, ou `null` se ela não existe. */
function secao(pares: readonly ParDeCodigo[], nome: string): readonly [number, number] | null {
  for (let k = 0; k < pares.length; k++) {
    const par = pares[k]!;
    if (par.codigo !== 2 || par.valor !== nome) continue;
    const anterior = pares[k - 1];
    if (anterior && !(anterior.codigo === 0 && anterior.valor === 'SECTION')) continue;
    let fim = k + 1;
    while (fim < pares.length && !(pares[fim]!.codigo === 0 && pares[fim]!.valor === 'ENDSEC')) fim++;
    return [k + 1, fim];
  }
  return null;
}

/** As entidades entre `inicio` e `fim`, e os blocos inseridos ali (os INSERT), sem expandir. */
function lerEntidadesEntre(
  pares: readonly ParDeCodigo[],
  inicio: number,
  fim: number,
): { entidades: EntidadeBruta[]; insercoes: InsercaoDeBloco[] } {
  const entidades: EntidadeBruta[] = [];
  const insercoes: InsercaoDeBloco[] = [];
  let i = inicio;

  while (i < fim) {
    const par = pares[i]!;
    if (par.codigo !== 0) {
      i++;
      continue;
    }

    const tipo = par.valor;
    if (tipo === 'LWPOLYLINE') {
      let camada = '0';
      let fechada = false;
      const vertices: Ponto2D[] = [];
      const bulges: number[] = [];
      let xPendente: number | null = null;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 70) fechada = (Number.parseInt(p.valor, 10) & 1) === 1;
        else if (p.codigo === 10) xPendente = Number.parseFloat(p.valor);
        else if (p.codigo === 20 && xPendente !== null) {
          vertices.push(ponto(xPendente, Number.parseFloat(p.valor)));
          bulges.push(0);
          xPendente = null;
        } else if (p.codigo === 42 && vertices.length > 0) bulges[vertices.length - 1] = Number.parseFloat(p.valor);
        i++;
      }
      entidades.push({ tipo, camada, pontos: comOsArcos(vertices, bulges, fechada), fechada });
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

    if (tipo === 'ARC') {
      // O arco solto (antes ignorado): do ângulo inicial ao final, no sentido anti-horário, em graus.
      let camada = '0';
      let cx = 0;
      let cy = 0;
      let raio = 0;
      let de = 0;
      let ate = 360;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 10) cx = Number.parseFloat(p.valor);
        else if (p.codigo === 20) cy = Number.parseFloat(p.valor);
        else if (p.codigo === 40) raio = Number.parseFloat(p.valor);
        else if (p.codigo === 50) de = Number.parseFloat(p.valor);
        else if (p.codigo === 51) ate = Number.parseFloat(p.valor);
        i++;
      }
      let varredura = (((ate - de) % 360) + 360) % 360;
      if (varredura === 0) varredura = 360;
      const inicioRad = (de * Math.PI) / 180;
      const varreduraRad = (varredura * Math.PI) / 180;
      const centro = ponto(cx, cy);
      const naPonta = (a: number): Ponto2D => ponto(cx + raio * Math.cos(a), cy + raio * Math.sin(a));
      if (raio > 0) {
        entidades.push({
          tipo,
          camada,
          pontos: [naPonta(inicioRad), ...pontosDoArco(centro, raio, inicioRad, varreduraRad), naPonta(inicioRad + varreduraRad)],
          fechada: false,
        });
      }
      continue;
    }

    if (tipo === 'INSERT') {
      let camada = '0';
      let nome = '';
      let x = 0;
      let y = 0;
      let escalaX = 1;
      let escalaY = 1;
      let rotacaoGraus = 0;
      i++;
      while (i < pares.length && pares[i]!.codigo !== 0) {
        const p = pares[i]!;
        if (p.codigo === 8) camada = p.valor;
        else if (p.codigo === 2) nome = p.valor;
        else if (p.codigo === 10) x = Number.parseFloat(p.valor);
        else if (p.codigo === 20) y = Number.parseFloat(p.valor);
        else if (p.codigo === 41) escalaX = Number.parseFloat(p.valor);
        else if (p.codigo === 42) escalaY = Number.parseFloat(p.valor);
        else if (p.codigo === 50) rotacaoGraus = Number.parseFloat(p.valor);
        i++;
      }
      insercoes.push({ nome, camada, ponto: ponto(x, y), escalaX, escalaY, rotacaoGraus });
      continue;
    }

    if (tipo === 'POLYLINE') {
      let camada = '0';
      const vertices: Ponto2D[] = [];
      const bulges: number[] = [];
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
        let bulge = 0;
        while (i < pares.length && pares[i]!.codigo !== 0) {
          const p = pares[i]!;
          if (p.codigo === 8) camada = p.valor;
          else if (p.codigo === 10) x = Number.parseFloat(p.valor);
          else if (p.codigo === 20) y = Number.parseFloat(p.valor);
          else if (p.codigo === 42) bulge = Number.parseFloat(p.valor);
          i++;
        }
        vertices.push(ponto(x, y));
        bulges.push(bulge);
      }
      if (i < pares.length && pares[i]!.valor === 'SEQEND') {
        i++;
        while (i < pares.length && pares[i]!.codigo !== 0) i++;
      }
      // convenção adotada: POLYLINE clássica de molde é sempre fechada
      entidades.push({ tipo: 'LWPOLYLINE', camada, pontos: comOsArcos(vertices, bulges, true), fechada: true });
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

  return { entidades, insercoes };
}

/** Os blocos da seção BLOCKS, pelo nome (em maiúsculas: o DXF não diferencia). */
function lerBlocos(pares: readonly ParDeCodigo[]): Map<string, Bloco> {
  const blocos = new Map<string, Bloco>();
  const limites = secao(pares, 'BLOCKS');
  if (!limites) return blocos;
  const [inicio, fim] = limites;
  let i = inicio;
  while (i < fim) {
    if (!(pares[i]!.codigo === 0 && pares[i]!.valor === 'BLOCK')) {
      i++;
      continue;
    }
    let nome = '';
    let bx = 0;
    let by = 0;
    i++;
    while (i < fim && pares[i]!.codigo !== 0) {
      const p = pares[i]!;
      if (p.codigo === 2) nome = p.valor;
      else if (p.codigo === 10) bx = Number.parseFloat(p.valor);
      else if (p.codigo === 20) by = Number.parseFloat(p.valor);
      i++;
    }
    let fimDoBloco = i;
    while (fimDoBloco < fim && !(pares[fimDoBloco]!.codigo === 0 && pares[fimDoBloco]!.valor === 'ENDBLK')) fimDoBloco++;
    const lidas = lerEntidadesEntre(pares, i, fimDoBloco);
    blocos.set(nome.toUpperCase(), { base: ponto(bx, by), entidades: lidas.entidades, insercoes: lidas.insercoes });
    i = fimDoBloco + 1;
  }
  return blocos;
}

/**
 * O que um INSERT desenha: as entidades do bloco levadas pela escala, pelo giro e pelo ponto de inserção (e os
 * blocos inseridos dentro dele, do mesmo jeito). O que está na camada "0" do bloco fica na camada do INSERT,
 * como no AutoCAD.
 */
function expandirInsercao(insercao: InsercaoDeBloco, blocos: ReadonlyMap<string, Bloco>, profundidade: number): EntidadeBruta[] {
  const bloco = blocos.get(insercao.nome.toUpperCase());
  if (!bloco || profundidade > PROFUNDIDADE_MAXIMA_DE_BLOCOS) return [];
  const angulo = (insercao.rotacaoGraus * Math.PI) / 180;
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  const levar = (p: Ponto2D): Ponto2D => {
    const x = (p.x - bloco.base.x) * insercao.escalaX;
    const y = (p.y - bloco.base.y) * insercao.escalaY;
    return ponto(insercao.ponto.x + x * cos - y * sin, insercao.ponto.y + x * sin + y * cos);
  };
  const doBloco = [...bloco.entidades, ...bloco.insercoes.flatMap((dentro) => expandirInsercao(dentro, blocos, profundidade + 1))];
  return doBloco.map((e) => ({
    ...e,
    camada: e.camada === '0' ? insercao.camada : e.camada,
    pontos: e.pontos.map(levar),
    ...(e.raio !== undefined ? { raio: e.raio * Math.abs(insercao.escalaX) } : {}),
  }));
}

/**
 * As entidades do desenho: as da seção ENTITIES e, no lugar de cada INSERT, o que o bloco desenha. É assim
 * que os arquivos de molde no padrão AAMA/ASTM guardam as peças — cada uma num bloco —, e antes elas não
 * eram lidas.
 */
function lerEntidades(pares: ParDeCodigo[]): EntidadeBruta[] {
  const limites = secao(pares, 'ENTITIES');
  if (!limites) return [];
  const { entidades, insercoes } = lerEntidadesEntre(pares, limites[0], limites[1]);
  if (insercoes.length === 0) return entidades;
  const blocos = lerBlocos(pares);
  return [...entidades, ...insercoes.flatMap((insercao) => expandirInsercao(insercao, blocos, 0))];
}

/** Pontas a menos disto (mm) são a mesma ponta, ao encadear linhas e arcos soltos. */
const MESMA_PONTA_MM = 0.01;

/**
 * Linhas, arcos e polilinhas abertas da mesma camada que se encadeiam ponta com ponta até fechar viram uma
 * polilinha fechada: o contorno desenhado em pedaços (comum em DXF feito no AutoCAD), que antes não era
 * reconhecido como peça. Só passa por pontas em que se encontram exatamente dois pedaços: numa
 * bifurcação não há como saber o caminho, e os pedaços ficam como estão.
 */
function encadearPedacosSoltos(entidades: readonly EntidadeBruta[]): { fechadas: EntidadeBruta[]; usadas: Set<EntidadeBruta> } {
  const chave = (p: Ponto2D): string => `${Math.round(p.x / MESMA_PONTA_MM)},${Math.round(p.y / MESMA_PONTA_MM)}`;
  const pedacos = entidades.filter((e) => !e.fechada && e.pontos.length >= 2 && (e.tipo === 'LINE' || e.tipo === 'ARC' || e.tipo === 'LWPOLYLINE' || e.tipo === 'SPLINE'));
  const fechadas: EntidadeBruta[] = [];
  const usadas = new Set<EntidadeBruta>();
  const porCamada = new Map<string, EntidadeBruta[]>();
  for (const e of pedacos) porCamada.set(e.camada, [...(porCamada.get(e.camada) ?? []), e]);

  for (const [camada, daCamada] of porCamada) {
    const naPonta = new Map<string, EntidadeBruta[]>();
    for (const e of daCamada) {
      for (const p of [e.pontos[0]!, e.pontos.at(-1)!]) naPonta.set(chave(p), [...(naPonta.get(chave(p)) ?? []), e]);
    }
    const livres = new Set(daCamada);
    for (const primeiro of daCamada) {
      if (!livres.has(primeiro)) continue;
      const inicio = chave(primeiro.pontos[0]!);
      let ponta = chave(primeiro.pontos.at(-1)!);
      if (ponta === inicio) continue;
      const cadeia: (readonly Ponto2D[])[] = [primeiro.pontos];
      const usadosAqui = [primeiro];
      let fechou = false;
      for (;;) {
        if (ponta === inicio) {
          fechou = true;
          break;
        }
        const ali = naPonta.get(ponta) ?? [];
        if (ali.length !== 2) break;
        const seguinte = ali.find((e) => e !== usadosAqui.at(-1));
        if (!seguinte || !livres.has(seguinte) || usadosAqui.includes(seguinte)) break;
        const orientado = chave(seguinte.pontos[0]!) === ponta ? seguinte.pontos : [...seguinte.pontos].reverse();
        cadeia.push(orientado);
        usadosAqui.push(seguinte);
        ponta = chave(orientado.at(-1)!);
      }
      if (!fechou || cadeia.length < 2 || (naPonta.get(inicio) ?? []).length !== 2) continue;
      const pontos = cadeia.flatMap((pedaco) => pedaco.slice(0, -1));
      if (pontos.length < 3 || area(pontos) <= 0) continue;
      for (const e of usadosAqui) {
        livres.delete(e);
        usadas.add(e);
      }
      fechadas.push({ tipo: 'LWPOLYLINE', camada, pontos, fechada: true });
    }
  }
  return { fechadas, usadas };
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

/** Forma inteira dentro de outra: caixa contida e primeiro ponto dentro do contorno externo. */
function estaDentroDe(forma: EntidadeBruta, externa: EntidadeBruta): boolean {
  const a = caixaDe(forma.pontos);
  const b = caixaDe(externa.pontos);
  const dentroDaCaixa = a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;
  return dentroDaCaixa && pontoDentroDoContorno(forma.pontos[0]!, externa.pontos);
}

/**
 * Borda da folha: uma forma fechada, fora das camadas de contorno, que cobre
 * quase todo o desenho e contém outras formas fechadas (no arquivo de teste,
 * uma SPLINE fechada em volta de todas as peças). Só é reconhecida se houver
 * de fato formas dentro dela, para não descartar uma peça única.
 */
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
  const lidasMm = lerEntidades(pares).map((e) => ({
    ...e,
    pontos: e.pontos.map((p) => ponto(p.x * unidade.fator, p.y * unidade.fator)),
  }));

  const avisos: string[] = [];
  const { fechadas: encadeadas, usadas } = encadearPedacosSoltos(lidasMm);
  const entidadesMm = [...lidasMm.filter((e) => !usadas.has(e)), ...encadeadas];
  if (encadeadas.length > 0) {
    avisos.push(
      `${encadeadas.length} contorno(s) desenhado(s) em pedaços (linhas e arcos soltos, ponta com ponta) foi(ram) juntado(s) num contorno fechado.`,
    );
  }

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

  // A borda da folha fica fora de tudo: sem isso ela virava linha interna da
  // peça que encosta no canto dela (o primeiro ponto da borda cai "dentro"
  // dessa peça), apesar do aviso de que foi ignorada.
  const furosCandidatos = poligonosFechados.filter(
    (e) => !contornos.includes(e) && !bordas.includes(e) && nomeDeCamadaContem(e.camada, 'FURO', 'HOLE'),
  );
  const internasCandidatas = poligonosFechados.filter(
    (e) => !contornos.includes(e) && !bordas.includes(e) && !furosCandidatos.includes(e),
  );
  const linhasDeFioCandidatas = entidadesMm.filter(
    (e) => e.tipo === 'LINE' && nomeDeCamadaContem(e.camada, 'FIO', 'GRAIN'),
  );
  // As retas soltas (LINE, ou polilinha aberta de dois pontos) que não são linha de fio: dentro de uma peça,
  // são linhas internas dela, como a janela de importação diz. Antes eram todas descartadas — a linha de
  // posição do bolso, o centro da frente sumiam.
  const meioDa = (e: EntidadeBruta): Ponto2D =>
    ponto((e.pontos[0]!.x + e.pontos.at(-1)!.x) / 2, (e.pontos[0]!.y + e.pontos.at(-1)!.y) / 2);
  const retasSoltas = entidadesMm.filter((e) => !e.fechada && e.pontos.length === 2 && !linhasDeFioCandidatas.includes(e));
  const retasDeFora = retasSoltas.filter((e) => !contornos.some((c) => pontoDentroDoContorno(meioDa(e), c.pontos)));
  if (retasDeFora.length > 0) {
    avisos.push(`${retasDeFora.length} linha(s) reta(s) fora das peças foram ignoradas.`);
  }

  const pecas: PecaImportadaDxf[] = contornos.map((contornoEntidade, indice) => {
    const contorno = contornoEntidade.pontos;
    const furosDaPeca = furosCandidatos
      .filter((f) => f.pontos.length > 0 && pontoDentroDoContorno(f.pontos[0]!, contorno))
      .map((f) => f.pontos);
    const internasDaPeca = [
      ...internasCandidatas.filter((linha) => linha.pontos.length > 0 && pontoDentroDoContorno(linha.pontos[0]!, contorno)),
      ...retasSoltas.filter((reta) => pontoDentroDoContorno(meioDa(reta), contorno)),
    ].map((linha) => linha.pontos);
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

/**
 * Altura do desenho em coordenadas do DXF (y para cima), usada para virar o
 * eixo vertical como na página do PDF.
 */
export function alturaDoDesenho(resultado: ResultadoImportacaoDxf): number {
  let maximo = Number.NEGATIVE_INFINITY;
  for (const peca of resultado.pecas) {
    const todos = [peca.contorno, ...peca.furos, ...peca.linhasInternas];
    for (const contorno of todos) for (const p of contorno) maximo = Math.max(maximo, p.y);
    if (peca.linhaDeFio) maximo = Math.max(maximo, peca.linhaDeFio.inicio.y, peca.linhaDeFio.fim.y);
  }
  return Number.isFinite(maximo) ? maximo : 0;
}

/**
 * Converte um ponto do DXF para a tela do app, do mesmo modo que o PDF:
 * o eixo x do arquivo vai para a horizontal, e o y (invertido) para a vertical.
 */
export function dxfParaMundo(p: Ponto2D, alturaDoDesenhoDxf: number): Ponto2D {
  return ponto(alturaDoDesenhoDxf - p.y, p.x);
}

/**
 * Direção, na tela do app, de uma linha de fio lida do DXF (coordenadas do
 * arquivo). Como em dxfParaMundo, o x do DXF vai para a horizontal da tela e
 * o y para a vertical; uma linha inclinada fica com o eixo em que anda mais.
 */
export function direcaoNaTelaDaLinhaDeFio(fio: LinhaDeFio): 'vertical' | 'horizontal' {
  return Math.abs(fio.fim.x - fio.inicio.x) >= Math.abs(fio.fim.y - fio.inicio.y) ? 'horizontal' : 'vertical';
}
