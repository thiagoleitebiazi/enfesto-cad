# ADR 0003 — Tecido e os 5 tipos de enfesto

## Contexto

A seção 4 do escopo pede 5 modalidades de enfesto (Par, Ímpar, Zigue-zague,
Tubular, Ramado), cada uma com configuração própria, e é explícita: "o tipo
ramado deve ser tratado como modalidade independente. Não presuma
equivalência com o enfesto tubular ou com outros tipos." A seção 3 pede o
cadastro de tecido.

## Decisão

1. **Tecido** (`domain/tecido.ts`): entidade simples — nome, referência,
   composição opcional, largura total, largura útil, direcional (bool),
   pelo (bool), padrão (liso/listrado/xadrez), observações opcionais.
   `tecidoExigeRespeitoDeOrientacao()` centraliza a pergunta "este tecido
   restringe orientação?" para ser reusada pela validação da seção 5 depois.

2. **Enfesto** (`domain/enfesto.ts`): união discriminada por `tipo`, uma
   interface por modalidade, todas estendendo uma base comum (largura útil,
   comprimento, quantidade de camadas, margem lateral, margem de
   extremidade). Campos específicos:
   - Tubular: `larguraDoTuboMm` (validado >= largura útil declarada).
   - Ramado: `alinhamentoDasBordas` ('alinhado'|'escalonado') e
     `sentidoDeAlimentacao` ('unico'|'alternado') — exatamente os dois
     parâmetros que o escopo pede para esta modalidade, nada além disso.
   - Par/Ímpar/Zigue-zague: só os campos da base (nenhum parâmetro extra
     inventado para eles).

3. **O que É modelado como regra real** (tenho base razoável para isto na
   prática de enfesto têxtil):
   - `espessurasFisicasPorCamada`: Par e Tubular dobram o tecido (rolo
     dobrado ao meio / tubo achatado) — cada camada de enfesto corresponde a
     2 espessuras físicas de tecido. Os demais tipos são enfesto aberto (1
     espessura por camada). Isto importa para o cálculo de consumo (Etapa
     12) e não é uma suposição arriscada — é a definição destes dois tipos.
   - `orientacaoDaCamada`: só Zigue-zague alterna a face do tecido a cada
     camada (é a definição do enfesto contínuo de ida-e-volta sem cortar
     entre camadas, ao contrário do enfesto "só de ida" que sempre retorna
     ao mesmo lado). Os demais tipos mantêm a mesma face em todas as
     camadas. `enfestoInverteFaceEmAlgumaCamada` liga isto à seção 5: um
     tecido direcional/com pelo/estampado + zigue-zague com mais de 1 camada
     é uma combinação que precisa de aviso na validação (Etapa 5), já que
     metade das camadas fica com a face invertida.

4. **O que NÃO é modelado** (deliberadamente, para não inventar): nenhuma
   simulação física de dobra/tubo além da contagem de espessuras acima;
   nenhuma regra adicional de "ramado" além dos 2 parâmetros que o escopo
   pede — qualquer nuance industrial mais profunda que distinga ramado de
   outros tipos além disso precisaria de uma especificação adicional do
   usuário antes de ser codificada (a alternativa seria adivinhar um
   comportamento e arriscar implementar algo tecnicamente incorreto, o que
   o próprio escopo pede para evitar).

## Consequências

- A interface (Etapa 4/6) precisa apresentar uma configuração diferente por
  tipo — implementado como um formulário condicional por `tipo` mais uma
  representação visual simples (diagrama de camadas empilhadas, indicando
  espessura dupla e orientação invertida quando aplicável).
- Um projeto só pode avançar para o enfesto manual/automático (Etapas 6/7)
  depois de ter um tecido E uma configuração de enfesto definidos — reforça
  "o usuário deverá selecionar o tipo antes de iniciar o planejamento".
