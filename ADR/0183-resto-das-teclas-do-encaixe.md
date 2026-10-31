# ADR 0183 — O resto das teclas do encaixe

A tabela completa da apostila da referência mostrou que li errado parte das teclas do ADR 0180: as setas sozinhas movem o encaixe, e Ctrl com as setas gira. O texto extraído não deixa ler os símbolos das setas, e essa é a leitura mais provável. A tabela traz ainda F9, F10, F11 e várias combinações com Ctrl.

**Decisão:**

- As setas deslizam a peça até encostar. Ctrl+← e Ctrl+→ giram 90°, com as regras de rotação de sempre.
- F9 e F10 travam o arrasto das peças na horizontal ou na vertical; a mesma tecla destrava.
- F11 alterna, por peça, entre ir na dobra do tecido (o padrão desde o ADR 0172) e seguir com as outras.
- Ctrl+R abre "Mover com referência", que não existia: as peças selecionadas andam uma medida a partir de onde estão, ou vão a uma distância do canto da mesa.
- Ctrl+G dá às peças selecionadas um grupo do encaixe novo; Ctrl+U tira.
- Ctrl+W abre a validação. Ctrl+T mede distâncias, Ctrl+K corta, Ctrl+Shift+T insere texto, Ctrl+P plota e Ctrl+L abre a Biblioteca.

**Limites:** quatro teclas da referência ficam diferentes aqui, porque o programa já as usa: Ctrl+A (aqui selecionar tudo), Ctrl+O (aqui abrir), Ctrl+D (aqui duplicar) e Ctrl+E (aqui exportar PDF). Com Ctrl+←/→ o giro de 90° é leitura minha. Grupo aqui é o grupo do encaixe, que sai junto num trecho da mesa; a referência não explica o dela.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
