# ADR 0035 — Abas Início, Construção, Produção, Graduação, Conferência e Modelo

## Contexto

O ADR 0032 organizou a aba Manipulação como a de um CAD de moldes comercial:
os grupos e os nomes da referência, o que existe no programa ligado, e o resto
desabilitado com o motivo na dica. O usuário mandou as imagens das outras abas
da referência e pediu o mesmo para elas, "de forma organizada e profissional",
menos a Manipulação, que já estava feita.

As abas pedidas são seis: Início, Construção, Produção, Graduação, Conferência
e Modelo. Boa parte das ferramentas delas é de modelagem (retas e curvas
soltas, pences, pregas, graduação), e este programa prepara o encaixe e o corte
de moldes prontos. Valem as regras de sempre: nenhum botão decorativo e nenhum
comportamento inventado. O que o manual da referência descreve e cabe aqui foi
implementado; o resto aparece no lugar de costume, desligado.

## Decisão

### Abas

A fita passa a ter dez abas, na ordem da referência, com a do próprio programa
no fim: **Arquivo, Início, Construção, Produção, Marcações, Graduação,
Manipulação, Conferência, Modelo e Encaixe**. O programa abre em Início.

- A aba Edição deu lugar à Início. Desfazer e Refazer continuam na barra de
  acesso rápido; Duplicar continua em Ctrl+D e em Manipulação > Copiar.
- O Furo saiu da Construção e foi para a aba Marcações.
- As abas Arquivo, Marcações, Manipulação e Encaixe não mudaram de conteúdo.

Das 86 ferramentas das seis abas, 25 funcionam e 61 ficam desligadas:

| Aba | Grupos | Ligadas | Desligadas |
|---|---|---|---|
| Início | Desenho, Editar, Selecionar, Restauração | 10 | 2 |
| Construção | Retas, Curvas, Pontos, Arcos, Texto | 2 | 18 |
| Produção | Definir moldes, Complementar moldes, Costura, Pregas e Pences, Cortar e Unir | 5 | 16 |
| Graduação | Graduar, Manipular graduação | 0 | 14 |
| Conferência | Perímetro, Distância | 3 | 7 |
| Modelo | Informações, Operações | 5 | 4 |

### Ferramentas ligadas

**Início**

- Colar, Recortar, Copiar, Excluir, Selecionar e Selecionar tudo já existiam.
- **Inverter seleção** (nova): passam a estar selecionadas as peças que não
  estavam (`domain/selecao.ts`). Vale o lote marcado na lista ou, sem lote, a
  peça selecionada, como em Excluir. Se sobra uma só, ela vira a seleção única.
- **Selecionar moldes**: na referência, seleciona só os moldes, deixando os
  elementos soltos de fora. Aqui todo objeto é um molde, então faz o mesmo que
  Selecionar tudo, e a dica diz isso.
- **Ponto de restauração** e **Restaurar** (novas): o primeiro guarda a peça
  selecionada como está; o segundo a devolve a essa forma
  (`restaurarFormaDoMolde`).
  - Voltam o contorno, os furos, as linhas internas, os piques, as marcas, a
    linha de fio, a costura e o giro, no lugar em que estavam.
  - Nome, referência, tamanho, quantidade e rotações permitidas ficam como
    estão hoje.
  - Restaurar é um passo de desfazer.
  - O ponto vale enquanto o projeto está aberto; não vai para o arquivo.

**Construção**

- **Reta**: a ferramenta que já desenhava o contorno de um molde novo, reta a
  reta (era o botão Novo Molde).
- **Retângulo** (nova): um clique num canto e outro no canto oposto criam um
  molde retangular.
  - A prévia mostra a medida de cada lado, e a barra de status mostra DX e DY.
  - Com o ímã e a grade, os cantos caem na grade, e as medidas saem redondas.
  - Depois dos cantos, dois cliques marcam a linha de fio, como no molde
    desenhado reta a reta.
  - Na referência, o retângulo só vira molde com a opção "Criar molde"; aqui
    sempre vira, porque não há elementos soltos.

**Produção**

- **Criar molde**: a mesma ferramenta de Construção > Reta.
- **Sentido do fio** (nova): dois cliques redesenham a linha de fio da peça
  selecionada (`redefinirLinhaDeFio`). Só a linha muda: a peça não gira, e as
  rotações permitidas continuam contadas a partir da posição atual dela.
- **Costura** e **Converter em costura**: abrem o diálogo novo "Costura"
  (`ui/PainelDeCostura.tsx`), que define a margem das peças selecionadas, em
  mm. Ele substitui a caixa de texto do sistema que o Converter em costura
  usava, e passa a valer também para um lote.
- **Remover costura** (nova): zera a margem das peças selecionadas.

**Conferência** (`ui/medicao.ts`)

As medidas são leituras: ficam no desenho e na faixa de mensagens até a medida
seguinte ou até sair da ferramenta, e não mudam o projeto.

- **Distância** (nova): dois cliques mostram a distância, a horizontal, a
  vertical e o ângulo — o que o manual da referência diz que a ferramenta
  mostra.
  - Perto de um vértice (10 px), o clique cai exatamente nele, mesmo com o ímã
    desligado: medir de canto a canto tem de dar o número exato.
  - O ângulo é o da tela, de 0° a 360°, no sentido anti-horário.
- **Perímetro** (nova):
  - um clique dentro de uma peça mostra o perímetro dela e, se houver costura,
    o da linha de corte;
  - dois cliques no contorno medem o trecho entre eles. O trecho segue a
    numeração dos pontos, do primeiro clique ao segundo; na ordem inversa, dá o
    outro lado. A faixa mostra os dois lados e o perímetro.
- **Comparar perímetros** (nova): duas medidas (peça inteira ou trecho) e a
  diferença entre elas. A terceira medida recomeça a comparação.
- Uma medida de trecho deixa de valer se a peça mudar depois (desfazer, mover),
  em vez de mostrar um número que já não é o do desenho.

**Modelo**

- **Propriedades**: o diálogo de propriedades da peça selecionada.
- **Informações**: o Relatório de produção, que reúne os dados do projeto.
- **Tecidos**: o diálogo do tecido do projeto.
- **Informações dos moldes** (nova, `ui/PainelDeInformacoesDosMoldes.tsx`):
  uma tabela com as medidas de todas as peças — quantidade, largura, altura,
  área, perímetro, costura, pontos, piques e furos —, com os totais. Clicar
  numa linha seleciona a peça.
- **Localizar modelos**: a Biblioteca de trabalhos, que busca os projetos
  salvos por nome, código ou tecido.

### Ferramentas desligadas

Cada uma diz na dica o nome dela e o motivo:

- **Elementos soltos** (Por ângulo, Estender reta, Estender até elemento,
  Estender duas retas, os pontos de construção, Extrair molde): aqui só existem
  peças fechadas, como no ADR 0032.
- **Curvas e arcos** (o grupo Curvas, Por raio, No centro do arco, Raio): os
  contornos são feitos só de segmentos retos.
- **Modelagem** (Bainha, Dobrar, Desdobrar, Pregas, as pences, Cortar, Unir,
  Remover região, Conferir): os moldes chegam prontos para o encaixe.
- **Graduação** (a aba inteira): cada tamanho entra como uma peça própria, já
  graduada. Uma nota na própria aba diz isso, sem exigir passar o mouse.
- **Cotas** (Cota perímetro, Cota distância, Horizontal / Vertical, Ângulo):
  não há cotas fixas no desenho; a dica aponta para Distância e Perímetro.
- **Sem equivalente no programa**:
  - Cor, Inserir e Editar texto, Autor, Imagens e Relacionamento piques: o
    projeto não guarda esses dados;
  - Linha de simetria: o encaixe não dobra moldes;
  - Digitalizar: depende de uma mesa digitalizadora.
- **Comportamento não confirmado**: Inverter moldes, Converter em contorno,
  Comparar distância e Variantes.

### Interface

- **Botão da fita** (`Ferramenta`, em `ui/BarraDeFerramentas.tsx`): um
  componente só para o botão grande e o pequeno, com a dica do disponível, o
  motivo fixo de não existir e o que falta agora ("selecione uma peça
  primeiro"). As seis abas usam o mesmo desenho da Manipulação: botões grandes
  e colunas de até três pequenos.
- **Ícones**: 76 novos, no mesmo traço dos anteriores, desenhados para este
  projeto.
- **Cabeçalho das abas**: dez abas mais os quatro menus pedem cerca de 1210 px.
  Abaixo disso as abas e os menus apertam, em dois passos (1240 e 1120 px), e
  continuam numa linha até a largura mínima da janela (1024 px).
- **Faixa de mensagens**: passou a ser montada num lugar só. Ganhou os textos
  das ferramentas novas e a confirmação das ações que não mudam o desenho
  ("Ponto de restauração guardado…", "Costura removida…"), que some na próxima
  mudança nas peças, na seleção ou de ferramenta.
- **Barra de status**: "Seleção" conta as peças do lote ("2 peças"); antes
  dizia "nenhuma" com um lote marcado.
- **Ajuda e mensagens**: onde citavam o botão Novo Molde, citam Reta e Criar
  molde.

## O que NÃO foi feito

- **A aba Marcações** não veio nas imagens e não foi reorganizada; só recebeu o
  Furo.
- **As seis ferramentas de arco sem rótulo** da referência (ícones pequenos ao
  lado de Por raio): os nomes não são legíveis na imagem.
- **O grupo que abre os outros programas do fabricante**, na aba Início: não
  tem equivalente.
- **Cotas fixas no desenho**: exigiriam um objeto novo no projeto, salvo e
  exportado. As medidas existem como leitura.
- **Comparar perímetros não acumula** várias somas e subtrações, como a
  referência: compara duas medidas.
- **Retângulo por medidas digitadas**: as medidas saem dos cliques, com a
  grade e o ímã; depois, Dimensionar e Redefinir perímetro acertam o valor.
- **Costura por trecho do contorno**: a margem vale para a peça inteira.
- **Ponto de restauração salvo no arquivo**: vale só com o projeto aberto.
- **Graduação, pences, pregas, dobras, cortar e unir moldes**: são do programa
  de modelagem.
- **Conferência com a referência**: o comportamento das ferramentas novas
  segue o manual, mas não foi comparado com o programa de referência em uso.

## Verificação (Electron real, build de produção)

- **Testes:** 484/484 em 35 arquivos (eram 381 em 30).
  - Novos: fita 31, medição 23, perímetro e trecho 10, desenho 10, peça 7,
    diálogo Costura 7, seleção 6, tabela dos moldes 6, barra de status 3.
  - Os testes da fita conferem, para cada aba, os grupos e os botões na ordem,
    a dica de todo botão desligado e a ação de todo botão ligado.
  - Cinco mutações à mão foram pegas pelos testes, e o original foi restaurado
    e conferido em cada uma:
    - ângulo sem inverter a vertical da tela;
    - trecho na mesma aresta sem dar a volta;
    - Distância sem prender nos vértices;
    - botão desligado sem o motivo na dica;
    - Comparar guardando uma medida só.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático, janela de 1440 × 900 visível**, com um DXF de dois
  retângulos (300 × 400 e 400 × 300 mm):
  - Retângulo, com ímã e grade: a barra de status mostrou DX 20,00 cm e
    DY 30,00 cm antes do segundo clique, e a peça criada mede 200 × 300 mm,
    600,0 cm².
  - Sentido do fio: a seta deitada sumiu e a de pé apareceu (pixels conferidos
    nos dois lugares). Ctrl+Z e Ctrl+Y trocaram de volta e de novo.
  - Costura: o diálogo abriu com 10 e o foco no campo; "12,5" e Enter
    aplicaram. O Perímetro mostrou 1000,0 mm e, na linha de corte, 1100,0 mm.
    Remover costura tirou a linha de corte e ficou desligado, com o motivo.
  - Distância entre dois cantos opostos do 300 × 400: 500,0 mm, horizontal
    300,0, vertical 400,0, ângulo 306,9°. Os cliques foram dados a 5 px dos
    vértices.
  - Perímetro: 1400,0 mm dentro da peça. Trecho de um canto ao vizinho:
    300,0 mm, com 1100,0 pelo outro lado; na ordem inversa, 1100,0 e 300,0.
  - Comparar perímetros: 1400,0 mm (peça) e 300,0 mm (trecho), diferença
    1100,0 mm, "a 1ª é maior". A terceira medida recomeçou. Esc desligou a
    ferramenta e limpou o desenho.
  - Ponto de restauração e Restaurar: a peça foi modificada para 410 × 320,
    1255,0 cm²; Restaurar devolveu 400 × 300, 1200,0 cm². Ctrl+Z voltou a
    1255,0, e outro Ctrl+Z, a 1200,0.
  - Inverter seleção: de uma peça para as outras duas (status "2 peças") e de
    volta. Selecionar moldes marcou as três; invertendo, nenhuma.
  - Modelo: a tabela mostrou as três peças com as medidas certas e o total;
    clicar numa linha selecionou a peça. Propriedades, Informações, Tecidos e
    Localizar modelos abriram os diálogos esperados, e Esc fechou cada um.
  - Graduação: 14 botões, 14 desligados, com a nota.
- **Larguras:** nas dez abas, a 1440, 1280 e 1024 px, a fita tem 154 px de
  altura e nem a fita nem a página rolam na horizontal. A 1024 px as abas
  terminam em 759 px e os menus começam em 817.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). Os
  roteiros usam uma pasta própria.
