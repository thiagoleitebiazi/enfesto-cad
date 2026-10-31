# ADR 0160 — As áreas bloqueadas da mesa

A apostila da referência tem as "linhas de referência", que permitem o enfesto em escada e bloqueiam áreas do risco. O programa só conhecia a mesa inteira.

**Decisão:** o Enfesto ganha "Áreas bloqueadas da mesa": uma por linha, em mm (comprimento de, até, largura de, até). Os dois métodos do encaixe automático desviam delas, a mesa as mostra em vermelho, e a validação acusa a peça posta à mão sobre uma delas.

**Não feito:** desenhar a área com o mouse. A busca de riscos do planejamento ainda não considera as áreas: ela calcula o risco sem conhecer a mesa.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
