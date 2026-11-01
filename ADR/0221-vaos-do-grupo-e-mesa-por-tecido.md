# ADR 0221 — Os vãos do grupo, a forma da peça mantida e a mesa de cada tecido

O que tinha ficado de fora por ser trabalho a mais, não por ser impossível.

- **Vãos do grupo:** o grupo entrava no encaixe como a volta das peças, e o espaço entre elas se perdia. Agora ele entra com a forma real: as peças ligadas por um traço sem largura. Outras peças podem cair no vão. Peças do grupo que se tocam, ou a envolvente retangular, seguem como uma volta só.
- **Peça mantida no lugar:** bloqueava a caixa inteira. Agora o encaixe contorna a forma dela.
- **Mesa por tecido:** além da largura, cada tecido pode ter o comprimento da mesa, as emendas e os textos do risco. Emendas marcadas com um tecido ativo ficam só nele.
- **Linha de referência:** pode ser marcada com um clique na mesa, em Encaixe › Posicionar.
- **Costura no PDF:** sai tracejada ou pontilhada, quando essa opção vale no plotter.

**Limites:** o método de grade trabalha com retângulos: nele, a peça mantida segue ocupando a caixa. As linhas de referência são as mesmas para todos os tecidos.

Conferência: testes unitários, com o cálculo de verdade nos vãos, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
