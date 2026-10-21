# ADR 0090 — DXF reais de outro programa, o pique que se perdia e o PDF que saía espelhado

## Contexto

Pedido: concluir a pendência "arquivos DXF reais de outros CADs" (risco R-1),
e só ela — ERP, login e banco de dados continuam como estão (ADR 0089).

Neste computador há dois DXF que o usuário recebeu de outro programa de
modelagem (pasta Downloads; um deles também chegou pelo WhatsApp):
`test modelagem.dxf` (06/10) e `teste 2 com outra coisa.dxf` (12/10). Os dois
são AutoCAD 2018 (`AC1032`), gravados pela biblioteca ODA, em centímetros
(`$INSUNITS` 5), tudo numa camada "Camada 1": o primeiro com 239 SPLINE, o
segundo com 238 LWPOLYLINE. São o molde de uma camiseta tamanho G — costas,
frente, manga larga, manga e o acabamento do decote —, com os nomes, as
quantidades e a linha de fio desenhados dentro de cada peça, e um texto de
informação fora delas. O primeiro já tinha sido usado no ADR 0030 (quando o
SPLINE passou a ser lido); o segundo nunca. Os arquivos foram lidos por
cópias, numa pasta de trabalho, e não ficam no repositório.

O ADR 0030 tinha deixado em aberto se a peça chegava espelhada ("Não
verifiquei isso contra o DXF original num visualizador").

## O que os arquivos mostraram

1. **As medidas estão certas.** Lidos por um caminho independente do
   programa (um leitor das LWPOLYLINE escrito à parte), as cinco formas
   fechadas do segundo arquivo têm 3989,95, 3731,37, 2312,43, 1061,37 e
   258 cm²; o importador chega a 398995, 373137, 231243, 106137 e 25800 mm², e
   às mesmas caixas. O primeiro arquivo, com as mesmas peças em curvas (e
   algumas giradas), dá as mesmas áreas — dois caminhos de leitura diferentes,
   o mesmo resultado.
2. **A tela não espelha.** Desenhado com o y para cima (como um visualizador
   de CAD), o arquivo mostra os textos legíveis; na tela do programa, as peças
   ficam na mesma disposição (`dxfParaMundo` mais a troca de eixos da tela é
   uma translação do desenho original).
3. **O pique se perdia.** No meio do decote das costas há um traço de 5 mm
   que atravessa a linha de corte — o pique do centro, para costurar o
   acabamento. Como o meio dele fica fora da peça, ele caía em "linha reta
   fora das peças" e era ignorado (no arquivo de polilinhas) ou virava uma
   linha interna (no de curvas, conforme a ponta que ficava dentro).
4. **O texto de fora sumia calado** no arquivo de curvas: o aviso só contava
   as retas de dois pontos.
5. **Sem nomes de camada, não se sabe qual contorno é qual.** A janela de
   importação listava "Contorno 1 — 68 vértices", sem o desenho.
6. **O retângulo de 43 × 6 cm é uma peça**, o acabamento do decote — e não a
   "caixa de nota" que o ADR 0030 registrou. A janela já o deixa marcado.
7. **O PDF de tamanho real saía espelhado.** Lido também por um caminho à
   parte (os traços da página com as matrizes do próprio PDF), o contorno das
   costas aparecia na folha com o sentido de giro oposto ao do arquivo
   (+398995 contra −398995 mm², os mesmos 68 pontos na mesma ordem). A causa
   vem do ADR 0012: a tela passou a mostrar o y do mundo na horizontal e o x
   descendo, e o PDF continuou usando o x e o y direto. Trocar os eixos sem
   mais nada é um espelho na diagonal — o comentário do código já dizia que
   "na folha os eixos da tela vêm trocados". Nestas peças (simétricas) não faz
   diferença no corte; numa peça assimétrica (frente esquerda, bolso de um
   lado), o papel impresso seria a peça do outro lado. Vale para todo PDF, não
   só para as peças importadas.

## Decisão

- **Pique por traço** (`dxf-importacao.ts`): um traço aberto (reta,
  polilinha ou curva) de até 20 mm, com uma ponta dentro da peça e a outra
  fora, é um pique, no ponto em que cruza o contorno e na aresta em que cai.
  Ele não fica também como linha, e a importação o leva para a peça
  (`App.tsx`, com a mesma conversão dos pontos). O desenho do pique é o do
  programa (aba Marcações); o comprimento do traço do arquivo não é guardado.
- **O aviso do que fica fora** conta tudo o que não cai numa peça, de
  qualquer tipo.
- **A miniatura de cada contorno** na janela de importação (DXF e PDF), na
  orientação em que ele vai ficar na tela, com as linhas de dentro (onde vêm o
  nome e o fio). A direção do fio continua escolhida por quem importa: sem
  camada de fio no arquivo, o programa não a presume.
- **O PDF mostra a peça como a tela** (`naFolha` em `pdf-exportacao.ts`): o
  comprimento (y do mundo) na horizontal da folha, a largura descendo. O
  ladrilhado acompanha (no encaixe, as colunas andam no comprimento da mesa);
  o "Pique texto" sai no mesmo ângulo da tela. Cada folha leva a marca
  `% enfesto-cad:folha:como-a-tela`: a importação de PDF lê os eixos assim
  quando a marca está lá, e como antes quando não está — os PDFs já gerados
  continuam voltando certos (o registro da peça confere com o desenho nos
  dois casos).
- **A exportação abre em paisagem**: com a peça deitada na folha, é a
  orientação que gasta as mesmas folhas que o retrato gastava antes (o
  retrato continua à escolha).

## O que NÃO foi feito

- Só um programa de origem foi visto (os dois arquivos vêm dele). Arquivos de
  outros programas — por exemplo, com as camadas numéricas do AAMA — não
  apareceram; quando aparecerem, passam pela mesma conferência (medidas por
  um caminho à parte, orientação, piques, o que fica de fora).
- O desenho do pique do arquivo (o comprimento do traço) não é copiado: o
  pique fica com o desenho padrão do programa.
- A linha de fio desenhada no arquivo (sem camada própria) vem como linha
  interna; a direção é escolhida na importação.

## Verificação

- **Testes:** 2519 em 123 arquivos (2502 no ADR 0089); tipos e lint limpos;
  build feito. Novos: a estrutura dos arquivos reais em DXF sintético (tudo
  numa camada, em cm — o pique reto e o curvo, na aresta certa, a linha longa
  que encosta na borda, o traço que só corta um canto, o pique da peça certa
  com duas peças, o aviso do que fica fora, o fio que não é presumido), a
  folha como a tela (o contorno ponto a ponto, o sentido de giro, a marca em
  cada folha, as folhas da peça comprida e do encaixe, o texto girado, o
  nome no canto), a leitura da folha de agora e da de antes, a miniatura na
  janela de importação e a paisagem como padrão.
- **Mutações:** 23 no código deste ADR, uma por vez, com o código conferido
  por hash antes e depois: 10 pegas na primeira rodada; as 13 que ficaram
  apontaram os testes que faltavam (uma, a do padrão em paisagem, não tinha
  sido aplicada — o trecho sem espaços perdia as aspas simples no caminho
  até o bash; refeita com a linha inteira). Com os testes novos, as 23 pegas.
- **Na tela, com o programa gerado** (pasta de dados separada), os dois
  arquivos reais (cópias): 23 conferências, 0 falhas — a janela com os 5
  contornos desenhados, o aviso do pique e do que fica fora, as 5 peças com
  o nome, o tamanho e a origem em centímetros, as áreas e as medidas iguais
  às do arquivo (costas 775,25 × 560 mm, frente 749,55 × 560, acabamento
  430 × 60), o pique em cima da aresta, o PDF gravado. O contorno das costas
  no PDF, lido à parte, tem o mesmo sentido de giro do arquivo (−398995 mm²
  nos dois arquivos), em 32 e 36 folhas A4 em paisagem. O roteiro dos fluxos:
  72 certas, 0 falhas (exporta e importa PDF); o do planejamento: 44, 0
  falhas; o dos planos: 0 falhas; a varredura dos botões: igual à anterior.
- **Dados reais:** os 9 projetos da pasta do programa instalado com as mesmas
  impressões e o diagnóstico com as mesmas 1536 linhas; os dois DXF da pasta
  Downloads iguais aos copiados (mesmos hashes); as cópias e tudo o que foi
  gerado delas, apagados depois.
