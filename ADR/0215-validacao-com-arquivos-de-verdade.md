# ADR 0215 — A validação com arquivos de verdade e as portas do Windows

Os ADRs 0207 e 0210 deixaram limites: o ASTM com poucas amostras, o DMPL sem nenhum arquivo de plotter e as portas LPT e COM sem execução. Boa parte disso dá para validar sem o equipamento, com o que outros programas produziram.

**O que foi feito:**

- **ASTM e AAMA:** os 34 arquivos públicos do projeto astm-parser, feitos por outros sistemas, foram lidos sem erro. Nos pares do mesmo modelo, o AAMA e o ASTM dão as mesmas peças, com diferença abaixo de 0,5 mm. Cada arquivo exportado e lido de novo mantém as medidas. Os arquivos ficam fora do repositório; `src/formats/corpusPublico.test.ts` roda com `CORPUS_PUBLICO` apontando para a pasta.
- **DMPL:** dois arquivos públicos de verdade mostraram um erro: o número de `L0`, `V5` e `BP` era lido como coordenada, e o desenho saía todo errado. Corrigido. Os arquivos reais cabem nas 16 × 11 polegadas do plotter a que se destinam, o que confirma a unidade do EC1 em 0,001 polegada. O EC5 e o ECN seguem sem confirmação: nenhum arquivo real os usa.
- **Portas LPT e COM:** o Windows só abre essas portas como algo que já existe, e o programa pedia para criar: o envio falharia em toda porta real. Corrigido. O envio foi testado num dispositivo do Windows que se comporta do mesmo jeito (um pipe), e a porta inexistente é dita pelo nome.

**Limites:** nenhuma porta COM ou LPT real foi aberta, nem o comando `mode` que dá a velocidade. Só o arquivo A232F4ORU001 pede um .RUL, e ele não é público: o par base e regras segue testado só com o que o programa mesmo gera.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`.
