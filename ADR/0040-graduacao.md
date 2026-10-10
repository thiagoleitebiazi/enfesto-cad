# ADR 0040 — Graduação

## Contexto

Quinta e última etapa do pedido do ADR 0036: as 14 ferramentas da aba
Graduação, que o ADR 0035 tinha deixado desligadas com a nota "este programa
não faz graduação: cada tamanho entra como uma peça própria".

O manual da referência descreve:

- **Graduar via tabela:** número do ponto, tamanho, DX, DY, incremental,
  aplicar, copiar e colar.
- **Graduar automático:** diferença de DX e de DY.
- **Graduar via mouse:** incremental, absoluto ou proporcional.
- **Graduar com regras** e **criar regra via molde** (nome e tabela).
- **Graduar tangente:** distância, inverter sentido, usar contorno base.
- **Ajustar graduação:** apenas DX ou apenas DY.
- **Separar um tamanho** e **unir tamanhos**.
- **Copiar graduação:** um ponto, vários ou todos; apenas DX ou DY; inverter.
- **Agrupar ou desagrupar**, **adicionar ou remover ponto de curva graduado**
  e **apagar graduação** (apenas DX, apenas DY, todo o molde).
- **Deduzir** e **Graduar curva** não aparecem com esses nomes.

O manual dá os campos de cada ferramenta, mas não a construção de várias
delas.

## Decisão

### O modelo

- **A peça desenhada é o tamanho base.** A graduação (`Molde.graduacao`)
  guarda a lista de tamanhos, qual é o base e os **pontos graduados**: para
  cada um, o deslocamento em cada tamanho, em mm, a partir do base.
- **Só alguns pontos são graduados**, em geral os cantos. Os outros (os de uma
  curva, por exemplo) são **proporcionais**: cada um fica entre os dois pontos
  graduados vizinhos, pela distância andada sobre o contorno.
- Ao definir os tamanhos, os cantos do contorno (onde a direção muda mais de
  20°) entram como pontos graduados, sem deslocamento.
- **O ponto graduado é guardado pela posição, não pelo número.** Inserir,
  tirar ou arredondar pontos em outro lugar da peça não troca a regra de
  ninguém. O ponto graduado que deixa de coincidir com um ponto do contorno
  não conta.
- **A graduação acompanha a peça:** mover, girar, espelhar e dimensionar levam
  posições e regras; mover um ponto leva a regra dele; desdobrar espelha os
  pontos graduados; pences por pivô, transferências e pregas levam os do lado
  que anda.
- **O encaixe, a validação e a exportação continuam usando só o contorno
  base.** Para encaixar os outros tamanhos, "Separar" cria as peças.
- O desenho mostra os outros tamanhos em linha fina, em volta do base.

### DX e DY

São os da tela, como no diálogo "Modificar": **DX** é a horizontal (+ para a
direita) e **DY** é a vertical (+ para baixo).

### Ferramentas

- **Tabela:** abre pelos tamanhos (a lista, do menor ao maior, e o base).
  Depois, um clique num ponto do contorno abre a tabela dele: DX e DY em cada
  tamanho.
  - "Incremental" mostra e aceita a diferença para o tamanho vizinho.
  - "Copiar" guarda a regra para "Colar" na tabela de outro ponto.
  - Mudando a lista de tamanhos, as regras dos que continuam ficam, e um
    tamanho novo entra igual ao base. Trocando o base, o contorno desenhado
    passa a ser o desse tamanho.
- **Automático:** os pontos clicados andam a mesma diferença de DX e de DY de
  um tamanho para o seguinte.
- **Mouse:** um clique no ponto e outro onde ele deve ficar. No modo
  absoluto, o segundo clique é o tamanho da ponta (o maior), e os outros vão
  por passos iguais; no incremental, é o tamanho seguinte ao base. O desenho
  mostra o tamanho da ponta enquanto o mouse anda.
- **Tangente:** os pontos clicados andam uma distância por tamanho na direção
  da aresta que sai deles, ou da que chega, invertendo.
- **Criar regra** e **Regras:** a graduação de um ponto fica guardada com um
  nome, no cadastro deste computador, e pode ser aplicada a outros pontos e a
  outras peças. Vale pelo nome de cada tamanho.
- **Remover graduação:** apaga DX, DY ou os dois dos pontos clicados, que
  ficam parados. Do molde inteiro, com DX e DY, a peça deixa de ser graduada.
- **Separar:** cria uma peça própria para um tamanho, ou para todos, sem
  graduação. As peças novas ficam em fila depois das que já estão na mesa.
- **Unir:** a peça selecionada vira a graduada, e as marcadas na lista viram
  os outros tamanhos dela.
  - As peças precisam dos mesmos pontos, na mesma ordem, e de um tamanho
    diferente cada uma (o das propriedades).
  - São comparadas com o início da linha de fio de cada uma no mesmo lugar.
  - Os tamanhos ficam em ordem de área, e todos os pontos ficam graduados.
- **Agrupar:** os pontos clicados recebem a regra do primeiro e passam a ser
  graduados juntos. Um clique num ponto do grupo tira-o dele.
- **Copiar graduação:** leva a regra de um ponto para os clicados, ou para
  todos os graduados: DX, DY ou os dois, com o sinal invertido se pedido.
- **Ajustar:** soma um acréscimo de DX e de DY por tamanho à regra que os
  pontos clicados já têm.
- **Deduzir:** desconta de todos os pontos a graduação do ponto clicado. Ele
  passa a ser o ponto fixo, onde os tamanhos ficam empilhados; a forma de cada
  tamanho não muda.
- **Graduar curva:** torna graduado um ponto proporcional, com a regra que ele
  tinha na proporção, ou devolve um ponto graduado à proporção.

Com uma ferramenta ligada, um anel marca cada ponto graduado. Cada aplicação é
um passo de desfazer, e a faixa de mensagens diz o que mudou.

### Leitura natural

Onde o manual não dá a construção, vale a leitura natural, dita na tela:

- **Deduzir** e **Graduar curva** não estão no manual com esses nomes. A dica
  dos dois botões diz isso.
- **Ajustar:** o manual só traz "apenas DX" e "apenas DY". A nota do diálogo
  diz que somar um acréscimo é a leitura natural.
- **Mouse, modo proporcional:** não existe aqui, e a nota do diálogo diz por
  quê: os pontos de curva já andam sempre na proporção.

### Organização

- `domain/graduacao.ts`: o modelo e as contas sobre regras e pontos.
- `domain/tamanhosGraduados.ts`: definir os tamanhos, separar e unir.
- `ui/ferramentasDeGraduacao.ts`: diálogos, cliques, prévia e mensagens das
  14 ferramentas. `ui/regrasDeGraduacao.ts`: o cadastro de regras.
  `ui/tabelaDeGraduacao.ts`: tela e mundo, absoluto e incremental.
- `ui/PainelDeTabelaDeGraduacao.tsx` e `ui/PainelDeRegras.tsx`.
- A fita chama as 14 por uma ação só (`onUsarFerramentaDeGraduacao`).

## O que NÃO foi feito

- **Graduar furos, linhas internas, marcas e linha de fio:** a graduação é só
  do contorno. Na peça separada, eles ficam como no base, e os piques
  acompanham as arestas na mesma proporção.
- **Encaixar os tamanhos direto da peça graduada:** é preciso separar.
- **Conjuntos de regras** e **código de mesa** da referência.
- **"Ajustar curvas" ao unir:** todos os pontos ficam graduados, com o
  deslocamento exato de cada tamanho.
- **Reconhecer os pontos correspondentes ao unir** quando as peças têm
  quantidades de pontos diferentes: é recusado, com a explicação.
- **Mostrar o nome de cada tamanho no desenho**, e cores por tamanho.
- **Editar a regra arrastando** o ponto de um tamanho que não seja a ponta.
- **Recalcular por distância ao trocar o base:** os pontos proporcionais
  passam a ser medidos sobre o contorno novo, o que pode mudar um pouco a
  posição deles nos outros tamanhos.
- **Conferência com a referência:** não houve como comparar o resultado com o
  programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 995/995 em 55 arquivos (eram 832 em 50).
  - Novos: modelo da graduação 41, tamanhos (definir, separar, unir e
    acompanhar as edições) 25, cliques, diálogos e mensagens 48, cadastro de
    regras e tabela 13, os dois painéis 18, fita 18.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - Seis mutações, uma por vez, todas pegas pelos testes e desfeitas.
- **Roteiro automático, janela de 1440 × 900 visível**, conferido no arquivo
  salvo do projeto. Peça de 400 × 300 mm:
  - Sem tamanhos, só a Tabela estava ligada, e as outras diziam o que falta.
  - Tamanhos P, M, G, GG com o M de base: 4 pontos graduados (os cantos), e o
    tamanho da peça passou a ser M. Um tamanho só foi recusado.
  - Tabela de um canto, com DX 10 e DY 20 no G e o dobro no GG: a regra salva
    foi (20, 10) e (40, 20) em mm do mundo, com os eixos da tela convertidos.
    "Incremental" mostrou 10 e 20 no GG. Um valor que não é número foi
    recusado, dizendo o campo.
  - Copiar e Colar levaram a mesma regra para outro canto; Ctrl+Z desfez.
  - Automático com DX 5: −5, 0, 5 e 10 nos quatro tamanhos. Um clique fora de
    um ponto só avisou.
  - Mouse, Tangente, Ajustar, Copiar com DX invertido, Agrupar (a tabela de um
    ponto do grupo mudou os dois), Deduzir, Graduar curva e Remover só o DX:
    cada regra salva conferiu com a conta.
  - Criar regra e Regras: a regra ficou no cadastro e foi aplicada a outro
    ponto com os mesmos números.
  - Separar todos: 3 peças novas (P, G e GG), em fila depois das peças que já
    estavam, com a validação sem problemas. A área do G separado foi igual à
    do G da graduação.
  - Remover do molde inteiro e Unir as três de volta: a peça voltou a ser
    graduada em P, M, G, GG, e o G dela ficou a 1,4 × 10⁻¹⁴ mm do G de antes
    de separar.
  - Sem peça selecionada, todos os botões ficaram desligados.
  - Os diálogos, a tabela, os tamanhos no desenho e as peças separadas foram
    conferidos nas imagens da tela.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
