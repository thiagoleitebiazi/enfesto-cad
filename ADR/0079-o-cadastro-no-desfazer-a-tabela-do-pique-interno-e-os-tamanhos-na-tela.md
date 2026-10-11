# ADR 0079 — O cadastro no Ctrl+Z, a tabela do pique interno e os piques dos tamanhos na tela

## Contexto

O ADR 0077 deixou escrito, em "O que NÃO foi feito", três coisas da aba
Marcações que dependiam só do programa:

- "O Ctrl+Z não desfaz o cadastro de piques (só as peças)."
- "Não há tabela para editar o que o pique interno alinhado anda em cada
  tamanho."
- "Na tela, os outros tamanhos da peça graduada aparecem só pelo contorno."

## Decisão

### O cadastro de piques no Ctrl+Z

- Criar, redesenhar, renomear e excluir um formato são, cada um, **um passo
  do Ctrl+Z**. Desfeito o passo, o cadastro volta ao que era; refeito
  (Ctrl+Y), avança de novo.
- Quando a mudança também alcançou piques já postos (o "levar a mudança"),
  **um só Ctrl+Z** devolve o cadastro e os piques.
- O cadastro fica neste computador, fora do projeto. Por isso o passo só mexe
  nele **se ele ainda está como o passo o deixou**: o que foi mudado por outro
  caminho depois (noutra janela do programa, por exemplo) fica como está.
- Criar um formato não muda peça nenhuma; o passo dele no histórico existe só
  para o cadastro.

### A tabela do pique interno alinhado

- A janela do "Alterar" do pique interno alinhado ganhou **dois campos por
  tamanho que não é o base**: quanto ele anda nesse tamanho, na horizontal e
  na vertical da tela, contado de onde está no tamanho base.
- O campo que não foi mexido fica com o valor exato de antes (a janela mostra
  duas casas).
- A tabela que poria o pique **fora da peça** em algum tamanho é recusada, com
  a janela aberta e a mensagem dizendo o tamanho.
- A mensagem diz que a tabela mudou e a que distância o pique fica em cada
  tamanho.
- Com a caixa "Alinhado entre os tamanhos" desmarcada, a tabela não é lida: o
  alinhamento é desfeito.
- O pique que nunca foi alinhado não tem tabela: alinha-se primeiro.

### Os piques dos outros tamanhos na tela

- Na peça graduada, além do contorno de cada tamanho, a tela desenha **os
  piques desse tamanho**, na mesma cor e em linha fina: os do contorno, na
  borda do tamanho; os internos, onde o alinhamento (ou a proporção da peça)
  os põe; e as marcas sem formato, como um ponto.
- É por eles que se vê o que o "Alinhar" e a tabela fizeram.

## O que NÃO foi feito

- **Os textos, as linhas internas e os furos dos outros tamanhos continuam
  sem aparecer na tela:** só o contorno e os piques.
- **O Ctrl+Z do cadastro vale dentro da sessão do projeto:** fechado o
  programa, o histórico não existe mais, como para o resto.

## Verificação

- **Testes:** 1992/1992 em 92 arquivos (eram 1978 em 90); tipos e lint limpos
  (o aviso antigo do `useMemo` continua). Novos: o cadastro ao desfazer e ao
  refazer, inclusive mudado por outro caminho; a tabela dada à mão e as
  recusas; os campos da janela e o que ela aplica; os piques de cada tamanho
  e o desenho deles.
- **Mutações:** 35, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas.
- **Electron real, peças de teste:**
  - cadastrado um formato: Ctrl+Z o tira do cadastro (e as linhas do desenho
    continuam na peça); Ctrl+Y o põe de volta;
  - redesenhado, levando ao pique posto: um Ctrl+Z devolve a forma de antes
    ao cadastro e ao pique;
  - excluído: Ctrl+Z desfaz a exclusão; Ctrl+Y a refaz;
  - na peça graduada, o pique interno alinhado: a janela do "Alterar" tem os
    quatro campos; 500 mm é recusado com a janela aberta; com 60 e −60, o
    pique passa a andar isso, e a mensagem diz;
  - na tela, a cruz do tamanho maior e a do menor aparecem onde a tabela as
    pôs (antes não havia nada ali);
  - Ctrl+Z devolve as peças e o cadastro.
  - **15 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
