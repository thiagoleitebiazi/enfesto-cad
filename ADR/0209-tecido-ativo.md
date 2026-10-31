# ADR 0209 — O tecido ativo: um encaixe por tecido

Antes, os tecidos do modelo dividiam uma mesa só. O encaixe de um tecido mandava os outros para fora da mesa, e as saídas levavam tudo junto. Na referência, cada tecido tem o seu encaixe.

**Decisão:** quando há mais de um tecido, a barra acima da mesa ganha uma aba por tecido, mais "Todos". Com um tecido ativo:

- a mesa, a lista de peças, a validação, a barra de status e o status do encaixe veem só as peças dele;
- o PLT, o PDF, o ISO, o DXF, o SVG e o XML saem só com as peças dele;
- o encaixe automático calcula só ele, e os outros tecidos ficam onde estão, no encaixe deles;
- arrastar, encostar, compactar e trazer para a mesa não esbarram nas peças dos outros tecidos;
- o botão "Largura" dá a largura própria do tecido, guardada no enfesto (`largurasPorTecido`).

"Todos" é a tela de antes: uma mesa só, com a validação acusando as peças de tecidos diferentes que estejam uma sobre a outra.

**Limites:** a escolha da aba não fica guardada no projeto: ao abrir, volta para "Todos". O comprimento da mesa, as emendas e os textos do risco são os mesmos para todos os tecidos; só a largura muda. O ASTM e os moldes individuais seguem saindo com todas as peças do projeto, porque são a modelagem, não o encaixe. O PDF de impressão digital também.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários), então as abas nunca foram vistas na tela.
