# ADR 0013 — Aba "Manipulação": edição de pontos e transformações manuais

## Contexto

O usuário mandou um terceiro screenshot do Audaces, desta vez do módulo
"Moldes Avançado" — edição de molde ponto a ponto (mover/inserir/excluir
vértice, "Dimensionar" com fator X/Y, espelhar, girar, arredondar/chanfrar
cantos, alinhar, além de graduação de tamanhos e curvas Bézier), pedindo
"o mais parecido possível... até as funcionalidades funcionando 100%".

Essa tela é de um produto diferente do que o enfesto-cad foi escopado
para ser: é construção/edição de molde, o domínio central do projeto
irmão `moda-cad` (que já tem grading e curvas). Implementar tudo ali
duplicaria esforço real de engenharia e violaria a separação de escopo já
estabelecida entre os dois projetos (a mesma razão pela qual a "Ficha
Técnica" do ADR 0011 foi descartada, só que desta vez a sobreposição é
muito maior).

Perguntado diretamente (`AskUserQuestion`), o usuário escolheu
explicitamente a opção intermediária: implementar só as partes que fazem
sentido no domínio do enfesto-cad (edição de forma de uma peça já
desenhada, para ajuste/correção antes do encaixe), deixando de fora
graduação de tamanhos e curvas Bézier reais (que continuam sendo do
moda-cad).

## Decisões

### Escopo entregue

Nova aba "Manipulação" na barra em abas (ADR 0011), com três grupos:

1. **Pontos**: Mover ponto (arrasta um vértice), Inserir ponto (clique
   numa aresta insere um vértice novo ali), Excluir ponto (clique num
   vértice remove — bloqueado se o contorno ficaria com menos de 3
   pontos).
2. **Transformar**: Dimensionar (diálogo com Fator X/Fator Y
   independentes e prévia em mm do tamanho resultante, com opção "Fazer
   cópia"), Espelhar (inverte a peça horizontalmente, uma vez, ação
   manual), Girar em ângulo livre (diferente dos botões 90°/180°/270° já
   existentes).
3. **Organizar**: Alinhar (peças selecionadas em lote pela borda comum),
   Chanfrar canto e Arredondar canto (clique num vértice, informa
   distância/raio em mm).

### Por que "Girar em ângulo livre" e "Espelhar" NÃO passam pela mesma
### validação de sentido do fio que os botões 90°/180°/270°

Isto foi a decisão mais delicada do lote. Os botões 90°/180°/270°
existentes bloqueiam a rotação se `restricaoDeRotacao` não permitir —
correto, porque o motor de nesting tenta exatamente esses mesmos ângulos
a partir de onde a peça JÁ ESTÁ, então permitir manualmente um desses
ângulos fora da permissão abriria uma forma de contornar a regra.

Um ângulo livre (ex.: 47°) não tem essa relação com o motor de nesting —
o motor nunca tenta ângulos arbitrários, só os discretos permitidos. Girar
livremente é equivalente a ter desenhado a peça torta desde o início (o
usuário sempre pôde fazer isso ao clicar os pontos do "Novo Molde"), não
uma forma de escapar da restrição. Por isso `girarLivreSelecionada` reusa
`rotacionarMolde` sem checar `rotacaoEhPermitida`, mas com um aviso
explícito no próprio prompt: "Isto redefine a orientação de referência
desta peça — confira se a linha de fio (seta vermelha) continua alinhada
ao sentido correto do tecido". `anguloDeRotacaoGraus` continua sendo
atualizado normalmente (mostra a rotação real acumulada, não esconde que
a peça girou) — a peça não "finge" que nunca girou.

`espelharSelecionadaManualmente` segue o mesmo raciocínio: é uma edição
deliberada da FORMA como desenhada, diferente de `permiteEspelhamento`
(que controla se o MOTOR de nesting pode usar a versão espelhada
automaticamente). As duas coisas continuam sendo conceitos diferentes no
domínio, exatamente como já documentado no ADR 0011.

### Índices de pique ao editar o contorno

Um pique (`Pique.indiceAresta`) referencia uma aresta do contorno pelo
índice. Inserir/remover/chanfrar/arredondar um vértice muda quantas
arestas existem. Regra aplicada (documentada em `domain/molde.ts`):
quando a edição é inequívoca (o pique está numa aresta bem depois do
ponto editado), o índice só é ajustado; quando a aresta afetada é
exatamente uma das que mudou de forma, o pique é **descartado** em vez de
adivinhado — mais seguro que deixar um pique silenciosamente errado.
Testado explicitamente (`molde.test.ts`) para cada uma das 4 operações.

### Arredondar canto: arco tesselado, não curva real

Este app ainda não suporta curvas Bézier (`TODO.md`, decisão já
registrada no ADR 0010 para o botão "Curva" desabilitado). "Arredondar
canto" gera um arco aproximado por segmentos retos (8 por padrão) — uma
aproximação visualmente equivalente para fins de corte/exportação PDF,
sem precisar de um motor de curvas de verdade. Mesma limitação conhecida
de cantos reflexos muito agudos já documentada para
`deslocarContornoParaFora` (R-2) se aplica aqui por construção
semelhante — raio/distância sempre limitados a 99% do comprimento da
aresta adjacente mais curta, para nunca ultrapassar o vértice vizinho.

### Alinhar: só uma direção, bem definida

"Alinhar" translada as peças selecionadas (2 ou mais, via seleção em
lote) para que a borda esquerda dos seus retângulos envolventes
(`minX`) coincida — organização manual simples antes do encaixe
automático, não um sistema completo de guias/snapping.

## Verificação (Electron real, build de produção)

Duas rodadas de verificação, com leitura de valores reais de
"Largura"/"Altura"/"Área" no painel de propriedades (não só ausência de
erro):

- **Dimensionar** (fator X=2, Y=1): Largura 307.7→615.4mm (exatos 2×),
  Área 1420.1→2840.2 cm² (exatos 2×) — Altura inalterada.
- **Girar livre** (45°): "Ângulo atual" passa a mostrar 45°, Área
  permanece 2840.2 cm² (rotação preserva área — confirma que é uma
  rotação de verdade, não uma corrupção).
- **Mover ponto** (arrasto real via mousedown→mousemove→mouseup num
  vértice): bbox cresce de forma consistente com o vértice tendo sido
  puxado para fora.
- **Excluir ponto**: Área cai de 1923.1 para 976.3 cm² (quase pela
  metade) com a mesma bbox — exatamente o esperado ao remover 1 vértice
  de um quadrilátero (vira triângulo, mesmo envelope, metade da área).
- **Espelhar**: Área e bbox idênticos antes/depois (976.3 cm²,
  423.1×615.4mm) — reflexão preserva área e envelope, como esperado.
- **Alinhar**: testado com 2 peças selecionadas em lote; botão
  corretamente habilitado só com 2+ selecionadas, desabilitado com 0/1.
- Handles de vértice (círculos laranja) confirmados visualmente via
  screenshot no modo "Mover ponto".
- Inserir ponto/Chanfrar/Arredondar canto: NÃO exercidos manualmente
  nesta rodada de Electron real (mesmo padrão de clique-no-vértice+prompt
  já verificado para Girar livre, e a geometria de cada um já tem
  cobertura de teste unitário com valores conferidos à mão) — sinalizado
  explicitamente ao usuário como verificação parcial, não escondido.

215→239 testes (24 novos: 12 em `core/geometria.test.ts`, 12 em
`domain/molde.test.ts`), typecheck/lint/build limpos.

## Consequências

- Nenhuma peça existente quebra: todas as funções novas são aditivas
  (campos opcionais, modos de desenho novos) — projetos salvos antes
  desta mudança continuam abrindo normalmente.
- `MATRIZ_DE_RISCOS.md`: nenhuma entrada nova necessária — "Girar em
  ângulo livre"/"Espelhar manual" são ações deliberadas do usuário com
  aviso explícito, não uma automação que poderia silenciosamente violar
  sentido do fio (esse risco continua coberto pela regra crítica já
  documentada, que rotação/espelhamento automáticos do motor de nesting
  nunca ignoram).
- Fora de escopo, permanece deliberadamente do moda-cad: graduação de
  tamanhos, curvas Bézier reais, marcações/conferência/modelo (as outras
  abas do Audaces Moldes Avançado que não foram pedidas).
