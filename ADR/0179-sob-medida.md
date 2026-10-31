# ADR 0179 — O tamanho sob medida

Uma confecção que atende sob medida parte da grade e ajusta para a pessoa.

**Decisão:** Modelo › "Sob medida" pede as medidas da peça pronta, pelos pontos da tabela da ficha técnica. Cada medida diz onde cai na grade, a média é a posição, e as peças de mesma grade ganham um tamanho ali, com as regras tiradas dos vizinhos. Vai até um tamanho além das pontas; mais longe, recusa.

**Limites:** a peça cresce por inteiro, não medida por medida. As medidas são da peça pronta, já com a folga, não do corpo. Confira na peça-piloto. Os piques graduados ficam como no base, nesse tamanho.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
