import { retanguloEnvolvente, transladarContorno, type Ponto2D } from '../core/geometria';
import { arestaDeSimetria } from './anotacoes';
import { areaUtilDaMesa, contornoDaZona, dobraDoEnfesto, enfestoComEmendas, type ConfiguracaoDeEnfesto, type DobraDoTecido } from './enfesto';
import { espelharMolde, linhaDeCorteDaPeca, rotacionarMolde, transladarMolde, type Molde } from './molde';
import type { ResultadoDeNesting } from './nesting';
import { comContasRefeitas, juntarDobra, naPosicaoDaDobra, type DobraPreparada } from './pecasNaDobra';
import { caixaDe, FOLGA_DO_ENCOSTO_MM, lugarLivre, sugerirPosicaoSemSobreposicao } from './posicionamento';

/**
 * O encaixe à mão pelo teclado (ADR 0180): as teclas da referência para a peça selecionada, e o que cada uma faz.
 * Giro, espelho e giro livre são as mesmas ações dos botões; aqui ficam as que não tinham botão.
 */

export type DirecaoDoEncaixe = 'direita' | 'esquerda' | 'cima' | 'baixo';

export type AcaoDaTecla =
  | {
      readonly tipo:
        | 'girar-livre'
        | 'girar-180'
        | 'girar-esquerda'
        | 'girar-direita'
        | 'espelhar'
        | 'dobra-horizontal'
        | 'dobra-vertical'
        | 'so-na-dobra'
        | 'meia-camada'
        | 'original'
        | 'sobreposicao'
        | 'travar-horizontal'
        | 'travar-vertical'
        | 'para-fora'
        | 'mover-com-referencia'
        | 'agrupar'
        | 'desagrupar'
        | 'verificar'
        | 'medir'
        | 'cortar'
        | 'texto'
        | 'plotar'
        | 'localizar';
    }
  | { readonly tipo: 'mover'; readonly direcao: DirecaoDoEncaixe };

const TECLAS_F: Readonly<Record<string, AcaoDaTecla>> = {
  F2: { tipo: 'girar-livre' },
  F3: { tipo: 'girar-180' },
  F4: { tipo: 'espelhar' },
  F5: { tipo: 'dobra-horizontal' },
  F6: { tipo: 'dobra-vertical' },
  F7: { tipo: 'meia-camada' },
  F8: { tipo: 'original' },
  F9: { tipo: 'travar-horizontal' },
  F10: { tipo: 'travar-vertical' },
  F11: { tipo: 'so-na-dobra' },
  F12: { tipo: 'sobreposicao' },
};

/** As letras com Ctrl da tabela da referência que não colidem com os atalhos do programa (Ctrl+O abrir, Ctrl+E exportar, Ctrl+D duplicar). */
const LETRAS_COM_CTRL: Readonly<Record<string, AcaoDaTecla>> = {
  f: { tipo: 'para-fora' },
  r: { tipo: 'mover-com-referencia' },
  g: { tipo: 'agrupar' },
  u: { tipo: 'desagrupar' },
  w: { tipo: 'verificar' },
  t: { tipo: 'medir' },
  k: { tipo: 'cortar' },
  p: { tipo: 'plotar' },
  l: { tipo: 'localizar' },
};

const SETAS: Readonly<Record<string, DirecaoDoEncaixe>> = { ArrowRight: 'direita', ArrowLeft: 'esquerda', ArrowUp: 'cima', ArrowDown: 'baixo' };

export function acaoDaTeclaDoEncaixe(e: { readonly key: string; readonly ctrlKey: boolean; readonly metaKey: boolean; readonly altKey: boolean; readonly shiftKey: boolean }): AcaoDaTecla | null {
  if (e.altKey) return null;
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.shiftKey) return ctrl && e.key.toLowerCase() === 't' ? { tipo: 'texto' } : null;
  if (ctrl) {
    if (e.key === 'ArrowLeft') return { tipo: 'girar-esquerda' };
    if (e.key === 'ArrowRight') return { tipo: 'girar-direita' };
    return LETRAS_COM_CTRL[e.key.toLowerCase()] ?? null;
  }
  const direcao = SETAS[e.key];
  return direcao ? { tipo: 'mover', direcao } : (TECLAS_F[e.key] ?? null);
}

const VETOR_DA_DIRECAO: Readonly<Record<DirecaoDoEncaixe, Ponto2D>> = {
  direita: { x: 0, y: 1 },
  esquerda: { x: 0, y: -1 },
  baixo: { x: 1, y: 0 },
  cima: { x: -1, y: 0 },
};

const PASSO_DO_DESLIZE_MM = 5;
const PASSOS_DA_METADE = 12;

/** Quanto a peça anda na direção até encostar na vizinha (à distância mínima) ou no limite da mesa. Em cima de outra, não anda. */
export function moverAteEncostar(peca: Molde, outras: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, direcao: DirecaoDoEncaixe): Ponto2D {
  const corte = linhaDeCorteDaPeca(peca);
  const caixa = retanguloEnvolvente(corte);
  const util = areaUtilDaMesa(enfesto);
  const ate = { direita: util.maxY - caixa.maxY, esquerda: caixa.minY - util.minY, baixo: util.maxX - caixa.maxX, cima: caixa.minX - util.minX }[direcao];
  if (ate <= 0) return { x: 0, y: 0 };
  const v = VETOR_DA_DIRECAO[direcao];
  const existentes = [...outras.map(linhaDeCorteDaPeca), ...(enfesto.zonasBloqueadas ?? []).map(contornoDaZona)];
  const caixas = existentes.map(caixaDe);
  const livre = (d: number): boolean =>
    lugarLivre(transladarContorno(corte, { x: v.x * d, y: v.y * d }), existentes, caixas, enfesto.distanciaMinimaEntrePecasMm, FOLGA_DO_ENCOSTO_MM);
  let bom = 0;
  for (let d = PASSO_DO_DESLIZE_MM; ; d += PASSO_DO_DESLIZE_MM) {
    const alvo = Math.min(d, ate);
    if (!livre(alvo)) {
      let ocupado = alvo;
      for (let i = 0; i < PASSOS_DA_METADE; i++) {
        const meio = (bom + ocupado) / 2;
        if (livre(meio)) bom = meio;
        else ocupado = meio;
      }
      break;
    }
    bom = alvo;
    if (alvo === ate) break;
  }
  return { x: v.x * bom + 0, y: v.y * bom + 0 };
}

/**
 * "Compactar" (ADR 0195): cada peça, do começo do comprimento para o fim, anda para trás e para cima até encostar, e
 * isso se repete enquanto alguma andar. Com grupos, não mexe: os trechos da mesa não podem misturar.
 */
export function compactarEncaixe(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto): readonly Molde[] {
  if (pecas.some((p) => p.grupoDoEncaixe)) return pecas;
  const comEmendas = enfestoComEmendas(enfesto);
  const atual = [...pecas];
  const ordem = atual.map((_, i) => i).sort((a, b) => retanguloEnvolvente(linhaDeCorteDaPeca(atual[a]!)).minY - retanguloEnvolvente(linhaDeCorteDaPeca(atual[b]!)).minY);
  for (let volta = 0; volta < VOLTAS_DA_COMPACTACAO; volta++) {
    let andou = false;
    for (const i of ordem) {
      for (const direcao of ['esquerda', 'cima'] as const) {
        const peca = atual[i]!;
        const d = moverAteEncostar(peca, atual.filter((_, k) => k !== i), comEmendas, direcao);
        if (Math.hypot(d.x, d.y) > 0.5) {
          atual[i] = transladarMolde(peca, d, peca.id);
          andou = true;
        }
      }
    }
    if (!andou) break;
  }
  return atual;
}

const VOLTAS_DA_COMPACTACAO = 4;

export function compactarResultado(resultado: ResultadoDeNesting, enfesto: ConfiguracaoDeEnfesto): ResultadoDeNesting {
  const compactadas = compactarEncaixe(resultado.pecasColocadas.map((p) => p.molde), enfesto);
  return comContasRefeitas(resultado, resultado.pecasColocadas.map((p, i) => ({ ...p, molde: compactadas[i]! })), enfesto);
}

/** O fim do encaixe automático: as peças da dobra de volta e, se pedido, a compactação. */
export function fecharEncaixe(resultado: ResultadoDeNesting, dobra: DobraPreparada, enfesto: ConfiguracaoDeEnfesto): ResultadoDeNesting {
  const junto = juntarDobra(resultado, dobra, enfesto);
  return enfesto.compactar ? compactarResultado(junto, enfesto) : junto;
}

const AFASTAMENTO_FORA_DA_MESA_MM = 100;

/** "Mover para fora do enfesto": as peças indicadas vão para depois do fim da mesa, em fila, sem sobrar em cima das que já estão lá. */
export function moverParaForaDoEnfesto(pecas: readonly Molde[], ids: ReadonlySet<string>, enfesto: Pick<ConfiguracaoDeEnfesto, 'comprimentoMm' | 'larguraUtilMm' | 'margemLateralMm' | 'margemDeExtremidadeMm'>): Molde[] {
  const util = areaUtilDaMesa(enfesto);
  const fimDasQueEstaoFora = pecas
    .filter((p) => !ids.has(p.id))
    .map((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p)))
    .filter((c) => c.minY >= enfesto.comprimentoMm)
    .map((c) => c.maxY);
  let y = Math.max(enfesto.comprimentoMm, ...fimDasQueEstaoFora) + AFASTAMENTO_FORA_DA_MESA_MM;
  return pecas.map((p) => {
    if (!ids.has(p.id)) return p;
    const c = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    const posta = transladarMolde(p, { x: util.minX - c.minX, y: y - c.minY }, p.id);
    y += c.maxY - c.minY + AFASTAMENTO_FORA_DA_MESA_MM;
    return posta;
  });
}

export type AlvoDoPosicionar = 'molde' | 'tamanho' | 'todos';

/** As peças do comando: a selecionada, as do tamanho dela, ou todas. */
export function idsParaPosicionar(pecas: readonly Molde[], selecionadoId: string | null, alvo: AlvoDoPosicionar): string[] {
  if (alvo === 'todos') return pecas.map((p) => p.id);
  const peca = pecas.find((p) => p.id === selecionadoId);
  if (!peca) return [];
  return alvo === 'molde' ? [peca.id] : pecas.filter((p) => p.tamanho === peca.tamanho).map((p) => p.id);
}

/** As peças indicadas que estão fora da mesa voltam, cada uma para o primeiro lugar livre. Diz quantas não couberam. */
export function trazerParaAMesa(pecas: readonly Molde[], ids: readonly string[], enfesto: ConfiguracaoDeEnfesto): { readonly pecas: readonly Molde[]; readonly semLugar: number } {
  const atual = [...pecas];
  let semLugar = 0;
  for (const id of ids) {
    const i = atual.findIndex((p) => p.id === id);
    const peca = atual[i];
    if (!peca || retanguloEnvolvente(linhaDeCorteDaPeca(peca)).minY < enfesto.comprimentoMm) continue;
    const d = sugerirPosicaoSemSobreposicao(peca, atual.filter((p) => p.id !== id), enfesto);
    if (d) atual[i] = transladarMolde(peca, d, peca.id);
    else semLugar++;
  }
  return { pecas: atual, semLugar };
}

/** "Molde original": a peça volta à orientação com que entrou no projeto. O espelho não volta: a peça não guarda se foi espelhada. */
export function voltarAoOriginal(peca: Molde): Molde {
  return peca.anguloDeRotacaoGraus === 0 ? peca : rotacionarMolde(peca, -peca.anguloDeRotacaoGraus);
}

/** A peça levada à dobra do tecido: a simetria na borda, sem a margem de segurança (ADR 0172). No resto, fica onde está. */
export function pecaNaDobraDoTecido(peca: Molde, dobra: DobraDoTecido, enfesto: Pick<ConfiguracaoDeEnfesto, 'tipo' | 'larguraUtilMm' | 'dobraInferior'>, sentidoUnico = false): Molde {
  if (dobraDoEnfesto(enfesto.tipo) !== dobra) {
    throw new Error(dobra === 'horizontal' ? 'A dobra horizontal só existe no enfesto par e no tubular.' : 'A dobra vertical só existe no enfesto em zigue-zague.');
  }
  const inferior = dobra === 'horizontal' && enfesto.dobraInferior === true;
  const orientada = naPosicaoDaDobra(peca, sentidoUnico, dobra, inferior);
  if (!orientada) {
    throw new Error(arestaDeSimetria(peca) === null ? 'A peça não tem linha de simetria: marque-a antes de levar à dobra.' : 'As rotações permitidas desta peça não a deixam na dobra.');
  }
  const c = retanguloEnvolvente(linhaDeCorteDaPeca(orientada));
  return transladarMolde(orientada, dobra === 'horizontal' ? { x: inferior ? enfesto.larguraUtilMm - c.maxX : -c.minX, y: 0 } : { x: 0, y: -c.minY }, peca.id);
}

/**
 * O lugar livre mais perto de onde a peça foi solta (o deslocamento), procurado em anéis em volta dela; `null`, se não
 * houver nenhum no alcance. Serve à sobreposição desligada: a peça não fica em cima de outra.
 */
export function lugarLivreMaisPerto(peca: Molde, outras: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, passoMm = 20, alcanceMm = 600): Ponto2D | null {
  const corte = linhaDeCorteDaPeca(peca);
  const caixa = retanguloEnvolvente(corte);
  const util = areaUtilDaMesa(enfesto);
  const existentes = outras.map(linhaDeCorteDaPeca);
  const caixas = existentes.map(caixaDe);
  const livre = (d: Ponto2D): boolean =>
    caixa.minX + d.x >= util.minX &&
    caixa.maxX + d.x <= util.maxX &&
    caixa.minY + d.y >= util.minY &&
    caixa.maxY + d.y <= util.maxY &&
    lugarLivre(transladarContorno(corte, d), existentes, caixas, enfesto.distanciaMinimaEntrePecasMm, FOLGA_DO_ENCOSTO_MM);
  if (livre({ x: 0, y: 0 })) return { x: 0, y: 0 };
  for (let r = passoMm; r <= alcanceMm; r += passoMm) {
    const anel: Ponto2D[] = [];
    for (let k = -r; k <= r; k += passoMm) anel.push({ x: k, y: -r }, { x: k, y: r }, { x: -r, y: k }, { x: r, y: k });
    anel.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const achado = anel.find(livre);
    if (achado) return achado;
  }
  return null;
}

/**
 * A peça como entra no encaixe: refletida e girada como as propriedades dela pedem (ADR 0180). O ângulo guardado não
 * muda, porque essa passa a ser a orientação de referência dela; as três propriedades saem da peça, pois já estão na
 * forma: o encaixe seguinte parte dela sem aplicar de novo.
 */
export function comOrientacaoInicial(peca: Molde): Molde {
  const { giroInicialGraus = 0, refletidoHorizontal, refletidoVertical, ...restricao } = peca.restricaoDeRotacao;
  if (giroInicialGraus === 0 && !refletidoHorizontal && !refletidoVertical) return peca;
  let m = peca;
  // O x do mundo aponta para baixo: o espelho do programa vira de cima para baixo. O de lado é ele e meia-volta.
  if (refletidoVertical) m = espelharMolde(m, m.id);
  if (refletidoHorizontal) m = rotacionarMolde(espelharMolde(m, m.id), 180);
  if (giroInicialGraus !== 0) m = rotacionarMolde(m, giroInicialGraus);
  return { ...m, restricaoDeRotacao: restricao, anguloDeRotacaoGraus: peca.anguloDeRotacaoGraus };
}

/** "Mover com referência": as peças andam a partir de onde estão, ou o canto do grupo vai a essa distância do canto da mesa. Horizontal é o comprimento; vertical, a largura. */
export function moverComReferencia(pecas: readonly Molde[], ids: ReadonlySet<string>, referencia: 'peca' | 'mesa', horizontalMm: number, verticalMm: number): Molde[] {
  const escolhidas = pecas.filter((p) => ids.has(p.id));
  if (escolhidas.length === 0) return [...pecas];
  const caixa = retanguloEnvolvente(escolhidas.flatMap((p) => [...linhaDeCorteDaPeca(p)]));
  const d = referencia === 'peca' ? { x: verticalMm, y: horizontalMm } : { x: verticalMm - caixa.minX, y: horizontalMm - caixa.minY };
  return pecas.map((p) => (ids.has(p.id) ? transladarMolde(p, d, p.id) : p));
}

/** O primeiro nome "Grupo N" ainda sem uso no projeto. */
export function proximoGrupo(pecas: readonly Molde[]): string {
  const usados = new Set(pecas.map((p) => p.grupoDoEncaixe));
  let n = 1;
  while (usados.has(`Grupo ${n}`)) n++;
  return `Grupo ${n}`;
}

/** "Molde dobrado somente na dobra" (F11): ligado (o padrão), a peça de simetria vai na dobra; desligado, vai com as outras. */
export function comForaDaDobra(peca: Molde, fora: boolean): Molde {
  if (fora) return { ...peca, foraDaDobra: true };
  const { foraDaDobra, ...resto } = peca;
  return foraDaDobra ? resto : peca;
}

/** "½ camada": liga ou desliga na peça. */
export function comMeiaCamada(peca: Molde, ligada: boolean): Molde {
  if (ligada) return { ...peca, meiaCamada: true };
  const { meiaCamada, ...resto } = peca;
  return meiaCamada ? resto : peca;
}

/** "Alt + clique": as peças do mesmo tamanho da indicada. */
export function pecasDoTamanho(pecas: readonly Molde[], id: string): { readonly tamanho: string; readonly ids: readonly string[] } | null {
  const tamanho = pecas.find((p) => p.id === id)?.tamanho;
  if (!tamanho) return null;
  return { tamanho, ids: pecas.filter((p) => p.tamanho === tamanho).map((p) => p.id) };
}
