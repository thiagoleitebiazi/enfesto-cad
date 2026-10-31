# ADR 0191 — O relacionamento dos piques

O manual da referência tem a janela "Relacionamento piques", com os modos peça com tecido (horizontal, vertical, centralizado) e peça com peça (horizontal, vertical, simétrico). Ele só lista os nomes. O programa já casava peça com tecido e peça com peça pelos pontos de casamento, sempre nos dois sentidos.

**Decisão:** o diálogo do ponto de casamento ganha o Relacionamento: nos dois sentidos, só na horizontal, só na vertical, ou centralizado, com o ponto no meio do desenho. Vale nos dois casos, com o tecido e com o grupo.

**Limites:** os modos "simétrico" não foram feitos: o manual não diz o que fazem. O como dos outros é leitura minha, pelos nomes. Vale no risco de casamento, não no encaixe comum.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
