# ADR 0148 — A faca tangencial no arquivo ISO

O ADR 0140 deixou de fora a faca tangencial no eixo C, comum nas mesas de corte de tecido.

**Decisão:** o diálogo do ISO ganha "Faca tangencial". Com ela, os cortes da faca (T1) levam o eixo C no rumo de cada trecho, na volta mais perto da de agora (`rumoContinuo`).
- Nas viradas de até 30° a faca gira cortando.
- Acima disso, ela sobe, gira e desce (`anguloDeLevantarGraus`, que no programa fica em 30°).

**Não feito:** a compensação da distância entre o eixo e a ponta da lâmina, e os comandos próprios de cada fabricante. Não foi testado numa mesa física.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
