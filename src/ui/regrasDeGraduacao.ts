import type { Ponto2D } from '../core/geometria';
import { indiceDoTamanho, type Graduacao } from '../domain/graduacao';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import { paraAbsoluto, paraATela, paraOCampo, paraOMundo } from './tabelaDeGraduacao';

/**
 * Regra de graduação guardada para reuso ("Criar regra" / "Regras"): o
 * deslocamento de um ponto em cada tamanho, com os nomes dos tamanhos. Ao ser
 * aplicada noutra peça, vale pelo nome de cada tamanho.
 */
export interface RegraCadastrada {
  readonly id: string;
  readonly nome: string;
  readonly tamanhos: readonly string[];
  /** O nome do tamanho base da peça de onde a regra saiu. */
  readonly base: string;
  /** O deslocamento em cada tamanho (na ordem de `tamanhos`), em mm, a partir do base. */
  readonly deslocamentos: readonly Ponto2D[];
  /** O código da regra (o "código mesa" da referência): um rótulo curto para achá-la, sem efeito nas contas. */
  readonly codigo?: string;
}

/**
 * Um conjunto de regras: várias regras do cadastro, em ordem. Em uso, cada
 * clique num ponto aplica a regra seguinte do conjunto.
 */
export interface ConjuntoDeRegras {
  readonly id: string;
  readonly nome: string;
  /** Os ids das regras, na ordem em que são aplicadas. */
  readonly regras: readonly string[];
}

const CHAVE = 'enfesto-cad:regras-de-graduacao';

function ehPonto(valor: unknown): valor is Ponto2D {
  const p = valor as { x?: unknown; y?: unknown } | null;
  return typeof p === 'object' && p !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function ehRegra(valor: unknown): valor is RegraCadastrada {
  const r = valor as { id?: unknown; nome?: unknown; tamanhos?: unknown; base?: unknown; deslocamentos?: unknown } | null;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    typeof r.nome === 'string' &&
    typeof r.base === 'string' &&
    Array.isArray(r.tamanhos) &&
    r.tamanhos.length >= 2 &&
    r.tamanhos.every((t) => typeof t === 'string') &&
    Array.isArray(r.deslocamentos) &&
    r.deslocamentos.length === r.tamanhos.length &&
    r.deslocamentos.every(ehPonto)
  );
}

/**
 * As regras cadastradas neste computador. Um conteúdo guardado que não dá
 * para ler vale como lista vazia: o cadastro nunca impede o programa de abrir.
 */
export function lerRegrasCadastradas(armazenamento: Pick<Storage, 'getItem'>): RegraCadastrada[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? '[]');
    return Array.isArray(lido)
      ? lido.filter(ehRegra).map((r) => ({
          id: r.id,
          nome: r.nome,
          tamanhos: r.tamanhos,
          base: r.base,
          deslocamentos: r.deslocamentos,
          ...(typeof r.codigo === 'string' && r.codigo.trim() !== '' ? { codigo: r.codigo.trim() } : {}),
        }))
      : [];
  } catch {
    return [];
  }
}

/** Guarda as regras. Devolve `false` se não deu para gravar. */
export function gravarRegrasCadastradas(armazenamento: Pick<Storage, 'setItem'>, regras: readonly RegraCadastrada[]): boolean {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(regras));
    return true;
  } catch {
    return false;
  }
}

/** Cria a regra cadastrada a partir da regra de um ponto de uma peça graduada. */
export function regraDoPonto(id: string, nome: string, graduacao: Graduacao, deslocamentos: readonly Ponto2D[], codigo = ''): RegraCadastrada {
  if (nome.trim() === '') throw new Error('Dê um nome à regra.');
  return {
    id,
    nome: nome.trim(),
    tamanhos: [...graduacao.tamanhos],
    base: graduacao.tamanhos[graduacao.base]!,
    deslocamentos: deslocamentos.map((d) => ({ x: d.x, y: d.y })),
    ...(codigo.trim() !== '' ? { codigo: codigo.trim() } : {}),
  };
}

// ---------------------------------------------------------------------------
// A janela do "Criar regra": a tabela do ponto, que pode ser mudada antes de guardar
// ---------------------------------------------------------------------------

/** Os valores de uma coluna da tabela, num campo só: um por tamanho, separados por ponto e vírgula. */
function emLista(valores: readonly number[]): string {
  return valores.map(paraOCampo).join('; ');
}

/**
 * O que a janela do "Criar regra" pergunta: o nome, o código e a tabela do
 * ponto — os tamanhos, o base e o DX e o DY de cada tamanho (os da tela,
 * contados do base) —, que pode ser mudada antes de guardar. Criar um
 * tamanho é acrescentar o nome dele e um valor em cada coluna, na mesma
 * posição; excluir é apagar os três; mudar o base é trocar o nome dele.
 */
export function dialogoDeCriarRegra(graduacao: Graduacao, regra: readonly Ponto2D[]): { readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  const naTela = graduacao.tamanhos.map((_, t) => paraATela(regra[t] ?? { x: 0, y: 0 }));
  return {
    campos: [
      { tipo: 'texto', id: 'nome', rotulo: 'Nome da regra', inicial: '' },
      { tipo: 'texto', id: 'codigo', rotulo: 'Código (opcional): um rótulo curto para achar a regra', inicial: '', opcional: true },
      { tipo: 'texto', id: 'tamanhos', rotulo: 'Tamanhos da regra, do menor para o maior, separados por vírgula', inicial: graduacao.tamanhos.join(', ') },
      { tipo: 'texto', id: 'base', rotulo: 'Tamanho base (um dos de cima)', inicial: graduacao.tamanhos[graduacao.base] ?? '' },
      { tipo: 'texto', id: 'dx', rotulo: 'DX de cada tamanho (mm), na mesma ordem, separados por ponto e vírgula', inicial: emLista(naTela.map((d) => d.dx)) },
      { tipo: 'texto', id: 'dy', rotulo: 'DY de cada tamanho (mm), na mesma ordem, separados por ponto e vírgula', inicial: emLista(naTela.map((d) => d.dy)) },
      { tipo: 'caixa', id: 'incremental', rotulo: 'Incremental: os valores digitados são a diferença para o tamanho vizinho, do lado do base', inicial: false },
    ],
    nota:
      'A regra guarda o que um ponto anda em cada tamanho. A tabela vem com o que este ponto anda, e pode ser mudada antes de guardar: para criar um tamanho, acrescente o nome dele em “Tamanhos” e um valor em DX e em DY, na mesma posição; para excluir, apague os três; para mudar o base, troque o nome em “Tamanho base” — os valores passam a ser contados dele. Para dar o mesmo passo a todos os tamanhos, marque “Incremental” e repita o valor. A regra fica no cadastro deste computador, em “Regras”, e vale para as peças que têm esses tamanhos. O código aparece na lista, ao lado do nome; não muda as contas.',
  };
}

/** Os números de uma coluna da tabela, lidos do campo: aceita vírgula ou ponto nas casas, e exige um valor por tamanho. */
function coluna(texto: unknown, nome: string, quantos: number): number[] {
  const partes = String(texto ?? '')
    .split(';')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '');
  const valores = partes.map((parte) => Number(parte.replace(/\s/g, '').replace(',', '.')));
  if (partes.length !== quantos || !valores.every((valor) => Number.isFinite(valor))) {
    throw new Error(`${nome} precisa de um número para cada tamanho (${quantos}), separados por ponto e vírgula.`);
  }
  return valores;
}

/** A regra cadastrada com o que a janela do "Criar regra" entregou. Lança erro, sem guardar nada, quando a tabela não serve. */
export function regraDoDialogo(id: string, valores: ValoresDoDialogo): RegraCadastrada {
  const nome = String(valores.nome ?? '').trim();
  if (nome === '') throw new Error('Dê um nome à regra.');
  const tamanhos = String(valores.tamanhos ?? '')
    .split(/[,;]/)
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '');
  if (tamanhos.length < 2) throw new Error('A regra precisa de pelo menos dois tamanhos: o base e mais um.');
  if (new Set(tamanhos).size !== tamanhos.length) throw new Error('Os tamanhos da regra precisam ter nomes diferentes.');
  const base = String(valores.base ?? '').trim();
  const doBase = tamanhos.indexOf(base);
  if (doBase < 0) throw new Error(`O tamanho base “${base}” não está entre os tamanhos da regra (${tamanhos.join(', ')}).`);
  const [dx, dy] = [coluna(valores.dx, 'DX', tamanhos.length), coluna(valores.dy, 'DY', tamanhos.length)];
  // Incremental: a diferença para o vizinho do lado do base. Senão, cada valor é contado do base: o que foi digitado no base sai de todos.
  const doIncremental = valores.incremental === true;
  const contados = (digitados: number[]): number[] => (doIncremental ? paraAbsoluto(digitados, doBase) : digitados.map((valor) => valor - digitados[doBase]!));
  const [absolutoDx, absolutoDy] = [contados(dx), contados(dy)];
  const codigo = valores.codigo === undefined ? '' : String(valores.codigo).trim();
  return {
    id,
    nome,
    tamanhos,
    base,
    deslocamentos: tamanhos.map((_, t) => {
      const doMundo = paraOMundo({ dx: absolutoDx[t]!, dy: absolutoDy[t]! });
      // Zero negativo não vai para o cadastro.
      return { x: doMundo.x === 0 ? 0 : doMundo.x, y: doMundo.y === 0 ? 0 : doMundo.y };
    }),
    ...(codigo !== '' ? { codigo } : {}),
  };
}

const CHAVE_DOS_CONJUNTOS = 'enfesto-cad:conjuntos-de-regras';
/** Um conjunto tem, no máximo, esta quantidade de regras. */
export const MAXIMO_DE_REGRAS_NO_CONJUNTO = 40;

function ehConjunto(valor: unknown): valor is ConjuntoDeRegras {
  const c = valor as { id?: unknown; nome?: unknown; regras?: unknown } | null;
  return typeof c === 'object' && c !== null && typeof c.id === 'string' && typeof c.nome === 'string' && Array.isArray(c.regras) && c.regras.every((r) => typeof r === 'string');
}

/** Os conjuntos de regras cadastrados neste computador; o que não dá para ler vale como lista vazia. */
export function lerConjuntosDeRegras(armazenamento: Pick<Storage, 'getItem'>): ConjuntoDeRegras[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE_DOS_CONJUNTOS) ?? '[]');
    return Array.isArray(lido) ? lido.filter(ehConjunto).map((c) => ({ id: c.id, nome: c.nome, regras: [...c.regras] })) : [];
  } catch {
    return [];
  }
}

/** Guarda os conjuntos. Devolve `false` se não deu para gravar. */
export function gravarConjuntosDeRegras(armazenamento: Pick<Storage, 'setItem'>, conjuntos: readonly ConjuntoDeRegras[]): boolean {
  try {
    armazenamento.setItem(CHAVE_DOS_CONJUNTOS, JSON.stringify(conjuntos));
    return true;
  } catch {
    return false;
  }
}

/** Cria um conjunto com as regras dadas, na ordem dada. */
export function criarConjuntoDeRegras(id: string, nome: string, regras: readonly string[]): ConjuntoDeRegras {
  if (nome.trim() === '') throw new Error('Dê um nome ao conjunto.');
  if (regras.length < 2) throw new Error('Um conjunto tem pelo menos duas regras: marque-as na ordem em que devem ser aplicadas.');
  if (regras.length > MAXIMO_DE_REGRAS_NO_CONJUNTO) throw new Error(`Um conjunto tem, no máximo, ${MAXIMO_DE_REGRAS_NO_CONJUNTO} regras.`);
  return { id, nome: nome.trim(), regras: [...regras] };
}

/** As regras do conjunto que continuam no cadastro, na ordem dele. */
export function regrasDoConjunto(conjunto: ConjuntoDeRegras, regras: readonly RegraCadastrada[]): RegraCadastrada[] {
  return conjunto.regras.flatMap((id) => regras.filter((r) => r.id === id));
}

/**
 * A regra da vez de um conjunto em uso: a de número `posicao` (contada a
 * partir de 0, dando a volta quando o conjunto acaba). `null` se o conjunto
 * ficou sem regras no cadastro.
 */
export function regraDaVez(conjunto: ConjuntoDeRegras, regras: readonly RegraCadastrada[], posicao: number): { readonly regra: RegraCadastrada; readonly numero: number; readonly total: number } | null {
  const doConjunto = regrasDoConjunto(conjunto, regras);
  if (doConjunto.length === 0) return null;
  const i = ((posicao % doConjunto.length) + doConjunto.length) % doConjunto.length;
  return { regra: doConjunto[i]!, numero: i + 1, total: doConjunto.length };
}

/**
 * A regra cadastrada nos tamanhos da graduação dada, pelo nome de cada
 * tamanho e contada a partir do base dessa graduação. Recusa a regra que não
 * tem algum dos tamanhos da peça.
 */
export function regraParaAGraduacao(regra: RegraCadastrada, graduacao: Graduacao): Ponto2D[] {
  const naRegra = graduacao.tamanhos.map((nome) => indiceDoTamanho(regra.tamanhos, nome));
  const faltam = graduacao.tamanhos.filter((_, t) => naRegra[t]! < 0);
  if (faltam.length > 0) {
    throw new Error(
      `A regra “${regra.nome}” não tem ${faltam.length === 1 ? 'o tamanho' : 'os tamanhos'} ${faltam.join(', ')}: ela foi criada para ${regra.tamanhos.join(', ')}.`,
    );
  }
  const doBase = regra.deslocamentos[naRegra[graduacao.base]!]!;
  return naRegra.map((i) => {
    const d = regra.deslocamentos[i]!;
    return { x: d.x - doBase.x, y: d.y - doBase.y };
  });
}
