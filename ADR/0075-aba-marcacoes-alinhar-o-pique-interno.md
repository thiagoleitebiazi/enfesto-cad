# ADR 0075 — Aba Marcações: o "Alinhar" no pique interno

## Contexto

O ADR 0072 deixou em "O que NÃO foi feito": "O Alinhar não trata o pique
interno, só o do contorno".

O manual da referência diz que a ferramenta "alinha os piques na graduação",
com os modos Horizontal, Vertical, Elemento, Ponto horizontal e Ponto
vertical. Não separa os piques internos dos do contorno, e não dá a conta.

Até aqui, o pique interno (a marca com formato) só acompanhava a peça na
proporção, de tamanho em tamanho, como tudo o que está dentro dela.

## Decisão

### O que o alinhamento faz no pique interno

- Em cada tamanho, o pique vai, **de onde estava, para o ponto mais perto da
  linha de alinhamento**. *Leitura nossa.*
- A linha de cada modo:
  - **Horizontal / Vertical:** a que passa por ele no tamanho base. Ele só
    anda ao longo dela. Alinhado nas duas, fica no mesmo lugar em todos os
    tamanhos.
  - **Elemento:** a linha interna indicada. O pique do base também vai para
    ela.
  - **Ponto horizontal / Ponto vertical:** a que passa, em cada tamanho, pelo
    ponto do contorno indicado. O pique do base também vai para ela.
- Um alinhamento feito em cima de outro parte de onde o pique está hoje em
  cada tamanho.
- Se em algum tamanho o pique cairia **fora da peça**, nada muda, e a mensagem
  diz o tamanho. Em cima da borda ainda conta como dentro.

### Onde fica guardado

- Na própria marca: **quanto ela anda em cada tamanho**, contado de onde está
  no base. Sem esse registro, ela continua acompanhando a peça na proporção.
- O registro acompanha a peça girada, espelhada, dimensionada e desdobrada, e
  a parte dela que anda numa pence ou prega.
- Mudando os tamanhos ou o base, os valores passam a ser contados do base
  novo; o tamanho novo entra igual ao base.
- A peça de um tamanho, solta da graduação, leva o pique para onde o
  alinhamento manda e fica sem o registro.
- O registro que não tem um valor por tamanho não vale: o pique volta à
  proporção.

### Como usar e como desfazer

- O clique do "Alinhar" pega o pique do contorno **ou o interno** — o que
  estiver mais perto.
- A mensagem diz a que distância, em cada tamanho, o pique fica de onde está
  no base.
- **Para desfazer depois:** a janela do "Alterar" do pique interno alinhado
  tem a caixa "Alinhado entre os tamanhos"; desmarcada, ele volta a acompanhar
  a peça na proporção.

## O que NÃO foi feito

- **Não há tabela para editar os valores de cada tamanho** do pique interno,
  como há para o do contorno: alinha-se de novo, ou desfaz-se pelo "Alterar".
- **Na tela, os outros tamanhos da peça graduada aparecem só pelo contorno:**
  o pique interno de cada tamanho é visto na peça separada, no encaixe e no
  PDF — e na mensagem do alinhamento.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1956/1956 em 88 arquivos (eram 1939); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: cada modo com as posições
  conferidas por conta feita à parte numa peça que cresce na proporção; as
  recusas; a peça solta de um tamanho; a mudança de tamanhos e de base; girar,
  espelhar, dimensionar, a região que gira e o desdobrar; a ferramenta
  (cliques, o mais perto entre o do contorno e o interno, mensagens, prévia) e
  a caixa do "Alterar".
- **Mutações:** 36, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas.
- **Electron real, peça de teste graduada** (um canto andando 40 mm por
  tamanho):
  - o pique interno posto não tem registro;
  - Horizontal: o registro ganha um valor por tamanho, zero no base, e nenhum
    sai da linha;
  - Vertical por cima: fica no mesmo lugar em todos os tamanhos;
  - Ponto vertical pelo canto que anda: no tamanho maior o pique cairia fora
    da peça (a borda fica inclinada), e o programa recusa sem mudar nada;
  - o "Alterar" com a caixa desmarcada tira o registro;
  - Ponto horizontal pelo mesmo canto: o pique do base vai para a linha, e os
    outros andam ao longo dela;
  - Ctrl+Z devolve a peça.
  - **16 conferências, 0 falhas.** Na primeira rodada o roteiro esperava que
    o Ponto vertical desse certo; a recusa do programa é que estava certa, e
    a conferência foi corrigida.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
