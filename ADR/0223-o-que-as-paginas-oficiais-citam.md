# ADR 0223 — O que as páginas oficiais citam e ainda faltava

Lidas as páginas oficiais de cada módulo da referência (moldes, encaixe, servidor de encaixes, PLM, ficha, IA, 3D, digitalização, sala de corte, enfestadeira) e cruzadas com o código. Quase tudo já existia, muitas vezes com outro nome: furos e piques na foto, indicadores por operador, retalhos, mix da coleção, relatório da fila, estampa no desenho técnico.

**O que faltava, e entrou:**

- **Provar outro tamanho:** o provador trocava o manequim, mas a roupa ficava no tamanho do molde. Agora há "Tamanho das peças", que não muda o projeto. Os dois são independentes: dá para ver o M no manequim do G.
- **Consumo de cada molde:** a janela Status do encaixe mostra o consumo e a parte de cada molde, repartidos pela área.
- **Sequência de enfestos:** o plano salva os enfestos em ordem, com o comprimento e as camadas de cada um, que é o que a enfestadeira programa.
- **Descrição técnica preliminar:** a ficha ganha "Escrever a partir dos moldes", com os moldes, os tamanhos, os tecidos e as costuras. Não usa IA.

**O que as páginas citam e não entrou:** a edição da imagem gerada e a descrição feita por IA dependem do serviço de IA. A nuvem de verdade, a integração com a máquina de corte da própria marca e o assistente são serviços dela.

**Limites:** a parte de cada molde é pela área, não pelo lugar que ele ocupa no encaixe. O provador não mede a diferença entre dois tamanhos: mostra um de cada vez.

Conferência: testes unitários, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
