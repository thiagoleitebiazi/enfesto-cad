# ADR 0058 — O bico da pence pelo traçado de ofício, e o rodapé das janelas

## Contexto

Várias contas das ferramentas são "leitura nossa": o manual da referência dá
os campos e a ordem dos cliques, e não a conta. O pedido foi procurar de novo
de onde tirá-las.

A busca foi refeita para cada uma: Múltiplas pences, Deduzir, o giro do Fechar
pence por pivô, a linha das dobras horizontal e vertical, a proporção do
Ajustar, a construção do bico e a conta do "Aplicar no tamanho".

- **Do programa de referência não apareceu nada novo.** Não há documentação
  pública dessas contas além do manual já lido.
- **Para o bico da pence apareceu o traçado de ofício**, que não depende de
  programa nenhum: como se acerta a borda de uma pence dobrada, no papel
  (*Checking, Blending, and Truing Your Sewing Patterns – Part 2*,
  <https://blog.fabrics-store.com/?p=32999>).

## O que o traçado de ofício diz

1. Decide-se para que lado a pence é dobrada na costura (as verticais, em
   geral, para o centro; as horizontais, para baixo).
2. A metade da pence desse lado ganha a borda vizinha **espelhada na perna**,
   da perna até a linha do meio.
3. A outra metade é o espelho dessa **na linha do meio**.

O nosso bico (ADR 0052) espelhava a borda de **cada** lado na perna dele e
ficava no meio dos dois encontros. Coincide com o traçado quando as duas
bordas chegam com a mesma inclinação; quando chegam diferentes, o traçado
escolhe um lado, e nós ficávamos no meio.

## Decisão

### O lado da dobra

- A janela da "Pence no contorno" pergunta, para o acabamento, **para que lado
  a pence é dobrada**, de quem olha da borda para o vértice:
  - *Para a esquerda* ou *para a direita*: o bico é o do traçado de ofício —
    a borda desse lado, espelhada na perna, até a linha do meio.
  - *Sem lado* (o de antes, e o que vem marcado): o bico fica no meio dos
    dois.
- O registro guarda a ponta do lado da dobra. A pence mudada continua dobrada
  para o mesmo lado; na peça espelhada, a esquerda e a direita trocam, e a
  borda é a mesma.
- Com o lado escolhido, **o bico pode ficar para dentro da reta das pontas**:
  é o que a dobra dá quando a borda desse lado se afasta da pence. Sem lado,
  só conta o encontro para fora, como era.
- Se a borda espelhada não chega à linha do meio (ela continua a perna, por
  exemplo), o contorno passa reto pelo meio das pontas.

### O rodapé das janelas

- Com o campo novo, a janela da pence voltou a ficar mais alta que a tela, e o
  botão de confirmar saiu de vista (já tinha acontecido no ADR 0055).
- Em vez de encurtar texto outra vez, **o rodapé das janelas de campos (a
  mensagem de erro e os botões) fica colado embaixo**: os campos e a
  explicação rolam por trás dele. Vale para todas as janelas desse tipo.

## O que NÃO foi feito

- **O bico continua sendo um ponto**, com dois trechos retos. O traçado de
  ofício segue a borda inteira: numa borda curva, o bico dele é curvo. O nosso
  segue só o primeiro trecho da borda ao lado de cada ponta.
- **O lado da dobra não muda pela janela das medidas** de uma pence já feita:
  para trocar, fecha-se a pence e abre-se de novo.
- **Continuam sendo leitura nossa**, sem fonte: Múltiplas pences, Deduzir, o
  giro do Fechar pence por pivô, a linha das dobras horizontal e vertical, a
  proporção do Ajustar e a conta do "Aplicar no tamanho".
- **Nada foi comparado com o programa de referência em uso.**

## Verificação (Electron real, build de produção)

- **Testes:** 1647/1647 em 78 arquivos (eram 1640).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 13 mutações guardadas, uma por vez, todas pegas. Os arquivos foram
    conferidos por hash depois.
- **Roteiro automático**, numa peça desenhada com a borda reta de um lado da
  pence e inclinada do outro, conferido no arquivo salvo:
  - o bico dobrado para a esquerda e o dobrado para a direita ficam a 3,1 mm
    um do outro; o "sem lado" fica exatamente no meio dos dois;
  - o registro guarda a ponta da dobra (a 0 num caso, a 2 no outro);
  - **a janela:** antes do rodapé fixo, o botão acabava a 878 px numa tela de
    863; depois, a 785 px, à vista.
  - Validação sem problemas no fim.
- **Os moldes reais, pela tela, de novo** (como manda o ADR 0057 para toda
  mudança de geometria): nas 4 peças, a pence com acabamento foi feita sem
  lado, dobrada para a esquerda e dobrada para a direita. 20 operações ao
  todo, com a pence recortada e a prega; todas desfeitas de volta ao original.
  - Em duas peças os três bicos coincidem: as bordas chegam iguais dos dois
    lados.
  - Nas outras duas, o bico dobrado para a direita fica a 25,0 e a 11,3 mm do
    "sem lado", para dentro da reta das pontas.
  - **Foi este teste que mostrou a falta:** na primeira versão, o bico
    dobrado para o lado em que a borda se afasta saía reto. O bico para dentro
    entrou por causa disso.
  - A folha de revisão (`revisao-local/`, fora do git) foi refeita com as
    fotos dos dois lados da dobra.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
