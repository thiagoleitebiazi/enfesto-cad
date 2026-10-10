import type { Molde } from '../domain/molde';
import {
  definirGraduacaoDoPique,
  distanciaAteAReferencia,
  perimetrosDoPique,
  referenciaDoPique,
  referenciaSugerida,
  removerGraduacaoDoPique,
} from '../domain/piquesGraduados';
import type { CampoDoDialogo, ValoresDoDialogo } from './DialogoDeCampos';
import type { ResultadoDeFerramentaDeMolde } from './ferramentasDeMolde';
import { formatarMm } from './medidas';
import { paraAbsoluto, paraOCampo } from './tabelaDeGraduacao';

/**
 * A "tabela dos piques" da graduação: com a ferramenta Tabela ligada, o clique
 * num pique abre esta janela. O pique graduado fica, em cada tamanho, a uma
 * distância certa de um ponto de referência do contorno, medida sobre ele.
 */
export interface DialogoDoPique {
  readonly titulo: string;
  readonly resumo: ReadonlyArray<readonly [string, string]>;
  readonly campos: readonly CampoDoDialogo[];
  readonly nota: string;
}

const campoDoTamanho = (t: number): string => `perimetro-${t}`;

/** A janela da graduação de um pique; `null` se a peça não é graduada ou o pique não é dela. */
export function dialogoDoPique(peca: Molde, piqueId: string): DialogoDoPique | null {
  const graduacao = peca.graduacao;
  const pique = peca.piques.find((q) => q.id === piqueId);
  if (!graduacao || !pique) return null;
  const graduado = referenciaDoPique(peca, pique);
  const referencia = graduado ?? referenciaSugerida(peca, pique);
  const perimetros = perimetrosDoPique(peca, pique);
  return {
    titulo: 'Graduação do pique',
    resumo: [
      ['Peça', peca.nome],
      ['Pique', `a ${formatarMm(distanciaAteAReferencia(peca, pique, referencia))} do ponto ${referencia + 1}, sobre o contorno — ${graduado === null ? 'proporcional à aresta' : 'graduado'}`],
    ],
    campos: [
      { tipo: 'inteiro', id: 'referencia', rotulo: `Referência: o ponto do contorno de onde a distância é contada (1 a ${peca.contorno.length})`, inicial: String(referencia + 1) },
      ...graduacao.tamanhos.flatMap((nome, t): CampoDoDialogo[] =>
        t === graduacao.base ? [] : [{ tipo: 'medida', id: campoDoTamanho(t), rotulo: `Perímetro no tamanho ${nome} (mm)`, inicial: paraOCampo(perimetros[t] ?? 0) }],
      ),
      { tipo: 'caixa', id: 'incremental', rotulo: 'Incremental: os valores são a diferença para o tamanho vizinho, do lado do base', inicial: false },
      { tipo: 'caixa', id: 'inverter', rotulo: 'Inverter sinal dos valores', inicial: false },
      { tipo: 'caixa', id: 'todos', rotulo: '= Perímetro: aplicar os mesmos valores a todos os piques desta peça', inicial: false },
      { tipo: 'caixa', id: 'remover', rotulo: 'Tirar a graduação deste pique: ele volta a andar na proporção da aresta', inicial: false },
    ],
    nota: 'O “perímetro” de cada tamanho é quanto a distância do pique ao ponto de referência, medida sobre o contorno, aumenta (ou, negativa, diminui) nesse tamanho; com zero, o pique fica à mesma distância da referência em todos. Sem graduação, ele fica na mesma proporção da aresta. Com “= Perímetro”, cada um dos outros piques leva os mesmos valores, contados do ponto graduado mais perto dele. O manual da referência dá os campos desta tabela, sem a conta; essa é a nossa leitura.',
  };
}

function trocar(pecas: readonly Molde[], nova: Molde): Molde[] {
  return pecas.map((p) => (p.id === nova.id ? nova : p));
}

/** Aplica a janela no pique. Lança erro, sem mudar nada, quando os valores não servem. */
export function aplicarDialogoDoPique(pecas: readonly Molde[], peca: Molde, piqueId: string, valores: ValoresDoDialogo): ResultadoDeFerramentaDeMolde {
  const graduacao = peca.graduacao;
  if (!graduacao) throw new Error(`A peça “${peca.nome}” não tem graduação: defina os tamanhos dela antes.`);
  if (valores.remover === true) {
    return { pecas: trocar(pecas, removerGraduacaoDoPique(peca, piqueId)), recado: `Graduação tirada do pique de “${peca.nome}”: ele volta a andar na proporção da aresta.` };
  }
  const referencia = Number(valores.referencia) - 1;
  const digitados = graduacao.tamanhos.map((_, t) => (t === graduacao.base ? 0 : Number(valores[campoDoTamanho(t)])));
  if (!digitados.every((valor) => Number.isFinite(valor))) throw new Error('Os valores de perímetro precisam ser números, em mm.');
  const absolutos = valores.incremental === true ? paraAbsoluto(digitados, graduacao.base) : digitados;
  const perimetros = absolutos.map((valor) => (valores.inverter === true && valor !== 0 ? 0 - valor : valor));
  let nova = definirGraduacaoDoPique(peca, piqueId, referencia, perimetros);
  let outros = 0;
  if (valores.todos === true) {
    for (const pique of peca.piques) {
      if (pique.id === piqueId) continue;
      nova = definirGraduacaoDoPique(nova, pique.id, referenciaSugerida(nova, pique), perimetros);
      outros++;
    }
  }
  const ponta = graduacao.base < graduacao.tamanhos.length - 1 ? graduacao.tamanhos.length - 1 : 0;
  return {
    pecas: trocar(pecas, nova),
    recado:
      `Pique de “${peca.nome}” graduado a partir do ponto ${referencia + 1}: no tamanho ${graduacao.tamanhos[ponta]}, o perímetro muda ${formatarMm(perimetros[ponta] ?? 0)}.` +
      (outros > 0 ? ` ${outros === 1 ? 'O outro pique levou' : `Os outros ${outros} piques levaram`} os mesmos valores, cada um a partir do ponto graduado mais perto dele.` : ''),
  };
}
