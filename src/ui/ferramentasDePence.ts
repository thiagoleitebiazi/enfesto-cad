import { area, distancia, type Ponto2D } from '../core/geometria';
import type { Molde } from '../domain/molde';
import {
  abrirPence,
  conferirMedidasDaPence,
  conferirMultiplasPences,
  conferirOpcoesDePenceInterna,
  criarMultiplasPences,
  criarPence,
  criarPenceInterna,
  ehVerticeDePence,
  fecharPence,
  MAXIMO_DE_PENCES,
  transferirPence,
  type ModoDePence,
  type OpcoesDePenceInterna,
} from '../domain/pences';
import { conferirOpcoesDePregas, criarPregas, MAXIMO_DE_PREGAS, type ModoDePrega, type OpcoesDePregas } from '../domain/pregas';
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
  };
  readonly interna: OpcoesDePenceInterna;
  readonly fecharSomenteORecorte: boolean;
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
  pence: { modo: 'recortar', aberturaMm: 30, profundidadeMm: 100, perpendicular: true, piquesLaterais: true, marcaNoVertice: true },
  interna: { altura1Mm: 80, altura2Mm: 80, larguraMm: 20, anguloGraus: 0, linhaAuxiliar: true, marcas: true },
  fecharSomenteORecorte: false,
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

/** Todos os cliques que a ferramenta pede já foram dados. */
export function penceCompleta(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, estado: TrechoEmEdicao): boolean {
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
}

const NAO_E_PENCE = 'Esse ponto não é o vértice de uma pence recortada: clique no ponto de dentro do recorte.';

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
  clique: CliqueDeTrecho,
): CliqueDePence {
  const pedidos = cliquesPedidos(ferramenta, opcoes);
  const igual: CliqueDePence = { estado, recusa: null };
  if (penceCompleta(ferramenta, opcoes, estado)) return igual;
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

  switch (ferramenta) {
    case 'pence-no-contorno': {
      const { modo, aberturaMm, profundidadeMm, piquesLaterais, marcaNoVertice, perpendicular } = opcoes.pence;
      const medidas = `abertura de ${formatarMm(aberturaMm)}, profundidade de ${formatarMm(profundidadeMm)}`;
      const nova =
        modo === 'abrir'
          ? abrirPence(peca, inicio!, fim!, aberturaMm, profundidadeMm, piquesLaterais, novoId)
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
          : `Pence ${NOME_DO_MODO[modo]} em “${peca.nome}”: ${medidas}. A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.`,
      );
    }
    case 'pence-interna':
      return pronto(criarPenceInterna(peca, livre!, opcoes.interna, novoId), `Pence interna desenhada em “${peca.nome}”.`);
    case 'fechar-pence': {
      const nova = fecharPence(peca, inicio!.indiceAresta, opcoes.fecharSomenteORecorte ? null : fim);
      const mudanca = `A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.`;
      if (opcoes.fecharSomenteORecorte) {
        return pronto(nova, `Recorte da pence fechado em “${peca.nome}”: o contorno passa reto, e a pence ficou marcada. ${mudanca}`);
      }
      // As pontas só se encontram se estiverem à mesma distância do pivô; senão sobra um degrau, e a mensagem diz de quanto.
      const n = peca.contorno.length;
      const pontas = [peca.contorno[(inicio!.indiceAresta - 1 + n) % n]!, peca.contorno[(inicio!.indiceAresta + 1) % n]!] as const;
      const degrau = Math.abs(distancia(fim!.ponto, pontas[0]) - distancia(fim!.ponto, pontas[1]));
      const aviso =
        degrau > DEGRAU_QUE_VALE_AVISAR_MM
          ? ` As pontas da pence estão a distâncias diferentes do pivô: sobrou um degrau de ${formatarMm(degrau)} entre elas, para acertar com Mover ponto.`
          : '';
      return pronto(nova, `Pence fechada em “${peca.nome}”, girando em torno do pivô. ${mudanca}${aviso}`);
    }
    case 'transferir-pence': {
      const nova = transferirPence(peca, inicio!.indiceAresta, fim!);
      return pronto(nova, `Pence transferida em “${peca.nome}”, com o mesmo vértice e o mesmo ângulo. A área continua ${areaDe(nova)}.`);
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
  mouse: CliqueDeTrecho | null,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!mouse) return { marcas };
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

const ESC = ' Esc sai.';

/** A instrução do próximo clique, para a faixa de mensagens. */
export function instrucaoDaPence(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, estado: TrechoEmEdicao): string {
  switch (ferramenta) {
    case 'pence-no-contorno':
      if (opcoes.pence.modo === 'abrir') {
        return !estado.inicio
          ? 'Pence (abrir): clique no contorno da peça selecionada, onde a pence deve abrir.' + ESC
          : 'Pence (abrir): clique no contorno do lado oposto, no pivô — o lado sem a linha de fio gira em torno dele.' + ESC;
      }
      return !estado.inicio
        ? `Pence (${opcoes.pence.modo}): clique no contorno da peça selecionada, no meio da pence.` + ESC
        : `Pence (${opcoes.pence.modo}): clique dentro da peça, para onde o vértice deve apontar.` + ESC;
    case 'pence-interna':
      return 'Pence interna: clique dentro da peça selecionada, no centro da pence.' + ESC;
    case 'fechar-pence':
      return !estado.inicio
        ? 'Fechar pence: clique no vértice da pence recortada (o ponto de dentro do recorte).' + ESC
        : 'Fechar pence: clique no contorno, no pivô — o lado sem a linha de fio gira em torno dele até a pence fechar.' + ESC;
    case 'transferir-pence':
      return !estado.inicio
        ? 'Transferir pence: clique no vértice da pence recortada (o ponto de dentro do recorte).' + ESC
        : 'Transferir pence: clique no contorno, na nova posição da pence.' + ESC;
    case 'multiplas-pences':
      return 'Múltiplas pences: clique no contorno da peça selecionada, no meio do grupo de pences.' + ESC;
    case 'pregas':
      if (!estado.inicio) return 'Pregas: clique no contorno da peça selecionada, numa ponta da linha da prega.' + ESC;
      return !estado.fim
        ? 'Pregas: clique no contorno, na outra ponta da linha da prega.' + ESC
        : 'Pregas: clique do lado em que as outras pregas devem ficar.' + ESC;
  }
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

/** O diálogo que a ferramenta abre antes dos cliques; `null` para a que não pergunta nada ("Transferir pence"). */
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
          { tipo: 'medida', id: 'abertura', rotulo: 'Abertura (mm)', inicial: paraCampo(opcoes.pence.aberturaMm) },
          { tipo: 'medida', id: 'profundidade', rotulo: 'Profundidade (mm)', inicial: paraCampo(opcoes.pence.profundidadeMm) },
          {
            tipo: 'caixa',
            id: 'perpendicular',
            rotulo: 'Vértice perpendicular ao contorno (sem isso, um segundo clique aponta a pence)',
            inicial: opcoes.pence.perpendicular,
          },
          { tipo: 'caixa', id: 'piquesLaterais', rotulo: 'Piques laterais: um em cada ponta da pence', inicial: opcoes.pence.piquesLaterais },
          { tipo: 'caixa', id: 'marcaNoVertice', rotulo: 'Marca no vértice (na pence marcada)', inicial: opcoes.pence.marcaNoVertice },
        ],
        nota: 'Depois de confirmar, clique no contorno da peça, no meio da pence. Para abrir, clique em seguida no pivô, no contorno do lado oposto: a peça é cortada até ele, e o lado sem a linha de fio gira até abrir a medida pedida.',
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
        ],
        nota: 'Depois de confirmar, clique no vértice da pence recortada. Sem “Somente o recorte”, clique em seguida no pivô, no contorno: a peça é cortada do vértice até ele, e o lado sem a linha de fio gira em torno do pivô até as pontas da pence se encontrarem. O manual da referência só dá a ordem dos cliques; o resultado é a leitura natural dela.',
      };
    case 'transferir-pence':
      return null;
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
          { tipo: 'medida', id: 'abertura', rotulo: 'Abertura de cada uma (mm)', inicial: paraCampo(opcoes.multiplas.aberturaMm) },
          { tipo: 'medida', id: 'profundidade', rotulo: 'Profundidade (mm)', inicial: paraCampo(opcoes.multiplas.profundidadeMm) },
          { tipo: 'escolha', id: 'modo', rotulo: 'O que fazer', opcoes: MODOS_DE_PENCE, inicial: opcoes.multiplas.modo },
          { tipo: 'caixa', id: 'piquesLaterais', rotulo: 'Piques laterais: um em cada ponta de cada pence', inicial: opcoes.multiplas.piquesLaterais },
          { tipo: 'caixa', id: 'marcaNoVertice', rotulo: 'Marca no vértice (nas pences marcadas)', inicial: opcoes.multiplas.marcaNoVertice },
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
      return { ...opcoes, fecharSomenteORecorte: caixa('somenteORecorte') };
    case 'transferir-pence':
      return opcoes;
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
