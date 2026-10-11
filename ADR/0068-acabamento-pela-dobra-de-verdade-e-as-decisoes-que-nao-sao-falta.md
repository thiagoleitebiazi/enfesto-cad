# ADR 0068 — O acabamento da pence pela dobra de verdade, e as decisões que não são falta

## Contexto

Duas coisas ficaram ditas como abertas nos ADRs anteriores:

- **ADR 0060:** na pence de pernas de comprimentos diferentes (com desvio do
  vértice), o acabamento usava a linha do vértice ao meio das pontas, e não a
  linha em torno da qual a pence dobra. A segunda metade terminava na ponta
  da pence, "com um pequeno canto".
- **Quatro pontos que eu não fiz por não serem falta**, mas que só estavam
  explicados nos ADRs: quem usa o programa não tinha como saber.

## Decisão

### O acabamento pela linha da dobra

- A pence fechada dobra em torno da **bissetriz das pernas**: é a linha que
  leva uma perna sobre a outra. O acabamento passa a usá-la — para achar o
  bico e para espelhar a segunda metade.
- **Com pernas iguais nada muda:** a bissetriz passa pelo meio das pontas.
- **Com pernas desiguais:** a dobra não leva a ponta de um lado à ponta do
  outro. Leva-a para a reta da outra perna, antes ou depois da ponta dela. Esse
  ponto entra no acabamento. O que aparece no desenho é a diferença das pernas,
  exata, como um degrau sobre a linha da costura — no lugar do canto sem
  medida de antes.
- **Sem lado de dobra**, o bico continua sendo um ponto só, agora na
  bissetriz.
- Pernas com menos de 0,01 mm de diferença contam como iguais.

### A mensagem diz a diferença

Mudando as medidas de uma pence com acabamento, se as pernas ficam desiguais
a mensagem diz:

- de quanto é a diferença;
- o que ela dá na costura (as bordas dos dois lados se desencontram isso);
- que o acabamento foi feito pela dobra de verdade, e onde a diferença
  aparece;
- como igualar: zerar o desvio do vértice.

A janela das medidas explica o mesmo antes, onde há o campo do desvio.

O programa **não iguala as pernas sozinho**: seria mexer na pence sem
ninguém pedir.

### As quatro decisões, agora ditas na tela

| O que não é falta | Por quê | Onde o programa diz |
|---|---|---|
| Dobrar por uma curva | Papel e tecido só dobram em linha reta | Janela do "Dobrar", e a mensagem de quando se clica numa linha que não é reta (com o que fazer) |
| Trecho do contorno como elemento do corte | Ele já é a borda: cortar por ele não separa nada | Janela do "Cortar" |
| Pernas retas na pence transferida | O manual dá os passos e não fala da forma das pernas; a reta é a que não inventa nada | Janela do "Transferir pence", com o que fazer se elas devem ser curvas |
| Alça de tangente até 85° | De lado ou para trás, a curva teria de dar a volta para chegar ao ponto vizinho | Instrução da alça escolhida |

## O que NÃO foi feito

- **Igualar as pernas automaticamente**, nem redesenhar a borda do outro lado
  para o degrau sumir (o "acertar a pence" do ofício). Fica com quem modela.
- **A pence de pernas curvas** continua sem acabamento.
- **Pela tela, a pence com acabamento só ganha desvio** depois de deixar de
  ser "aberta por pivô" (o pivô saiu da peça): a aberta por pivô não tem o
  campo, porque o vértice dela fica sempre em esquadro.
- **Ninguém da modelagem olhou.** A conta é a do traçado em papel (dobrar a
  pence fechada e passar a borda por cima dela); o caso entra na folha de
  revisão.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1798/1798 em 83 arquivos (eram 1788); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: a diferença das pernas; o bico
  na bissetriz e o ponto a mais na reta da outra perna, à distância certa,
  para os dois lados; o degrau igual à diferença; o contorno sem cruzar;
  pernas iguais e quase iguais sem o ponto a mais; sem lado; ida e volta; o
  desvio pelas medidas; a mensagem (com lado, sem lado, diferença pequena,
  desvio zerado, pence sem acabamento); as quatro explicações.
- **Mutações:** 18 de 18 pegas, uma por vez, com o código conferido por hash
  antes e depois. A primeira rodada deixou passar três; cada uma ganhou
  teste. Uma delas era antiga: sem lado de dobra, "só conta a dobra que sai
  para fora" nunca tinha tido teste.
- **Electron real, peça de teste:** pence aberta com acabamento (pernas de
  102 e 102 mm, um ponto); tirada a faixa onde estava o pivô, as medidas
  passam a pedir o desvio.
  - Desvio de 10 mm, dobrada para a esquerda: pernas de 104,4 e 100,5 mm;
    acabamento de dois pontos, no contorno, em ordem; bico a 0 mm da
    bissetriz; o ponto a mais a 0 mm da reta da outra perna, a 104,4 mm do
    vértice; **degrau de 3,9 mm**, igual à diferença; a mensagem diz tudo
    isso; validação sem problemas.
  - Sem lado: um ponto, na bissetriz; a mensagem diz a diferença, sem degrau.
  - Desvio zerado: pernas de 102 e 102 mm, um ponto, mensagem sem diferença.
  - **15 conferências, 0 falhas.**
- **Electron real, moldes reais pela tela** (cópias, fora do repositório): o
  roteiro do acabamento em borda curva (ADR 0060), nas peças de produção e no
  projeto menor. **100 e 76 conferências, 0 falhas**, com os mesmos 8
  acabamentos de mais de um ponto em cada; nas peças de produção, os números
  são os mesmos da rodada anterior, linha por linha.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
