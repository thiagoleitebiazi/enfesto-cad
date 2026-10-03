# Enfesto CAD

CAD industrial de enfesto têxtil, encaixe (nesting) e preparação para corte —
aplicação desktop para Windows. Projeto novo, começado do zero (ver
[ADR/0001-projeto-novo-e-arquitetura.md](ADR/0001-projeto-novo-e-arquitetura.md)
para o histórico da decisão e o estado real de cada funcionalidade).

## Status

As 10 etapas do plano original estão completas (ver [TODO.md](TODO.md) para
o detalhe de cada uma e as limitações conhecidas de cada funcionalidade —
nenhum botão da interface finge fazer algo que não faz: os que ainda não têm
lógica por trás aparecem desabilitados com uma explicação).

## Baixar e instalar (usuário final, Windows)

Instalador pronto (não precisa de Node/npm) na
[página de releases](https://github.com/thiagoleitebiazi/enfesto-cad/releases/tag/v0.1.0):
**[Enfesto CAD Setup 0.1.0.exe](https://github.com/thiagoleitebiazi/enfesto-cad/releases/download/v0.1.0/Enfesto.CAD.Setup.0.1.0.exe)**
— Windows 10/11, 64 bits.

**O Windows vai mostrar um aviso "O Windows protegeu o computador" ao abrir
o instalador.** Isso acontece porque o instalador ainda não tem uma
assinatura digital de um certificado reconhecido pela Microsoft (certificado
de code signing pago, não configurado neste projeto ainda) — é o motivo mais
comum de alguém concluir que "o programa não abre" em outro computador.
Para instalar mesmo assim: clique em **"Mais informações"** e depois em
**"Executar assim mesmo"**. O arquivo é seguro — o código-fonte completo
deste repositório é público e pode ser auditado.

Se o instalador abrir mas o próprio aplicativo não iniciar depois de
instalado, o motivo mais provável é a falta do **Microsoft Visual C++
Redistributable** no computador (um componente comum do Windows, exigido
por muitos programas, nem sempre pré-instalado em máquinas novas/limpas):
baixe e instale o
[vc_redist.x64.exe oficial da Microsoft](https://aka.ms/vs/17/release/vc_redist.x64.exe)
e tente abrir o Enfesto CAD de novo.

## Instalar para desenvolvimento

Pré-requisitos: Node.js 20+ e npm.

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm run dev
```

Abre a janela Electron com recarregamento automático do renderer (Vite) e
do processo principal.

## Testes

```bash
npm test          # roda a suíte uma vez
npm run test:watch
```

## Verificação de tipos e lint

```bash
npm run typecheck
npm run lint
```

## Build de produção

```bash
npm run build
```

Gera os bundles do renderer (`dist/`) e do processo principal/preload
(`dist-electron/`). Para gerar o instalador Windows a partir disso:

```bash
npm run package:win
```

Produz `release/Enfesto CAD Setup 0.1.0.exe` (NSIS) via `electron-builder` —
**sem assinatura digital** (ver aviso na seção "Baixar e instalar" acima).

## Estrutura

```
electron/       processo principal (IPC, diálogos de arquivo, persistência
                 de projetos em disco) e preload do Electron
src/core/       geometria pura (pontos, contornos, transformações), em mm
src/domain/     entidades de domínio (Molde, Enfesto, Tecido, nesting,
                 relatórios, restrições de rotação/fio)
src/formats/    importação/exportação de DXF e PDF
src/ui/         interface React (canvas, réguas, painéis, barra de
                 ferramentas em abas)
ADR/            decisões de arquitetura registradas
```
