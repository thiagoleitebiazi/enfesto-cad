# ADR 0042 — Arcos reconhecidos no contorno

## Contexto

O ADR 0037 fez curvas e arcos amostrados: viram pontos do contorno, sem
centro nem raio guardados. Por isso ficaram desligadas quatro ferramentas que
precisam de um arco como elemento: os arcos tangentes "à reta ou arco", "a
arco e reta" e "a 2 arcos", e a cota de Raio. O pedido foi fazê-las funcionar.

## Decisão

### O arco não é guardado: é reconhecido

- `core/arcos.ts` reconhece os arcos no próprio contorno: **quatro ou mais
  pontos seguidos sobre um mesmo círculo, em passos de até 30°** vistos do
  centro. Dá o centro, o raio e de que ponto a que ponto o arco vai.
- Com isso valem os arcos feitos aqui, os cantos arredondados, os círculos e
  os arcos que vêm prontos de um DXF ou de um PDF.
- Não há dado de arco para ficar desatualizado: se o contorno muda, o arco é
  reconhecido de novo, ou deixa de ser.
- Um polígono de poucos lados (passos maiores que 30°) não é arco. Um
  retângulo tem os quatro cantos num círculo, e também não é.
- Os pontos de um arquivo vêm arredondados, então dois passos contam como do
  mesmo círculo com uma folga de 0,05 mm, ou de 0,5% do raio.

### Ferramentas

- **Raio** (aba Conferência): um clique sobre um arco do contorno põe a cota.
  Ela guarda o centro e um ponto do arco, é desenhada como um raio do círculo
  ("R 50,0 mm") e acompanha a peça, como as outras cotas. Numa reta, a
  ferramenta avisa que ali não há arco.
- **Arco tangente à reta ou arco:** dois cliques no contorno. O arco sai do
  primeiro ponto dando continuidade ao elemento que fica do outro lado dele —
  uma reta ou um arco — e chega ao segundo. Só existe um arco assim. Se o
  elemento vizinho é um arco, a tangente é a do círculo, exata.
- **Arco tangente a arco e reta** e **a 2 arcos**, dado o raio: um clique num
  canto e o raio, num diálogo. O canto vira o arco tangente aos dois
  elementos que se encontram nele. Dos arcos possíveis, vale o que fica mais
  junto do canto; o raio que não cabe é recusado.
- **Cada ferramenta de canto vale para um tipo de canto.** Num canto de outro
  tipo, a faixa de mensagens diz qual ferramenta usar. O diálogo do raio
  mostra o nome da ferramenta do canto clicado.
- "Arco tangente a 2 retas" continua sendo o arredondar de sempre, que reduz
  o raio ao que cabe.

## O que NÃO foi feito

- **Arcos muito curtos e muito fechados** (menos de 24 mm de comprimento
  cobrindo mais de 120°) saem com passos maiores que 30° e não são
  reconhecidos.
- **Curvas que não são arcos de círculo** (as da ferramenta Curva) continuam
  sem dado próprio: não têm raio nem centro.
- **Editar o raio de um arco existente** por um número: é preciso refazer o
  arco.
- **Ponto no centro do arco** e as outras ferramentas de pontos e retas: ficam
  para a etapa das ferramentas de elementos.

## Verificação (Electron real, build de produção)

- **Testes:** 1049/1049 em 58 arquivos (eram 1009 em 56).
  - Novos: reconhecimento de arcos, direção do contorno, arco tangente e
    concordância 20; ferramentas de canto, cota de raio e a ferramenta de
    trecho 15; fita 5.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático**, conferido no arquivo salvo. Peça de 400 × 300 mm:
  - Arco tangente a uma aresta: o centro do arco ficou na perpendicular à
    aresta pelo ponto de partida, e o raio foi o que leva ao segundo ponto.
  - Cota de Raio sobre esse arco: R 151,916 mm, igual ao raio do arco. Um
    clique numa reta só avisou.
  - "Arco tangente a 2 retas" num canto de arco e reta, e o contrário: a faixa
    disse qual ferramenta usar, e o diálogo não abriu.
  - Arco tangente a arco e reta com raio 30: o arco novo tem raio 30,000, o
    centro a 30,000 mm da reta e a 121,916 mm do centro do arco (o raio dele
    menos 30).
  - Arco tangente a 2 arcos com raio 15: o canto saiu do contorno.
  - Cada operação foi desfeita com Ctrl+Z.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
