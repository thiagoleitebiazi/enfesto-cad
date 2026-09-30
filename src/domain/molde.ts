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
 * um pique silenciosamente na posição errada.
 */

/** Move o vértice `indice` do contorno. Furos/linhas internas/fio não mudam; piques mantêm o índice de aresta. */
export function moverPontoDoMolde(molde: Molde, indice: number, novaPosicao: Ponto2D): Molde {
  return { ...molde, contorno: moverPontoDoContorno(molde.contorno, indice, novaPosicao) };
}

/**
 * Move vários vértices do contorno juntos, pelo mesmo deslocamento —
 * seleção múltipla de pontos (Shift+clique ou "cerca" retangular na UI,
 * equivalente ao "Manipulação rápida"/"Definir cerca"+"Mover cerca" do
 * Audaces, unificados aqui numa única operação de domínio).
 */
export function moverVariosPontosDoMolde(molde: Molde, indices: readonly number[], delta: Ponto2D): Molde {
  const indicesSet = new Set(indices);
  return {
    ...molde,
    contorno: molde.contorno.map((p, i) => (indicesSet.has(i) ? somar(p, delta) : p)),
  };
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
