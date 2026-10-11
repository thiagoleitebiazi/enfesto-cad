# ADR 0057 — Os moldes reais pela tela, e a folha de revisão

## Contexto

O teste com os moldes reais (ADR 0053) rodou as contas das ferramentas, e não
os cliques na tela. E ninguém da modelagem tinha olhado se a pence, o bico e a
prega ficam como o ofício espera.

A segunda parte não é coisa que o programa resolva: é preciso uma pessoa. O
que dá para fazer é deixar pronto o que ela precisa para olhar.

## Decisão

### O teste pela tela

- O roteiro automático passa a ter uma variante que **abre um projeto real**:
  uma cópia do arquivo é posta na pasta de projetos do roteiro (nunca a do
  programa) e aberta pela Biblioteca, como o usuário faz.
- Para cada peça, o roteiro enquadra a peça com o "Zoom por janela" e faz, com
  cliques de verdade na área de desenho:
  1. uma pence recortada de 20 × 80 mm, em esquadro, no meio do lado de cima;
  2. uma pence aberta por pivô de 30 × 100 mm, com acabamento (o bico), do
     lado de cima ao de baixo;
  3. uma prega simples de 20 mm, de um lado ao outro.
- Depois de cada uma, lê o arquivo salvo, tira uma foto e desfaz com Ctrl+Z.
  No fim de cada peça, confere que ela voltou a ser a de antes.

### A folha de revisão

- As fotos e as medidas lidas viram uma folha (HTML) para quem faz a
  modelagem: a peça como está, os três resultados e, para cada um, o que
  olhar, com uma caixa para marcar.
- A folha fica em `revisao-local/`, **fora do git** (`.gitignore`): são moldes
  reais, e o repositório é público. O roteiro e o gerador da folha também não
  estão no repositório.

## O que NÃO foi feito

- **Ninguém da modelagem olhou ainda.** A folha está pronta; a resposta
  depende de uma pessoa.
- **O lugar da pence e da prega em cada peça foi escolhido pelo roteiro** (o
  meio de um lado), para ter o que mostrar. Não é onde elas iriam numa roupa.
- **O roteiro só passou por pence recortada, pence com bico e prega.** O corte
  por elementos, o "Cortar intersecções", as pontas indicadas, as alças de
  tangente e a graduação foram exercitados pela tela nas peças de teste (ADR
  0054 a 0056), e não nas reais.
- **Um projeto só:** o que tem os moldes de produção. Os outros têm retângulos
  ou os mesmos moldes com menos pontos.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação (Electron real, build de produção)

- **Projeto real, pela tela:** 4 peças, de 445 a 829 pontos e 24 a 27 linhas
  internas. 12 operações, todas aplicadas.
  - **Pence recortada:** nas quatro, abertura de 20,0 mm e as duas pernas com
    80,6 mm (a hipotenusa de 10 × 80).
  - **Pence com acabamento:** nas quatro, o bico é um ponto do contorno; fica
    de 4,2 a 19,2 mm para fora da reta das pontas, conforme a inclinação da
    borda ali.
  - **Prega:** nas quatro, a peça abriu 40,0 mm nas duas pontas.
  - Depois dos Ctrl+Z, as quatro peças voltaram ao que eram: os mesmos pontos,
    a mesma área, as mesmas linhas.
- **Validação:** o projeto já abre com 1 erro, que é dos dados, não das
  ferramentas (uma peça está fora da área útil do tecido). Não apareceu erro
  de contorno em nenhuma operação. Numa peça, a prega fez a peça crescer para
  cima da vizinha (2 erros), e o Ctrl+Z desfez.
- **Nenhum defeito das ferramentas apareceu neste teste.**
- **Testes:** 1640/1640 em 78 arquivos, sem mudança: esta etapa não mexeu no
  código do programa.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). O
  repositório não ganhou nenhum dado real (`git status` só mostra o
  `.gitignore` e este ADR).
