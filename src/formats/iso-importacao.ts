const UNIDADES_POR_MM = 40;

/**
 * Importar arquivo de corte ISO (ADR 0201): o manual da referência lê de volta o G-code da mesa. O caminho com a
 * ferramenta embaixo é o desenho, e o que vem dele vira HPGL, para seguir o mesmo reconhecimento de peças do PLT. Só o
 * básico da norma: G0, G1, X, Y, Z (embaixo em Z0 ou menos); os furos em M43 e os comandos de fabricante ficam de fora.
 */
export function hpglDoIso(texto: string): string {
  const comandos: string[] = ['IN'];
  let x = 0;
  let y = 0;
  let embaixo = false;
  let traco: string[] = [];
  const emUnidades = (): string => `${Math.round(x * UNIDADES_POR_MM)},${Math.round(y * UNIDADES_POR_MM)}`;
  const fechar = (): void => {
    if (traco.length >= 2) comandos.push(`PU${traco[0]}`, `PD${traco.slice(1).join(',')}`);
    traco = [];
  };
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\(.*?\)/g, '').trim().toUpperCase();
    if (linha === '' || linha === '%') continue;
    const valor = (letra: string): number | null => {
      const achado = new RegExp(`${letra}\\s*(-?\\d+(?:\\.\\d+)?)`).exec(linha);
      return achado ? Number(achado[1]) : null;
    };
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
  }
  fechar();
  return `${comandos.join(';')};`;
}
