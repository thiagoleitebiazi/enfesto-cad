# ADR 0097 — Um visual com cores: a marca em azul-marinho e uma cor para cada grupo de ferramentas

## Contexto

Pedido do usuário, sobre a melhoria visual do ADR 0093: "ficou igual, queria mais profissional, mais organizado e com
cores". O ADR 0093 tinha arrumado a base (os controles das janelas, o planejamento, os estados), mas a tela principal
— a que se vê o tempo todo — continuou quase a mesma: barras cinza-claro, ícones cinza, abas cinza.

Pedido anterior que continua valendo: as cores das peças e da mesa na área de desenho e a lógica de desenho não mudam
(o desenho e as réguas são pintados pelo programa, não pelo CSS).

## Decisão

Uma mudança que se vê na tela principal e nas janelas, só de estilo (CSS e a marca na barra de cima):

- **A marca:** azul-marinho (`--marca-*`) na barra de cima, na barra de status e no cabeçalho das janelas, e um
  laranja (`--destaque`) para marcar a aba aberta e a borda do cabeçalho das janelas.
- **Barra de cima:** a marca do programa à esquerda (camadas empilhadas, como as folhas de um enfesto, e "Enfesto
  CAD"), os ícones do acesso rápido claros. As abas claras sobre o azul-marinho; a aberta é uma lingueta branca com o
  traço laranja em cima; "Arquivo" em azul cheio.
- **A fita:** cada grupo de ferramentas com a sua cor (`--grupo-1` a `--grupo-8`: azul, verde-água, roxo, laranja,
  magenta, verde, ciano e âmbar, na ordem da tela), nos ícones, no fundo ao passar o mouse, na ferramenta ligada e num
  traço curto sob o nome do grupo. O ícone grande fica num quadradinho com o fundo claro da cor do grupo. A ferramenta
  desligada perde a cor (cinza): dá para ver de longe o que está disponível.
- **Barra do projeto:** a aba do projeto com o traço azul; o tecido e o enfesto em etiquetas, verde-água e roxo.
- **Lista de peças:** o título com o traço azul; cada peça num cartão branco; a selecionada com o cartão azul-claro, a
  borda azul e o traço à esquerda.
- **Barra de status:** azul-marinho, com "Salvo às…" e "Validação" em selos — verde, amarelo (avisos) ou vermelho
  (erro, ou não salvo), com o ícone e o texto (a cor não é o único sinal).
- **Janelas:** o cabeçalho azul-marinho com o título branco e a borda laranja.
- A barra de visualização, embaixo do desenho, branca, com os ícones no azul da marca.

Não mudou: a área de desenho (as cores das peças, da mesa e da seleção; as réguas), os nomes, os botões, os atalhos,
os cálculos e os dados.

## Conferência

- `npx vitest run`: 132 arquivos, 2626 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O programa gerado, fotografado tela por tela (pasta de dados descartável) a 1024 × 700 (a menor janela) e a
  1280 × 720 (a tela de quem usa): sem rolagem horizontal, a fita compactando como antes na janela menor, sem erro na
  página.
- O teste de uso do repositório, no Windows: 17 conferências, nenhuma falha. Numa primeira rodada, a conferência do
  arrasto falhou (as peças andaram para o lado errado); repetida, passou — o teste manda movimentos de mouse para a
  janela, e o mouse de verdade passando por cima dela atrapalha. O estilo não mexe no arrasto.
