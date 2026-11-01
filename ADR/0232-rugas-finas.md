# ADR 0232 — As rugas finas

## Contexto

As dobras grandes já vêm da simulação (ADR 0230). A malha de 12 mm não tem pontos para um vinco de 1 cm, e a de 8 mm é lenta. Mas a simulação sabe onde esses vincos estariam: é onde o pano está apertado, e o aperto é a folga que ela guardou (o pano pode encolher até 14%).

## Decisão

**O aperto de cada triângulo vira ruga no desenho** (`rugasDaPeca`). De cada triângulo sai a direção em que ele está mais encolhido em relação ao molde, e ela é somada nos cantos. O dobro do ângulo é o que entra na soma: o aperto não tem sentido, 0° e 180° são o mesmo, e a média entre vizinhos precisa saber disso.

**No estúdio,** as rugas correm atravessadas ao aperto e só mexem na normal e um pouco na cor. Não mudam a silhueta, e por isso custam quase nada.

- **Só os apertos fortes:** de 5% para cima. Na primeira tentativa, todo aperto enrugava, e o vestido inteiro virou um tecido canelado.
- **Irregulares:** duas ondas tortas pelo ruído, em manchas, com trechos lisos entre elas.
- **A distância entre as rugas** vem da rigidez do tecido: de 9 a 34 mm (`distanciaDasRugas`).

No mapa de tensão não há rugas.

## O que não foi feito

As rugas são uma aparência tirada da física, não física: não têm volume nem fazem sombra longa. Para isso, a malha de 8 mm.

## Conferência

- `ui/lotesDoTecido.test.ts`: sem aperto, nada; o ângulo em u, em v e a 45°; o refino leva as rugas.
- `ui/estudio3d.test.ts`: sem aperto a imagem é idêntica à lisa; com aperto, muda.
