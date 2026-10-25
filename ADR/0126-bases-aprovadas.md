# ADR 0126 — A biblioteca de bases aprovadas

## Contexto

A segunda rodada do estudo lista, da referência: "a biblioteca de modelos base, para criar modelos novos reaproveitando
moldes aprovados". O modelista não desenha cada modelo do zero. Ele parte da base da empresa (a camisa, a calça, o
vestido), já provada e graduada, e muda o que o modelo pede.

Até aqui o Enfesto CAD tinha o "Duplicar" da Biblioteca e as Variantes (ADR 0050). Os dois copiam um projeto, mas nada
diz quais projetos são bases. Quem procura uma base olha a lista inteira. O modelo copiado não guarda de onde veio.
Para trazer a manga de uma base para o corpo de outra, era preciso copiar e colar entre projetos abertos.

## Decisão

**1. A base é um projeto da biblioteca marcado como aprovado** (`Projeto.base`, em `domain/basesAprovadas.ts`).
- **Na marca:** quem aprovou (digitado, como nas revisões do molde: o programa não tem login), quando, e uma nota do
  que a base é ("camisa social, tabela 2026").
- **A aprovação** pede quem aprova, e um projeto com peças.
- **"Tirar das bases"** desfaz a marca. Os modelos feitos dela continuam dizendo de onde vieram.
- **O projeto aberto, aprovado como base,** entra com as peças da tela: o que mudou desde o último salvamento é
  salvo junto. Assim, aprovar aprova o molde que se vê.

**2. Na Biblioteca:**
- **Como a base aparece:** um selo verde "Base aprovada", uma faixa verde à esquerda da linha, e a linha de quem
  aprovou.
- **O filtro** "Só as bases aprovadas".
- **Os botões de cada base:**
  - **"Novo modelo desta base"**: pede o nome e sugere "‹base› — modelo novo";
  - **"Pôr as peças no aberto"**: não aparece na própria base aberta.

**3. O modelo novo** (`modeloDaBase`) é um projeto novo e à parte. A base não muda.
- **O que vem da base:** as peças, o tecido e a mesa, e o que vale para o modelo todo: as regras de caimento, o tecido
  da recomendação de tamanho e a montagem do provador 3D.
- **O que fica na base:** a ficha técnica, as imagens, os planos, as revisões e o histórico.
- **De onde veio:** o modelo guarda o nome, o código e a revisão do molde da base (quando as peças eram as de uma
  revisão registrada). A Biblioteca o mostra ("Feito da base “Camisa base” (ENF-…), revisão 2 do molde"), e o primeiro
  evento do histórico também.
- **Ao criar o modelo,** o projeto aberto é salvo antes, se mudou, como ao trocar de projeto. O modelo abre na hora.

**4. O "Novo projeto" oferece as bases:**
- "Começar de": uma mesa vazia, ou cada base, com o código, o número de peças e a nota;
- com uma base escolhida, os campos da mesa e do tecido saem (vêm da base), o botão vira "Criar da base", e o nome
  ainda não escrito vira "‹base› — modelo novo".

**5. As peças de uma base no projeto aberto** (`pecasDaBase`): a manga de uma base no corpo de outra.
- **Como entram:** cópias com ids novos, à direita das peças do projeto, alinhadas pelo alto. Ficam marcadas, a vista
  se ajusta a elas, e a faixa de mensagens diz quais entraram.
- **Ctrl+Z** desfaz.

## O que não foi feito

- **A base que muda depois:** o modelo não é avisado. Ele diz de que revisão veio, e a base pode registrar revisões
  novas, mas o modelo não recebe as mudanças sozinho. Seria a herança de um molde em outro, e ela pede decidir o que
  acontece com o que o modelo já mudou.
- **Escolher só algumas peças da base** para pôr no aberto: entram todas, e as que sobram são apagadas no projeto.
- **A aprovação com mais de uma pessoa** (fluxo de aprovação): uma pessoa aprova e o nome dela fica.

## Conferência

- `domain/basesAprovadas.test.ts` (4):
  - **aprovar:** quem aprova e a nota ficam; sem quem aprova, ou sem peças, não; tirar das bases;
  - **as bases para escolher:** só as aprovadas e não arquivadas, pelo nome;
  - **o modelo:** as peças e as regras vêm, a revisão é dita, a ficha e as revisões ficam na base; sem base, ou sem
    nome, não;
  - **as peças no aberto:** ids novos, 40 mm à direita das que estão; no projeto vazio, onde estavam.
- `ui/PainelDeBiblioteca.test.tsx` (5 novos):
  - o selo, a faixa e quem aprovou; o modelo diz a base;
  - o filtro das bases;
  - o erro de quem aprova na linha, e Enter aprova;
  - os botões da base;
  - a base aberta não oferece pôr as peças nela mesma.
- `ui/PainelDeNovoProjeto.test.tsx` (2 novos):
  - sem bases, nada muda;
  - com a base escolhida: os campos saem, o nome sugerido, o erro, o "Criar da base", e a volta à mesa vazia.
- `npx vitest run`: 169 arquivos, 3012 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 99 conferências, nenhuma falha, nenhum aviso no console. As seis novas:
  - a Biblioteca abre;
  - o projeto aberto, aprovado como base, aparece com o selo, quem aprovou e a nota;
  - o modelo novo abre com as 6 peças da base (os contornos iguais), diz de que base veio e não é base;
  - o "Novo projeto" oferece a mesa vazia e a base;
  - as 6 peças da base entram no modelo à direita das 6 dele, com ids novos;
  - o Desfazer as tira.
