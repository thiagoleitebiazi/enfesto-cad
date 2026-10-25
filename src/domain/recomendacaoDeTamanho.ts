import type { FichaTecnica, PontoDeMedida } from './fichaTecnica';
import { numeroComVirgula } from '../core/numeros';
import { textoCsv } from '../core/csv';

/**
 * A recomendação de tamanho (ADR 0110): pelas medidas do corpo de uma pessoa e pela tabela de medidas da ficha
 * técnica (a peça pronta, por tamanho), com a regra de caimento de cada ponto — a folga que a peça deve ter sobre o
 * corpo (o busto, a cintura, o quadril) ou a medida que deve bater (o comprimento). Sai o tamanho recomendado, a
 * explicação ponto por ponto, os tamanhos que apertam e o "entre dois tamanhos". O guia de medidas (as faixas do
 * corpo de cada tamanho) sai das mesmas regras, para a loja.
 *
 * As medidas da pessoa não são gravadas (são dados pessoais): só a regra de caimento fica no projeto.
 *
 * O tecido entra pela elasticidade (ADR 0119): a volta da peça de malha cede no corpo, e o tamanho que é um pouco menor
 * que o corpo ainda veste; no tecido plano, não.
 */

export type TipoDoPonto = 'circunferencia' | 'comprimento';

export const ROTULO_DO_TIPO_DO_PONTO: Readonly<Record<TipoDoPonto, string>> = {
  circunferencia: 'Volta (precisa caber, com folga)',
  comprimento: 'Comprimento (o mais perto)',
};

export interface RegraDoPonto {
  readonly usar: boolean;
  readonly tipo: TipoDoPonto;
  /** A folga ideal da peça sobre o corpo (cm); no comprimento, a diferença desejada (normalmente 0). */
  readonly folgaCm: number;
  /** O peso do ponto na escolha (1 normal; 2 o que manda: o busto numa camisa, o quadril numa calça). */
  readonly peso: number;
}

/** As regras de caimento do projeto, por ponto de medida (pelo id do ponto). */
export type RegrasDeCaimento = Readonly<Record<string, RegraDoPonto>>;

// ---- O tecido (ADR 0119)

export type TecidoDaRecomendacao = 'plano' | 'malha' | 'malha-com-elastano' | 'personalizado';

export const TECIDOS_DA_RECOMENDACAO: Readonly<Record<Exclude<TecidoDaRecomendacao, 'personalizado'>, { readonly nome: string; readonly cedePercentual: number }>> = {
  plano: { nome: 'Tecido plano (não estica)', cedePercentual: 0 },
  malha: { nome: 'Malha (cede um pouco: 5%)', cedePercentual: 5 },
  'malha-com-elastano': { nome: 'Malha com elastano (cede 15%)', cedePercentual: 15 },
};

/** O máximo do personalizado: mais que isso, a peça fica marcando o corpo. */
export const CEDE_MAXIMO_PERCENTUAL = 40;

/**
 * O tecido da peça na recomendação: quanto a volta da peça cede no corpo, confortável, sem ficar marcando (% da
 * medida da peça). É menos que o quanto o tecido estica no teste da mão: a peça não pode vestir esticada no limite.
 */
export interface ElasticidadeDaRecomendacao {
  readonly tecido: TecidoDaRecomendacao;
  readonly cedePercentual: number;
}

export const SEM_ELASTICIDADE: ElasticidadeDaRecomendacao = { tecido: 'plano', cedePercentual: 0 };

/** A elasticidade de um dos tecidos da lista (o personalizado fica com o número dado, entre 0 e o máximo). */
export function elasticidadeDoTecido(tecido: TecidoDaRecomendacao, personalizadoPercentual = 0): ElasticidadeDaRecomendacao {
  if (tecido === 'personalizado') return { tecido, cedePercentual: Math.min(CEDE_MAXIMO_PERCENTUAL, Math.max(0, personalizadoPercentual)) };
  return { tecido, cedePercentual: TECIDOS_DA_RECOMENDACAO[tecido].cedePercentual };
}

/** A elasticidade guardada no projeto, conferida (sem ela, ou quebrada: o tecido plano). */
export function lerElasticidadeDaRecomendacao(bruto: unknown): ElasticidadeDaRecomendacao {
  if (typeof bruto !== 'object' || bruto === null) return SEM_ELASTICIDADE;
  const x = bruto as Record<string, unknown>;
  const tecido = x.tecido;
  if (tecido !== 'plano' && tecido !== 'malha' && tecido !== 'malha-com-elastano' && tecido !== 'personalizado') return SEM_ELASTICIDADE;
  const personalizado = typeof x.cedePercentual === 'number' && Number.isFinite(x.cedePercentual) ? x.cedePercentual : 0;
  return elasticidadeDoTecido(tecido, personalizado);
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A regra sugerida pelo nome do ponto (a folga usual de um caimento regular); `null`: o ponto não entra de saída. */
export function regraSugerida(nome: string): RegraDoPonto | null {
  const n = semAcento(nome);
  if (/busto|torax|peito/.test(n)) return { usar: true, tipo: 'circunferencia', folgaCm: 8, peso: 2 };
  if (/quadril|bacia/.test(n)) return { usar: true, tipo: 'circunferencia', folgaCm: 6, peso: 2 };
  if (/cintura/.test(n)) return { usar: true, tipo: 'circunferencia', folgaCm: 4, peso: 1 };
  if (/braco|biceps|coxa|punho/.test(n)) return { usar: true, tipo: 'circunferencia', folgaCm: 4, peso: 1 };
  if (/pescoco|colarinho/.test(n)) return { usar: true, tipo: 'circunferencia', folgaCm: 2, peso: 1 };
  if (/comprimento|manga|entreperna|gancho|ombro|costas/.test(n)) return { usar: true, tipo: 'comprimento', folgaCm: 0, peso: 1 };
  return null;
}

/** A regra de cada ponto da ficha: a guardada, ou a sugerida pelo nome (ou fora, se o nome não diz). */
export function regrasDaFicha(ficha: Pick<FichaTecnica, 'medidas'>, guardadas: RegrasDeCaimento = {}): Record<string, RegraDoPonto> {
  const regras: Record<string, RegraDoPonto> = {};
  for (const p of ficha.medidas) regras[p.id] = guardadas[p.id] ?? regraSugerida(p.nome) ?? { usar: false, tipo: 'circunferencia', folgaCm: 4, peso: 1 };
  return regras;
}

export interface AvaliacaoDoPonto {
  readonly pontoId: string;
  readonly nome: string;
  readonly tipo: TipoDoPonto;
  readonly corpoCm: number;
  /** O que a peça deveria ter (o corpo + a folga). */
  readonly idealCm: number;
  readonly pecaCm: number;
  readonly toleranciaCm: number;
  /** Peça − ideal (positivo: maior que o ideal). */
  readonly diferencaCm: number;
  /** Na volta: quanto a peça cede no corpo pelo tecido (cm; 0 no plano e no comprimento). */
  readonly cedeCm: number;
  /** Na volta: a peça, mesmo no máximo da tolerância e cedendo o que o tecido cede, é menor que o corpo. */
  readonly aperta: boolean;
  /** Na volta: a peça é menor que o corpo, mas veste porque o tecido cede (malha). */
  readonly esticaParaVestir: boolean;
}

export interface AvaliacaoDoTamanho {
  readonly tamanho: string;
  readonly pontos: readonly AvaliacaoDoPonto[];
  /** Quanto o tamanho se afasta do ideal (menor é melhor; o mais justo que o ideal pesa o triplo). */
  readonly nota: number;
  /** O afastamento médio do ideal (cm, pelo peso, sem o triplo do justo): a medida do "entre dois tamanhos". */
  readonly desvioCm: number;
  readonly veste: boolean;
}

export interface Recomendacao {
  readonly tamanhos: readonly AvaliacaoDoTamanho[];
  /** O recomendado (`null`: falta dado). */
  readonly recomendado: string | null;
  /** O tamanho vizinho que também veste e fica perto do ideal (a pessoa entre dois tamanhos). */
  readonly alternativa: string | null;
  readonly explicacao: readonly string[];
  readonly faltando: readonly string[];
}

const cm = (v: number): string => `${numeroComVirgula(v, 1)} cm`;

/** Avalia cada tamanho da ficha para as medidas do corpo (cm, pelo id do ponto) e recomenda um. */
export function recomendarTamanho(
  ficha: Pick<FichaTecnica, 'medidas' | 'tamanhos'>,
  regras: RegrasDeCaimento,
  corpoCm: Readonly<Record<string, number>>,
  elasticidade: ElasticidadeDaRecomendacao = SEM_ELASTICIDADE,
): Recomendacao {
  const faltando: string[] = [];
  const usados = ficha.medidas.filter((p) => regras[p.id]?.usar);
  if (usados.length === 0) faltando.push('Escolha ao menos um ponto de medida para comparar (por exemplo, o busto ou o quadril).');
  const comCorpo = usados.filter((p) => corpoCm[p.id] !== undefined && corpoCm[p.id]! > 0);
  for (const p of usados) if (!comCorpo.includes(p)) faltando.push(`Falta a medida do corpo: ${p.nome}.`);
  if (ficha.tamanhos.length === 0) faltando.push('A ficha não tem tamanhos (aba Descrição).');
  const tamanhos = ficha.tamanhos.map((t) => avaliarTamanho(t, comCorpo, regras, corpoCm, elasticidade.cedePercentual / 100));
  const avaliaveis = tamanhos.filter((t) => t.pontos.length === comCorpo.length && t.pontos.length > 0);
  if (comCorpo.length > 0 && avaliaveis.length === 0) faltando.push('Nenhum tamanho tem todas as medidas usadas na tabela da ficha.');
  if (faltando.length > 0 && (comCorpo.length === 0 || avaliaveis.length === 0)) return { tamanhos, recomendado: null, alternativa: null, explicacao: [], faltando };
  const ordenados = [...avaliaveis].sort((a, b) => Number(b.veste) - Number(a.veste) || a.nota - b.nota);
  const melhor = ordenados[0]!;
  const alternativa = melhor.veste ? vizinhoQueTambemServe(ficha.tamanhos, avaliaveis, melhor) : null;
  const explicacao: string[] = [];
  if (!melhor.veste) {
    const apertados = melhor.pontos.filter((p) => p.aperta).map((p) => `${p.nome} (${cm(p.corpoCm - (p.pecaCm + p.cedeCm + p.toleranciaCm))} a menos que o corpo${p.cedeCm > 0 ? ', mesmo com o tecido cedendo' : ''})`);
    explicacao.push(`Nenhum tamanho veste com a folga pedida: o ${melhor.tamanho} é o que mais se aproxima, mas aperta em ${apertados.join(', ')}.`);
  } else {
    explicacao.push(`O ${melhor.tamanho} é o que mais se aproxima do caimento pedido${alternativa ? `; o ${alternativa} também serve (a pessoa está entre os dois)` : ''}.`);
  }
  if (elasticidade.cedePercentual > 0) {
    explicacao.push(`O tecido cede até ${numeroComVirgula(elasticidade.cedePercentual, 0)}% na volta: o tamanho um pouco menor que o corpo ainda veste (justo, esticado no corpo).`);
  }
  for (const p of melhor.pontos) {
    const comoFica = Math.abs(p.diferencaCm) < 0.05 ? 'na medida certa' : p.diferencaCm > 0 ? `${cm(p.diferencaCm)} a mais que o ideal (mais folgado)` : `${cm(-p.diferencaCm)} a menos que o ideal (mais justo)`;
    explicacao.push(
      p.tipo === 'circunferencia'
        ? `${p.nome}: corpo ${cm(p.corpoCm)} + folga ${cm(p.idealCm - p.corpoCm)} = ${cm(p.idealCm)}; o ${melhor.tamanho} tem ${cm(p.pecaCm)} (± ${numeroComVirgula(p.toleranciaCm, 1)}${p.cedeCm > 0 ? `; cede até ${cm(p.cedeCm)}` : ''}): ${comoFica}${p.esticaParaVestir ? ', e veste esticando' : ''}.`
        : `${p.nome}: o ideal é ${cm(p.idealCm)}; o ${melhor.tamanho} tem ${cm(p.pecaCm)} (± ${numeroComVirgula(p.toleranciaCm, 1)}): ${comoFica}.`,
    );
  }
  for (const t of tamanhos) {
    if (t === melhor || t.veste || t.pontos.length === 0) continue;
    explicacao.push(`O ${t.tamanho} aperta em: ${t.pontos.filter((p) => p.aperta).map((p) => p.nome).join(', ')}.`);
  }
  return { tamanhos, recomendado: melhor.tamanho, alternativa, explicacao, faltando };
}

/** O vizinho (o tamanho de antes ou o de depois) que veste, com o afastamento até o dobro do recomendado (+ 0,5 cm). */
function vizinhoQueTambemServe(ordem: readonly string[], avaliaveis: readonly AvaliacaoDoTamanho[], melhor: AvaliacaoDoTamanho): string | null {
  const i = ordem.indexOf(melhor.tamanho);
  const vizinhos = [ordem[i - 1], ordem[i + 1]]
    .map((t) => avaliaveis.find((a) => a.tamanho === t))
    .filter((a): a is AvaliacaoDoTamanho => a !== undefined && a.veste && a.desvioCm <= 2 * melhor.desvioCm + 0.5)
    .sort((a, b) => a.desvioCm - b.desvioCm);
  return vizinhos[0]?.tamanho ?? null;
}

function avaliarTamanho(tamanho: string, pontos: readonly PontoDeMedida[], regras: RegrasDeCaimento, corpoCm: Readonly<Record<string, number>>, cede: number): AvaliacaoDoTamanho {
  const avaliados: AvaliacaoDoPonto[] = [];
  let nota = 0;
  let desvio = 0;
  let pesos = 0;
  for (const p of pontos) {
    const peca = p.valoresCm[tamanho];
    if (peca === undefined) continue;
    const regra = regras[p.id]!;
    const corpo = corpoCm[p.id]!;
    const ideal = corpo + regra.folgaCm;
    const diferenca = peca - ideal;
    // A volta da malha cede no corpo: ela aperta só se nem cedendo chega no corpo.
    const cedeCm = regra.tipo === 'circunferencia' ? peca * cede : 0;
    const menorQueOCorpo = regra.tipo === 'circunferencia' && peca + p.toleranciaCm < corpo;
    const aperta = menorQueOCorpo && peca + cedeCm + p.toleranciaCm < corpo;
    nota += regra.peso * (diferenca < 0 ? 3 : 1) * Math.abs(diferenca);
    desvio += regra.peso * Math.abs(diferenca);
    pesos += regra.peso;
    avaliados.push({ pontoId: p.id, nome: p.nome, tipo: regra.tipo, corpoCm: corpo, idealCm: ideal, pecaCm: peca, toleranciaCm: p.toleranciaCm, diferencaCm: diferenca, cedeCm, aperta, esticaParaVestir: menorQueOCorpo && !aperta });
  }
  return { tamanho, pontos: avaliados, nota, desvioCm: pesos > 0 ? desvio / pesos : 0, veste: avaliados.length > 0 && !avaliados.some((p) => p.aperta) };
}

// ---- O guia de medidas (para a loja)

export interface FaixaDoGuia {
  readonly pontoId: string;
  readonly nome: string;
  /** A medida do corpo de cada tamanho: o ideal e a faixa (até o meio do caminho para o vizinho). */
  readonly porTamanho: Readonly<Record<string, { readonly idealCm: number; readonly deCm: number; readonly ateCm: number }>>;
}

/** As faixas do corpo de cada tamanho, pelos pontos usados (a peça − a folga; os vizinhos dividem o caminho). */
export function guiaDeMedidas(ficha: Pick<FichaTecnica, 'medidas' | 'tamanhos'>, regras: RegrasDeCaimento): FaixaDoGuia[] {
  const faixas: FaixaDoGuia[] = [];
  for (const p of ficha.medidas) {
    const regra = regras[p.id];
    if (!regra?.usar) continue;
    const comValor = ficha.tamanhos.filter((t) => p.valoresCm[t] !== undefined);
    if (comValor.length === 0) continue;
    const ideais = comValor.map((t) => p.valoresCm[t]! - regra.folgaCm);
    const porTamanho: Record<string, { idealCm: number; deCm: number; ateCm: number }> = {};
    comValor.forEach((t, i) => {
      const ideal = ideais[i]!;
      const antes = ideais[i - 1];
      const depois = ideais[i + 1];
      const passo = depois !== undefined ? depois - ideal : antes !== undefined ? ideal - antes : 2 * p.toleranciaCm;
      porTamanho[t] = {
        idealCm: ideal,
        deCm: antes !== undefined ? (antes + ideal) / 2 : ideal - passo / 2,
        ateCm: depois !== undefined ? (ideal + depois) / 2 : ideal + passo / 2,
      };
    });
    faixas.push({ pontoId: p.id, nome: p.nome, porTamanho });
  }
  return faixas;
}

const faixaEscrita = (f: { readonly deCm: number; readonly ateCm: number }): string => `${numeroComVirgula(f.deCm, 0)}–${numeroComVirgula(f.ateCm, 0)}`;

export function csvDoGuia(faixas: readonly FaixaDoGuia[], tamanhos: readonly string[]): string {
  const cabecalho = ['Medida do corpo (cm)', ...tamanhos];
  const linhas = faixas.map((f) => [f.nome, ...tamanhos.map((t) => (f.porTamanho[t] ? faixaEscrita(f.porTamanho[t]) : ''))]);
  return textoCsv([cabecalho, ...linhas]);
}

const escapar = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** O guia de medidas como uma página HTML simples (para pôr na loja virtual). */
export function htmlDoGuia(titulo: string, faixas: readonly FaixaDoGuia[], tamanhos: readonly string[]): string {
  const cabecalho = `<tr><th>Medida do corpo (cm)</th>${tamanhos.map((t) => `<th>${escapar(t)}</th>`).join('')}</tr>`;
  const linhas = faixas.map((f) => `<tr><th>${escapar(f.nome)}</th>${tamanhos.map((t) => `<td>${f.porTamanho[t] ? faixaEscrita(f.porTamanho[t]) : '—'}</td>`).join('')}</tr>`).join('\n      ');
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapar(titulo)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 16px; color: #1f2933; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #c5cad3; padding: 6px 10px; text-align: center; }
      thead th { background: #1b2a4a; color: #fff; }
      tbody th { text-align: left; background: #f4f5f7; }
    </style>
  </head>
  <body>
    <h1>${escapar(titulo)}</h1>
    <p>Meça o corpo com a fita justa (sem apertar) e procure a coluna em que as suas medidas cabem.</p>
    <table>
      <thead>${cabecalho}</thead>
      <tbody>
      ${linhas}
      </tbody>
    </table>
  </body>
</html>
`;
}

// ---- A leitura (de dentro do projeto)

/** As regras guardadas no projeto, conferidas (o que não serve fica de fora). */
export function lerRegrasDeCaimento(bruto: unknown): RegrasDeCaimento {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return {};
  const regras: Record<string, RegraDoPonto> = {};
  for (const [id, r] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof r !== 'object' || r === null) continue;
    const x = r as Record<string, unknown>;
    if (typeof x.usar !== 'boolean' || (x.tipo !== 'circunferencia' && x.tipo !== 'comprimento') || typeof x.folgaCm !== 'number' || typeof x.peso !== 'number') continue;
    regras[id] = { usar: x.usar, tipo: x.tipo, folgaCm: x.folgaCm, peso: x.peso };
  }
  return regras;
}
