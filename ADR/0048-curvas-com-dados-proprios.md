# ADR 0048 — Curvas com dados próprios

## Contexto

Uma curva, depois de feita, era só uma fila de pontos do contorno (ADR 0037).
Para mudar a forma dela, o jeito era arrastar os pontos um a um, ou apagar e
desenhar de novo. O pedido foi corrigir isso, como foi feito com as pences
(ADR 0047).

## Decisão

### O registro

- A **Curva** e os arcos **por 2 pontos** e **por 3 pontos** ficam
  **registrados na peça** (`Molde.curvas`): os pontos por onde a curva passa
  (as duas pontas e os pontos de passagem clicados) e os pontos do contorno
  que ela gerou.
- **Vale enquanto esses pontos forem pontos seguidos do contorno**, na ordem
  (num sentido ou no outro). Fora disso o registro é ignorado, sem erro.
- O arco continua sendo reconhecido pelo desenho, como antes (ADR 0042); o
  registro é a mais.

### Mexer nos pontos de passagem

- Com **Editar pontos de curva** ligada, os pontos de passagem das curvas
  registradas aparecem com um anel.
- Um clique num anel escolhe o ponto; o clique seguinte diz onde ele deve
  ficar. Enquanto o mouse anda, o desenho mostra a curva antiga em destaque e
  a nova tracejada.
- A curva é **refeita pelos pontos de passagem de agora** — a curva suave por
  todos eles, ou o arco de círculo pelos três — e entra no contorno no lugar
  da antiga. As pontas não saem do lugar.
- É um passo de desfazer.
- A ferramenta continua fazendo o que fazia (mudar quantos pontos um trecho
  tem): o clique fora dos anéis começa o trecho, como antes. Não há botão novo.

### O registro acompanha a peça

- Mover, girar, espelhar e dimensionar.
- Cada tamanho da graduação.
- A região que gira ao abrir, fechar ou transferir uma pence, e nas pregas,
  quando a curva está inteira nela.

## O que NÃO foi feito

- **Um ponto da curva mexido à mão** (Mover ponto, Modificar, cerca, inserir ou
  excluir ponto) invalida o registro: a curva passa a ser uma fila de pontos
  comum. Foi de propósito — refazer a curva pelos pontos de passagem apagaria
  o ajuste feito à mão.
- **Mover as pontas** da curva pelos anéis: elas são pontos do contorno, e
  movem-se com Mover ponto (o que invalida o registro).
- **Acrescentar ou tirar pontos de passagem** de uma curva já feita.
- **Alças de tangente** (as de curva Bézier): a curva passa pelos pontos; não
  há controle da inclinação em cada um.
- **Registro para o que já existia:** curvas de projetos antigos ou de peças
  importadas, a Pré-definida, a Espiral, o arco tangente e o Por raio não têm
  registro.
- **Refazer a curva ao dimensionar ou graduar:** os pontos dela são levados
  como estão. A curva continua lisa, mas com a mesma quantidade de pontos.
- **Editar pontos de curva num trecho de curva registrada** (mudar a
  quantidade de pontos) invalida o registro, como qualquer mudança à mão.

## Verificação (Electron real, build de produção)

- **Testes:** 1293/1293 em 70 arquivos (eram 1276 em 68).
  - Novos: registro e edição no domínio 12, interface 5.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 13 mutações guardadas, uma por vez: todas pegas, e os cinco arquivos
    conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo. Peça de 400 × 300 mm:
  - Curva no lugar de um lado, passando por um ponto 38 mm para fora:
    1287,9 cm², 70 pontos, registrada com os três pontos de passagem.
  - Um clique no anel escolheu o ponto; o seguinte levou-o para (151; 387). A
    curva refeita passa a 0 mm do ponto novo e a 43 mm do antigo: 1405,2 cm²,
    com a validação sem problemas. Ctrl+Z voltou aos 1287,9 cm².
  - O clique num trecho reto abriu o diálogo de quantidade de pontos, como
    antes.
  - Arco por 3 pontos na outra peça, registrado; com o ponto do meio movido,
    todos os pontos do arco novo ficaram a 172,6 mm do centro.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
