import { grupoDaPeca } from './gruposDoEncaixe';
import { area, retanguloEnvolvente, transladarContorno, type Contorno, type Ponto2D } from '../core/geometria';
import { abrirSimetrias } from './anotacoes';
import { alteradaDesdeAImportacao, espelharMolde, linhaDeCorteDaPeca, rotacionarMolde, semGraduacao, transladarMolde, type Molde, type OrigemDaImportacao, type RestricaoDeRotacao } from './molde';
import { moldeDoTamanho } from './tamanhosGraduados';
import { impressaoDigitalDoMolde, TAMANHO_UNICO } from './planoDeCorte';
import { TOLERANCIAS_PADRAO } from './validacao';

/**
 * O modelo (a peça de roupa) como o planejamento de corte o vê, tirado das peças do projeto: quais peças a roupa
 * tem, em que tamanhos cada uma entra, e o que falta ou não confere para encaixar. Nada aqui muda o projeto.
 *
 * - Peça graduada: entra em cada tamanho da graduação, com a forma daquele tamanho.
 * - Peça com tamanho (não graduada): entra só no tamanho dela.
 * - Peça sem tamanho, num projeto que tem tamanhos: entra igual em todos (é dito, para conferir).
 * - Sem tamanho nenhum no projeto: um tamanho só, "Único".
 * - Cópias postas na mesa por um encaixe (`id#n`) contam como uma peça só, com tantas por roupa quanto as cópias.
 * - A peça com linha de simetria entra aberta (inteira); a peça dobrada com a metade guardada precisa ser desdobrada.
 * - A peça entra na orientação em que foi criada ou importada (o giro feito depois é desfeito): as rotações
 *   permitidas valem a partir dela.
 */

export type NivelDoProblema = 'erro' | 'aviso' | 'info';

export interface ProblemaDoModelo {
  readonly nivel: NivelDoProblema;
  /** A peça do projeto (para o atalho "abrir a peça"), quando o problema é de uma. */
  readonly pecaId?: string;
  readonly texto: string;
}

export interface PecaDoModelo {
  /** O id da peça no projeto (das cópias de um encaixe, o da peça original). */
  readonly id: string;
  /** Os ids das peças do projeto que ela representa (a própria, ou as cópias do encaixe). */
  readonly idsNoProjeto: readonly string[];
  readonly nome: string;
  readonly tamanhos: readonly string[];
  readonly graduada: boolean;
  /** Sem tamanho, num projeto com tamanhos: entra em todos. */
  readonly comum: boolean;
  /** Quantas desta peça vão numa roupa, como sugestão: a quantidade da peça, ou o número de cópias na mesa. */
  readonly quantidadeSugerida: number;
  readonly origemDaQuantidade: 'quantidade da peça' | 'cópias na mesa';
  readonly emPar: boolean;
  /** O grupo do encaixe (ADR 0103; `''`: sem grupo). */
  readonly grupo: string;
  readonly restricao: RestricaoDeRotacao;
  readonly larguraMm: number;
  readonly comprimentoMm: number;
  readonly areaMm2: number;
  readonly abertaNaSimetria: boolean;
  readonly origem: OrigemDaImportacao | null;
  /** A forma mudou depois da importação (`null`: não veio de arquivo). */
  readonly alteradaDesdeAImportacao: boolean | null;
}

/** Uma peça pronta para o encaixe num tamanho: na orientação de origem, com o canto da linha de corte em (0, 0). */
export interface PecaParaEncaixe {
  readonly pecaId: string;
  readonly molde: Molde;
}

export interface ModeloDoPlano {
  readonly pecas: readonly PecaDoModelo[];
  readonly tamanhos: readonly string[];
  readonly pecasPorTamanho: Readonly<Record<string, readonly PecaParaEncaixe[]>>;
  readonly problemas: readonly ProblemaDoModelo[];
  readonly impressaoDigital: string;
}

const COPIA_DO_ENCAIXE = /^(.*)#(\d+)$/;

/**
 * O contorno se cruza (duas arestas que não são vizinhas se atravessam)? Só conta a travessia de verdade (uma aresta
 * passando de um lado para o outro da outra). Encostar não conta, nem os pontos repetidos seguidos — como o último
 * ponto igual ao primeiro, comum nos contornos importados: a aresta de comprimento zero que eles fazem não
 * atravessa nada.
 */
export function contornoSeCruza(contorno: Contorno): boolean {
  const pontos = contorno;
  const n = pontos.length;
  if (n < 4) return false;
  const lado = (a: Ponto2D, b: Ponto2D, c: Ponto2D): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const atravessa = (p1: Ponto2D, q1: Ponto2D, p2: Ponto2D, q2: Ponto2D): boolean => {
    const d1 = lado(p1, q1, p2);
    const d2 = lado(p1, q1, q2);
    const d3 = lado(p2, q2, p1);
    const d4 = lado(p2, q2, q1);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (atravessa(pontos[i]!, pontos[(i + 1) % n]!, pontos[j]!, pontos[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

/** A peça na orientação de origem (o giro acumulado desfeito) e, se for a cópia espelhada de um par, desespelhada. */
function naOrientacaoDeOrigem(peca: Molde, espelhada: boolean): Molde {
  const desgirada = peca.anguloDeRotacaoGraus === 0 ? peca : rotacionarMolde(peca, -peca.anguloDeRotacaoGraus);
  return espelhada ? espelharMolde(desgirada, desgirada.id) : desgirada;
}

/** A peça com o canto da linha de corte em (0, 0). */
function naOrigem(peca: Molde): Molde {
  const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(peca));
  return caixa.minX === 0 && caixa.minY === 0 ? peca : transladarMolde(peca, { x: -caixa.minX, y: -caixa.minY }, peca.id);
}

interface Grupo {
  readonly id: string;
  readonly representante: Molde;
  readonly idsNoProjeto: string[];
  copias: number;
  readonly daMesa: boolean;
}

/** As peças do projeto agrupadas: as cópias de um encaixe (`id#n`) viram uma só, representada pela de número mais baixo. */
function agrupar(pecas: readonly Molde[]): Grupo[] {
  const grupos = new Map<string, { menor: number; peca: Molde; ids: string[] }>();
  const soltas: Grupo[] = [];
  for (const peca of pecas) {
    const copia = COPIA_DO_ENCAIXE.exec(peca.id);
    if (!copia) {
      soltas.push({ id: peca.id, representante: peca, idsNoProjeto: [peca.id], copias: peca.quantidade, daMesa: false });
      continue;
    }
    const base = copia[1]!;
    const indice = Number(copia[2]);
    const atual = grupos.get(base);
    if (!atual) grupos.set(base, { menor: indice, peca, ids: [peca.id] });
    else {
      atual.ids.push(peca.id);
      if (indice < atual.menor) {
        atual.menor = indice;
        atual.peca = peca;
      }
    }
  }
  const daMesa = [...grupos].map(([base, g]): Grupo => {
    // Do par, as cópias de número ímpar saíram espelhadas no encaixe: a de origem é a direita.
    const espelhada = g.peca.emPar === true && g.menor % 2 === 1;
    const representante = { ...naOrientacaoDeOrigem(g.peca, espelhada), id: base, quantidade: g.ids.length };
    return { id: base, representante, idsNoProjeto: g.ids, copias: g.ids.length, daMesa: true };
  });
  return [...soltas.map((g) => ({ ...g, representante: naOrientacaoDeOrigem(g.representante, false) })), ...daMesa];
}

export function modeloDoPlano(pecasDoProjeto: readonly Molde[]): ModeloDoPlano {
  const problemas: ProblemaDoModelo[] = [];
  const impressaoDigital = impressaoDigitalDoMolde(pecasDoProjeto);
  if (pecasDoProjeto.length === 0) {
    return { pecas: [], tamanhos: [], pecasPorTamanho: {}, problemas: [{ nivel: 'erro', texto: 'O projeto não tem peças: importe (DXF ou PDF) ou desenhe as peças do modelo antes de planejar.' }], impressaoDigital };
  }
  const grupos = agrupar(pecasDoProjeto);

  // Os tamanhos, na ordem em que aparecem (a da graduação primeiro).
  const tamanhos: string[] = [];
  const incluir = (t: string): void => {
    if (t !== '' && !tamanhos.includes(t)) tamanhos.push(t);
  };
  for (const g of grupos) for (const t of g.representante.graduacao?.tamanhos ?? []) incluir(t.trim());
  for (const g of grupos) if (!g.representante.graduacao) incluir(g.representante.tamanho.trim());
  if (tamanhos.length === 0) tamanhos.push(TAMANHO_UNICO);
  const semTamanhosNoProjeto = tamanhos.length === 1 && tamanhos[0] === TAMANHO_UNICO;

  const pecas: PecaDoModelo[] = [];
  const pecasPorTamanho: Record<string, PecaParaEncaixe[]> = Object.fromEntries(tamanhos.map((t) => [t, []]));

  for (const g of grupos) {
    let peca = g.representante;
    const nome = peca.nome.trim() || '(sem nome)';
    // A forma: precisa ser uma peça de verdade, sem se cruzar.
    if (peca.contorno.length < 3 || !(area(peca.contorno) > 0)) {
      problemas.push({ nivel: 'erro', pecaId: g.idsNoProjeto[0]!, texto: `A peça “${nome}” não tem um contorno válido (menos de 3 pontos ou área zero): corrija ou tire a peça.` });
      continue;
    }
    if (contornoSeCruza(peca.contorno)) {
      problemas.push({ nivel: 'erro', pecaId: g.idsNoProjeto[0]!, texto: `O contorno da peça “${nome}” se cruza: corrija o desenho (aba Manipulação) — uma peça assim não tem um lado de dentro certo para o corte.` });
      continue;
    }
    if (peca.dobraMantida) {
      problemas.push({ nivel: 'erro', pecaId: g.idsNoProjeto[0]!, texto: `A peça “${nome}” está dobrada, com a outra metade guardada: desdobre-a (aba Produção > Desdobrar) para o corte sair inteiro.` });
      continue;
    }
    const abertaNaSimetria = peca.linhaDeSimetria !== undefined;
    if (abertaNaSimetria) peca = abrirSimetrias([peca], () => peca.id)[0]!;

    const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(peca));
    const { dimensaoMinimaPlausivelMm: minimo, dimensaoMaximaPlausivelMm: maximo } = TOLERANCIAS_PADRAO;
    if (Math.min(caixa.largura, caixa.altura) < minimo || Math.max(caixa.largura, caixa.altura) > maximo) {
      problemas.push({
        nivel: 'aviso',
        pecaId: g.idsNoProjeto[0]!,
        texto: `A peça “${nome}” mede ${Math.round(caixa.largura)} × ${Math.round(caixa.altura)} mm, fora do comum: confira a escala ou a unidade do arquivo.`,
      });
    }
    const origem = peca.origemDaImportacao ?? null;
    if (origem?.unidadeAssumida) {
      problemas.push({ nivel: 'aviso', pecaId: g.idsNoProjeto[0]!, texto: `A unidade do arquivo de “${nome}” (${origem.arquivo}) não estava declarada; foi presumida ${origem.unidade}. Confira uma medida conhecida.` });
    }
    const alterada = g.daMesa ? null : alteradaDesdeAImportacao(peca);

    // Os tamanhos da peça, e a forma dela em cada um.
    const graduacao = peca.graduacao;
    const tamanhosDaPeca: string[] = [];
    const comum = !graduacao && peca.tamanho.trim() === '' && !semTamanhosNoProjeto;
    if (graduacao) {
      graduacao.tamanhos.forEach((nomeDoTamanho, t) => {
        try {
          const doTamanho = t === graduacao.base ? { ...semGraduacao(peca), tamanho: nomeDoTamanho } : moldeDoTamanho(peca, t, peca.id);
          pecasPorTamanho[nomeDoTamanho.trim()]!.push({ pecaId: g.id, molde: naOrigem({ ...doTamanho, id: g.id }) });
          tamanhosDaPeca.push(nomeDoTamanho.trim());
        } catch (e) {
          problemas.push({ nivel: 'erro', pecaId: g.idsNoProjeto[0]!, texto: `${e instanceof Error ? e.message : String(e)} A peça “${nome}” fica fora do tamanho ${nomeDoTamanho}.` });
        }
      });
    } else {
      const destino = semTamanhosNoProjeto ? [TAMANHO_UNICO] : comum ? tamanhos : [peca.tamanho.trim()];
      for (const t of destino) {
        pecasPorTamanho[t]!.push({ pecaId: g.id, molde: naOrigem({ ...peca, id: g.id }) });
        tamanhosDaPeca.push(t);
      }
    }
    if (comum) {
      problemas.push({ nivel: 'info', pecaId: g.idsNoProjeto[0]!, texto: `A peça “${nome}” não tem tamanho: entra igual em todos os tamanhos. Se não for comum a todos, informe o tamanho dela.` });
    }
    pecas.push({
      id: g.id,
      idsNoProjeto: g.idsNoProjeto,
      nome,
      tamanhos: tamanhosDaPeca,
      graduada: graduacao !== undefined,
      comum,
      quantidadeSugerida: g.daMesa ? g.copias : peca.quantidade,
      origemDaQuantidade: g.daMesa ? 'cópias na mesa' : 'quantidade da peça',
      emPar: peca.emPar === true,
      grupo: grupoDaPeca(peca),
      restricao: peca.restricaoDeRotacao,
      larguraMm: caixa.largura,
      comprimentoMm: caixa.altura,
      areaMm2: area(linhaDeCorteDaPeca(peca)),
      abertaNaSimetria,
      origem,
      alteradaDesdeAImportacao: alterada,
    });
  }

  // Peças repetidas (mesmo nome, mesmo tamanho, mesma área): cada uma conta como uma peça da roupa.
  for (const t of tamanhos) {
    const porNome = new Map<string, PecaDoModelo[]>();
    for (const p of pecas.filter((x) => x.tamanhos.includes(t))) {
      const chave = p.nome.toLocaleLowerCase('pt-BR');
      porNome.set(chave, [...(porNome.get(chave) ?? []), p]);
    }
    for (const iguais of porNome.values()) {
      if (iguais.length < 2) continue;
      const area0 = iguais[0]!.areaMm2;
      if (!iguais.every((p) => Math.abs(p.areaMm2 - area0) <= area0 * 0.005)) continue;
      problemas.push({
        nivel: 'aviso',
        pecaId: iguais[1]!.idsNoProjeto[0]!,
        texto: `“${iguais[0]!.nome}” aparece ${iguais.length} vezes no tamanho ${t}, com a mesma forma: cada uma conta como uma peça da roupa. Se forem cópias da mesma, deixe uma e use a quantidade por roupa.`,
      });
    }
  }
  for (const t of tamanhos) {
    if (pecasPorTamanho[t]!.length === 0) problemas.push({ nivel: 'erro', texto: `O tamanho ${t} ficou sem nenhuma peça válida.` });
  }
  return { pecas, tamanhos, pecasPorTamanho, problemas, impressaoDigital };
}

/**
 * A quantidade de cada peça numa roupa, como o plano vai usar: a escolhida, ou a sugerida. Diz o que não vale:
 * a peça em par com quantidade ímpar (não fecha direita e esquerda), número que não é inteiro.
 */
export function quantidadesPorRoupa(
  modelo: ModeloDoPlano,
  escolhidas: Readonly<Record<string, number>>,
): { readonly quantidades: Record<string, number>; readonly erros: string[] } {
  const quantidades: Record<string, number> = {};
  const erros: string[] = [];
  for (const p of modelo.pecas) {
    const q = escolhidas[p.id] ?? p.quantidadeSugerida;
    if (!Number.isInteger(q) || q < 0) {
      erros.push(`A quantidade de “${p.nome}” por roupa precisa ser um número inteiro de 0 para cima.`);
      continue;
    }
    if (p.emPar && q % 2 === 1) {
      erros.push(`“${p.nome}” é cortada em pares (direita e esquerda): a quantidade por roupa precisa ser par, e está ${q}.`);
      continue;
    }
    quantidades[p.id] = q;
  }
  if (erros.length === 0 && !modelo.pecas.some((p) => (quantidades[p.id] ?? 0) > 0)) erros.push('Nenhuma peça entra no plano: a quantidade por roupa de todas está 0.');
  return { quantidades, erros };
}

/** A linha de corte de uma peça para o encaixe, no lugar (usada para desenhar e para conferir). */
export function linhaDeCorteNaOrigem(peca: PecaParaEncaixe): Contorno {
  const corte = linhaDeCorteDaPeca(peca.molde);
  const caixa = retanguloEnvolvente(corte);
  return transladarContorno(corte, { x: -caixa.minX, y: -caixa.minY });
}
