# ADR 0120 — O fio, a trama e o viés no provador 3D

## Contexto

O ADR 0111 deixou em "O que não foi feito": "a elasticidade é a mesma nos dois sentidos (sem trama e urdume
diferentes)". O tecido de verdade não é assim:
- a malha estica bem mais na largura (a trama) que no comprimento;
- o tecido plano quase não estica no fio nem na trama, mas cede no viés, a 45° do fio. É por isso que a saia cortada
  no viés cai diferente da cortada no fio.

No provador, a peça girada 45° no fio continuava igual à reta.

## Decisão

**1. O tecido em três direções** (`Tecido3D`):
- `elasticidade` passa a ser a do fio;
- `elasticidadeNaTrama` e `elasticidadeNoVies` são novas, de 0 a 100, e opcionais. Sem elas (os projetos gravados
  antes), o tecido é o mesmo em toda direção, como era.

Os tecidos prontos ganharam as três. A elasticidade no fio de cada um continua a mesma de antes:

| Tecido | No fio | Na trama | No viés |
|---|---|---|---|
| Malha | 70 | 80 | 75 |
| Moletom | 45 | 55 | 50 |
| Tricoline | 10 | 18 | 78 |
| Jeans | 5 | 12 | 70 |
| Seda / viscose | 15 | 22 | 85 |
| Linho | 5 | 12 | 72 |

**2. Cada aresta pela direção dela.** A elasticidade de cada aresta da malha da peça sai do ângulo dela com a linha de
fio da peça (`elasticidadeNaDirecao`):
- **os pesos:** cos² vai para o fio, sen² para a trama e sen²(2θ) para o viés, que é o maior a 45° e zero no fio e na
  trama;
- **a mistura** é a da elasticidade (de 0 a 100), antes de virar a complacência da física;
- **a simulação** guarda uma complacência por aresta, e o estiramento usa a de cada uma.

Como a malha é desenhada nas coordenadas do molde, a peça girada no provador leva o fio junto.

**3. Os números do viés.** A escala de 0 a 100 vira a complacência de 10⁻⁸ a 10⁻³, e com os passos pequenos da
simulação o tecido só cede de verdade de uns 60 para cima. Abaixo disso, o tecido fica, na prática, sem esticar.
- **Na primeira tentativa,** o viés do tricoline era 62, e a saia no viés ficou igual à reta: 0 mm de diferença na
  barra, a mesma tensão.
- **Na versão final,** o viés dos tecidos planos ficou entre 70 e 85, onde aparece. Fica mais que o comprimento da
  malha: o tecido plano cede no viés mais que a malha no fio.

**4. Na aba Tecido** do provador, as três réguas: "Elasticidade no fio", "Na trama (atravessado)" e "No viés (45°)".
As duas últimas ficam recuadas, com a borda violeta, e uma nota explica a direção pelo fio da peça. Mexer numa delas
faz o tecido "Personalizado".

## O que se vê (medido, a saia de teste no manequim feminino, 4 s)

- **Com o fio solto** (95, a trama firme), as arestas no comprimento da saia esticam 1,93% em média. **Com o fio
  firme** (a trama solta), esticam 0,27%. O peso puxa a saia no comprimento, a direção do fio.
- **A saia de seda cortada no viés** estica 0,54% no comprimento, contra 0,24% da cortada no fio; o tricoline, 0,38%
  contra 0,22%. A barra desce só cerca de 1 mm: sob o próprio peso, a saia apoiada no quadril carrega pouco o tecido.
  Na vida, a saia no viés se alonga mais com o tempo, e o provador não simula o tempo.

## O que não foi feito

- **A rigidez de flexão continua a mesma em toda direção.** O tecido não dobra mais fácil num sentido que no outro.
- **O cisalhamento não é uma restrição própria.** O viés vem das arestas na diagonal, que é a aproximação da malha de
  triângulos.
- **A peça sobre outra peça** (o bolso sobre a frente) continua de fora (ADR 0111).

## Conferência

- `domain/provador3d.test.ts` (+5):
  - a elasticidade em cada direção: 10 no fio, 18 na trama, 78 no viés do tricoline, entre eles a 22,5°, e a mesma em
    toda direção sem a trama e o viés;
  - a menor complacência das arestas é a do fio, e a maior, a do viés;
  - o fio solto estica mais de três vezes o firme no comprimento;
  - a saia de seda no viés estica mais de 1,5 vez a reta;
  - a leitura da montagem guarda a trama e o viés, e a antiga fica sem.
- O teste "o mesmo tecido, mais elástico, estica mais" passou a mudar as três direções juntas.
- `ui/PainelDoProvador3D.test.tsx`: o jeans pronto com a trama e o viés, e a régua do viés.
- `npx vitest run`: 166 arquivos, 2970 testes passando, entre eles a saia, a regata e a camiseta de verdade no manequim
  com a malha nova. `npx eslint .` e `npx tsc -b --noEmit` sem erro; `npm run build` gera o programa.
- O teste de uso, no programa gerado: 86 conferências, nenhuma falha, nenhum aviso no console.
  - **Nova:** a aba Tecido com 70, 80 e 75 na malha.
  - A saia de teste simulada com a malha de três direções assentou com as costuras fechadas (0 mm) e a tensão média
    de 2,8%.
