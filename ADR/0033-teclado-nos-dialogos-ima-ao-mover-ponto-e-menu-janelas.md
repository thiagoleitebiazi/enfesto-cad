# ADR 0033 — Diálogos seguram o teclado, ímã no Mover ponto, menu Janelas e fio do DXF corrigido

## Contexto

O ADR 0032 terminou com uma lista do que ficou de fora, e o usuário pediu
para fazer tudo o que desse. Dessa lista, dava para resolver sem adivinhar
comportamento:

1. **Os diálogos não seguravam as teclas.** Com o foco num botão ou num
   `<select>` de um diálogo, Delete, Ctrl+Z, zoom e os outros atalhos agiam
   no desenho por trás — Delete podia apagar a peça selecionada —, e Esc
   cancelava a ferramenta em vez de fechar o diálogo.
2. **F1 não abria a ajuda.** E, logo ao abrir o programa, nenhum atalho
   funcionava antes do primeiro clique: o foco ficava no corpo da página,
   fora da janela do app.
3. **O ímã valia só nos cliques.** Arrastar vértices (Mover ponto) era livre.
4. **A barra de status mostrava sempre mm**, mesmo com a régua em cm.
5. **Abrir um projeto não reenquadrava a vista**, e as vistas guardadas do
   projeto anterior continuavam no histórico.
6. **A cerca não tinha faixa de instruções**, e o realce mostrava todas as
   categorias de pontos, sem seguir as caixas marcadas no diálogo.
7. **As duas tabelas de atalhos** tinham larguras de coluna diferentes.
8. **Não havia menu Janelas.**

A revisão do código encontrou mais dois problemas:

9. **A sugestão do fio na importação de DXF estava invertida.** Uma linha de
   fio em pé na tela era sugerida como "horizontal", e vice-versa. E a escolha
   feita no diálogo era ignorada quando o arquivo trazia a linha: a peça
   ficava sempre com a linha do arquivo.
10. **Estado que sobrava de um projeto para outro.** Um projeto novo ou
    aberto mantinha a seleção em lote, a ferramenta de desenho e o contorno
    pela metade do anterior. Excluir o projeto aberto deixava o histórico de
    desfazer, e Ctrl+Z trazia as peças do projeto excluído para o projeto
    vazio. Restaurar uma versão mantinha a seleção, que podia apontar para
    peças que já não existiam.

E a verificação mostrou um terceiro:

11. **Esc e o foco dentro dos diálogos.** Com os diálogos segurando o Esc,
    apertá-lo no campo de renomear da Biblioteca fechava a biblioteca
    inteira. E, quando o controle com o foco some de um diálogo ("Cancelar"
    da troca de nome, "Calcular encaixe" no Nesting), o foco cai no corpo da
    página e as teclas deixam de chegar ao diálogo — Esc não o fechava.

## Decisão

### Diálogos seguram o teclado (`ui/Sobreposicao.tsx`)

Vale para os 14 diálogos do programa, que usam a mesma sobreposição.

- As teclas apertadas dentro do diálogo não chegam aos atalhos do programa.
- **Esc** fecha o diálogo, com o foco em qualquer controle dele.
- **Tab e Shift+Tab** circulam só entre os controles do diálogo.
- Ao abrir, o foco entra no diálogo: no controle com `autoFocus`, se houver;
  senão, no painel. Ao fechar, volta para onde estava; se aquilo sumiu, vai
  para a janela do programa, para os atalhos continuarem valendo.
- **Foco perdido:** se o controle com o foco some do diálogo, a próxima tecla
  o traz de volta. Esc fecha; Tab vai para o primeiro controle (Shift+Tab, o
  último); as outras teclas só devolvem o foco ao painel, sem agir no desenho.
- O painel ganhou `role="dialog"`, `aria-modal` e o título como rótulo.
- `aoTeclar`, no App, ignora qualquer tecla enquanto houver um diálogo aberto,
  para o caso de uma tecla chegar de fora dele.
- **Campo de renomear da Biblioteca:** Enter faz o mesmo que OK, e Esc o mesmo
  que Cancelar, sem fechar a biblioteca.

### F1 e o foco ao abrir o programa

- F1 abre "Atalhos de teclado". O atalho aparece no menu Ajuda e na própria
  tabela.
- Ao abrir o programa, o foco vai para a janela do app, se ninguém o tiver
  pegado. Os atalhos funcionam antes do primeiro clique.

### Ímã no Mover ponto (`ui/AreaDeDesenho.tsx`)

- Com o ímã ligado, o vértice arrastado prende no vértice mais próximo **das
  outras peças** (contorno, furos e linhas internas), a até 10 px na tela.
  Se não houver nenhum, e a grade estiver visível, prende no ponto da grade.
  O marcador é o mesmo dos cliques: quadrado no vértice, cruz na grade.
- Quem prende é o vértice agarrado: a posição dele mais o quanto o mouse
  andou. Agarrá-lo um pouco ao lado não cria um deslocamento a mais.
- **Não prende nos vértices da própria peça**, o que deixaria pontos
  repetidos ou o contorno encostando em si mesmo.
- Com vários vértices selecionados (Shift+clique ou retângulo), os outros
  andam exatamente o mesmo tanto que o agarrado.
- Um clique para escolher um vértice, com tremor menor que 3 px, não o move.
  Com a grade visível, o tremor o levaria ao ponto da grade mais próximo.
- Com o ímã desligado, o vértice anda exatamente o que o mouse andou, como
  antes. Um arrasto continua sendo um passo só de Desfazer.
- A dica do Ímã diz que ele vale também ao arrastar um vértice.

### Barra de status na unidade da régua

X, Y, DX, DY e Dist seguem a unidade escolhida no canto das réguas ou no
menu Opções. Em cm, com duas casas (a mesma precisão de 0,1 mm); em mm, com
uma casa. O ângulo continua em graus.

### Abrir projeto e estado que sobrava

Abrir um projeto da Biblioteca enquadra o desenho como "Ajustar à tela" (a
mesa e todas as peças) e limpa o histórico de vistas, que era do projeto
anterior.

Cada ação abaixo passou a limpar também o que era do estado anterior:

| Ação | Passa a limpar |
|---|---|
| Novo projeto | seleção em lote, ferramenta de desenho (volta a Selecionar), contorno pela metade |
| Abrir projeto | o mesmo, mais o histórico de vistas (e reenquadra) |
| Excluir o projeto aberto | seleção, seleção em lote, histórico de desfazer e refazer |
| Restaurar versão | seleção e seleção em lote |

### Cerca

- O realce no desenho segue as caixas marcadas no diálogo "Mover cerca" e
  mostra só os pontos que o próximo movimento vai deslocar
  (`pontosMoveisNaCerca` recebe as opções). As opções ficam no App: continuam
  como o usuário as deixou de uma abertura do diálogo para a outra.
- Com a cerca definida e nenhuma ferramenta de desenho ativa, uma faixa fixa
  diz: "Cerca ativa: “Mover cerca” (aba Manipulação) desloca os pontos
  destacados. Clique em “Definir cerca” de novo para removê-la."

### Tabela de atalhos

- A coluna das teclas tem a mesma largura (46%) nas duas tabelas, Teclado e
  Mouse, e elas ficam alinhadas (`table-layout: fixed` e `<colgroup>`).
- Textos corrigidos:
  - Esc também fecha o diálogo aberto.
  - Shift+clique num vértice inclui o vértice na seleção do Mover ponto **ou
    o tira dela** (antes dizia só "somar").

### Menu Janelas

Fica entre Opções e Ajuda, no mesmo padrão dos outros menus:

- **Lista de peças, Barra de visualização e Validação do projeto** mostram ou
  escondem cada painel e ficam marcados quando ele está visível.
- **Propriedades da peça** abre o diálogo da peça selecionada. Sem uma peça
  selecionada, fica desabilitado, com a dica "Selecione uma peça primeiro".

Sem a lista de peças, a grade do layout passa a ter uma coluna só
(`.sem-lista-de-pecas`) e o desenho ocupa a largura toda; sem isso, ele
ficaria preso na coluna estreita da lista. Sem a barra de visualização, o
desenho fica mais alto.

### Sugestão do fio no DXF (`formats/dxf-importacao.ts`)

- `direcaoNaTelaDaLinhaDeFio` dá a direção na tela de uma linha de fio do
  DXF. Como em `dxfParaMundo` (ADR 0012), o x do DXF é a horizontal da tela
  e o y, a vertical; uma linha inclinada fica com o eixo em que anda mais. O
  código anterior, no próprio App, tinha os dois lados trocados.
- Ao confirmar a importação, a linha exata do arquivo só é usada se o
  usuário manteve a direção sugerida. Se escolheu a outra, a peça recebe uma
  linha nova na direção escolhida, como quando o arquivo não traz a linha.

## O que NÃO foi feito

- **Modificar e Redefinir perímetro**: continuam aguardando um DXF de antes e
  depois, feito na referência.
- **Ferramentas de elementos e Definir curva**: os motivos do ADR 0032 seguem
  valendo.
- **Grupos recolhidos num único botão, como no Office**: até a largura mínima
  da janela (1024 px), não foi preciso.
- **O menu Janelas não gerencia documentos**: o programa continua com um
  projeto por vez, e o menu só mostra e esconde painéis.
- **O ímã não vale ao arrastar a peça inteira**, só ao arrastar vértices.
- **Restaurar uma versão não reenquadra a vista.**
- **Abrir um projeto pela Biblioteca troca o trabalho não salvo sem
  perguntar** (comportamento antigo).
- **X e Y da barra de status continuam nos eixos do projeto** (ADR 0012): X é
  a vertical da tela.
- **As opções da cerca não ficam salvas no projeto**: valem enquanto o
  programa está aberto.
- **Fechar o Nesting durante o cálculo não o interrompe.** Agora dá para
  fechar também com Esc, como já dava com o × e com um clique fora; o cálculo
  continua. Para pará-lo, há o botão Cancelar.
- **Projetos salvos antes da correção do DXF do ADR 0032** mantêm a linha
  interna a mais; basta importar o DXF de novo.
- **O DXF de exemplo não tem linhas de fio.** A sugestão foi conferida com um
  DXF sintético, feito só para o teste.
- Ícones no estilo do próprio programa; a identidade visual da referência não
  foi copiada (ADRs 0017/0018/0031).

## Verificação (Electron real, build de produção)

- **Testes:** 342/342 em 28 arquivos (eram 322 em 24).
  - Novos: ímã no Mover ponto 6, diálogos 7, Biblioteca 2, barra de status 2,
    DXF 2 (direção do fio na tela), cerca 1 (realce segue as opções).
  - O teste do diálogo Mover cerca passou a controlar as opções de fora.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático, janela de 1440 × 900 visível:**
  - Abertura: logo ao abrir, o foco está na janela do app. F1, antes de
    qualquer clique, abriu "Atalhos de teclado", e Esc o fechou.
  - Fio no DXF: num DXF sintético com uma linha de fio em pé e outra
    deitada, o diálogo sugeriu "vertical" e "horizontal", e as setas na
    captura conferem. Desfazer deixou 0 peças.
  - Menu Janelas:
    - sem a lista, o desenho ocupou a largura toda da janela;
    - sem a barra de visualização, ficou mais alto;
    - a validação aparece e some;
    - Propriedades da peça fica desabilitado sem seleção.
  - Diálogo Propriedades aberto, com Mover ponto ligado:
    - Delete e Ctrl+Z dentro do diálogo não mexeram nas peças (5 de 5), e o
      diálogo ficou aberto;
    - Esc fechou só o diálogo, e o foco voltou ao botão Janelas;
    - um segundo Esc desligou o Mover ponto.
  - Tabelas de atalhos: a primeira coluna tem 239 px nas duas.
  - Barra de status:
    - em cm, "X: 74.38 cm  Y: 61.12 cm";
    - em mm, "X: 746.9 mm", com "mm" no canto das réguas;
    - DX, DY e Dist do Novo Molde nas duas unidades.
  - Cerca:
    - a faixa "Cerca ativa" aparece;
    - ao desmarcar "Pontos do contorno", os pixels do realce caíram de 435
      para 146, e a escolha continuou ao fechar e reabrir o diálogo;
    - removida a cerca, a faixa e o realce sumiram.
  - Ímã no Mover ponto, com grade: o marcador não aparece num tremor de
    1 px, aparece durante o arrasto e some ao soltar. Desfazer devolveu o
    vértice.
  - Abrir projeto: com o zoom em 98%, abrir levou a 32%, o mesmo de "Ajustar
    à tela". A seleção ficou vazia e Vista anterior, desabilitada.
  - Janela de 1024 × 720: fita com 154 px, sem rolagem horizontal; o diálogo
    de atalhos cabe na janela.
- **Roteiro curto da Biblioteca:**
  - Esc no campo de renomear cancelou só a troca de nome: a biblioteca
    continuou aberta e o nome, igual.
  - Tab, em seguida, foi para o × do diálogo.
  - Enter renomeou, e a biblioteca continuou aberta.
  - Depois de "Cancelar", o foco caiu no corpo da página. Delete devolveu o
    foco ao diálogo, e Esc o fechou, com o foco de volta na janela do app.
    F1 voltou a funcionar.
- **Janela de teste atrás de outras:**
  - Nesse estado, o Chromium dá a janela como oculta, deixa de avisar o
    tamanho da área de desenho e devolve capturas antigas. O zoom ao abrir
    variava entre 22% e 32% de uma execução para outra.
  - Só o roteiro de teste passou a usar `setBackgroundThrottling(false)`; o
    programa não mudou. Com isso, deu 32% em todas as execuções.
  - Um usuário não clica numa janela escondida, e ela recebe o tamanho certo
    ao aparecer.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos). Os roteiros
  usam uma pasta própria.
