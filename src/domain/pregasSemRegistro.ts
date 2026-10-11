import { distancia, pontoDentroDoContorno, trechoDoContorno, type Contorno, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import type { Molde, PregaDaPeca } from './molde';
import { faixaDaPrega, pregasDaPeca, removerPrega } from './pregas';
import { distanciaAteALinha } from './regioes';

/**
 * A prega que está na peça sem registro — aberta antes de as pregas ficarem
 * registradas, vinda de outro projeto ou desenhada à mão — é reconhecida pelo
 * desenho, quando ele é o que a ferramenta faz:
 * - duas linhas internas retas (as bordas da abertura), cada uma de um ponto
 *   do contorno a outro, com as pontas vizinhas no contorno, duas a duas;
 * - entre elas, a linha do meio (prega simples) ou as três que repartem a
 *   abertura em quatro (prega dupla);
 * - uma borda em esquadro com a abertura numa das pontas, e as duas do mesmo
 *   comprimento (o lado que andou não esticou).
 * As setas, se houver, dizem para que lado a prega dobra.
 */

const NO_MESMO_LUGAR_MM = 1e-6;
/** Quanto (mm) o desenho pode fugir do que a ferramenta faz e ainda ser reconhecido. */
const FOLGA_DO_DESENHO_MM = 0.01;
/** O ponto do contorno a menos disto (mm) da reta entre os vizinhos não é um canto. */
const NA_RETA_MM = 1e-6;

function mesmoLugar(p: Ponto2D, q: Ponto2D): boolean {
  return distancia(p, q) <= NO_MESMO_LUGAR_MM;
}

function entre(a: Ponto2D, b: Ponto2D, k: number): Ponto2D {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** A linha de dois pontos liga `de` a `ate` (num sentido ou no outro), com a folga dada. */
function liga(linha: Contorno, de: Ponto2D, ate: Ponto2D, folgaMm: number): boolean {
  if (linha.length !== 2) return false;
  const [p, q] = [linha[0]!, linha[1]!];
  return (distancia(p, de) <= folgaMm && distancia(q, ate) <= folgaMm) || (distancia(p, ate) <= folgaMm && distancia(q, de) <= folgaMm);
}

/** A seta que a ferramenta desenha (a haste e as duas farpas, voltando à ponta) com a haste de `de` a `ate`. */
function ehSetaDe(linha: Contorno, de: Ponto2D, ate: Ponto2D): boolean {
  return (
    linha.length === 5 &&
    mesmoLugar(linha[1]!, linha[3]!) &&
    distancia(linha[0]!, de) <= FOLGA_DO_DESENHO_MM &&
    distancia(linha[1]!, ate) <= FOLGA_DO_DESENHO_MM
  );
}

/** Duas bordas de uma abertura, pelos números dos pontos do contorno em que acabam: `a` e `b` de uma, `a2` e `b2` da outra. */
interface Bordas {
  readonly a: number;
  readonly b: number;
  readonly a2: number;
  readonly b2: number;
}

/** As pontas estão no contorno como a ferramenta as põe: cada ponta de uma borda é vizinha da ponta da outra, e as duas bordas correm lado a lado. */
function ladoALado(n: number, { a, b, a2, b2 }: Bordas): 'adiante' | 'atras' | null {
  if (a2 === (a + 1) % n && b === (b2 + 1) % n) return 'adiante';
  if (a === (a2 + 1) % n && b2 === (b + 1) % n) return 'atras';
  return null;
}

/** O trecho do contorno do lado da borda `a`–`b` (o lado que ficou parado, se ela é a borda parada). */
function ladoDaBorda(contorno: Contorno, bordas: Bordas, sentido: 'adiante' | 'atras'): Ponto2D[] {
  const no = (indice: number): PosicaoNoContorno => ({ indiceAresta: indice, ponto: contorno[indice]! });
  return sentido === 'adiante' ? trechoDoContorno(contorno, no(bordas.b), no(bordas.a)) : trechoDoContorno(contorno, no(bordas.a), no(bordas.b));
}

/** As pregas sem registro que a peça tem, cada uma com o registro que teria (todas com o `id` dado: é só uma candidata). */
export function pregasSemRegistro(molde: Molde, id: string): PregaDaPeca[] {
  const contorno = molde.contorno;
  const n = contorno.length;
  const registradas = pregasDaPeca(molde);
  const jaTemRegistro = (linha: Contorno): boolean => registradas.some((r) => r.linhas.some((l) => l.length === linha.length && l.every((p, i) => mesmoLugar(p, linha[i]!))));
  const indiceDe = (p: Ponto2D): number => contorno.findIndex((v) => mesmoLugar(v, p));
  // As linhas internas retas que vão de um ponto do contorno a outro: as que podem ser borda de uma abertura.
  const retas = molde.linhasInternas
    .filter((linha) => linha.length === 2)
    .map((linha) => ({ linha, de: indiceDe(linha[0]!), ate: indiceDe(linha[1]!) }))
    .filter((r) => r.de >= 0 && r.ate >= 0 && r.de !== r.ate);
  const meioDoFio = entre(molde.linhaDeFio.inicio, molde.linhaDeFio.fim, 0.5);
  const achadas: PregaDaPeca[] = [];
  for (let i = 0; i < retas.length; i++) {
    for (let j = i + 1; j < retas.length; j++) {
      const [r0, r1] = [retas[i]!, retas[j]!];
      // Qual borda ficou parada e de que ponta a abertura foi medida: as quatro leituras possíveis das mesmas duas linhas.
      const leituras: Bordas[] = [
        { a: r0.de, b: r0.ate, a2: r1.de, b2: r1.ate },
        { a: r0.de, b: r0.ate, a2: r1.ate, b2: r1.de },
        { a: r0.ate, b: r0.de, a2: r1.ate, b2: r1.de },
        { a: r0.ate, b: r0.de, a2: r1.de, b2: r1.ate },
      ].flatMap((l) => [l, { a: l.a2, b: l.b2, a2: l.a, b2: l.b }]);
      const servem = leituras.flatMap((bordas) => {
        const sentido = ladoALado(n, bordas);
        if (!sentido) return [];
        const [a, b, a2, b2] = [contorno[bordas.a]!, contorno[bordas.b]!, contorno[bordas.a2]!, contorno[bordas.b2]!];
        const comprimento = distancia(a, b);
        const abertura = distancia(a, a2);
        if (comprimento <= FOLGA_DO_DESENHO_MM || abertura <= FOLGA_DO_DESENHO_MM) return [];
        // Na ponta de onde a abertura foi medida, ela fica em esquadro com a borda parada; e a borda que andou não mudou de comprimento.
        const foraDoEsquadro = Math.abs((a2.x - a.x) * (b.x - a.x) + (a2.y - a.y) * (b.y - a.y)) / comprimento;
        if (foraDoEsquadro > FOLGA_DO_DESENHO_MM || Math.abs(distancia(a2, b2) - comprimento) > FOLGA_DO_DESENHO_MM) return [];
        return [{ bordas, sentido, a, b, a2, b2 }];
      });
      if (servem.length === 0) continue;
      // O lado da linha de fio é o que ficou parado: é a regra da ferramenta.
      const leitura = servem.find((l) => pontoDentroDoContorno(meioDoFio, ladoDaBorda(contorno, l.bordas, l.sentido))) ?? servem[0]!;
      const { a, b, a2, b2 } = leitura;
      // As linhas que repartem a abertura: três, na prega dupla; uma, na simples. As de uma prega que já tem registro não contam: ela não é reconhecida de novo.
      const outras = molde.linhasInternas.filter((l) => l !== r0.linha && l !== r1.linha && !jaTemRegistro(l));
      const noMeio = (partes: number): Contorno[] | null => {
        const livres = [...outras];
        const linhas: Contorno[] = [];
        for (let k = 1; k < partes; k++) {
          const onde = livres.findIndex((l) => liga(l, entre(a, a2, k / partes), entre(b, b2, k / partes), FOLGA_DO_DESENHO_MM));
          if (onde < 0) return null;
          linhas.push(...livres.splice(onde, 1));
        }
        return linhas;
      };
      const daDupla = noMeio(4);
      const doMeio = daDupla ?? noMeio(2);
      if (!doMeio) continue;
      const dupla = daDupla !== null;
      // As setas, no meio da prega: na dupla, uma de cada lado, apontando para o meio; na simples, uma, para o lado em que o tecido dobra.
      const meio = (k: number): Ponto2D => entre(entre(a, b, 0.5), entre(a2, b2, 0.5), k);
      const setaDe = (de: number, ate: number): Contorno | undefined => outras.find((l) => !doMeio.includes(l) && ehSetaDe(l, meio(de), meio(ate)));
      const paraOLadoQueAndou = setaDe(0.25, 0.75);
      const paraOLadoParado = setaDe(0.75, 0.25);
      const setas = dupla ? [setaDe(0.125, 0.375), setaDe(0.875, 0.625)] : [paraOLadoQueAndou ?? paraOLadoParado];
      const d = { x: (b.x - a.x) / distancia(a, b), y: (b.y - a.y) / distancia(a, b) };
      const andouParaADireita = (a2.x - a.x) * d.y - (a2.y - a.y) * d.x > 0;
      // Na simples, a seta que vai para o lado que andou é a da prega dobrada para esse lado; sem seta, fica "para a direita".
      const modo: PregaDaPeca['modo'] = dupla
        ? 'dupla'
        : paraOLadoQueAndou
          ? andouParaADireita
            ? 'simples-direita'
            : 'simples-esquerda'
          : paraOLadoParado
            ? andouParaADireita
              ? 'simples-esquerda'
              : 'simples-direita'
            : 'simples-direita';
      const borda = (de: Ponto2D, ate: Ponto2D): Contorno => (liga(r0.linha, de, ate, NO_MESMO_LUGAR_MM) ? r0.linha : r1.linha);
      const linhas = [borda(a, b), ...doMeio, borda(a2, b2), ...setas.filter((s): s is Contorno => s !== undefined)];
      // Os piques que estão nas pontas das linhas de dobra são os que a ferramenta põe com a prega.
      const pontas = linhas.filter((l) => l.length === 2).flatMap((l) => [l[0]!, l[1]!]);
      const piques = molde.piques.filter((q) => pontas.some((p) => distancia(p, q.posicao) <= FOLGA_DO_DESENHO_MM)).map((q) => q.id);
      const semPontas: PregaDaPeca = { id, modo, parada: [a, b], movida: [a2, b2], linhas, pontasCriadas: [false, false], ...(piques.length > 0 ? { piques } : {}) };
      achadas.push({ ...semPontas, pontasCriadas: pontasPostasPelaPrega(molde, semPontas) });
    }
  }
  return achadas;
}

/**
 * Cada ponta da borda parada foi posta no contorno pela prega? É o que parece
 * quando, fechada a peça, a ponta fica no meio de uma reta: não é um canto.
 */
function pontasPostasPelaPrega(molde: Molde, prega: PregaDaPeca): readonly [boolean, boolean] {
  let fechado: Contorno;
  try {
    fechado = removerPrega({ ...molde, pregas: [...pregasDaPeca(molde), prega] }, prega.id).contorno;
  } catch {
    return [false, false];
  }
  const n = fechado.length;
  const noMeioDeUmaReta = (p: Ponto2D): boolean => {
    const i = fechado.findIndex((v) => mesmoLugar(v, p));
    if (i < 0) return false;
    const [antes, depois] = [fechado[(i - 1 + n) % n]!, fechado[(i + 1) % n]!];
    const comprimento = distancia(antes, depois);
    if (comprimento <= NO_MESMO_LUGAR_MM) return false;
    return Math.abs((depois.x - antes.x) * (p.y - antes.y) - (depois.y - antes.y) * (p.x - antes.x)) / comprimento <= NA_RETA_MM;
  };
  return [noMeioDeUmaReta(prega.parada[0]), noMeioDeUmaReta(prega.parada[1])];
}

/** A prega sem registro em cuja faixa o ponto está, ou de que está mais perto, a até `raioMm` — com o registro que teria. */
export function pregaSemRegistroPerto(molde: Molde, p: Ponto2D, raioMm: number, id: string): PregaDaPeca | null {
  let melhor: { prega: PregaDaPeca; distancia: number } | null = null;
  for (const prega of pregasSemRegistro(molde, id)) {
    const faixa = faixaDaPrega(prega);
    const d = pontoDentroDoContorno(p, faixa) ? 0 : distanciaAteALinha(p, [...faixa, faixa[0]!]);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { prega, distancia: d };
  }
  return melhor ? melhor.prega : null;
}

/** A peça com a prega reconhecida registrada: o desenho não muda, e ela passa a aceitar as medidas, como as feitas pela ferramenta. */
export function comPregaReconhecida(molde: Molde, prega: PregaDaPeca): Molde {
  return { ...molde, pregas: [...pregasDaPeca(molde), prega] };
}
