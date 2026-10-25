# ADR 0119 — A recomendação de tamanho conhece o tecido que cede

## Contexto

O ADR 0110 deixou em "O que não foi feito": "A recomendação usa só a tabela de medidas: não sabe do tecido (a malha
que estica, o plano que não), a não ser pela folga escolhida."

Na prática, uma legging ou uma blusa de malha com elastano é feita menor que o corpo e veste justa, esticada. A
recomendação tratava toda peça como tecido plano. Por isso, para uma pessoa com o corpo maior que a tabela, dizia
"nenhum tamanho veste", mesmo quando o GG de malha vestiria.

## Decisão

**1. O tecido da peça, na aba Caimento:**
- **Tecido plano (não estica):** cede 0%, como antes.
- **Malha:** cede 5%.
- **Malha com elastano:** cede 15%.
- **Personalizado:** o número dado, de 0 a 40%.

"Cede" é quanto a volta da peça estica no corpo, confortável, sem marcar. É menos que o quanto o tecido estica no
teste da mão, e a janela diz isso. A escolha fica no projeto (`elasticidadeDaRecomendacao`). O projeto sem ela é de
tecido plano, e a recomendação sai igual à de antes.

**2. A conta** (`recomendarTamanho`, com a elasticidade):
- **Só as voltas cedem** (o busto, o quadril, a cintura); os comprimentos não.
- **Quando aperta:** a volta só aperta se, nem cedendo, a peça chega no corpo, ou seja, se *peça × (1 + cede) +
  tolerância* é menor que o corpo.
- **"Veste esticando":** a volta menor que o corpo que veste por causa do tecido.
- **O ideal não muda** (o corpo + a folga), e a nota do tamanho também não: o tamanho que veste esticando continua
  "mais justo" que o ideal, e a escolha prefere o mais perto dele.
- **A explicação:**
  - diz quanto o tecido cede;
  - em cada volta, quanto ela cede em cm e se veste esticando;
  - no tamanho que aperta, "mesmo com o tecido cedendo".

**3. Na tela:**
- **Recomendar** mostra o tecido escolhido, com o botão "Mudar".
- **A tabela de comparação** pinta de roxo a volta que veste esticando, e a legenda ganha "veste esticando (o tecido
  cede)".
- **Na legenda,** o vermelho vira "aperta (nem cedendo chega no corpo)".
- **No Caimento,** a escolha fica num quadro roxo, em cima das regras de cada ponto.

## O que não foi feito

- **O guia de medidas para a loja continua pelo ideal** (a peça menos a folga): ele não alarga as faixas pelo tecido
  que cede.
- **O tecido não vem sozinho** do cadastro de malhas nem do provador 3D. O "elasticidade" do provador é uma escala da
  simulação, não a porcentagem que a peça cede no corpo.
- **O mesmo valor vale para as duas direções.** A malha cede mais na largura que no comprimento, mas os comprimentos
  não cedem na conta.

## Conferência

- `domain/recomendacaoDeTamanho.test.ts` (+3):
  - no plano, o corpo maior que o GG não veste em nenhum;
  - na malha com elastano, o GG veste esticando, com 16,5 cm de folga no busto pelo tecido e o comprimento sem
    ceder, e a explicação diz isso;
  - a malha que cede pouco não salva o tamanho muito menor ("mesmo com o tecido cedendo");
  - a leitura do projeto (sem ela, o plano; o personalizado de 0 a 40%).
- `ui/PainelDeRecomendacaoDeTamanho.test.tsx` (+2):
  - "Mudar" leva ao Caimento, a malha com elastano é guardada, e o GG passa a ser o recomendado, com a célula roxa;
  - o personalizado limitado a 40%.
- `npx vitest run`: 166 arquivos, 2965 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 85 conferências, nenhuma falha, nenhum aviso no console, em duas rodadas
  seguidas. Duas são novas:
  - **na malha com elastano,** o corpo de busto 113 e quadril 115 veste o GG esticando, com as células roxas;
  - **o tecido ficou guardado** no projeto.

  O passo do arrasto do cartão (ADR 0118) ganhou mais um movimento curto antes da foto. Numa rodada, o realce da
  coluna debaixo do mouse ainda era o do movimento anterior; o cartão caía no lugar certo do mesmo jeito.
