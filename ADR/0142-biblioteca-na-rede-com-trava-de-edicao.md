# ADR 0142 — A biblioteca na rede, com a trava de quem está editando

## Contexto

A referência guarda os modelos na nuvem para a equipe inteira trabalhar junto. Cada pessoa vê o que as outras fizeram,
sem duas pessoas mudarem o mesmo modelo ao mesmo tempo. O estudo deixava isso de fora, porque exige servidor.

No Enfesto CAD, cada computador tinha só a sua biblioteca, em `<userData>/projetos`. Para passar um modelo a outra
estação, era preciso exportar e importar à mão.

O usuário pediu para implementar tudo. Sem servidor, o que dá para fazer é usar uma pasta da rede que todas as estações
enxergam. A base para isso veio no ADR 0141: o processo principal lê e grava só dentro da pasta escolhida.

## Decisão

**1. A pasta** (tipo `biblioteca`) tem duas subpastas:
- `projetos`: um arquivo por modelo, `<id>.json`;
- `travas`: a trava de quem está editando, `<id>.trava.json`, com o nome da pessoa, a hora e o nome do modelo.

**2. As regras** (`domain/bibliotecaNaRede.ts`):
- **Publicar** põe na rede um modelo que ainda não está lá. O que já está só muda por "pegar para editar" e
  "devolver".
- **Pegar para editar** cria a trava *só se ela ainda não existe*: quem chega primeiro fica com ela.
  - **Se a trava é de outra pessoa,** a mensagem diz quem está editando e desde quando.
  - **Se a trava já é de quem pede,** pegar de novo não atrapalha.
  - **A cópia da rede** vai para a biblioteca deste computador, a não ser que a deste computador seja igual ou mais
    nova.
- **Devolver** grava o modelo na rede e tira a trava. Só quem está com a trava pode devolver.
- **Liberar sem devolver** tira a própria trava a qualquer hora. A trava de outra pessoa só pode ser tirada depois de
  12 horas, quando a pessoa esqueceu de devolver.
- **Trazer uma cópia** traz a versão da rede para ver, mesmo com o modelo travado. Nunca troca uma cópia local mais
  nova.
- **O nome da pessoa** não é conta nem senha: o programa não tem login. O nome é escrito na tela e lembrado neste
  computador.

**3. A tela:** uma seção "Biblioteca na rede" no fim da Biblioteca de trabalhos.
- **Os controles:**
  - escolher, trocar ou deixar de usar a pasta;
  - atualizar a lista;
  - "Seu nome".
- **A tabela dos modelos na rede.** Para cada modelo, ela mostra:
  - a última mudança;
  - a comparação com a cópia deste computador: só na rede, igual, a da rede mais nova ou a deste mais nova;
  - quem está editando;
  - as ações que valem.
- **As cores:** a linha travada por outra pessoa fica em âmbar e a que está com você, em verde.
- **Publicar:** uma lista dos modelos deste computador que ainda não estão na rede.
- **Trazer o projeto aberto** atualiza a tela e mantém a Biblioteca aberta. Se ele tem mudanças não salvas, a cópia não
  é trazida e a mensagem pede para salvar antes.

## O que não foi feito

- **A edição ao mesmo tempo no mesmo modelo** (a colaboração simultânea): a trava deixa uma pessoa de cada vez.
- **Os avisos para os outros** (e-mail, celular): ninguém é avisado quando um modelo é devolvido. A lista mostra ao
  atualizar.
- **O controle de quem pode o quê:** fica com as permissões da própria pasta da rede.

## Conferência

- `domain/bibliotecaNaRede.test.ts` (6 testes):
  - a trava lida, vencida e descrita;
  - a situação da cópia;
  - publicar, ler a lista com travas e avisos, e não publicar duas vezes;
  - pegar para editar com duas pessoas;
  - devolver;
  - liberar a própria trava e a vencida.
- `ui/BibliotecaNaRede.test.tsx` (3 testes):
  - publicar, pegar sem nome e com nome, e devolver, com o nome lembrado;
  - o modelo travado por outra pessoa;
  - a cópia local mais nova.
- `npx vitest run`: 181 arquivos, 3103 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 118 conferências, nenhuma falha.
  - **As duas novas:**
    - publicar o projeto aberto, pegar para editar (a trava com "Teste de uso", a linha verde "Com você") e devolver
      (a trava sai);
    - uma trava de "Maria" posta na pasta aparece, depois de Atualizar, na linha âmbar "Em edição por Maria desde…",
      que só oferece "Trazer uma cópia".
  - **O problema que o teste de uso achou:** trazer o projeto aberto fechava a Biblioteca. Agora ela fica aberta, e
    pegar um modelo igual ao deste computador não o recarrega.
