# ADR 0053 — As ferramentas novas nos moldes reais

## Contexto

Tudo o que entrou do ADR 0044 ao 0052 tinha sido testado com peças
retangulares de teste. Faltava rodar nas peças dos projetos de verdade.

## Como foi feito

- Os cinco arquivos da biblioteca de projetos foram **copiados** para a pasta
  de rascunho, e só as cópias foram lidas. A pasta original não foi aberta
  para escrita; o MD5 dos cinco arquivos é o mesmo antes e depois.
- Um arquivo de teste temporário, que **não entrou no repositório**, rodou as
  ferramentas novas em cada peça e escreveu um relatório. Quatro dos cinco
  projetos têm peças: 11 ao todo.
  - Três retângulos de 300 × 400 mm.
  - Quatro moldes de 37 a 69 pontos (até 560 × 775 mm).
  - Os mesmos quatro moldes com 445 a 829 pontos e de 24 a 27 linhas internas
    cada.
- Em cada peça: tornar um trecho curva editável, mover, pôr e tirar ponto de
  passagem, mover a ponta; pence recortada, aberta por pivô e com acabamento,
  mudar as medidas e fechar; prega, mudar e tirar; cortar com costura;
  remover faixa unindo; tangente com e sem contorno base; dobrar mantendo a
  dobra, graduar e desdobrar um tamanho.

## O que o teste achou, e o que foi corrigido

1. **Tirar uma prega comia um ponto do contorno.** Num molde real, a ponta da
   linha da prega caiu a 18 nanômetros de um ponto do contorno, sem ser ele.
   A limpeza ao fechar a prega tinha uma folga de um décimo de milésimo de
   milímetro, e levou os dois: a peça perdeu 11,8 mm² e um ponto.
   - A limpeza passou a tirar só a ponta que a prega pôs.
   - Onde uma reta cruza o contorno, o ponto dele a menos de um milésimo de
     milímetro da reta é o cruzamento: não nasce mais um ponto colado no que
     já existia. Vale para as retas "pelo meio" e para as linhas internas.
2. **A abertura digitada não era a que a pence ficava tendo.** As pontas
   andavam meia abertura para cada lado **sobre o contorno**; em borda curva ou
   em canto, a reta de uma ponta à outra saía menor. Pedindo 30 × 50, o diálogo
   lia de volta de 21,7 × 47,7 a 29,1 × 50,0 nas peças reais.
   - A abertura passou a ser a reta entre as pontas. Na borda reta nada muda.
   - Ao mudar as medidas, o vértice é posto em relação à reta entre as pontas
     novas, e a pence fica centrada onde estava.
   - Nas 11 peças, 30 × 50 é lido de volta como 30,00 × 50,00.
3. **A tangente "seguindo cada tamanho" travava em contorno denso.** Com o
   ponto vizinho a 3 mm e o passo de 5, o ponto passava por cima do vizinho, a
   direção se invertia e o tamanho seguinte voltava ao lugar do base. O vizinho
   proporcional agora é lido com a regra do ponto já aplicada: anda junto.
4. **A prega tirava uma linha interna sem devolver.** A linha que estava em
   cima da linha da prega (a reta auxiliar, ou uma linha de centro do molde)
   saía ao abrir e não voltava ao tirar. Ela fica guardada no registro e volta.
5. **A linha de fio ficava fora da peça** depois de remover uma faixa, em 4
   dos 22 casos. A seta que não cabe na peça vai para o meio dela e, se ainda
   não cabe, encolhe em torno do meio, sem mudar de direção, até caber.
   - Vale também para as partes do "Cortar" e para o "Extrair molde", que
     deixavam a seta sobrando para fora na peça mais curta que ela.

## O que o teste mostrou sem ser defeito

- **Nenhum ponto dos moldes reais é reconhecido como pence sem registro** por
  engano: 0 em 2.746 pontos.
- **Tornar um trecho curva com 3 pontos de passagem** (um sexto do contorno de
  cada peça) mudou a forma de 5 a 14 mm em seis das oito peças curvas, e 35 mm
  nas outras duas. A mensagem diz a medida; com mais pontos de passagem, ou um
  trecho menor, muda menos.
- **Os moldes de muitos pontos trazem o ponto de fechamento repetido** (o
  último igual ao primeiro). As ferramentas que refazem o contorno tiram a
  repetição: a peça fica com um ponto a menos e a mesma área.
- **Remover uma faixa entre retas paralelas** numa peça de borda curva deixa
  degrau de até 24 mm: as duas retas têm comprimentos diferentes. A mensagem
  diz o degrau.
- Pence aberta por pivô, com e sem acabamento, fecha de volta na área de antes
  nas 11 peças. A prega tirada devolve a área, os pontos e as linhas. O corte
  com costura de 10 mm nas duas partes soma 2 × 10 × o comprimento do corte.

## O que NÃO foi feito

- **O teste roda as contas, não a tela.** Nos moldes reais, as ferramentas
  foram chamadas direto; os cliques no aplicativo foram conferidos com as
  peças de teste (roteiros dos ADRs 0050 a 0052, repetidos depois destas
  correções, com os mesmos números).
- **Os moldes reais não têm graduação, pences, pregas nem curvas registradas:**
  o que foi testado neles é o que as ferramentas criam, não dados que já
  viessem de produção.
- **Ninguém da modelagem olhou o resultado.** As contas fecham; se a pence, o
  bico e a prega ficam como o ofício espera é outra pergunta.

## Verificação

- **Testes:** 1442/1442 em 70 arquivos (eram 1426), sem o arquivo temporário.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 20 mutações guardadas, uma por vez. Uma sobreviveu (a seta do fio numa
    peça em "U", com o meio no vão): faltava o caso. Corrigido, passou a ser
    pega. Os cinco arquivos foram conferidos por hash depois.
  - O teste da prega colada num ponto do contorno foi escrito antes da
    correção e falhou com o código de antes.
- **Roteiros dos ADRs 0050, 0051 e 0052** repetidos no Electron real: os
  mesmos números, validação sem problemas.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
