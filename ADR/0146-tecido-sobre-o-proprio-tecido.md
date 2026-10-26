# ADR 0146 — O tecido sobre o próprio tecido no provador 3D

## Contexto

A referência simula o caimento com o tecido colidindo consigo mesmo: a barra que dobra, a peça que encosta na outra.
O estudo marcava a física do provador como simplificada, e uma das faltas era "sem o tecido colidir consigo mesmo"
(ADR 0111). O tecido batia só no corpo e no chão. Duas camadas, como a frente e as costas caídas no chão ou uma dobra
da barra, entravam uma na outra.

## Decisão

**1. A regra** (`domain/simulacaoDoTecido.ts`, `AutoColisao`): dois pontos do tecido que chegam mais perto que um
raio são afastados até o raio.
- **O raio:** meio passo da malha, e ao menos o dobro da espessura. Na malha normal, de 20 a 25 mm, ele fica perto de
  13 mm.
- **Os pares que não contam:**
  - **Os vizinhos no próprio molde,** a até 2,5 raios de distância no molde: estão perto porque são vizinhos.
  - **Perto das costuras,** que é onde as peças se juntam. Em peças diferentes, basta um dos dois estar a até 3 raios
    (no molde) de um ponto costurado; isso cobre as pontas, como a axila. Na mesma peça, os dois precisam estar perto
    de costura: são as duas beiradas da manga, costuradas embaixo do braço.
  - **As camadas diferentes:** o bolso costurado sobre a frente (ADR 0123).

**2. O custo** (`paresCandidatos`, `separarOTecido`):
- **A busca:** os pares que podem se encostar, a até 1,5 raio, são buscados uma vez por quadro, por uma grade de
  células.
- **O afastamento:** esses pares são afastados em cada passo.
- **Sem quicar:** como no corpo, o empurrão não vira velocidade para fora.
- **Durante a costura** a regra fica desligada: as peças ainda estão se juntando.

**3. Os problemas achados no caminho** (pelos testes do provador):
- **Afastar uma vez por quadro não segura:** a camada de cima afundava com o peso nos subpassos, e a simulação nunca
  assentava. Daí a busca por quadro com o afastamento por passo.
- **As beiradas da manga:** sem a exceção da peça costurada nela mesma, elas se afastavam e abriam a costura de baixo
  do braço (13 mm, contra o limite de 6).

**4. A tela:** na aba Tecido do provador, "O tecido não atravessa a si mesmo (… um pouco mais lento)", ligado por
padrão. Desligado, a simulação fica mais rápida (`ligarAutoColisao`). A escolha fica na montagem (`autoColisao`: só o
desligado é escrito), e mudar recomeça a simulação.

## O que não foi feito

- **A colisão exata de triângulo com triângulo:** a regra é de ponto com ponto. Com a malha grossa, uma ponta fina
  ainda pode passar entre dois pontos.
- **Os vincos menores que a malha.**

O provador continua "física simplificada": mostra o caimento e onde a peça repuxa, mas não substitui a peça-piloto.

## Conferência

- `domain/provador3d.test.ts` (4 novos):
  - **Um par de pontos da mesma peça,** longe no molde e a 2 mm no espaço: é afastado até o raio, cada um a metade; o
    ponto preso não anda.
  - **Os pares que não contam:** vizinhos no molde, camadas diferentes e perto da costura (em peças diferentes, um;
    na mesma, os dois).
  - **Uma saia larga sem costura, que cai no chão em duas camadas:** com a colisão, o pior par fica a menos de 0,3
    raio de entrar e a simulação assenta. Sem ela, entra mais de 0,8 raio: 12,3 de 12,9 mm, as camadas a 0,6 mm.
  - **A montagem guarda a escolha.**
- **Os testes do provador de antes continuam passando, com a colisão ligada:**
  - a saia, a regata e a camiseta com as mangas: as costuras fechadas e nada atravessa o corpo;
  - o fio, a trama e o viés;
  - o bolso.

  Os 30 testes levavam 24 s e passaram a levar 28 s.
- `ui/PainelDoProvador3D.test.tsx` (1 novo): a opção ligada; desligar e religar ficam guardados.
- `npx vitest run`: 188 arquivos, 3133 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 124 conferências, nenhuma falha. A opção aparece ligada, e a saia do teste,
  simulada com ela, assenta em 3,7 s com as costuras a 2 mm.
