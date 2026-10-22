# ADR 0095 — A importação que dá certo não mostra a faixa de avisos

## Contexto

Pedido do usuário, com a foto da faixa "Avisos da importação" depois de importar um DXF (as peças importadas, a
unidade, os nomes, "nenhuma camada de contorno reconhecida", o pique reconhecido, as linhas ignoradas, o fio na
horizontal): "remova isso, não há necessidade de aparecer".

Desde o ADR 0091 a importação é direta: as peças entram com o nome do arquivo e o fio na horizontal, sem pergunta, e a
faixa descrevia o que tinha sido feito.

## Decisão

- **Importou alguma peça (DXF ou PDF):** nenhuma faixa. As peças aparecem na lista e na mesa; a importação continua
  registrada no histórico ("Importação do DXF “…”: N peça(s), em …") e na origem de cada peça (Informações dos moldes).
- **Nada entrou** (o arquivo sem peça reconhecível, ou um erro ao ler): a faixa continua, com o motivo. Sem ela,
  clicar em Importar e não ver nada acontecer não diria por quê.
- A importação em si não mudou: as mesmas peças, nomes, fio, posição na mesa, piques e registro no histórico.

## Conferência

- `npx vitest run`: 131 arquivos, 2612 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório (`scripts/teste-de-uso/main.cjs`) trocou a conferência da mensagem por duas: "sem
  faixa de avisos depois de importar" e "as peças na lista, com o nome do arquivo". No Windows: 15 conferências,
  nenhuma falha.
- O programa gerado com um DXF sem nenhuma peça (pasta de dados descartável): a faixa aparece com "Nenhuma polilinha
  fechada encontrada no arquivo — nenhuma peça pôde ser importada", e a lista fica vazia.
