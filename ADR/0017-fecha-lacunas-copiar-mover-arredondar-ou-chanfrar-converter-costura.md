# ADR 0017 — Fecha lacunas: Copiar, Mover, "Arredondar ou chanfrar" unificado, Converter em costura

## Contexto

O usuário mandou uma versão mais nítida do mesmo screenshot do Audaces
Moldes Avançado e perguntou diretamente: "está igual a esta imagem? com
as ordens, layout e funcionalidades?". Com os ícones e agrupamentos
legíveis desta vez, ficou claro que ainda faltavam itens reais que as
rodadas anteriores (ADR 0013/0015/0016) não tinham capturado por a
imagem anterior estar em resolução mais baixa.

## Decisões

Comparação item a item contra a imagem revelou 4 lacunas fechávais sem
precisar de mais pesquisa (diferente das duas que continuam em aberto):

1. **"Mover"** (grupo Redefinir) — faltava como botão explícito. Não é
   uma ferramenta nova: é o modo "Selecionar" que já existia na aba
   Desenho (arrastar a peça inteira). Adicionado como atalho aqui,
   reaproveitando o mesmo `onEntrarModoSelecionar`.
2. **"Copiar"** (grupo Indicar) — mapeado para "Duplicar" (mesma ação já
   existente na aba Edição, Ctrl+D), exposta aqui também por ser onde o
   Audaces a mostra neste contexto.
3. **"Arredondar ou chanfrar"** — o Audaces trata como UM botão só, não
   dois. As duas ferramentas já existiam separadas desde o ADR 0013
   (Chanfrar canto/Arredondar canto); unificadas num único modo que
   pergunta primeiro qual operação ("A" arredondar / "C" chanfrar) e
   depois o valor em mm — mesmo par de funções de domínio já testadas
   (`arredondarCantoDoMolde`/`chanfrarCantoDoMolde`), só a entrada da UI
   mudou.
4. **"Converter em costura"** — confirmado no ADR 0016 que é o mesmo
   conceito do campo "Margem de costura (mm)" das Propriedades (ADR
   0005). Adicionado como atalho real nesta aba: pergunta o valor e
   aplica direto na peça selecionada, sem duplicar lógica nova.

Continuam de fora, pela mesma razão do ADR 0016 (comportamento exato
incerto mesmo após pesquisa): **"Manipular pontos"** (parece ser um
container/menu maior em vez de uma ação própria — redundante com "Mover
ponto", que já cobre a manipulação de pontos de verdade), **"Definir
cerca"/"Mover cerca"** como botões separados (o mecanismo já existe,
unificado dentro de "Mover ponto" desde o ADR 0016 — repetir como
botões separados seria só decoração, a ação de fundo é idêntica),
**"Transformar em elementos"** e **"Copiar ou trocar elemento"**.

## Verificação (Electron real, build de produção)

- "Arredondar ou chanfrar" com escolha "A" (arredondar) e raio 15mm:
  Área caiu de 1597.6 para 1597.1 cm² (pequena redução esperada ao
  arredondar um canto), Largura/Altura do envelope inalteradas (correto
  — arredondar nunca ultrapassa o canto original).
- "Converter em costura" com 8mm: dimensões do contorno base
  permaneceram idênticas (correto — a margem de costura não altera o
  contorno base, só adiciona a linha de corte derivada).
- "Copiar": lista de peças foi de 1 para 2 itens.
- Captura de tela confirma os 5 grupos (Redefinir, Indicar, Definir
  curva, Manipular molde, Visualização) com os nomes e itens batendo
  com a imagem de referência, salvo os itens deliberadamente deixados de
  fora (documentados acima).

241/241 testes (sem testes novos — mudança é reorganização de UI +
combinação de duas funções de domínio já testadas), typecheck/lint
limpos.

## Consequências

- `ModoDeDesenho` perdeu `'chanfrar-canto'`/`'arredondar-canto'` em favor
  de um único `'arredondar-ou-chanfrar'` — simplificação, não regressão
  (as duas funções de domínio continuam existindo e testadas
  individualmente).
- Nenhuma peça salva antes desta mudança é afetada — é só reorganização
  de botões na barra de ferramentas.
