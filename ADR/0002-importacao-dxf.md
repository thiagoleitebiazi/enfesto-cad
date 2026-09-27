# ADR 0002 — Importação DXF: escopo, heurísticas e limitação conhecida

## Contexto

A seção 3 do escopo pede importação de DXF e, "quando tecnicamente viável",
AAMA/ASTM. AAMA (American Apparel Manufacturers Association) não define um
formato binário próprio para isto — na prática, o intercâmbio de moldes entre
softwares CAD de vestuário usa DXF comum com **convenções de nome de camada**
(contorno, furo, linha de fio, piques) que cada fabricante de software segue
com variações. Não há acesso, neste repositório, a nenhum arquivo DXF real
gerado por outro software CAD têxtil para validar contra um dialeto
específico.

## Decisão

1. Implementar um parser DXF ASCII próprio (`src/formats/dxf-importacao.ts`),
   não uma biblioteca de terceiros — o subconjunto necessário (LWPOLYLINE,
   LINE, CIRCLE, POLYLINE/VERTEX clássico, `$INSUNITS`) é pequeno o bastante
   para não justificar uma dependência externa, e testar exaustivamente com
   fixtures sintéticas é mais simples sem a superfície de uma biblioteca
   genérica.
2. Reconhecimento de camada é **heurístico, por nome** (contém "CONTORNO",
   "OUTLINE", "FURO", "HOLE", "FIO", "GRAIN" etc., case-insensitive) — não
   uma implementação certificada de nenhuma especificação AAMA/ASTM formal.
   Isto é declarado explicitamente na interface e no README; o programa nunca
   deve alegar "compatível com AAMA" sem qualificação.
3. Se nenhuma camada de contorno for reconhecida, a polilinha fechada de
   maior área é usada como contorno, com aviso explícito (heurística, não
   verdade garantida).
4. **Nunca inventar uma linha de fio.** Se o arquivo não declarar uma camada
   de fio reconhecível, a peça importada tem `linhaDeFio: null` e um aviso
   textual citando a regra crítica da seção 5 — a peça só pode ser adicionada
   ao projeto depois que o usuário desenhar a linha de fio manualmente. Isto
   é nova para este projeto, mas seque o mesmo princípio de "não presumir
   automaticamente" já estabelecido no domínio (`RESTRICAO_PADRAO` em
   `domain/molde.ts`).
5. Unidade: lida de `$INSUNITS` quando presente (mm, cm, m, polegadas, pés);
   se ausente ou com um código não mapeado, assume milímetros e marca
   `unidadeAssumida: true` no resultado — isto deve ser exibido na interface,
   não silenciado.

## Limitação conhecida (risco registrado, não "corrigido por enquanto")

**Nenhum arquivo DXF real de terceiros (exportado por outro CAD têxtil ou
AAMA/ASTM) foi usado para testar este parser.** Todos os testes em
`dxf-importacao.test.ts` usam fixtures escritas à mão seguindo a
especificação pública de grupos de código DXF. É plausível que arquivos
reais usem variações de convenção de camada, entidades não suportadas
(SPLINE, ARC, blocos/INSERT, textos de anotação) ou nuances de codificação
que este parser ainda não trata. Ver `MATRIZ_DE_RISCOS.md` (risco R-1).
Antes de declarar suporte a DXF "pronto para produção", pelo menos um
arquivo real de cada software CAD-alvo (ex.: exportações comuns do setor)
precisa ser obtido e testado.

## Consequências

- `formats/dxf-importacao.ts` é puro (recebe uma string, devolve dados) —
  sem I/O de arquivo, para ficar testável sem Electron. A leitura do arquivo
  em si (diálogo nativo + `fs.readFile`) fica na integração Electron
  (`electron/main.ts` + preload + IPC), tratada separadamente.
- A UI deve exibir os avisos (`avisos: string[]`) ao usuário após a
  importação, nunca descartá-los silenciosamente.
