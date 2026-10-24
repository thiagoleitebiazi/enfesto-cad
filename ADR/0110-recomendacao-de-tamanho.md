# ADR 0110 — A recomendação de tamanho e o guia de medidas

## Contexto

Fase 6 do estudo de funcionalidades (ADR 0099). A referência recomenda o tamanho pelas medidas do corpo da pessoa e
pela tabela de medidas do modelo, com a explicação. Faz isso na loja virtual dela, que é um serviço. A parte local
é a conta: a tabela de medidas já está na ficha técnica (ADR 0105), a peça pronta por tamanho, com a tolerância.

## Decisão

- **Modelo › Loja** tem dois botões, que abrem a mesma janela (`ui/PainelDeRecomendacaoDeTamanho.tsx`) na aba
  pedida:
  - **Recomendar tamanho**;
  - **Guia de medidas**.
- A conta fica em `domain/recomendacaoDeTamanho.ts`.
- **Sem a tabela de medidas** (sem ficha, ou a ficha sem tamanhos ou sem pontos), a janela diz o que falta.
  "Abrir a tabela de medidas" leva à ficha técnica, na aba Medidas.

### A regra de caimento de cada ponto (aba Caimento)

- **Usar** ou não o ponto na escolha.
- **Tipo:**
  - **volta**: a peça precisa caber com folga (o busto, a cintura, o quadril);
  - **comprimento**: a medida da peça deve bater com a da pessoa.
- **Folga** (cm): quanto a peça pronta tem a mais que o corpo.
- **Peso** (1 normal, 2 manda, 3 decide).
- A primeira regra vem do nome do ponto:

  | Ponto | Tipo | Folga | Peso |
  |---|---|---|---|
  | Busto, tórax, peito | volta | 8 | 2 |
  | Quadril, bacia | volta | 6 | 2 |
  | Cintura | volta | 4 | 1 |
  | Braço, bíceps, coxa, punho | volta | 4 | 1 |
  | Pescoço, colarinho | volta | 2 | 1 |
  | Comprimentos, manga, entreperna, gancho, ombro, costas | comprimento | 0 | 1 |

  O ponto de nome desconhecido começa fora. "Voltar às folgas sugeridas pelo nome" refaz tudo.
- As regras ficam **no projeto** (`Projeto.regrasDeCaimento`, pelo id do ponto), guardadas meio segundo depois da
  última mudança e ao fechar, e lidas conferidas (`lerRegrasDeCaimento`).

### A recomendação (aba Recomendar)

- **As medidas do corpo** são digitadas, uma por ponto usado, com vírgula decimal. Elas **não são gravadas** (são
  dados pessoais): ficam só na janela, e "Limpar as medidas" as tira.
- **O ideal** de cada ponto é o corpo mais a folga.
- **A nota** de cada tamanho é a soma, ponto a ponto, de peso × |peça − ideal|. O que fica **mais justo** que o
  ideal pesa o triplo: na dúvida, é melhor sobrar que faltar.
- **Aperta:** um tamanho aperta quando, numa volta, a peça, mesmo no máximo da tolerância, é menor que o corpo.
- **O recomendado** é o de menor nota entre os que vestem. Se nenhum veste, o recomendado é o mais próximo, em
  vermelho, com o quanto falta em cada ponto.
- **Entre dois tamanhos:** é o tamanho vizinho do recomendado (o de antes ou o de depois na ordem da ficha) que
  também veste. Para isso, o afastamento médio dele do ideal (pelo peso, sem o triplo) tem de ficar até o dobro do
  afastamento do recomendado, mais 0,5 cm. A janela diz se ele é o mais justo ou o mais folgado.
  - Na tabela de exemplo (busto P 96, M 100, G 104, GG 110; folga 8):
    - quem está a meio passo do M (busto 94) recebe "G, o M também serve";
    - quem está a meio centímetro do M recebe só o M.
- **Na tela:**
  - a faixa dos tamanhos: o recomendado em verde, maior; o vizinho que também serve em azul; o que aperta em
    vermelho, riscado;
  - o cartão com a letra grande;
  - a tabela de comparação: cada ponto, o corpo, o ideal, e a peça de cada tamanho com a diferença, em cores (na
    medida, mais folgado, mais justo, aperta), com a coluna do recomendado em destaque;
  - a explicação ponto por ponto;
  - o que falta: o ponto usado sem a medida do corpo; a recomendação sai com os outros e diz qual faltou.

### O guia de medidas (aba Guia de medidas)

- É a faixa do **corpo** de cada tamanho, pelos pontos usados.
- **O ideal** de cada tamanho é a peça menos a folga. **Os limites** ficam no meio do caminho para os vizinhos. Nas
  pontas, o meio passo do vizinho.
- **Salvar:**
  - **CSV**, para planilha, com `;` e a marca de UTF-8;
  - **página HTML**, simples e sozinha, em pt-BR, para a página do produto na loja virtual.

## O que não foi feito

- **A loja virtual** (o provador na página do produto, o cliente digitando as medidas no site) é um serviço: aqui
  sai a página do guia, que a loja publica.
- **O provador virtual**, a busca visual e as combinações de looks continuam dependendo da loja e de serviços.
- A recomendação usa só a tabela de medidas: não sabe do tecido (a malha que estica, o plano que não), a não ser
  pela folga escolhida.

## Conferência

- `domain/recomendacaoDeTamanho.test.ts` (9):
  - a regra sugerida pelo nome e a guardada;
  - o tamanho na medida;
  - o justo que pesa o triplo;
  - o "entre dois" e o caso em que não há;
  - o que aperta;
  - nenhum veste;
  - o que falta;
  - o guia (as faixas, o CSV, o HTML);
  - a leitura das regras.
- `ui/PainelDeRecomendacaoDeTamanho.test.tsx` (7):
  - sem a tabela;
  - o tamanho em destaque, com a comparação colorida e a explicação;
  - entre dois, e limpar;
  - nenhum veste;
  - o caimento guardado no projeto (e as medidas da pessoa, não);
  - a regra guardada ao abrir, e voltar às sugeridas;
  - o guia salvo em CSV e em HTML.
- `ui/BarraDeFerramentas.test.tsx`: o grupo Loja da aba Modelo e os dois botões.
- `npx vitest run`: 157 arquivos, 2855 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro.
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - "Recomendar tamanho" sem a tabela diz o que falta;
  - "Abrir a tabela de medidas" abre a ficha na aba Medidas, e a tabela da planilha entra colada (3 pontos);
  - o corpo de 94/98/73 dá o G, com "o M também serve (mais justo)" e a comparação dos 3 pontos;
  - o guia na tela, salvo como página HTML;
  - a folga do busto mudada para 6 cm fica no projeto, e as medidas da pessoa não;
  - em 1280 × 720, a aba Modelo cabe inteira, sem rolar;
  - 57 conferências, nenhuma falha.
