# ADR 0192 — O auto ajuste de texto, as linhas do desenho e a calculadora

O manual da referência tem o "Auto ajuste de texto" (tamanho do texto e do fio entre um mínimo e um máximo, e a orientação manual), a cor, o estilo e o peso da linha do desenho, "Usar estilos de linha definidos" no plotter e a calculadora.

**Decisão:**

- Opções › "Auto ajuste de texto": no plotter, o nome acompanha o tamanho da peça entre os limites, o fio também, e o texto sai em 0°, 90°, 180° ou 270°.
- Opções › "Estilo da costura no plotter": a costura sai tracejada ou pontilhada, com o comando LT.
- O painel da peça ganha a cor, o estilo e o peso das linhas internas no desenho.
- Opções › "Calculadora".

**Limites:** a conta do tamanho do texto (1% do lado menor) é minha. "Ajustar descrição" e "Ajustar observações" não têm efeito próprio: o plotter daqui só escreve o nome e o tamanho. Cor, estilo e peso valem por peça, não por linha, e só na tela. O LT e o DI não foram testados num plotter.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
