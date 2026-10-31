# ADR 0162 — O cabeçalho do risco

Um risco plotado sem identificação se perde na sala de corte.

**Decisão:** o PLT sai com duas linhas logo depois da última peça: o modelo, o código e a data; a largura, o comprimento, o aproveitamento e o número de peças. Ficam depois da última peça porque ali sempre há papel, e a largura pode não ter folga.

**Não feito:** o cabeçalho no PDF e os textos livres no risco. Não foi testado num plotter físico.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
