# ADR 0064 — Graduação: as quatro pendências que o manual confirma

## Contexto

O ADR 0054 deixou quatro coisas da graduação por fazer. Relido o manual da
referência (v10), as quatro estão lá:

- **Separar um tamanho do molde:** "indique a posição do molde na Área de
  trabalho".
- **Tabela para piques de contorno:** um botão que "copia a graduação do pique
  selecionado" e outro que "cola a graduação copiada no pique indicado".
- **Graduar molde automático:** "gradua os pontos e os piques"; **Graduar
  tangente:** "indicar os pontos de controle ou piques".
- **Criar regra de graduação via molde:** a "tabela de valores DX/DY", que
  "informa os valores que serão copiados e possibilita alterá-los", com botões
  para criar um tamanho acima ou abaixo, definir o base e excluir um tamanho,
  e a opção Incremental.

O manual dá os campos e os passos. Não dá as contas.

## Decisão

### Separar: a posição com o mouse

- A janela ganhou "Indicar com o mouse onde as peças separadas ficam", que vem
  marcada. Confirmada, a ferramenta fica ligada: o desenho mostra os contornos
  das peças novas presos ao mouse, e o clique põe a primeira ali — pelo canto
  de cima à esquerda — e as outras em fila depois dela, a 20 mm.
- Postas as peças, a ferramenta desliga (outro clique não põe outra cópia).
- Desmarcada, é como antes: as peças entram na hora, depois das que já estão
  na mesa.

### Tabela dos piques: Copiar e Colar

- "Copiar" guarda a graduação aplicada no pique (os valores como ficaram nele,
  já com Incremental e Inverter contados).
- Na janela de outro pique, "Colar" aparece quando o que foi copiado serve para
  a peça — os mesmos tamanhos, com o mesmo base — e mostra os valores. Marcada,
  eles valem no lugar dos digitados, contados da referência desse pique.
  "Inverter" ainda vale por cima (o pique do outro lado da peça).

### Automático e Tangente nos piques

- O clique num pique, fora de um ponto do contorno, gradua o pique.
- **O pique só anda sobre o contorno.** Na Tangente, anda a distância pedida,
  no sentido do ponto de número seguinte (invertendo, do anterior). No
  Automático, anda a parte de DX e DY que está na direção da borda onde ele
  está; se não há parte nenhuma (o deslocamento está em esquadro com a borda),
  nada muda, e a mensagem diz.
- "Todos" ou um tamanho só, incremental ou a partir do base: valem como para
  os pontos.
- A distância é contada do **ponto de referência** do pique — o que a tabela
  dele já usa: o que ele tinha, ou o ponto graduado mais perto. A mensagem diz
  qual é.

### Criar regra: a tabela na janela

- A janela traz, além do nome e do código, a tabela do ponto: os tamanhos, o
  base e o DX e o DY de cada tamanho. Tudo pode ser mudado antes de guardar.
- **Criar um tamanho** é acrescentar o nome dele e um valor em DX e em DY, na
  mesma posição; **excluir** é apagar os três; **mudar o base** é trocar o nome
  dele — os valores passam a ser contados do base novo.
- "Incremental": os valores digitados são a diferença para o vizinho do lado
  do base. Repetir o mesmo número dá o mesmo passo a todos os tamanhos (o que,
  na referência, são dois botões).
- A tabela que não fecha é recusada dizendo o que falta, e nada é guardado.

## O que NÃO foi feito

- **A tabela do "Criar regra" é em listas, e não em grade.** Um campo para os
  tamanhos, um para o DX de todos e um para o DY de todos, separados por ponto
  e vírgula. Não há uma célula por tamanho nem os botões de criar e excluir
  linha: faz-se o mesmo editando as listas.
- **No "Separar", o tamanho continua sendo escolhido na janela.** Na
  referência ele é indicado com o mouse, no próprio desenho.
- **Copiar e colar valem para um pique de cada vez**, como no manual.
- **As contas dos piques são leitura nossa:** o manual diz que Automático e
  Tangente graduam piques, e não diz como. Em especial, projetar DX e DY na
  direção da borda é escolha nossa.
- **Ninguém da modelagem olhou. Nada foi comparado com a referência em uso.**

## Verificação

- **Testes:** 1736/1736 em 81 arquivos (eram 1707); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: copiar entrega a graduação
  aplicada, colar só aparece quando serve e vale no lugar dos digitados; o
  pique andando sobre o contorno, em todos os tamanhos e num só, incremental
  e a partir do base, com a referência atrás e adiante; Tangente e Automático
  clicando no pique, com as mensagens; as peças separadas a partir do ponto,
  o clique, a prévia e a instrução do Separar; a tabela do Criar regra aberta
  com os valores do ponto, mudada, com tamanho a mais e a menos, com o base
  trocado, incremental, e as recusas.
- **Mutações:** 32, uma por vez, com o código conferido por hash antes e
  depois: 32 pegas. Ao escrever a lista, três não teriam como ser pegas (o
  clique do Separar sem quem dê os ids; a Tangente a partir do base, que com
  três tamanhos dá o mesmo que a incremental; a referência que o pique já
  tinha, que no teste coincidia com a sugerida): os três casos foram
  acrescentados antes de rodar.
- **Electron real, build de produção**, numa peça de teste com P, M e G:
  - **Copiar e colar:** o pique 1 graduado com −10 / 0 / 10 e copiado; a
    janela do pique 2 oferece "Colar: aplicar a graduação copiada (P: -10; G:
    10)"; colado, o pique 2 fica com os mesmos valores, contados da referência
    dele.
  - **Tangente num pique:** 5 mm por tamanho sobre o contorno (5 / 0 / −5, com
    a referência adiante dele). **Automático:** só com DX, numa borda em que
    quem anda é o DY, nada muda e a faixa explica; com DY 8, o pique anda 8 mm
    por tamanho.
  - **Separar:** confirmada a janela, nada é separado e a faixa pede o clique;
    o desenho mostra os dois contornos presos ao mouse; o clique em (600,
    1000) põe o P com o canto a 2 mm dali e o G 20 mm depois; a ferramenta
    desliga; outro clique não separa de novo; Ctrl+Z tira as duas. Sem a
    opção, as duas entram na hora.
  - **Criar regra:** a janela abre com "P, M, G", "M", "-10; 0; 10" e
    "0; 0; 0"; com um tamanho a mais e um valor a menos no DY, é recusada e
    nada é guardado; completa, a regra fica com 4 tamanhos e o GG andando 25.
  - **17 conferências, 0 falhas.**
- **Moldes reais pela tela**, com o build final e a máquina sem outra carga: o
  roteiro das seis ferramentas (ADR 0059), que gradua e separa um tamanho em
  cada peça, deu 22 e 17 operações feitas, 0 falhas, e a vista não saiu do
  lugar nenhuma vez.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). A
  regra criada pelo roteiro foi para o cadastro do próprio roteiro, e saiu de
  lá no fim.
