# ADR 0093 — Melhoria visual: uma base única, os estados à vista e o planejamento no padrão das outras janelas

## Contexto

Pedido do usuário: uma melhoria visual completa — mais profissional, organizada e agradável de usar na rotina de
produção —, sem mudar regras de negócio, cálculos, dados, gravação, importação/exportação, o encaixe nem os fluxos de
confirmação, e sem tirar campo, botão, validação ou recurso.

Antes de mudar, o programa foi aberto (o gerado, numa pasta de dados descartável) e fotografado tela por tela a
1280 × 720 — a tela de quem usa (1920 × 1080 a 150%). O que se viu:

- a tela principal e a maioria das janelas já eram coerentes (a fita de CAD, a lista de peças, o desenho);
- o **Planejamento de corte** destoava: campos e botões sem estilo (os do sistema), botões esticados na largura toda,
  campos da configuração desalinhados (rótulos de 2 e 3 linhas), "Confirmar o plano" igual a "Salvar rascunho", e a
  janela mais larga que a área visível — rolava na horizontal e, nas últimas etapas, cortava o texto pela esquerda;
- a **faixa da validação** ficava vermelha mesmo com "Nenhum problema encontrado";
- no **Nesting**, Cancelar e Calcular ficavam cortados no pé da janela, e notas longas apareciam em MAIÚSCULAS;
- o **Relatório** empilhava rótulo e valor, e a lista passava da altura da tela;
- dois cinzas misturados (um azulado e um neutro), o botão principal com degradê, e o Tahoma como fonte no Mac.

## Decisão

### A base (App.css)

- **Cores:** uma escala de cinza (`--cinza-0` a `--cinza-900`, levemente azulada), um azul só para destaque
  (`--azul-*`: seleção, ação principal, foco) e as cores dos estados, cada uma com texto, fundo e borda
  (`--sucesso-*`, `--aviso-*`, `--erro-*`, `--info-*`). Os nomes de antes (`--cor-*`) apontam para a escala; os
  cinzas soltos dos componentes passaram a usá-la.
- **Fonte:** Segoe UI no Windows (como antes) e, no Mac, a do sistema (`system-ui`). Nenhum texto abaixo de 11 px.
- **Barras de rolagem** finas, no tom da interface; **foco** visível em botões, campos, resumos (`summary`) e links.
- **Controles das janelas** sem classe própria (botão, campo, seleção, tabela, `fieldset`, `details`): o mesmo
  estilo em todas, com especificidade zero (`:where`) — o estilo próprio de um componente sempre vale por cima. Estados
  de passar o mouse, foco, desabilitado e inválido (`aria-invalid`).
- **Botões:** o principal (`.botao-primario`, um por tela, sem degradê), o comum e o de perigo (`.botao-perigo`:
  Excluir, com o texto e a borda vermelhos; a confirmação continua a mesma).
- **Estados sem depender só de cor:** os ícones (aviso, erro, informação, sucesso) mudam de forma; os alertas do plano
  começam pelo rótulo do nível ("Erro", "Aviso", "Informação"); "Salvo às…" e "Validação: …" ganham o ícone.
- **Tabelas:** cabeçalho em cinza claro, linhas finas e números à direita (`.coluna-numerica`) nas colunas só de
  números (as tabelas do plano, do custo do tecido e do relatório).

### A tela principal

- Faixa dos avisos da importação: o ícone, o título, a lista e o **Dispensar** à direita (sem uma linha só para ele).
- Faixa da validação: verde sem problema, amarela só com avisos, vermelha com erro (`estadoDaValidacao`).
- Faixa de instrução: o ícone de informação. Barra de status: os itens separados por um traço fino.
- Lista de peças vazia: além de "Nenhuma peça no projeto.", como começar (importar um molde ou desenhar).

### As janelas

- O cabeçalho fica no topo enquanto a janela rola; o "×" virou um botão de 28 px, com o foco visível.
- Os botões ficam **sempre à vista, presos embaixo**, nas janelas longas: Tecido, Enfesto, Novo projeto, Nesting,
  Relatório e Planejamento (o "Seguir").
- Nesting e Novo projeto: as notas longas saíram das maiúsculas (só os títulos curtos continuam em versalete).
- Relatório: o rótulo à esquerda e o valor à direita, uma linha cada.

### O Planejamento de corte

- A janela cabe na tela (até 1240 px, nunca mais que 94% da largura): sem rolagem horizontal em nenhuma etapa.
- **As etapas** viraram um caminho: a atual em azul, e o estado de cada uma (✓ dados completos, ⚠ falta dado),
  tirado das mesmas listas "falta" que a etapa mostra; "Planos deste projeto" fica à direita, separado. O estado vai
  na dica do botão; o nome do botão não muda.
- **Obrigatórios** com * (os que as regras do formulário já exigem: código da ordem, descrição e largura útil da
  malha, peso disponível, medidas do risco informado, a configuração da mesa e do encaixe, o responsável), com a
  legenda no alto; os campos de ações opcionais (registrar revisão, cadastrar rolo) não levam *.
- **O erro junto do campo:** a mensagem da lista "falta" que cita o campo pelo nome (entre aspas) aparece logo abaixo
  dele, com o ícone e `aria-invalid`/`aria-describedby` — depois que a pessoa passa pelo campo, para o formulário não
  abrir todo vermelho. A lista "falta" de cada etapa continua.
- **Uma ação principal por etapa:** Seguir (etapas 1 a 3), Calcular as alternativas (4), Revisar e confirmar esta
  alternativa (5), Confirmar o plano (6) e Sim, confirmar. A confirmação do plano ganhou um bloco próprio (não usa mais
  a cor de bloqueio). Os botões das etapas têm o tamanho do texto; os campos da configuração ficam alinhados (colunas
  de 140 px, o campo no pé da célula).

## O que não mudou

Cálculos, regras, gravação, importação e exportação, o encaixe, a validação, as perguntas de confirmação do sistema
("Continuar?", "Excluir…?") e os nomes dos campos. Duas exceções de texto, as duas conferidas antes:

- a opção vazia da unidade do custo passou de "(escolha, se informar o custo)" para "(escolha)" (o texto longo era
  cortado no campo);
- **corrigido** (era um problema de mensagem, não visual): no risco informado à mão, a falta da largura dizia
  `"Largura do risco (m)"` — o nome de outro campo da mesma etapa (a largura da malha). Agora diz
  `"Largura ocupada do risco (m)"`, o campo de verdade. Nenhum cálculo muda; nenhum teste dependia do texto antigo.

## Achados, não mexidos (dependem de decisão)

- O **ponto decimal**: a barra de status ("X: 12.34 cm") e o relatório ("954.0 mm", "19.5%") usam ponto, e o resto do
  programa, vírgula. A barra de status é testada com o ponto (foi uma escolha); padronizar é uma decisão à parte.
- O texto do **Novo projeto** diz "sem margens", mas desde o ADR 0091 a margem de segurança de 4 mm vale sempre.
- A **área de desenho** (as cores das peças, da mesa e da seleção) é desenhada pelo programa, não pelo CSS: ficou como
  estava.

## Conferência

- `npx vitest run`: 127 arquivos, 2598 testes, todos passando (antes: 126 e 2591); `npx eslint .` sem erro nem
  aviso; `npx tsc -b --noEmit` sem erro; `npm run build` gera o programa.
- O teste de uso do repositório (`scripts/teste-de-uso/main.cjs`, o mesmo do Mac do GitHub), rodado no Windows com o
  visual novo: 14 conferências, nenhuma falha, sem erro na página.
- Testes novos: `estadoDaValidacao`; a lista de peças vazia com a dica; no planejamento, o obrigatório
  (`aria-required`), o erro junto do campo depois de visitado (e que some quando corrigido), o estado das etapas na
  dica, a mensagem do risco informado e a ação principal de cada etapa.
- O programa gerado, fotografado antes e depois, a 1024 × 700 (a menor janela), 1280 × 720 (a tela de quem usa) e
  1920 × 1080 (simulado com zoom): sem rolagem horizontal, sem erro na página.
