import type { Contorno, Ponto2D } from '../core/geometria';
import {
  retanguloEnvolvente,
  area,
  pontoMaisProximoNoContorno,
  deslocarContornoParaFora,
  transladarContorno,
  somar,
} from '../core/geometria';

/**
 * Regra crítica (seção 5 do escopo): por padrão nenhuma rotação que altere a
 * orientação em relação ao fio é permitida. 180° e 90°/270° são liberados
 * apenas quando o usuário autoriza explicitamente, por molde.
 */
export interface RestricaoDeRotacao {
  readonly permite180: boolean;
  readonly permite90e270: boolean;
}

export const RESTRICAO_PADRAO: RestricaoDeRotacao = {
  permite180: false,
  permite90e270: false,
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
