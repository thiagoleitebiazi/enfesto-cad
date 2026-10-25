# ADR 0118 — Arrastar o cartão do modelo entre as etapas da coleção

## Contexto

O ADR 0108 deixou em "O que não foi feito": "Os cartões não se arrastam entre as colunas: o 'Avançar →' e o detalhe
do modelo fazem as mudanças." No quadro das etapas, mudar um modelo de coluna pedia abrir o modelo e procurar o botão.
A única exceção era avançar.

Ao conferir o arrasto no programa, com o mouse de verdade, apareceu um erro que já existia no "Avançar →". Sem o nome
do autor no programa e sem o responsável da coleção, a mudança era recusada com "Diga quem muda a etapa (o
responsável)", e o quadro não tinha onde dizer. No quadro, o botão nunca funcionava nesse caso.

## Decisão

**1. As regras do arrasto** (`mudancaPeloQuadro`, no domínio). O arrasto segue as mesmas regras do fluxo, e não move o
cartão livre:
- **para a coluna seguinte:** avança;
- **para a de antes:** volta, e pede o motivo;
- **da Aprovação:** a Produção aprova a piloto (pede a confirmação); a Peça-piloto pede alteração (pede o que
  alterar, e a revisão da piloto sobe);
- **para Cancelado:** cancela, e pede o motivo;
- **do Cancelado:** só a etapa em que o modelo estava, que o reabre;
- **pular etapa, ou a mesma coluna:** nada.

A mudança é feita pelas mesmas funções dos botões (`aplicarMudancaPeloQuadro`), com o histórico, o motivo e a
revisão da piloto.

**2. O arrasto na tela.**
- O cartão segue o mouse, inclinado e com sombra.
- **Enquanto arrasta:**
  - as colunas onde o cartão pode cair ficam com a borda verde tracejada e dizem o que acontece ("Avançar",
    "Voltar (diga o motivo)", "Aprovar a piloto"…);
  - a coluna debaixo do mouse fica verde forte;
  - as que não valem ficam apagadas.
- **Ao soltar:** avançar e reabrir valem na hora. Voltar, cancelar, pedir alteração e aprovar a piloto abrem um quadro
  laranja em cima das colunas, com "Quem decide", o motivo (ou o comentário) e "Confirmar" / "Desistir".
- **O clique:** o fim do arrasto não abre o modelo; um clique no nome continua abrindo.
- **A forma do arrasto:** pelos eventos do ponteiro, não pelo arrasto nativo do navegador. Assim funciona com o mouse e
  com o toque, e o teste de uso consegue arrastar com o mouse de verdade (pelo sistema).
- **Com a coleção só para ver**, o cartão não se arrasta.

**3. Quem muda as etapas.** O quadro ganhou o campo "Quem muda as etapas":
- ele vem com o autor do programa ou o responsável da coleção;
- vazio, o arrasto e o "Avançar →" abrem o quadro de confirmação perguntando "Quem decide", em vez de falhar;
- o nome digitado fica para as mudanças seguintes.

## O que não foi feito

- **Não se arrasta para mudar a ordem** dos cartões dentro da mesma coluna: a ordem é a do mix.
- **Não se arrastam vários cartões de uma vez.**
- **O teclado não arrasta.** Pelo teclado, continuam o "Avançar →" e os botões do detalhe do modelo.

## Conferência

- `domain/colecoes.test.ts` (+3):
  - a coluna seguinte, a de antes, o cancelado, e pular etapa;
  - da aprovação, e do cancelado;
  - a mudança pelas regras dos botões: o motivo pedido e a revisão da piloto.
- `ui/PainelDeColecoes.test.tsx` (+5):
  - avançar arrastando, com as colunas verde, verde forte e apagada, e o rótulo "Avançar";
  - o clique do fim do arrasto não abre o modelo, e o clique de verdade abre;
  - pular etapa não muda nada;
  - da aprovação para a piloto, com o motivo pedido;
  - da aprovação para a produção, com a confirmação e o "Desistir";
  - sem saber quem muda, o "Avançar →" pergunta e depois avança.
- `npx vitest run`: 166 arquivos, 2960 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 83 conferências, nenhuma falha, nenhum aviso no console. Uma é nova: **o mouse
  de verdade, mandado pelo sistema, arrasta o cartão da Criação para a Modelagem.**
  - No meio do arrasto, a Modelagem fica verde com "Avançar" e a Produção apagada.
  - Ao soltar, como o teste não tem autor nem responsável, a janela pergunta quem decide.
  - Com o nome, o modelo vai para a Modelagem.

  Foi esse teste que achou o erro do "Avançar →" sem responsável.
