# ADR 0100 — O painel da sala de corte

## Contexto

Fase 1 do estudo de funcionalidades (ADR 0099): a sala de corte inteira, não só a execução de um plano (ADR 0098).
A referência descreve, para a sala de corte: ordens de corte geradas do encaixe e do planejamento, a situação de
cada uma, indicadores (tempo de corte, metros processados, eficiência por operador, aproveitamento), o planejado ×
executado com sugestões de correção, a gestão de retalhos, relatórios para compras e o histórico para auditoria —
além da ligação com a máquina de corte, que é equipamento (fora daqui).

Até o ADR 0098, a execução só se via e se fazia dentro do plano, abrindo o projeto dele.

## Decisão

- **Encaixe > Sala de corte** abre o painel, com quatro partes:
  - **Ordens de corte:** todas as execuções do cadastro de produção, de todos os projetos (o nome e o código do
    projeto vêm da Biblioteca), com a malha, a situação, quem liberou, o operador, camadas, consumo, desvio e tempo;
    filtro por situação (abertas, concluídas, canceladas, todas). Cada ordem abre os mesmos controles do plano
    (`ExecucaoDoCorteNaTela`): **começar e concluir daqui, sem abrir o projeto**.
  - **Indicadores e sugestões** (últimos 7 dias, 30 dias ou tudo): cortes concluídos, ordens abertas, malha
    cortada real × planejada, desvio, camadas, tempo total e médio, metros por hora (só com ao menos 1 minuto de
    corte registrado), e a tabela por operador. **Sugestões de correção**, cada uma com o dado de onde vem: o consumo
    por camada acima ou abaixo da tolerância (3%, a partir de 3 cortes — a média ponderada pelas camadas, e quanto
    aumentar ou diminuir as pontas por camada), cortes com camadas a menos, ordens liberadas há mais de 2 dias sem
    começar e cortes começados há mais de 12 h.
  - **Retalhos:** os rolos marcados como retalho, ainda no estoque, com o saldo e onde estão; "Usado ou descartado"
    (tira do estoque) e "Não é retalho".
  - **Relatórios:** o consumo por malha do período (para compras, com o peso pelo rendimento) e dois CSV — o consumo
    por malha e o histórico de todas as ordens (auditoria) —, com ponto e vírgula, vírgula decimal e a marca que faz
    a planilha ler os acentos.
- A execução passa a guardar, ao ser liberada, **o que o plano usa de cada rolo e a malha** (`usosPlanejados`,
  `malha`): é com isso que o painel conclui sem abrir o projeto (`planoDaExecucao`). O formato do cadastro continua o
  3 (os campos são opcionais; a versão 3 ainda não tinha sido publicada).
- Os números continuam os informados por quem opera; o painel diz isso. A ligação com máquina de corte, enfestadeira
  e mesa não existe (equipamento).

## Conferência

- `domain/salaDeCorte.test.ts`: indicadores (total, por operador, período), as quatro sugestões e o "ainda sem
  média", retalhos, consumo por malha, os dois CSV (o texto com ponto e vírgula entre aspas). `ui/PainelDaSalaDeCorte.test.tsx`:
  começar e concluir pelo painel (a baixa é a do real), os indicadores, os retalhos e a exportação.
- `npx vitest run`: 136 arquivos, 2657 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa; o teste de uso do repositório, no Windows: 17 conferências, nenhuma falha.
- O programa gerado, numa pasta de dados descartável: um plano confirmado e liberado; no painel, a ordem com o
  projeto e a situação, começada e concluída daqui; os indicadores; o CSV do histórico gravado com a marca; o
  cadastro com a execução concluída e a malha guardada; sem erro na página (9 conferências). A primeira foto mostrou
  o painel mais largo que a janela (cortado à esquerda): a janela passou a acompanhar o painel, como a do
  planejamento.
