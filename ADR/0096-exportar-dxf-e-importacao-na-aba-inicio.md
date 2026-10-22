# ADR 0096 — Exportar DXF, e importar/exportar na aba Início

## Contexto

Pedido do usuário, com a foto da aba Encaixe e os botões Importar DXF, Importar PDF e Exportar PDF marcados: "essas
3 opções devem estar na primeira tela de início quando o programa é aberto, e está faltando a opção de exportar dxf".
Depois: "remova aqueles que ficaram na área de encaixe".

O programa abre na aba Início; importar e exportar ficavam na aba Encaixe. Não havia exportação de DXF: o DXF só
entrava (ADR 0002, 0090).

## Decisão

### Os botões

- A aba **Início** começa pelo grupo **Importação e exportação**: Importar DXF, Importar PDF, Exportar DXF e Exportar
  PDF. Sem peça no projeto, as duas exportações ficam desligadas e dizem o motivo ("não há peças no projeto").
- A aba **Encaixe** não tem mais esses botões; o grupo dela ficou só com **Relatórios**.
- A dica da lista de peças vazia aponta para "aba Início › Importar DXF ou Importar PDF".
- Os atalhos não mudaram (Ctrl+I importa DXF, Ctrl+E abre o PDF).

### O DXF (`formats/dxf-exportacao.ts`)

- As peças **como estão na mesa**, em milímetros (`$INSUNITS` = 4), num **DXF R12** (AC1009, ASCII, Windows-1252): o
  formato clássico que programas de modelagem, de encaixe e de corte abrem. Sem janela de opções: o botão abre direto
  a janela de salvar ("moldes.dxf"), e o arquivo salvo fica no histórico.
- Os eixos são os da tela: o x do arquivo é a horizontal (o comprimento da mesa) e o y sobe, contado da borda da mesa
  — o inverso exato da importação (`mundoParaDxf` / `dxfParaMundo`).
- Uma camada para cada parte, com os nomes que a importação deste programa reconhece:
  - `CONTORNO`: a linha de corte (com a margem de costura, quando há);
  - `COSTURA`: o contorno da peça, quando há margem de costura;
  - `FURO`, `LINHAS-INTERNAS` (as do molde; os elementos de construção ficam fora, como no PDF), `FIO` (a linha de
    fio, uma reta, com o sentido);
  - `PIQUES`: cada pique como um corte reto que atravessa a linha de corte (1 mm para fora, 6 mm para dentro);
  - `SIMETRIA` (a aresta da dobra), `MARCAS` (um ponto em cada marca) e `TEXTO` (o nome da peça, os textos dela e o
    código dos piques).
- O DXF leva a geometria; o que só este programa entende (a graduação, o desenho de cada pique, os registros de pences
  e curvas) fica no projeto e no PDF com o registro da peça.

### A importação lê o próprio DXF de volta

Duas mudanças na importação, só para as camadas que este programa grava (os arquivos de outros programas continuam
lidos como antes):

- Numa camada de linhas internas (`INTERNA`/`INTERNAL` no nome), a POLYLINE clássica sem a marca de fechada fica
  **aberta** (nas outras camadas ela continua sempre fechada, a convenção de antes), e a linha é da peça por onde ela
  passa — a que começa na borda (o centro da frente, a cintura) também. Ela não vira pique.
- As retas das camadas de simetria (`SIMETRIA`/`MIRROR`) não viram pique nem linha interna; a linha de costura
  (`COSTURA`) não é tomada por borda da folha.

## Conferência

- `domain`/`formats`: o arquivo (R12, mm, camadas, EOF, ponto decimal, sem notação científica); os eixos; os acentos
  em Windows-1252; a volta pela importação com a mesma forma — contorno, furo, linha interna aberta, fio com o sentido
  e pique; a margem de costura (linha de corte como contorno, costura como linha interna, pique na linha de corte); a
  linha interna que começa na borda; simetria, marcas e textos sem virar peça, linha interna ou pique; várias peças
  com as posições de uma em relação à outra; o corte do pique para dentro, nos dois sentidos do contorno; e, na
  importação, a POLYLINE aberta na camada de linhas internas e fechada nas outras.
- A barra: o grupo Importação e exportação primeiro na aba Início, cada botão com a sua ação, as exportações
  desligadas sem peça; a aba Encaixe sem esses botões.
- `npx vitest run`: 132 arquivos, 2626 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório (`scripts/teste-de-uso/main.cjs`) confere que a tela de início tem os quatro botões,
  importa e exporta pela aba Início e grava o DXF (R12, em mm, com as 3 peças na camada CONTORNO). No Windows: 17
  conferências, nenhuma falha, sem erro na página.
