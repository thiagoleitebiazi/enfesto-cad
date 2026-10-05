# ADR 0029 — Importação de PDF de outros programas só com confirmação do usuário

## Contexto

O ADR 0028 importava os contornos fechados com valores que o arquivo não
tinha: escala 1:1, nomes "Peça N", linha de fio vertical e disposição em
grade. Isso contraria o princípio do projeto de não inventar dados. O
usuário pediu que a importação ficasse fiel ao arquivo.

## Decisão

1. **Coordenadas reais da página.** O extrator mantém as coordenadas do
   PDF em pontos, com origem no canto inferior esquerdo. Não há deslocamento
   para a origem nem disposição em grade.
2. **Conversão fiel à página.** `contornoEmMundo` multiplica pelo fator de
   escala do usuário e inverte o eixo vertical (PDF tem y para cima; a tela
   tem y para baixo). A orientação da peça na tela bate com a do PDF.
3. **Confirmação antes de criar peças.** Ao importar, abre o diálogo
   `DialogoDeImportacaoPdf`, que lista cada contorno com vértices e exige:
   - fator de escala (padrão 1, que é o tamanho do papel em mm; aceita
     apenas número maior que zero);
   - nome da peça (campo vazio até o usuário digitar);
   - direção do fio, "vertical" ou "horizontal" na tela (sem valor
     pré-selecionado);
   - "Importar" só habilita quando todos os contornos marcados têm nome e
     direção do fio.
   Cada contorno pode ser desmarcado sem exigir nome nem fio.
4. **Descartes com motivo.** O diálogo informa quantos contornos foram
   descartados por borda da folha, poucos vértices, área pequena e
   não fechados, e quantas curvas foram aproximadas por segmentos.
5. **Falhas não passam em silêncio.** A criação das peças roda dentro de
   `try/catch`; uma falha vira mensagem na faixa de avisos.

## O que NÃO é assumido

- Escala real: o desenho diz "1:5", mas o arquivo não confirma isso. O
  padrão 1 é o tamanho do papel; o usuário define a escala.
- Nome, direção do fio e tamanho ("M", o valor padrão de Novo Molde): o
  usuário define nome e fio; "M" continua sendo o padrão do modelo.
- Linhas abertas não são reconstruídas em contornos.
- Curvas continuam aproximadas por segmentos, como no arquivo.

## Verificação

- Testes do extrator (7): contornos aceitos e descartados por motivo,
  coordenadas exatas da página (centro do círculo em (300, altura − 400)),
  inversão e escala, direção do fio.
- Testes do diálogo (4): botão desabilitado sem nome e fio, habilitado com
  os dois, desmarcar contorno, recusa de fator inválido.
- Suíte completa: 271/271. Typecheck limpo. Lint sem erros.
- Electron de produção com o PDF do Audaces: o diálogo lista os 4
  contornos (67, 69, 37 e 37 vértices); o botão começa desabilitado; ao
  preencher nomes e fio, habilita; ao importar, as 4 peças entram com os
  nomes escolhidos e as posições do PDF, e o diálogo fecha.
- As 3 validações de erro na tela são sobreposição entre contornos, que
  também se sobrepõem no desenho original.

## Consequências

- Não publicado: aguardando pedido explícito.
- Os nomes de teste (Frente, Costas, Manga, Gola) foram escolhidos pelo
  teste e não correspondem necessariamente às formas do desenho.

## Atualização

- O tamanho ("M") deixou de ser um valor fixo: não está no arquivo. Agora é um
  campo opcional no diálogo, vazio por padrão, e as listas mostram um traço
  quando ele está vazio.
- Escala, nomes e direção do fio continuam sendo definidos pelo usuário: o
  arquivo não os traz em forma legível (o "1:5" e os nomes são contornos
  desenhados, sem texto). Automatizar isso exigiria chutar.
