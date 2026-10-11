# ADR 0056 — Registros: alças de tangente, círculo e espiral, prega sem registro

## Contexto

Os registros (ADR 0045 a 0051) guardam o que cada ferramenta fez, para dar
para mexer depois. Ficaram três buracos:

- a curva registrada só tinha os pontos de passagem: não havia como dizer em
  que direção ela sai de cada ponta;
- o círculo do "Por raio" e a espiral viravam peças comuns, sem as medidas;
- a prega aberta antes de as pregas ficarem registradas, ou desenhada à mão,
  não era reconhecida (a pence já era, desde o ADR 0050).

## Decisão

### Alças de tangente na curva

- A curva por pontos de passagem ganha uma **alça de tangente em cada ponta**:
  um anel preso à ponta por um traço, visível com o "Editar pontos de curva".
  - O clique na alça escolhe-a; o seguinte diz para onde ela aponta.
  - A curva passa a sair da ponta **na direção da alça**. O comprimento da
    alça não conta.
  - Delete, com a alça escolhida, tira-a: a curva volta a sair na direção do
    ponto de passagem vizinho.
- A alça precisa apontar para o lado da curva: no máximo 85° da reta que vai
  da ponta ao ponto de passagem vizinho. Além disso, é recusada.
- A alça anda com a ponta dela, acompanha a peça movida, girada, espelhada e
  levada a outro tamanho, e sai do registro se deixa de servir (o ponto de
  passagem foi para o outro lado).
- O arco e a curva pré-definida não têm alças: a forma deles é a deles.
- **É extensão nossa.** O manual da referência não tem alças de tangente.
- *A conta:* a curva é a mesma spline centrípeta de antes. Em cada ponta ela
  usa um ponto fantasma; com a alça, o fantasma é o vizinho espelhado na reta
  que passa pela ponta em esquadro com a alça, e a tangente cai na direção
  pedida.

### Círculo e espiral com as medidas guardadas

- A peça feita pelo "Por raio" ou pela "Espiral" guarda o que ela é
  (`Molde.figura`): o raio, ou a largura e o perímetro, o centro e os eixos em
  que foi desenhada.
- Com a ferramenta ligada, um anel marca o centro de cada figura já feita. O
  clique nele abre as medidas.
  - **Círculo:** refeito com o raio novo, no mesmo centro. A linha de fio, as
    linhas, as marcas e os piques crescem ou encolhem junto.
  - **Espiral:** refeita no mesmo centro. Os piques vão para o ponto mais
    próximo da borda nova; a linha de fio é levada para dentro da tira se
    ficar de fora; o resto fica onde está.
- O registro acompanha a peça movida, girada e espelhada. Deixa de valer, sem
  erro, quando o contorno já não é o da figura: um ponto mexido, a peça
  cortada, dobrada ou dimensionada.

### Prega sem registro

- Com a ferramenta "Pregas", o clique dentro de uma prega que não tem registro
  abre as medidas dela, se o desenho é o que a ferramenta faz:
  - duas linhas internas retas (as bordas da abertura), de um ponto do
    contorno a outro, com as pontas vizinhas no contorno;
  - entre elas, a linha do meio (simples) ou as três que repartem a abertura
    em quatro (dupla);
  - uma borda em esquadro com a abertura numa ponta, e as duas do mesmo
    comprimento (até 0,01 mm).
- O que é lido do desenho, e dito na janela:
  - o lado da linha de fio é o que ficou parado;
  - a seta diz para que lado a prega dobra; sem seta, "para a direita";
  - a ponta que, fechada a peça, fica no meio de uma reta é dada como posta
    pela prega, e sai com ela;
  - os piques que estão nas pontas das linhas de dobra são os da prega.
- Aplicando, a prega passa a ter registro; fechando sem aplicar, nada muda.

## O que NÃO foi feito

- **O comprimento da alça de tangente não muda a curva.** Só a direção.
- **A alça não passa de 85°** da reta até o ponto de passagem: a curva não faz
  a volta para trás na ponta.
- **Dimensionar tira o registro do círculo e da espiral**, mesmo por igual nos
  dois sentidos.
- **Na espiral refeita, o que está desenhado dentro não acompanha.**
- **A graduação da peça não acompanha o raio novo do círculo.**
- **A prega desenhada à mão sem a linha do meio não é reconhecida**, nem a que
  foge mais de 0,01 mm do desenho da ferramenta.
- **A ponta da prega que já era um ponto do contorno no meio de uma aresta
  reta é lida como posta pela prega**, e sai quando a prega é tirada. A forma
  da peça não muda; o ponto, sim.
- **A linha que a prega antiga tirou de cima da linha dela não volta**: o
  desenho não diz que ela existiu.

## Verificação (Electron real, build de produção)

- **Testes:** 1640/1640 em 78 arquivos (eram 1580).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 50 mutações guardadas, uma por vez. Duas sobreviveram: a regra do lado da
    linha de fio (as linhas estavam sempre na ordem que dava certo por acaso)
    e um filtro repetido. Entrou o teste com as linhas na outra ordem, e o
    filtro repetido saiu; as duas passaram a ser pegas. Os arquivos foram
    conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - **Alça de tangente:** a curva saía da ponta a 169,3°; com a alça apontando
    a 124,3°, passou a sair a 124,4°. A alça para trás foi recusada. Delete
    devolveu os 169,3°.
  - **Círculo** desenhado com raio de 99,4 mm; pelo centro, mudado para 150:
    todos os pontos a 150,0 mm do centro, 144 lados, a linha de fio de 100
    para 150 mm.
  - **Espiral** de 30 × 300 mm refeita com 20 × 200: de 118,3 para 52,4 cm²,
    com a linha de fio levada para dentro da tira.
  - **Prega sem registro:** uma prega da ferramenta, com a seta apagada (o
    registro deixa de valer). O clique na faixa abriu as medidas, com o aviso
    de que foi reconhecida; fechada sem aplicar, nada mudou; com 30 mm, a peça
    foi de 1360,0 para 1440,0 cm²; tirada, voltou a 1200,0 cm², 4 pontos e
    nenhuma linha.
  - Validação sem problemas no fim.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
