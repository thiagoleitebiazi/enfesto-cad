# ADR 0121 — Os traços de caneta da foto viram linhas internas do molde

## Contexto

O ADR 0109 (o molde da foto) deixou em "O que não foi feito": "As linhas internas desenhadas a caneta (além do fio)
não viram linhas do molde." O molde de papel de verdade tem pences, marcas de bolso, linhas de dobra e de casa,
desenhadas a caneta. O reconhecimento achava o contorno, os furos, os piques e o traço do fio, e os outros traços
eram jogados fora. Quem digitalizava tinha de redesenhar cada pence à mão.

## Decisão

**1. Que traço vira linha.** Dentro do papel, o traço de caneta é um "buraco" na região do molde, como já era no fio.
- **O furo:** o buraco redondo continua sendo furo.
- **O fio:** o traço reto mais comprido continua sendo o fio.
- **A linha interna:** cada outro traço comprido (15 mm ou mais) e fino (até 4 mm de largura média: a área sobre o
  comprimento) vira uma linha interna.

**2. A linha do meio do traço.**
- **A tinta:** os pixels do traço são os de fora do papel dentro da volta do buraco.
- **O esqueleto:** os pixels afinados até 1 pixel (o afinamento de Zhang e Suen).
- **O caminho:** no esqueleto, o mais comprido, achado por duas buscas em largura (a ponta mais longe de um pixel
  qualquer, e a mais longe dela). Isso vale para a reta, a curva e a pence: no V, o caminho vai de uma ponta, pelo bico,
  até a outra.
- **A primeira tentativa,** pelas duas metades da borda entre os dois pontos mais longe um do outro, errou a pence. No
  V de 20 mm de boca e 30 mm de fundo, os dois pontos mais longe são o bico e uma ponta, não as duas pontas.

**3. A simplificação da linha:**
- **Douglas-Peucker** na tolerância do contorno.
- **Uma limpeza:** sai o ponto do meio que fica a menos da tolerância da reta entre os vizinhos.
- **O trecho curto do meio,** de menos de 5 mm ou quatro larguras do traço, vira um ponto só: o mais saliente, o mais
  longe da reta entre os vizinhos de fora.
  - **O porquê:** a pence riscada em dois traços que se cruzam no bico (o que a mão faz) deixa no esqueleto um vaivém
    do tamanho do traço.
  - **Na foto do teste de uso,** a pence saía com 4 pontos, e o ponto a mais ficava a cerca de 1,5 mm da reta: a
    tolerância não o tirava. Com o trecho curto, saem 3 pontos: as duas pontas e o bico.

**4. Na janela do molde da foto:**
- **a opção:** "Os outros traços de caneta viram linhas internas (pence, bolso, dobra)", ligada de saída;
- **a revisão:** as linhas aparecem tracejadas em violeta sobre a foto corrigida, e "Achados" conta as linhas
  internas;
- **a peça criada** leva as linhas, e o histórico diz quantas.

**5. Junto, o realce do quadro das etapas (ADR 0118).** No arrasto do cartão, a coluna debaixo do mouse passou a
sair do que está no ponto do mouse (`document.elementsFromPoint`, sem o cartão arrastado, que não pega o mouse), e
não do alvo do evento.
- **O erro:** em uma de cada três rodadas do teste de uso, a coluna debaixo do mouse ficava só com o realce de "vale"
  em vez do verde forte. O cartão caía no lugar certo.
- **Depois da troca:** três rodadas seguidas, todas com o verde forte.
- **No jsdom dos testes,** que não tem `elementsFromPoint`, vale o alvo do evento.

## O que não foi feito

- **O traço que encosta no contorno** (uma linha riscada até a borda do papel) não é um buraco: não é achado. Ele
  entra no contorno como um entalhe e, se for estreito e curto, pode virar um pique.
- **O traço com galho** (um T, uma cruz): fica o caminho mais comprido; o galho mais curto sai.
- **O tipo da linha** (pence, dobra, costura) não é reconhecido: toda linha entra como linha interna, e o tipo se
  muda depois, no molde.
- **A correção da lente** continua de fora (ADR 0109).

## Conferência

- `domain/digitalizacao.test.ts` (+4):
  - numa foto desenhada a 0,5 mm/px, a pence (o V) e a marca do bolso viram duas linhas: a pence com as pontas e o bico
    no lugar (até 1,5 e 2 mm), o bolso com 30 mm (até 1 mm);
  - o fio não entra, e o tracinho de 8 mm fica de fora;
  - a foto só com o fio não dá linha, e a opção desligada também não;
  - o vaivém pequeno sai pela tolerância; o trecho curto vira o ponto mais saliente, e o trecho de 12 mm fica.
- `ui/PainelDaFotoParaMolde.test.tsx`: os achados contam as linhas internas.
- `npx vitest run`: 166 arquivos, 2974 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 86 conferências, nenhuma falha, nenhum aviso no console, em três rodadas
  seguidas.
  - A foto desenhada no teste, fotografada torta, ganhou uma pence de 20 × 35 mm riscada em dois traços.
  - Corrigida a perspectiva, os achados dizem "1 linha(s) interna(s)".
  - A peça criada no projeto tem a linha interna com 3 pontos: as duas pontas e o bico.
  - Numa rodada logo depois da bateria inteira de testes, com o computador ocupado, falhou também o arrasto das peças
    selecionadas, outro passo de mouse. Nas rodadas sozinhas, passou.
