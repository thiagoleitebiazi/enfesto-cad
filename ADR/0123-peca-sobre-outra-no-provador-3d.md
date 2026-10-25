# ADR 0123 — A peça sobre outra no provador 3D: o bolso na frente

## Contexto

O ADR 0111 deixou em "O que não foi feito": "Peças fora do corpo: a gola, o punho e o bolso só vão como 'fora', ou
postos à mão numa das posições. Não há posição sobre outra peça."

O bolso chapado, a aplicação e a etiqueta são peças do molde que vão costuradas por cima de outra peça, não em volta do
corpo. No provador, o bolso ficava de fora: a roupa vestida não tinha os bolsos. As costuras só juntavam borda com
borda, e o bolso é costurado no meio da frente.

## Decisão

**1. A posição "Sobre outra peça (bolso, aplicação)"** (`ConfiguracaoDaInstancia.sobre`), com:
- **a peça de baixo** (a instância);
- **a distância** do alto da peça de baixo até o alto da de cima, e do meio dela até o meio da de cima (+ para a
  direita de quem olha), em mm;
- **a boca em cima:** o lado de cima fica aberto, como no bolso. Desligada, a peça é costurada em volta toda, como a
  aplicação e a etiqueta.

**2. Pelo nome.** A peça chamada "bolso" vai sobre a frente que estiver no corpo (sobre as costas, se o nome diz),
com a boca em cima, um quarto da altura abaixo do alto e um quarto da largura para o lado; o par fica um de cada lado.
A "aplicação" e a "etiqueta" vão costuradas em volta toda.

**3. A cor.** A peça de cima na mesma cor da de baixo sumiria nela. Ela começa um tom mais escuro (`corMaisEscura`),
pelo nome e também escolhida à mão, se as cores eram iguais.

**4. Onde cada ponto cai** (`pontosNaPecaDeBaixo`):
- **Pelas faces:** o ponto da peça de cima vai à face da de baixo, pela distância do alto e do meio.
- **Na malha:** fica no triângulo da malha de baixo que o contém, com os pesos dele (baricêntricos). O ponto que cai
  fora da peça de baixo fica na borda do triângulo mais perto.
- **Na simulação:** a peça de cima é posta depois da de baixo. Cada ponto dela sai do ponto da de baixo onde cai, 4 mm
  para fora do corpo.

**5. A costura por dentro da peça de baixo** (a aplicação, na simulação):
- **Os pontos costurados** são os da borda da peça de cima, menos o meio do lado de cima quando ele é a boca
  (`pontosCosturadosDaPecaDeCima`). Os cantos da boca são costurados.
- **A restrição:** cada ponto costurado vai ao seu ponto dentro do triângulo da de baixo. A distância de partida vai a
  zero durante a costura. A correção se reparte entre o ponto e os três de baixo, pelos pesos e pelas massas.
- **A abertura da costura** do quadro de resultado conta também essas costuras.

**6. Por cima, não por dentro.** Não há colisão entre tecidos. A peça de cima guarda do corpo o dobro da espessura,
então fica por cima da de baixo onde ela encosta no corpo. No desenho, ela vem um pouco mais à frente que a de baixo.

**7. Sem a peça de baixo no corpo,** a de cima não entra na simulação. A janela diz para pôr antes a de baixo.

## O que não foi feito

- **O tecido não colide com ele mesmo:** longe do corpo (uma saia rodada solta), o bolso pode atravessar a peça de
  baixo.
- **A gola e o punho** continuam sem posição própria. A gola não é costurada no decote sozinha: ela é posta à mão, ou
  costurada pelos pontos, como as outras costuras.
- **O lugar do bolso se ajusta pelos números,** não arrastando na figura.

## Conferência

- `domain/provador3d.test.ts` (+4):
  - o bolso pelo nome vai sobre a frente, a um quarto da altura e da largura, com a boca em cima e um tom mais escuro;
  - cada ponto do bolso cai no lugar pedido da face da frente (até 10⁻⁶ mm), e os costurados são a borda menos o meio
    da boca, todos no alto da face;
  - **a saia com o bolso, simulada:** as duas laterais sugeridas, as costuras e o bolso fechados (menos de 6 mm),
    nada atravessa o corpo, e o bolso inteiro a mais de 4 mm do corpo, por cima da frente;
  - sem a frente no corpo, o bolso não entra, e a leitura guarda onde ele vai.
- `ui/PainelDoProvador3D.test.tsx` (+2):
  - o bolso pelo nome sobre a frente; a peça de baixo, a distância e a boca mudadas e guardadas;
  - "sobre outra peça" escolhido à mão vai sobre a frente.

  O teste antigo dos giros, que usava uma peça chamada "Bolso", passou a usar "Retalho" (o bolso agora vai à frente
  sozinho).
- `npx vitest run`: 166 arquivos, 2984 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 88 conferências, nenhuma falha, nenhum aviso no console.
  - **O bolso:** a peça da foto (a de 100 × 150 mm, com a pence), que antes ia "fora", vai como bolso sobre a frente
    da saia de teste, 8 cm abaixo do alto. A frente é escolhida sozinha.
  - **A simulação** assentou com a maior abertura de 2 mm, contando o bolso.
  - **A montagem guardada** tem a frente, as costas e o bolso.
  - **Na foto,** o bolso aparece mais escuro, chapado no alto da frente da saia.
