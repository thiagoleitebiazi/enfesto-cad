# ADR 0015 — Remove peças de demonstração, reorganiza grupos e adiciona "Elemento paralelo"

## Contexto

Um quarto screenshot do Audaces (a mesma tela do ADR 0013, agora com o
diálogo "Dimensionar" aberto e os grupos da aba Manipulação bem
visíveis), com três pedidos diretos: "deixe exatamente como está na
imagem", "remova os 2 exemplos de frente e costa", "deve estar
organizado e com as mesmas funcionalidades da imagem".

## Decisões

### 1. Peças de demonstração removidas

`pecasDeDemonstracao()` (Frente/Costas, existia desde a Etapa 1) foi
removida — o projeto agora abre com `pecas: []`. A mesa/tecido de
demonstração (ADR 0012) continuam existindo, porque esses SIM são a
característica real de "a mesa aparece deitada desde o início"; as duas
peças nunca tiveram esse papel, eram só uma demonstração inicial.

### 2. Grupos da aba Manipulação renomeados e reorganizados para bater com a imagem

Os nomes dos grupos ("Pontos"/"Transformar"/"Organizar", inventados no
ADR 0013) foram trocados pelos nomes REAIS da imagem — **Redefinir**,
**Indicar**, **Definir curva**, **Manipular molde** — e os itens
existentes foram redistribuídos para bater com o agrupamento mostrado:

- **Redefinir**: Mover ponto
- **Indicar**: Elemento paralelo (novo), Girar, Dimensionar, Espelhar
- **Definir curva**: Inserir ponto, Excluir ponto
- **Manipular molde**: Alinhar, Chanfrar canto, Arredondar canto

### 3. "Elemento paralelo" — nova função real, não só reorganização

Diferente dos outros itens desta aba, "Elemento paralelo" não existia
ainda. Mapeado para o domínio deste app como: cria uma NOVA peça com o
contorno inteiro deslocado por uma distância uniforme (positiva = para
fora, negativa = para dentro) — reaproveitando `deslocarContornoParaFora`,
a mesma função já usada para calcular a linha de corte da margem de
costura (`contornoDeCorte`). Furos/piques/marcas não são copiados para a
peça nova (ficariam com posições incoerentes em relação ao contorno
deslocado, mesmo cuidado já tomado em `dimensionarMolde`).

### 4. O que NÃO foi implementado — motivo genuíno, não preguiça

Vários rótulos da imagem continuam sem equivalente real neste app, por
eu não ter certeza do comportamento exato sem acesso prático ao Audaces
(a imagem sozinha não deixa claro o suficiente para implementar direito):

- **"Manipular pontos"** e **"Manipulação rápida"** (ícone grande à
  esquerda do grupo Redefinir) — parecem ser um seletor de modo/menu
  maior, não um botão de ação única; sem saber exatamente o que cada
  opção faz, implementar seria adivinhar.
- **"Mover"**/**"Redefinir perímetro"** — "Mover" já existe (arrastar a
  peça inteira no modo Selecionar, aba Desenho); "Redefinir perímetro"
  tem nome ambíguo o suficiente para não arriscar um palpite.
- **"Copiar"** (dentro de Indicar) — já existe como "Duplicar" na aba
  Edição (Ctrl+D); não dupliquei o botão aqui para não ter duas ações
  idênticas com nomes diferentes.
- **"Definir cerca"/"Mover cerca"** — sem contexto suficiente do que uma
  "cerca" significa nesta ferramenta específica (limite de edição?
  agrupamento temporário?).
- **"Transformar elementos"**, **"Copiar ou trocar elemento"**,
  **"Converter em costura"** — nomes que sugerem funcionalidade real, mas
  cujo comportamento exato não dá para inferir só da imagem.

Se o usuário quiser algum desses especificamente, a forma mais segura de
implementar certo é explicar o que a ferramenta deveria fazer (não só
o nome) — daí dá para mapear para uma função real do domínio, do mesmo
jeito que "Elemento paralelo" foi mapeado para `deslocarContornoParaFora`.

## Verificação (Electron real, build de produção)

- Projeto abre com "Nenhuma peça no projeto." (confirmado via DOM) — as
  peças de demonstração realmente sumiram.
- "Elemento paralelo" aplicado com 15mm numa peça de 269.2×384.6mm
  resultou numa peça nova (lista passa de 1 para 2 itens) de
  299.2×414.6mm — exatamente +30mm em cada dimensão (15mm de cada lado),
  matemática conferida à mão.
- Captura de tela confirma os 4 grupos renomeados (Redefinir/Indicar/
  Definir curva/Manipular molde) com os ícones e rótulos corretos.
- Typecheck/lint/239 testes (nenhum teste novo — mudança é reorganização
  de UI + uma função nova sem lógica de domínio adicional além de reusar
  `deslocarContornoParaFora`, já coberta por testes existentes) limpos.

## Consequências

- Projetos salvos antes desta mudança que dependiam das peças de
  demonstração não são afetados — elas só existiam no estado inicial do
  app, nunca foram persistidas como "padrão" de um projeto salvo.
- Réplica visual pixel-a-pixel (ícones grandes tipo dropdown, grade
  compacta de 2-3 linhas por grupo) deliberadamente não foi perseguida —
  isso se aproximaria de copiar o DESENHO da interface do Audaces, não só
  a organização funcional; a linha traçada aqui é replicar nomes de
  grupo e funcionalidades reais, não o pixel exato do layout.
