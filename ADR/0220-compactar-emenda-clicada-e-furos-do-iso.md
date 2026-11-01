# ADR 0220 — Compactar com grupos, a emenda clicada e os furos do ISO

Os últimos limites dos ADRs 0188, 0195 e 0201 que eram de funcionamento.

- **Compactar com grupos:** antes, o encaixe com grupos não era compactado. Agora a folga dentro de cada trecho fecha, e nenhuma peça entra no trecho do grupo anterior.
- **Emenda clicada na mesa:** a janela Pontos de emenda ganha "Marcar clicando na mesa". Cada clique põe uma emenda ali; clicar perto de uma tira ela; Esc termina.
- **Furos no ISO importado:** o furo da ferramenta T4 e o de M43 voltam como furinhos de 2 mm na peça. Antes eles sumiam.

**Limites:** a peça do ISO volta com furo, não com a marca que o gerou: o arquivo não diz qual era. As linhas de referência seguem digitadas. O traço da costura ainda não sai no PDF, só na tela e no plotter.

Conferência: testes unitários, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
