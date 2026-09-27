# Matriz de riscos — Enfesto CAD

Riscos conhecidos e deliberadamente registrados (não escondidos, não
"resolvidos" sem evidência real). Atualizar sempre que um risco for mitigado
ou um novo for descoberto.

| ID | Risco | Impacto | Estado |
|----|-------|---------|--------|
| R-1 | Nenhum arquivo DXF real de terceiros (outro CAD têxtil, AAMA/ASTM) foi usado para testar `formats/dxf-importacao.ts` — só fixtures sintéticas escritas à mão. | Arquivos reais podem usar convenções de camada, entidades (SPLINE, ARC, INSERT/blocos) ou nuances não suportadas, falhando silenciosamente na classificação (contorno/furo/fio) ou lançando avisos incorretos. | Aberto. Ver ADR 0002. Precisa de pelo menos um arquivo real por software-alvo antes de declarar suporte "pronto para produção". |
| R-2 | `core/geometria.ts#deslocarContornoParaFora` (margem de costura) usa deslocamento de arestas + interseção em esquadria ("miter"), sem detecção de autointerseção. | Cantos reflexos muito agudos combinados com margem grande podem gerar um contorno de corte que se autointersecciona (geometria inválida, não seria um erro visível imediato). | Aberto. Testado apenas contra formas convexas/moderadamente côncavas. Documentado no docstring da função. |
| R-3 | O motor de NESTING (a implementar na Etapa 7) ainda não existe — este risco será detalhado quando a implementação começar. | — | Planejado, não aplicável ainda. |

## Convenção

- **Aberto**: risco real, não mitigado, sem evidência de que está resolvido.
- **Mitigado**: reduzido por uma mudança real, com evidência (teste, medição).
- **Fechado**: eliminado ou não se aplica mais, com justificativa.

Nunca mover um risco para "Mitigado"/"Fechado" sem uma mudança real e
verificável por trás — isto é uma cópia do princípio já em vigor no projeto
irmão (moda-cad) para o mesmo tipo de tabela.
