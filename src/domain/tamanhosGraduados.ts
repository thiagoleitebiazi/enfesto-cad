import { area, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import { transformarCota } from './cota';
import {
  deslocamentoNoPonto,
  deslocamentosDoContorno,
  indiceDoTamanho,
  iniciarGraduacao,
  semPontosSoltos,
  type Graduacao,
  type PontoGraduado,
} from './graduacao';
import { reancorarPiques, semGraduacao, transladarMolde, type Molde } from './molde';

/**
 * O que a graduação faz com a peça inteira: definir os tamanhos, tirar um
 * tamanho como peça própria ("Separar") e juntar peças de tamanhos diferentes
 * numa peça graduada ("Unir").
 */

const AREA_MINIMA_MM2 = 1e-6;
const ZERO: Ponto2D = { x: 0, y: 0 };

/**
 * A peça com a forma de um tamanho da graduação (o resto fica como está): o
 * contorno desse tamanho e, acompanhando-o na proporção, o que está dentro —
 * furos, linhas internas, marcas e cotas. Os piques ficam na mesma proporção
 * das arestas, e a linha de fio anda inteira, sem mudar de direção nem de
 * comprimento, o que anda o meio dela.
 */
function naFormaDoTamanho(molde: Molde, graduacao: Graduacao, tamanho: number): Molde {
  if (tamanho === graduacao.base) return molde;
  const base = molde.contorno;
  const doTamanho = deslocamentosDoContorno(graduacao, base).map((regra) => regra[tamanho] ?? ZERO);
  const levar = (p: Ponto2D): Ponto2D => {
    const d = deslocamentoNoPonto(base, doTamanho, p);
    return { x: p.x + d.x, y: p.y + d.y };
  };
  const contorno = base.map((p, i) => ({ x: p.x + doTamanho[i]!.x, y: p.y + doTamanho[i]!.y }));
  const fio = molde.linhaDeFio;
  const doFio = deslocamentoNoPonto(base, doTamanho, { x: (fio.inicio.x + fio.fim.x) / 2, y: (fio.inicio.y + fio.fim.y) / 2 });
  return {
    ...molde,
    contorno,
    furos: molde.furos.map((furo) => furo.map(levar)),
    linhasInternas: molde.linhasInternas.map((linha) => linha.map(levar)),
    marcas: molde.marcas.map((m) => ({ ...m, posicao: levar(m.posicao) })),
    piques: reancorarPiques(molde.piques, base, contorno),
    linhaDeFio: {
      inicio: { x: fio.inicio.x + doFio.x, y: fio.inicio.y + doFio.y },
      fim: { x: fio.fim.x + doFio.x, y: fio.fim.y + doFio.y },
    },
    ...(molde.cotas ? { cotas: molde.cotas.map((c) => transformarCota(c, levar, (v) => v)) } : {}),
    ...(molde.textos ? { textos: molde.textos.map((t) => ({ ...t, posicao: levar(t.posicao) })) } : {}),
    ...(molde.linhaDeSimetria ? { linhaDeSimetria: { de: levar(molde.linhaDeSimetria.de), ate: levar(molde.linhaDeSimetria.ate) } } : {}),
    ...(molde.pences
      ? {
          pences: molde.pences.map((pence) => ({
            ...pence,
            pontos: pence.pontos.map(levar),
            ...(pence.removidos ? { removidos: pence.removidos.map(levar) } : {}),
          })),
        }
      : {}),
  };
}

/**
 * Define os tamanhos da peça e qual deles é o base. Sem graduação ainda, os
 * cantos do contorno entram como pontos graduados, sem deslocamento. Com
 * graduação, as regras dos tamanhos que continuam (pelo nome) ficam; um
 * tamanho novo entra igual ao base. Se o base muda, o contorno desenhado
 * passa a ser o desse tamanho, e as regras passam a ser contadas a partir
 * dele. O tamanho da peça (o das propriedades) passa a ser o nome do base.
 */
export function definirTamanhosDoMolde(molde: Molde, tamanhos: readonly string[], nomeDoBase: string): Molde {
  const base = indiceDoTamanho(tamanhos, nomeDoBase);
  if (base < 0) throw new Error('O tamanho base precisa ser um dos tamanhos da lista.');
  const atual = molde.graduacao ? semPontosSoltos(molde.graduacao, molde.contorno) : null;
  if (!atual) return { ...molde, tamanho: tamanhos[base]!, graduacao: iniciarGraduacao(molde.contorno, tamanhos, base) };

  // De que tamanho antigo vem cada tamanho novo (-1: é um tamanho que não existia).
  const antigoDe = tamanhos.map((nome) => indiceDoTamanho(atual.tamanhos, nome));
  const antigoDoBase = antigoDe[base]!;
  // Trocando o base, a peça inteira (contorno e o que está dentro) passa a ter a forma desse tamanho.
  const naForma = antigoDoBase >= 0 && antigoDoBase !== atual.base ? naFormaDoTamanho(molde, atual, antigoDoBase) : molde;
  if (!(area(naForma.contorno) > AREA_MINIMA_MM2)) throw new Error(`O tamanho “${tamanhos[base]}” não tem área para ser o base.`);
  const pontos: PontoGraduado[] = atual.pontos.map((p) => {
    const doBase = antigoDoBase >= 0 ? (p.deslocamentos[antigoDoBase] ?? ZERO) : ZERO;
    return {
      ...p,
      posicao: { x: p.posicao.x + doBase.x, y: p.posicao.y + doBase.y },
      deslocamentos: antigoDe.map((antigo) => {
        const d = antigo >= 0 ? (p.deslocamentos[antigo] ?? ZERO) : doBase;
        return { x: d.x - doBase.x, y: d.y - doBase.y };
      }),
    };
  });
  return { ...naForma, tamanho: tamanhos[base]!, graduacao: { tamanhos: [...tamanhos], base, pontos } };
}

/**
 * A peça de um tamanho, solta da graduação: o contorno desse tamanho, com o
 * que está dentro (furos, linhas internas, marcas, cotas e linha de fio)
 * acompanhando na proporção, os piques na mesma proporção das arestas, e o
 * nome do tamanho nas propriedades.
 */
export function moldeDoTamanho(molde: Molde, tamanho: number, novoId: string): Molde {
  const graduacao = molde.graduacao;
  if (!graduacao) throw new Error(`A peça “${molde.nome}” não tem graduação.`);
  if (!Number.isInteger(tamanho) || tamanho < 0 || tamanho >= graduacao.tamanhos.length) throw new Error('Tamanho fora da graduação.');
  const naForma = naFormaDoTamanho(molde, graduacao, tamanho);
  if (!(area(naForma.contorno) > AREA_MINIMA_MM2)) {
    throw new Error(`O tamanho “${graduacao.tamanhos[tamanho]}” de “${molde.nome}” ficaria sem área.`);
  }
  return { ...semGraduacao(naForma), id: novoId, tamanho: graduacao.tamanhos[tamanho]! };
}

/**
 * As peças como vão para o encaixe quando todos os tamanhos entram: cada peça
 * graduada vira uma peça comum por tamanho (a do base continua sendo ela, com
 * o mesmo id), na ordem dos tamanhos; as outras ficam como estão.
 */
export function expandirTamanhos(pecas: readonly Molde[], novoId: () => string): Molde[] {
  return pecas.flatMap((peca) => {
    const graduacao = peca.graduacao;
    if (!graduacao) return [peca];
    return graduacao.tamanhos.map((_, t) => (t === graduacao.base ? semGraduacao(peca) : moldeDoTamanho(peca, t, novoId())));
  });
}

/**
 * "Separar": uma peça nova para cada tamanho pedido (pela posição na lista de
 * tamanhos), postas em fila ao lado da peça graduada, para não ficarem umas
 * em cima das outras, e alinhadas com ela pela borda de cima. A fila começa
 * depois da peça graduada — ou depois de `depoisDeY`, se for mais adiante
 * (o fim das outras peças do projeto, para não cair em cima delas). A peça
 * graduada não muda.
 */
export function separarTamanhos(
  molde: Molde,
  quais: readonly number[],
  novoId: () => string,
  depoisDeY = -Infinity,
  afastamentoMm = 20,
): Molde[] {
  if (quais.length === 0) throw new Error('Escolha pelo menos um tamanho para separar.');
  const caixaDaGraduada = retanguloEnvolvente(molde.contorno);
  let borda = Math.max(caixaDaGraduada.maxY, depoisDeY) + afastamentoMm;
  return quais.map((tamanho) => {
    const id = novoId();
    const solta = moldeDoTamanho(molde, tamanho, id);
    const caixa = retanguloEnvolvente(solta.contorno);
    const noLugar = transladarMolde(solta, { x: caixaDaGraduada.minX - caixa.minX, y: borda - caixa.minY }, id);
    borda += caixa.maxY - caixa.minY + afastamentoMm;
    return noLugar;
  });
}

/**
 * "Unir": a peça `base` passa a ser graduada, e cada uma das `outras` vira um
 * tamanho dela. As peças têm de ter o mesmo número de pontos no contorno, na
 * mesma ordem, e um tamanho diferente cada uma (o das propriedades). São
 * comparadas com o início da linha de fio de cada uma posto no mesmo lugar, e
 * os tamanhos ficam em ordem de área. Todos os pontos do contorno ficam
 * graduados, com o deslocamento exato de cada tamanho.
 */
export function unirTamanhos(base: Molde, outras: readonly Molde[]): Molde {
  if (outras.length === 0) throw new Error('Marque na lista as peças dos outros tamanhos.');
  const todas = [base, ...outras];
  const semTamanho = todas.find((p) => p.tamanho.trim() === '');
  if (semTamanho) throw new Error(`Dê um tamanho à peça “${semTamanho.nome}” (em Propriedades) antes de unir.`);
  const repetida = todas.find((p, i) => todas.findIndex((q) => indiceDoTamanho([q.tamanho], p.tamanho) === 0) !== i);
  if (repetida) throw new Error(`Há mais de uma peça com o tamanho “${repetida.tamanho}”: cada peça precisa de um tamanho diferente.`);
  const diferente = outras.find((p) => p.contorno.length !== base.contorno.length);
  if (diferente) {
    throw new Error(
      `“${diferente.nome}” (${diferente.tamanho}) tem ${diferente.contorno.length} pontos no contorno e “${base.nome}” (${base.tamanho}) tem ${base.contorno.length}: para unir, os tamanhos precisam dos mesmos pontos, na mesma ordem.`,
    );
  }
  const emOrdem = [...todas].sort((a, b) => area(a.contorno) - area(b.contorno));
  const origem = base.linhaDeFio.inicio;
  const graduacao: Graduacao = {
    tamanhos: emOrdem.map((p) => p.tamanho.trim()),
    base: emOrdem.indexOf(base),
    pontos: base.contorno.map((posicao, i) => ({
      posicao,
      deslocamentos: emOrdem.map((p) => {
        const q = p.contorno[i]!;
        return { x: q.x - p.linhaDeFio.inicio.x - (posicao.x - origem.x), y: q.y - p.linhaDeFio.inicio.y - (posicao.y - origem.y) };
      }),
    })),
  };
  return { ...base, graduacao };
}
