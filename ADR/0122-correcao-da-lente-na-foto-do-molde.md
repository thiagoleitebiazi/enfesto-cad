# ADR 0122 — A correção da lente na foto do molde

## Contexto

O ADR 0109 deixou em "O que não foi feito": "A correção da lente (a distorção de barril das câmeras de celular): a
perspectiva é corrigida pelos quatro cantos, mas a curvatura da lente não."

A lente do celular curva as retas perto da borda da foto, e os quatro cantos não sabem disso. A placa de corte
fotografada de perto, para caber inteira, sai com os lados abaulados. O molde perto da borda da foto fica com milímetros
a mais ou a menos.

## Decisão

**1. A lente, de um coeficiente** (`Lente`, em `domain/digitalizacao.ts`):
- **A fórmula:** a distorção radial em volta do meio da foto. O ponto `d` da foto vai ao lugar sem a lente
  `c + (d − c)·(1 + k·r²)`, com `r` a distância ao meio sobre a meia diagonal.
- **O sinal:** `k > 0` desfaz o barril, a curva do celular; `k < 0`, a almofada.
- **A direção da fórmula:** escrita da foto para o lugar certo, a conta é direta (`desfazerLente`). A volta
  (`aplicarLente`, do lugar certo para a foto) é por Newton no raio, e é única na foto inteira para |k| ≤ 0,3.
  Escrita ao contrário (do lugar certo para a foto, com k negativo), a fórmula dobra perto dos cantos e não tem volta.

**2. O coeficiente pelos lados da referência** (`estimarLente`):
- **Os pontos:** depois dos 4 cantos, a pessoa clica um ponto na borda de cada lado da referência, perto do meio,
  onde a curva mais aparece.
- **A conta:** o `k` é o que, desfeita a lente, deixa cada ponto na reta entre os dois cantos do seu lado.
- **A busca:** uma varredura de −0,3 a 0,3 de 0,005 em 0,005, e o ajuste fino pela seção áurea.
- **A resposta** diz o quanto os pontos estavam fora da reta, e o quanto ficaram (a média quadrática em pixels).

**3. A foto corrigida** (`retificar`, com a lente):
- a perspectiva sai dos cantos já no lugar certo;
- cada pixel da foto corrigida volta à foto pela perspectiva e depois pela lente.

Sem a lente, tudo fica como antes.

**4. Na janela do molde da foto:**
- **A opção:** "Corrigir a curvatura da lente (mais 4 cliques)".
- **Depois dos cantos,** a janela pede "um ponto na borda do lado de cima / da direita / de baixo / da esquerda, perto
  do meio", e cada ponto aparece como um losango azul.
- **O resultado** fica num quadro verde: "os lados estavam a 6,0 px da reta; corrigida, a 0,5 px". Fica vermelho, com
  "Confira os pontos", se a reta não fecha a 1,5 px.
- **O botão** vira "Corrigir a lente e a perspectiva".

## O que não foi feito

- **A lente de um coeficiente só,** em volta do meio da foto. A foto cortada fora do meio, ou a lente muito torta
  (olho de peixe), precisa de mais termos.
- **Os lados não são achados sozinhos** na foto: os pontos são clicados, como os cantos.
- **A correção vale para a foto toda,** pela referência: o molde precisa estar no plano da referência, em cima dela,
  como já era.

## Conferência

- `domain/digitalizacao.test.ts` (+3):
  - desfazer e aplicar a lente são a volta um do outro;
  - **numa foto com k = 0,1,** os pontos dos lados estão a 7,2 px da reta, e o coeficiente achado é 0,1000, com a
    reta a menos de 0,1 px; a foto sem lente dá k = 0;
  - **a foto curvada pela lente** (a placa e o molde desenhados pixel a pixel pela perspectiva e pela lente): corrigida
    a lente, o molde sai com erro de 0,05 mm; sem corrigir, de 6,5 mm.
- `ui/PainelDaFotoParaMolde.test.tsx` (+1): os 4 pontos pedidos depois dos cantos, o botão desligado até lá, o
  resultado, os losangos e a foto corrigida.
- `npx vitest run`: 166 arquivos, 2978 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 87 conferências, nenhuma falha, nenhum aviso no console.
  - **A foto do teste** passou a ser curvada pela lente (k = 0,08, cada lado desenhado em 24 pedaços); a opção da
    lente é ligada pelo clique.
  - **Os cliques:** os 4 cantos e os 4 pontos dos lados com o mouse.
  - **Nova conferência:** "os lados estavam a 6,0 px da reta; corrigida, a 0,5 px".
  - **O molde** sai com 100,0 × 150,0 mm, com o furo, o fio e a pence.
  - **A conferência da peça criada** passou a procurar o seu aviso entre os da janela, porque o resultado da lente
    também é um aviso.
