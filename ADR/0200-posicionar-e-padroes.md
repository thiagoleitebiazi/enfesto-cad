# ADR 0200 — Posicionar os moldes e os padrões do encaixe

O manual do encaixe tem "Molde selecionado", "Tamanho selecionado", "Todos moldes no enfesto" e "Todos moldes fora do enfesto", "Encaixa molde ao clicar", o "Usar" de cada molde, "Verifica sobreposição ao plottar" e, nas opções, o que um encaixe novo já traz.

**Decisão:**

- Aba Encaixe › "Posicionar": a peça selecionada, o tamanho dela ou todas, para a mesa ou para fora dela.
- "Encaixa molde ao clicar": o clique na lista leva à mesa a peça que está fora dela.
- "Usar no encaixe", no painel da peça: desligado, a peça fica de fora do encaixe, sem sair do projeto.
- O plotter avisa de moldes sobrepostos antes de sair, e isso pode ser desligado.
- Janela do Enfesto › "Usar como padrão": largura, comprimento, tipo, margens e distância viram o começo de todo enfesto novo.

**Limite:** o aviso vale na saída para arquivo; a pasta do plotter não pergunta.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
