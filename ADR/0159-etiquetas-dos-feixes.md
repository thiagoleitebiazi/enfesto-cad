# ADR 0159 — As etiquetas dos feixes

Depois do corte, as peças vão para a costura em feixes, e cada feixe precisa de uma etiqueta. O programa não tinha isso.

**Decisão:** em Planejamento › Ordem, "Etiquetas dos feixes" divide a grade da ordem em feixes de N roupas, por tamanho. A folha em HTML, para imprimir, traz a ordem, o produto, a cor, o tamanho, a numeração das roupas, as peças e um código de barras Code 39. A mesma lista sai em CSV.

**Não feito:** o acompanhamento do feixe pela leitura do código, e a impressão direta em impressora de etiquetas. O código de barras não foi lido por um leitor de verdade.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
