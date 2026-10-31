# ADR 0214 — O servidor de colaboração

A nuvem da referência é um serviço na internet dela, e não há como ligar o programa a ele. O que dá para fazer é o que ela oferece, num servidor da própria empresa: projeto compartilhado, várias pessoas no mesmo modelo, comentários e aprovação à distância.

**Decisão:** o botão "Colaboração" abre um painel com duas coisas.

- **Este computador como servidor:** a pedido, liga um servidor HTTP na porta escolhida, gera uma chave e mostra o endereço e a chave para passar aos outros. Ele guarda em `<userData>/colaboracao` as últimas 50 versões de cada projeto, os comentários e a aprovação. Não liga sozinho ao abrir o programa.
- **Ligar a um servidor:** com o endereço, a chave e o nome, a pessoa envia o projeto aberto, atualiza com o servidor, baixa outros projetos para a biblioteca, vê quem está no projeto, comenta e aprova ou reprova.

**Mudanças de duas pessoas:** o servidor recusa a versão que não parte da última e devolve a última. O programa de quem enviou compara as duas com a versão de onde partiram e junta peça por peça. Peças diferentes se somam. Se as duas pessoas mudaram a mesma peça de jeitos diferentes, fica a do servidor, e o programa diz qual. Nada é gravado por cima sem essa comparação.

**A aprovação** é da versão: enviar uma versão nova apaga a aprovação da anterior.

**Segurança:** todo pedido precisa da chave, comparada em tempo constante. O id do projeto vira nome de pasta e só aceita letras, números, hífen e sublinhado. As chaves ficam cifradas pelo cofre do sistema, no processo principal; a interface só diz o método e o caminho, e só os caminhos do servidor saem. A chave do servidor aparece na tela de quem o ligou, porque é preciso passá-la aos outros.

**Limites:**

- Não é a nuvem da referência, nem substitui uma: o servidor é um computador da empresa, que precisa estar ligado. Nenhum dado sai para a internet por conta do programa.
- A conexão não é cifrada. Para usar fora da rede da empresa, é preciso pôr um proxy com HTTPS na frente, e isso não foi feito nem testado.
- Há uma chave só: não há usuários, permissões nem registro de quem é quem. O nome é o que a pessoa digitou, e a aprovação não é uma assinatura.
- A união é peça por peça: duas pessoas mudando pontos diferentes da mesma peça dá conflito.
- Vai o projeto como está agora, sem o histórico. Comentar não aponta uma peça na tela, embora o servidor aceite.
- O servidor não recebe atualização em tempo real: o painel olha a cada 20 segundos, e só enquanto está aberto.

Conferência: testes unitários, com o servidor de verdade numa porta local: chave, versões, envios ao mesmo tempo, comentários, aprovação, presença e pedidos inválidos. `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários), e o servidor nunca rodou entre dois computadores.
