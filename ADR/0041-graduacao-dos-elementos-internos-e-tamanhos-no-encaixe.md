# ADR 0041 — Graduação dos elementos internos e tamanhos direto no encaixe

## Contexto

O ADR 0040 deixou duas limitações na graduação, e o pedido seguinte foi
resolvê-las:

- a graduação era só do contorno: furos, linhas internas, marcas e linha de
  fio ficavam, em todos os tamanhos, onde estavam no base;
- o encaixe usava só o tamanho base: para encaixar os outros era preciso
  "Separar" antes.

## Decisão

### O que está dentro da peça acompanha a graduação

- Em cada tamanho, um ponto de dentro da peça anda a **média dos
  deslocamentos dos pontos do contorno**, calculada por coordenadas de valor
  médio (`deslocamentoNoPonto`, em `domain/graduacao.ts`).
  - Em cima de um ponto do contorno, dá o deslocamento dele.
  - Sobre uma aresta, dá a proporção entre as duas pontas.
  - Se o contorno todo anda, cresce ou encolhe por igual, o ponto de dentro
    faz exatamente o mesmo. Vale também em contornos que não são convexos.
- Com isso, na peça de um tamanho ("Separar", o encaixe e a troca do base):
  - **furos, linhas internas, marcas e cotas** acompanham na proporção;
  - **a linha de fio** anda inteira o que anda o meio dela, sem mudar de
    direção nem de comprimento;
  - **os piques** continuam na mesma proporção das arestas, como antes.
- Não há regra própria para os pontos de dentro: eles sempre seguem o
  contorno.

### Os tamanhos vão direto para o encaixe

- O diálogo do Nesting automático ganhou, quando há peças graduadas, a opção
  **"Encaixar todos os tamanhos das peças graduadas"**, que vem marcada. A
  tabela de peças mostra os tamanhos de cada uma.
- Marcada, cada peça graduada entra no cálculo como uma peça comum por tamanho
  (`expandirTamanhos`). Ao aplicar o encaixe, o projeto passa a ter essas
  peças, sem graduação. Ctrl+Z desfaz, e a peça graduada volta.
- Desmarcada, só o tamanho base entra, e a peça continua graduada.
- "Separar" continua existindo, para quem quer as peças dos tamanhos sem
  encaixar.

## O que NÃO foi feito

- **Regra própria para um furo, uma linha ou uma marca:** eles seguem o
  contorno. Para um elemento que não deve acompanhar, é preciso separar o
  tamanho e mexer na peça.
- **Mostrar os elementos internos dos outros tamanhos no desenho:** o desenho
  da peça graduada continua mostrando só os contornos.
- **Grade de tamanhos no encaixe** (quantas peças de cada tamanho): cada
  tamanho entra com a quantidade da peça.
- **Encaixe manual, validação e PDF da peça graduada:** continuam olhando só
  para o base. Só o Nesting automático abre os tamanhos.

## Verificação (Electron real, build de produção)

- **Testes:** 1009/1009 em 56 arquivos (eram 995 em 55).
  - Novos: média dos deslocamentos 5, peça de um tamanho com o que está
    dentro 3, troca do base 1, abrir os tamanhos para o encaixe 2, diálogo do
    Nesting 3. Um teste antigo, que conferia o fio parado, passou a conferir o
    fio andando.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático**, conferido no arquivo salvo. Peça de 400 × 300 mm com
  uma marca no meio, graduada em P, M e G para crescer 10% na largura por
  tamanho:
  - Separando o G: largura de 330 mm, a marca a 162,9 mm da borda (estava a
    148,1 de 300 no base: a mesma proporção) e a linha de fio a 165 mm.
  - Nesting automático com a opção marcada: a tabela mostrou "P, M, G", as
    4 peças (três tamanhos e a outra peça do projeto) foram colocadas, com as
    áreas 1080, 1200 e 1320 cm², e a validação ficou sem problemas.
  - Ctrl+Z devolveu a peça graduada.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
