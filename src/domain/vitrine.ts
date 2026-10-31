/**
 * A vitrine da coleção (ADR 0213): uma página só, sem servidor, para pôr no ar onde quiser ou mandar a quem compra. Traz
 * os produtos, os looks, o filtro por categoria e o "qual é o meu tamanho", que roda na própria página. Não é uma loja:
 * não tem carrinho nem pagamento.
 */

export interface ProdutoDaVitrine {
  readonly id: string;
  readonly nome: string;
  readonly referencia: string;
  readonly categoria: string;
  readonly cores: readonly string[];
  readonly tecido: string;
  readonly croquiSvg: string | null;
  readonly tamanhos: readonly string[];
  readonly medidas: readonly { readonly nome: string; readonly valoresCm: Readonly<Record<string, number>> }[];
}

export interface LookDaVitrine {
  readonly nome: string;
  readonly produtoIds: readonly string[];
}

/** Quanto a peça sobra em volta do corpo, para contar como "veste". */
export const FOLGA_DA_VITRINE_CM = 2;

/**
 * O primeiro tamanho em que cada medida informada cabe. Esta função vai escrita dentro da página: não pode usar nada de
 * fora dela.
 */
export function tamanhoDaVitrine(tamanhos: readonly string[], medidas: readonly { readonly valoresCm: Readonly<Record<string, number>> }[], corpoCm: readonly number[], folgaCm: number): string | null {
  for (const tamanho of tamanhos) {
    let serve = true;
    for (let i = 0; i < medidas.length; i++) {
      const corpo = corpoCm[i] ?? 0;
      const peca = medidas[i]?.valoresCm[tamanho];
      if (corpo > 0 && (peca === undefined || peca < corpo + folgaCm)) serve = false;
    }
    if (serve) return tamanho;
  }
  return null;
}

const escapar = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cartao(p: ProdutoDaVitrine): string {
  const medir = p.medidas.map((m, i) => `<label>${escapar(m.nome)} (cm)<input type="number" min="0" step="0.5" data-medida="${i}"></label>`).join('');
  return `<article class="produto" data-categoria="${escapar(p.categoria)}" data-produto="${escapar(p.id)}">
<div class="croqui">${p.croquiSvg ?? '<span class="sem">sem imagem</span>'}</div>
<h3>${escapar(p.nome)}</h3>
<p class="ref">${escapar(p.referencia)}${p.tecido ? ` · ${escapar(p.tecido)}` : ''}</p>
${p.cores.length > 0 ? `<p>Cores: ${p.cores.map(escapar).join(', ')}</p>` : ''}
${p.tamanhos.length > 0 ? `<p>Tamanhos: ${p.tamanhos.map(escapar).join(', ')}</p>` : ''}
${p.medidas.length > 0 ? `<details><summary>Qual é o meu tamanho?</summary>${medir}<button type="button" data-ver>Ver o tamanho</button><p class="resposta" role="status"></p></details>` : ''}
</article>`;
}

const ESTILO = `:root{color-scheme:light dark;--fundo:#f7f7f8;--cartao:#fff;--texto:#1f2937;--suave:#6b7280;--marca:#0f766e}
@media (prefers-color-scheme:dark){:root{--fundo:#111418;--cartao:#1c2127;--texto:#e5e7eb;--suave:#9ca3af;--marca:#2dd4bf}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font-family:system-ui,sans-serif}
header{padding:32px 16px 8px;max-width:1160px;margin:auto}h1{margin:0 0 12px}main{padding:8px 16px 40px;max-width:1160px;margin:auto}
.filtros{display:flex;flex-wrap:wrap;gap:8px}.filtros button,[data-ver]{padding:8px 14px;border:1px solid var(--marca);border-radius:999px;background:none;color:var(--marca);font:inherit;cursor:pointer}
.filtros button[aria-pressed=true]{background:var(--marca);color:var(--cartao)}
.produtos{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:16px}
.produto{padding:12px;border-radius:10px;background:var(--cartao)}.produto[hidden]{display:none}.produto h3{margin:8px 0 2px}.produto p{margin:4px 0}.ref{color:var(--suave);font-size:14px}
.croqui{display:flex;align-items:center;justify-content:center;min-height:200px}.croqui svg{max-width:100%;height:auto}.sem{color:var(--suave)}
details label{display:block;margin:8px 0;font-size:14px}details input{display:block;width:100%;padding:6px;font:inherit}.resposta{font-weight:600}
.looks{display:flex;flex-wrap:wrap;gap:16px}.look{padding:12px 16px;border-radius:10px;background:var(--cartao)}.look h3{margin:0 0 4px}.look p{margin:0;color:var(--suave)}`;

export function htmlDaVitrine(colecao: string, produtos: readonly ProdutoDaVitrine[], looks: readonly LookDaVitrine[]): string {
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter((c) => c !== ''))];
  const nomeDe = (id: string): string => produtos.find((p) => p.id === id)?.nome ?? '';
  const dados = JSON.stringify(Object.fromEntries(produtos.map((p) => [p.id, { tamanhos: p.tamanhos, medidas: p.medidas }]))).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(colecao)}</title>
<style>${ESTILO}</style>
</head><body>
<header><h1>${escapar(colecao)}</h1>
${categorias.length > 1 ? `<div class="filtros"><button type="button" data-filtro="" aria-pressed="true">Todos</button>${categorias.map((c) => `<button type="button" data-filtro="${escapar(c)}" aria-pressed="false">${escapar(c)}</button>`).join('')}</div>` : ''}
</header>
<main>
<section class="produtos">
${produtos.map(cartao).join('\n')}
</section>
${looks.length > 0 ? `<h2>Looks</h2><section class="looks">${looks.map((l) => `<article class="look"><h3>${escapar(l.nome)}</h3><p>${l.produtoIds.map(nomeDe).map(escapar).join(' + ')}</p></article>`).join('')}</section>` : ''}
</main>
<script>
const DADOS = ${dados};
const FOLGA = ${FOLGA_DA_VITRINE_CM};
const tamanhoDaVitrine = ${tamanhoDaVitrine.toString()};
document.querySelectorAll('[data-filtro]').forEach((botao) => botao.addEventListener('click', () => {
  document.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
  document.querySelectorAll('[data-categoria]').forEach((p) => { p.hidden = botao.dataset.filtro !== '' && p.dataset.categoria !== botao.dataset.filtro; });
}));
document.querySelectorAll('[data-ver]').forEach((botao) => botao.addEventListener('click', () => {
  const produto = botao.closest('[data-produto]');
  const dados = DADOS[produto.dataset.produto];
  const corpo = dados.medidas.map((_, i) => Number(produto.querySelector('[data-medida="' + i + '"]').value) || 0);
  const resposta = produto.querySelector('.resposta');
  if (!corpo.some((c) => c > 0)) { resposta.textContent = 'Escreva ao menos uma medida.'; return; }
  const tamanho = tamanhoDaVitrine(dados.tamanhos, dados.medidas, corpo, FOLGA);
  resposta.textContent = tamanho ? 'Tamanho sugerido: ' + tamanho : 'Nenhum tamanho veste estas medidas.';
}));
</script>
</body></html>
`;
}
