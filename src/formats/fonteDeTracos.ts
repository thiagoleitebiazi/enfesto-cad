import type { Ponto2D } from '../core/geometria';

/**
 * "Utilizar texto como linha" (ADR 0184): as letras desenhadas em traços, para o plotter que não tem letreiro próprio
 * (o comando LB). Cada letra é uma lista de traços numa grade de 4 de largura por 6 de altura, com o y para cima;
 * "|" separa os traços. Só maiúsculas, números e os sinais usados nos nomes: o que não está aqui vira espaço.
 */

const O = '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0';
const P = '0,0 0,6 3,6 4,5 4,4 3,3 0,3';

const LETRAS: Readonly<Record<string, string>> = {
  A: '0,0 0,4 2,6 4,4 4,0|0,3 4,3',
  B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|3,3 4,2 4,1 3,0 0,0',
  C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5',
  D: '0,0 0,6 3,6 4,5 4,1 3,0 0,0',
  E: '4,0 0,0 0,6 4,6|0,3 3,3',
  F: '0,0 0,6 4,6|0,3 3,3',
  G: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3',
  H: '0,0 0,6|4,0 4,6|0,3 4,3',
  I: '1,0 3,0|2,0 2,6|1,6 3,6',
  J: '0,1 1,0 3,0 4,1 4,6',
  K: '0,0 0,6|4,6 0,2|1,3 4,0',
  L: '0,6 0,0 4,0',
  M: '0,0 0,6 2,3 4,6 4,0',
  N: '0,0 0,6 4,0 4,6',
  O,
  P,
  Q: `${O}|2,2 4,0`,
  R: `${P}|2,3 4,0`,
  S: '0,1 1,0 3,0 4,1 4,2 3,3 1,3 0,4 0,5 1,6 3,6 4,5',
  T: '0,6 4,6|2,6 2,0',
  U: '0,6 0,1 1,0 3,0 4,1 4,6',
  V: '0,6 2,0 4,6',
  W: '0,6 1,0 2,3 3,0 4,6',
  X: '0,0 4,6|0,6 4,0',
  Y: '0,6 2,3 4,6|2,3 2,0',
  Z: '0,6 4,6 0,0 4,0',
  '0': `${O}|0,1 4,5`,
  '1': '1,5 2,6 2,0|1,0 3,0',
  '2': '0,5 1,6 3,6 4,5 4,4 0,0 4,0',
  '3': '0,5 1,6 3,6 4,5 4,4 3,3 1,3|3,3 4,2 4,1 3,0 1,0 0,1',
  '4': '3,0 3,6 0,2 4,2',
  '5': '4,6 0,6 0,3 3,3 4,2 4,1 3,0 0,0',
  '6': '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2 3,3 0,3',
  '7': '0,6 4,6 1,0',
  '8': '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3',
  '9': '0,1 1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,4 1,3 4,3',
  '-': '1,3 3,3',
  '.': '2,0 2,1',
  ',': '2,1 1,-1',
  ':': '2,1 2,2|2,4 2,5',
  '/': '0,0 4,6',
  '(': '3,0 2,1 2,5 3,6',
  ')': '1,0 2,1 2,5 1,6',
  '#': '1,0 1,6|3,0 3,6|0,2 4,2|0,4 4,4',
  '+': '0,3 4,3|2,1 2,5',
  '=': '0,2 4,2|0,4 4,4',
  _: '0,0 4,0',
  '%': '0,6 1,6 1,5 0,5 0,6|4,6 0,0|3,1 4,1 4,0 3,0 3,1',
};

const ALTURA_DA_GRADE = 6;
const AVANCO_DA_LETRA = 5.5;

/** Os traços do texto, em mm, com o começo em (0, 0) e a altura pedida. Sem acentos e em maiúsculas, como o letreiro do plotter. */
export function tracosDoTexto(texto: string, alturaMm: number): Ponto2D[][] {
  const escala = alturaMm / ALTURA_DA_GRADE;
  const limpo = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return [...limpo].flatMap((letra, i) =>
    (LETRAS[letra]?.split('|') ?? []).map((traco) =>
      traco.split(' ').map((par) => {
        const [x, y] = par.split(',').map(Number);
        return { x: (x! + i * AVANCO_DA_LETRA) * escala, y: y! * escala };
      }),
    ),
  );
}
