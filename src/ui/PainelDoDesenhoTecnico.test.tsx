import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DESENHO_VAZIO, type CotaDoDesenho, type DesenhoTecnico, type TracoDoDesenho } from '../domain/desenhoTecnico';
import type { ImagemDoModelo } from '../domain/imagens';
import type { PontoDeMedida } from '../domain/fichaTecnica';
import { PainelDoDesenhoTecnico } from './PainelDoDesenhoTecnico';

const IMAGEM: ImagemDoModelo = {
  id: 'img1',
  nome: 'Estampa floral',
  dados: 'data:image/png;base64,iVBORw0KGgo=',
  larguraPx: 200,
  alturaPx: 100,
  origem: { x: 0, y: 0 },
  mmPorPx: 0.26,
  calibrada: false,
  opacidade: 1,
  visivel: true,
};

// A folha ocupa 400 × 500 px a partir de (0, 0): o ponto da tela é o ponto da folha.
const caixaOriginal = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return { left: 0, top: 0, width: 400, height: 500, right: 400, bottom: 500, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = caixaOriginal;
  cleanup();
});

function abrir(opcoes: { readonly desenho?: DesenhoTecnico; readonly somenteLeitura?: string | null; readonly medidas?: readonly PontoDeMedida[] } = {}) {
  const onGuardar = vi.fn();
  const onExportarSvg = vi.fn();
  let n = 0;
  render(
    <PainelDoDesenhoTecnico
      desenho={opcoes.desenho ?? DESENHO_VAZIO}
      somenteLeitura={opcoes.somenteLeitura ?? null}
      imagens={[IMAGEM]}
      medidas={opcoes.medidas ?? []}
      tamanhos={['P', 'M']}
      onGuardar={onGuardar}
      onExportarSvg={onExportarSvg}
      novoId={() => `d${++n}`}
      onFechar={() => {}}
    />,
  );
  const folha = screen.getByRole('img', { name: /^Folha do desenho/ });
  /** Um clique (apertar e soltar) num ponto da folha. */
  const clicar = (x: number, y: number): void => {
    fireEvent.pointerDown(folha, { clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: x, clientY: y, pointerId: 1 });
  };
  const ultimo = (): DesenhoTecnico => onGuardar.mock.calls.at(-1)![0] as DesenhoTecnico;
  return { onGuardar, onExportarSvg, folha, clicar, ultimo };
}

const ferramenta = (nome: string) => fireEvent.click(within(screen.getByRole('toolbar', { name: 'Ferramentas' })).getByRole('button', { name: nome }));

describe('PainelDoDesenhoTecnico', () => {
  it('pôr a base: o contorno da frente e das costas e os detalhes; guardado sozinho na ficha', async () => {
    const { onGuardar, ultimo } = abrir();
    fireEvent.change(screen.getByLabelText('Base técnica'), { target: { value: 'calca' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a base (frente e costas)' }));
    expect(screen.getByRole('tab', { name: 'Frente (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Costas (3)' })).toBeInTheDocument();
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultimo().elementos).toHaveLength(7);
  });

  it('a reta: clica os pontos, duplo clique termina; com o espelho, aparece dos dois lados', async () => {
    const { folha, clicar, onGuardar, ultimo } = abrir();
    ferramenta('Reta');
    clicar(120, 200);
    clicar(150, 260);
    fireEvent.doubleClick(folha);
    // O traço e o espelho dele (e o realce dos dois, por estar escolhido).
    const caminhos = folha.querySelectorAll('path:not(.traco-em-desenho)');
    expect(caminhos.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    const traco = ultimo().elementos[0] as TracoDoDesenho;
    expect(traco).toMatchObject({ tipo: 'traco', vista: 'frente', estilo: 'contorno', espelhar: true, pontos: [{ x: 120, y: 200 }, { x: 150, y: 260 }] });
  });

  it('escolher (também pelo espelho), mudar o estilo, apagar; desfazer volta', async () => {
    const { clicar, folha } = abrir();
    ferramenta('Reta');
    clicar(100, 100);
    clicar(140, 100);
    fireEvent.doubleClick(folha);
    ferramenta('Selecionar');
    clicar(10, 10);
    expect(screen.getByText(/Escolha um elemento/)).toBeInTheDocument();
    // O espelho da reta fica em x de 260 a 300.
    clicar(280, 101);
    expect(screen.getByLabelText('Estilo')).toHaveValue('contorno');
    fireEvent.change(screen.getByLabelText('Estilo'), { target: { value: 'pesponto' } });
    expect(folha.querySelector('path[stroke-dasharray="4 3"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(screen.getByRole('tab', { name: 'Frente (0)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByRole('tab', { name: 'Frente (1)' })).toBeInTheDocument();
  });

  it('arrastar move o elemento (o arrasto inteiro é um desfazer só); arrastar um ponto muda só ele', async () => {
    const { clicar, folha, onGuardar, ultimo } = abrir();
    ferramenta('Reta');
    clicar(100, 100);
    clicar(140, 100);
    fireEvent.doubleClick(folha);
    ferramenta('Selecionar');
    fireEvent.pointerDown(folha, { clientX: 120, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 125, clientY: 110, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 130, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 130, clientY: 120, pointerId: 1 });
    // Agora o ponto do começo (110, 120) é puxado para (110, 150).
    fireEvent.pointerDown(folha, { clientX: 110, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 110, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 110, clientY: 150, pointerId: 1 });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect((ultimo().elementos[0] as TracoDoDesenho).pontos).toEqual([{ x: 110, y: 150 }, { x: 150, y: 120 }]), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect((ultimo().elementos[0] as TracoDoDesenho).pontos).toEqual([{ x: 100, y: 100 }, { x: 140, y: 100 }]), { timeout: 2000 });
  });

  it('o texto, a forma e a estampa', async () => {
    const { clicar, folha, onGuardar, ultimo } = abrir();
    ferramenta('Texto');
    clicar(40, 470);
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Pesponto duplo a 6 mm' } });
    expect(folha).toHaveTextContent('Pesponto duplo a 6 mm');
    fireEvent.change(screen.getByLabelText('Forma'), { target: { value: 'botao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a forma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a estampa' }));
    expect(folha.querySelector('image')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Largura da estampa'), { target: { value: '120' } });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(ultimo().elementos.map((e) => e.tipo)).toEqual(['texto', 'traco', 'traco', 'estampa']), { timeout: 2000 });
    expect(ultimo().elementos[3]).toMatchObject({ imagemId: 'img1', largura: 120 });
  });

  it('as costas são outra folha; copiar o elemento para a outra vista', () => {
    const { clicar, folha } = abrir();
    ferramenta('Reta');
    clicar(100, 100);
    clicar(140, 100);
    fireEvent.doubleClick(folha);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar para as costas' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Costas (1)' }));
    expect(screen.getByRole('img', { name: 'Folha do desenho — Costas' })).toBeInTheDocument();
  });

  it('só para ver (a ficha aprovada): o motivo, as ferramentas travadas, nada é guardado; o SVG sai', async () => {
    const { onGuardar, onExportarSvg } = abrir({ somenteLeitura: 'A ficha está aprovada (versão 1): o desenho só pode ser visto.' });
    expect(screen.getByText('A ficha está aprovada (versão 1): o desenho só pode ser visto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pôr a base (frente e costas)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar SVG' }));
    expect(onExportarSvg).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 700));
    expect(onGuardar).not.toHaveBeenCalled();
  });
});

describe('PainelDoDesenhoTecnico — o zoom e a grade (ADR 0116)', () => {
  const zoom = () => within(screen.getByRole('toolbar', { name: 'Zoom e grade' }));

  it('aproximar: a folha mostra a metade do meio, e o clique cai no ponto certo da folha', async () => {
    const { folha, clicar, onGuardar, ultimo } = abrir();
    expect(folha.getAttribute('viewBox')).toBe('0 0 400 500');
    expect(zoom().getByRole('button', { name: 'Afastar' })).toBeDisabled();
    fireEvent.click(zoom().getByRole('button', { name: 'Aproximar' }));
    expect(folha.getAttribute('viewBox')).toBe('100 125 200 250');
    expect(zoom().getByRole('button', { name: '200%' })).toBeInTheDocument();
    // O quadro tem 400 × 500 px: o canto do quadro é o ponto (100, 125) da folha; o meio, (200, 250).
    ferramenta('Reta');
    clicar(0, 0);
    clicar(200, 250);
    fireEvent.doubleClick(folha);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect((ultimo().elementos[0] as TracoDoDesenho).pontos).toEqual([
      { x: 100, y: 125 },
      { x: 200, y: 250 },
    ]);
    // "200%" volta à folha inteira.
    fireEvent.click(zoom().getByRole('button', { name: '200%' }));
    expect(folha.getAttribute('viewBox')).toBe('0 0 400 500');
  });

  it('a roda do mouse aproxima no ponto do mouse; as teclas + − 0', () => {
    const { folha } = abrir();
    fireEvent.wheel(folha, { deltaY: -100, clientX: 0, clientY: 0 });
    // O canto (0, 0) fica parado no canto do quadro.
    const [x, y, largura] = folha.getAttribute('viewBox')!.split(' ').map(Number);
    expect([x, y]).toEqual([0, 0]);
    expect(largura).toBeCloseTo(400 / 1.2, 6);
    fireEvent.keyDown(folha, { key: '0' });
    expect(folha.getAttribute('viewBox')).toBe('0 0 400 500');
    fireEvent.keyDown(folha, { key: '+' });
    fireEvent.keyDown(folha, { key: '+' });
    expect(zoom().getByRole('button', { name: '400%' })).toBeInTheDocument();
    fireEvent.keyDown(folha, { key: '-' });
    expect(zoom().getByRole('button', { name: '200%' })).toBeInTheDocument();
  });

  it('de perto, arrastar o vazio (com Selecionar) anda pela folha', () => {
    const { folha } = abrir();
    fireEvent.click(zoom().getByRole('button', { name: 'Aproximar' }));
    // 2 px da tela por unidade da folha: 100 px para a direita andam 50 para a esquerda na folha.
    fireEvent.pointerDown(folha, { clientX: 200, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 300, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 300, clientY: 250, pointerId: 1 });
    expect(folha.getAttribute('viewBox')).toBe('50 125 200 250');
  });

  it('a grade aparece; com o ímã, os pontos novos e o ponto arrastado param no cruzamento', async () => {
    const { folha, clicar, onGuardar, ultimo } = abrir();
    expect(zoom().getByRole('button', { name: 'Ímã' })).toBeDisabled();
    fireEvent.click(zoom().getByRole('button', { name: 'Grade' }));
    expect(folha.querySelectorAll('.grade-da-folha line').length).toBe(39 + 49);
    expect(folha.querySelectorAll('.grade-da-folha line.grade-forte').length).toBe(7 + 9);
    fireEvent.click(zoom().getByRole('button', { name: 'Ímã' }));
    expect(zoom().getByRole('button', { name: 'Ímã' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Espelhar o que desenhar'));
    ferramenta('Reta');
    clicar(123, 207);
    clicar(151, 262);
    fireEvent.doubleClick(folha);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect((ultimo().elementos[0] as TracoDoDesenho).pontos).toEqual([
      { x: 120, y: 210 },
      { x: 150, y: 260 },
    ]);
    // Arrastar o primeiro ponto (o traço está escolhido) para perto de (163, 228): para em (160, 230).
    ferramenta('Selecionar');
    fireEvent.pointerDown(folha, { clientX: 121, clientY: 209, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 164, clientY: 227, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 164, clientY: 227, pointerId: 1 });
    await waitFor(() => expect((ultimo().elementos[0] as TracoDoDesenho).pontos[0]).toEqual({ x: 160, y: 230 }), { timeout: 2000 });
  });

  it('só para ver: o zoom e a grade funcionam, o ímã não; de perto, arrastar anda pela folha', () => {
    const { folha } = abrir({ somenteLeitura: 'A ficha está aprovada (versão 1): o desenho só pode ser visto.' });
    fireEvent.click(zoom().getByRole('button', { name: 'Aproximar' }));
    fireEvent.click(zoom().getByRole('button', { name: 'Grade' }));
    expect(zoom().getByRole('button', { name: 'Ímã' })).toBeDisabled();
    fireEvent.pointerDown(folha, { clientX: 200, clientY: 250, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 200, clientY: 150, pointerId: 1 });
    expect(folha.getAttribute('viewBox')).toBe('100 175 200 250');
  });
});

describe('PainelDoDesenhoTecnico — as cotas (ADR 0117)', () => {
  const MEDIDAS: PontoDeMedida[] = [
    { id: 'busto', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 48, M: 52.5 } },
    { id: 'comprimento', nome: 'Comprimento', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 66 } },
  ];

  it('dois cliques fazem a cota, com a letra do próximo ponto de medida; as propriedades mostram os valores', async () => {
    const { folha, clicar, onGuardar, ultimo } = abrir({ medidas: MEDIDAS });
    ferramenta('Cota');
    clicar(110, 150);
    clicar(290, 150);
    clicar(200, 120);
    clicar(200, 400);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(ultimo().elementos).toHaveLength(2), { timeout: 2000 });
    const [a, b] = ultimo().elementos as CotaDoDesenho[];
    expect(a).toMatchObject({ tipo: 'cota', de: { x: 110, y: 150 }, ate: { x: 290, y: 150 }, medidaId: 'busto' });
    expect(b).toMatchObject({ medidaId: 'comprimento' });
    expect([...folha.querySelectorAll('.cota-do-desenho text')].map((t) => t.textContent)).toEqual(['A', 'B']);
    // A escolhida (a última) mostra o ponto e os valores; o busto já tem cota.
    expect(screen.getByText(/\(cm\): P 66,0$/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'A — Busto (já tem cota)' })).toBeInTheDocument();
  });

  it('sem ponto de medida, o texto da cota; arrastar a ponta da cota escolhida', async () => {
    const { folha, clicar, onGuardar, ultimo } = abrir({ medidas: MEDIDAS });
    ferramenta('Cota');
    clicar(100, 300);
    clicar(100, 380);
    fireEvent.change(screen.getByLabelText('Ponto de medida'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Texto da cota'), { target: { value: 'Barra 3 cm' } });
    expect(folha.querySelector('.cota-do-desenho text')?.textContent).toBe('Barra 3 cm');
    ferramenta('Selecionar');
    fireEvent.pointerDown(folha, { clientX: 100, clientY: 380, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 100, clientY: 420, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 100, clientY: 420, pointerId: 1 });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(ultimo().elementos[0]).toMatchObject({ medidaId: null, texto: 'Barra 3 cm', de: { x: 100, y: 300 }, ate: { x: 100, y: 420 } }), { timeout: 2000 });
  });

  it('sem pontos de medida na ficha, a cota diz como ligar e leva o texto', () => {
    const { clicar } = abrir();
    ferramenta('Cota');
    clicar(100, 300);
    clicar(200, 300);
    expect(screen.getByText(/A ficha ainda não tem pontos de medida/)).toBeInTheDocument();
    expect(screen.getByLabelText('Texto da cota')).toBeInTheDocument();
  });
});

describe('a área para o consumo (ADR 0127)', () => {
  const corpo = (id: string, vista: 'frente' | 'costas'): TracoDoDesenho => ({
    id,
    tipo: 'traco',
    vista,
    pontos: [
      { x: 150, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 300 },
      { x: 150, y: 300 },
    ],
    curvo: false,
    fechado: true,
    estilo: 'contorno',
    cor: '#000000',
    espessura: 2,
    preenchimento: null,
    espelhar: true,
  });
  const cota: CotaDoDesenho = { id: 'c1', tipo: 'cota', vista: 'frente', de: { x: 120, y: 100 }, ate: { x: 120, y: 300 }, medidaId: 'comp', texto: '', cor: '#c62828' };
  const comprimento: PontoDeMedida = { id: 'comp', nome: 'Comprimento', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 66, M: 70 } };

  it('o corpo de frente e de costas na escala da cota, no tamanho do meio', () => {
    abrir({ desenho: { ...DESENHO_VAZIO, elementos: [corpo('f', 'frente'), corpo('c', 'costas'), cota] }, medidas: [comprimento] });
    const caixa = screen.getByRole('region', { name: 'Área para o consumo' });
    // 100 × 200 unidades por vista, 3,3 mm por unidade (66 cm em 200 unidades): 0,2178 m² cada.
    expect(caixa).toHaveTextContent('Área para o consumo (tamanho P)');
    expect(caixa).toHaveTextContent('0,436 m²');
    expect(caixa).toHaveTextContent('frente 0,218 m² + costas 0,218 m², na escala da cota de Comprimento (66 cm no P). 2 contorno(s) fechado(s).');
    // 100 × 200 unidades a 3,3 mm: 33 × 66 cm.
    expect(caixa).toHaveTextContent('Nesta escala, a roupa tem 33 × 66 cm (largura × altura)');
  });

  it('sem a cota ligada a uma medida, diz o que falta', () => {
    abrir({ desenho: { ...DESENHO_VAZIO, elementos: [corpo('f', 'frente')] }, medidas: [comprimento] });
    expect(screen.getByRole('region', { name: 'Área para o consumo' })).toHaveTextContent('nenhuma cota do desenho está ligada a uma medida com valor no tamanho P — a cota dá a escala.');
  });
});
