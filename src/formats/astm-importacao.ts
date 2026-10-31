import { distancia, ponto, pontoMaisProximoNoContorno, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import type { Graduacao, PontoGraduado } from '../domain/graduacao';
import { criarMolde, type LinhaDeFio, type Molde } from '../domain/molde';
import { dxfParaMundo } from './dxf-importacao';
import type { TabelaDeRegras } from './rul';

/**
 * O DXF ASTM D6673 / AAMA de outros sistemas de modelagem (ADR 0207): é por ele que os moldes de sistemas de formato
 * fechado chegam aqui. Cada peça é um bloco, com os textos "Piece Name:" e "Size:". Há dois jeitos de trazer os tamanhos:
 * - a grade pronta: um bloco por tamanho, com os mesmos pontos; a regra sai da diferença entre eles;
 * - a base e as regras: um bloco só, com "# n" nos pontos, e os valores num arquivo .RUL.
 * Camadas: 1 contorno, 2 e 3 pontos, 4 piques, 6 espelho, 7 fio, 8 linhas internas, 11 recortes, 13 furos, 14 costura.
 */

interface Entidade {
  readonly tipo: string;
  readonly camada: string;
  readonly pontos: Ponto2D[];
  readonly texto: string;
  readonly fechada: boolean;
}

interface BlocoDoAstm {
  readonly nome: string;
  readonly entidades: readonly Entidade[];
}

export interface PecaDoBloco {
  readonly nome: string;
  readonly tamanho: string;
  readonly quantidade: number;
  readonly categoria: string;
  readonly tecido: string;
  readonly contorno: Ponto2D[];
  readonly furos: Ponto2D[][];
  readonly linhas: Ponto2D[][];
  readonly fio: readonly [Ponto2D, Ponto2D] | null;
  readonly espelho: readonly [Ponto2D, Ponto2D] | null;
  readonly piques: Ponto2D[];
  readonly marcas: Ponto2D[];
  /** Os pontos com regra: "# 509" em cima do ponto. */
  readonly regras: ReadonlyArray<{ readonly id: string; readonly ponto: Ponto2D }>;
}

export interface LeituraDoAstm {
  readonly estilo: string;
  readonly tamanhoBase: string;
  readonly mmPorUnidade: number;
  readonly unidadeDeclarada: boolean;
  readonly pecas: readonly PecaDoBloco[];
  readonly avisos: readonly string[];
}

const PROXIMO_MM = 0.01;

function lerPares(conteudo: string): Array<readonly [number, string]> {
  const linhas = conteudo.split(/\r?\n/);
  const pares: Array<readonly [number, string]> = [];
  for (let i = 0; i + 1 < linhas.length; i += 2) {
    const codigo = Number(linhas[i]!.trim());
    if (Number.isFinite(codigo)) pares.push([codigo, linhas[i + 1]!]);
  }
  return pares;
}

/** Os blocos e os textos de fora deles (os do estilo). */
function lerDxf(conteudo: string): { readonly blocos: BlocoDoAstm[]; readonly textos: string[] } {
  const blocos: Array<{ nome: string; entidades: Entidade[] }> = [];
  const textos: string[] = [];
  let bloco: { nome: string; entidades: Entidade[] } | null = null;
  let tipo = '';
  let camada = '';
  let pontos: Array<{ x: number; y: number | null }> = [];
  let texto = '';
  let fechada = false;
  let polilinha: { camada: string; pontos: Ponto2D[]; fechada: boolean } | null = null;
  let lendoCabecalhoDoBloco = false;
  const validos = (): Ponto2D[] => pontos.filter((p): p is { x: number; y: number } => p.y !== null).map((p) => ponto(p.x, p.y));
  const guardar = (e: Entidade): void => {
    if (bloco) bloco.entidades.push(e);
  };
  const fechar = (): void => {
    if (tipo === 'VERTEX' && polilinha) polilinha.pontos.push(...validos());
    else if (tipo === 'TEXT') {
      if (bloco) guardar({ tipo, camada, pontos: validos(), texto, fechada: false });
      else textos.push(texto);
    } else if (tipo === 'LINE' || tipo === 'POINT' || tipo === 'LWPOLYLINE') guardar({ tipo, camada, pontos: validos(), texto: '', fechada });
    tipo = '';
    camada = '';
    pontos = [];
    texto = '';
    fechada = false;
  };
  for (const [codigo, valor] of lerPares(conteudo)) {
    if (codigo === 0) {
      fechar();
      const v = valor.trim();
      if (v === 'BLOCK') {
        bloco = { nome: '', entidades: [] };
        blocos.push(bloco);
        lendoCabecalhoDoBloco = true;
      } else if (v === 'ENDBLK') {
        bloco = null;
      } else if (v === 'POLYLINE') {
        lendoCabecalhoDoBloco = false;
        polilinha = { camada: '', pontos: [], fechada: false };
      } else if (v === 'SEQEND') {
        if (polilinha) guardar({ tipo: 'POLYLINE', camada: polilinha.camada, pontos: polilinha.pontos, texto: '', fechada: polilinha.fechada });
        polilinha = null;
      } else {
        lendoCabecalhoDoBloco = false;
        tipo = v;
      }
      continue;
    }
    if (lendoCabecalhoDoBloco) {
      if (codigo === 2 && bloco) bloco.nome = valor.trim();
      continue;
    }
    if (polilinha && tipo === '') {
      if (codigo === 8) polilinha.camada = valor.trim();
      if (codigo === 70) polilinha.fechada = (Number(valor) & 1) === 1;
      continue;
    }
    if (codigo === 8) camada = valor.trim();
    else if (codigo === 1) texto = valor;
    else if (codigo === 70) fechada = (Number(valor) & 1) === 1;
    else if (codigo === 10 || codigo === 11) pontos.push({ x: Number(valor), y: null });
    else if ((codigo === 20 || codigo === 21) && pontos.length > 0) pontos[pontos.length - 1]!.y = Number(valor);
  }
  return { blocos, textos };
}

/** O valor do texto "Chave: valor"; a chave não liga para maiúsculas. */
function valorDe(textos: readonly string[], chave: string): string {
  const achado = textos.find((t) => t.slice(0, t.indexOf(':') < 0 ? 0 : t.indexOf(':')).trim().toLowerCase() === chave);
  return achado ? achado.slice(achado.indexOf(':') + 1).trim() : '';
}

const iguais = (a: Ponto2D, b: Ponto2D, folga: number): boolean => distancia(a, b) <= folga;

/** Os pedaços de contorno emendados pelas pontas: o contorno pode vir em várias polilinhas. */
function emendar(pedacos: readonly (readonly Ponto2D[])[], folga: number): Ponto2D[] {
  const restantes = pedacos.filter((p) => p.length > 1).map((p) => [...p]);
  const cadeia = restantes.shift() ?? [];
  for (let andou = true; andou && restantes.length > 0; ) {
    andou = false;
    for (let i = 0; i < restantes.length; i++) {
      const r = restantes[i]!;
      const fim = cadeia[cadeia.length - 1]!;
      const inicio = cadeia[0]!;
      if (iguais(r[0]!, fim, folga)) cadeia.push(...r.slice(1));
      else if (iguais(r[r.length - 1]!, fim, folga)) cadeia.push(...r.slice(0, -1).reverse());
      else if (iguais(r[r.length - 1]!, inicio, folga)) cadeia.unshift(...r.slice(0, -1));
      else if (iguais(r[0]!, inicio, folga)) cadeia.unshift(...r.slice(1).reverse());
      else continue;
      restantes.splice(i, 1);
      andou = true;
      break;
    }
  }
  if (cadeia.length > 2 && iguais(cadeia[0]!, cadeia[cadeia.length - 1]!, folga)) cadeia.pop();
  return cadeia;
}

export function ehArquivoAstm(conteudo: string): boolean {
  return /piece name\s*:/i.test(conteudo);
}

export function lerAstm(conteudo: string): LeituraDoAstm {
  const { blocos, textos } = lerDxf(conteudo);
  const avisos: string[] = [];
  const unidade = valorDe(textos, 'units').toUpperCase();
  const mmPorUnidade = unidade === 'ENGLISH' ? 25.4 : 1;
  const folga = PROXIMO_MM / mmPorUnidade;
  const pecas: PecaDoBloco[] = [];
  for (const b of blocos) {
    const dosTextos = b.entidades.filter((e) => e.tipo === 'TEXT');
    const nome = valorDe(dosTextos.map((e) => e.texto), 'piece name');
    if (nome === '') continue;
    const tracos = (camada: string): Ponto2D[][] => b.entidades.filter((e) => e.camada === camada && e.tipo !== 'POINT' && e.tipo !== 'TEXT').map((e) => [...e.pontos]);
    const pontos = (camada: string): Ponto2D[] => b.entidades.filter((e) => e.camada === camada && e.tipo === 'POINT').flatMap((e) => e.pontos);
    const contorno = emendar(tracos('1'), folga);
    if (contorno.length < 3) {
      avisos.push(`A peça "${nome}" (bloco ${b.nome}) não tem contorno na camada 1.`);
      continue;
    }
    const segmento = (camada: string): readonly [Ponto2D, Ponto2D] | null => {
      const t = tracos(camada)[0];
      return t && t.length >= 2 ? [t[0]!, t[t.length - 1]!] : null;
    };
    const textosDoBloco = dosTextos.map((e) => e.texto);
    pecas.push({
      nome,
      tamanho: valorDe(textosDoBloco, 'size'),
      quantidade: Math.max(1, Number.parseInt(valorDe(textosDoBloco, 'quantity'), 10) || 1),
      categoria: valorDe(textosDoBloco, 'category'),
      tecido: valorDe(textosDoBloco, 'fabric') || valorDe(textosDoBloco, 'material'),
      contorno,
      furos: tracos('11').filter((t) => t.length >= 3),
      linhas: [...tracos('8'), ...tracos('14')].filter((t) => t.length >= 2),
      fio: segmento('7'),
      espelho: segmento('6'),
      piques: pontos('4'),
      marcas: pontos('13'),
      regras: dosTextos.flatMap((e) => {
        const id = /^#\s*(\S+)/.exec(e.texto.trim())?.[1];
        return id && e.pontos[0] ? [{ id, ponto: e.pontos[0] }] : [];
      }),
    });
  }
  if (pecas.length === 0) avisos.push('Nenhuma peça: o arquivo não tem blocos com "Piece Name".');
  return { estilo: valorDe(textos, 'style name'), tamanhoBase: valorDe(textos, 'sample size'), mmPorUnidade, unidadeDeclarada: unidade !== '', pecas, avisos };
}

const ordemNatural = (a: string, b: string): number => {
  const [x, y] = [Number(a), Number(b)];
  return Number.isFinite(x) && Number.isFinite(y) && a !== '' && b !== '' ? x - y : 0;
};

/** O vetor do DXF no mundo: o x do desenho é o comprimento (y do mundo), e o y sobe. */
export const vetorDoDxf = (dx: number, dy: number): Ponto2D => ponto(-dy, dx);

export interface PecasDoAstm {
  readonly moldes: readonly Molde[];
  /** O arquivo tem só a base, com "# n": os valores estão num .RUL. */
  readonly pedeRegras: boolean;
  readonly avisos: readonly string[];
}

/** As peças do arquivo: cada nome vira um molde, graduado se houver mais de um tamanho, ou se vier a tabela de regras. */
export function moldesDoAstm(leitura: LeituraDoAstm, novoId: () => string, tabela: TabelaDeRegras | null = null): PecasDoAstm {
  const escala = leitura.mmPorUnidade;
  const avisos = [...leitura.avisos];
  const altura = Math.max(0, ...leitura.pecas.flatMap((p) => p.contorno.map((q) => q.y)));
  const noMundo = (p: Ponto2D): Ponto2D => {
    const q = dxfParaMundo(p, altura);
    return ponto(q.x * escala, q.y * escala);
  };
  const nomes = [...new Set(leitura.pecas.map((p) => p.nome))];
  let pedeRegras = false;
  const moldes = nomes.map((nome) => {
    const doNome = leitura.pecas.filter((p) => p.nome === nome);
    const tamanhos = doNome.map((p) => p.tamanho).sort(ordemNatural);
    const iBase = Math.max(0, tamanhos.indexOf(leitura.tamanhoBase));
    const base = doNome.find((p) => p.tamanho === tamanhos[iBase])!;
    const contorno = base.contorno.map(noMundo);
    const c = retanguloEnvolvente(contorno);
    const fio: LinhaDeFio = base.fio ? { inicio: noMundo(base.fio[0]), fim: noMundo(base.fio[1]) } : { inicio: ponto((c.minX + c.maxX) / 2, c.minY + 0.15 * (c.maxY - c.minY)), fim: ponto((c.minX + c.maxX) / 2, c.maxY - 0.15 * (c.maxY - c.minY)) };
    const molde = criarMolde(
      {
        nome,
        referencia: leitura.estilo,
        tamanho: base.tamanho,
        quantidade: base.quantidade,
        contorno,
        furos: base.furos.map((f) => f.map(noMundo)),
        linhasInternas: base.linhas.map((l) => l.map(noMundo)),
        piques: base.piques.flatMap((q) => {
          const perto = pontoMaisProximoNoContorno(noMundo(q), contorno);
          return perto.distancia <= 1 ? [{ id: novoId(), posicao: perto.ponto, indiceAresta: perto.indiceAresta }] : [];
        }),
        linhaDeFio: fio,
      },
      novoId(),
    );
    const espelho = base.espelho ? arestaEntre(contorno, noMundo(base.espelho[0]), noMundo(base.espelho[1])) : null;
    const comExtras: Molde = {
      ...molde,
      marcas: base.marcas.map((q) => ({ id: novoId(), posicao: noMundo(q) })),
      ...(base.categoria ? { descricao: base.categoria } : {}),
      ...(base.tecido && base.tecido !== '1' ? { tecidoDoMolde: `Tecido ${base.tecido}` } : {}),
      ...(espelho ? { linhaDeSimetria: espelho } : {}),
    };
    if (doNome.length > 1) {
      const graduacao = graduacaoDosBlocos(doNome, tamanhos, base, escala, noMundo, avisos);
      return graduacao ? { ...comExtras, graduacao } : comExtras;
    }
    if (base.regras.length === 0) return comExtras;
    if (!tabela) {
      pedeRegras = true;
      return comExtras;
    }
    const graduacao = graduacaoDasRegras(base, contorno, tabela, escala, noMundo, avisos);
    return graduacao ? { ...comExtras, graduacao } : comExtras;
  });
  return { moldes, pedeRegras, avisos };
}

/** A aresta do contorno cujas pontas são as do espelho; `null` se ele não cai numa aresta. */
function arestaEntre(contorno: readonly Ponto2D[], a: Ponto2D, b: Ponto2D): { readonly de: Ponto2D; readonly ate: Ponto2D } | null {
  const n = contorno.length;
  for (let i = 0; i < n; i++) {
    const p = contorno[i]!;
    const q = contorno[(i + 1) % n]!;
    if ((distancia(p, a) < 0.5 && distancia(q, b) < 0.5) || (distancia(p, b) < 0.5 && distancia(q, a) < 0.5)) return { de: p, ate: q };
  }
  return null;
}

/** A regra de cada ponto, tirada da diferença entre o tamanho e a base. O tamanho com outra contagem de pontos fica de fora. */
function graduacaoDosBlocos(doNome: readonly PecaDoBloco[], tamanhos: readonly string[], base: PecaDoBloco, escala: number, noMundo: (p: Ponto2D) => Ponto2D, avisos: string[]): Graduacao | null {
  const usados = tamanhos.filter((t) => {
    const p = doNome.find((x) => x.tamanho === t)!;
    if (p.contorno.length === base.contorno.length) return true;
    avisos.push(`"${base.nome}", tamanho ${t}: tem outros pontos (${p.contorno.length} contra ${base.contorno.length} da base) e ficou de fora.`);
    return false;
  });
  if (usados.length < 2) return null;
  const pontos: PontoGraduado[] = base.contorno.map((p, i) => ({
    posicao: noMundo(p),
    deslocamentos: usados.map((t) => {
      const q = doNome.find((x) => x.tamanho === t)!.contorno[i]!;
      return vetorDoDxf((q.x - p.x) * escala, (q.y - p.y) * escala);
    }),
  }));
  return { tamanhos: usados, base: usados.indexOf(base.tamanho), pontos };
}

function graduacaoDasRegras(base: PecaDoBloco, contorno: readonly Ponto2D[], tabela: TabelaDeRegras, escala: number, noMundo: (p: Ponto2D) => Ponto2D, avisos: string[]): Graduacao | null {
  const iBase = tabela.tamanhos.indexOf(tabela.tamanhoBase);
  const pontos: PontoGraduado[] = [];
  const semRegra = new Set<string>();
  for (const r of base.regras) {
    const regra = tabela.regras.get(r.id);
    if (!regra) {
      semRegra.add(r.id);
      continue;
    }
    const noContorno = noMundo(r.ponto);
    const posicao = contorno.find((p) => distancia(p, noContorno) < 0.5);
    if (!posicao) continue;
    pontos.push({ posicao, deslocamentos: regra.map((d) => vetorDoDxf(d.x * escala, d.y * escala)) });
  }
  if (semRegra.size > 0) avisos.push(`"${base.nome}": regras que não estão na tabela: ${[...semRegra].join(', ')}.`);
  if (pontos.length === 0) return null;
  return { tamanhos: tabela.tamanhos, base: Math.max(0, iBase), pontos };
}
