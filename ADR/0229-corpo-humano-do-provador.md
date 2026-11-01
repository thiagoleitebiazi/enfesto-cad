# ADR 0229 — O corpo humano do provador

## Contexto

O manequim era feito de elipses e cones, com a cabeça num elipsoide (ADR 0111). Nenhuma luz salva esse corpo. Desenhar um corpo à mão também não daria certo: a anatomia é o que mais se nota.

## Decisão

**A malha é a do MakeHuman**, que seus autores liberaram em CC0 1.0 (domínio público, setembro de 2020). O uso é livre, inclusive em produto, sem obrigação de crédito; o crédito fica no arquivo de dados assim mesmo. Entram 13 524 pontos: o corpo e os olhos. Ficam de fora a língua, os dentes, os cílios e o cabelo.

`scripts/corpo/gerar-corpo.cjs` gera `domain/corpoHumano.dados.ts` a partir dos arquivos originais (a malha base, as formas e os pesos do esqueleto), que não ficam no repositório. São 671 KB.

**Três formas** (`Público` do manequim): feminina, masculina e infantil. A infantil é a média das duas de criança, neutra.

**O ajuste às medidas** (`domain/corpoHumano.ts`):
- as alturas seguem os níveis do manequim (gancho, quadril, cintura, busto, axila, ombro, pescoço);
- as voltas são acertadas nesses níveis, e entre eles fica a forma do corpo;
- os braços e as pernas seguem os ossos, com os pesos da própria malha, que é o que deixa o ombro girar sem amassar;
- as voltas do busto e do quadril são medidas de novo no fim, como a fita, e o que falta entra aos poucos.

**O acabamento é o de um manequim de vitrine:** cor única, sem pele, e o peito liso. O bico marcaria o tecido justo, e a roupa é o assunto.

**A colisão** deixou de ser por elipses e cones. O corpo vira um campo de distâncias numa grade de 8 mm (`campoDoCorpo`), exato perto da superfície. Ler a grade custa o mesmo em qualquer parte do corpo, e ela conhece a axila, o gancho, as mãos e o queixo. Medir leva cerca de meio segundo, ou 0,8 s com os braços abertos, que alargam a grade; os últimos seis corpos ficam guardados.

**O que ficou igual:** as seções elípticas do tronco continuam arrumando as peças em volta do corpo. Só o que se vê e o que empurra o tecido mudou.

**A sugestão de costuras** passou a aceitar lados evasê. Na peça que abre para baixo, as pontas de cima ficam longe na arrumação, e o meio era comparado com a média das pontas: nenhum vestido evasê tinha as laterais sugeridas. Agora ele é comparado com a ponta mais afastada. A barra continua recusada: ali as duas pontas se tocam e o meio fica longe.

## O que não foi feito

- **Cabelo, pele e olhos pintados.** Um humano fotográfico cairia no estranho; o manequim de vitrine é realista como o que é.
- **A pose das pernas.** Só os braços têm poses (ADR 0138).

## Conferência

- `domain/corpoHumano.test.ts`: as voltas e a altura nas três formas e num corpo grande; os pés no chão; a simetria; a pose; o peito liso; a superfície no zero da grade; o que é dentro e o que é fora.
- `domain/provador3d.test.ts`, `domain/desenhoNoCorpo.test.ts`: passam no corpo novo, ajustados no que dependia da elipse.
