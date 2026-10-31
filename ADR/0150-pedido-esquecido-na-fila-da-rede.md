# ADR 0150 — O pedido esquecido na fila da rede

O ADR 0143 deixou em aberto o pedido levado por uma estação que fechou e não voltou: ele ficava em "calculando" para sempre.

**Decisão:** ao levar um pedido, a estação escreve nele quem levou e quando. Uma estação que atende, ao ficar livre, devolve a "pedidos" o que está parado em "calculando" há mais de 6 horas (`devolverEsquecidos`), e o pedido pode ser levado de novo.

**Limite conhecido:** se a estação antiga voltar e terminar depois disso, o resultado dela sobra em "prontos". Quem pediu fica com o primeiro que chegar.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
