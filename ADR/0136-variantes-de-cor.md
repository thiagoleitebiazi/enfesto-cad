# ADR 0136 — As variantes de cor do modelo

## Contexto

Da terceira rodada do estudo: a referência mostra o mesmo modelo em várias cores (as variações de cor, a cartela), no
desenho e na ficha. No Enfesto CAD, o desenho técnico tinha uma cor só por área. Para ver o modelo em marinho, era
preciso pintar o desenho de novo e perder o original.

## Decisão

**1. As variantes ficam no desenho técnico** (`DesenhoTecnico.variantes`, em `domain/desenhoTecnico.ts`).
- **O que cada uma tem:** um nome ("Marinho") e a troca de cada cor de preenchimento: a original (#rrggbb, minúsculas)
  pela da variante.
- **O desenho continua um só.** A variante não copia os traços: mudar a forma muda todas as variantes.
- **O que muda na variante** (`desenhoNaVariante`): só os preenchimentos. Os traços, os textos, as cotas e as estampas
  ficam como estão.
- **As regras:** a cor sem troca fica a original; o nome vazio ou repetido é recusado; a troca pela mesma cor desfaz a
  troca.
- **A leitura** guarda as variantes e deixa de fora as trocas que não são cores.

**2. Na janela do desenho técnico,** a caixa "Variantes de cor" (roxa, nas propriedades, à direita) tem:
- **Ver:** "Original" ou uma variante. A folha mostra o desenho na variante escolhida, e o SVG exportado é o que se vê.
- **Nova variante:** com o nome, ela já fica escolhida.
- **As cores:** para cada cor de preenchimento do desenho (`coresDoDesenho`), a amostra da original e a cor da
  variante, para escolher. Sem áreas pintadas, a caixa diz para pintar o preenchimento dos traços fechados.
- **Apagar a variante.**

**3. Na ficha técnica em PDF,** depois do croqui vem "Variantes de cor": a primeira vista em cada variante, pequena,
com o nome embaixo, em fileiras.

## O que não foi feito

- **A variante no provador 3D:** as peças do 3D têm a cor de cada uma (ADR 0111), que não está ligada às áreas do
  desenho.
- **O material de cada variante na ficha** (o consumo e o custo por cor): a lista de materiais é uma só.

## Conferência

- `domain/desenhoTecnico.test.ts` (4 novos):
  - **as cores do desenho:** sem repetir, em minúsculas;
  - **a troca na variante:** a cor sem troca fica, os traços também, e a mesma cor desfaz a troca;
  - **os recusados:** o nome vazio ou repetido; apagar a última variante tira a lista;
  - **a leitura** deixa de fora a troca que não é cor.
- `ui/PainelDoDesenhoTecnico.test.tsx` (1 novo):
  - a variante nova fica escolhida, e a cor trocada pinta a folha;
  - o desenho guardado tem a variante, com as cores originais nos traços;
  - de volta à original, a cor da variante sai da folha.
- `npx vitest run`: 175 arquivos, 3066 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 111 conferências, nenhuma falha. A nova: no desenho técnico da camiseta (passo
  12b), a variante "Marinho" é criada e fica vista na folha. O desenho do teste não tem áreas pintadas, então a troca
  de cor em si foi conferida no teste da tela (o mesmo componente), não com o mouse.
