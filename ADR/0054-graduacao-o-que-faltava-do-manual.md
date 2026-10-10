# ADR 0054 — Graduação: o que faltava do manual

## Contexto

O ADR 0052 releu o manual da referência e listou o que continuava diferente
nas ferramentas de graduação. O pedido foi concluir a lista.

O manual foi relido de novo para cada item. Ele confirma os campos e os
passos, e não dá as contas — onde é o caso, a janela da ferramenta diz que a
conta é a nossa leitura.

## Decisão

### Tabela do ponto

- **Setas e zero:** digita-se o valor (mm por tamanho) e aperta-se uma seta. A
  coluna DX (esquerda, direita) ou DY (cima, baixo) é preenchida com um passo
  por tamanho, os tamanhos maiores para o lado da seta. A outra coluna fica. O
  botão 0 zera a graduação do ponto.
- **Distância e ângulo:** a tabela troca DX e DY por distância (mm) e ângulo
  (graus; 0° para a direita, anti-horário, como no "Por ângulo").

### Tabela dos piques

- Com a Tabela ligada, o clique num **pique** abre a janela dele.
- O pique graduado fica, em cada tamanho, a uma distância certa de um **ponto
  de referência** do contorno, medida sobre ele: a que tem no base mais o
  **perímetro** desse tamanho. Sem graduação, continua na mesma proporção da
  aresta.
  - A referência proposta é o ponto graduado mais perto do pique.
  - "Incremental", "Inverter sinal", "= Perímetro" (os mesmos valores em todos
    os piques da peça) e tirar a graduação.
- A referência é guardada pela posição e acompanha a peça movida, girada,
  espelhada e dimensionada, o ponto do contorno quando ele muda de lugar e o
  lado da peça que anda. Trocado o base ou a lista de tamanhos, os valores
  passam a contar do base novo. A peça solta de um tamanho não leva a tabela.
- *Leitura nossa: o manual dá as colunas (Referência, Perímetro, Incremental),
  sem dizer a conta.*

### Regras

- **Código:** "Criar regra" pede também um código, opcional. Aparece na lista,
  ao lado do nome, e não entra nas contas.
- **Conjunto de regras:** várias regras do cadastro, em ordem. Monta-se no
  painel das Regras, marcando-as na ordem. Em uso, cada clique num ponto
  aplica a regra seguinte; acabadas, volta à primeira. A faixa diz qual é a
  regra da vez. *Leitura nossa: o manual nomeia o conjunto sem dizer como ele
  é aplicado.*

### Copiar graduação

- Com a origem indicada, o clique num ponto de **outra** peça graduada copia a
  regra para ele. A outra peça precisa ter todos os tamanhos desta.

### Unir moldes

- **Unir tamanhos** (ligado de início): a peça unida fica com a graduação das
  duas, se têm os mesmos tamanhos e o mesmo base. Desligado, só com a da
  primeira.
- **Giro:** "Igual base" gira todos os tamanhos da outra peça como o base (o
  que já fazia). "Igual tamanho" encosta cada tamanho dela no mesmo tamanho da
  primeira, aresta com aresta. *Leitura nossa.*
- A mensagem diz o que foi feito da graduação, e por que ela não entrou quando
  não entra.

### Cortar

- **Manter distâncias** (ligado de início): na peça graduada, as duas pontas do
  corte ficam com a regra que tinham na aresta inteira, nas duas partes. A
  linha do corte cai no mesmo lugar de cada tamanho. Sem isso, as pontas andam
  na proporção do contorno de cada parte.

## O que NÃO foi feito

- **Automático e Tangente não graduam piques.** O pique é graduado pela tabela
  dele.
- **Criar regra não tem a tabela editável na janela** (criar tamanho, mudar o
  base): a regra é a do ponto indicado; para outros números, muda-se o ponto.
- **Separar** continua pondo as peças numa fila ao lado, sem pedir a posição
  com o mouse.
- **Copiar e colar na tabela dos piques.** "= Perímetro" faz a repetição.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação (Electron real, build de produção)

- **Testes:** 1501/1501 em 73 arquivos (eram 1442).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 40 mutações guardadas, uma por vez. Três sobreviveram (a referência entre
    os pontos graduados; o clique noutra peça antes da origem; a opção
    chegando à união): faltava o caso. Corrigidos os testes, as três passaram
    a ser pegas. Os onze arquivos foram conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - **Seta** para a direita com 6: DX −6 no P e 6 no G. Em **distância e
    ângulo**: 6 mm a 0° no G e a 180° no P.
  - **Pique** a 98,4 mm do canto, graduado com +10 no G: na peça do G
    separada, ficou a 108,4 mm (na proporção seriam 100,4).
  - **Regra com código** "A1" na lista. **Conjunto** "Blusa" (Cava, Ombro): o
    primeiro clique aplicou a Cava e o segundo, o Ombro.
  - **Copiar** do canto de uma peça para o canto de outra: a regra chegou.
  - **Cortar** com "Manter distâncias": a ponta do corte, a meia altura, ficou
    com 2,96 mm no G nas duas partes (o canto de cima tem 6; o de baixo, 0).
  - **Unir** com "Igual tamanho": uma peça de 2400 cm², com 8 pontos graduados.
  - Validação sem problemas no fim.
  - O roteiro achou um defeito de uso: criado o primeiro conjunto, nenhum
    ficava escolhido e o botão continuava apagado. Corrigido e testado.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
