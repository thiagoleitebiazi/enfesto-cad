# ADR 0036 — Cotas fixas, Comparar distância, Converter em contorno, Inverter moldes e Variantes

## Contexto

O ADR 0035 deixou desligadas, entre outras, as cotas fixas da aba Conferência e
quatro ferramentas de comportamento não confirmado. O usuário pediu para fazer
tudo o que tinha ficado de fora, inclusive a modelagem (curvas, arcos, pences,
pregas, bainha, dobrar, cortar e unir moldes, graduação). Isso muda uma decisão
dele de 3 de outubro, de manter a modelagem fora deste programa; vale o pedido
de agora.

O trabalho segue em etapas, cada uma testada no programa real e com ADR e
commit próprios. Esta é a primeira: as cotas e as quatro ferramentas não
confirmadas.

O manual da referência descreve as cotas e a janela "Distância entre pontos".
Não descreve Converter em contorno, Inverter moldes nem Variantes, e a busca em
outras fontes não achou nada. Nessas três, o comportamento é a leitura deste
programa para o nome da ferramenta, dita na dica.

## Decisão

### Cotas fixas (`domain/cota.ts`, `ui/cotas.ts`)

Uma cota é uma medida escrita no desenho, **guardada na peça** em que foi
criada (`Molde.cotas`, campo opcional):

- anda, gira, espelha e escala com a peça (`transformarCota`, chamada por
  `transladarMolde`, `rotacionarMolde`, `espelharMolde` e `dimensionarMolde`);
- o encaixe automático também a leva, porque monta as peças com essas funções;
- desfazer e refazer valem para ela, e ela vai para o arquivo do projeto;
- o número é sempre calculado dos pontos guardados, nunca digitado.

As quatro ferramentas, na aba Conferência:

- **Cota distância**: dois pontos e um clique para a posição da linha de cota.
  Mede em linha reta.
- **Horizontal / Vertical**: dois pontos e um clique para a posição. Posta
  acima ou abaixo dos pontos, mede a horizontal da tela; ao lado deles, a
  vertical. O manual troca de eixo com o botão direito do mouse; aqui quem
  escolhe é a posição.
- **Ângulo**: um ponto de um lado, o vértice, um ponto do outro lado e a
  posição do arco, na ordem do manual. Mede de 0° a 180°.
- **Cota perímetro**: um clique dentro da peça deixa o perímetro dela escrito
  ali, e o número acompanha as mudanças da peça.

Regras comuns:

- Perto de um vértice (10 px), o clique cai exatamente nele, como na Distância.
- A cota fica com a peça do primeiro clique ou, clicando fora de todas, com a
  peça selecionada.
- Enquanto falta só o clique da posição, a cota aparece em prévia.
- **Apagar:** com uma ferramenta de cota ligada, um clique no número de uma
  cota a apaga. A faixa de mensagens diz isso.
- Uma cota de horizontal ou vertical guarda a direção medida. Se a peça gira,
  a direção gira junto e a medida continua a mesma.

**Raio** continua desligado: a cota de raio precisa de um arco, e as curvas
daqui são sequências de pontos, sem raio guardado.

### Comparar distância

Mede duas distâncias (dois pontos cada) e mostra as duas e a diferença, como o
Comparar perímetros. A terceira medida recomeça a comparação. A janela da
referência acumula várias somas e subtrações e separa por tamanho da graduação;
aqui são duas medidas.

### Converter em contorno (`converterCosturaEmContorno`)

A linha de corte, que é o contorno afastado pela margem de costura, passa a ser
o contorno da peça, e a margem volta a zero. Cada pique vai para o ponto mais
próximo do contorno novo. Vale para as peças selecionadas que têm costura.

### Inverter moldes

Faz o mesmo que Inverter seleção. Na referência há objetos que não são moldes;
aqui todo objeto é um molde.

### Variantes (`domain/projeto.ts`, `ui/PainelDeVariantes.tsx`)

Uma variante é uma cópia do projeto aberto para testar outra versão do mesmo
trabalho (outras quantidades, outro tecido, outro encaixe):

- é um projeto inteiro da Biblioteca, com histórico próprio, ligado ao original
  pelo campo opcional `varianteDe`;
- a variante de uma variante continua ligada ao mesmo original;
- o diálogo lista a família, marca a que está aberta, abre as outras e cria
  uma nova com o nome sugerido ("Camisa — variante 2");
- ao criar ou trocar de variante, o projeto aberto é salvo antes.

### Outras mudanças

- O clique no desenho passou a entregar também o ponto exato sob o mouse, sem a
  captura do ímã. É o que acha o número de uma cota e a peça dona dela.
- `abrirProjeto` foi dividido: `mostrarProjeto` põe na tela um projeto já
  carregado e serve à Biblioteca e às Variantes.

## O que NÃO foi feito

- **Cota de raio:** depende de arcos com raio guardado.
- **Cotas no PDF:** a exportação não as desenha.
- **Editar uma cota** (arrastar o número ou a linha): apaga-se e faz-se outra.
- **Cotas presas aos vértices:** a cota acompanha a peça inteira, mas, se um
  vértice medido for movido sozinho, a cota fica onde estava.
- **Comparar distância por tamanho e com somas acumuladas**, como na
  referência.
- **Conferência com a referência** de Converter em contorno, Inverter moldes e
  Variantes: não há descrição delas para comparar.
- **As demais etapas** (curvas e arcos; cortar, unir, dobrar e bainha; pences e
  pregas; graduação) ficam para os próximos ADRs.

## Verificação (Electron real, build de produção)

- **Testes:** 538/538 em 38 arquivos (eram 484 em 35).
  - Novos: cotas 16, cotas na peça e Converter em contorno 10, montagem das
    cotas pelos cliques 10, variantes no projeto 6, diálogo Variantes 6, fita
    +1, desenho +5.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático, janela de 1440 × 900 visível**, com as duas peças do
  DXF de teste. As cotas foram conferidas no arquivo salvo do projeto:
  - Cota distância na diagonal da peça de 300 × 400: 500,0 mm.
  - Horizontal / Vertical na outra peça: 400,0 mm (posta acima) e 300,0 mm
    (posta ao lado).
  - Ângulo num canto: 90,0°.
  - Cota perímetro: 1400,0 mm no desenho.
  - Arrastar a peça: cada ponto das cotas andou exatamente o mesmo que o
    contorno.
  - Espelhar: as medidas continuaram 400 e 300, e os pontos medidos
    continuaram sobre os vértices.
  - Dois Ctrl+Z devolveram a peça e as cotas ao lugar.
  - Um clique no número da cota da diagonal a apagou; Ctrl+Z a devolveu.
  - Comparar distância: 500,0 e 400,0 mm, diferença 100,0 mm, "a 1ª é maior".
    A terceira medida recomeçou.
  - Inverter moldes: de uma peça selecionada para a outra.
  - Converter em contorno, com costura de 10 mm: a peça passou de 400 × 300
    para 420 × 320 mm, 1344,0 cm², com costura 0. Ctrl+Z voltou a 400 × 300
    com costura 10.
  - Variantes: criar gerou um segundo arquivo de projeto, ligado ao original,
    com as mesmas peças e cotas; o programa passou a mostrar a variante; Abrir
    voltou à original.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). O
  roteiro usa uma pasta própria.
