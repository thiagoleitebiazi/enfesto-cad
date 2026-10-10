# ADR 0039 — Pences e pregas

## Contexto

Quarta etapa do pedido do ADR 0036: as seis ferramentas do grupo "Pregas e
Pences" da aba Produção, que o ADR 0035 tinha deixado desligadas.

O manual da referência descreve:

- **Criar pence no molde:** abertura e profundidade; abrir pence (acrescenta a
  abertura, com um pivô), recortar pence (tira o interior) ou marcada; vértice
  perpendicular; piques laterais e pique no vértice.
- **Pence interna:** altura 1, altura 2, largura, ângulo de inserção, linha
  auxiliar e pique interno.
- **Transferir ou fechar pence:** indica-se o início, o vértice e o fim da
  pence e, depois, a nova posição de corte (transferir) ou o pivô (fechar).
  Opção "somente recorte da pence".
- **Pregas:** modo (simples à direita, simples à esquerda, dupla), número de
  pregas, distância, largura 1, largura 2 e pique, sobre uma linha auxiliar.
- **Múltiplas pences:** não aparece no manual consultado.

O manual dá os campos e a ordem dos cliques, mas não a construção geométrica.

## Decisão

### O que é uma pence aqui

- A pence do contorno é um "V": duas pernas retas que saem do contorno e se
  encontram no vértice, dentro da peça.
  - **Recortada:** o V faz parte do contorno, e a peça perde o triângulo.
  - **Marcada:** o contorno não muda; as pernas entram como linha interna,
    com piques nas pontas e uma marca no vértice, se pedidos.
- A pence interna é um losango desenhado como linha interna.
- Não se guarda nenhum dado de pence. Depois de criada, ela é contorno, linha
  interna, pique e marca, como qualquer outra coisa da peça.

### Abrir a peça

Abrir pence, transferir, fechar e fazer pregas têm a mesma base
(`domain/regioes.ts`): a peça é dividida em duas regiões por uma reta, e uma
delas gira ou anda.

- **Move-se a região que não tem a linha de fio**, para o fio ficar onde está.
  Se o meio do fio não está em nenhuma, move-se a menor.
- O que está na região que se move vai junto: furos, linhas internas, marcas,
  cotas e os piques da borda dela.
- A reta tem de ficar toda dentro da peça.

### Ferramentas

- **Pence no contorno:** o diálogo pede o modo, a abertura, a profundidade e
  as marcações. Um clique no contorno marca o meio da pence.
  - As pontas ficam a meia abertura de cada lado, medida sobre o contorno.
  - O vértice fica em esquadro com a linha que liga as pontas. Sem "Vértice
    perpendicular", um segundo clique aponta a pence.
  - **Abrir:** um segundo clique, no contorno do lado oposto, marca o pivô. A
    peça é cortada da posição ao pivô, e um lado gira em torno dele até as
    bordas do corte ficarem afastadas da abertura pedida. A pence recortada
    ocupa essa abertura até a profundidade; dali até o pivô, o espaço aberto
    vira tecido da peça.
- **Pence interna:** um clique dentro da peça marca o centro. O eixo segue a
  linha de fio (a altura 1 para onde a seta aponta) ou gira dela pelo ângulo
  pedido. Tem de caber inteira na peça.
- **Múltiplas pences:** várias pences iguais, em esquadro com o contorno, a
  uma distância fixa de centro a centro, repartidas por igual dos dois lados
  do clique.
- **Transferir pence:** um clique no vértice de uma pence recortada e outro na
  nova posição, no contorno. A peça é cortada do vértice à nova posição, e um
  lado gira em torno do vértice até as pernas da pence antiga se encontrarem.
  A pence nova tem o mesmo vértice e o mesmo ângulo, e a área não muda.
- **Fechar pence:** um clique no vértice da pence recortada.
  - Com **pivô** (segundo clique, no contorno): a peça é cortada do vértice ao
    pivô, e um lado gira em torno do pivô até as duas pontas da pence se
    alinharem. As bordas do corte se sobrepõem, e o contorno novo é o de fora.
    Se as pontas estão a distâncias diferentes do pivô, sobra um degrau entre
    elas, e a mensagem diz de quanto.
  - **Somente o recorte:** nada gira. O contorno passa reto de uma ponta à
    outra, e a pence fica marcada.
- **Pregas:** dois cliques no contorno marcam a linha da prega. A peça abre na
  linha: um lado anda duas larguras (quatro, na prega dupla).
  - Entram as linhas de dobra (as duas bordas da abertura e as que a repartem
    em larguras iguais) e uma seta para onde o tecido dobra. A prega dupla tem
    duas setas, apontando para o meio.
  - Direita e esquerda são as de quem vai do primeiro ponto ao segundo.
  - Com largura 2, a prega abre mais numa ponta que na outra.
  - Com mais de uma prega, um terceiro clique diz de que lado ficam as
    outras. Elas são paralelas, e a distância é a que fica entre o fim de uma
    e o começo da seguinte.

Todas mostram a prévia no desenho antes do clique que aplica, dizem na faixa
de mensagens o que mudou na área, continuam ligadas para repetir, e cada
aplicação é um passo de desfazer. Os diálogos lembram os últimos valores.

### Leitura natural

Onde o manual não descreve a geometria, vale a leitura natural, dita na tela:

- **Múltiplas pences** não está no manual: a dica do botão e a nota do
  diálogo dizem isso.
- **Fechar pence com pivô:** o manual só dá a ordem dos cliques. A nota do
  diálogo diz que o resultado é a leitura natural.
- **"Somente recorte da pence"** foi lido como "fecha o recorte e deixa a
  pence marcada".

### Organização

- `domain/pences.ts`, `domain/pregas.ts` e `domain/regioes.ts`.
- `core/geometria.ts`: `andarNoContorno`, que acha o ponto a uma distância
  dada sobre o perímetro.
- `ui/ferramentasDePence.ts`: os diálogos, os cliques, a prévia e as
  mensagens das seis ferramentas. O `App` só guarda as opções e encaminha.
- A prévia do desenho ganhou `linhas`, para as linhas que entram na peça.

## O que NÃO foi feito

- **Indicar a pence por três cliques** (início, vértice e fim), como no
  manual: basta o vértice, e as pontas são os dois pontos vizinhos. Por isso
  as pernas têm de ser retas, e qualquer canto que entra na peça é aceito
  como vértice de pence.
- **Pence com pernas curvas** e **acabamento da boca da pence** ("Criar
  acabamento" e "Cortar intersecções" da referência).
- **Marca no vértice da pence recortada:** o vértice já é um ponto do
  contorno.
- **Transferir ou fechar uma pence marcada:** só as recortadas.
- **Tipos de linha:** as linhas de dobra e as pernas de pence são linhas
  internas comuns, sem estilo próprio (tracejado, cor).
- **Prega em linha curva ou quebrada**, e pregas não paralelas.
- **Verificar se o contorno se cruza** depois de abrir, girar ou fechar: como
  nas outras edições de forma.
- **Manter a peça dentro da mesa:** a peça que cresce pode passar da borda do
  tecido, e a validação acusa, como em qualquer peça fora da mesa.
- **Conferência com a referência:** não houve como comparar o resultado com o
  programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 832/832 em 50 arquivos (eram 726 em 46).
  - Novos: pences 39, pregas 18, andar no contorno 8, cliques, prévia,
    diálogos e mensagens 33, fita 8.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - Cinco mutações, uma por vez, todas pegas pelos testes e desfeitas.
- **Roteiro automático, janela de 1440 × 900 visível**, conferido no arquivo
  salvo do projeto. Peça de 400 × 300 mm (1200,0 cm²):
  - Pence recortada de 40 × 100: 1180,0000 cm², com abertura 40,0000 e
    profundidade 100,0000 medidas no contorno salvo, e 2 piques.
  - Marcada: contorno igual, 1 linha interna, 2 piques e 1 marca no vértice.
  - Apontada por um segundo clique: profundidade 100,0000 na direção clicada.
  - Aberta por pivô, com abertura 60 e corte de 400 mm: 1289,6620 cm², igual
    à conta (a cunha aberta menos o triângulo da pence).
  - Pence interna: losango no sentido do fio, com o eixo e 4 marcas. Junto da
    borda: recusada, nada mudou.
  - 3 pences de 20 × 80 a cada 60 mm: 1176,0000 cm² e 13 pontos.
  - Transferir: a área continuou 1180,0000 cm², com o mesmo vértice. A
    abertura e a profundidade novas dão o mesmo ângulo da pence antiga.
  - Clique num canto que não é pence: recusado com a explicação.
  - Fechar só o recorte: a área voltou a incluir o triângulo, e a pence ficou
    como linha interna. Fechar com pivô: o vértice saiu do contorno, e a
    mensagem avisou do degrau.
  - 1 prega simples de 20 mm numa linha de 400 mm: 1360,0000 cm², 3 linhas de
    dobra, 1 seta e 6 piques.
  - 3 pregas duplas de 10 mm a cada 40 mm: 1680,0000 cm², 21 linhas e
    30 piques.
  - Os diálogos recusaram abertura 0 e a falta da distância com mais de uma
    prega, e lembraram os últimos valores.
  - Cada operação foi desfeita com Ctrl+Z. Sem peça selecionada, os seis
    botões ficaram desligados, dizendo o que falta.
  - Os cinco diálogos, as prévias e os resultados foram conferidos nas
    imagens da tela.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
