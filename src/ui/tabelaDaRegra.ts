import type { Ponto2D } from '../core/geometria';
import { indiceDoTamanho, MAXIMO_DE_TAMANHOS } from '../domain/graduacao';
import { lerMedida } from './medidas';
import type { RegraCadastrada } from './regrasDeGraduacao';
import { paraAbsoluto, paraATela, paraIncremental, paraOCampo, paraOMundo } from './tabelaDeGraduacao';

/**
 * A tabela da janela do "Criar regra": uma linha por tamanho, com o nome dele
 * e o DX e o DY (os da tela) como estão digitados. A regra pode ser mudada
 * antes de ser guardada — tamanhos criados e excluídos, outro base, os
 * números —, e aqui fica cada uma dessas mudanças; a janela só as mostra.
 */
export interface LinhaDaRegra {
  readonly tamanho: string;
  readonly dx: string;
  readonly dy: string;
}

export interface TabelaDaRegra {
  readonly linhas: readonly LinhaDaRegra[];
  /** A linha do tamanho base: os números dela são sempre zero. */
  readonly base: number;
  /** Os números mostrados são a diferença de cada tamanho para o vizinho do lado do base; senão, são contados do base. */
  readonly incremental: boolean;
}

/** A tabela com esses números (contados do base), mostrados do jeito pedido. */
function mostrar(tamanhos: readonly string[], base: number, incremental: boolean, dx: readonly number[], dy: readonly number[]): TabelaDaRegra {
  const doBase = (valores: readonly number[]): number[] => valores.map((valor) => valor - valores[base]!);
  const comoSeVe = (valores: readonly number[]): number[] => (incremental ? paraIncremental(doBase(valores), base) : doBase(valores));
  const [mostradosDx, mostradosDy] = [comoSeVe(dx), comoSeVe(dy)];
  return {
    linhas: tamanhos.map((tamanho, t) => ({ tamanho, dx: paraOCampo(mostradosDx[t]!), dy: paraOCampo(mostradosDy[t]!) })),
    base,
    incremental,
  };
}

/** A tabela como a janela abre: os tamanhos da peça, o base dela e o que o ponto anda em cada um, contado do base. */
export function tabelaDaRegra(tamanhos: readonly string[], base: number, regra: readonly Ponto2D[]): TabelaDaRegra {
  const naTela = tamanhos.map((_, t) => paraATela(regra[t] ?? { x: 0, y: 0 }));
  return mostrar(
    tamanhos,
    base,
    false,
    naTela.map((d) => d.dx),
    naTela.map((d) => d.dy),
  );
}

/** A linha nas mensagens: pelo nome do tamanho ou, enquanto ele não tem nome, pela posição. */
function nomeDaLinha(tabela: TabelaDaRegra, linha: number): string {
  const nome = tabela.linhas[linha]!.tamanho.trim();
  return nome !== '' ? `do tamanho ${nome}` : `da linha ${linha + 1}`;
}

/** O número digitado num campo da tabela; o campo vazio não é zero. */
function numeroDoCampo(texto: string): number | null {
  return texto.trim() === '' ? null : lerMedida(texto);
}

/**
 * Os números da tabela, contados do base (o que está na linha do base não
 * conta: ela é sempre zero). Lança erro dizendo o campo que não é número.
 */
export function valoresDaTabela(tabela: TabelaDaRegra): { readonly dx: number[]; readonly dy: number[] } {
  const coluna = (qual: 'dx' | 'dy'): number[] => {
    const digitados = tabela.linhas.map((linha, t) => {
      if (t === tabela.base) return 0;
      const numero = numeroDoCampo(linha[qual]);
      if (numero === null) throw new Error(`O ${qual === 'dx' ? 'DX' : 'DY'} ${nomeDaLinha(tabela, t)} precisa ser um número em mm.`);
      return numero;
    });
    return tabela.incremental ? paraAbsoluto(digitados, tabela.base) : digitados;
  };
  return { dx: coluna('dx'), dy: coluna('dy') };
}

const nomes = (tabela: TabelaDaRegra): string[] => tabela.linhas.map((linha) => linha.tamanho);

/** Liga ou desliga o "Incremental": a regra é a mesma, os números mostrados é que mudam. */
export function comIncremental(tabela: TabelaDaRegra, ligado: boolean): TabelaDaRegra {
  if (tabela.incremental === ligado) return tabela;
  const { dx, dy } = valoresDaTabela(tabela);
  return mostrar(nomes(tabela), tabela.base, ligado, dx, dy);
}

/** Outro tamanho como base: a regra é a mesma, os números passam a ser contados dele. */
export function comOBaseNa(tabela: TabelaDaRegra, linha: number): TabelaDaRegra {
  if (linha === tabela.base) return tabela;
  const { dx, dy } = valoresDaTabela(tabela);
  return mostrar(nomes(tabela), linha, tabela.incremental, dx, dy);
}

/**
 * Um tamanho novo acima ou abaixo da linha dada, ainda sem nome. Os números
 * dele vêm na proporção dos vizinhos — no meio dos dois, ou continuando o
 * passo de quem está na ponta —, e os dos outros tamanhos não mudam.
 */
export function comTamanhoNovo(tabela: TabelaDaRegra, linha: number, onde: 'acima' | 'abaixo'): TabelaDaRegra {
  if (tabela.linhas.length >= MAXIMO_DE_TAMANHOS) throw new Error(`São aceitos até ${MAXIMO_DE_TAMANHOS} tamanhos.`);
  const { dx, dy } = valoresDaTabela(tabela);
  const posicao = onde === 'acima' ? linha : linha + 1;
  const doNovo = (valores: readonly number[]): number => {
    if (posicao === 0) return valores[0]! - (valores[1]! - valores[0]!);
    if (posicao === valores.length) return valores.at(-1)! + (valores.at(-1)! - valores.at(-2)!);
    return (valores[posicao - 1]! + valores[posicao]!) / 2;
  };
  const inserir = <T>(lista: readonly T[], item: T): T[] => [...lista.slice(0, posicao), item, ...lista.slice(posicao)];
  return mostrar(inserir(nomes(tabela), ''), posicao <= tabela.base ? tabela.base + 1 : tabela.base, tabela.incremental, inserir(dx, doNovo(dx)), inserir(dy, doNovo(dy)));
}

/** A tabela sem o tamanho da linha dada; os números dos outros não mudam. O base não sai, e a regra não fica com menos de dois tamanhos. */
export function semOTamanho(tabela: TabelaDaRegra, linha: number): TabelaDaRegra {
  if (linha === tabela.base) throw new Error('O tamanho base não pode ser excluído: defina outro como base antes.');
  if (tabela.linhas.length <= 2) throw new Error('A regra precisa de pelo menos dois tamanhos: o base e mais um.');
  // O que está digitado na linha que sai não precisa ser número.
  const semErroNaLinha: TabelaDaRegra = {
    ...tabela,
    linhas: tabela.linhas.map((l, t) => (t === linha ? { ...l, dx: numeroDoCampo(l.dx) === null ? '0' : l.dx, dy: numeroDoCampo(l.dy) === null ? '0' : l.dy } : l)),
  };
  const { dx, dy } = valoresDaTabela(semErroNaLinha);
  const tirar = <T>(lista: readonly T[]): T[] => lista.filter((_, t) => t !== linha);
  return mostrar(tirar(nomes(tabela)), linha < tabela.base ? tabela.base - 1 : tabela.base, tabela.incremental, tirar(dx), tirar(dy));
}

/**
 * O mesmo passo em todos os tamanhos: o que a linha dada anda por tamanho
 * passa a valer para todos — os maiores que o base para esse lado, os menores
 * para o outro. A linha dada fica como está. (É a nossa leitura do "mesmo DX
 * e DY para todos os tamanhos" da referência.)
 */
export function comOMesmoPasso(tabela: TabelaDaRegra, linha: number): TabelaDaRegra {
  if (linha === tabela.base) throw new Error('Escolha a linha de um tamanho que não seja o base: é o DX e o DY dela que viram o passo de todos.');
  const { dx, dy } = valoresDaTabela(tabela);
  const tamanhosDoBase = linha - tabela.base;
  // No incremental a linha já mostra o passo dela (com o sinal trocado nos menores que o base); senão, o que ela anda dividido por quantos tamanhos está do base.
  const passo = (qual: 'dx' | 'dy', contados: readonly number[]): number =>
    tabela.incremental ? numeroDoCampo(tabela.linhas[linha]![qual])! * Math.sign(tamanhosDoBase) : contados[linha]! / tamanhosDoBase;
  const [passoDx, passoDy] = [passo('dx', dx), passo('dy', dy)];
  return mostrar(
    nomes(tabela),
    tabela.base,
    tabela.incremental,
    tabela.linhas.map((_, t) => passoDx * (t - tabela.base)),
    tabela.linhas.map((_, t) => passoDy * (t - tabela.base)),
  );
}

/** A regra cadastrada com o que a janela do "Criar regra" tem. Lança erro, sem guardar nada, quando a tabela não serve. */
export function regraDaTabela(id: string, nome: string, codigo: string, tabela: TabelaDaRegra): RegraCadastrada {
  if (nome.trim() === '') throw new Error('Dê um nome à regra.');
  const tamanhos = tabela.linhas.map((linha) => linha.tamanho.trim());
  if (tamanhos.length < 2) throw new Error('A regra precisa de pelo menos dois tamanhos: o base e mais um.');
  const semNome = tamanhos.findIndex((tamanho) => tamanho === '');
  if (semNome >= 0) throw new Error(`Dê um nome ao tamanho da linha ${semNome + 1}.`);
  // Na peça os tamanhos são digitados separados por vírgula: um nome com vírgula nunca casaria com nenhum.
  const comSeparador = tamanhos.find((tamanho) => /[,;]/.test(tamanho));
  if (comSeparador) throw new Error(`O nome do tamanho “${comSeparador}” não pode ter vírgula nem ponto e vírgula.`);
  const repetido = tamanhos.find((tamanho, t) => indiceDoTamanho(tamanhos, tamanho) !== t);
  if (repetido) throw new Error(`O tamanho “${repetido}” aparece mais de uma vez.`);
  const { dx, dy } = valoresDaTabela(tabela);
  return {
    id,
    nome: nome.trim(),
    tamanhos,
    base: tamanhos[tabela.base]!,
    deslocamentos: tamanhos.map((_, t) => {
      const doMundo = paraOMundo({ dx: dx[t]!, dy: dy[t]! });
      // Zero negativo não vai para o cadastro.
      return { x: doMundo.x === 0 ? 0 : doMundo.x, y: doMundo.y === 0 ? 0 : doMundo.y };
    }),
    ...(codigo.trim() !== '' ? { codigo: codigo.trim() } : {}),
  };
}
