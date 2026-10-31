# ADR 0186 — A grade de corte

A apostila da referência define, em cada tecido, a "Grade de Corte", e tem "Aplicar para modelo" quando a grade é a mesma nos outros tecidos. O encaixe daqui só entrava com uma peça de cada tamanho, ou só com o base.

**Decisão:** a janela do encaixe, com "todos os tamanhos", mostra a grade: quantas vezes cada tamanho entra no risco, de 1 em diante, e zero tira o tamanho. O número multiplica a quantidade da peça. A grade vale para as peças do modelo, é lembrada enquanto o programa está aberto, e segue para a fila de encaixes.

**Limite:** o projeto aqui tem um tecido só, então "Aplicar para modelo" é o caminho único: não há grade por tecido. O plano de corte continua com a grade própria dele. "Alterando seu risco", na apostila, é o que aqui é a janela do Enfesto, e a mudança de quantidade ou de giro é feita nas propriedades da peça.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
