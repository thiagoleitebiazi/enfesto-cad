# ADR 0021 — Aba "Marcações" separada, rótulo e medida da peça no canvas

## Contexto

Após o ADR 0020 (remoção do painel fixo de Propriedades), o usuário
comparou a interface resultante com a mesma referência (Audaces Moldes
Avançado) de novo e perguntou diretamente se interface e funcionalidades
estavam parecidas. Nessa comparação honesta, identifiquei lacunas ainda
abertas e o usuário pediu "faça bater" para fechá-las. As lacunas
endereçadas neste ADR (das que eu havia levantado) são as que tinham dado
concretos já existentes no app, sem precisar inventar nada:

1. A aba "Desenho" misturava construção de contorno (Selecionar/Novo
   Molde/Curva/Furo) com marcações de acabamento (Pique/Marca) num único
   grupo — a referência trata isso como categorias separadas.
2. Nenhuma peça tinha identificação visual no canvas (nome) nem uma
   medida visível — a referência mostra o nome da peça e uma cota de
   largura com seta dupla abaixo de cada molde.

## Decisão

### Aba "Construção" (ex-"Desenho") + nova aba "Marcações"

`BarraDeFerramentas.tsx`: a aba `desenho` foi renomeada para o rótulo
"Construção" (mesmo `id` interno, só o texto exibido muda) e ficou só com
Selecionar/Novo Molde/Curva/Furo. Pique e Marca foram fisicamente
realocados (mesmos `onClick`/`aria-pressed`/`title`/ícones — nenhum
comportamento novo) para um novo bloco `{abaAtiva === 'marcacoes' && (...)}`,
com rótulo de aba "Marcações". É puramente reorganização de onde os
botões já existentes aparecem.

### Rótulo do nome + seta de medida no canvas

`AreaDeDesenho.tsx`, dentro do loop de desenho de cada peça (mesmo lugar
que já desenha a numeração dos vértices, ADR 0020): acrescentado um
rótulo com `peca.nome` centralizado acima do retângulo envolvente da
peça, e uma cota horizontal (seta dupla, reaproveitando a função
`desenharSeta` já existente — chamada duas vezes, uma vez em cada
sentido, para desenhar ponta de seta nas duas extremidades) abaixo da
peça, com o valor em mm do intervalo horizontal do retângulo envolvente
(`retanguloEnvolvente`, a mesma função que `dimensoesDoMolde` já usa em
`PainelDePropriedades`). Nenhum dado novo: nome e geometria já existiam,
só passaram a ser desenhados no canvas além de já aparecerem na lista de
peças / diálogo de Propriedades.

## O que não foi mexido

- Barra de abas de documentos (múltiplos projetos abertos simultâneos) —
  este app trabalha com um projeto por vez; não existe o conceito de
  "documento" para ter abas. Fora de escopo deste ADR (mudaria a
  arquitetura de estado do app, não é um ajuste de UI).
- Grupo "Cerca" dedicado na ribbon — a funcionalidade de cerca de seleção
  já existe (ADR 0016, unificada em "Mover ponto"); criar um grupo
  dedicado só para bater o rótulo visual sem mudar comportamento foi
  considerado reorganização cosmética de baixo valor frente ao restante
  do pedido.
- Nome do app na barra de título — é a barra de título nativa do
  Electron/SO, já observado como fora de alcance do HTML/React no ADR
  0020.

## Verificação (Electron real, build de produção)

Script temporário rodou o app real (`dist-electron/main.js` carregado via
`require` dentro de um processo Electron próprio, janela 1440×900):

- DOM: aba "Construção" expõe exatamente `["Selecionar", "Novo Molde",
  "Curva", "Furo"]`; aba "Marcações" expõe exatamente `["Pique", "Marca"]`.
- Desenhado um molde retangular completo (4 cliques + Enter + 2 cliques
  de linha de fio) — screenshot confirma: nome "Molde 1" acima da peça,
  numeração 1–4 nos vértices, seta de fio vermelha, cota horizontal com
  seta dupla e "462 mm" abaixo da peça, consistente com a peça desenhada
  em tela.
- 252/252 testes (sem testes novos — mudança de apresentação pura, sem
  lógica de domínio nova), typecheck/lint/build limpos.

## Consequências

- Nenhuma prop nova em `AreaDeDesenho`/`BarraDeFerramentas` além do que já
  existia; é realocação de JSX e desenho adicional no canvas.
- `core/geometria.retanguloEnvolvente` passa a ser importado também em
  `AreaDeDesenho.tsx` (já usado em vários outros lugares do app).
