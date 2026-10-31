# ADR 0184 — O texto como linha, a pasta do plotter e o retângulo de organização

O manual da referência tem "Utilizar texto como linha", para os textos saírem desenhados, e a plotagem direta. A apostila ensina a desenhar um retângulo da largura do papel menos 1 cm, pôr os moldes dentro e apagá-lo.

**Decisão:**

- Opções › "Texto como linha no plotter": os textos saem em traços, numa fonte própria com maiúsculas, números e sinais, sem o comando LB. Serve ao plotter que não tem letreiro.
- Opções › "Enviar ao plotter (pasta)": grava o risco em "para-plotar", na pasta escolhida, usando a mesma pasta compartilhada do ERP e da fila.
- Visão › "Retângulo de organização": uma guia tracejada, 1 cm mais estreita que o papel. "Organizar os moldes" passa a usar essa largura.

**Limites:** a pasta só plota se um programa do plotter a vigiar: o programa não fala com a porta da máquina. A fonte não tem acentos, como o letreiro simples dos plotters. Nada disso foi testado num plotter.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
