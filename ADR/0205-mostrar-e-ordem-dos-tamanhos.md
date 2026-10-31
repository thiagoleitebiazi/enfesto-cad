# ADR 0205 — Mostrar e esconder a interface, e a ordem dos tamanhos

A auditoria do manual do encaixe, com 104 itens contra o código, achou quatro que faltavam e cabem aqui: esconder a régua e a barra de status, a ordem crescente dos tamanhos no menu de moldes, e as opções ligadas a eles.

**Decisão:** Visão › "Réguas" e "Barra de status" mostram ou escondem cada uma. As opções do encaixe ganham a lista de peças em ordem crescente dos tamanhos: as letras da grade, depois os números. Tudo fica lembrado neste computador.

**O que ficou de fora, com o motivo:** o arquivo .aoc da enfestadeira, formato fechado; a importação de DMPL, sem um arquivo para conferir; (os blocos na vertical e a envolvente entraram depois, no ADR 0208); a fonte TrueType nos textos; os níveis de impressão do plotter Mutoh, sem a máquina para conferir; as janelas em cascata, porque o programa tem uma janela só; o teclado virtual, que o Windows já tem.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
