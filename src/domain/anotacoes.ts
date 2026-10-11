import { distancia, pontoDentroDoContorno, type Ponto2D } from '../core/geometria';
import { desdobrarMolde } from './corteEUniao';
import { semCampo, type Molde, type Pique, type TextoDaPeca } from './molde';

/**
 * O que se anota numa peça além da geometria: a cor, os textos, a linha de
 * simetria e o código dos piques.
 */

/** As cores que uma peça pode ter: tons claros, para o contorno e o que está dentro continuarem legíveis. */
export const CORES_DE_PECA: ReadonlyArray<{ readonly nome: string; readonly valor: string }> = [
  { nome: 'Azul', valor: '#d6e6fb' },
  { nome: 'Verde', valor: '#d9f0dc' },
  { nome: 'Amarelo', valor: '#fbf3c8' },
  { nome: 'Laranja', valor: '#fde3c8' },
  { nome: 'Rosa', valor: '#fbd9e3' },
  { nome: 'Roxo', valor: '#e6dcf7' },
  { nome: 'Cinza', valor: '#dfe3e8' },
];

/** "Cor": a cor de fundo da peça no desenho; `null` volta à cor padrão. */
export function definirCor(molde: Molde, cor: string | null): Molde {
  if (cor === null) return semCampo(molde, 'cor');
  if (!CORES_DE_PECA.some((c) => c.valor === cor)) throw new Error('Cor fora da paleta.');
  return { ...molde, cor };
}

export const ALTURA_MINIMA_DO_TEXTO_MM = 1;
export const ALTURA_MAXIMA_DO_TEXTO_MM = 500;

function conferirTexto(texto: string, alturaMm: number): void {
  if (texto.trim() === '') throw new Error('Escreva o texto.');
  if (!Number.isFinite(alturaMm) || alturaMm < ALTURA_MINIMA_DO_TEXTO_MM || alturaMm > ALTURA_MAXIMA_DO_TEXTO_MM) {
    throw new Error(`A altura do texto precisa ficar entre ${ALTURA_MINIMA_DO_TEXTO_MM} e ${ALTURA_MAXIMA_DO_TEXTO_MM} mm.`);
  }
}

/** O ângulo e a âncora de um "Pique texto": o que fica no ponto clicado é o meio, o começo ou o fim do texto. */
export interface PoseDoTexto {
  readonly anguloGraus: number;
  readonly ancora: 'centro' | 'inicio' | 'fim';
}

/** Os campos do texto que a pose dá: o ângulo e, se não é o meio, a âncora. */
function camposDaPose(pose: PoseDoTexto): Pick<TextoDaPeca, 'anguloGraus' | 'ancora'> {
  if (!Number.isFinite(pose.anguloGraus) || Math.abs(pose.anguloGraus) > 360) throw new Error('O ângulo do texto precisa ficar entre −360° e 360°.');
  return { anguloGraus: pose.anguloGraus, ...(pose.ancora === 'centro' ? {} : { ancora: pose.ancora }) };
}

/**
 * "Inserir texto": um texto preso à peça, centrado em `posicao`, com a altura
 * dada em mm. Com `pose` (o "Pique texto"), tem ângulo, e o que fica em
 * `posicao` pode ser o começo ou o fim dele.
 */
export function adicionarTexto(molde: Molde, posicao: Ponto2D, texto: string, alturaMm: number, id: string, pose?: PoseDoTexto): Molde {
  conferirTexto(texto, alturaMm);
  return { ...molde, textos: [...(molde.textos ?? []), { id, posicao, texto: texto.trim(), alturaMm, ...(pose ? camposDaPose(pose) : {}) }] };
}

/** "Editar texto": troca o que está escrito e a altura; com o texto vazio, apaga-o. Com `pose`, troca também o ângulo e a âncora (sem ela, ficam como estavam). */
export function alterarTexto(molde: Molde, id: string, texto: string, alturaMm: number, pose?: PoseDoTexto): Molde {
  const textos = molde.textos ?? [];
  if (!textos.some((t) => t.id === id)) throw new Error('Texto não encontrado na peça.');
  if (texto.trim() === '') return { ...molde, textos: textos.filter((t) => t.id !== id) };
  conferirTexto(texto, alturaMm);
  return {
    ...molde,
    textos: textos.map((t) => {
      if (t.id !== id) return t;
      if (!pose) return { ...t, texto: texto.trim(), alturaMm };
      // A âncora de antes sai: vale a da pose.
      return { id: t.id, posicao: t.posicao, texto: texto.trim(), alturaMm, ...camposDaPose(pose) };
    }),
  };
}

/** O texto da peça cujo centro está mais perto do ponto, a até `raioMm` (ou a meia altura do texto, se for maior). */
export function textoPerto(molde: Molde, p: Ponto2D, raioMm: number): TextoDaPeca | null {
  let melhor: { texto: TextoDaPeca; distancia: number } | null = null;
  for (const texto of molde.textos ?? []) {
    const d = distancia(p, texto.posicao);
    if (d <= Math.max(raioMm, texto.alturaMm) && (!melhor || d < melhor.distancia)) melhor = { texto, distancia: d };
  }
  return melhor ? melhor.texto : null;
}

const NO_MESMO_LUGAR_MM = 1e-6;

/**
 * A aresta do contorno marcada como linha de simetria (o número do ponto em
 * que ela começa), ou `null` — a peça não tem linha de simetria, ou a aresta
 * marcada deixou de existir com alguma edição.
 */
export function arestaDeSimetria(molde: Molde): number | null {
  const linha = molde.linhaDeSimetria;
  if (!linha) return null;
  const n = molde.contorno.length;
  for (let i = 0; i < n; i++) {
    const a = molde.contorno[i]!;
    const b = molde.contorno[(i + 1) % n]!;
    const direta = distancia(a, linha.de) <= NO_MESMO_LUGAR_MM && distancia(b, linha.ate) <= NO_MESMO_LUGAR_MM;
    const invertida = distancia(a, linha.ate) <= NO_MESMO_LUGAR_MM && distancia(b, linha.de) <= NO_MESMO_LUGAR_MM;
    if (direta || invertida) return i;
  }
  return null;
}

/**
 * "Linha de simetria": marca a aresta `indiceAresta` como a linha em que a
 * peça é dobrada (a peça desenhada é meia peça). Marcar de novo a mesma
 * aresta tira a marca. Recusa a aresta em que a peça não pode ser desdobrada.
 */
export function definirLinhaDeSimetria(molde: Molde, indiceAresta: number): Molde {
  if (arestaDeSimetria(molde) === indiceAresta) return semCampo(molde, 'linhaDeSimetria');
  // Vale a mesma condição do "Desdobrar": a peça inteira de um lado só da reta da aresta.
  desdobrarMolde(semCampo(molde, 'linhaDeSimetria'), indiceAresta, () => 'conferencia');
  const n = molde.contorno.length;
  return { ...molde, linhaDeSimetria: { de: molde.contorno[indiceAresta]!, ate: molde.contorno[(indiceAresta + 1) % n]! } };
}

/**
 * As peças como vão para o encaixe quando as de simetria entram abertas: cada
 * peça com linha de simetria é desdobrada nela (a peça inteira), e deixa de
 * ter a marca. As outras ficam como estão.
 */
export function abrirSimetrias(pecas: readonly Molde[], novoId: () => string): Molde[] {
  return pecas.map((peca) => {
    const aresta = arestaDeSimetria(peca);
    return aresta === null ? peca : desdobrarMolde(semCampo(peca, 'linhaDeSimetria'), aresta, novoId);
  });
}

/** O pique da peça mais perto do ponto, a até `raioMm`. */
export function piquePerto(molde: Molde, p: Ponto2D, raioMm: number): Pique | null {
  let melhor: { pique: Pique; distancia: number } | null = null;
  for (const pique of molde.piques) {
    const d = distancia(p, pique.posicao);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { pique, distancia: d };
  }
  return melhor ? melhor.pique : null;
}

export const TAMANHO_MAXIMO_DO_CODIGO = 8;

/**
 * "Relacionamento piques": dá ao pique um código. Piques de peças diferentes
 * com o mesmo código são os que se encontram na costura. Com o código vazio,
 * o pique volta a não ter código.
 */
export function definirCodigoDoPique(molde: Molde, piqueId: string, codigo: string): Molde {
  if (!molde.piques.some((p) => p.id === piqueId)) throw new Error('Pique não encontrado na peça.');
  const limpo = codigo.trim();
  if (limpo.length > TAMANHO_MAXIMO_DO_CODIGO) throw new Error(`O código do pique pode ter até ${TAMANHO_MAXIMO_DO_CODIGO} caracteres.`);
  return {
    ...molde,
    piques: molde.piques.map((p) => {
      if (p.id !== piqueId) return p;
      if (limpo !== '') return { ...p, codigo: limpo };
      return { id: p.id, posicao: p.posicao, indiceAresta: p.indiceAresta };
    }),
  };
}

/**
 * Onde escrever o código do pique: a `afastamentoMm` dele, na perpendicular
 * da aresta e do lado de dentro da peça — seja qual for o sentido em que o
 * contorno está guardado. Do lado de dentro, a peça vizinha no encaixe nunca
 * cobre o código.
 */
export function ondeEscreverOCodigo(molde: Molde, pique: Pique, afastamentoMm: number): Ponto2D {
  const n = molde.contorno.length;
  const a = molde.contorno[pique.indiceAresta % n]!;
  const b = molde.contorno[(pique.indiceAresta + 1) % n]!;
  const comprimento = distancia(a, b) || 1;
  const normal = { x: (b.y - a.y) / comprimento, y: -(b.x - a.x) / comprimento };
  const deUmLado = { x: pique.posicao.x + normal.x * afastamentoMm, y: pique.posicao.y + normal.y * afastamentoMm };
  if (pontoDentroDoContorno(deUmLado, molde.contorno)) return deUmLado;
  return { x: pique.posicao.x - normal.x * afastamentoMm, y: pique.posicao.y - normal.y * afastamentoMm };
}

/** Em que peças há piques com o código dado, e quantos em cada uma. */
export function piquesComOCodigo(pecas: readonly Molde[], codigo: string): Array<{ readonly peca: Molde; readonly quantos: number }> {
  const limpo = codigo.trim();
  if (limpo === '') return [];
  return pecas
    .map((peca) => ({ peca, quantos: peca.piques.filter((p) => p.codigo === limpo).length }))
    .filter((r) => r.quantos > 0);
}
