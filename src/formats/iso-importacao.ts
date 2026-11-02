const UNIDADES_POR_MM = 40;

/**
 * Importar arquivo de corte ISO (ADR 0201): o manual da referência lê de volta o G-code da mesa. O caminho com a
 * ferramenta embaixo é o desenho, e o que vem dele vira traços, para o reconhecimento de peças (ADR 0225). Os furos da
 * ferramenta T4 e de M43 voltam como furinhos na peça (ADR 0220); os comandos de fabricante ficam de fora.
 *
 * A ferramenta desce pelo Z (embaixo em Z0 ou menos). Muitas mesas não usam Z, e descem por um comando próprio: nesses arquivos, o
 * que anda em G1, G2 ou G3 é corte, e o G0 é andar por cima (ADR 0236). Lê também os arcos, as polegadas (G20), as coordenadas
 * relativas (G91) e os comentários depois de ponto e vírgula.
 */
const RAIO_DO_FURO_MM = 1;
/** O passo dos arcos (radianos). */
const PASSO_DO_ARCO = Math.PI / 36;
const MM_POR_POLEGADA = 25.4;

const semComentario = (bruta: string): string => bruta.replace(/\(.*?\)/g, '').replace(/;.*$/, '').trim().toUpperCase();

export function tracosDoIso(texto: string): string {
  const linhas = texto.split(/\r?\n/).map(semComentario);
  const usaZ = linhas.some((l) => /Z\s*-?\d*\.?\d/.test(l));
  const comandos: string[] = ['IN'];
  let x = 0;
  let y = 0;
  let embaixo = false;
  let ferramenta = 0;
  let movimento = 0;
  let escala = 1;
  let relativo = false;
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
  /** O arco de onde a ferramenta está até (`fimX`, `fimY`), pelo centro (`cx`, `cy`): os pontos, sem o primeiro. */
  const pontosDoArco = (fimX: number, fimY: number, cx: number, cy: number, horario: boolean): void => {
    const raio = Math.hypot(x - cx, y - cy);
    const inicio = Math.atan2(y - cy, x - cx);
    let volta = Math.atan2(fimY - cy, fimX - cx) - inicio;
    if (horario && volta >= -1e-9) volta -= 2 * Math.PI;
    if (!horario && volta <= 1e-9) volta += 2 * Math.PI;
    const partes = Math.max(2, Math.ceil(Math.abs(volta) / PASSO_DO_ARCO));
    for (let k = 1; k < partes; k++) {
      x = cx + raio * Math.cos(inicio + (volta * k) / partes);
      y = cy + raio * Math.sin(inicio + (volta * k) / partes);
      if (embaixo) traco.push(emUnidades());
    }
  };
  for (const linha of linhas) {
    if (linha === '' || linha === '%') continue;
    const valor = (letra: string): number | null => {
      const achado = new RegExp(`${letra}\\s*(-?\\d*\\.?\\d+)`).exec(linha);
      return achado ? Number(achado[1]) : null;
    };
    for (const achado of linha.matchAll(/G\s*0*(\d+)/g)) {
      const g = Number(achado[1]);
      if (g <= 3) movimento = g;
      else if (g === 20) escala = MM_POR_POLEGADA;
      else if (g === 21) escala = 1;
      else if (g === 90) relativo = false;
      else if (g === 91) relativo = true;
    }
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
      const fimX = novoX === null ? x : relativo ? x + novoX * escala : novoX * escala;
      const fimY = novoY === null ? y : relativo ? y + novoY * escala : novoY * escala;
      if (!usaZ) {
        const cortando = movimento > 0;
        if (cortando && !embaixo) traco = [emUnidades()];
        if (!cortando && embaixo) fechar();
        embaixo = cortando;
      }
      if (movimento >= 2) pontosDoArco(fimX, fimY, x + (valor('I') ?? 0) * escala, y + (valor('J') ?? 0) * escala, movimento === 2);
      x = fimX;
      y = fimY;
      if (embaixo) traco.push(emUnidades());
    }
    if (/\bM43\b/.test(linha)) furo();
  }
  fechar();
  return `${comandos.join(';')};`;
}
