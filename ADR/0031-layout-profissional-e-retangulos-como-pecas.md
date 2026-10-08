# ADR 0031 — Layout profissional (referência de CAD de moldes) e retângulos como peças

## Contexto

O usuário enviou de novo a captura de um CAD de moldes comercial e pediu
"esse nível de profissionalismo e organização do layout". Comparando a tela
real do app com a referência, os problemas concretos eram:

1. **Faixa cinza vazia** entre a fita e o desenho. A tela era uma grade de 3
   linhas (`auto 1fr auto`), e a linha que estica caía na faixa
   "Tecido/Enfesto", não na área de desenho.
2. **Barra de menu padrão do Electron** ("File Edit View Window"), em inglês,
   duplicando a fita e permitindo zoom da página inteira por engano.
3. **Fita** com grupos em caixas arredondadas, rótulos no topo e ferramenta
   ativa como um bloco azul cheio.
4. **Réguas** só com as marcas numeradas, sem subdivisões.
5. **Desenho das peças**: nome numa etiqueta acima da peça, seta de fio
   vermelha, uma cota de largura em todas as peças, e numeração de todos os
   vértices — em curvas importadas (centenas de pontos) isso virava uma mancha.
6. **Lista de peças**: miniatura com os eixos trocados em relação ao canvas
   (peça aparecia girada) e item selecionado como bloco azul cheio.
7. **Barra de status** dizendo "encaixe ainda não implementado", o que é falso.

Ao rever a página do PDF de exemplo, outro erro apareceu: o retângulo de
430 × 60 mm rotulado "101-ACAB. DO DECOTE-G / 1 VEZ" é uma **peça**
(acabamento do decote), não uma caixa de nota. O importador de PDF o
descartava por ter só 4 vértices.

## Decisão

- **Layout:** `.app-shell` vira coluna flexível; só `.corpo-principal` estica.
  A faixa "Tecido/Enfesto" virou a **barra do documento** acima do desenho:
  uma aba com o nome do projeto aberto e o contexto de tecido/enfesto à direita.
- **Sem menu padrão:** `Menu.setApplicationMenu(null)`; janela com título
  "Enfesto CAD" e aberta maximizada. Copiar/colar em campos de texto foi
  verificado sem o menu.
- **Fita:** abas em maiúsculas, "Arquivo" destacada em cor cheia, grupos sem
  caixa com separador vertical e nome embaixo, ícones maiores, ferramenta
  ativa em azul-claro com borda.
- **Réguas:** traço numerado em cada passo, médio na metade e pequenos nas
  subdivisões que couberem (`subdivisoesDaRegua`, testada).
- **Peças no canvas:** nome escrito sobre a linha de fio, girado com ela; fio
  na cor da peça, com seta nas duas pontas quando a peça pode girar 180° (fio
  sem sentido) e numa ponta quando não pode; marcadores quadrados nos vértices;
  em contornos com mais de 40 vértices, só os cantos (giro ≥ 15°) recebem
  número, com 16 px de espaço mínimo; cota de largura e caixa tracejada só na
  peça selecionada.
- **Lista de peças:** nome em cima, miniatura maior embaixo, na mesma
  orientação do canvas (`mundo.y` na horizontal); seleção em azul-claro.
- **Barra de status:** "Aproveitamento da mesa" calculado de verdade
  (`aproveitamentoDaMesa`: área das peças ÷ largura útil × comprimento usado,
  cada peça contada uma vez; testada).
- **PDF:** sai o filtro de mínimo de 8 vértices; o filtro passa a ser só pela
  área (≥ 500 mm², elimina letras desenhadas) e pela borda da folha. Peças
  retangulares (cós, viés, acabamentos) passam a ser importadas.

## O que NÃO foi feito

- Ícones coloridos e barra de status azul: identidade visual da referência,
  mantida a decisão dos ADRs 0017/0018 de não copiar.
- Linha de fio diagonal: o diálogo de importação só oferece vertical ou
  horizontal. No exemplo, a peça "101-MANGA/LG-G" está girada no arquivo e o fio
  real é diagonal; hoje ela fica com o fio errado se importada.
- Nomenclatura "Largura/Altura" no diálogo de Propriedades segue o domínio
  (largura = eixo vertical da tela), o que pode confundir; não mexido.

## Verificação (Electron real, build de produção)

- Menu da aplicação: nenhum. Janela abre maximizada, título "Enfesto CAD".
- Medidas: fita 0–154 px, área principal 154–838 px, status 838–863 px —
  sem faixa vazia.
- PDF de exemplo: 5 contornos no diálogo (4 grandes + acabamento do decote);
  descartes: 1 borda, 26 de área pequena, 207 abertos.
- DXF de exemplo: 5 contornos; importadas 5 peças com os nomes legíveis no PDF.
- Barra de status: "Aproveitamento da mesa: 36.2%".
- Copiar (Ctrl+C) no campo Nome e colar (Ctrl+V) no campo Referência
  funcionam sem a barra de menu.
- Capturas: tela vazia, aba Manipulação com as 5 peças, diálogo de
  Propriedades sobre o novo layout.
- Testes: 279/279. Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
