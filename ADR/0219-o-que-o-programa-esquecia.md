# ADR 0219 — O que o programa esquecia, repetia ou não mostrava

Mais limites dos ADRs 0188 a 0214 que eram falta de acabamento.

- **Fila de impressão:** o que não saiu sobrevive ao fechar o programa e volta pausado, para quem abre decidir quando mandar.
- **Aba do tecido:** o programa lembra o tecido ativo de cada projeto.
- **Arquivos de encaixe:** criar de novo atualiza o projeto do mesmo risco, em vez de fazer outro. O projeto guarda de que modelo e de que risco veio.
- **Perdas:** o comprimento com as perdas aparece no relatório, na tela, no PDF e no Excel.
- **Descrição da peça:** sai no plotter, perto do nome.
- **Emenda no PDF:** agora sai com a palavra, como no PLT.
- **Comentários:** o comentário pode falar de uma peça, e um botão leva até ela.
- **Blocos:** a janela mostra os tamanhos do projeto e avisa do tamanho escrito que não existe.

**Limites:** a fila guarda o texto já gerado: mudar o molde depois não muda o risco que estava esperando. Criar de novo troca as peças do arquivo de encaixe, inclusive o que tiver sido mexido à mão nele; o histórico do projeto guarda a versão anterior.

Conferência: testes unitários, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
