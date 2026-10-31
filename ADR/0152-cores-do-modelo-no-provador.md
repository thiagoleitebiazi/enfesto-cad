# ADR 0152 — As cores do modelo no provador 3D

O ADR 0136 deixou as variantes de cor só no desenho e na ficha.

**Decisão:** na aba Imagem do provador, "Cor do modelo" mostra a roupa na variante escolhida.
- A cor de cada peça vem da troca da variante (`corNaVariante`). A peça na cor de partida, que ninguém escolheu, toma a troca da cor principal do desenho.
- Só a vista muda: a simulação não recomeça, e a montagem guardada não muda.
- "Salvar a cartela de cores (PNG)" põe a vista de agora na cor original e em cada variante, lado a lado.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. A imagem da cartela não foi gerada de verdade: o programa não foi aberto (pedido do usuário: só testes unitários).
