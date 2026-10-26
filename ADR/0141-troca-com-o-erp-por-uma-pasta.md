# ADR 0141 — A troca com o ERP por uma pasta

## Contexto

A referência liga o encaixe e a sala de corte ao ERP da empresa: as ordens chegam dele, e o consumo e o estoque voltam
para ele. O estudo deixava o ERP de fora, porque ligar um pela rede exige o ERP, o endereço, a credencial e o
mapeamento dos campos. As ordens só entravam por CSV escolhido à mão.

O usuário pediu para implementar tudo. Sem servidor e sem credencial, o caminho que quase todo ERP aceita é a troca de
arquivos por uma pasta: a integração do ERP grava e lê arquivos numa pasta da rede.

## Decisão

**1. As pastas compartilhadas** (`electron/pastasCompartilhadas.ts`). O usuário escolhe uma pasta, no computador ou na
rede, e o programa cria as subpastas do tipo:
- **Onde a escolha fica:** em `<userData>/pastas-compartilhadas.json`.
- **O que a interface pode pedir:** só o tipo da pasta, uma das subpastas conhecidas e um nome de arquivo sem barra,
  sem ".." e sem os caracteres que o Windows recusa. O caminho é montado no processo principal, sempre dentro da pasta
  escolhida.
- **As operações:**
  - listar, sem os ocultos e os temporários;
  - ler;
  - gravar sem deixar o arquivo pela metade;
  - mover sem substituir o que já está no destino;
  - criar só se não existe;
  - apagar.
- **Para que mais serve:** a mesma base fica para a biblioteca e a fila na rede.

**2. A troca** (`domain/trocaComOErp.ts`, `trocarComOErp`), em Planejamento › 2. Ordem › "Troca com o ERP (pasta)":
- **"Escolher a pasta…"** cria `entrada`, `processados`, `com-erro` e `saida`.
- **"Trocar com o ERP agora"** lê da `entrada` só os CSV deste molde: o nome começa pelo código do molde, seguido de um
  separador (`ENF-1_ordens.csv`). Os de outros moldes ficam lá, para quando o molde deles for aberto.
- **Cada arquivo é conferido** como na importação à mão, tudo ou nada.
  - **O aceito** vai para `processados`, com a data e a hora na frente do nome, *antes* de as ordens entrarem. Se
    outra estação o levou primeiro, as ordens não entram duas vezes.
  - **O recusado** vai para `com-erro`, com um `.erros.txt` ao lado, e os erros aparecem na tela.
  - **Uma ordem que já existe** é recusada, como na importação à mão.
- **Depois da entrada, a `saida`** recebe cinco arquivos, sempre com os mesmos nomes, já com as ordens que acabaram de
  entrar:
  - `ordens.csv`: a grade, as peças e a situação do corte (a execução mais recente), com os cortes concluídos, as
    camadas e o consumo real;
  - `rolos.csv`: o inicial, o consumido, o reservado, o saldo e o disponível de cada rolo;
  - `movimentos-de-estoque.csv`: reservas, baixas e estornos, com o peso e se ainda valem;
  - `cortes.csv`: o histórico da sala de corte;
  - `consumo-por-malha.csv`.
- **"Deixar de usar a pasta"** esquece a pasta. Os arquivos dela continuam lá.
- **Fora do programa** (no navegador), a caixa não aparece.

O recado de "nenhum ERP ligado" e a Ajuda passam a citar a pasta.

## O que não foi feito

- **A ligação direta com um ERP** (serviço na rede, login): continua dependendo do ERP e de quem cuida dele.
- **A troca automática de tempos em tempos:** a troca é por botão.
- **Ordens de vários moldes de uma vez:** cada troca importa as do molde aberto.

## Conferência

- `electron/pastasCompartilhadas.test.ts` (5 testes):
  - os nomes que sairiam da pasta são recusados;
  - preparar, gravar, listar, ler e apagar;
  - mover não substitui nem move o que outra estação levou;
  - "criar se não existe" deixa o segundo pedido perder;
  - a pasta escolhida fica guardada.
- `domain/trocaComOErp.test.ts` (8 testes):
  - os arquivos do molde;
  - o nome carimbado e o relatório;
  - as ordens com a situação do corte, o rolo depois do corte e o movimento de baixa com o peso;
  - os cinco arquivos;
  - a troca completa numa pasta de mentira: o arquivo aceito, o recusado e o de outro molde;
  - o arquivo levado por outra estação;
  - a pasta fora do ar.
- `ui/PainelDePlanejamento.test.tsx` (3 novos):
  - sem a pasta, a caixa não aparece;
  - escolher, trocar e deixar de usar;
  - o arquivo com erro.
- `npx vitest run`: 179 arquivos, 3094 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 116 conferências, nenhuma falha.
  - **A nova:** a pasta escolhida ganha as quatro subpastas. Um CSV `<código do molde>_ordens.csv` posto na entrada é
    importado, vai para `processados`, e a saída tem os cinco arquivos, com a ordem nova em `ordens.csv`.
