# ADR 0066 — "Separar": o tamanho indicado com o mouse, no desenho

## Contexto

O ADR 0064 deixou em aberto: no "Separar", a posição da peça nova já era
indicada com o mouse, mas o tamanho ainda era escolhido na janela.

O manual da referência descreve a ferramenta em dois passos: usar o mouse
para indicar o tamanho que será separado, e indicar a posição do molde na
área de trabalho.

## Decisão

- A janela do "Separar" vem com **"O que eu indicar com o mouse, no
  desenho"**. Confirmada, a ferramenta fica ligada à espera de um clique na
  linha de um tamanho — as linhas finas, por dentro e por fora do contorno da
  peça graduada.
- **A linha sob o mouse fica em destaque**, antes do clique: é assim que se
  vê qual tamanho o clique vai pegar.
- **Qual linha é a clicada:** a mais perto do clique, entre todas as que
  passam a até o raio do clique (10 px) — a do base inclusive.
  - Sobre a linha do base sozinha: a mensagem diz que o base continua nesta
    peça, e pede a linha de outro tamanho.
  - Onde a linha de outro tamanho passa junto com a do base, é a do outro
    tamanho (o base não se separa).
  - Onde as linhas de dois tamanhos passam juntas (uma borda que não foi
    graduada, por exemplo), o clique não escolhe: a mensagem diz quais são, e
    lembra que o tamanho também pode ser escolhido na janela.
  - A meio caminho, exato, entre duas linhas: a mensagem pede o clique em
    cima de uma delas.
- **Depois do tamanho:** com a posição por indicar, a peça desse tamanho fica
  presa ao mouse (tracejada), a linha dele continua em destaque, a faixa de
  mensagens diz o tamanho indicado, e o clique seguinte põe a peça — em
  qualquer lugar, mesmo em cima de outra linha. Sem a posição por indicar, o
  clique na linha já põe a peça na fila, depois das que estão na mesa.
- **Escolher na janela continua valendo**, como extensão nossa: "Todos" e
  "Só o …". A janela guarda a última escolha; se a peça não tem o tamanho
  guardado, volta ao indicado no desenho.

## O que NÃO foi feito

- **Depois de indicado, o tamanho não se troca com outro clique:** o clique
  seguinte é o da posição. Para indicar outro, Esc e ligar a ferramenta de
  novo.
- **Indicar vários tamanhos com o mouse, um atrás do outro.** O manual fala
  de um tamanho; para todos de uma vez há a escolha na janela.
- **Nada foi comparado com o programa de referência em uso.** O manual dá os
  dois passos; a regra da linha mais perto e as mensagens são leitura nossa.

## Verificação

- **Testes:** 1758/1758 em 81 arquivos (eram 1749); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: a linha mais perto de todas, a
  do base, as linhas juntas, o meio caminho; os dois cliques; a fila sem a
  posição; os cliques que não indicam nada; a prévia nas duas fases; as
  instruções; a janela.
- **Mutações:** 20 de 20 pegas, uma por vez, com o código conferido por hash
  antes e depois.
- **Electron real, peça de teste** (P, M, G; um canto andando 40 mm por
  tamanho):
  - a janela vem com o tamanho indicado no desenho; confirmada, nada é
    separado;
  - clique dentro da peça, na linha do base e onde P e G passam juntas: cada
    um com a sua mensagem, e nenhuma peça nova;
  - clique na linha do G: "tamanho G indicado"; clique em (600, 1000): uma
    peça G de 1280,0 cm², sem graduação, com o canto a 2 mm do clique; a
    ferramenta desliga; Ctrl+Z tira;
  - sem a posição: o clique na linha do P põe a peça P (1120,0 cm²) na fila;
  - "Todos", pela janela: as duas, como antes.
  - **15 conferências, 0 falhas.** O roteiro da graduação do ADR 0064, com o
    "Separar" dele escolhendo "Todos" na janela: 17 conferências, 0 falhas.
- **Moldes reais:** não entram aqui — a mudança é no clique e na janela; a
  conta que faz a peça de cada tamanho é a mesma do ADR 0064.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
