# ADR 0043 — Retas, pontos, Extrair molde e os elementos da aba Manipulação

## Contexto

Quinze ferramentas continuavam desligadas com o motivo "trabalha sobre
elementos de modelagem (linhas soltas), e aqui só existem peças fechadas":

- **Construção:** Por ângulo, Estender reta, Estender até elemento, Estender
  duas retas; pontos Por coordenada, Por interseção, No centro do arco, No
  perímetro e Por distância.
- **Produção:** Extrair molde.
- **Manipulação:** Manipular pontos, Manipulação rápida, Dividir elementos,
  Transformar em elementos e Copiar ou trocar elemento.

Na referência, elas criam e mexem em elementos soltos (retas e pontos), que
depois viram moldes. O pedido foi fazê-las funcionar.

## Decisão

### Os elementos são da peça

Não foi criada uma camada de elementos soltos. **As retas são as linhas
internas da peça selecionada, e os pontos são as marcas dela.**

- Já são desenhados, salvos e desfeitos com a peça, e já andam, giram e
  espelham com ela.
- As dicas e os diálogos dizem "linha interna" e "ponto (marca)", para ficar
  claro onde o elemento vai parar.

### Ferramentas de retas

- **Por ângulo:** o diálogo pede o ângulo e o comprimento; um clique marca o
  começo. O ângulo é o da tela: 0° aponta para a direita e 90° para cima. Um
  clique junto do contorno começa bem em cima dele.
- **Estender reta:** a ponta clicada de uma linha interna cresce a medida
  digitada, na direção em que a linha já ia.
- **Estender até elemento:** a ponta cresce até o primeiro elemento que
  encontra — o contorno, um furo ou outra linha interna.
- **Estender duas retas:** as pontas clicadas de duas linhas vão para o ponto
  em que as duas retas se encontram.

### Ferramentas de pontos

- **Por coordenada:** o diálogo pede X e Y, as mesmas coordenadas da barra de
  status; a marca entra ao confirmar.
- **Por interseção:** dois cliques em dois elementos (arestas do contorno ou
  linhas internas); a marca fica onde as retas deles se encontram.
- **No centro do arco:** um clique sobre um arco do contorno (ADR 0042).
- **No perímetro:** a marca fica sobre o contorno, à distância digitada do
  ponto clicado. Negativa, anda contra a numeração dos pontos.
- **Por distância:** a marca fica à distância digitada do primeiro ponto
  clicado, na direção do segundo.

### Extrair molde

- Um clique dentro da peça escolhe a **região delimitada pelo contorno e
  pelas linhas internas**, e ela vira uma peça nova. A prévia mostra a região
  antes do clique.
- Cada linha que atravessa a região de borda a borda a divide, e fica o lado
  do clique. Vale o pedaço da linha que está dentro da região, então linhas
  que se cruzam formam os quatro cantos.
- Um laço fechado é uma região: o que está dentro dele.
- A peça nova leva os furos, as linhas internas e as marcas que estão inteiros
  dentro dela, e os piques das bordas que herdou. Vai para depois das peças
  que já estão na mesa. A peça de origem não muda.
- Sem linha que delimite nada, a ferramenta explica como desenhar a divisa.

### Elementos da aba Manipulação

- **Manipular pontos:** clique numa marca e, depois, onde ela deve ficar.
- **Manipulação rápida:** clique numa linha interna ou numa marca e, depois,
  onde ela deve ficar (ela anda o que o mouse andou). Com o elemento
  escolhido, **Delete apaga-o** — é o jeito de apagar uma linha interna.
- **Dividir elementos:** a linha interna clicada vira duas, no ponto clicado.
- **Transformar em elementos:** o contorno de outra peça entra na peça
  selecionada como linha interna fechada, no lugar em que está (a marcação de
  um bolso, por exemplo). Essa linha delimita uma região que pode ser
  extraída.
- **Copiar ou trocar elemento:** uma linha interna ou uma marca de outra peça
  entra na peça selecionada. Trocando, ela sai da peça de origem.

Todas mostram a prévia, dizem o que fizeram na faixa de mensagens e são um
passo de desfazer.

## O que NÃO foi feito

- **Elementos soltos, fora de qualquer peça:** uma reta ou um ponto sempre
  pertence a uma peça.
- **Desenhar o molde só com elementos e depois extraí-lo:** para um molde
  novo, o caminho continua sendo Reta, Retângulo ou Criar molde.
- **Tipos de linha** (auxiliar, de corte, tracejada): todas as linhas internas
  são iguais.
- **Regiões delimitadas por linhas que não chegam à borda** nem a outra
  divisa: é preciso estendê-las.
- **Conferência com a referência:** não houve como comparar o resultado com o
  programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 1103/1103 em 60 arquivos (eram 1049 em 58).
  - Novos: geometria dos elementos 27, cliques, diálogos e prévia 24, fita 3.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático**, conferido no arquivo salvo. Peça de 400 × 300 mm:
  - Por ângulo a 0° com 100 mm, a partir do contorno: a linha salva foi de
    (201, 0) a (201, 100). Estender até elemento levou-a a (201, 300).
  - Outra reta a 90°, de 50 mm, estendida 20 mm: ficou com 70 mm.
  - Por interseção das duas: a marca ficou em (201; 148,1), o x de uma e o y
    da outra.
  - Por coordenada (100, 100), No perímetro a 50 mm do canto e Por distância a
    100 mm na direção do canto oposto: marcas em (100, 100), (50, 0) e
    (80, 60).
  - Extrair molde: a região de um lado da linha virou a peça "TESTE-1 (2)",
    com 602,9 cm² (a linha estava em x = 201), posta depois das outras, com a
    validação sem problemas.
  - Dividir elementos: 2 linhas viraram 3, com o corte no ponto clicado.
  - Manipular pontos moveu a marca. Manipulação rápida com Delete apagou a
    linha, e as peças continuaram as mesmas.
  - Transformar em elementos: o contorno da outra peça entrou como linha
    fechada de 5 pontos. Copiar elemento levou uma linha para a outra peça, e
    a de origem continuou com ela.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
