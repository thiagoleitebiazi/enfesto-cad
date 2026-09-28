# ADR 0007 — Relatórios de produção (PDF/Excel)

## Contexto

Seção 12 do escopo pede um relatório de produção exportável em PDF e Excel,
cobrindo projeto/referências, tecido, enfesto, peças por tamanho, consumo de
tecido e aproveitamento/desperdício.

## Decisões

1. **`gerarRelatorioDeProducao(projeto, agoraIso)` é puro** (`domain/relatorio.ts`),
   sem I/O — recebe um `Projeto` já carregado e devolve um objeto de dados
   (`RelatorioDeProducao`). Segue a mesma separação de camadas do ADR 0001:
   domínio não sabe nada sobre PDF/Excel/Electron.
2. **Aproveitamento/desperdício são recalculados a partir da geometria atual**,
   não lidos de um resultado de nesting salvo anteriormente. Um relatório
   gerado reflete sempre o estado presente das peças, mesmo que o usuário
   tenha movido peças manualmente depois do último nesting automático — a
   alternativa (guardar o resultado do nesting e exibi-lo mesmo depois de
   desatualizado) daria números enganosos sem nenhum aviso.
3. **`versaoDoEncaixe` conta eventos `execucao-de-nesting` no histórico do
   projeto** (ADR 0006) em vez de manter um contador separado — o histórico
   já é a fonte de verdade para "quantas vezes o encaixe rodou", nenhum
   estado novo precisa ser inventado.
4. **Excel via `exceljs`, não `xlsx`.** `xlsx` foi instalado, testado, e
   removido depois que `npm audit` acusou uma vulnerabilidade real de
   severidade HIGH no pacote. `exceljs` tem apenas uma vulnerabilidade
   moderada, transitiva (via `uuid`, um bug de validação de buffer que só
   importa se buffers forem passados às funções de geração de uuid — este
   projeto nunca faz isso). Registrado em `MATRIZ_DE_RISCOS.md` como risco
   aceito, mesmo padrão do ADR 0005 para o polyfill de `crypto`.
5. **Verificação do Excel por round-trip real**: os testes escrevem o
   `.xlsx` com `gerarExcelDeRelatorio` e leem de volta com
   `new ExcelJS.Workbook().xlsx.load(buffer)`, conferindo nomes de planilha
   e valores de células específicas — mais forte que só checar tamanho de
   arquivo ou assinatura de bytes, porque prova estrutura interna válida.
6. **Reaproveita o canal IPC `salvar-arquivo`** (ADR 0005), generalizado para
   detectar a extensão do nome sugerido (`pdf` vs `xlsx`) e escolher o
   filtro do diálogo nativo de acordo, em vez de criar um segundo canal só
   para Excel.

## Problema real encontrado e corrigido: `Helvetica-Bold` não registrada

O mesmo problema descrito no ADR 0005 (build do `pdfkit` para o renderer não
carrega fontes do disco, exige `registerStdFonts()`) voltou de um jeito
novo: `pdf-exportacao.ts` nunca chama `.font(...)` (usa só a fonte padrão),
então o registro de só `Helvetica` bastava. `relatorio-exportacao.ts` é o
primeiro módulo a usar negrito (`.font('Helvetica-Bold')` para os
rótulos de campo e cabeçalhos de tabela) — e travava com
`Standard font "Helvetica-Bold" is not registered` ao clicar em "Exportar
PDF" dentro do relatório.

Os testes automatizados (`vitest`, ambiente `jsdom`) **não detectaram isso**:
a resolução de módulos do Node usada pelo vitest para `pdfkit` cai na build
Node (que carrega fontes do disco sozinha), não na build de navegador que o
Vite resolve de fato dentro do processo de renderer do Electron. Só a
verificação num Electron real (clique sintético em "Exportar PDF" via
`webContents.executeJavaScript`) reproduziu o erro — confirmando, de novo,
por que esta etapa exige essa verificação além dos testes unitários.

Corrigido importando também `pdfkit/standard-fonts/HelveticaBold` e
registrando os dois pesos: `registerStdFonts(Helvetica, HelveticaBold)`.

## Consequências

- Qualquer novo módulo de exportação em PDF que use um peso de fonte ainda
  não registrado (itálico, por exemplo) vai reproduzir esta mesma classe de
  erro — e só aparecerá numa verificação real em Electron, não em `vitest`.
  Ao adicionar `.font(...)` com um novo peso, registrar o `standard-fonts`
  correspondente no mesmo arquivo, antes de considerar o recurso pronto.
- O relatório não tem preview embutido no app — só os dois botões de
  exportação (PDF/Excel), mesma limitação de "nenhuma visualização de PDF
  embutida" já registrada no ADR 0006.
