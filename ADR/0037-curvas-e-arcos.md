# ADR 0037 — Curvas e arcos

## Contexto

Segunda etapa do pedido do ADR 0036: as ferramentas de curva e de arco da aba
Construção, que o ADR 0035 tinha deixado desligadas com o motivo "os contornos
são feitos só de segmentos retos". O pedido inclui as seis ferramentas de arco
que a imagem da referência mostra só com ícone; o manual dela dá os nomes.

O manual da referência descreve:

- **Curvas:** criar curva (por pontos, com "Desfaz ponto"), dividir curva,
  inserir curva pré-definida, inserir curva proporcional ou espiral (com
  Largura e Perímetro), cadastrar curva e editar o número de pontos da curva.
- **Arcos:** pelo centro (com raio), dados 2 pontos, dados 3 pontos, tangente à
  reta ou arco, tangente a 2 retas dado o raio, tangente a arco e reta, e
  tangente a 2 arcos.

Na referência, curvas e arcos são elementos soltos, que depois viram molde.
Aqui só existem peças fechadas.

## Decisão

### Curvas amostradas

Curvas e arcos deste programa são **amostrados**: viram uma sequência de pontos
próximos (cerca de 6 mm entre um e outro), que entra no contorno como vértices
comuns. Não se guarda raio nem ponto de controle.

- O encaixe, a validação, a área, o PDF e a importação continuam trabalhando
  com polígonos, sem nenhuma mudança.
- É o mesmo que a importação de DXF e de PDF já fazia com as curvas dos
  arquivos, e o que Arredondar canto fazia desde o ADR 0013.
- Depois de criada, a curva se edita ponto a ponto, ou se refaz o trecho.

### Trocar um trecho do contorno

A base de quase todas as ferramentas é `substituirTrechoDoMolde`: troca um
trecho do contorno da peça selecionada por uma linha nova.

- O trecho é **o mais curto dos dois caminhos** entre os dois pontos indicados
  no contorno. A prévia o mostra em destaque antes do último clique.
- Um clique perto de um vértice cai nele; senão, no ponto mais próximo da
  aresta.
- A numeração dos vértices que não foram mexidos muda o mínimo possível: o
  contorno novo começa pelo vértice de menor número que sobrou.
- Os piques das arestas que não mudaram ficam; os do trecho trocado saem, pela
  regra das outras edições de forma.
- A troca que deixaria o contorno sem área é recusada.

### Ferramentas de curva

- **Curva:** um clique no contorno, onde a curva começa; cliques fora dele, nos
  pontos por onde ela deve passar; e um clique no contorno, onde termina. A
  curva é suave e passa por todos os pontos (spline centrípeta). Backspace
  desfaz o último ponto de passagem.
- **Dividir curva:** liga o Inserir ponto. Aqui a curva é uma sequência de
  pontos, e dividir é marcar um ponto dela.
- **Editar pontos de curva:** dois cliques indicam o trecho, e um diálogo pede
  quantos pontos ele deve ter. Os pontos ficam igualmente espaçados; com menos
  pontos a forma simplifica.
- **Cadastrar curva:** dois cliques indicam o trecho, e um diálogo pede o nome.
  Fica guardada só a forma, sem tamanho nem posição, neste computador.
- **Pré-definida:** escolhe uma curva do cadastro e a põe entre dois pontos do
  contorno, esticada ou encolhida por igual. "Espelhar" a vira para o outro
  lado. O cadastro vem com três arcos simples (flecha de 10%, de 25% e meio
  círculo) e mostra as curvas do usuário, que podem ser excluídas ali.
- **Espiral e curvas:** cria o molde em espiral do babado, dadas a largura da
  tira e o perímetro, como no manual. O perímetro é o comprimento da borda de
  dentro. A borda de dentro começa num raio igual à largura, e cada volta fica
  1 mm afastada da anterior, para o contorno não encostar em si mesmo.
- **Definir curva**, na aba Manipulação, liga a mesma ferramenta Curva.

### Ferramentas de arco

- **Por raio:** cria um molde circular. Um clique no centro e outro na borda;
  a distância entre os dois é o raio, que a barra de status mostra.
- **Arco por 2 pontos:** os dois pontos do contorno e, depois, um ponto por
  onde o arco passa.
- **Arco por 3 pontos:** um ponto do contorno, o ponto de passagem e o outro
  ponto do contorno. Um clique fora do contorno troca o ponto de passagem.
- **Arco tangente a 2 retas, dado o raio:** um clique num canto e o raio, num
  diálogo. O canto vira um arco tangente às duas arestas (é o Arredondar
  canto, sem a caixa de texto do sistema).
- Na fita, as seis ferramentas além de Por raio são botões só com ícone, como
  na referência, com o nome na dica.

Círculo, retângulo e espiral seguem o mesmo caminho depois de desenhados: dois
cliques marcam a linha de fio e o molde é criado.

### Diálogo de campos (`ui/DialogoDeCampos.tsx`)

Um diálogo só para as ferramentas que pedem alguns valores (medidas, contagens,
texto, caixas e escolhas). Lê e confere cada campo, e mostra o erro sem fechar.
Serve a esta etapa e às próximas.

## O que NÃO foi feito

- **Arco tangente à reta ou arco, a arco e reta e a 2 arcos:** precisam de um
  arco como elemento, com centro e raio. Ficam desligados, com o motivo.
- **Curvas com pontos de controle editáveis:** a curva vira pontos do contorno.
- **Cota de raio:** pelo mesmo motivo.
- **Verificar se o contorno se cruza** depois da troca: como no Mover ponto.
- **Curva proporcional** como ferramenta separada da Pré-definida: num contorno
  fechado a curva sempre tem de caber entre dois pontos, então as duas seriam
  a mesma.
- **As ações de girar, ampliar e reduzir** da curva pré-definida da referência.
- **Conferência com a referência:** a espiral segue os dois parâmetros do
  manual, mas a construção exata dela (raio inicial, folga) é deste programa.

## Verificação (Electron real, build de produção)

- **Testes:** 621/621 em 43 arquivos (eram 538 em 38).
  - Novos: curvas e arcos 22, ferramentas de trecho 22, troca de trecho no
    contorno 10, troca de trecho na peça 5, diálogo de campos 6, cadastro de
    curvas 8, diálogo Pré-definida 6, fita 4.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático, janela de 1440 × 900 visível**, conferido no arquivo
  salvo do projeto. Peça de 300 × 400 mm (1200,0 cm²):
  - Curva na aresta de 400 mm, passando 60 mm para fora: o contorno passou de
    4 para 73 pontos e 1338,7 cm². Todos os pontos novos ficaram do lado de
    fora da aresta, e o ponto 1 continuou no mesmo canto.
  - Editar pontos de curva: o diálogo mostrou "71 pontos em 419,4 mm"; com 6,
    o contorno ficou com 8 pontos. Ctrl+Z voltou aos 73.
  - Cadastrar curva: sem nome, o diálogo avisou; com nome, a curva apareceu no
    cadastro e na faixa de mensagens.
  - Arco por 3 pontos e por 2 pontos, com flecha de 150 mm: 1640,3 cm² nos
    dois (a conta do segmento de círculo dá 1641,9; o polígono fica um pouco
    por dentro). Todos os pontos do arco ficaram num mesmo círculo, com desvio
    de 6 × 10⁻¹⁴ mm.
  - Arco tangente a 2 retas com raio de 50 mm: 1194,5 cm² (esperado 1194,6).
    Um clique fora de um canto não abriu o diálogo.
  - Pré-definida noutra peça, numa aresta de 300 mm: a curva cadastrada entrou
    esticada na proporção certa (flecha de 59,4 mm virou 44,6 mm).
  - Dividir curva: um clique na aresta deixou a peça com 5 pontos.
  - Por raio, com grade e ímã: a barra de status mostrou Dist 10,00 cm, e o
    molde ficou com 200 × 200 mm e 314,0 cm² (π × 100² = 314,2).
  - Espiral de largura 60 e perímetro 1000: borda de dentro com 999,9 mm,
    60 mm entre as bordas em todos os pontos, e validação sem problemas.
  - Cada operação foi desfeita com Ctrl+Z.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). O
  roteiro usa uma pasta própria.
