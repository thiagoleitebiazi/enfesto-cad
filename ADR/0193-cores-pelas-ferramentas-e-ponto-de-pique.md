# ADR 0193 — As cores pelas ferramentas e o ponto de pique

O manual da referência, em Cores, tem "Mostrar conforme definição das ferramentas" e "Ponto de pique".

**Decisão:** Visão › "Cores pelas ferramentas" pinta o contorno das peças na cor da caneta do corte. Visão › "Pontos de pique" marca o ponto de cada pique no contorno.

**Limites:** só o contorno muda de cor, não os outros elementos. A cor e o formato do ponto de pique são fixos, ao contrário da referência. O resultado não foi visto na tela.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
