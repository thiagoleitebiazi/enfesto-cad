# ADR 0158 — O PLT por partes

A apostila da referência tem o "X inicial de plotagem", para retomar quando o papel acaba, e as faixas de plotagem.

**Decisão:** Início › "PLT por partes" pede o X inicial e a largura do papel, com a faixa. O risco é deslocado, e o próprio plotter recorta o resto (IW, a janela do HPGL). O PLT comum não muda.

**Não feito:** a marca de emenda entre as faixas. Não foi testado num plotter físico: o recorte depende de o plotter aceitar o IW.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
