# ADR 0224 — O enfesto em escada

Aprendido das aulas públicas da referência ("Enfesto Escada" e "Encaixe por bloco"): o encaixe por blocos existe para cortar num enfesto em degraus, em que cada bloco leva um número de camadas. Aqui os blocos existiam, mas todos com as camadas do enfesto.

**Decisão:** no campo dos blocos, cada bloco pode dizer as camadas: `P M x40; G GG x20`. Quando diz:

- o bloco de mais camadas vai para o começo da mesa, porque as camadas a mais só vão até o fim dele;
- as camadas ficam gravadas no enfesto;
- o status mostra o consumo somado degrau por degrau, e cada degrau;
- a ficha da enfestadeira sai com uma linha por degrau, que é o que a máquina programa.

**Limites:** o manual não descreve a escada: a regra de degraus vem da prática do enfesto e do que as aulas dizem. Na mesa de lado (blocos na vertical) a escada não vale. As perdas não entram nos degraus. O relatório e o plano de corte seguem contando um número só de camadas.

Conferência: testes unitários, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
