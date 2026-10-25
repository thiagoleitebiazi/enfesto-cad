# ADR 0131 — O brilho e a transparência do tecido no provador 3D

## Contexto

Da segunda rodada do estudo: o provador 3D da referência mostra o tecido que brilha (o cetim, a seda) e o que deixa
ver o corpo (o voal, a organza). No Enfesto CAD, todo tecido era pintado fosco e opaco, só com a luz que bate na face
(ADR 0111).

## Decisão

**1. Duas propriedades novas do tecido do provador** (`Tecido3D.brilho` e `Tecido3D.transparencia`, de 0 a 100,
opcionais: sem elas, fosco e opaco).
- **Só mudam a vista,** não a física. Mexer nelas não recomeça a simulação: a chave que decide simular de novo deixa
  de fora o brilho, a transparência e o nome do tecido pronto. Antes, qualquer régua trocava o nome para
  "Personalizado" e recomeçava a simulação.
- **A seda pronta** já vem com brilho 55 e transparência 10.

**2. O brilho** (`montarCena`, em `ui/cena3d.ts`) é o reflexo de Blinn-Phong. A cor vai para o branco onde a face está
de frente para o meio do caminho entre a luz e o olho.
- Quanto mais brilho, mais forte e mais estreito o reflexo (o expoente vai de 8 a 68): o cetim tem o risco de luz; o
  tafetá, uma mancha larga.
- O reflexo nunca passa de 90%.
- Na estampa, uma película branca por cima, na força do reflexo.
- Pintado pelo mapa de tensão, sem brilho: a cor diz o quanto estica.

**3. A transparência** é a opacidade do triângulo do tecido, de 100% a 15% (o voal não some).
- O corpo, pintado antes (mais longe), aparece por trás.
- O tecido transparente não leva o traço que fecha as frestas entre os triângulos: o traço dobraria a cor nas
  emendas.

**4. A aba Tecido** ganha as réguas "Brilho" (fosco, algodão → brilha, cetim) e "Transparência" (opaco → deixa ver,
voal). Elas ficam guardadas na montagem do projeto e são lidas de volta.

## O que não foi feito

- **O brilho que muda com o fio** (o cetim brilha diferente no sentido do fio): o reflexo é o mesmo em toda direção.
- **A sombra que um tecido faz no outro** e a cor do tecido de baixo vista através do de cima: a transparência deixa
  ver o que já foi pintado, na ordem de distância.
- **O zíper como aviamento e a biblioteca de componentes:** ficam na lista.

## Conferência

- `ui/cena3d.test.ts` (3):
  - **fosco e opaco:** nenhum reflexo, nenhuma transparência;
  - **com brilho:** a esfera de tecido reflete; com mais brilho, o reflexo é mais forte e cobre menos faces; não passa
    de 0,9; pelo mapa de tensão, nenhum;
  - **com transparência:** 40 dá opacidade 0,66; 100 dá 0,15.
- `ui/PainelDoProvador3D.test.tsx` (1 novo): a régua começa em 0; a seda pronta traz 55 e 10; a régua da transparência
  muda o tecido guardado.
- `npx vitest run`: 173 arquivos, 3045 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 106 conferências, nenhuma falha. A nova: com a saia assentada, o brilho em 85 e a
  transparência em 55 deixam a saia assentada ("Assentou…", sem recomeçar). Na foto, as pernas aparecem através da
  saia, com o reflexo. As réguas voltam a 0 para os passos seguintes.

  Na primeira rodada, a simulação recomeçou: a régua trocava o nome do tecido para "Personalizado", e o nome estava na
  chave da física. Ele saiu da chave.
