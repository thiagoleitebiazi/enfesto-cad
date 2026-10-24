# ADR 0099 — Ampliação do escopo: o estudo das funcionalidades e as fases

## Contexto

Pedido do usuário (2026-10-24): "um estudo completo para adicionar todas as funcionalidades, de forma completa, do
[ecossistema de referência] e implementá-las aqui".

Até aqui o Enfesto CAD era um CAD de enfesto, encaixe e preparação de corte (ADR 0001), e em duas ocasiões o
usuário escolheu um recorte menor quando havia sobreposição com outros tipos de programa — no ADR 0011, recusou a
ficha técnica e a gestão de coleção neste programa. O ADR 0098 registrou essas áreas como "fora do objetivo". O
pedido de agora muda isso: o usuário quer as funções dos outros módulos aqui.

## Decisão

- O estudo está em [ESTUDO-DE-FUNCIONALIDADES.md](../ESTUDO-DE-FUNCIONALIDADES.md): cada função dos módulos da
  referência, a situação no Enfesto CAD e a viabilidade aqui (completa, com limite, dependente de serviço ou
  equipamento).
- O escopo do Enfesto CAD passa a incluir, em fases: encaixe e sala de corte completos; ficha técnica e pré-custo;
  desenho técnico; gestão de coleção; digitalização pela foto; recomendação de tamanho; 3D; IA (quando houver o
  serviço). A ordem e o conteúdo de cada fase estão no estudo.
- Continua valendo: o código do programa irmão de modelagem não é copiado para cá sem um pedido (ADR 0001); nada
  aparece como pronto sem estar; o que é equipamento vira arquivo de saída, e o que depende de servidor ou conta de
  terceiros fica dito como tal, com a parte local feita.
- Cada fase entra testada, conferida no programa gerado (pasta de dados descartável) e registrada no seu ADR.
