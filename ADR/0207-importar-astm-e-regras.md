# ADR 0207 — Importar ASTM e as regras de graduação

Os formatos próprios de outros sistemas (Lectra, Gerber, Investrônica, MDL, VET, IBA) não têm especificação pública nem leitor aberto. A pesquisa confirmou isso. O que todos eles exportam é o DXF ASTM D6673 / AAMA, que é a porta de troca do setor. Aqui, a importação de DXF só reconhecia isso por heurística, e não trazia os tamanhos.

**Decisão:**

- Um arquivo com blocos "Piece Name:" é lido como ASTM, nos dois jeitos que existem. Com um bloco por tamanho, os blocos da mesma peça viram uma peça só, e a regra de cada ponto sai da diferença entre o tamanho e a base. Com a base e os "# n", o programa pede o .RUL e lê as regras dele.
- Vêm junto o contorno (mesmo em vários pedaços), as linhas internas, os recortes, os furos, os piques, o fio, o espelho, a quantidade, a categoria e o tecido. As polegadas viram milímetros.
- Na exportação, "ASTM com regras" grava o tamanho base em DXF e a tabela .RUL. O ASTM de sempre passa a dizer o tamanho base e as unidades.

**Conferência com arquivos reais:** usei três arquivos públicos de testes de um leitor aberto de ASTM: dois de um sistema comercial (AAMA e ASTM, 3 peças em 14 tamanhos cada) e um de um sistema 3D (9 peças). As peças, as medidas e os piques vieram, e a graduação cresce de tamanho em tamanho: de 442 × 354 mm no menor a 667 × 453 mm no maior, numa peça. Esses arquivos não entram no repositório.

**Limites:** o par base e .RUL só foi testado com o que este programa escreve, porque não achei um par real público; a sintaxe vem de um guia público da norma. Exportar para outro sistema não foi testado: ninguém abriu aqui o que sai. Os pontos internos graduam na proporção. Quem está num sistema de formato fechado precisa exportar em ASTM/AAMA lá: abrir o arquivo fechado direto continua impossível.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
