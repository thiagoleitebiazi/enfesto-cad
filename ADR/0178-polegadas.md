# ADR 0178 — A régua em polegadas

O manual da referência tem "Unidade de medida". O programa tinha centímetros e milímetros na régua.

**Decisão:** Régua em polegadas, com passos redondos e frações. A barra de status mostra as coordenadas na mesma unidade.

**Não feito:** a unidade geral: os campos dos diálogos continuam em mm ou cm, como cada um diz.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
