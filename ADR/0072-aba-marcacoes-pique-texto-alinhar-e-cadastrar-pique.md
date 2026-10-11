# ADR 0072 — Aba Marcações: Pique texto, Alinhar e Cadastrar pique

## Contexto

Segunda parte da aba Marcações (a primeira é o ADR 0071). Faltavam três
ferramentas de piques e as linhas auxiliares; este ADR faz as três de piques.

O manual da referência diz, de cada uma:

- **Pique texto:** texto no interior do molde "em forma de pique", com Texto,
  Altura, Ângulo e Referência ("a posição do texto em relação ao cursor"). Não
  lista as posições da Referência.
- **Alinhar piques:** "alinha os piques na graduação", nos modos Horizontal,
  Vertical, Elemento, Ponto horizontal e Ponto vertical. Dá os cliques de cada
  modo, não a conta.
- **Manipular piques** (o "Cadastrar pique" da aba): criar um formato pelo
  desenho — indicar os elementos, confirmar, indicar o ponto de referência,
  dar nome e descrição —, alterar e excluir. Só os criados podem ser alterados
  ou excluídos.

## Decisão

### Pique texto

- É o **texto da peça** (o mesmo do "Inserir texto" da Construção), agora com
  dois dados a mais, opcionais: o **ângulo** e a **âncora** — o que fica no
  ponto clicado: o meio, o começo ou o fim do texto. *As três posições são
  leitura nossa.*
- Ângulo: 0° é a horizontal da tela; positivo, no sentido anti-horário.
- Cada clique dentro da peça escreve o texto ali. O traço da prévia mostra por
  onde ele se estende.
- O texto com ângulo **gira com a peça**, e o ângulo troca de sinal na peça
  espelhada. O texto de antes, sem ângulo, continua sempre na horizontal.
- No PDF, o texto com ângulo acompanha a peça (na folha os eixos da tela vêm
  trocados; as letras não são espelhadas).
- **O "Alterar" pega o texto:** a janela dele muda o que está escrito, a
  altura, o ângulo e a âncora. Em branco, apaga.

### Alinhar

- Vale na **peça graduada**. Em cada tamanho, o pique vai para onde a linha de
  alinhamento cruza o contorno desse tamanho — **o cruzamento mais perto de
  onde ele estava**. *Leitura nossa.*
- A linha de cada modo:
  - **Horizontal / Vertical:** a que passa pelo pique no tamanho base;
  - **Elemento:** uma linha interna, que precisa cruzar o contorno de todos os
    tamanhos (o pique do base também vai para ela);
  - **Ponto horizontal / Ponto vertical:** a que passa, em cada tamanho, por
    um ponto do contorno.
- O resultado fica guardado como a graduação do pique: quanto a distância dele
  ao ponto de referência, sobre o contorno, muda em cada tamanho. É o mesmo
  dado da "tabela dos piques" — dá para ver e mudar por lá.
- Se em algum tamanho a linha não cruza o contorno, nada muda, e a mensagem
  diz o tamanho.
- **Cliques:** no pique; no modo Elemento, depois na linha; nos modos de
  ponto, depois no ponto. *No manual, os modos de ponto só falam em indicar o
  ponto; aqui o pique é indicado antes*, para ficar dito qual pique anda.

### Cadastrar pique

- **Criar:** o formato é desenhado com linhas internas na peça, **de pé na
  tela** (a boca embaixo, a ponta para cima). Na janela vai o nome (e a
  descrição). Depois: clique em cada linha, **Enter**, e clique no **ponto de
  referência** — o ponto do desenho que fica na borda da peça. Perto de uma
  ponta de linha, o clique é preso nela.
- O desenho vira a **proporção** do formato; a largura e a altura são dadas em
  cada uso, como nos tipos do programa.
- O cadastro fica **neste computador** (como as regras de graduação). O pique
  posto com um formato cadastrado **leva a forma consigo**: o projeto abre
  igual em outro computador, e o pique continua desenhado mesmo que o formato
  saia do cadastro.
- **Alterar** troca o nome e a descrição; **Excluir** tira do cadastro. Os
  tipos do programa são fixos.
- *No manual o nome é pedido no fim; aqui, antes.*

## O que NÃO foi feito

- **Linhas auxiliares:** no próximo ADR. É o último botão desligado da aba.
- **A forma de um formato cadastrado não se edita:** para mudar o desenho,
  exclui-se e cria-se outro.
- **Formato cadastrado que não é simétrico:** na peça espelhada o ângulo
  troca de sinal, mas o desenho não é espelhado.
- **O texto não é preso a um pique do contorno:** é um texto da peça, com
  posição própria.
- **O "Alinhar" não trata o pique interno**, só o do contorno.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1898/1898 em 87 arquivos (eram 1867); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: o alinhamento em cada modo, com
  as posições conferidas por conta feita à parte, e as recusas; a forma tirada
  do desenho; o texto com ângulo e âncora, girando e espelhando; o cadastro
  (gravar, ler, o que está estragado); as três ferramentas com janela,
  cliques, prévia e instrução; o "Alterar" nos textos; a aba.
- **Mutações:** 32, uma por vez, com o código conferido por hash antes e
  depois. 31 pegas — três delas só depois de ganharem teste. A que restou
  mostrou uma linha sem efeito, que foi retirada.
- **Electron real, peças de teste:**
  - **Pique texto:** "BOLSO" com 20 mm, posto no meio da peça; pelo "Alterar",
    vai a 45°.
  - **Cadastrar pique:** um V desenhado com duas linhas, as duas indicadas,
    Enter, o ponto de referência no meio da boca: o formato vai para o
    cadastro com dois traços, a boca na base e a ponta no alto. Aparece na
    lista do "Inserir"; o pique posto com ele leva o nome e a forma. Excluído
    do cadastro, o pique posto continua desenhado.
  - **Alinhar:** na peça graduada (um canto andando 40 mm por tamanho), o
    pique do meio de uma borda, alinhado na vertical, fica com a mesma
    distância do canto nos três tamanhos.
  - Ctrl+Z devolve as duas peças; o cadastro volta ao que era.
  - **18 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
