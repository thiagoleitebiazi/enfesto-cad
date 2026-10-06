# ADR 0030 — DXF com splines, borda da folha e confirmação do usuário

## Contexto

Um DXF exportado de um programa de modelagem (`test modelagem.dxf`) foi
importado e a mensagem foi "Nenhuma polilinha fechada encontrada". O arquivo
traz 239 entidades SPLINE, em centímetros (`$INSUNITS` = 5), sem camada de
contorno e sem linha de fio. O importador só lia LWPOLYLINE, LINE, CIRCLE e
POLYLINE. Quando a camada de contorno não existia, ele usava a maior forma
fechada, que era a borda da folha, e a folha virava peça.

## Decisão

1. **SPLINE lida como NURBS.** Os pontos de controle, nós e pesos do arquivo
   são amostrados pelo algoritmo de de Boor, sem trocar a curva por uma
   aproximação. Só splines marcadas como fechadas (flag 1) viram contorno.
   Splines abertas continuam como linhas internas.
2. **Borda da folha reconhecida e ignorada.** Um retângulo que cobre quase
   todo o desenho, que não está em camada de contorno e que contém pelo menos
   duas formas fechadas (que não sejam furos) não vira peça. Isso evita tratar
   a folha como peça, sem descartar uma peça única com furo.
3. **Formas de fora como candidatas, não só a maior.** Sem camada de contorno,
   as formas fechadas que não estão dentro de outra e não são furos viram
   candidatas. Formas com menos de 500 mm² (textos e letras desenhados como
   contorno) são descartadas.
4. **Confirmação do usuário.** O mesmo diálogo do PDF
   (`DialogoDeImportacaoDeContornos`, agora neutro quanto à origem) lista as
   candidatas. Nome, tamanho e direção do fio são definidos pelo usuário. A
   direção do fio é pré-selecionada só quando o próprio arquivo traz a linha
   de fio. A escala não é pedida no DXF, porque o arquivo declara a unidade.
   Cada candidata pode ser desmarcada.
5. **Sem valores inventados.** Não há mais tamanho "M" fixo nem nome a partir
   do nome do arquivo.

## O que NÃO foi feito

- A orientação vertical do DXF não é invertida como no PDF. O eixo y do DXF é
  para cima e o da tela é para baixo. Pode haver espelhamento vertical em
  relação ao visualizador do programa de origem. Não verifiquei isso contra o
  DXF original num visualizador.
- A caixa de nota (430 × 60 mm) continua como candidata. O app não consegue
  diferenciá-la de uma peça pela geometria; o usuário a desmarca.
- Contornos de texto acima de 500 mm² podem existir em arquivos com letras
  grandes. Ficam como candidatas e o usuário as desmarca.

## Verificação

- Testes do SPLINE (2): quadrado de 10 cm importado como 100 mm × 100 mm,
  com área exata; spline aberta não vira contorno.
- Testes do diálogo genérico (6), incluindo direção sugerida pelo arquivo e
  fator de escala oculto no DXF.
- Suíte completa: 275/275. Typecheck limpo. Lint sem erros.
- Electron de produção com o DXF real: 5 candidatas listadas (805, 829, 445,
  445 e 49 vértices), a caixa de nota desmarcada, 4 peças importadas com
  nome, em centímetros, com a unidade do arquivo.
- No canvas, o resultado tem 7 erros de validação: sobreposição entre peças
  e partes fora da mesa de 1500 mm. O desenho original também tem essas
  sobreposições.

## Consequências

- `importarDxf` retorna as candidatas sem decidir por conta própria a direção
  do fio nem o nome.
- Não publicado: aguardando pedido explícito.
