# ADR 0073 — Aba Marcações: Linhas auxiliares (Inserir ou remover)

## Contexto

Terceira e última parte da aba Marcações (as outras são os ADR 0071 e 0072).
Faltava o botão "Inserir ou remover", do grupo Linhas auxiliares.

O manual da referência diz, de "Adicionar ou remover linhas auxiliares do
molde":

- **Ação:** *Adicionar* — o elemento indicado passa a ser uma linha auxiliar,
  das "que irão fazer parte do molde"; *Remover* — a linha auxiliar volta a ser
  elemento.
- **Modo:** *Automático* ou *Manual*; no manual, uma mensagem confirma que
  todos os elementos foram selecionados.
- Passos: indicar o molde, indicar o elemento (ou a linha), confirmar.
- A janela de informações do molde lista "Linha aux. (cm)".

Não diz o que "fazer parte do molde" muda na prática, nem a diferença exata
entre os dois modos.

Neste programa, até aqui, toda linha interna da peça saía no PDF.

## Decisão

### Os dois tipos de linha interna

- **Linha auxiliar:** faz parte do molde. Sai no PDF com ele.
- **Elemento:** só de construção. Continua na tela, **clara e pontilhada**, e
  serve às ferramentas que pedem um elemento (cortar, dobrar, alinhar,
  múltiplos piques…), mas **não sai no PDF** — nem no dos moldes, nem no do
  encaixe.

### O ponto de partida é o contrário do da referência

- Aqui **toda linha interna nasce fazendo parte do molde**. É o "Remover" que
  a deixa só de construção, e o "Adicionar" que a traz de volta.
- Na referência, o elemento desenhado só passa a ser do molde com o
  "Adicionar".
- Motivo: os projetos já feitos e as outras ferramentas continuam como eram —
  nenhuma linha some do PDF sem alguém pedir.
- *Leitura nossa*, dita na nota da janela.

### A ferramenta

- **Janela:** Ação (Adicionar / Remover) e Modo (Automático / Manual). Abre
  com o que foi escolhido da última vez.
- **Automático:** cada clique numa linha já a converte.
- **Manual:** os cliques indicam as linhas (o clique numa já indicada a tira
  da lista) e o **Enter** converte todas. *A leitura dos dois modos é nossa.*
- Só muda a linha que ainda não está no estado pedido. A mensagem conta
  quantas mudaram. Sem nenhuma a mudar, nada muda, e a mensagem diz por quê.
- A prévia destaca a linha sob o mouse e as já indicadas. Ctrl+Z desfaz.

### O registro

- A peça guarda os elementos **pelos pontos de cada linha**, num sentido ou no
  outro. Peça sem elemento não tem o registro: os projetos antigos abrem como
  eram.
- O elemento **continua elemento** quando:
  - a peça é movida, girada, espelhada ou dimensionada;
  - a peça é graduada (em cada tamanho);
  - uma parte da peça anda (pence, prega);
  - a cerca leva pontos dele;
  - ele é movido, esticado ou dividido pelas ferramentas de elementos;
  - a peça é cortada, dobrada (com a metade guardada), desdobrada ou unida a
    outra. Na desdobrada pelo espelho, a cópia do elemento também é elemento.
- A linha refeita por outro caminho deixa de casar com o registro e **volta a
  ser linha do molde**. É o lado seguro: ela sai no PDF.
- Toda linha **nova** nasce fazendo parte do molde, mesmo a tirada de um
  elemento (paralela, cópia para outra peça).

### Informações dos moldes

- A tabela ganhou a coluna **"Linhas aux. (mm)"**: a soma das linhas internas
  que fazem parte do molde, sem os elementos.

## O que NÃO foi feito

- **As ferramentas não distinguem os dois tipos:** a que pede um elemento
  aceita também a linha auxiliar. O manual não diz se na referência é assim.
- **O PDF não leva os elementos:** reimportado, o molde vem sem eles.
- **O pontilhado da tela não tem teste de unidade:** foi conferido no programa
  aberto, medindo o traço.
- **A saída do PDF não foi conferida pela tela** (depende da janela de salvar
  do sistema): o conteúdo do PDF é conferido nos testes.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1927/1927 em 88 arquivos (eram 1898 em 87); tipos e lint limpos
  (o aviso antigo do `useMemo` continua). Novos: o registro (pôr, tirar, os
  dois sentidos, a limpeza), o que leva o elemento junto em cada transformação
  da lista acima, a ferramenta (janela, cliques, Enter, prévia, instrução), a
  aba, o PDF sem os elementos, a coluna do painel.
- **Mutações:** 51, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas.
- **Electron real, peças de teste:**
  - duas linhas desenhadas: as duas cheias na tela, e o painel soma as duas;
  - "Remover" no automático: a linha clicada vira elemento, aparece
    pontilhada, e o painel deixa de contá-la; o clique repetido avisa;
  - "Adicionar" no manual, com as duas indicadas: o Enter traz de volta só a
    que era elemento; o Enter sem o que converter avisa;
  - "Remover" no manual: as duas de uma vez;
  - a peça girada continua com os dois elementos;
  - Ctrl+Z devolve a peça.
  - **24 conferências, 0 falhas.**
- **A aba inteira nos moldes reais** (cópias de dois projetos, oito peças, pela
  tela — a passada que o ADR 0071 deixou para o fim da aba). Em cada peça: um
  pique posto, três de uma vez, o pique alterado, um texto, uma linha interna
  tornada elemento e devolvida, os piques substituídos, um removido com o
  clique, todos removidos pela janela, e tudo desfeito com Ctrl+Z, com a peça
  conferida no arquivo salvo contra a que foi aberta.
  - Primeiro projeto: **58 conferências, 0 falhas.**
  - Segundo projeto: **58 conferências, 0 falhas.**
  - As peças do primeiro projeto não têm linha interna: o roteiro desenhou uma
    em cada, para as Linhas auxiliares.
  - Na primeira rodada do segundo projeto, uma conferência falhou por erro do
    roteiro, não do programa: ele escolheu clicar numa linha interna solta, a
    mais de um metro da peça, fora do enquadramento. Passou a escolher só
    pontos de dentro da peça, e a rodada inteira foi repetida.
  - **Achado nos dados:** uma das peças reais tem essa linha interna solta,
    longe do contorno. Nada foi mexido nela.
  - Ficaram fora desta passada o **Alinhar** (as peças reais não estão
    graduadas) e o **Cadastrar pique** (o cadastro não depende da peça).
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
