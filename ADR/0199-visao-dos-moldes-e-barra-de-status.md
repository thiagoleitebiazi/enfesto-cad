# ADR 0199 — O que aparece nos moldes, os destaques e a barra de status

O manual do encaixe da referência tem, em Visão, "Moldes no encaixe" (o que aparece em cada peça, sem afetar a impressão), "Destacar pacotes" e "Destacar relacionamento de piques", e em Configuração a escolha dos campos da barra de status e a precisão das medidas.

**Decisão:**

- Visão › "Moldes no encaixe": nome, preenchimento, fio, números, graduação, piques, descrição, linhas auxiliares, costura, perímetro, tamanho, tecido, quantidade e giro. Fica lembrado neste computador.
- Visão › "Destacar pacotes": cada pacote numa cor, com o código na frente do nome. O pacote é o tamanho e a cópia que o encaixe deu à peça.
- Visão › "Destacar relacionamento de piques": um anel nos pontos de casamento.
- Opções › "Barra de status": encaixados, comprimento, largura, área, perímetro da peça e os dois rendimentos.
- Opções › "Opções do encaixe": ângulo de giro, usado por Ctrl+← e Ctrl+→, precisão e código dos pacotes, alfanumérico ou numérico.
- O painel da peça ganha a Descrição.

**Limites:** as cores dos pacotes são de uma paleta, não escolhidas uma a uma. "Caminho grade" não foi feito: o manual não explica. O resultado não foi visto na tela.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
