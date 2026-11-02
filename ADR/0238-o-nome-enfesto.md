# ADR 0238 — O nome do programa: Enfesto

## Contexto

Quem usa o programa pediu que ele se chame só **Enfesto**, e não mais Enfesto CAD, antes da publicação.

## Decisão

O nome mudou em tudo o que se vê:

- a barra do programa, o título da janela e o "Sobre";
- as mensagens e as janelas de abrir e salvar;
- o PDF, o cabeçalho do ISO e o do RUL;
- o instalador do Windows (`Enfesto Setup 0.1.0.exe`) e o do Mac (`Enfesto-0.1.0-mac.dmg`, com o `Enfesto.app`);
- o README e os documentos de trabalho.

Os ADRs ficam como foram escritos: são o registro de cada época.

O que não muda:

- **A pasta de dados.** Continua `%APPDATA%\enfesto-cad`, com os projetos, as preferências e o diagnóstico. O Electron dá a pasta pelo nome do programa, e um nome novo poderia esconder os projetos de quem já usa; `electron/pastaDeDados.ts` a fixa. A pasta escolhida por quem abre (`--user-data-dir`) e a dos testes ficam como estão, para um teste nunca cair nos dados de verdade.
- **A identidade do instalador** (`com.enfestocad.app`), para o novo substituir o antigo.
- **Os formatos.** O perfil e o projeto em arquivo usam chaves próprias, e os arquivos de antes abrem igual.
- **O repositório e as variáveis de ambiente** (`ENFESTO_CAD_…`), que são internos.

## O que não foi feito

- A troca por cima de uma instalação antiga não foi experimentada aqui: o programa instalado neste computador é de quem usa, e não foi tocado. O instalador novo tem a mesma identidade do antigo, para substituí-lo, mas o atalho e a pasta do programa podem ficar com o nome antigo até a primeira desinstalação.
- No Mac, o `Enfesto.app` novo fica ao lado do `Enfesto CAD.app` antigo na pasta Aplicativos; o antigo se apaga à mão.
