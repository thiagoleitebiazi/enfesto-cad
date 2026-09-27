# ADR 0001 — Projeto novo, stack e arquitetura inicial

## Contexto

O pedido original descreve um CAD industrial completo de enfesto têxtil,
encaixe (nesting) e preparação para corte, como aplicação desktop Windows.
Antes de começar, foi confirmado explicitamente com o usuário se este
trabalho deveria continuar em `moda-cad` (um CAD de modelagem já existente,
com ~12 prioridades entregues) ou ser um projeto novo. Resposta do usuário:
**"crie um novo do zero"**. Este repositório (`enfesto-cad`) é esse projeto
novo, independente de `moda-cad` e de `textil-gestao` (app de gestão
Next.js/Prisma, sem relação com CAD).

## Decisões

1. **Aplicação desktop com Electron**, não Tauri. O pedido sugeria "Tauri ou
   Electron". Esta máquina não tem toolchain Rust/Cargo instalado — instalar
   um toolchain novo de sistema só para isso seria um custo desnecessário
   nesta etapa. Electron roda inteiramente sobre Node, que já está disponível.
   Isso é revisitável: nada na arquitetura de domínio/geometria depende do
   shell desktop.
2. **React + TypeScript + Vite** para a interface, com `vite-plugin-electron`
   integrando o processo principal (`electron/main.ts`) e o preload
   (`electron/preload.ts`) ao mesmo pipeline de build do renderer.
3. **Unidade interna: milímetros**, sempre, como `number` do JavaScript
   (double-precision). Nenhuma conversão para polegadas/pixels acontece fora
   da camada de UI (`ui/transformacaoDeTela.ts`), que só existe para mapear
   mm → pixels de tela.
4. **Camadas com dependência apenas para baixo**, mesmo padrão que funcionou
   bem em `moda-cad` (registrado na memória do projeto):
   `core/` (geometria pura) → `domain/` (Molde, e futuramente Tecido/Enfesto)
   → `nesting/` (motor de encaixe, ainda não criado) → `formats/`
   (DXF/PDF, ainda não criado) → `persistence/` (biblioteca de trabalhos,
   ainda não criado) → `ui/` (React).
5. **Persistência**: ainda não implementada (Etapa 9). Quando implementada,
   será baseada em arquivos locais via processo principal do Electron
   (`fs`), não em IndexedDB do navegador — o Electron dá acesso a disco de
   verdade, o que facilita a "biblioteca permanente de trabalhos" pedida na
   seção 9 do escopo.
6. **Sem rotação automática por aproveitamento.** A regra da seção 5 do
   pedido (sentido do fio nunca pode ser violado, nem "silenciosamente
   otimizado") é tratada como regra crítica de domínio desde o primeiro
   commit: `domain/molde.ts` só permite as rotações explicitamente
   autorizadas por peça (`RestricaoDeRotacao`), com teste dedicado
   verificando que nenhum ângulo fora da lista permitida passa a validação.

## Estado ao final desta rodada (Etapas 1–2 do plano)

Interface funcional real, não uma maquete: barra de ferramentas agrupada
(Arquivo/Edição/Desenho/Importação-Exportação/Configuração/Visualização),
área de desenho em Canvas com réguas em mm, pan (arrastar com botão do meio
ou espaço+arrastar), zoom com a roda do mouse (mantendo o ponto sob o cursor
fixo), seleção por clique com teste de ponto-dentro-do-contorno real (não
apenas bounding box), painel de peças, painel de propriedades (dimensões
reais calculadas a partir do contorno), barra de status com coordenadas do
cursor em mm e zoom atual, desfazer/refazer/duplicar/excluir funcionais com
histórico real, atalhos de teclado (Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, +/-,
Ctrl+0).

Botões sem função real (importação DXF, exportar PDF, salvar/abrir projeto,
tecido, enfesto, ferramentas de linha/curva/pique) estão **desabilitados**
com `title` explicando o motivo — nenhum é decorativo ou finge funcionar.

## Consequências / próximos passos

- Etapa 3 (modelo de dados completo dos moldes + importação DXF) exige
  escolher uma biblioteca de parsing DXF (avaliar `dxf-parser` ou
  implementação própria mínima) — decisão adiada até começar essa etapa.
- O motor de nesting, tipos de enfesto e exportação PDF ainda não existem;
  nada na UI hoje declara que existem.
