# ADR 0070 — Fechamento dos pontos abertos, e a folha de comparação

## Contexto

Depois do ADR 0064 ficou uma lista do que não estava concluído: quatro
parciais, quatro pontos "não feitos por não serem falta", o nome do programa
de referência nos ADRs antigos, um cuidado de uso no "Remover região" e o
fato de nada ter sido comparado com o programa de referência rodando.

O pedido foi resolver tudo, para não ficar em aberto.

## O que foi feito de cada ponto

| Ponto | Como ficou | Onde |
|---|---|---|
| "Remover região": o clique do lado perto de uma linha era lido como clique na linha | O Enter confirma a linha; depois dele todo clique é o do lado | ADR 0065 |
| "Unir moldes" só com retas | Duas linhas quaisquer, cada uma confirmada com Enter | ADR 0065 |
| "Separar": o tamanho escolhido na janela | Indicado com um clique na linha dele, no desenho | ADR 0066 |
| "Criar regra": a tabela em listas | Tabela em grade, com os botões do manual | ADR 0067 |
| Acabamento da pence com pernas desiguais: um pequeno canto | Pela dobra de verdade (a bissetriz); a diferença aparece exata, e a mensagem diz | ADR 0068 |
| Dobrar por curva; trecho do contorno no corte; pernas retas na pence transferida; limite de 85° da alça | Continuam como decisão — e agora cada ferramenta explica o porquê na tela | ADR 0068 |
| Nome do programa de referência nos ADRs 0011 a 0029 | Trocado por "referência" nas 39 ocorrências | commit `9be2dc4` |
| Nada comparado com o programa de referência | Não tenho como rodá-lo. Ficou pronta a folha de comparação (abaixo) | este ADR |

Ao reler o manual apareceu um ponto que não estava na lista: no "Cortar", o
lado clicado decide a parte que ganha a costura. Foi feito (ADR 0069).

## A folha de comparação

- Está em `revisao-local/comparacao-com-a-referencia.html`, fora do git, ao
  lado das folhas de revisão da modelagem. É para quem tem o programa de
  referência: abre no navegador e imprime.
- São seis casos num retângulo de 40 × 30 cm: Cortar com costura, Remover
  região com "Unir moldes", pence aberta com acabamento, Separar, a tabela
  do Criar regra e seis perguntas rápidas (entre elas, as quatro decisões
  que não são falta).
- Cada caso diz o que fazer no programa de referência e o que o Enfesto CAD
  dá, com números. Os números saíram do código do programa, por um teste
  temporário que não ficou no repositório.
- A folha não diz o nome do programa de referência.

## O que continua dependendo de uma pessoa

- **A comparação em si.** Alguém com o programa de referência precisa
  preencher a folha. Onde der diferente, o programa é ajustado.
- **O olhar da modelagem** nas folhas de revisão que já existiam
  (`revisao-local/`), ainda sem resposta.
- **Publicar.** Estes commits estão só nesta máquina; o instalador e a
  versão web publicados são anteriores a eles.

## O que NÃO foi feito

- **O histórico do git** anterior ao commit `9be2dc4` continua com o nome do
  programa de referência no texto dos ADRs antigos. Tirar dali seria
  reescrever o histórico de um repositório publicado; não fiz.
- **A folha de revisão da modelagem não ganhou páginas novas.** O caso das
  pernas desiguais entrou na folha de comparação (caso 6, pergunta 4).
- **Depois de um corte, as duas partes ficam no lugar**, e a validação aponta
  "se sobrepõem" até uma ser movida — mesmo sem costura, só encostadas. Já
  era assim; está perguntado na folha (caso 1, item b).

## Verificação

- 1808 testes em 83 arquivos; tipos e lint limpos (o aviso antigo do
  `useMemo` continua). Cada etapa tem a verificação dela no seu ADR.
- Os números da folha foram conferidos, um a um, com a saída do teste
  temporário e com os roteiros de tela das etapas.
- Nenhuma ocorrência do nome do programa de referência no repositório (fora
  do histórico).
- Biblioteca de projetos do usuário: intacta (5 arquivos, mesmo MD5). As
  cópias dos projetos reais usadas nos testes foram apagadas.
