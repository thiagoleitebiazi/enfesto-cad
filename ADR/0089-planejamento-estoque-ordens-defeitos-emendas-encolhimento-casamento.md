# ADR 0089 — Planejamento de corte: estoque, ordens por CSV, defeitos, emendas, encolhimento e casamento

## Contexto

Pedido: continuar o planejamento de corte a partir de `f78a2fe` e `b04959a`
(ADR 0088), sem recomeçar nem tirar o que existe e sem publicar nada, até o
fluxo de produção funcionar de ponta a ponta — molde e ordem, plano de
encaixe, mesa, enfesto e o estoque —, com cadastro, validação, persistência e
as restrições do material.

A auditoria partiu da lista "O que NÃO foi feito" do ADR 0088 e separou:

- **Feito com o código e os dados que há:** ordens importadas de arquivo;
  reserva, baixa e estorno do estoque; posição dos defeitos; emendas;
  compensação do encolhimento; casamento de listras e xadrez; o motor do
  risco no Nesting Automático (como opção); a matriz dos formatos de molde
  declarados; a recuperação do arquivo do cadastro.
- **Depende de credencial, formato ou decisão de fora:** ligar um ERP
  (endereço, autenticação, mapeamento dos campos, rede); login (um serviço de
  identidade); banco de dados compartilhado (a decisão de ter um servidor);
  arquivos reais de outros CADs (os arquivos).
- **Fora do escopo deste pedido:** garantia de encaixe ótimo; casamento por
  mais de um ponto da peça; aproveitar o resto da largura ao lado de um
  defeito.

Feito em dois commits: o domínio (`dee6ad6`) e a tela, a documentação e o que
as mutações mostraram (o commit deste ADR).

## Decisão

### Ordens por CSV (`importacaoDeOrdens.ts`)

Formato documentado no código, na tela e em `PLANEJAMENTO-DE-CORTE.md`:
cabeçalho, uma ordem por linha, separador `;`, `,` ou tabulação; colunas
conhecidas (codigo obrigatória, produto, cor, prazo, observacoes, molde,
revisao) sem diferença de acento e maiúscula; as outras são tamanhos.
**Tudo ou nada**, cada erro com a linha: código faltando ou repetido no
arquivo, ordem que já está no cadastro, molde de outro projeto, revisão não
registrada, prazo que não é data, quantidade que não é inteira, tamanho que o
molde não tem, ordem sem quantidade. A ordem entra ligada ao projeto e à
revisão (a da linha ou a das peças de agora). Digitar e colar continuam.

Um ERP entraria pela interface `FonteDeOrdens` (entrega as linhas; a mesma
conferência vale). Nenhuma conexão foi escrita: não há endereço, credencial
nem mapeamento — a tela diz "Nenhum ERP está ligado".

### Estoque (cadastro de produção, versão 2)

`MovimentoDeEstoque`: reserva, baixa ou estorno; rolo, plano, projeto,
comprimento (mm) e peso (g, quando há rendimento), data, responsável
informado, motivo (o estorno exige). Nada é apagado: o estorno é um movimento
que aponta o desfeito.

- `estadoDoRolo` separa **saldo físico** (inicial − baixas), **reservado**,
  **consumido** e **disponível** (saldo − reservas de outros planos).
- `reservarPlano` / `darBaixaDoPlano`: **sem repetir** — a mesma operação do
  mesmo plano no mesmo rolo, ainda valendo, não é feita de novo (dita como
  "já estava feito"); reservar depois da baixa também não. A baixa faz a
  reserva do mesmo plano deixar de contar. **Tudo ou nada**: um rolo sem
  disponível (reserva) ou sem saldo (baixa) recusa o movimento inteiro.
- `estornarMovimento`: um estorno por movimento; estorno não se estorna.
- O cadastro da versão 1 abre na 2 com o histórico vazio.

Nada se move sozinho: os botões ficam no plano confirmado (Planos deste
projeto), pedem quem faz e mostram o histórico com a situação de cada
movimento (vale, trocado pela baixa, estornado, desfaz outro).

### A gravação do cadastro (`electron/gravacao.ts`)

`gravarComAnterior`: antes de gravar, o arquivo atual (se legível) vai para
`cadastro-de-producao.json.anterior`; a gravação continua atômica (temporário
e troca) e com a cópia de segurança da versão antiga. `lerComRecuperacao`: se
o arquivo sumiu ou quebrou e a versão anterior está boa, ela é aberta e a
tela diz. O arquivo com registros que a leitura deixa de fora é copiado
inteiro para `copias-de-seguranca` (uma vez por conteúdo).

### Os defeitos, as emendas e o que já foi usado (`alocacaoDosRolos.ts`)

As camadas são postas ao longo de cada rolo, do começo ao fim:

- o que outros planos já consumiram ou reservaram sai do começo do rolo; o
  rolo todo usado **bloqueia**;
- o defeito **com posição** é um trecho proibido: a camada que passaria por
  ele começa depois, e o pulo é perda por defeito (dita no plano);
- o defeito **sem posição** sai do fim do rolo e **bloqueia** até a decisão
  explícita de usar o rolo assim — e o plano diz que ele não foi evitado;
- a **emenda** (desligada por padrão) só acontece se a configuração permite,
  numa linha do risco que não corta peça (`linhasDeEmendaDoRisco`), quando a
  camada não cabe no trecho livre em que o rolo está — até o fim dele, ou até
  um defeito com posição (a camada para antes do defeito) —, com a
  sobreposição configurada; cada emenda fica no plano (de qual rolo para
  qual, a posição no risco, a sobreposição).

A largura afetada e o tipo do defeito são registrados; a camada pula o
trecho inteiro (não aproveita o resto da largura).

A primeira versão (`dee6ad6`) só emendava quando o trecho livre ia até o fim
do rolo: com um defeito no meio, a camada que não passava dele ia inteira
para o rolo seguinte, e o plano saía com uma camada a menos. Uma mutação que
tirava essa condição não foi pega por nenhum teste — a regra não estava
especificada. Parar a camada antes do defeito e continuar no rolo seguinte é
tão possível na mesa quanto no fim do rolo, e deixa a sobra do rolo (o
defeito e o que vem depois) inteira no estoque; a condição saiu e o caso
ficou num teste.

### Encolhimento (`encolhimento.ts`)

Por direção, com a unidade (%) e a fonte (ensaio de lavagem, fornecedor,
estimativa). Fator 1/(1 − e/100). Só com a decisão de quem planeja, depois
da prévia das peças antes e depois; nunca quando o molde já está compensado;
não se aplica ao risco informado (na tela, a decisão só vale quando se
aplica). O risco é buscado na largura da malha ÷ fator e aumentado
(`riscoCompensado`, que marca os fatores); o plano recusa riscos compensados
sem a decisão, ou com fatores diferentes dos da malha.

### Listras e xadrez

A malha guarda a repetição e a fase do desenho (comprimento e largura). Com a
repetição, o risco põe o ponto "casamento" de cada peça (uma marca da aba
Marcações) na fase, só a 0°/180°, e confere depois de posto
(`conferirCasamento`). Sem a repetição, ou sem a marca em alguma peça, o risco
não sai e o plano só continua com a decisão "casamento feito à parte" —
nunca promete o casamento automático sem os dados. A tela diz o que falta
(a repetição, ou as peças sem a marca).

### O motor do risco

Cancelar no meio (`deveParar`), o progresso, o deslocamento de cada peça (a
linha de corte verdadeira é conferida nos testes: distância real ≥ a pedida
com d = 0, 3 e 8 mm em curvas de 180 pontos) e o modo que deixa de fora o que
não cabe. No Nesting Automático, a busca em grade continua o padrão; "Pontos
de canto" é a outra opção (o motor antigo não saiu). A comparação dos dois nos
mesmos casos está em `comparacaoDosMotores.test.ts`; os limites medidos estão
em `PLANEJAMENTO-DE-CORTE.md`. O texto diz "melhor alternativa encontrada",
não "ótima".

### Formatos de molde

`formatosSuportados.test.ts`: um arquivo DXF sintético por entidade e unidade
(LWPOLYLINE, POLYLINE clássica, arco por bulge, LINE+ARC soltos, SPLINE,
INSERT com escala, CIRCLE como furo; `$INSUNITS` mm, cm, m, polegada, pé,
ausente e desconhecido), o aberto que não vira peça, os arquivos vazios ou
que não são DXF, e a peça sem fio. A lista de formatos aceitos não mudou;
nenhum arquivo real de outro CAD foi testado.

### A tela

Etapa 2: importar CSV (com o formato e o exemplo). Etapa 3: fonte do
encolhimento, repetição e fase (cm), tipo/extensão/posição/largura do
defeito, a coluna disponível / reservado / consumido, a decisão dos defeitos
sem posição. Etapa 4: emenda e sobreposição, o bloco do encolhimento (dito,
prévia, aplicar, tirar), o bloco de listras e xadrez (o que falta); o que
outros planos usaram de cada rolo entra no cálculo. Planos deste projeto: o
estoque do plano confirmado (`EstoqueDoPlano.tsx`). O resumo do plano: uso
anterior, trecho pulado e emendas por rolo, a tabela das emendas, risco
compensado ou casado — só quando há (os planos antigos não ganham colunas
vazias). "Como usar" e "Limitações conhecidas" na janela; "Sobre" diz de onde
vêm as ordens e que não há login.

### Projetos e planos antigos

O cadastro da versão 1 abre na 2 (histórico de estoque vazio; os defeitos
sem posição continuam sem posição, e o plano novo pede a decisão) e ganha a
cópia de segurança antes de ser gravado na 2. Os planos guardados abrem como
foram guardados, sem recalcular; nenhum movimenta o estoque sozinho.

## O que NÃO foi feito

- **ERP:** nenhuma conexão (faltam endereço, autenticação, mapeamento, rede).
- **Login:** não há; o responsável é "informado".
- **Banco de dados:** não há; arquivos deste computador.
- **Arquivos reais de outros CADs:** nenhum testado (R-1).
- Defeito: sem aproveitar o resto da largura; casamento por um ponto só.
- O motor novo não virou o padrão do Nesting Automático: em riscos curtos a
  grade às vezes é mais curta.
- Na tela, o plano de teste usou 0,75 m do primeiro rolo: o rolo com o
  defeito posicionado foi cadastrado e gravado, mas a camada não chegou a
  ele — o desvio do defeito está provado nos testes do domínio, não na tela.

## Verificação

- **Testes:** 2502 em 123 arquivos (2405 em 116 no `b04959a`, 2460 em 120 no
  `dee6ad6`); tipos e lint limpos; build feito. Novos nesta parte: a janela
  do planejamento (14: o CSV certo e o errado e o formato; defeito sem e com
  posição; o uso de outro plano no cálculo; emendas; o estoque de um plano
  confirmado pela tela; encolhimento com prévia, já compensado, não
  aplicado, na largura; listras sem repetição, sem marca e com marca;
  limitações), o estoque do plano (6: nada sem o clique, quem faz, sem
  repetir, baixa, estorno com motivo, tudo ou nada, rascunho), o resumo (4),
  os formatos (16), a alocação (defeito com emenda) e o formulário.
- **Mutações:** 48 no código desta fase — estoque 12, CSV 7, alocação 8,
  encolhimento 3, bloqueios do plano 4, gravação 3, casamento 2, tela 9 —,
  uma por vez, com o código conferido por hash antes e depois: 44 pegas. As 4
  que ficaram: a linha de emenda com uma peça curta ao lado de uma comprida
  (faltava o teste), a emenda com defeito (a regra acima), e duas da tela (a
  compensação não aplicada, a largura da busca com encolhimento na largura).
  Com os testes novos, rodadas de novo: as 4 pegas.
- **Na tela, com o programa gerado** (pasta de dados separada), 44
  conferências, 0 falhas: o CSV com erro não entra e diz a linha, o certo
  grava as duas ordens ligadas ao molde e à revisão; o cadastro na versão 2,
  a malha com o encolhimento e a fonte, o defeito em mm com tipo e largura; a
  tabela dos rolos com o defeito e o disponível / reservado / consumido; o
  encolhimento dito, a prévia, os fatores; o plano com a compensação e os
  riscos compensados; o estoque do plano: reserva no arquivo (um movimento
  por rolo, quem fez), repetir não reserva, a baixa troca a reserva, o
  estorno com o motivo desfaz a baixa sem apagar nada, a versão anterior do
  arquivo ao lado. Numa rodada com a versão anterior de outra rodada ao lado
  e o arquivo principal apagado, a janela disse "O arquivo do cadastro de
  produção não foi encontrado: o programa abriu a versão anterior dele". O
  roteiro dos fluxos: 72 certas, 0 falhas; o dos planos: 0 falhas; a
  varredura dos botões: igual à anterior.
- **Dados reais:** os 9 projetos da pasta do programa instalado com as mesmas
  impressões e o diagnóstico com as mesmas 1536 linhas antes e depois; nenhum
  cadastro criado lá.
