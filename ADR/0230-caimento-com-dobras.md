# ADR 0230 — O caimento com dobras

## Contexto

Com o corpo e a luz novos (ADR 0228, 0229), o que denunciava o 3D era o tecido: ele caía liso, como papelão. Um vestido evasê virava um saco achatado, com a frente e as costas fechadas uma sobre a outra, e a sugestão de costuras nem o fechava. Com os braços abaixados, o braço atravessava o pano.

## Decisão

**1. O pano quase não resiste a ser apertado.** Cada aresta resiste a esticar, mas cede ao aperto, como o tecido de verdade, que enruga em vez de encolher. Sem isso a malha trava: cada triângulo defende as três arestas e as dobras não nascem. A mudança é gradual, de 1% a 4% de aperto. Uma quina no comprimento de repouso fazia a aresta tremer em volta dele, e metade da saia nunca parava. Passado 14%, a aresta volta a resistir.

**2. A costura resiste a dobrar.** As folgas costuradas por dentro fazem dela o trecho mais firme do pano. Cada ponto da costura ganha uma dobra entre o vizinho de dentro de um lado e o do outro. Sem isso a costura era uma dobradiça solta.

**3. Um empurrão pequeno quando o peso entra,** uma ondulação pela posição, sem sorteio: a mesma roupa cai sempre igual. Sem ele, nada faz a primeira dobra nascer num pano perfeitamente plano.

**4. A roupa é vestida na pose de vestir, e o corpo vai depois até a pose pedida** (`corposDoCaminho`). Com a roupa já pendurada, os braços descem por fora dela. Os corpos do caminho andam até 30 mm por vez na mão: mais que isso, o braço pularia o pano da manga. Chegando à pose, eles são largados.

**5. Cada altura da peça é arrumada na largura dela** (`larguraPorLinha`). Antes uma elipse só, do tamanho da barra, afastava o ombro do corpo; num modelo bem evasê os ombros nem eram sugeridos, e o vestido caía no chão.

**6. O ar segura o dobro** (de 1,5 para 3 por segundo). O pano leve assenta mais depressa, e de mais perto do real.

**7. A malha padrão é a fina (12 mm),** onde as dobras cabem; há uma de 8 mm para as dobras pequenas. Durante a simulação, a imagem é desenhada no máximo seis vezes por segundo: ela custa mais que um passo da física.

**8. A calça fecha.** A perna da peça vem da forma dela: o gancho é a ponta de onde o contorno recua logo abaixo, e ele aponta para o meio do corpo. Pela cópia só, um molde desenhado para a outra perna ia ao avesso. Na sugestão de costuras, abaixo do gancho cada perna fecha sozinha (a entreperna de trás de uma ficava perto da de trás da outra), e o alto da peça da perna entra, porque ali não há cava: é o gancho, que fecha de uma perna para a outra.

**A trama** é uma escolha da aba Tecido (plana, sarja, malha, cetim, felpa e linho), que vem do tecido pronto e não muda a física.

## O que não foi feito

- **Os vincos menores que a malha.** Com 12 mm, as dobras têm de 4 cm para cima; as finas de verdade pedem a malha de 8 mm.
- **O tempo.** Com 12 mm, um vestido leva uns 20 s para assentar; com 8 mm, passa de um minuto.

## Conferência

`domain/provador3d.test.ts`, bloco do vestido evasê: as costuras sugeridas em barras de 34 e 56 cm; o ombro do evasê no lugar do reto; a dobra na costura; o caminho da pose; a malha muito fina e a trama guardadas. A saia que cai no chão, sem costuras, assenta com a colisão ligada.
