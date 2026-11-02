# ADR 0236 — O ISO volta em pedaços, e de qualquer mesa

## Contexto

Importar um ISO podia terminar em "Nenhuma linha fechada no arquivo: não há peças para importar", num arquivo cheio de peças. O próprio programa gerava esse arquivo: com a faca tangencial, a faca sobe em cada canto para girar, e o contorno sai em pedaços abertos. O leitor só reconhecia uma linha fechada quando ela vinha inteira. O mesmo acontece com o arquivo de uma mesa que levanta a ferramenta nos cantos, ou que não usa o eixo Z.

## Decisão

Em `tracos-importacao.ts`, os traços abertos que, ponta com ponta, dão uma volta inteira viram uma linha fechada. As pontas contam como a mesma até 6 mm, porque a compensação da lâmina desloca o eixo a cada giro. A busca volta atrás: no canto de onde sai um pique, a primeira ponta perto pode não ser a do contorno. O que não entra numa volta continua sendo pique ou linha interna.

Se nada fecha, a linha que quase fecha (vão de até 10% do comprimento) é a peça.

Em `iso-importacao.ts`, sem Z no arquivo, o que anda em G1, G2 ou G3 é corte e o G0 é andar por cima. O leitor também passou a entender arcos (G2, G3), polegadas (G20), coordenadas relativas (G91), comentários depois de ponto e vírgula e números como `.5`.

O aviso antigo saiu. Só um arquivo sem desenho nenhum ainda avisa, com outro texto, "Este arquivo não traz o desenho de nenhuma peça: nada foi importado": importar sem dizer nada pareceria que o botão não funcionou.

## O que não foi feito

- Não há ISO de uma mesa real aqui: os outros formatos foram conferidos com arquivos escritos à mão, pela norma.
- Com a compensação da lâmina, o contorno volta deslocado até o tamanho dela, porque o arquivo não diz qual era.
