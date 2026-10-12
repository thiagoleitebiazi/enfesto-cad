# ADR 0082 — A validação: a folga na tela, a metade guardada pela dobra e a peça real

## Contexto

O ADR 0081 deixou escrito, em "O que NÃO foi feito", três coisas, e o pedido
foi ajustá-las:

- "A folga de 1 mm não tem campo na tela."
- "As linhas da metade guardada pela dobra (a que o 'Desdobrar' traz de
  volta) não são conferidas."
- "O 'Tirar só o de fora' não foi usado numa peça real pela tela."

## Decisão

### A folga na tela

- A faixa de validação ganhou um campo: **"Linhas internas: apontar o que
  passa de [ ] mm da borda da peça"**.
- Aceita de 0 a 100 mm, com vírgula ou ponto. O número que serve passa a
  valer na hora, enquanto é escrito; o que não serve fica marcado no campo e
  não muda nada.
- Enter e Esc saem do campo. Ao sair, o campo volta a mostrar a folga que
  está valendo.
- A folga fica **guardada neste computador**, como os cadastros, e vale para
  todos os projetos abertos nele. Sem nada guardado, é de 1 mm.
- Os botões dos avisos ("Tirar", "Tirar só o de fora", "Tirar a linha") usam
  a mesma folga que a lista.

### A peça dobrada que guarda a outra metade

- A peça dobrada com "Manter dobra do molde" é conferida **inteira**: a borda
  é a da peça com a metade guardada de volta no lugar, e entram na conta as
  linhas das duas metades.
- A linha de uma metade que entra na outra **não saiu da peça**. Antes, a
  linha do desenho que passava da dobra era apontada, embora estivesse dentro
  da peça inteira.
- Se a metade guardada **não encaixa mais** na dobra (a peça foi mexida
  depois), cada metade é conferida contra o contorno dela.
- A metade guardada não aparece no desenho. Por isso o aviso diz quando a
  linha é dela: "uma linha interna da metade guardada pela dobra…", ou, com
  várias, "…; N na metade guardada pela dobra".
- Os botões alcançam as duas metades. O "Tirar só o de fora" corta a linha da
  metade guardada na borda da peça inteira; desdobrada a peça, a linha
  aparece já cortada.
- A linha só de construção da metade guardada continua de construção depois
  de cortada.
- Sem "Manter dobra", nada muda: a borda é a da metade que ficou.

### Na peça real

- O "Tirar só o de fora" foi usado pela tela nas oito peças dos dois projetos
  reais (em cópias). Como nenhuma linha delas sai da peça, o roteiro traça
  uma, com a ferramenta "Por ângulo": de um ponto de dentro até uns 60 mm
  além da caixa do contorno.
- Em cada peça: a validação aponta a reta e diz até onde ela vai — conferido
  contra uma conta à parte, feita andando pela reta de 0,05 em 0,05 mm; o
  campo da folga a esconde e a mostra de novo; o botão a corta em cima do
  contorno real; dois Ctrl+Z devolvem a peça como era.

### Um defeito achado no caminho

- Ao sair do campo da folga, o foco do teclado ficava solto na página, e os
  atalhos do programa (Ctrl+Z, Ctrl+S) deixavam de valer até o próximo
  clique: eles são ouvidos na janela do programa, e não na página.
- Agora Enter e Esc devolvem o foco ao programa.

## O que NÃO foi feito

- **A folga é do computador, e não do projeto:** o mesmo projeto, aberto
  noutro computador, é conferido com a folga de lá.
- **A linha da metade guardada não pode ser vista antes de desdobrar:** a
  metade guardada fica fora do desenho. O aviso diz que a linha é dela, mas
  não a mostra.
- **Nas peças reais a reta é traçada pelo roteiro:** elas não têm linha
  própria que saia da peça.

## Verificação

- **Testes:** 2063/2063 em 94 arquivos (eram 2047 em 93); tipos e lint limpos
  (o aviso antigo do `useMemo` continua). Novos: a folga escrita no campo,
  lida e gravada; a peça dobrada conferida inteira, sem a metade guardada e
  com a metade desencaixada; o que cada botão faz nas duas metades; a linha
  de construção da metade guardada; as frases da validação.
- **Mutações:** 52, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas.
- **Electron real, peças de teste:**
  - o campo aparece com 1 mm; com 50, a linha que passa 38 mm deixa de ser
    apontada, e a folga fica guardada; "abc" e 250 ficam marcados e não mudam
    nada; Enter sai do campo e o texto volta ao que vale; com 0,5, a linha
    volta a ser apontada; com 30, o "Tirar só o de fora" a corta na borda;
  - três linhas e a peça dobrada com "Manter dobra": antes de dobrar, duas
    saem; dobrada, a lista diz "2 linhas internas saem da peça (…; 1 na
    metade guardada pela dobra)", e a que passa de uma metade para a outra
    não é apontada; "Tirar só o de fora" corta a do desenho e a da metade
    guardada; desdobrada, a peça está inteira, com as duas cortadas na borda;
  - seis Ctrl+Z devolvem a peça como era.
  - **22 conferências, 0 falhas.**
- **Electron real, projetos reais (cópias), pela tela:** as oito peças (de 37
  a 829 pontos), uma reta em cada uma, em quatro direções. **44 + 44
  conferências, 0 falhas.** A distância dita pelo aviso bateu com a conta à
  parte em todas (por exemplo, 113 mm ditos para 112,55 medidos), e a ponta
  nova ficou a menos de um milésimo de milímetro do contorno.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
