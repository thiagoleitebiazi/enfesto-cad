# ADR 0143 — A fila de encaixes na rede (o servidor de encaixes sem servidor)

## Contexto

A referência tem um servidor de encaixes: as estações mandam os encaixes para uma máquina dedicada, que calcula o dia
inteiro e devolve os resultados. O estudo deixava isso de fora, porque exige servidor na rede.

No Enfesto CAD, a fila de encaixes (ADR 0102) calcula um de cada vez em segundo plano, mas só os desta estação.
As pastas compartilhadas (ADR 0141, 0142) já permitem que estações troquem arquivos por uma pasta da rede, sem
servidor.

## Decisão

**1. A pasta** (tipo `fila`) tem três subpastas:
- `pedidos`: os encaixes mandados, um arquivo por encaixe;
- `calculando`: o pedido que uma estação levou para calcular;
- `prontos`: os resultados.

**2. O protocolo** (`domain/filaNaRede.ts`):
- **Mandar:** um encaixe que espera a vez nesta estação vai para `pedidos`, com as peças, a mesa, as opções e o nome
  de quem pediu. Na fila desta estação, ele fica numa situação nova, **"Na fila da rede"**, fora da vez daqui. Ele
  não é cancelado nem removido; "Trazer de volta" o devolve à vez daqui e tira o pedido da pasta, se ninguém o levou.
- **Atender:** a estação que atende leva o pedido mais antigo de `pedidos` para `calculando`.
  - **Quem fica com o pedido:** levar o arquivo de uma pasta para a outra é a posse. Se outra estação levou antes, o
    arquivo já não está lá.
  - **Como é calculado:** o pedido entra na fila desta estação como um encaixe dela (`rede-<id>`, marcado como pedido
    da rede) e é calculado pela mesma fila de antes.
  - **Ao terminar:** o resultado, ou o erro, vai para `prontos`, e o trabalho sai desta fila.
  - **Um de cada vez:** só pega outro quando o anterior terminou, e nada com a fila pausada.
- **Receber:** quem mandou encontra o resultado em `prontos`. O encaixe termina na fila de quem mandou como
  "Concluído", com o encaixe e o nome de quem calculou, e daí em diante é aplicado como os outros.

**3. O vigia** (`ui/useFilaNaRede.ts`): com a pasta escolhida, ele olha a pasta a cada 4 segundos enquanto o programa
está aberto, mesmo com a janela da fila fechada. Em cada volta:
- recebe os resultados prontos;
- entrega os pedidos calculados aqui;
- atendendo, pega um pedido novo.

**4. A tela** (Fila de encaixes, caixa "Fila na rede"):
- **Os controles:**
  - escolher ou deixar de usar a pasta;
  - "Nome desta estação": o mesmo nome da biblioteca na rede, lembrado neste computador;
  - "Atender a fila da rede nesta estação".
- **Nas linhas:**
  - "Mandar para a rede" e "Trazer de volta";
  - o selo roxo "Na fila da rede";
  - "pedido de X pela rede" e "calculado por X na rede".
- **O pedido de outra estação** não conta como "pronto para aplicar" aqui nem oferece "Aplicar".

## O que não foi feito

- **Uma máquina sem o programa aberto** (um serviço que roda sozinho, 24 h): a estação que atende precisa estar com o
  Enfesto CAD aberto.
- **Vários pedidos ao mesmo tempo na mesma estação:** é um de cada vez, como a fila local.
- **O pedido levado por uma estação que fechou no meio** volta a ser calculado por ela ao abrir de novo, como a fila
  local. Outra estação não o assume sozinha.

## Conferência

- `domain/filaNaRede.test.ts` (5 testes):
  - mandar, trazer de volta e o que não se faz com um trabalho na rede;
  - receber concluído ou com falha, e a fila gravada lida de volta;
  - o pedido como trabalho de quem atende e o pronto, inclusive o cancelado;
  - na pasta: pegar o mais antigo, pular o levado por outra estação, apagar o que não é pedido, entregar e buscar;
  - retirar e devolver o pedido.
- `ui/useFilaNaRede.test.ts` (2 testes), com duas estações e a mesma pasta:
  - a 1 manda; a 2 atende, pega, calcula e devolve; o encaixe termina na 1 com quem calculou, e a pasta fica vazia;
  - trazer de volta antes de alguém levar.
- `npx vitest run`: 183 arquivos, 3110 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado, com esta estação mandando e atendendo: 119 conferências, nenhuma falha.
  - **A sequência:** com a fila pausada, o encaixe posto nela vai para `pedidos` e mostra "Na fila da rede" com
    "Trazer de volta". Com "Atender" ligado e a fila retomada, ele termina "Concluído · calculado por Estação de teste
    na rede".
  - **No fim:** as três subpastas ficam vazias, e nenhum pedido da rede fica na fila.
