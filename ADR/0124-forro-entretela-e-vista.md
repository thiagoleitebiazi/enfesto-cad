# ADR 0124 — O forro, a entretela e a vista tirados da peça principal

## Contexto

O usuário pediu para estudar a referência a fundo e implementar o que ela tem. A segunda rodada do estudo
(`ESTUDO-DE-FUNCIONALIDADES.md`, "Segunda rodada") leu as páginas oficiais de cada módulo da referência e listou o que
ainda faltava. O primeiro item da modelagem: "Automatic generation of linings, interfacings and facings from the main
pattern". O estudo já tinha essa linha com 🟡: "Elemento paralelo, Bainha, Dobrar; não um comando 'gerar forro'".

Até aqui, para tirar a vista de uma frente era preciso fazer o elemento paralelo, extrair a região e renomear. Para o
forro, copiar a peça e cortar a barra. Para a entretela, copiar e recuar à mão.

## Decisão

**1. Um comando: "Forro, entretela e vista"**, na aba Produção, ao lado da Bainha. A peça selecionada não muda; a
peça nova entra no projeto ao lado dela.
- **A vista (o revel):** a faixa ao longo de um trecho do contorno (o decote, o meio da frente, a cava), na largura
  pedida, ou numa largura em cada ponta. Ela vai para dentro da peça. O trecho é indicado como na Bainha: dois cliques
  no contorno, o trecho mais curto entre eles.
- **O forro:** a peça sem a faixa de um trecho, ou seja, encurtada na barra, ou sem a vista. Fica com a costura da
  peça.
- **A entretela:** a peça inteira recuada em volta, sem a margem de costura nem as marcações. Sai na hora, sem cliques.

**2. Um corte só para a vista e o forro** (`dividirPeloTrecho`, em `domain/pecasDerivadas.ts`):
- **A paralela:** a paralela ao trecho, para dentro, com a largura de cada ponto (da largura do começo à do fim, pela
  distância andada) e em esquadria nos cantos, como a da Bainha.
- **As pontas** da paralela vão até o contorno na direção dela. A que já está no contorno (o trecho que começa num
  canto) é a própria ponta.
- **O corte:** a peça é cortada por essa linha (`metadeDoMolde`, o mesmo do Cortar e do Dobrar). A parte com o trecho
  é a vista; a outra, o forro. As pontas da vista seguem o contorno da peça (a costura do ombro, do lado), como se
  traça uma vista.
- **A largura que passa da peça** nesse trecho é dita e não corta nada.

**3. A entretela** (`entretelaDoMolde`): o contorno deslocado para dentro pelo recuo. O recuo grande demais vira o
contorno do avesso, e então é dito.

**4. O grupo do encaixe** (ADR 0103): o forro vai no grupo "Forro" e a entretela no grupo "Entretela", porque são de
outro tecido; a vista fica no tecido da peça.

**5. O lugar da peça nova:** à direita da peça principal (o y do mundo), levada mais para a direita até não ficar em
cima de nenhuma outra (`aoLadoSemSobrepor`). A vista e a entretela da mesma peça ficam uma depois da outra.

**6. Na janela** aparecem:
- o tipo, em três opções com a explicação;
- a largura (da vista) ou quanto encurta (o forro);
- a largura da outra ponta, opcional;
- o recuo da entretela.

Depois de "Continuar", a vista e o forro pedem os dois cliques, com a prévia tracejada da peça que vai sair. A
entretela sai direto, e a ferramenta deixa de esperar cliques.

## O que não foi feito

- **A folga do forro** (o forro um pouco mais largo que a peça, para não repuxar) não é acrescentada: o forro sai na
  medida da peça, menos o trecho.
- **A vista em várias peças de uma vez** (a vista do decote que pega a frente e as costas) é feita peça por peça.
- **A entretela em parte da peça** (só na vista, só no punho) é feita tirando a vista e depois a entretela dela.

## Conferência

- `domain/pecasDerivadas.test.ts` (8):
  - **a vista do alto:** a faixa de 60 × 250 mm, e o forro com o resto;
  - **a vista com duas larguras:** o trapézio, e o trecho no meio do lado que vai até os lados;
  - **a vista do decote em V:** contém o decote, com o bico da paralela em esquadria (80 + 40·√(20² + 25²)/25) e toda
    dentro da peça;
  - **o forro** 20 mm mais curto, com a costura;
  - **a entretela** recuada 2 mm, sem costura, no grupo "Entretela", e o recuo grande demais dito;
  - **a peça pronta:** o nome, o grupo e o lugar ao lado;
  - **duas peças tiradas da mesma** não se sobrepõem;
  - **o que não dá:** a largura que passa da peça, o mesmo ponto duas vezes, a vista sem trecho, a largura zero.
- `ui/BarraDeFerramentas.test.tsx`: o botão no grupo "Complementar moldes", chamando a ferramenta, e pressionado
  enquanto ligada.
- `npx vitest run`: 167 arquivos, 2993 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 90 conferências, nenhuma falha, nenhum aviso no console. Duas são novas, com a
  peça 1 escolhida pela lista:
  - **a vista de 30 mm** pelo trecho do primeiro lado, clicado com o mouse, e **a entretela** na hora: as duas peças
    novas ao lado, a entretela sem costura e no grupo "Entretela", uma depois da outra;
  - **dois Desfazer** tiram as duas: 5 peças antes, as 3 de antes depois.

  Ao montar o teste, a conta da posição na tela precisou ser refeita depois de entrar na ferramenta. A faixa de
  instrução ("Vista: clique no contorno…") aparece em cima do desenho e o empurra para baixo, e os cliques caíam 8 cm
  acima do lado.
