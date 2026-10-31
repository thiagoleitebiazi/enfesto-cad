# ADR 0210 — A saída direta para o plotter

O risco só saía por arquivo ou pela pasta que o programa do plotter vigia. O manual da referência tem a porta de saída, o gerenciador de impressão e os níveis de impressão do plotter que desenha e corta.

**Decisão:**

- **Porta de saída** (menu Opções): um endereço da rede local (porta 9100 se não disser), uma impressora compartilhada (`\\SERVIDOR\PLOTTER`), LPT1 ou COM1, com velocidade opcional (`COM1:9600`). Só o processo principal lê o destino, e ele só aceita essas formas: nada de arquivo comum, nada fora da rede local.
- **Gerenciador de impressão**: com a porta escolhida, "Enviar ao plotter" põe o risco numa fila. Um por vez, com subir, descer, cancelar, pausar e enviar de novo. Se um falha, a fila pausa: o plotter desligado faria os seguintes falharem também.
- **Níveis de impressão** (Ferramentas do plotter): com "Usar níveis de impressão", sai o nível menor em todas as peças, depois o seguinte. O plotter que desenha e corta faz a tinta primeiro e o corte por último.
- **DMPL**: o arquivo entra por "Importar PLT", reconhecido pelo começo `;:`, e vira HPGL como o ISO.
- **ISO**: com a porta escolhida, a janela do ISO pode enviar o arquivo direto, pela mesma fila, para a mesa de corte que recebe assim.
- **Emendas no PDF do encaixe**: a linha tracejada na largura toda, como no PLT.

**Limites:**

- Nada disso foi testado com um plotter. O envio pela rede foi testado com um servidor local de verdade, que recebeu os bytes; a impressora compartilhada, LPT e COM não foram executadas, e o comando `mode` que dá a velocidade também não.
- A fila fica na memória: fechar o programa perde o que estava esperando.
- A porta serial vale no Windows. No Mac, só a rede.
- O "tipo" do nível (desenho, corte, punção) é a caneta do elemento, que já se escolhe na mesma janela: no HPGL, o plotter só recebe o número. Nenhum comando próprio do Mutoh foi usado, por falta de documentação pública.
- O DMPL foi escrito a partir de exemplos públicos soltos, sem a especificação, e nunca leu um arquivo de plotter de verdade. As unidades EC1, EC5 e ECN são leitura minha; outro "EC" cai na unidade do EC1.
- A emenda no PDF sai sem a palavra, e o ISO segue sem ela: é um arquivo de corte.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
