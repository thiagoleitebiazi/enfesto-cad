# ADR 0059 — O resto das ferramentas nos moldes reais, e o Espaço preso

## Contexto

O teste pela tela com os moldes reais (ADR 0057 e 0058) só tinha passado por
pence recortada, pence com bico e prega. O corte por elementos, o "Cortar
intersecções", as pontas indicadas, as alças de tangente e a graduação tinham
sido exercitados pela tela só nas peças de teste. E só um projeto real tinha
sido aberto.

## Decisão

### O roteiro

Para cada peça dos **dois** projetos reais que têm moldes (o de produção e o
menor), o roteiro enquadra a peça e faz, com cliques de verdade:

1. **Cortar pelo elemento:** traça uma linha interna de um lado ao outro e
   corta a peça por ela.
2. **Curva editável + alça de tangente:** torna um trecho do contorno uma
   curva registrada e puxa a alça de uma ponta.
3. **Graduação:** tabela P/M/G, uma regra num ponto, "Automático" e "Separar"
   o tamanho G.
4. **Pence por pivô com "Cortar intersecções":** numa reta que sai da peça e
   volta, quando a peça tem uma.
5. **Transferir** uma pence com as **pontas indicadas**.
6. **Fechar** "somente o recorte" com as pontas indicadas.

Antes de cada passo, confere na barra de status que a vista não saiu do lugar;
depois de cada um, lê o arquivo salvo e desfaz com Ctrl+Z, conferindo que a
peça voltou a ser a de antes.

### O defeito que o roteiro achou: o Espaço preso

Nas primeiras rodadas, em algumas peças os cliques deixavam de valer: a
ferramenta ficava esperando e a vista andava. A causa: **a tecla Espaço
(segurar para arrastar a vista) ficava "apertada" para o programa quando o
"soltar" não chegava** — a janela perde o foco com a tecla apertada, e o
"soltar" vai para outro programa. Daí em diante todo clique com o botão
esquerdo arrastava a vista em vez de agir, até alguém apertar e soltar o
Espaço de novo. Para o usuário: "o programa parou de responder ao clique".

Correção, em `AreaDeDesenho`:

- quando a janela **perde o foco**, o Espaço é dado como solto e o arrasto em
  curso termina;
- o Espaço **digitado num campo de texto** é texto, e não arma o arrasto (antes
  armava: digitar "P, M, G" numa janela deixava a tecla valendo até o
  "soltar").

## O que NÃO foi feito

- **De onde veio o Espaço sem "soltar" no roteiro não foi identificado.** O
  texto que o roteiro digita não produz a tecla (conferido). O mais provável é
  o teclado de verdade com a janela do teste em foco. O defeito foi
  reproduzido de propósito (apertar sem soltar, e tirar o foco), e é esse caso
  que a correção cobre.
- **O lugar de cada operação foi escolhido pelo roteiro**, para ter o que
  conferir. Não é onde ela iria numa roupa.
- **"Cortar intersecções" só abriu as peças que têm reentrância** (uma reta
  entre pontos do contorno que sai e volta): "frente" e "costa" no projeto de
  produção, a "2" no menor. Nas outras o roteiro registra que não há onde.
- **Ninguém da modelagem olhou estes resultados.** A folha de revisão (ADR
  0057) continua sendo a das pences e da prega.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação (Electron real, build de produção)

- **Projeto de produção** (4 peças, 445 a 829 pontos, 24 a 27 linhas
  internas): **22 operações feitas, 0 recusadas, 0 falhas; a vista saiu do
  lugar 0 vezes.**
  - Corte pelo elemento: nas quatro, as duas partes somam a área da peça
    (por exemplo 2016,0 + 1974,0 = 3989,9 cm²).
  - Curva + alça: nas quatro, a curva sai na direção da alça com até 1,3° de
    diferença (o trecho é feito de pontos).
  - Graduação: 8 a 10 pontos graduados; o G separado tem os mesmos pontos do
    base e área maior.
  - "Cortar intersecções": "frente" foi de 805 para 809 pontos e ganhou 4
    linhas; "costa", de 829 para 833.
  - Transferir com as pontas indicadas: a área não muda (3981,9 → 3981,9 cm²).
  - Fechar só o recorte: a peça volta a ter os pontos e a área de antes, e a
    pence fica marcada.
- **Projeto menor** (4 peças, 37 a 69 pontos, sem linhas internas): **17
  feitas, 0 recusadas, 0 falhas**, duas vezes seguidas.
- Depois dos Ctrl+Z, todas as peças voltaram ao que eram.
- **Validação:** os projetos já abrem com 1 e 3 erros, que são dos dados.
  Durante as operações aparecem erros a mais quando a peça cortada ou o
  tamanho separado cai em cima da vizinha, e o Ctrl+Z desfaz.
- **O Espaço preso, de propósito:** com a tecla apertada sem soltar e a janela
  tendo perdido o foco, a pence no contorno não saía (0 pences); com a
  correção, sai (1 pence).
- **Testes:** 1650/1650 em 78 arquivos (3 novos: o Espaço apertado leva o
  clique para o arrasto; perder o foco solta; o Espaço num campo de texto não
  arma). Tipos e lint limpos (o aviso antigo do `useMemo` continua).
- **Mutações:** 4 de 4 pegas (não soltar ao perder o foco, não terminar o
  arrasto, não soltar no "soltar", armar com o Espaço digitado em campo).
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). Os
  projetos reais foram lidos por cópia, fora do repositório.
