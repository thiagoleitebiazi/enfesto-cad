# ADR 0197 — Os pontos de emenda automáticos

O manual do encaixe explica os pontos de emenda, que o ADR 0188 fez só à mão: "Automático", no Método 1 (distância mínima, máxima e margem) e no Método 2 (direção do enfesto e espaço entre os pontos), além de "Apagar".

**Decisão:** o botão "Pontos de emenda" da aba Encaixe. No Método 1, a partir do começo, cada ponto é o de menor transpasse dentro da faixa entre a mínima e a máxima. No Método 2, os pontos vão de espaço em espaço, do começo ou do fim. Depois de aplicar, o programa diz a posição e o transpasse de cada um. O transpasse é quanto o tecido novo volta sobre o anterior para cobrir as peças que atravessam o ponto.

**Limites:** a conta do transpasse é da prática do enfesto, o manual não a descreve. "Configurar visualização" (posição, altura das setas) não foi feita: a emenda aparece como linha. O transpasse é dito na hora, não fica guardado.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
