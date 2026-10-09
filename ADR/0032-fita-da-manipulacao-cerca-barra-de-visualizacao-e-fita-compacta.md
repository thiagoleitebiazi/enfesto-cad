# ADR 0032 — Aba Manipulação como na referência: cerca, barra de visualização, menus e fita compacta

## Contexto

O usuário enviou duas capturas do CAD de moldes comercial usado como
referência — a aba Manipulação e a barra embaixo do desenho — e perguntou se
o programa tinha "todas essas funcionalidades de forma organizada". Não tinha:

1. **Grupos diferentes.** A referência divide a aba em Redefinir, Indicar,
   Cerca e Manipular molde. Aqui os grupos eram outros, e havia um grupo
   "Visualização" na fita que, na referência, fica na barra de baixo.
2. **Não havia cerca de verdade.** O ADR 0016 tratou "Definir cerca" e
   "Mover cerca" como a seleção retangular de vértices do Mover ponto. Não é a
   mesma coisa: na referência, a cerca é uma região que fica no desenho, e
   "Mover cerca" desloca por uma medida exata tudo o que estiver dentro dela —
   pontos do contorno, furos, linhas internas, marcas — em mais de uma peça.
3. **Sem barra de visualização** (mão, zoom por janela, vista anterior e
   próxima, grade, ímã) e **sem os menus Visão, Opções e Ajuda**.
4. Várias ferramentas da referência **trabalham sobre elementos de
   modelagem** (linhas soltas). Aqui só existem peças fechadas.

O plano aprovado foi fazer só o que é real: os 4 grupos, uma cerca de
verdade, a barra de visualização e os menus. As ferramentas que não existem
aqui ficam no lugar certo do layout, **desabilitadas e com a explicação** na
dica. Nenhum botão finge uma função.

Dois problemas apareceram durante a verificação:

5. **A fita quebrava em duas linhas na tela do usuário.** Uma tela de
   1920 × 1080 com escala de 150% tem 1280 px de CSS, e a aba Manipulação pede
   ~1330 px. A quebra levava a fita de 154 para 244 px e tirava ~90 px do
   desenho.
6. **A borda da folha do DXF virava linha interna.** O ADR 0030 já impedia que
   a borda virasse peça, mas ela continuava entre as candidatas a linha
   interna. O primeiro ponto da borda cai "dentro" da peça que encosta no
   canto dela, e a borda entrava nessa peça como linha interna — apesar do
   aviso de que tinha sido ignorada.

## Decisão

### Aba Manipulação

Quatro grupos, na ordem da referência:

| Grupo | Ferramentas |
|---|---|
| Redefinir | Modificar, Manipular pontos, Mover, Mover ponto, Manipulação rápida, Redefinir perímetro, Dividir elementos |
| Indicar | Elemento paralelo, Girar, Copiar, Dimensionar, Espelhar |
| Cerca | Definir cerca, Mover cerca |
| Manipular molde | Definir curva, Inserir ponto, Excluir ponto, Transformar em elementos, Alinhar, Copiar ou trocar elemento, Arredondar ou chanfrar, Converter em costura |

Ficam desabilitadas, com uma de três explicações na dica:

- **Trabalham sobre elementos** (Manipular pontos, Manipulação rápida,
  Dividir elementos, Transformar em elementos, Copiar ou trocar elemento):
  "indisponível neste programa: trabalha sobre elementos de modelagem (linhas
  soltas), e aqui só existem peças fechadas".
- **Comportamento não confirmado** (Modificar, Redefinir perímetro): "ainda
  não disponível: o comportamento exato desta ferramenta ainda não foi
  confirmado". Um DXF de antes e depois de uma delas, feito na referência,
  basta para implementá-las.
- **Sem curvas** (Definir curva): os contornos ainda são só segmentos retos.

O grupo "Visualização" saiu da fita e foi para a barra de baixo e o menu
Visão. A dica de Mover ponto deixou de dizer que ele equivale a Manipulação
rápida, Definir cerca e Mover cerca.

### Cerca (`domain/cerca.ts`)

- **Definir cerca** liga um modo em que um retângulo arrastado sobre o desenho
  (≥ 3 px) vira a cerca. Ela fica desenhada (tracejado laranja com o rótulo
  "Cerca"), e o botão fica pressionado enquanto ela existir; clicar de novo a
  remove. Antes do arrasto, Esc ou um novo clique cancelam. A cerca some ao
  criar, abrir, fechar ou restaurar um projeto.
- **Peças-alvo** (`pecasAlvoDaCerca`): as selecionadas em lote; senão, a peça
  selecionada; senão, todas. Só os pontos das peças-alvo que estão dentro da
  cerca ficam realçados.
- **Mover cerca** (desabilitado sem cerca) abre um diálogo com:
  - deslocamento horizontal e vertical em mm, nos eixos da **tela**
    (convertidos para os eixos trocados do mundo, ADR 0012), aceitando vírgula
    decimal;
  - as categorias com a contagem do que está dentro: pontos do contorno, dos
    furos e das linhas internas, marcas e linha de fio — esta só se move se
    as duas pontas estiverem dentro;
  - a lista das peças que mudam com as opções marcadas, e um aviso quando nada
    mudaria.

  Se o movimento deixar um contorno ou um furo com área zero, nada muda: o
  erro aparece e o diálogo fica aberto.
- **A cerca acompanha o movimento**, para dar para repetir. Desfazer e refazer
  devolvem a cerca à posição anterior só se ela ainda estiver onde o movimento
  a deixou.
- **Piques** (`reancorarPiques`, em `domain/molde.ts`): cada pique mantém a
  proporção ao longo da sua aresta, e arestas com as duas pontas paradas não
  mudam. Vale também para Mover ponto, que antes deixava os piques no lugar
  antigo, fora da aresta.

### Barra de visualização (embaixo do desenho)

- **Mão**: liga e desliga; com ela, arrastar move a vista. Esc ou um novo
  clique a desligam. O botão do meio, ou Espaço + arrastar, continuam movendo
  a vista sem ligar a Mão.
- **Zoom por janela**: o retângulo arrastado (≥ 5 px) passa a ocupar a área de
  desenho; a ferramenta se desliga sozinha depois de um uso.
- **Aumentar e Diminuir zoom** passam a ampliar em torno do centro real da
  área de desenho (antes, o ponto fixo 400, 300). **Ajustar à tela** usa o
  tamanho real da área (antes, uma largura fixa de 900 px). Ao abrir o
  programa, o enquadramento é refeito uma vez, quando a área já tem o tamanho
  de verdade.
- **Vista anterior e Próxima vista**: histórico de até 50 vistas. Um gesto de
  roda conta como uma vista só (pausa de 500 ms); um clique sem arrasto não
  guarda nada; um projeto novo limpa o histórico.
- **Grade**: pontos sob as peças, com passo de 1, 2 ou 5 × 10ⁿ mm, o menor que
  fique com pelo menos 12 px na tela. A barra mostra o passo (ex.: "Grade:
  5 cm").
- **Ímã**: só nos pontos criados com o mouse — vértices de novo molde e de
  novo furo, fio, marca e os dois cantos da cerca. Captura primeiro um vértice
  próximo, depois a grade (se estiver visível), e mostra onde o ponto vai cair
  (quadrado no vértice, cruz na grade).
- Trocar de ferramenta desliga a Mão e o Zoom por janela.
- Ao desenhar um contorno, clicar no primeiro ponto fecha o contorno; repetir
  o último ponto é ignorado, assim como uma linha de fio de comprimento zero —
  situações que o ímã torna fáceis de produzir.

### Menus Visão, Opções e Ajuda (`MenuSuspenso`)

- **Visão**: Aumentar zoom, Diminuir zoom, Ajustar à tela, Vista anterior,
  Próxima vista, Grade.
- **Opções**: Ímã; régua em centímetros ou em milímetros. A unidade da régua
  passou a ficar no App, para o menu e o canto das réguas mostrarem o mesmo.
- **Ajuda**: Atalhos de teclado (a lista do que `aoTeclar` trata de fato) e
  Sobre o Enfesto CAD.
- Teclado: ↓ abre; ↑ e ↓ percorrem; Home e End; Esc fecha e devolve o foco ao
  botão; Tab fecha. Com o menu aberto, as teclas não chegam aos atalhos do
  desenho.

### Fita compacta (`ui/compactacaoDaFita.ts`)

A fita nunca quebra linha e mantém 154 px. Quando não cabe, encolhe por
níveis e usa o primeiro que couber:

- nível 0: normal;
- nível 1: rótulos dos botões grandes em duas linhas;
- nível 1 + k: além disso, os botões pequenos dos k últimos grupos ficam só
  com o ícone (o nome continua na dica, que começa pelo nome da ferramenta, e
  para leitores de tela).

Se nem o último nível couber, a fita rola na horizontal. A medição roda em
`useLayoutEffect` com `ResizeObserver`, antes da pintura, e o nível vive só
em atributos do DOM — sem novo estado do React.

Larguras dos grupos da aba Manipulação (Redefinir / Indicar / Cerca /
Manipular molde), em px:

| Largura da janela | Nível | Grupos |
|---|---|---|
| 1440 | 0 | 337 / 276 / 166 / 547 |
| 1280 | 1 | 337 / 234 / 131 / 478 |
| 1100 | 2 | 337 / 234 / 131 / 208 |
| 1024 (mínimo) | 2 | 337 / 234 / 131 / 208 |

### Borda da folha no DXF

A borda reconhecida pelo ADR 0030 fica fora das candidatas a furo e a linha
interna (`importarDxf`). Ela continua só gerando o aviso de que foi ignorada.

## O que NÃO foi feito

- **Menu Janelas** da referência: o programa trabalha com um documento por vez.
- **Modificar e Redefinir perímetro**: aguardam um DXF de antes e depois.
- **Ferramentas de elementos**: exigiriam elementos de modelagem soltos, que o
  programa não tem.
- **Definir curva**: não há curvas Bézier nos contornos.
- **Ímã ao mover**: arrastar vértices (Mover ponto) continua livre.
- **F1** não abre a ajuda.
- As coordenadas da barra de status continuam em mm, mesmo com a régua em cm.
- Abrir um projeto não reenquadra a vista.
- Depois de definida, a cerca não tem faixa de instruções fixa; o tracejado e
  o botão pressionado indicam que ela existe.
- O realce da cerca mostra todas as categorias de pontos, sem seguir as caixas
  marcadas no diálogo.
- Grupos recolhidos num único botão, como no Office: até a largura mínima da
  janela (1024 px), não foi preciso.
- As duas tabelas do diálogo de atalhos têm larguras de coluna diferentes
  (cosmético).
- Projetos salvos antes da correção do DXF mantêm a linha interna a mais;
  basta importar o DXF de novo.
- **Problema antigo, não corrigido:** os diálogos (`Sobreposicao`) não seguram
  as teclas, e `aoTeclar` só ignora campos de texto. Com o foco num botão ou
  num `<select>` de um diálogo, Delete, Ctrl+Z, zoom e os outros atalhos agem
  no desenho por trás, e Esc cancela a ferramenta em vez de fechar o diálogo.
  Os menus novos já seguram as teclas.
- Ícones novos desenhados no estilo do próprio programa; a identidade visual da
  referência não foi copiada (ADRs 0017/0018/0031).

## Verificação (Electron real, build de produção)

- Testes: 322/322 em 24 arquivos (eram 279). Novos: cerca 12, ímã 6, menu 5,
  diálogo Mover cerca 5, compactação da fita 5, transformação de tela 7,
  molde 2 (piques), DXF 1 (borda da folha). Typecheck limpo. Lint com 1 aviso
  antigo, não relacionado.
- O teste da borda da folha **falha** com o importador anterior (conferido
  numa cópia temporária) e passa com a correção.
- Roteiro automático, janela de 1440 × 900, DXF de exemplo:
  - 5 peças importadas; fita com 154 px nas 6 abas;
  - menus com os itens listados acima; Próxima vista desabilitada antes de
    voltar alguma vista; barra de baixo com "Grade: 5 cm";
  - depois de arrastar a cerca, Definir cerca pressionado e Mover cerca
    habilitado; o diálogo mostrou a cerca de 300,0 × 350,0 mm e os 12 pontos
    do contorno de 101-FRENTE-G, e fechou depois de Mover; com as 5 peças
    selecionadas, só 101-FRENTE-G aparece entre as que mudam;
  - Zoom por janela foi a 88% e se desligou; Vista anterior voltou a 32% e
    habilitou Próxima vista;
  - Desfazer devolveu a peça e a cerca ao lugar (conferido nas capturas);
  - com a janela em 1100 px, a fita ficou com 154 px (antes, 244).
- Tela deste computador (1920 × 1080, escala 150%; janela maximizada com
  1280 × 650 de área útil): zoom inicial de 18%, igual em 3 aberturas. Nessa
  largura (1280 px), a aba Manipulação cabe no nível 1, sem quebrar.
- Biblioteca de projetos do usuário intacta (5 arquivos).
