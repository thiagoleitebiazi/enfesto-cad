import {
  area,
  distancia,
  pontoMaisProximoNoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { criarBainha, geometriaDaBainha, type OpcoesDeBainha } from '../domain/bainha';
import {
  conferirOpcoesDeCorte,
  cortarMoldeComOpcoes,
  CORTE_SEM_COSTURA,
  desdobraComAMetadeGuardada,
  desdobrarMolde,
  dobraPelaLinhaInterna,
  dobrarMolde,
  encostarMolde,
  metadeDoMolde,
  removerFaixaDoMolde,
  separarRegiaoDoMolde,
  unirMoldes,
  type OpcoesDeCorte,
  type OpcoesDeDobra,
} from '../domain/corteEUniao';
import { rotacaoEhPermitida, type Molde } from '../domain/molde';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import { caminhoDoTrecho, SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import { formatarMm } from './medidas';

/**
 * Ferramentas da aba Produção que cortam, dobram, unem e dão bainha à peça
 * selecionada. Aqui fica o que cada clique faz e o que o desenho mostra antes
 * de aplicar; a geometria é do domínio (`corteEUniao.ts` e `bainha.ts`).
 */
export type FerramentaDeMolde = 'cortar' | 'remover-regiao' | 'dobrar' | 'desdobrar' | 'unir' | 'bainha';

/** As que pedem uma reta de corte, de um ponto do contorno a outro. */
export type FerramentaDeReta = 'cortar' | 'remover-regiao' | 'dobrar';

const FERRAMENTAS_DE_MOLDE: ReadonlySet<string> = new Set(['cortar', 'remover-regiao', 'dobrar', 'desdobrar', 'unir', 'bainha']);

export function ehFerramentaDeMolde(modo: string): modo is FerramentaDeMolde {
  return FERRAMENTAS_DE_MOLDE.has(modo);
}

export function ehFerramentaDeReta(modo: string): modo is FerramentaDeReta {
  return modo === 'cortar' || modo === 'remover-regiao' || modo === 'dobrar';
}

/** Dois pontos do contorno a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;

/** O que o desenho mostra enquanto a ferramenta está em uso (o mesmo formato da prévia das curvas). */
export interface PreviaDeFerramentaDeMolde {
  readonly novo?: readonly Ponto2D[] | null;
  readonly novoFechado?: boolean;
  readonly substituido?: readonly Ponto2D[] | null;
  /** Linhas que vão entrar na peça além do contorno (pernas de pence, linhas de dobra). */
  readonly linhas?: readonly (readonly Ponto2D[])[];
  readonly marcas?: readonly Ponto2D[];
}

/** O resultado de aplicar uma ferramenta: as peças novas do projeto e o que dizer na faixa de mensagens. */
export interface ResultadoDeFerramentaDeMolde {
  readonly pecas: readonly Molde[];
  readonly recado: string;
}

function cm2(areaMm2: number): string {
  return `${(areaMm2 / 100).toFixed(1).replace('.', ',')} cm²`;
}

/** A aresta do contorno que passa a até `raioMm` do ponto, ou `null`. */
export function arestaPerto(p: Ponto2D, contorno: Contorno, raioMm: number): number | null {
  const maisProximo = pontoMaisProximoNoContorno(p, contorno);
  return maisProximo.distancia <= raioMm ? maisProximo.indiceAresta : null;
}

/** Das outras peças, a aresta mais próxima do ponto, a até `raioMm` dele. */
export function arestaDeOutraPecaPerto(
  p: Ponto2D,
  pecas: readonly Molde[],
  excetoId: string,
  raioMm: number,
): { readonly peca: Molde; readonly indiceAresta: number } | null {
  let melhor: { peca: Molde; indiceAresta: number } | null = null;
  let menor = raioMm;
  for (const peca of pecas) {
    if (peca.id === excetoId) continue;
    const maisProximo = pontoMaisProximoNoContorno(p, peca.contorno);
    if (maisProximo.distancia <= menor) {
      menor = maisProximo.distancia;
      melhor = { peca, indiceAresta: maisProximo.indiceAresta };
    }
  }
  return melhor;
}

function arestaDoContorno(contorno: Contorno, indiceAresta: number): Ponto2D[] {
  return [contorno[indiceAresta]!, contorno[(indiceAresta + 1) % contorno.length]!];
}

/** O que o "Remover região" pergunta. */
export interface OpcoesDeRemoverRegiao {
  /** "Manter região do molde": a região tirada vira uma peça nova, em vez de sumir. */
  readonly manter: boolean;
  /** "Unir moldes": com duas retas, sai a faixa entre elas, e as duas partes que sobram são unidas. */
  readonly unir: boolean;
}

export const REMOVER_REGIAO_SIMPLES: OpcoesDeRemoverRegiao = { manter: false, unir: false };

/**
 * A reta está completa: os dois pontos do contorno e, em "Dobrar" e "Remover
 * região", o clique dentro da peça que escolhe o lado. Em "Remover região" com
 * `segundaReta` ("Unir moldes"), em vez do lado vêm os dois pontos da segunda
 * reta.
 */
export function retaCompleta(ferramenta: FerramentaDeReta | 'bainha', estado: TrechoEmEdicao, segundaReta = false): boolean {
  if (!estado.inicio || !estado.fim) return false;
  if (ferramenta === 'remover-regiao' && segundaReta) return estado.livres.length >= 2;
  return ferramenta === 'cortar' || ferramenta === 'bainha' || estado.livres.length > 0;
}

/**
 * O estado depois de um clique: primeiro os dois pontos do contorno (um clique
 * fora dele, ou no mesmo ponto, não conta) e, nas ferramentas que escolhem um
 * lado, o ponto clicado em seguida. Com `segundaReta`, os cliques seguintes
 * são os dois pontos do contorno da segunda reta.
 */
export function cliqueDeReta(ferramenta: FerramentaDeReta | 'bainha', estado: TrechoEmEdicao, clique: CliqueDeTrecho, segundaReta = false): TrechoEmEdicao {
  if (retaCompleta(ferramenta, estado, segundaReta)) return estado;
  if (!estado.inicio) return clique.noContorno ? { ...SEM_TRECHO, inicio: clique.noContorno } : estado;
  if (!estado.fim) {
    const fim = clique.noContorno;
    return fim && distancia(fim.ponto, estado.inicio.ponto) > MESMO_PONTO_MM ? { ...estado, fim } : estado;
  }
  if (ferramenta === 'remover-regiao' && segundaReta) {
    const p = clique.noContorno?.ponto;
    const repetido = p !== undefined && estado.livres.some((q) => distancia(p, q) <= MESMO_PONTO_MM);
    return p && !repetido ? { ...estado, livres: [...estado.livres, p] } : estado;
  }
  return { ...estado, livres: [clique.livre] };
}

/**
 * O clique numa linha interna reta da peça (o "elemento"), em vez de dois
 * pontos do contorno: a reta é a linha inteira, de borda a borda. Vale para a
 * reta que ainda não começou — a primeira ou, com `segundaReta`, a segunda.
 * `null` quando o clique não é isso, e a ferramenta segue como sempre.
 */
export function retaPeloElemento(
  ferramenta: FerramentaDeReta,
  peca: Molde,
  estado: TrechoEmEdicao,
  linhaInterna: number | null,
  segundaReta = false,
): { readonly estado: TrechoEmEdicao; readonly recado: string | null } | null {
  if (linhaInterna === null || ferramenta === 'dobrar') return null;
  const primeira = !estado.inicio;
  const segunda = ferramenta === 'remover-regiao' && segundaReta && estado.inicio !== null && estado.fim !== null && estado.livres.length === 0;
  if (!primeira && !segunda) return null;
  try {
    const [a, b] = dobraPelaLinhaInterna(peca, linhaInterna);
    return { estado: primeira ? { ...SEM_TRECHO, inicio: a, fim: b } : { ...estado, livres: [a.ponto, b.ponto] }, recado: null };
  } catch (e) {
    return { estado, recado: (e instanceof Error ? e.message : String(e)).replace('de linha de dobra', 'de reta de corte') };
  }
}

/** Um nome que nenhuma peça usa: "Nome (2)", "Nome (3)"… */
export function nomeDaParteNova(nome: string, pecas: readonly Molde[]): string {
  const usados = new Set(pecas.map((p) => p.nome));
  for (let n = 2; ; n++) {
    const candidato = `${nome} (${n})`;
    if (!usados.has(candidato)) return candidato;
  }
}

function trocar(pecas: readonly Molde[], id: string, novas: readonly Molde[]): Molde[] {
  return pecas.flatMap((p) => (p.id === id ? novas : [p]));
}

const DOBRA_SIMPLES: OpcoesDeDobra = { manter: false, fioNoCentro: false };

/**
 * Aplica "Cortar", "Remover região" ou "Dobrar" na peça. Lança erro, sem mudar
 * nada, quando a reta não serve. `dobra` são as opções da janela do "Dobrar";
 * `extras`, as do "Cortar" e do "Remover região".
 */
export function aplicarReta(
  ferramenta: FerramentaDeReta,
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  novoId: () => string,
  dobra: OpcoesDeDobra = DOBRA_SIMPLES,
  extras: { readonly corte?: OpcoesDeCorte; readonly remover?: OpcoesDeRemoverRegiao } = {},
): ResultadoDeFerramentaDeMolde {
  if (!estado.inicio || !estado.fim) throw new Error('Indique os dois pontos da reta no contorno da peça.');
  if (ferramenta === 'cortar') {
    const corte = extras.corte ?? CORTE_SEM_COSTURA;
    const [maior, menor] = cortarMoldeComOpcoes(peca, estado.inicio, estado.fim, novoId, corte);
    const nova = { ...menor, nome: nomeDaParteNova(peca.nome, pecas) };
    const costura =
      corte.costuraMm > 0
        ? ` A borda do corte ganhou ${formatarMm(corte.costuraMm)} de costura ${corte.costuraNasDuas ? 'nas duas partes' : 'na peça nova'}${corte.piques ? ', com um pique em cada ponta da linha do corte' : ''}.`
        : '';
    return {
      pecas: trocar(pecas, peca.id, [maior, nova]),
      recado: `“${peca.nome}” cortada em duas: ${cm2(area(maior.contorno))} continuam nela e ${cm2(area(nova.contorno))} são a peça nova “${nova.nome}”.${costura}`,
    };
  }
  const remover = extras.remover ?? REMOVER_REGIAO_SIMPLES;
  if (ferramenta === 'remover-regiao' && remover.unir) {
    const [a2, b2] = estado.livres;
    if (!a2 || !b2) throw new Error('Indique as duas retas que delimitam a faixa: dois pontos do contorno para cada uma.');
    const { peca: unida, faixa, degrauMm } = removerFaixaDoMolde(peca, estado.inicio, estado.fim, a2, b2, novoId());
    const guardada = remover.manter ? { ...faixa, nome: nomeDaParteNova(peca.nome, pecas) } : null;
    const degrau =
      degrauMm > 0.05 ? ` As duas retas têm comprimentos diferentes: as bordas ficaram centralizadas, e sobrou um degrau de ${formatarMm(degrauMm / 2)} em cada ponta.` : '';
    return {
      pecas: trocar(pecas, peca.id, guardada ? [unida, guardada] : [unida]),
      recado:
        `Faixa de ${cm2(area(faixa.contorno))} removida de “${peca.nome}”, e as duas partes que sobraram foram unidas: a peça passou de ${cm2(area(peca.contorno))} para ${cm2(area(unida.contorno))}.` +
        (guardada ? ` A faixa virou a peça “${guardada.nome}”.` : '') +
        degrau,
    };
  }
  const lado = estado.livres[0];
  if (!lado) throw new Error('Clique dentro da peça para escolher o lado.');
  if (ferramenta === 'dobrar') {
    const dobrada = dobrarMolde(peca, estado.inicio, estado.fim, lado, dobra);
    return {
      pecas: trocar(pecas, peca.id, [dobrada]),
      recado: `“${peca.nome}” dobrada: ficou o lado clicado, e a reta é a linha de dobra. ${
        dobra.manter
          ? 'A outra metade ficou guardada: “Desdobrar”, nessa aresta, traz ela de volta como era.'
          : '“Desdobrar”, nessa aresta, devolve a outra metade espelhada.'
      }`,
    };
  }
  if (remover.manter) {
    const { peca: sem, regiao } = separarRegiaoDoMolde(peca, estado.inicio, estado.fim, lado, novoId());
    const guardada = { ...regiao, nome: nomeDaParteNova(peca.nome, pecas) };
    return {
      pecas: trocar(pecas, peca.id, [sem, guardada]),
      recado: `Região de ${cm2(area(guardada.contorno))} removida de “${peca.nome}”; ela virou a peça “${guardada.nome}”.`,
    };
  }
  const metade = metadeDoMolde(peca, estado.inicio, estado.fim, lado, 'sai');
  return {
    pecas: trocar(pecas, peca.id, [metade]),
    recado: `Região de ${cm2(area(peca.contorno) - area(metade.contorno))} removida de “${peca.nome}”.`,
  };
}

/** O que a janela do "Cortar" pergunta. */
export function dialogoDeCortar(opcoes: OpcoesDeCorte): { readonly titulo: string; readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    titulo: 'Cortar molde',
    campos: [
      { tipo: 'medida', id: 'costura', rotulo: 'Costura na borda do corte (mm; 0 = sem costura)', inicial: String(opcoes.costuraMm).replace('.', ',') },
      { tipo: 'caixa', id: 'costuraNasDuas', rotulo: 'Costura 2 moldes: nas duas partes (sem isso, só na peça nova)', inicial: opcoes.costuraNasDuas },
      { tipo: 'caixa', id: 'piques', rotulo: 'Pique em cada ponta da linha do corte, na parte que ganha costura', inicial: opcoes.piques },
      {
        tipo: 'escolha',
        id: 'modo',
        rotulo: 'Modo: como a costura acaba nas pontas',
        opcoes: [
          { valor: 'tangente', rotulo: 'Tangente: segue a direção das arestas vizinhas' },
          { valor: 'reta', rotulo: 'Reta: sai em esquadro com o corte' },
        ],
        inicial: opcoes.modo,
      },
    ],
    nota: 'Depois de confirmar, clique no contorno da peça, onde o corte começa e onde termina — ou numa linha interna reta dela (o elemento), que vira a reta do corte, de borda a borda. A parte maior continua sendo a peça; a outra vira uma peça nova. A costura entra no contorno, só na borda do corte; no modo tangente, a aresta vizinha que não chega à borda nova em até quatro vezes a costura acaba em esquadro. O manual da referência não diz qual parte ganha a costura sem “2 moldes”; aqui é a peça nova.',
  };
}

/** As opções do "Cortar" com o que a janela entregou. Lança erro quando a costura não serve. */
export function lerDialogoDeCortar(valores: ValoresDoDialogo): OpcoesDeCorte {
  const opcoes: OpcoesDeCorte = {
    costuraMm: Number(valores.costura),
    costuraNasDuas: valores.costuraNasDuas === true,
    piques: valores.piques === true,
    modo: valores.modo === 'reta' ? 'reta' : 'tangente',
  };
  conferirOpcoesDeCorte(opcoes);
  return opcoes;
}

/** O que a janela do "Remover região" pergunta. */
export function dialogoDeRemoverRegiao(opcoes: OpcoesDeRemoverRegiao): { readonly titulo: string; readonly campos: readonly CampoDoDialogo[]; readonly nota: string } {
  return {
    titulo: 'Remover região',
    campos: [
      { tipo: 'caixa', id: 'manter', rotulo: 'Manter região do molde: a região tirada vira uma peça nova', inicial: opcoes.manter },
      { tipo: 'caixa', id: 'unir', rotulo: 'Unir moldes: com duas retas, sai a faixa entre elas e as duas partes que sobram são unidas', inicial: opcoes.unir },
    ],
    nota: 'Depois de confirmar, indique a reta que separa a região: dois pontos do contorno, ou uma linha interna reta (o elemento). Sem “Unir moldes”, clique em seguida dentro da região que deve sair. Com “Unir moldes”, indique a segunda reta do mesmo jeito: a faixa entre as duas sai, e a parte que não tem a linha de fio gira e anda até encostar na outra, borda com borda.',
  };
}

export function lerDialogoDeRemoverRegiao(valores: ValoresDoDialogo): OpcoesDeRemoverRegiao {
  return { manter: valores.manter === true, unir: valores.unir === true };
}

const ESC_DA_RETA = ' Esc sai.';

/** A instrução do próximo clique do "Cortar" e do "Remover região". */
export function instrucaoDaReta(ferramenta: 'cortar' | 'remover-regiao', estado: TrechoEmEdicao, remover: OpcoesDeRemoverRegiao = REMOVER_REGIAO_SIMPLES): string {
  const ouElemento = ' Ou clique numa linha interna reta da peça: ela vira a reta, de borda a borda.';
  if (ferramenta === 'cortar') {
    return !estado.inicio
      ? 'Cortar: clique no contorno da peça selecionada, onde o corte começa.' + ouElemento + ESC_DA_RETA
      : 'Cortar: clique no contorno, onde o corte termina — a peça vira duas, pela reta tracejada.' + ESC_DA_RETA;
  }
  if (!estado.inicio) return 'Remover região: clique no contorno da peça selecionada, numa ponta da reta que separa a região.' + ouElemento + ESC_DA_RETA;
  if (!estado.fim) return 'Remover região: clique no contorno, na outra ponta da reta.' + ESC_DA_RETA;
  if (!remover.unir) return 'Remover região: clique dentro da peça, na região que deve sair (ela fica em destaque).' + ESC_DA_RETA;
  return estado.livres.length === 0
    ? 'Remover região (unir): agora a segunda reta — clique no contorno, numa ponta dela, ou numa linha interna reta.' + ESC_DA_RETA
    : 'Remover região (unir): clique no contorno, na outra ponta da segunda reta — a faixa entre as duas sai (fica em destaque).' + ESC_DA_RETA;
}

/**
 * A prévia da reta de corte: a reta até o mouse e, com ela posta, o lado que
 * vai sair em destaque. Com `segundaReta` ("Remover região" unindo), a
 * segunda reta até o mouse e, se ela fecha a faixa, a faixa em destaque.
 */
export function previaDaReta(
  ferramenta: FerramentaDeReta,
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  segundaReta = false,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!estado.inicio) return { marcas };
  const ate = estado.fim?.ponto ?? mouse?.noContorno?.ponto ?? mouse?.livre ?? null;
  const novo = ate && distancia(ate, estado.inicio.ponto) > MESMO_PONTO_MM ? [estado.inicio.ponto, ate] : null;
  if (ferramenta === 'remover-regiao' && segundaReta && estado.fim) {
    const todas = [...marcas, ...estado.livres];
    const a2 = estado.livres[0];
    if (!a2) return { novo, marcas: todas };
    const b2 = estado.livres[1] ?? mouse?.noContorno?.ponto ?? null;
    const segunda = [a2, b2 ?? mouse?.livre ?? a2];
    try {
      // Só para saber qual é a faixa: o id e as peças não importam aqui.
      const faixa = b2 ? removerFaixaDoMolde(peca, estado.inicio, estado.fim, a2, b2, 'previa').faixa.contorno : null;
      return { novo, linhas: [segunda], marcas: todas, ...(faixa ? { substituido: [...faixa, faixa[0]!] } : {}) };
    } catch {
      return { novo, linhas: [segunda], marcas: todas };
    }
  }
  if (!estado.fim || ferramenta === 'cortar' || !mouse) return { novo, marcas };
  try {
    // O lado sob o mouse: em "Remover região" é o que sai; em "Dobrar", sai o outro.
    const queSai = metadeDoMolde(peca, estado.inicio, estado.fim, mouse.livre, ferramenta === 'dobrar' ? 'sai' : 'fica').contorno;
    return { novo, substituido: [...queSai, queSai[0]!], marcas };
  } catch {
    return { novo, marcas };
  }
}

/** Aplica a bainha no trecho indicado da peça. */
export function aplicarBainha(
  pecas: readonly Molde[],
  peca: Molde,
  estado: TrechoEmEdicao,
  opcoes: OpcoesDeBainha,
  novoId: () => string,
): ResultadoDeFerramentaDeMolde {
  if (!estado.inicio || !estado.fim) throw new Error('Indique o começo e o fim da bainha no contorno da peça.');
  const comBainha = criarBainha(peca, estado.inicio, estado.fim, opcoes, novoId);
  const larguras =
    opcoes.largura2Mm !== undefined && opcoes.largura2Mm !== opcoes.larguraMm
      ? `de ${formatarMm(opcoes.larguraMm)} a ${formatarMm(opcoes.largura2Mm)}`
      : `de ${formatarMm(opcoes.larguraMm)}`;
  return {
    pecas: trocar(pecas, peca.id, [comBainha]),
    recado: `Bainha com ${opcoes.dobras} ${opcoes.dobras === 1 ? 'dobra' : 'dobras'} ${larguras} criada em “${peca.nome}”.`,
  };
}

/** A prévia da bainha: o trecho indicado em destaque e a sobra que entraria no contorno. */
export function previaDaBainha(
  peca: Molde,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  opcoes: OpcoesDeBainha,
): PreviaDeFerramentaDeMolde {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!estado.inicio) return { marcas };
  const fim: PosicaoNoContorno | null = estado.fim ?? mouse?.noContorno ?? null;
  if (!fim || distancia(fim.ponto, estado.inicio.ponto) <= MESMO_PONTO_MM) return { marcas };
  const substituido = caminhoDoTrecho(peca.contorno, estado.inicio, fim);
  try {
    const { de, ate, miolo } = geometriaDaBainha(peca, estado.inicio, fim, opcoes);
    return { novo: [de.ponto, ...miolo, ate.ponto], substituido, marcas };
  } catch {
    return { substituido, marcas };
  }
}

/** Aplica "Desdobrar" na aresta indicada da peça; `fioNoCentro` é a opção da janela do "Dobrar". */
export function aplicarDesdobrar(
  pecas: readonly Molde[],
  peca: Molde,
  indiceAresta: number,
  novoId: () => string,
  fioNoCentro = false,
): ResultadoDeFerramentaDeMolde {
  const comAGuardada = desdobraComAMetadeGuardada(peca, indiceAresta);
  const inteira = desdobrarMolde(peca, indiceAresta, novoId, { fioNoCentro });
  const como = comAGuardada
    ? 'a metade que estava guardada voltou como era'
    : peca.dobraMantida
      ? 'a outra metade entrou espelhada — a metade guardada é de outra aresta, ou a dobra foi mexida e ela já não encaixa'
      : 'a outra metade entrou espelhada';
  return {
    pecas: trocar(pecas, peca.id, [inteira]),
    recado: `“${peca.nome}” desdobrada: ${como}. Agora tem ${cm2(area(inteira.contorno))}, e a dobra ficou como linha interna.`,
  };
}

/** A prévia de "Desdobrar": a aresta sob o mouse em destaque e a peça como ficaria. */
export function previaDeDesdobrar(peca: Molde, indiceAresta: number | null): PreviaDeFerramentaDeMolde {
  if (indiceAresta === null) return {};
  try {
    const inteira = desdobrarMolde(peca, indiceAresta, () => 'previa');
    return { novo: inteira.contorno, novoFechado: true, substituido: inteira.linhasInternas.at(-1) ?? null };
  } catch {
    return { substituido: arestaDoContorno(peca.contorno, indiceAresta) };
  }
}

/**
 * Aplica "Unir": a segunda peça encosta na primeira, aresta com aresta, e as
 * duas viram uma só — ou, com `apenasMover`, a segunda só muda de lugar. Só
 * mover não pode deixar a peça numa posição que o sentido do fio dela não
 * permite; unindo, vale o fio da primeira.
 */
export function aplicarUniao(
  pecas: readonly Molde[],
  primeira: Molde,
  arestaDaPrimeira: number,
  segunda: Molde,
  arestaDaSegunda: number,
  apenasMover: boolean,
): ResultadoDeFerramentaDeMolde {
  if (primeira.id === segunda.id) throw new Error('Para unir, indique a aresta de outra peça.');
  if (!apenasMover) {
    const unida = unirMoldes(primeira, arestaDaPrimeira, segunda, arestaDaSegunda);
    return {
      pecas: trocar(pecas, primeira.id, [unida]).filter((p) => p.id !== segunda.id),
      recado: `“${segunda.nome}” unida a “${primeira.nome}”: agora são uma peça só, de ${cm2(area(unida.contorno))}, com a linha de fio de “${primeira.nome}”.`,
    };
  }
  const encostada = encostarMolde(primeira, arestaDaPrimeira, segunda, arestaDaSegunda);
  if (!rotacaoEhPermitida(encostada.restricaoDeRotacao, encostada.anguloDeRotacaoGraus)) {
    const giro = String(Math.round(encostada.anguloDeRotacaoGraus * 10) / 10).replace('.', ',');
    throw new Error(
      `Para encostar, “${segunda.nome}” ficaria girada ${giro}°, e o sentido do fio dela não permite. Sem “Apenas mover”, as duas viram uma peça só, com o fio de “${primeira.nome}”.`,
    );
  }
  return {
    pecas: trocar(pecas, segunda.id, [encostada]),
    recado: `“${segunda.nome}” encostada em “${primeira.nome}”; as duas continuam separadas.`,
  };
}

/**
 * A prévia de "Unir": a aresta da primeira peça em destaque (a já escolhida
 * ou a que está sob o mouse) e, com o mouse na aresta de outra peça, onde
 * essa peça vai parar.
 */
export function previaDeUnir(
  primeira: Molde,
  arestaEscolhida: number | null,
  arestaSobOMouse: number | null,
  alvo: { readonly peca: Molde; readonly indiceAresta: number } | null,
): PreviaDeFerramentaDeMolde {
  if (arestaEscolhida === null) {
    return arestaSobOMouse === null ? {} : { substituido: arestaDoContorno(primeira.contorno, arestaSobOMouse) };
  }
  const substituido = arestaDoContorno(primeira.contorno, arestaEscolhida);
  if (!alvo) return { substituido };
  try {
    return { novo: encostarMolde(primeira, arestaEscolhida, alvo.peca, alvo.indiceAresta).contorno, novoFechado: true, substituido };
  } catch {
    return { substituido };
  }
}
