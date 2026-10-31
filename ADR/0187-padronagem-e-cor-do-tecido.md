# ADR 0187 — A padronagem e a cor do tecido

O manual da referência tem, no tecido, "Mostra padronagem", com a imagem do padrão e o comprimento dele, e a cor de preenchimento dos moldes.

**Decisão:** a janela do Enfesto ganha "Mostra padronagem", com a imagem (até 2 MB) e o comprimento do padrão, e "Cor do tecido nas peças". A imagem se repete sobre a área útil da mesa, meio transparente, no tamanho real. A cor preenche as peças que não têm cor própria.

**Limites:** a imagem fica dentro do projeto, por isso o limite. A padronagem é só para ver: não casa as peças com a estampa, o que continua nas listras e na impressão digital. O resultado não foi visto na tela.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
