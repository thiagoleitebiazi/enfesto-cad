# ADR 0213 — A vitrine da coleção

A loja virtual da referência é um serviço na internet dela, e não há como ligar o programa a ele. O que dá para fazer aqui é o que a loja mostra.

**Decisão:** a aba Looks da coleção ganha "Salvar a vitrine (HTML)": uma página só, sem servidor, que funciona no celular e em tema escuro, para pôr em qualquer hospedagem ou mandar a quem compra. Ela traz os produtos com o croqui, as cores, o tecido e os tamanhos; os looks; o filtro por categoria; e "Qual é o meu tamanho?", que usa as medidas da ficha técnica de cada modelo.

**Limites:**

- Não é uma loja: não tem carrinho, pagamento, estoque nem pedido. Publicar a página é com o usuário.
- As imagens são os croquis, não fotos nem o modelo 3D: não há provador virtual.
- O tamanho é o primeiro em que cada medida cabe, com 2 cm de folga, para qualquer tecido. É mais simples que a recomendação do programa (ADR 0119), que usa as regras de caimento e a elasticidade.
- Só o modelo ligado a um projeto com ficha técnica tem tamanhos e medidas.

Conferência: testes unitários, com a página de verdade rodando o script dela. `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários), e a página nunca foi vista num navegador.
