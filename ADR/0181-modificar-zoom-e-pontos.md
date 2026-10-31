# ADR 0181 — Os modos do Modificar, o zoom de um elemento e o ponto não graduado

O "Modificar" tinha dois modos desligados, esperando confirmação. O manual da referência diz só que o Discreto "move o ponto junto aos pontos próximos" e que o Proporcional "move os pontos mantendo a proporção". Ele tem ainda "Modificar linha auxiliar", "Zoom de um elemento" e a opção de ver o "Ponto não graduado".

**Decisão:**

- Discreto: os pontos a menos de um alcance, medido sobre o contorno, andam cada vez menos, até zero. O alcance vem com 30 mm e pode mudar no diálogo.
- Proporcional: o trecho entre os dois cantos vizinhos acompanha, na proporção da distância a eles, e os cantos ficam no lugar. A curva estica sem mudar de jeito.
- A "Manipulação rápida" já movia a linha inteira. Clicada em cima de um ponto da linha, agora move só ele.
- Visão › "Zoom de um elemento": o clique seguinte enquadra a linha, o furo ou a peça que estiver ali.
- Visão › "Pontos não graduados": marca em vermelho, na peça selecionada, os cantos sem regra.

**Limites:** o como dos dois modos é leitura minha, a conferir com quem conhece a referência. Numa peça só de cantos, o Proporcional faz o mesmo que mover o ponto, porque não há trecho entre eles.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
