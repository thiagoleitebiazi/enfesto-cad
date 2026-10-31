# ADR 0190 — As opções do extrair molde, o fio, inverter costura e manter diferença

A segunda auditoria, com os 256 nomes de janelas e opções do manual da referência, achou o que a primeira não viu.

**Decisão:**

- "Extrair molde" ganha um diálogo com as opções de "Criar molde por intersecção": detectar graduações, piques e linhas auxiliares; quebrar linhas auxiliares, ficando a parte de dentro; compor contornos, sem o interior.
- O fio: "Usar ângulo" e "Fio no centro" no painel da peça, e "Fio por seleção" na fita, em que o clique numa aresta ou numa linha dá a direção.
- "Inverter costura": a linha de corte vira o contorno, e a costura fica por dentro, como linha do molde.
- "Manter diferença", no tamanho novo: entra depois do último, com a distância média da regra da grade.

"Usar linhas auxiliares" é o que o extrair já fazia. "Manter base" é o padrão daqui: o contorno fica e a costura se projeta. "Todo Molde" é a costura de sempre.

**Limites:** em "Detectar graduações", só os cantos que já existiam levam a regra; os criados pelo corte ficam sem. O "Extrair molde" passa a abrir um diálogo antes do clique.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
