# ADR 0129 — Listras e xadrez casados por mais de um ponto

## Contexto

O sexto item da segunda rodada do estudo: a referência casa listras e xadrez por mais de um ponto. A listra que passa
na cava da frente passa também na cabeça da manga, e a do peito passa no bolso.

O Enfesto CAD casava por um ponto só (ADR 0089, que listou isso em "o que não foi feito"):
- cada peça tinha a marca "casamento";
- o risco a punha onde essa marca caísse numa linha do desenho do tecido (a fase).

Todas as peças ficavam na mesma fase. Isso casa a frente com as costas pelo centro, mas não a manga com a cava. Na
frente, a cava fica a uma distância qualquer do ponto do centro, e a listra que passa ali não é a da fase.

## Decisão

**1. As marcas de grupo** (`grupoDaMarcaDeCasamento`, em `domain/risco.ts`):
- **O ponto principal:** "casamento" (ou "ponto de casamento", como antes) cai na linha do desenho.
- **O ponto de um grupo:** "casamento: manga" (ou "casamento - manga", "casamento — bolso do peito"). Ele cai na mesma
  listra que o ponto "casamento: manga" das outras peças.
- **Quantos:** uma peça pode ter o principal e vários grupos. A manga pode ter só o do grupo dela.

**2. A fase de cada grupo** vem da primeira peça posta que tem esse grupo: é onde o ponto do grupo dela caiu. Para a
fase sair da frente, e não da manga:
- a frente cai na linha do desenho pelo ponto principal;
- com o casamento, as peças só com pontos de grupo entram no risco depois das que têm o ponto principal, dentro de cada
  grupo do encaixe.

A manga então vai só para os lugares em que o ponto dela cai na fase do grupo.

**3. O lugar da peça** (`alvoDoCasamento`), na ordem:
- com o ponto principal, ele cai na fase do tecido;
- sem ele, o ponto de um grupo que já tem fase cai nela;
- sem nenhum dos dois, o ponto do primeiro grupo cai na fase do tecido, e a peça dá a fase desse grupo.

O resto é o mesmo de antes:
- só as posições na fase;
- as peças só giram 0° ou 180°;
- a fase é procurada em até quatro repetições à frente.

**4. O risco guarda os pontos dos grupos** no lugar (`pontosDeCasamento`, pelo nome do grupo), além do principal.

**5. A conferência** (`conferirCasamento`) acha:
- o ponto principal fora da linha do desenho, como antes;
- o ponto de um grupo fora da listra do mesmo grupo na primeira peça que o tem ("Manga (M), no ponto “casamento:
  manga”").

A peça só com pontos de grupo basta para o risco sair. A peça sem marca nenhuma continua pedindo a marca.

**6. O desenho do risco** (`DesenhoDoRisco`), com o casamento, mostra:
- as linhas do desenho do tecido na fase, tracejadas em azul por baixo das peças;
- o ponto principal, um círculo vermelho;
- o ponto de cada grupo, um losango laranja com o nome.

Dá para ver de olho que a manga e a cava estão na mesma listra.

**7. A janela do planejamento**, em "Listras e xadrez", explica as marcas de grupo.

## O que não foi feito

- **A fase do grupo pela posição na roupa:** ela vem da peça posta, e o risco não procura a orientação da frente que
  deixaria a manga mais perto.
- **O ponto de um grupo em duas listras ao mesmo tempo** (a peça com dois grupos que já têm fase, e as duas distâncias
  não batem com a repetição): a peça vai pelo primeiro, e a conferência diz o outro.
- **No teste de uso:** o caminho pelo planejamento com um tecido listrado ainda não é feito pelo teste de uso. Ele só
  abre o planejamento, como desde o ADR 0089, cujas conferências na tela foram feitas à parte. Ficam para o próximo
  passo.

## Conferência

- `domain/risco.test.ts` (4 novos, no grupo do casamento):
  - **a manga casa com a listra da cava da frente,** e não com a fase do tecido:
    - a frente tem o ponto principal na fase 30 e o da cava 163 mm depois;
    - as duas mangas caem na fase 93, mesmo vindo antes da frente na lista;
    - a conferência confirma, e a geometria não tem sobreposição;
  - **a peça só com o ponto do grupo basta,** e a peça sem marca nenhuma não sai;
  - **o rótulo dá o grupo:** "Casamento" e "Ponto de casamento" são o principal; "casamento: Manga" e "Casamento —
    bolso do peito", os grupos; os outros não são de casamento;
  - **a conferência acha o ponto do grupo fora da listra** do mesmo grupo na outra peça.
- `ui/DesenhoDoRisco.test.tsx` (2):
  - as listras na fase, a cada 100 mm a partir de 30;
  - o ponto principal e os dois pontos do grupo, com o nome;
  - sem o casamento, sem as listras.
- `npx vitest run`: 171 arquivos, 3037 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 104 conferências, nenhuma falha, nenhum aviso no console. Nada novo nele (ver
  acima).
