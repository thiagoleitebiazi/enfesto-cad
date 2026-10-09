import type { Contorno, Ponto2D } from '../core/geometria';
import {
  retanguloEnvolvente,
  area,
  pontoMaisProximoNoContorno,
  deslocarContornoParaFora,
  transladarContorno,
  rotacionarContorno,
  rotacionar,
  espelharContornoHorizontal,
  espelharHorizontal,
  somar,
  distancia,
  moverPontoDoContorno,
  inserirPontoNoContorno,
  removerPontoDoContorno,
  escalarContorno,
  escalarPonto,
  chanfrarCantoDoContorno,
  arredondarCantoDoContorno,
} from '../core/geometria';

/**
 * Regra crítica (seção 5 do escopo): por padrão nenhuma rotação OU
 * espelhamento que altere a orientação em relação ao fio é permitida. 180°,
 * 90°/270° e espelhamento são liberados apenas quando o usuário autoriza
 * explicitamente, por molde — espelhar uma peça cortada de tecido
 * direcional/com pelo inverte o desenho/sentido do pelo fisicamente, exatamente
 * o mesmo tipo de erro que a rotação proibida evita.
 */
export interface RestricaoDeRotacao {
  readonly permite180: boolean;
  readonly permite90e270: boolean;
  /** Permite usar a versão espelhada (imagem de espelho) da peça — nunca presumido, mesmo padrão da rotação. */
  readonly permiteEspelhamento?: boolean;
}

export const RESTRICAO_PADRAO: RestricaoDeRotacao = {
  permite180: false,
  permite90e270: false,
  permiteEspelhamento: false,
};

/** Seta do sentido do fio: de `inicio` para `fim`, em mm no espaço do molde. */
export interface LinhaDeFio {
  readonly inicio: Ponto2D;
  readonly fim: Ponto2D;
}

/** Pique (marcação de corte): um pequeno traço perpendicular ao contorno, na aresta indicada. */
export interface Pique {
  readonly id: string;
  readonly posicao: Ponto2D;
  readonly indiceAresta: number;
}

/** Marca de referência/alinhamento (ex.: ponto de casa de botão, marca de dobra). */
export interface Marca {
  readonly id: string;
  readonly posicao: Ponto2D;
  readonly rotulo?: string;
}

export interface Molde {
  readonly id: string;
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly linhasInternas: readonly Contorno[];
  readonly furos: readonly Contorno[];
  readonly piques: readonly Pique[];
  readonly marcas: readonly Marca[];
  readonly margemDeCosturaMm: number;
  readonly linhaDeFio: LinhaDeFio;
  readonly quantidade: number;
  readonly restricaoDeRotacao: RestricaoDeRotacao;
  /** Rotação acumulada em relação à orientação original (criação/importação), normalizada em [0, 360). */
  readonly anguloDeRotacaoGraus: number;
}

export interface DadosDeNovoMolde {
  readonly nome: string;
  readonly referencia: string;
  readonly tamanho: string;
  readonly contorno: Contorno;
  readonly linhaDeFio: LinhaDeFio;
  readonly quantidade?: number;
  readonly linhasInternas?: readonly Contorno[];
  readonly furos?: readonly Contorno[];
  readonly piques?: readonly Pique[];
  readonly marcas?: readonly Marca[];
  readonly margemDeCosturaMm?: number;
  readonly restricaoDeRotacao?: RestricaoDeRotacao;
}

/** Constrói um molde válido ou lança erro — usar apenas com dados já conferidos (ex.: vindos de importação já validada). */
export function criarMolde(dados: DadosDeNovoMolde, id: string): Molde {
  if (dados.contorno.length < 3) {
    throw new Error(`Molde "${dados.nome}" precisa de um contorno com ao menos 3 pontos.`);
  }
  if (area(dados.contorno) <= 0) {
    throw new Error(`Molde "${dados.nome}" possui contorno degenerado (área zero).`);
  }
  if (!Number.isFinite(dados.quantidade ?? 1) || (dados.quantidade ?? 1) < 1) {
    throw new Error(`Molde "${dados.nome}" precisa de quantidade >= 1.`);
  }
  for (const furo of dados.furos ?? []) {
    if (furo.length < 3) {
      throw new Error(`Molde "${dados.nome}" tem um furo com menos de 3 pontos.`);
    }
    if (area(furo) <= 0) {
      throw new Error(`Molde "${dados.nome}" tem um furo com contorno degenerado (área zero).`);
    }
  }
  const margem = dados.margemDeCosturaMm ?? 0;
  if (!Number.isFinite(margem) || margem < 0) {
    throw new Error(`Molde "${dados.nome}" precisa de margem de costura >= 0.`);
  }
  return {
    id,
    nome: dados.nome,
    referencia: dados.referencia,
    tamanho: dados.tamanho,
    contorno: dados.contorno,
    linhasInternas: dados.linhasInternas ?? [],
    furos: dados.furos ?? [],
    piques: dados.piques ?? [],
    marcas: dados.marcas ?? [],
    margemDeCosturaMm: margem,
    linhaDeFio: dados.linhaDeFio,
    quantidade: dados.quantidade ?? 1,
    restricaoDeRotacao: dados.restricaoDeRotacao ?? RESTRICAO_PADRAO,
    anguloDeRotacaoGraus: 0,
  };
}

/** Adiciona um pique na aresta do contorno mais próxima de `posicaoClicada`. */
export function adicionarPique(molde: Molde, posicaoClicada: Ponto2D, id: string): Molde {
  const encontrado = pontoMaisProximoNoContorno(posicaoClicada, molde.contorno);
  const novoPique: Pique = { id, posicao: encontrado.ponto, indiceAresta: encontrado.indiceAresta };
  return { ...molde, piques: [...molde.piques, novoPique] };
}

export function removerPique(molde: Molde, piqueId: string): Molde {
  return { ...molde, piques: molde.piques.filter((p) => p.id !== piqueId) };
}

export function adicionarMarca(molde: Molde, posicao: Ponto2D, id: string, rotulo?: string): Molde {
  const marca: Marca = rotulo === undefined ? { id, posicao } : { id, posicao, rotulo };
  return { ...molde, marcas: [...molde.marcas, marca] };
}

export function removerMarca(molde: Molde, marcaId: string): Molde {
  return { ...molde, marcas: molde.marcas.filter((m) => m.id !== marcaId) };
}

/**
 * Linha de corte real: o contorno da peça já considerando a margem de
 * costura (seção 8 do escopo — o PDF deve distinguir linha de corte de
 * linha de costura). Sem margem configurada, corte e contorno coincidem.
 */
export function contornoDeCorte(molde: Molde): Contorno {
  if (molde.margemDeCosturaMm <= 0) return molde.contorno;
  return deslocarContornoParaFora(molde.contorno, molde.margemDeCosturaMm);
}

/** Translada um molde inteiro (contorno, furos, linhas internas, piques, marcas e linha de fio) por `deslocamento`. */
export function transladarMolde(molde: Molde, deslocamento: Ponto2D, novoId: string): Molde {
  return {
    ...molde,
    id: novoId,
    contorno: transladarContorno(molde.contorno, deslocamento),
    linhasInternas: molde.linhasInternas.map((l) => transladarContorno(l, deslocamento)),
    furos: molde.furos.map((f) => transladarContorno(f, deslocamento)),
    piques: molde.piques.map((p) => ({ ...p, posicao: somar(p.posicao, deslocamento) })),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: somar(m.posicao, deslocamento) })),
    linhaDeFio: {
      inicio: somar(molde.linhaDeFio.inicio, deslocamento),
      fim: somar(molde.linhaDeFio.fim, deslocamento),
    },
  };
}

/**
 * Rotaciona um molde inteiro por `anguloGraus` em torno do centro do seu
 * retângulo envolvente. Esta função é pura geometria — NÃO verifica se a
 * rotação é permitida pela `restricaoDeRotacao` do molde; quem chama (a UI)
 * deve checar `rotacaoEhPermitida` antes e recusar/alertar se não for (regra
 * crítica da seção 5 — nunca ignorada).
 */
export function rotacionarMolde(molde: Molde, anguloGraus: number): Molde {
  const centro = retanguloEnvolvente(molde.contorno);
  const pivo = { x: (centro.minX + centro.maxX) / 2, y: (centro.minY + centro.maxY) / 2 };
  return {
    ...molde,
    contorno: rotacionarContorno(molde.contorno, pivo, anguloGraus),
    linhasInternas: molde.linhasInternas.map((l) => rotacionarContorno(l, pivo, anguloGraus)),
    furos: molde.furos.map((f) => rotacionarContorno(f, pivo, anguloGraus)),
    piques: molde.piques.map((p) => ({ ...p, posicao: rotacionar(p.posicao, pivo, anguloGraus) })),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: rotacionar(m.posicao, pivo, anguloGraus) })),
    linhaDeFio: {
      inicio: rotacionar(molde.linhaDeFio.inicio, pivo, anguloGraus),
      fim: rotacionar(molde.linhaDeFio.fim, pivo, anguloGraus),
    },
    anguloDeRotacaoGraus: normalizarAngulo(molde.anguloDeRotacaoGraus + anguloGraus),
  };
}

/**
 * Espelha um molde inteiro horizontalmente (imagem de espelho) em torno do
 * centro do seu retângulo envolvente. Assim como `rotacionarMolde`, é pura
 * geometria — NÃO verifica `restricaoDeRotacao.permiteEspelhamento`; quem
 * chama deve checar antes (regra crítica da seção 5, nunca ignorada).
 */
export function espelharMolde(molde: Molde, novoId: string): Molde {
  const centro = retanguloEnvolvente(molde.contorno);
  const centroX = (centro.minX + centro.maxX) / 2;
  return {
    ...molde,
    id: novoId,
    contorno: espelharContornoHorizontal(molde.contorno, centroX),
    linhasInternas: molde.linhasInternas.map((l) => espelharContornoHorizontal(l, centroX)),
    furos: molde.furos.map((f) => espelharContornoHorizontal(f, centroX)),
    piques: molde.piques.map((p) => ({ ...p, posicao: espelharHorizontal(p.posicao, centroX) })),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: espelharHorizontal(m.posicao, centroX) })),
    linhaDeFio: {
      inicio: espelharHorizontal(molde.linhaDeFio.inicio, centroX),
      fim: espelharHorizontal(molde.linhaDeFio.fim, centroX),
    },
  };
}

/**
 * Ferramentas de edição de forma (seção "Manipulação", inspiradas no
 * Audaces Moldes mas restritas ao que faz sentido no domínio deste app:
 * edição de vértices e transformações manuais de uma peça já desenhada.
 * Fora de escopo deliberadamente: graduação de tamanhos e curvas Bézier —
 * ver ADR correspondente.
 *
 * Nota sobre piques nas funções de edição de contorno abaixo: um pique
 * (`Pique.indiceAresta`) referencia a aresta do contorno pelo índice. Editar
 * o contorno (inserir/remover/arredondar/chanfrar um vértice) muda quantas
 * arestas existem e o que cada índice significa. Quando a edição é
 * inequívoca (índice bem depois do ponto editado), o índice só é ajustado
 * (+n ou -n); quando a aresta afetada é exatamente uma das que mudou de
 * forma, o pique é descartado em vez de adivinhado — mais seguro que deixar
 * um pique silenciosamente na posição errada. Quando só se MOVEM vértices
 * (a quantidade não muda), a aresta continua a mesma e o pique acompanha
 * na mesma proporção (`reancorarPiques`).
 */

/**
 * Mantém cada pique sobre a sua aresta depois que vértices do contorno
 * mudaram de lugar (mesma quantidade de vértices, mesma ordem). O pique
 * conserva a proporção ao longo da aresta: se estava a 30 % do caminho entre
 * os vértices i e i+1, continua a 30 % entre as posições novas. Arestas cujas
 * duas pontas não se moveram ficam intocadas — sem deriva de ponto flutuante.
 */
export function reancorarPiques(piques: readonly Pique[], contornoAntigo: Contorno, contornoNovo: Contorno): readonly Pique[] {
  if (contornoAntigo === contornoNovo || contornoAntigo.length !== contornoNovo.length) return piques;
  const n = contornoAntigo.length;
  return piques.map((pique) => {
    const i = pique.indiceAresta;
    const j = (i + 1) % n;
    const a = contornoAntigo[i];
    const b = contornoAntigo[j];
    const novoA = contornoNovo[i];
    const novoB = contornoNovo[j];
    if (!a || !b || !novoA || !novoB) return pique;
    if (a.x === novoA.x && a.y === novoA.y && b.x === novoB.x && b.y === novoB.y) return pique;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const comprimentoQuadrado = dx * dx + dy * dy;
    const t =
      comprimentoQuadrado === 0
        ? 0
        : Math.max(0, Math.min(1, ((pique.posicao.x - a.x) * dx + (pique.posicao.y - a.y) * dy) / comprimentoQuadrado));
    return { ...pique, posicao: { x: novoA.x + (novoB.x - novoA.x) * t, y: novoA.y + (novoB.y - novoA.y) * t } };
  });
}

/** Move o vértice `indice` do contorno. Furos/linhas internas/fio não mudam; piques das duas arestas vizinhas acompanham (`reancorarPiques`). */
export function moverPontoDoMolde(molde: Molde, indice: number, novaPosicao: Ponto2D): Molde {
  const contorno = moverPontoDoContorno(molde.contorno, indice, novaPosicao);
  return { ...molde, contorno, piques: reancorarPiques(molde.piques, molde.contorno, contorno) };
}

/**
 * Move vários vértices do contorno juntos, pelo mesmo deslocamento — a
 * seleção múltipla de vértices da ferramenta "Mover ponto" (Shift+clique ou
 * retângulo de seleção). Não confundir com a Cerca (`domain/cerca.ts`), que
 * delimita uma área e move tudo o que estiver dentro dela, de várias peças.
 */
export function moverVariosPontosDoMolde(molde: Molde, indices: readonly number[], delta: Ponto2D): Molde {
  const indicesSet = new Set(indices);
  const contorno = molde.contorno.map((p, i) => (indicesSet.has(i) ? somar(p, delta) : p));
  return { ...molde, contorno, piques: reancorarPiques(molde.piques, molde.contorno, contorno) };
}

/** Abaixo disso (mm²) o contorno conta como sem área — a mesma tolerância da Cerca. */
const AREA_MINIMA_DO_CONTORNO_MM2 = 1e-6;
/** Tolerância (mm) das medidas ao longo de uma aresta: abaixo disso é zero. */
const TOLERANCIA_NA_ARESTA_MM = 1e-6;

function exigirContornoComArea(molde: Molde, comOQue: string): Molde {
  if (!(area(molde.contorno) > AREA_MINIMA_DO_CONTORNO_MM2)) {
    throw new Error(`O contorno da peça "${molde.nome}" ficaria sem área ${comOQue}.`);
  }
  return molde;
}

/**
 * "Modificar" pela janela de coordenadas: desloca os vértices `indices` por
 * `delta`, como `moverVariosPontosDoMolde` (só eles andam; os vizinhos ficam
 * no lugar), mas recusa com erro a medida que deixaria o contorno sem área —
 * digitando não há a prévia do arrasto para mostrar o problema antes.
 */
export function modificarPontosDoMolde(molde: Molde, indices: readonly number[], delta: Ponto2D): Molde {
  if (indices.length === 0) throw new Error('Indique pelo menos um ponto do contorno.');
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= molde.contorno.length)) {
    throw new Error('Ponto fora do contorno da peça.');
  }
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw new Error('Deslocamento inválido.');
  return exigirContornoComArea(moverVariosPontosDoMolde(molde, indices, delta), 'com esse deslocamento');
}

/**
 * Qual ponta anda no "Redefinir perímetro": a do início da aresta (o vértice
 * i), a do fim (i+1) — uni-direcional — ou as duas, bi-direcional.
 */
export type PontaDaAresta = 'inicio' | 'fim' | 'ambas';

/**
 * "Redefinir perímetro" de uma aresta reta: a aresta `indiceAresta` (do
 * vértice i ao i+1) passa a medir `novoComprimentoMm`, sem mudar de direção.
 * Uni-direcional ('inicio' ou 'fim'): só aquela ponta anda, a outra fica no
 * lugar. Bi-direcional ('ambas'): cada ponta anda metade da diferença e o
 * meio da aresta fica no lugar. As arestas vizinhas dividem o vértice que
 * andou e mudam junto, com os piques delas na mesma proporção
 * (`reancorarPiques`).
 *
 * Os piques da própria aresta não andam: a reta dela continua a mesma, só as
 * pontas mudam, então um pique marcado a 30 mm do ponto parado continua a
 * 30 mm dele. Se a aresta encolher a ponto de deixar um pique para fora, a
 * medida é recusada — mais seguro que mover ou apagar o pique sem avisar.
 * Também é recusada medida não positiva, aresta sem comprimento (não há
 * direção) e contorno que ficaria sem área.
 */
export function redefinirComprimentoDaAresta(
  molde: Molde,
  indiceAresta: number,
  novoComprimentoMm: number,
  ponta: PontaDaAresta,
): Molde {
  const n = molde.contorno.length;
  if (!Number.isInteger(indiceAresta) || indiceAresta < 0 || indiceAresta >= n) {
    throw new Error('Aresta fora do contorno da peça.');
  }
  if (!Number.isFinite(novoComprimentoMm) || novoComprimentoMm <= 0) {
    throw new Error('O novo comprimento precisa ser maior que zero.');
  }
  const indiceDoFim = (indiceAresta + 1) % n;
  const a = molde.contorno[indiceAresta]!;
  const b = molde.contorno[indiceDoFim]!;
  const comprimentoAtual = distancia(a, b);
  if (comprimentoAtual <= TOLERANCIA_NA_ARESTA_MM) {
    throw new Error('Essa aresta não tem comprimento, então não tem direção para crescer ou encolher.');
  }
  const direcao = { x: (b.x - a.x) / comprimentoAtual, y: (b.y - a.y) / comprimentoAtual };
  const aoLongo = (origem: Ponto2D, mm: number): Ponto2D => ({ x: origem.x + direcao.x * mm, y: origem.y + direcao.y * mm });
  const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const novoInicio =
    ponta === 'fim' ? a : ponta === 'inicio' ? aoLongo(b, -novoComprimentoMm) : aoLongo(meio, -novoComprimentoMm / 2);
  const novoFim = ponta === 'inicio' ? b : ponta === 'fim' ? aoLongo(a, novoComprimentoMm) : aoLongo(meio, novoComprimentoMm / 2);
  const contorno = molde.contorno.map((p, i) => (i === indiceAresta ? novoInicio : i === indiceDoFim ? novoFim : p));

  const reancorados = reancorarPiques(molde.piques, molde.contorno, contorno);
  const piques = molde.piques.map((pique, k) => {
    if (pique.indiceAresta !== indiceAresta) return reancorados[k]!;
    const posicaoNaAresta =
      (pique.posicao.x - novoInicio.x) * direcao.x + (pique.posicao.y - novoInicio.y) * direcao.y;
    if (posicaoNaAresta < -TOLERANCIA_NA_ARESTA_MM || posicaoNaAresta > novoComprimentoMm + TOLERANCIA_NA_ARESTA_MM) {
      throw new Error(
        'Um pique dessa aresta ficaria fora dela com esse comprimento. Exclua o pique antes, ou use um comprimento maior.',
      );
    }
    return pique;
  });
  return exigirContornoComArea({ ...molde, contorno, piques }, 'com esse comprimento');
}

/** Insere um novo vértice na aresta `indiceAresta` (entre esse vértice e o próximo). */
export function inserirPontoNoMolde(molde: Molde, indiceAresta: number, novoPonto: Ponto2D): Molde {
  return {
    ...molde,
    contorno: inserirPontoNoContorno(molde.contorno, indiceAresta, novoPonto),
    piques: molde.piques.map((p) => (p.indiceAresta > indiceAresta ? { ...p, indiceAresta: p.indiceAresta + 1 } : p)),
  };
}

/** Remove o vértice `indice`. Lança erro se o contorno ficaria com menos de 3 pontos. */
export function removerPontoDoMolde(molde: Molde, indice: number): Molde {
  if (molde.contorno.length <= 3) {
    throw new Error('O contorno precisa de ao menos 3 pontos — não é possível remover mais vértices.');
  }
  const arestaAnterior = (indice - 1 + molde.contorno.length) % molde.contorno.length;
  return {
    ...molde,
    contorno: removerPontoDoContorno(molde.contorno, indice),
    piques: molde.piques
      .filter((p) => p.indiceAresta !== indice && p.indiceAresta !== arestaAnterior)
      .map((p) => (p.indiceAresta > indice ? { ...p, indiceAresta: p.indiceAresta - 1 } : p)),
  };
}

/** Corta o canto vivo do vértice `indice` (chanfro reto de `distanciaMm`). */
export function chanfrarCantoDoMolde(molde: Molde, indice: number, distanciaMm: number): Molde {
  const arestaAnterior = (indice - 1 + molde.contorno.length) % molde.contorno.length;
  return {
    ...molde,
    contorno: chanfrarCantoDoContorno(molde.contorno, indice, distanciaMm),
    piques: molde.piques
      .filter((p) => p.indiceAresta !== indice && p.indiceAresta !== arestaAnterior)
      .map((p) => (p.indiceAresta > indice ? { ...p, indiceAresta: p.indiceAresta + 1 } : p)),
  };
}

/** Arredonda o canto do vértice `indice` (arco tesselado de raio `raioMm`). */
export function arredondarCantoDoMolde(molde: Molde, indice: number, raioMm: number): Molde {
  const arestaAnterior = (indice - 1 + molde.contorno.length) % molde.contorno.length;
  const contornoAntes = molde.contorno.length;
  const novoContorno = arredondarCantoDoContorno(molde.contorno, indice, raioMm);
  const delta = novoContorno.length - contornoAntes;
  return {
    ...molde,
    contorno: novoContorno,
    piques: molde.piques
      .filter((p) => p.indiceAresta !== indice && p.indiceAresta !== arestaAnterior)
      .map((p) => (p.indiceAresta > indice ? { ...p, indiceAresta: p.indiceAresta + delta } : p)),
  };
}

/**
 * Escala a peça por `fatorX`/`fatorY` (independentes), mantendo o canto
 * superior esquerdo do retângulo envolvente fixo — mesma referência visual
 * do "Dimensionar" do Audaces (DX/DY mostram o novo tamanho resultante).
 */
export function dimensionarMolde(molde: Molde, fatorX: number, fatorY: number): Molde {
  if (!Number.isFinite(fatorX) || fatorX <= 0 || !Number.isFinite(fatorY) || fatorY <= 0) {
    throw new Error('Fatores de dimensionamento precisam ser maiores que zero.');
  }
  const bbox = retanguloEnvolvente(molde.contorno);
  const origem = { x: bbox.minX, y: bbox.minY };
  return {
    ...molde,
    contorno: escalarContorno(molde.contorno, origem, fatorX, fatorY),
    linhasInternas: molde.linhasInternas.map((l) => escalarContorno(l, origem, fatorX, fatorY)),
    furos: molde.furos.map((f) => escalarContorno(f, origem, fatorX, fatorY)),
    piques: molde.piques.map((p) => ({ ...p, posicao: escalarPonto(p.posicao, origem, fatorX, fatorY) })),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: escalarPonto(m.posicao, origem, fatorX, fatorY) })),
    linhaDeFio: {
      inicio: escalarPonto(molde.linhaDeFio.inicio, origem, fatorX, fatorY),
      fim: escalarPonto(molde.linhaDeFio.fim, origem, fatorX, fatorY),
    },
  };
}

export interface DimensoesDoMolde {
  readonly larguraMm: number;
  readonly alturaMm: number;
  readonly areaMm2: number;
}

export function dimensoesDoMolde(molde: Molde): DimensoesDoMolde {
  const bbox = retanguloEnvolvente(molde.contorno);
  return { larguraMm: bbox.largura, alturaMm: bbox.altura, areaMm2: area(molde.contorno) };
}

/** Ângulo da seta do fio em graus, 0° = apontando para +x (direita), sentido anti-horário positivo. */
export function anguloDaLinhaDeFio(fio: LinhaDeFio): number {
  const dx = fio.fim.x - fio.inicio.x;
  const dy = fio.fim.y - fio.inicio.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function normalizarAngulo(anguloGraus: number): number {
  const normalizado = anguloGraus % 360;
  return normalizado < 0 ? normalizado + 360 : normalizado;
}

/** Lista as rotações (em graus, relativas à orientação original) que a restrição do molde permite. */
export function rotacoesPermitidas(restricao: RestricaoDeRotacao): readonly number[] {
  const permitidas = [0];
  if (restricao.permite180) permitidas.push(180);
  if (restricao.permite90e270) permitidas.push(90, 270);
  return permitidas.sort((a, b) => a - b);
}

/** Verdadeiro se `anguloGraus` (rotação proposta, qualquer valor) corresponde a uma das rotações permitidas. */
export function rotacaoEhPermitida(restricao: RestricaoDeRotacao, anguloGraus: number): boolean {
  const alvo = normalizarAngulo(anguloGraus);
  return rotacoesPermitidas(restricao).some((permitida) => Math.abs(permitida - alvo) < 1e-6);
}
