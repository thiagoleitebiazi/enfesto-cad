# ADR 0216 — O laboratório de validação

Desde o ADR 0148, o programa não tinha sido aberto, e nada do que vai para uma máquina tinha sido lido por outra coisa que não o próprio programa. Os testes unitários não alcançam o bundle de produção, o cálculo em segundo plano, o processo principal, as portas nem a tela.

**Decisão:** `npm run validar` (`scripts/validacao/main.cjs`) usa o programa gerado, com o mouse e o teclado, em dados descartáveis, e confere:

- **O plotter virtual** (`plotter-virtual.cjs`) ouve numa porta e interpreta o que chega como a máquina faria, com regras próprias, sem nada do programa; o G-code passa por um leitor de terceiros (gcode-parser), e o DXF e o ASTM por outro (dxf-parser). Cada peça tem de sair no lugar e no tamanho, a menos de 0,05 mm.
- **O caminho inteiro de cada função nova:** envolvente, grupo, blocos na vertical, tecido ativo, envio, falha e volta do plotter, níveis, ISO pela porta, portas inválidas, teste do equipamento, fonte TrueType, teclado, janelas, colaboração com outra pessoa do outro lado e a vitrine num navegador real, com o código minificado de produção.
- **A tela, sem olhar:** todo texto visível de cada esquema de cores é medido contra o fundo que está atrás dele, abaixo de 3:1 é falha. Cada botão e item de menu é clicado, com uma peça selecionada, e nada pode quebrar a tela nem sujar o console.

O servidor de colaboração ouve só neste computador durante a validação. Nenhuma foto é tirada: o resultado é um registro de texto.

**O que ele achou, e foi corrigido:**

- Com níveis de impressão, o cabeçalho, as emendas e as linhas saíam depois do corte: tinta em papel já cortado. Agora saem com os nomes.
- Janelas lado a lado se sobrepunham em telas de 1280, por causa da largura mínima, e o Windows podia ignorar o arranjo logo depois de sair do maximizado.
- A validação acusava "a 3,0 mm, abaixo do mínimo de 3 mm" em peças giradas: erro de arredondamento dava um erro falso. Agora há folga de 0,001 mm.
- O tema escuro estava ilegível: rótulos da barra com contraste de 1,1, títulos azuis sobre fundo escuro e a peça selecionada branca sobre azul-claro. As superfícies agora seguem o esquema, e os tons de azul e de aviso têm versão escura. As folhas de desenho continuam brancas, como papel.
- A roda do mouse tentava segurar o evento num ouvinte passivo: não valia, e a pinça do trackpad daria zoom na página inteira.
- "Criar arquivos de encaixe" pôs as peças fora da área útil: o risco nasce encostado na borda, e o projeto tem a margem de segurança de 4 mm. Só um risco gerado de verdade mostrou isso. Agora as peças andam juntas até a margem, menos no sentido da dobra, e a mesa acompanha.
- Fora do Windows, `\\servidor\plotter` criaria um arquivo comum com esse nome. Agora é recusado com a explicação.

Os ajustes no teste de uso (`scripts/teste-de-uso`): a lista de botões da tela de início, a espera pelo serviço de IA e a resposta à pergunta de peças sobrepostas. Três falhas dele eram do próprio teste, e uma só apareceu quando a pasta de saída foi limpa: um arquivo antigo passava pelo novo.

**O que continua sem validar:**

- Máquina de verdade: é para isso o teste do equipamento (ADR 0217).
- O servidor de colaboração entre dois computadores: só neste, com outro cliente do outro lado.
- A IA: só com um serviço de mentira, até haver a chave.
- As leituras minhas do manual (Discreto, Proporcional, relacionamento, transpasse, sugestão do método): só com quem tem o programa de referência.
- O que minimizou a janela principal em algumas rodadas do laboratório não foi descoberto: nada no programa minimiza janelas. Foi isso que fez "lado a lado" falhar de vez em quando: a janela minimizada ficava de fora do arranjo. Agora ela volta e entra no arranjo, e o programa ainda confere onde cada janela ficou.
- O contraste mede a cor, não a composição: a tela segue sem ser vista por uma pessoa.

Conferência: `npm run validar` e o teste de uso completo, em dados descartáveis, mais os testes unitários, `npx eslint` e `npx tsc -b --noEmit`.
