/**
 * Uma conta digitada no campo de medida (ADR 0163): "45/2+1", "(80-4)/4", "3x12". Soma, subtração, multiplicação (* ou
 * x), divisão e parênteses, com vírgula ou ponto decimal. `null` se não for uma conta.
 */
export function calcularConta(texto: string): number | null {
  // Dois números só com um espaço no meio não são uma conta.
  if (/[\d.,]\s+[\d.,]/.test(texto)) return null;
  const t = texto.replace(/\s/g, '').replace(/,/g, '.').replace(/[xX×]/g, '*').replace(/÷/g, '/');
  let i = 0;
  const numero = (): number | null => {
    const m = /^\d*\.?\d+|^\d+\./.exec(t.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const fator = (): number | null => {
    if (t[i] === '-' || t[i] === '+') {
      const sinal = t[i] === '-' ? -1 : 1;
      i++;
      const v = fator();
      return v === null ? null : sinal * v;
    }
    if (t[i] === '(') {
      i++;
      const v = soma();
      if (v === null || t[i] !== ')') return null;
      i++;
      return v;
    }
    return numero();
  };
  const produto = (): number | null => {
    let v = fator();
    while (v !== null && (t[i] === '*' || t[i] === '/')) {
      const op = t[i++];
      const d = fator();
      if (d === null) return null;
      v = op === '*' ? v * d : v / d;
    }
    return v;
  };
  function soma(): number | null {
    let v = produto();
    while (v !== null && (t[i] === '+' || t[i] === '-')) {
      const op = t[i++];
      const d = produto();
      if (d === null) return null;
      v = op === '+' ? v + d : v - d;
    }
    return v;
  }
  const r = soma();
  return r !== null && i === t.length && Number.isFinite(r) ? r : null;
}

/** Número (ou conta) digitado com vírgula ou ponto decimal; campo vazio vale 0. `null` se não for um número. */
export function lerMedida(texto: string): number | null {
  if (texto.trim() === '') return 0;
  return calcularConta(texto);
}

/** Medida em mm para os diálogos, com vírgula decimal: "12,5 mm". */
export function formatarMm(valor: number, casas = 1): string {
  return `${valor.toFixed(casas).replace('.', ',')} mm`;
}

/** O número do texto (vírgula ou ponto); `null` vazio; `NaN` se não for número. */
export function numeroDoTexto(texto: string): number | null {
  if (texto.trim() === '') return null;
  return calcularConta(texto.replace(/\s/g, '')) ?? Number.NaN;
}
