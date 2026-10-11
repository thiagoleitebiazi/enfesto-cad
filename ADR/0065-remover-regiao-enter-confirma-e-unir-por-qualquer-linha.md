# ADR 0065 — "Remover região": o Enter confirma a linha, e "Unir moldes" por qualquer linha

## Contexto

O ADR 0063 deixou duas coisas em aberto no "Remover região":

- **Um cuidado de uso.** Com elementos indicados, o clique do lado a menos de
  uns 14 mm de uma linha interna era lido como clique na linha. Num molde
  cheio de linhas, o lado tinha de ser clicado num lugar livre.
- **"Unir moldes" só com retas.** A faixa entre duas curvas não saía.

O manual da referência descreve a ferramenta assim: indicar o primeiro
elemento, confirmar, indicar o segundo elemento, confirmar.

## Decisão

### O Enter confirma a linha

- Com elementos indicados, o **Enter confirma a linha**. Daí em diante todo
  clique é o do lado — mesmo em cima de outra linha interna. A prévia mostra a
  região sob o mouse também ali.
- Sem o Enter, é como antes: o clique numa linha a junta (ou tira), e o
  clique fora delas escolhe o lado.
- Só se confirma o que dá uma linha de borda a borda; senão a faixa de
  mensagens diz o que falta, e os elementos continuam indicados.

### "Unir moldes" por duas linhas quaisquer

- Cada linha é um **grupo de elementos** — um só, reto ou curvo, ou vários
  emendados —, confirmado com Enter. O segundo Enter tira a faixa entre as
  duas e une as partes que sobram.
- **Como as partes são unidas:** unidas, a linha da emenda some do contorno;
  só as pontas dela contam. Por isso cada linha é trocada pela corda dela (a
  reta entre as duas pontas), e as duas cordas se encostam como duas arestas,
  do mesmo jeito que as retas já se encostavam. A parte que tem a linha de
  fio fica; a outra gira e anda até ela.
- **Linhas de formas diferentes** são unidas pelas pontas. Ao longo da emenda
  uma parte passa por cima da outra (ou fica aquém): a mensagem diz quanto a
  peça unida tem a mais ou a menos que as duas partes somadas.
- **Pontas a distâncias diferentes:** as partes ficam centralizadas e sobra um
  degrau, como com as retas; a mensagem diz.
- A união que cruzaria a si mesma é recusada.
- A reta por dois pontos do contorno continua como era, para as duas linhas.
  Com a primeira posta assim, o clique numa linha interna reta continua
  valendo como a segunda reta inteira.

### O que mudou no uso

- Com "Unir moldes", o clique numa linha interna reta **não vale mais na
  hora** como a primeira reta: ela entra no grupo, e o Enter confirma. Sem
  isso, uma linha feita de várias retas emendadas não tinha como começar. É
  também a ordem que o manual da referência dá.

## O que NÃO foi feito

- **Linhas de formas diferentes não são "acomodadas".** Na costura, duas
  linhas de formas diferentes se juntam com folga ou embebido; no plano, as
  partes ficam uma por cima da outra. O programa une pelas pontas e diz a
  diferença: não redesenha a emenda.
- **Uma guarda sem teste:** a união que cruza a si mesma. Não encontrei duas
  linhas que caiam nela (o contorno unido é feito só das bordas de fora das
  duas partes).
- **Nada foi comparado com o programa de referência em uso.** A conta da
  união pelas cordas é leitura nossa.

## Verificação

- **Testes:** 1749/1749 em 81 arquivos (eram 1736); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: a faixa entre duas linhas
  iguais sai e as partes se encaixam (a emenda some do contorno); linhas de
  formas diferentes; a ordem das linhas; a segunda linha achada pelo meio
  dela; as recusas; o Enter confirmando, o clique do lado em cima de outra
  linha, a prévia; os dois grupos do "Unir moldes", a reta entrando no grupo,
  o clique fora das linhas, as instruções e a janela.
- **Mutações:** 15 de 15 pegas, uma por vez, com o código conferido por hash
  antes e depois.
- **Electron real, peça de teste:** dois "V" de duas retas cada.
  - Sem "Unir moldes": os dois elementos do primeiro, Enter, e o clique do
    lado **em cima de uma linha do segundo V**: a região sai (828,2 cm²).
  - Com "Unir moldes": dois elementos, Enter, dois elementos (a faixa em
    destaque), Enter: saem 323,2 cm², as partes são unidas e não sobra linha
    interna. As duas linhas são iguais, e a mensagem não fala de diferença.
  - Pelas retas de dois pontos, como antes: 177,1 cm².
  - **11 conferências, 0 falhas.**
- **Electron real, moldes reais pela tela** (cópia, fora do repositório): nas
  4 peças de produção, o elemento de 13 pontos, Enter, e o lado clicado a
  **12 mm da linha** (numa delas, a 8,5 mm) — o clique que, sem o Enter, não
  tirava região nenhuma. Tirou nas quatro; as duas partes somam a área da
  peça; Ctrl+Z devolve. **24 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
