# ADR 0004 — Motor de NESTING automático: estratégia e limites

## Contexto

A seção 6 do escopo pede um motor de encaixe 2D real (contornos, não só
bounding box), respeitando quantidade, restrição de rotação, sentido do
fio, margens/distância mínima e limites de corte; três modos (automático,
semiautomático — Etapa 6 — e manual — também Etapa 6); métricas de
resultado; e é explícita: "não prometa encontrar o ótimo matemático em
todos os casos. Priorize resultados válidos, reprodutíveis e com boa
qualidade geométrica."

## Decisão

1. **Heurística: "maior peça primeiro, primeiro encaixe" (largest-first,
   first-fit)** — todas as cópias a colocar (uma por unidade de
   `quantidade` de cada molde) são ordenadas por área decrescente, e cada
   uma é posicionada na primeira posição livre encontrada por uma
   varredura esquerda→direita, cima→baixo (`domain/posicionamento.ts#
   encontrarPrimeiraPosicaoValida`, a mesma primitiva do modo
   semiautomático da Etapa 6 — nenhuma lógica de posicionamento duplicada
   entre os dois modos).
2. **Sentido do fio nunca é ignorado**: para cada peça, só os ângulos de
   `rotacoesPermitidas(peca.restricaoDeRotacao)` são tentados — nenhum
   código de fallback ou "tenta girar mesmo assim se não couber". Uma peça
   que só cabe girada, mas cuja restrição não permite aquele ângulo, fica
   como não colocada — nunca gira sem permissão para melhorar
   aproveitamento (mesma regra crítica da seção 5, testada explicitamente:
   ver `nesting.test.ts` "nunca usa uma rotação fora de
   rotacoesPermitidas...").
3. **Geometria completa preservada**: cada peça colocada é reconstruída via
   `rotacionarMolde`/`transladarMolde` (as mesmas funções já usadas pela
   edição manual) — furos, piques, marcas e margem de costura viajam
   junto, não são reimplementados só para o encaixe.
4. **Não bloqueia a interface**: o cálculo roda num Web Worker
   (`src/nesting.worker.ts`), com progresso reportado peça a peça e
   cancelamento cooperativo (`deveContinuar`) — interromper devolve um
   resultado parcial (`interrompido: true`), nunca trava a UI nem finge
   ter terminado.
5. **Métricas honestas**: comprimento utilizado, área ocupada,
   aproveitamento % e tempo de processamento são calculados a partir do
   resultado real, não estimados. Peças que não couberam são listadas
   explicitamente na UI antes de aplicar — aplicar o resultado nunca
   descarta peças silenciosamente sem avisar antes.

## O que NÃO foi implementado (limitação conhecida, não escondida)

- **Uma única estratégia heurística.** O escopo sugere "comparar
  resultados, executar diferentes tentativas" — isso não existe ainda;
  hoje há exatamente uma ordenação (maior-primeiro) e uma estratégia de
  busca (primeiro encaixe). Busca local, têmpera simulada ou algoritmos
  genéticos, e a comparação de múltiplas tentativas, ficam para uma etapa
  futura caso o usuário peça.
- **Varredura por passo fixo (grade), não um algoritmo de posicionamento
  contínuo/NFP (no-fit polygon).** `passoMm` (padrão 10mm) limita a
  precisão do encaixe — peças podem ficar mais espaçadas do que o ótimo
  geométrico permitiria. Reduzir o passo aumenta a qualidade mas também o
  tempo de cálculo (O(área/passo²) por peça já colocada).
- **Direcionalidade de tecido (estampa) não é considerada no motor
  automático ainda** — a seção 4/5 pede correspondência de padrão para
  tecidos direcionais/xadrez/listrado; isso está modelado no domínio
  (`tecidoExigeRespeitoDeOrientacao`, `enfestoInverteFaceEmAlgumaCamada`)
  mas o motor de nesting ainda não usa essa informação para restringir
  ainda mais as posições/rotações tentadas.
- **Desempenho não testado em escala grande** (centenas de peças) — a
  complexidade quadrática por peça colocada é aceitável para o caso comum
  (dezenas de peças, testado com 8 no fluxo real via Electron) mas pode
  ficar lenta para projetos industriais muito grandes. Sem otimização por
  índice espacial (ver mesma limitação já registrada para a validação
  geométrica, Etapa 5).

## Consequências

- `domain/nesting.ts` é puro e testável sem worker (13 testes cobrindo
  casos básicos, sentido do fio, métricas, interrupção cooperativa e
  preservação de furos/piques/marcas).
- `src/nesting.worker.ts` é só um adaptador fino de protocolo de mensagens
  em cima da função pura — qualquer mudança de estratégia futura muda só
  o domínio, não o worker.
