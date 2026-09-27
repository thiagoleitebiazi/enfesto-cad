# TODO — Enfesto CAD

Rastreia as 10 etapas do plano original. "Feito" só é marcado quando existe
código real, testado, por trás — não quando existe só a tela.

## Etapa 1 — Analisar repositório e preparar arquitetura
**Feito.** Projeto novo (decisão do usuário), stack Electron + React + TS +
Vite, camadas `core/domain/(nesting)/(formats)/(persistence)/ui`. Ver
[ADR/0001](ADR/0001-projeto-novo-e-arquitetura.md).

## Etapa 2 — Interface CAD funcional
**Em andamento — núcleo funcional entregue.**
- [x] Barra de ferramentas agrupada (Arquivo/Edição/Desenho/Importação-
  Exportação/Configuração/Visualização), grupos com `role="group"` +
  `aria-label`.
- [x] Área de desenho em Canvas com réguas horizontais/verticais em mm.
- [x] Zoom (roda do mouse, mantém o ponto sob o cursor) e pan (botão do meio
  ou espaço+arrastar).
- [x] Seleção por clique com teste real de ponto-dentro-do-contorno.
- [x] Painel de peças e painel de propriedades (dimensões calculadas do
  contorno real, não hardcoded).
- [x] Barra de status (coordenadas do cursor em mm, zoom%, contagem de
  peças/seleção).
- [x] Desfazer/Refazer/Duplicar/Excluir com histórico real.
- [x] Atalhos de teclado (Ctrl+Z/Y/D, Delete, +/-, Ctrl+0).
- [ ] Redimensionamento de painéis (drag de divisores) — não implementado.
- [ ] Multisseleção (retângulo de seleção, Shift+clique) — não implementado.

## Etapa 3 — Modelo de dados dos moldes e importação
**Núcleo funcional entregue.**
- [x] Modelo completo: contorno, linhas internas, furos, piques, marcas,
  margem de costura, linha de fio, restrição de rotação (`domain/molde.ts`).
- [x] Ferramenta "Novo Molde": clique para adicionar pontos, Enter fecha o
  contorno, dois cliques seguintes definem a linha de fio (nunca presumida —
  seção 5). Esc cancela em qualquer momento.
- [x] Ferramenta "Furo": mesmo fluxo de desenho, aplicado à peça selecionada.
- [x] Ferramenta "Pique": clique perto da borda da peça selecionada
  (`adicionarPique` encontra a aresta mais próxima de verdade).
- [x] Ferramenta "Marca": ponto de referência na peça selecionada.
- [x] Painel de propriedades editável (nome, referência, tamanho, quantidade,
  margem de costura, permite180/permite90e270) — não é mais só leitura.
- [x] Linha de corte (contorno + margem de costura) desenhada tracejada
  quando margem > 0 (`contornoDeCorte`, deslocamento de arestas com junção em
  esquadria — ver limitação R-2 em MATRIZ_DE_RISCOS.md).
- [x] Furos renderizados como buracos reais (regra `evenodd` do Canvas), não
  apenas contornos por cima.
- [x] Importação DXF real: parser próprio (`formats/dxf-importacao.ts`),
  reconhece LWPOLYLINE/LINE/CIRCLE/POLYLINE clássico, unidade via
  `$INSUNITS`, heurística de camada (CONTORNO/FURO/FIO por nome). **Nunca
  inventa uma linha de fio ausente** — peças sem fio reconhecível não são
  adicionadas automaticamente, ficam listadas num aviso pedindo desenho
  manual. Ligado a um diálogo de arquivo real via IPC do Electron
  (`electron/main.ts` + `preload.ts`).
- [ ] Importação AAMA/ASTM: tratada apenas como heurística de nome de camada
  sobre DXF comum, não uma implementação certificada — ver ADR 0002 e risco
  R-1 (nenhum arquivo real de terceiros disponível para testar).
- [ ] Edição de pontos já existentes (arrastar vértice de um molde já criado)
  — hoje só é possível desenhar um contorno novo do zero, não editar um
  existente ponto a ponto.
- [ ] Curvas (Bézier) — só segmentos retos por enquanto, botão "Curva"
  permanece desabilitado e diz isso.
- [ ] Renomear/editar rótulo de uma Marca depois de criada.

## Etapa 4 — Tecido e tipos de enfesto
**Não iniciado.** Nenhuma entidade `Tecido` ou `Enfesto` existe ainda. Os 5
tipos (Par, Ímpar, Zigue-zague, Tubular, Ramado) precisam ser modelados como
modalidades independentes (o pedido é explícito: não presumir equivalência
entre Ramado e Tubular).

## Etapa 5 — Sentido do fio e validação geométrica
**Parcialmente feito.** `domain/molde.ts`:
- [x] Toda peça tem `linhaDeFio` (seta desenhada de verdade no canvas).
- [x] `RestricaoDeRotacao` com `permite180`/`permite90e270`, ambas `false`
  por padrão — nenhuma rotação é permitida a menos que autorizada
  explicitamente por peça.
- [x] `rotacaoEhPermitida` testado inclusive contra ângulos fora de
  [0°, 360°) e contra "nenhuma flag liga automaticamente por
  aproveitamento".
- [ ] A regra ainda não está conectada a nenhuma ferramenta de rotação na UI
  (não existe ferramenta de rotação na UI ainda — Etapa 3/6).
- [ ] Módulo de validação geométrica (sobreposição, fora dos limites,
  espaçamento) não existe.

## Etapa 6 — Enfesto manual e semiautomático
**Não iniciado.**

## Etapa 7 — Motor de NESTING automático
**Não iniciado.**

## Etapa 8 — PDF vetorial 1:1
**Não iniciado.**

## Etapa 9 — Biblioteca, atalhos de trabalhos ripados, histórico
**Não iniciado.** Ver ADR 0001 nota sobre persistência via `fs` do processo
principal do Electron (decisão já tomada, implementação pendente).

## Etapa 10 — Relatórios, testes integrados, empacotamento Windows
**Não iniciado.**

---

## Testes automatizados existentes hoje

64 testes em 4 arquivos:
- `src/core/geometria.test.ts` — vetores, bbox, área (shoelace), ponto-
  dentro-do-contorno, translação/rotação de contorno, ponto mais próximo de
  segmento/contorno, deslocamento de contorno para fora (margem de costura).
- `src/domain/molde.test.ts` — construção válida/inválida (incluindo furos e
  margem), dimensões reais, ângulo da linha de fio, a regra crítica de
  rotação, piques/marcas (adicionar/remover), `contornoDeCorte`,
  `transladarMolde` (usado por Duplicar — cobre furos/piques/marcas/fio).
- `src/ui/transformacaoDeTela.test.ts` — inversão mundo↔tela, zoom mantendo
  o pivô fixo, limites de escala, escolha do passo da régua.
- `src/formats/dxf-importacao.test.ts` — unidades (mm/polegadas/ausente),
  contorno+fio básico, furos e linhas internas por camada, regra crítica
  (nunca inventar linha de fio), heurística de fallback de contorno, múltiplas
  peças por arquivo, POLYLINE clássica, arquivo sem polilinha nenhuma. Todas
  as fixtures são sintéticas — ver risco R-1.

Nenhum teste de UI de integração (React Testing Library) ainda — a UI tem
lógica de canvas (não testável por `render()`/queries de DOM da mesma forma
que formulários). A ferramenta "Novo Molde" + Pique + Furo + margem de
costura + importação DXF foi verificada manualmente numa sessão real do
Electron (cliques sintéticos via `sendInputEvent`/`dispatchEvent` reais, não
simulação de teste — script descartável, não commitado).
