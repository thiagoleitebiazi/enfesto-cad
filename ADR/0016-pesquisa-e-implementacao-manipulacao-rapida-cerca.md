# ADR 0016 — Pesquisa das funcionalidades pendentes e implementação do que ficou claro

## Contexto

Depois do ADR 0015 ter deixado explícito quais ferramentas do Audaces
Moldes Avançado não foram implementadas por falta de certeza sobre seu
comportamento exato, o usuário pediu para pesquisar essas funcionalidades
e implementá-las. Pesquisa feita via busca na web (documentação/manuais
públicos do Audaces e de um concorrente, molde.me, que documenta
conceitos equivalentes de forma mais acessível) — não acesso direto ao
software.

## O que a pesquisa revelou

- **"Definir cerca"**: "Define um contorno, na área selecionada, para
  utilizar a ferramenta Mover cerca" — desenha uma seleção retangular.
- **"Mover cerca"**: move os elementos que caíram dentro da cerca
  (pontos de controle, piques internos, linhas auxiliares).
- **"Manipulação rápida"** corresponde à aula "Mover pontos: como
  alterar de forma rápida" do treinamento oficial Audaces — uma forma
  mais rápida/abrangente de mover pontos do que um de cada vez.
- **"Redefinir perímetro"**: redimensiona um segmento por suas
  extremidades, com um modo específico ("Manter extremos") que só existe
  para curvas — não se aplica a segmentos retos.
- **"Converter em costura"**: no Audaces v14+, a margem de costura passa
  a ser uma "projeção" do molde base, vinculada à forma dele — ou seja,
  é conceitualmente a mesma coisa que este app já faz com
  `margemDeCosturaMm`/`contornoDeCorte()` (ADR 0005): a linha de corte é
  sempre recalculada a partir do contorno base + a margem configurada.
- **"Copiar ou trocar elemento"**: aula "substituindo um segmento por
  outro" — troca a forma de um segmento pela forma de outro. Achei o
  título da aula, não uma descrição do comportamento exato (geometria de
  reconciliação entre segmentos de tamanhos diferentes, etc.).
- **"Transformar elementos"**: aparece associada a "transformar contornos
  em moldes e inserir linhas auxiliares" — não achei uma definição
  precisa o suficiente para implementar com confiança.

Fontes: manual digital Audaces Moldes VS10 (idoc.pub/PDFCoffee), páginas
de ajuda do molde.me (`ajuda/redefinir-perimetro`,
`ajuda/estudio/pontos-de-controle`), e resultados de busca sobre o
currículo do Audaces Academy (aulas 23, 24 e 26 do curso Audaces Moldes).

## Decisões

### Unificado: seleção múltipla de pontos + cerca (marquee), numa única ferramenta

Em vez de três botões separados ("Manipular pontos" genérico,
"Manipulação rápida", "Definir cerca"+"Mover cerca" como dois passos),
implementei tudo como uma extensão do "Mover ponto" que já existia —
justificativa: as três coisas são, no fundo, a MESMA operação (mover
vértices do contorno) com métodos de SELEÇÃO diferentes, não
capacidades distintas:

- **Shift+clique** num vértice: acrescenta/remove da seleção, sem
  arrastar (constrói um grupo).
- **Clique e arrasto num espaço vazio**: desenha uma "cerca" retangular;
  ao soltar, todos os vértices dentro dela ficam selecionados — mesmo
  comportamento do "Definir cerca" do Audaces, sem precisar de um passo
  separado para "confirmar" a cerca antes de poder mover.
- **Arrastar qualquer vértice já selecionado**: move TODOS os vértices
  selecionados juntos pelo mesmo deslocamento — "Mover cerca"/
  "Manipulação rápida" na prática.
- Arrastar um vértice que NÃO está selecionado continua funcionando como
  antes (seleciona só ele e arrasta) — compatível com o fluxo já
  existente desde o ADR 0013.

Nova função de domínio `moverVariosPontosDoMolde(molde, indices, delta)`
(testada), reaproveitando a mesma lógica de bookkeeping simples (soma
vetorial por índice) que já existia para o caso de um único ponto.

### "Redefinir perímetro" não ganhou uma ferramenta própria

Como o modo "Manter extremos" (o que distingue de verdade essa
ferramenta de simplesmente mover pontos) só existe para curvas — e este
app ainda não tem curvas reais — "Redefinir perímetro" aplicado a
segmentos retos é equivalente a mover os pontos das extremidades do
segmento, já coberto por "Mover ponto". Não haveria comportamento novo
para implementar sem antes ter curvas.

### "Converter em costura" já existe — não é uma peça faltando

Confirmado pela pesquisa: é o mesmo conceito de "Margem de costura (mm)"
já presente no painel de Propriedades desde o ADR 0005 (a linha de corte
tracejada já é recalculada ao vivo a partir do contorno + a margem).
Nenhuma ferramenta nova precisa ser criada — o rótulo do Audaces é
diferente, a funcionalidade por trás é a mesma.

### "Transformar elementos" e "Copiar ou trocar elemento" continuam fora

Mesmo depois de pesquisar, não achei uma descrição precisa o bastante do
comportamento (o quê exatamente é "transformado", como a geometria de
"trocar um segmento por outro" reconcilia tamanhos diferentes). Prefiro
deixar de fora com essa explicação documentada a implementar um palpite
e chamá-lo pelo nome certo sem ele fazer a coisa certa.

## Verificação (Electron real, build de produção)

Teste desenhado para ser matematicamente decisivo, não só visual: depois
de mover em grupo só os dois vértices "de baixo" de um retângulo por um
deslocamento paralelo à aresta que os une, a Largura do retângulo (eixo
perpendicular ao deslocamento) ficou **exatamente** igual
(384.6mm antes e depois), a Altura cresceu **exatamente** pelo
deslocamento aplicado (538.5mm → 1500.0mm), e a Área ficou **exatamente**
igual (2071.0 cm² antes e depois) — esse último resultado, à primeira
vista suspeito, na verdade é a assinatura matemática correta de um
cisalhamento (shear): mover uma aresta inteira por um deslocamento
paralelo a ela mesma preserva a área exatamente, prova por geometria
analítica (fórmula do shoelace), não coincidência. Os três números juntos
só se explicam se a cerca selecionou EXATAMENTE os 2 vértices certos —
qualquer bug (selecionar os 4, ou só 1) teria produzido números
diferentes. Confirmado visualmente também: a peça virou um paralelogramo
alongado, com os 2 vértices de cima intactos.

Shift+clique testado separadamente: 2 vértices ficam destacados em azul
(cor de seleção) contra o laranja padrão dos demais, e arrastar um deles
move os dois juntos mantendo a peça retangular (mesma aresta, só
deslocada).

241/241 testes (2 novos para `moverVariosPontosDoMolde`), typecheck/lint
limpos.

## Consequências

- `onMoverPontoDoMolde` (prop/callback de ponto único) foi removida da
  UI — toda edição de "mover ponto" agora passa por
  `onMoverVariosPontos`, tratando 1 ponto como o caso N=1 do mesmo
  mecanismo, em vez de manter dois caminhos paralelos. A função de
  domínio `moverPontoDoMolde` (ponto único, posição absoluta) continua
  existindo e testada, só não está mais ligada a esta interação
  específica da UI.
- A pesquisa ficou documentada com fontes específicas para que, se o
  usuário tiver acesso direto ao Audaces e quiser confirmar/corrigir
  algum desses comportamentos, dê pra revisar a decisão com uma base
  concreta em vez de começar do zero.
