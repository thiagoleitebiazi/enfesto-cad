# ADR 0127 — O consumo do tecido pelo desenho técnico

## Contexto

O quarto item da segunda rodada do estudo: a referência estima o consumo do tecido pelas áreas do desenho, antes do
molde. Quem cria a coleção quer saber quanto tecido a roupa gasta (e o custo dela) quando só existe o croqui. O
encaixe só vem semanas depois, com o molde pronto.

A ficha técnica (ADR 0105) tinha dois consumos:
- "Informado": o número digitado;
- "Pelo encaixe da mesa": o comprimento do encaixe pelas roupas que ele tem. Sem molde, não há encaixe.

O desenho técnico (ADR 0107) já tinha o que falta para medir: os contornos fechados da roupa, de frente e de costas, e
as cotas ligadas às medidas da ficha (ADR 0117). Uma cota de 200 unidades da folha ligada ao comprimento de 70 cm diz
que cada unidade tem 3,5 mm.

## Decisão

**1. A escala pelas cotas** (`escalaDoDesenho`, em `domain/consumoPeloDesenho.ts`):
- **Cada cota** ligada a uma medida com valor no tamanho dá milímetros por unidade: o valor da medida pelo comprimento
  da cota na folha.
- **Com mais de uma cota,** vale a do meio, e a diferença entre elas é guardada.

**2. As formas que entram:**
- **Quais:** os traços fechados de estilo contorno (`formasDoConsumo`): o corpo da roupa, e o bolso ou a gola
  desenhados por cima, que também são tecido.
- **O espelho:** a forma espelhada vale com o espelho, pela área da união (`areaDaUniao`, por faixas). A parte que
  passa do meio da folha não conta duas vezes.
- **O que fica de fora:** os traços abertos, as costuras, os pespontos e os detalhes.

**3. O consumo "Pelo desenho técnico" na ficha** (o terceiro tipo do item, `ConsumoDoItem`):
- **A conta:** a área de frente e costas na escala do tamanho, mais o acréscimo de costura e folga (15% de partida,
  pela margem e pelo que o desenho não mostra), dividida pelo aproveitamento esperado do encaixe (80% de partida).
- **O resultado:** os m² de tecido; em metros, pela largura do tecido (a do material ou a do projeto); em quilos, pela
  gramatura do material.
- **O tamanho:** por padrão o do meio da ficha, ou o escolhido no item.
- **Na tabela,** a linha diz como saiu ("frente 0,245 m² + costas 0,245 m², na escala da cota de Comprimento (70 cm no
  M); + 15% de costura e folga, ÷ 80% de aproveitamento = 0,704 m² de tecido ÷ 1,60 m de largura").
- **O pré-custo** usa esse consumo como os outros. No custo por tamanho, o tecido "pelo desenho" de cada tamanho sai na
  escala das medidas dele.
- **Se falta algo** (o desenho, um contorno fechado, a cota ligada, a largura, a gramatura), o motivo é dito no lugar
  do número.

**4. A área no próprio desenho técnico:** uma caixa azul no fim das propriedades, sempre à vista. Ela mostra:
- a área no tamanho do meio, em número grande;
- como saiu;
- quantos contornos entraram;
- o tamanho que a roupa desenhada tem nessa escala ("33 × 66 cm"), para conferir de olho.

**5. O tamanho que nenhuma roupa tem é avisado** (`avisoDoTamanhoDaRoupa`):
- **Quando:** a roupa sai com mais de 1,60 m, ou menos de 10 cm, de largura ou de altura.
- **Onde:** em vermelho na caixa, e no começo da explicação da ficha.
- **O erro de sempre:** a medida de uma volta inteira (o busto de 100 cm) ligada a uma cota que atravessa só a frente,
  que dobra a escala. O próprio teste de uso tem esse caso, e o aviso apareceu nele: "a roupa tem 163 × 234 cm".

**6. A tabela de materiais:** os campos de número ficam curtos e na linha do texto ("no tamanho [M], costura e folga
[15] %, aproveitamento [80] %"). Antes, o campo curto perdia para a regra que deixa todos os campos da tabela na
largura toda, e o "Informado" e o "Pelo encaixe" também ocupavam a coluna inteira.

## O que não foi feito

- **Cada forma num tecido** (o corpo na malha, a gola na ribana): todos os contornos entram no item "Pelo desenho". A
  gola de outro tecido é desenhada com outro estilo e o consumo dela é informado.
- **A manga vista de lado:** de frente e de costas, a manga aparece pela metade em cada vista, e a soma das duas dá a
  manga inteira. A manga longa caída rente ao corpo, escondida atrás dele, não entra.
- **O ajuste pelo encaixe de verdade:** quando o molde fica pronto, o "Pelo encaixe" dá o número real. O "Pelo
  desenho" não aprende com ele.

## Conferência

- `domain/consumoPeloDesenho.test.ts` (8):
  - **a área da união:** o quadrado, dois separados, dois que se cruzam, o triângulo;
  - **as formas:** só os contornos fechados; a espelhada no dobro; a que passa do meio sem repetir o meio;
  - **a escala:** pela cota no M e no G; com duas cotas, a do meio e a diferença; sem medida no tamanho, ou sem cota
    ligada, nenhuma;
  - **a área da roupa:** frente e costas (0,245 m² cada), o tamanho dela (35 × 70 cm), o texto, e o que falta;
  - **o tamanho improvável:** grande demais e pequeno demais;
  - **o tamanho do meio;**
  - **na ficha:**
    - em m², em metros pela largura (a do material antes da do projeto), em cm e em quilos;
    - o G na escala dele;
    - os erros (sem largura, sem gramatura, em unidades, sem ficha, sem tamanhos, aproveitamento zero) e a validação.
- `ui/PainelDoDesenhoTecnico.test.tsx` (2 novos): a caixa com 0,436 m² e 33 × 66 cm no P; sem cota, o que falta.
- `ui/PainelDaFichaTecnica.test.tsx` (1 novo): o tecido "Pelo desenho técnico" dá 0,440 m e R$ 8,80, com a
  explicação; no G, a escala do G; o aproveitamento muda a conta.
- `npx vitest run`: 170 arquivos, 3023 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 101 conferências, nenhuma falha, nenhum aviso no console. As duas novas:
  - **no desenho técnico:** com a cota do busto, a caixa mostra a área, a escala, o tamanho da roupa e o aviso de
    grande demais (o busto da ficha é a volta inteira);
  - **na ficha:** um tecido em m² "Pelo desenho técnico" dá exatamente a área do desenho × 1,15 ÷ 0,80 (7,203 m²
    para 5,011 m²), e depois é tirado.

  Ao montar o teste, o passo de arrastar o cartão no quadro das etapas (ADR 0118) falhou duas vezes e passou na
  terceira. O caminho medido mostrou o cartão parado antes do ponto final do mouse também na rodada que passou: o
  sistema perde às vezes os últimos movimentos mandados de uma vez. O teste agora repete o último movimento até o quadro
  mostrar a coluna debaixo do mouse.
