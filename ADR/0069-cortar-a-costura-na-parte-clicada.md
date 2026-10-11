# ADR 0069 — "Cortar": a costura vai para a parte clicada

## Contexto

Achado ao reler o manual da referência para fechar os pontos abertos: no
"Cortar molde", depois de indicado o corte, o manual manda posicionar e
confirmar sobre a parte cortada, e avisa que **o lado selecionado influencia o
sentido da costura**.

O programa não fazia isso. Sem "2 moldes", a costura ia sempre para a parte
nova (a menor), e a janela dizia que o manual "não diz qual parte ganha a
costura". Dizia errado.

## Decisão

- **Com costura e sem "2 moldes"**, indicada a linha do corte a ferramenta
  espera um clique na parte que deve ganhar a costura. A parte sob o mouse
  fica em destaque. O clique corta, e a costura vai para a parte clicada — a
  maior ou a menor.
- Vale para os três jeitos de indicar o corte:
  - **dois pontos do contorno:** o terceiro clique é o da parte;
  - **um elemento, no contorno automático:** o clique no elemento o deixa
    como a linha do corte, e o clique seguinte é o da parte;
  - **vários elementos, no contorno manual:** o Enter confirma a linha (como
    o manual pede), e o clique seguinte é o da parte.
- **O clique fora da peça não corta nada:** a linha continua indicada, e a
  mensagem pede outro clique.
- **Sem costura, ou com "2 moldes"**, não há o que escolher: o corte é feito
  na hora, como sempre.
- A mensagem do corte diz qual parte ganhou a costura. A janela e a instrução
  dizem o que o clique faz. A frase errada sobre o manual saiu.
- Qual parte continua sendo a peça não mudou: a maior. A outra é a peça nova.

## O que NÃO foi feito

- **As duas partes continuam no lugar depois do corte.** Encostadas — ou, com
  costura, uma por cima da outra pela faixa da costura — a validação aponta
  "se sobrepõem" até uma delas ser movida. Já era assim em todo corte; não é
  desta mudança. O "posicione" do manual pode querer dizer que, na
  referência, a parte cortada é levada para outro lugar: está no roteiro de
  comparação.
- **Os roteiros de tela antigos do "Cortar" com costura numa parte só**
  (etapas 17 a 25, fora do repositório) não foram refeitos: hoje pediriam o
  clique na parte.
- **Moldes reais:** não entram aqui. A conta da costura em cada parte é a que
  já existia (a do "2 moldes"); o que mudou é a escolha da parte.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1808/1808 em 83 arquivos (eram 1798); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: a costura na parte do ponto
  indicado, o ponto fora da peça, quando o ponto não conta; o elemento à
  espera da parte; o clique na maior e na menor; o clique fora; os dois
  pontos do contorno; o contorno manual com Enter; quando o clique não é o da
  parte; a prévia; a instrução e a janela.
- **Mutações:** 23, uma por vez, com o código conferido por hash antes e
  depois. 22 pegas. A que passou mostrou código sem efeito na prévia (tirar
  os elementos da peça antes de achar a parte): foi retirado. Outra condição
  sem efeito foi achada ao escrever as mutações, e retirada também.
- **Electron real, peça de teste** (300 × 400 mm; 10 mm de costura):
  - pelos dois pontos: com eles, nada é cortado e a instrução pede a parte;
    clique fora da peça: nada, e a linha continua; clique na parte maior:
    841,7 cm² continuam e 398,3 cm² na nova (sem costura seriam 801,7 e
    398,3); clique na menor: 801,7 e 438,3. A mensagem diz qual foi.
  - pelo elemento: fica à espera; clicando de um lado e do outro, o que uma
    parte ganha num corte a outra ganha no outro;
  - contorno manual, dois elementos em "V": o Enter confirma, o clique corta
    pelos dois, sem sobrar linha interna;
  - com "2 moldes": 841,7 e 438,3, na hora; sem costura: na hora.
  - **20 conferências, 0 falhas.**
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
