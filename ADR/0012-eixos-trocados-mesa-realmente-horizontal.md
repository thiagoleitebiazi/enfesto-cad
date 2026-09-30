# ADR 0012 — Eixos trocados na tela: a mesa finalmente fica horizontal de verdade

## Contexto

Terceira vez que "a área de trabalho deve ser retangular na horizontal"
volta como reclamação, depois de duas tentativas anteriores que corrigiram
sintomas reais, mas não a causa:

- ADR 0009: o `<canvas>` ficava preso em ~800×600px por um bug de CSS Grid
  (tamanho intrínseco do canvas ignorando `1fr`). Corrigido.
- ADR 0010: mesmo com o container do tamanho certo, nada desenhava um
  retângulo representando a mesa — só réguas com números. Corrigido
  desenhando o retângulo real do enfesto.
- Usuário mandou um screenshot real do app rodando e apontou: mesmo com a
  mesa visível, ela continuava alta/estreita (em pé), não larga/baixa
  (deitada).

## Causa raiz real

`domain/enfesto.ts` define a mesa em X=`larguraUtilMm` (largura do
tecido, geralmente a medida MENOR) e Y=`comprimentoMm` (comprimento do
enfesto — quantos metros de tecido são desenfestados, geralmente a medida
MAIOR, ex.: 1500×3000mm por padrão). `ui/transformacaoDeTela.ts` mapeava
`mundo.x → tela.x` e `mundo.y → tela.y` sem nenhuma troca — ou seja,
a medida MENOR (largura) sempre virava a largura da TELA, e a medida
MAIOR (comprimento) sempre virava a altura da TELA. Resultado: não
importa o quão mais larga a mesa real seja em metros de comprimento, ela
sempre desenhava mais ALTA que larga no canvas — o oposto exato do que
"retangular na horizontal" pede. As duas correções anteriores (ADR 0009 e
0010) eliminaram bugs reais, mas nenhuma delas tocava esse mapeamento de
eixos — por isso o sintoma voltava.

Numa mesa de corte real, o operador vê o comprimento (o sentido em que
anda, desenfestando o tecido) como a horizontal, e a largura do tecido
como a vertical (mais estreita). O domínio (nesting, nível de peça,
`core/geometria.ts`) está correto e não muda — a convenção X=largura/
Y=comprimento já é usada consistentemente por `domain/nesting.ts`,
`domain/posicionamento.ts`, `domain/molde.ts`, os testes, etc. O problema
era só na camada de apresentação.

## Decisão

Trocar os eixos exclusivamente em `ui/transformacaoDeTela.ts`
(`mundoParaTela`/`telaParaMundo`), o único par de funções por onde TODA
renderização e TODO clique do canvas já passavam (mesa, peças, réguas,
piques, marcas, linha de fio, contorno em edição, cursor). Por ser um
único ponto central, a troca propaga automaticamente e de forma
consistente para tudo que usa o canvas, sem precisar tocar
`AreaDeDesenho.tsx` peça por peça nem qualquer código de domínio — testado
explicitamente (`domain/nesting.test.ts` etc. inalterados, 0 mudanças,
continuam verdes).

```ts
// mundo.y (comprimento) → tela.x (horizontal); mundo.x (largura) → tela.y (vertical)
export function mundoParaTela(p, t) {
  return { x: t.offsetXPx + p.y * t.escalaPxPorMm, y: t.offsetYPx + p.x * t.escalaPxPorMm };
}
```

Os três lugares em `App.tsx` que calculam a escala de enquadramento
(`ajustarTela`, o autoenquadramento de `criarNovoProjetoComDados`, e o
novo `transformParaEnquadrarMesa` — ver abaixo) precisaram inverter qual
medida (largura/comprimento) é dividida pela largura ou altura disponível
em pixels, para combinar com a troca.

### Mesa visível desde o primeiro lançamento, não só depois de "Novo projeto"

O screenshot que motivou esta investigação mostrava o app recém-aberto
(sem ter passado por "Novo projeto"), com "Enfesto: não configurado" —
por isso nenhuma mesa aparecia, só as 2 peças de demonstração soltas num
fundo cinza. Isso reforçava a impressão de "não parece nem um pouco com
o Audaces" (que sempre mostra uma mesa/marcador ativo). Adicionado
`enfestoDeDemonstracao()`/`tecidoDeDemonstracao()` (mesmos parâmetros
padrão do diálogo "Novo projeto": 1500×3000mm, tipo Ímpar, sem margens) e
`transformParaEnquadrarMesa()` como estado inicial de `enfesto`/`tecido`/
`transform`, para a mesa real e horizontal aparecer imediatamente ao
abrir o app, sem exigir nenhum clique antes. `projetoAtual` inicial
também passou a incluir esse enfesto/tecido de demonstração (antes
usava `null`/`null`), então o projeto "demo" que aparece ao abrir o app
agora é um projeto coerente de verdade, não um estado parcialmente vazio.

## Verificação (Electron real, build de produção)

1. **Screenshot do app recém-aberto** (sem nenhum clique): mesa branca
   visível, régua horizontal cobrindo a faixa de comprimento (maior),
   régua vertical cobrindo a faixa de largura (menor) — retângulo
   claramente deitado.
2. **Teste de desenho**: uma peça desenhada com 200px de largura × 40px
   de altura NA TELA (proporção 5:1 horizontal) virou uma peça de
   153.8mm × 769.2mm NO DOMÍNIO (mesma proporção ~5:1, mas agora no eixo
   comprimento) — confirma que clique→mm e mm→tela continuam inversos
   corretos depois da troca, não só a mesa.
3. Suíte completa: 215/215 testes (1 novo, fixando a troca de eixos
   explicitamente em `transformacaoDeTela.test.ts`), typecheck/lint/build
   limpos.

## Consequências

- Nenhuma mudança em código de domínio (`domain/*`, `core/*`) — a
  convenção de coordenadas do motor de nesting, validação, exportação
  DXF/PDF continua exatamente a mesma; só a apresentação no canvas mudou.
- Projetos salvos antes desta mudança continuam abrindo corretamente — o
  JSON persistido guarda `larguraUtilMm`/`comprimentoMm` (dados de
  domínio), nunca coordenadas de tela; a troca é recalculada em tempo de
  exibição.
- Risco relacionado, não deste ADR: o cálculo de auto-enquadramento
  (`ajustarTela`, `transformParaEnquadrarMesa`) ainda assume uma área de
  canvas fixa de 900×600px em vez de medir o tamanho real do container —
  por isso a mesa pode aparecer cortada à direita em janelas maiores até
  o usuário clicar "Ajustar". Isso já existia antes desta mudança (mesma
  aproximação usada desde o ADR 0010) e não é uma regressão desta troca de
  eixos — mas vale registrar como possível próximo ajuste, não feito aqui
  para não expandir o escopo de uma correção de causa raiz.
