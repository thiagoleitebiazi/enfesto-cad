# ADR 0108 — A gestão de coleção (PLM local)

## Contexto

Fase 4 do estudo de funcionalidades (ADR 0099). O PLM da referência organiza:
- as coleções (estação, ano, datas), com vários modelos dentro;
- o mix num quadro (cores, formas, tecidos, categorias);
- o fluxo por etapas (criação → modelagem → piloto → aprovação → produção), com responsáveis e prazos;
- as tarefas e pendências por pessoa, com avisos de prazo;
- a aprovação da peça-piloto, com comentários e revisões;
- os painéis de andamento e a linha do tempo do lançamento;
- a ligação com o desenho, o molde e o encaixe.

Ele roda na nuvem, com várias pessoas ao mesmo tempo. Aqui havia só a Biblioteca de projetos, e o projeto só sabia
"em edição/arquivado".

## Decisão

- **Modelo › Coleção › Coleções** abre o PLM local (`domain/colecoes.ts`, `ui/PainelDeColecoes.tsx`).
- **No disco:** `<userData>/colecoes.json`, como o cadastro, a fila e a biblioteca de materiais: a versão anterior
  ao lado; o ilegível vai para as cópias de segurança; o de versão mais nova aparece e não é gravado. É lido ao abrir
  o programa (o aviso de prazos precisa dele) e gravado a cada mudança.
- **A coleção:**
  - nome, estação (primavera-verão, alto verão, outono-inverno, resort, permanente) e ano;
  - a data do lançamento, o responsável, a descrição e os **marcos** (as datas dela).
  - O nome não se repete no mesmo ano. A coleção pode ser arquivada (sai da lista, a não ser com "Mostrar as
    arquivadas") ou apagada.
- **O modelo:**
  - nome, referência (não se repete na coleção), categoria (sugerida das já usadas), cores ("#rrggbb" mostra a
    cor), tecido, responsável e o prazo da etapa;
  - o **projeto ligado** (um da Biblioteca, ou "Ligar o projeto aberto", com "Abrir o projeto"). O projeto traz o
    molde, o encaixe, a ficha técnica e o croqui: o modelo mostra o croqui da ficha, a situação e a versão dela, e
    as peças do molde.
- **O mix:** os modelos em cartões, cada um com o croqui do projeto, a referência, a categoria, as cores, o tecido,
  a etapa (com a cor dela na borda) e o prazo (em vermelho, atrasado). O resumo conta por categoria, cor e tecido; há
  filtro por categoria e etapa, e o CSV do mix.
- **O fluxo por etapas:** criação → modelagem → peça-piloto → aprovação → produção.
  - Avançar (com o prazo da etapa seguinte) e voltar (o motivo é obrigatório) ficam no histórico, com quem e quando.
  - **Na aprovação, a peça-piloto é aprovada** (vai para a produção) **ou volta com alteração pedida**: o comentário
    é obrigatório, e ela volta à piloto na revisão seguinte. O histórico guarda a revisão de cada decisão.
  - O modelo pode ser cancelado (com o motivo) e reaberto na etapa em que estava.
  - A aba **Etapas** é o quadro: uma coluna por etapa, com "Avançar →" no cartão.
- **Tarefas e prazos:**
  - cada modelo tem as tarefas (descrição, responsável, prazo; feita ou não) e os comentários;
  - a aba **Tarefas e prazos** junta os prazos abertos (os das etapas e os das tarefas), da coleção ou de todas, por
    pessoa, com a situação ("atrasado 4 dia(s)", "hoje", "em 6 dia(s)"), o "feita" e o CSV.
- **O aviso de prazos** na barra de status: "Prazos: 2 atrasado(s) · 1 na semana" (vermelho com atraso, azul só com
  os da semana). Abre os prazos; o dia de hoje é conferido de hora em hora.
- **Andamento:**
  - os modelos, os prontos (% na produção), os atrasados, quantos dias até o lançamento, as tarefas abertas e
    feitas;
  - as barras de modelos por etapa;
  - a **linha do tempo**: os prazos das etapas (em vermelho, os atrasados), os marcos e o lançamento, com a linha de
    hoje.

## O que não foi feito

- A colaboração ao mesmo tempo entre pessoas e os avisos por e-mail ou celular precisam de servidor: o PLM é local
  (uma pessoa, ou um computador). Para várias pessoas, o arquivo pode ser levado de um computador ao outro, mas não há
  junção de mudanças feitas nos dois.
- Não há login: o responsável e quem decide são nomes digitados.
- Os cartões não se arrastam entre as colunas: o "Avançar →" e o detalhe do modelo fazem as mudanças (com o
  histórico).

## Conferência

- `domain/colecoes.test.ts` (11):
  - as coleções (o nome no ano, a ordem, as recusas);
  - o modelo (a referência);
  - avançar e voltar com o histórico;
  - a aprovação da piloto com as revisões;
  - cancelar e reabrir;
  - tarefas e comentários;
  - os prazos (o atraso, a semana, por pessoa, o arquivado);
  - o andamento, o mix e a linha do tempo;
  - as datas, os CSV e o arquivo (ida e volta, os quebrados de fora, a versão mais nova).
- `ui/PainelDeColecoes.test.tsx` (9):
  - a coleção nova com um marco;
  - o mix (os cartões, o atraso, o resumo, o filtro, o CSV);
  - o modelo novo com as cores;
  - a peça-piloto (alteração na revisão 2, aprovação, o histórico);
  - o quadro das etapas;
  - as tarefas nos prazos;
  - o andamento e a linha do tempo;
  - o projeto ligado com o croqui;
  - arquivar.
- `ui/useColecoes.test.ts` (3): ler, gravar, a falha, o quebrado, o recuperado e a versão mais nova.
- `ui/BarraDeStatus.test.tsx`: o aviso de prazos.
- `npx vitest run`: 153 arquivos, 2823 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - uma coleção nova;
  - um modelo ligado ao projeto aberto, mostrando o croqui da ficha no detalhe e no cartão do mix;
  - uma tarefa atrasada;
  - a barra de status com "Prazos: 1 atrasado(s)", que abre os prazos com a tarefa;
  - tudo gravado em `colecoes.json`;
  - 47 conferências, nenhuma falha.
