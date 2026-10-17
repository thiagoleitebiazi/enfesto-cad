# ADR 0084 — Revisão completa das funcionalidades

## Contexto

Pedido: uma revisão completa das funcionalidades do programa, corrigindo o
que estivesse errado. As revisões anteriores foram por ferramenta, à medida
que cada uma era feita; esta passou pelo programa inteiro de uma vez, do
jeito que ele é usado depois de instalado.

## Como foi feita

- **Varredura de todos os botões, na tela.** Um roteiro abriu o programa de
  verdade (o `main.js` gerado, com uma pasta de dados só dele) e apertou cada
  botão das 10 abas (139), cada item dos 4 menus do alto (15) e cada botão
  da barra de acesso rápido (11), com uma peça escolhida, anotando a janela
  que abria, a instrução da ferramenta, os erros da página e do console e as
  caixas do Windows.
- **Os fluxos de ponta a ponta, na tela:** salvar e salvar como, girar,
  elemento paralelo, arredondar e chanfrar, inserir e excluir ponto, o lote
  marcado na lista pelo teclado, exportar PDF (os dois tipos), relatório
  (PDF e Excel), importar PDF e DXF, tecido, enfesto, encaixe automático (e o
  Cancelar no meio dele), biblioteca, histórico e novo projeto.
- **Leitura do código** das partes que os roteiros não alcançam: gravação
  dos projetos, importação de DXF, geração do PDF, o Worker do encaixe, as
  regras de tecido.
- **Os projetos reais** (em cópias, apagadas no fim) passaram pela validação
  nova.

## Os defeitos encontrados, e o que foi feito

### Funções que davam erro e não faziam nada no programa instalado

- **Salvar como** (o botão e o Ctrl+Shift+S), **Girar livre**, **Elemento
  paralelo** e **Arredondar ou chanfrar** pediam o valor pela caixa de texto
  do navegador (`window.prompt`), que o Electron não mostra: dá o erro
  "prompt() is not supported" e o botão não faz nada. Os testes de unidade
  não pegavam isso (no jsdom a caixa existe). Agora cada uma tem a sua
  janela, como as outras ferramentas. Na de arredondar ou chanfrar a escolha
  é feita na própria janela, e a última escolha volta no canto seguinte.

### Ferramentas que ficavam ligadas sem dizer o que fazer

- **Mover ponto**, **Inserir ponto** (e o **Dividir curva**, que é ele),
  **Excluir ponto** e **Arredondar ou chanfrar** deixavam o botão apertado e
  a faixa de instrução vazia. Agora dizem onde clicar. O motivo de não poder
  excluir um ponto (o contorno ficaria com menos de 3) aparece na faixa, e
  não mais numa caixa do Windows.

### Inserir ponto

- O clique em qualquer lugar, mesmo longe da peça, criava um ponto na
  aresta mais próxima; agora só o clique perto do contorno. O clique fora de
  um canto criava um ponto em cima do canto (aresta de comprimento zero);
  agora não.
- O pique da aresta dividida que ficava depois do ponto novo continuava
  preso à primeira metade: ao mover o ponto novo, ele ia parar em cima do
  ponto. Passa para a segunda metade.

### O relatório de produção

- Era montado com o projeto **como estava no último salvamento**, e não como
  está na tela: tirada ou acrescentada uma peça, o relatório (e o PDF e o
  Excel dele) saía com os números velhos até o salvamento automático. Agora
  é o da tela. (Isso também tirou o aviso antigo do lint.)
- No histórico, a exportação do relatório em Excel aparecia como
  "Exportação de PDF"; o rótulo passou a "Exportação de arquivo" (a
  descrição diz qual arquivo).

### Salvar

- **A falha era engolida.** Disco cheio, pasta bloqueada pelo antivírus: o
  Ctrl+S não fazia nada e não dizia nada — quem salvou achava que tinha
  salvado. Agora aparece uma faixa vermelha ("O projeto não foi salvo", com
  o motivo), e a barra de status diz "Não foi salvo".
- **O que deu certo não dizia nada.** A barra de status passou a mostrar
  "Salvo às 14:32" (também depois do salvamento automático).
- **A gravação podia deixar o arquivo pela metade.** Se o programa caísse, ou
  faltasse luz, no meio dela, o arquivo do projeto ficava cortado, e a
  biblioteca deixava de listá-lo — o projeto "sumia". Agora o conteúdo vai
  para um arquivo temporário e só então toma o lugar do antigo; um
  salvamento de cada vez por projeto (o automático e o Ctrl+S podiam
  chegar juntos e se misturar); e tenta de novo quando o Windows segura o
  arquivo por um instante (EPERM/EBUSY). O mesmo para a lista de atalhos
  (Programas). O código do projeto, que vira nome de arquivo, é conferido
  antes de gravar ou excluir.

### Biblioteca e histórico

- **Renomear, Duplicar e Arquivar não apareciam na lista** — às vezes sim,
  às vezes não: a lista era relida do disco ao mesmo tempo que a gravação,
  e podia chegar antes dela. Agora a lista muda na hora, e é relida depois
  de gravado.
- **Abrir outro projeto descartava o que não estava salvo**, sem aviso (até
  um minuto de trabalho, o intervalo do salvamento automático). Agora salva
  antes de trocar, como as Variantes já faziam. Reabrir o próprio projeto
  aberto mostra a versão de agora, e não a da lista.
- **Restaurar uma versão descartava o que estava na tela**, e o restaurar
  também limpa o Ctrl+Z. Agora o que estava na tela vira uma versão do
  histórico ("O que estava na tela antes de restaurar") antes da troca.
- **Todos os projetos do mesmo dia tinham o mesmo código** (ENF-…-001), na
  biblioteca e no nome do arquivo do relatório — os projetos reais têm três
  com o mesmo código. Agora o código é o seguinte do dia. Os antigos ficam
  como estão.

### A seleção e o teclado

- Com várias peças marcadas na lista, **Copiar e Recortar** ficavam ligados
  e não faziam nada (ou agiam só na peça escolhida), enquanto Duplicar e
  Excluir já tratavam todas. Agora copiam, recortam e colam todas.
- Com o foco numa caixinha de marcar da lista (o que acontece ao marcar o
  lote), **Delete, Ctrl+C, Ctrl+Z e os outros atalhos não funcionavam** até
  se clicar no desenho. Agora só os campos de digitar seguram as teclas.

### Exportar PDF

- **Uma margem grande travava o programa**: com metade da folha (105 mm numa
  A4), a área de desenho dava zero e a divisão em folhas virava um laço sem
  fim. Agora a janela recusa a margem que não deixa espaço (até 50 mm na A4)
  e diz por quê; e o que não é número não vira mais 0 sem aviso.
- **O PDF do encaixe saía com folhas em branco a mais** (96 em vez de 88 na
  mesa de demonstração): o nome de uma peça que caía fora da folha fazia a
  biblioteca do PDF abrir folhas novas sozinha, e a numeração para a
  remontagem ficava errada. Corrigido; e cada folha só desenha as peças que
  caem nela.
- **E imprimia a mesa inteira**, mesmo vazia: numa mesa de 10 m com um risco
  de 3 m, mais de cem folhas em branco. Agora vai até a peça mais distante
  (mais a margem de extremidade). O cabeçalho diz o comprimento usado e o da
  mesa.

### Encaixe automático

- **O Cancelar não cancelava.** O cálculo rodava de uma vez no Worker, e a
  mensagem de cancelar ficava na fila até o fim. Agora roda em fatias, com
  uma pausa entre elas: o Cancelar para em menos de um segundo e mostra o
  resultado parcial (na tela: 546 ms, 18 de 151 peças colocadas).
- Fechar a janela no meio do cálculo deixava-o rodando escondido; agora
  para.
- Um erro no cálculo deixava a janela em "Calculando…" para sempre; agora
  ela fecha e diz o erro.
- A quantidade de cópias de uma peça não tinha teto: um zero a mais,
  digitado sem querer, travava o encaixe. O campo vai até 999.

### O tecido: as opções que não tinham efeito

- **"Tem pelo" e "Estampa direcional" não mudavam nada.** As regras estavam
  escritas no domínio desde a etapa 4, mas nunca foram ligadas (risco R-4).
  Agora:
  - a validação avisa o enfesto zigue-zague (que vira o tecido a cada
    camada) num tecido de sentido único, e as peças viradas 180° ou 270°;
  - o encaixe automático não vira peças nesse tecido: usa só 0° e 90°, para
    todas ficarem no mesmo sentido — a janela do encaixe diz isso e mostra
    as rotações que vai usar.
- **A mesa mais larga que o tecido** não era apontada: aviso, ou erro com as
  peças que passam da largura do tecido.

### Outros

- **Editar pontos de curva:** um número enorme de pontos travava o
  programa; o máximo é 2000.
- **Importar contornos (PDF e DXF):** o botão "Importar" ficava desligado
  sem dizer por quê; a janela diz o que falta (o nome, a direção do fio, e
  de quantos contornos).

### Importar DXF

- **As peças dentro de blocos não eram lidas.** É assim que os arquivos de
  molde no padrão AAMA/ASTM guardam cada peça (um BLOCK, posto no desenho
  por um INSERT); o programa só lia o que estava fora dos blocos e, nesses
  arquivos, não achava peça nenhuma. Agora cada INSERT entra com o
  ponto-base do bloco, a escala, o giro e os blocos dentro de blocos (com
  limite, para o arquivo circular não travar); o que está na camada 0 do
  bloco fica na camada do INSERT.
- **Os arcos dentro das polilinhas viravam reta.** O "bulge" (código 42)
  era ignorado: um decote ou uma cava desenhados com arco chegavam como a
  reta entre os dois vértices — a forma mudava sem aviso. Agora entram como
  arco (LWPOLYLINE e POLYLINE clássica). O ARC solto também é lido.
- **O contorno desenhado em pedaços** (linhas e arcos soltos, ponta com
  ponta — comum em DXF feito no AutoCAD) não era reconhecido como peça.
  Agora os pedaços da mesma camada que fecham viram um contorno. Só passa
  por pontas em que se encontram exatamente dois pedaços: numa bifurcação
  não há como saber o caminho, e nada é inventado.
- **As retas internas eram descartadas**, embora a janela de importação
  dissesse que as linhas abertas viram linhas internas. Agora a reta dentro
  de uma peça entra como linha interna dela; a de fora é avisada.

## O que NÃO foi feito

- **O DXF continua sem um arquivo real de outro programa** (risco R-1): os
  blocos, os arcos e os pedaços seguem a especificação pública do formato,
  testados com arquivos montados à mão. As camadas numéricas do AAMA não
  são interpretadas uma a uma: a linha de fio na camada 7 não é reconhecida
  pelo nome (escolhe-se a direção na janela, como antes); os piques
  (camada 4) entram como linhas internas curtas; os furos marcados por
  POINT não são lidos.
- **Tecido listrado ou xadrez**: o casamento do padrão entre as peças não
  foi feito (o R-4 fica aberto nessa parte).
- **Os projetos antigos com código repetido** continuam com ele.
- **O PDF do encaixe vai até o comprimento usado**, e não mais até o fim da
  mesa: é uma mudança de comportamento, de propósito.
- Algumas mensagens ainda usam as caixas do Windows (`alert`/`confirm`):
  começar um projeto novo, excluir um projeto, remover uma imagem, a falha ao
  gerar um PDF. Elas funcionam no programa instalado (ao contrário do
  `prompt`), e ficaram.
- **O instalador não foi refeito**: as correções chegam aos computadores
  depois de publicadas.

## Verificação

- **Testes:** 2189 em 99 arquivos (eram 2115 em 95); tipos e lint limpos.
  Novos: a gravação sem corromper e a fila de gravações; o código do
  projeto; o sentido do tecido, as rotações no encaixe e a validação do
  tecido; o pique ao inserir ponto; o encaixe em fatias e o Cancelar; a
  margem e o comprimento do PDF, e as folhas em branco; o limite de pontos;
  o campo de digitar; a barra de status com o salvamento; a janela de
  exportar e a de importar; o DXF com blocos, bulge, ARC, pedaços e retas.
- **Mutações** na lógica nova (a gravação, o código do projeto, o sentido do tecido, a validação do tecido, o pique ao inserir ponto, o encaixe em fatias, a margem e o comprimento do PDF, o campo de digitar, o limite de pontos, o DXF, as janelas de exportar e de importar, a mensagem do salvamento): 68, uma por vez, com o código conferido por hash antes e depois. Na primeira rodada, 58 pegas; as 8 que sobreviveram e as 2 que não rodaram direito apontaram testes que faltavam (o erro de disco cheio que não deve ser repetido, o código de outro dia e a ordem, o pique de outra aresta, a pausa a cada fatia, o encaixe que viraria a peça 180° num tecido com pelo, o centro do arco de bulge negativo, a margem no limite da folha); com eles, 67 de 68. A que sobra é equivalente: o texto do nome da peça já não cai fora da folha, porque cada folha só desenha as peças dela — o `lineBreak: false` ficou como segunda proteção.
- **Na tela, com o programa gerado:**
  - a varredura dos 139 botões das abas, dos 15 itens de menu e dos 11 da
    barra de acesso rápido: nenhum erro de página nem de console (antes:
    Salvar como, Elemento paralelo e Girar davam erro; Arredondar ou
    chanfrar dava erro no clique do canto);
  - os fluxos: 72 conferências, 0 falhas — entre elas, o projeto salvo com
    outro nome, o giro de 90° no sentido anti-horário, o chanfro de 20 mm
    (2 cm² a menos) e o arredondamento de 30 mm, o ponto que não nasce longe
    do contorno, o lote copiado e excluído pelo teclado, a margem de 105 mm
    recusada, os PDFs e o Excel gravados, o relatório que muda sem salvar, o
    encaixe calculado no Worker e o Cancelar em 546 ms, a biblioteca que
    mostra na hora, o trabalho não salvo que volta ao reabrir o projeto, a
    versão "O que estava na tela antes de restaurar";
  - o DXF com duas peças num bloco (uma girada 90°) com arco de bulge e uma
    em linhas soltas: as três entraram, com 1553 cm² (o retângulo e o meio
    círculo) e 600 cm².
- **Projetos reais** (6, em cópias): a validação nova não deu nenhum aviso
  falso; os originais ficaram intactos (mesmo MD5) e o diagnóstico real sem
  linhas novas.
