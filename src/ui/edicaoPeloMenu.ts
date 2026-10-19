/**
 * O menu Editar do Mac. Lá, ⌘Z, ⌘C, ⌘V, ⌘X e ⌘A são atalhos do menu da barra
 * do sistema: o menu pega a tecla antes da página, e o atalho do programa
 * (Desfazer, Copiar a peça…) não seria visto. Então os itens do menu mandam a
 * ação para a página, que decide: num campo de texto, é o texto que se
 * desfaz, copia ou cola; fora dele, é o comando do programa.
 */
export const ACOES_DE_EDICAO = ['desfazer', 'refazer', 'recortar', 'copiar', 'colar', 'selecionar-tudo'] as const;

export type AcaoDeEdicao = (typeof ACOES_DE_EDICAO)[number];

/** O comando do campo de texto (o do motor de páginas) que corresponde a cada ação. */
export const COMANDO_NO_TEXTO: Readonly<Record<AcaoDeEdicao, 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'>> = {
  desfazer: 'undo',
  refazer: 'redo',
  recortar: 'cut',
  copiar: 'copy',
  colar: 'paste',
  'selecionar-tudo': 'selectAll',
};

export function ehAcaoDeEdicao(valor: unknown): valor is AcaoDeEdicao {
  return typeof valor === 'string' && (ACOES_DE_EDICAO as readonly string[]).includes(valor);
}

/**
 * Para onde vai a ação do menu: para o texto do campo em foco; para o programa; ou para nenhum, com uma janela
 * aberta por cima (como os atalhos de teclado, que também não valem sob uma janela).
 */
export function destinoDaAcaoDoMenu(campoDeTextoEmFoco: boolean, janelaAberta: boolean): 'texto' | 'programa' | 'nenhum' {
  if (campoDeTextoEmFoco) return 'texto';
  return janelaAberta ? 'nenhum' : 'programa';
}
