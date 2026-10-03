# ADR 0020 — Remove o painel fixo de Propriedades, adota diálogo flutuante

## Contexto

Pedido estruturado (template de "atualizar interface para corresponder a
imagem de referência"), com a mesma screenshot do Audaces Moldes
Avançado já usada nos ADRs 0013-0019 como "imagem 2". Diferença desta
vez: instrução explícita e detalhada para **remover o painel fixo de
Propriedades da lateral direita** — ele existe na interface atual, mas
não existe na imagem de referência (lá, edição de peça acontece via
diálogos flutuantes sobre o canvas, como o "Dimensionar" visível na
imagem).

Esclarecido via `AskUserQuestion` antes de implementar (a imagem não
veio anexada na primeira mensagem — confirmado que era a mesma já usada,
reenviada em seguida) e uma segunda pergunta sobre o escopo exato da
remoção: a resposta do usuário foi explícita — remover o painel fixo,
mas **não** empurrar tudo para dentro do diálogo "Dimensionar" (que
continua sendo só a ferramenta de dimensionamento). Em vez disso, manter
nome/referência/margem de costura/rotações/etc. editáveis por "meios
contextuais apropriados... sem inventar novos comportamentos", e
verificar antes que nada ficasse inacessível.

## Decisão

### Painel de Propriedades vira diálogo flutuante sob demanda

`PainelDePropriedades` (todos os campos: Nome, Referência, Tamanho,
Quantidade, Margem de costura, Rotações permitidas, Girar peça, e o
resumo em `<dl>`) foi **movido integralmente, sem remover nenhum
campo**, para dentro de uma `Sobreposicao` (o mesmo componente de
diálogo já usado por Tecido/Enfesto/Dimensionar/Novo Projeto) — só
muda o CONTêiner (de `<section>` docked para `Sobreposicao` flutuante),
a lógica/formulário interno é idêntica. Nenhum comportamento novo
inventado: é literalmente o mesmo painel, só exibido sob demanda em vez
de sempre visível.

Gatilhos de abertura (dois, cobrindo os dois lugares naturais onde um
usuário pensaria em "abrir os detalhes de uma peça"):
- **Duplo-clique num item da lista de peças** (`PainelDePecas`).
- **Duplo-clique na peça no canvas**, no modo "Selecionar" (`AreaDeDesenho`).

### Caixa de seleção na lista de peças

A imagem de referência mostra uma caixa de seleção ao lado de cada item
da lista. Em vez de inventar um comportamento novo sem função real,
ligada diretamente ao mecanismo de **seleção em lote já existente**
(`idsSelecionadosEmLote`, usado por Ctrl+A/Duplicar/Excluir/Alinhar
desde o ADR 0010): marcar a caixa inclui a peça na seleção em lote,
desmarcar remove — independente do clique na linha (que continua
fazendo seleção única, como antes). Zero conceito novo, só uma segunda
forma de acionar uma função que já existia.

### Numeração dos vértices sempre visível

A imagem de referência mostra números nos vértices de cada peça o tempo
todo, não só durante edição. Os índices já existiam internamente
(usados por Mover/Inserir/Excluir ponto) — passaram a ser desenhados
como texto pequeno ao lado de cada vértice no desenho normal da peça
(não inventa dado novo, só exibe um índice que já existe).

### Grade principal: 3 colunas → 2 colunas

`.corpo-principal` (`grid-template-columns`) perde a 3ª coluna fixa de
240px — a área de desenho agora ocupa todo o espaço à direita da lista
de peças, igual à composição da imagem de referência.

## O que NÃO foi reproduzido, e por quê

- **Barra de título nativa da janela** (ícone/nome "Enfesto CAD" +
  minimizar/maximizar/fechar): já é a barra de título real do Electron,
  fora do controle do HTML/React — nada para mudar aqui.
- **Botões 90°/180°/270° sempre visíveis fora do diálogo**: continuam
  existindo dentro do diálogo de Propriedades (acesso preservado,
  conforme pedido), mas não foram duplicados na ribbon — a instrução
  pedia preservar ACESSO funcional, não necessariamente a mesma
  visibilidade constante; duplicar o mesmo controle em dois lugares
  arriscaria confundir com o "Girar" de ângulo livre que já existe na
  aba Manipulação.
- **Cores/ícones específicos da marca Audaces**: mantida a decisão já
  registrada nos ADRs 0017/0018 — convenções de layout são replicadas,
  identidade visual de marca não.

## Verificação (Electron real, build de produção)

- Checagem direta no DOM: `.corpo-principal` tem 2 colunas (antes 3);
  nenhum elemento com `aria-label="Propriedades da peça selecionada"`
  existe mais fora de um diálogo; duplo-clique num item da lista abre o
  diálogo (`.sobreposicao-painel` aparece).
- Capturas de tela em dois tamanhos de janela (1440×900, igual à
  proporção da referência, e 1024×700, para testar adaptação): composição
  bate com a referência (barra de acesso rápido, abas, ribbon, lista com
  caixa+miniatura+nome, canvas branco com régua em cm ocupando todo o
  espaço à direita, sem painel fixo); na janela menor a ribbon
  genuinamente não cabe numa linha só e quebra para uma segunda linha —
  comportamento esperado/necessário nesse tamanho, nada sobrepõe ou corta.
- Diálogo de Propriedades aberto por duplo-clique mostra todos os campos
  originais intactos (nome, referência, tamanho, quantidade, margem de
  costura, rotações permitidas, girar peça, resumo).
- 252/252 testes (sem testes novos — mudança de UI pura, sem lógica de
  domínio nova), typecheck/lint/build limpos.

## Consequências

- `PainelDePropriedades`/`PainelDePecas` (`ui/PainelLateral.tsx`) ganham
  novas props (`onAlternarSelecaoEmLote`, `onAbrirPropriedades`) — ambas
  opcionais, não quebram nenhum outro uso do componente.
- Nenhum dado de peça foi descartado ou teve comportamento alterado —
  é puramente uma mudança de ONDE e QUANDO os mesmos controles aparecem.
