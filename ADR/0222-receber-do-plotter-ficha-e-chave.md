# ADR 0222 — Receber do plotter, a ficha da enfestadeira e conferir a chave

Três itens pareciam presos a algo que não se tem: o formato fechado, a máquina e a conta da IA. Em cada um há um caminho que não depende disso.

- **Receber de outro programa:** todo sistema de formato fechado sabe plotar. Com o receptor ligado (Opções), este computador aparece como um plotter de rede, na porta 9100. Instalado esse plotter no outro sistema, o que for plotado nele entra no projeto aberto. Lê HP-GL, com o embrulho de PJL e PCL dos drivers de impressora, DMPL e ISO. Só liga a pedido e não volta sozinho.
- **Trazer de outro sistema:** o manual do programa explica o caminho: primeiro DXF-AAMA ou DXF-ASTM, que traz a graduação; depois plotar. Não cita o menu de cada sistema, porque não foi possível conferir nenhum.
- **Ficha da enfestadeira:** o arquivo .aoc é fechado, mas o que a máquina precisa não é. Uma planilha traz, por tecido, a largura, o comprimento por camada com as perdas, as camadas, o total e as emendas.
- **Conferir a chave:** o serviço de IA ganha um botão que pergunta se a chave vale, pela lista de modelos, sem gastar crédito.

**O que isto não resolve:**

- O arquivo fechado continua sem abrir. O plotter só traz a forma: sem graduação, sem nomes e sem os dados do molde.
- O receptor não pede senha: quem estiver na rede pode plotar nele enquanto estiver ligado. Por isso ele só liga a pedido, e o que chega é tratado como desenho.
- Nenhum sistema de verdade plotou aqui: o teste usa um cliente que manda o que um driver mandaria.
- A ficha não programa a enfestadeira sozinha.
- "Produto: Auto reconhecimento" e "Caminho grade" seguem sem fazer: a busca não achou o que são, e inventar seria pior que faltar. Elas estão na folha de comparação.

Conferência: testes unitários, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
