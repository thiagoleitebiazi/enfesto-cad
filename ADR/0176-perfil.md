# ADR 0176 — O perfil

O manual da referência tem "Salvar perfil", "Carregar perfil" e "Restaurar padrões".

**Decisão:** no menu Opções, "Salvar perfil" grava num arquivo as preferências deste computador (favoritos, teclas, cores, canetas, nome na rede, ajustes da mesa). "Carregar perfil" as traz, e "Restaurar padrões" as tira, com confirmação. Os projetos não mudam.

**Limite:** carregar e restaurar valem ao abrir o programa de novo: recarregar sozinho perderia o que não foi salvo.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
