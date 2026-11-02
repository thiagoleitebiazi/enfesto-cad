import { ponto, type Ponto2D } from '../core/geometria';
import { criarMolde, type Molde } from './molde';

/**
 * Uma camiseta de teste, sem nome nas peças, como vem de um arquivo de molde: frente, costas, uma manga curta e uma comprida da
 * mesma cabeça e a gola de ribana, com o fio deitado. Só para os testes.
 */
const naTela = (pontos: readonly (readonly [number, number])[]): Ponto2D[] => pontos.map(([x, y]) => ponto(-y, x + 400));

function curva(de: readonly [number, number], controle: readonly [number, number], ate: readonly [number, number], partes: number): [number, number][] {
  return Array.from({ length: partes + 1 }, (_, k) => {
    const t = k / partes;
    return [0, 1].map((i) => (1 - t) ** 2 * de[i]! + 2 * t * (1 - t) * controle[i]! + t ** 2 * ate[i]!) as [number, number];
  });
}

export function pecaDeTronco(id: string, decote: number, emV = false): Molde {
  const meia: [number, number][] = [...curva([90, 0], [205, -45], [205, -45], 1), ...curva([205, -45], [190, -190], [280, -260], 12).slice(1), [280, -760]];
  const espelho = [...meia].reverse().map(([x, y]): [number, number] => [-x, y]);
  const pescoco: [number, number][] = emV ? [[-90, 0], [0, -decote], [90, 0]] : curva([-90, 0], [0, -2 * decote], [90, 0], 14);
  return criarMolde({ nome: id, referencia: '', tamanho: '', contorno: naTela([...pescoco.slice(0, -1), ...meia, ...espelho.slice(0, -1)]), linhaDeFio: { inicio: ponto(100, 400), fim: ponto(600, 400) } }, id);
}

/** `folga`: o tamanho das orelhas da barra no punho (mm), como no molde; 0: o punho reto. */
export function pecaDeManga(id: string, comprimento: number, punho: number, folga = 0): Molde {
  const cabeca = curva([-205, 0], [0, 260], [205, 0], 24);
  const barra: [number, number][] =
    folga > 0
      ? [[punho / 2, -comprimento], [punho / 2 + 7, -comprimento - folga], [-punho / 2 - 7, -comprimento - folga], [-punho / 2, -comprimento]]
      : [[punho / 2, -comprimento], [-punho / 2, -comprimento]];
  return criarMolde({ nome: id, referencia: '', tamanho: '', contorno: naTela([...cabeca, ...barra]), linhaDeFio: { inicio: ponto(comprimento, 400), fim: ponto(0, 400) } }, id);
}

export function pecaDeGola(id: string, comprimento: number, largura: number): Molde {
  return criarMolde(
    {
      nome: id,
      referencia: '',
      tamanho: '',
      contorno: [ponto(0, 0), ponto(0, comprimento), ponto(largura, comprimento), ponto(largura, 0)],
      linhaDeFio: { inicio: ponto(largura / 2, 10), fim: ponto(largura / 2, comprimento - 10) },
    },
    id,
  );
}

/** Uma peça de saia: a cintura em cima, um pouco curva, e a barra mais larga. */
export function pecaDeSaia(id: string, cintura: number, barra: number, altura: number): Molde {
  const alto = curva([-cintura / 2, 0], [0, -30], [cintura / 2, 0], 10);
  return criarMolde({ nome: id, referencia: '', tamanho: '', contorno: naTela([...alto, [barra / 2, -altura], [-barra / 2, -altura]]), linhaDeFio: { inicio: ponto(altura - 50, 400), fim: ponto(50, 400) } }, id);
}

/** Uma perna de calça: o cós em cima, o gancho saindo de um lado e a barra embaixo. */
export function pecaDeCalca(id: string, gancho: number): Molde {
  const contorno = naTela([[-95, 0], [95, 0], [140, -180], [95, -1000], [-95, -1000], [-100 - gancho * 0.2, -300], [-100 - gancho, -255], [-92 - gancho * 0.3, -190]]);
  return criarMolde({ nome: id, referencia: '', tamanho: '', contorno, linhaDeFio: { inicio: ponto(900, 400), fim: ponto(100, 400) } }, id);
}

/** A camiseta inteira: as costas (decote raso), a frente (fundo), a manga comprida, a curta e a gola. */
export const camisetaSemNomes = (): Molde[] => [pecaDeTronco('p1', 25), pecaDeTronco('p2', 85), pecaDeManga('p3', 600, 240, 26), pecaDeManga('p4', 250, 400, 26), pecaDeGola('p5', 400, 60)];
