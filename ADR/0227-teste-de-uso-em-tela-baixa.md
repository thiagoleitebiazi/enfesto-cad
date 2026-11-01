# ADR 0227 — O teste de uso em tela baixa

O teste de uso acusou três falhas no Mac do GitHub. Nenhuma era defeito do programa.

- **A vista e o Desfazer dela:** o clique no contorno caiu em y = 597, e a área de desenho terminava em 595: foi na barra de baixo, 2 pixels fora. A janela não chega ao tamanho que o teste pede quando a tela é baixa, e a faixa de instrução da ferramenta ainda empurra o desenho. Com "Ajustar à tela" antes de clicar, as duas etapas passaram no Windows.
- **A imagem das três vistas:** o arquivo foi gravado, mas depois dos 2,5 segundos fixos do teste. Sem placa de vídeo, demora mais. O teste agora espera o arquivo aparecer.

**No CI:** o teste de uso ganhou mais tempo (12 minutos). A abertura da parte Intel pelo Rosetta passou a ter prazo de 120 segundos, para separar "lento" de "não desenha".

**Limites:** o Rosetta numa máquina sem placa de vídeo não é um Mac Intel de verdade; o resultado dele serve de indício, não de prova.
