import { area, distancia, pontoDentroDoContorno, pontoMaisProximoNoContorno, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import {
  ancoraDoElemento,
  contornoComoLinhaInterna,
  copiarElemento,
  criarRetaPorAngulo,
  dividirLinha,
  elementoPerto,
  moverElemento,
  removerElemento,
  estenderAteElemento,
  estenderDuasRetas,
  estenderReta,
  extrairMolde,
  linhaInternaPerto,
  pontoNoCentroDoArco,
  pontoNoPerimetro,
  pontoPorDistancia,
  pontoPorIntersecao,
  regiaoDaPeca,
  segmentoPerto,
} from '../domain/elementos';
import { adicionarMarca, transladarMolde, type Molde } from '../domain/molde';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import { nomeDaParteNova, type PreviaDeFerramentaDeMolde } from './ferramentasDeMolde';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';

/**
 * As ferramentas de retas e pontos (aba Construção), o "Extrair molde" (aba
 * Produção) e as de elementos da aba Manipulação. Na referência elas
 * trabalham com elementos soltos; aqui, com as **linhas internas** (as retas)
 * e as **marcas** (os pontos) da peça selecionada. A geometria é do domínio
 * (`elementos.ts`).
 */
export type FerramentaDeElemento =
  | 'reta-por-angulo'
  | 'estender-reta'
  | 'estender-ate-elemento'
  | 'estender-duas-retas'
  | 'ponto-por-coordenada'
  | 'ponto-por-intersecao'
  | 'ponto-no-centro-do-arco'
  | 'ponto-no-perimetro'
  | 'ponto-por-distancia'
  | 'extrair-molde'
  | 'mover-ponto-de-construcao'
  | 'manipulacao-rapida'
  | 'dividir-linha'
  | 'transformar-em-elementos'
  | 'copiar-elemento';

/** As que ficam ligadas à espera de cliques; "Por coordenada" age ao confirmar o diálogo. */
export type ModoDeElemento = Exclude<FerramentaDeElemento, 'ponto-por-coordenada'>;

const MODOS_DE_ELEMENTO: ReadonlySet<string> = new Set([
  'reta-por-angulo',
  'estender-reta',
  'estender-ate-elemento',
  'estender-duas-retas',
  'ponto-por-intersecao',
  'ponto-no-centro-do-arco',
  'ponto-no-perimetro',
  'ponto-por-distancia',
  'extrair-molde',
  'mover-ponto-de-construcao',
  'manipulacao-rapida',
  'dividir-linha',
  'transformar-em-elementos',
  'copiar-elemento',
]);

export function ehModoDeElemento(modo: string): modo is ModoDeElemento {
  return MODOS_DE_ELEMENTO.has(modo);
}

export interface OpcoesDeElemento {
  readonly porAngulo: { readonly anguloGraus: number; readonly comprimentoMm: number };
  readonly estender: { readonly comprimentoMm: number };
  /** Coordenadas do mundo, em mm: X é a régua da esquerda e Y, a de cima (como na barra de status). */
  readonly coordenada: { readonly xMm: number; readonly yMm: number };
  readonly noPerimetro: { readonly distanciaMm: number };
  readonly porDistancia: { readonly distanciaMm: number };
  /** "Copiar ou trocar elemento": copiar deixa o original; trocar tira-o da peça de origem. */
  readonly copiar: { readonly modo: 'copiar' | 'trocar' };
}

export const OPCOES_INICIAIS_DE_ELEMENTO: OpcoesDeElemento = {
  porAngulo: { anguloGraus: 0, comprimentoMm: 100 },
  estender: { comprimentoMm: 20 },
  coordenada: { xMm: 0, yMm: 0 },
  noPerimetro: { distanciaMm: 50 },
  porDistancia: { distanciaMm: 50 },
  copiar: { modo: 'copiar' },
};

const SEM_LINHA = 'Clique perto da ponta de uma linha interna da peça selecionada.';
const NO_CONTORNO = 'Clique sobre o contorno da peça selecionada.';
/** Distância (mm) entre a peça extraída e as que já estavam na mesa. */
const AFASTAMENTO_DA_EXTRAIDA_MM = 20;

function paraCampo(valor: number): string {
  return String(valor).replace('.', ',');
}

function cm2(areaMm2: number): string {
  return `${(areaMm2 / 100).toFixed(1).replace('.', ',')} cm²`;
}

function trocar(pecas: readonly Molde[], id: string, nova: Molde): Molde[] {
  return pecas.map((p) => (p.id === id ? nova : p));
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

export interface DialogoDeElemento {
  readonly titulo: string;
  readonly campos: readonly CampoDoDialogo[];
  readonly nota: string;
  readonly rotuloDoBotao: string;
}

const INDICAR = 'Indicar no desenho';

/** O diálogo que a ferramenta abre antes de agir; `null` para as que não perguntam nada. */
export function dialogoDoElemento(ferramenta: FerramentaDeElemento, opcoes: OpcoesDeElemento): DialogoDeElemento | null {
  switch (ferramenta) {
    case 'reta-por-angulo':
      return {
        titulo: 'Reta por ângulo',
        campos: [
          {
            tipo: 'medida',
            id: 'angulo',
            rotulo: 'Ângulo (graus): 0 aponta para a direita, 90 para cima',
            inicial: paraCampo(opcoes.porAngulo.anguloGraus),
          },
          { tipo: 'medida', id: 'comprimento', rotulo: 'Comprimento (mm)', inicial: paraCampo(opcoes.porAngulo.comprimentoMm) },
        ],
        nota: 'Depois de confirmar, clique onde a reta começa — num ponto do contorno ou dentro da peça. Ela entra como linha interna da peça selecionada.',
        rotuloDoBotao: INDICAR,
      };
    case 'estender-reta':
      return {
        titulo: 'Estender reta',
        campos: [{ tipo: 'medida', id: 'comprimento', rotulo: 'Quanto acrescentar (mm)', inicial: paraCampo(opcoes.estender.comprimentoMm) }],
        nota: 'Depois de confirmar, clique perto da ponta de uma linha interna: ela cresce essa medida, na direção em que já ia.',
        rotuloDoBotao: INDICAR,
      };
    case 'ponto-por-coordenada':
      return {
        titulo: 'Ponto por coordenada',
        campos: [
          { tipo: 'medida', id: 'x', rotulo: 'X (mm): a medida da régua da esquerda', inicial: paraCampo(opcoes.coordenada.xMm) },
          { tipo: 'medida', id: 'y', rotulo: 'Y (mm): a medida da régua de cima', inicial: paraCampo(opcoes.coordenada.yMm) },
        ],
        nota: 'O ponto entra como uma marca da peça selecionada, nessa posição do desenho. São as mesmas coordenadas que a barra de status mostra (lá, em cm).',
        rotuloDoBotao: 'Criar ponto',
      };
    case 'ponto-no-perimetro':
      return {
        titulo: 'Ponto no perímetro',
        campos: [
          {
            tipo: 'medida',
            id: 'distancia',
            rotulo: 'Distância sobre o contorno (mm): negativa anda contra a numeração dos pontos',
            inicial: paraCampo(opcoes.noPerimetro.distanciaMm),
          },
        ],
        nota: 'Depois de confirmar, clique num ponto do contorno: a marca fica a essa distância dele, medida sobre o contorno.',
        rotuloDoBotao: INDICAR,
      };
    case 'ponto-por-distancia':
      return {
        titulo: 'Ponto por distância',
        campos: [{ tipo: 'medida', id: 'distancia', rotulo: 'Distância (mm)', inicial: paraCampo(opcoes.porDistancia.distanciaMm) }],
        nota: 'Depois de confirmar, clique no ponto de partida e, em seguida, noutro ponto, que dá a direção: a marca fica a essa distância do primeiro, na direção do segundo.',
        rotuloDoBotao: INDICAR,
      };
    case 'copiar-elemento':
      return {
        titulo: 'Copiar ou trocar elemento',
        campos: [
          {
            tipo: 'escolha',
            id: 'modo',
            rotulo: 'O que fazer com o elemento clicado',
            opcoes: [
              { valor: 'copiar', rotulo: 'Copiar: ele continua na peça de origem' },
              { valor: 'trocar', rotulo: 'Trocar de peça: ele sai da peça de origem' },
            ],
            inicial: opcoes.copiar.modo,
          },
        ],
        nota: 'Depois de confirmar, clique numa linha interna ou num ponto (marca) de outra peça: ele entra na peça selecionada, no mesmo lugar do desenho.',
        rotuloDoBotao: INDICAR,
      };
    default:
      return null;
  }
}

/** As opções com o que o diálogo entregou. Lança erro, com a mensagem para o diálogo, quando os valores não servem. */
export function lerDialogoDoElemento(ferramenta: FerramentaDeElemento, opcoes: OpcoesDeElemento, valores: ValoresDoDialogo): OpcoesDeElemento {
  const numero = (id: string): number => Number(valores[id]);
  const positivo = (id: string, oQue: string): number => {
    const valor = numero(id);
    if (!(valor > 0)) throw new Error(`${oQue} precisa ser maior que zero.`);
    return valor;
  };
  switch (ferramenta) {
    case 'reta-por-angulo':
      return { ...opcoes, porAngulo: { anguloGraus: numero('angulo'), comprimentoMm: positivo('comprimento', 'O comprimento da reta') } };
    case 'estender-reta':
      return { ...opcoes, estender: { comprimentoMm: positivo('comprimento', 'O comprimento a acrescentar') } };
    case 'ponto-por-coordenada':
      return { ...opcoes, coordenada: { xMm: numero('x'), yMm: numero('y') } };
    case 'ponto-no-perimetro':
      if (numero('distancia') === 0) throw new Error('A distância precisa ser diferente de zero.');
      return { ...opcoes, noPerimetro: { distanciaMm: numero('distancia') } };
    case 'ponto-por-distancia':
      return { ...opcoes, porDistancia: { distanciaMm: positivo('distancia', 'A distância') } };
    case 'copiar-elemento':
      return { ...opcoes, copiar: { modo: valores.modo === 'trocar' ? 'trocar' : 'copiar' } };
    default:
      return opcoes;
  }
}

/** "Por coordenada": a marca entra na peça, na posição digitada. */
export function aplicarPontoPorCoordenada(
  opcoes: OpcoesDeElemento,
  pecas: readonly Molde[],
  peca: Molde,
  novoId: () => string,
): { readonly pecas: readonly Molde[]; readonly recado: string } {
  const { xMm, yMm } = opcoes.coordenada;
  return {
    pecas: trocar(pecas, peca.id, adicionarMarca(peca, { x: xMm, y: yMm }, novoId())),
    recado: `Ponto criado em “${peca.nome}”, em X ${formatarMm(xMm)} e Y ${formatarMm(yMm)}.`,
  };
}

// ---------------------------------------------------------------------------
// Cliques
// ---------------------------------------------------------------------------

export interface CliqueDeElemento {
  readonly estado: TrechoEmEdicao;
  /** As peças do projeto depois do clique, quando ele mudou alguma coisa (um passo de desfazer). */
  readonly pecas?: readonly Molde[];
  readonly recado: string | null;
}

/**
 * O que um clique faz com a ferramenta ligada. As de dois cliques guardam o
 * primeiro ponto e resolvem os dois no segundo.
 */
export function cliqueDeElemento(
  modo: ModoDeElemento,
  opcoes: OpcoesDeElemento,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  clique: CliqueDeTrecho,
  raioMm: number,
  novoId: () => string,
): CliqueDeElemento {
  const com = (nova: Molde, recado: string): CliqueDeElemento => ({ estado: SEM_TRECHO, pecas: trocar(pecas, peca.id, nova), recado });
  const guardar = (p: Ponto2D): CliqueDeElemento => ({ estado: { ...SEM_TRECHO, livres: [p] }, recado: null });
  const recusar = (recado: string): CliqueDeElemento => ({ estado, recado });
  const primeiro = estado.livres[0];
  // Um clique junto do contorno vale o ponto do contorno, para as linhas e os pontos começarem bem em cima dele.
  const ponto = clique.noContorno?.ponto ?? clique.livre;

  try {
    switch (modo) {
      case 'reta-por-angulo': {
        const { anguloGraus, comprimentoMm } = opcoes.porAngulo;
        return com(
          criarRetaPorAngulo(peca, ponto, anguloGraus, comprimentoMm),
          `Reta de ${formatarMm(comprimentoMm)} a ${paraCampo(anguloGraus)}° criada em “${peca.nome}”, como linha interna.`,
        );
      }
      case 'estender-reta': {
        const perto = linhaInternaPerto(peca, clique.livre, raioMm);
        if (!perto) return recusar(SEM_LINHA);
        return com(estenderReta(peca, perto.linha, perto.ponta, opcoes.estender.comprimentoMm), `Linha estendida ${formatarMm(opcoes.estender.comprimentoMm)}.`);
      }
      case 'estender-ate-elemento': {
        const perto = linhaInternaPerto(peca, clique.livre, raioMm);
        if (!perto) return recusar(SEM_LINHA);
        return com(estenderAteElemento(peca, perto.linha, perto.ponta), 'Linha estendida até o primeiro elemento que encontrou.');
      }
      case 'estender-duas-retas': {
        const perto = linhaInternaPerto(peca, clique.livre, raioMm);
        if (!perto) return recusar(SEM_LINHA);
        if (!primeiro) return guardar(clique.livre);
        const antes = linhaInternaPerto(peca, primeiro, raioMm);
        if (!antes) return { estado: SEM_TRECHO, recado: SEM_LINHA };
        return com(estenderDuasRetas(peca, antes.linha, antes.ponta, perto.linha, perto.ponta), 'As duas linhas foram levadas ao ponto em que se encontram.');
      }
      case 'ponto-por-intersecao': {
        const segmento = segmentoPerto(peca, clique.livre, raioMm);
        if (!segmento) return recusar('Clique sobre uma aresta do contorno ou sobre uma linha interna da peça selecionada.');
        if (!primeiro) return guardar(clique.livre);
        const antes = segmentoPerto(peca, primeiro, raioMm);
        if (!antes) return { estado: SEM_TRECHO, recado: 'Clique de novo no primeiro elemento.' };
        return com(pontoPorIntersecao(peca, antes, segmento, novoId()), `Ponto criado em “${peca.nome}”, no encontro dos dois elementos.`);
      }
      case 'ponto-no-centro-do-arco':
        if (!clique.noContorno) return recusar(NO_CONTORNO);
        return com(pontoNoCentroDoArco(peca, clique.noContorno, novoId()), `Ponto criado no centro do arco, em “${peca.nome}”.`);
      case 'ponto-no-perimetro':
        if (!clique.noContorno) return recusar(NO_CONTORNO);
        return com(
          pontoNoPerimetro(peca, clique.noContorno, opcoes.noPerimetro.distanciaMm, novoId()),
          `Ponto criado sobre o contorno de “${peca.nome}”, a ${formatarMm(Math.abs(opcoes.noPerimetro.distanciaMm))} do ponto clicado.`,
        );
      case 'ponto-por-distancia':
        if (!primeiro) return guardar(ponto);
        return com(
          pontoPorDistancia(peca, primeiro, ponto, opcoes.porDistancia.distanciaMm, novoId()),
          `Ponto criado em “${peca.nome}”, a ${formatarMm(opcoes.porDistancia.distanciaMm)} do primeiro ponto.`,
        );
      case 'mover-ponto-de-construcao': {
        if (!primeiro) {
          const escolhido = elementoPerto(peca, clique.livre, raioMm);
          return escolhido?.tipo === 'marca' ? guardar(clique.livre) : recusar('Clique em cima de um ponto (marca) da peça selecionada.');
        }
        const escolhido = elementoPerto(peca, primeiro, raioMm);
        const de = escolhido && ancoraDoElemento(peca, escolhido);
        if (!escolhido || escolhido.tipo !== 'marca' || !de) return { estado: SEM_TRECHO, recado: 'Clique de novo no ponto a mover.' };
        return com(moverElemento(peca, escolhido, { x: ponto.x - de.x, y: ponto.y - de.y }), `Ponto movido em “${peca.nome}”.`);
      }
      case 'manipulacao-rapida': {
        if (!primeiro) {
          return elementoPerto(peca, clique.livre, raioMm)
            ? guardar(clique.livre)
            : recusar('Clique em cima de uma linha interna ou de um ponto (marca) da peça selecionada.');
        }
        const escolhido = elementoPerto(peca, primeiro, raioMm);
        if (!escolhido) return { estado: SEM_TRECHO, recado: 'Clique de novo no elemento a mover.' };
        // O elemento anda o mesmo que o mouse andou do primeiro clique ao segundo.
        const delta = { x: clique.livre.x - primeiro.x, y: clique.livre.y - primeiro.y };
        if (Math.hypot(delta.x, delta.y) < 1e-6) return recusar('Clique onde o elemento deve ficar, ou tecle Delete para apagá-lo.');
        return com(moverElemento(peca, escolhido, delta), `${escolhido.tipo === 'marca' ? 'Ponto movido' : 'Linha movida'} em “${peca.nome}”.`);
      }
      case 'dividir-linha': {
        const perto = linhaInternaPerto(peca, clique.livre, raioMm);
        if (!perto) return recusar('Clique sobre uma linha interna da peça selecionada, onde ela deve ser dividida.');
        return com(dividirLinha(peca, perto.linha, clique.livre), `Linha dividida em duas, em “${peca.nome}”.`);
      }
      case 'transformar-em-elementos': {
        const outras = pecas.filter((p) => p.id !== peca.id);
        const origem =
          [...outras].reverse().find((p) => pontoDentroDoContorno(clique.livre, p.contorno)) ??
          outras.find((p) => pontoMaisProximoNoContorno(clique.livre, p.contorno).distancia <= raioMm);
        if (!origem) return recusar('Clique em outra peça: o contorno dela entra como linha interna da peça selecionada.');
        return com(
          contornoComoLinhaInterna(peca, origem),
          `O contorno de “${origem.nome}” entrou em “${peca.nome}” como linha interna, no lugar em que estava. “${origem.nome}” não mudou.`,
        );
      }
      case 'copiar-elemento': {
        for (const origem of pecas) {
          if (origem.id === peca.id) continue;
          const elemento = elementoPerto(origem, clique.livre, raioMm);
          if (!elemento) continue;
          const comACopia = copiarElemento(peca, origem, elemento, novoId);
          const trocando = opcoes.copiar.modo === 'trocar';
          const ponto = elemento.tipo === 'marca';
          return {
            estado: SEM_TRECHO,
            pecas: pecas.map((p) => (p.id === peca.id ? comACopia : trocando && p.id === origem.id ? removerElemento(origem, elemento) : p)),
            recado: trocando
              ? `${ponto ? 'Ponto' : 'Linha'} de “${origem.nome}” passou para “${peca.nome}”.`
              : `${ponto ? 'Ponto' : 'Linha'} de “${origem.nome}” ${ponto ? 'copiado' : 'copiada'} para “${peca.nome}”.`,
          };
        }
        return recusar('Clique sobre uma linha interna ou um ponto (marca) de outra peça.');
      }
      case 'extrair-molde': {
        const extraida = extrairMolde(peca, clique.livre, novoId, nomeDaParteNova(peca.nome, pecas));
        // A peça nova vai para depois das que já estão na mesa, para não ficar em cima da de origem.
        const fimDasPecas = Math.max(...pecas.map((p) => retanguloEnvolvente(p.contorno).maxY));
        const caixa = retanguloEnvolvente(extraida.contorno);
        const noLugar = transladarMolde(extraida, { x: 0, y: fimDasPecas + AFASTAMENTO_DA_EXTRAIDA_MM - caixa.minY }, extraida.id);
        return {
          estado: SEM_TRECHO,
          pecas: [...pecas, noLugar],
          recado: `Molde “${noLugar.nome}” extraído de “${peca.nome}”: ${cm2(area(noLugar.contorno))}, posto depois das peças que já estavam na mesa. “${peca.nome}” não mudou.`,
        };
      }
    }
  } catch (e) {
    return { estado: SEM_TRECHO, recado: mensagem(e) };
  }
}

/**
 * "Manipulação rápida", com um elemento já escolhido: a tecla Delete apaga-o.
 * Devolve as peças sem ele, ou `null` se não há elemento escolhido.
 */
export function apagarElementoEscolhido(
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  raioMm: number,
): { readonly pecas: readonly Molde[]; readonly recado: string } | null {
  const primeiro = estado.livres[0];
  const escolhido = primeiro ? elementoPerto(peca, primeiro, raioMm) : null;
  if (!escolhido) return null;
  return {
    pecas: trocar(pecas, peca.id, removerElemento(peca, escolhido)),
    recado: `${escolhido.tipo === 'marca' ? 'Ponto apagado' : 'Linha apagada'} de “${peca.nome}”.`,
  };
}

// ---------------------------------------------------------------------------
// Prévia e instruções
// ---------------------------------------------------------------------------

/**
 * O que o desenho mostra com o mouse onde está: o que o clique faria — as
 * linhas que mudariam ou entrariam, os pontos novos e, no "Extrair molde", a
 * região que viraria uma peça.
 */
export function previaDoElemento(
  modo: ModoDeElemento,
  opcoes: OpcoesDeElemento,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  raioMm: number,
): PreviaDeFerramentaDeMolde {
  const jaClicados = estado.livres.slice(0, 1);
  if (!mouse) return { marcas: jaClicados };
  if (modo === 'extrair-molde') {
    try {
      const regiao = regiaoDaPeca(peca, mouse.livre);
      return regiao ? { novo: regiao, novoFechado: true } : {};
    } catch {
      return {};
    }
  }
  const resultado = cliqueDeElemento(modo, opcoes, pecas, peca, estado, mouse, raioMm, () => 'previa');
  const nova = resultado.pecas?.find((p) => p.id === peca.id);
  if (!nova) return { marcas: jaClicados };
  const posicoesDeAntes = peca.marcas.map((m) => m.posicao);
  return {
    linhas: nova.linhasInternas.filter((linha) => !peca.linhasInternas.includes(linha)),
    // Os pontos novos e os que mudariam de lugar.
    marcas: [...jaClicados, ...nova.marcas.map((m) => m.posicao).filter((p) => !posicoesDeAntes.some((q) => distancia(p, q) < 1e-9))],
  };
}

const ESC = ' Esc sai.';

/** A instrução do próximo clique, para a faixa de mensagens. */
export function instrucaoDoElemento(modo: ModoDeElemento, opcoes: OpcoesDeElemento, estado: TrechoEmEdicao): string {
  const temPrimeiro = estado.livres.length > 0;
  switch (modo) {
    case 'reta-por-angulo':
      return `Por ângulo: clique onde começa a reta de ${formatarMm(opcoes.porAngulo.comprimentoMm)} a ${paraCampo(opcoes.porAngulo.anguloGraus)}°.` + ESC;
    case 'estender-reta':
      return `Estender reta: clique perto da ponta de uma linha interna — ela cresce ${formatarMm(opcoes.estender.comprimentoMm)}.` + ESC;
    case 'estender-ate-elemento':
      return 'Estender até elemento: clique perto da ponta de uma linha interna — ela cresce até o contorno ou até outra linha.' + ESC;
    case 'estender-duas-retas':
      return (temPrimeiro
        ? 'Estender duas retas: clique perto da ponta da segunda linha.'
        : 'Estender duas retas: clique perto da ponta da primeira linha interna.') + ESC;
    case 'ponto-por-intersecao':
      return (temPrimeiro
        ? 'Por interseção: clique no segundo elemento — o ponto fica onde as retas dos dois se encontram.'
        : 'Por interseção: clique no primeiro elemento (uma aresta do contorno ou uma linha interna).') + ESC;
    case 'ponto-no-centro-do-arco':
      return 'No centro do arco: clique sobre um arco do contorno da peça selecionada.' + ESC;
    case 'ponto-no-perimetro':
      return `No perímetro: clique num ponto do contorno — a marca fica a ${formatarMm(Math.abs(opcoes.noPerimetro.distanciaMm))} dele, sobre o contorno.` + ESC;
    case 'ponto-por-distancia':
      return (temPrimeiro
        ? 'Por distância: clique noutro ponto, que dá a direção.'
        : `Por distância: clique no ponto de partida — a marca fica a ${formatarMm(opcoes.porDistancia.distanciaMm)} dele.`) + ESC;
    case 'extrair-molde':
      return 'Extrair molde: clique dentro da peça selecionada, na região delimitada pelas linhas internas — ela vira uma peça nova (a tracejada).' + ESC;
    case 'mover-ponto-de-construcao':
      return (temPrimeiro ? 'Manipular pontos: clique onde o ponto deve ficar.' : 'Manipular pontos: clique em cima de um ponto (marca) da peça selecionada.') + ESC;
    case 'manipulacao-rapida':
      return (temPrimeiro
        ? 'Manipulação rápida: clique onde o elemento deve ficar (ele anda o que o mouse andou), ou tecle Delete para apagá-lo.'
        : 'Manipulação rápida: clique em cima de uma linha interna ou de um ponto (marca) da peça selecionada.') + ESC;
    case 'dividir-linha':
      return 'Dividir elementos: clique sobre uma linha interna, no lugar em que ela deve virar duas.' + ESC;
    case 'transformar-em-elementos':
      return 'Transformar em elementos: clique em outra peça — o contorno dela entra na peça selecionada como linha interna.' + ESC;
    case 'copiar-elemento':
      return `${opcoes.copiar.modo === 'trocar' ? 'Trocar elemento de peça' : 'Copiar elemento'}: clique numa linha interna ou num ponto (marca) de outra peça — ele entra na peça selecionada.` + ESC;
  }
}
