# ADR 0188 — Os pontos de emenda

A tabela de teclas da apostila da referência lista "Pontos de emenda / Manual", sem explicar. Na prática do corte, emenda é onde um rolo termina e outro começa no enfesto: nenhuma peça pode atravessar esse ponto.

**Decisão:** a janela do Enfesto ganha "Pontos de emenda", posições no comprimento. Cada um vira uma faixa de 2 mm que o encaixe automático não atravessa, uma linha vermelha tracejada na mesa, uma linha com a palavra EMENDA no plotter, e um aviso na validação para a peça que estiver em cima.

**Limites:** a explicação vem da prática, não da referência. Ctrl+E, a tecla dela, aqui segue exportando o PDF. A emenda não sai no PDF nem no ISO. A posição é digitada, não clicada na mesa.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
