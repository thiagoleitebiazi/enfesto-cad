# ADR 0078 — O PDF leva a peça inteira; a peça maior que uma folha volta

## Contexto

O ADR 0077 fechou as listas de "não foi feito" da aba Marcações e deixou
escrito o que ainda ficava. Dois itens eram do PDF:

- "A peça maior que uma folha não é importada do PDF."
- "O PDF não leva a graduação, a cor, a linha de simetria nem os registros de
  pence, curva e prega."

E havia um defeito conhecido, visto na conferência do ADR 0076: a peça
importada do PDF entrava **em cima** das que já estavam no projeto, e a
validação acusava a sobreposição.

## Decisão

### O registro passa a ser a peça inteira

- O registro que o ADR 0076 pôs na página da peça levava só parte dela (os
  formatos, os textos, as linhas de construção). Agora leva **a peça como está
  no projeto**: também a graduação (a dela, a dos piques e o alinhamento dos
  piques internos), a cor, a linha de simetria, as rotações permitidas, as
  cotas, a metade guardada pela dobra e os registros de pence, curva, prega,
  cunha e figura.
- Continua sendo um comentário do PDF, que não aparece na folha. O desenho é o
  mesmo.
- Toda peça sai com o registro, na **primeira página dela**. O PDF do encaixe
  não o leva.

### A leitura

- O registro é **dado vindo de fora**. Cada campo é conferido contra o que uma
  peça pode ter; o que não é campo de peça fica de fora; e, se alguma coisa
  não serve, nada dele é aproveitado.
- O registro **só vale se descreve a peça que o desenho mostra**: o mesmo
  contorno, ponto a ponto. Senão, a peça volta só pelo desenho, e um aviso
  diz.
- A peça que vira molde do projeto ganha **identificadores novos** — o dela e
  os de tudo o que ela tem —, e as listas que apontam para piques e marcas
  (nas pences, pregas e cunhas) acompanham a troca.
- Sem registro (um PDF de antes dele), a peça volta pelo desenho, como
  sempre, sem aviso.

### A peça maior que uma folha

- Ela sai em várias páginas, e **cada página traz o desenho inteiro** — a
  folha só deixa aparecer um pedaço, pelo recorte. A importação lê a primeira
  página e pula as outras.
- O aviso antigo ("não é suportada") saiu: a peça volta inteira.

### Onde a peça importada vai parar

- Cada peça que chega vai para o **primeiro lugar livre** da área do enfesto,
  sem ficar em cima das que já estão no projeto nem umas das outras.
- A que não cabe no enfesto — ou todas, sem enfesto configurado — vai para
  depois de tudo o que há, na direção do comprimento, a 20 mm.
- A peça anda inteira; só a posição muda.

## O que NÃO foi feito

- **O PDF do encaixe continua não sendo importado:** ele mostra as peças
  postas na mesa, sem página própria nem registro.
- **Um PDF de outro programa** continua voltando só pelo desenho, quando
  volta.
- **A importação do DXF não foi mexida:** ela já punha as peças juntas num
  lugar próprio.

## Verificação

- **Testes:** 1978/1978 em 90 arquivos (eram 1973); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: a peça com tudo o que uma peça
  pode ter volta igual pelo registro; 52 formas de registro estragado
  recusadas, uma por campo; a ida e volta pelo PDF de verdade; os
  identificadores novos e as listas que os seguem; o registro de outra peça,
  com mais ou com menos pontos; a peça de seis páginas; o lugar das peças que
  chegam.
- **Mutações:** 61, uma por vez, com o código conferido por hash antes e
  depois. 58 pegas de primeira; as outras três ganharam teste e foram pegas na
  segunda rodada.
- **Electron real, pela janela de exportar e pelo botão de importar** (só a
  janela de salvar e a de abrir do sistema foram respondidas pelo roteiro):
  - uma peça pequena, graduada em três tamanhos, com pique V com código,
    pique interno, texto a 30° e uma linha de construção; e as duas peças de
    teste grandes;
  - exportadas em "moldes individuais": 11 páginas, três registros (um por
    peça), uma só linha interna desenhada;
  - importado o mesmo arquivo: voltam as três peças, sem aviso — as grandes
    com os 1200 cm² que têm, e a pequena com tudo, a graduação inclusive;
  - nenhuma das que chegaram ficou em cima de outra, e a validação continuou
    "sem problemas";
  - Ctrl+Z tira as três de uma vez.
  - **14 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
