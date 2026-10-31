# ADR 0196 — As linhas de referência e a verificação

O manual do encaixe da referência tem "Editar linhas de referência": nome, distância, borda de referência, "Evitar deslizamento, sobreposição", "Limite de seção" e "Mostrar valor da linha". Tem também "Verificar", que acha moldes sobrepostos, dobrados fora da dobra e fora do enfesto, e diz que "Uma camada" encaixa moldes sobre outros no tecido tubular.

**Decisão:**

- A janela do Enfesto ganha as linhas de referência, uma por linha do campo. Elas aparecem na mesa e no plotter. "Evitar" faz o encaixe automático e o compactar não atravessarem a linha, e a validação avisa. "Limite" fecha a mesa depois da linha. "Valor" escreve a distância ao lado do nome.
- A validação avisa da peça dobrada longe da dobra do tecido.
- Duas peças de ½ camada podem se sobrepor no tecido dobrado: cada uma fica numa camada. A sobreposição de uma delas com uma peça comum continua sendo erro, porque a comum ocupa as duas camadas.

**Limites:** a linha é digitada, não arrastada na mesa. "Evitar deslizamento" não existe separado: aqui é a mesma coisa que evitar a sobreposição. O encaixe automático não usa a sobreposição de ½ camada: ela é só à mão.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
