# ADR 0169 — A senha no projeto exportado

O manual da referência tem "Senha" nas informações do modelo.

**Decisão:** "Exportar projeto" aceita uma senha. O arquivo sai cifrado (AES-GCM, chave por PBKDF2 com 200 mil voltas) e "Importar projeto" pede a senha. A senha errada é recusada, e nada entra.

**Limites:** quem perde a senha perde o arquivo. A proteção vale para o arquivo exportado, não para o projeto já aberto ou guardado na biblioteca. O campo mostra a senha ao digitar.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
