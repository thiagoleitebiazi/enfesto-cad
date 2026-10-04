# ADR 0026 — Interface servida por protocolo `app://` e recuperação automática

## Contexto

O instalador publicado abriu em outro computador com a janela preta e o
título sem atualizar (ADRs 0024 e 0025). A correção de GPU não resolveu
nessa máquina, e a causa não é reproduzível aqui.

A interface era carregada com `loadFile` (`file://`). Nesse modo o
Chromium trata a página como origem opaca, e carregamentos de módulos
ES e de recursos com `crossorigin` são uma fonte conhecida de falhas
silenciosas no Electron. Além disso, quando a página falha, a janela
fica vazia sem nenhuma mensagem para o usuário.

## Decisão

1. **Protocolo próprio `app://`.** `protocol.registerSchemesAsPrivileged`
   (antes do `ready`) e `protocol.handle` (no `ready`) servem os arquivos
   de `dist/` com `content-type` correto. A página passa a ter origem
   normal, igual à de um site, e os módulos e o worker carregam pelo mesmo
   mecanismo de qualquer aplicação web.
2. **Proteção contra travessia de diretório.** O caminho pedido é
   resolvido e precisa continuar dentro de `dist/`; qualquer outro caminho
   responde 404.
3. **Vigia e recuperação.** Se `did-finish-load` não ocorrer em 20 s, ou
   se o processo de renderização morrer, a janela recarrega. Após 2
   tentativas, mostra uma caixa de erro com o caminho do
   `diagnostico.log`, em vez de ficar preta e muda.

## Verificação (Electron real, build de produção)

- Título "Enfesto CAD", URL `app://enfesto/index.html`, barra de
  ferramentas renderizada.
- Asset JS via `app://`: 200.
- `app://enfesto/%2e%2e/%2e%2e/package.json`: 404 (travessia bloqueada).
- Worker de encaixe carregado via `app://`: 200, sem erro.
- Falha forçada do processo de renderização (`forcefullyCrashRenderer`):
  `render-process-gone` registrado, recarregamento automático,
  `did-finish-load` de volta, barra de ferramentas presente.
- 256/256 testes, typecheck, lint e build limpos.

## O que NÃO foi verificado

- O caminho do **instalador** (`app.asar`) não foi executado com este
  código. Ele usa o mesmo `dist/` e `fs` com suporte a asar, mas a
  confirmação real exige gerar o instalador e testar em outra máquina.
- A caixa de erro de 2 tentativas não foi acionada de propósito.
- Não há garantia de que isso resolve a tela preta do computador
  relatado. Se a causa for outra, o `diagnostico.log` dirá qual é.

## Consequências

- `electron/main.ts`: `loadFile` substituído por `loadURL('app://…')` em
  produção; `loadURL` continua em desenvolvimento via Vite.
- A versão publicada atual (`4234596`) continua carregando por `file://`
  até esta mudança ser publicada.
