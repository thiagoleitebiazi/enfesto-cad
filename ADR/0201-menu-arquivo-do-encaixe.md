# ADR 0201 — O menu Arquivo do encaixe

O manual do encaixe da referência tem, em Arquivo e Editar: "Informações" (cliente, descrição, palavra chave, datas), "Unir", exportar "Arquivo metafile" e "Arquivo de dados (XML)", importar "Arquivo de corte ISO", "Colar vários", "Colar incrementar grade", e "Plottar" com proporção, espelhar e limites do tecido; na impressão, ajustar à largura ou ao comprimento.

**Decisão:**

- "Informações" no menu do projeto: cliente, descrição e palavras chave, com o autor e as datas. A busca da biblioteca passa a achar por elas.
- "Unir encaixes": as peças de outro projeto da biblioteca entram neste, onde couberem.
- "Exportar SVG ou XML". O SVG faz o papel do metafile: uma imagem vetorial que qualquer programa de desenho abre.
- "Importar ISO": o caminho com a ferramenta embaixo vira as peças, pelo mesmo reconhecimento do PLT.
- "Colar vários" e "Colar incrementando a grade", em Encaixe › Posicionar.
- "Plotar…" (Ctrl+P): fatores X e Y, espelhar, limites do tecido e observação.
- O PDF ganha ajustar à largura e ao comprimento da folha.

**Limites:** o formato .wmf/.emf não foi feito: SVG no lugar. O arquivo para enfestadeira (.aoc) não foi feito: o formato é fechado. O ISO importado só lê o básico da norma, e os furos em M43 ficam de fora. Nada disso foi testado numa máquina.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
