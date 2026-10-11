# ADR 0081 — A validação sem os três limites: tirar só o de fora, a linha que passa pouco da borda, e a fundura exata

## Contexto

O ADR 0080 deixou escrito, em "O que NÃO foi feito", três limites da
validação, e o pedido foi corrigi-los:

- "A linha que sai da peça não é aparada na borda: o 'Tirar' tira a linha
  toda, e não há um 'tirar só a parte de fora'."
- "A linha que passa menos de 100 mm para fora não é apontada, mesmo que não
  seja do molde."
- "A fundura é medida em pontos da borda, e não por área: uma entrada entre
  0,05 e uns 0,1 mm pode sair como 'encostadas' ou como 'se sobrepõem',
  conforme a forma."

Este ADR substitui, no 0080, o que ele diz da linha solta, da linha que sai e
do "Tirar".

## Decisão

### Uma conta exata da distância à borda

- O núcleo ganhou `trechosLongeDaBorda`: dado um segmento, um contorno e um
  raio, devolve os trechos do segmento que ficam **a mais do raio da borda**.
- É conta fechada, e não amostragem: em volta de cada lado do contorno há uma
  faixa (um retângulo ao longo dele e um disco em cada ponta); a reta do
  segmento atravessa cada faixa num trecho só; os vãos entre as faixas são os
  trechos longe da borda.
- Cada vão está inteiro de um lado só da borda — dentro ou fora —, porque não
  chega perto dela. Basta olhar o meio dele para saber de que lado.
- As duas contas abaixo saem daqui.

### A fundura da sobreposição, exata

- "A borda de uma peça entra na outra mais de 0,05 mm" passou a ser decidido
  por essa conta: algum trecho da borda de uma está dentro da outra, a mais
  de 0,05 mm da borda dela.
- Não depende mais de onde caíam os pontos de amostra: a 0,049 mm é encostar
  e a 0,051 mm é sobrepor, seja um lado inteiro, um bico ou um canto cortado
  de viés.
- O caso da mesma peça duas vezes no mesmo lugar continua como estava (um
  ponto bem de dentro de uma, dentro da outra).

### Fora da peça, dentro da peça e na borda

- A **borda da peça** é a linha de corte: o contorno, ou o contorno mais a
  margem de costura. A linha que fica na faixa da costura está na peça.
- A folga é de **1 mm** (era de 100 mm para a linha que sai, pela caixa do
  contorno, e de 10 mm para a solta). É o que sobra de um traço que acaba na
  borda. É uma tolerância da validação (`folgaForaDaPecaMm`).
- **Fora** é a mais de 1 mm para lá da borda; **dentro**, a mais de 1 mm para
  cá. O que fica entre uma coisa e outra está na borda.
- A linha é apontada quando tem trecho fora:
  - **sai da peça** a que tem também parte dentro;
  - **está fora da peça** a que não tem parte nenhuma dentro — a que está
    inteira do lado de fora, e também a que corre pela borda e sai.
- O aviso diz até onde a linha vai, para fora da borda: é a maior distância
  de um ponto dela à borda, achada com precisão de um centésimo — o ponto
  mais afastado pode não ser uma ponta da linha. Abaixo de 10 mm, a distância
  sai com uma casa.
- Na peça graduada, a conta é no tamanho base.

### Os botões

- O aviso da linha que **sai da peça** tem dois botões:
  - **Tirar só o de fora**: corta a linha na borda e tira o trecho de fora; o
    que está dentro fica.
  - **Tirar a linha**: tira a linha inteira.
- O aviso da linha que **está fora da peça** tem um: **Tirar**. Não há o que
  guardar dela.
- Cada botão é um passo do Ctrl+Z.

### O que o "Tirar só o de fora" corta

- Sai cada **trecho de fora** — da saída pela borda até a volta, ou até o fim
  da linha — em que algum ponto vai a mais de 1 mm. O trecho sai inteiro,
  inclusive a parte dele que corre junto da borda.
- O trecho de fora que **não passa de 1 mm** não é mexido.
- O que fica são as partes de dentro, **uma linha para cada parte**, no lugar
  da linha antiga. A linha que sai e volta fica em duas.
- O cruzamento com a borda só vira ponto onde a linha foi cortada.
- A parte que sobraria **só em cima da borda**, solta do resto, sai junto: não
  é coisa de dentro da peça.
- Na **linha fechada**, a parte que passa pelo ponto em que ela fechava fica
  numa linha só.
- A linha **só de construção** continua de construção, e as partes dela
  também.

### No projeto real

- A moldura da peça real (ADR 0080) tem dois lados **em cima da borda** da
  peça — medidos, ficam de 0 a 0,025 mm dela — e o resto longe. Cortada na
  borda, sobraria dela um traço colado no contorno.
- Por isso ela é apontada como linha que **está fora da peça**, com o
  "Tirar".

A validação é deste programa: não há ferramenta da referência a que comparar.

## O que NÃO foi feito

- **A folga de 1 mm não tem campo na tela.** É uma tolerância da validação,
  com o valor padrão; a linha que passa menos de 1 mm da borda não é
  apontada.
- **As linhas da metade guardada pela dobra** (a que o "Desdobrar" traz de
  volta) não são conferidas.
- **A primeira validação de um projeto grande demora um pouco mais:** na cópia
  do maior projeto real (4 peças de 445 a 829 pontos, 102 linhas), a conta
  das linhas levou cerca de 0,1 s. Ela fica guardada por peça: depois, só a
  peça que mudou é refeita.
- **O "Tirar só o de fora" não foi usado numa peça real pela tela:** nos
  projetos reais não há linha que saia da peça tendo parte dentro (medido: as
  outras 101 linhas ficam inteiras dentro das peças delas). Ele foi conferido
  pela tela nas peças de teste.
- **Os outros problemas dos projetos reais continuam como estão:** a validação
  os diz, e arrumar a posição das peças é de quem fez o projeto.

## Verificação

- **Testes:** 2047/2047 em 93 arquivos (eram 2018); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: o cruzamento de dois segmentos
  e os trechos longe da borda, com os valores exatos; a fundura a 0,049 e a
  0,051 mm em três formas; as linhas que saem por pouco, pelo vão, pela borda
  e com margem de costura; o que o "tirar só o de fora" deixa em cada caso,
  inclusive nas linhas fechadas e nas de construção; a distância no ponto
  mais afastado; as frases e a tolerância da validação.
- **Mutações:** 87, uma por vez, com o código conferido por hash antes e
  depois. Na primeira rodada uma sobreviveu: a do cruzamento bem na ponta do
  segmento, porque o teste comparava por aproximação e um `null` passava por
  0. O teste passou a comparar o valor exato, e ela foi pega. Todas pegas.
- **Electron real, peças de teste:**
  - uma linha que passa 38 mm da borda (antes não era apontada): aviso com os
    dois botões; "Tirar só o de fora" a deixa acabando na borda; Ctrl+Z a
    devolve; "Tirar a linha" a tira; Ctrl+Z a devolve;
  - uma linha de dentro, uma que sai 258 mm e uma fora: dois avisos, o da que
    sai com dois botões e o da de fora com um; "Tirar só o de fora" corta a
    primeira na borda e não mexe nas outras; "Tirar" tira a de fora; dois
    Ctrl+Z devolvem as duas;
  - o corte sem costura continua "encostadas"; com costura, "se sobrepõem".
  - **28 conferências, 0 falhas.**
- **Electron real, projetos reais (cópias), pela tela:**
  - num, a moldura sai como "está fora da peça, até 1361 mm da borda", com o
    "Tirar"; o botão levou a peça de 26 para 25 linhas, com o contorno, os
    piques, as marcas e o fio iguais; Ctrl+Z devolveu a peça igual;
  - no outro, nada mudou: os três pares abaixo da distância mínima;
  - **8 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
