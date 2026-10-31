# ADR 0194 — Os tecidos do modelo

O manual do programa de encaixe da referência, lido só agora, mostra que cada molde diz o tecido dele (principal, contraste, forro, entretela), e que o encaixe automático tem "Gerar encaixe para": todos os tecidos ou só o selecionado. Cada tecido tem a sua grade, com "Aplicar para modelo". Aqui, todas as peças iam juntas para a mesa, e o ADR 0186 dizia que o projeto tinha um tecido só.

**Decisão:** o painel da peça ganha "Tecido do molde". O forro e a entretela gerados já vêm com o deles. Com mais de um tecido, a janela do encaixe pergunta para qual gerar: todos juntos, todos com um trecho da mesa para cada, ou um só. As peças dos outros tecidos saem da mesa quando o encaixe é aplicado, depois do fim dela. A grade passa a ser por tecido, com "Aplicar para modelo". Vale também na fila.

**Limites:** um projeto continua com um enfesto: largura, margens e listras não são por tecido. Para encaixar outro tecido com outra largura, é preciso mudar o enfesto. O projeto guarda um risco por vez, não um por tecido.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
