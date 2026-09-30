# ADR 0014 — Ícones na barra em abas e miniaturas de peça

## Contexto

Depois do ADR 0013, o usuário perguntou diretamente "a aparência está
muito parecida com a da imagem que eu enviei?". Resposta honesta: não —
a estrutura (abas + grupos) era parecida, mas faltavam ícones nos botões
e miniaturas das peças na lista, duas coisas visíveis de cara na imagem
do Audaces. Pedido seguinte: "deixe profissional como está na imagem".

## Decisões

### Ícones desenhados para este projeto, não copiados de nenhuma biblioteca/marca

Novo `src/ui/Icone.tsx`: ~39 ícones de linha simples (SVG, `viewBox`
20×20, traço `currentColor`), um para cada botão de toda a barra de
ferramentas (todas as 5 abas + o grupo Visualização), desenhados à mão
para este projeto — não são o ícone específico do Audaces nem de nenhuma
biblioteca de terceiros, só o mesmo tipo de pictograma simples e genérico
(disquete para salvar, tesoura para recortar, lixeira para excluir, etc.)
que qualquer programa de desenho usa. Continua respeitando "sem copiar a
marca": nenhuma cor, logo ou ícone específico do Audaces foi reproduzido.

Todos os botões da barra passaram de texto puro para ícone em cima +
rótulo embaixo (padrão ribbon do Office/Audaces/qualquer CAD), via CSS
(`display:flex; flex-direction:column`) — mudança de estilo, não de
comportamento: os mesmos `onClick`/`disabled`/`title`/`aria-pressed` de
antes continuam exatamente iguais.

### Miniaturas de peça na lista lateral

`PainelDePecas` ganhou `MiniaturaDoMolde` — um SVG pequeno que desenha só
o contorno externo da peça (sem furos/piques, para não poluir um ícone de
34×34px), com `viewBox` ajustado ao retângulo envolvente da peça mais uma
margem de 12%. Mesma ideia das miniaturas de TRASEIRO/DIANTEIRO/CÓS na
imagem do Audaces — reconhecer a peça pela forma na lista, não só pelo
nome.

## Verificação

Build de produção + captura de tela real em Electron de todas as 5 abas
(Arquivo, Edição, Desenho, Manipulação, Encaixe) confirmando que cada
ícone renderiza sem erro visual (nenhum ícone em branco/quebrado,
nenhuma sobreposição de texto), os estados desabilitado/selecionado
continuam corretos visualmente (ícone + texto ficam acinzentados juntos
quando `disabled`, brancos juntos quando `item-selecionado`/
`aria-pressed`), e a miniatura de peça aparece corretamente na lista
lateral com o contorno real de cada peça. Typecheck/lint/239 testes
(nenhum teste novo — mudança é puramente visual, sem lógica de domínio
nova) permanecem limpos.

## Consequências

- Nenhuma mudança de comportamento/lógica — só apresentação. Nenhum teste
  de domínio precisou mudar.
- `Icone.tsx` é um mapa fechado (`Record<NomeDoIcone, ...>`) — adicionar
  um botão novo no futuro exige adicionar o nome ao union type E ao mapa,
  o TypeScript avisa se um dos dois faltar.
