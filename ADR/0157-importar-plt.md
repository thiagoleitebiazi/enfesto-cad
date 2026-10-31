# ADR 0157 — Importar PLT

O programa só escrevia PLT. Riscos antigos e de outros sistemas costumam estar nesse formato.

**Decisão:** Início › "Importar PLT" lê o HPGL (`formats/plt-importacao.ts`: IN, SP, PU, PD, PA, PR, DT, LB) e deduz as peças, porque o arquivo só tem traços e textos:
- a linha fechada que não está dentro de outra é uma peça, e o retângulo da mesa fica de fora;
- a linha fechada dentro dela é um furo; com mais de metade da área, é a costura, que fica de fora;
- o traço curto que sai do contorno é um pique;
- o traço reto mais comprido é o fio, e os outros são linhas internas;
- o texto dentro da peça é o nome.

**Limites conhecidos:** o fio é um palpite: confira. Uma peça retangular no canto do papel, com outra linha fechada dentro, seria tomada pela mesa. Não há graduação no PLT. Arquivos de outros sistemas não foram testados: o teste é a ida e volta com o PLT deste programa.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
