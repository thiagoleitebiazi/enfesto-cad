# ADR 0062 — O círculo dimensionado por igual continua sendo círculo

## Contexto

O círculo do "Por raio" guarda um registro (ADR 0056): com ele, o raio muda
depois pela janela. O "Dimensionar" tirava esse registro sempre — mesmo com o
mesmo fator nos dois sentidos, em que o círculo continua sendo um círculo, só
maior ou menor.

O que impedia: o círculo é desenhado com um número de lados que depende do
raio. Dimensionado, ele fica com os lados que tinha; refeito pelo registro com
o raio novo, sairia com outro número de lados, e o contorno já não bateria.

## Decisão

- O registro do círculo pode guardar **quantos lados o contorno tem**
  (`lados`), quando não é o número que o raio pede.
- O "Dimensionar" **por igual nos dois sentidos** mantém o registro: raio novo
  (o de antes vezes o fator), o centro onde foi parar, os mesmos eixos e os
  lados que o contorno tem.
- **Mudado o raio pela janela**, o círculo é refeito com os lados que o raio
  novo pede, e o registro volta a não guardar os lados.
- A janela do círculo diz que dimensionar por igual não tira o registro.

## O que NÃO foi feito

- **Com fatores diferentes** o círculo vira uma elipse: o registro deixa de
  valer, como antes.
- **A espiral perde o registro mesmo por igual.** A espiral da ferramenta tem
  o vão entre as voltas fixo (1 mm): a espiral ampliada não é a espiral da
  ferramenta com outras medidas.
- **O círculo dimensionado fica com os lados que tinha.** Ampliado muito, os
  lados ficam compridos; mudar o raio pela janela refaz com os lados certos.
- **O nome do programa de referência** ainda aparecia em quatro comentários
  do código (um deles neste "Dimensionar"): saiu. Nos ADR antigos (0011 a
  0029, já publicados) ele continua: não foram reescritos.

## Verificação

- **Testes:** 1696/1696 em 81 arquivos (eram 1694). Novos: dimensionado por
  2, por 0,5 e duas vezes seguidas, o registro fica com o raio certo e os
  lados de antes; continua acompanhando a peça movida, girada e espelhada;
  mudado o raio, os lados voltam a ser os do raio; com fatores diferentes, e
  na espiral, o registro deixa de valer; a janela abre com o raio novo.
- **Mutações:** 8, uma por vez, com o código conferido por hash antes e
  depois. 7 pegas pelos testes. A oitava (tratar a espiral como círculo) não
  passa na checagem de tipos: o compilador é que a pega.
- **Electron real, build de produção:** um círculo feito com o "Por raio"
  (raio 99,4 mm, 105 lados). Dimensionado 1,5 × 1,5: continua círculo, raio
  149,2, 105 lados guardados, todos os pontos a 149,2 do centro. O clique no
  centro abre a janela com 149,17; mudado para 120: 126 lados, e os lados
  deixam de estar guardados. Dimensionado 2 × 1: a faixa deixa de oferecer
  "mudar o raio de um círculo já feito". Três Ctrl+Z devolvem o círculo de
  antes. **7 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
