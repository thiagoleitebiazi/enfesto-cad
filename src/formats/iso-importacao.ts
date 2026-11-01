const UNIDADES_POR_MM = 40;

/**
 * Importar arquivo de corte ISO (ADR 0201): o manual da referência lê de volta o G-code da mesa. O caminho com a
 * ferramenta embaixo é o desenho, e o que vem dele vira traços, para o reconhecimento de peças (ADR 0225). Só o
 * básico da norma: G0, G1, X, Y, Z (embaixo em Z0 ou menos). Os furos da ferramenta T4 e de M43 voltam como furinhos na
 * peça (ADR 0220); os comandos de fabricante ficam de fora.
 */
const RAIO_DO_FURO_MM = 1;

export function tracosDoIso(texto: string): string {
  const comandos: string[] = ['IN'];
  let x = 0;
  let y = 0;
  let embaixo = false;
  let ferramenta = 0;
  let traco: string[] = [];
  const furo = (): void => {
    const [cx, cy, r] = [Math.round(x * UNIDADES_POR_MM), Math.round(y * UNIDADES_POR_MM), RAIO_DO_FURO_MM * UNIDADES_POR_MM];
    comandos.push(`PU${cx + r},${cy}`, `PD${cx},${cy + r},${cx - r},${cy},${cx},${cy - r},${cx + r},${cy}`);
  };
  const emUnidades = (): string => `${Math.round(x * UNIDADES_POR_MM)},${Math.round(y * UNIDADES_POR_MM)}`;
  const fechar = (): void => {
    if (traco.length >= 2) comandos.push(`PU${traco[0]}`, `PD${traco.slice(1).join(',')}`);
    else if (traco.length === 1 && ferramenta === 4) furo();
    traco = [];
  };
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\(.*?\)/g, '').trim().toUpperCase();
    if (linha === '' || linha === '%') continue;
    const valor = (letra: string): number | null => {
      const achado = new RegExp(`${letra}\\s*(-?\\d+(?:\\.\\d+)?)`).exec(linha);
      return achado ? Number(achado[1]) : null;
    };
    const trocaDeFerramenta = valor('T');
    if (trocaDeFerramenta !== null) ferramenta = trocaDeFerramenta;
    const z = valor('Z');
    const novoX = valor('X');
    const novoY = valor('Y');
    if (z !== null) {
      const agora = z <= 0;
      if (embaixo && !agora) fechar();
      if (!embaixo && agora) traco = [emUnidades()];
      embaixo = agora;
    }
    if (novoX !== null || novoY !== null) {
      x = novoX ?? x;
      y = novoY ?? y;
      if (embaixo) traco.push(emUnidades());
    }
    if (/\bM43\b/.test(linha)) furo();
  }
  fechar();
  return `${comandos.join(';')};`;
}
