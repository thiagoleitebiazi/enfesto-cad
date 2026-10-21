# ADR 0091 — Margem de segurança de 4 mm, fio só na horizontal, importação direta e seleção com o mouse e o Ctrl

## Contexto

Pedido do usuário (quatro itens):

1. "a mesa precisa ter 4 milímetro de margem de segurança";
2. "deixe somente a opção do fio na horizontal";
3. "ao importar deve importar direto sem a necessidade de colocar nome, e fio";
4. "permita selecionar peças ao clicar e arrastar o mouse, coloque o ctrl para poder clicar na peça e selecionar mais
   de uma segurando o ctrl".

Como estava: a mesa de um projeto novo começava com margem zero (as peças podiam encostar na borda); a importação
abria uma janela de confirmação (ADR 0030) em que cada contorno pedia nome e a direção do fio ("vertical na tela" ou
"horizontal na tela"); no Selecionar, o clique pegava uma peça só, o arrasto movia essa peça e o clique no vazio só
tirava a seleção — várias peças só pelas caixas da lista ou pelo Ctrl+A.

## Decisão

### A margem de segurança da mesa

`MARGEM_DE_SEGURANCA_DA_MESA_MM = 4` (`domain/enfesto.ts`). `margensDaMesa` dá as margens que valem — as
configuradas, nunca menos que 4 mm — e `areaUtilDaMesa`, a área em que as peças podem ficar. Elas são usadas no
encaixe automático (os dois motores), no Sugerir posição, na validação ("fora dos limites"), no desenho da área útil,
na posição das peças importadas, no comprimento impresso do encaixe e no "Ajustar o enfesto" do plano (a mesa fica,
no mínimo, até as peças mais a margem). Projetos novos e a mesa de começo já têm 4 mm. O painel do Enfesto mostra as
margens "a partir de 4", abre um projeto de antes (gravado com zero) mostrando 4, e recusa menos que isso dizendo por
quê. A validação do domínio continua aceitando zero no arquivo: os projetos de antes abrem como estão, e a margem de
segurança vale do mesmo jeito.

### O fio só na horizontal, e a importação direta

A janela de confirmação da importação saiu (`DialogoDeImportacaoDeContornos`, com a miniatura do ADR 0090). O
arquivo vira peças na hora (`formats/importacaoDireta.ts`):

- **DXF:** o nome é o do arquivo (`arquivo-1`, `arquivo-2`…; só o nome, quando há uma peça), sem tamanho. A peça
  sem linha de fio no arquivo recebe uma, deitada, no meio dela. A que tem a linha de fio do arquivo em outra direção
  é **girada** até ela deitar (`comOFioNaHorizontal`, `domain/molde.ts`: o menor giro, a seta para qualquer um dos
  lados; a orientação que sai é a de origem da peça) — só trocar a seta, sem girar, faria cortá-la fora do fio. O
  conjunto vai para o canto da mesa, depois da margem de segurança.
- **PDF de outro programa:** os contornos fechados viram peças no tamanho do papel (1:1), com o nome do arquivo e o
  fio deitado; a mensagem diz o que ficou de fora e lembra do Dimensionar, se o PDF não estava em tamanho real.
- **PDF deste programa:** como antes (o registro da peça); a peça sem linha de fio entra com ela deitada.

A mensagem da importação diz quantas peças entraram, os nomes, que o fio ficou na horizontal, as que foram giradas e
os avisos do arquivo. A importação é um passo do Desfazer e uma versão do histórico, como antes.

### A seleção

No Selecionar (`ui/AreaDeDesenho.tsx`, regras em `domain/selecao.ts`):

- arrastar no vazio desenha um retângulo; ao soltar, as peças **inteiras** dentro dele são a seleção (uma só vira a
  seleção única; várias, o lote); o clique no vazio, sem arrastar, só tira a seleção;
- Ctrl+clique (⌘ no Mac) numa peça a põe na seleção ou a tira; Ctrl+arrastar no vazio soma as peças do retângulo às
  que já estavam;
- arrastar uma das peças selecionadas leva todas, o mesmo tanto, num passo só do Desfazer; arrastar uma peça fora da
  seleção a seleciona sozinha e leva só ela.

A lista de atalhos (F1) e a dica do Selecionar dizem isso.

## O que NÃO foi feito

- O retângulo seleciona só as peças inteiras dentro dele (não as que ele só toca).
- As ferramentas de desenhar e de redesenhar o fio ("Sentido do fio") continuam livres, por cliques: o pedido do fio
  na horizontal foi aplicado à importação, onde estava a única escolha de direção.
- A peça girada na importação pode ficar em cima de outra do mesmo arquivo; a validação aponta.

## Verificação

- **Testes:** 2535 em 124 arquivos (eram 2519); tipos e lint limpos; build feito. Novos ou mudados: a margem de
  segurança (a validação nos quatro lados com as margens configuradas em zero, o canto do Sugerir posição e do encaixe
  a 4 mm, o comprimento impresso, o `enfestoDoPlano`, o painel do Enfesto — o projeto de antes mostra 4, abaixo de 4 é
  recusado, com 4 salva), a importação direta (o nome do arquivo, o fio deitado, a peça com o fio em pé girada 90° e
  com a orientação de origem, o menor giro, o pique levado, o PDF de outro programa no tamanho do papel e o nome da
  peça única) e a seleção (o Ctrl+clique, o retângulo com e sem o Ctrl, só as peças inteiras, o clique no vazio, o
  ⌘ do Mac, o grupo arrastado junto, a peça de fora do grupo). Os números medidos da comparação dos motores andaram
  4 mm (o mesmo encaixe, depois da margem).
- **Mutações:** 26 no código deste ADR, uma por vez, com o código conferido por hash antes e depois, e todas
  aplicadas (nenhuma com "ocorrências: 0"): as 26 pegas.
- **Na tela, com o programa gerado** (pasta de dados separada): o roteiro novo, 13 conferências, 0 falhas — o
  conjunto importado a 4 mm das bordas, o Enfesto com as margens a partir de 4 e a de 2 mm recusada, o retângulo
  arrastado com o mouse de verdade selecionando as duas peças, o Ctrl+clique tirando e pondo uma, o grupo arrastado
  junto e desfeito num Ctrl+Z, o clique no vazio, e um DXF com o fio em pé importado direto e girado (300 mm ao longo
  do fio na horizontal, fio deitado, ângulo de origem 0). Os dois DXF reais (cópias, apagadas depois): 5 peças cada,
  direto, com o nome do arquivo, o fio deitado sem girar nenhuma, as áreas de sempre, o pique e o conjunto a 4 mm. O
  roteiro dos fluxos: 74 certas, 0 falhas (o PDF de outro programa importado direto); o do planejamento e o dos
  planos: 0 falhas; a varredura dos botões: a mesma, menos a janela da importação, que agora importa (e o Ctrl+Z
  desfaz). Os roteiros passaram a importar o DXF de teste direto e a renomear as peças pela janela de Propriedades.
- **Dados reais:** os 9 projetos com as mesmas impressões, o diagnóstico com 1536 linhas, os dois DXF da pasta
  Downloads iguais.
