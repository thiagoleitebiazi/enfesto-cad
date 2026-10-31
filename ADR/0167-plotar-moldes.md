# ADR 0167 — Plotar os moldes

O manual da referência plota os moldes, não só o encaixe, com as opções "tamanhos separados", "desdobrar moldes", "girando 90°", "elementos selecionados" e "reorganizar os moldes". E tem "Organiza todos os moldes".

**Decisão:** Início › "Plotar moldes" salva um PLT com essas opções, em colunas na largura do papel, sem mexer no encaixe. Visão › "Organizar os moldes" faz a mesma organização na tela (tira as peças do encaixe; Ctrl+Z desfaz).

Não foi testado num plotter físico.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
