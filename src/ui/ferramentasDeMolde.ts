import {
  area,
  distancia,
  pontoMaisProximoNoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { criarBainha, geometriaDaBainha, type OpcoesDeBainha } from '../domain/bainha';
import {
  conferirOpcoesDeCorte,
  cortarMoldeComOpcoes,
  CORTE_SEM_COSTURA,
  desdobraComAMetadeGuardada,
  desdobrarMolde,
  dobraPelaLinhaInterna,
  dobrarMolde,
  encostarMolde,
  metadeDoMolde,
  removerFaixaDoMolde,
  separarRegiaoDoMolde,
  UNIAO_PADRAO,
  unirMoldes,
  type OpcoesDeCorte,
  type OpcoesDeDobra,
  type OpcoesDeUniao,
} from '../domain/corteEUniao';
import { cortarMoldePelosElementos, linhaDeCortePelosElementos, separarRegiaoPelosElementos } from '../domain/cortePorElementos';
import { rotacaoEhPermitida, type Molde } from '../domain/molde';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import { caminhoDoTrecho, SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';

/**
 * Ferramentas da aba Produção que cortam, dobram, unem e dão bainha à peça
 * selecionada. Aqui fica o que cada clique faz e o que o desenho mostra antes
 * de aplicar; a geometria é do domínio (`corteEUniao.ts` e `bainha.ts`).
 */
export type FerramentaDeMolde = 'cortar' | 'remover-regiao' | 'dobrar' | 'desdobrar' | 'unir' | 'bainha';

/** As que pedem uma reta de corte, de um ponto do contorno a outro. */
export type FerramentaDeReta = 'cortar' | 'remover-regiao' | 'dobrar';

const FERRAMENTAS_DE_MOLDE: ReadonlySet<string> = new Set(['cortar', 'remover-regiao', 'dobrar', 'desdobrar', 'unir', 'bainha']);

export function ehFerramentaDeMolde(modo: string): modo is FerramentaDeMolde {
  return FERRAMENTAS_DE_MOLDE.has(modo);
}

export function ehFerramentaDeReta(modo: string): modo is FerramentaDeReta {
  return modo === 'cortar' || modo === 'remover-regiao' || modo === 'dobrar';
}

/** Dois pontos do contorno a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;

/** O que o desenho mostra enquanto a ferramenta está em uso (o mesmo formato da prévia das curvas). */
export interface PreviaDeFerramentaDeMolde {
  readonly novo?: readonly Ponto2D[] | null;
  readonly novoFechado?: boolean;
  readonly substituido?: readonly Ponto2D[] | null;
  /** Linhas que vão entrar na peça além do contorno (pernas de pence, linhas de dobra). */
  readonly linhas?: readonly (readonly Ponto2D[])[];
  readonly marcas?: readonly Ponto2D[];
}

/** O resultado de aplicar uma ferramenta: as peças novas do projeto e o que dizer na faixa de mensagens. */
export interface ResultadoDeFerramentaDeMolde {
  readonly pecas: readonly Molde[];
  readonly recado: string;
}

function cm2(areaMm2: number): string {
  return `${(areaMm2 / 100).toFixed(1).replace('.', ',')} cm²`;
}

/** A aresta do contorno que passa a até `raioMm` do ponto, ou `null`. */
export function arestaPerto(p: Ponto2D, contorno: Contorno, raioMm: number): number | null {
  const maisProximo = pontoMaisProximoNoContorno(p, contorno);
  return maisProximo.distancia <= raioMm ? maisProximo.indiceAresta : null;
}

/** Das outras peças, a aresta mais próxima do ponto, a até `raioMm` dele. */
export function arestaDeOutraPecaPerto(
  p: Ponto2D,
  pecas: readonly Molde[],
  excetoId: string,
  raioMm: number,
): { readonly peca: Molde; readonly indiceAresta: number } | null {
  let melhor: { peca: Molde; indiceAresta: number } | null = null;
  let menor = raioMm;
  for (const peca of pecas) {
    if (peca.id === excetoId) continue;
    const maisProximo = pontoMaisProximoNoContorno(p, peca.contorno);
    if (maisProximo.distancia <= menor) {
      menor = maisProximo.distancia;
      melhor = { peca, indiceAresta: maisProximo.indiceAresta };
    }
  }
  return melhor;
}

function arestaDoContorno(contorno: Contorno, indiceAresta: number): Ponto2D[] {
  return [contorno[indiceAresta]!, contorno[(indiceAresta + 1) % contorno.length]!];
}

/** O que o "Remover região" pergunta. */
export interface OpcoesDeRemoverRegiao {
  /** "Manter região do molde": a região tirada vira uma peça nova, em vez de sumir. */
  readonly manter: boolean;
  /** "Unir moldes": com duas retas, sai a faixa entre elas, e as duas partes que sobram são unidas. */
  readonly unir: boolean;
}

export const REMOVER_REGIAO_SIMPLES: OpcoesDeRemoverRegiao = { manter: false, unir: false };

/**
 * A reta está completa: os dois pontos do contorno e, em "Dobrar" e "Remover
 * região", o clique dentro da peça que escolhe o lado. Em "Remover região" com
 * `segundaReta` ("Unir moldes"), em vez do lado vêm os dois pontos da segunda
 * reta.
 */
export function retaCompleta(ferramenta: FerramentaDeReta | 'bainha', estado: TrechoEmEdicao, segundaReta = false): boolean {
  if (!estado.inicio || !estado.fim) return false;
  if (ferramenta === 'remover-regiao' && segundaReta) return estado.livres.length >= 2;
  return ferramenta === 'cortar' || ferramenta === 'bainha' || estado.livres.length > 0;
}

/**
 * O estado depois de um clique: primeiro os dois pontos do contorno (um clique
 * fora dele, ou no mesmo ponto, não conta) e, nas ferramentas que escolhem um
 * lado, o ponto clicado em seguida. Com `segundaReta`, os cliques seguintes
 * são os dois pontos do contorno da segunda reta.
 */
export function cliqueDeReta(ferramenta: FerramentaDeReta | 'bainha', estado: TrechoEmEdicao, clique: CliqueDeTrecho, segundaReta = false): TrechoEmEdicao {
  if (retaCompleta(ferramenta, estado, segundaReta)) return estado;
  if (!estado.inicio) return clique.noContorno ? { ...SEM_TRECHO, inicio: clique.noContorno } : estado;
  if (!estado.fim) {
    const fim = clique.noContorno;
    return fim && distancia(fim.ponto, estado.inicio.ponto) > MESMO_PONTO_MM ? { ...estado, fim } : estado;
  }
  if (ferramenta === 'remover-regiao' && segundaReta) {
    const p = clique.noContorno?.ponto;
    const repetido = p !== undefined && estado.livres.some((q) => distancia(p, q) <= MESMO_PONTO_MM);
    return p && !repetido ? { ...estado, livres: [...estado.livres, p] } : estado;
  }
  return { ...estado, livres: [clique.livre] };
}

/**
 * O clique numa linha interna reta da peça (o "elemento"), em vez de dois
 * pontos do contorno: a reta é a linha inteira, de borda a borda. Vale para a
 * reta que ainda não começou — a primeira ou, com `segundaReta`, a segunda.
 * `null` quando o clique não é isso, e a ferramenta segue como sempre.
 */
export function retaPeloElemento(
  ferramenta: FerramentaDeReta,
  peca: Molde,
  estado: TrechoEmEdicao,
  linhaInterna: number | null,
  segundaReta = false,
): { readonly estado: TrechoEmEdicao; readonly recado: string | null } | null {
  if (linhaInterna === null || ferramenta === 'dobrar') return null;
  const primeira = !estado.inicio;
  const segunda = ferramenta === 'remover-regiao' && segundaReta && estado.inicio !== null && estado.fim !== null && estado.livres.length === 0;
  if (!primeira && !segunda) return null;
  try {
    const [a, b] = dobraPelaLinhaInterna(peca, linhaInterna);
    return { estado: primeira ? { ...SEM_TRECHO, inicio: a, fim: b } : { ...estado, livres: [a.ponto, b.ponto] }, recado: null };
  } catch (e) {
    return { estado, recado: (e instanceof Error ? e.message : String(e)).replace('de linha de dobra', 'de reta de corte') };
  }
}

/** O ponto que guarda, no estado da ferramenta, um elemento indicado: o meio do primeiro trecho dele. */
function marcaDoElemento(linha: Contorno): Ponto2D {
  return { x: (linha[0]!.x + linha[1]!.x) / 2, y: (linha[0]!.y + linha[1]!.y) / 2 };
}

/** Os elementos (linhas internas, pelo número) indicados para o corte no "Contorno manual", na ordem em que foram indicados. */
export function elementosDoCorte(peca: Molde, estado: TrechoEmEdicao): number[] {
  if (estado.inicio) return [];
  return estado.livres
    .map((marca) => peca.linhasInternas.findIndex((linha) => linha.length >= 2 && distancia(marcaDoElemento(linha), marca) <= MESMO_PONTO_MM))
    .filter((i) => i >= 0);
}

/** O que a mensagem do "Cortar" diz depois do corte. */
function recadoDoCorte(peca: Molde, maior: Molde, nova: Molde, corte: OpcoesDeCorte, pelosElementos: number, reto = true): string {
  const costura =
    corte.costuraMm > 0
      ? ` A borda do corte ganhou ${formatarMm(corte.costuraMm)} de costura ${corte.costuraNasDuas ? 'nas duas partes' : 'na peça nova'}${corte.piques ? ', com um pique em cada ponta da linha do corte' : ''}.`
      : '';
  const como = pelosElementos === 0 ? '' : pelosElementos === 1 ? ', pelo elemento indicado' : `, pelos ${pelosElementos} elementos indicados`;
  // No corte que não é reto, a costura é a borda deslocada: o manual da referência manda revisar.
  const revisar = !reto && corte.costuraMm > 0 ? ' Num corte que não é reto, confira a costura: ela é a borda do corte deslocada.' : '';
  return `“${peca.nome}” cortada em duas${como}: ${cm2(area(maior.contorno))} continuam nela e ${cm2(area(nova.contorno))} são a peça nova “${nova.nome}”.${costura}${revisar}`;
}

/** "Cortar" pelos elementos indicados (linhas internas da peça, pelo número). Lança erro, sem mudar nada, quando eles não dão uma linha de corte. */
export function aplicarCortePelosElementos(
  pecas: readonly Molde[],
  peca: Molde,
  elementos: readonly number[],
  novoId: () => string,
  corte: OpcoesDeCorte = CORTE_SEM_COSTURA,
): ResultadoDeFerramentaDeMolde {
  const reto = linhaDeCortePelosElementos(peca, elementos).miolo.length === 0;
  const [maior, menor] = cortarMoldePelosElementos(peca, elementos, novoId, corte);
  const nova = { ...menor, nome: nomeDaParteNova(peca.nome, pecas) };
  return { pecas: trocar(pecas, peca.id, [maior, nova]), recado: recadoDoCorte(peca, maior, nova, corte, elementos.length, reto) };
}

/** O que o clique do "Cortar" num elemento faz: o estado novo, o que dizer e, se o corte foi feito, as peças. */
export interface CliqueNoElementoDoCorte {
  readonly estado: TrechoEmEdicao;
  readonly recado: string | null;
  readonly pecas?: readonly Molde[];
}

/**
 * O clique do "Cortar" numa linha interna da peça (o elemento: reta, curva,
 * arco ou linha quebrada), antes de qualquer ponto do contorno. Com o
 * contorno automático, corta por ela na hora. Com o manual, ela entra na
 * lista dos elementos do corte (ou sai, se já estava), e o Enter corta.
 * `null` quando o clique não é isso.
 */
export function cliqueNoElementoDoCorte(
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  linhaInterna: number | null,
  manual: boolean,
  novoId: () => string,
  corte: OpcoesDeCorte = CORTE_SEM_COSTURA,
): CliqueNoElementoDoCorte | null {
  const linha = linhaInterna === null ? undefined : peca.linhasInternas[linhaInterna];
  if (linhaInterna === null || !linha || linha.length < 2 || estado.inicio) return null;
  if (!manual) {
    try {
      const feito = aplicarCortePelosElementos(pecas, peca, [linhaInterna], novoId, corte);
      return { estado: SEM_TRECHO, recado: feito.recado, pecas: feito.pecas };
    } catch (e) {
      return { estado, recado: e instanceof Error ? e.message : String(e) };
    }
  }
  const marca = marcaDoElemento(linha);
  const jaIndicado = elementosDoCorte(peca, estado).includes(linhaInterna);
  const livres = jaIndicado ? estado.livres.filter((p) => distancia(p, marca) > MESMO_PONTO_MM) : [...estado.livres, marca];
  const n = livres.length;
  return {
    estado: { ...SEM_TRECHO, livres },
    recado: n === 0 ? null : `${n} ${n === 1 ? 'elemento indicado' : 'elementos indicados'} para o corte. Enter corta; o clique num elemento já indicado tira ele da lista.`,
  };
}

/** O Enter do "Cortar" com o contorno manual: corta pelos elementos indicados. `null` se não há nenhum. */
export function confirmarCortePelosElementos(
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  novoId: () => string,
  corte: OpcoesDeCorte = CORTE_SEM_COSTURA,
): CliqueNoElementoDoCorte | null {
  const elementos = elementosDoCorte(peca, estado);
  if (elementos.length === 0) return null;
  try {
    const feito = aplicarCortePelosElementos(pecas, peca, elementos, novoId, corte);
    return { estado: SEM_TRECHO, recado: feito.recado, pecas: feito.pecas };
  } catch (e) {
    // Os elementos continuam indicados: dá para tirar o que sobra, ou indicar o que falta.
    return { estado, recado: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A prévia do corte por elementos: os elementos indicados (e o que está sob o
 * mouse) em destaque e, se eles já dão uma linha de corte, a linha, de borda
 * a borda. `null` quando não há elemento nenhum em jogo.
 */
export function previaDoCortePelosElementos(peca: Molde, estado: TrechoEmEdicao, linhaSobOMouse: number | null, manual: boolean): PreviaDeFerramentaDeMolde | null {
  if (estado.inicio) return null;
  const indicados = elementosDoCorte(peca, estado);
  const sobOMouse = linhaSobOMouse !== null && (peca.linhasInternas[linhaSobOMouse]?.length ?? 0) >= 2 ? linhaSobOMouse : null;
  // No automático, o clique corta pelo elemento sob o mouse; no manual, ele entra na lista (ou sai dela).
  const emJogo = sobOMouse === null ? indicados : !manual ? [sobOMouse] : indicados.includes(sobOMouse) ? indicados : [...indicados, sobOMouse];
  if (emJogo.length === 0) return null;
  const linhas = emJogo.map((i) => peca.linhasInternas[i]!);
  try {
    const { a, b, miolo } = linhaDeCortePelosElementos(peca, emJogo);
    return { novo: [a.ponto, ...miolo, b.ponto], linhas, marcas: [a.ponto, b.ponto] };
  } catch {
    return { linhas };
  }
}

/** "Remover região" pelos elementos indicados (linhas internas, pelo número) e pelo lado clicado. Lança erro, sem mudar nada, quando não dá. */
export function aplicarRemoverPelosElementos(
  pecas: readonly Molde[],
  peca: Molde,
  elementos: readonly number[],
  lado: Ponto2D,
  novoId: () => string,
  remover: OpcoesDeRemoverRegiao = REMOVER_REGIAO_SIMPLES,
): ResultadoDeFerramentaDeMolde {
  const { peca: sem, regiao } = separarRegiaoPelosElementos(peca, elementos, lado, novoId());
  const como = elementos.length === 1 ? 'pelo elemento indicado' : `pelos ${elementos.length} elementos indicados`;
  if (remover.manter) {
    const guardada = { ...regiao, nome: nomeDaParteNova(peca.nome, pecas) };
    return {
      pecas: trocar(pecas, peca.id, [sem, guardada]),
      recado: `Região de ${cm2(area(guardada.contorno))} removida de “${peca.nome}”, ${como}; ela virou a peça “${guardada.nome}”.`,
    };
  }
  return { pecas: trocar(pecas, peca.id, [sem]), recado: `Região de ${cm2(area(regiao.contorno))} removida de “${peca.nome}”, ${como}.` };
}

/**
 * O clique do "Remover região" (sem "Unir moldes") que tem a ver com
 * elementos, antes de qualquer ponto do contorno. Numa linha interna da peça
 * (reta, curva, arco ou linha quebrada), ela entra na lista dos elementos que
 * formam a linha — ou sai, se já estava. Fora delas, com elementos já
 * indicados, o clique escolhe o lado, e a região sai. `null` quando o clique
 * não é isso: a reta por dois pontos do contorno segue como sempre.
 */
export function cliqueNoElementoDeRemover(
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  linhaInterna: number | null,
  livre: Ponto2D,
  novoId: () => string,
  remover: OpcoesDeRemoverRegiao = REMOVER_REGIAO_SIMPLES,
): CliqueNoElementoDoCorte | null {
  if (estado.inicio) return null;
  const indicados = elementosDoCorte(peca, estado);
  const linha = linhaInterna === null ? undefined : peca.linhasInternas[linhaInterna];
  if (linhaInterna !== null && linha && linha.length >= 2) {
    const marca = marcaDoElemento(linha);
    const livres = indicados.includes(linhaInterna) ? estado.livres.filter((p) => distancia(p, marca) > MESMO_PONTO_MM) : [...estado.livres, marca];
    // O que falta fazer é a instrução da ferramenta que diz: aqui não há recado a dar.
    return { estado: { ...SEM_TRECHO, livres }, recado: null };
  }
  if (indicados.length === 0) return null;
  try {
    const feito = aplicarRemoverPelosElementos(pecas, peca, indicados, livre, novoId, remover);
    return { estado: SEM_TRECHO, recado: feito.recado, pecas: feito.pecas };
  } catch (e) {
    // Os elementos continuam indicados: dá para clicar de novo, do lado certo, ou acertar a lista.
    return { estado, recado: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A prévia do "Remover região" pelos elementos: os elementos em jogo e a
 * linha que eles dão e, com o mouse fora deles, a região que sairia, em
 * destaque. `null` quando não há elemento nenhum em jogo.
 */
export function previaDoRemoverPelosElementos(peca: Molde, estado: TrechoEmEdicao, linhaSobOMouse: number | null, livre: Ponto2D | null): PreviaDeFerramentaDeMolde | null {
  const base = previaDoCortePelosElementos(peca, estado, linhaSobOMouse, true);
  if (!base) return null;
  const indicados = elementosDoCorte(peca, estado);
  if (linhaSobOMouse !== null || !livre || indicados.length === 0) return base;
  try {
    const queSai = separarRegiaoPelosElementos(peca, indicados, livre, 'previa').regiao.contorno;
    return { ...base, substituido: [...queSai, queSai[0]!] };
  } catch {
    return base;
  }
}

/** Um nome que nenhuma peça usa: "Nome (2)", "Nome (3)"… */
export function nomeDaParteNova(nome: string, pecas: readonly Molde[]): string {
  const usados = new Set(pecas.map((p) => p.nome));
  for (let n = 2; ; n++) {
    const candidato = `${nome} (${n})`;
    if (!usados.has(candidato)) return candidato;
  }
}

function trocar(pecas: readonly Molde[], id: string, novas: readonly Molde[]): Molde[] {
  return pecas.flatMap((p) => (p.id === id ? novas : [p]));
}

const DOBRA_SIMPLES: OpcoesDeDobra = { manter: false, fioNoCentro: false };

/**
 * Aplica "Cortar", "Remover região" ou "Dobrar" na peça. Lança erro, sem mudar
 * nada, quando a reta não serve. `dobra` são as opções da janela do "Dobrar";
 * `extras`, as do "Cortar" e do "Remover região".
 */
export function aplicarReta(
  ferramenta: FerramentaDeReta,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  novoId: () => string,
  dobra: OpcoesDeDobra = DOBRA_SIMPLES,
  extras: { readonly corte?: OpcoesDeCorte; readonly remover?: OpcoesDeRemoverRegiao } = {},
): ResultadoDeFerramentaDeMolde {
  if (!estado.inicio || !estado.fim) throw new Error('Indique os dois pontos da reta no contorno da peça.');
  if (ferramenta === 'cortar') {
    const corte = extras.corte ?? CORTE_SEM_COSTURA;
    const [maior, menor] = cortarMoldeComOpcoes(peca, estado.inicio, estado.fim, novoId, corte);
    const nova = { ...menor, nome: nomeDaParteNova(peca.nome, pecas) };
    return { pecas: trocar(pecas, peca.id, [maior, nova]), recado: recadoDoCorte(peca, maior, nova, corte, 0) };
  }
  const remover = extras.remover ?? REMOVER_REGIAO_SIMPLES;
  if (ferramenta === 'remover-regiao' && remover.unir) {
    const [a2, b2] = estado.livres;
    if (!a2 || !b2) throw new Error('Indique as duas retas que delimitam a faixa: dois pontos do contorno para cada uma.');
    const { peca: unida, faixa, degrauMm } = removerFaixaDoMolde(peca, estado.inicio, estado.fim, a2, b2, novoId());
    const guardada = remover.manter ? { ...faixa, nome: nomeDaParteNova(peca.nome, pecas) } : null;
    const degrau =
      degrauMm > 0.05 ? ` As duas retas têm comprimentos diferentes: as bordas ficaram centralizadas, e sobrou um degrau de ${formatarMm(degrauMm / 2)} em cada ponta.` : '';
    return {
      pecas: trocar(pecas, peca.id, guardada ? [unida, guardada] : [unida]),
      recado:
        `Faixa de ${cm2(area(faixa.contorno))} removida de “${peca.nome}”, e as duas partes que sobraram foram unidas: a peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(unida.contorno))}.` +
        (guardada ? ` A faixa virou a peça “${guardada.nome}”.` : '') +
        degrau,
    };
  }
  const lado = estado.livres[0];
  if (!lado) throw new Error('Clique dentro da peça para escolher o lado.');
  if (ferramenta === 'dobrar') {
    const dobrada = dobrarMolde(peca, estado.inicio, estado.fim, lado, dobra);
    return {
      pecas: trocar(pecas, peca.id, [dobrada]),
      recado: `“${peca.nome}” dobrada: ficou o lado clicado, e a reta é a linha de dobra. ${
        dobra.manter
          ? 'A outra metade ficou guardada: “Desdobrar”, nessa aresta, traz ela de volta como era.'
          : '“Desdobrar”, nessa aresta, devolve a outra metade espelhada.'
      }`,
    };
  }
  if (remover.manter) {
    const { peca: sem, regiao } = separarRegiaoDoMolde(peca, estado.inicio, estado.fim, lado, novoId());
    const guardada = { ...regiao, nome: nomeDaParteNova(peca.nome, pecas) };
    return {
      pecas: trocar(pecas, peca.id, [sem, guardada]),
      recado: `Região de ${cm2(area(guardada.contorno))} removida de “${peca.nome}”; ela virou a peça “${guardada.nome}”.`,
    };
  }
  const metade = metadeDoMolde(peca, estado.inicio, estado.fim, lado, 'sai');
  return {
    pecas: trocar(pecas, peca.id, [metade]),
    recado: `Região de ${cm2(area(peca.contorno) - area(metade.contorno))} removida de “${peca.nome}”.`,
  };
}

/** O que a mensagem do "Unir" diz da graduação das duas peças (nada, se nenhuma é graduada). */
function oQueFoiFeitoDaGraduacao(primeira: Molde, segunda: Molde, uniao: OpcoesDeUniao): string {
  const [gA, gB] = [primeira.graduacao, segunda.graduacao];
  if (!gA && !gB) return '';
  if (!gA) return ` A graduação de “${segunda.nome}” não entrou: “${primeira.nome}” não é graduada.`;
  if (!gB) return '';
  const mesmos = gA.base === gB.base && gA.tamanhos.length === gB.tamanhos.length && gA.tamanhos.every((t, i) => t === gB.tamanhos[i]);
  if (!mesmos) return ` A graduação de “${segunda.nome}” não entrou: os tamanhos (ou o base) não são os mesmos de “${primeira.nome}”.`;
  if (!uniao.unirTamanhos) return ` Sem “Unir tamanhos”, ficou só a graduação de “${primeira.nome}”.`;
  return uniao.giro === 'tamanho'
    ? ` Os tamanhos foram unidos, cada tamanho de “${segunda.nome}” encostado no mesmo tamanho de “${primeira.nome}”.`
    : ` Os tamanhos foram unidos, todos girados como o tamanho base.`;
}

/** O que a janela do "Unir moldes" pergunta. */
export function dialogoDeUnir(apenasMover: boolean, uniao: OpcoesDeUniao): { readonly titulo: string; readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    titulo: 'Unir moldes',
    campos: [
      { tipo: 'caixa', id: 'apenasMover', rotulo: 'Apenas mover: a outra peça encosta, mas as duas continuam separadas', inicial: apenasMover },
      { tipo: 'caixa', id: 'unirTamanhos', rotulo: 'Unir tamanhos: a peça unida fica com a graduação das duas (mesmos tamanhos e mesmo base)', inicial: uniao.unirTamanhos },
      {
        tipo: 'escolha',
        id: 'giro',
        rotulo: 'Giro dos tamanhos da outra peça',
        opcoes: [
          { valor: 'base', rotulo: 'Igual base: todos giram como o tamanho base' },
          { valor: 'tamanho', rotulo: 'Igual tamanho: cada tamanho encosta no mesmo tamanho desta peça' },
        ],
        inicial: uniao.giro,
      },
    ],
    nota: 'Depois de confirmar, clique na aresta desta peça por onde as duas se juntam e, em seguida, na aresta da outra peça. A outra gira e encosta, aresta com aresta, centralizada. Unidas, as duas viram uma peça só, com o nome e a linha de fio desta. O manual da referência nomeia “Unir tamanhos” e os dois giros sem dizer a conta; a que está aqui é a nossa leitura.',
  };
}

export function lerDialogoDeUnir(valores: ValoresDoDialogo): { readonly apenasMover: boolean; readonly uniao: OpcoesDeUniao } {
  return { apenasMover: valores.apenasMover === true, uniao: { unirTamanhos: valores.unirTamanhos !== false, giro: valores.giro === 'tamanho' ? 'tamanho' : 'base' } };
}

/** O que a janela do "Cortar" pergunta; `contornoManual` é o "Contorno" que ficou escolhido da última vez. */
export function dialogoDeCortar(opcoes: OpcoesDeCorte, contornoManual = false): { readonly titulo: string; readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    titulo: 'Cortar molde',
    campos: [
      {
        tipo: 'escolha',
        id: 'contorno',
        rotulo: 'Contorno: como o corte por elementos é feito',
        opcoes: [
          { valor: 'automatico', rotulo: 'Automático: o clique num elemento corta por ele na hora' },
          { valor: 'manual', rotulo: 'Manual: indique os elementos que formam a linha do corte e confirme com Enter' },
        ],
        inicial: contornoManual ? 'manual' : 'automatico',
      },
      { tipo: 'medida', id: 'costura', rotulo: 'Costura na borda do corte (mm; 0 = sem costura)', inicial: String(opcoes.costuraMm).replace('.', ',') },
      { tipo: 'caixa', id: 'costuraNasDuas', rotulo: 'Costura 2 moldes: nas duas partes (sem isso, só na peça nova)', inicial: opcoes.costuraNasDuas },
      { tipo: 'caixa', id: 'piques', rotulo: 'Pique em cada ponta da linha do corte, na parte que ganha costura', inicial: opcoes.piques },
      {
        tipo: 'escolha',
        id: 'modo',
        rotulo: 'Modo: como a costura acaba nas pontas',
        opcoes: [
          { valor: 'tangente', rotulo: 'Tangente: segue a direção das arestas vizinhas' },
          { valor: 'reta', rotulo: 'Reta: sai em esquadro com o corte' },
        ],
        inicial: opcoes.modo,
      },
      {
        tipo: 'caixa',
        id: 'manterDistancias',
        rotulo: 'Manter distâncias: na peça graduada, as pontas do corte ficam com a graduação que tinham na peça inteira',
        inicial: opcoes.manterDistancias,
      },
    ],
    nota: 'Depois de confirmar, clique no contorno da peça, onde o corte começa e onde termina — ou numa linha interna dela (o elemento: reta, curva, arco ou linha quebrada), que vira a linha do corte, de borda a borda. No contorno manual, indique os elementos que se emendam ponta com ponta (a até 1 mm) e aperte Enter. O elemento que passa do contorno é aparado nele; o que para antes é prolongado em linha reta até a borda. A parte maior continua sendo a peça; a outra vira uma peça nova. No modo tangente, a aresta vizinha que não chega à borda nova em até quatro vezes a costura acaba em esquadro; num corte que não é reto, confira a costura. O manual da referência não diz qual parte ganha a costura sem “2 moldes” (aqui, a nova), como os elementos se juntam nem o que se faz com o que não chega à borda: é a nossa leitura.',
  };
}

/** O "Contorno" que a janela do "Cortar" entregou: manual (verdadeiro) ou automático. */
export function lerContornoDoCorte(valores: ValoresDoDialogo): boolean {
  return valores.contorno === 'manual';
}

/** As opções do "Cortar" com o que a janela entregou. Lança erro quando a costura não serve. */
export function lerDialogoDeCortar(valores: ValoresDoDialogo): OpcoesDeCorte {
  const opcoes: OpcoesDeCorte = {
    costuraMm: Number(valores.costura),
    costuraNasDuas: valores.costuraNasDuas === true,
    piques: valores.piques === true,
    modo: valores.modo === 'reta' ? 'reta' : 'tangente',
    manterDistancias: valores.manterDistancias !== false,
  };
  conferirOpcoesDeCorte(opcoes);
  return opcoes;
}

/** O que a janela do "Remover região" pergunta. */
export function dialogoDeRemoverRegiao(opcoes: OpcoesDeRemoverRegiao): { readonly titulo: string; readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    titulo: 'Remover região',
    campos: [
      { tipo: 'caixa', id: 'manter', rotulo: 'Manter região do molde: a região tirada vira uma peça nova', inicial: opcoes.manter },
      { tipo: 'caixa', id: 'unir', rotulo: 'Unir moldes: com duas retas, sai a faixa entre elas e as duas partes que sobram são unidas', inicial: opcoes.unir },
    ],
    nota: 'Depois de confirmar, indique a linha que separa a região: dois pontos do contorno, ou uma linha interna da peça (o elemento: reta, curva, arco ou linha quebrada — ou várias emendadas, clicando uma a uma). Sem “Unir moldes”, clique em seguida dentro da região que deve sair. Com “Unir moldes”, as duas linhas têm de ser retas: indique a segunda do mesmo jeito; a faixa entre as duas sai, e a parte que não tem a linha de fio gira e anda até encostar na outra, borda com borda.',
  };
}

export function lerDialogoDeRemoverRegiao(valores: ValoresDoDialogo): OpcoesDeRemoverRegiao {
  return { manter: valores.manter === true, unir: valores.unir === true };
}

const ESC_DA_RETA = ' Esc sai.';

/** A instrução do próximo clique do "Cortar" e do "Remover região"; `corteManual` é o "Contorno manual" do "Cortar". */
export function instrucaoDaReta(
  ferramenta: 'cortar' | 'remover-regiao',
  estado: TrechoEmEdicao,
  remover: OpcoesDeRemoverRegiao = REMOVER_REGIAO_SIMPLES,
  corteManual = false,
): string {
  const ouElemento = ' Ou clique numa linha interna reta da peça: ela vira a reta, de borda a borda.';
  if (ferramenta === 'cortar') {
    if (estado.inicio) return 'Cortar: clique no contorno, onde o corte termina — a peça vira duas, pela reta tracejada.' + ESC_DA_RETA;
    if (!corteManual) {
      return 'Cortar: clique no contorno da peça selecionada, onde o corte começa. Ou clique numa linha interna da peça (reta ou curva): ela vira a linha do corte, de borda a borda.' + ESC_DA_RETA;
    }
    const n = estado.livres.length;
    return n === 0
      ? 'Cortar (contorno manual): clique nas linhas internas que formam a linha do corte, uma a uma, e aperte Enter. Ou clique no contorno, onde um corte reto começa.' + ESC_DA_RETA
      : `Cortar (contorno manual): ${n} ${n === 1 ? 'elemento indicado' : 'elementos indicados'} — clique nos outros, ou aperte Enter para cortar.` + ESC_DA_RETA;
  }
  if (!estado.inicio && !remover.unir) {
    const n = estado.livres.length;
    return n === 0
      ? 'Remover região: clique no contorno da peça selecionada, numa ponta da reta que separa a região. Ou clique numa linha interna da peça (reta ou curva): ela vira a linha que separa a região, de borda a borda.' + ESC_DA_RETA
      : `Remover região: ${n} ${n === 1 ? 'elemento indicado' : 'elementos indicados'} — clique dentro da peça, na região que deve sair (ela fica em destaque). O clique em outra linha interna junta ela à linha; num elemento já indicado, tira ele.` + ESC_DA_RETA;
  }
  if (!estado.inicio) return 'Remover região: clique no contorno da peça selecionada, numa ponta da reta que separa a região.' + ouElemento + ESC_DA_RETA;
  if (!estado.fim) return 'Remover região: clique no contorno, na outra ponta da reta.' + ESC_DA_RETA;
  if (!remover.unir) return 'Remover região: clique dentro da peça, na região que deve sair (ela fica em destaque).' + ESC_DA_RETA;
  return estado.livres.length === 0
    ? 'Remover região (unir): agora a segunda reta — clique no contorno, numa ponta dela, ou numa linha interna reta.' + ESC_DA_RETA
    : 'Remover região (unir): clique no contorno, na outra ponta da segunda reta — a faixa entre as duas sai (fica em destaque).' + ESC_DA_RETA;
}

/**
 * A prévia da reta de corte: a reta até o mouse e, com ela posta, o lado que
 * vai sair em destaque. Com `segundaReta` ("Remover região" unindo), a
 * segunda reta até o mouse e, se ela fecha a faixa, a faixa em destaque.
 */
export function previaDaReta(
  ferramenta: FerramentaDeReta,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  segundaReta = false,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!estado.inicio) return { marcas };
  const ate = estado.fim?.ponto ?? mouse?.noContorno?.ponto ?? mouse?.livre ?? null;
  const novo = ate && distancia(ate, estado.inicio.ponto) > MESMO_PONTO_MM ? [estado.inicio.ponto, ate] : null;
  if (ferramenta === 'remover-regiao' && segundaReta && estado.fim) {
    const todas = [...marcas, ...estado.livres];
    const a2 = estado.livres[0];
    if (!a2) return { novo, marcas: todas };
    const b2 = estado.livres[1] ?? mouse?.noContorno?.ponto ?? null;
    const segunda = [a2, b2 ?? mouse?.livre ?? a2];
    try {
      // Só para saber qual é a faixa: o id e as peças não importam aqui.
      const faixa = b2 ? removerFaixaDoMolde(peca, estado.inicio, estado.fim, a2, b2, 'previa').faixa.contorno : null;
      return { novo, linhas: [segunda], marcas: todas, ...(faixa ? { substituido: [...faixa, faixa[0]!] } : {}) };
    } catch {
      return { novo, linhas: [segunda], marcas: todas };
    }
  }
  if (!estado.fim || ferramenta === 'cortar' || !mouse) return { novo, marcas };
  try {
    // O lado sob o mouse: em "Remover região" é o que sai; em "Dobrar", sai o outro.
    const queSai = metadeDoMolde(peca, estado.inicio, estado.fim, mouse.livre, ferramenta === 'dobrar' ? 'sai' : 'fica').contorno;
    return { novo, substituido: [...queSai, queSai[0]!], marcas };
  } catch {
    return { novo, marcas };
  }
}

/** Aplica a bainha no trecho indicado da peça. */
export function aplicarBainha(
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  opcoes: OpcoesDeBainha,
  novoId: () => string,
): ResultadoDeFerramentaDeMolde {
  if (!estado.inicio || !estado.fim) throw new Error('Indique o começo e o fim da bainha no contorno da peça.');
  const comBainha = criarBainha(peca, estado.inicio, estado.fim, opcoes, novoId);
  const larguras =
    opcoes.largura2Mm !== undefined && opcoes.largura2Mm !== opcoes.larguraMm
      ? `de ${formatarMm(opcoes.larguraMm)} a ${formatarMm(opcoes.largura2Mm)}`
      : `de ${formatarMm(opcoes.larguraMm)}`;
  return {
    pecas: trocar(pecas, peca.id, [comBainha]),
    recado: `Bainha com ${opcoes.dobras} ${opcoes.dobras === 1 ? 'dobra' : 'dobras'} ${larguras} criada em “${peca.nome}”.`,
  };
}

/** A prévia da bainha: o trecho indicado em destaque e a sobra que entraria no contorno. */
export function previaDaBainha(
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  opcoes: OpcoesDeBainha,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!estado.inicio) return { marcas };
  const fim: PosicaoNoContorno | null = estado.fim ?? mouse?.noContorno ?? null;
  if (!fim || distancia(fim.ponto, estado.inicio.ponto) <= MESMO_PONTO_MM) return { marcas };
  const substituido = caminhoDoTrecho(peca.contorno, estado.inicio, fim);
  try {
    const { de, ate, miolo } = geometriaDaBainha(peca, estado.inicio, fim, opcoes);
    return { novo: [de.ponto, ...miolo, ate.ponto], substituido, marcas };
  } catch {
    return { substituido, marcas };
  }
}

/** Aplica "Desdobrar" na aresta indicada da peça; `fioNoCentro` é a opção da janela do "Dobrar". */
export function aplicarDesdobrar(
  pecas: readonly Molde[],
  peca: Molde,
  indiceAresta: number,
  novoId: () => string,
  fioNoCentro = false,
): ResultadoDeFerramentaDeMolde {
  const comAGuardada = desdobraComAMetadeGuardada(peca, indiceAresta);
  const inteira = desdobrarMolde(peca, indiceAresta, novoId, { fioNoCentro });
  const como = comAGuardada
    ? 'a metade que estava guardada voltou como era'
    : peca.dobraMantida
      ? 'a outra metade entrou espelhada — a metade guardada é de outra aresta, ou a dobra foi mexida e ela já não encaixa'
      : 'a outra metade entrou espelhada';
  return {
    pecas: trocar(pecas, peca.id, [inteira]),
    recado: `“${peca.nome}” desdobrada: ${como}. Agora tem ${cm2(area(inteira.contorno))}, e a dobra ficou como linha interna.`,
  };
}

/** A prévia de "Desdobrar": a aresta sob o mouse em destaque e a peça como ficaria. */
export function previaDeDesdobrar(peca: Molde, indiceAresta: number | null): PreviaDeFerramentaDeMolde {
  if (indiceAresta === null) return {};
  try {
    const inteira = desdobrarMolde(peca, indiceAresta, () => 'previa');
    return { novo: inteira.contorno, novoFechado: true, substituido: inteira.linhasInternas.at(-1) ?? null };
  } catch {
    return { substituido: arestaDoContorno(peca.contorno, indiceAresta) };
  }
}

/**
 * Aplica "Unir": a segunda peça encosta na primeira, aresta com aresta, e as
 * duas viram uma só — ou, com `apenasMover`, a segunda só muda de lugar. Só
 * mover não pode deixar a peça numa posição que o sentido do fio dela não
 * permite; unindo, vale o fio da primeira.
 */
export function aplicarUniao(
  pecas: readonly Molde[],
  primeira: Molde,
  arestaDaPrimeira: number,
  segunda: Molde,
  arestaDaSegunda: number,
  apenasMover: boolean,
  uniao: OpcoesDeUniao = UNIAO_PADRAO,
): ResultadoDeFerramentaDeMolde {
  if (primeira.id === segunda.id) throw new Error('Para unir, indique a aresta de outra peça.');
  if (!apenasMover) {
    const unida = unirMoldes(primeira, arestaDaPrimeira, segunda, arestaDaSegunda, uniao);
    return {
      pecas: trocar(pecas, primeira.id, [unida]).filter((p) => p.id !== segunda.id),
      recado:
        `“${segunda.nome}” unida a “${primeira.nome}”: agora são uma peça só, de ${cm2(area(unida.contorno))}, com a linha de fio de “${primeira.nome}”.` +
        oQueFoiFeitoDaGraduacao(primeira, segunda, uniao),
    };
  }
  const encostada = encostarMolde(primeira, arestaDaPrimeira, segunda, arestaDaSegunda);
  if (!rotacaoEhPermitida(encostada.restricaoDeRotacao, encostada.anguloDeRotacaoGraus)) {
    const giro = String(Math.round(encostada.anguloDeRotacaoGraus * 10) / 10).replace('.', ',');
    throw new Error(
      `Para encostar, “${segunda.nome}” ficaria girada ${giro}°, e o sentido do fio dela não permite. Sem “Apenas mover”, as duas viram uma peça só, com o fio de “${primeira.nome}”.`,
    );
  }
  return {
    pecas: trocar(pecas, segunda.id, [encostada]),
    recado: `“${segunda.nome}” encostada em “${primeira.nome}”; as duas continuam separadas.`,
  };
}

/**
 * A prévia de "Unir": a aresta da primeira peça em destaque (a já escolhida
 * ou a que está sob o mouse) e, com o mouse na aresta de outra peça, onde
 * essa peça vai parar.
 */
export function previaDeUnir(
  primeira: Molde,
  arestaEscolhida: number | null,
  arestaSobOMouse: number | null,
  alvo: { readonly peca: Molde; readonly indiceAresta: number } | null,
): PreviaDeFerramentaDeMolde {
  if (arestaEscolhida === null) {
    return arestaSobOMouse === null ? {} : { substituido: arestaDoContorno(primeira.contorno, arestaSobOMouse) };
  }
  const substituido = arestaDoContorno(primeira.contorno, arestaEscolhida);
  if (!alvo) return { substituido };
  try {
    return { novo: encostarMolde(primeira, arestaEscolhida, alvo.peca, alvo.indiceAresta).contorno, novoFechado: true, substituido };
  } catch {
    return { substituido };
  }
}
