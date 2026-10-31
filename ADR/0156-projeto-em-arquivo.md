# ADR 0156 — O projeto num arquivo

A apostila da referência tem Importar e Exportar de arquivos do modelo. No Enfesto CAD, um projeto só saía do computador pela pasta da rede.

**Decisão:** Arquivo › "Exportar projeto" salva o projeto inteiro num arquivo `.enfesto`, com o que ainda não foi salvo. "Importar projeto" o abre e o põe na biblioteca. Se ela já tem um projeto de mesmo id, ele entra como outro (id e código novos, "(importado)" no nome): importar nunca troca o que está lá. O arquivo quebrado, ou de uma versão mais nova, é recusado com o motivo.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
