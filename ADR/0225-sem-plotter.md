# ADR 0225 — O programa sem o plotter

O dono do projeto pediu para tirar todas as funcionalidades ligadas ao plotter.

**Saiu:**

- Exportar PLT, "PLT por partes" e "Plotar moldes"; a janela Plotar e o Ctrl+P;
- a pasta do plotter e o "Enviar ao plotter";
- canetas, níveis de impressão, ferramentas do plotter, texto como linha e auto ajuste de texto;
- a opção "verificar ao plotar", a altura do nome da peça no plotter e as cores pelas ferramentas;
- importar PLT e DMPL, e "Receber de outro programa" (ouvia na porta e guardava o que vinha);
- a página de teste do plotter, a correção pelas medidas e o retângulo de organização, que era a guia do papel.

**Ficou, porque não depende do plotter:**

- a mesa de corte: o ISO, a porta de saída, a fila e o teste, com "plotter" tirado dos textos. O gerenciador de impressão se chama agora "Fila da mesa de corte";
- a leitura do ISO. Ela passava pelo leitor de PLT, que virou `tracos-importacao.ts`, só por dentro: nenhum arquivo PLT entra mais. Esse leitor ainda entende comandos que o ISO não produz, como texto e movimento relativo, e isso ficou como estava;
- a fonte TrueType e o estilo da costura, agora só no PDF. A fonte não vira mais traços: a fontkit só confere o arquivo, e o pdfkit embute;
- "Organizar moldes", agora na largura da mesa.

**Projetos antigos:** continuam abrindo. Peças importadas de PLT mantêm a origem `plt`, e campos que não existem mais são ignorados. As peças vindas de ISO agora dizem `iso`.

**Limites:** a correção da máquina saiu junto com o plotter, então o ISO sai na medida do arquivo; se uma mesa de corte precisar de ajuste, é o que a própria mesa oferece. Os ADRs antigos ficam como história: ainda falam do plotter porque descrevem o que foi feito naquele momento.

**Validação:** o laboratório agora usa uma mesa de corte virtual e confere o envio, a falha e a volta, as portas inválidas e o teste da mesa pelo ISO. As etapas de níveis, envio de PLT e receptor saíram com o que testavam.
