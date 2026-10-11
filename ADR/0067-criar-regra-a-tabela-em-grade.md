# ADR 0067 — "Criar regra": a tabela em grade

## Contexto

O ADR 0064 pôs a tabela do ponto na janela do "Criar regra", mas em listas
de texto: os tamanhos num campo, os DX noutro, os DY noutro, um valor por
tamanho separado por ponto e vírgula. Ficou dito ali como parcial.

O manual da referência mostra uma grade: uma linha por tamanho, com DX e DY
editáveis, e botões para criar um tamanho acima ou abaixo, definir o base,
excluir um tamanho, "Incremental" e dar o mesmo DX e DY a todos os tamanhos.

## Decisão

A janela do "Criar regra" passa a ser uma **tabela em grade**
(`PainelDeCriarRegra`), e as listas de texto saem do programa.

- **Uma linha por tamanho:** o nome dele (que se digita ali), o DX e o DY. A
  linha do base vem marcada "(base)" e travada em zero.
- **A linha escolhida** é a marcada na primeira coluna — ou a do campo em que
  o cursor está. É nela que os botões agem:
  - **Criar tamanho acima / abaixo:** a linha nova vem sem nome, com os
    números na proporção dos vizinhos — no meio dos dois, ou continuando o
    passo de quem está na ponta. Os números dos outros tamanhos não mudam. A
    janela pede o nome e a conferência; sem o nome, a regra não é guardada.
  - **Excluir tamanho:** a linha sai; os outros ficam onde estavam. O base
    não sai, e a regra não fica com menos de dois tamanhos.
  - **Definir como base:** a regra é a mesma; os números passam a ser
    contados desse tamanho.
  - **Mesmo passo em todos:** o que a linha escolhida anda por tamanho passa
    a valer para todos — os maiores que o base para esse lado, os menores
    para o outro. A linha escolhida fica como está.
- **Incremental** troca só o que a grade mostra: a diferença de cada tamanho
  para o vizinho do lado do base. A regra não muda ao ligar ou desligar.
- **O que não serve é recusado pelo nome:** o campo que não é número ("O DX
  do tamanho G precisa ser um número em mm"), o campo vazio (não vale zero),
  o tamanho sem nome, o nome repetido, o nome com vírgula ou ponto e vírgula
  (na peça os tamanhos são digitados separados assim: nunca casaria).
- Cada mudança da tabela é uma função pura (`tabelaDaRegra.ts`); a janela só
  as mostra.

## O que é leitura nossa

- **"Mesmo passo em todos".** O manual fala em dar o mesmo DX e DY a todos os
  tamanhos, sem dizer a conta. Copiar o mesmo número para todas as linhas
  faria os tamanhos menores que o base andarem para o mesmo lado dos maiores;
  a leitura adotada é a de graduação: o mesmo passo por tamanho, crescendo
  para um lado e diminuindo para o outro. A janela diz isso na nota e no
  botão.
- **Os números do tamanho novo.** O manual não diz com que valores a linha
  nova vem; aqui ela vem na proporção dos vizinhos, e a mensagem pede para
  conferir.

## O que NÃO foi feito

- **Distância e ângulo, e as setas** da tabela do ponto ("Tabela") não estão
  nesta janela: aqui é só DX e DY.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1788/1788 em 83 arquivos (eram 1758; saíram os 7 da janela em
  listas, entraram 23 da tabela e 14 da janela). Tipos e lint limpos (o aviso
  antigo do `useMemo` continua).
- **Mutações:** 37 de 37 pegas, uma por vez, com o código conferido por hash
  antes e depois. A primeira rodada deixou passar uma — a linha escolhida
  depois de excluir a última —; ganhou teste e passou a ser pega.
- **Electron real, peça de teste** (P, M, G; um canto andando 10 mm em DX por
  tamanho):
  - a janela abre com `P −10 0 | M 0 0 | G 10 0`, o base travado;
  - criar tamanho abaixo do G: linha sem nome com 20; nome "GG" e 25
    digitados na grade;
  - Incremental: o GG mostra 15; desligado, volta a 25;
  - base no P: `0, 10, 20, 35`; de volta ao M: os números de antes;
  - sem o nome da regra: "Dê um nome à regra", e a janela continua aberta;
  - com nome e código: a regra vai para o cadastro com P, M, G e GG, base M,
    e o GG andando 25 em DX; aparece em "Regras" com o código;
  - mesmo passo pelo G (30, 4): o P fica com −30 e −4; criar acima do P: −60
    e −8; excluir; excluir o base é recusado; Cancelar não guarda nada.
  - **18 conferências, 0 falhas.** O roteiro da graduação do ADR 0064, sem a
    parte da janela em listas: conferido de novo, sem falhas.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
