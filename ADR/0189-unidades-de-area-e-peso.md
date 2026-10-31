# ADR 0189 — As unidades de área e de peso

A apostila da referência tem três unidades de medida: linear, quadrado e peso. O programa tinha a régua em cm, mm e polegadas (ADR 0178).

**Decisão:** no menu Opções, a área em cm², m² ou pol², e o peso em kg, g ou lb. Valem nas informações dos moldes e no relatório, e ficam lembradas neste computador.

**Limites:** as exportações do relatório (PDF, Excel), a ficha técnica e o custo seguem em kg e m², que é como os dados são guardados. Os campos de digitar continuam na unidade que cada um diz.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
