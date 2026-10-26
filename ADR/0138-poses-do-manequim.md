# ADR 0138 — As poses do manequim

## Contexto

Da terceira rodada do estudo: a referência põe o manequim 3D em poses para as imagens de catálogo, como os modelos
de verdade. O manequim do Enfesto CAD tinha uma pose só: os braços 15° afastados do corpo, a de vestir, para as mangas
caírem sem prender no tronco.

## Decisão

**1. Quatro poses** (`PoseDoManequim`, em `domain/manequim.ts`):
- **A de vestir:** os braços 15° afastados, como antes.
- **Braços abaixados (catálogo):** 7°.
- **Braços abertos:** 60°.
- **Mãos na cintura:** o braço sai a 32°, e o antebraço volta do cotovelo até o lado do quadril, na altura da
  cintura, um pouco à frente.

Só os braços mudam: o tronco, as pernas e a cabeça são os mesmos em todas.

**2. A pose fica na montagem do provador** (`ManequimDaMontagem.pose`; sem ela, a de vestir).
- **Onde é usada:** a simulação, as costuras sugeridas e o desenho no corpo usam o corpo na pose.
- **Na física:** a pose está na chave, e trocá-la pede simular de novo, porque o corpo mudou.
- **Ao mudar o público ou as medidas,** a pose escolhida fica.

**3. Na aba Manequim,** o campo "Pose", no alto.

## O que não foi feito

- **A pose das pernas** (o passo, o quadril de lado) e da cabeça.
- **A pose livre,** com o ângulo de cada junta: só as quatro prontas.

## Conferência

- `domain/desenhoNoCorpo.test.ts` (2 novos, as poses):
  - o braço sai do corpo a 15°, 7° e 60°, e o tronco é o mesmo;
  - nas mãos na cintura, o antebraço volta, e a mão fica fora do tronco, na altura da cintura.
- `ui/PainelDoProvador3D.test.tsx` (1 novo): a pose fica guardada, e continua quando o público muda.
- `npx vitest run`: 176 arquivos, 3072 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 113 conferências, nenhuma falha. A nova: no fim do provador, a pose "Braços
  abaixados", Simular, e a saia assenta de novo ("Assentou em 3,9 s"). Na foto de frente, os braços estão junto do
  corpo.
