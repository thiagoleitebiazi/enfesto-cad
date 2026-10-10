# ADR 0044 — Cor, textos, linha de simetria, código de pique, autor e Conferir

## Contexto

Sete ferramentas continuavam desligadas, cada uma com um motivo do tipo "este
programa não guarda isso":

- **Início:** Cor ("as peças não têm cor própria").
- **Construção:** Inserir texto e Editar texto ("não há textos soltos no
  desenho").
- **Produção:** Linha de simetria ("o encaixe não dobra moldes").
- **Modelo:** Autor ("o projeto não guarda dados de autor") e Relacionamento
  piques ("os piques não têm código").
- **Conferência:** Conferir ("operação de modelagem").

O pedido foi fazê-las funcionar. O que faltava era, em todas, um dado a mais
na peça ou no projeto.

## Decisão

### O que passou a ser guardado

- **Na peça:** `cor`, `textos` e `linhaDeSimetria`, todos opcionais. No
  **pique**, `codigo`. No **projeto**, `autor`.
- Tudo o que é da peça é salvo com ela e entra no desfazer, sem código novo
  para isso. Projetos antigos abrem como antes: os campos só existem em quem
  os usa.
- Textos e linha de simetria andam, giram, espelham e são dimensionados com a
  peça, e acompanham a forma de cada tamanho na graduação.

### Cor

- O diálogo oferece sete tons claros e "Sem cor (a padrão)". Vale para a peça
  selecionada ou para todas as marcadas na lista.
- A cor é só o fundo da peça na tela. **O contorno continua dizendo o estado**
  (selecionada, com problema), e os tons são claros para o que está dentro
  continuar legível. O PDF não leva a cor.

### Inserir texto e Editar texto

- **Inserir:** o diálogo pede o texto e a altura das letras em mm; cada clique
  põe o texto, centrado no ponto clicado, na peça selecionada.
- **Editar:** um clique sobre um texto abre o diálogo com o que está escrito e
  a altura. **Em branco, apaga o texto.**
- Na tela, o texto é desenhado na altura pedida, com um mínimo de 7 px para
  não sumir com o zoom afastado, e por cima do nome da peça.
- **No PDF**, sai na altura real em mm, centrado no mesmo ponto. O texto fica
  na horizontal da folha, como o rótulo da peça.

### Linha de simetria

- Um clique numa aresta do contorno marca-a como a linha em que a peça é
  dobrada: **a peça desenhada é meia peça**. Clicar de novo na mesma aresta
  tira a marca; em outra, troca a linha de lugar.
- Só é aceita a aresta em que a peça pode ser desdobrada (a peça inteira de um
  lado só da reta), a mesma condição do Desdobrar (ADR 0038).
- A marca é guardada pelas duas pontas da aresta. Se uma edição do contorno
  desfizer a aresta, a marca deixa de valer sozinha, sem erro.
- Na tela e no PDF, a aresta ganha um traço e ponto roxo por cima.
- **No encaixe automático**, quando há peça com linha de simetria, aparece a
  opção "Abrir as peças com linha de simetria", marcada de início. Marcada, a
  peça entra aberta, inteira; ao aplicar o resultado, passa a ser a peça
  inteira (Ctrl+Z desfaz). Desmarcada, entra como está desenhada.

### Relacionamento piques

- Um clique num pique da peça selecionada abre o diálogo do código dele (até 8
  caracteres). O diálogo mostra os códigos já em uso e em que peças.
- **Piques de peças diferentes com o mesmo código são os que se encontram na
  costura.** Ao aplicar, a faixa diz se já há outro pique com esse código em
  outra peça.
- O código é escrito ao lado do pique, **do lado de dentro da peça**, na tela
  e no PDF. Assim a peça vizinha no encaixe nunca o cobre, seja qual for o
  sentido em que o contorno está guardado.
- Em branco, o pique volta a não ter código.

### Autor

- O diálogo guarda no projeto o nome de quem fez o modelo (até 80
  caracteres); em branco, tira.
- O autor vai junto para as variantes do projeto e para a cópia feita com
  "Salvar como".

### Conferir

- Mede dois trechos de contorno, um em cada peça (dois cliques em cada), e dá
  o veredito na faixa: **"As duas costuras conferem"** ou **"Não conferem: a
  2ª é X mm maior (Y%)"**, com as duas medidas.
- Conferem até 0,5 mm de diferença: é menos do que se corta ou costura com
  precisão.
- É a leitura natural do nome, com o que o programa já sabia medir. O manual
  da referência não descreve a ferramenta em detalhe.

## O que NÃO foi feito

- **Conferir deslizando um molde sobre o outro** (andar a costura ponto a
  ponto, com os piques): Conferir compara os comprimentos.
- **Texto girado, em outra fonte ou em várias linhas:** o texto é uma linha,
  na horizontal da tela.
- **Cor no PDF e no relatório:** a cor é só da tela.
- **Conferência automática dos códigos de pique** (avisar de um código sem
  par): o diálogo mostra onde cada código está, e a decisão é de quem modela.
- **Conferência com a referência:** não houve como comparar o resultado com o
  programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 1144/1144 em 61 arquivos (eram 1103 em 60).
  - Novos: anotações da peça 21, Conferir 3, autor 4, opção do encaixe 4,
    PDF 4, fita 5.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 13 mutações guardadas, uma por vez: todas pegas pelos testes, e os oito
    arquivos conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo. Peças de 400 × 300 mm:
  - **Cor:** verde salvo na peça (`#d9f0dc`) e presente no desenho dentro
    dela, e não na outra peça.
  - **Textos:** "DOBRA" de 20 mm posto em (201; 98,4); um segundo virou
    "MEIO" de 30 mm; em branco, foi apagado; Ctrl+Z trouxe de volta. Texto em
    branco no Inserir é recusado com mensagem.
  - **Piques:** um em cada peça, os dois com o código "K7". No segundo, o
    diálogo mostrou "K7 (TESTE-1: 1)" e a faixa disse "o mesmo de TESTE-1".
    Código de 9 caracteres foi recusado.
  - **Autor:** "Maria Teste" gravado no arquivo do projeto e de volta no
    diálogo ao reabrir.
  - **Conferir:** 300 mm com 300 mm, "As duas costuras conferem"; 300 mm com
    400 mm, "Não conferem: a 2ª é 100,0 mm maior (33,3%)".
  - **Linha de simetria:** marcada de (0, 0) a (400, 0); o segundo clique
    tirou; traço roxo presente nessa aresta e ausente na oposta.
  - **PDF dos moldes**, gerado pelo próprio programa: contém "DOBRA", "MEIO" e
    "K7", letras de 56,69 pt e 85,04 pt (20 e 30 mm) e o traço e ponto.
  - **Encaixe com a peça aberta:** a meia peça de 1200 cm² entrou com
    2400 cm², com a cor, os dois textos e os piques dos dois lados; validação
    sem problemas; Ctrl+Z voltou à meia peça com a marca.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
