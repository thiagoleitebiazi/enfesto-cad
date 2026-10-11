# ADR 0063 — "Remover região" pelos elementos: curva, linha quebrada e vários

## Contexto

O "Cortar" já aceitava como linha de corte uma linha interna que não é reta, e
várias emendadas (ADR 0055). O "Remover região" continuava só com a reta: dois
pontos do contorno, ou uma linha interna reta. Uma região delimitada por uma
curva — um recorte de decote, uma pala — tinha de ser cortada com o "Cortar" e
a parte que sobrava, apagada à mão.

## Decisão

- Sem "Unir moldes", o **clique numa linha interna** da peça (reta, curva,
  arco ou linha quebrada) a indica como elemento; o clique em outra **junta**
  as duas na mesma linha (ponta com ponta, a até 1 mm); o clique num elemento
  já indicado o tira. A linha vai de borda a borda como no "Cortar":
  prolongada em linha reta se para dentro da peça, aparada se passa do
  contorno.
- Com elementos indicados, o **clique fora deles escolhe o lado**: essa região
  sai. Com "Manter região do molde", ela vira uma peça nova.
- Os elementos indicados **saem da peça**: viraram a borda.
- A prévia mostra a linha que os elementos dão e, com o mouse fora deles, a
  região que sai, em destaque. A faixa de mensagens diz quantos elementos
  estão indicados e o que falta.
- A reta por **dois pontos do contorno** continua como era.
- A janela diz que a linha pode ser curva ou de vários elementos.

## O que NÃO foi feito

- **Com "Unir moldes", as duas linhas continuam tendo de ser retas.** A faixa
  entre duas curvas sai deixando duas bordas de formas diferentes: não há como
  encostar uma na outra sem deformar. O "Unir" junta arestas retas.
- **"Dobrar" continua só com a reta.** Uma dobra é reta: não é falta.
- **Um trecho do contorno não entra na linha** (como no "Cortar"): só linhas
  internas.
- **Nada foi comparado com o programa de referência em uso.** O manual dele
  pede "o 1º elemento do molde" e "o 2º elemento do molde", cada um seguido de
  "confirme", e não diz de que tipo é o elemento nem como se escolhe a região.
  Aceitar a curva é a leitura natural de "elemento"; escolher a região com um
  clique do lado, e não com um segundo elemento, **é leitura nossa** (o
  segundo elemento, no nosso, é a segunda reta do "Unir moldes").

## Verificação

- **Testes:** 1707/1707 em 81 arquivos (eram 1696); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: pela linha quebrada, a região
  do lado clicado sai e a que fica fecha pela linha; do outro lado; por
  vários elementos e pelo elemento reto; a linha interna em cima da reta de
  dois pontos sai; as recusas; o clique que indica, junta e tira; o lado; com
  "Manter região"; a prévia; a instrução e a janela.
- **Mutações:** 15, uma por vez, com o código conferido por hash antes e
  depois. 13 pegas de saída. 2 sobreviveram — a linha interna em cima da reta
  de dois pontos, que tem de sair; e a prévia com o mouse em cima de outra
  linha: faltava o caso. Com os testes novos, pegas.
- **Electron real, peça de teste:** duas retas internas emendadas num bico
  (um "V"). Indicadas uma a uma, a faixa conta os elementos; a prévia mostra
  a linha prolongada até as bordas e a região em destaque; o clique dentro do
  "V" tira 371,8 cm², e a peça fecha pelo bico, sem linha interna. Com
  "Manter região", clicando do outro lado, a região vira "TESTE-2 (2)" e as
  duas somam a área de antes. Um elemento só é prolongado em linha reta. A
  reta por dois pontos tira a faixa de 100 mm, como antes. Ctrl+Z em tudo.
  **10 conferências, 0 falhas.**
- **Electron real, moldes reais pela tela** (cópia, fora do repositório): nas
  4 peças de produção, "Remover região" pela linha interna aberta mais
  comprida (13 pontos, 148 a 234 mm), com "Manter região". As duas partes
  somam a área da peça (por exemplo 2016,0 + 1974,0 = 3989,9 cm²), o elemento
  virou borda (uma linha interna a menos) e o Ctrl+Z devolve a peça.
  **20 conferências, 0 falhas.**
  - **O que o molde real mostrou:** o clique do lado a menos de uns 14 mm de
    uma linha interna (no zoom de 71%) é lido como clique na linha — tira o
    elemento, ou junta outro. Num molde cheio de linhas, o lado tem de ser
    clicado num lugar livre, ou com o zoom mais perto. A primeira rodada do
    roteiro clicava a 12 mm e não tirou região nenhuma; clicando num lugar
    livre, tirou nas quatro.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
