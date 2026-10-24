# ADR 0111 — O provador 3D (aproximado)

## Contexto

Fase 7 do estudo de funcionalidades (ADR 0099). A referência tem um módulo 3D com estas partes:
- o manequim com medidas;
- a costura virtual dos moldes 2D no manequim;
- o caimento pelas propriedades do tecido, com os pontos de tensão;
- as cores, as estampas e os aviamentos;
- a imagem para o catálogo.

O estudo marcou o caimento como **P**: uma física simplificada, que não substitui a peça-piloto. O programa não tinha
3D nem biblioteca de 3D. Tudo aqui é TypeScript puro, desenhado num canvas comum, sem dependência nova.

## Decisão

**Conferência › 3D › Provador 3D** abre a janela (`ui/PainelDoProvador3D.tsx`). A tela fica dividida em duas:
- **à esquerda**, o manequim num fundo de estúdio:
  - arrastar gira, a roda aproxima;
  - Frente, Lado e Costas;
  - Simular, Continuar e Recomeçar;
  - Mapa de tensão;
- **à direita**, as abas.

### O manequim (`domain/manequim.ts`, aba Manequim)

- **As medidas:** dez medidas em cm. Altura, busto, cintura, quadril, ombro a ombro, pescoço, braço, comprimento do
  braço, entreperna e coxa. Cada uma fica dentro de limites.
- **De onde vêm:**
  - de um público: feminino, masculino ou infantil;
  - digitadas;
  - de um tamanho da ficha técnica. As medidas do corpo saem do guia de medidas (a peça menos a folga, ADR 0110), e a
    janela diz quais vieram da ficha.
- **O corpo:**
  - o tronco em seções elípticas empilhadas, do gancho ao pescoço; a volta de cada seção bate com a medida;
  - os braços (um pouco abertos) e as pernas em cones arredondados;
  - a cabeça num elipsoide.
- **A colisão:** a distância de um ponto ao corpo sai com a normal para fora. No tronco, a normal leva em conta a
  inclinação das seções, então no ombro ela sobe.
- **O desenho:** uma malha de triângulos com a frente para fora.

### As peças (`domain/montagem3d.ts`, aba Peças)

- **As instâncias:**
  - cada cópia de uma peça é uma instância, até 4 por peça;
  - a segunda de um par sai espelhada (a manga esquerda);
  - a peça com linha de simetria entra desdobrada (a peça inteira).
- **A peça vista pela face:** como na tela, com o fio na vertical. O alto da peça é o lado para onde o fio aponta para
  cima na tela. Com o fio deitado, o alto é a direita da tela: é como entra o desenho de um CAD, com o y do arquivo
  para cima.
- **O que se escolhe em cada peça:**
  - onde vai: frente, costas, laterais, braço direito ou esquerdo (manga), perna direita ou esquerda (frente ou
    costas), ou fora;
  - a altura do topo (pescoço, ombro, busto, cintura, quadril) e quanto sobe;
  - quanto vai para o lado;
  - o giro de 90 em 90 graus;
  - a cor;
  - a estampa.
- **O que vem do nome da peça:** frente e costas, manga em par, calça nas pernas; saia e calça começam na cintura. O
  resto fica fora.
- **A cor de partida** é a mesma em todas as peças, porque uma roupa é de um tecido só. Cada peça pode mudar depois.
- **A arrumação:** antes de costurar, cada peça é enrolada em volta do corpo, medida pelo comprimento, sem esticar.
  - **No tronco:** uma elipse 3 cm afastada do corpo, grande o bastante para meia volta caber na peça. Assim a frente
    e as costas se encontram dos lados.
  - **Nos braços e nas pernas:** um cilindro em volta do eixo.
- **A montagem fica no projeto** (`Projeto.montagem3d`): o manequim, as peças, as costuras, o tecido e a resolução. A
  simulação não fica.

### As costuras (aba Costuras)

- **Uma costura** liga um trecho do contorno de uma peça (do ponto *de* ao ponto *até*, no sentido do contorno) ao
  trecho de outra, ou da mesma peça. Ela pode ser **invertida**.
- **Sugerir costuras** acha dois lados do contorno (os trechos entre os cantos de mais de 35°), de mesmo comprimento
  (até 3%), que sejam:
  - **laterais**: mais em pé que deitados, fora da faixa de cima da peça, lado a lado na arrumação (até 16 cm, sem o
    meio se afastar). São as laterais e o embaixo do braço;
  - **ombros**: no alto das peças de cima, mais deitados que em pé, um sobre o outro visto de frente.

  A barra, o cós, o decote e a cava não são sugeridos. Isso foi conferido com uma saia e com uma regata.
- **À mão:** em cada lado, escolhe-se a peça e clica-se no ponto onde a costura começa e no ponto onde acaba, no
  contorno pequeno (com os cantos numerados). Também dá para digitar os números. O sentido é o que fica mais perto
  na arrumação.
- **O molde mudou:** cada costura guarda como era o contorno (os pontos e o perímetro). Se a peça mudou ou sumiu, a
  costura diz o que houve. A que aponta para pontos que não existem mais fica fora da simulação.

### O caimento (`domain/simulacaoDoTecido.ts`)

- **As partículas:** a malha de cada peça (`domain/malhaDaPeca.ts`). O contorno é amostrado com todos os pontos do
  molde, o miolo numa grade triangular, e os triângulos por Delaunay, sem os que caem fora da peça.
- **As restrições**, resolvidas pelo método das posições com complacência (XPBD), em passos pequenos (8 por quadro):
  - o **estiramento**: cada aresta quer o comprimento do molde;
  - a **flexão**: os dois pontos opostos de cada aresta interna;
  - as **costuras**: cada ponto de um lado com o ponto do outro na mesma fração do trecho.
- **As duas fases:**
  - **a costura**: 1,2 s sem gravidade e com o ar segurando, enquanto a distância das costuras vai a zero;
  - **o caimento**: com o peso.
- **O corpo e o chão** empurram o tecido para fora (3 mm), com atrito. O ponto empurrado é conferido de novo, porque
  na axila sair de um pedaço do corpo pode pôr o ponto em outro.
- **O tecido** (aba Tecido): seis prontos (malha, moletom, tricoline, jeans, seda e linho) ou um personalizado:
  - a gramatura (g/m²), que dá a massa;
  - a **elasticidade**, a **rigidez** e o **atrito**, de 0 a 100, que viram a complacência e o atrito da física;
  - a malha da simulação: 30, 20 ou 12 mm.
- **O fim:**
  - para quando o tecido assenta, ou em 10 s;
  - a janela diz a maior abertura das costuras, a tensão (a maior e a média) e de que altura a que altura do chão a
    roupa ficou;
  - avisa a peça que **escorregou do corpo** (o alto abaixo do gancho: a volta de cima larga demais, uma costura
    faltando, ou a peça de cabeça para baixo) e o tecido que entra no corpo mais de 5 mm.
- **O mapa de tensão** pinta cada triângulo pelo quanto ele está esticado:
  - verde até 1%;
  - amarelo em 4%;
  - vermelho de 8% para cima;
  - azul, o encolhido.

### O desenho (`ui/cena3d.ts`)

- **A projeção:** câmera em órbita, perspectiva, cada triângulo iluminado pela direção dele.
- **A ordem:** o mais longe é pintado primeiro. O tecido vem 25 mm à frente na ordem, porque fica a 3 mm do corpo e um
  triângulo grande do corpo o cobriria.
- **As faces:** o corpo esconde as de trás. O tecido mostra os dois lados, com o avesso mais escuro.
- **A estampa** é uma das imagens do modelo, **corrida** (repete, com a largura em mm) ou **localizada** (uma vez, no
  meio da peça, com quanto sobe).
  - Ela vai pela face da peça, então a do par não sai espelhada.
  - Uma transformação afim por triângulo, em seis tons já sombreados, sem película de sombra por cima (que marcaria
    as emendas).
- **Os botões:** os furos do molde aparecem como botões, presos ao triângulo em que caem.
- **A imagem (aba Imagem):** "Salvar esta vista" ou "Salvar frente, lado e costas", em PNG de fundo branco.

### O molde 2D refletido no 3D

A janela monta tudo pelas peças de agora, a cada vez que abre. A mudança no molde aparece no 3D, e as costuras que
dependiam do contorno antigo avisam.

## O que não foi feito

- **A física é simplificada:**
  - o tecido não colide com ele mesmo;
  - os vincos aparecem só na escala da malha (12 a 30 mm);
  - a elasticidade é a mesma nos dois sentidos (sem trama e urdume diferentes).
  
  Mostra o caimento e onde a peça repuxa, mas não substitui a peça-piloto.
- **Peças fora do corpo:** a gola, o punho e o bolso só vão como "fora", ou postos à mão numa das posições. Não há
  posição sobre outra peça.
- **A textura do tecido** (o relevo da trama) é só uma imagem corrida, sem relevo.
- **As medidas da pessoa da recomendação** não vão para o manequim: são dados pessoais, e não são guardadas (ADR 0110).

## Conferência

- `domain/provador3d.test.ts` (15):
  - o manequim: as voltas batem com as medidas; a distância e a normal (no ombro, para cima); a malha para fora; os
    limites; o tamanho da ficha;
  - a malha: Delaunay; a soma das áreas é a área da peça; os pontos do molde na borda; os trechos, dando a volta;
  - a montagem:
    - a face com o fio para cima;
    - a peça de um CAD;
    - a frente na frente e as costas atrás;
    - as costuras sugeridas da saia (as laterais, não o cós nem a barra) e da regata (as laterais e os ombros, não a
      cava, o decote nem a barra);
    - o molde mudou;
    - a leitura;
  - a simulação:
    - a saia fica entre a cintura e o quadril, com as costuras fechadas e nada atravessando;
    - a regata fica pendurada pelos ombros;
    - mais elástico estica mais.
- `ui/PainelDoProvador3D.test.tsx` (6):
  - as posições pelo nome, guardadas;
  - as costuras: sugeridas, à mão pelos pontos, inverter, tirar;
  - o aviso do molde mudado;
  - o manequim (público, medida, tamanho da ficha);
  - o tecido (pronto e personalizado);
  - sem peça não simula; com a saia, simula até assentar e diz onde a roupa ficou.
- `ui/BarraDeFerramentas.test.tsx`: o grupo 3D da aba Conferência.
- `npx vitest run`: 159 arquivos, 2876 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro.
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - a saia de teste (`scripts/teste-de-uso/saia-de-teste.dxf`) entra pelo Importar DXF;
  - o Provador 3D abre;
  - a frente e as costas vão ao corpo, e a peça da foto vai para fora;
  - as duas laterais são sugeridas;
  - a simulação assenta com as costuras fechadas e a saia no corpo, de 41 a 98 cm do chão;
  - o mapa de tensão aparece (vermelho no quadril: a saia de teste tem 87 cm de volta na altura de um quadril de
    100);
  - a foto entra como estampa localizada;
  - o PNG das três vistas, com 1800 px de largura, é gravado;
  - a montagem fica no projeto;
  - 64 conferências, nenhuma falha.
- **A primeira versão do teste deixou passar uma saia caída no chão.** A peça importada entrava de cabeça para baixo,
  e o teste só conferia as costuras. Agora a janela diz a altura da roupa, avisa a que escorregou, e o teste confere
  que a saia fica entre a cintura e o quadril.
