# ADR 0006 — Biblioteca de trabalhos, atalhos e histórico/versões

## Contexto

Seções 9 (biblioteca permanente), 10 (atalhos para trabalhos ripados) e 11
(histórico e versões) do escopo, tratadas juntas nesta etapa porque, na
prática, dependem da mesma peça de infraestrutura: persistência real em
disco de um "Projeto" (não só os moldes soltos que já existiam desde a
Etapa 1).

## Decisões

1. **Um projeto = um arquivo JSON** em
   `<userData>/projetos/<id>.json` (Electron `app.getPath('userData')`,
   local, sem servidor — mesma linha do ADR 0001/0010 do moda-cad: local-
   first). Nada de banco de dados embutido — para o volume esperado
   (dezenas a poucas centenas de projetos por usuário), arquivos simples
   são suficientes e trivialmente inspecionáveis/copiáveis para backup
   manual pelo próprio usuário.
2. **Seções 9 e 10 unificadas num único painel** (`PainelDeBiblioteca`).
   O "atalho para trabalho ripado" da seção 10 — "não pode ser só uma
   imagem ou link temporário, precisa apontar para o projeto persistido" —
   já é exatamente o que "Abrir" na biblioteca faz: carrega o
   `Projeto` completo do disco, com moldes/tecido/enfesto/histórico
   intactos. Não foi criada uma segunda lista/view separada só para
   diferenciar "trabalhos ripados" de "projetos da biblioteca" — seria a
   mesma listagem com um filtro de status a menos, sem ganho real.
3. **Histórico grava um snapshot completo do estado** (`EstadoDoProjeto` =
   `{pecas, tecido, enfesto}`) a cada evento significativo — criação,
   salvamento (manual ou automático), mudança de tecido/enfesto, execução
   de nesting, exportação de PDF, restauração de versão anterior. Simples
   e correto (nenhuma lógica de diff/patch para acertar), ao custo de cada
   evento carregar o estado inteiro. Ver limitação de escala abaixo.
4. **Restaurar versão NUNCA apaga histórico** — `restaurarVersao` sempre
   adiciona um novo evento `restauracao-de-versao` com o estado antigo,
   nunca remove/reescreve eventos passados. Testado explicitamente
   (`projeto.test.ts`) e confirmado numa sessão real do Electron com
   múltiplas restaurações em sequência, cada uma preservando os eventos
   anteriores.
5. **Salvamento automático**: um temporizador de 60s compara o estado ao
   vivo (`pecas`/`tecido`/`enfesto`, via `useRef` atualizado num
   `useEffect` — nunca lido/escrito durante o render, para não repetir o
   erro de "ref durante render" já corrigido antes nesta sessão) com o
   último estado registrado; se mudou, grava um evento `salvamento`
   automaticamente. Isto cobre "recuperação após falha" sem precisar de um
   fluxo de "restaurar rascunho?" à parte — o estado mais recente já fica
   disponível na Biblioteca, então reabrir o app e abrir o projeto de novo
   já é a recuperação.
6. **Duplicar/Renomear/Arquivar/Excluir agem sobre QUALQUER projeto da
   lista**, não só o aberto no momento — abrem/modificam o arquivo
   diretamente via IPC, sem precisar carregar o projeto na tela. Excluir
   sempre pede confirmação (`window.confirm`) antes.

## O que NÃO foi implementado (limitações reais, registradas)

- **Nenhuma transição de status além de `em-edicao` ⇄ `arquivado`** está
  ligada a uma ação real de UI. `calculando`/`concluido`/
  `pronto-para-producao` existem no tipo `StatusDoProjeto` (para quando
  operações reais os justificarem — ex.: `calculando` durante o nesting
  automático) mas não há botão "marcar como pronto para produção" ainda;
  isso exigiria decidir o que esse status realmente trava/libera, o que
  não foi pedido explicitamente ainda.
- **`envio-para-producao` existe no tipo `TipoDeEvento`** mas nenhuma ação
  de UI o dispara — nenhuma etapa do escopo até aqui define o que "enviar
  para produção" significa concretamente (não há impressora/fila real).
- **Nenhuma visualização de PDF embutida** — a biblioteca não abre os PDFs
  exportados dentro do próprio app; o usuário abre o arquivo pelo SO. O
  caminho do arquivo fica registrado na descrição do evento de histórico
  (`exportacao-de-pdf`), mas não há um leitor de PDF embutido.
- **Escala**: cada arquivo de projeto carrega TODO o histórico com
  snapshots completos — um projeto editado centenas de vezes ao longo do
  tempo acumula um arquivo grande, e `listar-projetos` lê e faz parse de
  todos os arquivos por completo a cada abertura da biblioteca. Aceitável
  para o uso esperado (dezenas de projetos, histórico de uma sessão de
  trabalho), não otimizado para bibliotecas muito grandes nem para
  histórico de anos de uso contínuo.
- **Sem cópia de segurança nem resolução de conflito** além de "arquivo
  ilegível é ignorado na listagem, nunca apagado" — não há arquivo `.bak`
  automático nem tratamento de edição concorrente do mesmo projeto por
  duas instâncias do app (cenário improvável para um app local de usuário
  único, mas não tratado).

## Consequências

- `domain/projeto.ts` é puro e testável sem Electron (16 testes).
- A persistência real (IPC + `fs`) só existe no processo principal —
  `formats`/`domain` continuam sem I/O direto, mesma separação de camadas
  do ADR 0001.
