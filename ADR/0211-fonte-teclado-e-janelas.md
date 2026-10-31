# ADR 0211 — A fonte TrueType, o teclado virtual e as janelas

O manual da referência tem a fonte dos textos do plotter, o teclado na tela (Ctrl+F1) e o arranjo das janelas (nova, em cascata, lado a lado).

**Decisão:**

- **Fonte TrueType** (menu Opções): o usuário escolhe um .ttf ou .otf. No PLT, o contorno de cada letra vira linhas, com acento, e as maiúsculas ficam na altura pedida. No PDF, a fonte vai embutida e todos os textos saem nela. O caminho fica em `fonte-do-plotter.json`, no processo principal; a interface nunca dá um caminho. A leitura é da fontkit, que já vinha com o pdfkit e passa a ser dependência direta, na mesma versão.
- **Teclado virtual** (menu Visão ou Ctrl+F1): fica por cima de tudo, e as teclas não tiram o foco do campo. Serve para a mesa sem teclado.
- **Janelas** (menu Visão): "Nova janela" abre outra janela do programa; "Janelas em cascata" e "Janelas lado a lado" arrumam as visíveis.

**Limites:**

- A fonte só vale no plotter e no PDF: a tela segue com a dela. A letra sai em contorno, não preenchida.
- A fonte foi testada com a Arial do Windows, nas letras e no PDF, mas não num plotter.
- O teclado não tem acentos: só o ç. Ele não tem Enter nem Tab.
- As janelas dividem os mesmos projetos gravados: abrir o mesmo projeto em duas e salvar nas duas deixa valer a última gravação. A recuperação da tela preta (ADR 0083) acompanha só a última janela aberta.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
