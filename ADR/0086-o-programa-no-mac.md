# ADR 0086 — O programa no Mac

## Contexto

Pedido: "agora preciso que o software rode no Mac". O programa é feito em
Electron, que roda no Mac, mas até aqui só era montado e conferido para
Windows. Três coisas impediam o uso no Mac:

- **Não havia instalador de Mac**, e ele não se monta no Windows: o pacote
  do Mac (com os links internos do Electron.app, a imagem .dmg, a assinatura)
  só se monta num Mac. Este computador é Windows.
- **No Mac, sem menu, ⌘C/⌘V/⌘Z não funcionam**, nem nos campos de texto: lá
  os atalhos de edição são do menu da barra do sistema, e o programa tirava
  o menu (no Windows, a faixa de abas faz esse papel). Também não havia
  ⌘Q para sair.
- **O trackpad disparava o zoom.** Cada evento de rolagem dava 15% de zoom;
  o trackpad do Mac manda dezenas deles num gesto de dois dedos, e a vista
  disparava. A pinça também aproximava aos saltos.

E dois pontos da abertura conferida (ADR 0083) não serviam no Mac: a caixa
"Abrindo o Enfesto CAD…", sem janela-mãe, roda presa ao processo principal
no Mac (a abertura pararia até alguém clicar nela); e o desenho por software
do modo padrão, posto por causa dos drivers de vídeo do Windows, fica
pesado na tela Retina.

## Decisão

### O instalador é montado num Mac do GitHub

- `.github/workflows/mac.yml`: a cada envio para o `master` (e pelo botão
  "Run workflow"), um Mac do GitHub (macos-15, chip Apple) instala as
  dependências, roda os testes, gera o programa e monta
  **`Enfesto-CAD-0.1.0-mac.dmg`**, um arquivo só para Mac com chip Apple e
  Intel (universal). Depois **abre o programa montado de verdade**, no modo de
  teste (abaixo), na parte do chip Apple e — se aquele Mac tiver o Rosetta —
  na parte Intel; se a tela não aparecer, a execução falha. A foto da tela
  e o .dmg ficam guardados na execução (14 dias), e o .dmg vai para o
  lançamento v0.1.0, ao lado do instalador do Windows.
- **Sem a assinatura paga da Apple** (a conta de desenvolvedor custa por
  ano, e o projeto não tem): o programa leva a assinatura local ("ad hoc",
  sem a qual o Mac com chip Apple nem roda o programa), sem o "hardened
  runtime" (que, com essa assinatura, recusaria o próprio Electron). Na
  primeira abertura o Mac avisa que não pode verificar o programa; o README
  diz como abrir mesmo assim.
- `npm run package:mac` monta o mesmo, num Mac.

### O teste de abertura

- `ENFESTO_CAD_TESTE_DE_ABERTURA=1`: o programa abre, espera a tela aparecer
  conferida (a mesma conferência do ADR 0083), tira a foto dela (se pedida
  em `ENFESTO_CAD_FOTO_DA_ABERTURA`), escreve "ABERTURA-OK" e sai com 0. Se a
  tela não aparece, escreve "ABERTURA-FALHOU" e sai com 1 — sem reabrir em
  outro modo, sem perguntar nada e sem caixa nenhuma (num Mac do GitHub não
  há ninguém para clicar).

### O menu da barra do Mac

- **Enfesto CAD:** Sobre, Ocultar (⌘H), Ocultar os outros, Mostrar todos,
  Sair (⌘Q). **Editar:** Desfazer (⌘Z), Refazer (⇧⌘Z), Recortar, Copiar,
  Colar, Selecionar tudo. **Janela:** Minimizar, Zoom, Tela cheia.
- Os itens do Editar não usam os papéis prontos do sistema: com eles, ⌘Z e
  ⌘C iriam sempre para o texto, e no desenho não fariam nada. Eles mandam a
  ação para a página (`src/ui/edicaoPeloMenu.ts`): com um campo de texto em
  foco, a ação é do texto (feita pelo próprio motor); fora dele, é a do
  programa (desfazer, copiar a peça…); com uma janela aberta e sem campo de
  texto, nada — como os atalhos de teclado.
- No Windows nada muda: continua sem menu.
- ⌘H oculta o programa, como em todo Mac: o Histórico, que no Windows é
  Ctrl+H, fica no Mac em **Control+H** (o programa aceita Ctrl e ⌘ em todos os
  atalhos). A lista de atalhos (F1) ganhou, no Mac, a parte "No Mac" e a do
  trackpad.

### O trackpad, e a roda do mouse

- `gestoDaRoda` (`src/ui/rodaDoMouse.ts`): com Ctrl ou ⌘ — e a pinça, que o
  sistema manda como roda com Ctrl —, zoom proporcional ao gesto, no máximo
  um "dente" (15%) por evento. **No Mac**, a rolagem com dois dedos (ou a
  roda) move a vista. **No Windows**, a roda continua sendo o zoom de 15%, e
  a rolagem só de lado (a roda inclinada) passa a mover a vista (antes
  afastava). A pinça do touchpad do Windows também ficou suave.

### A abertura no Mac

- O modo padrão desenha pela placa de vídeo no Mac (`opcoesDoModo(modo,
  plataforma)`); os modos de compatibilidade são os mesmos.
- A caixa "Abrindo o Enfesto CAD…" não aparece no Mac (só fica no
  diagnóstico): presa ao processo principal, ela pararia a abertura.
- Fechada a janela, o programa sai, no Mac também (antes ficava rodando sem
  janela, e reabri-la pelo Dock refaria a abertura inteira).
- O diagnóstico e a caixa de quando a tela não aparece dizem o sistema
  ("macOS (Darwin …)" ou "Windows …").

## O que NÃO foi feito

- **Ninguém abriu o programa num Mac de verdade ainda.** A conferência é a do
  Mac do GitHub: os testes, a abertura do programa montado e a foto da tela.
  O primeiro uso num Mac de pessoa pode mostrar o que esse teste não vê (o
  aviso do Gatekeeper, a sensação do trackpad).
- **Sem assinatura nem notarização da Apple**: o aviso da primeira abertura
  continua; ele some só com a conta de desenvolvedor da Apple.
- **Não roda em macOS 11 (Big Sur) ou mais antigo**: o Electron 44 pede o 12.
- O ícone continua o padrão do Electron, no Mac e no Windows.
- O instalador do Windows continua sendo montado neste computador, à mão.

## Verificação

- **Testes:** 2213 em 102 arquivos (eram 2199 em 99); tipos e lint limpos.
  Novos: o modo padrão por plataforma; o menu Editar (as ações, o destino:
  texto, programa ou nenhum); o gesto da roda no Windows e no Mac; a lista de
  atalhos com e sem a parte do Mac.
- **No Windows, com o programa gerado:** o modo de teste de abertura saiu
  com "ABERTURA-OK modo=padrao conferida=true" e gravou a foto da tela (numa
  pasta de dados à parte; o diagnóstico real sem linhas novas); a roda do
  mouse no desenho: um dente aproxima 15% e volta, a rolagem de lado move a
  vista sem mudar o zoom, a pinça (Ctrl, passo pequeno) aproxima pouco; o
  roteiro dos fluxos (ADR 0084), 72 conferências, 0 falhas.
- **No Mac:** a execução do `mac.yml` depois do envio — os testes, a
  montagem e a abertura do programa montado, com a foto.
