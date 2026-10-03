# ADR 0024 — Desliga aceleração por GPU (tela preta em outro computador)

## Contexto

Usuário instalou o `.exe` publicado em um segundo computador e reportou
uma captura de tela real: a janela do Enfesto CAD abre (título da barra
ainda mostrando "enfesto-cad", o nome padrão do `package.json`, não
"Enfesto CAD" do `<title>` de `index.html`), mas o conteúdo inteiro
aparece **preto sólido** — nem o fundo cinza-claro padrão da aplicação,
nem nenhum elemento da interface.

Título nunca atualizado para o valor do `<title>` da página é a pista
decisiva: o Electron atualiza o título da janela assim que o HTML é
interpretado (evento `page-title-updated`, um dos primeiros passos do
carregamento de uma página). Como isso nunca aconteceu, a página não
chegou nem a ser pintada — não é um problema de CSS/JS que falhou depois
de carregar (que normalmente ainda mostraria um fundo branco/claro
padrão do Chromium), é o compositor do processo de renderização falhando
completamente antes de desenhar qualquer coisa. Essa é a assinatura
clássica de incompatibilidade de aceleração por GPU no Electron/Chromium
— comum em computadores com driver de vídeo desatualizado/incompatível,
GPU virtualizada (máquina virtual) ou sessões de área de trabalho
remota, nenhuma delas reproduzível a partir desta máquina de
desenvolvimento.

## Decisão

`electron/main.ts`: chamada a `app.disableHardwareAcceleration()` logo
no topo do arquivo, antes de qualquer outro uso de `app`/`BrowserWindow`
(precisa ser antes de `app.whenReady()` para ter efeito — é a
recomendação oficial do próprio Electron para este sintoma exato).
Força o Chromium a desenhar via software em vez de depender da GPU do
sistema — mais lento para conteúdo pesado (vídeo, WebGL, animações
complexas), mas esta aplicação é inteiramente 2D (Canvas, sem WebGL/3D),
então o custo real é baixo frente ao ganho de compatibilidade.

## O que NÃO foi feito, e por quê

- **Não foi possível reproduzir o problema nesta máquina** — a máquina
  de desenvolvimento sempre renderizou corretamente em todas as
  verificações deste projeto (muitas capturas de tela reais ao longo de
  toda a sessão). A causa raiz (driver de vídeo específico, virtualização
  ou RDP na máquina do usuário) é inerentemente externa a este ambiente.
  A correção aplicada é a mitigação padrão e amplamente documentada para
  esta classe de problema, não uma reprodução-e-correção direta.
- **Não foi adicionada nenhuma flag adicional de linha de comando do
  Chromium** (`--disable-gpu`, `--disable-software-rasterizer` etc.) —
  `disableHardwareAcceleration()` já cobre o caso de forma mais segura e
  é a API oficial recomendada; empilhar flags experimentais sem um caso
  concreto que as exija seria risco sem benefício comprovado.

## Verificação

- `npm run typecheck`/`lint`/`test` (256/256) limpos — mudança de uma
  linha no processo principal, sem lógica nova para testar via Vitest
  (processo principal do Electron não é coberto pela suíte de testes,
  mesma limitação de sempre).
- Build de produção + execução em Electron real nesta máquina: título da
  janela confirmado como "Enfesto CAD" (prova de que a página carregou e
  pintou normalmente), captura de tela idêntica à de antes da mudança —
  nenhuma regressão visual aqui, exatamente o esperado (esta máquina já
  funcionava; o objetivo é ampliar compatibilidade para máquinas que não
  funcionavam, não mudar nada aqui).
- **Não verificado na máquina que relatou o problema** — ainda não há
  confirmação de que o usuário reinstalou a versão corrigida. Reportar
  como resolvido só depois dessa confirmação real, não antes.

## Consequências

- `electron/main.ts`: `app.disableHardwareAcceleration()` afeta a
  aplicação inteira (processo principal, todas as janelas) — não há
  caminho de código que dependa de GPU em nenhum outro lugar do app.
- Instalador precisa ser reconstruído e republicado para que a correção
  chegue a quem já baixou a versão anterior.
