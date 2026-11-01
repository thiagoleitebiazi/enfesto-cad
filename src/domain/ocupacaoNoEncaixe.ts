import { area, areaAssinada, contornosSeSobrepoem, deslocarContornoParaFora, espelharHorizontal, pontoDentroDoContorno, retanguloEnvolvente, rotacionar, type Contorno, type Ponto2D } from '../core/geometria';
import { comFolgaNoEncaixe, comOrientacaoInicial, compactarResultado, semFolgaNoEncaixe } from './encaixeManual';
import { areaUtilDaMesa, dobraDoEnfesto, enfestoComEmendas, type ConfiguracaoDeEnfesto, type ZonaBloqueada } from './enfesto';
import { posicaoDoTamanho } from './graduacao';
import { comGrupoDoEncaixe } from './gruposDoEncaixe';
import { criarMolde, espelharMolde, linhaDeCorteDaPeca, rotacionarMolde, transladarMolde, type Molde, type RestricaoDeRotacao } from './molde';
import type { PecaColocada, ResultadoDeNesting } from './nesting';
import { comContasRefeitas, juntarDobra, prepararDobra, type DobraPreparada } from './pecasNaDobra';

/**
 * O que a peça ocupa no encaixe, além do corte dela (ADR 0208): a envolvente (uma margem em volta, seguindo o contorno ou
 * retangular), a margem por ponto do contorno e o grupo que anda junto. O encaixe automático não conhece nada disso:
 * ele recebe uma peça de mentira, com a forma do que se ocupa, e no fim as peças de verdade vão para onde ela ficou.
 */

/** A linha do contorno afastada, cada aresta pela margem do ponto em que ela começa; os pontos são os do desenho, a partir de 1. */
export function contornoComMargens(contorno: Contorno, margens: Readonly<Record<string, number>>): Contorno {
  const n = contorno.length;
  const margem = (i: number): number => margens[String(((i + n) % n) + 1)] ?? 0;
  const retas = contorno.map((a, i) => {
    const b = contorno[(i + 1) % n]!;
    const tamanho = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / tamanho, y: (b.y - a.y) / tamanho };
    const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const n1 = { x: -u.y, y: u.x };
    const fora = pontoDentroDoContorno({ x: meio.x + n1.x * 0.01, y: meio.y + n1.y * 0.01 }, contorno) ? { x: -n1.x, y: -n1.y } : n1;
    return { p: { x: a.x + fora.x * margem(i), y: a.y + fora.y * margem(i) }, u };
  });
  return contorno.map((v, i) => {
    const r0 = retas[(i - 1 + n) % n]!;
    const r1 = retas[i]!;
    const det = r0.u.x * r1.u.y - r0.u.y * r1.u.x;
    if (Math.abs(det) < 1e-6) return r1.p;
    const t = ((r1.p.x - r0.p.x) * r1.u.y - (r1.p.y - r0.p.y) * r1.u.x) / det;
    void v;
    return { x: r0.p.x + r0.u.x * t, y: r0.p.y + r0.u.y * t };
  });
}

function retangulo(pontos: readonly Ponto2D[], margem: number): Contorno {
  const c = retanguloEnvolvente(pontos);
  return [
    { x: c.minX - margem, y: c.minY - margem },
    { x: c.maxX + margem, y: c.minY - margem },
    { x: c.maxX + margem, y: c.maxY + margem },
    { x: c.minX - margem, y: c.maxY + margem },
  ];
}

/** O fecho convexo: a volta de todos os pontos do grupo. */
export function fechoConvexo(pontos: readonly Ponto2D[]): Contorno {
  const p = [...pontos].sort((a, b) => a.x - b.x || a.y - b.y);
  const virou = (o: Ponto2D, a: Ponto2D, b: Ponto2D): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const metade = (lista: readonly Ponto2D[]): Ponto2D[] => {
    const r: Ponto2D[] = [];
    for (const q of lista) {
      while (r.length >= 2 && virou(r[r.length - 2]!, r[r.length - 1]!, q) <= 0) r.pop();
      r.push(q);
    }
    r.pop();
    return r;
  };
  return [...metade(p), ...metade([...p].reverse())];
}

/** A forma que a peça ocupa no encaixe. */
export function ocupacaoDaPeca(peca: Molde): Contorno {
  const corte = linhaDeCorteDaPeca(peca);
  const base = peca.margensDoContorno ? contornoComMargens(corte, peca.margensDoContorno) : corte;
  const e = peca.envolvente;
  if (!e) return base;
  if (e.tipo === 'retangular') return retangulo(base, e.margemMm);
  return e.margemMm > 0 ? deslocarContornoParaFora(base, e.margemMm) : base;
}

/**
 * As peças do grupo numa linha só: cada uma ligada à anterior por um traço sem largura, entre os vértices mais próximos.
 * A forma fica com os vãos entre elas, e o encaixe pode pôr outras peças ali (ADR 0221).
 */
export function costurarContornos(contornos: readonly Contorno[]): Contorno {
  const sentido = Math.sign(areaAssinada(contornos[0]!));
  const noMesmoSentido = contornos.map((c) => (Math.sign(areaAssinada(c)) === sentido ? [...c] : [...c].reverse()));
  return noMesmoSentido.slice(1).reduce((linha, proxima) => {
    let [i, j, menor] = [0, 0, Infinity];
    linha.forEach((a, ia) =>
      proxima.forEach((b, ib) => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < menor) [i, j, menor] = [ia, ib, d];
      }),
    );
    return [...linha.slice(i), ...linha.slice(0, i), linha[i]!, ...proxima.slice(j), ...proxima.slice(0, j), proxima[j]!];
  }, noMesmoSentido[0]!);
}

/** A forma que o grupo ocupa, com a envolvente da primeira peça. Peças que se tocam não têm vão: vale a volta delas. */
function ocupacaoDoGrupo(membros: readonly Molde[]): Contorno {
  const contornos = membros.map(ocupacaoDaPeca);
  if (membros[0]!.envolvente?.tipo === 'retangular') return retangulo(contornos.flat(), 0);
  const seTocam = contornos.some((a, i) => contornos.slice(i + 1).some((b) => contornosSeSobrepoem(a, b)));
  return seTocam ? fechoConvexo(contornos.flat()) : costurarContornos(contornos);
}

function restricaoDoGrupo(membros: readonly Molde[]): RestricaoDeRotacao {
  const r = membros.map((m) => m.restricaoDeRotacao);
  return { permite180: r.every((x) => x.permite180), permite90e270: r.every((x) => x.permite90e270), permiteEspelhamento: false, inclinacaoGraus: Math.min(...r.map((x) => x.inclinacaoGraus ?? 0)) };
}

interface PecaVirtual {
  readonly molde: Molde;
  readonly membros: readonly Molde[];
}

function virtual(id: string, membros: readonly Molde[], contorno: Contorno, quantidade: number): Molde {
  const base = membros[0]!;
  const c = retanguloEnvolvente(contorno);
  const m = criarMolde(
    {
      nome: base.nome,
      referencia: base.referencia,
      tamanho: base.tamanho,
      quantidade,
      contorno: [...contorno],
      margemDeCosturaMm: 0,
      linhaDeFio: { inicio: { x: (c.minX + c.maxX) / 2, y: c.minY }, fim: { x: (c.minX + c.maxX) / 2, y: c.maxY } },
      restricaoDeRotacao: membros.length > 1 ? restricaoDoGrupo(membros) : base.restricaoDeRotacao,
    },
    id,
  );
  return { ...m, ...(base.grupoDoEncaixe ? { grupoDoEncaixe: base.grupoDoEncaixe } : {}), ...(membros.length === 1 && base.emPar ? { emPar: true as const } : {}) };
}

/** As peças como o encaixe as recebe: as de envolvente, de margem ou de grupo viram peças de mentira. */
export function comOcupacao(pecas: readonly Molde[]): { readonly pecas: readonly Molde[]; readonly virtuais: ReadonlyMap<string, PecaVirtual> } {
  const virtuais = new Map<string, PecaVirtual>();
  const saida: Molde[] = [];
  const grupos = new Map<string, Molde[]>();
  for (const p of pecas) {
    if (p.conjuntoRigido) grupos.set(p.conjuntoRigido, [...(grupos.get(p.conjuntoRigido) ?? []), p]);
    else if (p.envolvente || p.margensDoContorno) {
      const id = `ocupacao:${p.id}`;
      const m = virtual(id, [p], ocupacaoDaPeca(p), p.quantidade);
      virtuais.set(id, { molde: m, membros: [p] });
      saida.push(m);
    } else saida.push(p);
  }
  for (const [nome, membros] of grupos) {
    const id = `ocupacao:${nome}`;
    const quantidade = Math.min(...membros.map((m) => m.quantidade));
    const m = virtual(id, membros, ocupacaoDoGrupo(membros), quantidade);
    virtuais.set(id, { molde: m, membros });
    saida.push(m);
    // O que uma peça tem a mais que as outras do grupo vai sozinha.
    for (const p of membros) if (p.quantidade > quantidade) saida.push({ ...p, quantidade: p.quantidade - quantidade });
  }
  return { pecas: saida, virtuais };
}

const direcao = (a: Ponto2D, b: Ponto2D): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** As peças de verdade no lugar da de mentira: o mesmo giro e o mesmo deslocamento. */
export function semOcupacao(resultado: ResultadoDeNesting, virtuais: ReadonlyMap<string, PecaVirtual>, enfesto: Pick<ConfiguracaoDeEnfesto, 'larguraUtilMm'>): ResultadoDeNesting {
  if (virtuais.size === 0) return resultado;
  const colocadas = resultado.pecasColocadas.flatMap((c): PecaColocada[] => {
    const v = virtuais.get(c.idOriginal);
    if (!v) return [c];
    const posta = c.molde.contorno;
    const espelhada = Math.sign(areaAssinada(v.molde.contorno)) !== Math.sign(areaAssinada(posta));
    return v.membros.map((membro) => {
      const caixa = retanguloEnvolvente(membro.contorno);
      const centroX = (caixa.minX + caixa.maxX) / 2;
      const base = espelhada ? espelharMolde(membro, membro.id) : membro;
      const original = espelhada ? v.molde.contorno.map((p) => espelharHorizontal(p, centroX)) : v.molde.contorno;
      const v0 = original[0]!;
      const giro = direcao(posta[0]!, posta[1]!) - direcao(v0, original[1]!);
      const girada = Math.abs(giro) < 1e-9 ? base : rotacionarMolde(base, giro);
      const q = rotacionar(base.contorno[0]!, v0, giro);
      const alvo = { x: q.x + posta[0]!.x - v0.x, y: q.y + posta[0]!.y - v0.y };
      const id = `${membro.id}#${c.indiceCopia}`;
      return { idOriginal: membro.id, indiceCopia: c.indiceCopia, molde: { ...transladarMolde(girada, { x: alvo.x - girada.contorno[0]!.x, y: alvo.y - girada.contorno[0]!.y }, id), quantidade: 1 } };
    });
  });
  const naoColocadas = resultado.pecasNaoColocadas.flatMap((p) => {
    const v = virtuais.get(p.idOriginal);
    return v ? v.membros.map((m) => ({ ...p, idOriginal: m.id, nome: m.nome })) : [p];
  });
  return { ...comContasRefeitas(resultado, colocadas, enfesto), pecasNaoColocadas: naoColocadas };
}

// ---- Os blocos

export interface ConfiguracaoDeBlocos {
  /** "Separação completa": cada tamanho é um bloco, em ordem crescente. */
  readonly separacaoCompleta: boolean;
  /** Os tamanhos de cada bloco. */
  readonly blocos: readonly (readonly string[])[];
  /** As camadas de cada bloco, para o enfesto em escada (ADR 0224). */
  readonly camadas?: readonly (number | null)[];
  readonly vertical: boolean;
}

/** As peças em blocos: o bloco é um grupo do encaixe, e os grupos saem na ordem em que aparecem. */
export function comBlocos(pecas: readonly Molde[], c: ConfiguracaoDeBlocos): Molde[] {
  const tamanhos = [...new Set(pecas.map((p) => p.tamanho))].sort((a, b) => posicaoDoTamanho(a) - posicaoDoTamanho(b));
  const grupos = c.separacaoCompleta ? tamanhos.map((t) => [t]) : c.blocos;
  const postas = new Set<string>();
  const nosBlocos = grupos.flatMap((g, i) =>
    pecas
      .filter((p) => g.includes(p.tamanho))
      .map((p) => {
        postas.add(p.id);
        return comGrupoDoEncaixe(p, `Bloco ${i + 1}`);
      }),
  );
  const resto = pecas.filter((p) => !postas.has(p.id)).map((p) => comGrupoDoEncaixe(p, 'Sem bloco'));
  return [...nosBlocos, ...resto];
}

/** Os blocos no campo do formulário: um por linha ou separados por ";", com os tamanhos separados por espaço (e "x40" dá as camadas, ADR 0224). */
export function lerBlocos(texto: string): string[][] {
  return texto
    .split(/[;\n]/)
    .map((l) => l.trim().split(/[\s,]+/).filter((t) => t !== '' && !/^x\d+$/i.test(t)))
    .filter((g) => g.length > 0);
}

// ---- Os blocos na vertical: o encaixe trabalha na mesa de lado, e as peças voltam depois

function mesaDeLado(enfesto: ConfiguracaoDeEnfesto): ConfiguracaoDeEnfesto {
  const c = enfesto.comprimentoMm;
  const zonas: ZonaBloqueada[] = (enfesto.zonasBloqueadas ?? []).map((z) => ({ minX: c - z.maxY, maxX: c - z.minY, minY: z.minX, maxY: z.maxX }));
  return {
    ...enfesto,
    tipo: 'impar',
    larguraUtilMm: c,
    comprimentoMm: enfesto.larguraUtilMm,
    margemLateralMm: enfesto.margemDeExtremidadeMm,
    margemDeExtremidadeMm: enfesto.margemLateralMm,
    zonasBloqueadas: zonas,
    ...(enfesto.obstaculos ? { obstaculos: enfesto.obstaculos.map((o) => o.map((p) => ({ x: c - p.y, y: p.x }))) } : {}),
  } as ConfiguracaoDeEnfesto;
}

function deVolta(resultado: ResultadoDeNesting, enfesto: ConfiguracaoDeEnfesto): ResultadoDeNesting {
  const c = enfesto.comprimentoMm;
  const postas = resultado.pecasColocadas.map((p) => {
    const girada = rotacionarMolde(p.molde, -90);
    const v = p.molde.contorno[0]!;
    const molde = transladarMolde(girada, { x: v.y - girada.contorno[0]!.x, y: c - v.x - girada.contorno[0]!.y }, p.molde.id);
    return { ...p, molde: comGrupoDoEncaixe(molde, '') };
  });
  // No quadro de lado, as peças ficam no fim da mesa: vão para o começo, todas juntas.
  const minimo = postas.length > 0 ? Math.min(...postas.map((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p.molde)).minY)) : 0;
  const recuo = minimo - areaUtilDaMesa(enfesto).minY;
  const { blocosDosGrupos, ...semBlocos } = resultado;
  void blocosDosGrupos;
  return comContasRefeitas(semBlocos, postas.map((p) => ({ ...p, molde: transladarMolde(p.molde, { x: 0, y: -recuo }, p.molde.id) })), enfesto);
}

// ---- A entrada e a saída do encaixe

export interface EntradaDoEncaixe {
  readonly dobra: DobraPreparada;
  /** O resultado do cálculo, com tudo de volta: a dobra, a compactação, a mesa, as folgas e as peças de mentira. */
  readonly fechar: (resultado: ResultadoDeNesting) => ResultadoDeNesting;
}

export function entradaDoEncaixe(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, sentidoUnico: boolean): EntradaDoEncaixe {
  const preparadas = pecas.map(comOrientacaoInicial);
  const ocupacao = enfesto.semEnvolvente ? { pecas: preparadas, virtuais: new Map<string, PecaVirtual>() } : comOcupacao(preparadas);
  const comFolga = ocupacao.pecas.map(comFolgaNoEncaixe);
  // A mesa de lado é aberta: com o tecido dobrado, as peças perderiam a dobra. Aí os blocos seguem na horizontal.
  const vertical = enfesto.blocosVerticais === true && dobraDoEnfesto(enfesto.tipo) === null;
  const comEmendas = enfestoComEmendas(enfesto);
  const mesa = vertical ? mesaDeLado(comEmendas) : comEmendas;
  const dobra = prepararDobra(vertical ? comFolga.map((p) => rotacionarMolde(p, 90)) : comFolga, mesa, sentidoUnico);
  return {
    dobra,
    fechar: (resultado) => {
      const junto = juntarDobra(resultado, dobra, mesa);
      const compactado = enfesto.compactar ? compactarResultado(junto, mesa) : junto;
      const naMesa = vertical ? deVolta(compactado, enfesto) : compactado;
      const semFolga = naMesa.pecasColocadas.some((p) => p.molde.folgaNoEncaixeMm) ? comContasRefeitas(naMesa, naMesa.pecasColocadas.map((p) => ({ ...p, molde: semFolgaNoEncaixe(p.molde) })), enfesto) : naMesa;
      return semOcupacao(semFolga, ocupacao.virtuais, enfesto);
    },
  };
}

/** A área que as peças realmente ocupam, para quem confere o aproveitamento com as margens de fora. */
export const areaDaOcupacao = (peca: Molde): number => area(ocupacaoDaPeca(peca));
