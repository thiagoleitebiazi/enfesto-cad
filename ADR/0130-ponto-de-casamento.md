# ADR 0130 — A ferramenta "Ponto de casamento"

## Contexto

O risco casa listras e xadrez por marcas na peça: "casamento" (ADR 0089) e "casamento: nome" (ADR 0129). A janela do
planejamento diz "Ponha a marca (aba Marcações)".

Ao preparar o teste de uso do casamento por mais de um ponto, apareceu a lacuna: **nenhuma tela dava nome a uma
marca.** O rótulo (`Marca.rotulo`) só existia nos dados. Quem planejava um tecido listrado não tinha como pôr a marca
que o planejamento pedia, e o casamento automático não saía para ninguém.

## Decisão

**1. A ferramenta "Ponto de casamento"** (aba Marcações, grupo novo "Listras e xadrez"):
- **A janela pergunta o grupo.** Em branco, é o ponto principal, que cai na linha do desenho. Com um nome ("manga",
  "bolso"), é o ponto daquele grupo, que cai na mesma listra que o do mesmo grupo nas outras peças. A nota explica a
  cava da frente e a cabeça da manga.
- **Depois de continuar,** cada clique numa peça põe o ponto ali. Vale a peça selecionada, se o clique cai nela; senão,
  a de cima. Assim dá para marcar a frente e a manga sem trocar de ferramenta.
- **Na mesma peça,** o ponto do mesmo grupo muda de lugar: um de cada grupo por peça.
- **A faixa de instrução** diz o grupo e o que aconteceu ("O ponto “casamento: manga” foi posto em “Manga”"). Esc sai.
- **O que é recusado:** o clique fora das peças, e o nome com dois-pontos ou traço, que separam o nome no rótulo.

**2. As marcas** (`comPontoDeCasamento`, em `domain/pontosDeCasamento.ts`) têm o rótulo que o risco lê: "casamento"
e "casamento: manga", em minúsculas, como `grupoDaMarcaDeCasamento` devolve.

**3. No desenho,** os pontos de casamento aparecem como no desenho do risco: o principal é um círculo vermelho; o de um
grupo, um losango laranja com o nome. As outras marcas continuam o ponto verde-azulado de antes.

## O que não foi feito

- **Escolher o ponto pelo pique** (o ponto de casamento num pique da cava, que anda com ele na graduação): o ponto é
  uma marca solta, que acompanha a peça na proporção, como as outras marcas.
- **Apagar um ponto de casamento pela ferramenta:** apaga-se como as outras marcas, pela Manipulação rápida (o
  elemento escolhido e Delete).

## Conferência

- `domain/pontosDeCasamento.test.ts` (3):
  - o rótulo e o nome, que o risco lê de volta;
  - o ponto posto onde foi clicado; o do mesmo grupo anda; o de outro grupo é outro ponto; a marca que não é de
    casamento não muda;
  - fora da peça, ou com dois-pontos no nome, não.
- `ui/BarraDeFerramentas.test.tsx`: o grupo "Listras e xadrez" na aba Marcações; o botão abre a ferramenta e fica
  apertado enquanto ligada.
- `npx vitest run`: 172 arquivos, 3041 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- **O teste de uso**, no programa gerado: 105 conferências, nenhuma falha, nenhum aviso no console. A nova, com o mouse
  de verdade:
  - na pala de teste, o ponto principal; depois, o grupo "Manga" na pala e na saia;
  - as marcas ficam gravadas com os rótulos "casamento" e "casamento: manga" (na pala) e "casamento: manga" (na saia);
  - o recado diz onde o último foi posto;
  - a foto de perto (a roda do mouse aproxima no ponto) mostra o círculo vermelho e os dois losangos laranja com
    "manga".

  Ao montar o teste, os cliques caíram fora das peças duas vezes, por dois motivos:
  - a conta da posição na tela foi feita antes da faixa de instrução aparecer;
  - o ponto escolhido ficou a poucos milímetros da borda, e nesse zoom um pixel tem uns 6 mm.

  O teste agora refaz a conta depois de entrar na ferramenta, e escolhe o ponto mais para dentro da peça.
