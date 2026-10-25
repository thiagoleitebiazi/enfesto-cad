# ADR 0125 — O encaixe da fila entra com o molde de agora

## Contexto

Na segunda rodada do estudo, o segundo item que faltava: na referência, mudar o molde atualiza o encaixe ligado a ele.

No Enfesto CAD, as peças na mesa são as do projeto. Mexer numa peça muda a mesa na hora. O que fica guardado à parte é o
encaixe calculado na fila (ADR 0102): ele guarda as peças já postas, com o desenho de quando entrou na fila.

Antes, aplicar esse encaixe depois de mudar uma peça fazia duas coisas:
- perguntava "as peças do projeto mudaram depois que o encaixe entrou na fila… Aplicar mesmo assim?";
- se a resposta fosse sim, punha na mesa as peças **de antes**, e desfazia sem dizer o que tinha mudado (a costura, um
  pique, um ponto do contorno).

## Decisão

**1. Cada peça do encaixe entra como está agora, no lugar e na posição em que o encaixe pôs a de antes**
(`encaixeComOMoldeDeAgora`, em `domain/encaixeAtualizado.ts`).
- **O movimento do encaixe:** o encaixe só anda, gira e espelha a peça, ponto a ponto, sem mudar a ordem dos pontos.
  O primeiro ponto do contorno e o mais longe dele dão o giro; o espelho é o que faz todos os pontos baterem
  (`movimentoDaPeca`). O mesmo movimento leva a peça de agora.
- **A peça mexida no projeto depois do encaixe** (andada, girada, espelhada) é levada antes de volta ao lugar de então:
  - se o contorno é o mesmo, por ele;
  - se o contorno mudou e o fio só andou, pelo fio, com o espelho pelo sentido do contorno.
  Assim, arrastar a peça no projeto não a tira do lugar no encaixe.
- **A peça que não mudou, ou que só andou,** fica exatamente como o encaixe a pôs.
- **O giro acumulado** é o da peça posta: é ele que conta para as rotações permitidas e o alto da estampa.

**2. As peças de agora preparadas como as do encaixe:** com os tamanhos e as simetrias abertas, se o encaixe pediu. Cada
tamanho ganha um id novo a cada preparo; a peça de agora é achada pelo id e, sem ele, pelo nome e o tamanho.

**3. O que não bate é dito:**
- a peça que saiu do projeto, ou a cópia a menos, fica fora da mesa;
- a peça nova (que o encaixe não tem) continua no projeto, onde estava; a cópia a mais é dita;
- duas peças de agora com o nome e o tamanho de uma do encaixe: não dá para saber qual é a dela, e ela fica como no
  encaixe.

**4. Sem a pergunta, com o recado:** a peça que mudou já não pede confirmação. Ctrl+Z desfaz, como antes. A pergunta
continua para o encaixe de outro projeto e para a mesa diferente. Depois de aplicar, a faixa de mensagens diz:
- que peças entraram com o molde de agora;
- o que ficou fora;
- quantos problemas de sobreposição, de distância ou de limite da mesa a validação acha, porque a peça que cresceu
  pode encostar na vizinha. O recado sugere afastar as peças ou fazer o encaixe de novo.

O botão "Aplicar no projeto" diz isso na dica.

## O que não foi feito

- **O plano de corte guardado** continua com os valores de quando foi feito e avisa que o molde mudou. Ele é o
  registro do que foi decidido (ADR 0087); recalcular é fazer um plano novo.
- **A peça que passou a ser em par** (ou deixou de ser) depois do encaixe: as cópias ficam com o espelho que o encaixe
  deu. O recado das cópias pede o encaixe novo quando a quantidade muda.
- **Afastar sozinho a peça que cresceu**: a mesa fica como o encaixe a deixou, e a validação mostra onde encosta.

## Conferência

- `domain/encaixeAtualizado.test.ts` (8):
  - **o movimento:** com e sem espelho, nos quatro giros; outro contorno não é movimento;
  - **a peça mudada** com o bico puxado 30 mm: cada ponto que não mudou no mesmo lugar, o bico 30 mm adiante, o mesmo
    giro; a que não mudou é a mesma do encaixe;
  - **a peça só andada:** fica como estava;
  - **a peça mexida no projeto e mudada** (andada; girada e andada; girada e espelhada): entra no mesmo lugar que a
    mudada sem mexer;
  - **o pique novo:** entra no lugar certo da peça posta;
  - **as que saíram e as novas:** a peça apagada e a cópia a menos saem; a nova e as cópias a mais são ditas;
  - **todos os tamanhos:** a peça achada pelo nome e o tamanho; com o nome repetido, fica como no encaixe;
  - **um encaixe de verdade,** com a manga em par e giros: a manga mudada ocupa o lugar de cada cópia, uma direita e
    uma esquerda.
- `npx vitest run`: 168 arquivos, 3001 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 93 conferências, nenhuma falha, nenhum aviso no console. As três novas:
  - com o melhor encaixe da fila aplicado, a costura da peça 1 vai de 0 a 6 mm, e o outro encaixe é aplicado;
  - a peça 1 entra com a costura nova, com o contorno exatamente onde aquele encaixe a pôs, e as outras como ele as pôs;
  - o recado diz que ela mudou depois do encaixe e que a validação acha 2 problemas, porque a costura nova encosta na
    vizinha. Dois Desfazer voltam às peças de antes da costura.
