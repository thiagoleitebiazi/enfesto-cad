# ADR 0204 — O relacionamento simétrico, o manual no programa e a sugestão do enfesto

Sobraram itens menores do manual do encaixe e das páginas da referência: os modos simétricos do relacionamento de piques, as cores dos pacotes, as linhas de referência no padrão da mesa nova, o "Manual Digital" e "O que há de novo" no menu Ajuda, e a sugestão do método de enfesto mais eficiente.

**Decisão:**

- O relacionamento ganha simétrico, nos dois sentidos, na horizontal e na vertical: o ponto cai na fase vista do outro lado do desenho.
- As opções do encaixe ganham as oito cores dos pacotes.
- "Usar como padrão" guarda também as linhas de referência.
- Ajuda › "Manual": o caminho de cada trabalho, em poucas linhas. Ajuda › "O que há de novo".
- A janela do Enfesto sugere o método, pelas regras da prática: o tubo vai como tubo; o tecido de um sentido só não vira a cada camada; peças em par pedem zigue-zague.

**Limites:** o manual da referência só lista os nomes dos modos simétricos: a conta é leitura minha. A sugestão do método não calcula cada um deles, como a referência parece fazer. O manual do programa é um guia curto, não a descrição de cada ferramenta: essa continua nas dicas dos botões.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
