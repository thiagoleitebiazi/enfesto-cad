# ADR 0104 — A biblioteca de materiais e aviamentos

## Contexto

Fase 2 do estudo de funcionalidades (ADR 0099): ficha técnica e pré-custo. Os dois precisam de um cadastro de
materiais da empresa, reutilizável entre os modelos: o tecido, os aviamentos (botão, zíper, linha, etiqueta,
elástico, entretela…) e a embalagem, cada um com a unidade em que é comprado e o preço. Até aqui só havia o
cadastro de malhas e rolos, feito para o corte (ADR 0088), e o custo só do tecido (ADR 0092).

## Decisão

- **Modelo › Ficha técnica › Materiais e aviamentos** abre a biblioteca.
- **Material** (`domain/materiais.ts`):
  - código (em branco, ou sem repetir), descrição (obrigatória), categoria (tecido, aviamento, embalagem, outro);
  - unidade de compra (m, cm, kg, g, un, par, m²) e preço por unidade (em branco: sem preço; o custo diz o que
    falta);
  - fornecedor, cor e observações;
  - no tecido, composição, largura útil e gramatura: elas passam o consumo em metros a quilos.
  - O **preço trocado guarda o anterior**, com a data até quando valeu, e o formulário mostra os preços de antes.
- **Na janela:**
  - procurar (por código, descrição, fornecedor, cor ou composição, sem diferença de maiúsculas nem acentos) e
    filtrar por categoria;
  - novo, editar e remover (remover avisa quais fichas técnicas usam o material);
  - **trazer as malhas do cadastro de produção** como tecidos (descrição, composição, largura, gramatura e custo
    por metro ou por quilo), uma vez só cada malha;
  - **exportar CSV** (ponto e vírgula, vírgula decimal).
- **Padrões de custo da empresa** (a segunda aba): o custo do minuto de costura, os indiretos (% sobre materiais +
  mão de obra), os impostos, a comissão e a margem (% do preço). Impostos + comissão + margem ficam abaixo de 100%.
  O pré-custo de cada modelo começa com eles e pode trocá-los.
- **No disco:** `<userData>/biblioteca-de-materiais.json`, como o cadastro de produção e a fila: a versão anterior
  fica ao lado para recuperar, o arquivo ilegível vai para as cópias de segurança na primeira gravação, e o de
  versão mais nova aparece e não é gravado. No navegador comum, o armazenamento do navegador.

## O que não foi feito (nesta parte)

- Importar materiais de uma planilha (só exportar).
- O uso dos materiais nas fichas e o custo: são a ficha técnica e o pré-custo (os próximos ADRs da fase 2).

## Conferência

- `domain/materiais.test.ts` (8):
  - guardar e mudar, com o histórico do preço;
  - as recusas;
  - a ordem e a busca;
  - remover e o preço escrito;
  - os padrões;
  - as malhas do cadastro (uma vez só);
  - o CSV;
  - o arquivo (ida e volta, os quebrados de fora, a versão mais nova, os padrões que não fecham).
- `ui/PainelDeMateriais.test.tsx` (9):
  - vazia, a lista;
  - novo tecido com os campos dele;
  - os erros na janela;
  - editar o preço e ver o anterior;
  - remover com o aviso dos modelos;
  - trazer as malhas e exportar;
  - a busca e o filtro;
  - os padrões.
- `npx vitest run`: 143 arquivos, 2736 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows): a biblioteca aberta pela aba Modelo, um material
  novo pelo formulário, na lista com o preço "R$ 0,35/un" e gravado em `biblioteca-de-materiais.json` — 30
  conferências, nenhuma falha. Na foto, os rótulos "Procurar" e "Categoria" saíram grandes, ao lado dos campos, e
  passaram ao estilo dos outros rótulos.
