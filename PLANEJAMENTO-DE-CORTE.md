# Planejamento de corte — como usar

Do molde ao plano de enfesto, e do plano ao estoque. A janela fica em
**Encaixe → Planejamento de corte**; dentro dela, "Como usar" e "Limitações
conhecidas" repetem o essencial deste texto.

Unidades: na tela, metro (m) para comprimentos de mesa, risco e rolo,
centímetro (cm) para margens, alturas, larguras de defeito e repetição do
desenho, quilo (kg) para peso, m/kg para rendimento. Por dentro, o programa
guarda tudo em mm e g.

## O caminho

1. **Molde** — as peças de cada tamanho, a quantidade por roupa, a revisão
   do molde. Problemas de peça (contorno inválido, tamanho sem peça) aparecem
   com o botão "Abrir a peça".
2. **Ordem** — o código, o produto, a cor, o prazo e a quantidade por
   tamanho. Três jeitos de entrar: digitar; colar a grade de uma planilha;
   importar um CSV (abaixo). "Guardar a ordem no cadastro" a deixa para os
   próximos planos.
3. **Malha e rolos** — a malha (largura útil, rendimento ou gramatura,
   encolhimento por direção e a fonte do valor, padrão e, se listrado ou
   xadrez, a repetição e a fase do desenho; o tipo de tecido e o custo, os
   dois opcionais — ver "Custo do tecido") e o material: um peso disponível,
   ou os rolos do estoque.
4. **Risco e enfesto** — o tipo de enfesto, de onde vem o risco (gerado
   pelo programa, tirado da mesa, ou informado à mão), a configuração, a
   compensação do encolhimento e o casamento do desenho.
5. **Alternativas** — "Calcular as alternativas" faz os riscos e as
   composições; a tabela compara consumo, enfestos e excedente; o desenho
   mostra cada risco em escala.
6. **Revisar e confirmar** — ajustes (camadas por risco, camadas por
   enfesto, mesa), quem confirma (informado) e a confirmação em dois cliques.
   "Salvar rascunho" guarda sem confirmar.
7. **Planos deste projeto** — os planos guardados, com os valores de então.
   No plano confirmado com rolos fica o **estoque do plano** (abaixo).

O programa nunca muda a ordem sozinho: o que falta ou sobra por tamanho é
mostrado (pedido, planejado, excedente, falta, e o que dá com o material
que há).

Na tela: cada etapa mostra se está com os dados completos (✓) ou se falta
dado (⚠); os campos obrigatórios têm *; o erro de um campo aparece logo
abaixo dele (depois que se passa por ele), além da lista do que falta na
etapa; e o botão em azul é a ação principal da etapa.

## Importar ordens por CSV

Uma linha de cabeçalho e uma linha por ordem. O separador é ponto e vírgula
(o do Excel em português), vírgula ou tabulação — o do cabeçalho vale para
o arquivo todo.

```
codigo;produto;cor;prazo;observacoes;molde;revisao;P;M;G;GG
OP-100;Camiseta básica;Azul;2026-11-30;;ENF-20261020-001;1;10;20;20;10
OP-101;Camiseta básica;Preta;30/11/2026;urgente;;;5;10;10;5
```

- **codigo** é obrigatória. **produto**, **cor**, **prazo** (AAAA-MM-DD ou
  DD/MM/AAAA), **observacoes**, **molde** (o código do projeto aberto) e
  **revisao** (um número de revisão registrada do molde) são opcionais. Os
  nomes das colunas valem com ou sem acento e maiúscula.
- As outras colunas são **tamanhos**: a quantidade de cada um, inteira, 0 ou
  mais. Vazio vale 0. O tamanho que o molde não tem é erro.
- Campos com o separador dentro vão entre aspas: `"Camiseta; manga longa"`.
- **Tudo ou nada**: com um erro em qualquer linha, nenhuma ordem entra, e
  cada erro diz a linha (a 1 é o cabeçalho). Uma ordem que já está no
  cadastro é recusada (para mudá-la, use a tela). A ordem de outro molde é
  recusada (abra o projeto dela).
- A ordem importada fica ligada a este projeto e à revisão (a da linha, ou a
  das peças de agora).

**ERP:** nenhum está ligado. O código tem o lugar para uma fonte de ordens
(`FonteDeOrdens` em `src/domain/importacaoDeOrdens.ts`): ela entrega as linhas
e a mesma conferência do CSV vale para elas. Para ligar um ERP de verdade
faltam o endereço do serviço, a forma de autenticação, o mapeamento dos
campos (código, tamanhos, molde) e a rede da fábrica — nada disso foi
inventado.

### Testar uma importação

1. Salve o exemplo acima num arquivo `ordens.csv`, trocando `ENF-...` pelo
   código do projeto aberto (aparece na etapa 1. Molde: "Projeto ENF-…") e
   os tamanhos pelos do seu molde (ou apague as colunas molde e revisao).
2. Na etapa **2. Ordem**, em "Importar ordens (CSV)", escolha o arquivo.
3. Certo: a mensagem diz quantas ordens entraram, e a primeira vem para o
   formulário. Errado: a lista diz a linha e o problema, e nada entrou.

## Estoque

Cada rolo tem, separados:

| | O que é |
|---|---|
| **Saldo físico** | o comprimento do rolo menos o que já teve baixa |
| **Reservado** | o que planos confirmados reservaram e ainda não cortaram |
| **Consumido** | o que teve baixa (o corte foi feito) |
| **Disponível** | saldo físico menos o reservado |

O comprimento do rolo é o medido, ou peso × rendimento (aí é dito
"estimado pelo peso").

No plano confirmado com rolos, em **Planos deste projeto**:

- **Reservar os rolos do plano** — reserva o que o plano usa de cada rolo.
- **Dar baixa (o corte foi feito)** — registra o consumo; a reserva do mesmo
  plano deixa de contar.
- **Estornar** — desfaz um movimento; pede o motivo. O movimento estornado e
  o estorno ficam no histórico (nada é apagado).

Nada se move sem o clique. Repetir não reserva nem baixa duas vezes (a
mensagem diz "já estava feito"). Um rolo sem disponível suficiente recusa o
movimento inteiro (tudo ou nada). Cada movimento guarda o plano, o rolo, o
comprimento (e o peso, quando há rendimento), a data e quem fez (informado —
o programa não tem login).

Ao planejar, o que outros planos já reservaram ou consumiram de um rolo sai
do começo dele: o plano novo começa depois (coluna "Já usado por outros
planos"). A tabela dos rolos na etapa 3 mostra disponível / reservado /
consumido.

## Execução do corte (sala de corte)

O plano confirmado é o **planejado**; a execução é o **feito**. Em **Planos
deste projeto**, abra o plano confirmado: abaixo do estoque fica a seção
**Execução do corte**, e o título do plano mostra a situação dela.

1. **Liberar para o corte** — o plano vai para a sala de corte (guarda quem
   liberou e quando).
2. **Começar o corte** — guarda quem corta e a hora do começo.
3. **Concluir o corte** — com o que de fato aconteceu:
   - as **camadas enfestadas** (vem com as do plano);
   - o **consumo real de cada rolo** — o que saiu dele: as camadas e as
     pontas (vem com o que o plano usa; com vírgula, em metros). No plano por
     peso, sem rolos, o consumo real é um total;
   - **a sobra vira retalho** — marque nos rolos cuja sobra foi guardada como
     retalho: o rolo continua no estoque, com o saldo dele, e aparece como
     "(retalho)" na escolha dos rolos de um plano novo;
   - observações (opcional).
4. **Cancelar** (antes de concluir) — pede o motivo; a execução cancelada
   fica no registro e o plano pode ser liberado de novo.

Ao concluir um plano com rolos, a **baixa do estoque passa a ser a do consumo
real**: se a baixa planejada já tinha sido dada, ela é estornada (com o motivo
"Trocada pela baixa do consumo real") e a do real entra no lugar; a reserva de
um rolo que o corte não usou (consumo real zero) é estornada. Nada é apagado:
os movimentos ficam no histórico do estoque. Tudo ou nada: um consumo maior
que o saldo do rolo, um número inválido ou camadas erradas não mudam nada, e a
mensagem diz o quê.

Concluído, aparece o **planejado × executado**: camadas, consumo de malha
(com a diferença em metros e em %), consumo por camada e o tempo do corte
(do começo à conclusão), e a tabela por rolo (planejado, real, saldo agora,
retalho ou não). As horas, as camadas e o consumo são os **informados** por
quem opera: o programa não se liga a máquina nenhuma (enfestadeira, faca,
plotter) e não tem login. O corte concluído não se cancela (o estoque já
saiu): para corrigir, estorne os movimentos no estoque.

## Defeitos dos rolos

Cada defeito tem a **extensão** no comprimento do rolo (m), e pode ter a
**posição** (m, do começo do rolo), a **largura afetada** (cm) e o **tipo**
(furo, mancha, fio puxado, barramento, falha de tinturaria, outro).

- **Com posição**, o plano evita o defeito: a camada que passaria por ele
  começa depois. O trecho pulado aparece no plano ("Pulado por defeito").
  A largura afetada é registrada, mas a camada pula o trecho inteiro.
- **Sem posição**, o plano não tem como evitá-lo: ele **bloqueia** até que
  quem planeja marque "Usar os rolos com defeito sem posição" — o
  comprimento do defeito sai do rolo, e o plano diz que ele **não** foi
  evitado.

## Emendas

Desligadas por padrão. Com "A enfestadeira/o processo permite emendar uma
camada" marcado (etapa 4), a camada que não cabe no que resta do rolo — até
o fim dele, ou até um defeito com posição — continua no rolo seguinte, numa
linha do risco que não corta peça, com a sobreposição configurada (padrão
10 cm). O plano lista cada emenda (risco, de qual rolo
para qual, a posição no risco, a sobreposição) e soma as sobreposições às
perdas. O risco informado à mão não tem as peças: nele não há emenda.

## Encolhimento

A malha guarda o encolhimento no comprimento e na largura (%), a fonte do
valor (ensaio de lavagem, fornecedor, estimativa) e se ele **já está
compensado no molde**.

- Já compensado no molde: o plano não aplica nada (nunca duas vezes).
- Não compensado: o plano avisa. Na etapa 4, "Ver a prévia da compensação no
  risco" mostra as peças antes e depois; só "Aplicar a compensação ao risco"
  liga a compensação. O risco é feito na largura da malha dividida pelo fator
  e aumentado (comprimento × 1/(1 − e/100), largura idem), para caber.
- A peça não muda no projeto; o plano registra os fatores usados.
- Não se aplica ao risco informado à mão (ele já é a medida do corte).

## Listras e xadrez

Para o programa casar o desenho:

- o cadastro da malha precisa da **repetição** do desenho (no comprimento,
  na largura, ou nos dois) e, se houver, da **fase** (onde o desenho começa);
- cada peça precisa de uma marca com o rótulo **casamento** (aba Marcações)
  no ponto que deve cair no desenho;
- as camadas precisam ser estendidas com o desenho alinhado (mesa de
  agulhas, por exemplo).

O risco põe o ponto de cada peça na repetição, só a 0° ou 180° (as peças não
deitam), e confere depois de posto. Sem a repetição, ou sem a marca em alguma
peça, o risco não sai: o plano só continua com a decisão "o casamento será
feito à parte", e aí avisa que o risco precisa ser conferido à mão.

## O encaixe (o risco)

O risco do planejamento usa os **pontos de canto**: cada peça vai para o
primeiro lugar livre entre os cantos das já postas, na orientação permitida
em que ela termina mais perto do começo da mesa, e é encostada nas vizinhas
até a distância pedida. Três ordens de entrada; fica o risco mais curto. É a
**melhor alternativa encontrada**, não a ótima.

A distância entre as peças é garantida na linha de corte verdadeira: as
curvas são simplificadas para as contas (até 0,2 mm da linha), e essa
diferença é somada à distância (com curvas, ela fica até 0,4 mm acima da
pedida). A busca tem tempo máximo, mostra o progresso e pode ser cancelada;
o que não saiu no tempo é dito.

Medido neste computador (camiseta: frente, costas, manga em par, gola; mesa
de 1,60 × 30 m; 3 mm entre peças):

| Roupas | Pontos de canto | Grade (padrão) |
|---|---|---|
| 1 | 0,88 m, 0 de fora | 0,88 m, 0 de fora |
| 2 | 1,77 m, 0 de fora | 1,74 m, 0 de fora |
| 4 | 3,43 m, 0 de fora | 2,42 m, **8 peças de fora** |
| 6 | 4,93 m, 0 de fora | 2,42 m, 16 de fora |
| 10 | 8,25 m, 0 de fora | 2,42 m, 33 de fora |
| 16 | 13,29 m, 0 de fora (1,8 s) | 2,42 m, 63 de fora (19 s) |

O aproveitamento dos pontos de canto ficou entre 77,9% e 83,8%. A grade para
em 20 000 posições por peça (perto de 2,4 m nesta largura). Em riscos curtos
ela às vezes é mais curta (2 roupas: 1,74 m × 1,77 m). A comparação dos dois
nos mesmos casos é reproduzível: `src/domain/comparacaoDosMotores.test.ts`.

No **Nesting Automático** da aba Encaixe, a busca em grade continua sendo o
padrão; "Pontos de canto" é uma opção ("Método do encaixe").

## O que é configurável

Na etapa 4 (guardado para os próximos planos):

| Premissa | Padrão |
|---|---|
| Margem no começo / no fim da mesa | 10 cm / 10 cm |
| Pontas por camada | 2 cm |
| Perda por rolo | 0 |
| Folhas por enfesto (máximo) | 100 |
| Altura máxima / peso máximo do enfesto | sem limite (informe) |
| Comprimento da mesa | 12 m |
| Largura da mesa | sem (informe para a área da mesa física) |
| Roupas por risco (máximo) | 6 |
| Distância entre as peças | 3 mm |
| Tolerância de rendimento | 5% |
| Tempo da busca dos riscos | 30 s |
| Emenda permitida / sobreposição | não / 10 cm |

**Bloqueia** (não deixa calcular nem confirmar): o que falta para calcular,
rolo mais estreito que todos os riscos, rolo todo usado por outros planos,
lotes misturados sem a decisão, defeito sem posição sem a decisão, listras
sem o casamento e sem a decisão, compensação incoerente com os riscos.
**Avisa** (aparece no plano): divergência de rendimento, encolhimento não
compensado, defeitos não evitados, emendas, enfesto com lotes misturados.
**Estimativa** (dita como tal): comprimento pelo peso, consumo, sobra.

## Custo do tecido (estimativa)

Opcional: sem o custo, o plano é o mesmo, e a parte do custo diz "Não
informado" (nenhum valor aparece como R$ 0,00).

- **Onde informar:** no tecido do projeto (**Encaixe → Tecido**: tipo de
  tecido, custo, unidade do custo e rendimento, todos opcionais) ou na malha
  do planejamento (etapa 3). O tecido do projeto já entra na malha.
- **O custo:** em reais, até 2 casas (os centavos), de 0 para cima, **por
  metro linear** (o metro da malha como é comprada — na tubular, o metro de
  tubo) **ou por quilo**. A unidade tem de ser escolhida: o programa não
  presume. O custo por quilo vira custo por metro pelo rendimento (m/kg) do
  plano; numa malha tubular, só com o rendimento informado (o calculado pela
  gramatura conta uma folha, e o tubo tem duas).
- **O tipo de tecido:** "Não informado", "Ramado (aberto)" ou "Tubular" (é
  o tipo do tecido, não o do enfesto). Ele substitui a antiga caixa "Malha
  tubular": a malha antiga marcada como tubular aparece como "Tubular"; a não
  marcada, como "Não informado".
- **A área:** a área real do contorno de cada peça (a linha de corte, com a
  costura), na forma de cada tamanho — não o retângulo em volta. Uma roupa
  tem as peças com a quantidade por roupa (o par conta as duas); cada tamanho
  tem a sua.
- **As contas** (aparecem em "Como o custo foi estimado", no plano):
  - malha por metro = largura na mesa × folhas por camada (aberta: a largura
    útil; no par, 2 folhas de meia largura; na tubular, 2 folhas do tubo
    achatado — só no enfesto tubular);
  - custo por m² = custo por metro ÷ malha por metro;
  - custo direto por roupa = área da roupa × custo por m²;
  - custo do enfesto = consumo das camadas (com as pontas) × custo por metro;
  - área não aproveitada = malha do enfesto − peças cortadas: as pontas, a
    faixa da largura fora do risco e os espaços entre as peças. Não é sobra
    reaproveitável;
  - **custo médio por unidade** = custo do enfesto ÷ unidades produzidas;
    **por tamanho**, o custo direto da roupa mais a parte da área não
    aproveitada, na proporção da área. Os dois somam o custo do enfesto: a
    perda não é contada duas vezes.
- **Fora do custo do enfesto** (mostradas à parte): perda dos rolos,
  trechos pulados por defeitos, sobreposição das emendas. A sobra dos rolos
  volta para o estoque.
- **Quando não calcula** (e diz por quê): sem o custo; por quilo sem
  rendimento; malha tubular em enfesto que não é tubular (ou o contrário);
  tipo não informado no enfesto tubular; peças passando a área do risco.
- O plano guardado leva a estimativa de então; os planos de antes dela dizem
  que não a têm (não são recalculados).

## Onde ficam os dados

- **Projetos** e **planos**: os arquivos da Biblioteca, como antes.
- **Cadastro de produção** (malhas, rolos, ordens, movimentos de estoque,
  execuções do corte): `cadastro-de-producao.json` na pasta de dados do
  programa. A gravação não deixa o arquivo pela metade (vai para um temporário
  e troca); a versão anterior fica em `cadastro-de-producao.json.anterior`. Se
  o arquivo sumir ou quebrar, o programa abre a versão anterior e diz. O
  cadastro de uma versão mais antiga do formato (1 ou 2) ganha uma cópia em
  `copias-de-seguranca` antes de ser gravado na versão atual (3, com as
  execuções do corte); um arquivo com registros que não se leem é copiado
  inteiro para lá antes de eles ficarem de fora.

## Projetos e planos antigos

- O cadastro antigo (versão 1) abre com o histórico de estoque vazio; os
  defeitos sem posição continuam sem posição (o plano novo pede a decisão). O
  da versão 2 abre sem execuções do corte e sem rolos marcados como retalho.
- **Rendimento da malha tubular pela gramatura** (corrigido, ADR 0098): ele
  conta as duas folhas do tubo achatado — antes contava uma, e um quilo de
  malha tubular rendia o dobro dos metros. Os planos novos e o comprimento dos
  rolos pelo peso usam a conta certa; os planos já confirmados continuam como
  foram guardados (não são recalculados): confira os que usaram malha tubular
  sem o rendimento informado.
- Os planos já guardados abrem como foram guardados, sem recalcular, e não
  ganham colunas vazias (emendas, uso anterior, trecho pulado só aparecem
  quando há). Os da primeira versão do cálculo só podem ser vistos.
- Nenhum plano antigo movimenta o estoque sozinho: a reserva e a baixa são
  feitas no plano confirmado, pelo botão.
- Os planos de antes da estimativa de custo dizem que não a têm; as malhas e
  os tecidos de antes abrem sem o tipo e sem o custo ("Não informado").

## Limitações conhecidas

- O encaixe e a composição são heurísticos: nem o menor risco nem a melhor
  composição são garantidos.
- **Login:** não há; o responsável é digitado e aparece como "informado".
- **Banco de dados:** não há; tudo fica em arquivos deste computador, não
  compartilhados entre computadores.
- **ERP:** nenhum ligado (ver acima o que falta).
- Defeito: a largura afetada não é usada para aproveitar o resto da largura.
- Emenda só nas linhas do risco sem peça cortada (riscos gerados ou da mesa).
- Casamento por um ponto por peça; mais de um ponto não é feito.
- **Custo:** estimativa só do tecido, em reais, com o consumo planejado (não
  há consumo medido por peça); a largura aberta de uma malha tubular não é
  presumida.
- **Execução do corte:** o consumo real é por rolo (ou o total, sem rolos),
  não por peça; as horas são as dos cliques (começar, concluir), não as de uma
  máquina; não há fila de cortes entre várias estações nem ligação com
  enfestadeira, faca ou plotter.
- **Formatos de molde:** DXF (LWPOLYLINE, POLYLINE clássica, LINE e ARC
  soltos que fecham, CIRCLE como furo, SPLINE, blocos com INSERT e escala;
  unidade pelo `$INSUNITS` — mm, cm, m, polegada, pé —, a desconhecida
  presumida em mm com aviso) e PDF vetorial. Testados com arquivos sintéticos
  escritos pela especificação (`src/formats/formatosSuportados.test.ts`) e com
  dois arquivos reais de outro programa de modelagem (AutoCAD 2018, em cm, um
  com curvas e o outro com polilinhas, tudo numa camada). A importação é
  direta: as peças entram com o nome do arquivo e o fio na horizontal (a que
  vem com a linha de fio em outra direção é girada até ela ficar deitada).
