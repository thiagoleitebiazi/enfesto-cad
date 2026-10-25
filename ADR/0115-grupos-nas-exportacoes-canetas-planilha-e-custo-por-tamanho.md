# ADR 0115 — Os grupos nas exportações, o plotter de duas canetas, a planilha de materiais e o custo por tamanho

## Contexto

Quatro itens das listas "O que não foi feito" de ADRs anteriores:

- **ADR 0103:** "O PDF, o DXF e o PLT não levam a divisa dos trechos (a divisa é só na tela)". Quem corta a enfesto
  pelo risco impresso não sabe onde o trecho da entretela acaba.
- **ADR 0101:** "Não há várias canetas (corte × risco)". No plotter de duas canetas, a linha de corte e o risco
  (costura, fio, piques, nomes) saíam com a mesma caneta.
- **ADR 0104:** "Importar materiais de uma planilha (só exportar)". A lista de preços do fornecedor tinha de ser
  digitada material por material.
- **ADR 0106:** "O custo por tamanho". O pré-custo era de uma peça média; o GG custa mais tecido que o P, e o preço
  sugerido era um só.

Junto, o teste de uso passou a reparar também nos avisos do console (um `console.error` ou `console.warn` da página é
erro escondido).

## Decisão

**1. A divisa dos grupos no PDF, no DXF e no PLT.** A conta da divisa saiu da tela para o domínio
(`divisasEntreOsBlocos`, em `gruposDoEncaixe.ts`): no meio entre o fim de um trecho e o começo do seguinte, e só
quando eles não se misturam. Os três arquivos e a tela usam a mesma conta.
- **PDF:** a divisa tracejada (4 mm de traço, 2,5 mm de espaço) atravessando a mesa, e o nome do trecho no começo
  dele, na cor dos grupos da tela (magenta).
- **DXF:** a camada nova `GRUPOS` (cor 30): a divisa como reta e o nome como texto, 8 mm antes da borda da mesa.
- **PLT:** a divisa e o nome (`LB`), no mesmo lugar do DXF.

Sem grupos no encaixe, nada muda em nenhum dos três.

**2. O plotter de duas canetas.** No menu **Opções**, "Plotter de uma caneta" (o padrão) ou "Plotter de duas
canetas (corte e risco)".
- Com duas, a linha de corte vai na caneta 1 (`SP1`), e o resto vai na 2 (`SP2`): a costura, as linhas internas, o
  fio, os piques, os textos, a mesa e os grupos.
- Com uma, nada muda: o arquivo é igual ao de antes, sem `SP2`. No plotter de uma caneta, as linhas da caneta 2 não
  sairiam, por isso duas é uma escolha.
- A escolha é do computador (do plotter ligado nele), não do projeto. Fica guardada no armazenamento local, como a
  unidade da régua.

**3. A planilha de materiais.** Em Materiais e aviamentos, o botão **"Importar planilha…"** abre um quadro.
- **O que entra:** o texto colado (o Excel cola separado por tabulação) ou um arquivo CSV, com `;` ou `,`. A própria
  exportação da biblioteca volta igual.
- **As colunas** são achadas pelo nome da primeira linha, sem acento: Código, Descrição, Categoria, Unidade, Preço,
  Fornecedor, Cor, Composição, Largura, Gramatura, Observações.
  - Só a descrição é obrigatória.
  - Os sinônimos comuns valem ("Nome", "Valor", "Ref.", "metro", "peça", "Malha"…).
  - O preço pode vir como "R$ 1.234,56".
- **O material que já existe** (o mesmo código ou, sem código, a mesma descrição) é atualizado. Se o preço mudou, o
  antigo vai para os preços anteriores, como na edição pela tela. A coluna que a planilha não tem não mexe no
  material.
- **Antes de gravar, a prévia** diz quantos materiais são novos, quantos são atualizados e quantos mudam de preço.
  Também diz cada linha que fica de fora, com o motivo (sem descrição, categoria ou unidade desconhecida, preço que não
  é número).

**4. O custo por tamanho.** Com as peças graduadas e a ficha com dois tamanhos ou mais, o **Pré-custo** ganha a tabela
"Por tamanho". Ela tem a área das peças de cada tamanho, o tecido com quanto a mais ou a menos (em laranja e azul), o
custo total e o preço sugerido.
- **O tecido** acompanha a área das peças do tamanho sobre a média dos tamanhos, porque o consumo informado e o do
  encaixe são de uma roupa média. O do encaixe é contado com o encaixe esticado pelo mesmo fator.
- **O resto é igual** em todos os tamanhos: os aviamentos, a embalagem e a mão de obra.
- **O PDF da ficha** leva a mesma tabela, depois do "Pré-custo (por peça)". Como a fonte do PDF não tem o sinal de
  menos, o PDF usa o hífen no lugar.
- Os textos do tecido ("1,048 m", "+4,8%") saem de `consumoDosTecidos` e `variacaoDoTecido`, os mesmos na tela e no
  PDF.

**5. O console no teste de uso.** O roteiro guarda o que a página escreve com `console.error` e `console.warn`, mostra
no relatório e confere "sem aviso no console".

## O que não foi feito

- **O plotter de duas canetas não foi testado num plotter físico** (não há um aqui), como o de uma (ADR 0101).
  Faca, vinco e comandos de mesa de corte continuam de fora: cada fabricante tem os seus.
- **A planilha não lê o arquivo do Excel (.xlsx)**: só o texto colado ou o CSV. O material que sumiu da planilha não
  é apagado da biblioteca, e a planilha não liga o tecido a uma malha do cadastro.
- **O custo por tamanho não faz um encaixe para cada tamanho.** O tecido vai pela proporção da área. O encaixe
  conta, além da área, como as peças se acomodam. Os aviamentos que crescem com o tamanho (um elástico em metros)
  ficam iguais.

## Conferência

- `core/csv.test.ts` (3): o separador pela primeira linha (tabulação, `;`, `,`); as aspas com separador, quebra de
  linha e aspa dentro; as linhas vazias de fora; a marca do UTF-8 no começo.
- `domain/materiais.test.ts` (+4):
  - os novos e os atualizados pelo código, o preço antigo no histórico, a contagem dos preços mudados, e cada linha
    com problema dita;
  - a coluna ausente não mexe no material;
  - a planilha exportada volta igual;
  - a planilha sem a coluna da descrição.
- `domain/preCusto.test.ts` (+2): a área de cada tamanho pela graduação; o tecido de cada tamanho (o informado e o
  do encaixe), com os aviamentos iguais.
- `domain/gruposDoEncaixe.test.ts` (+1): as divisas entre os trechos; nenhuma entre trechos misturados.
- `formats/pdf-exportacao.test.ts`, `dxf-exportacao.test.ts`, `plt-exportacao.test.ts` (+4):
  - a divisa e os nomes dos grupos em cada arquivo;
  - no PLT, a linha de corte na caneta 1 e o resto na 2;
  - com uma caneta, nenhum `SP2`.
- `formats/ficha-exportacao.test.ts` (+2): a tabela por tamanho no conteúdo (com o hífen) e no PDF, depois do
  pré-custo.
- `ui/PainelDeMateriais.test.tsx` (+1), `ui/PainelDaFichaTecnica.test.tsx` (+1), `ui/BarraDeFerramentas.test.tsx`:
  - a prévia e a importação;
  - a tabela "Por tamanho" (P −4,8%, M +4,8%), e o Exportar PDF levando os dois tamanhos;
  - as opções do plotter.
- `npx vitest run`: 165 arquivos, 2932 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado: 78 conferências, nenhuma falha, nenhum aviso no console. Duas
  delas são novas:
  - **o PLT de duas canetas depois do encaixe com grupos:** a linha de corte na caneta 1, o risco na 2, e os nomes
    "Entretela" e "Sem grupo";
  - **a planilha colada:** o botão já cadastrado ganha a cor e fica com o preço, a linha entra como nova, e a linha
    da unidade "rolo" é dita na prévia e fica de fora.
