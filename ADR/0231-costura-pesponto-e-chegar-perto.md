# ADR 0231 — A costura, o pesponto e chegar perto

## Contexto

Com o caimento certo (ADR 0230), a roupa ainda parecia um pano inteiro: sem costura, sem barra. E a roda do mouse não aproximava: o foco da câmera crescia junto com a distância, e o tamanho na tela não mudava desde a ADR 0111. Só a perspectiva mudava.

## Decisão

**1. A borda de cada peça é uma grade pela face** (`MapaDaPeca`, `mapaDaPeca`): a distância ao contorno, o caminho andado nele e se aquele lado tem costura. O estúdio lê essa grade ponto a ponto, então o detalhe tem a mesma nitidez em qualquer zoom e não depende da malha.

- **Na costura:** o sulco onde os dois panos se juntam e um franzido leve dos lados.
- **Na borda livre** (a barra, o decote, a cava): a beirada dobrada e, a 15 mm dela, o pesponto, com o pano um pouco afundado na linha. De perto, a linha é tracejada no passo da máquina (2,8 mm); de longe, vira a média dela com o pano.

A barra é sempre desenhada assim: a peça não diz como foi acabada. Quem precisar de outro acabamento não tem como mudar por enquanto.

**2. Chegar perto.** O foco ficou fixo, e a roda agora aproxima de verdade, até 25 cm do alvo. **Shift e arrastar**, ou o botão direito, move a vista: é como se chega à barra ou ao decote.

## Conferência

- `ui/estudio3d.test.ts`: o sulco da costura escurece, o pesponto muda o pano a 15 mm da borda livre, e longe das bordas nada muda.
- `ui/lotesDoTecido.test.ts`: a distância, o caminho, os lados costurados, o miolo de fora e o mapa de tensão sem borda.
- `ui/cena3d.test.ts`: a roda aumenta o que se vê, e o que está no alvo acompanha o arrasto.
