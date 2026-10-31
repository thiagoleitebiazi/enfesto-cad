# ADR 0185 — A impressão com proporção, cores e prévia

O manual da referência tem, na impressão, "Proporção" (do tamanho da folha ou por porcentagem), "Fatores de escala" X e Y, "Em cores" e a janela de prévia. O PDF saía só em 1:1.

**Decisão:** a janela do PDF ganha a Proporção (real, do tamanho da folha, porcentagem, fatores X e Y), "Em cores" e o botão Visualizar. Com "Em cores", a peça sai com a cor dela; sem, tudo em preto e branco. A prévia desenha as peças e o corte das folhas, e diz quantas são. Na escala, as peças mudam de tamanho e o lugar delas na mesa acompanha.

**Limites:** a prévia é um desenho das peças e das folhas, sem os piques nem os textos. Fora de 1:1, a régua de 100 mm e o tamanho dos textos não acompanham, e a janela avisa disso. Nos moldes individuais, "do tamanho da folha" usa a maior peça para todas. O PDF não foi conferido impresso.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
