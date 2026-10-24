# ADR 0106 — O pré-custo e o simulador de meta

## Contexto

Fase 2 do estudo de funcionalidades (ADR 0099). O pré-custo da referência soma o tecido, os aviamentos, a mão de
obra e os indiretos, dá o custo e o preço, e simula uma meta de custo. Também atualiza vários produtos de uma vez
quando um preço muda. Aqui só havia o custo do tecido no plano de corte (ADR 0092).

## Decisão

- **Modelo › Pré-custo** abre a ficha técnica (ADR 0105) na aba Pré-custo (`domain/preCusto.ts`).
- **O custo de uma peça pronta:**
  - os materiais da ficha: o consumo × o preço da biblioteca, ou o digitado no item;
  - a mão de obra: o tempo da sequência operacional × o custo do minuto;
  - os indiretos: % sobre materiais + mão de obra;
  - o custo total.
  - O **preço sugerido** é o custo ÷ (100% − impostos − comissão − margem), o markup divisor. Mostra quanto do
    preço vai para os impostos, a comissão e a margem.
- **O que falta não vira zero:**
  - o item sem preço, o material que saiu da biblioteca, o consumo pelo encaixe sem peças na mesa;
  - o item em outra unidade que a do preço (metro contra quilo);
  - a ficha sem operações, ou sem o custo do minuto.
  Com qualquer um deles, o custo sai **parcial**, e a faixa diz o que falta. O grupo sem nenhum valor calculado
  aparece "—", e não "R$ 0,00".
- **Os padrões de custo** (o custo do minuto, os indiretos, os impostos, a comissão, a margem) vêm da empresa (a
  biblioteca de materiais, ADR 0104), ou são **próprios da ficha**.
- **O simulador de meta:** um custo-alvo, ou um preço-alvo (que vira o custo que dá aquele preço com os percentuais
  de agora). Ele diz quanto falta (ou sobra) e cada caminho para chegar lá, sozinho:
  - quantos minutos tirar da costura;
  - o preço ou o consumo dos dois materiais que mais pesam;
  - os indiretos;
  - na meta de preço, a margem que aquele preço dá.
  Quando um caminho não basta, ele diz ("nem sem ele chega").
- **A aprovação guarda o custo da hora** (ADR 0105), e o pré-custo mostra o aprovado e a diferença para o de agora.
- **Vários modelos de uma vez:** o custo sai sempre com os preços de agora da biblioteca, então mudar o preço de
  um material lá muda o custo de todos os modelos que o usam.
  - A biblioteca ganha a aba **Custos dos modelos**: cada projeto com ficha técnica, com o custo de agora, o
    aprovado, a diferença e o preço sugerido; o projeto aberto entra como está na tela. Exporta em CSV.
  - Remover um material avisa quais fichas o usam.
- Os valores em reais arredondam o meio centavo para cima (R$ 22,495 → R$ 22,50), sem o erro da conta com
  vírgula flutuante.

## O que não foi feito

- O custo por tamanho (cada tamanho com o consumo dele): o pré-custo é de uma peça pronta, com o consumo médio.
- Os custos de terceiros (facção, estamparia, lavanderia) entram como itens digitados (categoria Outro), não como
  um grupo próprio.

## Conferência

- `domain/preCusto.test.ts` (10):
  - a conta inteira: materiais, mão de obra, indiretos, total, preço, markup, o que sai do preço e os grupos;
  - o preço da biblioteca mudado;
  - o parcial com o que falta (e o grupo sem valor);
  - o material removido, o item digitado e a unidade que não confere;
  - os padrões próprios;
  - o custo aprovado;
  - o simulador: dentro, acima com os caminhos, e a meta de preço;
  - os custos de todos os modelos e o CSV.
- `ui/PainelDaFichaTecnica.test.tsx` (o pré-custo e o simulador na tela), `ui/PainelDeMateriais.test.tsx` (a aba
  Custos dos modelos e o aviso ao remover).
- `npx vitest run`: 147 arquivos, 2774 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro.
- O teste de uso do repositório, no programa gerado: o pré-custo com os 6 botões a R$ 0,35 (R$ 2,10), parcial
  porque falta o custo do minuto — 35 conferências, nenhuma falha.
