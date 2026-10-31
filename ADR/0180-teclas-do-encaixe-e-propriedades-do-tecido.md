# ADR 0180 — As teclas do encaixe e as propriedades da peça no tecido

A auditoria final, item por item contra o manual e a apostila da referência, achou duas lacunas no encaixe à mão. A apostila traz as teclas: F2 girar livre, F3 girar 180°, F4 espelhar, F5 dobra horizontal, F6 dobra vertical, F7 ½ camada, F8 molde original, F12 sobreposição de moldes, Ctrl+F mover para fora do enfesto, as setas para mover o encaixe e Alt+clique para conferir um tamanho. O programa tinha as ações de giro e espelho em botões, sem as teclas, e não tinha as outras. A janela de tecidos do manual traz ainda "Livre", "Giro inicial", "Refletido horizontal" e "Refletido vertical".

**Decisão:** com a peça selecionada, no modo de seleção:

- F2, F3 e F4 fazem o mesmo que os botões, com as mesmas regras de rotação.
- F5 leva a peça à dobra de cima, no enfesto par e no tubular. F6 leva à dobra do começo do comprimento, no zigue-zague, onde o tecido dobra nas pontas da mesa. O encaixe automático passa a fazer o mesmo no zigue-zague, e a validação aceita a peça de simetria encostada nessa dobra.
- F7 liga "½ camada": aparece no nome da peça e no cabeçalho do risco no plotter.
- F8 desfaz o giro acumulado.
- F12, ou Visão › "Sobreposição de moldes": desligada, a peça solta em cima de outra vai para o lugar livre mais perto.
- Ctrl+F leva as peças selecionadas para depois do fim da mesa, em fila.
- Ctrl+setas deslizam a peça até encostar na vizinha ou na margem.
- Alt+clique seleciona as peças do mesmo tamanho e diz quantas são.

O painel da peça ganha "Giro livre" (o encaixe tenta de 15 em 15 graus), "Giro inicial", "Refletido na horizontal" e "Refletido na vertical". As três últimas valem no próximo encaixe: a peça entra assim e fica assim, sem aplicar de novo no encaixe seguinte.

**Limites:** a tabela da apostila não diz a tecla de "mover encaixe", e usar Ctrl+setas é leitura minha; "mover" como deslizar até encostar também é. F8 não desfaz o espelho, porque a peça não guarda se foi espelhada. "½ camada" é um aviso para o corte: não muda o consumo nem a quantidade. A peça fora da mesa continua no projeto, a validação acusa e ela sai no plotter até voltar. A dobra vertical usa só a ponta do começo da mesa. O giro livre deixa o encaixe mais lento, com 24 ângulos em vez de até 4.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
