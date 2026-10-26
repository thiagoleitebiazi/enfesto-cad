# ADR 0144 — A mesa digitalizadora (o quadro de captura) pela porta serial

## Contexto

A referência copia moldes de papel com o quadro de captura: o molde preso numa mesa digitalizadora e um cursor de
botões tocado em cada ponto. O estudo deixava isso de fora, porque é equipamento ("H").

O Enfesto CAD já copiava moldes de papel pela foto (ADR 0045 e 0109), mas não pela mesa. As mesas de modelagem falam
pela porta serial (ou por um adaptador USB-serial) e mandam uma linha de texto por toque, no formato ASCII
"XXXXX,YYYYY,B": as coordenadas em linhas da mesa e o botão do cursor.

## Decisão

**1. A leitura e os botões** (`domain/mesaDigitalizadora.ts`):
- **Cada linha é um toque:** dois inteiros e o botão.
  - **Os separadores:** vírgula, espaço ou ponto e vírgula.
  - **O botão:** em decimal ou num dígito hexadecimal.
  - **A ordem dos campos:** "X, Y, botão" ou "botão, X, Y".
  - **O que não é toque** (cabeçalho, linha quebrada) fica de fora e é contado.
- **A escala:** a resolução, em linhas por polegada, leva os toques a milímetros, arredondados ao milésimo de
  milímetro.
- **Os eixos:** o x da mesa vai para a direita do desenho e o y da mesa, para cima.
- **Os botões do cursor:**
  1. ponto de canto;
  2. ponto de curva;
  3. pique, que também é ponto do contorno;
  4. fio, com dois toques (um terceiro recomeça);
  5. fechar a peça;
  6. desfazer o último ponto.

  Os outros botões dizem "sem uso".
- **Fechar a peça:**
  - os trechos que tocam um ponto de curva viram curva (Catmull-Rom, passando pelos pontos), e os de canto ficam
    retos;
  - os piques ficam nos seus pontos, presos à aresta certa;
  - o fio é o tocado; sem ele, fica horizontal pelo meio da peça;
  - a peça precisa de 3 pontos que não estejam numa linha só.

**2. A porta serial** (Web Serial do Electron):
- **Ligar:** "Ligar a mesa (porta serial)…" pede a porta. O processo principal recebe a lista das portas deste
  computador (`select-serial-port`) e a manda para a janela, que mostra cada uma ("Usar COM3…") e "Cancelar". A
  escolha volta por `porta-serial-escolhida`.
- **Ajustes:** a porta abre na velocidade e no formato escolhidos (1200 a 38400 bps; 8N1, 7O1, 7E1 ou 7N2). A
  resolução, a ordem dos campos, a velocidade e o formato ficam lembrados neste computador.
- **A leitura:** cada linha que chega é um toque.
- **Desligar:** pelo botão, ou ao fechar a janela.

**3. O registro colado:** o texto que a mesa mandou, guardado por um programa de terminal, entra pelo "Colar o
registro da mesa" e passa pelo mesmo caminho dos toques ao vivo.

**4. A tela:** Produção › "Mesa digitalizadora", ao lado do "Molde da foto".
- **A janela mostra:**
  - a peça que está na mesa: os pontos, os de curva, os piques e o fio (x/2);
  - o recado do último toque;
  - as peças já feitas;
  - a tabela dos botões.
- **Cada peça fechada** entra no desenho depois das peças que já estão lá, como "Peça da mesa N", com os piques e o
  fio. Ela fica selecionada e enquadrada, e vai para o histórico.

## O que não foi feito

- **O teste numa mesa de verdade:** não há uma aqui. O caminho até a lista das portas foi conferido no programa, mas
  não a leitura de uma mesa ligada. A resolução, a ordem dos campos e o formato ficam na tela para acertar pelo
  manual, e o texto da janela pede para conferir as medidas da primeira peça.
- **Os formatos binários** de algumas mesas (os de 5 bytes): só o ASCII.
- **Botões diferentes por mesa:** a tabela dos botões é fixa.
- **Furos, linhas internas e marcas** tocados na mesa: só o contorno, os piques e o fio.

## Conferência

- `domain/mesaDigitalizadora.test.ts` (5 testes):
  - a leitura das linhas: separadores, hexa, botão no começo, o lixo;
  - a escala e os eixos;
  - um retângulo com pique e fio, a peça no zero e o pique na aresta certa, aceita por `criarMolde`;
  - os pontos de curva;
  - desfazer, o fio recomeçado, o botão sem uso e as peças que não fecham.
- `ui/PainelDaMesaDigitalizadora.test.tsx` (3 testes):
  - o registro colado vira duas peças de uma vez, com o pique e as linhas de lixo contadas;
  - a peça pela metade e os ajustes lembrados;
  - a lista das portas: escolher, cancelar, nenhuma.
- `ui/BarraDeFerramentas.test.tsx`: o botão novo no grupo "Definir moldes".
- `npx vitest run`: 185 arquivos, 3118 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 121 conferências, nenhuma falha.
  - **A porta:** "Ligar a mesa" fez o pedido de verdade ao programa. A lista das portas deste computador chegou à
    janela ("Nenhuma porta serial encontrada"), e Cancelar não ligou ("Nenhuma porta foi escolhida").
  - **O registro colado** de dois retângulos virou "Peça da mesa 1" e "Peça da mesa 2": 101,6 mm de largura (4000
    linhas a 1000 por polegada), a segunda com o pique.
