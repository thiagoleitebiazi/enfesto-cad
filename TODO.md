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
**Não iniciado.** `domain/molde.ts` já existe com o modelo de dados (id,
nome, referência, tamanho, contorno, linhas internas, linha de fio,
quantidade, restrição de rotação) mas:
- [ ] Edição de pontos/linhas/curvas na interface (hoje só existem as 2
  peças de demonstração, hardcoded em `App.tsx`).
- [ ] Piques, furos, marcas, margens de costura.
- [ ] Importação DXF (nem sequer iniciada — precisa avaliar biblioteca de
  parsing).
- [ ] Importação AAMA/ASTM — avaliar viabilidade real antes de prometer.

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

- `src/core/geometria.test.ts` — vetores, bbox, área (shoelace), ponto-
  dentro-do-contorno, translação/rotação de contorno.
- `src/domain/molde.test.ts` — construção válida/inválida, dimensões reais,
  ângulo da linha de fio, e a regra crítica de rotação (inclui teste de que
  nenhuma flag "otimiza automaticamente" a orientação).
- `src/ui/transformacaoDeTela.test.ts` — inversão mundo↔tela, zoom mantendo
  o pivô fixo, limites de escala, escolha do passo da régua.

Nenhum teste de UI de integração (React Testing Library) ainda — a UI tem
lógica de canvas (não testável por `render()`/queries de DOM da mesma forma
que formulários); testado manualmente via `npm run dev`.
