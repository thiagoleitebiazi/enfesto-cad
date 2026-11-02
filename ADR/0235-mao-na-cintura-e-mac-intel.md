# ADR 0235 — A mão sobre o pano, e o Mac Intel de verdade

## Contexto

Três pontas abertas no provador e no Mac:

- Na pose de mãos na cintura, os dedos sumiam dentro do vestido, e a mão virava um toco.
- O Mac Intel nunca tinha sido testado numa máquina Intel: só emulado no Mac de chip Apple, pelo Rosetta, onde os modos de segurança falhavam no prazo.
- Salvar a imagem podia levar um minuto num computador lento, sem nenhum aviso na tela.

## Decisão

**A mão.** O defeito era da pose, não da colisão. A mão apontava para dentro do quadril, e o punho encostava na cintura: não sobrava vão para o pano, que era empurrado para fora dos dedos. Agora a mão acompanha a linha do quadril, que abre da cintura para baixo, e fica a 22 mm do corpo.

**O Mac Intel.** O `mac.yml` ganhou o trabalho `intel`, num Mac Intel do GitHub (`macos-15-intel`). Depois do lançamento, para uma falha não segurar o instalador, ele abre o instalador montado, com o prazo normal e em cada modo de segurança, e usa o programa. Os modos sob o Rosetta passaram a ter o mesmo prazo longo do modo padrão.

Resultado na primeira rodada: os quatro modos abriram na máquina Intel, no prazo normal, e também sob o Rosetta, com o prazo longo. Era lentidão, não defeito. O teste de uso deu 122 certos e 2 falhas: as três vistas e o vídeo levaram mais que os 30 s e os 20 s que o teste esperava. O prazo do teste subiu.

**O aviso.** Ao salvar, a tela diz o que está calculando, vista por vista.

**A trama de lado.** Bem de perto, a trama virava um pontilhado perto do contorno. Ela apaga pelo tamanho do pixel no pano, e esse tamanho era medido de frente; de lado, o pano se espreme na tela. Agora conta a inclinação.

**A camiseta na tela.** `scripts/teste-de-uso/camiseta.cjs` importa um molde sem nomes no programa de verdade, com `camiseta-de-teste.dxf` ou com o arquivo de `CAMISETA_DXF`, e confere o reconhecimento, a simulação e a troca de manga. Roda no Mac Apple e no Intel. Os moldes reais não entram no repositório.

## O que não foi feito

- O Mac Intel do GitHub é uma máquina virtual, sem placa de vídeo. Um Mac Intel físico continua sem teste.
- A mão não ganhou uma colisão própria: o pano de 12 mm ainda pode passar entre dois dedos abertos, se a roupa os cobrir.
- Uma manga mais comprida que o braço do manequim embola na mão, e a tensão ali chega a centenas de por cento.
