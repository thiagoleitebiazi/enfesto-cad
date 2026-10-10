# ADR 0055 — Produção: corte por elementos, "Cortar intersecções" e pence de pernas curvas

## Contexto

Ficaram três diferenças do manual da referência nas ferramentas da aba
Produção (ADR 0052): o "Cortar" só aceitava como elemento uma linha interna
reta; a pence aberta por pivô não tinha o "Cortar intersecções"; e o
"Transferir" e o "Fechar pence" só serviam à pence de pernas retas, porque
tomavam como pontas os pontos vizinhos do vértice.

O manual foi relido para os três. Ele diz o que cada opção faz e a ordem dos
cliques, e não dá as contas — onde é o caso, a janela diz que a conta é a
nossa leitura.

## Decisão

### Cortar por um elemento que não é reto, ou por vários

- O **elemento** do corte passa a ser qualquer linha interna da peça: reta,
  curva, arco ou linha quebrada. A linha do corte vai de uma borda à outra por
  cima dela.
- **Contorno** (campo novo da janela, como no manual):
  - *Automático*: o clique no elemento corta por ele na hora.
  - *Manual*: cada clique indica um elemento (o clique repetido tira), e o
    Enter corta pela linha que eles formam, emendados ponta com ponta.
- O que o manual não diz, e ficou assim (*leitura nossa*):
  - dois elementos estão emendados quando as pontas estão a até 1 mm;
  - o elemento que passa do contorno é aparado onde entra na peça;
  - o que para a até 1 mm do contorno é levado até ele;
  - o que para antes, dentro da peça, é prolongado em linha reta, na direção
    em que acaba, até a borda.
- A linha é recusada quando sai da peça no caminho, passa por um furo, cruza a
  si mesma ou fecha uma volta.
- **Costura** no corte que não é reto: a borda do corte deslocada. Nos cantos
  da linha os dois trechos se encontram; num canto fechado demais (mais de
  quatro vezes a costura), cada trecho acaba no seu ponto. A costura que faria
  a borda cruzar a si mesma é recusada. A mensagem manda conferir, como o
  manual avisa.
- "Manter distâncias" vale igual: as pontas levam a regra da peça inteira, e
  as duas partes continuam encaixando pela linha do corte em cada tamanho.

### "Cortar intersecções" na pence aberta por pivô

- Serve quando a reta da posição da pence até o pivô cruza o contorno em mais
  de dois pontos (sai da peça e volta). Sem a opção, a ferramenta recusa e
  aponta a opção.
- Com ela, a peça é cortada em cada trecho da reta que está dentro dela. O
  lado sem a linha de fio gira inteiro em torno do pivô (todos os pedaços
  juntos), e o que abre em cada trecho vira tecido.
- O resultado é uma prega em cunha: não há vértice, a profundidade não conta,
  e as duas bordas de cada trecho ficam desenhadas. *Leitura nossa: o manual
  diz só quando a opção é necessária e que "o resultado é uma prega".*
- Se a linha de fio não está em parte nenhuma, fica o lado de mais área.

### Transferir e Fechar pence: início, vértice e fim indicados

- Opção nova nas duas janelas (o "Transferir" não tinha janela). Com ela, os
  três primeiros cliques são o início, o vértice e o fim da pence — a ordem do
  manual; a contrária também serve — e só depois vem a nova posição ou o pivô.
- Os pontos das pernas saem do contorno com a pence. O giro é o que leva o fim
  para a direção do início (visto do vértice, no Transferir; do pivô, no
  Fechar).
- "Somente o recorte": o contorno passa reto de uma ponta à outra, e a pence
  fica desenhada com as pernas como eram.
- Sem a opção, tudo continua como era: basta o vértice.

## O que NÃO foi feito

- **"Remover região" e "Dobrar"** continuam aceitando só o elemento reto.
- **No contorno manual, o elemento é sempre uma linha interna.** Um trecho do
  contorno não entra na linha do corte.
- **A costura do corte curvo não arredonda os cantos**, e não é corrigida
  quando não cabe: é recusada.
- **A prega do "Cortar intersecções" não tem registro.** Não dá para mudar a
  abertura depois nem tirá-la pela ferramenta; o caminho de volta é o Ctrl+Z.
- **A pence transferida tem pernas retas**: a curva das pernas não é levada
  para a nova posição, e a área da peça muda um pouco (a mensagem diz quanto).
  Se as pontas estão a distâncias diferentes do vértice, sobra um degrau.
- **Uma recusa sem teste:** a peça que "dá a volta por fora da linha" no
  "Cortar intersecções". Não encontrei uma peça que caia nela.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação (Electron real, build de produção)

- **Testes:** 1580/1580 em 75 arquivos (eram 1501).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 60 mutações guardadas, uma por vez. Uma sobreviveu (a conta do canto da
    costura, num eixo): o canto do teste era simétrico. Com um canto que não
    é, passou a ser pega. Os sete arquivos foram conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - **Contorno manual**, duas retas emendadas num ponto: 828,2 e 371,8 cm²
    (1200 ao todo), cinco pontos em cada parte. O clique no contorno com
    elementos indicados não começou um corte reto.
  - **Automático**, um elemento prolongado até as bordas, 10 mm de costura
    nas duas partes: 647,6 e 644,8 cm².
  - **Os dois elementos com costura:** 874,4 e 418,0 cm², com o aviso de
    conferir.
  - **"Cortar intersecções"** numa peça em "C" desenhada à mão: sem a opção,
    recusa com a dica; com ela, de 701,6 para 731,4 cm², 15 pontos, 4 linhas,
    2 piques, nenhuma pence registrada.
  - **Pence de pernas curvas** desenhada à mão: transferida (863,6 cm², com um
    degrau dos cliques), fechada só no recorte (899,4 cm², a pence desenhada
    com 5 pontos) e fechada por pivô (810,4 cm²).
  - Validação sem problemas no fim.
  - O roteiro achou um defeito de uso: a janela da pence ficou mais alta que a
    tela, e o botão saía de vista. As explicações das duas janelas foram
    encurtadas.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
