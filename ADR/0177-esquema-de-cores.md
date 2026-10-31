# ADR 0177 — O esquema de cores

O manual da referência tem três esquemas de cores além do padrão.

**Decisão:** no menu Opções, Cores padrão, Cores escuras, Alto contraste e Cores areia. Cada esquema troca a escala de cinza da interface, e a escolha fica lembrada.

**Limites:** o resultado não foi visto: o programa não foi aberto, e as cores fixas de alguns painéis podem destoar no esquema escuro. A mesa do desenho continua clara. A cor de cada item não é configurável, ao contrário da referência.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
