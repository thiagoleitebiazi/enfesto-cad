# ADR 0114 — O provador 3D e a estampa no encaixe com peças de verdade

## Contexto

O provador 3D (ADR 0111) e a estampa no encaixe (ADR 0113) foram feitos e conferidos com peças desenhadas para o
teste: uma saia, uma regata. Passados pelos dois DXFs reais do usuário (a camiseta tamanho G de "test modelagem" e
de "teste 2 com outra coisa", lidos só por cópias no scratchpad, nunca no repositório), apareceram erros que as
peças de teste não mostravam.

**1. O alto da peça.** Os dois arquivos não têm linha de fio, e a importação põe uma deitada em cada peça. As peças
vêm viradas de qualquer jeito no arquivo de encaixe, e o alto era decidido pelo sentido do fio. Resultado:
- **das três peças da camiseta, só a frente ficava de pé**: as costas estão viradas 180° no arquivo, e a manga
  também;
- uma das mangas vem **inclinada 35°**, e a outra deitada de lado.

**2. Os cantos.** O SPLINE chega com um ponto a cada 2 ou 3 mm, e a virada de um canto se espalha por dois ou três
deles. **O ombro e o decote de um lado saíam como um lado só**, e a sugestão de costura não achava esse ombro.

**3. A malha.** Todos os pontos do contorno entravam na malha: 805 numa peça só, com triângulos finíssimos, quase sem
massa. **A camiseta de manga longa estourava:** abria 48 mm, e a tensão média chegava a 105%.

**4. Os pontos soltos.** Nas curvas côncavas (a cava, o decote), a reta entre duas amostras da borda passa um pouco
**por fora** da peça. O filtro tirava os triângulos da borda, e **sobravam 7 pontos soltos em cada corpo**, presos só
pela costura. Eles caíam até o chão.

**5. O ponto arremessado.** Na axila, entre o braço e o tronco, o empurrão do corpo virava velocidade, e os empurrões
se somavam até **lançar um ponto a 1 m do corpo**.

**6. A conta que não chegava lá.** Com uma volta das restrições por passo, a camiseta pendurada pelos ombros
**esticava o dobro do real** na costura do ombro. E o tecido mais firme saía com mais tensão, o contrário da física.

**7. O atrito na costura.** Com o atrito todo durante a costura, a manga comprida ficava presa esticada. Sem atrito
nenhum, a saia apertada subia no corpo que afina para cima, como um elástico num cone.

**8. "Assentou" nunca chegava.** A regra pedia todos os pontos parados, e uns poucos tremendo na axila seguravam a
simulação até o fim.

## Decisão

- **O alto pela forma** (`montagem3d.ts`):
  - a ponta mais **estreita** em cima: o decote e os ombros sobre a barra da blusa, a cintura sobre a barra da saia;
  - na **perna**, a mais larga (a cintura da calça);
  - a largura é medida cruzando o contorno com uma linha a 4% do comprimento de cada ponta; pontas quase iguais (até
    8%) não decidem;
  - na **manga**, o **eixo**: do meio do punho (o lado mais oposto à cabeça, entre os que têm ao menos 10% do contorno)
    ao alto da cabeça (o lado mais abaulado, de bojo de 12% da corda para cima). O alto da cabeça vai no alto do
    braço. A cabeça de uma manga de verdade não é simétrica, e a perpendicular à corda saía torta; a manga se torcia.
- **O giro em qualquer ângulo** no provador: ↺/↻ de 15°, o campo do ângulo, "Virar 180°" e "Pela forma". Cada peça
  mostra uma **miniatura** como vai no corpo, com a seta do alto. Trocar onde a peça vai refaz o alto pela forma.
- **Os cantos por uma janela** de 6 mm para cada lado: a virada maior que 35°, e um canto só por virada. Numa curva de
  raio de 2 cm para cima, a janela vira menos de 35°.
- **A manga com as cavas**, sugerida junto com as outras costuras:
  - em cada manga posta num braço, a cabeça vai com a cava da frente e com a das costas do mesmo lado (os lados
    livres do alto do tronco mais perto do ombro), se tiver o comprimento das duas juntas (até 10%);
  - a cabeça é dividida no ponto em que o comprimento da cava da frente acaba;
  - a ponta de baixo de cada metade vai com a ponta de baixo da cava.
- **A malha:** a borda é reamostrada pela curva a cada 20 mm, mais ou menos, passando exatamente pelos cantos e pelos
  pontos onde as costuras começam e acabam. Os outros pontos do molde apontam para a amostra mais perto. Cada ponto
  tem uma massa mínima (a quarta parte da média). O triângulo rente à borda (até 30% do espaço da malha) fica.
- **A colisão:**
  - o empurrão do corpo não vira velocidade para fora: o tecido não quica;
  - nenhum ponto passa de 3 m/s;
  - o ponto empurrado para fora de um pedaço do corpo é conferido de novo, até três vezes.
- **A conta:**
  - o estiramento e as costuras são resolvidos **três vezes por passo**, e a colisão, que é o que custa, uma só;
  - o atrito durante a costura é 30% do atrito do tecido;
  - "Assentou" quando menos de 2% dos pontos ainda se mexem.
- **A mão** do manequim: um cone curto depois do pulso.
- **A estampa no encaixe** (`impressaoDigital.ts`): o alto pela forma, como no provador (calça, bermuda e short com a
  ponta larga em cima); a manga, pelo nome, pelo eixo dela. Cada peça tem o giro da estampa à mão (de 15° em 15°),
  guardado no projeto (`giroPorPeca`).
- **A lista de costuras:** o texto à esquerda, e "Inverter" e "Tirar" juntos à direita.

## O resultado com a camiseta real (8 s de simulação, malha de 20 mm, manequim masculino)

| | Manga curta | Manga longa |
|---|---|---|
| Costuras sugeridas | 10 (2 laterais, 2 ombros, 2 embaixo do braço, 4 da cabeça com a cava) | 10 |
| Maior abertura das costuras | 1,5 mm (antes 3,6) | 2,3 mm (antes 47,8) |
| Tensão média | 2,2% (antes 6,8) | 2,4% (antes 104,8) |
| Triângulos acima de 50% | 0 (antes 35) | 21 de 6992, na junção da axila (antes 62) |
| Do chão ao alto | de 73 a 148 cm, pendurada nos ombros | igual, e assenta em 3,9 s |

## O que não foi feito

- A junção das quatro costuras na axila da manga longa ainda tem triângulos esticados (cerca de 0,3% da malha).
- A cabeça da manga é dividida num ponto que já existe no molde. Num arquivo com poucos pontos na cabeça, a metade
  pode ficar até 9 mm diferente da cava; a costura reparte a diferença.

## Conferência

- `domain/provador3d.test.ts` (21):
  - o canto de um SPLINE é um canto só, e a curva suave não é canto;
  - a regata virada 180° volta com o decote em cima; na perna, a ponta larga;
  - a manga inclinada 135° fica de pé pelo eixo;
  - a malha de um contorno de 2 em 2 mm: a borda reamostrada, o ponto pedido exato, nenhum ponto solto;
  - a camiseta com mangas: as 10 costuras, cada metade da cabeça na cava do lado do braço;
  - a camiseta vestida: pendurada nos ombros, as costuras fechando, as mangas nos braços, a tensão média abaixo de 5%;
  - os testes que simulam têm 30 s (na bateria inteira, tudo roda junto).
- `domain/impressaoDigital.test.ts` (8): a saia virada no arquivo com a cintura em cima; a calça com a ponta larga; o
  giro pedido; a manga inclinada pelo eixo.
- `ui/PainelDoProvador3D.test.tsx` e `ui/PainelDaImpressaoDigital.test.tsx`: os botões de girar, o campo, "Virar",
  "Pela forma", a miniatura, e o giro da estampa guardado.
- `npx vitest run`: 164 arquivos, 2914 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro.
- O teste de uso do repositório, no programa gerado: 75 conferências, nenhuma falha. A saia de teste agora tem
  tensão média de 2,7% (antes 5,7).
- A camiseta real pela tela, num roteiro fora do repositório: as miniaturas com o alto certo; as 7 costuras com uma
  manga; a camiseta no manequim.
