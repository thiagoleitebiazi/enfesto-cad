# ADR 0217 — O teste do equipamento

O plotter virtual (ADR 0216) confere o que o programa envia. Ele não diz se a máquina de verdade aceita o arquivo, nem se 100 mm saem 100 mm no papel. Isso só se vê na máquina, e tem de ser rápido o bastante para alguém fazer.

**Decisão:** Opções › "Teste do equipamento" traz um roteiro curto, feito na fábrica, sem mim:

- **Plotter:** envia uma página com moldura de 140 mm de largura e comprimento à escolha (1 m, se não mudar), um quadrado de 100 mm, a régua de 100 em 100 mm e os nomes. Ela sai pelo mesmo caminho e com as mesmas canetas de um risco de verdade, sem a correção. Quem está na máquina mede a moldura com a trena e escreve as medidas.
- **Correção:** o programa calcula quanto corrigir no comprimento e na largura e aplica em tudo o que sai para o plotter: peças, moldura, emendas, linhas e textos. Mais de 10% é recusado: não é ajuste, é medida trocada ou escala errada.
- **Mesa de corte:** envia pela porta um quadrado de 100 mm com a ferramenta T1, para rodar em papel.

**Limites:** a correção é por computador e vale para um plotter só. Ela vale para o PLT, não para o ISO: a mesa de corte tem o ajuste dela. A mesa digitalizadora segue sem teste assim: o teste dela é ligar e pegar uma peça conhecida, na janela dela (ADR 0144).

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. A rodada com a máquina de verdade é a parte que falta, e é para isso que esta janela existe.
