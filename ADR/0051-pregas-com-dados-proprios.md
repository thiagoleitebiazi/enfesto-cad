# ADR 0051 — Pregas com dados próprios

## Contexto

Depois dos ADRs 0047, 0048 e 0050, as pregas eram a única ferramenta do grupo
"Pregas e Pences" sem registro: aberta a prega, a peça ficava com mais pontos
no contorno e algumas linhas internas, e não havia como mudar a largura nem
tirar a prega sem desfazer tudo o que veio depois.

## Decisão

- **Registro (`Molde.pregas`):** cada prega aberta por ferramenta guarda as
  duas bordas da abertura (a que ficou parada e a que andou), as linhas que
  desenhou (as de dobra e as setas), os piques que pôs e se cada ponta da
  linha da prega foi posta no contorno por ela.
  - O registro vale enquanto as quatro pontas são pontos do contorno, cada
    parada vizinha da que andou, e as linhas continuam na peça. Mexido isso à
    mão, ele é ignorado, sem erro.
  - Acompanha a peça movida, girada, espelhada e dimensionada, os tamanhos da
    graduação, e o lado da peça que gira ou anda quando outra pence ou prega é
    aberta.
- **Mudar:** com "Pregas" ligada, o clique **dentro da faixa** de uma prega já
  feita (marcada com um anel no meio) abre as medidas dela: modo e as duas
  larguras. A prega é tirada e aberta de novo na mesma linha.
  - No contorno, o clique continua começando outra prega.
- **Tirar:** no mesmo diálogo. O lado que tinha andado volta para junto do
  outro, levando o que está nele (furos, linhas, marcas, piques, as outras
  pregas); as linhas e os piques da prega saem, e as pontas que ela tinha
  posto no contorno também.
- **Validação:** "fora da área útil" passa a ter uma folga de um milionésimo
  de milímetro (`folgaNosLimitesMm`). Girar e deslocar um lado da peça deixa
  pontos a 10⁻¹⁵ mm da borda, e a peça encostada na borda da mesa era dada
  como fora. O roteiro desta etapa achou o caso.

## O que NÃO foi feito

- **Prega sem registro** (de projeto antigo ou desenhada à mão): não é
  reconhecida pelo desenho, como a pence é. Não há como saber, só pelas
  linhas, qual lado andou e quanto.
- **Mudar o número de pregas ou a distância** de um grupo: cada prega muda e
  sai sozinha.
- **No tamanho que não é o base**, tirar a prega fecha a peça com uma pequena
  sobra quando a graduação estica as duas bordas de modo diferente: os
  tamanhos não são cópias rígidas uns dos outros.

## Verificação (Electron real, build de produção)

- **Testes:** 1374/1374 em 70 arquivos (eram 1356).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 21 mutações guardadas, uma por vez. Uma sobreviveu (o registro no tamanho
    da graduação): o teste não dava regra a nenhum ponto. Corrigido, a mutação
    passou a ser pega. Os seis arquivos foram conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - Prega simples de 20 mm numa peça de 1200 cm²: 1360,0 cm², com o registro.
  - Clique na faixa: o diálogo abriu com "simples à direita, 20 e 20".
    Largura zero foi recusada. Com 10 e 10: 1280,0 cm².
  - Tirada: 1200,0 cm², 4 pontos, nenhuma linha e nenhum pique. Ctrl+Z trouxe
    a prega de volta, registrada.
  - Três pregas de 10 mm: 1380,0 cm² e três registros. Tirada a do meio:
    1320,0 cm², e as outras duas continuaram registradas, no lugar novo.
  - Validação sem problemas no fim (antes da folga, acusava a peça encostada
    na borda da mesa).
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
