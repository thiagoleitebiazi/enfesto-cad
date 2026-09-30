# ADR 0018 — Réguas em cm, barra de acesso rápido, grade densa na aba Manipulação

## Contexto

Depois da rodada do ADR 0017, o usuário disse só "não está igual ao da
imagem que eu havia enviado" — feedback genérico demais para agir sem
adivinhar de novo. Usei `AskUserQuestion` para descobrir especificamente
o quê, com múltipla escolha; o usuário marcou **todas** as opções:
aparência visual/cores/ícones, unidade das réguas, barra de acesso
rápido, e as ferramentas ainda pendentes (essas últimas continuam
precisando de explicação do usuário sobre o comportamento esperado —
não implementadas nesta rodada).

## Decisões

### Réguas em centímetros, não milímetros

As réguas horizontal/vertical mostravam o valor bruto em mm
(`Math.round(mm)`). A imagem do Audaces mostra números em cm (`0, 10,
20...140`) com um rótulo "cm" no canto superior esquerdo das réguas.
Trocado para `Math.round(mm / 10)` nas duas réguas, e adicionado o texto
"cm" no `.regua-canto` (célula do canto, antes vazia). O algoritmo de
escolha do passo da régua (`passoDeReguaEmMm`) não precisou mudar —
como ele já escolhe passos em 1/2/5 × potência de 10 em mm, dividir por
10 continua dando números redondos em cm.

### Barra de acesso rápido acima das abas

Nova fileira fina de ícones (sem rótulo, só tooltip) entre o topo da
janela e as abas Arquivo/Edição/Desenho/Manipulação/Encaixe — Novo,
Abrir, Salvar, Exportar PDF, Desfazer, Refazer, Recortar, Copiar, Colar,
Excluir. Mesma ideia da barra de acesso rápido do Audaces (que fica
acima das abas ARQUIVO/INÍCIO/CONSTRUÇÃO...). Todos os botões reusam os
mesmos handlers que já existem nas abas correspondentes — é só mais um
lugar de acesso às mesmas ações reais, não lógica nova.

### Grade densa na aba Manipulação

A aba Manipulação tinha todos os botões em uma única fileira (ícone
grande em cima, rótulo embaixo, todos do mesmo tamanho). A imagem do
Audaces usa uma grade mais densa: alguns botões "grandes" (ação
principal de uma coluna, ocupam a altura toda do grupo) ao lado de pares
de botões "pequenos" (ícone+rótulo lado a lado, empilhados dois por
coluna). Implementado com duas classes CSS novas (`.botao-grande`,
`.botao-pequeno`) aplicadas só na aba Manipulação por enquanto (onde a
comparação direta com a imagem está sendo feita) — grupo "Indicar" agora
tem Elemento paralelo/Dimensionar/Espelhar como botões grandes e
Girar+Copiar empilhados pequenos numa coluna; grupo "Manipular molde"
tem Converter em costura grande e Alinhar+Arredondar/chanfrar
empilhados. Escopo deliberadamente restrito a esta aba por ora — aplicar
a mesma densidade nas outras 4 abas é possível depois, mas não foi
pedido nem comparado diretamente contra a imagem.

### O que continua não sendo replicado, e por quê

A cor de destaque vermelha do Audaces (tema da marca) e o logo
"Audaces" no topo não foram copiados — a linha que sigo é replicar
PADRÕES de interface (ribbon com abas, barra de acesso rápido, réguas em
cm, densidade de grade) que são convenções comuns de CAD profissional,
não elementos de identidade visual específicos de uma marca. Cores e
ícones usam a paleta cinza/azul já estabelecida neste projeto desde o
início.

## Verificação (Electron real, build de produção)

Screenshot confirma: barra de acesso rápido com 10 ícones + 2
separadores no topo; régua horizontal mostrando "-40" (era "-400" em
mm) com "cm" no canto; aba Manipulação com a grade densa renderizando
corretamente (botões grandes e pequenos lado a lado, sem sobreposição,
estados desabilitado/selecionado continuam corretos visualmente).
241/241 testes (nenhum novo — mudança visual/organizacional, sem lógica
de domínio nova), typecheck/lint limpos.

## Consequências

- Como as réguas agora mostram cm, qualquer medida lida visualmente
  nelas precisa ser multiplicada por 10 para virar mm — o resto do app
  (campos de propriedades, diálogos, relatórios) continua em mm, sem
  mudança, porque só a APRESENTAÇÃO da régua mudou, não a unidade
  interna do domínio.
- A leitura de cursor "X/Y" na barra de status continua em mm
  (precisão), não convertida — o pedido era especificamente sobre as
  réguas, não sobre todos os números da tela.
