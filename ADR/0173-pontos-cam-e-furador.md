# ADR 0173 — Os pontos CAM e o furador

O manual da referência define os pontos CAM: onde a faca da máquina inicia e encerra o corte. No tipo Completo, a peça é cortada de uma vez, começando e terminando no mesmo ponto. No Semi-corte, em duas etapas, de pontos de entrada até pontos de saída, em sentidos opostos. Ele também tem o furador ISO, com os comandos M43 e M44.

**Decisão:** o painel da peça ganha "Corte na mesa" (Normal, Completo, Semi-corte), com o número do ponto de entrada e o de saída. O ISO começa o contorno na entrada ou faz os dois trechos. O diálogo do ISO ganha o furador por M43 e M44.

**Limites:** os pontos são números do contorno, não um clique no desenho. O manual não diz o que cada comando faz: M43 desce e M44 sobe é uma leitura minha, a conferir na máquina. Nada disso foi testado numa mesa física.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
