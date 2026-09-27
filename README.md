# Enfesto CAD

CAD industrial de enfesto têxtil, encaixe (nesting) e preparação para corte —
aplicação desktop para Windows. Projeto novo, começado do zero (ver
[ADR/0001-projeto-novo-e-arquitetura.md](ADR/0001-projeto-novo-e-arquitetura.md)
para o histórico da decisão e o estado real de cada funcionalidade).

## Status

Etapas 1 e 2 do plano (arquitetura + interface CAD funcional) em andamento.
Veja [TODO.md](TODO.md) para o que já funciona de verdade e o que ainda está
pendente — nenhum botão da interface finge fazer algo que não faz: os que
ainda não têm lógica por trás aparecem desabilitados com uma explicação.

## Instalar

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
(`dist-electron/`). Empacotamento como instalador Windows (`.exe`/MSI) ainda
não está configurado — é a Etapa 10 do plano.

## Estrutura

```
electron/     processo principal e preload do Electron
src/core/     geometria pura (pontos, contornos, transformações), em mm
src/domain/   entidades de domínio (Molde, restrições de rotação/fio)
src/ui/       interface React (canvas, réguas, painéis, barra de ferramentas)
ADR/          decisões de arquitetura registradas
```

`nesting/`, `formats/` (DXF/PDF) e `persistence/` (biblioteca de projetos)
ainda não existem — serão criados nas próximas etapas do plano.
