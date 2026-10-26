# ADR 0137 — Trocar um material em todos os modelos de uma vez

## Contexto

Da terceira rodada do estudo: a ficha da referência permite "mudar de uma vez todo o mix da coleção". O caso comum: o
tecido saiu de linha, ou o botão passou a vir de outro fornecedor, e todos os modelos que o usam precisam do novo.

No Enfesto CAD, mudar o preço de um material já atualizava o custo de todos os modelos (ADR 0106). Trocar o material
era abrir a ficha de cada modelo e trocar item por item.

## Decisão

**1. A troca** (`trocarMaterialNosModelos`, em `domain/trocaDeMaterial.ts`): em cada projeto com ficha, cada item com o
material de agora passa a ser o novo, com o mesmo consumo e a mesma aplicação (a descrição e a unidade vêm do novo).
- **A ficha aprovada ou em aprovação não muda.** Ela só muda abrindo nova versão (ADR 0105). Esses modelos são ditos
  no recado (`recadoDaTroca`).
- **Os recusados:** o mesmo material, e o material de outra unidade, porque o consumo da ficha está na unidade do
  item.

**2. Na biblioteca de materiais,** aba "Custos dos modelos", a caixa "Trocar um material em todos os modelos" tem:
- **O material de agora:** um dos que estão nas fichas.
- **Entra no lugar:** só os da mesma unidade, e sempre escolhido. O campo começa em "Escolha…", e o botão só funciona
  depois disso.
- **Trocar nos modelos:** troca nos projetos da Biblioteca e no aberto (como está agora), grava os que mudaram e diz
  o resultado.

**3. Por que a escolha é obrigatória:** o teste de uso achou o defeito. O campo vinha preenchido com o primeiro
material da mesma unidade, a linha de costura, e a troca trocou o botão pela linha.

## O que não foi feito

- **Trocar só numa coleção** (e não em todos os modelos): a troca vale para todas as fichas abertas.
- **Desfazer a troca:** ela muda os projetos gravados. Para voltar, troca-se de novo, ao contrário.

## Conferência

- `domain/trocaDeMaterial.test.ts` (2):
  - entre três modelos, troca só o de ficha aberta que usa o material, com o mesmo consumo e aplicação, e os outros
    itens como estão; o aprovado fica e é dito no recado;
  - o mesmo material, ou outra unidade, não.
- `ui/PainelDeMateriais.test.tsx` (1 novo):
  - "Entra no lugar" só tem os da mesma unidade (a linha em metros não entra no lugar do botão) e começa em "Escolha…";
  - o botão fica desligado até a escolha; a troca chama com os dois materiais e mostra o recado.
- `npx vitest run`: 176 arquivos, 3069 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 112 conferências, nenhuma falha. A nova: o "Botão de pressão 14 mm" é
  cadastrado e entra no lugar do de 12 mm. A ficha em rascunho que usava o de 12 fica gravada com o de 14.
