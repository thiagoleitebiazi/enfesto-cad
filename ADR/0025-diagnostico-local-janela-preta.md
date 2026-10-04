# ADR 0025 — Diagnóstico local para janela preta em outras máquinas

## Contexto

O instalador publicado (SHA256 `ddd918ed…`, igual ao build local — o
usuário recebeu o arquivo correto) foi instalado em outro computador e a
janela abriu com conteúdo totalmente preto. O título da janela continuou
"enfesto-cad" (nome do `package.json`), e não "Enfesto CAD" (o `<title>`
de `index.html`): a página não chegou a ser interpretada.

A correção do ADR 0024 (`app.disableHardwareAcceleration()`) não resolveu
o caso nessa máquina. Sem acesso ao computador do usuário e sem conseguir
reproduzir o problema aqui (esta máquina renderiza corretamente em todas
as verificações), qualquer nova correção seria um palpite.

## Decisão

Em vez de publicar outro palpite, o app passa a gravar um diagnóstico
local em `<userData>/diagnostico.log` (no Windows, normalmente
`%APPDATA%\Enfesto CAD\diagnostico.log`), com:

- versão, plataforma, arquitetura e caminho do executável no início;
- `app.getGPUFeatureStatus()` — mostra se a GPU/compositor foi realmente
  desligado e o estado de cada recurso gráfico nessa máquina;
- `did-finish-load` (a página carregou) ou `did-fail-load` (código e URL
  da falha);
- `render-process-gone` (o processo de renderização morreu, com motivo);
- erros de console da página (`console-message` de nível `error`).

O arquivo fica só na máquina da pessoa; ela decide se envia. Nada é
enviado automaticamente. Falha ao gravar nunca derruba o app.

## Como interpretar quando o usuário enviar o arquivo

- Tem `did-finish-load` e a UI não aparece → o problema está no
  compositor/renderização, não no carregamento do HTML.
- Não tem `did-finish-load` e tem `did-fail-load` → o HTML/assets não
  carregaram; o código e a URL dizem exatamente o que faltou.
- Tem `render-process-gone` → o processo de renderização morreu (ex.:
  antivírus, sandbox); o motivo indica a causa.
- Não tem nenhuma linha além de `inicio` → a página nunca começou a
  carregar; investigar o processo principal/instalação.

## O que NÃO foi feito

- Nenhuma nova mudança de comportamento para tentar corrigir às cegas.
  A correção só deve sair depois que o diagnóstico mostrar a causa.
- Não foi verificado na máquina do usuário. Esta versão ainda **não está
  publicada**; o diagnóstico só chega à pessoa depois de uma nova
  publicação (decisão pendente do usuário).

## Verificação

- `npm run typecheck`/`lint`/`test` (256/256) limpos; build de produção ok.
- Execução real do Electron nesta máquina: `diagnostico.log` criado com
  versão, GPU em modo software, `did-finish-load`, e a UI (ribbon)
  presente — prova de que a gravação não quebra o carregamento normal.
- Corrigido aviso de API antiga (`console-message` com argumentos
  posicionais, deprecated no Electron 44) para a forma com objeto de evento.
