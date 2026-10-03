# ADR 0023 — Corrige bug real das réguas, alternância cm/mm, leitura DX/DY/distância/ângulo

## Contexto

Um prompt longo e estruturado pedia uma modelagem completa de molde
(pences, dobrar/desdobrar, extração/união de contorno, curvas com nº de
pontos editável) — escopo que, após esclarecido via `AskUserQuestion`,
pertence ao domínio do moda-cad, não do enfesto-cad, e que o usuário
decidiu adiar lá (moda-cad está formalmente congelado para novas
funcionalidades grandes, em meio ao primeiro piloto externo controlado —
ver memória `moda-cad-pending-pattern-drafting-prompt`).

O usuário então pediu explicitamente para prosseguir **neste projeto**
(enfesto-cad), focando no que já havia sido proposto como subconjunto
apropriado: edição de pontos, régua, organização "iguais à imagem" de
referência. Este ADR cobre o primeiro corte concreto e seguro desse
subconjunto — nada de pences/dobrar-desdobrar/extração automática
(continuam fora de escopo aqui).

## Decisão

### Bug real encontrado e corrigido: réguas só desenhavam uma marca

Ao instrumentar a régua para a alternância de unidade, ficou evidente
que `telaParaMundo`/`mundoParaTela` (ADR 0012, troca de eixos
mundo.y↔tela.x / mundo.x↔tela.y) nunca tiveram o código de desenho das
réguas atualizado para a nova convenção: a régua horizontal lia o campo
`.x` de `telaParaMundo` (que depende de `p.y`, fixo em `0` nas duas
chamadas de `mmInicial`/`mmFinal`) em vez do `.y` (que depende de `p.x`,
o eixo que realmente varre a régua horizontal) — e o mesmo trocado ao
inverso na régua vertical. O resultado prático, presente desde o ADR
0012: **cada régua desenhava no máximo uma marca, sempre no canto**,
mascarado nas capturas de tela anteriores por aparecer só como um "-40"
isolado no canto esquerdo, nunca notado como anomalia até agora.
Corrigido em `AreaDeDesenho.tsx` (os dois `useEffect` de régua), com
comentário explicando a convenção para não repetir o erro.

### Alternância cm/mm

`.regua-canto` (antes uma `<div>` estática com o texto "cm") virou um
`<button>` que alterna um novo estado local `unidadeDaRegua: 'cm' |
'mm'`. Nova função pura `valorDaReguaEmUnidade(mm, unidade)` em
`transformacaoDeTela.ts` (testada) faz a conversão só na exibição — a
geometria interna de toda a aplicação continua em mm, sem nenhuma
mudança de precisão ou de modelo de dados.

### Leitura DX/DY/distância/ângulo durante a construção

Nova função pura `anguloEmGraus(a, b)` em `core/geometria.ts` (mesma
convenção 0°=+x, anti-horário positivo, já usada por
`anguloDaLinhaDeFio`). `BarraDeStatus` ganhou uma prop opcional
`pontoReferencia`: quando o modo é "Novo Molde"/"Novo Furo" e já existe
ao menos um ponto confirmado no contorno em edição, a barra de status
mostra `DX`/`DY`/`Dist`/`Âng` relativos ao último ponto confirmado e à
posição atual do cursor — mesmo padrão de leitura numérica de um CAD
profissional (seção 4.1 do pedido original), usando dados que já
existiam (`pontosEmEdicao`, `cursorMundo`), nada inventado.

## O que foi deliberadamente NÃO feito aqui

- **Pences/pinças, dobrar/desdobrar, extração/união automática de
  contorno, curvas com nº de pontos editável**: domínio do moda-cad,
  explicitamente fora de escopo por decisão do usuário nesta sessão.
- **Margem de costura por aresta com início/fim diferentes** (seção 4.7
  do pedido original): avaliado e propositalmente adiado — mudar de um
  valor único por peça para um valor por aresta (ainda mais com
  afunilamento início≠fim) é uma mudança real de esquema de dados, com
  impacto em persistência (migração), exportação/importação de PDF (o
  importador hoje estima a margem a partir do deslocamento uniforme da
  linha de corte — um valor variável por aresta exigiria um parser bem
  mais complexo) e nesting. Dado o pedido explícito de "não pode haver
  erro", essa mudança de alto risco geométrico/esquema merece seu
  próprio checkpoint dedicado, não deve ser empacotada às pressas junto
  de uma correção de régua.
- **Ferramentas de construção adicionais** (ponto por coordenada, ponto
  por distância, arco por dois pontos, extensão de reta): o "Novo
  Molde" atual já cobre construção por cliques sucessivos; essas
  variantes ficam para um próximo checkpoint, se pedido.

## Verificação (Electron real, build de produção)

- Capturas de tela antes/depois confirmam visualmente: régua horizontal
  agora mostra uma sequência completa e uniformemente espaçada
  (-20, 0, 20, 40 ... 420 em cm), régua vertical idem (0, 20, 40 ...
  160) — antes mostrava só uma marca isolada.
- Clique no canto "cm"/"mm" alterna corretamente (DOM confirma texto do
  botão mudando) e os números da régua mudam de escala mantendo as
  mesmas posições de marca (mesmos múltiplos "redondos" em mm,
  exibidos em unidades diferentes).
- Durante "Novo Molde", após um clique e um movimento do mouse, a barra
  de status mostra `DX: -969.2 mm DY: -607.7 mm Dist: 1144.0 mm Âng:
  -147.9°` — valores coerentes com a distância percorrida na tela.
- 256/256 testes (4 novos: `anguloEmGraus` ×2, `valorDaReguaEmUnidade`
  ×2), typecheck/lint/build limpos.

## Consequências

- `core/geometria.ts`: nova função pura `anguloEmGraus`, sem efeito em
  nenhum código existente.
- `ui/transformacaoDeTela.ts`: novo tipo `UnidadeDeRegua` e função pura
  `valorDaReguaEmUnidade`, sem alterar `mundoParaTela`/`telaParaMundo`.
- `ui/AreaDeDesenho.tsx`: `.regua-canto` passa de `<div>` para
  `<button>` (CSS ajustado); novo estado local `unidadeDaRegua`.
- `ui/BarraDeStatus.tsx`/`App.tsx`: nova prop opcional
  `pontoReferencia`, não quebra nenhum outro uso do componente.
