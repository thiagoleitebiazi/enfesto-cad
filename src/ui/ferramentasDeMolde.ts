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
  cortarMolde,
  desdobraComAMetadeGuardada,
  desdobrarMolde,
  dobrarMolde,
  encostarMolde,
  metadeDoMolde,
  unirMoldes,
  type OpcoesDeDobra,
} from '../domain/corteEUniao';
import { rotacaoEhPermitida, type Molde } from '../domain/molde';
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

/**
 * A reta está completa: os dois pontos do contorno e, em "Dobrar" e "Remover
 * região", o clique dentro da peça que escolhe o lado.
 */
export function retaCompleta(ferramenta: FerramentaDeReta | 'bainha', estado: TrechoEmEdicao): boolean {
  if (!estado.inicio || !estado.fim) return false;
  return ferramenta === 'cortar' || ferramenta === 'bainha' || estado.livres.length > 0;
}

/**
 * O estado depois de um clique: primeiro os dois pontos do contorno (um clique
 * fora dele, ou no mesmo ponto, não conta) e, nas ferramentas que escolhem um
 * lado, o ponto clicado em seguida.
 */
export function cliqueDeReta(ferramenta: FerramentaDeReta | 'bainha', estado: TrechoEmEdicao, clique: CliqueDeTrecho): TrechoEmEdicao {
  if (retaCompleta(ferramenta, estado)) return estado;
  if (!estado.inicio) return clique.noContorno ? { ...SEM_TRECHO, inicio: clique.noContorno } : estado;
  if (!estado.fim) {
    const fim = clique.noContorno;
    return fim && distancia(fim.ponto, estado.inicio.ponto) > MESMO_PONTO_MM ? { ...estado, fim } : estado;
  }
  return { ...estado, livres: [clique.livre] };
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
 * nada, quando a reta não serve. `dobra` são as opções da janela do "Dobrar".
 */
export function aplicarReta(
  ferramenta: FerramentaDeReta,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  novoId: () => string,
  dobra: OpcoesDeDobra = DOBRA_SIMPLES,
): ResultadoDeFerramentaDeMolde {
  if (!estado.inicio || !estado.fim) throw new Error('Indique os dois pontos da reta no contorno da peça.');
  if (ferramenta === 'cortar') {
    const [maior, menor] = cortarMolde(peca, estado.inicio, estado.fim, novoId());
    const nova = { ...menor, nome: nomeDaParteNova(peca.nome, pecas) };
    return {
      pecas: trocar(pecas, peca.id, [maior, nova]),
      recado: `“${peca.nome}” cortada em duas: ${cm2(area(maior.contorno))} continuam nela e ${cm2(area(nova.contorno))} são a peça nova “${nova.nome}”.`,
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
  const metade = metadeDoMolde(peca, estado.inicio, estado.fim, lado, 'sai');
  return {
    pecas: trocar(pecas, peca.id, [metade]),
    recado: `Região de ${cm2(area(peca.contorno) - area(metade.contorno))} removida de “${peca.nome}”.`,
  };
}

/** A prévia da reta de corte: a reta até o mouse e, com ela posta, o lado que vai sair em destaque. */
export function previaDaReta(
  ferramenta: FerramentaDeReta,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!estado.inicio) return { marcas };
  const ate = estado.fim?.ponto ?? mouse?.noContorno?.ponto ?? mouse?.livre ?? null;
  const novo = ate && distancia(ate, estado.inicio.ponto) > MESMO_PONTO_MM ? [estado.inicio.ponto, ate] : null;
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
): ResultadoDeFerramentaDeMolde {
  if (primeira.id === segunda.id) throw new Error('Para unir, indique a aresta de outra peça.');
  if (!apenasMover) {
    const unida = unirMoldes(primeira, arestaDaPrimeira, segunda, arestaDaSegunda);
    return {
      pecas: trocar(pecas, primeira.id, [unida]).filter((p) => p.id !== segunda.id),
      recado: `“${segunda.nome}” unida a “${primeira.nome}”: agora são uma peça só, de ${cm2(area(unida.contorno))}, com a linha de fio de “${primeira.nome}”.`,
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
