# ADR 0208 — A envolvente, o grupo rígido, a margem por ponto e os blocos

O manual do encaixe da referência explica: "Criar envolvente" põe uma margem em volta dos moldes selecionados, seguindo o contorno ou retangular; "Margem" dá um valor a cada elemento do contorno; "Agrupar" une os moldes; "Configuração dos blocos" tem os modelos e tamanhos de cada bloco, "Separação completa" (um bloco por tamanho, em ordem crescente) e a "Orientação", horizontal ou vertical; "Manter orientação dos pacotes" intercala um pacote a 0° e o seguinte a 180°.

**Decisão:** o encaixe automático não precisou mudar por dentro. Antes do cálculo, a peça com envolvente, com margem ou de um grupo vira uma peça de mentira, com a forma do que ocupa. Depois, as peças de verdade vão para onde ela ficou, com o mesmo giro e o mesmo deslocamento. Assim vale para os dois métodos e para a fila.

- Encaixe › Posicionar › "Criar envolvente" e "Eliminar envolvente". Com mais de uma peça selecionada, elas viram um grupo. A envolvente aparece tracejada na peça.
- O grupo anda junto: clicar numa peça seleciona as outras. Ctrl+G e Ctrl+U passam a criar e desfazer esse grupo; antes davam um grupo do encaixe.
- O painel da peça ganha a margem por ponto do contorno.
- A janela do encaixe ganha "Encaixar em blocos", com a separação completa, os tamanhos de cada bloco e a orientação, e "Manter orientação dos pacotes".
- Nos blocos na vertical, o cálculo roda com a mesa de lado, e as peças voltam ao fim. As opções do encaixe têm "Usar envolvente de grupo".

**Limites:** o grupo entra no encaixe como a volta convexa das peças, então não aproveita os vãos dele. O grupo não sai espelhado. Na mesa de lado, a dobra não vale: o tecido é tratado como aberto. Na janela de blocos, os tamanhos são escritos, não escolhidos numa lista.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`, com o encaixe de verdade nos testes. O programa não foi aberto (pedido do usuário: só testes unitários).
