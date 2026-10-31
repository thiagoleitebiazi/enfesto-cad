# ADR 0203 — O que as páginas de cada módulo trouxeram

As páginas oficiais da referência, módulo por módulo, citam o que ainda faltava aqui: a captura em lote na digitalização, a rastreabilidade do material e os relatórios de compra na sala de corte, a previsão de compra no encaixe, o catálogo virtual, o modelo virtual personalizável nas fotos, as imagens prontas para a loja. O manual do encaixe tem ainda a imagem do encaixe guardada no arquivo e os esquemas de cores próprios.

**Decisão:**

- Molde da foto › "Criar todos da foto": acha todos os moldes inteiros e cria uma peça para cada um.
- Sala de corte › Relatórios: "Previsão de compra", por malha, com o que os cortes pendentes pedem, o saldo e a falta; e "Rastreabilidade do material", cada movimento com o rolo, o lote, a ordem, o projeto e quem fez, com busca. As duas exportam CSV.
- Coleções › "Salvar o catálogo (HTML)": todos os modelos da coleção numa página.
- Na foto comercial da IA: corpo, idade, cabelo e pose do modelo virtual entram no pedido, e a imagem pode ser salva recortada em 1:1, 3:4 ou 9:16.
- A biblioteca mostra a miniatura do encaixe de cada projeto.
- Opções › "Cores da área de trabalho": mesa, margem, contorno e seleção, em até três esquemas próprios.

**Limites:** a captura em lote deixa de fora o molde cortado pela foto ou encostado em outro. A previsão olha só os cortes liberados: um pedido sem plano ainda não conta. O catálogo traz os croquis que estiverem na tela da coleção. A IA precisa da chave do usuário, e o recorte e o modelo virtual nunca foram usados com o serviço real. As cores próprias não foram vistas na tela.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
