# ADR 0094 — Os números da tela com vírgula decimal, e a nota das margens no Novo projeto

## Contexto

Pedido do usuário: padronizar os números exibidos com vírgula decimal, em português, incluindo a barra de status e o
relatório; atualizar os testes sem manter o ponto só para eles passarem; corrigir o texto do Novo projeto (não há
margens adicionais, mas existe a margem de segurança de 4 mm); manter as cores das peças e da mesa e a lógica de desenho
da área de desenho; preservar cálculos, dados e os outros comportamentos.

Os dois pontos estavam em "Achados, não mexidos" do ADR 0093. Uma varredura do código (os `toFixed`, e os números
escritos direto num texto com unidade) achou o ponto decimal em:

- a **barra de status**: X, Y, DX, DY, Dist e Âng da régua, e o aproveitamento da mesa ("X: 12.34 cm", "19.5%");
- o **relatório**, na janela e no PDF ("954.0 mm", "19.5% / 80.5%", "0.200 kg", "1.235 m²");
- o **resultado do encaixe automático** e a linha dele no **histórico** ("36.9% de aproveitamento");
- a **barra do documento** (a largura útil do tecido, quando tem casa decimal);
- as **propriedades da peça** (ângulo, largura, altura, área) e o **Dimensionar** (medidas atuais e novas);
- **mensagens**: as da validação (a distância entre peças e o mínimo exigido, o ângulo da peça girada, a medida da peça
  de escala suspeita, a distância das linhas internas fora da peça), a do formato do pique ("entre 0.5 e 200 mm"), a da
  margem da folha do PDF, a da peça girada na importação ("(12.5°)");
- a **legenda das folhas** do PDF do encaixe (largura útil e comprimento da mesa).

O resto do programa já usava vírgula (`formatarMm`, as cotas e medições, o planejamento, as ferramentas).

## Decisão

- **`numeroComVirgula(valor, casas?)`** (`src/core/numeros.ts`), usada pelo domínio e pela tela: as mesmas casas e o
  mesmo arredondamento de antes (o `toFixed` de antes), só a vírgula no lugar do ponto. Sem separador de milhar, como o
  resto do programa ("1234,6 mm"). Sem `casas`, o número como ele é ("1500", "180,5").
- Todos os lugares da lista acima passaram a usá-la.
- **Novo projeto**, a nota: "As medidas da mesa definem o enfesto inicial (tipo Ímpar). Não há margens adicionais, mas
  a margem de segurança de 4 mm vale sempre: nenhuma peça chega mais perto que isso das bordas da mesa. Ajuste depois
  pelo botão "Enfesto" se precisar de outro tipo ou de margens maiores." O 4 vem da constante
  `MARGEM_DE_SEGURANCA_DA_MESA_MM` (ADR 0091), a mesma que a mesa usa. Só o texto mudou: o projeto novo já era criado
  com as margens de 4 mm.

## O que não mudou

- **A área de desenho:** nenhuma linha de `AreaDeDesenho.tsx` (as cotas na tela já usavam vírgula ou números inteiros).
  As cores das peças, da mesa e da seleção e a lógica de desenho ficaram iguais.
- **Os cálculos e os dados:** só o texto mostrado muda. A gravação dos projetos, o `localStorage` e os arquivos
  gerados guardam os números como antes.
- **O Excel do relatório:** as células continuam números de verdade (o próprio Excel os mostra com a vírgula da
  configuração de quem abre; em texto, as contas na planilha parariam de funcionar).
- **Os campos numéricos** (`type="number"`: mesa, tecido, enfesto, margem de costura, fatores do Dimensionar): o valor
  de um campo desses precisa do ponto; quem mostra e aceita a vírgula é o próprio campo, pelo idioma do sistema. Os
  campos de texto que já aceitavam vírgula continuam aceitando.
- **As coordenadas** do SVG e do conteúdo vetorial do PDF (não são texto para ler).
- **Os valores em reais** ("R$ 1.234,50", ADR 0092): o ponto ali é o separador de milhar do real, não o decimal.

## Testes

- Atualizados para a vírgula (o ponto não ficou só para eles passarem): a barra de status ("X: 12,34 cm", "Âng: 0,0°",
  "X: 123,4 mm"), a validação ("a 2,0 mm uma da outra", "até 3,5 mm da borda", "até 5,0 mm para fora da borda") e o
  pique ("entre 0,5 e 200 mm").
- Novos: `numeroComVirgula`; o aproveitamento na barra de status; o relatório na janela e os campos do PDF (com
  valores fracionados e sem nenhum ponto decimal no texto); o resultado do encaixe; as propriedades da peça; o
  Dimensionar; a legenda e a mensagem de margem do PDF do encaixe; as mensagens da validação com valores fracionados
  (2,5 mm, 1,5 mm, 12,5°, 4,5 mm); a nota do Novo projeto.

## Conferência

- `npx vitest run`: 131 arquivos, 2612 testes, todos passando (antes: 127 e 2598); `npx eslint .` sem erro nem aviso;
  `npx tsc -b --noEmit` sem erro; `npm run build` gera o programa (o aviso de tamanho de pedaço do Vite é antigo).
- O teste de uso do repositório (`scripts/teste-de-uso/main.cjs`), no Windows: 14 conferências, nenhuma falha, sem
  erro na página. Ele lê a posição da barra de status e já aceitava a vírgula.
- O programa gerado, numa pasta de dados descartável, com um projeto novo de mesa e tecido de 1500,5 mm, o molde de
  teste importado e encaixado: a nota nova no Novo projeto; "Tecido: Malha teste (1500,5 mm úteis)";
  "Comprimento utilizado 504,0 mm", "Aproveitamento 36,9%"; "X: 57,80 cm Y: 32,25 cm … Aproveitamento da mesa: 36,9%";
  propriedades "300,0 mm", "400,0 mm", "1187,5 cm²"; Dimensionar "450,0 mm"; relatório "1500,5 mm / 1500,5 mm",
  "36,9% / 63,1%"; histórico "36,9% de aproveitamento". Nenhum desses textos com ponto decimal, nenhum erro na página.
