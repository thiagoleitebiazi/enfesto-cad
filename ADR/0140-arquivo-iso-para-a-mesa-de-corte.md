# ADR 0140 — O arquivo ISO para a mesa de corte automático

## Contexto

A referência manda o encaixe para as suas mesas de corte automático. O estudo deixava isso de fora, porque não há
protocolo nem equipamento aqui. O Enfesto CAD já gerava o PDF 1:1, o DXF e o PLT para o plotter de papel, mas nenhum
arquivo que uma mesa de corte lê.

O usuário pediu para implementar tudo, inclusive o que depende de máquina, com o que der para fazer sem ela. As mesas
de corte de tecido costumam aceitar ISO (o G-code da norma ISO 6983), além dos formatos de cada fabricante.

## Decisão

**"Exportar ISO (corte)"** na aba Início, ao lado de "Exportar PLT", abre um diálogo:
- **o que ele mostra:** as peças e a largura da mesa (a do enfesto, quando há);
- **o que ele pede:**
  - a velocidade de corte, padrão 12 000 mm/min;
  - se a caneta risca as linhas internas e o fio.

O arquivo `encaixe.iso` (`formats/iso-exportacao.ts`, `gerarIso`):
- **As unidades:** milímetros (G21) e coordenadas absolutas (G90). O comprimento do encaixe vai no X e a largura no Y,
  como no PLT.
- **As ferramentas, pelo número:**
  - T1 é a faca: o contorno de corte e os furos;
  - T2 é o piqueteador: cada pique, na direção dele;
  - T3 é a caneta: as linhas internas e o fio, só quando pedido;
  - T4 é o furador: um golpe em cada marca.
- **A ordem:** as peças vão pelo comprimento, porque a mesa avança num sentido só. Em cada peça, o que fica dentro dela
  vem antes do contorno, na ordem caneta, furador, piqueteador e furos. Cortado o contorno, a peça se solta.
- **Os movimentos:** a ferramenta sobe (Z5) para andar (G0) e desce (Z0) para cortar (G1), na velocidade pedida.
- **O texto:** um comentário com o nome e o tamanho de cada peça, e o fim do programa (M30).
- **O registro:** depois de salvar, o histórico guarda as peças, os metros de corte e os piques (`resumoDoIso`).

## O que não foi feito

- **A mesa de verdade:** o arquivo não foi testado numa mesa de corte, e a dica do botão e o diálogo dizem isso.
- **Os dialetos de cada fabricante:** a faca tangencial no eixo C, os comandos próprios do piqueteador e a compensação
  da lâmina ficam para o pós-processador da mesa.
- **A ligação direta com a máquina** (rede, porta): não existe. O arquivo vai por pendrive ou pasta.

## Conferência

- `formats/iso-exportacao.test.ts` (4 testes):
  - o cabeçalho, as unidades e o fim, com as peças na ordem do comprimento;
  - o contorno, com a faca descendo, cortando e fechando no começo, nas coordenadas da mesa;
  - a ordem das ferramentas dentro de uma peça, com e sem a caneta;
  - o resumo de corte.
- `ui/BarraDeFerramentas.test.tsx`: o botão novo no grupo de importação e exportação chama a sua ação.
- `npx vitest run`: 177 arquivos, 3078 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 115 conferências, nenhuma falha.
  - **A nova:** o diálogo com a velocidade 9000 e a caneta grava `encaixe.iso` com G21, G90 e M30, as 3 peças, a caneta
    antes da faca em cada peça, e o F9000. Depois de salvar, o diálogo fecha.
  - **A tela de início** mostra o botão novo.
