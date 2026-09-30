# ADR 0010 — Mesa visível, tecido completo no "Novo projeto", seleção múltipla

## Contexto

Terceiro pedido direto do usuário sobre o app em uso, em cima do ADR 0009:

1. O diálogo de "Novo projeto" devia pedir também a configuração do tecido
   (tipo, kilos, largura, gramatura) e permitir escrever uma descrição.
2. A área de trabalho continuava não parecendo "retangular na horizontal" —
   mesmo depois do ADR 0009 corrigir o CSS Grid que travava o tamanho do
   canvas.
3. Uma lista de atalhos padrão (CTRL+A até CTRL+Z) pedindo para adicionar
   os que ainda faltassem.

## Decisões

### 1. "Novo projeto" também cria o tecido

`PainelDeNovoProjeto.tsx` ganhou os campos de tecido (tipo/nome, largura em
mm, gramatura opcional, estoque em kg opcional, descrição opcional — os
mesmos conceitos do ADR 0009, só que preenchidos ao criar o projeto em vez
de exigir um segundo passo pelo botão "Tecido"). `criarNovoProjetoComDados`
agora monta tanto o `ConfiguracaoDeEnfesto` (mesa) quanto o `Tecido` numa
única chamada, usando `criarTecido` com a largura informada tanto para
`larguraTotalMm` quanto `larguraUtilMm` (simplificação deliberada — pedir
as duas separadamente não foi solicitado, e o usuário ainda pode refinar
depois pelo botão "Tecido" se precisar diferenciar largura total da
largura de corte).

### 2. Causa raiz real do "não parece retangular": não havia mesa nenhuma desenhada

Investigando de novo antes de reformular a mesma correção: `AreaDeDesenho`
nunca recebia o `enfesto` como prop e nunca desenhava nada além de um fundo
cinza uniforme + as peças. Não existia, em lugar nenhum, um retângulo
representando a mesa real configurada — só as réguas com números. O ADR
0009 corrigiu o container ter o TAMANHO certo (não mais travado em
800×600, não mais vazando sobre o painel), mas o CONTEÚDO desenhado dentro
dele continuava sem nenhuma referência visual de "isto é a mesa". Por isso
o pedido voltou: o bug de layout estava corrigido, mas o sintoma
("não parece uma mesa retangular") continuava, porque a causa não era só de
layout.

Corrigido desenhando a mesa de verdade: um retângulo de `(0,0)` até
`(larguraUtilMm, comprimentoMm)` do enfesto (mesma convenção de
`domain/posicionamento.ts`/`domain/nesting.ts`), com a faixa de margem
(`margemLateralMm`/`margemDeExtremidadeMm`) num tom mais escuro e a área
útil de verdade em branco por cima — a margem agora se vê, não só se
calcula. `ajustarTela()` também passou a enquadrar a mesa inteira (não só
as peças) quando não há peças ainda, e `criarNovoProjetoComDados` chama o
enquadramento na hora de criar o projeto — a mesa nova aparece inteira e
retangular imediatamente, sem precisar clicar em "Ajustar" manualmente.

**Verificado de forma que prova a causa, não só o sintoma**: o script de
verificação leu o pixel do centro do canvas via `getImageData` depois de
criar um projeto com mesa 2000×1000mm — `[255,255,255,255]` (branco puro),
confirmando que a mesa realmente está sendo desenhada, não só presumindo
pelo código-fonte.

### 3. Atalhos: implementados de verdade só os que fazem sentido no domínio deste app

Da lista pedida (CTRL+A/B/C/D/E/G/I/J/K/N/O/P/Q/S/V/X/Z), os que já
existiam desde o ADR 0009 foram ignorados como pedido (D/E/I/N/O/S/Z).
Dos que faltavam:

- **Implementados** (fazem sentido real no domínio de um CAD de moldes):
  - `Ctrl+A` — Selecionar tudo.
  - `Ctrl+C`/`Ctrl+X`/`Ctrl+V` — Copiar/Recortar/Colar uma peça.
- **Deliberadamente NÃO implementados**, um por um, porque vincular a
  tecla a uma ação decorativa contradiz o princípio já em vigor desde a
  Etapa 1 (nenhum botão sem função real por trás):
  - `Ctrl+B` (Negrito) — não há texto rico em lugar nenhum do app.
  - `Ctrl+G`/`Ctrl+K` (Agrupar/Separar) — não existe conceito de
    agrupamento de peças no modelo de domínio (`Molde` não tem noção de
    "conjunto"); implementar um atalho para algo que não existe seria
    decorativo. Ficaria como uma feature nova de verdade, não um atalho.
  - `Ctrl+J` (Opções) — não existe painel de opções/preferências no app.
  - `Ctrl+P` (Imprimir) — o app já tem "Exportar PDF" (Ctrl+E) gerando um
    PDF vetorial real em escala 1:1 (ADR 0005) — o equivalente funcional
    de "imprimir" para um CAD industrial. Um "imprimir" literal via
    `webContents.print()` imprimiria a VIEW da tela (zoom arbitrário, sem
    a escala 1:1 cuidadosamente garantida pelo export), o que contradiria
    diretamente o requisito mais crítico da seção 8 do escopo original.
  - `Ctrl+Q` (Curvar) — curvas Bézier são uma limitação já documentada
    desde a Etapa 3 (`TODO.md`: "só segmentos retos por enquanto"); o
    botão "Curva" da barra já existe desabilitado com esse aviso. Um
    atalho de teclado para a mesma coisa não-implementada seria o mesmo
    problema com um disfarce diferente.

### Seleção múltipla: estado separado, não uma reescrita da seleção única

Em vez de migrar `selecionadoId: string | null` inteiro para um array
(mudança grande, arriscada, tocando ~40 pontos do código já testados —
furo/pique/marca/rotação/edição de propriedades, todos conceitualmente
"uma peça por vez"), a seleção em lote vive num estado à parte
(`idsSelecionadosEmLote: ReadonlySet<string>`). `Ctrl+D`/Delete foram
estendidos para operar no lote quando ele existe; ferramentas de
peça-única (furo, pique, marca, rotação) continuam exigindo exatamente uma
peça selecionada, porque conceitualmente não fazem sentido em "todas as
peças ao mesmo tempo" — o pedido original não pedia isso, e inventar
"furo em lote" seria escopo novo, não um atalho.

Qualquer seleção explícita de UMA peça (clique no canvas ou na lista)
limpa a seleção em lote automaticamente (`selecionarUnico`), para os dois
modos nunca coexistirem de um jeito confuso.

**Copiar/colar usa um clipboard em `useState`, não um `useRef`.** A
primeira versão usava `useRef<Molde|null>` para não guardar um objeto
grande desnecessariamente em estado — mas um ref mutado não dispara
re-render, então o botão "Colar" ficaria com o `disabled` desatualizado
até algum OUTRO re-render acontecer por acaso. Trocado para
`useState<Molde|null>` deliberadamente: aqui a reatividade da UI importa
mais que evitar guardar um objeto no estado.

## Consequências

- Todas as verificações deste ADR foram feitas com peças desenhadas de
  verdade no canvas via automação (não só peças de demonstração
  pré-existentes) — confirmando que Selecionar tudo, Duplicar/Excluir em
  lote e Copiar/Recortar/Colar funcionam com dados reais criados na hora:
  2 peças → Ctrl+A seleciona as 2 → Ctrl+D duplica para 4 → Ctrl+A+Delete
  apaga as 4 → Ctrl+C/Ctrl+V/Ctrl+X/Ctrl+V confirmados em sequência.
- Armadilha de teste repetida (mesma classe já registrada no ADR 0009):
  disparar 4 cliques de canvas + Enter + 2 cliques em sequência SEM pausa
  entre eles intermitentemente falhou em registrar pontos (peça ficava com
  0 peças no final). Corrigido adicionando ~40ms de espera entre cada
  evento disparado no script de verificação — não é um bug do app, é o
  mesmo comportamento de "timing entre eventos sintéticos" já documentado
  no ADR 0009 e na memória do projeto.
- O botão "Copiar"/"Colar", desabilitado desde a Etapa 2 com o aviso "use
  Duplicar por enquanto", agora é real — o aviso genérico foi removido.
