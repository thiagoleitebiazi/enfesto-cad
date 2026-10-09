/**
 * Compactação da fita de ferramentas quando a janela é estreita demais para
 * ela caber numa linha (a aba Manipulação pede ~1330 px; uma tela de 1920 ×
 * 1080 com escala de 150% dá 1280). Em vez de quebrar os grupos numa segunda
 * linha — o que roubava ~90 px de altura do desenho —, a fita encolhe por
 * níveis, como as fitas do Office, sempre com a mesma altura:
 *
 * - nível 0: normal;
 * - nível 1: os rótulos dos botões grandes passam a duas linhas (cada rótulo
 *   marca onde quebra);
 * - nível 1 + k: além disso, os botões pequenos dos k últimos grupos (da
 *   direita para a esquerda) ficam só com o ícone — o nome continua na dica e
 *   para leitores de tela.
 *
 * O primeiro nível que couber é o usado. Se nem o último couber, a fita rola
 * na horizontal (CSS); nunca quebra linha.
 */

/** No contêiner da fita: rótulos dos botões grandes em duas linhas. */
export const ATRIBUTO_ROTULOS_EM_DUAS_LINHAS = 'data-rotulos-em-duas-linhas';
/** Num grupo: botões pequenos só com o ícone. */
export const ATRIBUTO_GRUPO_COMPACTO = 'data-compacto';

export function aplicarNivelDeCompactacao(conteudo: HTMLElement, grupos: readonly HTMLElement[], nivel: number): void {
  conteudo.toggleAttribute(ATRIBUTO_ROTULOS_EM_DUAS_LINHAS, nivel >= 1);
  const compactos = Math.max(0, nivel - 1);
  grupos.forEach((grupo, indice) => grupo.toggleAttribute(ATRIBUTO_GRUPO_COMPACTO, indice >= grupos.length - compactos));
}

/**
 * Aplica, do mais folgado ao mais compacto, cada nível até `cabe()` dizer que
 * a fita cabe, e devolve o nível escolhido (o último, se nenhum couber).
 * `cabe` mede o layout já com o nível aplicado — tudo na mesma tarefa, antes
 * da pintura, então os níveis intermediários nunca aparecem na tela.
 */
export function ajustarCompactacao(conteudo: HTMLElement, grupos: readonly HTMLElement[], cabe: () => boolean): number {
  const ultimoNivel = grupos.length + 1;
  for (let nivel = 0; nivel < ultimoNivel; nivel++) {
    aplicarNivelDeCompactacao(conteudo, grupos, nivel);
    if (cabe()) return nivel;
  }
  aplicarNivelDeCompactacao(conteudo, grupos, ultimoNivel);
  return ultimoNivel;
}
