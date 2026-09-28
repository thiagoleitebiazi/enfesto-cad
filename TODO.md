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
**Núcleo funcional entregue.**
- [x] Entidade `Tecido` (`domain/tecido.ts`): nome, referência, composição
  opcional, largura total/útil, direcional, pelo, padrão (liso/listrado/
  xadrez), observações.
- [x] 5 tipos de enfesto como união discriminada (`domain/enfesto.ts`), cada
  um modalidade independente — Ramado não reaproveita nenhum campo de
  Tubular (ver ADR 0003). Tubular tem `larguraDoTuboMm` próprio; Ramado tem
  `alinhamentoDasBordas`/`sentidoDeAlimentacao` próprios.
- [x] Regras reais implementadas (não só armazenamento): Par/Tubular dobram
  o tecido (2 espessuras físicas por camada); só Zigue-zague alterna a face
  do tecido a cada camada (`orientacaoDaCamada`,
  `enfestoInverteFaceEmAlgumaCamada` — liga com a seção 5 para tecidos
  direcionais).
- [x] Painéis de configuração (`PainelDeTecido`, `PainelDeEnfesto`) com
  formulário condicional por tipo e diagrama de corte lateral
  (`DiagramaDeEnfesto`, SVG mostrando espessura dobrada e inversão de face).
  Botões "Tecido"/"Enfesto" da barra de ferramentas agora reais.
- [x] Faixa de status mostra o tecido/enfesto configurados (ou "não
  configurado").
- [ ] Ainda não há nenhum bloqueio que impeça avançar para nesting sem
  tecido/enfesto configurados — isso será natural quando a Etapa 6/7 (que
  de fato precisam desses dados) forem implementadas.

## Etapa 5 — Sentido do fio e validação geométrica
**Núcleo funcional entregue.**
- [x] Toda peça tem `linhaDeFio` (seta desenhada de verdade no canvas) e
  `RestricaoDeRotacao` (`permite180`/`permite90e270`, ambas `false` por
  padrão) — nenhuma rotação é permitida a menos que autorizada
  explicitamente por peça, testado inclusive contra "nenhuma flag liga
  automaticamente por aproveitamento".
- [x] `anguloDeRotacaoGraus` rastreado por peça (`Molde`) e
  `rotacionarMolde()` (rotação rígida em torno do centro do bbox, gira
  contorno/furos/linhas internas/piques/marcas/linha de fio juntos).
- [x] Ferramenta de rotação real na UI (botões 90°/180°/270° no painel de
  propriedades). **Bloqueia de verdade** (não só avisa) qualquer rotação
  fora de `rotacoesPermitidas` da peça, com alerta explicando quais ângulos
  são permitidos — verificado numa sessão real do Electron (peça sem
  permissão: bloqueada, ângulo permanece 0°; peça com permite180: aplicada,
  ângulo vira 180°).
- [x] Módulo de validação geométrica (`domain/validacao.ts`, independente de
  UI): sobreposição de contornos, fora dos limites do tecido (considerando
  margem lateral/extremidade), espaçamento insuficiente entre peças
  (`distanciaMinimaEntrePecasMm`, novo campo em `ConfiguracaoDeEnfesto`),
  rotação proibida, contorno inválido (peça ou furo), escala suspeita
  (peça implausivelmente pequena/grande — aviso, não erro).
- [x] Erros são distintos de avisos (`severidade: 'erro' | 'aviso'`) —
  `projetoTemErrosCriticos()` já pronta para a futura Etapa 9 usar como
  gate de "pronto para produção" (ainda não existe esse botão porque o
  conceito de status do projeto só existe a partir da Etapa 9 — não criado
  agora para não ser um botão decorativo sem persistência por trás).
- [x] UI: indicador de validação na barra de status (clicável, mostra
  contagem de erros/avisos), painel expansível com a lista completa (cada
  item seleciona a peça envolvida), contorno das peças com erro destacado
  em vermelho tracejado no canvas — verificado numa sessão real (duplicar
  uma peça sobre si mesma via Ctrl+D gera sobreposição real, detectada e
  refletida no indicador: "1 erro(s), 0 aviso(s)").
- [ ] Novas primitivas de geometria de suporte (`segmentosSeIntersectam`,
  `distanciaEntreSegmentos`, `contornosSeSobrepoem`, `distanciaEntreContornos`,
  `bboxesSeSobrepoem`) usam O(n·m) por par de peças com pré-filtro por bbox —
  suficiente para dezenas/poucas centenas de peças; não otimizado com índice
  espacial para projetos muito grandes (ver seção 14 do escopo original).

## Etapa 6 — Enfesto manual e semiautomático
**Núcleo funcional entregue.**
- [x] Manual: arrastar uma peça com o mouse (clique e arraste no canvas, modo
  "Selecionar") move-a de verdade, com validação em tempo real (o indicador
  de validação e o contorno vermelho tracejado já refletem sobreposição/
  fora dos limites/espaçamento durante a edição, herdado da Etapa 5). Uma
  prévia em tempo real é desenhada durante o arrasto; o deslocamento só
  entra no histórico de desfazer/refazer ao soltar o mouse (não a cada
  pixel).
- [x] Semiautomático: `domain/posicionamento.ts#sugerirPosicaoSemSobreposicao`
  — heurística "primeiro encaixe" (varre a área útil, primeira posição sem
  sobreposição e respeitando a distância mínima). Botão "Sugerir posição"
  (grupo Encaixe da barra de ferramentas) aplica a sugestão à peça
  selecionada; se nenhuma posição couber, avisa em vez de posicionar errado
  ou travar. Reaproveitável como bloco de construção do motor automático da
  Etapa 7.
- [x] Verificado numa sessão real do Electron: arrastar uma peça e conferir
  a nova posição por seleção de clique (posição antiga vazia, nova posição
  populada) + desfazer restaura a posição exata; duplicar uma peça sobre a
  original (sobreposição real), clicar "Sugerir posição" e ver o indicador
  de validação ir de "1 erro(s)" para "sem problemas".
- [ ] Sem otimização multi-peça ainda (isso é o motor da Etapa 7) — a
  sugestão olha uma peça de cada vez, ignorando quantidade/tamanhos
  variados/melhor aproveitamento global.

## Etapa 7 — Motor de NESTING automático
**Núcleo funcional entregue.**
- [x] `domain/nesting.ts`: heurística "maior peça primeiro, primeiro
  encaixe" usando contornos reais (não bounding box), reaproveitando a
  primitiva de varredura da Etapa 6 (`encontrarPrimeiraPosicaoValida`).
  Considera quantidade por peça, restrição de rotação (nunca tenta um
  ângulo fora de `rotacoesPermitidas` — regra crítica da seção 5, testada
  explicitamente), margens e distância mínima do enfesto, limites úteis.
  Peças colocadas são reconstruídas via `rotacionarMolde`/`transladarMolde`
  — furos, piques, marcas e margem de costura preservados.
- [x] Não bloqueia a interface: cálculo roda em Web Worker
  (`src/nesting.worker.ts`), com progresso peça a peça e cancelamento
  cooperativo (resultado parcial honesto, não finge ter terminado).
- [x] Métricas reais: peças colocadas/não colocadas, comprimento
  utilizado, área ocupada, aproveitamento %, tempo de processamento.
- [x] UI: botão "Nesting Automático" (grupo Encaixe), painel de progresso
  + resultado (`PainelDeNesting`), lista peças que não couberam antes de
  aplicar, "Aplicar ao projeto" substitui as peças pela disposição
  calculada (uma única entrada no histórico de desfazer).
- [x] Verificado numa sessão real do Electron: 5x "Frente" + 3x "Costas"
  (8 peças) — todas as 8 colocadas, 0 não colocadas, 820mm de comprimento
  utilizado, 78% de aproveitamento, 121ms; após aplicar, a validação da
  Etapa 5 confirma "sem problemas" no layout resultante (sem sobreposição,
  dentro dos limites, nenhuma rotação proibida).
- [ ] Uma única estratégia heurística — não compara múltiplas tentativas/
  ordenações nem usa busca local/algoritmos genéticos (ver ADR 0004).
- [ ] Varredura por passo fixo (grade), não um algoritmo NFP contínuo —
  limita a qualidade do encaixe; ajustável via `passoMm` mas não exposto
  na UI ainda.
- [ ] Tecidos direcionais/xadrez/listrado (`tecidoExigeRespeitoDeOrientacao`)
  ainda não restringem as posições/rotações tentadas pelo motor
  automático — ver risco R-4 em MATRIZ_DE_RISCOS.md.
- [ ] Desempenho em escala grande (centenas de peças) não testado.

## Etapa 8 — PDF vetorial 1:1
**Núcleo funcional entregue.**
- [x] `formats/pdf-exportacao.ts` (pdfkit + blob-stream): contornos viram
  operações vetoriais reais (`moveTo`/`lineTo`), nunca imagem rasterizada.
  Unidade mm convertida para pontos PDF só ao desenhar (`mmParaPontos`).
- [x] Tipo A — `gerarPdfDeEncaixe`: tecido, moldes posicionados, dimensões,
  comprimento, quantidade de camadas, ladrilhado (multi-página) quando a
  área é maior que uma folha, etiqueta de posição por página para
  remontagem.
- [x] Tipo B — `gerarPdfDeMoldesIndividuais`: cada peça em escala real,
  identificação (nome/referência/tamanho/quantidade), ladrilhado por peça
  quando maior que uma folha.
- [x] Cada peça desenhada com: contorno + furos (buraco real via regra
  evenodd), linhas internas, linha de corte tracejada (quando há margem de
  costura), piques, marcas, seta do sentido do fio.
- [x] Régua de referência de 100mm em toda exportação, para conferir a
  escala depois de imprimir.
- [x] Formato de página (A4/A3/Letter), orientação (retrato/paisagem),
  margem configuráveis via `PainelDeExportacaoPdf`. Salvamento real via IPC
  do Electron (`salvar-arquivo`, diálogo nativo de salvar).
- [x] Testes confirmam a GEOMETRIA real do PDF gerado, não só "não lançou
  exceção": assinatura `%PDF-`, contagem de páginas via `/Count`, e uma
  linha vetorial da régua de referência medida diretamente no fluxo de
  conteúdo do PDF (`m`/`l`) batendo com `mmParaPontos(100)` — prova real de
  escala 1:1, não presumida.
- [x] Bug real encontrado e corrigido: a build do pdfkit para navegador não
  registra fontes padrão automaticamente (precisa de `registerStdFonts()`)
  — sem isso, `doc.text()` lançava exceção dentro do handler de clique,
  manifestando como um `window.alert()` nativo que bloqueava toda a
  interface (e travava scripts de automação). Ver ADR 0005.
- [x] Verificado numa sessão real do Electron: os dois tipos de exportação
  gerados e salvos em disco com sucesso, contagem de páginas conferida
  batendo exatamente com o cálculo manual (9 páginas para um encaixe
  500×700mm em A4 retrato margem 10mm; 8 páginas para 2 peças de 300×400mm
  em moldes individuais).
- [ ] Importação AAMA/ASTM real de PDF não se aplica (isso é da Etapa 3);
  aqui a limitação é: não usa nenhuma biblioteca/verificador externo de
  conformidade PDF/A ou similar — só a própria geração via pdfkit.
- [ ] Impressão em múltiplas páginas testada só estruturalmente (contagem
  de páginas, geometria); nunca impressa fisicamente para confirmar que a
  régua de referência realmente mede 100mm no papel.

## Etapa 9 — Biblioteca, atalhos de trabalhos ripados, histórico
**Núcleo funcional entregue.**
- [x] `domain/projeto.ts`: entidade `Projeto` (id, nome, código gerado por
  data+sequencial, datas de criação/modificação, status, estado atual,
  histórico). Persistência real via IPC do Electron — um arquivo JSON por
  projeto em `<userData>/projetos/`, sobrevive a fechar e reabrir o app
  (`listar-projetos`/`salvar-projeto`/`excluir-projeto`).
- [x] `PainelDeBiblioteca`: lista ordenada por mais recente primeiro, busca
  por nome/código/tecido, filtro por status, Abrir/Duplicar/Renomear/
  Arquivar/Excluir (excluir sempre pede confirmação). Seções 9 e 10 do
  escopo unificadas neste único painel — "Abrir" já é o atalho persistente
  que a seção 10 pede (aponta para o projeto real salvo em disco, não uma
  imagem/link temporário). Ver ADR 0006.
- [x] Botões "Novo"/"Abrir"/"Salvar"/"Salvar como" da barra de ferramentas,
  antes desabilitados, agora reais. Atalhos de teclado Ctrl+S (salvar) e
  Ctrl+O (abrir biblioteca).
- [x] `PainelDeHistorico`: lista de eventos (criação, salvamento, mudança
  de tecido/enfesto, execução de nesting, exportação de PDF), mais recente
  primeiro, com "Restaurar esta versão" por evento — restaurar NUNCA apaga
  histórico, sempre adiciona um novo evento de restauração.
- [x] Salvamento automático a cada 60s quando algo mudou desde o último
  evento registrado (cobre recuperação após queda/travamento — o estado
  mais recente já fica na Biblioteca, sem precisar de um fluxo separado de
  "restaurar rascunho").
- [x] Verificado numa sessão real do Electron, incluindo um REINÍCIO
  completo do processo (não só recarregar a página): salvar um projeto com
  uma peça girada, encerrar o Electron por completo, abrir um processo
  novo do zero, confirmar que a Biblioteca lista o projeto vindo do disco,
  abrir e confirmar que a rotação salva volta corretamente; restaurar uma
  versão anterior do histórico múltiplas vezes em sequência, confirmado
  por inspeção direta do arquivo JSON persistido (não só pela tela) que
  nenhum evento de histórico foi perdido.
- [ ] Só os status `em-edicao`/`arquivado` estão ligados a uma ação real de
  UI — `calculando`/`concluido`/`pronto-para-producao` existem no tipo mas
  sem operação real que os justifique ainda (seção 9 pede status
  "conforme as operações realmente implementadas").
- [ ] `envio-para-producao` existe como tipo de evento de histórico mas
  nenhuma ação de UI o dispara — nenhuma etapa do escopo define ainda o
  que "enviar para produção" significa concretamente neste app.
- [ ] Nenhum visualizador de PDF embutido na biblioteca (abre pelo SO).
- [ ] Sem cópia de segurança automática nem otimização para bibliotecas
  muito grandes/histórico muito extenso — ver riscos R-6/R-7.

## Etapa 10 — Relatórios, testes integrados, empacotamento Windows
**Núcleo funcional entregue.**
- [x] `domain/relatorio.ts#gerarRelatorioDeProducao`: puro, sem I/O, recebe um
  `Projeto` e devolve projeto/referências/tecido/enfesto/peças por tamanho/
  comprimento utilizado/área ocupada/aproveitamento-desperdício (recalculados
  da geometria atual, nunca de um resultado de nesting salvo à parte) /versão
  do encaixe (conta eventos `execucao-de-nesting` no histórico, ADR 0006).
- [x] `formats/relatorio-exportacao.ts`: `gerarPdfDeRelatorio` (pdfkit,
  mesmo padrão vetorial do ADR 0005) e `gerarExcelDeRelatorio` (`exceljs` —
  `xlsx` foi avaliado e rejeitado por vulnerabilidade real de severidade alta
  via `npm audit`; ver ADR 0007, risco R-8).
- [x] `PainelDeRelatorio` (mesmo padrão de sobreposição dos demais painéis) +
  botão "Relatórios" na barra de ferramentas, com exportação real via o
  mesmo canal IPC `salvar-arquivo` (generalizado para detectar a extensão do
  arquivo e escolher o filtro do diálogo nativo — PDF ou Excel).
- [x] Bug real encontrado e corrigido numa verificação em Electron real (não
  pelos testes automatizados — ver risco R-9): `Helvetica-Bold` não estava
  registrada, travando a exportação em PDF do relatório com um diálogo
  nativo bloqueante. Corrigido registrando também
  `pdfkit/standard-fonts/HelveticaBold`. Ver ADR 0007.
- [x] Verificado numa sessão real do Electron: abrir o relatório mostra os
  dados reais do projeto carregado (2 modelos tamanho M, 4 peças no total),
  exportar Excel produz um `.xlsx` real (assinatura ZIP `PK`, 7738 bytes),
  reabrir o painel e exportar PDF produz um PDF real (assinatura `%PDF`,
  4890 bytes) — ambos os arquivos passaram pelo canal IPC de verdade
  (`salvar-arquivo`), painel fecha automaticamente após cada exportação bem-
  sucedida.
- [x] Teste integrado (`src/integracao.test.ts`): encadeia DXF → `Molde` →
  nesting automático → PDF do encaixe → `Projeto` → relatório de produção →
  PDF/Excel do relatório, tudo com dados reais (sem mocks). Cruza o
  aproveitamento calculado de forma independente pelo relatório com o
  aproveitamento devolvido pelo próprio motor de nesting — confirma que as
  duas camadas concordam sobre a mesma geometria.
- [x] Empacotamento Windows real via `electron-builder` (NSIS): script
  `npm run package:win` gera `release/Enfesto CAD Setup 0.1.0.exe` (~89MB,
  instalador de verdade com desinstalador) e `release/win-unpacked/` (build
  desempacotado). Verificado lançando o executável empacotado diretamente
  (sem instalar no sistema): janela real abre com o título "Enfesto CAD".
  Ver ADR 0008.
- [x] Risco real descoberto ao auditar a árvore completa de dependências
  pela primeira vez (`npm audit` após instalar `electron-builder`):
  `electron@33.4.11` está várias versões principais atrás e acumula
  vulnerabilidades reais conhecidas. Deliberadamente não corrigido nesta
  etapa (upgrade de versão principal, risco real de quebra, merece etapa
  própria) — registrado como risco R-10 em MATRIZ_DE_RISCOS.md, não
  escondido.
- [ ] Nenhuma assinatura de código real no instalador (sem certificado) —
  Windows SmartScreen vai avisar sobre executável não verificado. Ver ADR
  0008.
- [ ] Sem ícone customizado — usa o ícone padrão do Electron.
- [ ] `electron@33.4.11` não atualizado (risco R-10) — decisão deliberada,
  não uma limitação técnica.

---

## Testes automatizados existentes hoje

185 testes em 14 arquivos:
- `src/domain/tecido.test.ts` — criação válida/inválida, `tecidoExigeRespeitoDeOrientacao`.
- `src/domain/enfesto.test.ts` — validação comum aos 5 tipos, parâmetros
  próprios de Tubular e Ramado, espessuras físicas por camada, inversão de
  face por camada no Zigue-zague, distância mínima entre peças.
- `src/domain/validacao.test.ts` — projeto limpo (sem problemas),
  sobreposição, espaçamento insuficiente, fora dos limites do tecido,
  rotação proibida vs. explicitamente permitida, escala suspeita (pequena/
  grande), contorno/furo inválido, `projetoTemErrosCriticos`.
- `src/domain/posicionamento.test.ts` — sugestão em área vazia, desvio de
  peça existente respeitando distância mínima, `null` quando a peça não
  cabe ou a área está ocupada, margens respeitadas.
- `src/domain/nesting.test.ts` — casos básicos (área vazia, sem
  sobreposição no resultado, distância mínima, quantidade > 1, margens),
  regra crítica do sentido do fio (nunca gira fora do permitido, mesmo
  quando ajudaria a encaixar; usa 90° quando explicitamente permitido),
  métricas (comprimento/área/aproveitamento coerentes, zero peças sem
  NaN/erro, tempo via relógio injetado), interrupção cooperativa e
  progresso, preservação de furos/piques/marcas/margem de costura.
- `src/formats/pdf-exportacao.test.ts` — conversão mm↔pontos, orientação de
  página, estrutura real do PDF (assinatura, contagem de páginas via
  ladrilhado, rótulo de texto decodificado dos glifos hex do pdfkit),
  escala 1:1 verificada geometricamente (linha vetorial da régua de
  referência medida no fluxo de conteúdo).
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
- `src/domain/projeto.test.ts` — geração de código, criação com evento
  inicial, registro de eventos sem perder os anteriores, restauração de
  versão preservando todo o histórico, alterar status/renomear, filtro por
  texto/status combinados, ordenação por mais recente.
- `src/domain/relatorio.test.ts` — campos básicos (nome/código/status/data),
  "não configurado" quando falta tecido, agrupamento por tamanho (modelos x
  quantidade total), ordenação alfabética, comprimento utilizado como maior
  extensão em Y, aproveitamento+desperdício somando 100%, zero peças sem
  NaN, contagem de `versaoDoEncaixe` por eventos de nesting, referências
  únicas ignorando vazias.
- `src/formats/relatorio-exportacao.test.ts` — PDF real (assinatura `%PDF-`,
  tamanho mínimo), Excel real com round-trip completo (escreve com
  `exceljs` e lê de volta com o mesmo `exceljs`, conferindo nomes de
  planilha e valores de célula específicos — não só "não lançou exceção").
- `src/integracao.test.ts` — encadeia DXF → Molde → nesting automático →
  PDF do encaixe → Projeto → relatório de produção → PDF/Excel do
  relatório, com dados reais e cruzando o aproveitamento calculado por duas
  camadas independentes (nesting e relatório) para confirmar que concordam.

Nenhum teste de UI de integração (React Testing Library) ainda — a UI tem
lógica de canvas (não testável por `render()`/queries de DOM da mesma forma
que formulários). A ferramenta "Novo Molde" + Pique + Furo + margem de
costura + importação DXF foi verificada manualmente numa sessão real do
Electron (cliques sintéticos via `sendInputEvent`/`dispatchEvent` reais, não
simulação de teste — script descartável, não commitado).
