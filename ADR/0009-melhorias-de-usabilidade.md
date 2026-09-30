# ADR 0009 — Rendimento de tecido, novo projeto guiado, mesa retangular e atalhos

## Contexto

Pedido direto do usuário, cinco itens de usabilidade sobre o app já em uso:

1. Configuração de tecido devia permitir gramatura e quantidade em estoque
   (kg), para calcular o rendimento (quantas peças/lotes cabem no tecido
   disponível).
2. O botão "Novo" devia abrir uma janela de configuração (como todo
   programa) perguntando o projeto e as medidas, em vez de só limpar a
   tela.
3. A mesa de trabalho devia ser retangular (paisagem), porque monitores têm
   essa proporção — "tem maior visão".
4. A área de trabalho não podia invadir outros espaços da tela.
5. Atalhos de teclado padrão (Ctrl+O/N/I, etc.) para os demais botões.

## Decisões

### 1. Gramatura e estoque → rendimento

Dois campos novos e opcionais em `Tecido` (`domain/tecido.ts`):
`gramaturaGm2` (g/m²) e `quantidadeDisponivelKg` (kg). Opcionais de
propósito — nenhum fluxo existente que já cria/edita tecido quebra, e o
relatório trata a ausência deles como "não calculável" (`null`), nunca como
zero enganoso.

`domain/relatorio.ts` ganhou o cálculo: peso de uma área = `área_m² ×
gramatura_g/m² ÷ 1000`. Aplicado por peça (dentro de cada linha de
`pecasPorTamanho`) e para o projeto inteiro (`pesoTotalEstimadoKg`).
`rendimentoLotes = floor(estoque_kg ÷ pesoTotalEstimadoKg)` — "quantos
conjuntos iguais ao projeto atual cabem no tecido disponível", não um peso
por peça isolado, porque um projeto real mistura modelos diferentes (Frente
+ Costas etc.) e "rendimento" na prática têxtil é sobre o LOTE de corte, não
uma peça solta.

Verificado em três camadas: testes unitários com contas exatas (1m² a
200g/m² = 0.2kg, conferido por m² real, não aproximado), o round-trip do
Excel/PDF exportando os novos campos, e uma sessão real de Electron
preenchendo o formulário de tecido (usando o setter nativo de `<input>`
para respeitar o input controlado do React — ver nota de armadilha abaixo)
e conferindo que o relatório mostra os números certos: 4 peças de 300×400mm
a 200g/m² deram exatamente 0.096kg, e 10kg de estoque deram exatamente 104
lotes — batendo com a conta manual.

### 2. "Novo" abre diálogo de configuração

Novo componente `PainelDeNovoProjeto.tsx` (mesmo padrão `Sobreposicao` dos
demais painéis): pede nome do projeto, largura útil da mesa (mm) e
comprimento da mesa (mm). Ao confirmar, essas medidas viram um enfesto
inicial real (tipo Ímpar, sem margens, 1 camada — o mínimo neutro, editável
depois pelo botão "Enfesto") em vez de abrir a tela vazia sem nenhuma
relação com o trabalho real, como antes.

Não foi pedido tecido no mesmo diálogo — tecido continua sendo configurado
à parte pelo botão "Tecido" (o formulário de tecido tem campos demais para
caber num diálogo de "novo projeto" sem virar um formulário gigante logo de
cara). O diálogo cobre exatamente o que o pedido chamou de "medidas".

### 3 e 4. Mesa retangular / área não pode invadir outros espaços — mesmo bug, duas percepções

Os itens 3 e 4 eram o MESMO bug de CSS Grid, não dois problemas separados.
Medindo o layout numa sessão real de Electron: o container da área de
desenho (`.area-de-desenho-container`) e as duas réguas (`.regua-horizontal`,
`.regua-vertical`) são itens de grid dentro de `.area-de-desenho-grade`
(colunas/linhas `24px 1fr`). As réguas são `<canvas>` com `width`/`height`
setados via JS a partir do estado `tamanho` (que começa em `{800, 600}`) —
e canvas, como todo elemento substituído, contribui seu tamanho intrínseco
para o cálculo de tamanho mínimo automático do grid **mesmo dentro de uma
coluna/linha `1fr`**, a menos que o item tenha `min-width`/`min-height`
explicitamente zerados. Sem isso, a coluna `1fr` nunca encolhia abaixo de
800px nem a linha `1fr` abaixo de 600px — em qualquer janela menor que
isso, a área de desenho **vazava por cima do painel direito** (medido:
14-18px de sobreposição real numa janela de 1266px) e, em qualquer relação
de aspecto, ficava travada num retângulo quase quadrado (800×600) em vez de
esticar para ocupar o espaço realmente disponível — exatamente a "mesa não
retangular, sem aproveitar a proporção do monitor" do pedido.

Corrigido com `min-width: 0` em `.area-de-desenho-container` e
`.regua-horizontal`, `min-height: 0` em `.regua-vertical`. Mesma classe de
bug já documentada nesta sessão para outro elemento (ver histórico do
projeto) — grid + elemento substituído com tamanho via atributo é um padrão
recorrente que vale a pena checar sempre que uma área de canvas dentro de
grid parecer "grudada" num tamanho que não muda com a janela.

**Verificado por medição real, não só visual**: um script Electron mediu
`getBoundingClientRect()` do container antes e depois do fix. Antes: canvas
800×600, transbordando 18px sobre o painel direito. Depois: canvas
782×436, exatamente do tamanho disponível (confirmado batendo com a conta
manual: 1266 − 220 − 240 − 24 = 782). Testado adicionalmente forçando o
atributo do canvas para 10×10 e confirmando que o container SÓ muda de
tamanho depois do fix — prova de que a causa raiz era mesmo o
`min-width`/`min-height` ausente, não outra coisa.

### 5. Atalhos de teclado

Adicionados: `Ctrl+N` (Novo), `Ctrl+I` (Importar DXF), `Ctrl+E` (Exportar
PDF — só se houver peças, mesmo guard do botão), `Ctrl+Shift+S` (Salvar
como — teve que vir ANTES do `Ctrl+S` simples no `if/else`, porque
`e.key` já vem maiúsculo quando Shift está pressionado e
`.toLowerCase()` faz as duas condições coincidirem se a ordem/guarda
estiver errada), `Ctrl+H` (Histórico). `Ctrl+O`/`Ctrl+S`/`Ctrl+Z`/`Ctrl+Y`/
`Ctrl+D` já existiam de etapas anteriores.

Não foi adicionado atalho para Tecido/Enfesto/Relatórios/Sugerir posição/
Nesting automático — são ações de configuração secundárias, não do fluxo
"arquivo" que o pedido deu como exemplo (Ctrl+O/N/I), e forçar uma letra
mnemônica nelas (nenhuma tem uma letra óbvia livre) criaria atalhos
arbitrários e difíceis de lembrar sem ganho real. Documentado aqui como
decisão de escopo, não esquecimento.

## Armadilha real encontrada na verificação (vale registrar)

Ao escrever o script de verificação em Electron real, `input.value = 'x'`
seguido de `dispatchEvent(new Event('input'))` funcionou para alguns campos
mas deixou outros em branco de forma inconsistente — um campo "Nome"
salvou vazio mesmo depois do script "preenchê-lo". Causa: React rastreia o
último valor via um setter de propriedade nativo interceptado; setar
`.value` diretamente às vezes deixa esse rastreamento dessincronizado, e o
`input` event subsequente não dispara o `onChange` do React de forma
confiável em todos os casos. Corrigido usando o setter nativo de verdade:
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,
'value').set.call(input, valor)` antes de disparar o evento — a técnica
padrão para simular digitação em inputs controlados por React a partir de
fora do React. Não era um bug do app (o campo "Nome" do tecido é código
antigo, não tocado nesta etapa) — era do script de verificação. Registrado
aqui para não repetir a mesma investigação da próxima vez.

## Consequências

- `criarTecido` não valida `nome` não-vazio (comportamento pré-existente,
  não alterado aqui) — um tecido com nome em branco é aceito e mostrado
  como "Tecido:  (NNNN mm úteis)" com um espaço estranho. Não é uma
  regressão desta etapa, mas ficou mais visível ao testar; não corrigido
  agora por estar fora do escopo pedido.
- O enfesto criado pelo diálogo de "Novo" é sempre tipo Ímpar com 1 camada
  e margens zero — um ponto de partida neutro, não uma tentativa de
  adivinhar o tipo de enfesto real do usuário. Editável imediatamente pelo
  botão "Enfesto".
