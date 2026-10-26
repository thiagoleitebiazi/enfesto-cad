# ADR 0147 — O servidor de encaixes (uma máquina só para calcular)

## Contexto

A referência tem um servidor de encaixes: uma máquina dedicada que recebe os encaixes de várias estações e calcula o
dia inteiro. A fila na rede (ADR 0143) já fazia isso por uma pasta compartilhada, mas a estação que atendia era uma
estação de trabalho comum: alguém com o Enfesto CAD aberto e "Atender a fila da rede" marcado. O estudo marcou o que
faltava: "a máquina que calcula precisa estar com o programa aberto".

## Decisão

**1. O modo servidor:** o Enfesto CAD aberto com `--servidor-de-encaixes` no fim do destino do atalho
(`OPCAO_DO_SERVIDOR_DE_ENCAIXES`).
- **A janela:** pequena, de 720 × 560, com o título "Enfesto CAD — servidor de encaixes".
- **O que ela mostra** (`ui/ServidorDeEncaixes.tsx`, escolhido em `main.tsx` pela página `?modo=servidor`), sem o
  desenho:
  - se está atendendo (verde) ou se falta a pasta;
  - a pasta e o nome da estação;
  - quantos encaixes calculou desde que abriu;
  - os pedidos na fila dele, com o progresso;
  - o último recado ("Devolvido a Estação 1: “Saia” (calculado)").
- **Como ele atende:**
  - sempre (`useFilaNaRede`, opção `atenderSempre`), um pedido de cada vez, pela mesma fila e o mesmo cálculo em
    segundo plano da fila local;
  - a fila dele fica num arquivo à parte, `fila-do-servidor.json`, e não se mistura com a de quem desenha;
  - a proteção contra a tela preta continua valendo: ao reabrir o programa, a opção do servidor vai junto.
- **"Abrir este servidor ao entrar no Windows":** põe o programa, com a opção, na lista do que o Windows abre ao entrar
  (`app.setLoginItemSettings`). Só aparece no Windows; no Mac, essa lista não leva a opção.

**2. O aviso na fila:** a caixa "Fila na rede" das estações diz como deixar uma máquina só para calcular.

## O que não foi feito

- **Um serviço do sistema** que calcula sem ninguém entrar no Windows: o servidor abre ao entrar, não ao ligar a
  máquina.
- **O servidor e a tela de trabalho ao mesmo tempo no mesmo computador:** o programa abre uma vez só. Nesse caso, a
  própria estação marca "Atender a fila da rede".
- **O teste da caixa do Windows no teste de uso:** marcar a caixa mudaria a lista do Windows deste computador. Ela é
  conferida no teste da tela, com a lista de mentira.

## Conferência

- `ui/ServidorDeEncaixes.test.tsx` (3 testes):
  - **O atendimento:** com uma pasta de mentira e um cálculo de mentira, o servidor atende sempre. Ele pega o pedido,
    calcula, devolve o resultado com o nome da estação e conta "1". A fila dele fica num arquivo à parte e sai vazia.
  - **A caixa do Windows:** mostra o que o sistema diz e muda pelo programa.
  - **O sistema que não deixa:** sem a caixa.
- `ui/useFilaNaRede.test.ts`: os testes da fila na rede continuam passando.
- `npx vitest run`: 189 arquivos, 3136 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- **O programa gerado, aberto de verdade com `--servidor-de-encaixes`** (com dados descartáveis): a página do servidor,
  o título "Enfesto CAD — servidor de encaixes" e a janela de 720 × 560. Essa abertura achou dois problemas, já
  corrigidos:
  - a janela era maximizada, como a de trabalho;
  - o título da página cobria o da janela.

  O cabeçalho, que estava claro demais para o texto branco, passou para o azul escuro do topo das janelas.
- O teste de uso, no programa gerado: 125 conferências, nenhuma falha.
  - **A sequência:** uma segunda janela, na página do modo servidor e com a pasta da fila da rede do passo 5c, fica
    "Atendendo a fila da rede". A janela principal, que não atende, manda um encaixe para a rede. O servidor o pega,
    calcula e devolve.
  - **O resultado:** o encaixe termina na principal "Concluído · calculado por Servidor de teste na rede", o servidor
    conta "1", e a fila dele foi gravada em `fila-do-servidor.json`.
