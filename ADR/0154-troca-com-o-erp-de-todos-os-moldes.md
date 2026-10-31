# ADR 0154 — A troca com o ERP para todos os moldes

No ADR 0141, cada troca importava só as ordens do molde aberto.

**Decisão:** a troca também importa os arquivos dos outros moldes da biblioteca, cada um com os tamanhos e as revisões do projeto dele (os arquivados não entram). Dois projetos com o mesmo código: as ordens ficam com o primeiro, e o molde aberto vem antes. O arquivo de um código desconhecido fica na entrada. A biblioteca é relida ao abrir o planejamento.

**Limite conhecido:** a ordem de outro molde só leva revisão quando o arquivo diz qual é.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
