import { area, distancia, type Ponto2D } from '../core/geometria';
import type { Molde } from '../domain/molde';
import {
  abrirPence,
  alterarPence,
  alterarPenceInterna,
  conferirMedidasDaPence,
  conferirMultiplasPences,
  conferirOpcoesDePenceInterna,
  criarMultiplasPences,
  criarPence,
  criarPenceInterna,
  ehVerticeDePence,
  fecharPence,
  MAXIMO_DE_PENCES,
  medidasDaPence,
  medidasDaPenceInterna,
  penceNoVertice,
  pencesDaPeca,
  removerPence,
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
  /** O clique caiu numa pence já feita: em vez de criar outra, abre as medidas dela (o id do registro). */
  readonly editar?: string;
}

/** Um clique com a ferramenta de pence ligada: além do que todo clique traz, a pence registrada que está sob ele (se há). */
export interface CliqueNaPence extends CliqueDeTrecho {
  readonly pence?: string | null;
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
  clique: CliqueNaPence,
): CliqueDePence {
  const pedidos = cliquesPedidos(ferramenta, opcoes);
  const igual: CliqueDePence = { estado, recusa: null };
  if (penceCompleta(ferramenta, opcoes, estado)) return igual;
  // Antes de qualquer ponto: o clique numa pence já feita abre as medidas dela.
  if (!estado.inicio && clique.pence) {
    const pence = pencesDaPeca(peca).find((q) => q.id === clique.pence);
    const daFerramenta =
      pence !== undefined &&
      ((ferramenta === 'pence-no-contorno' && pence.tipo !== 'interna') || (ferramenta === 'pence-interna' && pence.tipo === 'interna'));
    if (pence && daFerramenta) return { estado, recusa: null, editar: pence.id };
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
      const mudanca = `A peça passou de ${areaDe(peca)} para ${areaDe(nova)}.${penceNoVertice(peca, inicio!.indiceAresta) ? '' : CANTO_TRATADO_COMO_PENCE}`;
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
      return pronto(
        nova,
        `Pence transferida em “${peca.nome}”, com o mesmo vértice e o mesmo ângulo. A área continua ${areaDe(nova)}.${penceNoVertice(peca, inicio!.indiceAresta) ? '' : CANTO_TRATADO_COMO_PENCE}`,
      );
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
  const marcas = [...dasPences, ...[estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined)];
  if (!mouse) return { marcas };
  // Com o mouse em cima de uma pence já feita, o clique abre as medidas dela: a pence fica em destaque.
  const sobOMouse = cliqueDePence(ferramenta, opcoes, peca, estado, mouse).editar;
  if (sobOMouse) {
    const pence = pencesDaPeca(peca).find((q) => q.id === sobOMouse)!;
    return { marcas, substituido: pence.tipo === 'interna' ? [...pence.pontos, pence.pontos[0]!] : pence.pontos };
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

const ESC = ' Esc sai.';

/** A instrução do próximo clique, para a faixa de mensagens. `temPences`: a peça tem pences registradas, que um clique pode abrir. */
export function instrucaoDaPence(ferramenta: FerramentaDePence, opcoes: OpcoesDasPences, estado: TrechoEmEdicao, temPences = false): string {
  const ouMudar = temPences ? ' Ou clique numa pence já feita (as marcadas com um anel) para mudar as medidas dela.' : '';
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

/** O diálogo das medidas de uma pence já feita; `null` se ela não está mais na peça como foi posta. */
export function dialogoDeEditarPence(peca: Molde, id: string): DialogoDePence | null {
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
      apagar,
    ],
    nota:
      pence.tipo === 'recortada'
        ? 'A pence é refeita no mesmo lugar, com as medidas novas: o contorno volta a ser o de antes do recorte e é recortado de novo. O desvio leva o vértice para o lado da segunda ponta (negativo, para o da primeira). Apagando, o contorno fica como era antes da pence.'
        : 'A pence é refeita no mesmo lugar, com as medidas novas. O desvio leva o vértice para o lado da segunda ponta (negativo, para o da primeira). Apagando, a linha, os piques e a marca dela saem da peça.',
  };
}

/** Uma medida lida dos pontos, sem as casas que só vêm das contas. */
function arredondar(valor: number): number {
  const arredondado = Math.round(valor * 100) / 100;
  return arredondado === 0 ? 0 : arredondado;
}

/** Aplica o diálogo das medidas na pence: muda-as ou, com "Apagar", tira a pence. Lança erro quando as medidas não servem. */
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
  if (valores.apagar === true) {
    const sem = removerPence(peca, id);
    return {
      pecas: trocar(pecas, peca.id, sem),
      recado:
        pence.tipo === 'recortada'
          ? `Pence apagada de “${peca.nome}”: o contorno voltou a ser o de antes dela. A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(sem.contorno))}.`
          : `Pence apagada de “${peca.nome}”.`,
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
  const nova = alterarPence(peca, id, medidas, novoId);
  const desvio = medidas.desvioMm === 0 ? '' : `, desvio de ${formatarMm(medidas.desvioMm)}`;
  return {
    pecas: trocar(pecas, peca.id, nova),
    recado:
      `Pence de “${peca.nome}” refeita: abertura de ${formatarMm(medidas.aberturaMm)}, profundidade de ${formatarMm(medidas.profundidadeMm)}${desvio}.` +
      (pence.tipo === 'recortada' ? ` A peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(nova.contorno))}.` : ''),
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
