# ADR 0022 — Acabamento visual "profissional" (sombras, estados, tipografia)

## Contexto

Após mostrar capturas de tela do estado atual, o usuário respondeu
"não está profissional" — feedback real, mas sem apontar o quê
especificamente. Em vez de adivinhar, usei `AskUserQuestion` com 4 áreas
candidatas (estilo visual de botões/painéis, densidade/espaçamento,
tipografia, ícones/gráficos no canvas); o usuário marcou **todas as 4**.

Revisando o CSS existente (`App.css`), o diagnóstico ficou claro: os
elementos já tinham a ESTRUTURA certa (ribbon, abas, painéis, diálogo),
mas faltava o acabamento que diferencia software comercial de um
protótipo — sem sombras/profundidade em nenhum lugar, zero estado de
`hover` na lista de peças, zero `focus` visível em campos de formulário,
abas ativas indicadas só por fundo branco (sem nenhum destaque),
elementos numerados no canvas como texto solto sem nenhum marcador.

## Decisão

Mudança é inteiramente de apresentação (CSS + refinamento de desenho no
canvas) — nenhuma prop, handler ou comportamento novo.

### Design tokens (`:root`)

Acrescentados `--cor-borda-forte`, `--cor-texto-secundario`,
`--cor-selecao-escura`, três níveis de sombra (`--sombra-leve/-media/
-flutuante`) e três raios de borda (`--raio-sm/-md/-lg`), substituindo
valores de `border-radius`/`box-shadow` espalhados e inconsistentes por
uma escala única. `body` ganhou `-webkit-font-smoothing: antialiased` e
`font-variant-numeric: tabular-nums` (números do status bar alinham em
largura fixa). Todo `button`/`input`/`select`/`textarea` ganhou
`transition` nas propriedades visuais e um anel de foco visível
(`:focus-visible`) — nenhum dos dois existia antes.

### Ribbon/toolbar

- Barra do ribbon e conteúdo das abas ganharam `box-shadow` sutil,
  separando visualmente as camadas (barra de acesso rápido → abas →
  grupos → canvas) em vez de depender só de bordas de 1px.
- Aba ativa ganhou um friso azul no topo (`box-shadow: inset 0 2px 0
  var(--cor-selecao)`) — o mesmo tipo de indicador usado por ribbons/
  editores profissionais, além do fundo branco que já existia.
- `.grupo-de-ferramentas` ganhou fundo levemente destacado do branco
  puro do conteúdo da aba, raio maior e rótulo do grupo em negrito.
- Botão selecionado/pressionado (`item-selecionado`/`aria-pressed`)
  passou de cor sólida para um leve gradiente + sombra, com um estado de
  "pressionado" (`:active`, sombra interna) que não existia.

### Lista de peças e diálogos

- `.lista-de-pecas button` não tinha ESTADO DE HOVER NENHUM antes —
  agora destaca fundo+borda ao passar o mouse, e o item selecionado usa
  o mesmo gradiente+sombra do ribbon (consistência visual entre os dois
  lugares onde "selecionado" aparece).
- Cabeçalho do diálogo (`Sobreposicao`) ganhou fundo levemente diferente
  do corpo (como o título de uma janela nativa) e sombra mais forte/
  realista (`--sombra-flutuante`) no painel inteiro.
- `PEÇAS` (título do painel lateral) ganhou borda inferior e peso maior,
  criando separação clara de seção.

### Canvas (`AreaDeDesenho.tsx`)

- Numeração de vértices: cada vértice agora tem um pequeno ponto
  preenchido (além do número, que passou a negrito) — mesma convenção
  visual de marcador de ponto de um CAD, não só texto flutuando.
- Novo helper `desenharRotuloComFundo` (reaproveitado pelo nome da peça
  e pelo texto da cota, ambos adicionados no ADR 0021): desenha um
  pequeno retângulo branco semi-opaco atrás do texto, usando
  `TextMetrics.actualBoundingBoxAscent/Descent` para dimensionar —
  mesma convenção de cotas de CAD profissional (texto sempre legível
  sobre qualquer coisa atrás dele, não só "flutuando" sobre o contorno).
- `desenharSeta` (seta de fio e seta de medida) ganhou `lineCap:
  'round'` nas pontas da linha, para um traço menos "serrilhado".

## O que foi deliberadamente NÃO mexido

- **Densidade do espaço vazio do canvas** (muito cinza ao redor da
  mesa): isso é resultado do zoom/posição atuais, não de CSS — mudar
  exigiria alterar comportamento (zoom padrão, auto-fit), não só
  aparência, e não foi pedido. Fica para um pedido futuro específico se
  o usuário achar que o zoom inicial deveria ser diferente.
- **Conjunto de ícones**: já eram consistentes (mesmo `viewBox`,
  `strokeWidth`, `strokeLinecap/join` — ver `Icone.tsx`); o pedido de
  "ícones parecem rascunho" foi interpretado como fazendo parte do
  acabamento geral (sombra/contraste ao redor deles), não como pedido
  para redesenhar os ~39 ícones individualmente.

## Verificação (Electron real, build de produção)

Capturas de tela em 1440×900 com 2 peças desenhadas (uma dentro da mesa,
uma propositalmente fora para também mostrar o destaque de validação em
vermelho não quebrado pelas mudanças): aba Construção, aba Manipulação,
e o diálogo de Propriedades aberto por duplo-clique — confirmando
visualmente: friso azul na aba ativa, grupos com fundo diferenciado,
hover/seleção da lista de peças com gradiente+sombra, cabeçalho do
diálogo com fundo distinto, pontos+números em negrito nos vértices, e os
rótulos de nome/medida no canvas com fundo branco legível. 252/252
testes (mudança de apresentação pura, nenhum teste novo necessário),
typecheck/lint/build limpos.

## Consequências

- `src/App.css`: tokens novos em `:root`, nenhum token removido —
  qualquer seletor que já usava `var(--cor-borda)` etc. continua
  funcionando, só o valor subjacente mudou.
- `AreaDeDesenho.tsx`: novo helper `desenharRotuloComFundo` (useCallback,
  sem dependências externas) adicionado ao array de dependências do
  efeito de desenho principal.
