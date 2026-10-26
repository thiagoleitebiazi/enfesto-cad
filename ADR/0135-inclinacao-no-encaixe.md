# ADR 0135 — A inclinação do fio no encaixe

## Contexto

O usuário pediu todas as funcionalidades da referência. A terceira rodada do estudo (`ESTUDO-DE-FUNCIONALIDADES.md`)
leu as páginas oficiais de todos os produtos dela e achou cinco lacunas que não dependem de servidor nem de máquina. A
primeira: o encaixe da referência define "ângulos" por tecido e por peça.

Além de 0°, 90°, 180° e 270°, a peça pode girar alguns graus: o fio tolera uma pequena inclinação, e a peça cabe
melhor. O Enfesto CAD só girava em múltiplos de 90°.

## Decisão

**1. A tolerância é da peça** (`RestricaoDeRotacao.inclinacaoGraus`, de 0 a 5°, `INCLINACAO_MAXIMA_GRAUS`). Ela fica no
painel Propriedades, junto das rotações permitidas, como "Inclinação no encaixe (°, até 5)". O PDF com o registro do
molde a leva e a lê de volta.

**2. O encaixe** (`rotacoesNoEncaixe`) tenta cada rotação permitida também inclinada pela metade e pelo todo da
tolerância, para cada lado. Com 2°, a peça que gira 0° e 180° tenta 0°, 1°, 2°, 359°, 358°, 180°, 181°, 182°, 179° e
178°. Valem nos dois motores, o de pontos de canto e o da grade.
- **No tecido de sentido único,** a inclinação vale sobre 0° e 90°.
- **Com o casamento de listras e xadrez,** nenhuma: a peça inclinada sairia da listra.

**3. A validação** (`rotacaoEhPermitida`) aceita a rotação permitida inclinada até a tolerância. A peça que o encaixe
inclinou não aparece como "rotação proibida".

**4. O planejamento** mostra a tolerância na tabela das peças ("± 2° de inclinação").

## O que não foi feito

- **A tolerância do tecido para todas as peças de uma vez:** ela é posta peça a peça (cada peça tem a sua, como as
  rotações).
- **A busca contínua do melhor ângulo:** só os cinco ângulos de cada rotação.

## Conferência

- `domain/molde.test.ts`:
  - as rotações do encaixe com 2° de inclinação; sem ela, as de antes;
  - a validação aceita 358,5° e 182° e recusa 183°;
  - acima de 5°, vale 5°.
- `domain/risco.test.ts`: seis tiras de 100 × 1000 mm desenhadas 3° tortas, numa mesa de 620 mm.
  - **Sem inclinação,** cabem 4 na largura, e o risco passa de 1,9 m (duas fileiras).
  - **Com 3°,** as 6 ficam retas (giradas −3°) numa fileira só, com o risco abaixo de 1,01 m, sem sobreposição.
- `npx vitest run`: 175 arquivos, 3061 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 110 conferências, nenhuma falha. A nova: Modelo › Propriedades da manga, a
  inclinação em 2°, gravada na peça.
