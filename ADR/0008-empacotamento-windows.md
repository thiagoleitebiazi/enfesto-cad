# ADR 0008 — Empacotamento Windows (instalador real)

## Contexto

A Etapa 10 pede um empacotamento real para Windows — um instalador de
verdade, não só `npm run dev` funcionando na máquina de desenvolvimento.

## Decisões

1. **`electron-builder`**, não `electron-forge` nem um script manual de
   empacotamento. É o empacotador mais usado para apps Electron não
   iniciados via Forge, com suporte nativo a NSIS (instalador Windows
   completo, com desinstalador) sem infraestrutura extra.
2. **Alvo NSIS** (`win.target: ["nsis"]`), não Squirrel.Windows nem só
   `--dir` (pasta portátil). NSIS gera um instalador `.exe` de verdade —
   com desinstalador, escolha de diretório de instalação
   (`allowToChangeInstallationDirectory: true`) e sem instalação
   silenciosa automática (`oneClick: false`), o que é mais apropriado para
   um software instalado manualmente por um usuário/empresa do que uma
   atualização silenciosa estilo Squirrel (pensada para apps com
   autoatualização via servidor, que este projeto não tem).
3. **Script `electron-winstaller` (dependência do alvo Squirrel) não
   aprovado** em `allowScripts` — como o alvo usado é NSIS, o script de
   instalação nativa do Squirrel (`select-7z-arch.js`) nunca roda; não
   aprovado propositalmente para manter o princípio de menor privilégio já
   em uso neste `package.json` (nenhum script de instalação é aprovado sem
   necessidade real).
4. **Sem ícone customizado ainda** — `electron-builder` usa o ícone padrão
   do Electron (`default Electron icon is used` no log de build). Nenhuma
   identidade visual foi pedida nesta etapa; trocar depois é só apontar
   `win.icon` para um `.ico` real.
5. **Verificação real, sem instalar no sistema**: em vez de rodar o
   instalador NSIS de verdade (que gravaria no Registro do Windows/Menu
   Iniciar da máquina de desenvolvimento — uma alteração de sistema que não
   deveria acontecer sem confirmação explícita fora de uma etapa de
   empacotamento pedida), a verificação lançou diretamente o executável
   já empacotado em `release/win-unpacked/Enfesto CAD.exe` (exatamente o
   que o instalador copiaria) e confirmou uma janela real abrindo com o
   título "Enfesto CAD". Isto prova que o empacotamento produz um app
   funcional sem deixar nenhum rastro persistente no sistema operacional
   da máquina onde foi construído.
6. **Armadilha real repetida: `ELECTRON_RUN_AS_NODE=1` no ambiente do
   terminal.** A primeira tentativa de lançar o executável empacotado
   encerrou quase instantaneamente sem janela nenhuma — não por falha do
   pacote, mas porque essa variável de ambiente (usada por este terminal
   para outros fins) faz o `electron.exe` rodar como Node puro, e
   `require('electron')` sob esse modo não devolve a API real
   (`app`/`BrowserWindow`), então o processo principal falha ao
   desestruturar essas propriedades e encerra sem UI nem mensagem visível.
   Resolvido removendo a variável (`Remove-Item Env:\ELECTRON_RUN_AS_NODE`)
   antes de lançar — mesma causa raiz já registrada para sessões de
   desenvolvimento do Electron nesta sessão, agora confirmada também no
   binário empacotado.

## Risco real descoberto durante esta etapa: Electron desatualizado

Rodar `npm audit` depois de instalar `electron-builder` (a primeira vez que
a árvore de dependências completa foi auditada nesta sessão) revelou que o
próprio `electron@33.4.11` — já presente desde a Etapa 1, não introduzido
agora — está various versões principais atrás e acumula vulnerabilidades
reais conhecidas (severidade alta agregada, várias de severidade moderada
individualmente: bypass de integridade do ASAR, spoofing de IPC do service
worker, uso-após-liberação em vários callbacks, entre outras). Não existe
patch dentro da própria linha 33.x — `33.4.11` já é a última versão
publicada dela; corrigir exigiria subir pelo menos até a linha 35.7.5/
38.8.6/40.10.2 dependendo de qual CVE se quer fechar, o que é uma
atualização de versão principal (não um bump de rotina) com risco real de
mudança de comportamento/API em todo o app.

**Decisão**: não fazer esse upgrade dentro desta etapa. Empacotar e
verificar com a versão atual, e registrar o risco explicitamente (ver
MATRIZ_DE_RISCOS.md, R-10) em vez de escondê-lo ou tentar uma migração de
versão principal sem testes dedicados, no fim de uma sessão de trabalho já
longa. É uma decisão que merece atenção própria do usuário antes de ser
feita, não uma correção de rotina.

### Atualização (2026-09-28): tentativa real de correção, bloqueada por dependência de sistema ausente

Numa análise posterior pedida explicitamente pelo usuário ("resolver todos
os erros"), a atualização foi de fato tentada: `electron@^44.4.5` (a
`latest` publicada) instalada via `npm install`. O binário do Electron
falhou ao carregar com:

```
Error: Cannot find native binding. npm has a bug related to optional
dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i`
again after removing both package-lock.json and node_modules directory.
```

Uma reinstalação limpa (`node_modules` + `package-lock.json` removidos,
`npm install` do zero) reproduziu o mesmo erro — descartando a explicação
oficial do próprio pacote (bug de `optionalDependencies` do npm) como causa
real. Inspecionando a cadeia de `cause` do erro diretamente
(`e.cause.cause`, não só a mensagem de topo) revelou a causa verdadeira:
`Não foi possível encontrar o módulo especificado` ao carregar
`index.win32-x64-msvc.node` — um erro clássico do Windows (`ERROR_MOD_NOT_FOUND`)
que quase sempre significa uma DLL da qual o binário nativo depende está
faltando, não que o próprio arquivo `.node` esteja ausente ou corrompido
(ele estava presente, com tamanho plausível). Confirmado: `vcruntime140.dll`,
`vcruntime140_1.dll` e `msvcp140.dll` **não existem** em
`C:\Windows\System32` nesta máquina — o Microsoft Visual C++ Redistributable
(x64) não está instalado.

**Causa raiz real**: a partir de uma versão recente, o próprio pacote
`electron` passou a depender de `@electron-internal/extract-zip` — uma
reescrita nativa (Rust/NAPI-RS) do `extract-zip` puro-JS antigo, usada só
durante a instalação para descompactar o binário do Electron baixado — e
essa reescrita nativa exige o runtime do Visual C++ para carregar no
Windows, uma dependência que a versão antiga (JS puro) nunca teve. Isto **não
é um bug do projeto nem do processo de upgrade** — é uma dependência de
sistema genuinamente ausente nesta máquina específica, que só se manifestou
porque o upgrade tentado troca justamente o componente que a introduz.

**Decisão**: revertido para `electron@^33.4.11` (confirmado funcionando de
novo: `electron.cmd --version` executa sem erro, suíte completa de 186
testes verde) em vez de deixar o projeto num estado quebrado só para
"tentar mesmo assim". Instalar software de sistema (o VC++ Redistributable)
numa máquina de usuário sem confirmação explícita não é uma ação que este
processo deveria tomar sozinho — é uma dependência externa ausente, uma das
categorias explícitas para parar e perguntar em vez de contornar
silenciosamente. Registrado como atualização do R-10 em
MATRIZ_DE_RISCOS.md, com o link oficial da Microsoft para o instalador e os
passos exatos para retomar depois que ele estiver instalado.

`extract-zip@2.0.1` (dependência do próprio pacote `electron`, usada só
durante `npm install` para descompactar o binário do Electron baixado) tem
duas vulnerabilidades reais de severidade alta (travessia de symlink em
arquivos zip). Risco aceito como as demais dependências de build (ADR 0005):
não roda com entrada de usuário nem em produção, só durante instalação de
dependências a partir do pacote oficial `electron` no registro npm.

## Consequências

- `release/` (instalador + build desempacotado) já está no `.gitignore` —
  nunca deveria ser versionado (arquivo de ~90MB, gerado, específico da
  máquina de build).
- Nenhuma assinatura de código real (`signtool.exe` roda no processo do
  `electron-builder` mas sem certificado configurado) — o instalador vai
  gerar o aviso padrão do Windows SmartScreen para executável não
  verificado. Aceitável para uso interno/piloto; assinatura de código real
  exigiria um certificado adquirido pelo usuário, fora do escopo técnico
  desta etapa.
