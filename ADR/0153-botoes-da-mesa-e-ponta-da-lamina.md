# ADR 0153 — Os botões de cada mesa e a ponta da lâmina

Os ADRs 0144 e 0148 deixaram de fora a tabela de botões configurável e a compensação da lâmina.

**Decisão:**
- **Mesa digitalizadora:** a tabela dos botões passa a ter o número de cada ação, editável (0 a 15) e lembrado neste computador. Um número em duas ações é avisado, e só a primeira da tabela vale.
- **ISO:** com a faca tangencial, o diálogo aceita a distância da ponta da lâmina ao eixo. O eixo anda adiantado da ponta, no rumo do corte, e ao subir para girar ele vai para o lugar certo do rumo novo.

**Não feito:** os formatos binários de algumas mesas. Nada disso foi testado em equipamento físico.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
