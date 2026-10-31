# ADR 0198 — O status do encaixe e as perdas

O manual do encaixe tem a janela "Status" (consumo, e as abas Modelos, Moldes e Informações de corte), "Perdas" no tecido (percentual ou comprimento), e na barra de status "Rendimento consumo" e "Rendimento peso".

**Decisão:** o botão "Status" da aba Encaixe mostra as peças na mesa, o comprimento, o consumo com as perdas, o consumo do enfesto, o aproveitamento e os dois rendimentos, e duas tabelas: por tamanho (completos e encaixados) e por molde. As perdas ficam na janela do Enfesto, em porcentagem e em centímetros, e entram só nessa conta.

**Limites:** as perdas não entram no custo nem no relatório, que seguem com as contas deles. "Completos" compara os nomes das peças: dois moldes diferentes com o mesmo nome contam como um. A barra de status não foi mudada.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
