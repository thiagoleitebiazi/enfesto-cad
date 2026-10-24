# ADR 0105 — A ficha técnica do modelo

## Contexto

Fase 2 do estudo de funcionalidades (ADR 0099). A referência tem a ficha técnica ligada ao desenho e aos
materiais. É o que a produção precisa para fazer a peça igual: a descrição, os tamanhos, a tabela de medidas com as
tolerâncias, os materiais e aviamentos com o consumo, a sequência operacional, as instruções, a versão, a aprovação
e o PDF. Aqui não havia nada disso; o projeto tinha só o nome, o autor e as peças.

## Decisão

- **Modelo › Ficha técnica** abre a ficha do projeto. A primeira vez, ela nasce com:
  - a referência das peças (ou o código do projeto), o nome do projeto, o autor como modelista;
  - os tamanhos do molde (os da graduação e os das peças).
  A ficha mora no projeto (`Projeto.fichaTecnica`) e é guardada sozinha meio segundo depois de cada mudança (e ao
  fechar); o cabeçalho diz a hora.
- **As abas** (`domain/fichaTecnica.ts`, `ui/PainelDaFichaTecnica.tsx`):
  - **Descrição:** referência, nome, coleção, marca, estilista, modelista, a descrição do produto e os tamanhos
    (com "Usar os tamanhos do molde").
  - **Medidas:**
    - os pontos de medida, com "como medir", a medida de cada tamanho e a tolerância (±), em cm, com vírgula;
    - subir, descer e remover;
    - **colar de uma planilha**: a primeira linha diz os tamanhos (e "Tol."), uma linha por ponto, separada por
      tabulação ou ponto e vírgula. O que não é número é dito, linha por linha, e os tamanhos novos entram.
  - **Materiais:**
    - cada item vem da biblioteca de materiais (ADR 0104: a descrição, a unidade e o preço vêm dela) ou é digitado
      só na ficha, com o preço; a aplicação ("Corpo", "Gola") e o consumo por peça pronta;
    - o consumo pode ser **informado** ou **pelo encaixe da mesa**: o comprimento do encaixe ÷ as roupas que ele
      tem, mais a perda;
    - as roupas são contadas pelas peças na mesa (o menor número de cópias de cada peça, somado nos tamanhos), ou
      informadas;
    - em metros, ou em m², quilos e gramas pela largura e a gramatura do tecido;
    - o que impede o cálculo é dito ("falta a gramatura do tecido");
    - cada linha tem o valor (consumo × preço), e o total sai embaixo.
  - **Operações:** a sequência operacional: a operação, a máquina (sugerida das já usadas), o tempo-padrão (min) e
    a observação; o tempo total e a mão de obra.
  - **Instruções:** costura, acabamento, conservação e embalagem.
  - **Pré-custo:** o ADR 0106.
  - **Aprovação:**
    - rascunho → **enviar para aprovação** → **aprovar** (guarda o custo da peça na hora, quando o pré-custo saiu
      inteiro) ou **pedir alteração** (o comentário é obrigatório; a ficha volta a mudar);
    - a ficha aprovada (ou em aprovação) **não muda**: a tela diz, os campos ficam travados, e "Abrir nova versão"
      faz a versão seguinte, em rascunho;
    - tudo fica no histórico (a data, a versão, o que foi feito, quem e o comentário). O programa não tem login: o
      responsável é digitado.
- **Exportar PDF** (`formats/ficha-exportacao.ts`):
  - o cabeçalho e os campos;
  - a descrição e o desenho das peças como estão na mesa;
  - a tabela de medidas com as tolerâncias, os materiais com o consumo e o valor, a sequência operacional;
  - o histórico da aprovação, as instruções e o pré-custo (com o que falta, se parcial).
  Fica no histórico do projeto.

## O que não foi feito

- O desenho técnico (o croqui de frente e costas) é a fase 3; a ficha mostra o desenho das peças da mesa.
- As medidas não são tiradas do molde sozinhas: são digitadas ou coladas.
- A aprovação não tem login nem assinatura: quem aprova é o nome digitado.

## Conferência

- `domain/fichaTecnica.test.ts` (15):
  - a ficha nova;
  - os tamanhos e a medida com a tolerância;
  - a tabela colada (e os erros);
  - o encaixe da mesa, o consumo em metros (com a perda), em quilos e m², o que impede;
  - o informado e o escrito, as recusas do item, o tempo total;
  - a aprovação inteira (enviar, aprovar com o custo, pedir alteração, nova versão, as recusas);
  - a leitura.
- `ui/PainelDaFichaTecnica.test.tsx` (9):
  - guardar sozinho;
  - medidas com vírgula e colar;
  - materiais da biblioteca, pelo encaixe e digitado;
  - operações;
  - pré-custo e simulador;
  - aprovação com a ficha travada e a nova versão;
  - pedir alteração sem comentário;
  - o PDF.
- `formats/ficha-exportacao.test.ts` (3): o conteúdo do PDF com vírgula e o arquivo (o texto decodificado).
- `npx vitest run`: 147 arquivos, 2774 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - a ficha aberta pela aba Modelo, a coleção, o botão da biblioteca como material (6 por peça) e uma operação;
  - o pré-custo parcial dizendo que falta o custo do minuto;
  - enviada e aprovada ("Aprovada · versão 1");
  - o PDF gravado;
  - a ficha guardada no arquivo do projeto, aprovada, com o histórico;
  - 35 conferências, nenhuma falha.
- O PDF aberto no visualizador do Chromium (foto): cabeçalho, moldes, tabelas e o pré-custo diagramados sem
  sobreposição.
- As fotos mostraram "Mão de obra R$ 0,00" sem o custo do minuto: passou a "—" (não calculado), como o resto do que
  falta. E "1 operações" passou a "1 operação".
