# ADR 0047 — Pences com dados próprios

## Contexto

Uma pence, depois de feita, era só geometria: recortada, três pontos do
contorno; marcada ou interna, linhas internas (ADR 0039). Duas consequências:

- **Não dava para mudar as medidas depois.** O jeito era desfazer e fazer de
  novo, ou mexer ponto a ponto.
- **Fechar e Transferir adivinhavam** qual canto era a pence: qualquer canto
  do contorno que entra na peça servia.

O pedido foi corrigir isso.

## Decisão

### O registro

- Toda pence feita por ferramenta fica **registrada na peça** (`Molde.pences`):
  o tipo (recortada, marcada ou interna) e os pontos dela.
- A recortada guarda também **o que o recorte tirou do contorno**: os pontos
  que havia entre as duas pontas e se cada ponta foi posta pelo recorte.
- O registro guarda os piques e as marcas que vieram com a pence.
- **Vale enquanto os pontos estão na peça como foram postos.** A recortada,
  enquanto ponta, vértice e ponta forem pontos seguidos do contorno; a marcada
  e a interna, enquanto a linha interna delas existir. Fora disso o registro é
  ignorado, sem erro, e sai na próxima operação de pence.
- Registram: Pence no contorno (recortar, marcar e abrir), Pence interna e
  Múltiplas pences.

### Mudar as medidas

- Com **Pence no contorno** ligada, um clique numa pence já feita abre as
  medidas dela, em vez de criar outra. O mesmo com **Pence interna**, num
  losango já feito. Não há botão novo na fita.
- As pences registradas aparecem com um anel no vértice, e a que está sob o
  mouse fica em destaque.
- **Pence do contorno:** abertura, profundidade e **desvio do vértice** para o
  lado (zero é em esquadro). Com os três, o vértice vai para onde se quiser.
- **Pence interna:** as duas alturas e a largura.
- A pence é **tirada e refeita no mesmo lugar**, pelo mesmo código que a cria:
  valem as mesmas recusas (vértice fora da peça, pence que cruza o contorno).
- **Apagar esta pence**, no mesmo diálogo: a recortada devolve o contorno de
  antes do recorte, com os pontos que ele tinha tirado; a marcada e a interna
  levam as linhas, os piques e as marcas delas.
- É um passo de desfazer.

### O registro acompanha a peça

- Mover, girar, espelhar e dimensionar a peça.
- **Mover ponto**, Modificar e a cerca: o ponto de pence que estava em cima de
  um ponto do contorno vai com ele. A pence mexida assim continua editável.
- Cada tamanho da graduação.
- A região que gira ao abrir, fechar ou transferir outra pence, e nas pregas.

### Fechar e Transferir

- **Transferir:** o registro passa a ser o da pence nova, com o mesmo vértice.
- **Fechar só o recorte:** a pence continua registrada, agora como marcada.
- **Fechar com pivô:** a pence deixa de existir, e o registro sai.
- O canto que não foi feito por ferramenta de pence (peça importada, recorte
  desenhado à mão) **continua sendo aceito**, mas a mensagem diz: "Esse canto
  não foi feito por uma ferramenta de pence: foi tratado como pence por ser um
  canto que entra na peça".

## O que NÃO foi feito

- **Registro para o que já existia:** pences de projetos antigos, de peças
  importadas ou desenhadas à mão não têm registro. Fechar e Transferir
  funcionam nelas como antes; mudar pelas medidas, não.
- **Pregas:** continuam sem registro.
- **Cortar, Dobrar e Unir:** o registro da pence que foi parar na outra parte
  deixa de valer; a que ficou inteira continua.
- **Arrastar o vértice com o mouse** dentro do diálogo: o vértice muda pelas
  três medidas, ou com Mover ponto.
- **Pence aberta por pivô:** mudar a abertura refaz só o recorte, não o giro
  que abriu a peça.
- **Recorte numa curva:** ao mudar as medidas, as pontas novas ficam sobre o
  contorno de antes do recorte, e o vértice pode sair alguns décimos de
  milímetro do pedido.

## Verificação (Electron real, build de produção)

- **Testes:** 1276/1276 em 68 arquivos (eram 1242 em 67).
  - Novos: registro e edição no domínio 24, interface 10.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 17 mutações guardadas, uma por vez: todas pegas, e os cinco arquivos
    conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo. Peça de 400 × 300 mm:
  - Pence recortada de 40 × 100: 1180 cm², registrada com as três posições.
  - Um clique na perna abriu o diálogo com 40, 100 e 0. Profundidade de 900
    foi recusada ("o vértice cairia fora da peça").
  - Mudada para 60 × 50 com desvio de 10: 1185 cm² (1200 − 60 × 50 / 2), e o
    vértice 10 mm para o lado do meio das pontas.
  - Apagada: 1200 cm², 4 pontos, sem piques e sem o campo de pences. Ctrl+Z
    trouxe a pence de volta, com o registro.
  - Transferida: a área continuou 1185 cm², o registro seguiu com o mesmo
    vértice, e a mensagem veio sem o aviso do canto.
  - Fechado só o recorte: o registro virou "marcada", e o clique nela abriu o
    diálogo de pence marcada.
  - Pence interna criada e mudada para 50 mm de largura, com as mesmas 3
    linhas e 4 marcas, e a validação sem problemas.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
