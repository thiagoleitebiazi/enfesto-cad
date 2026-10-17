# ADR 0085 — 3 mm entre os moldes

## Contexto

Pedido: "criar espaço de 3 mm de distância entre os moldes" no encaixe
(nesting). O programa já tinha a "distância mínima entre peças" no diálogo do
Enfesto (5 mm nos projetos criados até aqui), mas:

- **A distância pedida não era a que saía.** O encaixe procura lugar de 10 em
  10 mm (a grade de `posicionamento.ts`), e o primeiro lugar livre ficava até
  um passo inteiro além da distância mínima: com 3 mm pedidos, as peças
  ficavam a 3 a 13 mm umas das outras — em geral perto de 10.
- **A distância era medida pelo contorno, e não pela linha de corte.** Numa
  peça com costura, a linha de corte fica fora do contorno (10 mm, por
  exemplo); "3 mm entre os moldes" deixava as linhas de corte de duas peças
  vizinhas sobrepostas, e a validação não apontava. O mesmo nos limites da
  mesa (a costura podia passar da borda) e nas contas do tecido gasto.
- **O lugar de mudar a distância era só o diálogo do Enfesto**, longe da
  janela do encaixe.

## Decisão

### A peça é encostada até a distância pedida

- Achado o lugar livre na grade, a peça anda — no comprimento, na largura e
  no comprimento de novo — na direção do começo da mesa, até ficar à
  distância mínima das vizinhas (ou no limite da área). Em cada direção ela
  anda no máximo um passo da grade, e o ponto certo é achado dividindo o
  caminho ao meio 12 vezes (≈ 0,002 mm). Nunca sai de um lugar livre para um
  ocupado.
- Fica uma folga de 0,01 mm acima da distância pedida: as contas com vírgula
  não a deixam um fio abaixo, e a validação não reclama da peça que o próprio
  encaixe pôs. Com 3 mm pedidos, as peças ficam a 3,01 mm.
- Vale para o encaixe automático, o "Sugerir posição" e as peças que chegam
  de uma importação (que usam a mesma busca).
- De quebra, cada conferência pula as peças cuja caixa está longe demais
  para encostar: o encaixe ficou mais rápido (151 cópias numa mesa de 1 m:
  antes passava de 1,2 s, agora termina antes disso).

### A distância é de linha de corte a linha de corte

- `linhaDeCorteDaPeca` (em `molde.ts`): a linha de corte, ou o contorno
  quando não há costura (ou quando o contorno é inválido — esse já tem o
  aviso dele).
- Passam a usá-la: o encaixe (o lugar, a distância, os limites, o
  comprimento usado e o aproveitamento), o "Sugerir posição", a validação
  (sobreposição, distância, limites da mesa e a largura do tecido), o
  relatório e o aproveitamento da barra de status (o tecido gasto), e o PDF
  do encaixe (o comprimento impresso).
- **O PDF de moldes individuais enquadra a linha de corte.** Enquadrando o
  contorno, a costura (que fica fora dele) saía cortada na beira da folha.
  Com isso, a peça importada de volta desse PDF vem com o canto da linha de
  corte no canto da folha (antes era o do contorno): a posição de quem chega
  de uma importação é refeita de qualquer jeito.

### 3 mm como padrão, e o campo na janela do encaixe

- `DISTANCIA_PADRAO_ENTRE_PECAS_MM = 3`: a mesa de demonstração, o projeto
  novo e o diálogo do Enfesto sem configuração começam com 3 mm.
- A janela do encaixe automático ganhou o campo **"Distância entre os
  moldes (mm)"**, que começa com a do enfesto do projeto. O valor escolhido
  passa a ser o do enfesto (fica no histórico como mudança de configuração),
  para a validação medir com ele. Aceita vírgula; o que não é número, ou é
  negativo, é recusado com o motivo.
- No diálogo do Enfesto, o campo passou a se chamar "Distância entre os
  moldes (mm), de linha de corte a linha de corte".

## O que NÃO foi feito

- **Os projetos que já existem continuam com a distância deles** (5 mm, nos
  projetos deste computador). Para 3 mm, basta pôr 3 no campo da janela do
  encaixe e calcular de novo.
- **O encaixe continua sendo "o primeiro que couber"** (risco R-3): a peça é
  encostada nas vizinhas, mas a ordem e o lugar de cada uma continuam os da
  varredura; não há busca de uma arrumação melhor.
- As peças cortadas em duas com costura (as duas partes de um "Cortar", lado
  a lado) passam a aparecer como sobrepostas, porque as linhas de corte
  delas se sobrepõem de fato: precisam ser afastadas antes de cortar.

## Verificação

- **Testes:** 2199 em 99 arquivos (eram 2189); tipos e lint limpos. Novos:
  as peças a 3 mm (e não a 10) no encaixe, e a validação sem queixa delas;
  distância 0 (encostadas); com costura, as linhas de corte a 3 mm e os
  contornos a 23; o aproveitamento pela linha de corte; a sobreposição e a
  distância pela linha de corte, e a costura que passa da borda da mesa; o
  relatório e o aproveitamento da mesa pela linha de corte; o "Sugerir
  posição" com costura; o campo da janela do encaixe (vírgula, recusa).
- **Mutações** (o encosto, a linha de corte em cada lugar que a usa, o
  campo): 20, uma por vez, com o código conferido por hash antes e depois;
  19 pegas na primeira rodada — a que sobrou apontou o teste que faltava (o
  "Sugerir posição" com costura) e, com ele, 20 de 20.
- **Na tela, com o programa gerado:** o campo vem com 3 mm na mesa de
  demonstração; as duas peças de teste ficaram a 3,01 mm (TESTE-2 em
  x = 403,01, depois dos 400 da TESTE-1); com 8 mm, a 8,01 mm, e o enfesto
  guardou os 8; com 10 mm de costura nas duas e 3 mm, os contornos a
  23,01 mm (as linhas de corte a 3,01); a validação sem problemas em todos.
  O roteiro dos fluxos (ADR 0084) de novo: 72 conferências, 0 falhas.
