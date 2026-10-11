import { area, distancia, pontoDentroDoContorno, type Ponto2D } from '../core/geometria';
import { dobraPelaLinhaInterna } from '../domain/corteEUniao';
import type { Molde, PenceDaPeca, PregaDaPeca } from '../domain/molde';
import { aberturaDaCunha, alterarCunha, cruzaOContornoMaisDeDuasVezes, cunhaPerto, cunhasDaPeca, faixasDaCunha, fecharCunha } from '../domain/penceComIntersecoes';
import {
  abrirPence,
  alterarPence,
  alterarPenceInterna,
  conferirMedidasDaPence,
  conferirMultiplasPences,
  conferirOpcoesDePenceInterna,
  conferirPontasDaPence,
  criarMultiplasPences,
  criarPence,
  criarPenceInterna,
  diferencaDasPernas,
  dobraDaPence,
  ehVerticeDePence,
  fecharPence,
  MAXIMO_DE_PENCES,
  medidasDaPence,
  medidasDaPenceInterna,
  penceNoVertice,
  pencesDaPeca,
  penceSemRegistroPerto,
  pivoDaPence,
  removerPence,
  transferirPence,
  type DobraDaPence,
  type ModoDePence,
  type OpcoesDePenceInterna,
  type PontasDaPence,
} from '../domain/pences';
import {
  alterarPrega,
  conferirOpcoesDePregas,
  criarPregas,
  faixaDaPrega,
  MAXIMO_DE_PREGAS,
  medidasDaPrega,
  pregasDaPeca,
  removerPrega,
  type ModoDePrega,
  type OpcoesDePregas,
} from '../domain/pregas';
import { pregaSemRegistroPerto } from '../domain/pregasSemRegistro';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { PreviaDeFerramentaDeMolde, ResultadoDeFerramentaDeMolde } from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';

/**
 * Ferramentas do grupo "Pregas e Pences" da aba Produção. Aqui fica o que
 * cada uma pergunta no diálogo, o que cada clique faz, o que o desenho mostra
 * antes de aplicar e o que a faixa de mensagens diz; a geometria é do domínio
 * (`pences.ts` e `pregas.ts`).
 */
export type FerramentaDePence =
  | 'pence-no-contorno'
  | 'pence-interna'
  | 'fechar-pence'
  | 'transferir-pence'
  | 'multiplas-pences'
  | 'pregas';

const FERRAMENTAS_DE_PENCE: ReadonlySet<string> = new Set([
  'pence-no-contorno',
  'pence-interna',
  'fechar-pence',
  'transferir-pence',
  'multiplas-pences',
  'pregas',
]);

export function ehFerramentaDePence(modo: string): modo is FerramentaDePence {
  return FERRAMENTAS_DE_PENCE.has(modo);
}

/** "Pence no contorno" tem, além de recortar e marcar, o abrir por pivô. */
export type ModoDePenceNoContorno = ModoDePence | 'abrir';

/** O que os diálogos das ferramentas deixaram escolhido; cada diálogo abre com o que foi usado por último. */
export interface OpcoesDasPences {
  readonly pence: {
    readonly modo: ModoDePenceNoContorno;
    readonly aberturaMm: number;
    readonly profundidadeMm: number;
    /** O vértice fica em esquadro com o contorno; sem isso, um segundo clique aponta a pence. */
    readonly perpendicular: boolean;
    readonly piquesLaterais: boolean;
    readonly marcaNoVertice: boolean;
    /** "Criar acabamento" (só no Abrir): a pence fica desenhada, sem recortar, e o contorno ganha o bico dela. */
    readonly acabamento: boolean;
    /** "Cortar intersecções" (só no Abrir): a linha até o pivô que sai da peça e volta corta em todos os trechos, e o resultado é uma prega. */
    readonly cortarIntersecoes: boolean;
    /** Com o acabamento: para que lado a pence é dobrada na costura, de quem olha da borda para o vértice (sem lado, o bico fica no meio dos dois). */
    readonly dobraDoAcabamento: DobraDaPence;
  };
  readonly interna: OpcoesDePenceInterna;
  readonly fecharSomenteORecorte: boolean;
  /**
   * "Fechar" e "Transferir": o início, o vértice e o fim da pence são indicados
   * um a um (a pence de pernas curvas). Sem isso, basta o vértice, e as pontas
   * são os pontos vizinhos dele.
   */
  readonly indicarPontas: boolean;
  readonly multiplas: {
    readonly quantidade: number;
    readonly distanciaMm: number;
    readonly aberturaMm: number;
    readonly profundidadeMm: number;
    readonly modo: ModoDePence;
    readonly piquesLaterais: boolean;
    readonly marcaNoVertice: boolean;
  };
  readonly pregas: OpcoesDePregas;
}

export const OPCOES_INICIAIS_DAS_PENCES: OpcoesDasPences = {
  pence: { modo: 'recortar', aberturaMm: 30, profundidadeMm: 100, perpendicular: true, piquesLaterais: true, marcaNoVertice: true, acabamento: false, cortarIntersecoes: false, dobraDoAcabamento: 'meio' },
  interna: { altura1Mm: 80, altura2Mm: 80, larguraMm: 20, anguloGraus: 0, linhaAuxiliar: true, marcas: true },
  fecharSomenteORecorte: false,
  indicarPontas: false,
  multiplas: { quantidade: 2, distanciaMm: 60, aberturaMm: 20, profundidadeMm: 80, modo: 'recortar', piquesLaterais: true, marcaNoVertice: true },
  pregas: { modo: 'simples-direita', quantidade: 1, distanciaMm: 50, larguraMm: 20, piques: true },
};

/** Dois pontos a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;
/** Degrau entre as pontas de uma pence fechada por pivô que já aparece na medida mostrada (mm). */
const DEGRAU_QUE_VALE_AVISAR_MM = 0.05;

function cm2(areaMm2: number): string {
  return `${(areaMm2 / 100).toFixed(1).replace('.', ',')} cm²`;
}

function paraCampo(valor: number): string {
  return String(valor).replace('.', ',');
}

/** O que a ferramenta pede, na ordem: o primeiro ponto, um segundo ponto no contorno e um ponto solto. */
interface CliquesPedidos {
  readonly inicio: 'contorno' | 'vertice-de-pence' | 'nenhum';
  readonly fim: boolean;
  readonly livre: boolean;
}

function cliquesPedidos(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences): CliquesPedidos {
  switch (ferramenta) {
    case 'pence-no-contorno':
      if (opcoes.pence.modo === 'abrir') return { inicio: 'contorno', fim: true, livre: false };
      return { inicio: 'contorno', fim: false, livre: !opcoes.pence.perpendicular };
    case 'pence-interna':
      return { inicio: 'nenhum', fim: false, livre: true };
    case 'fechar-pence':
      return { inicio: 'vertice-de-pence', fim: !opcoes.fecharSomenteORecorte, livre: false };
    case 'transferir-pence':
      return { inicio: 'vertice-de-pence', fim: true, livre: false };
    case 'multiplas-pences':
      return { inicio: 'contorno', fim: false, livre: false };
    case 'pregas':
      return { inicio: 'contorno', fim: true, livre: opcoes.pregas.quantidade > 1 };
  }
}

/** "Fechar" ou "Transferir" com o início, o vértice e o fim da pence indicados um a um. */
function comPontasIndicadas(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences): boolean {
  return opcoes.indicarPontas && (ferramenta === 'fechar-pence' || ferramenta === 'transferir-pence');
}

/**
 * As pontas indicadas, pelo número do ponto no contorno. No estado da
 * ferramenta, o início e o fim ficam nos pontos soltos (nessa ordem) e o
 * vértice, no primeiro ponto do contorno. `undefined` enquanto não há as duas.
 */
export function pontasIndicadas(peca: Molde, estado: TrechoEmEdicao): PontasDaPence | undefined {
  const [inicio, fim] = estado.livres.map((p) => peca.contorno.findIndex((v) => distancia(v, p) < MESMO_PONTO_MM));
  return inicio !== undefined && fim !== undefined && inicio >= 0 && fim >= 0 ? { inicio, fim } : undefined;
}

/** Todos os cliques que a ferramenta pede já foram dados. */
export function penceCompleta(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, estado: TrechoEmEdicao): boolean {
  if (comPontasIndicadas(ferramenta, opcoes)) {
    const pedeDestino = ferramenta === 'transferir-pence' || !opcoes.fecharSomenteORecorte;
    return estado.inicio !== null && estado.livres.length >= 2 && (!pedeDestino || estado.fim !== null);
  }
  const pedidos = cliquesPedidos(ferramenta, opcoes);
  return (
    (pedidos.inicio === 'nenhum' || estado.inicio !== null) &&
    (!pedidos.fim || estado.fim !== null) &&
    (!pedidos.livre || estado.livres.length > 0)
  );
}

/** O estado depois do clique e, quando o clique não serve e vale explicar, o porquê. */
export interface CliqueDePence {
  readonly estado: TrechoEmEdicao;
  readonly recusa: string | null;
  /** O clique caiu numa pence já feita: em vez de criar outra, abre as medidas dela (o id do registro). */
  readonly editar?: string;
  /** O clique caiu numa pence que não tem registro: abre as medidas dela, e é aplicando que ela passa a ter (o registro que teria). */
  readonly reconhecer?: PenceDaPeca;
  /** Com "Pregas": o clique caiu dentro de uma prega já feita, e abre as medidas dela (o id do registro). */
  readonly editarPrega?: string;
  /** Com "Pregas": o clique caiu dentro de uma prega que não tem registro; as medidas abrem, e é aplicando que ela passa a ter (o registro que teria). */
  readonly reconhecerPrega?: PregaDaPeca;
  /** Com "Pregas" ou "Pence no contorno": o clique caiu dentro de uma prega em cunha (a do "Cortar intersecções"), e abre a abertura dela (o id do registro). */
  readonly editarCunha?: string;
}

/** Um clique com a ferramenta de pence ligada: além do que todo clique traz, a pence que está sob ele (se há) — a registrada, ou a que não tem registro. */
export interface CliqueNaPence extends CliqueDeTrecho {
  readonly pence?: string | null;
  readonly semRegistro?: PenceDaPeca | null;
  /** A prega registrada em cuja faixa o clique caiu (se há). */
  readonly prega?: string | null;
  /** A prega sem registro em cuja faixa o clique caiu (se há), com o registro que teria. */
  readonly pregaSemRegistro?: PregaDaPeca | null;
  /** A prega em cunha registrada dentro da qual o clique caiu (se há). */
  readonly cunha?: string | null;
  /** A linha interna da peça que está sob o clique (o número dela), se há. */
  readonly linhaInterna?: number | null;
}

/** O id que a pence reconhecida leva enquanto é só uma candidata (no desenho, sob o mouse). */
export const ID_DA_PENCE_RECONHECIDA = 'pence-reconhecida';
/** O mesmo, para a prega reconhecida. */
export const ID_DA_PREGA_RECONHECIDA = 'prega-reconhecida';

/** A prega em cunha é mexida pela ferramenta que a abriu ("Pence no contorno") e pela "Pregas", que é o que ela é. */
function mexeEmCunha(ferramenta: FerramentaDePence): boolean {
  return ferramenta === 'pregas' || ferramenta === 'pence-no-contorno';
}

/** A prega em cunha registrada dentro da qual o ponto está (o id dela), para as ferramentas que mexem nela. */
export function cunhaSobOClique(ferramenta: FerramentaDePence, peca: Molde, p: Ponto2D): string | null {
  return mexeEmCunha(ferramenta) ? (cunhaPerto(peca, p, 0)?.id ?? null) : null;
}

/** A prega sem registro em cuja faixa o ponto está, com a ferramenta "Pregas" ligada; as outras ferramentas não reconhecem pregas. */
export function pregaSemRegistroSobOClique(ferramenta: FerramentaDePence, peca: Molde, p: Ponto2D, id = ID_DA_PREGA_RECONHECIDA): PregaDaPeca | null {
  return ferramenta === 'pregas' ? pregaSemRegistroPerto(peca, p, 0, id) : null;
}

/**
 * A pence sem registro que está sob o ponto, para a ferramenta ligada: a do
 * contorno (recortada ou marcada) com "Pence no contorno", o losango com
 * "Pence interna". As outras ferramentas não reconhecem nada.
 */
export function penceSemRegistroSobOClique(ferramenta: FerramentaDePence, peca: Molde, p: Ponto2D, raioMm: number, id = ID_DA_PENCE_RECONHECIDA): PenceDaPeca | null {
  if (ferramenta !== 'pence-no-contorno' && ferramenta !== 'pence-interna') return null;
  return penceSemRegistroPerto(peca, p, raioMm, ferramenta === 'pence-interna' ? 'interna' : 'do-contorno', id);
}

const NAO_E_PENCE = 'Esse ponto não é o vértice de uma pence recortada: clique no ponto de dentro do recorte.';
const NAO_E_PONTO = 'Clique num ponto do contorno: o início, o vértice e o fim da pence são pontos dele.';

/**
 * O clique do "Fechar" e do "Transferir" com as pontas indicadas: o início,
 * o vértice e o fim da pence (três pontos do contorno) e, por último, o pivô
 * ou a nova posição, em qualquer lugar do contorno.
 */
function cliqueComPontasIndicadas(peca: Molde, estado: TrechoEmEdicao, clique: CliqueNaPence): CliqueDePence {
  const igual: CliqueDePence = { estado, recusa: null };
  const posicao = clique.noContorno;
  if (!posicao) return igual;
  if (estado.inicio && estado.livres.length >= 2) {
    return distancia(posicao.ponto, estado.inicio.ponto) > MESMO_PONTO_MM ? { estado: { ...estado, fim: posicao }, recusa: null } : igual;
  }
  if (distancia(posicao.ponto, peca.contorno[posicao.indiceAresta]!) >= MESMO_PONTO_MM) return { estado, recusa: NAO_E_PONTO };
  const jaIndicado = [estado.inicio?.ponto, ...estado.livres].some((q) => q !== undefined && distancia(q, posicao.ponto) < MESMO_PONTO_MM);
  if (jaIndicado) return igual;
  if (estado.livres.length === 0) return { estado: { ...SEM_TRECHO, livres: [posicao.ponto] }, recusa: null };
  if (!estado.inicio) return { estado: { ...estado, inicio: posicao }, recusa: null };
  // O fim: com ele, os três pontos precisam formar uma pence recortada.
  const comOFim: TrechoEmEdicao = { ...estado, livres: [estado.livres[0]!, posicao.ponto] };
  try {
    conferirPontasDaPence(peca, estado.inicio.indiceAresta, pontasIndicadas(peca, comOFim)!);
  } catch (e) {
    return { estado, recusa: e instanceof Error ? e.message : String(e) };
  }
  return { estado: comOFim, recusa: null };
}

/**
 * O que um clique faz, na ordem que a ferramenta pede: o primeiro ponto (no
 * contorno, ou no vértice de uma pence recortada), o segundo ponto do
 * contorno e o ponto solto. Um clique que não serve devolve o mesmo estado.
 */
export function cliqueDePence(
  ferramenta: FerramentaDePence,
  opcoes: OpcoesDasPences,
  peca: Molde,
  estado: TrechoEmEdicao,
  clique: CliqueNaPence,
): CliqueDePence {
  const pedidos = cliquesPedidos(ferramenta, opcoes);
  const igual: CliqueDePence = { estado, recusa: null };
  if (penceCompleta(ferramenta, opcoes, estado)) return igual;
  if (comPontasIndicadas(ferramenta, opcoes)) return cliqueComPontasIndicadas(peca, estado, clique);
  // Antes de qualquer ponto: o clique numa pence já feita abre as medidas dela.
  if (!estado.inicio && clique.pence) {
    const pence = pencesDaPeca(peca).find((q) => q.id === clique.pence);
    const daFerramenta =
      pence !== undefined &&
      ((ferramenta === 'pence-no-contorno' && pence.tipo !== 'interna') || (ferramenta === 'pence-interna' && pence.tipo === 'interna'));
    if (pence && daFerramenta) return { estado, recusa: null, editar: pence.id };
  }
  // O clique dentro de uma prega em cunha — e fora do contorno, onde começaria outra coisa — abre a abertura dela.
  if (mexeEmCunha(ferramenta) && !estado.inicio && !clique.noContorno && clique.cunha && cunhasDaPeca(peca).some((q) => q.id === clique.cunha)) {
    return { estado, recusa: null, editarCunha: clique.cunha };
  }
  // Com "Pregas", o clique dentro de uma prega já feita — e fora do contorno, onde começaria outra — abre as medidas dela.
  if (ferramenta === 'pregas' && !estado.inicio && !clique.noContorno && clique.prega && pregasDaPeca(peca).some((q) => q.id === clique.prega)) {
    return { estado, recusa: null, editarPrega: clique.prega };
  }
  // O mesmo com a prega que não tem registro (de projeto antigo, ou desenhada como a ferramenta desenha).
  if (ferramenta === 'pregas' && !estado.inicio && !clique.noContorno && clique.pregaSemRegistro) {
    return { estado, recusa: null, reconhecerPrega: clique.pregaSemRegistro };
  }
  // Ainda com "Pregas": o clique numa linha interna reta (a reta auxiliar) faz dela a linha da prega, de borda a borda.
  if (ferramenta === 'pregas' && !estado.inicio && !clique.noContorno && clique.linhaInterna !== undefined && clique.linhaInterna !== null) {
    try {
      const [a, b] = dobraPelaLinhaInterna(peca, clique.linhaInterna);
      return { estado: { ...SEM_TRECHO, inicio: a, fim: b }, recusa: null };
    } catch (e) {
      return { estado, recusa: (e instanceof Error ? e.message : String(e)).replace('de linha de dobra', 'de linha da prega') };
    }
  }
  // O mesmo com a pence que não tem registro (de projeto antigo, importada ou desenhada à mão).
  if (!estado.inicio && clique.semRegistro) {
    const interna = clique.semRegistro.tipo === 'interna';
    if ((ferramenta === 'pence-no-contorno' && !interna) || (ferramenta === 'pence-interna' && interna)) {
      return { estado, recusa: null, reconhecer: clique.semRegistro };
    }
  }
  if (pedidos.inicio !== 'nenhum' && !estado.inicio) {
    const posicao = clique.noContorno;
    if (!posicao) return igual;
    if (pedidos.inicio === 'vertice-de-pence') {
      const noVertice = distancia(posicao.ponto, peca.contorno[posicao.indiceAresta]!) < MESMO_PONTO_MM;
      if (!noVertice || !ehVerticeDePence(peca, posicao.indiceAresta)) return { estado, recusa: NAO_E_PENCE };
    }
    return { estado: { ...SEM_TRECHO, inicio: posicao }, recusa: null };
  }
  if (pedidos.fim && !estado.fim) {
    const fim = clique.noContorno;
    const serve = fim !== null && (!estado.inicio || distancia(fim.ponto, estado.inicio.ponto) > MESMO_PONTO_MM);
    return serve ? { estado: { ...estado, fim }, recusa: null } : igual;
  }
  return { estado: { ...estado, livres: [clique.livre] }, recusa: null };
}

function trocar(pecas: readonly Molde[], id: string, nova: Molde): Molde[] {
  return pecas.map((p) => (p.id === id ? nova : p));
}

const NOME_DO_MODO: Record<ModoDePenceNoContorno, string> = { recortar: 'recortada', marcar: 'marcada', abrir: 'aberta' };
/** O que a mensagem acrescenta quando a pence fechada ou transferida não tinha registro. */
const CANTO_TRATADO_COMO_PENCE = ' Esse canto não foi feito por uma ferramenta de pence: foi tratado como pence por ser um canto que entra na peça.';
/** O que a mensagem acrescenta quando o início, o vértice e o fim da pence foram indicados um a um. */
const PONTAS_INDICADAS = ' O início, o vértice e o fim da pence foram os pontos indicados.';

/** Aplica a ferramenta na peça, com os cliques dados. Lança erro, sem mudar nada, quando não dá. */
export function aplicarPence(
  ferramenta: FerramentaDePence,
  opcoes: OpcoesDasPences,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  novoId: () => string,
): ResultadoDeFerramentaDeMolde {
  if (!penceCompleta(ferramenta, opcoes, estado)) throw new Error('Faltam pontos para aplicar a ferramenta.');
  const { inicio, fim } = estado;
  const livre = estado.livres[0];
  const pronto = (nova: Molde, recado: string): ResultadoDeFerramentaDeMolde => ({ pecas: trocar(pecas, peca.id, nova), recado });
  const areaDe = (m: Molde): string => cm2(area(m.contorno));
  // "Fechar" e "Transferir": as pontas indicadas uma a uma (se foram) e o que a mensagem diz da pence que não tinha registro.
  const pontas = comPontasIndicadas(ferramenta, opcoes) ? pontasIndicadas(peca, estado) : undefined;
  const semRegistro = pontas ? PONTAS_INDICADAS : inicio && penceNoVertice(peca, inicio.indiceAresta) ? '' : CANTO_TRATADO_COMO_PENCE;

  switch (ferramenta) {
    case 'pence-no-contorno': {
      const { modo, aberturaMm, profundidadeMm, piquesLaterais, marcaNoVertice, perpendicular, acabamento, cortarIntersecoes, dobraDoAcabamento } = opcoes.pence;
      const medidas = `abertura de ${formatarMm(aberturaMm)}, profundidade de ${formatarMm(profundidadeMm)}`;
      // Com "Cortar intersecções", a linha que sai da peça e volta abre a peça em todos os trechos: uma prega, sem vértice.
      if (modo === 'abrir' && cortarIntersecoes && cruzaOContornoMaisDeDuasVezes(peca.contorno, inicio!.ponto, fim!.ponto)) {
        const emPrega = abrirPence(peca, inicio!, fim!, aberturaMm, profundidadeMm, piquesLaterais, novoId, marcaNoVertice, acabamento, true);
        return pronto(
          emPrega,
          `“${peca.nome}” aberta com “Cortar intersecções”: a linha até o pivô sai da peça no caminho, e a peça abriu em todos os trechos dela, ${formatarMm(aberturaMm)} na posição indicada. O resultado é uma prega, sem vértice (a profundidade não conta), com as bordas de cada trecho desenhadas. Para mudar a abertura ou fechá-la, clique dentro dela. A peça passou de ${areaDe(peca)} para ${areaDe(emPrega)}.`,
        );
      }
      const nova =
        modo === 'abrir'
          ? abrirPence(peca, inicio!, fim!, aberturaMm, profundidadeMm, piquesLaterais, novoId, marcaNoVertice, acabamento, cortarIntersecoes, dobraDoAcabamento)
          : criarPence(
              peca,
              inicio!,
              { aberturaMm, profundidadeMm, modo, piquesLaterais, marcaNoVertice },
              novoId,
              perpendicular ? undefined : livre,
            );
      return pronto(
        nova,
        modo === 'marcar'
          ? `Pence marcada em “${peca.nome}”: ${medidas}.`
          : `Pence ${NOME_DO_MODO[modo]} em “${peca.nome}”${modo === 'abrir' && acabamento ? ', com acabamento (desenhada, com o bico no contorno)' : ''}: ${medidas}. A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.`,
      );
    }
    case 'pence-interna':
      return pronto(criarPenceInterna(peca, livre!, opcoes.interna, novoId), `Pence interna desenhada em “${peca.nome}”.`);
    case 'fechar-pence': {
      const nova = fecharPence(peca, inicio!.indiceAresta, opcoes.fecharSomenteORecorte ? null : fim, pontas);
      const mudanca = `A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.${semRegistro}`;
      if (opcoes.fecharSomenteORecorte) {
        return pronto(nova, `Recorte da pence fechado em “${peca.nome}”: o contorno passa reto, e a pence ficou marcada. ${mudanca}`);
      }
      // As pontas só se encontram se estiverem à mesma distância do pivô; senão sobra um degrau, e a mensagem diz de quanto.
      const n = peca.contorno.length;
      const dasPontas = pontas
        ? ([peca.contorno[pontas.inicio]!, peca.contorno[pontas.fim]!] as const)
        : ([peca.contorno[(inicio!.indiceAresta - 1 + n) % n]!, peca.contorno[(inicio!.indiceAresta + 1) % n]!] as const);
      const degrau = Math.abs(distancia(fim!.ponto, dasPontas[0]) - distancia(fim!.ponto, dasPontas[1]));
      const aviso =
        degrau > DEGRAU_QUE_VALE_AVISAR_MM
          ? ` As pontas da pence estão a distâncias diferentes do pivô: sobrou um degrau de ${formatarMm(degrau)} entre elas, para acertar com Mover ponto.`
          : '';
      return pronto(nova, `Pence fechada em “${peca.nome}”, girando em torno do pivô. ${mudanca}${aviso}`);
    }
    case 'transferir-pence': {
      const nova = transferirPence(peca, inicio!.indiceAresta, fim!, pontas);
      // Com as pernas indicadas (curvas), a pence nova tem pernas retas: a área pode mudar um pouco.
      const areas = pontas ? `As pernas da pence nova são retas: a peça passou de ${areaDe(peca)} para ${areaDe(nova)}.` : `A área continua ${areaDe(nova)}.`;
      return pronto(nova, `Pence transferida em “${peca.nome}”, com o mesmo vértice e o mesmo ângulo. ${areas}${semRegistro}`);
    }
    case 'multiplas-pences': {
      const { quantidade, distanciaMm, ...daPence } = opcoes.multiplas;
      const nova = criarMultiplasPences(peca, inicio!, quantidade, distanciaMm, daPence, novoId);
      return pronto(
        nova,
        daPence.modo === 'marcar'
          ? `${quantidade} pences marcadas em “${peca.nome}”, a cada ${formatarMm(distanciaMm)}.`
          : `${quantidade} pences recortadas em “${peca.nome}”, a cada ${formatarMm(distanciaMm)}. A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.`,
      );
    }
    case 'pregas': {
      const nova = criarPregas(peca, inicio!, fim!, opcoes.pregas, livre ?? null, novoId);
      const n = opcoes.pregas.quantidade;
      const tipo = opcoes.pregas.modo === 'dupla' ? (n === 1 ? 'prega dupla aberta' : 'pregas duplas abertas') : n === 1 ? 'prega aberta' : 'pregas abertas';
      return pronto(nova, `${n} ${tipo} em “${peca.nome}”. A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.`);
    }
  }
}

/**
 * A prévia com o mouse onde está: os pontos já clicados e, se o mouse como
 * próximo clique completa a ferramenta, a peça como ficaria — o contorno novo
 * e as linhas que entram. Antes disso, uma reta do primeiro ponto ao mouse.
 */
export function previaDaPence(
  ferramenta: FerramentaDePence,
  opcoes: OpcoesDasPences,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueNaPence | null,
): PreviaDeFerramentaDeMolde {
  // Os pontos já clicados e, nas ferramentas que mexem em pences, o vértice de cada pence registrada.
  const dasPences = ferramenta === 'pregas' || ferramenta === 'multiplas-pences' ? [] : pencesDaPeca(peca).map((pence) => pence.pontos[pence.tipo === 'interna' ? 0 : 1]!);
  // Com "Pregas", o meio de cada prega registrada: é onde se clica para mudá-la.
  const dasPregas = ferramenta === 'pregas' ? pregasDaPeca(peca).map((prega) => meioDaFaixa(faixaDaPrega(prega))) : [];
  // E o meio de cada trecho aberto das pregas em cunha.
  const dasCunhas = mexeEmCunha(ferramenta) ? cunhasDaPeca(peca).flatMap((cunha) => faixasDaCunha(peca, cunha).map(meioDaFaixa)) : [];
  const indicadas = comPontasIndicadas(ferramenta, opcoes) ? estado.livres : [];
  const marcas = [...dasPences, ...dasPregas, ...dasCunhas, ...indicadas, ...[estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined)];
  if (!mouse) return { marcas };
  const cunhaSobOMouse = cliqueDePence(ferramenta, opcoes, peca, estado, mouse).editarCunha;
  const cunhaEmDestaque = cunhaSobOMouse ? cunhasDaPeca(peca).find((q) => q.id === cunhaSobOMouse) : undefined;
  if (cunhaEmDestaque) {
    // Em destaque, o trecho aberto em que o mouse está.
    const faixas = faixasDaCunha(peca, cunhaEmDestaque);
    const faixa = faixas.find((f) => pontoDentroDoContorno(mouse.livre, f)) ?? faixas[0]!;
    return { marcas, substituido: [...faixa, faixa[0]!] };
  }
  const { editarPrega: pregaSobOMouse, reconhecerPrega } = cliqueDePence(ferramenta, opcoes, peca, estado, mouse);
  const pregaEmDestaque = pregaSobOMouse ? pregasDaPeca(peca).find((q) => q.id === pregaSobOMouse) : reconhecerPrega;
  if (pregaEmDestaque) {
    const faixa = faixaDaPrega(pregaEmDestaque);
    return { marcas, substituido: [...faixa, faixa[0]!] };
  }
  // Com o mouse em cima de uma pence já feita, o clique abre as medidas dela: a pence fica em destaque.
  const { editar: sobOMouse, reconhecer } = cliqueDePence(ferramenta, opcoes, peca, estado, mouse);
  const emDestaque = sobOMouse ? pencesDaPeca(peca).find((q) => q.id === sobOMouse) : reconhecer;
  if (emDestaque) {
    return { marcas, substituido: emDestaque.tipo === 'interna' ? [...emDestaque.pontos, emDestaque.pontos[0]!] : emDestaque.pontos };
  }
  const comOMouse = cliqueDePence(ferramenta, opcoes, peca, estado, mouse).estado;
  if (penceCompleta(ferramenta, opcoes, comOMouse)) {
    try {
      const nova = aplicarPence(ferramenta, opcoes, [peca], peca, comOMouse, () => 'previa').pecas[0]!;
      return {
        ...(nova.contorno !== peca.contorno ? { novo: nova.contorno, novoFechado: true } : {}),
        linhas: nova.linhasInternas.slice(peca.linhasInternas.length),
        marcas,
      };
    } catch {
      // O clique não daria certo ali: fica só a reta até o mouse.
    }
  }
  if (!estado.inicio) return { marcas };
  const ate = mouse.noContorno?.ponto ?? mouse.livre;
  return distancia(ate, estado.inicio.ponto) > MESMO_PONTO_MM ? { novo: [estado.inicio.ponto, ate], marcas } : { marcas };
}

/** O meio dos quatro cantos da faixa de uma prega. */
function meioDaFaixa(faixa: readonly Ponto2D[]): Ponto2D {
  return { x: faixa.reduce((s, p) => s + p.x, 0) / faixa.length, y: faixa.reduce((s, p) => s + p.y, 0) / faixa.length };
}

const ESC = ' Esc sai.';

/** A instrução dos três primeiros cliques do "Fechar" e do "Transferir" com as pontas indicadas. */
function instrucaoDasPontas(nome: string, estado: TrechoEmEdicao): string {
  if (estado.livres.length === 0) return nome + ' (pontas indicadas): clique no ponto do contorno onde a pence começa.' + ESC;
  if (!estado.inicio) return nome + ' (pontas indicadas): clique no vértice da pence, o ponto de dentro do recorte.' + ESC;
  return nome + ' (pontas indicadas): clique no ponto do contorno onde a pence termina.' + ESC;
}

/**
 * A instrução do próximo clique, para a faixa de mensagens. `temPences`: a
 * peça tem pences registradas, que um clique pode abrir. `temPregas`: o mesmo
 * para as pregas.
 */
export function instrucaoDaPence(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, estado: TrechoEmEdicao, temPences = false, temPregas = false): string {
  // A pence sem registro (de projeto antigo, importada ou desenhada à mão) também abre as medidas.
  const semRegistro = ferramenta === 'pence-interna' ? 'no losango já desenhado' : 'no vértice de uma pence que já esteja no contorno';
  const ouMudar = temPences
    ? ` Ou clique numa pence já feita (as marcadas com um anel) para mudar as medidas dela; a que não tem anel abre também, ${semRegistro}.`
    : ` Ou clique ${semRegistro}, para mudar as medidas.`;
  switch (ferramenta) {
    case 'pence-no-contorno':
      if (opcoes.pence.modo === 'abrir') {
        return !estado.inicio
          ? 'Pence (abrir): clique no contorno da peça selecionada, onde a pence deve abrir.' + ouMudar + ESC
          : 'Pence (abrir): clique no contorno do lado oposto, no pivô — o lado sem a linha de fio gira em torno dele.' + ESC;
      }
      return !estado.inicio
        ? `Pence (${opcoes.pence.modo}): clique no contorno da peça selecionada, no meio da pence.` + ouMudar + ESC
        : `Pence (${opcoes.pence.modo}): clique dentro da peça, para onde o vértice deve apontar.` + ESC;
    case 'pence-interna':
      return 'Pence interna: clique dentro da peça selecionada, no centro da pence.' + ouMudar + ESC;
    case 'fechar-pence':
      if (comPontasIndicadas(ferramenta, opcoes) && !(estado.inicio && estado.livres.length >= 2)) return instrucaoDasPontas('Fechar pence', estado);
      return !estado.inicio
        ? 'Fechar pence: clique no vértice da pence recortada (o ponto de dentro do recorte).' + ESC
        : 'Fechar pence: clique no contorno, no pivô — o lado sem a linha de fio gira em torno dele até a pence fechar.' + ESC;
    case 'transferir-pence':
      if (comPontasIndicadas(ferramenta, opcoes) && !(estado.inicio && estado.livres.length >= 2)) return instrucaoDasPontas('Transferir pence', estado);
      return !estado.inicio
        ? 'Transferir pence: clique no vértice da pence recortada (o ponto de dentro do recorte).' + ESC
        : 'Transferir pence: clique no contorno, na nova posição da pence.' + ESC;
    case 'multiplas-pences':
      return 'Múltiplas pences: clique no contorno da peça selecionada, no meio do grupo de pences.' + ESC;
    case 'pregas':
      if (!estado.inicio) {
        // A prega sem registro abre do mesmo jeito (fica em destaque sob o mouse); a instrução só fala disso quando a peça tem pregas.
        const ouMudarPrega = temPregas
          ? ' Ou clique dentro de uma prega já feita (as marcadas com um anel) para mudar as larguras dela ou tirá-la; a que não tem anel abre também, se está desenhada como a ferramenta desenha.'
          : '';
        return (
          'Pregas: clique no contorno da peça selecionada, numa ponta da linha da prega — ou numa linha interna reta (a reta auxiliar), que vira a linha da prega, de borda a borda.' +
          ouMudarPrega +
          ESC
        );
      }
      return !estado.fim
        ? 'Pregas: clique no contorno, na outra ponta da linha da prega.' + ESC
        : 'Pregas: clique do lado em que as outras pregas devem ficar.' + ESC;
  }
}

const MODOS_DE_PREGA: ReadonlyArray<{ readonly valor: ModoDePrega; readonly rotulo: string }> = [
  { valor: 'simples-direita', rotulo: 'Simples, dobrada para a direita' },
  { valor: 'simples-esquerda', rotulo: 'Simples, dobrada para a esquerda' },
  { valor: 'dupla', rotulo: 'Dupla: duas dobras que se encontram no meio' },
];

/** O que a explicação do diálogo diz antes, quando a prega não tinha registro. */
const NOTA_DA_PREGA_RECONHECIDA =
  'Esta prega não tinha registro (veio de um projeto antigo ou foi desenhada à mão): foi reconhecida pelo desenho — as duas bordas da abertura e as linhas de dobra entre elas —, e as medidas abaixo foram lidas dele. O lado da linha de fio foi tomado como o que ficou parado; sem seta, a prega foi tomada como dobrada para a direita. Aplicando, ela passa a ter registro; fechando sem aplicar, nada muda. ';

/** O diálogo das medidas de uma prega já feita; `null` se ela não está mais na peça como foi posta. `reconhecida`: a prega não tinha registro. */
export function dialogoDeEditarPrega(peca: Molde, id: string, reconhecida = false): DialogoDePence | null {
  const prega = pregasDaPeca(peca).find((q) => q.id === id);
  if (!prega) return null;
  const { modo, larguraMm, largura2Mm } = medidasDaPrega(prega);
  return {
    titulo: 'Prega: medidas',
    campos: [
      { tipo: 'escolha', id: 'modo', rotulo: 'Modo', opcoes: MODOS_DE_PREGA, inicial: modo },
      { tipo: 'medida', id: 'largura', rotulo: 'Largura na primeira ponta da linha (mm)', inicial: paraCampo(arredondar(larguraMm)) },
      { tipo: 'medida', id: 'largura2', rotulo: 'Largura na segunda ponta (mm)', inicial: paraCampo(arredondar(largura2Mm)) },
      { tipo: 'caixa', id: 'apagar', rotulo: 'Tirar esta prega (a peça fecha de volta)', inicial: false },
    ],
    nota: (reconhecida ? NOTA_DA_PREGA_RECONHECIDA : '') + 'A prega é tirada e aberta de novo na mesma linha, com o modo e as larguras novos: o lado da peça que andou volta e anda de novo, levando o que está nele. Tirando a prega, esse lado volta para junto do outro, e as linhas de dobra, as setas e os piques dela saem.',
  };
}

/** Aplica o diálogo das medidas na prega: muda-a ou, com "Tirar", fecha a peça de volta. Lança erro quando as medidas não servem. */
export function aplicarEdicaoDaPrega(pecas: readonly Molde[], peca: Molde, id: string, valores: ValoresDoDialogo, novoId: () => string): ResultadoDeFerramentaDeMolde {
  if (!pregasDaPeca(peca).some((q) => q.id === id)) throw new Error('Essa prega foi mexida à mão e já não pode ser mudada pelas medidas.');
  const areas = (nova: Molde): string => `A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(nova.contorno))}.`;
  if (valores.apagar === true) {
    const sem = removerPrega(peca, id);
    return { pecas: trocar(pecas, peca.id, sem), recado: `Prega tirada de “${peca.nome}”: o lado que tinha andado voltou. ${areas(sem)}` };
  }
  const modo = MODOS_DE_PREGA.find((m) => m.valor === valores.modo)?.valor ?? 'simples-direita';
  const medidas = { modo, larguraMm: Number(valores.largura), largura2Mm: Number(valores.largura2) };
  const nova = alterarPrega(peca, id, medidas, novoId);
  const larguras =
    Math.abs(medidas.larguraMm - medidas.largura2Mm) < 0.005
      ? `largura de ${formatarMm(medidas.larguraMm)}`
      : `larguras de ${formatarMm(medidas.larguraMm)} e ${formatarMm(medidas.largura2Mm)}`;
  return {
    pecas: trocar(pecas, peca.id, nova),
    recado: `Prega de “${peca.nome}” aberta de novo: ${modo === 'dupla' ? 'dupla' : 'simples'}, ${larguras}. ${areas(nova)}`,
  };
}

/** O diálogo da abertura de uma prega em cunha já feita; `null` se ela não está mais na peça como foi aberta. */
export function dialogoDeEditarCunha(peca: Molde, id: string): DialogoDePence | null {
  const cunha = cunhasDaPeca(peca).find((q) => q.id === id);
  if (!cunha) return null;
  return {
    titulo: 'Prega em cunha: abertura',
    campos: [
      { tipo: 'medida', id: 'abertura', rotulo: 'Abertura na posição da pence: de uma ponta à outra (mm)', inicial: paraCampo(arredondar(aberturaDaCunha(cunha))) },
      { tipo: 'caixa', id: 'apagar', rotulo: 'Fechar esta prega (a peça volta a ser a de antes de abrir)', inicial: false },
    ],
    nota: 'Esta prega foi aberta com “Pence no contorno”, no Abrir, com “Cortar intersecções”: a peça foi cortada em todos os trechos da linha até o pivô, e um lado girou em torno dele. Mudando a abertura, a peça fecha em torno do mesmo pivô e abre de novo com a abertura nova. Fechando, o lado que girou volta, levando o que está nele, e as bordas desenhadas e os piques da prega saem. O manual da referência não diz como mudar ou fechar essa prega: é a nossa leitura.',
  };
}

/** Aplica o diálogo da prega em cunha: muda a abertura ou, com "Fechar", fecha a peça de volta. Lança erro quando a abertura não serve. */
export function aplicarEdicaoDaCunha(pecas: readonly Molde[], peca: Molde, id: string, valores: ValoresDoDialogo, novoId: () => string): ResultadoDeFerramentaDeMolde {
  if (!cunhasDaPeca(peca).some((q) => q.id === id)) throw new Error('Essa prega foi mexida à mão e já não pode ser mudada pela abertura.');
  const areas = (nova: Molde): string => `A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(nova.contorno))}.`;
  if (valores.apagar === true) {
    const fechada = fecharCunha(peca, id);
    return { pecas: trocar(pecas, peca.id, fechada), recado: `Prega em cunha de “${peca.nome}” fechada: o lado que tinha girado voltou. ${areas(fechada)}` };
  }
  const aberturaMm = Number(valores.abertura);
  const nova = alterarCunha(peca, id, aberturaMm, novoId);
  return { pecas: trocar(pecas, peca.id, nova), recado: `Prega em cunha de “${peca.nome}” aberta de novo em torno do pivô: ${formatarMm(aberturaMm)} na posição da pence. ${areas(nova)}` };
}

/** O campo do lado para onde a pence com acabamento é dobrada, o mesmo ao abrir a pence e ao mudar as medidas dela. */
function campoDaDobra(id: string, inicial: DobraDaPence): CampoDoDialogo {
  return {
    tipo: 'escolha',
    id,
    rotulo: 'No acabamento, a pence é dobrada (de quem olha da borda para o vértice)',
    opcoes: [
      { valor: 'meio', rotulo: 'Sem lado: o bico fica no meio' },
      { valor: 'esquerda', rotulo: 'Para a esquerda' },
      { valor: 'direita', rotulo: 'Para a direita' },
    ],
    inicial,
  };
}

/** O lado da dobra lido do campo; o que não é um lado vale "sem lado". */
function dobraLida(valor: unknown): DobraDaPence {
  return valor === 'esquerda' || valor === 'direita' ? valor : 'meio';
}

const NOME_DA_DOBRA: Record<DobraDaPence, string> = { meio: 'sem lado de dobra, com o bico no meio', esquerda: 'dobrado para a esquerda', direita: 'dobrado para a direita' };

/** O que a explicação das medidas diz a mais quando a pence tem acabamento. */
const NOTA_DO_ACABAMENTO =
  ' O acabamento é refeito para as medidas novas e para o lado da dobra escolhido: dobrada para um lado, a borda desse lado, espelhada na perna, até a linha da dobra da pence (a que divide ao meio o ângulo das pernas) — numa borda curva, o acabamento acompanha a curva; sem lado, o bico fica no meio dos dois.';

/** O que a explicação diz a mais na pence com acabamento que tem o campo do desvio. */
const NOTA_DO_DESVIO_NO_ACABAMENTO =
  ' Com desvio do vértice as pernas ficam com comprimentos diferentes: costurada a pence, as bordas dos dois lados se desencontram. O acabamento mostra essa diferença como um degrau na ponta de uma das pernas, e a mensagem diz de quanto.';

/**
 * O que a mensagem diz a mais quando a pence com acabamento ficou com pernas
 * de comprimentos diferentes: de quanto, o que isso dá na costura e como
 * aparece no desenho.
 */
function avisoDasPernas(pence: PenceDaPeca | undefined): string {
  if (!pence?.bico) return '';
  const diferenca = Math.abs(diferencaDasPernas(pence));
  if (diferenca === 0) return '';
  const naCostura = ` As pernas ficaram com ${formatarMm(diferenca, diferenca < 0.1 ? 2 : 1)} de diferença: costurada a pence, as bordas dos dois lados se desencontram isso.`;
  const noDesenho = pence.dobra === undefined ? '' : ' O acabamento foi feito pela dobra de verdade (a bissetriz das pernas), e a diferença aparece nele como um degrau, na ponta da outra perna.';
  return `${naCostura}${noDesenho} Para igualar as pernas, zere o desvio do vértice.`;
}

/** O que a explicação do diálogo diz antes, quando a pence não tinha registro. */
const NOTA_DA_RECONHECIDA =
  'Esta pence não tinha registro (veio de um projeto antigo, de uma peça importada ou foi desenhada à mão): foi reconhecida pelo desenho, e as medidas abaixo foram lidas dele. Aplicando, ela passa a ter registro; fechando sem aplicar, nada muda. ';

/**
 * O diálogo das medidas de uma pence já feita; `null` se ela não está mais na
 * peça como foi posta. `reconhecida`: a pence não tinha registro, e a peça
 * dada já vem com o registro que ela teria (`comPenceReconhecida`).
 */
export function dialogoDeEditarPence(peca: Molde, id: string, reconhecida = false): DialogoDePence | null {
  const dialogo = dialogoDasMedidas(peca, id);
  return dialogo && reconhecida ? { ...dialogo, nota: NOTA_DA_RECONHECIDA + dialogo.nota } : dialogo;
}

function dialogoDasMedidas(peca: Molde, id: string): DialogoDePence | null {
  const pence = pencesDaPeca(peca).find((q) => q.id === id);
  if (!pence) return null;
  const apagar: CampoDoDialogo = { tipo: 'caixa', id: 'apagar', rotulo: 'Apagar esta pence', inicial: false };
  if (pence.tipo === 'interna') {
    const { altura1Mm, altura2Mm, larguraMm } = medidasDaPenceInterna(pence);
    return {
      titulo: 'Pence interna: medidas',
      campos: [
        { tipo: 'medida', id: 'altura1', rotulo: 'Altura 1: do centro à ponta (mm)', inicial: paraCampo(arredondar(altura1Mm)) },
        { tipo: 'medida', id: 'altura2', rotulo: 'Altura 2: do centro à outra ponta (mm)', inicial: paraCampo(arredondar(altura2Mm)) },
        { tipo: 'medida', id: 'largura', rotulo: 'Largura no centro (mm)', inicial: paraCampo(arredondar(larguraMm)) },
        apagar,
      ],
      nota: 'O losango é refeito no mesmo centro e na mesma direção, com as medidas novas. Apagando, as linhas e as marcas da pence saem da peça.',
    };
  }
  const { aberturaMm, profundidadeMm, desvioMm } = medidasDaPence(pence);
  const dobra = pence.bico ? [campoDaDobra('dobra', dobraDaPence(pence))] : [];
  const doAcabamento = pence.bico ? NOTA_DO_ACABAMENTO : '';
  if (pivoDaPence(peca, pence)) {
    // Aberta por pivô: o vértice fica sempre na linha do meio das pontas ao pivô, então não há desvio a pedir.
    return {
      titulo: 'Pence aberta por pivô: medidas',
      campos: [
        { tipo: 'medida', id: 'abertura', rotulo: 'Abertura: de uma ponta à outra (mm)', inicial: paraCampo(arredondar(aberturaMm)) },
        { tipo: 'medida', id: 'profundidade', rotulo: 'Profundidade: do meio das pontas ao vértice (mm)', inicial: paraCampo(arredondar(profundidadeMm)) },
        ...dobra,
        { ...apagar, rotulo: 'Fechar esta pence (a peça volta a ser a de antes de abrir)' },
      ],
      nota:
        'A pence foi aberta girando um lado da peça em torno do pivô. Mudando as medidas, a peça fecha em torno do mesmo pivô e abre de novo com a abertura nova — o tecido que a abertura acrescenta muda junto. Fechando, o lado que girou volta ao lugar.' +
        doAcabamento,
    };
  }
  return {
    titulo: pence.tipo === 'recortada' ? 'Pence recortada: medidas' : 'Pence marcada: medidas',
    campos: [
      { tipo: 'medida', id: 'abertura', rotulo: 'Abertura: de uma ponta à outra (mm)', inicial: paraCampo(arredondar(aberturaMm)) },
      { tipo: 'medida', id: 'profundidade', rotulo: 'Profundidade: do meio das pontas ao vértice (mm)', inicial: paraCampo(arredondar(profundidadeMm)) },
      {
        tipo: 'medida',
        id: 'desvio',
        rotulo: 'Desvio do vértice para o lado (mm; 0 = em esquadro)',
        inicial: paraCampo(arredondar(desvioMm)),
      },
      ...dobra,
      apagar,
    ],
    nota:
      pence.tipo === 'recortada'
        ? 'A pence é refeita no mesmo lugar, com as medidas novas: o contorno volta a ser o de antes do recorte e é recortado de novo. O desvio leva o vértice para o lado da segunda ponta (negativo, para o da primeira). Apagando, o contorno fica como era antes da pence.'
        : 'A pence é refeita no mesmo lugar, com as medidas novas. O desvio leva o vértice para o lado da segunda ponta (negativo, para o da primeira). Apagando, a linha, os piques e a marca dela saem da peça.' +
          doAcabamento +
          (pence.bico ? NOTA_DO_DESVIO_NO_ACABAMENTO : ''),
  };
}

/** Uma medida lida dos pontos, sem as casas que só vêm das contas. */
function arredondar(valor: number): number {
  const arredondado = Math.round(valor * 100) / 100;
  return arredondado === 0 ? 0 : arredondado;
}

/**
 * Aplica o diálogo das medidas na pence: muda-as ou, com "Apagar", tira a
 * pence. Lança erro quando as medidas não servem. A pence aberta por pivô é
 * fechada e aberta de novo em torno dele.
 */
export function aplicarEdicaoDaPence(
  pecas: readonly Molde[],
  peca: Molde,
  id: string,
  valores: ValoresDoDialogo,
  novoId: () => string,
): ResultadoDeFerramentaDeMolde {
  const pence = pencesDaPeca(peca).find((q) => q.id === id);
  if (!pence) throw new Error('Essa pence foi mexida à mão e já não pode ser mudada pelas medidas.');
  const numero = (campo: string): number => Number(valores[campo]);
  const porPivo = pivoDaPence(peca, pence) !== null;
  // Só a pence com acabamento tem lado de dobra a mudar; sem o campo, ela continua dobrada para onde estava.
  const dobra = pence.bico && valores.dobra !== undefined ? dobraLida(valores.dobra) : undefined;
  const doAcabamento = dobra ? ` O acabamento ficou ${NOME_DA_DOBRA[dobra]}.` : '';
  if (valores.apagar === true) {
    const sem = removerPence(peca, id);
    const mudanca = `A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(sem.contorno))}.`;
    return {
      pecas: trocar(pecas, peca.id, sem),
      recado: porPivo
        ? `Pence fechada em “${peca.nome}”, em torno do pivô em que foi aberta: a peça voltou a ser a de antes. ${mudanca}`
        : pence.tipo === 'recortada'
          ? `Pence apagada de “${peca.nome}”: o contorno voltou a ser o de antes dela. ${mudanca}`
          : `Pence apagada de “${peca.nome}”.`,
    };
  }
  if (porPivo) {
    const medidas = { aberturaMm: numero('abertura'), profundidadeMm: numero('profundidade'), desvioMm: 0 };
    const nova = alterarPence(peca, id, medidas, novoId, dobra);
    return {
      pecas: trocar(pecas, peca.id, nova),
      recado: `Pence de “${peca.nome}” aberta de novo em torno do pivô: abertura de ${formatarMm(medidas.aberturaMm)}, profundidade de ${formatarMm(medidas.profundidadeMm)}. A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(nova.contorno))}.${doAcabamento}`,
    };
  }
  if (pence.tipo === 'interna') {
    const medidas = { altura1Mm: numero('altura1'), altura2Mm: numero('altura2'), larguraMm: numero('largura') };
    return {
      pecas: trocar(pecas, peca.id, alterarPenceInterna(peca, id, medidas, novoId)),
      recado: `Pence interna de “${peca.nome}” refeita: alturas de ${formatarMm(medidas.altura1Mm)} e ${formatarMm(medidas.altura2Mm)}, largura de ${formatarMm(medidas.larguraMm)}.`,
    };
  }
  const medidas = { aberturaMm: numero('abertura'), profundidadeMm: numero('profundidade'), desvioMm: numero('desvio') };
  const nova = alterarPence(peca, id, medidas, novoId, dobra);
  const desvio = medidas.desvioMm === 0 ? '' : `, desvio de ${formatarMm(medidas.desvioMm)}`;
  return {
    pecas: trocar(pecas, peca.id, nova),
    recado:
      `Pence de “${peca.nome}” refeita: abertura de ${formatarMm(medidas.aberturaMm)}, profundidade de ${formatarMm(medidas.profundidadeMm)}${desvio}.` +
      (pence.tipo === 'recortada' ? ` A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(nova.contorno))}.` : '') +
      doAcabamento +
      // A pence refeita é a última do registro.
      avisoDasPernas(pencesDaPeca(nova).at(-1)),
  };
}

/** O diálogo de uma ferramenta: o título, os campos (com o que foi usado por último) e a explicação. */
export interface DialogoDePence {
  readonly titulo: string;
  readonly campos: readonly CampoDoDialogo[];
  readonly nota: string;
}

const MODOS_DE_PENCE: ReadonlyArray<{ readonly valor: ModoDePence; readonly rotulo: string }> = [
  { valor: 'recortar', rotulo: 'Recortar: o contorno entra pela pence' },
  { valor: 'marcar', rotulo: 'Marcar: a pence fica desenhada, sem cortar' },
];

/** O campo "indicar as pontas", igual no "Fechar" e no "Transferir". */
const CAMPO_DE_INDICAR_PONTAS = (inicial: boolean): CampoDoDialogo => ({
  tipo: 'caixa',
  id: 'indicarPontas',
  rotulo: 'Indicar o início, o vértice e o fim da pence, um a um: para a pence de pernas curvas ou de vários pontos',
  inicial,
});
const NOTA_DE_INDICAR_PONTAS =
  ' Com “Indicar o início, o vértice e o fim”, os três primeiros cliques são esses pontos do contorno, nessa ordem (a do manual da referência; a contrária também serve), e depois vem o pivô ou a nova posição. Os pontos das pernas saem do contorno com a pence.';

/** O diálogo que a ferramenta abre antes dos cliques. */
export function dialogoDaPence(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences): DialogoDePence | null {
  switch (ferramenta) {
    case 'pence-no-contorno':
      return {
        titulo: 'Pence no contorno',
        campos: [
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'O que fazer',
            opcoes: [...MODOS_DE_PENCE, { valor: 'abrir', rotulo: 'Abrir: acrescenta a abertura, girando a peça em torno de um pivô' }],
            inicial: opcoes.pence.modo,
          },
          { tipo: 'medida', id: 'abertura', rotulo: 'Abertura (mm): de uma ponta à outra, em linha reta', inicial: paraCampo(opcoes.pence.aberturaMm) },
          { tipo: 'medida', id: 'profundidade', rotulo: 'Profundidade (mm)', inicial: paraCampo(opcoes.pence.profundidadeMm) },
          {
            tipo: 'caixa',
            id: 'perpendicular',
            rotulo: 'Vértice perpendicular ao contorno (sem isso, um segundo clique aponta a pence)',
            inicial: opcoes.pence.perpendicular,
          },
          { tipo: 'caixa', id: 'piquesLaterais', rotulo: 'Piques laterais: um em cada ponta da pence', inicial: opcoes.pence.piquesLaterais },
          { tipo: 'caixa', id: 'marcaNoVertice', rotulo: 'Pique no vértice: uma marca no vértice da pence', inicial: opcoes.pence.marcaNoVertice },
          {
            tipo: 'caixa',
            id: 'acabamento',
            rotulo: 'Criar acabamento (só no Abrir): a pence fica desenhada, sem recortar, e o contorno ganha o bico dela',
            inicial: opcoes.pence.acabamento,
          },
          campoDaDobra('dobraDoAcabamento', opcoes.pence.dobraDoAcabamento),
          {
            tipo: 'caixa',
            id: 'cortarIntersecoes',
            rotulo: 'Cortar intersecções (só no Abrir): a linha até o pivô que sai da peça e volta corta em todos os trechos; o resultado é uma prega',
            inicial: opcoes.pence.cortarIntersecoes,
          },
        ],
        nota: 'Depois de confirmar, clique no contorno da peça, no meio da pence. Para abrir, clique em seguida no pivô, no contorno do lado oposto: a peça é cortada até ele, e o lado sem a linha de fio gira até abrir a medida pedida. Com “Criar acabamento”, a pence aberta fica desenhada, e o contorno ganha o bico que ela faz quando é dobrada: a borda do lado para onde ela dobra, espelhada na perna, até a linha do meio — é o traçado de ofício; sem lado, fica no meio dos dois. Dobrada para um lado numa borda curva, o acabamento acompanha a curva. Com “Cortar intersecções”, a linha até o pivô que sai da peça e volta corta em cada trecho de dentro; o que abre vira tecido: uma prega em cunha, sem vértice, com as bordas desenhadas — clicando dentro dela depois, dá para mudar a abertura ou fechá-la. O manual da referência tem as duas opções, mas não diz a conta: a da prega é a nossa leitura.',
      };
    case 'pence-interna':
      return {
        titulo: 'Pence interna',
        campos: [
          {
            tipo: 'medida',
            id: 'altura1',
            rotulo: 'Altura 1 (mm): do centro à ponta para onde a linha de fio aponta',
            inicial: paraCampo(opcoes.interna.altura1Mm),
          },
          { tipo: 'medida', id: 'altura2', rotulo: 'Altura 2 (mm): do centro à outra ponta', inicial: paraCampo(opcoes.interna.altura2Mm) },
          { tipo: 'medida', id: 'largura', rotulo: 'Largura (mm), no centro', inicial: paraCampo(opcoes.interna.larguraMm) },
          {
            tipo: 'medida',
            id: 'angulo',
            rotulo: 'Ângulo de inserção (graus), em relação à linha de fio',
            inicial: paraCampo(opcoes.interna.anguloGraus),
          },
          { tipo: 'caixa', id: 'linhaAuxiliar', rotulo: 'Linha auxiliar: o eixo, de ponta a ponta', inicial: opcoes.interna.linhaAuxiliar },
          { tipo: 'caixa', id: 'marcas', rotulo: 'Pique interno: uma marca em cada ponta e em cada lado', inicial: opcoes.interna.marcas },
        ],
        nota: 'Depois de confirmar, clique dentro da peça, no centro da pence. Ela é desenhada como linha interna; o contorno não muda.',
      };
    case 'fechar-pence':
      return {
        titulo: 'Fechar pence',
        campos: [
          {
            tipo: 'caixa',
            id: 'somenteORecorte',
            rotulo: 'Somente o recorte: o contorno passa reto e a pence fica marcada (a peça não gira)',
            inicial: opcoes.fecharSomenteORecorte,
          },
          CAMPO_DE_INDICAR_PONTAS(opcoes.indicarPontas),
        ],
        nota: 'Depois de confirmar, clique no vértice da pence recortada. Sem “Somente o recorte”, clique em seguida no pivô, no contorno: a peça é cortada do vértice até ele, e o lado sem a linha de fio gira em torno do pivô até as pontas da pence se encontrarem. O manual da referência só dá a ordem dos cliques; o resultado é a leitura natural dela.' + NOTA_DE_INDICAR_PONTAS,
      };
    case 'transferir-pence':
      return {
        titulo: 'Transferir pence',
        campos: [CAMPO_DE_INDICAR_PONTAS(opcoes.indicarPontas)],
        nota: 'Depois de confirmar, clique no vértice da pence recortada e, em seguida, no contorno, na nova posição: a peça é cortada do vértice até ela, e o lado sem a linha de fio gira em torno do vértice até a pence antiga fechar. A pence nova tem o mesmo vértice e o mesmo ângulo, e a área da peça não muda. Ela nasce com pernas retas, do vértice às pontas: o manual da referência dá os passos e não fala da forma das pernas, e a reta é a que não inventa nada — se elas devem ser curvas, redesenhe-as depois com as ferramentas de curva.' + NOTA_DE_INDICAR_PONTAS,
      };
    case 'multiplas-pences':
      return {
        titulo: 'Múltiplas pences',
        campos: [
          {
            tipo: 'inteiro',
            id: 'quantidade',
            rotulo: `Número de pences (2 a ${MAXIMO_DE_PENCES})`,
            inicial: String(opcoes.multiplas.quantidade),
          },
          {
            tipo: 'medida',
            id: 'distancia',
            rotulo: 'Distância entre as pences (mm), de centro a centro',
            inicial: paraCampo(opcoes.multiplas.distanciaMm),
          },
          { tipo: 'medida', id: 'abertura', rotulo: 'Abertura de cada uma (mm): de uma ponta à outra, em linha reta', inicial: paraCampo(opcoes.multiplas.aberturaMm) },
          { tipo: 'medida', id: 'profundidade', rotulo: 'Profundidade (mm)', inicial: paraCampo(opcoes.multiplas.profundidadeMm) },
          { tipo: 'escolha', id: 'modo', rotulo: 'O que fazer', opcoes: MODOS_DE_PENCE, inicial: opcoes.multiplas.modo },
          { tipo: 'caixa', id: 'piquesLaterais', rotulo: 'Piques laterais: um em cada ponta de cada pence', inicial: opcoes.multiplas.piquesLaterais },
          { tipo: 'caixa', id: 'marcaNoVertice', rotulo: 'Pique no vértice: uma marca no vértice de cada pence', inicial: opcoes.multiplas.marcaNoVertice },
        ],
        nota: 'Depois de confirmar, clique no contorno da peça, no meio do grupo. As pences ficam em esquadro com o contorno, repartidas por igual dos dois lados do clique. O manual da referência não descreve esta ferramenta; esta é a leitura natural.',
      };
    case 'pregas':
      return {
        titulo: 'Pregas',
        campos: [
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'Modo',
            opcoes: [
              { valor: 'simples-direita', rotulo: 'Simples, dobrada para a direita' },
              { valor: 'simples-esquerda', rotulo: 'Simples, dobrada para a esquerda' },
              { valor: 'dupla', rotulo: 'Dupla: duas dobras que se encontram no meio' },
            ],
            inicial: opcoes.pregas.modo,
          },
          { tipo: 'inteiro', id: 'quantidade', rotulo: `Número de pregas (1 a ${MAXIMO_DE_PREGAS})`, inicial: String(opcoes.pregas.quantidade) },
          {
            tipo: 'medida',
            id: 'distancia',
            rotulo: 'Distância entre as pregas (mm): só com mais de uma',
            inicial: paraCampo(opcoes.pregas.distanciaMm),
            opcional: true,
          },
          { tipo: 'medida', id: 'largura', rotulo: 'Largura da prega (mm)', inicial: paraCampo(opcoes.pregas.larguraMm) },
          {
            tipo: 'medida',
            id: 'largura2',
            rotulo: 'Largura 2 (mm): só se a outra ponta tiver largura diferente',
            inicial: opcoes.pregas.largura2Mm === undefined ? '' : paraCampo(opcoes.pregas.largura2Mm),
            opcional: true,
          },
          { tipo: 'caixa', id: 'piques', rotulo: 'Pique nas pontas de cada linha de dobra', inicial: opcoes.pregas.piques },
        ],
        nota: 'Depois de confirmar, clique no contorno da peça nas duas pontas da linha da prega; com mais de uma, clique em seguida do lado em que as outras devem ficar. A peça abre na linha: o lado sem a linha de fio anda duas larguras (quatro, na prega dupla), e as linhas de dobra ficam desenhadas, com uma seta para onde o tecido dobra. Direita e esquerda são as de quem vai do primeiro ponto ao segundo.',
      };
  }
}

/**
 * As opções com o que o diálogo da ferramenta entregou. Lança erro, com a
 * mensagem para o diálogo mostrar, quando os valores não servem.
 */
export function lerDialogoDaPence(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, valores: ValoresDoDialogo): OpcoesDasPences {
  const numero = (id: string): number => Number(valores[id]);
  const caixa = (id: string): boolean => valores[id] === true;
  switch (ferramenta) {
    case 'pence-no-contorno': {
      const pence = {
        modo: String(valores.modo) as ModoDePenceNoContorno,
        aberturaMm: numero('abertura'),
        profundidadeMm: numero('profundidade'),
        perpendicular: caixa('perpendicular'),
        piquesLaterais: caixa('piquesLaterais'),
        marcaNoVertice: caixa('marcaNoVertice'),
        acabamento: caixa('acabamento'),
        cortarIntersecoes: caixa('cortarIntersecoes'),
        dobraDoAcabamento: dobraLida(valores.dobraDoAcabamento),
      };
      conferirMedidasDaPence(pence.aberturaMm, pence.profundidadeMm);
      return { ...opcoes, pence };
    }
    case 'pence-interna': {
      const interna: OpcoesDePenceInterna = {
        altura1Mm: numero('altura1'),
        altura2Mm: numero('altura2'),
        larguraMm: numero('largura'),
        anguloGraus: numero('angulo'),
        linhaAuxiliar: caixa('linhaAuxiliar'),
        marcas: caixa('marcas'),
      };
      conferirOpcoesDePenceInterna(interna);
      return { ...opcoes, interna };
    }
    case 'fechar-pence':
      return { ...opcoes, fecharSomenteORecorte: caixa('somenteORecorte'), indicarPontas: caixa('indicarPontas') };
    case 'transferir-pence':
      return { ...opcoes, indicarPontas: caixa('indicarPontas') };
    case 'multiplas-pences': {
      const multiplas = {
        quantidade: numero('quantidade'),
        distanciaMm: numero('distancia'),
        aberturaMm: numero('abertura'),
        profundidadeMm: numero('profundidade'),
        modo: String(valores.modo) as ModoDePence,
        piquesLaterais: caixa('piquesLaterais'),
        marcaNoVertice: caixa('marcaNoVertice'),
      };
      conferirMultiplasPences(multiplas.quantidade, multiplas.distanciaMm, multiplas.aberturaMm, multiplas.profundidadeMm);
      return { ...opcoes, multiplas };
    }
    case 'pregas': {
      const quantidade = numero('quantidade');
      const pregas: OpcoesDePregas = {
        modo: String(valores.modo) as ModoDePrega,
        quantidade,
        // Com uma prega só a distância não conta: em branco, fica a anterior.
        distanciaMm: valores.distancia === undefined ? (quantidade > 1 ? Number.NaN : opcoes.pregas.distanciaMm) : numero('distancia'),
        larguraMm: numero('largura'),
        ...(valores.largura2 === undefined ? {} : { largura2Mm: numero('largura2') }),
        piques: caixa('piques'),
      };
      conferirOpcoesDePregas(pregas);
      return { ...opcoes, pregas };
    }
  }
}
