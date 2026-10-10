import {
  area,
  areaAssinada,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  retanguloEnvolvente,
  segmentosSeIntersectam,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { ancoraDoRotulo, type Cota } from './cota';
import { piquesQueFicamNoContorno, rotacionarMolde, transladarMolde, type LinhaDeFio, type Molde } from './molde';

/**
 * Operações que cortam, dobram e unem moldes inteiros (grupos "Cortar e
 * Unir" e "Complementar moldes" da aba Produção). Trabalham sobre o contorno
 * fechado da peça: o corte é uma reta entre dois pontos do contorno, e a
 * união cola duas peças por uma aresta de cada.
 */

/** Dois pontos a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;
/** Quanto (mm) a reta de corte é encurtada em cada ponta para o teste de cruzamento não acusar os próprios extremos. */
const FOLGA_DAS_PONTAS_DO_CORTE_MM = 0.01;
const AREA_MINIMA_DE_UMA_PARTE_MM2 = 1e-6;
/** Um vértice a menos disso (mm) da reta de dobra conta como estando sobre ela. */
const TOLERANCIA_DA_DOBRA_MM = 1e-6;

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

function arestas(contorno: Contorno): Array<readonly [Ponto2D, Ponto2D]> {
  return contorno.map((p, i) => [p, contorno[(i + 1) % contorno.length]!] as const);
}

/** Recusa o corte que não é uma reta inteira por dentro da peça, de um ponto do contorno a outro. */
export function exigirCorteValido(molde: Molde, a: Ponto2D, b: Ponto2D): void {
  const comprimento = distancia(a, b);
  if (comprimento < FOLGA_DAS_PONTAS_DO_CORTE_MM * 4) {
    throw new Error('O corte precisa de dois pontos diferentes do contorno.');
  }
  const k = FOLGA_DAS_PONTAS_DO_CORTE_MM / comprimento;
  const a1 = ponto(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
  const b1 = ponto(b.x + (a.x - b.x) * k, b.y + (a.y - b.y) * k);
  const meio = ponto((a.x + b.x) / 2, (a.y + b.y) / 2);
  if (!pontoDentroDoContorno(meio, molde.contorno) || arestas(molde.contorno).some(([p, q]) => segmentosSeIntersectam(a1, b1, p, q))) {
    throw new Error('A reta de corte precisa ficar toda dentro da peça, de um ponto do contorno a outro.');
  }
  if (molde.furos.some((furo) => arestas(furo).some(([p, q]) => segmentosSeIntersectam(a1, b1, p, q)))) {
    throw new Error('A reta de corte passa por um furo da peça.');
  }
}

/** Dos contornos dados, o que contém o ponto ou, se nenhum contém, o que passa mais perto dele. */
function contornoMaisProximo(p: Ponto2D, contornos: readonly Contorno[]): number {
  const dentro = contornos.findIndex((c) => pontoDentroDoContorno(p, c));
  if (dentro >= 0) return dentro;
  let melhor = 0;
  let menor = Infinity;
  contornos.forEach((c, i) => {
    const d = pontoMaisProximoNoContorno(p, c).distancia;
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  });
  return melhor;
}

/** A linha de fio da parte: a original, se cabe inteira nela; senão, a mesma seta levada ao meio da parte. */
export function fioDaParte(fio: LinhaDeFio, contorno: Contorno): LinhaDeFio {
  if (pontoDentroDoContorno(fio.inicio, contorno) && pontoDentroDoContorno(fio.fim, contorno)) return fio;
  const caixa = retanguloEnvolvente(contorno);
  const dx = (caixa.minX + caixa.maxX) / 2 - (fio.inicio.x + fio.fim.x) / 2;
  const dy = (caixa.minY + caixa.maxY) / 2 - (fio.inicio.y + fio.fim.y) / 2;
  return { inicio: ponto(fio.inicio.x + dx, fio.inicio.y + dy), fim: ponto(fio.fim.x + dx, fio.fim.y + dy) };
}

/**
 * As duas partes em que a reta de `a` a `b` divide a peça, cada uma com o que
 * é dela: os furos, as linhas internas e as marcas que ficam do lado dela, os
 * piques das arestas que herdou e as cotas mais próximas. A linha de fio vai
 * com cada parte (no lugar, se cabe; senão, no meio dela).
 */
function partesDoCorte(molde: Molde, a: PosicaoNoContorno, b: PosicaoNoContorno): readonly [Molde, Molde] {
  exigirCorteValido(molde, a.ponto, b.ponto);
  const contornos = [trechoDoContorno(molde.contorno, a, b), trechoDoContorno(molde.contorno, b, a)] as const;
  if (contornos.some((c) => c.length < 3 || !(area(c) > AREA_MINIMA_DE_UMA_PARTE_MM2))) {
    throw new Error('O corte deixaria uma das partes sem área.');
  }
  const ladoDe = (p: Ponto2D): number => contornoMaisProximo(p, contornos);
  const partes = contornos.map((contorno, lado): Molde => {
    const cotas = (molde.cotas ?? []).filter((c) => ladoDe(ancoraDoRotulo(c)) === lado);
    return {
      ...molde,
      contorno,
      furos: molde.furos.filter((f) => ladoDe(f[0]!) === lado),
      linhasInternas: molde.linhasInternas.filter((l) => ladoDe(l[0]!) === lado),
      marcas: molde.marcas.filter((m) => ladoDe(m.posicao) === lado),
      piques: piquesQueFicamNoContorno(molde.piques, contorno),
      linhaDeFio: fioDaParte(molde.linhaDeFio, contorno),
      ...(molde.cotas ? { cotas } : {}),
    };
  });
  return [partes[0]!, partes[1]!];
}

/**
 * "Cortar": divide a peça em duas pela reta entre dois pontos do contorno. A
 * parte maior continua sendo a peça (mesmo id e nome); a outra é uma peça
 * nova, com o id dado e o nome seguido de "(2)".
 */
export function cortarMolde(molde: Molde, a: PosicaoNoContorno, b: PosicaoNoContorno, novoId: string): readonly [Molde, Molde] {
  const [p0, p1] = partesDoCorte(molde, a, b);
  const [maior, menor] = area(p0.contorno) >= area(p1.contorno) ? [p0, p1] : [p1, p0];
  return [maior, { ...menor, id: novoId, nome: `${molde.nome} (2)` }];
}

/**
 * A parte da peça que fica de um lado da reta de corte: a que contém o ponto
 * clicado (`ladoClicado` = 'fica') ou a outra ('sai'). Serve a "Dobrar" (fica
 * o lado clicado) e a "Remover região" (sai o lado clicado). A peça continua
 * sendo ela mesma.
 */
export function metadeDoMolde(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  pontoDoLado: Ponto2D,
  ladoClicado: 'fica' | 'sai',
): Molde {
  const partes = partesDoCorte(molde, a, b);
  const clicada = partes.findIndex((p) => pontoDentroDoContorno(pontoDoLado, p.contorno));
  if (clicada < 0) {
    throw new Error(
      ladoClicado === 'fica' ? 'Clique dentro da peça, do lado que deve ficar.' : 'Clique dentro da peça, do lado que deve sair.',
    );
  }
  return partes[ladoClicado === 'fica' ? clicada : 1 - clicada]!;
}

function espelharNaReta(p: Ponto2D, a: Ponto2D, b: Ponto2D): Ponto2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const pe = ponto(a.x + dx * t, a.y + dy * t);
  return ponto(2 * pe.x - p.x, 2 * pe.y - p.y);
}

/**
 * "Desdobrar": a aresta indicada é a linha de dobra; a peça ganha a outra
 * metade, espelhada nela, e a dobra passa a ser uma linha interna (a linha de
 * centro). Furos, linhas internas, marcas e piques ganham a cópia espelhada;
 * os piques da própria dobra saem, porque ela deixa de ser borda. Quando a
 * dobra é feita de várias arestas seguidas na mesma reta, vale a dobra
 * inteira. Recusa a peça que passa para os dois lados da reta da dobra, ou
 * que volta a encostar nela.
 */
export function desdobrarMolde(molde: Molde, indiceAresta: number, novoId: () => string): Molde {
  const n = molde.contorno.length;
  if (!Number.isInteger(indiceAresta) || indiceAresta < 0 || indiceAresta >= n) {
    throw new Error('Aresta fora do contorno da peça.');
  }
  const a = molde.contorno[indiceAresta]!;
  const b = molde.contorno[(indiceAresta + 1) % n]!;
  const comprimento = distancia(a, b);
  if (comprimento < MESMO_PONTO_MM) throw new Error('Essa aresta não tem comprimento: não serve de linha de dobra.');
  // Distância (com sinal) de cada vértice à reta da dobra.
  const lado = (p: Ponto2D): number => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / comprimento;
  const naReta = (i: number): boolean => Math.abs(lado(molde.contorno[((i % n) + n) % n]!)) <= TOLERANCIA_DA_DOBRA_MM;
  // A dobra inteira: as arestas vizinhas que continuam na mesma reta entram nela.
  let inicio = indiceAresta;
  let fim = indiceAresta + 1;
  while (fim - inicio < n - 1 && naReta(inicio - 1)) inicio--;
  while (fim - inicio < n - 1 && naReta(fim + 1)) fim++;
  const foraDaDobra = Array.from({ length: n - (fim - inicio + 1) }, (_, j) => molde.contorno[(fim + 1 + j) % n]!);
  const lados = foraDaDobra.map(lado);
  if (lados.length === 0) throw new Error('A peça não tem área fora dessa aresta.');
  if (lados.some((d) => d > TOLERANCIA_DA_DOBRA_MM) && lados.some((d) => d < -TOLERANCIA_DA_DOBRA_MM)) {
    throw new Error('A peça passa para os dois lados dessa aresta: não dá para desdobrar nela.');
  }
  if (lados.some((d) => Math.abs(d) <= TOLERANCIA_DA_DOBRA_MM)) {
    throw new Error('A peça volta a encostar na reta dessa aresta: não dá para desdobrar nela.');
  }

  const pontaInicial = molde.contorno[((inicio % n) + n) % n]!;
  const pontaFinal = molde.contorno[fim % n]!;
  const espelhar = (p: Ponto2D): Ponto2D => espelharNaReta(p, a, b);
  const origemEspelhada = espelhar(ponto(0, 0));
  const espelharVetor = (v: Ponto2D): Ponto2D => {
    const e = espelhar(v);
    return ponto(e.x - origemEspelhada.x, e.y - origemEspelhada.y);
  };
  // Uma volta: da ponta final da dobra, a metade que existia até a ponta
  // inicial; dali, a metade espelhada, de trás para a frente.
  const volta = [
    { ponto: pontaFinal, original: fim % n },
    ...foraDaDobra.map((p, j) => ({ ponto: p, original: (fim + 1 + j) % n })),
    { ponto: pontaInicial, original: ((inicio % n) + n) % n },
    ...[...foraDaDobra].reverse().map((p) => ({ ponto: espelhar(p), original: n })),
  ];
  // O contorno novo começa pelo vértice de menor número que continua nele.
  const comeco = volta.reduce((menor, v, i) => (v.original < volta[menor]!.original ? i : menor), 0);
  const contorno = [...volta.slice(comeco), ...volta.slice(0, comeco)].map((v) => v.ponto);

  // O pique que está sobre a dobra é a própria imagem no espelho: não se repete.
  const piquesEspelhados = molde.piques
    .filter((p) => Math.abs(lado(p.posicao)) > TOLERANCIA_DA_DOBRA_MM)
    .map((p) => ({ ...p, id: novoId(), posicao: espelhar(p.posicao) }));
  return {
    ...molde,
    contorno,
    furos: [...molde.furos, ...molde.furos.map((f) => f.map(espelhar))],
    linhasInternas: [...molde.linhasInternas, ...molde.linhasInternas.map((l) => l.map(espelhar)), [pontaInicial, pontaFinal]],
    marcas: [...molde.marcas, ...molde.marcas.map((m) => ({ ...m, id: novoId(), posicao: espelhar(m.posicao) }))],
    piques: piquesQueFicamNoContorno([...molde.piques, ...piquesEspelhados], contorno),
    // Os pontos graduados da metade que existia ganham o par espelhado, com a regra espelhada.
    ...(molde.graduacao
      ? {
          graduacao: {
            ...molde.graduacao,
            pontos: [
              ...molde.graduacao.pontos,
              ...molde.graduacao.pontos
                .filter((p) => Math.abs(lado(p.posicao)) > TOLERANCIA_DA_DOBRA_MM)
                .map((p) => ({ ...p, posicao: espelhar(p.posicao), deslocamentos: p.deslocamentos.map(espelharVetor) })),
            ],
          },
        }
      : {}),
  };
}

function anguloDe(de: Ponto2D, ate: Ponto2D): number {
  return (Math.atan2(ate.y - de.y, ate.x - de.x) * 180) / Math.PI;
}

/**
 * A segunda peça levada até a primeira: girada e movida de modo que a aresta
 * `arestaB` dela fique sobre a aresta `arestaA` da primeira, meio com meio,
 * com as peças de lados opostos da aresta.
 */
export function encostarMolde(moldeA: Molde, arestaA: number, moldeB: Molde, arestaB: number): Molde {
  const nA = moldeA.contorno.length;
  const nB = moldeB.contorno.length;
  const dentro = (i: number, n: number): boolean => Number.isInteger(i) && i >= 0 && i < n;
  if (!dentro(arestaA, nA) || !dentro(arestaB, nB)) throw new Error('Aresta fora do contorno da peça.');
  const a0 = moldeA.contorno[arestaA]!;
  const a1 = moldeA.contorno[(arestaA + 1) % nA]!;
  const b0 = moldeB.contorno[arestaB]!;
  const b1 = moldeB.contorno[(arestaB + 1) % nB]!;
  if (distancia(a0, a1) < MESMO_PONTO_MM || distancia(b0, b1) < MESMO_PONTO_MM) {
    throw new Error('Uma das arestas não tem comprimento: não dá para unir por ela.');
  }
  // Com os dois contornos no mesmo sentido de giro, as peças ficam de lados
  // opostos quando as arestas correm em sentidos contrários.
  const mesmoSentido = Math.sign(areaAssinada(moldeA.contorno)) === Math.sign(areaAssinada(moldeB.contorno));
  const direcaoAlvo = mesmoSentido ? anguloDe(a1, a0) : anguloDe(a0, a1);
  const girada = rotacionarMolde(moldeB, direcaoAlvo - anguloDe(b0, b1));
  const g0 = girada.contorno[arestaB]!;
  const g1 = girada.contorno[(arestaB + 1) % nB]!;
  return transladarMolde(
    girada,
    ponto((a0.x + a1.x) / 2 - (g0.x + g1.x) / 2, (a0.y + a1.y) / 2 - (g0.y + g1.y) / 2),
    moldeB.id,
  );
}

/**
 * "Unir": as duas peças viram uma só, coladas pela aresta `arestaA` da
 * primeira e `arestaB` da segunda (que é girada e movida até encostar). A
 * peça unida é a primeira — id, nome, linha de fio, costura e quantidade — com
 * os furos, linhas internas, marcas, piques e cotas das duas. Arestas de
 * comprimentos diferentes são centralizadas uma na outra, e a sobra fica como
 * degrau no contorno.
 */
export function unirMoldes(moldeA: Molde, arestaA: number, moldeB: Molde, arestaB: number): Molde {
  const b = encostarMolde(moldeA, arestaA, moldeB, arestaB);
  const nA = moldeA.contorno.length;
  const nB = b.contorno.length;
  const mesmoSentido = Math.sign(areaAssinada(moldeA.contorno)) === Math.sign(areaAssinada(b.contorno));
  // A primeira peça inteira, da ponta final da aresta até a inicial; depois a
  // segunda, a partir da ponta que encostou nessa, no sentido que mantém o
  // contorno unido girando para o mesmo lado.
  const daA = Array.from({ length: nA }, (_, j) => moldeA.contorno[(arestaA + 1 + j) % nA]!);
  const daB = mesmoSentido
    ? Array.from({ length: nB }, (_, j) => b.contorno[(arestaB + 1 + j) % nB]!)
    : Array.from({ length: nB }, (_, j) => b.contorno[(arestaB - j + nB) % nB]!);
  const contorno: Ponto2D[] = [];
  for (const p of [...daA, ...daB]) {
    if (contorno.length === 0 || distancia(contorno.at(-1)!, p) > MESMO_PONTO_MM) contorno.push(p);
  }
  if (contorno.length > 1 && distancia(contorno.at(-1)!, contorno[0]!) <= MESMO_PONTO_MM) contorno.pop();
  const cotas: readonly Cota[] = [...(moldeA.cotas ?? []), ...(b.cotas ?? [])];
  // A graduação da segunda peça só entra se for nos mesmos tamanhos, com o mesmo base.
  const gA = moldeA.graduacao;
  const gB = b.graduacao;
  const mesmosTamanhos =
    gA !== undefined && gB !== undefined && gA.base === gB.base && gA.tamanhos.length === gB.tamanhos.length && gA.tamanhos.every((t, i) => t === gB.tamanhos[i]);
  return {
    ...moldeA,
    ...(gA && gB && mesmosTamanhos ? { graduacao: { ...gA, pontos: [...gA.pontos, ...gB.pontos] } } : {}),
    contorno,
    furos: [...moldeA.furos, ...b.furos],
    linhasInternas: [...moldeA.linhasInternas, ...b.linhasInternas],
    marcas: [...moldeA.marcas, ...b.marcas],
    piques: piquesQueFicamNoContorno([...moldeA.piques, ...b.piques], contorno),
    ...(cotas.length > 0 ? { cotas } : {}),
  };
}
