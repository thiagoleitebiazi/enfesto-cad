# ADR 0218 — Saídas e cálculos que não faziam o que deviam

Relendo os limites dos ADRs 0180 a 0214, alguns eram erros de funcionamento, não escolhas.

- **Peça fora da mesa:** ela saía no PLT, no ISO, no SVG e no PDF do encaixe, em papel que não existe. Agora não sai, e o programa diz quantas ficaram de fora.
- **Conferir ao plotar:** a pergunta das peças sobrepostas só valia no arquivo. Agora vale também na pasta do plotter e na porta de saída.
- **Blocos na vertical com o tecido dobrado:** a mesa de lado é aberta, e as peças perdiam a dobra sem aviso. Agora a opção fica desligada na janela, e, por outro caminho, os blocos seguem na horizontal.
- **Peça espelhada:** agora ela lembra que foi espelhada. "Voltar ao original" desfaz o espelho, e "Substituir tamanho" o mantém. A cópia espelhada de um par continua espelhada.
- **Texto em traços:** tem os acentos do português e a cedilha.
- **Margem de segurança no plano:** o risco era calculado na largura toda do tecido, e os 4 mm não existiam. Agora o plano deixa a margem nos dois lados; na dobra, só no lado de fora.
- **Teclado virtual:** ganhou os acentos, Tab e Enter.

**Limites:** "voltar ao original" desfaz o giro antes do espelho: a peça girada 90° à mão e só depois espelhada pode voltar virada. O plano de um risco já guardado não muda: vale para os próximos cálculos.

Conferência: testes unitários, `npx eslint`, `npx tsc -b --noEmit` e `npm run validar`.
