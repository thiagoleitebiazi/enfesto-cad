# ADR 0077 — Aba Marcações: fechamento do que estava em "não foi feito"

## Contexto

Os ADR 0071 a 0073 fizeram a aba Marcações e deixaram, cada um, uma lista
"O que NÃO foi feito". O pedido seguinte foi fazer tudo o que estava nessas
listas. Os ADR 0074 a 0076 fizeram o que era falta; este fecha o resto e
registra o destino de cada item.

## Decisão

### O destino de cada item

| Item que estava em "não foi feito" | Onde foi resolvido |
| --- | --- |
| O PDF não guarda o formato do pique (0071) | Feito — ADR 0076 |
| O "Substituir" não mexe nos piques internos (0071) | Feito — ADR 0074 |
| A forma de um pique cadastrado não se edita (0072) | Feito — ADR 0074 |
| O desenho cadastrado não é espelhado na peça espelhada (0072) | Feito — ADR 0074 |
| O "Alinhar" não trata o pique interno (0072) | Feito — ADR 0075 |
| O PDF não leva as linhas de construção (0073) | Feito — ADR 0076 |
| O pontilhado da tela não tem teste (0073) | Feito — ADR 0076 |
| A saída do PDF não foi conferida pela tela (0073) | Feito — ADR 0076 |
| Alinhar e Cadastrar ficaram fora da passada nas peças reais (0073) | Feito — este ADR |
| O pique com formato não é recortado do contorno (0071) | Decisão, dita na janela |
| "Pique na costura" não aparece na peça sem margem (0071) | Decisão; a mensagem já avisava |
| O texto não é preso a um pique do contorno (0072) | Decisão, dita na janela |
| As ferramentas não distinguem linha auxiliar de elemento (0073) | Decisão, dita na janela |
| Nada foi comparado com o programa de referência em uso (os três) | Folha para quem tem o programa; ver abaixo |

### O que é decisão, e não falta

Quatro itens não eram coisas por fazer. Ficaram explicados onde o usuário
vê:

- **O pique é uma marcação desenhada:** o contorno e o encaixe não mudam com
  ele. Está na nota da janela do "Inserir".
- **O texto fica dentro da peça, no ponto clicado.** É onde o manual da
  referência o põe ("no interior do molde"). Está na nota do "Pique texto".
- **A linha que faz parte do molde também serve às ferramentas que pedem um
  elemento.** Aqui toda linha é uma linha interna da peça; nenhuma ferramenta
  pede que ela seja só de construção. Está na nota das "Linhas auxiliares",
  junto com o que o PDF faz com o elemento.
- **O "pique na costura" só existe na peça com margem de costura.** A
  mensagem do "Inserir" já avisava; nada mudou.

### Defeitos achados no caminho

Não estavam em lista nenhuma. Foram corrigidos, com teste:

- o pique interno da peça espelhada continuava apontando para o mesmo lado
  (ADR 0074);
- o desenho cadastrado saía com a direita e a esquerda trocadas conforme o
  sentido do contorno (ADR 0074);
- a cópia do pique com ângulo, no "Desdobrar", ficava com o ângulo do
  original (ADR 0074);
- a importação do PDF não reconhecia a página da peça com texto ou com pique
  com código, nem a peça sem tamanho (ADR 0076).

### A comparação com o programa de referência

- O programa de referência não pode ser rodado daqui: a comparação depende de
  uma pessoa que o tenha.
- Para ela há uma **folha de comparação da aba Marcações**, com oito casos num
  retângulo de 40 × 30 cm e os números do Enfesto CAD em cada um. Fica em
  `revisao-local/` (fora do repositório), ao lado da folha das outras abas.
- Os números da folha foram tirados do próprio programa, por teste, e não de
  cabeça.

## O que NÃO foi feito

- **A comparação em si.** A folha está pronta; falta alguém com o programa de
  referência preenchê-la. Cada "deu diferente" vira uma correção.
- **O que os ADR 0074 a 0076 deixaram dito:** o Ctrl+Z não desfaz o cadastro
  de piques (só as peças); não há tabela para editar o que o pique interno
  alinhado anda em cada tamanho; na tela, os outros tamanhos da peça graduada
  aparecem só pelo contorno; a peça maior que uma folha não é importada do
  PDF; o PDF não leva a graduação, a cor, a linha de simetria nem os registros
  de pence, curva e prega.

## Verificação

- **Testes:** 1973/1973 em 90 arquivos (eram 1927 em 88 no fim do ADR 0073);
  tipos e lint limpos (o aviso antigo do `useMemo` continua). As três frases
  novas das janelas estão conferidas em teste.
- **Mutações, nos ADR 0074 a 0076:** 126 (41 + 36 + 49), uma por vez, com o
  código conferido por hash antes e depois. Todas pegas.
- **A folha de comparação:** os números dos casos 1, 3 e 7 (a ponta do pique
  a 30°, o pique antes e depois do "Vertical", o pique na peça espelhada)
  foram conferidos por um teste feito só para isso, que não ficou no
  repositório.
- **As ferramentas que faltavam, nos moldes reais** (cópias de dois projetos,
  oito peças, pela tela). Em cada peça: graduada só para isto (três tamanhos,
  um ponto do contorno andando 10 mm); um pique do contorno alinhado na
  vertical; um pique interno alinhado na horizontal; um L desenhado com duas
  linhas e cadastrado; um pique posto com ele; a peça espelhada e desfeita; o
  cadastrado redesenhado, levando ao pique posto; o "Substituir" com os
  internos; o cadastro limpo; e tudo desfeito com Ctrl+Z, com a peça
  conferida no arquivo salvo contra a que foi aberta.
  - Primeiro projeto: **70 conferências, 0 falhas.**
  - Segundo projeto: **70 conferências, 0 falhas.**
  - O pique do contorno foi posto no meio da aresta mais comprida de cada
    peça, que nesses moldes não anda de um tamanho para outro: o "Alinhar"
    dele deu zero nos três tamanhos. O caminho foi exercitado; o número que
    prova a conta está nos testes e na peça de teste (ADR 0072).
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
