# ADR 0155 — O look vestido no manequim

O ADR 0145 deixou de fora o look no 3D: o provador vestia um projeto de cada vez.

**Decisão:** em Coleções › Looks, "Vestir no manequim" abre o provador com as peças dos modelos do look juntas (`montagemDoLook`).
- Cada modelo entra com a montagem do próprio projeto: as peças no corpo, as costuras e as cores. Os ids ganham um prefixo, porque dois projetos podem ter ids iguais.
- Todos os modelos precisam já ter sido montados no provador; senão, a janela diz quais faltam. O botão pede ao menos dois modelos com projeto.
- O que se muda nesse provador não volta para os projetos.

**Limites conhecidos:**
- O manequim, a malha e o tecido são os do primeiro modelo: a simulação tem um tecido só. As cores continuam as de cada peça.
- Não há peça "por dentro" e "por fora": onde a blusa encontra a saia, as duas ficam na mesma camada, e a colisão do ADR 0146 só as afasta.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O look não foi simulado no programa: ele não foi aberto (pedido do usuário: só testes unitários).
