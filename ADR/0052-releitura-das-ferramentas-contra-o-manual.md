# ADR 0052 — Releitura das outras ferramentas contra o manual

## Contexto

O ADR 0046 refez Dobrar, Conferir, Ajustar e Agrupar pelo manual da
referência, e deixou escrito que as outras ferramentas — pences, pregas,
bainha, cortar, unir, remover região e as de graduação — não tinham sido
relidas contra o texto dele. O pedido foi fazer o que tinha ficado por fazer.

O manual foi relido, seção por seção, para cada uma delas: as opções da janela
e os passos de uso. Ele dá isso, e não as contas. Onde a opção existe e a conta
não está escrita, vale a leitura natural, dita na janela da ferramenta.

## O que a releitura achou, e o que foi feito

| Ferramenta | O manual tem | O programa tinha | Feito agora |
| --- | --- | --- | --- |
| Graduar automático | Diferença DX, DY, **Aplicar no tamanho** | DX e DY, sempre em todos | "Aplicar no tamanho" |
| Graduar tangente | Distância, Inverter, **Usar contorno base**, **Aplicar no tamanho**, **Incremental** | Distância e Inverter | as três opções |
| Criar pence | Abrir, Recortar, Vértice perpendicular, **Criar acabamento**, Cortar intersecções, Piques laterais, **Pique vértice** | sem acabamento; pique no vértice só na marcada | "Criar acabamento"; pique no vértice em todos os modos |
| Pregas | a linha é uma **reta auxiliar** indicada | dois pontos do contorno | também o clique numa linha interna reta |
| Cortar molde | pelo **elemento**; **Costura**, **Costura 2 moldes**, **Pique**, **Modo** (Tangente ou Reta); Contorno, Manter distâncias | reta por dois pontos, sem janela | janela com as quatro opções; corte pelo elemento reto |
| Remover região | **Manter região do molde**, **Unir moldes**; dois elementos | uma reta e o lado | as duas opções; a segunda reta; retas pelo elemento |
| Pence interna, Bainha, Agrupar, Ajustar, Apagar, Copiar (as opções), Unir tamanhos | — | as mesmas opções | nada a mudar |

### Graduação

- **Aplicar no tamanho** (Automático e Tangente): "Todos", ou um tamanho. Num
  tamanho só, só ele muda: fica à diferença pedida do tamanho vizinho, do lado
  do base. *Leitura nossa: o manual tem a opção, sem a conta.*
- **Incremental** (Tangente): ligado, a distância conta de um tamanho ao
  vizinho (o que já fazia). Desligado, conta a partir do base em cada tamanho.
- **Usar contorno base** (Tangente): ligado, a direção é sempre a da aresta no
  tamanho base (o que já fazia, e por isso vem ligado). Desligado, cada tamanho
  sai do vizinho na direção que a aresta tem nele: a tangente acompanha a curva
  dos tamanhos. *Leitura nossa.*

### Pences

- **Pique no vértice:** a marca no vértice vale para a pence recortada e para a
  aberta por pivô, e não só para a marcada. Sai e volta com a pence.
- **Criar acabamento** (só no Abrir): a pence aberta não é recortada. As pernas
  ficam desenhadas, e o contorno, entre as duas pontas, ganha o **bico** que a
  pence faz quando é dobrada.
  - O bico é onde a borda da peça de cada lado, espelhada na perna da pence,
    encontra a linha do meio dela. Com os dois lados chegando com inclinações
    diferentes, fica no meio dos dois encontros; sem encontro, a borda passa
    reta. Numa pence de 40 × 100 em borda reta, o bico sobe 8,3 mm.
  - Fica registrada com o bico e o pivô: muda de medidas e fecha como a pence
    aberta por pivô. *Leitura nossa: o manual diz que o acabamento é "como
    feito à mão, sem remover nada", sem a construção.*

### Pregas

- Com "Pregas" ligada, o clique numa linha interna reta faz dela a linha da
  prega, de borda a borda da peça. A linha indicada sai: a prega desenha a dela.

### Cortar

- A ferramenta passou a abrir uma janela.
- **Pelo elemento:** o clique numa linha interna reta faz dela a reta do corte,
  de borda a borda. A linha sai: virou a borda.
- **Costura:** a borda do corte anda essa medida para fora, no contorno da
  parte. **Costura 2 moldes:** nas duas partes; sem isso, só na peça nova.
  *Leitura nossa: o manual não diz qual parte.*
- **Modo:** Tangente estende as arestas vizinhas até a borda nova; Reta sai em
  esquadro. No Tangente, a vizinha que não chega em até quatro vezes a costura
  acaba em esquadro.
- **Pique:** um em cada ponta da linha do corte, na parte que ganha costura.

### Remover região

- **Manter região do molde:** a região tirada vira uma peça nova.
- **Unir moldes:** com duas retas, sai a faixa entre elas, e as duas partes que
  sobram são unidas pelas bordas do corte. A parte sem a linha de fio gira e
  anda até a outra. Retas de comprimentos diferentes ficam centralizadas, e a
  mensagem diz o degrau que sobrou.
- As retas podem ser dois pontos do contorno ou uma linha interna reta.

## O que NÃO foi feito

Diferenças que a releitura achou e que continuam:

- **Cortar:** "Contorno Automático/Manual" (corte por vários elementos) e o
  corte por elemento curvo — só reta. "Manter distâncias" (a graduação das
  partes). Costura no corte só na borda reta.
- **Unir moldes:** "Unir tamanhos" (giro por igual tamanho ou igual base). A
  união é por aresta, centralizada; o manual indica o começo e o fim da união e
  uma referência em cada molde.
- **Criar pence:** "Cortar intersecções" (a reta até o pivô que cruza o
  contorno mais de duas vezes): a ferramenta recusa essa reta.
- **Transferir e Fechar:** o manual indica o começo, o vértice e o fim da
  pence; aqui clica-se no vértice, e as pontas são os pontos vizinhos. A pence
  de pernas curvas (com pontos no meio delas) não é fechada nem transferida.
- **Tabela:** a entrada por Distância/Ângulo, as setas de sentido e a tabela
  dos piques de contorno. **Automático e Tangente** não graduam piques.
- **Regras:** o "conjunto de regras". **Criar regra:** o Código e a tabela
  editável na janela (a regra é a do ponto indicado).
- **Copiar graduação** para um ponto de **outra** peça: só pela Tabela
  (Copiar e Colar). **Separar:** as peças novas vão para uma fila ao lado; o
  manual indica a posição com o mouse.
- **Múltiplas pences e Deduzir** não estão no manual (versão 10): continuam
  leitura nossa. O mesmo para a geometria do pivô no Fechar, a linha das dobras
  horizontal e vertical e a conta do Ajustar.
- **Nada foi comparado com o programa de referência em uso.**

## Verificação (Electron real, build de produção)

- **Testes:** 1426/1426 em 70 arquivos (eram 1374).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 35 mutações guardadas, uma por vez. Duas sobreviveram (a tangente sem
    incremental e sem contorno base; o bico com um lado só): faltava o caso
    nos testes. Corrigidos, as duas passaram a ser pegas. Os oito arquivos
    foram conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - **Automático no GG**, DX 8: só o GG mudou (0; 8), e a mensagem disse "em
    relação ao G". **Tangente a partir do base**, 5 mm: PP e P a +5, G e GG a −5.
  - **Cortar com costura** de 10 mm, modo Reta, com pique: a peça nova passou
    de 307,1 para 337,1 cm² (300 × 10 a mais), com 2 piques; a outra, igual.
  - **Cortar pelo elemento:** o clique na linha interna cortou a peça ao meio
    (602,8 e 597,2 cm²), e a linha saiu.
  - **Remover região unindo:** a faixa de 198,9 cm² saiu e a peça ficou com
    1001,1 cm², numa peça só.
  - **Prega pela reta auxiliar:** 1280,0 cm², 4 linhas (a auxiliar saiu),
    registrada.
  - **Pence aberta com acabamento:** 1281,3 cm², registrada como marcada, com
    bico e pivô, 1 linha e 1 marca. Abertura 60: 1324,7 cm², ainda com bico.
    Fechada: 1200,0 cm², sem linha e sem marca.
  - Validação sem problemas no fim.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
