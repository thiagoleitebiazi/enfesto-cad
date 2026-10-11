# ADR 0071 — Aba Marcações: o pique com formato; Inserir, Remover, Múltiplos, Substituir e Alterar

## Contexto

O pedido foi fazer a aba Marcações como as outras, a partir da imagem da
referência: três grupos — **Piques** (Inserir, Remover pique, Pique texto,
Múltiplos), **Editar piques** (Alinhar, Cadastrar pique, Substituir, Alterar)
e **Linhas auxiliares** (Inserir ou remover).

A aba tinha três botões antigos: Pique, Marca e Furo. O pique era um traço
fixo de 6 mm na borda, sem tipo nem medidas.

O manual da referência dá, de cada ferramenta, os campos e a ordem dos
cliques. Não descreve os tipos de pique, não diz de onde o ângulo é contado
nem dá as contas.

Este ADR cobre a base e cinco das nove ferramentas. As outras quatro (Pique
texto, Alinhar, Cadastrar pique e Linhas auxiliares) ficam desligadas na aba,
com o motivo dito, até os próximos ADRs deste mesmo trabalho.

## Decisão

### O pique ganha um formato

- **Formato** = tipo, largura (ao longo da borda), altura (para dentro da
  peça) e ângulo. Guardado no pique, opcional: projetos antigos abrem como
  antes.
- **Sete tipos** vêm com o programa: Traço (I), V, T, U, Caixa, Cruz e
  Círculo. *Escolha nossa:* o manual tem a lista na janela e não a descreve.
- **O pique com formato entra na peça**, seja qual for o sentido em que o
  contorno está guardado.
- **Ângulo:** 0° é em esquadro com a borda; positivo gira no sentido
  anti-horário da tela. *Leitura nossa.*
- **O pique sem formato** (os de antes) continua sendo o traço de 6 mm de
  sempre, para o lado em que já era desenhado. Passando pelo "Alterar" ou
  pelo "Substituir", ganha formato.
- **Pique interno** = a marca da peça com um formato, centrado no ponto. É o
  que o manual chama de "marca" na janela do Substituir. A marca sem formato
  continua sendo o ponto de sempre.
- **Medidas em mm**, como no resto do programa (o manual as dá em cm).
- A tela e o PDF desenham pelo formato. O ângulo acompanha a peça que gira ou
  espelha.

### A aba

- Os três grupos da imagem, na mesma ordem. O **Furo** não é da aba da
  referência: fica num quarto grupo, "Furos", para continuar à mão.
- Saíram os botões antigos "Pique" e "Marca": o "Inserir" faz os dois (na
  borda, ou interno).

### Inserir

Janela com o formato e:

- **Pique sobre o contorno** (desmarcado, é pique interno);
- **Referência:** a distância do ponto do contorno mais perto do clique. Em
  branco, o pique fica onde for clicado;
- **Código:** cada pique recebe o código seguinte da sequência do projeto;
- **Adicionar ponto de controle:** põe também um ponto no contorno;
- **Manter distância nos tamanhos:** na peça graduada, a mesma distância do
  ponto de referência em todos os tamanhos;
- **Pique na costura:** Projetado ou Estendido — como ele vai para a linha de
  corte, na peça com margem de costura;
- **Dx e Dy** (pique interno): a distância do ponto clicado. *Leitura nossa:*
  o manual não diz de onde partem.

Cada clique põe um pique; o tracejado mostra antes.

### Remover pique

- Sem nada marcado, cada clique tira o pique sob ele (do contorno ou interno).
- Com "Todos os piques sobre o contorno" ou "Todos os piques internos", age
  na peça selecionada ao confirmar.

### Múltiplos

- **Sobre o contorno:** dois cliques na borda; os piques vão do primeiro ao
  segundo no sentido horário, como o manual pede.
- **Pontos do mouse:** piques internos na reta entre dois pontos clicados.
- **Elemento:** piques internos ao longo de uma linha interna.
- **Nro. piques:** essa quantidade, com espaços iguais do começo ao fim.
  **Perímetro:** um a cada tantos mm, a partir do começo. *Leitura nossa:* o
  manual dá os modos e não a conta.
- No máximo 200 de uma vez.

### Substituir

- Escolhe-se o tipo a substituir (ou todos) e onde: na peça selecionada, nas
  marcadas na lista ou em todas.
- **Substituir pelo pique:** mesmo lugar e mesmo código, formato novo.
- **Substituir por marca:** o pique do contorno vira um pique interno, à
  distância dada, para dentro da peça.
- **Remover piques selecionados.**
- A mensagem diz quantos foram substituídos ou removidos, e em quantas peças.

### Alterar

- Um clique num pique abre a janela dele: formato, ponto de referência e
  perímetro (a distância dele, sobre o contorno), código, pique na costura e,
  na peça graduada, manter distância.
- "Indicar a posição com o mouse": depois de aplicar, o clique seguinte leva
  o pique para lá. *No manual é um duplo clique sobre o pique;* aqui é uma
  caixa da janela.

## Dois defeitos achados na tela, e corrigidos

- **Perto de um canto, o pique ia para o lado errado.** O clique perto de um
  canto é preso nele, e a "distância da referência" era andada para o lado
  da outra aresta. Agora quem diz o lado é o ponto clicado de verdade.
- **Aplicar o "Alterar" sem mexer no lugar deslocava o pique** alguns
  milésimos de milímetro, porque a janela mostra o perímetro arredondado.
  Agora, sem mexer no ponto nem no perímetro, o pique fica exatamente onde
  estava.

## O que NÃO foi feito

- **Pique texto, Alinhar, Cadastrar pique e Linhas auxiliares:** nos próximos
  ADRs. Estão na aba, desligados, com o motivo.
- **O PDF não guarda o formato.** Importando um PDF exportado daqui, o pique
  com formato volta no lugar certo, mas como o traço de sempre; o pique
  interno volta como um ponto.
- **O pique com formato não é recortado do contorno:** é uma marcação
  desenhada, como já era. O encaixe continua usando o contorno.
- **"Pique na costura" não aparece** na peça sem margem de costura; a mensagem
  avisa.
- **O "Substituir" não mexe nos piques internos**, só nos do contorno.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1867/1867 em 85 arquivos (eram 1808); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: os formatos, os traços de cada
  tipo, o ângulo, o pique interno, giro e espelho, a linha de corte, a
  referência; cada ferramenta com a janela, os cliques, a prévia, a instrução
  e as recusas; a aba; o PDF de ida e volta.
- **Mutações:** 38 de 38 pegas, uma por vez, com o código conferido por hash
  antes e depois. A primeira rodada deixou passar duas; cada uma ganhou
  teste, e uma delas melhorou a mensagem (a linha que sai da peça diz quantos
  pontos ficaram sem pique).
- **Electron real, peça de teste:** a aba com os quatro grupos; um V de
  10 × 12 mm na borda; outro a 50 mm do canto, com o código 1; uma cruz
  interna; o V vira T de 20 mm e vai, com o mouse, para a borda de baixo;
  quatro piques com espaços iguais; os seis viram U, e depois piques internos
  a 20 mm da borda; um sai com o clique, os outros todos de uma vez; Ctrl+Z
  devolve a peça. **21 conferências, 0 falhas.**
- **Moldes reais:** não entram neste ADR; ficam para o fim da aba, com as
  nove ferramentas.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
