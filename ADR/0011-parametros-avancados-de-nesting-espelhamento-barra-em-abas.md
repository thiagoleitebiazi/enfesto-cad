# ADR 0011 — Parâmetros avançados de encaixe, espelhamento controlado, barra em abas

## Contexto

O usuário enviou duas capturas de tela do Audaces (CAD industrial comercial
real) mostrando dois módulos bem diferentes: uma "Ficha Técnica"
(custos/coleções) e um diálogo "Automatic marker — Advanced" (parâmetros
avançados de encaixe automático), pedindo "layout e funcionalidades do
Audaces". Dado o princípio já em vigor desde a especificação original
("sem copiar a marca") e a separação deliberada de escopo com o projeto
irmão `moda-cad` (que já cobre ficha técnica/custos/coleções), uma
pergunta de esclarecimento (`AskUserQuestion`) reduziu o pedido a dois
itens concretos e sem sobreposição de escopo:

1. Parâmetros avançados do encaixe automático.
2. Barra de ferramentas em abas (ribbon).

A "Ficha Técnica" foi deliberadamente descartada por sobrepor o escopo do
`moda-cad`.

## Decisões

### 1. Barra de ferramentas em abas (ribbon)

`BarraDeFerramentas.tsx` reagrupa os mesmos botões que já existiam (nenhum
botão novo decorativo) em quatro abas clicáveis — Arquivo, Edição, Desenho,
Encaixe — mais um grupo "Visualização" (zoom) que fica fora do sistema de
abas, sempre visível, porque zoom é uma necessidade constante independente
da tarefa atual. É puramente reorganização de layout: nenhuma função nova,
nenhum handler novo — os mesmos `onClick`/`disabled`/`title` de antes,
só reagrupados.

### 2. Parâmetros avançados do encaixe automático

Dois parâmetros opcionais, adicionados ao motor (`domain/nesting.ts`) e
expostos na UI (`PainelDeNesting.tsx`) antes de iniciar o cálculo:

- **Limite de tempo (minutos)** — o motor para de tentar posicionar peças
  assim que o tempo decorrido (relógio injetável via `opcoes.agora`, para
  testes determinísticos) atinge o limite; peças restantes entram em
  `pecasNaoColocadas` como resultado parcial honesto, não como falha.
- **Aproveitamento desejado (%)** — o motor verifica `aproveitamentoAtual()`
  (área ocupada / área usada até agora) depois de CADA peça posicionada
  com sucesso e para assim que atingir a meta, mesmo com peças/cópias
  ainda por tentar.

`PainelDeNesting` ganhou uma fase de configuração nova, renderizada antes
de iniciar o worker (`!executando && !resultado`), com os dois campos
opcionais e um botão "Calcular encaixe" que só então dispara
`onCalcular({ limiteDeTempoMinutos?, aproveitamentoDesejadoPercentual? })`.
`iniciarNestingAutomatico` foi dividido em `abrirConfiguracaoDeNesting`
(só abre o painel) e `calcularNestingAutomatico` (converte minutos→ms e
inicia o worker) — o botão da barra de ferramentas agora só abre a
configuração, nunca inicia o cálculo direto, para o usuário sempre ver
(e poder ignorar) os parâmetros antes de rodar.

### 3. Espelhamento como extensão da mesma regra crítica da rotação

O Audaces original mostrava opções de espelhamento dentro dos parâmetros
avançados de encaixe. Em vez de um espelhamento "automático e implícito"
(que violaria a regra crítica da seção 5: nunca inventar uma orientação
não autorizada pela peça, mesmo que melhore o aproveitamento), o
espelhamento segue **exatamente o mesmo padrão já estabelecido para
`permite180`/`permite90e270`**: uma flag `permiteEspelhamento` por peça
(`RestricaoDeRotacao`, padrão `false`), com um checkbox "Permitir
espelhamento" em `PainelDePropriedades`, ao lado dos checkboxes de
rotação já existentes.

Primitivas novas em `core/geometria.ts` (`espelharHorizontal`/
`espelharContornoHorizontal` — reflexão numa reta vertical em `centroX`,
isometria pura, preserva área) e `domain/molde.ts` (`espelharMolde` —
aplica a reflexão ao contorno, furos, linhas internas, piques, marcas e
linha de fio, mantendo o resto do molde intocado). O motor de nesting só
gera candidatos espelhados quando a flag está ligada, combinando com cada
ângulo já permitido (nunca inventando uma combinação ângulo×espelhamento
fora do que a peça autoriza).

**Prova geométrica, não só confiança no código**: os testes usam uma peça
em L (`PECA_EM_L`) construída à mão, chamando diretamente
`encontrarPrimeiraPosicaoValida` (contornando a ordenação por área do
motor) com coordenadas verificadas manualmente — provando que existe pelo
menos um cenário real onde a peça SÓ cabe espelhada, nunca apenas
rotacionada, e que sem a flag o motor nunca produz esse espelhamento
mesmo quando ajudaria a caber. Essa construção exigiu várias tentativas
descartadas (formas com divisão diagonal acabavam sendo resolvíveis por
rotação de 180°, não exigiam espelhamento de verdade) antes de chegar numa
peça genuinamente quiral.

## Verificação end-to-end (Electron real, não só testes unitários)

Script de automação (build de produção, não dev server) que: cria um
projeto novo pelo diálogo completo, desenha uma peça real no canvas
(4 cliques de contorno + Enter + 2 cliques de linha de fio, com ~40-50ms
de pausa entre eventos — mesma cautela de timing já documentada nos ADRs
0009/0010), define quantidade 5, ativa "Permitir espelhamento" (confirma
`checked` passando de `false` para `true` no DOM), abre "Nesting
Automático" (confirma que a fase de configuração aparece ANTES de
qualquer cálculo), preenche limite de tempo = 5 min e aproveitamento
desejado = 0,5%, clica "Calcular encaixe" e lê o resultado final:

```
Peças colocadas: 1        Peças não colocadas: 4
Aproveitamento: 16.7%     Status: Parou ao atingir o aproveitamento desejado
```

Confirma, com dados reais (não só a leitura do código): a fase de
configuração bloqueia o início do cálculo até o usuário decidir; os dois
campos realmente chegam ao motor através do worker; a parada por meta de
aproveitamento realmente interrompe antes de tentar as cópias restantes
(4 de 5 ficam de fora, mensagem de aviso correta); e o checkbox de
espelhamento reflete e mantém o estado ligado na peça selecionada.

## Consequências

- `OpcoesDeNesting`/`ResultadoDeNesting` ganharam campos novos, todos
  opcionais — motor continua funcionando sem eles como antes (nenhuma
  mudança de comportamento padrão).
- 23 testes novos em `domain/nesting.test.ts` (geometria do espelhamento,
  segurança/preferência do motor, limite de tempo, meta de aproveitamento)
  — 214/214 testes passando no total.
- `TODO.md`/`MATRIZ_DE_RISCOS.md`: espelhamento segue o mesmo padrão de
  risco já registrado para rotação (regra crítica de sentido do fio) —
  nenhuma entrada nova necessária, a mitigação já documentada cobre o caso.
