# ADR 0202 — O menu Moldes do encaixe

O manual do encaixe da referência tem, em Moldes e no Tecido: "Fundir pique ao contorno", "Remover piques não fundidos", "Margem" e "Criar envolvente", "Usar distância/margem" (Shift+Ctrl+D), "Sentido por tamanho" e "Sentido por pacote", "Manter orientação dos pacotes", a aba Quantidade por tamanho, o tamanho do texto de cada molde, os conjuntos de "Propriedades de encaixe" e o SNAP.

**Decisão:**

- "Substituir piques" ganha fundir ao contorno: o recorte entra na forma da peça, e o pique sai. Pode também tirar os que sobrarem.
- O painel da peça ganha a margem em volta no encaixe, a quantidade por tamanho ("P:2 M:1") e o tamanho do texto no plotter.
- Ctrl+Shift+D liga e desliga a distância entre os moldes, lembrando a medida.
- O tecido de um sentido só ganha "Sentido no encaixe": por tamanho, cada tamanho vai num sentido; por pacote, metade das cópias vai ao contrário. É o que economiza nesses tecidos sem misturar o sentido dentro de uma peça pronta.
- Opções › "Propriedades de encaixe": conjuntos com nome de giro, quantidade e tecido, para aplicar de uma vez.
- "Encostar ao soltar": a peça arrastada segue no rumo do arrasto até a vizinha, no lugar do SNAP.

**Limites:** a envolvente é a margem de cada peça, não em volta de um grupo, e não há a forma retangular. A margem por lado do contorno não foi feita. "Por pacote" divide as cópias de cada peça ao meio, sem saber quais peças formam cada pacote. "Substituir" (trocar um tamanho já encaixado por outro) não foi feito: depois de aplicado, o encaixe não guarda a graduação das peças; o caminho aqui é refazer com outra grade.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
