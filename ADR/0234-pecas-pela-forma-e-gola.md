# ADR 0234 — As peças pela forma, a gola e a barra do punho

## Contexto

Os moldes reais de quem usa o programa, em DXF e em PDF, trazem as peças sem nome ("arquivo-1", "arquivo-2"…). O provador decidia o lugar de cada peça pelo nome: todas abriam fora do corpo, e era preciso escolher peça por peça e sugerir as costuras à mão. Além disso, no molde:

- cada peça vem uma vez, mas a manga é um par;
- o mesmo arquivo pode trazer duas mangas (curta e comprida) da mesma cabeça, como opções do modelo;
- a gola de ribana não tinha lugar nenhum no corpo;
- a folga da barra do punho abre em duas orelhas, que ficavam de fora, como abas;
- num arquivo de poucos pontos, a divisão da cabeça da manga errava por quase 1 cm, e a costura abria 12 mm.

## Decisão

`domain/formaDasPecas.ts` lê a forma, sem depender do nome, e só afirma o que dá para afirmar:

- **Tronco:** o alto do contorno sobe dos dois lados do meio e desce para os ombros, em qualquer um dos quatro giros. O decote mais fundo é a frente.
- **Manga e gola** só se reconhecem ao lado de um tronco. A manga tem a curva para fora, é menor que o tronco e tem um eixo até o punho. A gola é um retângulo ao menos 4 vezes mais comprido que largo.
- **Sem tronco, nada muda.** Uma manga sozinha não se distingue de uma saia.
- O nome e o que está guardado mandam: a forma só preenche o que ficou fora. O projeto não muda; é tudo só para o provador (`pecasDoProvador`).

A manga vira par, salvo se vierem duas iguais (a direita e a esquerda). De comprimentos diferentes, fica a mais curta e a aba Peças mostra a escolha **Manga do modelo**, que leva as costuras junto (`comAManga`). A folga do punho sai, e a manga fica do comprimento acabado; um chanfro, que fecha em vez de abrir, fica. A cabeça ganha pontos a cada 6 mm, e a costura da cava passou de 12,5 mm de abertura para menos de 3.

Com a forma reconhecida, a peça já abre no corpo e costurada, com um aviso do que foi reconhecido.

**A gola** é a posição `gola`. Dobrada ao meio no comprido, uma camada só na simulação, e esticada até 98% do decote, como é costurada. Ela fecha no ombro esquerdo; a beira de baixo vai com o decote da frente e o das costas, na proporção deles (`costasDaGola` também divide o anel de partida).

A dobra precisa ser mais curta que a beira, porque é ela que aperta o pescoço. Foram quatro tentativas, olhando a imagem:

1. Gola reta: a beira de cima sobrava e ondulava.
2. Desenhada em trapézio: fechada em anel, a emenda quebra num V, porque um trapézio não vira um cone liso.
3. Emenda no meio das costas: vira uma dobradiça, e o decote a puxa num V.
4. Um retângulo com o comprimento de **descanso** menor na dobra (`descansoDaGola`), emendado no ombro, com a dobra a 89% da beira. A 85% a frente fazia um V; a 93%, um vinco.

**A costura ao lado.** O franzido era uma onda só, de 7 em 7 mm, que de perto parecia uma fileira de pontinhos; agora são três ondas que não repetem. O sulco ficou menos escuro. A beira da gola é uma dobra, sem barra nem pesponto.

## O que não foi feito

- Saia e calça sem nome: a forma delas não se distingue com segurança, e não havia moldes reais para conferir. Continuam pelo nome, ou à mão.
- Decote em V, de dois lados: a gola não costura sozinha. Escolha à mão.
- A gola é uma camada só: por dentro não se vê a segunda.
- A folga da barra da frente e das costas não sai: sem as orelhas, o molde não diz quanto ela mede.
