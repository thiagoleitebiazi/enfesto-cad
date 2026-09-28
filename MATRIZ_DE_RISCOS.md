# Matriz de riscos — Enfesto CAD

Riscos conhecidos e deliberadamente registrados (não escondidos, não
"resolvidos" sem evidência real). Atualizar sempre que um risco for mitigado
ou um novo for descoberto.

| ID | Risco | Impacto | Estado |
|----|-------|---------|--------|
| R-1 | Nenhum arquivo DXF real de terceiros (outro CAD têxtil, AAMA/ASTM) foi usado para testar `formats/dxf-importacao.ts` — só fixtures sintéticas escritas à mão. | Arquivos reais podem usar convenções de camada, entidades (SPLINE, ARC, INSERT/blocos) ou nuances não suportadas, falhando silenciosamente na classificação (contorno/furo/fio) ou lançando avisos incorretos. | Aberto. Ver ADR 0002. Precisa de pelo menos um arquivo real por software-alvo antes de declarar suporte "pronto para produção". |
| R-2 | `core/geometria.ts#deslocarContornoParaFora` (margem de costura) usa deslocamento de arestas + interseção em esquadria ("miter"), sem detecção de autointerseção. | Cantos reflexos muito agudos combinados com margem grande podem gerar um contorno de corte que se autointersecciona (geometria inválida, não seria um erro visível imediato). | Aberto. Testado apenas contra formas convexas/moderadamente côncavas. Documentado no docstring da função. |
| R-3 | O motor de NESTING (`domain/nesting.ts`) usa varredura por grade de passo fixo (padrão 10mm) com uma única heurística (maior-primeiro/primeiro-encaixe) — sem NFP, busca local nem comparação de múltiplas estratégias. | Encaixes podem ficar mais espaçados que o ótimo geométrico; complexidade quadrática por peça colocada não testada em escala grande (centenas de peças). | Aberto. Ver ADR 0004. Testado com 8 peças reais via Electron (78% de aproveitamento, 121ms) — não valida comportamento em projetos industriais muito maiores. |
| R-4 | O motor de nesting automático ainda não usa `tecidoExigeRespeitoDeOrientacao`/`enfestoInverteFaceEmAlgumaCamada` para restringir posições em tecidos direcionais/xadrez/listrado — essas funções existem no domínio (Etapa 4) mas não estão ligadas ao motor de nesting (Etapa 7). | Um tecido direcional/xadrez configurado não impede hoje que o nesting automático combine peças de forma que ignore a direção/casamento de padrão. | Aberto. Ver ADR 0004, seção "o que não foi implementado". |
| R-5 | `vite-plugin-node-polyfills` (dependência de build da exportação PDF, Etapa 8) traz uma vulnerabilidade conhecida de baixa severidade em `elliptic` (via `browserify-sign`/`create-ecdh`), transitiva do polyfill de `crypto` que este projeto nem usa. | Nenhum — o polyfill de `crypto` não é incluído na configuração (`include: ['util','stream','buffer']`), então esse código nunca é empacotado no app; o pacote só existe em `node_modules` como dependência de build. | Mitigado por escopo restrito. Ver ADR 0005. Reavaliar se a exclusão de `crypto` deixar de ser suportada por versões futuras do plugin. |
| R-6 | `domain/projeto.ts` grava um snapshot completo do estado (`pecas`/`tecido`/`enfesto`) a cada evento de histórico — nenhuma compactação/diff. `listar-projetos` lê e faz parse de todos os arquivos de projeto por completo a cada abertura da biblioteca. | Projetos editados/salvos muitas vezes ao longo do tempo acumulam arquivos JSON grandes; uma biblioteca com muitos projetos grandes deixa a listagem mais lenta. | Aberto. Ver ADR 0006. Aceitável para o uso esperado (dezenas de projetos); não otimizado para uso muito prolongado/biblioteca muito grande. |
| R-7 | Nenhuma cópia de segurança automática nem tratamento de edição concorrente do mesmo projeto por duas instâncias do app — um arquivo de projeto ilegível é só ignorado na listagem (nunca apagado, mas também nunca recuperado/reparado). | Corrupção de arquivo (ex.: gravação interrompida por queda de energia no meio da escrita) pode deixar um projeto invisível na biblioteca sem aviso explícito ao usuário de qual arquivo falhou. | Aberto. Ver ADR 0006, seção "o que não foi implementado". Cenário de instância concorrente é improvável (app local de usuário único) mas não impedido. |

## Convenção

- **Aberto**: risco real, não mitigado, sem evidência de que está resolvido.
- **Mitigado**: reduzido por uma mudança real, com evidência (teste, medição).
- **Fechado**: eliminado ou não se aplica mais, com justificativa.

Nunca mover um risco para "Mitigado"/"Fechado" sem uma mudança real e
verificável por trás — isto é uma cópia do princípio já em vigor no projeto
irmão (moda-cad) para o mesmo tipo de tabela.
