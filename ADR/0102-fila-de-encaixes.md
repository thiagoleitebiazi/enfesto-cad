# ADR 0102 — A fila de encaixes em segundo plano

## Contexto

Fase 1 do estudo de funcionalidades (ADR 0099). A referência tem um servidor de encaixes: as estações mandam
vários encaixes, que são calculados um atrás do outro, com prioridade, pausa, reordenação e um relatório de
eficiência. Aqui só havia o Nesting automático: um cálculo por vez, com a janela aberta esperando o fim.

O servidor que recebe de várias estações, 24 h, precisa de uma máquina na rede (fica de fora — ver o estudo). O
que cabe nesta estação é a fila local: vários encaixes esperando a vez, calculados enquanto a pessoa continua
trabalhando.

## Decisão

- **Pôr na fila:** a janela do Nesting automático ganha o botão "Pôr na fila" ao lado de "Calcular encaixe". O
  trabalho guarda as peças e a mesa como estão naquela hora (já com os tamanhos e as simetrias abertas, se pedido),
  as opções (método, limite de tempo, meta de aproveitamento, tecido de sentido único) e uma marca das peças do
  projeto. A janela fecha e um aviso diz onde acompanhar. A distância entre os moldes pedida passa a ser a do
  enfesto, como no calcular.
- **Quem roda:** `ui/useFilaDeEncaixes.ts`, desde a abertura do programa. Um trabalho de cada vez, no mesmo Web
  Worker do Nesting automático (a tela não trava), o próximo pela prioridade (alta, normal, baixa) e pela vez dentro
  dela. Concluído, o resultado fica guardado e começa o próximo.
- **Encaixe › Fila de encaixes** (e o selo na barra de status) abre a janela:
  - a faixa "Fila rodando / livre / pausada", com **Pausar a fila** (o que está calculando vai até o fim; nenhum
    novo começa), **Limpar os terminados** e **Exportar CSV**;
  - a lista: o que calcula (com a barra de progresso), os da vez numerados, os terminados; para cada um, o projeto,
    as opções, a situação, a **prioridade** (muda a vez), **subir/descer** (dentro da mesma prioridade),
    **Pausar/Retomar**, **Cancelar**, **Pôr de novo na fila** (o que falhou ou foi cancelado) e **Remover**;
  - o resultado: aproveitamento, comprimento, peças postas e de fora, tempo, e a **estrela** no melhor encaixe de um
    projeto com mais de um concluído (primeiro o que pôs todas as peças, depois o de maior aproveitamento, depois o
    mais curto);
  - **Aplicar no projeto** (o de origem, aberto) troca as peças pelas do encaixe, como o Aplicar do Nesting (Ctrl+Z
    desfaz), e registra no histórico. Antes, pergunta se o projeto aberto não é o de origem, se as peças mudaram
    depois que o encaixe entrou na fila ou se a mesa não é a mesma. **Abrir o projeto** abre o de origem, quando ele
    está na Biblioteca;
  - **Relatório de eficiência:** concluídos, com peças de fora, com falha, aproveitamento médio e melhor, comprimento
    somado e tempo de cálculo (total e médio). O CSV traz todos os encaixes (ponto e vírgula, vírgula decimal).
- **Barra de status:** o selo "Fila: 1 calculando · 2 aguardando · 1 pronto(s) para aplicar" (laranja calculando,
  azul esperando, verde com resultado para aplicar) aparece quando há algo na fila e abre a janela.
- **No disco:** `<userData>/fila-de-encaixes.json`, gravado a cada mudança como o cadastro de produção (a versão
  anterior ao lado para recuperar; o arquivo ilegível vai para as cópias de segurança na primeira gravação; o de
  versão mais nova aparece e não é gravado). Até 100 encaixes na fila.
- **Pausar no meio e fechar no meio:** pausar um encaixe que está calculando para o cálculo; retomado, ele recomeça
  do início (a tela diz). O mesmo para o programa fechado no meio: ao abrir, o encaixe volta para a vez e recomeça.
- Os relatórios em CSV passam a usar o mesmo `core/csv.ts` (a sala de corte também).
- Junto: aplicar um encaixe (do Nesting ou da fila) desmarca as peças da lista. As peças do encaixe são outras, e a
  barra de status contava "Seleção: 2 peças" sem nenhuma marcada.

## O que não foi feito

- A fila roda só com o programa aberto, nesta estação. Receber encaixes de outras estações e rodar 24 h exige um
  servidor na rede.
- Um cálculo de cada vez: dois ao mesmo tempo dividiriam o processador e cada um levaria o dobro.
- Pausar no meio não guarda o cálculo parcial: ele recomeça.

## Conferência

- `domain/filaDeEncaixes.test.ts` (20): a vez (prioridade e ordem), um de cada vez, a fila pausada, a fila cheia,
  subir/descer, pausar, retomar, cancelar, pôr de novo, falhar, o programa fechado no meio, remover e limpar, aplicar,
  o melhor de cada projeto, o relatório, as opções em palavras, o CSV, o arquivo (ida e volta, os quebrados de fora,
  a versão mais nova) e o trabalho guardado calculando o mesmo encaixe das peças de origem.
- `ui/useFilaDeEncaixes.test.ts` (8), com um Worker de mentira: lê e começa o primeiro (mandando peças, mesa e
  opções), conclui e passa ao próximo, o erro, pausar e cancelar o que calcula (a resposta atrasada não conta), a
  fila pausada, o interrompido ao abrir, o arquivo quebrado e o de versão mais nova, e a recusa da mudança.
- `ui/PainelDaFilaDeEncaixes.test.tsx` (9), `ui/PainelDeNesting.test.tsx` (Pôr na fila), `ui/BarraDeStatus.test.tsx`
  (o selo), `ui/BarraDeFerramentas.test.tsx` (o botão).
- `npx vitest run`: 140 arquivos, 2702 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows): dois encaixes postos na fila (busca em grade e
  pontos de canto), a barra de status avisando os 2 prontos, a fila com os 2 concluídos e a estrela no melhor,
  aplicar (validação sem problemas, nenhuma peça marcada), a fila gravada com o aplicado marcado — 25 conferências,
  nenhuma falha.
- O programa gerado com uma pasta de dados em que um encaixe ficou "calculando" (fechado no meio): ele recomeçou e
  terminou, com o recomeço contado, e a versão anterior da fila ficou ao lado. Com o arquivo da fila quebrado: o
  programa abre, a fila diz que estava quebrado e começa vazia, e na primeira gravação o arquivo quebrado foi para
  `copias-de-seguranca/`.
