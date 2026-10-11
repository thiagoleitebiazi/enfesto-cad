# ADR 0080 — A validação: encostar não é sobrepor, e as linhas internas que não são da peça

## Contexto

Depois do ADR 0079 ficaram apontados dois defeitos da validação do projeto:

- Duas peças **borda com borda** — as duas partes de um corte sem costura, por
  exemplo — saíam na lista como "se sobrepõem". Não se sobrepõem: estão
  encostadas.
- Numa peça real havia uma linha interna que não era dela, e a validação não
  dizia nada.

**Correção do que foi dito antes.** Essa linha tinha sido descrita como "uma
linha interna solta, a mais de um metro do contorno". Olhada na cópia do
projeto, ela não é isso: é uma linha **fechada**, de 49 pontos e 5,66 m de
comprimento — uma moldura retangular —, que passa por dentro da peça (8 pontos
dentro do contorno) e vai até 1361 mm para fora dele. Não está inteira do lado
de fora. Por isso o primeiro aviso feito nesta etapa (o da linha solta) não a
acusava, e foi preciso um segundo.

Na mesma conferência com as cópias dos projetos reais apareceu o primeiro
defeito de novo, noutra forma: num encaixe, duas peças vizinhas cuja borda
entra **0,010 a 0,017 mm** uma na outra (medido à parte, andando pela borda de
0,25 em 0,25 mm) continuavam saindo como "se sobrepõem". É erro de conta de
quem pôs as peças juntas, não sobreposição.

## Decisão

### Encostar não é sobrepor

- É **sobreposição** quando os interiores das duas peças têm parte em comum:
  - a borda de uma **entra na outra mais de 0,05 mm**; ou
  - um ponto bem de dentro de uma está dentro da outra a mais disso — o caso da
    mesma peça duas vezes no mesmo lugar, em que as bordas correm juntas e
    nenhuma entra na outra.
- A fundura é medida nos cantos e, em cada trecho de lado entre dois
  cruzamentos com a borda da outra, no começo e em três pontos dele.
- **0,05 mm** é meio décimo de milímetro: abaixo do que o corte distingue, e
  acima do erro de conta medido nos projetos reais. É um parâmetro da função
  (`FUNDURA_MINIMA_DA_SOBREPOSICAO_MM`).
- As peças que **só se encostam** (ou entram menos que isso uma na outra):
  - com distância mínima entre peças no enfesto, saem como espaçamento
    insuficiente, com a frase "estão encostadas uma na outra; o mínimo exigido
    entre peças é de N mm";
  - sem distância mínima, não são problema.
- A peça fina que está **em cima** de outra continua sendo sobreposição, por
  mais fina que seja: o que conta é a que fundura ela está dentro da outra, e
  não a largura dela.

### A linha interna solta

- É solta a linha interna que está **inteira do lado de fora** da peça, a mais
  de 10 mm do contorno. A que toca o contorno, a que o atravessa e a que passa
  perto dele pelo lado de fora não são: podem ser prolongamento ou marcação de
  costura.
- A validação dá um **aviso** (não é erro), dizendo a quantos milímetros do
  contorno ela está — ou quantas são, e a distância da mais afastada.

### A linha interna que sai da peça

- É a linha que tem parte na peça (ou junto dela) e **vai a mais de 100 mm da
  caixa do contorno**: uma moldura do desenho, o contorno de outra peça que
  veio junto na importação.
- A validação dá um **aviso**, dizendo até quantos milímetros para fora do
  contorno a linha vai.
- A medida de "longe" é pela caixa do contorno (o retângulo em volta dele),
  que é barata e não erra para mais. A linha de construção que passa um pouco
  da borda não entra.
- A linha solta não é contada de novo aqui: cada linha cai num aviso só.

### O "Tirar"

- Cada um dos dois avisos tem, na lista da validação, o botão **Tirar**, que
  tira da peça as linhas daquele aviso — e só elas — num passo do Ctrl+Z.
- A linha que sai da peça é tirada **inteira**, inclusive a parte que está
  dentro: o programa não sabe qual pedaço dela seria do molde.
- São avisos, e não erros, pelo mesmo motivo: a linha pode ter sido posta ali
  de propósito. Quem decide é quem está fazendo o molde.

A validação é deste programa: não há ferramenta da referência a que comparar.

## O que NÃO foi feito

- **A linha que sai da peça não é aparada na borda:** o "Tirar" tira a linha
  toda, e não há um "tirar só a parte de fora".
- **A linha que passa menos de 100 mm para fora** não é apontada, mesmo que
  não seja do molde.
- **A fundura é medida em pontos da borda**, e não por área: uma entrada entre
  0,05 e uns 0,1 mm pode sair como "encostadas" ou como "se sobrepõem",
  conforme a forma. Acima disso é sempre sobreposição.
- **Os outros problemas dos projetos reais não foram mexidos:** a validação os
  diz (uma peça fora da área útil do enfesto; peças a menos da distância
  mínima), e arrumar a posição das peças é de quem fez o projeto.
- **A ordenação dos cruzamentos de um lado** (dentro da conta da fundura) não
  entrou nas mutações: com até quatro cruzamentos por lado, a ordem em que a
  borda os dá já deixa juntos os dois de um trecho de dentro, e não há teste
  que distinga. Ela fica para os lados com mais cruzamentos.

## Verificação

- **Testes:** 2018/2018 em 93 arquivos (eram 1992 em 92); tipos e lint limpos
  (o aviso antigo do `useMemo` continua). Novos: borda com borda, canto com
  canto e canto no meio do lado; a entrada de 0,02 e de 0,06 mm; as bordas que
  se cruzam por centésimos; a faixa por cima de um canto; a agulha; a mesma
  peça quase no mesmo lugar; o ponto de dentro em formas difíceis (ampulheta,
  chave, U, peça com bojo); o prolongamento do lado; as linhas soltas e as que
  saem, com as folgas e o "tirar"; as mensagens da validação.
- **Mutações:** 51, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas.
- **Electron real, peças de teste:**
  - corte sem costura: a lista diz "estão encostadas", e não "se sobrepõem";
  - corte com 10 mm de costura: a lista diz "se sobrepõem";
  - uma linha traçada longe da peça: aviso de linha solta, com a distância e o
    "Tirar"; o "Tirar" tira só ela; Ctrl+Z a traz de volta;
  - uma linha que começa na peça e vai 260 mm para fora, junto com uma de
    dentro e uma solta: dois avisos, cada um com o seu "Tirar"; o da que sai
    tira só ela, inteira; Ctrl+Z a traz de volta;
  - são avisos: a barra de baixo não conta erro.
  - **18 conferências, 0 falhas.**
- **Electron real, projetos reais (cópias), pela tela:**
  - num, a validação passou a apontar a moldura ("uma linha interna sai da
    peça e vai até 1361 mm para fora do contorno"); o "Tirar" levou a peça de
    26 para 25 linhas, com o contorno, os piques e o fio iguais; Ctrl+Z
    devolveu o projeto igual ao arquivo aberto;
  - no outro, os dois pares que saíam como "se sobrepõem" saem como "estão
    encostadas uma na outra"; o terceiro par continua "a 0.6 mm";
  - **7 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
