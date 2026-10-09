# ADR 0038 — Cortar, Unir, Remover região, Dobrar, Desdobrar e Bainha

## Contexto

Terceira etapa do pedido do ADR 0036: as seis ferramentas da aba Produção que o
ADR 0035 tinha deixado desligadas com o motivo "são operações de modelagem; aqui
os moldes chegam prontos para o encaixe".

O manual da referência descreve:

- **Cortar molde:** corta o molde usando um elemento (uma reta ou curva
  desenhada antes), com opções de contorno, costura, pique e modo.
- **Unir moldes:** indica-se o início e o fim da união no primeiro molde e no
  segundo. "Apenas mover" encosta os moldes sem uni-los.
- **Remover região:** tira do molde a região delimitada por elementos.
- **Bainha:** número de dobras, largura, largura 2 (cada ponta com a sua) e
  pique; indica-se o começo e o fim da bainha no contorno.
- **Dobrar e Desdobrar:** não aparecem no manual consultado. Ele só descreve a
  linha de simetria, que marca onde o molde pode ser dobrado no encaixe.

Na referência, o corte e a região são definidos por elementos soltos. Aqui só
existem peças fechadas.

## Decisão

### A reta de corte

Cortar, Remover região e Dobrar usam a mesma reta: **dois cliques no contorno da
peça selecionada**. Um clique perto de um vértice cai nele; senão, no ponto mais
próximo da aresta.

- A reta tem de ficar toda dentro da peça. É recusada a que sai da peça no
  caminho, a que passa por um furo e a que corre em cima de uma aresta.
- Cada parte fica com o que é dela: os furos, as linhas internas e as marcas
  que estão do lado dela, os piques das arestas que herdou e as cotas cujo
  número está mais perto.
- A linha de fio fica no lugar na parte em que cabe inteira. Na outra, a mesma
  seta vai para o meio da parte.

### Ferramentas

- **Cortar:** a peça vira duas. A parte maior continua sendo a peça (mesmo
  nome e identidade). A outra é uma peça nova, com "(2)" no nome, ou o próximo
  número livre.
- **Remover região:** depois da reta, um clique dentro da peça escolhe a região
  que sai. Ela aparece em destaque antes do clique.
- **Dobrar:** depois da reta, um clique escolhe o lado que **fica**. O lado que
  sai aparece em destaque. A reta passa a ser uma aresta: a linha de dobra.
- **Desdobrar:** um clique na aresta que é a linha de dobra. A peça ganha a
  outra metade, espelhada nessa aresta, e a dobra fica como linha interna.
  - Furos, linhas internas, marcas e piques ganham a cópia espelhada.
  - Uma dobra feita de várias arestas seguidas na mesma reta vale inteira.
  - É recusada a peça que passa para os dois lados da reta da aresta, ou que
    volta a encostar nela.
- **Unir:** um diálogo pergunta por "Apenas mover". Depois, um clique na aresta
  da peça selecionada e outro na aresta de outra peça.
  - A outra peça gira e encosta, aresta com aresta, meio com meio, do lado de
    fora. A prévia mostra onde ela vai parar.
  - Unidas, as duas viram uma peça só: a selecionada, com o nome, a linha de
    fio, a costura e a quantidade dela, e com os furos, linhas internas,
    marcas, piques e cotas das duas.
  - Arestas de comprimentos diferentes ficam centralizadas, e a sobra vira um
    degrau no contorno.
  - **Apenas mover** só encosta. Como a peça continua existindo, vale a regra
    do sentido do fio: o giro que as propriedades dela não permitem é
    recusado, com a explicação. Unindo, o giro é livre, porque passa a valer o
    fio da primeira peça.
- **Bainha:** um diálogo pede o número de dobras (1 a 4), a largura de cada
  dobra, a largura 2 (opcional) e os piques. Depois, dois cliques no contorno:
  onde a bainha começa e onde termina. O trecho é o mais curto dos dois
  caminhos entre eles, como nas curvas.
  - A sobra sai para fora da peça, paralela ao trecho, com esquadria nos
    cantos.
  - As laterais copiam, espelhadas na linha da bainha, as costuras vizinhas.
    Assim, com a bainha dobrada, a lateral cai em cima da costura. Com mais de
    uma dobra, vão em ziguezague. No meio de uma aresta, saem em esquadro.
  - Com largura 2, a largura muda por igual do primeiro ponto clicado ao
    segundo.
  - A linha original da bainha e as dobras intermediárias viram linhas
    internas. Com piques, cada ponta de cada linha de dobra ganha um.
  - É recusada a bainha cujas laterais se cruzariam.

Todas mostram a prévia no desenho, dizem na faixa de mensagens o que fizeram
(com as áreas) ou por que não fizeram, continuam ligadas para repetir, e cada
aplicação é um passo de desfazer.

### Leitura natural

Dobrar e Desdobrar não estão no manual consultado. Foram feitas pela leitura
natural dos nomes (dobrar deixa meia peça; desdobrar devolve a outra metade
espelhada), e a dica dos dois botões diz isso.

### Organização

- `domain/corteEUniao.ts`: `cortarMolde`, `metadeDoMolde`, `desdobrarMolde`,
  `encostarMolde` e `unirMoldes`.
- `domain/bainha.ts`: `geometriaDaBainha` (para a prévia) e `criarBainha`.
- `ui/ferramentasDeMolde.ts`: o que cada clique faz, a prévia e as mensagens.
- `DialogoDeCampos` ganhou o campo opcional, que pode ficar em branco.
- A fita chama as seis por uma ação só (`onUsarFerramentaDeMolde`).

## O que NÃO foi feito

- **Corte por curva ou por linha quebrada:** o corte é sempre uma reta. Na
  referência ele segue um elemento desenhado antes.
- **Costura e pique no corte** (opções do Cortar da referência): as duas
  partes ficam com a margem de costura da peça original.
- **Dividir a linha interna que atravessa o corte:** ela vai inteira para a
  parte em que está o primeiro ponto dela.
- **Escolher os pontos de início e fim da união:** as arestas são sempre
  centralizadas uma na outra.
- **"Unir tamanhos":** depende da graduação.
- **Verificar se as peças se sobrepõem depois de unir**, e se o contorno se
  cruza depois da bainha num trecho muito curvo: só o cruzamento das laterais
  da própria bainha é conferido.
- **Linha de simetria:** continua desligada, porque o encaixe não dobra moldes.
- **Conferência com a referência:** não houve como comparar o resultado com o
  programa de referência; a geometria segue o que o manual descreve.

## Verificação (Electron real, build de produção)

- **Testes:** 726/726 em 46 arquivos (eram 621 em 43).
  - Novos: cortar, dobrar, desdobrar e unir 41; bainha 19; cliques, prévia e
    mensagens 34; fita 9; diálogo de campos 2.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - Quatro mutações, uma por vez, todas pegas pelos testes e desfeitas.
- **Roteiro automático, janela de 1440 × 900 visível**, conferido no arquivo
  salvo do projeto. Duas peças de 1200,0 cm²:
  - Cortar de canto a canto: duas peças de 600,0 cm², a nova com o nome
    "TESTE-1 (2)". Cortar no meio das arestas: as duas partes somaram
    1200,0000 cm². As duas pontas na mesma aresta: recusado, nada mudou.
  - Remover região pela outra diagonal: sobraram 600,0 cm², com o canto certo.
    Clique fora da peça para escolher o lado: recusado, nada mudou.
  - Dobrar ao meio e Desdobrar na aresta de dobra: a área desdobrada foi
    exatamente o dobro da dobrada, com a dobra guardada como linha interna.
  - Desdobrar numa aresta original: 800 × 300 mm, 2400,0 cm².
  - Bainha de 2 dobras de 25 mm numa aresta de 300 mm: 1350,0 cm², 2 linhas de
    dobra e 4 piques, nas posições esperadas. Com largura 2 de 50 mm e 1 dobra:
    1312,5 cm². O diálogo recusou 9 dobras e largura 0, e lembrou os valores.
  - Unir: uma peça só, de 2400,0 cm², 400 × 700 mm. Com a outra peça tendo de
    girar 90°: 2400,0 cm², 400 × 600 mm.
  - Apenas mover: a outra peça encostou centralizada e as duas continuaram
    separadas. Com giro de 90°: recusado com a explicação, nada mudou.
  - Cada operação foi desfeita com Ctrl+Z, e a lista de peças voltou ao que
    era. Esc saiu da ferramenta. Sem peça selecionada, os seis botões ficaram
    desligados, dizendo o que falta.
  - Os dois diálogos e as prévias foram conferidos nas imagens da tela.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). O
  roteiro usa uma pasta própria.
