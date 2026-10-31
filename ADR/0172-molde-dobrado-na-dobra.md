# ADR 0172 — O molde dobrado na dobra do tecido

A apostila da referência tem "Molde dobrado só na dobra", e o manual diz que as dobras servem para encaixar em tecidos com dobra. No programa, a meia peça ia para qualquer lugar da mesa, onde sairia cortada em duas.

**Decisão:** no enfesto par e no tubular, a peça de simetria que chega ao encaixe vai com a linha de simetria encostada na borda da dobra (o começo da largura, sem a margem de segurança de 4 mm: a 4 mm da dobra, a peça sairia em duas; a validação aceita isso só nessas peças), uma depois da outra, girada só no que a restrição dela deixa. As outras se encaixam em volta. Vale para os dois métodos do encaixe automático, sem opção nova: com "abrir as simetrias", as peças chegam abertas e nada muda.

**Limites:** a peça que não dá para pôr na dobra (a rotação não deixa, ou acabou a mesa) segue com as outras, como antes, e o programa não avisa. No tubular só a borda de cima é usada, embora o tubo tenha duas dobras. A busca do planejamento não passa por aqui. O pós-processamento roda no cálculo em segundo plano, que só tem teste das regras.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
