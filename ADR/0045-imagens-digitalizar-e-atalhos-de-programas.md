# ADR 0045 — Imagens, Digitalizar e os atalhos de Programas

## Contexto

Depois do ADR 0044, sobravam duas ferramentas desligadas e um grupo que nem
aparecia na fita:

- **Modelo > Imagens:** "o projeto não guarda imagens".
- **Produção > Digitalizar:** "depende de uma mesa digitalizadora".
- **O grupo que abre os outros programas do fabricante**, na aba Início: "não
  tem equivalente" (ADR 0035).

O pedido foi fazer o que fosse necessário para funcionarem. Nenhuma das três
pode ser igual à referência: não há mesa digitalizadora ligada a este
programa, nem outros programas nossos para abrir. Cada uma ganhou a leitura
natural do nome, com o que um computador comum tem.

## Decisão

### Imagens

- O projeto passa a guardar **fotos e desenhos do modelo** (`Projeto.imagens`),
  até 4. Cada uma aparece **por baixo das peças**, com moldura tracejada.
- O painel lista as imagens com miniatura, tamanho no desenho e escala. Em
  cada uma: mostrar ou esconder, opacidade (25, 50, 75 ou 100%), calibrar a
  escala e remover.
- **Ao entrar, a imagem é reduzida** para no máximo 2000 px no lado maior e
  gravada como JPEG sobre fundo branco. O arquivo do projeto continua pequeno
  (a foto de teste, de 1200 × 800 px, ocupou 20 KB).
- As imagens ficam no projeto, e **não no estado de cada versão**: o
  histórico não repete a imagem a cada evento.
- A imagem nova vai para o começo da mesa ou, havendo peças, para logo depois
  da última, e a vista vai até ela. "Ajustar à tela" passa a enquadrar também
  as imagens à mostra.
- As imagens vão junto para as variantes do projeto e para a cópia feita com
  "Salvar como".
- Mexer nas imagens **não entra no desfazer**: é coisa do projeto, como o
  autor. Remover pede confirmação.

### Calibrar a escala

- Dois cliques sobre a imagem, nas pontas de uma medida conhecida (uma régua
  na foto), e a distância real em mm. A imagem cresce ou encolhe até os dois
  pontos ficarem a essa distância.
- **O canto de cima à esquerda não sai do lugar**, para a imagem continuar na
  mesa. Na primeira versão ela crescia em volta do ponto clicado, escorregava
  para fora da mesa, e a peça contornada nascia com erro de validação.
- Até calibrar, a escala é a de uma tela comum (96 pontos por polegada) e o
  painel avisa: "Escala por calibrar".

### Digitalizar

- Abre o mesmo painel, com os três passos para **copiar um molde de papel a
  partir de uma foto ou de um escaneado**: adicionar a foto, calibrar a escala
  e contornar.
- Calibrando por aqui, o programa já liga o "Criar molde" em seguida. O botão
  "Contornar o molde" faz o mesmo quando já há uma imagem à mostra e na escala.
- O contorno é o do "Criar molde": clique nos pontos, Enter fecha, e dois
  cliques dão a linha de fio. A peça nasce na medida real.

### Programas

- Novo grupo na aba Início, com um botão que abre a lista de **atalhos para os
  outros programas que se usam junto com este**: o do plotter, o da máquina de
  corte, uma planilha, um site. É o usuário quem cadastra cada um.
- A lista é do computador (`programas.json`, na pasta de dados do programa),
  não do projeto. Até 12 atalhos.
- **A lista mora no processo principal.** A interface só pede "abra o atalho
  tal", pelo id; nunca manda um caminho para abrir.
  - Um arquivo só entra na lista pela janela de escolha do sistema.
  - Um endereço só entra se for http ou https (`file:`, `javascript:` e outros
    esquemas são recusados).
  - O arquivo da lista é conferido ao ser lido: o que não for um atalho bem
    formado é ignorado.
- No navegador (sem o processo principal), o botão fica desligado e diz que é
  só no programa instalado.

### A fita

- Não sobra nenhuma ferramenta marcada como "indisponível neste programa". A
  propriedade que servia para isso foi tirada do botão da fita.

## O que NÃO foi feito

- **Mesa digitalizadora:** não há leitura de nenhum aparelho. Digitalizar é
  contornar por cima de uma foto.
- **Corrigir a foto:** girar, endireitar a perspectiva ou tirar a distorção da
  lente. A foto precisa ser tirada de cima, bem de frente; um escaneado é
  melhor. A medida vale tanto quanto a foto for plana.
- **Achar o contorno sozinho:** quem contorna é o usuário, ponto a ponto.
- **Ver a foto através da peça:** a peça desenhada cobre a imagem.
- **Mover a imagem com o mouse:** ela fica onde entrou.
- **Imagens no PDF e no relatório.**
- **Abrir os programas do fabricante da referência:** os atalhos são para o
  que o usuário tiver instalado.
- **Conferência com a referência:** não houve como comparar o resultado com o
  programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 1184/1184 em 65 arquivos (eram 1144 em 61).
  - Novos: imagens 17, painel das imagens 6, atalhos 9, painel dos atalhos 6,
    fita 2.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 13 mutações guardadas, uma por vez: todas pegas pelos testes, e os seis
    arquivos conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo. A "foto" foi feita no
  roteiro: 1200 × 800 px, com um retângulo de 600 × 500 px e uma régua de
  500 px que vale 250 mm — a escala de verdade é 0,5 mm por px, e o "molde de
  papel" tem 300 × 250 mm.
  - Um arquivo de texto no lugar da imagem foi recusado com mensagem.
  - A foto entrou como JPEG de 20 KB, em (0, 920), logo depois das peças, fora
    do histórico, com "Escala por calibrar".
  - **Calibração:** dois cliques nas pontas da régua mediram 132,4 mm; com
    250 mm digitados, a escala ficou em 0,4994 mm por px (esperado 0,5), e o
    canto continuou em (0, 920). Distância em branco e zero foram recusadas.
  - **Contorno:** quatro cliques nos cantos do retângulo da foto, Enter e a
    linha de fio. A peça nova mediu **300,1 × 249,9 mm**, com a validação sem
    problemas.
  - **Imagens:** esconder e 25% de opacidade foram gravados, e o traço da foto
    sumiu do desenho; remover pediu confirmação e deixou o projeto sem o campo.
  - **Programas**, com a abertura trocada por um registro (nada foi aberto de
    verdade): um arquivo e um endereço cadastrados e gravados; o mesmo arquivo
    de novo e `javascript:alert(1)` recusados; "Abrir" chamou o sistema com o
    caminho e com `https://exemplo.com.br/pedidos`. Pedir para abrir um caminho
    no lugar de um id devolveu "Atalho não encontrado" e não abriu nada.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). A
  pasta de dados do usuário não ganhou `programas.json`.
