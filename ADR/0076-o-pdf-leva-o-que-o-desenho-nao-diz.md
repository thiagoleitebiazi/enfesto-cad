# ADR 0076 — O PDF leva o que o desenho não diz, e a importação traz de volta

## Contexto

Dois itens de "O que NÃO foi feito" eram do PDF:

- "O PDF não guarda o formato. Importando um PDF exportado daqui, o pique com
  formato volta no lugar certo, mas como o traço de sempre; o pique interno
  volta como um ponto" (ADR 0071).
- "O PDF não leva os elementos: reimportado, o molde vem sem eles" (ADR 0073).

E dois eram de verificação (ADR 0073):

- "O pontilhado da tela não tem teste de unidade."
- "A saída do PDF não foi conferida pela tela."

Ao escrever os testes de ida e volta apareceram dois defeitos antigos da
importação, que não estavam em lista nenhuma:

- A página da peça que tem **texto**, ou **pique com código**, não era
  reconhecida: a peça não voltava, e o aviso dizia só "nenhuma peça
  reconhecível".
- A peça **sem tamanho** também não era reconhecida, e sem aviso.

## Decisão

### O registro da peça no PDF

- Na página de cada peça vai um **registro** com o que o desenho não diz:
  - de cada pique do contorno: o formato (tipo, medidas, ângulo, a forma do
    cadastrado, o espelhamento), o "pique na costura" e o código;
  - os piques internos: onde cada um está de verdade (o desenho só mostra os
    traços) e o formato;
  - os textos da peça, com a altura, o ângulo e a âncora;
  - as linhas só de construção (os elementos).
- É um **comentário do PDF**: quem abre ou imprime o arquivo não vê nada, e o
  desenho é o mesmo de antes. A linha de construção **continua fora da
  folha**.
- A peça em que o desenho já diz tudo sai **sem registro**: o arquivo dela é
  igual ao de antes.

### A importação

- Lê o registro e devolve a peça como era: os piques com o formato, os
  internos no ponto certo, os textos, e as linhas de construção — que voltam
  para a peça, ainda só de construção.
- O registro é tratado como **dado vindo de fora**: cada campo é conferido.
  Cortado, trocado ou com um campo fora do esperado, nada dele é aproveitado:
  a peça volta só pelo desenho, e um aviso diz.
- O registro **não é imposto ao desenho**: o formato só vai para o pique que
  está no lugar que o registro diz, e as marcas só vêm dele quando são tantas
  quantas o desenho mostra.

### Os dois defeitos da importação

- O rótulo da peça passa a ser achado mesmo com textos escritos antes dele
  na página (os códigos dos piques e os textos da peça).
- A peça sem tamanho é reconhecida, e volta sem tamanho.

### O desenho das linhas internas

- O traçado das linhas internas saiu do componente da tela para uma função
  própria, com teste: a linha do molde, cheia; o elemento, claro e
  pontilhado; e o pontilhado não vaza para o que é desenhado depois.

## O que NÃO foi feito

- **A peça maior que uma folha continua não sendo importada** (sai em várias
  páginas; a importação avisa). É o limite que já existia.
- **O registro só é escrito por este programa:** um PDF de outro programa
  continua voltando só pelo desenho, quando volta.
- **O que mais a peça tem e o PDF não leva** — a graduação, a cor, a linha de
  simetria e os registros de pence, curva e prega — continua não voltando.
  O projeto salvo é que guarda tudo.

## Verificação

- **Testes:** 1973/1973 em 90 arquivos (eram 1956 em 88); tipos e lint limpos
  (o aviso antigo do `useMemo` continua). Novos: o registro escrito e lido de
  volta, com mais de vinte formas de registro estragado recusadas; a ida e volta pelo
  PDF de verdade — formato, pique na costura, código, pique interno, textos,
  linha de construção —; o registro estragado e o registro de outra peça; a
  peça com texto e a peça sem tamanho; o desenho das linhas internas.
- **Mutações:** 49, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas. Duas linhas sem efeito foram retiradas antes.
- **Electron real, pela janela de exportar e pelo botão de importar** (só a
  janela de salvar e a de abrir do sistema foram respondidas pelo roteiro):
  - uma peça pequena com pique V com código, pique interno em cruz, texto a
    30° e duas linhas internas, uma delas só de construção;
  - exportada em "moldes individuais": o arquivo tem um registro (o da peça
    nova) e uma só linha interna desenhada;
  - importado o mesmo arquivo: entra uma peça a mais, com o V de 8 × 10 e o
    código, a cruz, o texto a 30° e as duas linhas — a de construção ainda
    de construção; as medidas de dentro da peça são as mesmas;
  - as peças de teste grandes, sem tamanho, agora são reconhecidas e
    avisadas como "maiores que uma folha".
  - **12 conferências, 0 falhas.** Na primeira rodada o roteiro tinha posto
    as linhas perto demais da borda (o clique era preso ao contorno);
    afastadas, a rodada foi repetida.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
