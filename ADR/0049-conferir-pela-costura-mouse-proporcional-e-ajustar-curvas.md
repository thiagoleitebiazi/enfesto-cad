# ADR 0049 — Conferir pela costura, Mouse proporcional e "Ajustar curvas"

## Contexto

O ADR 0046 deixou de fora três partes do manual da referência:

- **Conferir:** "Usar costura", digitar o valor de "Atual" e escolher a peça
  de "Referência".
- **Graduar via mouse:** o modo Proporcional.
- **Unir tamanhos:** a opção "Ajustar curvas".

O pedido foi fazer o que tinha ficado por fazer.

## Decisão

### Conferir

- **Usar costura (mm):** as costuras indicadas passam a ser a linha a essa
  distância **para dentro** do contorno de cada peça — a linha de costura do
  molde que já tem a costura no contorno. Nos cantos, as retas deslocadas se
  encontram. O pique marcado continua no contorno, em frente ao ponto de
  encontro.
- **Atual (mm):** com o valor preenchido, o ponto de encontro fica nessa
  distância do começo das costuras, com o mouse onde estiver. A outra peça
  fica encostada ali, e um clique em qualquer lugar marca o ponto. Maior que a
  1ª costura, para no fim dela.
- **Referência:** a costura (a 1ª ou a 2ª) em que se conta a **diferença** — o
  que falta dela depois do ponto atual, como no manual ("diferença entre o
  perímetro total e o atual").
- Sem nada disso preenchido, o Conferir é o do ADR 0046.

### Graduar via mouse: Proporcional

- Dois cliques depois do ponto: **onde ele fica no menor tamanho** e **onde
  fica no maior**. Os tamanhos entre o base e cada ponta ficam com a parte
  proporcional à distância deles ao base.
- Os dois lados são independentes: o menor não precisa ser o contrário do
  maior.
- Com o base numa das pontas da grade, é um clique só.
- O desenho mostra o tamanho que está sendo indicado.

### Unir tamanhos: Ajustar curvas

- O Unir passa a abrir um diálogo, com a opção marcada de início.
- **Marcada:** todos os pontos do contorno ficam graduados, e as curvas de
  cada tamanho saem iguais às das peças unidas (o que já acontecia).
- **Desmarcada:** só os cantos ficam graduados, e os pontos de curva andam na
  proporção. A graduação fica mais simples de mexer, mas as curvas dos outros
  tamanhos são só aproximadas. A mensagem diz quantos cantos ficaram.
- O erro (peça sem tamanho, pontos diferentes) aparece no próprio diálogo.

## O que NÃO foi feito

- **Conferir pela linha de corte** (para fora do contorno): "Usar costura" leva
  a linha para dentro, que é o caso do contorno com a costura incluída.
- **Tamanho ou elemento a conferir**, como o manual pede em cada molde: as
  costuras são sempre do tamanho base, indicadas por dois pontos.
- **Conferência com a referência em uso:** os números não foram comparados
  com os do programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 1306/1306 em 70 arquivos (eram 1293).
  - Novos: Conferir 5, Mouse proporcional 4 mais 3 da regra, Unir 1.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 11 mutações guardadas, uma por vez: todas pegas, e os quatro arquivos
    conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - **Conferir** com costura de 10 mm, "Atual" em 80 e a 2ª de referência: a
    faixa disse "pela linha de costura, a 10,0 mm do contorno", "Atual:
    80,0 mm" e "o que falta da 2ª: 320,0 mm" (400 − 80). Um clique longe das
    peças marcou os piques em (400, 80) e (100, 580).
  - Costura negativa foi recusada no diálogo.
  - **Mouse proporcional** com PP, P, M, G e GG: o P ficou com metade do PP,
    e o G com metade do GG — (−9,39; −15,34) de (−18,78; −30,69), e
    (15,47; 23,5) de (30,95; 47,01).
  - **Unir** abriu o diálogo com "Ajustar curvas" marcada, e a falta de
    tamanho nas peças apareceu como erro nele.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
