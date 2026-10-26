# ADR 0145 — Os looks da coleção e a busca por imagem

## Contexto

A referência tem, na loja virtual dela, o provador, a busca visual e as combinações de looks. O estudo deixava a linha
inteira de fora ("S": loja virtual e serviços).

A loja virtual continua de fora. Mas duas partes dela servem a quem cria a coleção, e dá para fazê-las aqui sem
serviço nenhum:
- **Combinar os modelos em looks:** a blusa, a saia e o casaco que vão juntos, para ver e aprovar o conjunto.
- **Achar na biblioteca o modelo parecido com uma foto:** a de uma vitrine, a de um caderno de tendências, a de uma
  peça antiga.

## Decisão

**1. Os looks** (`domain/looks.ts`): combinações de 2 a 4 modelos da coleção, guardadas na própria coleção
(`Colecao.looks`, opcional; as coleções antigas abrem do mesmo jeito).
- **As regras:**
  - o look tem nome, único na coleção;
  - os modelos não se repetem e têm de ser da coleção;
  - o modelo que sai da coleção sai do look; o look que fica com menos de 2 modelos deixa de aparecer.
- **As cores em comum:** as que todos os modelos têm, sem diferença de maiúsculas.
- **A tela:** Coleções › **Looks**. Cada look aparece com os croquis dos modelos lado a lado (o croqui da ficha do
  projeto ligado), o nome, a referência, o tecido, as cores e as cores em comum.
  - **"Salvar a prancha (HTML)":** uma página com o nome do look, a coleção, as cores em comum e um cartão por modelo,
    com o croqui da tela, para mandar a quem aprova.
  - **"Tirar o look"** remove o look.
  - **"Novo look":** o nome, os modelos (os cancelados não entram) e uma nota.

**2. A busca por imagem** (`domain/buscaVisual.ts`). Na Biblioteca, "Buscar por imagem" compara uma foto às imagens
dos modelos (Modelo › Imagens):
- **A assinatura de cada imagem:**
  - **a forma:** o "hash de diferença", de 64 bits. Ele vem de uma miniatura de 9 × 8 em tons de cinza e não muda com
    o tamanho da foto.
  - **as cores:** a proporção de cada uma de 64 faixas de cor, sem o fundo quase branco.
- **A semelhança:** metade pela forma, metade pelas cores. Cada projeto vale pela sua imagem mais parecida.
- **O resultado:** os 5 mais parecidos, com a miniatura, o quanto se parecem e "Abrir". Os projetos sem imagem são
  contados.
- **Mais de uma busca:** as imagens já lidas não são lidas de novo.
- **O que ela acha:** o parecido no traço e nas cores, não "a mesma peça em outra pose". A janela não promete mais
  que isso.

## O que não foi feito

- **A loja virtual:** a vitrine para o cliente, o provador do cliente e as recomendações de compra.
- **A busca por imagem que entende a peça** (reconhecimento por IA): precisaria do serviço de IA, com a chave do
  usuário.
- **O look vestido no manequim 3D:** o provador veste um projeto de cada vez.

## Conferência

- `domain/looks.test.ts` (5 testes):
  - as regras do look;
  - guardar, trocar e tirar, e o modelo que sai da coleção;
  - as cores em comum;
  - a leitura das coleções com e sem looks;
  - a prancha, com o texto escapado.
- `domain/buscaVisual.test.ts` (3 testes):
  - a assinatura, sem o fundo;
  - a mesma peça em outro tamanho fica acima de 90%, e outra peça de outra cor fica abaixo de 60%;
  - a ordem, a melhor imagem de cada projeto e os sem imagem.
- `ui/BuscaPorImagem.test.tsx`: o mais parecido primeiro, os sem imagem contados, "Abrir", e a segunda busca sem ler
  de novo as imagens dos modelos.
- `ui/PainelDeColecoes.test.tsx` (1 novo): o look de dois modelos, com o croqui, as cores em comum, a prancha (o nome
  sem acento no arquivo) e o tirar.
- `npx vitest run`: 188 arquivos, 3128 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 123 conferências, nenhuma falha.
  - **O look:** com um segundo modelo na coleção do teste, o look mostra os dois, com o croqui do modelo ligado ao
    projeto. A prancha sai com os dois cartões e o croqui, e o look fica gravado em `colecoes.json`.
  - **A busca:** a foto do molde de papel, que está no projeto, acha esse projeto primeiro ("parecido 100%") e conta o
    projeto sem imagem.
