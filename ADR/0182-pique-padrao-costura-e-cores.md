# ADR 0182 — O pique padrão, o estilo da costura e as cores dos tamanhos

O manual da referência tem, nas opções, as dimensões padrão dos piques e o "Estilo linha costura", e na graduação uma coluna Cor, para ver cada tamanho numa cor na área de trabalho.

**Decisão:**

- Opções › "Pique padrão": largura, altura e ângulo com que os piques novos começam. Os já postos não mudam.
- Opções › costura tracejada, pontilhada ou contínua, no traço da linha de costura na tela.
- Visão › "Cores dos tamanhos": uma cor por tamanho. Sem escolha, cada posição da grade tem a sua cor de uma paleta: o desenho graduado deixa de ser todo de uma cor só.

As três ficam lembradas neste computador e entram no perfil.

**Limites:** o estilo da costura vale na tela, não no plotter nem no PDF. Os piques dos tamanhos graduados continuam na cor única. A cor é pelo nome do tamanho, para todos os projetos. O resultado não foi visto na tela.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
