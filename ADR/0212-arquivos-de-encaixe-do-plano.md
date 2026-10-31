# ADR 0212 — "Criar arquivos de encaixe": um projeto por risco do plano

O manual da referência cria, na ordem de corte, um arquivo de encaixe por risco. O planejamento daqui calculava os riscos e guardava só o desenho deles.

**Decisão:** o passo "Revisar" do planejamento ganha "Criar arquivos de encaixe". Cada risco vira um projeto na biblioteca, chamado "modelo - risco 1", com o tecido do projeto, a mesa do risco (largura e comprimento) e as camadas dele. As peças ficam no lugar em que o plano as pôs: o molde é girado, espelhado e deslocado como o risco registrou, e não refeito do desenho simplificado.

O risco digitado à mão não tem peças no lugar. Nele, as peças ficam fora da mesa, na grade certa, esperando o encaixe. O mesmo vale para o plano guardado antes de o deslocamento ser registrado.

**Limites:** cada clique cria projetos novos: não atualiza os da vez anterior. O projeto criado não guarda de que plano veio. A peça em par que também foi espelhada à vontade no risco não é separada da cópia do par.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
