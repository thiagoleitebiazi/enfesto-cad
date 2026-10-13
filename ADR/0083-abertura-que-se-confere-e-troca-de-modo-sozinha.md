# ADR 0083 — A abertura que se confere e troca de modo sozinha (a janela preta em outro computador)

## Contexto

Instalado em outro computador, o programa abre uma janela **preta**: nada é
desenhado. O relato é de outubro (ADRs 0024, 0025 e 0026) e continuou depois
das duas correções tentadas — desligar a aceleração por placa de vídeo e
servir a interface por `app://`. O arquivo de diagnóstico daquele computador
nunca chegou, e o defeito não aparece neste.

O que foi apurado agora, sem o outro computador:

- **Não falta nenhuma DLL.** Lidas as tabelas de importação de todos os
  executáveis e DLLs do programa empacotado: só dependem de DLLs do próprio
  Windows. O README dizia que a causa provável era a falta do Visual C++
  Redistributable; era um palpite, e estava errado.
- **O programa só roda em Windows 10 ou 11 de 64 bits** (é o que o cabeçalho
  do executável pede). Em Windows mais antigo ele nem abre a janela.
- **Não é o nome do usuário com acento.** O programa empacotado abriu
  normalmente com acentos, espaços, `#` e `&` na pasta de instalação, na de
  dados e na temporária, com o perfil novo.
- **O motor deixa de desenhar a janela que ele julga encoberta.** Reproduzido
  aqui: aberta atrás de outra janela, a do programa fica só com o fundo —
  página carregada, 48 botões no DOM, `visibilityState` "hidden", nenhum
  quadro de animação — até vir para a frente. Neste computador ela se
  recupera sozinha quando aparece; não há como garantir que em outro se
  recupere, e basta o motor errar esse julgamento para a janela ficar sem
  desenho à vista de quem usa. É a situação da abertura logo depois de
  instalar, com a janela do instalador ainda na frente.
- **As causas que restam estão fora do programa**, e variam de um computador
  para outro: o antivírus (ou outro programa de segurança) que não deixa os
  processos isolados do motor funcionarem; o processo de vídeo que não sobe;
  o computador lento em que a primeira abertura demora muito, com a janela
  preta à vista enquanto isso.

Sem saber qual é a do computador relatado, a correção não pode ser mais um
palpite numa opção só.

## Decisão

### O programa confere a tela, e só então mostra a janela

- A janela nasce **escondida**. Aparece quando a página carregou, o motor
  avisou que desenhou, e uma **foto da página** — pedida ao próprio motor —
  não está preta.
- Quem usa o programa não vê mais a janela preta à espera. Se a abertura
  passa de uns 8 segundos, aparece o aviso **"Abrindo o Enfesto CAD…"**, por
  uma caixa do próprio Windows (que não depende do motor de tela), com o
  botão "Cancelar a abertura".

### Se a tela não aparece, ele reabre em outro modo

Quatro modos, do padrão ao mais compatível:

| Modo | O que muda |
|---|---|
| padrão | desenho por software; todos os processos do motor isolados |
| vídeo no processo principal | o vídeo deixa de ser um processo à parte, e de ser isolado |
| de compatibilidade | nenhum processo do motor é isolado |
| de compatibilidade com a placa de vídeo | idem, e o desenho volta para a placa de vídeo |

- A abertura falha num modo quando: a página não começa a carregar em 25 s;
  ou carrega e nada é desenhado em 15 s; ou a foto dela sai preta até esse
  prazo; ou o processo da página, ou o de vídeo, cai antes de a tela aparecer.
- O **lado** do defeito escolhe o modo seguinte: se foi a página que não
  carregou, vai direto ao de compatibilidade (mexer só no vídeo não a faria
  carregar); se foi o vídeo, segue a ordem.
- O programa **reabre a si mesmo** no modo seguinte, na hora, dizendo no
  aviso que está tentando outro modo.
- O modo que funcionou fica **guardado neste computador**
  (`abertura.json`, na pasta de dados): as aberturas seguintes vão direto
  nele. O modo padrão tem **duas chances** antes de ser deixado — num
  computador lento, a primeira abertura depois de instalar pode só ter
  demorado. Os outros, uma.
- Se o programa **cai** antes de mostrar a tela (sem chance de reabrir
  sozinho), a abertura seguinte já começa no modo seguinte.
- Com outra versão do programa instalada, tudo recomeça do modo padrão.

### Se nenhum modo funciona, ele diz

- Uma caixa do Windows: "O Enfesto CAD não conseguiu mostrar a tela neste
  computador", o que tentar (exceção no antivírus, reiniciar), e um resumo —
  a versão do Windows, os antivírus que o Windows conhece ali, os modos
  tentados e o último motivo.
- Botões **"Copiar o diagnóstico"** e **"Abrir a pasta do diagnóstico"**: o
  próximo relato de janela preta já vem com a causa.

### O motor desenha a janela mesmo que a julgue encoberta

- O rastreio de janela encoberta do motor (`CalculateNativeWinOcclusion`)
  fica desligado em todos os modos. A janela aberta atrás de outra passa a
  ser desenhada do mesmo jeito.

### A janela preta que o programa não tem como ver

- Há um caso que escapa da conferência: o motor desenha, a foto sai certa, e
  a janela mesmo assim fica preta na tela. Quem vê isso fecha o programa e
  abre de novo.
- Então, **fechado logo depois de abrir duas vezes seguidas**, ele pergunta
  (por uma caixa do Windows): "A janela do Enfesto CAD abriu direito da
  última vez?". Com "Não, ficou preta ou vazia", passa ao modo seguinte. Com
  "Sim", não pergunta mais.

### O resto

- **Uma instância só:** abrir o programa de novo, com ele aberto ou abrindo,
  traz a janela que já existe, em vez de começar outra abertura por cima.
- **Pedidos pela linha de comando** (no atalho): `--modo-de-compatibilidade`
  abre sempre no modo de compatibilidade; `--modo-padrao` esquece o que está
  guardado. A variável `ENFESTO_CAD_PRAZO_DE_ABERTURA_S` muda o prazo (2 a
  600 s).
- **A página tem um aviso próprio** ("Abrindo o Enfesto CAD…") enquanto a
  interface carrega, e diz o erro se ela não montar: nunca fica vazia.
- **O diagnóstico** passou a ter o modo, o computador (Windows, processador,
  memória), cada passo da abertura com o tempo em que se deu, e a queda de
  qualquer processo do motor. O arquivo não cresce sem fim, e o mesmo erro
  de console repetido é gravado só três vezes.
- **O instalador ficou menor:** o arquivo do programa (`app.asar`) levava a
  pasta `node_modules` inteira, que não é usada (a interface já vai
  empacotada). Passou de 60 MB para 2,6 MB.
- A lógica (os modos, a troca, o estado guardado) fica em
  `src/domain/abertura.ts`, sem nada do Electron, e é testada à parte.

## O que NÃO foi feito

- **Não foi visto no computador do relato.** A causa de lá continua sem
  confirmação. O que mudou é que o programa agora contorna as causas
  conhecidas por conta própria e, se não conseguir, mostra o motivo.
- **O modo de compatibilidade desliga o isolamento dos processos do motor.**
  É uma proteção a menos, aceita só no computador em que o programa não abre
  de outro jeito. A interface não carrega nada da internet: só os arquivos do
  próprio programa.
- **Não há assinatura digital.** O instalador sem assinatura é o que mais
  atrai a desconfiança dos antivírus; continua como estava.
- **Não roda em Windows de 32 bits, nem em Windows 7 ou 8.**
- **O instalador novo não foi executado:** foi gerado o pacote desmontado, e
  é ele que foi aberto nos ensaios (rodar o instalador trocaria o programa
  instalado neste computador).

## Verificação

- **Testes:** 2115/2115 em 95 arquivos (eram 2063 em 94); tipos e lint limpos
  (o aviso antigo do `useMemo` continua). Novos, 52: os modos e o que cada um
  liga; o modo seguinte por lado do defeito; o estado guardado, inclusive
  estragado e de outra versão; a abertura inteira em cinco computadores
  imaginados (o que funciona, o que só abre no de compatibilidade, o lento, o
  que só abre no último modo, o que não abre); a pergunta; a linha de
  comando; os prazos; a conferência da foto.
- **Mutações** (na lógica, `src/domain/abertura.ts`): 85, uma por vez, com o
  código conferido por hash antes e depois; 84 pegas. A que sobreviveu
  apontou uma conferência redundante no prazo (o que não é número já cai fora
  da faixa aceita): foi tirada, e as 3 mutações refeitas na linha simplificada
  foram pegas. O processo principal (`electron/main.ts`) não é coberto por
  testes de unidade: é conferido pelos ensaios abaixo.
- **Electron real, com o `main.js` de verdade e um defeito injetado:**
  - sem defeito: abre no padrão;
  - a página que não responde: aviso, reabre no de compatibilidade e abre; na
    segunda abertura repete e o modo fica guardado; na terceira vai direto;
  - a foto que sai preta: reabre com o vídeo no processo principal;
  - o processo de vídeo derrubado, e o da página derrubado: reabre na hora,
    no modo do lado certo;
  - nada funciona: passa pelos modos e mostra a caixa final;
  - a abertura lenta: o aviso aparece e some, sem trocar de modo;
  - o processo que morre antes de mostrar a tela: a abertura seguinte já vem
    no modo seguinte;
  - a pergunta respondida "ficou preta": reabre no modo seguinte;
  - `--modo-de-compatibilidade`; e a segunda instância, que sai sem abrir
    janela.
- **O pacote novo, empacotado (com outro nome de app, para não tocar nos
  dados reais):**
  - aberto por trás de outra janela: desenhado, com 92 quadros em 1,5 s
    (antes ficava só com o fundo);
  - com o processo da página travado na partida, como faria um antivírus
    (`--wait-for-debugger-children=renderer`): passou pelos três modos e
    mostrou a caixa final, com o Windows e os antivírus deste computador no
    resumo.
- **Roteiro de tela anterior (a etapa 51):** 22 conferências, 0 falhas, com a
  abertura nova.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
