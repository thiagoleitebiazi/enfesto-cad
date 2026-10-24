# ADR 0103 — Grupos de peças no encaixe

## Contexto

Fase 1 do estudo de funcionalidades (ADR 0099). Na referência, peças podem ser agrupadas para ficarem juntas no
encaixe. O caso típico são as peças que vão para a entretela: elas saem num trecho só do risco, que é cortado e
levado à prensa à parte. Aqui o encaixe só conhecia os pares (direita e esquerda).

## Decisão

- **A peça ganha o "grupo do encaixe"** (`Molde.grupoDoEncaixe`, um texto: "Entretela", "Forro"…). Sem grupo,
  nada muda. Ele se põe:
  - nas **Propriedades da peça** (campo "Grupo no encaixe", com os grupos já usados sugeridos);
  - na **janela do Nesting automático** (coluna "Grupo" da tabela das peças, que se muda ali mesmo).
  A lista de peças mostra o grupo num selo, e o grupo acompanha a peça aberta nos tamanhos e na simetria.
- **A regra (`domain/gruposDoEncaixe.ts`):** as peças do mesmo grupo saem juntas, num trecho só do comprimento.
  Os grupos vão um depois do outro, na ordem em que aparecem na lista de peças; as peças sem grupo vêm por último.
  Cada grupo começa depois de tudo o que já foi posto, à distância entre as peças: nenhuma peça de um grupo cai no
  trecho de outro. Dentro do grupo, o encaixe é o de sempre.
- **Nos dois métodos do Nesting automático e no Planejamento de corte.**
  - A busca em grade ordena as peças pelo grupo e sobe o "piso" do comprimento a cada grupo novo.
  - O motor dos pontos de canto (`fazerRisco`) faz o mesmo. Ele também é o motor dos riscos do planejamento, que
    passam a respeitar os grupos sem mais nada.
  - O resultado diz o **trecho de cada grupo**: na janela do Nesting ("Entretela: de 4,0 a 304,0 mm"), no resumo
    dos riscos do planejamento ("— grupos: Entretela de 0,00 m a 0,30 m; …") e na tabela das peças do planejamento
    (coluna Grupo). A compensação do encolhimento aumenta os trechos junto com o risco.
- **Na mesa:** com peças em grupos, o nome de cada trecho aparece no começo dele, acima da mesa, e uma linha
  tracejada marca a divisa entre um trecho e o seguinte. É onde o risco pode ser cortado.
- **Na validação:** peças de grupos diferentes (ou sem grupo) no mesmo trecho do comprimento dão um aviso, com os
  trechos de cada um. Acontece ao mover peças à mão, ou antes de fazer o encaixe: "Grupos do encaixe misturados no
  comprimento: …".

## O que não foi feito

- Os grupos não têm uma área marcada na mesa (por exemplo, "a entretela só nos primeiros 60 cm da largura"): eles
  vão em trechos do comprimento, um depois do outro.
- A ordem dos grupos é a da lista de peças; não há um campo próprio para ela.
- O PDF, o DXF e o PLT não levam a divisa dos trechos (as peças vão nos lugares certos; a divisa é só na tela).

## Conferência

- `domain/gruposDoEncaixe.test.ts` (11):
  - a regra: o grupo, a ordem, pôr e tirar, os blocos, os que se misturam, o grupo seguindo a peça nos tamanhos e
    na simetria;
  - sem grupos, o encaixe de sempre (as peças pequenas ao lado da grande);
  - com grupos, cada um num trecho, na ordem e à distância, na busca em grade, nos pontos de canto e no risco do
    planejamento;
  - o grupo que não cabe fica de fora sem invadir o outro;
  - a validação (aviso só quando misturados);
  - o planejamento: o modelo do plano com o grupo, o risco gerado com os trechos, a compensação do encolhimento.
- `ui/PainelDeNesting.test.tsx` (a coluna, a nota com a ordem, os trechos no resultado), `ui/PainelLateral.test.tsx`
  (o campo e o selo), `ui/ResumoDoPlanejamento.test.tsx` (os trechos no resumo).
- `npx vitest run`: 141 arquivos, 2719 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - uma peça posta no grupo "Entretela" pela coluna da janela do Nesting;
  - a nota com a ordem e o resultado com os dois trechos ("Entretela: de 4,0 a 304,0 mm", "Sem grupo: de 307,0 a
    807,0 mm");
  - aplicado: o selo na lista e a validação sem problemas — 28 conferências, nenhuma falha.
- Na foto da mesa: "Entretela" e "Sem grupo" no começo de cada trecho, a divisa tracejada entre eles. Na primeira
  foto, o nome caía em cima dos números dos vértices das peças encostadas na borda, e foi subido.
