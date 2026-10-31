import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AreaDeDesenho, type FerramentaDeVista, type ModoDeDesenho, type PreviaNoDesenho } from './ui/AreaDeDesenho';
import { BarraDeFerramentas } from './ui/BarraDeFerramentas';
import { BarraDeVisualizacao } from './ui/BarraDeVisualizacao';
import { PainelDePecas, PainelDePropriedades, type PatchDeMolde } from './ui/PainelLateral';
import { BarraDeStatus } from './ui/BarraDeStatus';
import { motivoDoErroDeSalvar, type EstadoDoSalvamento } from './ui/salvamento';
import { ehCampoDeDigitar } from './ui/campoDeDigitar';
import { confirmarPlano, guardarRascunho, removerRascunho, type PlanoDeCorteV2 } from './domain/planejamento';
import { PainelDePlanejamento, type BuscarRiscos } from './ui/PainelDePlanejamento';
import { carregarCadastro, gravarCadastro, type CadastroCarregado } from './ui/cadastroNoDisco';
import { carregarBibliotecaDeMateriais, gravarBibliotecaDeMateriais, type BibliotecaCarregada } from './ui/materiaisNoDisco';
import { PainelDeMateriais } from './ui/PainelDeMateriais';
import type { BibliotecaDeMateriais } from './domain/materiais';
import { gravarConfiguracaoDoPlanejamento, lerConfiguracaoDoPlanejamento } from './ui/configuracaoDoPlanejamento';
import { executarBusca } from './domain/buscaDeRiscos';
import { escreverM as escreverEmMetros, enfestoDoPlano, impressaoDigitalDoMolde } from './domain/planoDeCorte';
import type { CadastroDeProducao } from './domain/cadastroDeProducao';
import type { MensagemParaABusca } from './planejamento.worker';
import { destinoDaAcaoDoMenu } from './ui/edicaoPeloMenu';
import { Sobreposicao } from './ui/Sobreposicao';
import { PainelDeMoverCerca } from './ui/PainelDeMoverCerca';
import { PainelDeModificar } from './ui/PainelDeModificar';
import { PainelDeRedefinirPerimetro, type RedefinicaoDePerimetro } from './ui/PainelDeRedefinirPerimetro';
import { PainelDeAjuda, type ConteudoDaAjuda } from './ui/PainelDeAjuda';
import { PainelDeCostura } from './ui/PainelDeCostura';
import { PainelDeInformacoesDosMoldes } from './ui/PainelDeInformacoesDosMoldes';
import { PainelDeVariantes } from './ui/PainelDeVariantes';
import { DialogoDeCampos } from './ui/DialogoDeCampos';
import { PainelDeCurvaPredefinida } from './ui/PainelDeCurvaPredefinida';
import {
  caminhoDoTrecho,
  cliqueDeTrecho,
  comprimentoDoTrecho,
  linhaNovaDoTrecho,
  pontosDoTrecho,
  previaDoTrecho,
  SEM_TRECHO,
  trechoCompleto,
  type FerramentaDeTrecho,
  type OpcoesDoTrecho,
  type TrechoEmEdicao,
} from './ui/ferramentasDeTrecho';
import {
  aplicarBainha,
  aplicarPecaDerivada,
  previaDaPecaDerivada,
  aplicarDesdobrar,
  aplicarReta,
  dialogoDeCortar,
  dialogoDeRemoverRegiao,
  dialogoDeUnir,
  lerDialogoDeUnir,
  instrucaoDaReta,
  lerContornoDoCorte,
  lerDialogoDeCortar,
  lerDialogoDeRemoverRegiao,
  cliqueNoElementoDeRemover,
  confirmarElementosDeRemover,
  cliqueNaParteDoCorte,
  cliqueNoElementoDoCorte,
  confirmarCortePelosElementos,
  previaDaParteDoCorte,
  previaDoCortePelosElementos,
  previaDoRemoverPelosElementos,
  REMOVER_REGIAO_SIMPLES,
  retaPeloElemento,
  type OpcoesDeRemoverRegiao,
  aplicarUniao,
  arestaDeOutraPecaPerto,
  arestaPerto,
  cliqueDeReta,
  ehFerramentaDeReta,
  previaDaBainha,
  previaDaReta,
  previaDeDesdobrar,
  previaDeUnir,
  retaCompleta,
  type FerramentaDeMolde,
} from './ui/ferramentasDeMolde';
import {
  aplicarPence,
  cliqueDePence,
  aplicarEdicaoDaCunha,
  aplicarEdicaoDaPence,
  aplicarEdicaoDaPrega,
  dialogoDeEditarPrega,
  dialogoDaPence,
  cunhaSobOClique,
  dialogoDeEditarCunha,
  dialogoDeEditarPence,
  ehFerramentaDePence,
  instrucaoDaPence,
  lerDialogoDaPence,
  OPCOES_INICIAIS_DAS_PENCES,
  penceCompleta,
  penceSemRegistroSobOClique,
  pregaSemRegistroSobOClique,
  previaDaPence,
  type FerramentaDePence,
  type OpcoesDasPences,
} from './ui/ferramentasDePence';
import {
  aplicarRemoverDoMolde,
  aplicarSeparar,
  aplicarTamanhos,
  aplicarUnir,
  cliqueDeGraduacao,
  dialogoDaGraduacao,
  dialogoDeTamanhos,
  ehModoDeGraduacao,
  instrucaoDaGraduacao,
  lerDialogoDaGraduacao,
  mesmosTamanhos,
  OPCOES_INICIAIS_DA_GRADUACAO,
  previaDaGraduacao,
  separarAgeNaHora,
  type FerramentaDeGraduacao,
  type OpcoesDaGraduacao,
} from './ui/ferramentasDeGraduacao';
import {
  criarConjuntoDeRegras,
  gravarConjuntosDeRegras,
  gravarRegrasCadastradas,
  lerConjuntosDeRegras,
  lerRegrasCadastradas,
  regraDaVez,
  regraDoPonto,
  regraParaAGraduacao,
  type ConjuntoDeRegras,
  type RegraCadastrada,
} from './ui/regrasDeGraduacao';
import { PainelDeTabelaDeGraduacao } from './ui/PainelDeTabelaDeGraduacao';
import { PainelDeCriarRegra } from './ui/PainelDeCriarRegra';
import { regraDaTabela } from './ui/tabelaDaRegra';
import { aplicarDialogoDoPique, dialogoDoPique, type GraduacaoDePiqueCopiada } from './ui/graduacaoDePiques';
import { PainelDeRegras } from './ui/PainelDeRegras';
import { definirRegra, pontoGraduadoEm, regraDoVertice } from './domain/graduacao';
import { expandirTamanhos } from './domain/tamanhosGraduados';
import {
  arredondarCanto,
  cotaDeRaioEm,
  ehFerramentaDeCanto,
  ferramentaDoCanto,
  nomeDaFerramentaDeCanto,
  recusaDoCanto,
  type FerramentaDeCanto,
} from './ui/ferramentasDeArco';
import { valorDaCotaDeRaio } from './domain/cota';
import {
  abrirSimetrias,
  adicionarTexto,
  alterarTexto,
  arestaDeSimetria,
  CORES_DE_PECA,
  definirCodigoDoPique,
  definirCor,
  definirLinhaDeSimetria,
  piquePerto,
  piquesComOCodigo,
  textoPerto,
} from './domain/anotacoes';
import { conferirOpcoesDaPecaDerivada, OPCOES_PADRAO_DA_PECA_DERIVADA, pedeOTrecho, type OpcoesDaPecaDerivada, type TipoDePecaDerivada } from './domain/pecasDerivadas';
import { definirAutor, definirElasticidadeDaRecomendacao, definirFichaTecnica, definirImpressaoDigital, definirInspiracao, definirMontagem3d, definirRegrasDeCaimento } from './domain/projeto';
import { lerImpressaoDigital, type ImpressaoDigital } from './domain/impressaoDigital';
import { gerarPdfParaImpressaoDigital } from './formats/impressao-exportacao';
import { lerPainelDeInspiracao, type PainelDeInspiracao as PainelDeInspiracaoDoModelo } from './domain/inspiracao';
import { lerMontagem3d, type Montagem3D } from './domain/montagem3d';
import { lerElasticidadeDaRecomendacao, lerRegrasDeCaimento, type ElasticidadeDaRecomendacao, type RegrasDeCaimento } from './domain/recomendacaoDeTamanho';
import { definirDesenhoDaFicha, encaixeParaConsumo, fichaEditavel, lerFichaTecnica, novaFichaTecnica, ROTULO_DA_SITUACAO_DA_FICHA, type FichaTecnica, type PontoDeMedida } from './domain/fichaTecnica';
import { DESENHO_VAZIO, type DesenhoTecnico } from './domain/desenhoTecnico';
import { PainelDoDesenhoTecnico } from './ui/PainelDoDesenhoTecnico';
import { svgDoDesenho } from './formats/desenho-exportacao';
import { useColecoes } from './ui/useColecoes';
import { PainelDeColecoes, type ParteDaColecao } from './ui/PainelDeColecoes';
import { avisoDePrazos, diaDe } from './domain/colecoes';
import { PainelDaFotoParaMolde } from './ui/PainelDaFotoParaMolde';
import { PainelDeRecomendacaoDeTamanho, type ParteDaRecomendacao } from './ui/PainelDeRecomendacaoDeTamanho';
import { PainelDoProvador3D } from './ui/PainelDoProvador3D';
import { PainelDaImpressaoDigital, type ImagemDeEstampa } from './ui/PainelDaImpressaoDigital';
import { PainelDeInspiracao, type AcessoAoServicoDeIa, type ParteDaInspiracao } from './ui/PainelDeInspiracao';
import { lerImagemParaInspiracao, pngDoSvg, reduzirParaInspiracao } from './ui/imagensDaInspiracao';
import { dataUrlDosPixels, pixelsDaImagem } from './ui/pixelsDaImagem';
import { paraODesenho, type MoldeReconhecido } from './domain/digitalizacao';
import { custosDosModelos, type CustoDoTamanho, type PreCusto } from './domain/preCusto';
import { PainelDaFichaTecnica, type ParteDaFicha } from './ui/PainelDaFichaTecnica';
import { gerarPdfDaFichaTecnica } from './formats/ficha-exportacao';
import type { FerramentaDeAnotacao } from './ui/BarraDeFerramentas';
import {
  adicionarImagem,
  calibrarImagem,
  descreverEscalaDaImagem,
  imagensDoProjeto,
  novaImagem,
  origemParaImagemNova,
  removerImagem,
  retanguloDaImagem,
  substituirImagem,
  type ImagemDoModelo,
} from './domain/imagens';
import { lerImagemDoArquivo } from './ui/carregarImagem';
import { PainelDeImagens } from './ui/PainelDeImagens';
import { PainelDeProgramas } from './ui/PainelDeProgramas';
import {
  cliqueDeDobrar,
  dialogoDeDobrar,
  instrucaoDeDobrar,
  lerDialogoDeDobrar,
  OPCOES_INICIAIS_DE_DOBRAR,
  previaDeDobrar,
  type OpcoesDeDobrar,
} from './ui/ferramentasDeDobra';
import { linhaInternaPerto } from './domain/elementos';
import {
  aplicarAlteracaoDoPique,
  aplicarAlteracaoDoTexto,
  aplicarCadastro,
  aplicarRemoverTodos,
  aplicarSubstituir,
  cadastroAgeNaHora,
  cliqueDeMarcacao,
  comOCadastrado,
  confirmarLinhasAuxiliares,
  confirmarLinhasDoCadastro,
  dialogoDaMarcacao,
  dialogoDeAlterarPique,
  dialogoDeAlterarTexto,
  ehModoDeMarcacao,
  instrucaoDaMarcacao,
  lerDialogoDaMarcacao,
  OPCOES_INICIAIS_DE_MARCACAO,
  previaDaMarcacao,
  removerAgeNaHora,
  type FerramentaDeMarcacao,
  type OpcoesDeMarcacao,
  type PiqueCadastrado,
} from './ui/ferramentasDeMarcacao';
import { cadastroAoDesfazer, cadastroAoRefazer, registrarMudancaDoCadastro } from './ui/historicoDoCadastro';
import { gravarPiquesCadastrados, lerPiquesCadastrados } from './ui/piquesCadastrados';
import { folgaDigitada, folgaEscrita, gravarFolgaForaDaPeca, lerFolgaForaDaPeca } from './ui/folgaDaValidacao';
import { comFiguraRegistrada, figuraDaEspiral, figuraDoCirculo } from './domain/figuras';
import type { FiguraDaPeca, PregaDaPeca } from './domain/molde';
import { aplicarDialogoDaFigura, avisoDasFiguras, centrosDasFiguras, dialogoDaFigura, figuraSobOClique } from './ui/ferramentasDeFigura';
import { comPenceReconhecida, pencePerto, pencesDaPeca } from './domain/pences';
import { pregaPerto, pregasDaPeca } from './domain/pregas';
import { comPregaReconhecida } from './domain/pregasSemRegistro';
import { comArcoRegistrado, comCurvaRegistrada } from './domain/curvasDaPeca';
import {
  apagarAlca,
  aplicarTornarCurva,
  avisoDasAlcas,
  cliqueDeNovoPontoDePassagem,
  cliqueNaAlca,
  instrucaoComAlca,
  previaDasAlcas,
  type AlcaEscolhida,
} from './ui/ferramentasDeCurva';
import {
  cliqueDaConferencia,
  dialogoDaConferencia,
  lerDialogoDaConferencia,
  OPCOES_INICIAIS_DA_CONFERENCIA,
  previaDaConferencia,
  SEM_CONFERENCIA,
  textoDaConferencia,
  type EstadoDaConferencia,
  type OpcoesDaConferencia,
} from './ui/conferencia';
import type { Programa } from './domain/programas';
import {
  apagarElementoEscolhido,
  aplicarPontoPorCoordenada,
  extrairTodasAsRegioes,
  cliqueDeElemento,
  dialogoDoElemento,
  ehModoDeElemento,
  instrucaoDoElemento,
  lerDialogoDoElemento,
  OPCOES_INICIAIS_DE_ELEMENTO,
  previaDoElemento,
  type FerramentaDeElemento,
  type OpcoesDeElemento,
} from './ui/ferramentasDeElemento';
import { conferirOpcoesDeBainha, MAXIMO_DE_DOBRAS_DA_BAINHA, type OpcoesDeBainha } from './domain/bainha';
import { cortePedeAParte, CORTE_SEM_COSTURA, UNIAO_PADRAO, type OpcoesDeCorte, type OpcoesDeUniao } from './domain/corteEUniao';
import {
  curvaDoTrecho,
  CURVAS_DE_FABRICA,
  gravarCurvasCadastradas,
  lerCurvasCadastradas,
  type CurvaCadastrada,
} from './ui/curvasCadastradas';
import { formatarMm } from './ui/medidas';
import { numeroComVirgula } from './core/numeros';
import { circulo, espiral } from './core/curvas';
import { CLIQUES_DA_COTA, cotaSobOPonto, montarCota, previaDaCota, type FerramentaDeCotaPorPontos } from './ui/cotas';
import { cotaDePerimetro } from './domain/cota';
import {
  alvoDaMedicao,
  cliqueDePerimetro,
  posicaoNoContornoPerto,
  descreverComparacao,
  descreverMedicao,
  registrarMedicao,
  resolverMedicao,
  SEM_MEDICAO,
  type EstadoDeMedicao,
  type MedicaoResolvida,
} from './ui/medicao';
import { alternarNaSelecao, inverterSelecao, selecionarPeloRetangulo, type SelecaoDePecas } from './domain/selecao';
import {
  aplicarZoom,
  enquadrarRetanguloDoMundo,
  passoDaGradeEmMm,
  type TransformacaoDeTela,
  type UnidadeDeRegua,
} from './ui/transformacaoDeTela';
import {
  cercaAfetaMolde,
  moverDentroDaCerca,
  pecasAlvoDaCerca,
  TODAS_AS_OPCOES_DA_CERCA,
  transladarCerca,
  type Cerca,
  type OpcoesDeMoverCerca,
} from './domain/cerca';
import {
  criarMolde,
  transladarMolde,
  rotacionarMolde,
  rotacaoEhPermitida,
  rotacoesPermitidas,
  espelharMolde,
  moverVariosPontosDoMolde,
  redefinirComprimentoDaAresta,
  inserirPontoNoMolde,
  removerPontoDoMolde,
  chanfrarCantoDoMolde,
  arredondarCantoDoMolde,
  dimensionarMolde,
  dimensoesDoMolde,
  redefinirLinhaDeFio,
  definirMargemDeCostura,
  restaurarFormaDoMolde,
  adicionarCota,
  removerCota,
  converterCosturaEmContorno,
  substituirTrechoDoMolde,
  linhaDeCorteDaPeca,
  comPar,
  origemDaPecaImportada,
  type Molde,
  type PenceDaPeca,
  type PontaDaAresta,
} from './domain/molde';
import { importarDxf } from './formats/dxf-importacao';
import { importarPdf, moldeDaPecaImportada } from './formats/pdf-importacao';
import { diagnosticarVetorPdf, descreverDiagnosticoVetorial } from './formats/pdf-diagnostico-vetorial';
import { extrairContornosDoPdf, linhaDeFioSobreContorno } from './formats/pdf-pecas-vetoriais';
import { moldesDoDxf, moldesDosContornosDoPdf } from './formats/importacaoDireta';
import { comprimentoDoEncaixeAImprimirMm, gerarPdfDeEncaixe, gerarPdfDeMoldesIndividuais } from './formats/pdf-exportacao';
import { codificarDxf, gerarDxf } from './formats/dxf-exportacao';
import { cabecalhoDoRisco, gerarPlt, ROTULO_DO_ELEMENTO, type ElementoDoPlotter, type OpcoesDoPlt } from './formats/plt-exportacao';
import { pecasDoPlt } from './formats/plt-importacao';
import { cifrarProjeto, decifrarProjeto, ehProjetoCifrado, nomeDoArquivoDoProjeto, projetoDoArquivo, textoDoProjeto } from './domain/projetoEmArquivo';
import { gerarDxfAstm } from './formats/dxf-astm';
import { moldesParaPlotar, moldeVizinho, organizarPecas, retanguloDoElemento } from './domain/plotarMoldes';
import { modificarComModo, type ModoDeModificar } from './domain/modificarElemento';
import { MEDIDA_MAXIMA_DO_PIQUE_MM, MEDIDA_MINIMA_DO_PIQUE_MM } from './domain/piques';
import {
  acaoDaTeclaDoEncaixe,
  comForaDaDobra,
  comMeiaCamada,
  lugarLivreMaisPerto,
  moverAteEncostar,
  moverComReferencia,
  moverParaForaDoEnfesto,
  pecaNaDobraDoTecido,
  pecasDoTamanho,
  proximoGrupo,
  voltarAoOriginal,
  type AcaoDaTecla,
} from './domain/encaixeManual';
import { comTamanhoIntermediario } from './domain/tamanhoIntermediario';
import { comTamanhoSobMedida, posicaoDasMedidas } from './domain/sobMedida';
import { aplicarEsquema, aplicarPerfil, esquemaGuardado, perfilAtual, restaurarPadroes, type EsquemaDeCores } from './ui/preferencias';
import {
  corDoTamanho,
  coresDosTamanhosGuardadas,
  estiloDaCosturaGuardado,
  guardarCoresDosTamanhos,
  guardarEstiloDaCostura,
  guardarPiquePadrao,
  piquePadraoGuardado,
  type EstiloDaCostura,
} from './ui/preferencias';
import { gerarIso, resumoDoIso, VELOCIDADE_PADRAO_MM_MIN } from './formats/iso-exportacao';
import { acessoAPasta } from './ui/pastasCompartilhadas';
import { PainelDaMesaDigitalizadora } from './ui/PainelDaMesaDigitalizadora';
import type { PecaDaMesa } from './domain/mesaDigitalizadora';
import { gerarPdfDeRelatorio, gerarExcelDeRelatorio } from './formats/relatorio-exportacao';
import { aproveitamentoDaMesa, gerarRelatorioDeProducao } from './domain/relatorio';
import {
  ponto,
  area,
  distancia,
  retanguloEnvolvente,
  deslocarContornoParaFora,
  pontoDentroDoContorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from './core/geometria';
import { comPontoDeCasamento, grupoLimpo, nomeDoPontoDeCasamento } from './domain/pontosDeCasamento';
import { COMPONENTES, componente, componenteNoProjeto, type TipoDeComponente } from './domain/componentes';
import { recadoDaTroca, trocarMaterialNosModelos } from './domain/trocaDeMaterial';
import { criarTecido, sentidoUnicoDoTecido, type Tecido } from './domain/tecido';
import type { ConfiguracaoDeEnfesto } from './domain/enfesto';
import { DISTANCIA_PADRAO_ENTRE_PECAS_MM, MARGEM_DE_SEGURANCA_DA_MESA_MM, ROTULO_DO_TIPO, criarConfiguracaoDeEnfesto, margensDaMesa } from './domain/enfesto';
import { estadoDaValidacao, TOLERANCIAS_PADRAO, validarProjeto } from './domain/validacao';
import { semLinhasQueSaem, semLinhasSoltas, semOQueSaiDasLinhas } from './domain/linhasSoltas';
import { sugerirPosicaoSemSobreposicao, posicionarAsQueChegam } from './domain/posicionamento';
import type { MetodoDoNesting, ResultadoDeNesting } from './domain/nesting';
import type { MensagemParaWorker } from './nesting.worker';
import { PainelDeTecido } from './ui/PainelDeTecido';
import { PainelDeEnfesto } from './ui/PainelDeEnfesto';
import { PainelDeNesting, type OpcoesAvancadasDeNesting } from './ui/PainelDeNesting';
import { PainelDaFilaDeEncaixes } from './ui/PainelDaFilaDeEncaixes';
import { comGrupoDoEncaixe, ordemDosGrupos } from './domain/gruposDoEncaixe';
import { useFilaDeEncaixes, type WorkerDoEncaixe } from './ui/useFilaDeEncaixes';
import { useFilaNaRede } from './ui/useFilaNaRede';
import { montagemDoLook } from './domain/lookNoManequim';
import { alinharPecas, ROTULO_DE_ALINHAR, type ModoDeAlinhar } from './domain/alinharPecas';
import { adicionarTrabalho, concluidosSemAplicar, contagemDaFila, csvDaFila, descricaoDasOpcoes, marcarAplicado } from './domain/filaDeEncaixes';
import { encaixeComOMoldeDeAgora, type EncaixeComOMoldeDeAgora } from './domain/encaixeAtualizado';
import { aprovarComoBase, basesAprovadas, modeloDaBase, pecasDaBase, tirarDasBases } from './domain/basesAprovadas';
import { PainelDeExportacaoPdf, type OpcoesDeExportacaoEscolhidas } from './ui/PainelDeExportacaoPdf';
import { PainelDeBiblioteca } from './ui/PainelDeBiblioteca';
import { PainelDeHistorico } from './ui/PainelDeHistorico';
import { PainelDeRelatorio } from './ui/PainelDeRelatorio';
import { PainelDeNovoProjeto, type DadosDeNovoProjeto } from './ui/PainelDeNovoProjeto';
import { PainelDaSalaDeCorte } from './ui/PainelDaSalaDeCorte';
import { PainelDeDimensionar } from './ui/PainelDeDimensionar';
import {
  criarProjeto,
  registrarEvento,
  registrarRevisaoDoMolde,
  restaurarVersao,
  alterarStatus,
  renomearProjeto,
  gerarCodigoDeProjeto,
  proximoCodigoDeProjeto,
  lerBiblioteca,
  criarVariante,
  variantesDoProjeto,
  nomeDaProximaVariante,
  type Projeto,
  type EstadoDoProjeto,
  type TipoDeEvento,
} from './domain/projeto';
import './App.css';

/** O dia de hoje, no fuso do computador ("AAAA-MM-DD"), para os prazos das coleções. */
const hojeLocal = (): string => diaDe(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString());

/** A hora e os ids da ficha técnica (fora do componente: a janela guarda pela mudança da função). */
const agoraIsoDaFicha = (): string => new Date().toISOString();
const CHAVE_DAS_CANETAS_DO_PLOTTER = 'enfesto-cad:canetas-do-plotter';
const novoIdDaFicha = (): string => `ficha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** O Worker da fila de encaixes (ADR 0102): o mesmo do Nesting automático. */
const criarWorkerDoEncaixe = (): WorkerDoEncaixe => new Worker(new URL('./nesting.worker.ts', import.meta.url), { type: 'module' });

function proximoId(): string {
  return `peca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mesa e tecido de demonstração — sem eles o app abre com "Enfesto: não
 * configurado" e nenhuma mesa desenhada (só um fundo cinza vazio), o que
 * não mostra a mesa retangular horizontal que é uma característica
 * constante do app, não algo que só aparece depois de configurar um
 * projeto na mão. Nenhuma peça de demonstração — o projeto abre vazio,
 * pronto para o usuário desenhar as próprias peças.
 */
function enfestoDeDemonstracao(): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1500,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 1,
    margemLateralMm: MARGEM_DE_SEGURANCA_DA_MESA_MM,
    margemDeExtremidadeMm: MARGEM_DE_SEGURANCA_DA_MESA_MM,
    distanciaMinimaEntrePecasMm: DISTANCIA_PADRAO_ENTRE_PECAS_MM,
  } as ConfiguracaoDeEnfesto);
}

function tecidoDeDemonstracao(): Tecido {
  return criarTecido(
    { nome: 'Tecido de demonstração', referencia: '', larguraTotalMm: 1500, larguraUtilMm: 1500 },
    'tecido-demo',
  );
}

/**
 * Tamanho da área de desenho até a primeira medida real (a área avisa o
 * tamanho de verdade assim que é montada — ver `aoMudarTamanhoDaTela`).
 */
const TAMANHO_PROVISORIO_DA_TELA = { largura: 900, altura: 600 } as const;

/**
 * O que "Ajustar à tela" enquadra: a mesa (com enfesto configurado), todas as
 * peças e as imagens do modelo que estão à mostra. `null` se não houver nada disso.
 */
function retanguloDoDesenho(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto | null,
  imagens: readonly ImagemDoModelo[],
): { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number } | null {
  let minX = enfesto ? 0 : Infinity;
  let minY = enfesto ? 0 : Infinity;
  let maxX = enfesto ? enfesto.larguraUtilMm : -Infinity;
  let maxY = enfesto ? enfesto.comprimentoMm : -Infinity;
  for (const peca of pecas) {
    const b = retanguloEnvolvente(peca.contorno);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  for (const imagem of imagens) {
    if (!imagem.visivel) continue;
    const b = retanguloDaImagem(imagem);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return Number.isFinite(minX) && Number.isFinite(maxX) ? { minX, minY, maxX, maxY } : null;
}

/** Quantas vistas "Vista anterior" guarda. */
const MAXIMO_DE_VISTAS_GUARDADAS = 50;

function mesmaVista(a: TransformacaoDeTela, b: TransformacaoDeTela): boolean {
  return a.escalaPxPorMm === b.escalaPxPorMm && a.offsetXPx === b.offsetXPx && a.offsetYPx === b.offsetYPx;
}

function empilharVista(pilha: readonly TransformacaoDeTela[], vista: TransformacaoDeTela): readonly TransformacaoDeTela[] {
  const topo = pilha.at(-1);
  if (topo && mesmaVista(topo, vista)) return pilha;
  return [...pilha, vista].slice(-MAXIMO_DE_VISTAS_GUARDADAS);
}

function mesmaCerca(a: Cerca | null, b: Cerca): boolean {
  return a !== null && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
}

/** Raio (px) em que um clique de medida acerta o contorno de uma peça — o mesmo raio de captura de vértices do desenho. */
const RAIO_DE_MEDICAO_PX = 10;
/** Um retângulo com menos disso (mm) de largura ou de altura não tem área: o segundo clique é ignorado. */
const LADO_MINIMO_DO_RETANGULO_MM = 1e-6;

/** Modos em que a barra de status mostra DX, DY, distância e ângulo a partir do último ponto clicado. */
const MODOS_COM_PONTO_DE_REFERENCIA: ReadonlySet<ModoDeDesenho> = new Set([
  'novo-molde',
  'novo-furo',
  'retangulo',
  'sentido-do-fio',
  'medir-distancia',
  'comparar-distancias',
  'cota-distancia',
  'cota-horizontal-vertical',
  'cota-angulo',
  'circulo',
]);

function ehFerramentaDeTrecho(modo: ModoDeDesenho): modo is FerramentaDeTrecho {
  return (
    modo === 'curva' ||
    modo === 'arco-2-pontos' ||
    modo === 'arco-3-pontos' ||
    modo === 'editar-pontos-de-curva' ||
    modo === 'cadastrar-curva' ||
    modo === 'curva-predefinida' ||
    modo === 'arco-tangente-a-elemento'
  );
}

/** Diálogo aberto por uma ferramenta de desenho, com o que ele precisa para aplicar. */
type DialogoDeFerramenta =
  | { readonly tipo: 'numero-de-pontos'; readonly inicio: PosicaoNoContorno; readonly fim: PosicaoNoContorno }
  | { readonly tipo: 'cadastrar-curva'; readonly inicio: PosicaoNoContorno; readonly fim: PosicaoNoContorno }
  | { readonly tipo: 'escolher-curva' }
  | { readonly tipo: 'espiral' }
  | { readonly tipo: 'figura'; readonly id: string }
  | { readonly tipo: 'raio-do-arco'; readonly indice: number }
  | { readonly tipo: 'bainha' }
  | { readonly tipo: 'forro-entretela-vista' }
  | { readonly tipo: 'ponto-de-casamento' }
  | { readonly tipo: 'componente' }
  | { readonly tipo: 'corte-iso' }
  | { readonly tipo: 'plt-por-partes' }
  | { readonly tipo: 'alinhar-pecas' }
  | { readonly tipo: 'plotar-moldes' }
  | { readonly tipo: 'ferramentas-do-plotter' }
  | { readonly tipo: 'sob-medida' }
  | { readonly tipo: 'cores-dos-tamanhos' }
  | { readonly tipo: 'mover-com-referencia' }
  | { readonly tipo: 'pique-padrao' }
  | { readonly tipo: 'tamanho-intermediario' }
  | { readonly tipo: 'exportar-projeto' }
  | { readonly tipo: 'senha-do-projeto'; readonly conteudo: string }
  | { readonly tipo: 'medidas-do-componente'; readonly componente: TipoDeComponente }
  | { readonly tipo: 'cortar' }
  | { readonly tipo: 'remover-regiao' }
  | { readonly tipo: 'dobrar' }
  | { readonly tipo: 'conferir' }
  | { readonly tipo: 'editar-pence'; readonly id: string; readonly reconhecer?: PenceDaPeca }
  | { readonly tipo: 'editar-prega'; readonly id: string; readonly reconhecer?: PregaDaPeca }
  | { readonly tipo: 'editar-cunha'; readonly id: string }
  | { readonly tipo: 'unir' }
  | { readonly tipo: 'pence'; readonly ferramenta: FerramentaDePence }
  | { readonly tipo: 'elemento'; readonly ferramenta: FerramentaDeElemento }
  | { readonly tipo: 'cor' }
  | { readonly tipo: 'texto-novo' }
  | { readonly tipo: 'editar-texto'; readonly id: string }
  | { readonly tipo: 'codigo-do-pique'; readonly id: string }
  | { readonly tipo: 'autor' }
  | { readonly tipo: 'escala-da-imagem' }
  | { readonly tipo: 'tamanhos' }
  | { readonly tipo: 'graduacao'; readonly ferramenta: FerramentaDeGraduacao }
  | { readonly tipo: 'marcacao'; readonly ferramenta: FerramentaDeMarcacao }
  | { readonly tipo: 'alterar-pique'; readonly id: string; readonly interno: boolean; readonly texto?: true }
  | { readonly tipo: 'tabela-do-ponto'; readonly indice: number }
  | { readonly tipo: 'tabela-do-pique'; readonly id: string }
  | { readonly tipo: 'nome-da-regra'; readonly indice: number }
  | { readonly tipo: 'escolher-regra' }
  // Os quatro abaixo pediam o valor pela caixa de texto do navegador, que o Electron não mostra (dá erro).
  | { readonly tipo: 'salvar-como' }
  | { readonly tipo: 'arredondar-ou-chanfrar'; readonly indice: number }
  | { readonly tipo: 'girar-livre' }
  | { readonly tipo: 'elemento-paralelo' };

/** Número para um campo de diálogo, com vírgula decimal. */
function paraCampo(valor: number): string {
  return String(valor).replace('.', ',');
}

type FerramentaDeMedida = 'medir-distancia' | 'medir-perimetro' | 'comparar-perimetros' | 'comparar-distancias';
type FerramentaDeCota = FerramentaDeCotaPorPontos | 'cota-perimetro';

function ehFerramentaDeCotaPorPontos(modo: ModoDeDesenho): modo is FerramentaDeCotaPorPontos {
  return modo === 'cota-distancia' || modo === 'cota-horizontal-vertical' || modo === 'cota-angulo';
}

function mesmoPonto(a: Ponto2D, b: Ponto2D): boolean {
  return a.x === b.x && a.y === b.y;
}

function novoProjetoVazio(estadoInicial: EstadoDoProjeto, nome = 'Projeto sem título', codigo?: string): Projeto {
  const agora = new Date().toISOString();
  const id = `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return criarProjeto(nome, id, codigo ?? gerarCodigoDeProjeto(agora, 1), agora, estadoInicial);
}

export default function App(): React.JSX.Element {
  const [pecas, setPecas] = useState<Molde[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [idsSelecionadosEmLote, setIdsSelecionadosEmLote] = useState<ReadonlySet<string>>(new Set());
  // As peças copiadas ou recortadas: a selecionada, ou as do lote marcado na lista (como no Duplicar e no Excluir).
  const [clipboard, setClipboard] = useState<readonly Molde[] | null>(null);
  const [transform, setTransform] = useState<TransformacaoDeTela>(() =>
    enquadrarRetanguloDoMundo({ minX: 0, minY: 0, maxX: 1500, maxY: 3000 }, TAMANHO_PROVISORIO_DA_TELA),
  );
  const [tamanhoDaTela, setTamanhoDaTela] = useState<{ readonly largura: number; readonly altura: number }>(
    TAMANHO_PROVISORIO_DA_TELA,
  );
  const vistaInicialEnquadradaRef = useRef(false);
  const [vistasAnteriores, setVistasAnteriores] = useState<readonly TransformacaoDeTela[]>([]);
  const [vistasSeguintes, setVistasSeguintes] = useState<readonly TransformacaoDeTela[]>([]);
  const [ferramentaDeVista, setFerramentaDeVista] = useState<FerramentaDeVista | null>(null);
  const [sobreposicaoDeMoldes, setSobreposicaoDeMoldes] = useState(true);
  const [travaDoEixo, setTravaDoEixo] = useState<'horizontal' | 'vertical' | null>(null);
  const [mostrarNaoGraduados, setMostrarNaoGraduados] = useState(false);
  const [estiloDaCostura, setEstiloDaCostura] = useState<EstiloDaCostura>(() => {
    try {
      return estiloDaCosturaGuardado(window.localStorage);
    } catch {
      return 'tracejada';
    }
  });
  const [coresDosTamanhos, setCoresDosTamanhos] = useState<Readonly<Record<string, string>>>(() => {
    try {
      return coresDosTamanhosGuardadas(window.localStorage);
    } catch {
      return {};
    }
  });
  const [mostrarGrade, setMostrarGrade] = useState(false);
  const [imaAtivo, setImaAtivo] = useState(false);
  const [unidadeDaRegua, setUnidadeDaRegua] = useState<UnidadeDeRegua>('cm');
  // As canetas do plotter: do computador (é do plotter que está ligado nele), não do projeto.
  // As preferências (ADR 0174, 0177).
  const [ferramentasDoPlotter, setFerramentasDoPlotter] = useState<Partial<Record<ElementoDoPlotter, number>>>(() => {
    try {
      const lidas: unknown = JSON.parse(window.localStorage.getItem('enfesto-cad:ferramentas-do-plotter') ?? '{}');
      return typeof lidas === 'object' && lidas !== null ? (lidas as Partial<Record<ElementoDoPlotter, number>>) : {};
    } catch {
      return {};
    }
  });
  const [esquemaDeCores, setEsquemaDeCores] = useState<EsquemaDeCores>(() => {
    try {
      return esquemaGuardado(window.localStorage);
    } catch {
      return 'padrao';
    }
  });
  const [canetasDoPlotter, setCanetasDoPlotter] = useState<1 | 2>(() => {
    try {
      return window.localStorage.getItem(CHAVE_DAS_CANETAS_DO_PLOTTER) === '2' ? 2 : 1;
    } catch {
      return 1;
    }
  });
  const definirCanetasDoPlotter = useCallback((canetas: 1 | 2) => {
    setCanetasDoPlotter(canetas);
    try {
      window.localStorage.setItem(CHAVE_DAS_CANETAS_DO_PLOTTER, String(canetas));
    } catch {
      // Sem como guardar: vale até fechar o programa.
    }
  }, []);
  const [cursorMundo, setCursorMundo] = useState<Ponto2D | null>(null);

  const [passado, setPassado] = useState<Molde[][]>([]);
  const [futuro, setFuturo] = useState<Molde[][]>([]);

  const [mostrarListaDePecas, setMostrarListaDePecas] = useState(true);
  const [mostrarBarraDeVisualizacao, setMostrarBarraDeVisualizacao] = useState(true);

  const [cerca, setCerca] = useState<Cerca | null>(null);
  const [mostrarMoverCerca, setMostrarMoverCerca] = useState(false);
  // Fica aqui, e não no diálogo, porque o desenho destaca só os pontos das
  // categorias marcadas — o que o próximo "Mover cerca" vai mover.
  const [opcoesDaCerca, setOpcoesDaCerca] = useState<OpcoesDeMoverCerca>(TODAS_AS_OPCOES_DA_CERCA);
  // Para desfazer/refazer um "Mover cerca" levar a cerca junto com as peças:
  // a chave é a lista de peças que ficou valendo depois do movimento.
  const movimentosDeCercaRef = useRef(new WeakMap<readonly Molde[], { readonly antes: Cerca; readonly depois: Cerca }>());
  // "Modificar" com medida exata: os vértices indicados no desenho, enquanto o diálogo está aberto.
  const [pontosParaModificar, setPontosParaModificar] = useState<readonly number[] | null>(null);
  // "Redefinir perímetro": fica aqui, e não no diálogo, porque o desenho
  // destaca a aresta escolhida e a ponta que anda.
  const [redefinicaoDePerimetro, setRedefinicaoDePerimetro] = useState<RedefinicaoDePerimetro | null>(null);
  // O modo usado no último "Redefinir perímetro" vem marcado no próximo.
  const ultimoModoDeRedefinirRef = useRef<RedefinicaoDePerimetro['modo']>('uni-direcional');
  const [painelDeAjuda, setPainelDeAjuda] = useState<ConteudoDaAjuda | null>(null);
  // Pontos de restauração (aba Início): a forma guardada de cada peça, pelo
  // id. Valem enquanto o projeto está aberto; não vão para o arquivo.
  const [pontosDeRestauracao, setPontosDeRestauracao] = useState<ReadonlyMap<string, Molde>>(new Map());
  const [mostrarCostura, setMostrarCostura] = useState(false);
  const [mostrarInformacoesDosMoldes, setMostrarInformacoesDosMoldes] = useState(false);
  // Medidas da aba Conferência: só leitura, somem ao sair da ferramenta.
  const [medicao, setMedicao] = useState<EstadoDeMedicao>(SEM_MEDICAO);
  // Peça que vai guardar a cota em construção: a do primeiro clique.
  const [donoDaCota, setDonoDaCota] = useState<string | null>(null);
  const [mostrarVariantes, setMostrarVariantes] = useState(false);
  // Ferramentas de curva e arco (aba Construção): o trecho do contorno sendo
  // indicado, o diálogo que a ferramenta abriu e o recado dela na faixa
  // (o que acabou de fazer, ou por que não fez).
  const [trecho, setTrecho] = useState<TrechoEmEdicao>(SEM_TRECHO);
  const [dialogoDeFerramenta, setDialogoDeFerramenta] = useState<DialogoDeFerramenta | null>(null);
  const [recadoDaFerramenta, setRecadoDaFerramenta] = useState<string | null>(null);
  // O grupo do ponto de casamento que os cliques põem (ADR 0130): '' é o ponto principal.
  const [grupoDoPontoDeCasamento, setGrupoDoPontoDeCasamento] = useState('');
  const [curvasDoUsuario, setCurvasDoUsuario] = useState<readonly CurvaCadastrada[]>(() =>
    lerCurvasCadastradas(window.localStorage),
  );
  const [curvaEscolhida, setCurvaEscolhida] = useState<{ readonly curva: CurvaCadastrada; readonly espelhar: boolean } | null>(
    null,
  );
  const [espiralPendente, setEspiralPendente] = useState<{ readonly larguraMm: number; readonly perimetroMm: number } | null>(
    null,
  );
  // Bainha e Unir (aba Produção): o que o diálogo da ferramenta deixou escolhido.
  const [opcoesDeBainha, setOpcoesDeBainha] = useState<OpcoesDeBainha>({ dobras: 1, larguraMm: 30, piques: true });
  const [opcoesDaPecaDerivada, setOpcoesDaPecaDerivada] = useState<OpcoesDaPecaDerivada>(OPCOES_PADRAO_DA_PECA_DERIVADA);
  const [opcoesDeCorte, setOpcoesDeCorte] = useState<OpcoesDeCorte>(CORTE_SEM_COSTURA);
  // O "Contorno" do Cortar: no manual, os elementos do corte são indicados um a um e o Enter confirma.
  const [corteManual, setCorteManual] = useState(false);
  const [opcoesDeRemover, setOpcoesDeRemover] = useState<OpcoesDeRemoverRegiao>(REMOVER_REGIAO_SIMPLES);
  // "Editar pontos de curva": o ponto de passagem escolhido, à espera do clique que diz onde ele fica.
  const [alcaDeCurva, setAlcaDeCurva] = useState<AlcaEscolhida | null>(null);
  // "Conferir": as opções da janela e as costuras já indicadas no desenho.
  const [opcoesDaConferencia, setOpcoesDaConferencia] = useState<OpcoesDaConferencia>(OPCOES_INICIAIS_DA_CONFERENCIA);
  const [conferencia, setConferencia] = useState<EstadoDaConferencia>(SEM_CONFERENCIA);
  // "Dobrar": o modo e as opções da janela; "Fio no centro" vale também para o "Desdobrar".
  const [opcoesDeDobrar, setOpcoesDeDobrar] = useState<OpcoesDeDobrar>(OPCOES_INICIAIS_DE_DOBRAR);
  const [unirApenasMovendo, setUnirApenasMovendo] = useState(false);
  const [opcoesDeUniao, setOpcoesDeUniao] = useState<OpcoesDeUniao>(UNIAO_PADRAO);
  // Pences e pregas: o que cada diálogo deixou escolhido.
  const [opcoesDasPences, setOpcoesDasPences] = useState<OpcoesDasPences>(OPCOES_INICIAIS_DAS_PENCES);
  // "Inserir texto": o texto e a altura que o próximo clique põe na peça.
  const [textoAInserir, setTextoAInserir] = useState<{ readonly texto: string; readonly alturaMm: number }>({ texto: '', alturaMm: 10 });
  // Retas e pontos de construção (linhas internas e marcas): o que cada diálogo deixou escolhido.
  const [opcoesDeElemento, setOpcoesDeElemento] = useState<OpcoesDeElemento>(OPCOES_INICIAIS_DE_ELEMENTO);
  // Graduação: as opções dos diálogos, o cadastro de regras deste computador, a
  // regra escolhida em "Regras" e a regra guardada pelo "Copiar" da tabela.
  const [opcoesDaGraduacao, setOpcoesDaGraduacao] = useState<OpcoesDaGraduacao>(OPCOES_INICIAIS_DA_GRADUACAO);
  const [opcoesDeMarcacao, setOpcoesDeMarcacao] = useState<OpcoesDeMarcacao>(() => {
    try {
      const formato = piquePadraoGuardado(window.localStorage);
      return { ...OPCOES_INICIAIS_DE_MARCACAO, inserir: { ...OPCOES_INICIAIS_DE_MARCACAO.inserir, formato }, multiplos: { ...OPCOES_INICIAIS_DE_MARCACAO.multiplos, formato } };
    } catch {
      return OPCOES_INICIAIS_DE_MARCACAO;
    }
  });
  const [regrasDoUsuario, setRegrasDoUsuario] = useState<readonly RegraCadastrada[]>(() =>
    lerRegrasCadastradas(window.localStorage),
  );
  /** Os formatos de pique cadastrados neste computador ("Cadastrar pique"). */
  const [piquesCadastrados, setPiquesCadastrados] = useState<readonly PiqueCadastrado[]>(() => lerPiquesCadastrados(window.localStorage));
  const [regraEscolhida, setRegraEscolhida] = useState<RegraCadastrada | null>(null);
  const [conjuntosDeRegras, setConjuntosDeRegras] = useState<readonly ConjuntoDeRegras[]>(() => lerConjuntosDeRegras(window.localStorage));
  // O conjunto de regras em uso e qual regra dele é a da vez (cada clique que aplica passa para a seguinte).
  const [conjuntoEmUso, setConjuntoEmUso] = useState<{ readonly id: string; readonly posicao: number } | null>(null);
  const vezDoConjunto = useMemo(() => {
    const conjunto = conjuntoEmUso ? conjuntosDeRegras.find((c) => c.id === conjuntoEmUso.id) : undefined;
    const vez = conjunto && conjuntoEmUso ? regraDaVez(conjunto, regrasDoUsuario, conjuntoEmUso.posicao) : null;
    return conjunto && vez ? { ...vez, nome: conjunto.nome } : null;
  }, [conjuntoEmUso, conjuntosDeRegras, regrasDoUsuario]);
  /** A regra que o próximo clique do "Regras" aplica: a da vez do conjunto em uso, ou a regra escolhida. */
  const regraEmUso = vezDoConjunto?.regra ?? regraEscolhida;
  const [regraCopiada, setRegraCopiada] = useState<RegraCadastrada | null>(null);
  // A graduação de pique guardada pelo "Copiar" da tabela dos piques, para o "Colar" em outro.
  const [piqueCopiado, setPiqueCopiado] = useState<GraduacaoDePiqueCopiada | null>(null);
  // Confirmação de uma ação que não muda nada visível no desenho (guardar um
  // ponto de restauração, por exemplo). Vale enquanto as peças e a seleção
  // forem as mesmas de quando foi dada.
  const [aviso, setAviso] = useState<{
    readonly texto: string;
    readonly pecas: readonly Molde[];
    readonly selecionadoId: string | null;
  } | null>(null);

  const [modo, setModo] = useState<ModoDeDesenho>('selecionar');
  // Trocar de ferramenta desliga a Mão/Zoom por janela — o próximo clique é da
  // ferramenta nova — e dispensa o aviso da ação anterior, que senão voltaria
  // a aparecer ao sair da ferramenta.
  const [modoDaFerramentaDeVista, setModoDaFerramentaDeVista] = useState<ModoDeDesenho>(modo);
  if (modo !== modoDaFerramentaDeVista) {
    setModoDaFerramentaDeVista(modo);
    setFerramentaDeVista(null);
    if (aviso) setAviso(null);
  }
  const [pontosEmEdicao, setPontosEmEdicao] = useState<Ponto2D[]>([]);
  const [contornoPendente, setContornoPendente] = useState<Ponto2D[] | null>(null);
  // O registro da figura (círculo, espiral) cujo contorno está pendente: entra na peça quando ela é criada, se o contorno ainda for o dela.
  const [figuraPendente, setFiguraPendente] = useState<FiguraDaPeca | null>(null);
  const [mensagensImportacao, setMensagensImportacao] = useState<readonly string[] | null>(null);

  const [tecido, setTecido] = useState<Tecido | null>(tecidoDeDemonstracao);
  const [enfesto, setEnfesto] = useState<ConfiguracaoDeEnfesto | null>(enfestoDeDemonstracao);
  const [painelAberto, setPainelAberto] = useState<'tecido' | 'enfesto' | null>(null);
  const [mostrarValidacao, setMostrarValidacao] = useState(false);
  // A folga das linhas internas na validação: escolhida no campo da faixa, e guardada neste computador.
  const [folgaForaDaPecaMm, setFolgaForaDaPecaMm] = useState(() => lerFolgaForaDaPeca(window.localStorage));
  const [folgaNoCampo, setFolgaNoCampo] = useState(() => folgaEscrita(lerFolgaForaDaPeca(window.localStorage)));

  const workerDeNestingRef = useRef<Worker | null>(null);
  // O método do encaixe em curso (o cancelar dos pontos de canto fecha o Worker).
  const metodoDoNestingRef = useRef<MetodoDoNesting>('grade');
  const [nestingExecutando, setNestingExecutando] = useState(false);
  const [progressoNesting, setProgressoNesting] = useState<{ colocadas: number; total: number } | null>(null);
  const [resultadoNesting, setResultadoNesting] = useState<ResultadoDeNesting | null>(null);
  const [mostrarPainelDeNesting, setMostrarPainelDeNesting] = useState(false);
  // A fila de encaixes (ADR 0102): lida do disco ao abrir e rodando em segundo plano enquanto o programa está aberto.
  const filaDeEncaixes = useFilaDeEncaixes(window.enfestoCad, criarWorkerDoEncaixe);
  // A fila na rede (ADR 0143): olha a pasta enquanto o programa está aberto.
  const [pastaDaFila] = useState(() => acessoAPasta('fila'));
  const filaNaRede = useFilaNaRede(pastaDaFila, filaDeEncaixes);
  const [mostrarFilaDeEncaixes, setMostrarFilaDeEncaixes] = useState(false);
  // As coleções (ADR 0108): lidas ao abrir, para o aviso de prazos da barra de status.
  const colecoes = useColecoes(window.enfestoCad);
  const [colecoesAbertas, setColecoesAbertas] = useState<ParteDaColecao | null>(null);
  // O dia de hoje muda com o programa aberto (de noite): conferido de hora em hora.
  const [hoje, setHoje] = useState(hojeLocal);
  useEffect(() => {
    const t = setInterval(() => setHoje(hojeLocal()), 3_600_000);
    return () => clearInterval(t);
  }, []);

  const [mostrarExportacaoPdf, setMostrarExportacaoPdf] = useState(false);
  // O planejamento de corte: a janela e o cadastro de produção (lido ao abrir a janela).
  const [mostrarPlanoDeCorte, setMostrarPlanoDeCorte] = useState(false);
  // A pasta de troca com o ERP (ADR 0141): fora do programa (no navegador), não há.
  const [pastaDoErp] = useState(() => acessoAPasta('erp'));
  // A biblioteca na rede (ADR 0142).
  const [pastaDaBiblioteca] = useState(() => acessoAPasta('biblioteca'));
  const [cadastroDeProducao, setCadastroDeProducao] = useState<CadastroCarregado | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [mostrarDimensionar, setMostrarDimensionar] = useState(false);
  const [mostrarPropriedadesDaPeca, setMostrarPropriedadesDaPeca] = useState(false);

  const [projetoAtual, setProjetoAtual] = useState<Projeto>(() =>
    novoProjetoVazio({
      pecas: [],
      tecido: tecidoDeDemonstracao(),
      enfesto: enfestoDeDemonstracao(),
    }),
  );
  const [projetos, setProjetos] = useState<readonly Projeto[]>([]);
  // O que a biblioteca tem a dizer da pasta de projetos (arquivos que não puderam ser lidos, versões mais novas).
  const [avisosDaBiblioteca, setAvisosDaBiblioteca] = useState<readonly string[]>([]);
  // Os códigos de projeto já usados (os da biblioteca e os criados agora): o de um projeto novo é o seguinte do dia.
  const codigosUsadosRef = useRef<Set<string>>(new Set());
  const novoCodigoDeProjeto = useCallback((): string => {
    const codigo = proximoCodigoDeProjeto(new Date().toISOString(), codigosUsadosRef.current);
    codigosUsadosRef.current.add(codigo);
    return codigo;
  }, []);
  // Ao abrir: a biblioteca diz os códigos já usados, e o projeto inicial (ainda não salvo) troca de código
  // se o dele já é de outro projeto.
  useEffect(() => {
    void window.enfestoCad?.listarProjetos().then(
      (bruta) => {
        const lista = lerBiblioteca(bruta).projetos;
        for (const p of lista) codigosUsadosRef.current.add(p.codigo);
        setProjetoAtual((atual) => {
          const salvo = lista.some((p) => p.id === atual.id);
          const deOutro = lista.some((p) => p.codigo === atual.codigo && p.id !== atual.id);
          if (salvo || !deOutro) return atual;
          return { ...atual, codigo: proximoCodigoDeProjeto(new Date().toISOString(), codigosUsadosRef.current) };
        });
      },
      () => {},
    );
  }, []);
  // Imagens do modelo: o painel aberto (pelo "Imagens" ou pelo "Digitalizar"), o
  // erro a mostrar nele e a calibração em curso (os pontos já clicados na imagem).
  const imagens = imagensDoProjeto(projetoAtual);
  const [painelDeImagens, setPainelDeImagens] = useState<'imagens' | 'digitalizar' | null>(null);
  const [erroDasImagens, setErroDasImagens] = useState<string | null>(null);
  const [calibracao, setCalibracao] = useState<{
    readonly imagemId: string;
    readonly pontos: readonly Ponto2D[];
    /** Aberta pelo "Digitalizar": depois de calibrar, liga o "Criar molde" para contornar. */
    readonly contornarDepois: boolean;
  } | null>(null);
  const arquivoDeImagemRef = useRef<HTMLInputElement | null>(null);
  // O nome do arquivo que está sendo importado (DXF ou PDF): vai na origem de cada peça e no histórico.
  const arquivoImportadoRef = useRef('');
  // Atalhos para outros programas: a lista (`null` com o painel fechado) e o erro a mostrar nele.
  const [programas, setProgramas] = useState<readonly Programa[] | null>(null);
  const [erroDosProgramas, setErroDosProgramas] = useState<string | null>(null);
  const [mostrarBiblioteca, setMostrarBiblioteca] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [mostrarNovoProjeto, setMostrarNovoProjeto] = useState(false);

  const problemasDeValidacao = useMemo(
    () => validarProjeto(pecas, enfesto, { ...TOLERANCIAS_PADRAO, folgaForaDaPecaMm }, tecido),
    [pecas, enfesto, folgaForaDaPecaMm, tecido],
  );
  const aproveitamentoAtualDaMesa = useMemo(() => aproveitamentoDaMesa(pecas, enfesto), [pecas, enfesto]);
  const idsComErro = useMemo(
    () =>
      new Set(
        problemasDeValidacao.filter((p) => p.severidade === 'erro').flatMap((p) => p.pecasEnvolvidasIds),
      ),
    [problemasDeValidacao],
  );

  // O último salvamento (o pedido e o automático): a hora em que terminou, ou por que falhou.
  const [salvamento, setSalvamento] = useState<EstadoDoSalvamento | null>(null);
  /** Grava o projeto; a promessa termina depois da gravação (deu certo ou não), e nunca falha. */
  const persistirProjeto = useCallback((projeto: Projeto): Promise<void> => {
    // Uma falha (disco cheio, pasta bloqueada) não trava a edição — o desenho continua na memória —,
    // mas aparece: antes ela era engolida, e quem apertou Ctrl+S achava que tinha salvado.
    const pedido = window.enfestoCad?.salvarProjeto(projeto);
    if (!pedido) return Promise.resolve();
    return pedido.then(
      () => setSalvamento({ ok: true, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }),
      (e: unknown) => setSalvamento({ ok: false, erro: motivoDoErroDeSalvar(e), dispensado: false }),
    );
  }, []);

  const registrarEventoEPersistir = useCallback(
    (tipo: TipoDeEvento, estado: EstadoDoProjeto, descricao?: string) => {
      setProjetoAtual((atual) => {
        const atualizado = registrarEvento(atual, tipo, estado, new Date().toISOString(), descricao);
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );

  const carregarListaDeProjetos = useCallback(() => {
    void window.enfestoCad
      ?.listarProjetos()
      .then((bruta) => {
        // Cada projeto é trazido para a versão atual do formato (o arquivo só muda quando for gravado, com cópia).
        const { projetos: lista, avisos } = lerBiblioteca(bruta);
        for (const p of lista) codigosUsadosRef.current.add(p.codigo);
        setProjetos(lista);
        setAvisosDaBiblioteca(avisos);
      })
      .catch(() => setProjetos([]));
  }, []);

  const aplicarMudanca = useCallback(
    (novasPecas: Molde[]) => {
      setPassado((p) => [...p, pecas]);
      setFuturo([]);
      setPecas(novasPecas);
    },
    [pecas],
  );

  /**
   * Muda o cadastro de piques deste computador como um passo do Ctrl+Z: com as peças novas, se elas também
   * mudaram, ou com as mesmas. Devolve `false`, sem mudar nada, se o cadastro não pôde ser gravado.
   */
  const mudarCadastroDePiques = useCallback(
    (novos: readonly PiqueCadastrado[], novasPecas: Molde[] = [...pecas]): boolean => {
      if (!gravarPiquesCadastrados(window.localStorage, novos)) return false;
      registrarMudancaDoCadastro(novasPecas, piquesCadastrados, novos);
      setPiquesCadastrados(novos);
      aplicarMudanca(novasPecas);
      return true;
    },
    [pecas, piquesCadastrados, aplicarMudanca],
  );

  /** Põe o cadastro de piques como estava do outro lado de um passo do histórico, se há o que pôr. */
  const levarCadastroPara = useCallback((cadastro: readonly PiqueCadastrado[] | null) => {
    if (cadastro && gravarPiquesCadastrados(window.localStorage, cadastro)) setPiquesCadastrados(cadastro);
  }, []);

  // Desfazer/refazer um "Mover cerca" também devolve a cerca à posição
  // correspondente — mas só se ela ainda estiver onde o movimento a deixou
  // (uma cerca redefinida ou removida depois disso fica como está). O mesmo
  // vale para o cadastro de piques, no passo que o mudou.
  const desfazer = useCallback(() => {
    const anterior = passado.at(-1);
    if (!anterior) return;
    const movimento = movimentosDeCercaRef.current.get(pecas);
    if (movimento && mesmaCerca(cerca, movimento.depois)) setCerca(movimento.antes);
    levarCadastroPara(cadastroAoDesfazer(piquesCadastrados, pecas));
    setPassado((p) => p.slice(0, -1));
    setFuturo((f) => [...f, pecas]);
    setPecas(anterior);
  }, [pecas, passado, cerca, piquesCadastrados, levarCadastroPara]);

  const refazer = useCallback(() => {
    const proximo = futuro.at(-1);
    if (!proximo) return;
    const movimento = movimentosDeCercaRef.current.get(proximo);
    if (movimento && mesmaCerca(cerca, movimento.antes)) setCerca(movimento.depois);
    levarCadastroPara(cadastroAoRefazer(piquesCadastrados, proximo));
    setFuturo((f) => f.slice(0, -1));
    setPassado((p) => [...p, pecas]);
    setPecas(proximo);
  }, [pecas, futuro, cerca, piquesCadastrados, levarCadastroPara]);

  /**
   * Tira da peça, num passo do Ctrl+Z, o que a validação apontou nas linhas internas: as soltas (inteiras fora
   * dela), as que saem dela (cada uma sai inteira), ou só o que elas têm de fora (cortadas na borda da peça).
   */
  const tirarLinhasDeFora = useCallback(
    (id: string | undefined, oQue: 'soltas' | 'que-saem' | 'so-o-de-fora') => {
      const peca = pecas.find((p) => p.id === id);
      if (!peca) return;
      const limpa =
        oQue === 'soltas' ? semLinhasSoltas(peca, folgaForaDaPecaMm) : oQue === 'que-saem' ? semLinhasQueSaem(peca, folgaForaDaPecaMm) : semOQueSaiDasLinhas(peca, folgaForaDaPecaMm);
      if (limpa === peca) return;
      aplicarMudanca(pecas.map((p) => (p.id === peca.id ? limpa : p)));
    },
    [pecas, aplicarMudanca, folgaForaDaPecaMm],
  );

  /** O campo da folga: o que está escrito fica no campo; quando é um número que serve, passa a valer e é guardado. */
  const mudarFolgaDaValidacao = useCallback((texto: string) => {
    setFolgaNoCampo(texto);
    const valor = folgaDigitada(texto);
    if (valor === null) return;
    setFolgaForaDaPecaMm(valor);
    gravarFolgaForaDaPeca(window.localStorage, valor);
  }, []);

  // Seleção única "de verdade" (limpa qualquer seleção em lote ativa) — usada
  // sempre que o usuário escolhe UMA peça de propósito (clique no canvas ou
  // na lista), para não deixar os dois modos de seleção coexistindo de forma
  // confusa.
  const selecionarUnico = useCallback((id: string | null) => {
    setSelecionadoId(id);
    setIdsSelecionadosEmLote(new Set());
  }, []);

  /** Duplo-clique numa peça (lista ou canvas): seleciona e abre o diálogo de Propriedades. */
  const abrirPropriedadesDaPeca = useCallback(
    (id: string) => {
      selecionarUnico(id);
      setMostrarPropriedadesDaPeca(true);
    },
    [selecionarUnico],
  );

  const selecionarTudo = useCallback(() => {
    if (pecas.length === 0) return;
    setIdsSelecionadosEmLote(new Set(pecas.map((p) => p.id)));
    setSelecionadoId(null);
  }, [pecas]);

  /** Caixa de seleção de cada item da lista: inclui/remove da seleção em lote, sem mexer na seleção única (`selecionadoId`). */
  const alternarSelecaoEmLote = useCallback((id: string) => {
    setIdsSelecionadosEmLote((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  /** Aplica uma seleção (a peça única ou o lote). */
  const aplicarSelecao = useCallback((selecao: SelecaoDePecas) => {
    setSelecionadoId(selecao.selecionadoId);
    setIdsSelecionadosEmLote(selecao.idsEmLote);
  }, []);

  /** Ctrl+clique (⌘ no Mac) numa peça do desenho: entra na seleção, ou sai dela. */
  const alternarPecaNaSelecao = useCallback(
    (id: string) => aplicarSelecao(alternarNaSelecao({ selecionadoId, idsEmLote: idsSelecionadosEmLote }, id)),
    [selecionadoId, idsSelecionadosEmLote, aplicarSelecao],
  );

  /** O retângulo arrastado no vazio do desenho: as peças inteiras dentro dele (com o Ctrl, somadas às que já estavam). */
  const selecionarPecasPeloRetangulo = useCallback(
    (ids: readonly string[], somar: boolean) => aplicarSelecao(selecionarPeloRetangulo({ selecionadoId, idsEmLote: idsSelecionadosEmLote }, ids, somar)),
    [selecionadoId, idsSelecionadosEmLote, aplicarSelecao],
  );

  const excluirSelecionado = useCallback(() => {
    if (idsSelecionadosEmLote.size > 0) {
      aplicarMudanca(pecas.filter((p) => !idsSelecionadosEmLote.has(p.id)));
      setIdsSelecionadosEmLote(new Set());
      return;
    }
    if (!selecionadoId) return;
    aplicarMudanca(pecas.filter((p) => p.id !== selecionadoId));
    setSelecionadoId(null);
  }, [pecas, selecionadoId, idsSelecionadosEmLote, aplicarMudanca]);

  const duplicarSelecionado = useCallback(() => {
    if (idsSelecionadosEmLote.size > 0) {
      const copias = pecas
        .filter((p) => idsSelecionadosEmLote.has(p.id))
        .map((p) => transladarMolde(p, ponto(30, 30), proximoId()));
      if (copias.length === 0) return;
      aplicarMudanca([...pecas, ...copias]);
      setIdsSelecionadosEmLote(new Set(copias.map((c) => c.id)));
      return;
    }
    const original = pecas.find((p) => p.id === selecionadoId);
    if (!original) return;
    const copia = transladarMolde(original, ponto(30, 30), proximoId());
    aplicarMudanca([...pecas, copia]);
    setSelecionadoId(copia.id);
  }, [pecas, selecionadoId, idsSelecionadosEmLote, aplicarMudanca]);

  /** As peças que a seleção abrange: as do lote marcado na lista ou, sem lote, a selecionada. */
  const pecasDaSelecao = useCallback(
    (): Molde[] => (idsSelecionadosEmLote.size > 0 ? pecas.filter((p) => idsSelecionadosEmLote.has(p.id)) : pecas.filter((p) => p.id === selecionadoId)),
    [pecas, selecionadoId, idsSelecionadosEmLote],
  );

  const copiarSelecionado = useCallback(() => {
    const copiadas = pecasDaSelecao();
    if (copiadas.length > 0) setClipboard(copiadas);
  }, [pecasDaSelecao]);

  const recortarSelecionado = useCallback(() => {
    const recortadas = pecasDaSelecao();
    if (recortadas.length === 0) return;
    setClipboard(recortadas);
    const ids = new Set(recortadas.map((p) => p.id));
    aplicarMudanca(pecas.filter((p) => !ids.has(p.id)));
    setSelecionadoId(null);
    setIdsSelecionadosEmLote(new Set());
  }, [pecas, pecasDaSelecao, aplicarMudanca]);

  const colar = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    const copias = clipboard.map((p) => transladarMolde(p, ponto(30, 30), proximoId()));
    aplicarMudanca([...pecas, ...copias]);
    if (copias.length === 1) {
      setSelecionadoId(copias[0]!.id);
      setIdsSelecionadosEmLote(new Set());
    } else {
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set(copias.map((c) => c.id)));
    }
  }, [pecas, clipboard, aplicarMudanca]);

  const novoProjeto = useCallback(() => {
    if (pecas.length > 0 && !window.confirm('Começar um novo projeto descarta as peças atuais não salvas da tela (o projeto anterior continua na biblioteca, se já foi salvo). Continuar?')) {
      return;
    }
    carregarListaDeProjetos();
    setMostrarNovoProjeto(true);
  }, [pecas, carregarListaDeProjetos]);

  const criarNovoProjetoComDados = useCallback((dados: DadosDeNovoProjeto) => {
    const enfestoInicial = criarConfiguracaoDeEnfesto({
      tipo: 'impar',
      larguraUtilMm: dados.larguraUtilMm,
      comprimentoMm: dados.comprimentoMm,
      quantidadeDeCamadas: 1,
      margemLateralMm: MARGEM_DE_SEGURANCA_DA_MESA_MM,
      margemDeExtremidadeMm: MARGEM_DE_SEGURANCA_DA_MESA_MM,
      distanciaMinimaEntrePecasMm: DISTANCIA_PADRAO_ENTRE_PECAS_MM,
    } as ConfiguracaoDeEnfesto);
    const tecidoInicial = criarTecido(
      {
        nome: dados.tecidoNome,
        referencia: '',
        larguraTotalMm: dados.tecidoLarguraMm,
        larguraUtilMm: dados.tecidoLarguraMm,
        ...(dados.tecidoGramaturaGm2 !== undefined ? { gramaturaGm2: dados.tecidoGramaturaGm2 } : {}),
        ...(dados.tecidoQuantidadeDisponivelKg !== undefined
          ? { quantidadeDisponivelKg: dados.tecidoQuantidadeDisponivelKg }
          : {}),
        ...(dados.tecidoDescricao !== undefined ? { observacoes: dados.tecidoDescricao } : {}),
      },
      `tecido-${Date.now().toString(36)}`,
    );
    setPecas([]);
    setTecido(tecidoInicial);
    setEnfesto(enfestoInicial);
    setSelecionadoId(null);
    setIdsSelecionadosEmLote(new Set());
    setModo('selecionar');
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setPassado([]);
    setFuturo([]);
    setPontosDeRestauracao(new Map());
    setMedicao(SEM_MEDICAO);
    setAviso(null);
    setCerca(null);
    setMostrarMoverCerca(false);
    setProjetoAtual(novoProjetoVazio({ pecas: [], tecido: tecidoInicial, enfesto: enfestoInicial }, dados.nome, novoCodigoDeProjeto()));
    setMostrarNovoProjeto(false);

    // Enquadra a mesa nova inteira na tela. Eixos trocados na tela (ver
    // comentário em ui/transformacaoDeTela.ts): comprimento ocupa a
    // horizontal, largura a vertical — a mesa sempre aparece deitada, sem
    // depender de qual das duas medidas o usuário informou maior. As vistas
    // guardadas eram da mesa anterior e deixam de valer.
    setTransform(
      enquadrarRetanguloDoMundo(
        { minX: 0, minY: 0, maxX: enfestoInicial.larguraUtilMm, maxY: enfestoInicial.comprimentoMm },
        tamanhoDaTela,
      ),
    );
    setVistasAnteriores([]);
    setVistasSeguintes([]);
  }, [tamanhoDaTela, novoCodigoDeProjeto]);

  const salvarProjetoAtual = useCallback(() => {
    registrarEventoEPersistir('salvamento', { pecas, tecido, enfesto });
  }, [pecas, tecido, enfesto, registrarEventoEPersistir]);

  /** "Salvar como": o nome é pedido numa janela do programa. */
  const salvarComo = useCallback(() => setDialogoDeFerramenta({ tipo: 'salvar-como' }), []);

  /** Grava o desenho atual como um projeto novo, com o nome dado, e passa a trabalhar nele. */
  const salvarComoNovoProjeto = useCallback(
    (nome: string) => {
      const novo = novoProjetoVazio({ pecas, tecido, enfesto }, undefined, novoCodigoDeProjeto());
      const agora = new Date().toISOString();
      // A cópia é do mesmo modelo: o autor vai junto.
      const comAutor = definirAutor(renomearProjeto(novo, nome, agora), projetoAtual.autor ?? '', agora);
      const renomeado = projetoAtual.imagens ? { ...comAutor, imagens: projetoAtual.imagens } : comAutor;
      setProjetoAtual(renomeado);
      persistirProjeto(renomeado);
    },
    [pecas, tecido, enfesto, projetoAtual.autor, projetoAtual.imagens, persistirProjeto, novoCodigoDeProjeto],
  );

  const abrirBiblioteca = useCallback(() => {
    carregarListaDeProjetos();
    setMostrarBiblioteca(true);
  }, [carregarListaDeProjetos]);

  /** Põe na tela um projeto já carregado, com tudo o que era do anterior limpo e a vista enquadrada. */
  const mostrarProjeto = useCallback(
    (projeto: Projeto) => {
      setPecas([...projeto.estadoAtual.pecas]);
      setTecido(projeto.estadoAtual.tecido);
      setEnfesto(projeto.estadoAtual.enfesto);
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set());
      // Um contorno pela metade era do projeto anterior.
      setModo('selecionar');
      setPontosEmEdicao([]);
      setContornoPendente(null);
      setPassado([]);
      setFuturo([]);
      setPontosDeRestauracao(new Map());
      setMedicao(SEM_MEDICAO);
      setAviso(null);
      setCerca(null);
      setMostrarMoverCerca(false);
      setProjetoAtual(projeto);
      setMostrarBiblioteca(false);
      // Enquadra o projeto aberto, como "Ajustar à tela". As vistas guardadas
      // eram do projeto anterior e deixam de valer.
      const retangulo = retanguloDoDesenho(projeto.estadoAtual.pecas, projeto.estadoAtual.enfesto, imagensDoProjeto(projeto));
      if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela));
      setVistasAnteriores([]);
      setVistasSeguintes([]);
    },
    [tamanhoDaTela],
  );

  /** Salva o projeto aberto como está, para trocar de projeto sem perder o que não foi salvo. */
  const salvarAntesDeTrocar = useCallback((): Projeto => {
    const salvo = registrarEvento(projetoAtual, 'salvamento', { pecas, tecido, enfesto }, new Date().toISOString());
    persistirProjeto(salvo);
    return salvo;
  }, [projetoAtual, pecas, tecido, enfesto, persistirProjeto]);

  const abrirProjeto = useCallback(
    (id: string) => {
      // O que mudou desde o último salvamento é salvo antes de trocar (como nas Variantes): antes, abrir outro
      // projeto descartava sem aviso o trabalho do último minuto, que o salvamento automático ainda não tinha pego.
      const mudou = JSON.stringify(projetoAtual.estadoAtual) !== JSON.stringify({ pecas, tecido, enfesto });
      const atual = mudou ? salvarAntesDeTrocar() : projetoAtual;
      if (mudou) setProjetos((lista) => [...lista.filter((p) => p.id !== atual.id), atual]);
      // Reabrir o próprio projeto aberto mostra a versão de agora, e não a da lista (que pode ser mais velha).
      const projeto = id === atual.id ? atual : projetos.find((p) => p.id === id);
      if (projeto) mostrarProjeto(projeto);
    },
    [projetos, projetoAtual, pecas, tecido, enfesto, salvarAntesDeTrocar, mostrarProjeto],
  );

  // A biblioteca na rede (ADR 0142): o projeto como está agora (o aberto, salvo antes se mudou), para publicar ou
  // devolver; e a cópia trazida da rede, que entra na biblioteca deste computador (e na tela, se for o aberto).
  const projetoParaEnviarARede = useCallback(
    (id: string): Projeto | null => {
      if (id !== projetoAtual.id) return projetos.find((p) => p.id === id) ?? null;
      if (JSON.stringify(projetoAtual.estadoAtual) === JSON.stringify({ pecas, tecido, enfesto })) return projetoAtual;
      const salvo = salvarAntesDeTrocar();
      setProjetoAtual(salvo);
      setProjetos((lista) => [...lista.filter((p) => p.id !== salvo.id), salvo]);
      return salvo;
    },
    [projetoAtual, projetos, pecas, tecido, enfesto, salvarAntesDeTrocar],
  );

  const trazerProjetoDaRede = useCallback(
    (projeto: Projeto): string | null => {
      if (projeto.id === projetoAtual.id && JSON.stringify(projetoAtual.estadoAtual) !== JSON.stringify({ pecas, tecido, enfesto })) {
        return 'o projeto aberto tem mudanças ainda não salvas: salve (Ctrl+S) e tente de novo.';
      }
      setProjetos((lista) => [...lista.filter((p) => p.id !== projeto.id), projeto]);
      if (projeto.id === projetoAtual.id) {
        mostrarProjeto(projeto);
        // Mostrar o projeto fecha a Biblioteca; aqui ela continua aberta, com a lista da rede.
        setMostrarBiblioteca(true);
      }
      void persistirProjeto(projeto).then(carregarListaDeProjetos);
      return null;
    },
    [projetoAtual, pecas, tecido, enfesto, mostrarProjeto, persistirProjeto, carregarListaDeProjetos],
  );

  // O look vestido no manequim (ADR 0155): o provador com as peças dos modelos juntas; nada volta para os projetos.
  const [lookNoProvador, setLookNoProvador] = useState<{
    readonly nome: string;
    readonly primeiro: Projeto;
    readonly imagens: ReturnType<typeof imagensDoProjeto>;
    readonly pecas: readonly Molde[];
    readonly montagem: Montagem3D;
  } | null>(null);
  const vestirLook = useCallback(
    (nome: string, projetoIds: readonly string[]): string | null => {
      const lista = projetoIds.flatMap((id) => {
        const p = id === projetoAtual.id ? projetoAtual : projetos.find((x) => x.id === id);
        return p ? [p] : [];
      });
      try {
        const look = montagemDoLook(lista.map((p) => ({ nome: p.nome, pecas: p.estadoAtual.pecas, montagem: lerMontagem3d(p.montagem3d) })));
        setLookNoProvador({ nome, primeiro: lista[0]!, imagens: lista.flatMap((p) => imagensDoProjeto(p)), pecas: look.pecas, montagem: look.montagem });
        setColecoesAbertas(null);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [projetoAtual, projetos],
  );

  // Variantes (aba Modelo): cópias do projeto aberto, guardadas na Biblioteca.
  const abrirVariantes = useCallback(() => {
    carregarListaDeProjetos();
    setMostrarVariantes(true);
  }, [carregarListaDeProjetos]);

  const criarVarianteDoProjeto = useCallback(
    (nome: string): string | null => {
      const salvo = salvarAntesDeTrocar();
      const agora = new Date().toISOString();
      const variante = criarVariante(
        salvo,
        nome,
        `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        novoCodigoDeProjeto(),
        agora,
        { pecas, tecido, enfesto },
      );
      persistirProjeto(variante);
      // A lista já fica certa na tela, sem esperar a releitura do disco.
      setProjetos((lista) => [...lista.filter((p) => p.id !== salvo.id), salvo, variante]);
      mostrarProjeto(variante);
      return null;
    },
    [pecas, tecido, enfesto, salvarAntesDeTrocar, persistirProjeto, mostrarProjeto, novoCodigoDeProjeto],
  );

  // A biblioteca de bases aprovadas (ADR 0126).
  /**
   * Muda um projeto da biblioteca e grava. O aberto entra com as peças da tela (o que mudou desde o último salvamento
   * é salvo junto): aprovar o aberto como base aprova o molde que se vê.
   */
  const mudarProjetoDaBiblioteca = useCallback(
    (id: string, mudar: (projeto: Projeto, agoraIso: string) => Projeto) => {
      const agora = new Date().toISOString();
      const aberto = id === projetoAtual.id;
      const mudou = aberto && JSON.stringify(projetoAtual.estadoAtual) !== JSON.stringify({ pecas, tecido, enfesto });
      const projeto = aberto ? (mudou ? registrarEvento(projetoAtual, 'salvamento', { pecas, tecido, enfesto }, agora) : projetoAtual) : projetos.find((p) => p.id === id);
      if (!projeto) return;
      const atualizado = mudar(projeto, agora);
      setProjetos((lista) => [...lista.filter((p) => p.id !== id), atualizado]);
      if (aberto) setProjetoAtual(atualizado);
      void persistirProjeto(atualizado).then(carregarListaDeProjetos);
    },
    [projetos, projetoAtual, pecas, tecido, enfesto, persistirProjeto, carregarListaDeProjetos],
  );

  const aprovarComoBaseDaBiblioteca = useCallback(
    (id: string, responsavel: string, nota: string): string | null => {
      try {
        mudarProjetoDaBiblioteca(id, (p, agora) => aprovarComoBase(p, { responsavel, nota }, agora));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [mudarProjetoDaBiblioteca],
  );

  const tirarDasBasesDaBiblioteca = useCallback((id: string) => mudarProjetoDaBiblioteca(id, tirarDasBases), [mudarProjetoDaBiblioteca]);

  /** O modelo novo feito da base: gravado na biblioteca e aberto (o aberto antes é salvo, se mudou). */
  const novoModeloDaBase = useCallback(
    (id: string, nome: string): string | null => {
      const mudou = JSON.stringify(projetoAtual.estadoAtual) !== JSON.stringify({ pecas, tecido, enfesto });
      const base = id === projetoAtual.id ? projetoAtual : projetos.find((p) => p.id === id);
      if (!base) return 'A base não está mais na biblioteca.';
      let modelo: Projeto;
      try {
        modelo = modeloDaBase(
          // A base aberta entra com as peças da tela, como as outras ações da biblioteca.
          id === projetoAtual.id && mudou ? { ...base, estadoAtual: { pecas, tecido, enfesto } } : base,
          nome,
          `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          novoCodigoDeProjeto(),
          new Date().toISOString(),
          impressaoDigitalDoMolde(id === projetoAtual.id && mudou ? pecas : base.estadoAtual.pecas),
        );
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      const atual = mudou ? salvarAntesDeTrocar() : projetoAtual;
      persistirProjeto(modelo);
      setProjetos((lista) => (mudou ? [...lista.filter((p) => p.id !== atual.id), atual, modelo] : [...lista, modelo]));
      mostrarProjeto(modelo);
      return null;
    },
    [projetos, projetoAtual, pecas, tecido, enfesto, salvarAntesDeTrocar, persistirProjeto, mostrarProjeto, novoCodigoDeProjeto],
  );

  /** As peças de uma base no projeto aberto, à direita das que ele já tem, marcadas e enquadradas. */
  const porPecasDaBase = useCallback(
    (id: string) => {
      const base = projetos.find((p) => p.id === id);
      if (!base) return;
      let novas: Molde[];
      try {
        novas = pecasDaBase(base, pecas, proximoId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
        return;
      }
      const novasPecas = [...pecas, ...novas];
      aplicarMudanca(novasPecas);
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set(novas.map((p) => p.id)));
      setMostrarBiblioteca(false);
      const retangulo = retanguloDoDesenho(novasPecas, enfesto, imagens);
      if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela));
      setAviso({
        texto: `${novas.length === 1 ? 'A peça' : `As ${novas.length} peças`} da base “${base.nome}” (${novas.map((p) => p.nome).join(', ')}) ${novas.length === 1 ? 'entrou' : 'entraram'} no projeto, à direita das que ele já tinha, ${novas.length === 1 ? 'marcada' : 'marcadas'}. Ctrl+Z desfaz.`,
        pecas: novasPecas,
        selecionadoId: null,
      });
    },
    [projetos, pecas, enfesto, imagens, tamanhoDaTela, aplicarMudanca],
  );

  const abrirVarianteDoProjeto = useCallback(
    (id: string) => {
      const variante = projetos.find((p) => p.id === id);
      if (!variante) return;
      const salvo = salvarAntesDeTrocar();
      setProjetos((lista) => lista.map((p) => (p.id === salvo.id ? salvo : p)));
      mostrarProjeto(variante);
    },
    [projetos, salvarAntesDeTrocar, mostrarProjeto],
  );

  const duplicarProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      const agora = new Date().toISOString();
      const copia = criarProjeto(`${projeto.nome} (cópia)`, `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, novoCodigoDeProjeto(), agora, projeto.estadoAtual);
      // A lista muda na hora, e é relida do disco só depois de gravado: lida junto com a gravação, ela
      // podia chegar antes, e a cópia (o nome novo, o arquivado) não aparecia.
      setProjetos((lista) => [...lista, copia]);
      void persistirProjeto(copia).then(carregarListaDeProjetos);
    },
    [projetos, persistirProjeto, carregarListaDeProjetos, novoCodigoDeProjeto],
  );

  const renomearProjetoDaBiblioteca = useCallback(
    (id: string, novoNome: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto || !novoNome.trim()) return;
      const atualizado = renomearProjeto(projeto, novoNome.trim(), new Date().toISOString());
      setProjetos((lista) => lista.map((p) => (p.id === id ? atualizado : p)));
      if (id === projetoAtual.id) setProjetoAtual(atualizado);
      void persistirProjeto(atualizado).then(carregarListaDeProjetos);
    },
    [projetos, projetoAtual.id, persistirProjeto, carregarListaDeProjetos],
  );

  const arquivarProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      const atualizado = alterarStatus(projeto, 'arquivado', new Date().toISOString());
      setProjetos((lista) => lista.map((p) => (p.id === id ? atualizado : p)));
      if (id === projetoAtual.id) setProjetoAtual(atualizado);
      void persistirProjeto(atualizado).then(carregarListaDeProjetos);
    },
    [projetos, projetoAtual.id, persistirProjeto, carregarListaDeProjetos],
  );

  const excluirProjetoDaBiblioteca = useCallback(
    (id: string) => {
      const projeto = projetos.find((p) => p.id === id);
      if (!projeto) return;
      if (!window.confirm(`Excluir permanentemente o projeto "${projeto.nome}"? Esta ação não pode ser desfeita.`)) {
        return;
      }
      void window.enfestoCad
        ?.excluirProjeto(id)
        .then(() => {
          carregarListaDeProjetos();
          if (id === projetoAtual.id) {
            setPecas([]);
            setTecido(null);
            setEnfesto(null);
            setSelecionadoId(null);
            setIdsSelecionadosEmLote(new Set());
            setPassado([]);
            setFuturo([]);
            setPontosDeRestauracao(new Map());
            setMedicao(SEM_MEDICAO);
            setAviso(null);
            setCerca(null);
            setMostrarMoverCerca(false);
            setProjetoAtual(novoProjetoVazio({ pecas: [], tecido: null, enfesto: null }, undefined, novoCodigoDeProjeto()));
          }
        })
        .catch(() => window.alert('Falha ao excluir o projeto.'));
    },
    [projetos, projetoAtual.id, carregarListaDeProjetos, novoCodigoDeProjeto],
  );

  const restaurarVersaoDoHistorico = useCallback(
    (idDoEvento: string) => {
      const agora = new Date().toISOString();
      const naTela = { pecas, tecido, enfesto };
      // O que estava na tela sem salvar vira uma versão do histórico antes de ser trocado: antes ele se perdia
      // (o restaurar também limpa o Ctrl+Z).
      const base =
        JSON.stringify(projetoAtual.estadoAtual) !== JSON.stringify(naTela)
          ? registrarEvento(projetoAtual, 'salvamento', naTela, agora, 'O que estava na tela antes de restaurar')
          : projetoAtual;
      const atualizado = restaurarVersao(base, idDoEvento, agora);
      setPecas([...atualizado.estadoAtual.pecas]);
      setTecido(atualizado.estadoAtual.tecido);
      setEnfesto(atualizado.estadoAtual.enfesto);
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set());
      setPassado([]);
      setFuturo([]);
      setPontosDeRestauracao(new Map());
      setMedicao(SEM_MEDICAO);
      setAviso(null);
      setCerca(null);
      setMostrarMoverCerca(false);
      setProjetoAtual(atualizado);
      persistirProjeto(atualizado);
    },
    [projetoAtual, pecas, tecido, enfesto, persistirProjeto],
  );

  // Histórico de vistas ("Vista anterior"/"Próxima vista"): cada mudança de
  // enquadramento feita pelo usuário guarda a vista de antes. A área de
  // desenho chama `guardarVista` antes de mão, roda e zoom por janela; os
  // comandos daqui passam por `mudarVistaPara`.
  const guardarVista = useCallback(() => {
    setVistasAnteriores((pilha) => empilharVista(pilha, transform));
    setVistasSeguintes([]);
  }, [transform]);

  const mudarVistaPara = useCallback(
    (nova: TransformacaoDeTela) => {
      if (mesmaVista(nova, transform)) return;
      guardarVista();
      setTransform(nova);
    },
    [transform, guardarVista],
  );

  const vistaAnterior = useCallback(() => {
    const anterior = vistasAnteriores.at(-1);
    if (!anterior) return;
    setVistasAnteriores((pilha) => pilha.slice(0, -1));
    setVistasSeguintes((pilha) => [...pilha, transform]);
    setTransform(anterior);
  }, [vistasAnteriores, transform]);

  const proximaVista = useCallback(() => {
    const proxima = vistasSeguintes.at(-1);
    if (!proxima) return;
    setVistasSeguintes((pilha) => pilha.slice(0, -1));
    setVistasAnteriores((pilha) => empilharVista(pilha, transform));
    setTransform(proxima);
  }, [vistasSeguintes, transform]);

  /** Zoom pelos botões e teclas: em torno do centro da área de desenho. */
  const zoom = useCallback(
    (fator: number) => {
      mudarVistaPara(aplicarZoom(transform, fator, { x: tamanhoDaTela.largura / 2, y: tamanhoDaTela.altura / 2 }));
    },
    [transform, tamanhoDaTela, mudarVistaPara],
  );

  const ajustarTela = useCallback(() => {
    // Sem peças nem enfesto configurados, não há nada real para enquadrar —
    // mantém o reset antigo. Com enfesto configurado, a mesa real (mesmo
    // vazia) é o retângulo de referência, para aparecer inteira e retangular
    // assim que o projeto é criado, sem precisar de "Ajustar" manual.
    const retangulo = retanguloDoDesenho(pecas, enfesto, imagens);
    mudarVistaPara(
      retangulo
        ? enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela)
        : { escalaPxPorMm: 1, offsetXPx: 80, offsetYPx: 80 },
    );
  }, [pecas, enfesto, imagens, tamanhoDaTela, mudarVistaPara]);

  // A área de desenho avisa o tamanho real assim que é montada (e a cada
  // redimensionamento). Na primeira medida de verdade, a vista inicial —
  // calculada antes, com um tamanho provisório — é refeita para esse
  // tamanho, uma vez só: depois disso, redimensionar a janela não mexe no
  // enquadramento que o usuário escolheu.
  const aoMudarTamanhoDaTela = useCallback(
    (tamanho: { readonly largura: number; readonly altura: number }) => {
      setTamanhoDaTela(tamanho);
      if (vistaInicialEnquadradaRef.current || tamanho.largura < 50 || tamanho.altura < 50) return;
      vistaInicialEnquadradaRef.current = true;
      const retangulo = retanguloDoDesenho(pecas, enfesto, imagens);
      if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanho));
    },
    [pecas, enfesto, imagens],
  );

  const pecaSelecionada = useMemo(() => pecas.find((p) => p.id === selecionadoId) ?? null, [pecas, selecionadoId]);

  const cancelarModo = useCallback(() => {
    setModo('selecionar');
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setFerramentaDeVista(null);
    setPontosParaModificar(null);
    setRedefinicaoDePerimetro(null);
    setMedicao(SEM_MEDICAO);
    setDonoDaCota(null);
    setTrecho(SEM_TRECHO);
    setDialogoDeFerramenta(null);
    setRecadoDaFerramenta(null);
    setCalibracao(null);
    setConferencia(SEM_CONFERENCIA);
    setAlcaDeCurva(null);
  }, []);

  const alternarFerramentaDeVista = useCallback((ferramenta: FerramentaDeVista) => {
    setFerramentaDeVista((atual) => (atual === ferramenta ? null : ferramenta));
  }, []);

  /** Sem cerca: entra no modo de definir cerca (ou sai dele). Com cerca: remove a cerca. */
  const alternarDefinirCerca = useCallback(() => {
    if (cerca) {
      setCerca(null);
      setMostrarMoverCerca(false);
      return;
    }
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setModo((atual) => (atual === 'definir-cerca' ? 'selecionar' : 'definir-cerca'));
  }, [cerca]);

  const definirCerca = useCallback((nova: Cerca) => {
    setCerca(nova);
    setModo('selecionar');
  }, []);

  const alvosDaCerca = useMemo(
    () => pecasAlvoDaCerca(pecas, idsSelecionadosEmLote, selecionadoId),
    [pecas, idsSelecionadosEmLote, selecionadoId],
  );

  /** Aplica "Mover cerca"; devolve a mensagem de erro (nada muda) ou `null`. A cerca acompanha o movimento. */
  const aplicarMoverCerca = useCallback(
    (delta: Ponto2D, opcoes: OpcoesDeMoverCerca): string | null => {
      if (!cerca) return 'Defina uma cerca primeiro.';
      const alvos = new Set(alvosDaCerca.map((p) => p.id));
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) =>
          alvos.has(p.id) && cercaAfetaMolde(p, cerca, opcoes) ? moverDentroDaCerca(p, cerca, delta, opcoes) : p,
        );
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      const depois = transladarCerca(cerca, delta);
      movimentosDeCercaRef.current.set(novasPecas, { antes: cerca, depois });
      aplicarMudanca(novasPecas);
      setCerca(depois);
      return null;
    },
    [cerca, pecas, alvosDaCerca, aplicarMudanca],
  );

  const entrarModoNovoMolde = useCallback(() => {
    setModo('novo-molde');
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setRecadoDaFerramenta(null);
  }, []);

  const entrarModoRetangulo = useCallback(() => {
    setModo('retangulo');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, []);

  const entrarModoSentidoDoFio = useCallback(() => {
    if (!selecionadoId) return;
    setModo('sentido-do-fio');
    setPontosEmEdicao([]);
    setContornoPendente(null);
  }, [selecionadoId]);

  const entrarModoDeMedida = useCallback((ferramenta: FerramentaDeMedida) => {
    setModo(ferramenta);
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setMedicao(SEM_MEDICAO);
  }, []);

  /** Liga uma ferramenta de desenho da aba Construção, começando do zero. */
  const entrarModoDeConstrucao = useCallback((ferramenta: ModoDeDesenho) => {
    setModo(ferramenta);
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setTrecho(SEM_TRECHO);
    setDialogoDeFerramenta(null);
    setRecadoDaFerramenta(null);
  }, []);

  /** As ferramentas que mexem no contorno precisam de uma peça selecionada. */
  const entrarModoNaPecaSelecionada = useCallback(
    (ferramenta: FerramentaDeTrecho | FerramentaDeCanto) => {
      if (selecionadoId) entrarModoDeConstrucao(ferramenta);
    },
    [selecionadoId, entrarModoDeConstrucao],
  );

  /** Ferramentas da aba Produção: as que têm opções pedem-nas antes, num diálogo; as outras ligam direto. */
  const usarFerramentaDeMolde = useCallback(
    (ferramenta: FerramentaDeMolde | FerramentaDePence) => {
      if (!selecionadoId) return;
      if (ferramenta === 'bainha' || ferramenta === 'forro-entretela-vista' || ferramenta === 'unir' || ferramenta === 'dobrar' || ferramenta === 'cortar' || ferramenta === 'remover-regiao') {
        setDialogoDeFerramenta({ tipo: ferramenta });
      }
      else if (ehFerramentaDePence(ferramenta) && dialogoDaPence(ferramenta, opcoesDasPences)) {
        setDialogoDeFerramenta({ tipo: 'pence', ferramenta });
      } else entrarModoDeConstrucao(ferramenta);
    },
    [selecionadoId, opcoesDasPences, entrarModoDeConstrucao],
  );

  const entrarModoDeCota = useCallback((ferramenta: FerramentaDeCota) => {
    setModo(ferramenta);
    setPontosEmEdicao([]);
    setContornoPendente(null);
    setDonoDaCota(null);
  }, []);

  const entrarModoNovoFuro = useCallback(() => {
    if (!selecionadoId) return;
    setModo('novo-furo');
    setPontosEmEdicao([]);
  }, [selecionadoId]);


  const entrarModoMoverPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('mover-ponto');
  }, [selecionadoId]);

  const entrarModoInserirPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('inserir-ponto');
  }, [selecionadoId]);

  const entrarModoExcluirPonto = useCallback(() => {
    if (!selecionadoId) return;
    setModo('excluir-ponto');
  }, [selecionadoId]);

  const entrarModoArredondarOuChanfrar = useCallback(() => {
    if (!selecionadoId) return;
    setModo('arredondar-ou-chanfrar');
  }, [selecionadoId]);

  const entrarModoModificar = useCallback(() => {
    if (!selecionadoId) return;
    setModo('modificar');
    setPontosParaModificar(null);
  }, [selecionadoId]);

  const entrarModoRedefinirPerimetro = useCallback(() => {
    if (!selecionadoId) return;
    setModo('redefinir-perimetro');
    setRedefinicaoDePerimetro(null);
  }, [selecionadoId]);

  const alterarPecaSelecionada = useCallback(
    (patch: PatchDeMolde) => {
      if (!selecionadoId) return;
      const { emPar, grupoDoEncaixe, meiaCamada, ...resto } = patch;
      aplicarMudanca(
        pecas.map((p) => {
          if (p.id !== selecionadoId) return p;
          const mudada = comPar(comMeiaCamada({ ...p, ...resto }, meiaCamada ?? p.meiaCamada === true), emPar ?? p.emPar === true);
          return grupoDoEncaixe === undefined ? mudada : comGrupoDoEncaixe(mudada, grupoDoEncaixe);
        }),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** O grupo do encaixe de uma peça, mudado na janela do Nesting automático (ADR 0103). */
  const alterarGrupoDaPeca = useCallback(
    (pecaId: string, grupo: string) => aplicarMudanca(pecas.map((p) => (p.id === pecaId ? comGrupoDoEncaixe(p, grupo) : p))),
    [pecas, aplicarMudanca],
  );

  /** Diz, na faixa de mensagens, o que uma ação acabou de fazer — até a próxima mudança nas peças ou na seleção. */
  const avisar = useCallback(
    (texto: string, pecasDepois: readonly Molde[] = pecas) => setAviso({ texto, pecas: pecasDepois, selecionadoId }),
    [pecas, selecionadoId],
  );

  /** "Extrair todas" (ADR 0128): as regiões da selecionada viram peças, de uma vez, marcadas e enquadradas. */
  const extrairTodasAsRegioesDaSelecionada = useCallback(() => {
    if (!pecaSelecionada) return;
    const resultado = extrairTodasAsRegioes(pecas, pecaSelecionada, proximoId);
    if (!resultado.pecas) {
      avisar(resultado.recado);
      return;
    }
    aplicarMudanca(resultado.pecas);
    setSelecionadoId(null);
    setIdsSelecionadosEmLote(new Set(resultado.novas.map((p) => p.id)));
    const retangulo = retanguloDoDesenho(resultado.pecas, enfesto, imagens);
    if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela));
    setAviso({ texto: resultado.recado, pecas: resultado.pecas, selecionadoId: null });
  }, [pecaSelecionada, pecas, enfesto, imagens, tamanhoDaTela, aplicarMudanca, avisar]);

  // ---- Planejamento de corte (aba Encaixe > Planejamento de corte). O cadastro de produção é lido ao abrir.
  const abrirPlanejamento = useCallback(() => {
    carregarListaDeProjetos();
    setMostrarPlanoDeCorte(true);
    let armazenamento: Storage | null = null;
    try {
      armazenamento = window.localStorage;
    } catch {
      armazenamento = null;
    }
    void carregarCadastro(window.enfestoCad, armazenamento).then(setCadastroDeProducao);
  }, [carregarListaDeProjetos]);

  // ---- A biblioteca de materiais e aviamentos (aba Modelo, ADR 0104): lida ao abrir, com o cadastro (as malhas).
  const [bibliotecaDeMateriais, setBibliotecaDeMateriais] = useState<BibliotecaCarregada | null>(null);
  const [mostrarMateriais, setMostrarMateriais] = useState(false);
  const abrirMateriais = useCallback(() => {
    setMostrarMateriais(true);
    let armazenamento: Storage | null = null;
    try {
      armazenamento = window.localStorage;
    } catch {
      armazenamento = null;
    }
    void carregarBibliotecaDeMateriais(window.enfestoCad, armazenamento).then(setBibliotecaDeMateriais);
    void carregarCadastro(window.enfestoCad, armazenamento).then(setCadastroDeProducao);
    // Os projetos da Biblioteca: o custo de cada modelo com ficha técnica (aba Custos dos modelos).
    carregarListaDeProjetos();
  }, [carregarListaDeProjetos]);
  const mudarBibliotecaDeMateriais = useCallback(async (nova: BibliotecaDeMateriais): Promise<string | null> => {
    let armazenamento: Storage | null = null;
    try {
      armazenamento = window.localStorage;
    } catch {
      armazenamento = null;
    }
    const erro = await gravarBibliotecaDeMateriais(window.enfestoCad, armazenamento, nova);
    if (erro === null) setBibliotecaDeMateriais((atual) => ({ avisos: atual?.avisos ?? [], somenteLeitura: atual?.somenteLeitura ?? false, biblioteca: nova }));
    return erro;
  }, []);

  // ---- A ficha técnica e o pré-custo (aba Modelo, ADR 0105 e 0106): a do projeto, ou uma nova; a biblioteca lida ao abrir.
  const [fichaAberta, setFichaAberta] = useState<{ readonly ficha: FichaTecnica; readonly parte: ParteDaFicha } | null>(null);
  const abrirFichaTecnica = useCallback(
    (parte: ParteDaFicha) => {
      let armazenamento: Storage | null = null;
      try {
        armazenamento = window.localStorage;
      } catch {
        armazenamento = null;
      }
      void carregarBibliotecaDeMateriais(window.enfestoCad, armazenamento).then(setBibliotecaDeMateriais);
      const ficha =
        lerFichaTecnica(projetoAtual.fichaTecnica) ??
        novaFichaTecnica({ nome: projetoAtual.nome, codigo: projetoAtual.codigo, ...(projetoAtual.autor ? { autor: projetoAtual.autor } : {}), pecas }, new Date().toISOString());
      setFichaAberta({ ficha, parte });
    },
    [projetoAtual, pecas],
  );
  /** A ficha mudada vai para o projeto e é gravada (a janela chama meio segundo depois da última mudança). */
  const guardarFichaTecnica = useCallback(
    (ficha: FichaTecnica) => {
      setProjetoAtual((atual) => {
        const atualizado = definirFichaTecnica(atual, ficha, new Date().toISOString());
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );
  const exportarPdfDaFicha = useCallback(
    async (ficha: FichaTecnica, preCusto: PreCusto, porTamanho: readonly CustoDoTamanho[]) => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      try {
        const blob = await gerarPdfDaFichaTecnica(ficha, preCusto, pecas, new Date().toISOString(), imagensDoProjeto(projetoAtual), porTamanho);
        const nome = `ficha-tecnica-${(ficha.referencia || projetoAtual.codigo).replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`;
        const caminhoSalvo = await api.salvarArquivo(nome, await blob.arrayBuffer());
        if (caminhoSalvo) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Ficha técnica (PDF, versão ${ficha.versao}) salva em ${caminhoSalvo}`);
      } catch (e) {
        window.alert(`Falha ao gerar o PDF da ficha técnica: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [pecas, tecido, enfesto, projetoAtual, registrarEventoEPersistir],
  );

  // ---- O desenho técnico (aba Modelo, ADR 0107): o croqui da ficha técnica; a ficha aprovada só deixa ver.
  const [desenhoAberto, setDesenhoAberto] = useState<{
    readonly desenho: DesenhoTecnico;
    readonly somenteLeitura: string | null;
    /** Os pontos de medida e os tamanhos da ficha: a letra e os valores das cotas (ADR 0117). */
    readonly medidas: readonly PontoDeMedida[];
    readonly tamanhos: readonly string[];
  } | null>(null);
  const abrirDesenhoTecnico = useCallback(
    (fichaDada?: FichaTecnica) => {
      const ficha =
        fichaDada ??
        lerFichaTecnica(projetoAtual.fichaTecnica) ??
        novaFichaTecnica({ nome: projetoAtual.nome, codigo: projetoAtual.codigo, ...(projetoAtual.autor ? { autor: projetoAtual.autor } : {}), pecas }, new Date().toISOString());
      setFichaAberta(null);
      setDesenhoAberto({
        desenho: ficha.desenho ?? DESENHO_VAZIO,
        medidas: ficha.medidas,
        tamanhos: ficha.tamanhos,
        somenteLeitura: fichaEditavel(ficha)
          ? null
          : `A ficha está ${ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao].toLowerCase()} (versão ${ficha.versao}): o desenho só pode ser visto. Para mudar, abra uma nova versão (Ficha técnica › Aprovação).`,
      });
    },
    [projetoAtual, pecas],
  );
  /** O desenho vai para a ficha do projeto (criada, se ainda não há) e é gravado. */
  const guardarDesenhoTecnico = useCallback(
    (desenho: DesenhoTecnico) => {
      setProjetoAtual((atual) => {
        const agora = new Date().toISOString();
        const ficha =
          lerFichaTecnica(atual.fichaTecnica) ??
          novaFichaTecnica({ nome: atual.nome, codigo: atual.codigo, ...(atual.autor ? { autor: atual.autor } : {}), pecas: atual.estadoAtual.pecas }, agora);
        if (!fichaEditavel(ficha)) return atual;
        const atualizado = definirFichaTecnica(atual, definirDesenhoDaFicha(ficha, desenho, agora), agora);
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );
  const exportarSvgDoDesenho = useCallback(
    async (desenho: DesenhoTecnico) => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      const ficha = lerFichaTecnica(projetoAtual.fichaTecnica);
      const referencia = ficha?.referencia || projetoAtual.codigo;
      const bytes = new TextEncoder().encode(svgDoDesenho(desenho, imagensDoProjeto(projetoAtual), `${referencia} — ${ficha?.nomeDoModelo ?? projetoAtual.nome}`, ficha?.medidas ?? []));
      const caminhoSalvo = await api.salvarArquivo(`desenho-tecnico-${referencia.replace(/[^A-Za-z0-9._-]+/g, '-')}.svg`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      if (caminhoSalvo) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Desenho técnico (SVG) salvo em ${caminhoSalvo}`);
    },
    [projetoAtual, pecas, tecido, enfesto, registrarEventoEPersistir],
  );

  // ---- A recomendação de tamanho e o guia de medidas (aba Modelo › Loja, ADR 0110): pela tabela de medidas da ficha.
  const [recomendacaoAberta, setRecomendacaoAberta] = useState<ParteDaRecomendacao | null>(null);
  /** A regra de caimento vai para o projeto e é gravada (as medidas da pessoa, não: ficam só na janela). */
  const guardarRegrasDeCaimento = useCallback(
    (regras: RegrasDeCaimento) => {
      setProjetoAtual((atual) => {
        const atualizado = definirRegrasDeCaimento(atual, regras, new Date().toISOString());
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );

  /** O tecido da recomendação (quanto a volta cede no corpo) vai para o projeto e é gravado (ADR 0119). */
  const guardarElasticidadeDaRecomendacao = useCallback(
    (elasticidade: ElasticidadeDaRecomendacao) => {
      setProjetoAtual((atual) => {
        const atualizado = definirElasticidadeDaRecomendacao(atual, elasticidade, new Date().toISOString());
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );

  // ---- A estampa no encaixe (aba Encaixe › Impressão, ADR 0113): a configuração vai para o projeto; o PDF 1:1 sai
  // pela janela de salvar.
  const [mostrarImpressaoDigital, setMostrarImpressaoDigital] = useState(false);
  const guardarImpressaoDigital = useCallback(
    (config: ImpressaoDigital) => {
      setProjetoAtual((atual) => {
        const atualizado = definirImpressaoDigital(atual, config, new Date().toISOString());
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );
  /** As imagens que podem virar estampa: as do modelo e as do painel de inspiração. */
  const imagensDeEstampa = useMemo((): ImagemDeEstampa[] => {
    const doModelo = imagensDoProjeto(projetoAtual).map((i) => ({ id: i.id, nome: i.nome, dados: i.dados, larguraPx: i.larguraPx, alturaPx: i.alturaPx }));
    const doPainel = lerPainelDeInspiracao(projetoAtual.inspiracao).itens.map((i) => ({ id: i.id, nome: `${i.nome || 'Inspiração'} (painel)`, dados: i.dados, larguraPx: i.larguraPx, alturaPx: i.alturaPx }));
    return [...doModelo, ...doPainel];
  }, [projetoAtual]);
  const exportarImpressaoDigital = useCallback(
    async (config: ImpressaoDigital): Promise<string | null> => {
      const api = window.enfestoCad;
      if (!api || !enfesto) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return null;
      }
      const imagens = new Map(imagensDeEstampa.map((i) => [i.id, i]));
      const blob = await gerarPdfParaImpressaoDigital(pecas, enfesto, imagens, config, `${projetoAtual.nome} — estampa no encaixe`);
      const caminho = await api.salvarArquivo(`impressao-digital-${projetoAtual.codigo.replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`, await blob.arrayBuffer());
      if (caminho) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Estampa no encaixe (PDF 1:1 para impressão) salva em ${caminho}`);
      return caminho;
    },
    [pecas, enfesto, tecido, imagensDeEstampa, projetoAtual, registrarEventoEPersistir],
  );

  // ---- A inspiração e a IA (aba Modelo › Criação, ADR 0112): o painel vai para o projeto; a chave da IA fica no
  // processo principal (cifrada), e a tela só pede por ele.
  const [inspiracaoAberta, setInspiracaoAberta] = useState<ParteDaInspiracao | null>(null);
  const guardarInspiracao = useCallback(
    (painel: PainelDeInspiracaoDoModelo) => {
      setProjetoAtual((atual) => {
        const atualizado = definirInspiracao(atual, painel, new Date().toISOString());
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );
  const servicoDeIa = useMemo((): AcessoAoServicoDeIa | null => {
    const api = window.enfestoCad;
    if (!api) return null;
    return {
      estado: () => api.estadoDaIa(),
      guardarChave: (chave, modelo) => api.guardarChaveDaIa(chave, modelo),
      mudarModelo: (modelo) => api.mudarModeloDaIa(modelo),
      esquecerChave: () => api.esquecerChaveDaIa(),
      gerar: (pedido) => api.gerarImagensComIa(pedido),
    };
  }, []);

  // ---- O provador 3D (aba Conferência › 3D, ADR 0111): a montagem vai para o projeto; a simulação, não.
  const [mostrarProvador3D, setMostrarProvador3D] = useState(false);
  const guardarMontagem3d = useCallback(
    (montagem: Montagem3D) => {
      setProjetoAtual((atual) => {
        const atualizado = definirMontagem3d(atual, montagem, new Date().toISOString());
        persistirProjeto(atualizado);
        return atualizado;
      });
    },
    [persistirProjeto],
  );
  const salvarArquivoDoProvador = useCallback(async (nome: string, bytes: ArrayBuffer): Promise<string | null> => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
      return null;
    }
    return api.salvarArquivo(nome, bytes);
  }, []);

  // ---- O molde da foto (aba Produção, ADR 0109): a peça nova vai depois das outras, com os furos, os piques e o fio.
  const [mostrarMoldeDaFoto, setMostrarMoldeDaFoto] = useState(false);
  // A mesa digitalizadora (ADR 0144): as peças fechadas com o cursor entram depois das da mesa, com os piques e o fio.
  const [mostrarMesaDigitalizadora, setMostrarMesaDigitalizadora] = useState(false);
  const escolhaDePortaSerial = useMemo(() => {
    const api = window.enfestoCad;
    return api ? { aoEscolher: api.aoEscolherPortaSerial.bind(api), escolher: api.escolherPortaSerial.bind(api) } : null;
  }, []);
  const criarPecaDaFoto = useCallback(
    (d: { readonly nome: string; readonly tamanho: string; readonly quantidade: number; readonly molde: MoldeReconhecido }): string | null => {
      try {
        const ocupado = pecas.flatMap((p) => linhaDeCorteDaPeca(p));
        const caixaDasPecas = ocupado.length > 0 ? retanguloEnvolvente(ocupado) : null;
        const r = paraODesenho(d.molde, caixaDasPecas ? ponto(caixaDasPecas.minX, caixaDasPecas.maxY + 50) : ponto(20, 20));
        const c = retanguloEnvolvente(r.contorno);
        // Sem o fio achado nem marcado, ele fica deitado (na horizontal da tela), no meio da peça.
        const fio = r.fio ?? { inicio: ponto((c.minX + c.maxX) / 2, c.minY + 0.15 * (c.maxY - c.minY)), fim: ponto((c.minX + c.maxX) / 2, c.maxY - 0.15 * (c.maxY - c.minY)) };
        const molde = criarMolde(
          {
            nome: d.nome,
            referencia: '',
            tamanho: d.tamanho,
            quantidade: d.quantidade,
            contorno: r.contorno,
            furos: r.furos,
            piques: r.piques.map((p) => ({ id: proximoId(), posicao: p.posicao, indiceAresta: p.indiceAresta })),
            linhaDeFio: fio,
            linhasInternas: r.linhasInternas,
          },
          proximoId(),
        );
        const novasPecas = [...pecas, molde];
        aplicarMudanca(novasPecas);
        setSelecionadoId(molde.id);
        // A janela fica aberta: a mesma foto pode ter outros moldes (cada um uma peça).
        registrarEventoEPersistir('mudanca-de-moldes', { pecas: novasPecas, tecido, enfesto }, `Molde da foto: “${molde.nome}”, ${r.furos.length} furo(s), ${r.piques.length} pique(s), ${r.linhasInternas.length} linha(s) interna(s)`);
        mudarVistaPara(enquadrarRetanguloDoMundo(retanguloEnvolvente(molde.contorno), tamanhoDaTela));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, tecido, enfesto, aplicarMudanca, registrarEventoEPersistir, mudarVistaPara, tamanhoDaTela],
  );

  const criarPecasDaMesa = useCallback(
    (lista: readonly PecaDaMesa[]): readonly string[] => {
      let novasPecas = [...pecas];
      const nomes: string[] = [];
      const jaFeitas = pecas.filter((p) => p.nome.startsWith('Peça da mesa ')).length;
      for (const peca of lista) {
        const id = proximoId();
        const nome = `Peça da mesa ${jaFeitas + nomes.length + 1}`;
        const molde = criarMolde(
          { nome, referencia: '', tamanho: '', contorno: peca.contorno, linhaDeFio: peca.linhaDeFio, piques: peca.piques.map((q) => ({ id: proximoId(), posicao: q.posicao, indiceAresta: q.indiceAresta })), furos: peca.furos, linhasInternas: peca.linhasInternas, marcas: peca.marcas.map((posicao) => ({ id: proximoId(), posicao })) },
          id,
        );
        novasPecas = [...novasPecas, componenteNoProjeto(molde, novasPecas)];
        nomes.push(nome);
      }
      aplicarMudanca(novasPecas);
      const ultima = novasPecas[novasPecas.length - 1];
      if (ultima) {
        setSelecionadoId(ultima.id);
        mudarVistaPara(enquadrarRetanguloDoMundo(retanguloEnvolvente(ultima.contorno), tamanhoDaTela));
      }
      registrarEventoEPersistir('mudanca-de-moldes', { pecas: novasPecas, tecido, enfesto }, `Mesa digitalizadora: ${nomes.join(', ')}`);
      return nomes;
    },
    [pecas, tecido, enfesto, aplicarMudanca, registrarEventoEPersistir, mudarVistaPara, tamanhoDaTela],
  );

  // Molde a molde e o molde original (ADR 0170).
  const [lembrarOriginal, setLembrarOriginal] = useState(false);
  const verMoldeVizinho = useCallback(
    (passo: 1 | -1) => {
      const peca = moldeVizinho(pecas, selecionadoId, passo);
      if (!peca) return;
      setSelecionadoId(peca.id);
      setIdsSelecionadosEmLote(new Set());
      mudarVistaPara(enquadrarRetanguloDoMundo(retanguloEnvolvente(peca.contorno), tamanhoDaTela));
    },
    [pecas, selecionadoId, mudarVistaPara, tamanhoDaTela],
  );

  // ---- As coleções (aba Modelo, ADR 0108): a lista da Biblioteca para ligar os modelos aos projetos.
  const abrirColecoes = useCallback(
    (parte: ParteDaColecao = 'mix') => {
      carregarListaDeProjetos();
      setColecoesAbertas(parte);
    },
    [carregarListaDeProjetos],
  );

  // ---- A sala de corte (aba Encaixe > Sala de corte, ADR 0100): o cadastro e os nomes dos projetos, lidos ao abrir.
  const [mostrarSalaDeCorte, setMostrarSalaDeCorte] = useState(false);
  const [nomesDosProjetos, setNomesDosProjetos] = useState<ReadonlyMap<string, string>>(new Map());
  const abrirSalaDeCorte = useCallback(() => {
    setMostrarSalaDeCorte(true);
    let armazenamento: Storage | null = null;
    try {
      armazenamento = window.localStorage;
    } catch {
      armazenamento = null;
    }
    void carregarCadastro(window.enfestoCad, armazenamento).then(setCadastroDeProducao);
    void window.enfestoCad?.listarProjetos().then(
      (bruta) => setNomesDosProjetos(new Map(lerBiblioteca(bruta).projetos.map((p) => [p.id, `${p.nome} (${p.codigo})`]))),
      () => {},
    );
  }, []);

  /** Um arquivo de texto (CSV) para a janela de salvar: UTF-8 com a marca do início, para a planilha ler os acentos. */
  const salvarTexto = useCallback(async (sugestaoDeNome: string, conteudo: string): Promise<string | null> => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
      return null;
    }
    const bytes = new TextEncoder().encode(String.fromCharCode(0xfeff) + conteudo);
    return api.salvarArquivo(sugestaoDeNome, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  }, []);

  const exportarCsvDaFila = useCallback(async () => {
    await salvarTexto('fila-de-encaixes.csv', csvDaFila(filaDeEncaixes.fila));
  }, [salvarTexto, filaDeEncaixes.fila]);

  const configuracaoDoPlanejamento = useMemo(() => {
    if (!mostrarPlanoDeCorte) return null;
    try {
      return lerConfiguracaoDoPlanejamento(window.localStorage);
    } catch {
      return lerConfiguracaoDoPlanejamento({ getItem: () => null });
    }
  }, [mostrarPlanoDeCorte]);

  const mudarCadastroDeProducao = useCallback(async (novo: CadastroDeProducao): Promise<string | null> => {
    let armazenamento: Storage | null = null;
    try {
      armazenamento = window.localStorage;
    } catch {
      armazenamento = null;
    }
    const erro = await gravarCadastro(window.enfestoCad, armazenamento, novo);
    if (!erro) setCadastroDeProducao((atual) => (atual ? { ...atual, cadastro: novo } : atual));
    return erro;
  }, []);

  /** Os riscos são feitos num Web Worker (a tela não trava); sem ele, aqui mesmo, com pausas. */
  const buscarRiscos = useCallback<BuscarRiscos>((pedidos, opcoes, aoProgredir) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./planejamento.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) {
      let parar = false;
      return {
        promessa: executarBusca(pedidos, opcoes, { aoProgredir, deveParar: () => parar, pausar: () => new Promise((r) => setTimeout(r, 0)) }),
        cancelar: () => {
          parar = true;
        },
      };
    }
    const w = worker;
    const promessa = new Promise<Awaited<ReturnType<typeof executarBusca>>>((resolver, rejeitar) => {
      w.onmessage = (evento: MessageEvent) => {
        const m = evento.data;
        if (m.tipo === 'progresso') aoProgredir(m.feitos, m.total);
        else if (m.tipo === 'concluido') {
          w.terminate();
          resolver(m.resultado);
        } else if (m.tipo === 'erro') {
          w.terminate();
          rejeitar(new Error(m.mensagem));
        }
      };
      w.onerror = (evento) => {
        evento.preventDefault();
        w.terminate();
        rejeitar(new Error(evento.message || 'a busca não pôde ser iniciada.'));
      };
    });
    const iniciar: MensagemParaABusca = { tipo: 'iniciar', pedidos, opcoes };
    w.postMessage(iniciar);
    const cancelar: MensagemParaABusca = { tipo: 'cancelar' };
    return { promessa, cancelar: () => w.postMessage(cancelar) };
  }, []);

  /** A revisão do molde fica com as peças de agora (e o projeto é salvo com ela). */
  const registrarRevisao = useCallback(
    (dados: { readonly responsavel: string; readonly descricao: string; readonly impressaoDigital: string }): string | null => {
      const agora = new Date().toISOString();
      const comAsPecasDeAgora = (p: Projeto): Projeto => ({ ...p, estadoAtual: { pecas, tecido, enfesto } });
      try {
        registrarRevisaoDoMolde(comAsPecasDeAgora(projetoAtual), dados, agora);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      setProjetoAtual((atual) => {
        const atualizado = registrarRevisaoDoMolde(comAsPecasDeAgora(atual), dados, agora);
        persistirProjeto(atualizado);
        return atualizado;
      });
      return null;
    },
    [projetoAtual, pecas, tecido, enfesto, persistirProjeto],
  );

  const guardarRascunhoDoPlano = useCallback(
    (plano: PlanoDeCorteV2): string | null => {
      const agora = new Date().toISOString();
      try {
        guardarRascunho(projetoAtual, plano, agora);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      setProjetoAtual((atual) => {
        const atualizado = guardarRascunho(atual, plano, agora);
        persistirProjeto(atualizado);
        return atualizado;
      });
      return null;
    },
    [projetoAtual, persistirProjeto],
  );

  const removerRascunhoDoPlano = useCallback(
    (id: string): string | null => {
      const agora = new Date().toISOString();
      try {
        removerRascunho(projetoAtual, id, agora);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      setProjetoAtual((atual) => {
        const atualizado = removerRascunho(atual, id, agora);
        persistirProjeto(atualizado);
        return atualizado;
      });
      return null;
    },
    [projetoAtual, persistirProjeto],
  );

  /**
   * Confirma o plano: ele fica no projeto como foi calculado (sem tirar os anteriores), o histórico registra, e, se
   * pedido, o enfesto do projeto passa a ser o do plano.
   */
  const confirmarPlanoDeCorte = useCallback(
    (plano: PlanoDeCorteV2, aplicarAoEnfesto: boolean): string | null => {
      const agora = new Date().toISOString();
      try {
        confirmarPlano(projetoAtual, plano, agora);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      const r = plano.resultado;
      let enfestoNovo = enfesto;
      if (aplicarAoEnfesto) {
        try {
          const alcance = pecas.length > 0 ? Math.max(...pecas.map((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p)).maxY)) : 0;
          enfestoNovo = enfestoDoPlano(
            enfesto,
            plano.entrada.tipoDeEnfesto,
            { larguraDaMesaMm: r.mesa.larguraDoTecidoMm, comprimentoDaMesaMm: r.mesa.comprimentoMm, enfestos: r.enfestos.map((e) => e.camadas) },
            DISTANCIA_PADRAO_ENTRE_PECAS_MM,
            alcance,
          );
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
        setEnfesto(enfestoNovo);
      }
      const descricao = `Ordem ${plano.entrada.ordem.codigo}: ${r.riscos.length} risco(s), ${r.camadas} camadas em ${r.enfestos.length} enfesto(s), ${escreverEmMetros(r.consumoMm)} de malha — por ${plano.responsavel} (informado)`;
      const estado = { pecas, tecido, enfesto: enfestoNovo };
      setProjetoAtual((atual) => {
        const atualizado = registrarEvento(confirmarPlano(atual, plano, agora), 'plano-de-corte', estado, agora, descricao);
        persistirProjeto(atualizado);
        return atualizado;
      });
      setMostrarPlanoDeCorte(false);
      avisar(`Plano de corte confirmado e guardado no projeto — ${descricao}.`);
      return null;
    },
    [projetoAtual, enfesto, pecas, tecido, persistirProjeto, avisar],
  );

  const guardarConfiguracaoNoComputador = useCallback((configuracao: Parameters<typeof gravarConfiguracaoDoPlanejamento>[1]) => {
    try {
      gravarConfiguracaoDoPlanejamento(window.localStorage, configuracao);
    } catch {
      // Sem gravar neste computador: a configuração fica só no plano.
    }
  }, []);

  /** "Abrir a peça", do planejamento: fecha a janela e abre as propriedades da peça (para corrigir o que falta). */
  const abrirPecaDoPlanejamento = useCallback(
    (pecaId: string) => {
      setMostrarPlanoDeCorte(false);
      if (pecas.some((p) => p.id === pecaId)) {
        setSelecionadoId(pecaId);
        abrirPropriedadesDaPeca(pecaId);
      }
    },
    [pecas, abrirPropriedadesDaPeca],
  );

  /** "Inverter seleção" (aba Início): passam a estar selecionadas as peças que não estavam. */
  const inverterSelecaoDePecas = useCallback(() => {
    const invertida = inverterSelecao(
      pecas.map((p) => p.id),
      { selecionadoId, idsEmLote: idsSelecionadosEmLote },
    );
    setSelecionadoId(invertida.selecionadoId);
    setIdsSelecionadosEmLote(invertida.idsEmLote);
  }, [pecas, selecionadoId, idsSelecionadosEmLote]);

  /** "Ponto de restauração": guarda a peça selecionada como está agora (troca o ponto anterior dela, se havia). */
  const criarPontoDeRestauracao = useCallback(() => {
    const peca = pecas.find((p) => p.id === selecionadoId);
    if (!peca) return;
    setPontosDeRestauracao((atual) => new Map(atual).set(peca.id, peca));
    avisar(`Ponto de restauração guardado para “${peca.nome}”. “Restaurar” devolve a peça a esta forma.`);
  }, [pecas, selecionadoId, avisar]);

  /** "Restaurar": a peça selecionada volta à forma do ponto de restauração dela, num passo de desfazer. */
  const restaurarSelecionada = useCallback(() => {
    const guardada = selecionadoId ? pontosDeRestauracao.get(selecionadoId) : undefined;
    if (!guardada) return;
    const novasPecas = pecas.map((p) => (p.id === selecionadoId ? restaurarFormaDoMolde(p, guardada) : p));
    aplicarMudanca(novasPecas);
    avisar(`“${guardada.nome}” voltou à forma do ponto de restauração.`, novasPecas);
  }, [pecas, selecionadoId, pontosDeRestauracao, aplicarMudanca, avisar]);

  // "Costura", "Remover costura" e "Converter em costura" agem nas peças
  // marcadas em lote ou, sem lote, na selecionada — a regra de Excluir.
  const alvosDeCostura = useMemo(
    () =>
      idsSelecionadosEmLote.size > 0
        ? pecas.filter((p) => idsSelecionadosEmLote.has(p.id))
        : pecas.filter((p) => p.id === selecionadoId),
    [pecas, idsSelecionadosEmLote, selecionadoId],
  );

  /** Define a margem de costura dos alvos; devolve a mensagem de erro (nada muda) ou `null`. */
  const aplicarCostura = useCallback(
    (margemMm: number): string | null => {
      const alvos = new Set(alvosDeCostura.map((p) => p.id));
      if (alvos.size === 0) return 'Selecione uma peça primeiro.';
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) => (alvos.has(p.id) ? definirMargemDeCostura(p, margemMm) : p));
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      aplicarMudanca(novasPecas);
      return null;
    },
    [pecas, alvosDeCostura, aplicarMudanca],
  );

  const removerCostura = useCallback(() => {
    const comCostura = alvosDeCostura.filter((p) => p.margemDeCosturaMm > 0);
    if (comCostura.length === 0) return;
    const ids = new Set(comCostura.map((p) => p.id));
    const novasPecas = pecas.map((p) => (ids.has(p.id) ? definirMargemDeCostura(p, 0) : p));
    aplicarMudanca(novasPecas);
    avisar(
      comCostura.length === 1
        ? `Costura removida de “${comCostura[0]!.nome}”.`
        : `Costura removida de ${comCostura.length} peças.`,
      novasPecas,
    );
  }, [pecas, alvosDeCostura, aplicarMudanca, avisar]);

  /** "Converter em contorno": a linha de corte das peças selecionadas vira o contorno, e a costura volta a zero. */
  /** Cor, textos, linha de simetria, código de pique, autor e conferência de costuras. */
  const usarFerramentaDeAnotacao = useCallback(
    (ferramenta: FerramentaDeAnotacao) => {
      if (ferramenta === 'autor') setDialogoDeFerramenta({ tipo: 'autor' });
      else if (ferramenta === 'conferir') setDialogoDeFerramenta({ tipo: 'conferir' });
      else if (ferramenta === 'cor') {
        if (selecionadoId !== null || idsSelecionadosEmLote.size > 0) setDialogoDeFerramenta({ tipo: 'cor' });
      } else if (!selecionadoId) return;
      else if (ferramenta === 'inserir-texto') setDialogoDeFerramenta({ tipo: 'texto-novo' });
      else entrarModoDeConstrucao(ferramenta);
    },
    [selecionadoId, idsSelecionadosEmLote, entrarModoDeConstrucao],
  );

  /** "Programas": lê a lista de atalhos deste computador e abre o painel. */
  const abrirProgramas = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) return;
    setErroDosProgramas(null);
    void api.listarProgramas().then(setProgramas, () => setProgramas([]));
  }, []);

  /** Um pedido sobre os atalhos (adicionar, remover): fica a lista que voltou e a mensagem do que o impediu. */
  const mudarProgramas = useCallback((pedido: Promise<{ readonly lista: Programa[]; readonly erro: string | null } | null> | undefined) => {
    void pedido?.then(
      (resultado) => {
        // `null`: o usuário desistiu na escolha do arquivo.
        if (!resultado) return;
        setProgramas(resultado.lista);
        setErroDosProgramas(resultado.erro);
      },
      (e: unknown) => setErroDosProgramas(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  /** Guarda no projeto (e no arquivo dele) uma mudança nas imagens; devolve a mensagem do erro, se houver. */
  const mudarImagens = useCallback(
    (mudar: (projeto: Projeto) => Projeto): string | null => {
      try {
        const atualizado = mudar(projetoAtual);
        setProjetoAtual(atualizado);
        persistirProjeto(atualizado);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [projetoAtual, persistirProjeto],
  );

  /** "Imagens" e "Digitalizar" abrem o mesmo painel; pelo "Digitalizar", com os passos para copiar um molde de papel. */
  const abrirImagens = useCallback(
    (como: 'imagens' | 'digitalizar') => {
      cancelarModo();
      setErroDasImagens(null);
      setPainelDeImagens(como);
    },
    [cancelarModo],
  );

  /** A foto ou o desenho escolhido entra no projeto, à mostra, e a vista vai até ele. */
  const receberArquivoDeImagem = useCallback(
    async (arquivo: File) => {
      try {
        const lida = await lerImagemDoArquivo(arquivo);
        const imagem = novaImagem(proximoId(), lida.nome, lida.dados, lida.larguraPx, lida.alturaPx, origemParaImagemNova(pecas));
        const erro = mudarImagens((projeto) => adicionarImagem(projeto, imagem, new Date().toISOString()));
        setErroDasImagens(erro);
        if (!erro) mudarVistaPara(enquadrarRetanguloDoMundo(retanguloDaImagem(imagem), tamanhoDaTela));
      } catch (e) {
        setErroDasImagens(e instanceof Error ? e.message : String(e));
      }
    },
    [pecas, mudarImagens, mudarVistaPara, tamanhoDaTela],
  );

  /** "Calibrar escala": fecha o painel e pede dois cliques sobre a imagem, nas pontas de uma medida conhecida. */
  const iniciarCalibracao = useCallback(
    (imagemId: string) => {
      const imagem = imagens.find((i) => i.id === imagemId);
      if (!imagem) return;
      const contornarDepois = painelDeImagens === 'digitalizar';
      // Os cliques são sobre a imagem: ela precisa estar à mostra.
      if (!imagem.visivel) mudarImagens((projeto) => substituirImagem(projeto, { ...imagem, visivel: true }, new Date().toISOString()));
      setPainelDeImagens(null);
      entrarModoDeConstrucao('calibrar-imagem');
      setCalibracao({ imagemId, pontos: [], contornarDepois });
      mudarVistaPara(enquadrarRetanguloDoMundo(retanguloDaImagem(imagem), tamanhoDaTela));
    },
    [imagens, painelDeImagens, mudarImagens, entrarModoDeConstrucao, mudarVistaPara, tamanhoDaTela],
  );

  /** "Contornar o molde" (Digitalizar): liga o "Criar molde" por cima da imagem já na escala. */
  const contornarAImagem = useCallback(() => {
    setPainelDeImagens(null);
    entrarModoNovoMolde();
    setRecadoDaFerramenta('Digitalizar: contorne o molde sobre a imagem');
  }, [entrarModoNovoMolde]);

  /** Retas e pontos de construção: as que têm opções pedem-nas antes, num diálogo; as outras ligam direto. */
  const usarFerramentaDeElemento = useCallback(
    (ferramenta: FerramentaDeElemento) => {
      if (!selecionadoId) return;
      if (dialogoDoElemento(ferramenta, opcoesDeElemento)) setDialogoDeFerramenta({ tipo: 'elemento', ferramenta });
      else if (ehModoDeElemento(ferramenta)) entrarModoDeConstrucao(ferramenta);
    },
    [selecionadoId, opcoesDeElemento, entrarModoDeConstrucao],
  );

  /**
   * Ferramentas da aba Graduação. "Tabela" começa pelos tamanhos; "Unir" age
   * na hora; as que têm opções pedem-nas antes; as outras ligam direto.
   */
  const usarFerramentaDeGraduacao = useCallback(
    (ferramenta: FerramentaDeGraduacao) => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return;
      if (ferramenta === 'graduar-tabela') {
        setDialogoDeFerramenta({ tipo: 'tamanhos' });
        return;
      }
      if (ferramenta === 'unir-tamanhos') {
        // Vale também para a peça que ainda não é graduada: é unindo que ela passa a ser.
        setDialogoDeFerramenta({ tipo: 'graduacao', ferramenta });
        return;
      }
      if (!peca.graduacao) return;
      if (ferramenta === 'graduar-regras') setDialogoDeFerramenta({ tipo: 'escolher-regra' });
      else if (dialogoDaGraduacao(ferramenta, opcoesDaGraduacao, peca)) setDialogoDeFerramenta({ tipo: 'graduacao', ferramenta });
      else if (ehModoDeGraduacao(ferramenta)) entrarModoDeConstrucao(ferramenta);
    },
    [pecas, selecionadoId, opcoesDaGraduacao, entrarModoDeConstrucao],
  );

  /** As ferramentas da aba Marcações: as que perguntam antes abrem a janela; as outras ligam direto. */
  const usarFerramentaDeMarcacao = useCallback(
    (ferramenta: FerramentaDeMarcacao) => {
      if (!pecas.some((p) => p.id === selecionadoId)) return;
      if (dialogoDaMarcacao(ferramenta, opcoesDeMarcacao, pecas, piquesCadastrados)) setDialogoDeFerramenta({ tipo: 'marcacao', ferramenta });
      else if (ehModoDeMarcacao(ferramenta)) entrarModoDeConstrucao(ferramenta);
    },
    [pecas, selecionadoId, opcoesDeMarcacao, piquesCadastrados, entrarModoDeConstrucao],
  );

  const excluirRegraCadastrada = useCallback(
    (id: string) => {
      const novas = regrasDoUsuario.filter((r) => r.id !== id);
      gravarRegrasCadastradas(window.localStorage, novas);
      setRegrasDoUsuario(novas);
      if (regraEscolhida?.id === id) setRegraEscolhida(null);
    },
    [regrasDoUsuario, regraEscolhida],
  );

  const converterEmContorno = useCallback(() => {
    const comCostura = alvosDeCostura.filter((p) => p.margemDeCosturaMm > 0);
    if (comCostura.length === 0) return;
    const ids = new Set(comCostura.map((p) => p.id));
    const novasPecas = pecas.map((p) => (ids.has(p.id) ? converterCosturaEmContorno(p) : p));
    aplicarMudanca(novasPecas);
    avisar(
      comCostura.length === 1
        ? `A linha de corte de “${comCostura[0]!.nome}” virou o contorno; a costura voltou a zero.`
        : `A linha de corte de ${comCostura.length} peças virou o contorno; a costura voltou a zero.`,
      novasPecas,
    );
  }, [pecas, alvosDeCostura, aplicarMudanca, avisar]);

  /**
   * Põe a linha nova no lugar do trecho indicado na peça selecionada. Devolve
   * a mensagem de erro (nada muda) ou `null`. De um jeito ou de outro a
   * ferramenta volta a esperar um trecho novo.
   */
  const aplicarTrecho = useCallback(
    (ferramenta: FerramentaDeTrecho, estado: TrechoEmEdicao, opcoes: OpcoesDoTrecho = {}): string | null => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      setTrecho(SEM_TRECHO);
      if (!peca || !estado.inicio || !estado.fim) return 'Selecione uma peça e indique o trecho no contorno dela.';
      try {
        const linha = linhaNovaDoTrecho(ferramenta, peca.contorno, estado.inicio, estado.fim.ponto, estado.livres, opcoes, estado.fim);
        if (!linha) return 'Faltam pontos para montar a curva.';
        const trocada = substituirTrechoDoMolde(peca, estado.inicio, estado.fim, linha.slice(1, -1));
        // A curva e os arcos ficam registrados, com os pontos por onde passam: dá para mexer neles depois.
        // O arco tangente fica com o ponto do meio como ponto de passagem; a pré-definida, com a forma e as duas pontas.
        const tipo = ferramenta === 'curva' ? 'curva' : ferramenta === 'arco-2-pontos' || ferramenta === 'arco-3-pontos' ? 'arco' : null;
        const nova = tipo
          ? comCurvaRegistrada(trocada, tipo, [estado.inicio.ponto, ...estado.livres, estado.fim.ponto], linha, proximoId())
          : ferramenta === 'arco-tangente-a-elemento'
            ? comArcoRegistrado(trocada, linha, proximoId())
            : ferramenta === 'curva-predefinida' && opcoes.forma
              ? comCurvaRegistrada(trocada, 'forma', [estado.inicio.ponto, estado.fim.ponto], linha, proximoId(), {
                  pontos: opcoes.forma,
                  espelhar: opcoes.espelhar ?? false,
                })
              : trocada;
        aplicarMudanca(pecas.map((p) => (p.id === peca.id ? nova : p)));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Editar pontos de curva": o trecho indicado vira uma curva com pontos de passagem. Devolve a mensagem de erro (nada muda) ou `null`. */
  const tornarCurvaEditavel = useCallback(
    (inicio: PosicaoNoContorno, fim: PosicaoNoContorno, pontosDePassagem: number): string | null => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      setTrecho(SEM_TRECHO);
      if (!peca) return 'Selecione uma peça primeiro.';
      try {
        const resultado = aplicarTornarCurva(pecas, peca, inicio, fim, pontosDePassagem, proximoId());
        aplicarMudanca([...resultado.pecas]);
        setRecadoDaFerramenta(resultado.recado);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const curvasDisponiveis = useMemo(() => [...CURVAS_DE_FABRICA, ...curvasDoUsuario], [curvasDoUsuario]);

  /** Guarda no cadastro a forma do trecho indicado; devolve a mensagem de erro ou `null`. */
  const cadastrarCurva = useCallback(
    (nome: string, inicio: PosicaoNoContorno, fim: PosicaoNoContorno): string | null => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return 'Selecione uma peça primeiro.';
      try {
        const curva = curvaDoTrecho(proximoId(), nome, caminhoDoTrecho(peca.contorno, inicio, fim));
        const novas = [...curvasDoUsuario, curva];
        if (!gravarCurvasCadastradas(window.localStorage, novas)) return 'Não foi possível guardar a curva neste computador.';
        setCurvasDoUsuario(novas);
        setRecadoDaFerramenta(`Curva “${curva.nome}” cadastrada: está em “Pré-definida”.`);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, selecionadoId, curvasDoUsuario],
  );

  const excluirCurvaCadastrada = useCallback(
    (id: string) => {
      const novas = curvasDoUsuario.filter((c) => c.id !== id);
      gravarCurvasCadastradas(window.localStorage, novas);
      setCurvasDoUsuario(novas);
      if (curvaEscolhida?.curva.id === id) setCurvaEscolhida(null);
    },
    [curvasDoUsuario, curvaEscolhida],
  );

  const girarPecaSelecionada = useCallback(
    (anguloGraus: number) => {
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) return;
      const anguloResultante = peca.anguloDeRotacaoGraus + anguloGraus;
      if (!rotacaoEhPermitida(peca.restricaoDeRotacao, anguloResultante)) {
        const permitidas = rotacoesPermitidas(peca.restricaoDeRotacao)
          .map((r) => `${r}°`)
          .join(', ');
        window.alert(
          `Rotação de ${anguloGraus}° não permitida para "${peca.nome}" — violaria o sentido do fio.\n` +
            `Rotações permitidas para esta peça: ${permitidas}.\n` +
            `Para permitir mais rotações, use as caixas "Permitir 180°"/"Permitir 90°/270°" nas propriedades da peça.`,
        );
        return;
      }
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? rotacionarMolde(p, anguloGraus) : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  // Ferramentas de edição de forma (aba "Manipulação", seção 5 continua
  // valendo: nada aqui reordena automaticamente sentido do fio — são ações
  // manuais e explícitas do usuário sobre a peça selecionada).
  const moverVariosPontosDaSelecionada = useCallback(
    (indices: readonly number[], delta: Ponto2D) => {
      if (!selecionadoId) return;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? moverVariosPontosDoMolde(p, indices, delta) : p)),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Modificar" com medida exata nos vértices indicados; devolve a mensagem de erro (nada muda) ou `null`. */
  const aplicarModificar = useCallback(
    (indices: readonly number[], delta: Ponto2D, modoDeModificar: ModoDeModificar, alcanceMm: number): string | null => {
      if (!selecionadoId) return 'Selecione uma peça primeiro.';
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) => (p.id === selecionadoId ? modificarComModo(p, indices, delta, modoDeModificar, alcanceMm) : p));
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      aplicarMudanca(novasPecas);
      return null;
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Redefinir perímetro" de uma aresta da peça selecionada; devolve a mensagem de erro (nada muda) ou `null`. */
  const aplicarRedefinirPerimetro = useCallback(
    (indiceAresta: number, novoComprimentoMm: number, ponta: PontaDaAresta): string | null => {
      if (!selecionadoId) return 'Selecione uma peça primeiro.';
      let novasPecas: Molde[];
      try {
        novasPecas = pecas.map((p) =>
          p.id === selecionadoId ? redefinirComprimentoDaAresta(p, indiceAresta, novoComprimentoMm, ponta) : p,
        );
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      aplicarMudanca(novasPecas);
      return null;
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** Clique numa aresta em "Redefinir perímetro": a ponta mais perto do clique vem marcada para andar. */
  const indicarArestaParaRedefinir = useCallback((indiceAresta: number, extremidade: 'inicio' | 'fim') => {
    setRedefinicaoDePerimetro({ indiceAresta, extremidade, modo: ultimoModoDeRedefinirRef.current });
  }, []);

  const alterarRedefinicaoDePerimetro = useCallback((redefinicao: RedefinicaoDePerimetro) => {
    ultimoModoDeRedefinirRef.current = redefinicao.modo;
    setRedefinicaoDePerimetro(redefinicao);
  }, []);

  const arestaEmDestaque = useMemo<{ readonly indiceAresta: number; readonly ponta: PontaDaAresta } | null>(
    () =>
      redefinicaoDePerimetro && modo === 'redefinir-perimetro'
        ? {
            indiceAresta: redefinicaoDePerimetro.indiceAresta,
            ponta: redefinicaoDePerimetro.modo === 'bi-direcional' ? 'ambas' : redefinicaoDePerimetro.extremidade,
          }
        : null,
    [redefinicaoDePerimetro, modo],
  );

  const inserirPontoNaSelecionada = useCallback(
    (indiceAresta: number, novoPonto: Ponto2D) => {
      if (!selecionadoId) return;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? inserirPontoNoMolde(p, indiceAresta, novoPonto) : p)),
      );
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const excluirPontoDaSelecionada = useCallback(
    (indice: number) => {
      if (!selecionadoId) return;
      try {
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? removerPontoDoMolde(p, indice) : p)));
        setRecadoDaFerramenta(null);
      } catch (e) {
        // O motivo aparece na faixa da ferramenta, como nas outras.
        setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /** "Arredondar ou chanfrar" (um único botão, como na referência): o clique no canto abre a janela que pergunta qual das duas, e o valor. */
  const arredondarOuChanfrarVerticeDaSelecionada = useCallback(
    (indice: number) => {
      if (!selecionadoId) return;
      setDialogoDeFerramenta({ tipo: 'arredondar-ou-chanfrar', indice });
    },
    [selecionadoId],
  );
  // A última escolha volta no canto seguinte.
  const [ultimoCanto, setUltimoCanto] = useState<{ readonly arredondar: boolean; readonly valorMm: number }>({ arredondar: true, valorMm: 10 });

  /** Arredonda ou chanfra o canto da peça selecionada; devolve a mensagem do que impediu, ou `null`. */
  const aplicarNoCanto = useCallback(
    (indice: number, arredondando: boolean, valorMm: number): string | null => {
      if (!selecionadoId) return 'Selecione uma peça primeiro.';
      if (!(valorMm > 0)) return arredondando ? 'O raio precisa ser maior que zero.' : 'A distância do chanfro precisa ser maior que zero.';
      try {
        aplicarMudanca(
          pecas.map((p) =>
            p.id === selecionadoId
              ? arredondando
                ? arredondarCantoDoMolde(p, indice, valorMm, proximoId())
                : chanfrarCantoDoMolde(p, indice, valorMm)
              : p,
          ),
        );
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      setUltimoCanto({ arredondar: arredondando, valorMm });
      return null;
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const dimensionarSelecionada = useCallback(
    (fatorX: number, fatorY: number, comoCopia: boolean) => {
      const original = pecas.find((p) => p.id === selecionadoId);
      if (!original) return;
      if (comoCopia) {
        const copia = dimensionarMolde({ ...original, id: proximoId() }, fatorX, fatorY);
        aplicarMudanca([...pecas, copia]);
        setSelecionadoId(copia.id);
        return;
      }
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? dimensionarMolde(p, fatorX, fatorY) : p)));
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const espelharSelecionadaManualmente = useCallback(() => {
    if (!selecionadoId) return;
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? espelharMolde(p, p.id) : p)));
  }, [pecas, selecionadoId, aplicarMudanca]);

  /**
   * Girar em ângulo livre (diferente dos botões 90°/180°/270°, que ficam
   * bloqueados pela restrição de sentido do fio): é uma ferramenta de
   * EDIÇÃO de forma, não uma decisão de encaixe — o usuário está ajustando
   * como a peça foi desenhada, então não faz sentido validar contra
   * `restricaoDeRotacao` (que é sobre quais orientações o MOTOR de nesting
   * pode tentar a partir de como a peça já está). Por isso avisa
   * explicitamente que isto redefine o ângulo de referência da peça, em vez
   * de bloquear ou de aplicar silenciosamente.
   */
  const girarLivreSelecionada = useCallback(() => {
    if (!selecionadoId) return;
    setDialogoDeFerramenta({ tipo: 'girar-livre' });
  }, [selecionadoId]);

  /** Gira a peça selecionada pelo ângulo dado (graus); devolve a mensagem do que impediu, ou `null`. */
  const aplicarGiroLivre = useCallback(
    (anguloGraus: number): string | null => {
      if (!selecionadoId) return 'Selecione uma peça primeiro.';
      if (anguloGraus === 0) return 'Digite um ângulo diferente de zero.';
      aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? rotacionarMolde(p, anguloGraus) : p)));
      return null;
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  /**
   * Alinha as peças selecionadas em lote pela borda esquerda (mínimo X do
   * retângulo envolvente — largura da mesa, eixo vertical na tela) comum,
   * útil para organizar peças manualmente antes do encaixe automático.
   */
  const alinharSelecionadas = useCallback(() => {
    if (idsSelecionadosEmLote.size < 2) return;
    const selecionadas = pecas.filter((p) => idsSelecionadosEmLote.has(p.id));
    const minXComum = Math.min(...selecionadas.map((p) => retanguloEnvolvente(p.contorno).minX));
    aplicarMudanca(
      pecas.map((p) => {
        if (!idsSelecionadosEmLote.has(p.id)) return p;
        const minXAtual = retanguloEnvolvente(p.contorno).minX;
        const deslocamento = { x: minXComum - minXAtual, y: 0 };
        return transladarMolde(p, deslocamento, p.id);
      }),
    );
  }, [pecas, idsSelecionadosEmLote, aplicarMudanca]);

  /**
   * "Elemento paralelo": cria uma NOVA peça com o contorno deslocado
   * uniformemente (reaproveita a mesma função de deslocamento da margem de
   * costura, `deslocarContornoParaFora` — distância negativa desloca para
   * dentro). Furos/piques/marcas não são copiados para a peça nova, porque
   * suas posições absolutas ficariam incoerentes com o contorno deslocado
   * (mesmo cuidado já documentado para `dimensionarMolde`/edição de pontos).
   */
  const criarElementoParaleloDaSelecionada = useCallback(() => {
    if (!selecionadoId) return;
    setDialogoDeFerramenta({ tipo: 'elemento-paralelo' });
  }, [selecionadoId]);

  /** Cria a peça paralela à selecionada, à distância dada; devolve a mensagem do que impediu, ou `null`. */
  const aplicarElementoParalelo = useCallback(
    (distanciaMm: number): string | null => {
      const original = pecas.find((p) => p.id === selecionadoId);
      if (!original) return 'Selecione uma peça primeiro.';
      if (distanciaMm === 0) return 'Digite uma distância diferente de zero.';
      try {
        const novoContorno = deslocarContornoParaFora(original.contorno, distanciaMm);
        const novaPeca = criarMolde(
          {
            nome: `${original.nome} (paralelo)`,
            referencia: original.referencia,
            tamanho: original.tamanho,
            contorno: novoContorno,
            linhaDeFio: original.linhaDeFio,
            quantidade: original.quantidade,
            margemDeCosturaMm: original.margemDeCosturaMm,
            restricaoDeRotacao: original.restricaoDeRotacao,
          },
          proximoId(),
        );
        aplicarMudanca([...pecas, novaPeca]);
        setSelecionadoId(novaPeca.id);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [pecas, selecionadoId, aplicarMudanca],
  );

  const moverPeca = useCallback(
    (id: string, deslocamento: Ponto2D) => {
      const andou = pecas.map((p) => (p.id === id ? transladarMolde(p, deslocamento, p.id) : p));
      const peca = andou.find((p) => p.id === id);
      if (sobreposicaoDeMoldes || !enfesto || !peca) {
        aplicarMudanca(andou);
        return;
      }
      // Sobreposição desligada (F12): a peça não fica em cima de outra.
      const livre = lugarLivreMaisPerto(peca, andou.filter((p) => p.id !== id), enfesto);
      if (!livre) avisar('Não há lugar livre perto de onde a peça foi solta: ela ficou em cima da outra.');
      aplicarMudanca(livre ? andou.map((p) => (p.id === id ? transladarMolde(p, livre, p.id) : p)) : andou);
    },
    [pecas, aplicarMudanca, sobreposicaoDeMoldes, enfesto, avisar],
  );

  /** O grupo selecionado arrastado junto: um passo só no Desfazer. */
  const moverPecas = useCallback(
    (ids: readonly string[], deslocamento: Ponto2D) => {
      const doGrupo = new Set(ids);
      aplicarMudanca(pecas.map((p) => (doGrupo.has(p.id) ? transladarMolde(p, deslocamento, p.id) : p)));
    },
    [pecas, aplicarMudanca],
  );

  /** As teclas do encaixe (ADR 0180), na peça selecionada. */
  const executarTeclaDoEncaixe = useCallback(
    (acao: AcaoDaTecla) => {
      if (acao.tipo === 'sobreposicao') {
        setSobreposicaoDeMoldes(!sobreposicaoDeMoldes);
        avisar(sobreposicaoDeMoldes ? 'Sobreposição de moldes desligada: a peça solta em cima de outra vai para o lugar livre mais perto.' : 'Sobreposição de moldes ligada.');
        return;
      }
      if (acao.tipo === 'travar-horizontal' || acao.tipo === 'travar-vertical') {
        const eixo = acao.tipo === 'travar-horizontal' ? 'horizontal' : 'vertical';
        setTravaDoEixo(travaDoEixo === eixo ? null : eixo);
        avisar(travaDoEixo === eixo ? 'Arrasto destravado.' : `Arrasto travado na ${eixo}.`);
        return;
      }
      const ids = idsSelecionadosEmLote.size > 0 ? idsSelecionadosEmLote : new Set(selecionadoId ? [selecionadoId] : []);
      if (acao.tipo === 'para-fora') {
        if (!enfesto || ids.size === 0) avisar('Selecione uma peça, com o enfesto configurado.');
        else aplicarMudanca(moverParaForaDoEnfesto(pecas, ids, enfesto));
        return;
      }
      if (acao.tipo === 'agrupar' || acao.tipo === 'desagrupar') {
        const grupo = acao.tipo === 'agrupar' ? proximoGrupo(pecas) : '';
        if (ids.size === 0) avisar('Selecione as peças primeiro.');
        else aplicarMudanca(pecas.map((p) => (ids.has(p.id) ? comGrupoDoEncaixe(p, grupo) : p)));
        return;
      }
      if (acao.tipo === 'mover-com-referencia') {
        if (ids.size === 0) avisar('Selecione uma peça primeiro.');
        else setDialogoDeFerramenta({ tipo: 'mover-com-referencia' });
        return;
      }
      const peca = pecas.find((p) => p.id === selecionadoId);
      if (!peca) {
        avisar('Selecione uma peça primeiro.');
        return;
      }
      const trocar = (nova: Molde): void => aplicarMudanca(pecas.map((p) => (p.id === peca.id ? nova : p)));
      if (acao.tipo === 'girar-livre') girarLivreSelecionada();
      else if (acao.tipo === 'girar-180') girarPecaSelecionada(180);
      else if (acao.tipo === 'girar-esquerda') girarPecaSelecionada(270);
      else if (acao.tipo === 'girar-direita') girarPecaSelecionada(90);
      else if (acao.tipo === 'so-na-dobra') {
        trocar(comForaDaDobra(peca, !peca.foraDaDobra));
        avisar(peca.foraDaDobra ? `“${peca.nome}” vai na dobra do tecido.` : `“${peca.nome}” segue com as outras peças, fora da dobra.`);
      }
      else if (acao.tipo === 'espelhar') espelharSelecionadaManualmente();
      else if (acao.tipo === 'original') trocar(voltarAoOriginal(peca));
      else if (acao.tipo === 'meia-camada') trocar(comMeiaCamada(peca, !peca.meiaCamada));
      else if (!enfesto) avisar('Configure o enfesto primeiro.');
      else if (acao.tipo === 'mover') {
        const d = moverAteEncostar(peca, pecas.filter((p) => p.id !== peca.id), enfesto, acao.direcao);
        if (d.x !== 0 || d.y !== 0) trocar(transladarMolde(peca, d, peca.id));
      } else {
        try {
          trocar(pecaNaDobraDoTecido(peca, acao.tipo === 'dobra-horizontal' ? 'horizontal' : 'vertical', enfesto));
        } catch (erro) {
          avisar(erro instanceof Error ? erro.message : String(erro));
        }
      }
    },
    [pecas, selecionadoId, idsSelecionadosEmLote, enfesto, sobreposicaoDeMoldes, travaDoEixo, aplicarMudanca, avisar, girarLivreSelecionada, girarPecaSelecionada, espelharSelecionadaManualmente],
  );

  /** Alt + clique numa peça: as do mesmo tamanho ficam selecionadas (ADR 0180). */
  const conferirTamanho = useCallback(
    (id: string) => {
      const achado = pecasDoTamanho(pecas, id);
      if (!achado) return;
      setIdsSelecionadosEmLote(new Set(achado.ids));
      avisar(`Tamanho ${achado.tamanho}: ${achado.ids.length} ${achado.ids.length === 1 ? 'peça' : 'peças'}.`);
    },
    [pecas, avisar],
  );

  const sugerirPosicaoParaSelecionada = useCallback(() => {
    const peca = pecas.find((p) => p.id === selecionadoId);
    if (!peca || !enfesto) return;
    const outras = pecas.filter((p) => p.id !== selecionadoId);
    const delta = sugerirPosicaoSemSobreposicao(peca, outras, enfesto);
    if (!delta) {
      window.alert(
        'Não foi possível encontrar uma posição sem sobreposição dentro da área útil do enfesto configurado. Tente posicionar manualmente ou revise as dimensões do enfesto.',
      );
      return;
    }
    aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? transladarMolde(p, delta, p.id) : p)));
  }, [pecas, selecionadoId, enfesto, aplicarMudanca]);

  const abrirConfiguracaoDeNesting = useCallback(() => {
    if (!enfesto || pecas.length === 0) return;
    setResultadoNesting(null);
    setNestingExecutando(false);
    setMostrarPainelDeNesting(true);
  }, [enfesto, pecas.length]);

  /**
   * As peças e a mesa do encaixe pedido na janela (o mesmo para calcular agora e para pôr na fila): a distância entre
   * os moldes passa a ser a do enfesto (a validação mede com ela), os tamanhos e as simetrias abertos, se pedido.
   */
  const prepararEncaixe = useCallback(
    (opcoesAvancadas: OpcoesAvancadasDeNesting): { readonly paraEncaixar: readonly Molde[]; readonly enfestoDoEncaixe: ConfiguracaoDeEnfesto } | null => {
      if (!enfesto || pecas.length === 0) return null;
      let enfestoDoEncaixe = enfesto;
      const distancia = opcoesAvancadas.distanciaEntreMoldesMm;
      if (distancia !== undefined && distancia !== enfesto.distanciaMinimaEntrePecasMm) {
        try {
          enfestoDoEncaixe = criarConfiguracaoDeEnfesto({ ...enfesto, distanciaMinimaEntrePecasMm: distancia });
        } catch (e) {
          window.alert(e instanceof Error ? e.message : String(e));
          return null;
        }
        setEnfesto(enfestoDoEncaixe);
        registrarEventoEPersistir(
          'mudanca-de-configuracao',
          { pecas, tecido, enfesto: enfestoDoEncaixe },
          `Distância entre os moldes: ${String(distancia).replace('.', ',')} mm`,
        );
      }
      // Com todos os tamanhos, cada peça graduada entra como uma peça comum por tamanho.
      let paraEncaixar: readonly Molde[] = pecas;
      if (opcoesAvancadas.todosOsTamanhos) {
        try {
          paraEncaixar = expandirTamanhos(pecas, proximoId);
        } catch (e) {
          window.alert(e instanceof Error ? e.message : String(e));
          return null;
        }
      }
      // As peças com linha de simetria entram abertas, inteiras.
      if (opcoesAvancadas.abrirSimetrias) paraEncaixar = abrirSimetrias(paraEncaixar, proximoId);
      return { paraEncaixar, enfestoDoEncaixe };
    },
    [pecas, enfesto, tecido, registrarEventoEPersistir],
  );

  const calcularNestingAutomatico = useCallback(
    (opcoesAvancadas: OpcoesAvancadasDeNesting) => {
      const preparado = prepararEncaixe(opcoesAvancadas);
      if (!preparado) return;
      const { paraEncaixar, enfestoDoEncaixe } = preparado;
      setResultadoNesting(null);
      setProgressoNesting({ colocadas: 0, total: paraEncaixar.reduce((soma, p) => soma + p.quantidade, 0) });
      setNestingExecutando(true);
      metodoDoNestingRef.current = opcoesAvancadas.metodo ?? 'grade';

      const worker = new Worker(new URL('./nesting.worker.ts', import.meta.url), { type: 'module' });
      workerDeNestingRef.current = worker;
      worker.onmessage = (evento: MessageEvent) => {
        const mensagem = evento.data;
        if (mensagem.tipo === 'progresso') {
          setProgressoNesting({ colocadas: mensagem.colocadas, total: mensagem.total });
        } else if (mensagem.tipo === 'concluido') {
          setResultadoNesting(mensagem.resultado);
          setNestingExecutando(false);
          worker.terminate();
          workerDeNestingRef.current = null;
        } else if (mensagem.tipo === 'erro') {
          falhou(mensagem.mensagem);
        }
      };
      // O erro no cálculo, ou o Worker que nem carregou: a janela sai do "Calculando..." e diz o que houve.
      const falhou = (motivo: string): void => {
        worker.terminate();
        if (workerDeNestingRef.current === worker) workerDeNestingRef.current = null;
        setNestingExecutando(false);
        setMostrarPainelDeNesting(false);
        window.alert(`O encaixe automático parou com um erro: ${motivo}`);
      };
      worker.onerror = (evento) => {
        evento.preventDefault();
        falhou(evento.message || 'o cálculo não pôde ser iniciado.');
      };
      const mensagemIniciar: MensagemParaWorker = {
        tipo: 'iniciar',
        pecas: paraEncaixar,
        enfesto: enfestoDoEncaixe,
        ...(opcoesAvancadas.limiteDeTempoMinutos !== undefined
          ? { limiteDeTempoMs: opcoesAvancadas.limiteDeTempoMinutos * 60_000 }
          : {}),
        ...(opcoesAvancadas.aproveitamentoDesejadoPercentual !== undefined
          ? { aproveitamentoDesejadoPercentual: opcoesAvancadas.aproveitamentoDesejadoPercentual }
          : {}),
        // Tecido com pelo ou estampa direcional: nenhuma peça sai virada.
        ...(sentidoUnicoDoTecido(tecido) ? { tecidoDeSentidoUnico: true } : {}),
        ...(opcoesAvancadas.metodo ? { metodo: opcoesAvancadas.metodo } : {}),
      };
      worker.postMessage(mensagemIniciar);
    },
    [prepararEncaixe, tecido],
  );

  const cancelarNestingAutomatico = useCallback(() => {
    const mensagemCancelar: MensagemParaWorker = { tipo: 'cancelar' };
    workerDeNestingRef.current?.postMessage(mensagemCancelar);
    // O método dos pontos de canto roda de uma vez: o cancelar fecha o Worker e volta para a configuração.
    if (metodoDoNestingRef.current === 'pontos-de-canto') {
      workerDeNestingRef.current?.terminate();
      workerDeNestingRef.current = null;
      setNestingExecutando(false);
      setResultadoNesting(null);
    }
  }, []);

  const fecharPainelDeNesting = useCallback(() => {
    // Fechada a janela no meio do cálculo, ele para: antes continuava rodando escondido, até o fim.
    workerDeNestingRef.current?.terminate();
    workerDeNestingRef.current = null;
    setNestingExecutando(false);
    setMostrarPainelDeNesting(false);
    setResultadoNesting(null);
  }, []);

  const aplicarResultadoNesting = useCallback(() => {
    if (!resultadoNesting) return;
    const novasPecas = resultadoNesting.pecasColocadas.map((p) => p.molde);
    aplicarMudanca(novasPecas);
    setSelecionadoId(null);
    // As peças do encaixe são outras (outros ids): a marca do lote era das de antes.
    setIdsSelecionadosEmLote(new Set());
    setMostrarPainelDeNesting(false);
    setResultadoNesting(null);
    registrarEventoEPersistir(
      'execucao-de-nesting',
      { pecas: novasPecas, tecido, enfesto },
      `${resultadoNesting.pecasColocadas.length} peça(s) colocada(s), ${numeroComVirgula(resultadoNesting.aproveitamentoPercentual, 1)}% de aproveitamento`,
    );
  }, [resultadoNesting, aplicarMudanca, tecido, enfesto, registrarEventoEPersistir]);

  // ---- A fila de encaixes (ADR 0102)

  /** O encaixe pedido na janela vai para a fila, com as peças e a mesa de agora; a janela fecha e o trabalho segue. */
  const porNaFila = useCallback(
    (opcoesAvancadas: OpcoesAvancadasDeNesting) => {
      const preparado = prepararEncaixe(opcoesAvancadas);
      if (!preparado) return;
      const minutos = opcoesAvancadas.limiteDeTempoMinutos;
      const meta = opcoesAvancadas.aproveitamentoDesejadoPercentual;
      try {
        filaDeEncaixes.mudar((f) =>
          adicionarTrabalho(
            f,
            {
              projetoId: projetoAtual.id,
              projetoNome: projetoAtual.nome,
              projetoCodigo: projetoAtual.codigo,
              impressaoDasPecas: impressaoDigitalDoMolde(pecas),
              prioridade: 'normal',
              pecas: preparado.paraEncaixar,
              enfesto: preparado.enfestoDoEncaixe,
              opcoes: {
                metodo: opcoesAvancadas.metodo ?? 'grade',
                ...(minutos !== undefined ? { limiteDeTempoMs: minutos * 60_000 } : {}),
                ...(meta !== undefined ? { aproveitamentoDesejadoPercentual: meta } : {}),
                ...(sentidoUnicoDoTecido(tecido) ? { tecidoDeSentidoUnico: true } : {}),
                ...(opcoesAvancadas.todosOsTamanhos ? { todosOsTamanhos: true } : {}),
                ...(opcoesAvancadas.abrirSimetrias ? { abrirSimetrias: true } : {}),
              },
            },
            `encaixe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            new Date().toISOString(),
          ),
        );
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
        return;
      }
      setMostrarPainelDeNesting(false);
      setAviso({
        texto: 'Encaixe posto na fila: ele é calculado em segundo plano, um de cada vez. Acompanhe pela barra de status ou em Encaixe › Fila de encaixes.',
        pecas,
        selecionadoId,
      });
    },
    [prepararEncaixe, filaDeEncaixes, projetoAtual, pecas, tecido, selecionadoId],
  );

  const abrirFilaDeEncaixes = useCallback(() => {
    // A lista da Biblioteca diz quais projetos de origem existem (para o "Abrir o projeto").
    carregarListaDeProjetos();
    setMostrarFilaDeEncaixes(true);
  }, [carregarListaDeProjetos]);

  /** Aplica o resultado de um encaixe da fila no projeto aberto: avisa antes se o projeto, as peças ou a mesa não são mais os dele. */
  const aplicarDaFila = useCallback(
    (id: string) => {
      const trabalho = filaDeEncaixes.fila.trabalhos.find((t) => t.id === id);
      const resultado = trabalho?.resultado;
      if (!trabalho || !resultado || resultado.pecasColocadas.length === 0) return;
      const motivos: string[] = [];
      // O encaixe ligado ao molde (ADR 0125): as peças que mudaram depois do encaixe entram como estão agora, no lugar
      // e na posição em que o encaixe pôs as de antes.
      let ligado: EncaixeComOMoldeDeAgora | null = null;
      if (trabalho.projetoId !== projetoAtual.id) {
        motivos.push(`este encaixe é do projeto "${trabalho.projetoNome}" (${trabalho.projetoCodigo}), e o aberto é "${projetoAtual.nome}" (${projetoAtual.codigo})`);
      } else if (impressaoDigitalDoMolde(pecas) !== trabalho.impressaoDasPecas) {
        try {
          // As de agora preparadas como as do encaixe: com os tamanhos e as simetrias abertas, se ele pediu.
          let preparadas: readonly Molde[] = pecas;
          if (trabalho.opcoes.todosOsTamanhos) preparadas = expandirTamanhos(preparadas, proximoId);
          if (trabalho.opcoes.abrirSimetrias) preparadas = abrirSimetrias(preparadas, proximoId);
          ligado = encaixeComOMoldeDeAgora(resultado.pecasColocadas, trabalho.pecas, preparadas);
        } catch (e) {
          motivos.push(`as peças do projeto mudaram depois que o encaixe entrou na fila, e as de agora não puderam ser preparadas como as dele (${e instanceof Error ? e.message : String(e)}): ele entra com as peças de antes`);
        }
      }
      const mesa = (e: ConfiguracaoDeEnfesto | null): string =>
        e ? [e.larguraUtilMm, e.comprimentoMm, e.margemLateralMm, e.margemDeExtremidadeMm, e.distanciaMinimaEntrePecasMm].join('|') : '';
      if (mesa(enfesto) !== mesa(trabalho.enfesto)) motivos.push('a mesa do projeto aberto (largura, comprimento, margens ou distância entre os moldes) não é a do encaixe');
      if (
        motivos.length > 0 &&
        !window.confirm(
          `Atenção: ${motivos.join('; ')}.\n\nAplicar troca as peças do projeto aberto pelas ${resultado.pecasColocadas.length} do encaixe (Ctrl+Z desfaz). Aplicar mesmo assim?`,
        )
      ) {
        return;
      }
      const novasPecas = ligado ? [...ligado.pecas, ...ligado.novas] : resultado.pecasColocadas.map((p) => p.molde);
      aplicarMudanca(novasPecas);
      setSelecionadoId(null);
      setIdsSelecionadosEmLote(new Set());
      registrarEventoEPersistir(
        'execucao-de-nesting',
        { pecas: novasPecas, tecido, enfesto },
        `Encaixe da fila (${descricaoDasOpcoes(trabalho.opcoes)}): ${resultado.pecasColocadas.length} peça(s) colocada(s), ${numeroComVirgula(resultado.aproveitamentoPercentual, 1)}% de aproveitamento${ligado && ligado.atualizadas.length > 0 ? ` — com o molde de agora em ${ligado.atualizadas.length} peça(s)` : ''}`,
      );
      filaDeEncaixes.mudar((f) => marcarAplicado(f, id, new Date().toISOString()));
      setMostrarFilaDeEncaixes(false);
      if (ligado) {
        const nomes = (lista: readonly string[]): string => lista.map((n) => `“${n}”`).join(', ');
        const umaOuMais = (lista: readonly string[], uma: string, mais: string): string => `${nomes(lista)} ${lista.length === 1 ? uma : mais}`;
        const partes: string[] = [];
        if (ligado.atualizadas.length > 0) partes.push(umaOuMais(ligado.atualizadas, 'mudou depois do encaixe e entrou como está agora, no lugar da de antes', 'mudaram depois do encaixe e entraram como estão agora, no lugar das de antes'));
        if (ligado.foraDoProjeto.length > 0) partes.push(umaOuMais(ligado.foraDoProjeto, 'saiu do projeto e ficou fora da mesa', 'saíram do projeto e ficaram fora da mesa'));
        if (ligado.foraDoEncaixe.length > 0) partes.push(umaOuMais(ligado.foraDoEncaixe, 'não está no encaixe', 'não estão no encaixe') + (ligado.novas.length > 0 ? ' (a peça nova continua no projeto, onde estava)' : ''));
        if (ligado.comoNoEncaixe.length > 0) partes.push(umaOuMais(ligado.comoNoEncaixe, 'ficou como no encaixe (há mais de uma peça com esse nome e tamanho)', 'ficaram como no encaixe (há mais de uma peça com esse nome e tamanho)'));
        const conflitos = validarProjeto(novasPecas, enfesto).filter((p) => p.tipo === 'sobreposicao' || p.tipo === 'espacamento-insuficiente' || p.tipo === 'fora-dos-limites').length;
        const fim =
          conflitos > 0
            ? ` A validação acha ${conflitos} ${conflitos === 1 ? 'problema' : 'problemas'} de sobreposição, distância entre os moldes ou limite da mesa: afaste as peças ou faça o encaixe de novo.`
            : ligado.foraDoEncaixe.length > 0
              ? ' Faça o encaixe de novo para pôr tudo na mesa.'
              : '';
        setAviso({
          texto: partes.length > 0 ? `Encaixe aplicado com o molde de agora: ${partes.join('; ')}.${fim}` : `Encaixe aplicado: as peças só mudaram de lugar no projeto, e ficam onde o encaixe as pôs.${fim}`,
          pecas: novasPecas,
          selecionadoId: null,
        });
      }
    },
    [filaDeEncaixes, projetoAtual, pecas, enfesto, tecido, aplicarMudanca, registrarEventoEPersistir],
  );

  const exportarPdf = useCallback(
    async (opcoesEscolhidas: OpcoesDeExportacaoEscolhidas) => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      setGerandoPdf(true);
      try {
        const opcoesDePagina = {
          formato: opcoesEscolhidas.formato,
          orientacao: opcoesEscolhidas.orientacao,
          margemMm: opcoesEscolhidas.margemMm,
        };
        const blob =
          opcoesEscolhidas.tipo === 'encaixe-completo' && enfesto
            ? await gerarPdfDeEncaixe(pecas, enfesto, {
                ...opcoesDePagina,
                ...(tecido?.nome !== undefined ? { tecidoNome: tecido.nome } : {}),
              })
            : await gerarPdfDeMoldesIndividuais(pecas, opcoesDePagina);
        const buffer = await blob.arrayBuffer();
        const sugestaoDeNome =
          opcoesEscolhidas.tipo === 'encaixe-completo' ? 'encaixe.pdf' : 'moldes.pdf';
        const caminhoSalvo = await api.salvarArquivo(sugestaoDeNome, buffer);
        if (caminhoSalvo) {
          setMostrarExportacaoPdf(false);
          registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Salvo em ${caminhoSalvo}`);
        }
      } catch (e) {
        window.alert(`Falha ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGerandoPdf(false);
      }
    },
    [pecas, enfesto, tecido, registrarEventoEPersistir],
  );

  // O DXF (ADR 0096): as peças como estão na mesa, direto para a janela de salvar — não há o que escolher antes.
  const exportarDxf = useCallback(async () => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
      return;
    }
    try {
      const bytes = codificarDxf(gerarDxf(pecas, enfesto ? { larguraDaMesaMm: enfesto.larguraUtilMm } : {}));
      const caminhoSalvo = await api.salvarArquivo('moldes.dxf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      if (caminhoSalvo) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `DXF salvo em ${caminhoSalvo}`);
    } catch (e) {
      window.alert(`Falha ao gerar o DXF: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [pecas, enfesto, tecido, registrarEventoEPersistir]);

  // O PLT (ADR 0101): o encaixe em escala 1:1, em HPGL, para o plotter — com o contorno da mesa, quando há enfesto.
  const exportarPlt = useCallback(async (partes: Partial<OpcoesDoPlt> = {}) => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
      return;
    }
    try {
      const bytes = new TextEncoder().encode(gerarPlt(pecas, { canetas: canetasDoPlotter, ferramentas: ferramentasDoPlotter, ...(enfesto?.textosNoRisco ? { textos: enfesto.textosNoRisco } : {}), cabecalho: cabecalhoDoRisco({ nome: projetoAtual.nome, codigo: projetoAtual.codigo, pecas, larguraMm: enfesto?.larguraUtilMm ?? null, dataIso: new Date().toISOString() }), ...(enfesto ? { larguraDaMesaMm: enfesto.larguraUtilMm, comprimentoDaMesaMm: enfesto.comprimentoMm } : {}), ...partes }));
      const caminhoSalvo = await api.salvarArquivo(Object.keys(partes).length > 0 ? 'encaixe-parte.plt' : 'encaixe.plt', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      if (caminhoSalvo) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `PLT (plotter) salvo em ${caminhoSalvo}`);
    } catch (e) {
      window.alert(`Falha ao gerar o PLT: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [pecas, enfesto, tecido, registrarEventoEPersistir, canetasDoPlotter, ferramentasDoPlotter, projetoAtual.nome, projetoAtual.codigo]);

  // O arquivo da mesa de corte (ADR 0140): o encaixe em ISO (G-code), com a faca, o piqueteador, o furador e a caneta.
  const exportarIso = useCallback(
    async (velocidadeMmMin: number, comCaneta: boolean, facaTangencial: boolean, compensacaoDaLaminaMm: number, furadorM43: boolean) => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      try {
        const texto = gerarIso(pecas, { velocidadeMmMin, comCaneta, facaTangencial, compensacaoDaLaminaMm, furadorM43, ...(enfesto ? { larguraDaMesaMm: enfesto.larguraUtilMm } : {}) });
        const bytes = new TextEncoder().encode(texto);
        const caminhoSalvo = await api.salvarArquivo('encaixe.iso', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
        if (!caminhoSalvo) return;
        const r = resumoDoIso(pecas);
        registrarEventoEPersistir(
          'exportacao-de-pdf',
          { pecas, tecido, enfesto },
          `ISO (mesa de corte) salvo em ${caminhoSalvo}: ${r.pecas} peça(s), ${numeroComVirgula(r.corteM, 1)} m de corte, ${r.piques} pique(s)`,
        );
      } catch (e) {
        window.alert(`Falha ao gerar o ISO: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [pecas, enfesto, tecido, registrarEventoEPersistir],
  );

  // O relatório é do que está na tela: o `estadoAtual` do projeto é o da última vez que ele foi salvo.
  // Só é montado com o painel aberto, e a hora é a de quando foi aberto (ou de quando as peças mudaram).
  const relatorioAtual = useMemo(
    () =>
      mostrarRelatorio
        ? gerarRelatorioDeProducao({ ...projetoAtual, estadoAtual: { pecas, tecido, enfesto } }, new Date().toISOString())
        : null,
    [mostrarRelatorio, projetoAtual, pecas, tecido, enfesto],
  );

  const exportarRelatorio = useCallback(
    async (formato: 'pdf' | 'xlsx') => {
      const api = window.enfestoCad;
      if (!api) {
        window.alert('Exportação de arquivo só está disponível rodando dentro do aplicativo Electron.');
        return;
      }
      if (!relatorioAtual) return;
      setGerandoRelatorio(true);
      try {
        const blob =
          formato === 'pdf'
            ? await gerarPdfDeRelatorio(relatorioAtual)
            : await gerarExcelDeRelatorio(relatorioAtual);
        const buffer = await blob.arrayBuffer();
        const sugestaoDeNome = `relatorio-${projetoAtual.codigo}.${formato}`;
        const caminhoSalvo = await api.salvarArquivo(sugestaoDeNome, buffer);
        if (caminhoSalvo) {
          setMostrarRelatorio(false);
          registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Relatório salvo em ${caminhoSalvo}`);
        }
      } catch (e) {
        window.alert(`Falha ao gerar o relatório: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGerandoRelatorio(false);
      }
    },
    [relatorioAtual, projetoAtual.codigo, pecas, tecido, enfesto, registrarEventoEPersistir],
  );

  const estadoAoVivoRef = useRef<EstadoDoProjeto>({ pecas, tecido, enfesto });
  useEffect(() => {
    estadoAoVivoRef.current = { pecas, tecido, enfesto };
  }, [pecas, tecido, enfesto]);

  // Salvamento automático (seção 11): a cada 60s, se algo mudou desde o
  // último evento registrado, grava um novo "salvamento" — cobre queda de
  // energia/travamento sem exigir um fluxo de "recuperar rascunho" à parte:
  // o estado salvo mais recente já fica disponível na Biblioteca.
  useEffect(() => {
    const intervalo = setInterval(() => {
      setProjetoAtual((atual) => {
        const mudou =
          JSON.stringify(atual.estadoAtual) !== JSON.stringify(estadoAoVivoRef.current);
        if (!mudou) return atual;
        const atualizado = registrarEvento(atual, 'salvamento', estadoAoVivoRef.current, new Date().toISOString(), 'Salvamento automático');
        persistirProjeto(atualizado);
        return atualizado;
      });
    }, 60000);
    return () => clearInterval(intervalo);
  }, [persistirProjeto]);

  const finalizarContornoEmEdicao = useCallback(() => {
    if (pontosEmEdicao.length < 3) return;
    if (area(pontosEmEdicao) <= 0) {
      window.alert('O contorno desenhado é inválido (área zero ou pontos colineares). Continue clicando ou pressione Esc para cancelar.');
      return;
    }
    if (modo === 'novo-molde') {
      setContornoPendente(pontosEmEdicao);
      setPontosEmEdicao([]);
      setModo('definir-fio');
    } else if (modo === 'novo-furo' && selecionadoId) {
      const contornoFuro = pontosEmEdicao;
      aplicarMudanca(
        pecas.map((p) => (p.id === selecionadoId ? { ...p, furos: [...p.furos, contornoFuro] } : p)),
      );
      cancelarModo();
    }
  }, [pontosEmEdicao, modo, selecionadoId, pecas, aplicarMudanca, cancelarModo]);

  const onCliqueNoCanvas = useCallback(
    (mundo: Ponto2D, semCaptura: Ponto2D) => {
      if (modo === 'novo-molde' || modo === 'novo-furo') {
        // Com o ímã, um clique perto do primeiro ponto cai exatamente nele:
        // fecha o contorno (como Enter). Um clique repetido sobre o último
        // ponto não cria um vértice duplicado.
        const primeiro = pontosEmEdicao[0];
        const ultimo = pontosEmEdicao.at(-1);
        if (primeiro && pontosEmEdicao.length >= 3 && mesmoPonto(mundo, primeiro)) {
          finalizarContornoEmEdicao();
          return;
        }
        if (ultimo && mesmoPonto(mundo, ultimo)) return;
        setPontosEmEdicao((prev) => [...prev, mundo]);
        return;
      }
      if (modo === 'definir-fio') {
        if (pontosEmEdicao.length === 0) {
          setPontosEmEdicao([mundo]);
          return;
        }
        // Fio de comprimento zero não tem direção: ignora o segundo clique no mesmo lugar.
        if (mesmoPonto(mundo, pontosEmEdicao[0]!)) return;
        if (!contornoPendente) return;
        const novoMolde = criarMolde(
          {
            nome: `Molde ${pecas.length + 1}`,
            referencia: '',
            tamanho: 'M',
            contorno: contornoPendente,
            linhaDeFio: { inicio: pontosEmEdicao[0]!, fim: mundo },
          },
          proximoId(),
        );
        // O círculo e a espiral ficam registrados; o registro que não é deste contorno (sobrou de uma figura abandonada) não entra.
        const comRegistro = figuraPendente ? comFiguraRegistrada(novoMolde, figuraPendente) : novoMolde;
        setFiguraPendente(null);
        aplicarMudanca([...pecas, comRegistro]);
        setSelecionadoId(novoMolde.id);
        cancelarModo();
        return;
      }
      if (modo === 'retangulo') {
        const canto = pontosEmEdicao[0];
        if (!canto) {
          setPontosEmEdicao([mundo]);
          return;
        }
        // Sem largura ou sem altura não há retângulo: espera um canto oposto de verdade.
        if (
          Math.abs(mundo.x - canto.x) < LADO_MINIMO_DO_RETANGULO_MM ||
          Math.abs(mundo.y - canto.y) < LADO_MINIMO_DO_RETANGULO_MM
        ) {
          return;
        }
        // Daqui segue como no molde desenhado reta a reta: falta a linha de fio.
        setContornoPendente([canto, ponto(canto.x, mundo.y), mundo, ponto(mundo.x, canto.y)]);
        setPontosEmEdicao([]);
        setModo('definir-fio');
        return;
      }
      if (modo === 'ponto-de-casamento') {
        // A peça debaixo do clique: a selecionada, se o clique cai nela; senão, a de cima.
        const alvo =
          pecaSelecionada && pontoDentroDoContorno(mundo, pecaSelecionada.contorno)
            ? pecaSelecionada
            : [...pecas].reverse().find((p) => pontoDentroDoContorno(mundo, p.contorno));
        if (!alvo) {
          setRecadoDaFerramenta('Clique dentro de uma peça');
          return;
        }
        try {
          const resultado = comPontoDeCasamento(alvo, grupoDoPontoDeCasamento, mundo, proximoId());
          aplicarMudanca(pecas.map((p) => (p.id === alvo.id ? resultado.molde : p)));
          const nome = nomeDoPontoDeCasamento(grupoDoPontoDeCasamento);
          setRecadoDaFerramenta(`${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${resultado.movido ? 'mudou de lugar' : 'foi posto'} em “${alvo.nome}”`);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'sentido-do-fio' && selecionadoId) {
        const inicio = pontosEmEdicao[0];
        if (!inicio) {
          setPontosEmEdicao([mundo]);
          return;
        }
        // Fio de comprimento zero não tem direção: ignora o segundo clique no mesmo lugar.
        if (mesmoPonto(mundo, inicio)) return;
        aplicarMudanca(pecas.map((p) => (p.id === selecionadoId ? redefinirLinhaDeFio(p, inicio, mundo) : p)));
        cancelarModo();
        return;
      }
      if (modo === 'medir-distancia' || modo === 'comparar-distancias') {
        const comparar = modo === 'comparar-distancias';
        const de = pontosEmEdicao[0];
        if (!de) {
          setPontosEmEdicao([mundo]);
          // Medindo, a medida anterior some; comparando, só recomeça depois da segunda.
          setMedicao((atual) => (comparar && atual.medicoes.length < 2 ? atual : SEM_MEDICAO));
          return;
        }
        if (mesmoPonto(mundo, de)) return;
        setMedicao((atual) => registrarMedicao(atual, { tipo: 'distancia', de, ate: mundo }, comparar));
        setPontosEmEdicao([]);
        return;
      }
      if (modo === 'cota-perimetro' || ehFerramentaDeCotaPorPontos(modo)) {
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        if (pontosEmEdicao.length === 0) {
          // Um clique no número de uma cota a apaga.
          const cotaClicada = cotaSobOPonto(pecas, semCaptura, raioMm);
          if (cotaClicada) {
            aplicarMudanca(pecas.map((p) => (p.id === cotaClicada.pecaId ? removerCota(p, cotaClicada.cotaId) : p)));
            return;
          }
          // A cota fica presa a uma peça: a do primeiro clique ou, fora de todas, a selecionada.
          const dona =
            alvoDaMedicao(semCaptura, pecas, raioMm)?.peca ?? pecas.find((p) => p.id === selecionadoId) ?? null;
          if (!dona) return;
          if (modo === 'cota-perimetro') {
            aplicarMudanca(
              pecas.map((p) => (p.id === dona.id ? adicionarCota(p, cotaDePerimetro(proximoId(), semCaptura)) : p)),
            );
            return;
          }
          setDonoDaCota(dona.id);
          setPontosEmEdicao([mundo]);
          return;
        }
        if (!ehFerramentaDeCotaPorPontos(modo)) return;
        const cliques = [...pontosEmEdicao, mundo];
        if (cliques.length < CLIQUES_DA_COTA[modo]) {
          // Um ponto repetido não mede nada: espera um ponto diferente.
          if (!mesmoPonto(mundo, pontosEmEdicao.at(-1)!)) setPontosEmEdicao(cliques);
          return;
        }
        try {
          const cota = montarCota(modo, proximoId(), cliques);
          aplicarMudanca(pecas.map((p) => (p.id === donoDaCota ? adicionarCota(p, cota) : p)));
        } catch {
          // Pontos que não formam a cota (dois iguais): recomeça sem criar nada.
        }
        setPontosEmEdicao([]);
        setDonoDaCota(null);
        return;
      }
      if (modo === 'medir-perimetro' || modo === 'comparar-perimetros') {
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        setMedicao((atual) =>
          cliqueDePerimetro(
            atual,
            alvoDaMedicao(mundo, pecas, raioMm, atual.inicioDoTrecho?.pecaId ?? null),
            modo === 'comparar-perimetros',
          ),
        );
        return;
      }
      if (modo === 'conferir') {
        const resultado = cliqueDaConferencia(opcoesDaConferencia, pecas, conferencia, semCaptura, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm, proximoId);
        setConferencia(resultado.estado);
        if (resultado.pecas) aplicarMudanca([...resultado.pecas]);
        setRecadoDaFerramenta(resultado.recado);
        return;
      }
      if (modo === 'calibrar-imagem') {
        if (!calibracao) return;
        // O ponto exato sob o mouse: o ímã prende nas peças, e a medida é da imagem.
        const pontos = calibracao.pontos.length >= 2 ? [semCaptura] : [...calibracao.pontos, semCaptura];
        setCalibracao({ ...calibracao, pontos });
        if (pontos.length === 2) setDialogoDeFerramenta({ tipo: 'escala-da-imagem' });
        return;
      }
      if (modo === 'inserir-texto' || modo === 'editar-texto' || modo === 'linha-de-simetria' || modo === 'relacionar-piques') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        try {
          if (modo === 'inserir-texto') {
            aplicarMudanca(
              pecas.map((p) => (p.id === peca.id ? adicionarTexto(p, semCaptura, textoAInserir.texto, textoAInserir.alturaMm, proximoId()) : p)),
            );
            setRecadoDaFerramenta(`Texto “${textoAInserir.texto.trim()}” posto em “${peca.nome}”.`);
          } else if (modo === 'editar-texto') {
            const texto = textoPerto(peca, semCaptura, raioMm);
            setRecadoDaFerramenta(texto ? null : 'Clique em cima de um texto da peça selecionada.');
            if (texto) setDialogoDeFerramenta({ tipo: 'editar-texto', id: texto.id });
          } else if (modo === 'relacionar-piques') {
            const pique = piquePerto(peca, semCaptura, raioMm);
            setRecadoDaFerramenta(pique ? null : 'Clique em cima de um pique da peça selecionada.');
            if (pique) setDialogoDeFerramenta({ tipo: 'codigo-do-pique', id: pique.id });
          } else {
            const aresta = arestaPerto(semCaptura, peca.contorno, raioMm);
            if (aresta === null) {
              setRecadoDaFerramenta('Clique sobre uma aresta do contorno da peça selecionada.');
              return;
            }
            const nova = definirLinhaDeSimetria(peca, aresta);
            aplicarMudanca(pecas.map((p) => (p.id === peca.id ? nova : p)));
            setRecadoDaFerramenta(
              arestaDeSimetria(nova) === null
                ? `Linha de simetria tirada de “${peca.nome}”.`
                : `Linha de simetria marcada em “${peca.nome}”: a peça desenhada é meia peça, dobrada nessa aresta.`,
            );
          }
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'editar-pontos-de-curva' && !trecho.inicio) {
        // Antes de indicar um trecho: o clique num ponto de passagem de uma curva registrada escolhe-o; o seguinte põe-no no lugar.
        const peca = pecas.find((p) => p.id === selecionadoId);
        const alcas = peca ? cliqueNaAlca(pecas, peca, alcaDeCurva, semCaptura, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm) : null;
        if (alcas?.tratou) {
          setAlcaDeCurva(alcas.alca);
          if (alcas.pecas) aplicarMudanca([...alcas.pecas]);
          setRecadoDaFerramenta(alcas.recado);
          return;
        }
      }
      if (modo === 'editar-pontos-de-curva' && trecho.inicio && !trecho.fim) {
        // O segundo clique no mesmo lugar, em cima de uma curva registrada, põe um ponto de passagem ali.
        const peca = pecas.find((p) => p.id === selecionadoId);
        const novoPonto = peca
          ? cliqueDeNovoPontoDePassagem(pecas, peca, trecho.inicio.ponto, semCaptura, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm)
          : null;
        if (novoPonto?.tratou) {
          setTrecho(SEM_TRECHO);
          if (novoPonto.pecas) aplicarMudanca([...novoPonto.pecas]);
          setRecadoDaFerramenta(novoPonto.recado);
          return;
        }
      }
      if (ehFerramentaDeTrecho(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        setRecadoDaFerramenta(null);
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const novo = cliqueDeTrecho(modo, trecho, {
          noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm),
          livre: mundo,
        });
        if (!trechoCompleto(modo, novo) || !novo.inicio || !novo.fim) {
          setTrecho(novo);
          return;
        }
        // Estas duas pedem um valor antes de aplicar: o diálogo termina o serviço.
        if (modo === 'editar-pontos-de-curva' || modo === 'cadastrar-curva') {
          setTrecho(novo);
          setDialogoDeFerramenta({
            tipo: modo === 'cadastrar-curva' ? 'cadastrar-curva' : 'numero-de-pontos',
            inicio: novo.inicio,
            fim: novo.fim,
          });
          return;
        }
        const opcoes =
          modo === 'curva-predefinida' && curvaEscolhida
            ? { forma: curvaEscolhida.curva.forma, espelhar: curvaEscolhida.espelhar }
            : {};
        setRecadoDaFerramenta(aplicarTrecho(modo, novo, opcoes));
        return;
      }
      if (modo === 'dobrar') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const resultado = cliqueDeDobrar(
          opcoesDeDobrar,
          pecas,
          peca,
          trecho,
          {
            noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm),
            livre: semCaptura,
            linhaInterna: linhaInternaPerto(peca, semCaptura, raioMm)?.linha ?? null,
          },
          proximoId,
        );
        setTrecho(resultado.estado);
        if (resultado.pecas) aplicarMudanca([...resultado.pecas]);
        setRecadoDaFerramenta(resultado.recado);
        return;
      }
      if (ehFerramentaDeReta(modo) || modo === 'bainha' || modo === 'forro-entretela-vista') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        // A vista e o forro pedem o trecho como a bainha: dois pontos do contorno.
        const comoReta = modo === 'forro-entretela-vista' ? 'bainha' : modo;
        if (!peca) return;
        setRecadoDaFerramenta(null);
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        // "Remover região" com "Unir moldes" pede uma segunda reta em vez do lado.
        const segundaReta = modo === 'remover-regiao' && opcoesDeRemover.unir;
        const noContorno = posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm);
        // No "Cortar", o clique numa linha interna (reta ou curva), fora do contorno, corta por ela — ou, no contorno manual, indica o elemento.
        if (modo === 'cortar') {
          // Com a linha do corte indicada e a costura numa parte só, o clique é o da parte que a ganha.
          const naParte = cliqueNaParteDoCorte(pecas, peca, trecho, semCaptura, proximoId, opcoesDeCorte);
          if (naParte) {
            setTrecho(naParte.estado);
            if (naParte.pecas) aplicarMudanca([...naParte.pecas]);
            setRecadoDaFerramenta(naParte.recado);
            return;
          }
          const noElemento = noContorno
            ? null
            : cliqueNoElementoDoCorte(pecas, peca, trecho, linhaInternaPerto(peca, semCaptura, raioMm)?.linha ?? null, corteManual, proximoId, opcoesDeCorte);
          if (noElemento) {
            setTrecho(noElemento.estado);
            if (noElemento.pecas) aplicarMudanca([...noElemento.pecas]);
            setRecadoDaFerramenta(noElemento.recado);
            return;
          }
          // Com elementos já indicados, o clique fora deles não começa um corte reto por engano.
          if (!trecho.inicio && trecho.livres.length > 0) {
            setRecadoDaFerramenta('Há elementos indicados para o corte: aperte Enter para cortar por eles, ou Esc para desistir.');
            return;
          }
        }
        // No "Remover região", o clique numa linha interna indica o elemento; com elementos indicados (ou a linha confirmada com Enter), o clique escolhe o lado.
        // Com "Unir moldes", os elementos de cada linha são confirmados com Enter; a reta clicada sozinha continua valendo na hora.
        if (modo === 'remover-regiao') {
          const noElemento = cliqueNoElementoDeRemover(
            pecas,
            peca,
            trecho,
            noContorno ? null : (linhaInternaPerto(peca, semCaptura, raioMm)?.linha ?? null),
            semCaptura,
            proximoId,
            opcoesDeRemover,
          );
          if (noElemento) {
            setTrecho(noElemento.estado);
            if (noElemento.pecas) aplicarMudanca([...noElemento.pecas]);
            setRecadoDaFerramenta(noElemento.recado);
            return;
          }
        }
        // Com "Unir moldes", o clique numa linha interna reta, fora do contorno, é a reta inteira dela (o elemento).
        const peloElemento =
          modo === 'remover-regiao' && segundaReta && !noContorno
            ? retaPeloElemento(modo, peca, trecho, linhaInternaPerto(peca, semCaptura, raioMm)?.linha ?? null, segundaReta)
            : null;
        if (peloElemento?.recado) {
          setRecadoDaFerramenta(peloElemento.recado);
          return;
        }
        const novo = peloElemento ? peloElemento.estado : cliqueDeReta(comoReta, trecho, { noContorno, livre: semCaptura }, segundaReta);
        // No "Cortar" com a costura numa parte só, os dois pontos não bastam: falta o clique na parte.
        if (!retaCompleta(comoReta, novo, segundaReta, modo === 'cortar' && cortePedeAParte(opcoesDeCorte))) {
          setTrecho(novo);
          return;
        }
        // Deu certo ou não, a ferramenta volta a esperar a primeira ponta.
        setTrecho(SEM_TRECHO);
        try {
          const resultado =
            modo === 'bainha'
              ? aplicarBainha(pecas, peca, novo, opcoesDeBainha, proximoId)
              : modo === 'forro-entretela-vista'
                ? aplicarPecaDerivada(pecas, peca, novo, opcoesDaPecaDerivada, proximoId)
                : aplicarReta(modo, pecas, peca, novo, proximoId, undefined, { corte: opcoesDeCorte, remover: opcoesDeRemover });
          aplicarMudanca([...resultado.pecas]);
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (ehModoDeElemento(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const resultado = cliqueDeElemento(
          modo,
          opcoesDeElemento,
          pecas,
          peca,
          trecho,
          { noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm), livre: semCaptura },
          raioMm,
          proximoId,
        );
        setTrecho(resultado.estado);
        setRecadoDaFerramenta(resultado.recado);
        if (resultado.pecas) aplicarMudanca([...resultado.pecas]);
        return;
      }
      if (ehModoDeMarcacao(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const noContorno = posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm);
        const resultado = cliqueDeMarcacao(
          modo,
          opcoesDeMarcacao,
          pecas,
          peca,
          trecho,
          { noContorno, livre: semCaptura },
          { raioMm, novoId: proximoId, linhaInterna: noContorno ? null : (linhaInternaPerto(peca, semCaptura, raioMm)?.linha ?? null) },
        );
        setTrecho(resultado.estado);
        setRecadoDaFerramenta(resultado.recado);
        if (resultado.cadastrar) {
          // Um formato novo entra no fim; o redesenhado fica no lugar do que era. O cadastro muda como um passo do
          // Ctrl+Z, junto com as peças que a mudança alcançou (se alcançou alguma).
          const novos = comOCadastrado(piquesCadastrados, resultado.cadastrar);
          if (!mudarCadastroDePiques(novos, resultado.pecas ? [...resultado.pecas] : undefined)) setRecadoDaFerramenta('Não foi possível guardar o formato neste computador.');
        } else if (resultado.pecas) {
          aplicarMudanca([...resultado.pecas]);
        }
        if (resultado.abrir) setDialogoDeFerramenta({ tipo: 'alterar-pique', ...resultado.abrir });
        return;
      }
      if (ehModoDeGraduacao(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const resultado = cliqueDeGraduacao(
          modo,
          opcoesDaGraduacao,
          pecas,
          peca,
          trecho,
          { noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm), livre: semCaptura },
          { regra: regraEmUso, raioMm, novoId: proximoId },
        );
        // "Separar": postas as peças, a ferramenta desliga (outro clique poria outra cópia). O clique que só indica o tamanho não põe nada.
        if (modo === 'separar-tamanhos' && resultado.pecas) {
          const novasPecas = [...resultado.pecas];
          aplicarMudanca(novasPecas);
          cancelarModo();
          avisar(resultado.recado ?? '', novasPecas);
          return;
        }
        setTrecho(resultado.estado);
        setRecadoDaFerramenta(resultado.recado);
        if (resultado.pecas) aplicarMudanca([...resultado.pecas]);
        // Com um conjunto de regras em uso, a regra aplicada dá a vez à seguinte.
        if (resultado.pecas && modo === 'graduar-regras' && conjuntoEmUso) {
          setConjuntoEmUso({ id: conjuntoEmUso.id, posicao: conjuntoEmUso.posicao + 1 });
        }
        if (resultado.abrir?.tipo === 'tabela-do-pique') {
          setDialogoDeFerramenta({ tipo: 'tabela-do-pique', id: resultado.abrir.id });
        } else if (resultado.abrir) {
          setDialogoDeFerramenta({
            tipo: resultado.abrir.tipo === 'tabela' ? 'tabela-do-ponto' : 'nome-da-regra',
            indice: resultado.abrir.indice,
          });
        }
        return;
      }
      if (ehFerramentaDePence(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        const { estado, recusa, editar, reconhecer, editarPrega, reconhecerPrega, editarCunha } = cliqueDePence(modo, opcoesDasPences, peca, trecho, {
          noContorno: posicaoNoContornoPerto(semCaptura, peca.contorno, raioMm),
          livre: semCaptura,
          cunha: cunhaSobOClique(modo, peca, semCaptura),
          pence: pencePerto(peca, semCaptura, raioMm)?.id ?? null,
          semRegistro: penceSemRegistroSobOClique(modo, peca, semCaptura, raioMm),
          prega: pregaPerto(peca, semCaptura, 0)?.id ?? null,
          pregaSemRegistro: pregaSemRegistroSobOClique(modo, peca, semCaptura),
          linhaInterna: linhaInternaPerto(peca, semCaptura, raioMm)?.linha ?? null,
        });
        setRecadoDaFerramenta(recusa);
        if (recusa) return;
        // O clique dentro de uma prega em cunha (a do "Cortar intersecções") abre a abertura dela.
        if (editarCunha) {
          setDialogoDeFerramenta({ tipo: 'editar-cunha', id: editarCunha });
          return;
        }
        // Com "Pregas", o clique dentro de uma prega já feita abre as medidas dela.
        if (editarPrega) {
          setDialogoDeFerramenta({ tipo: 'editar-prega', id: editarPrega });
          return;
        }
        // Ou numa prega sem registro: as medidas abrem do mesmo jeito, e é aplicando que ela passa a ter registro.
        if (reconhecerPrega) {
          const id = proximoId();
          setDialogoDeFerramenta({ tipo: 'editar-prega', id, reconhecer: { ...reconhecerPrega, id } });
          return;
        }
        // O clique caiu numa pence já feita: abrem-se as medidas dela.
        if (editar) {
          setDialogoDeFerramenta({ tipo: 'editar-pence', id: editar });
          return;
        }
        // Ou numa pence sem registro: as medidas abrem do mesmo jeito, e é aplicando que ela passa a ter registro.
        if (reconhecer) {
          const id = proximoId();
          setDialogoDeFerramenta({ tipo: 'editar-pence', id, reconhecer: { ...reconhecer, id } });
          return;
        }
        if (!penceCompleta(modo, opcoesDasPences, estado)) {
          setTrecho(estado);
          return;
        }
        setTrecho(SEM_TRECHO);
        try {
          const resultado = aplicarPence(modo, opcoesDasPences, pecas, peca, estado, proximoId);
          aplicarMudanca([...resultado.pecas]);
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'desdobrar') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const aresta = arestaPerto(semCaptura, peca.contorno, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
        if (aresta === null) return;
        try {
          const resultado = aplicarDesdobrar(pecas, peca, aresta, proximoId, opcoesDeDobrar.fioNoCentro);
          aplicarMudanca([...resultado.pecas]);
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (modo === 'unir') {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        // Primeiro a aresta da peça selecionada; depois, a da outra peça.
        if (!trecho.inicio) {
          const aresta = arestaPerto(semCaptura, peca.contorno, raioMm);
          if (aresta === null) return;
          setRecadoDaFerramenta(null);
          setTrecho({ ...SEM_TRECHO, inicio: { indiceAresta: aresta, ponto: semCaptura } });
          return;
        }
        const alvo = arestaDeOutraPecaPerto(semCaptura, pecas, peca.id, raioMm);
        if (!alvo) return;
        setTrecho(SEM_TRECHO);
        try {
          const resultado = aplicarUniao(pecas, peca, trecho.inicio.indiceAresta, alvo.peca, alvo.indiceAresta, unirApenasMovendo, opcoesDeUniao);
          aplicarMudanca([...resultado.pecas]);
          // A peça que foi unida deixa de existir: sai também da seleção em lote.
          if (!unirApenasMovendo) {
            setIdsSelecionadosEmLote((atual) =>
              atual.has(alvo.peca.id) ? new Set([...atual].filter((id) => id !== alvo.peca.id)) : atual,
            );
          }
          setRecadoDaFerramenta(resultado.recado);
        } catch (e) {
          setRecadoDaFerramenta(e instanceof Error ? e.message : String(e));
        }
        return;
      }
      if (ehFerramentaDeCanto(modo)) {
        const peca = pecas.find((p) => p.id === selecionadoId);
        if (!peca) return;
        const canto = posicaoNoContornoPerto(semCaptura, peca.contorno, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
        // Só um vértice serve: o arco é tangente aos dois elementos que se encontram nele.
        if (!canto || distancia(canto.ponto, peca.contorno[canto.indiceAresta]!) >= 1e-9) {
          setRecadoDaFerramenta(null);
          return;
        }
        // Cada ferramenta vale para um tipo de canto; a recusa diz qual é a certa.
        const recusa = recusaDoCanto(modo, peca.contorno, canto.indiceAresta);
        setRecadoDaFerramenta(recusa);
        if (!recusa) setDialogoDeFerramenta({ tipo: 'raio-do-arco', indice: canto.indiceAresta });
        return;
      }
      if (modo === 'cota-raio') {
        const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
        // Um clique no número de uma cota a apaga, como nas outras cotas.
        const cotaClicada = cotaSobOPonto(pecas, semCaptura, raioMm);
        if (cotaClicada) {
          aplicarMudanca(pecas.map((p) => (p.id === cotaClicada.pecaId ? removerCota(p, cotaClicada.cotaId) : p)));
          setRecadoDaFerramenta(null);
          return;
        }
        const alvo = alvoDaMedicao(semCaptura, pecas, raioMm);
        if (!alvo || alvo.tipo !== 'contorno') {
          setRecadoDaFerramenta('Clique sobre o contorno de uma peça, num arco.');
          return;
        }
        const cota = cotaDeRaioEm(alvo.peca.contorno, alvo.posicao, proximoId());
        if (!cota) {
          setRecadoDaFerramenta('Esse trecho do contorno é uma reta: a cota de raio é para arcos, cantos arredondados e círculos.');
          return;
        }
        aplicarMudanca(pecas.map((p) => (p.id === alvo.peca.id ? adicionarCota(p, cota) : p)));
        setRecadoDaFerramenta(`Raio de ${formatarMm(valorDaCotaDeRaio(cota))} em “${alvo.peca.nome}”.`);
        return;
      }
      if (modo === 'circulo') {
        const centro = pontosEmEdicao[0];
        if (!centro) {
          // O clique no centro de um círculo já feito abre as medidas dele, em vez de começar outro.
          const feito = figuraSobOClique(pecas, semCaptura, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm, 'circulo');
          if (feito) {
            setDialogoDeFerramenta({ tipo: 'figura', id: feito.id });
            return;
          }
          setPontosEmEdicao([mundo]);
          return;
        }
        if (mesmoPonto(mundo, centro)) return;
        // Como no retângulo: o círculo vira molde depois da linha de fio.
        setContornoPendente(circulo(centro, mundo));
        setFiguraPendente(figuraDoCirculo(centro, mundo));
        setPontosEmEdicao([]);
        setModo('definir-fio');
        return;
      }
      if (modo === 'espiral') {
        if (!espiralPendente) return;
        const feita = figuraSobOClique(pecas, semCaptura, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm, 'espiral');
        if (feita) {
          setDialogoDeFerramenta({ tipo: 'figura', id: feita.id });
          return;
        }
        setContornoPendente(espiral(mundo, espiralPendente.larguraMm, espiralPendente.perimetroMm));
        setFiguraPendente(figuraDaEspiral(mundo, espiralPendente.larguraMm, espiralPendente.perimetroMm));
        setPontosEmEdicao([]);
        setModo('definir-fio');
        return;
      }
    },
    [
      modo,
      grupoDoPontoDeCasamento,
      pecaSelecionada,
      opcoesDeMarcacao,
      piquesCadastrados,
      mudarCadastroDePiques,
      opcoesDeCorte,
      corteManual,
      opcoesDeRemover,
      pontosEmEdicao,
      contornoPendente,
      figuraPendente,
      pecas,
      selecionadoId,
      donoDaCota,
      trecho,
      curvaEscolhida,
      espiralPendente,
      opcoesDeBainha,
      opcoesDaPecaDerivada,
      unirApenasMovendo,
      opcoesDeUniao,
      opcoesDasPences,
      opcoesDaGraduacao,
      regraEmUso,
      conjuntoEmUso,
      opcoesDeElemento,
      textoAInserir,
      calibracao,
      opcoesDeDobrar,
      opcoesDaConferencia,
      conferencia,
      alcaDeCurva,
      aplicarTrecho,
      transform.escalaPxPorMm,
      aplicarMudanca,
      cancelarModo,
      avisar,
      finalizarContornoEmEdicao,
    ],
  );

  /** As peças que chegam de um arquivo: no lugar delas, com a origem anotada, numa versão do histórico. */
  const acrescentarPecasImportadas = useCallback(
    (chegando: readonly Molde[], origem: Parameters<typeof origemDaPecaImportada>[1], descricao: string) => {
      const comOrigem = chegando.map((m) => ({ ...m, origemDaImportacao: origemDaPecaImportada(m, origem) }));
      const depois = [...pecas, ...comOrigem];
      aplicarMudanca(depois);
      // A importação fica como uma versão no histórico: a forma das peças como chegaram do arquivo.
      registrarEventoEPersistir('mudanca-de-moldes', { pecas: depois, tecido, enfesto }, descricao);
    },
    [pecas, tecido, enfesto, aplicarMudanca, registrarEventoEPersistir],
  );

  // A importação é direta (ADR 0091): o nome vem do arquivo e o fio fica na horizontal; nada é perguntado.
  const importarDxfHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Importação de arquivo só está disponível rodando dentro do aplicativo Electron (npm run dev / build), não num navegador comum.');
      return;
    }
    void api.abrirArquivoDxf().then((arquivo) => {
      if (!arquivo) return;
      arquivoImportadoRef.current = arquivo.caminho.split(/[\\/]/).pop() ?? arquivo.caminho;
      const nomeBase = arquivoImportadoRef.current.replace(/\.dxf$/i, '');
      const resultado = importarDxf(arquivo.conteudo, nomeBase);
      const avisos = [...resultado.avisos];
      if (resultado.unidadeAssumida) avisos.push(`Unidade do arquivo não declarada: ${resultado.unidadeDetectada}.`);
      if (resultado.pecas.length === 0) {
        setMensagensImportacao(avisos.length > 0 ? avisos : null);
        return;
      }
      try {
        const { moldes } = moldesDoDxf(resultado, proximoId);
        // A origem do DXF é arbitrária (pode estar no meio do desenho): o conjunto inteiro é deslocado para o canto
        // útil da mesa, com o mesmo deslocamento para todas as peças, sem mudar a posição relativa entre elas.
        const todos = moldes.flatMap((m) => m.contorno);
        const margens = margensDaMesa(enfesto ?? { margemLateralMm: 0, margemDeExtremidadeMm: 0 });
        const delta = ponto(margens.lateralMm - Math.min(...todos.map((p) => p.x)), margens.extremidadeMm - Math.min(...todos.map((p) => p.y)));
        const posicionados = moldes.map((m) => transladarMolde(m, delta, m.id));
        const origem = {
          formato: 'dxf' as const,
          arquivo: arquivoImportadoRef.current,
          importadaEmIso: new Date().toISOString(),
          unidade: resultado.unidadeDetectada,
          unidadeAssumida: resultado.unidadeAssumida,
        };
        acrescentarPecasImportadas(posicionados, origem, `Importação do DXF “${origem.arquivo}”: ${posicionados.length} peça(s), em ${origem.unidade}`);
        // Importou: as peças aparecem na lista e na mesa, sem faixa de avisos (pedido do usuário, ADR 0095). A faixa
        // fica para quando nada entra, com o motivo.
        setMensagensImportacao(null);
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        setMensagensImportacao([`Não foi possível importar: ${motivo}`, ...avisos]);
      }
    });
  }, [enfesto, acrescentarPecasImportadas]);

  // O PLT (ADR 0157): as peças deduzidas das linhas do arquivo entram como as do DXF.
  const importarPltHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) return;
    void api.abrirArquivoTexto('plt').then((arquivo) => {
      if (!arquivo) return;
      const nomeDoArquivo = arquivo.caminho.split(/[\\/]/).pop() ?? arquivo.caminho;
      const { pecas: lidas, avisos } = pecasDoPlt(arquivo.conteudo);
      if (lidas.length === 0) {
        setMensagensImportacao(avisos);
        return;
      }
      try {
        const moldes = lidas.map((p, i) => {
          const c = retanguloEnvolvente(p.contorno);
          return criarMolde(
            {
              nome: p.nome ?? `${nomeDoArquivo.replace(/\.[^.]+$/, '')} ${i + 1}`,
              referencia: '',
              tamanho: '',
              contorno: p.contorno,
              furos: p.furos,
              linhasInternas: p.linhasInternas,
              piques: p.piques.map((q) => ({ id: proximoId(), posicao: q.posicao, indiceAresta: q.indiceAresta })),
              linhaDeFio: p.fio ?? { inicio: ponto((c.minX + c.maxX) / 2, c.minY + 0.15 * (c.maxY - c.minY)), fim: ponto((c.minX + c.maxX) / 2, c.maxY - 0.15 * (c.maxY - c.minY)) },
            },
            proximoId(),
          );
        });
        const todos = moldes.flatMap((m) => m.contorno);
        const margens = margensDaMesa(enfesto ?? { margemLateralMm: 0, margemDeExtremidadeMm: 0 });
        const delta = ponto(margens.lateralMm - Math.min(...todos.map((p) => p.x)), margens.extremidadeMm - Math.min(...todos.map((p) => p.y)));
        const origem = { formato: 'plt' as const, arquivo: nomeDoArquivo, importadaEmIso: new Date().toISOString(), unidade: 'mm (40 unidades do plotter por mm)', unidadeAssumida: false };
        acrescentarPecasImportadas(moldes.map((m) => transladarMolde(m, delta, m.id)), origem, `Importação do PLT “${nomeDoArquivo}”: ${moldes.length} peça(s)`);
        setMensagensImportacao(null);
      } catch (erro) {
        setMensagensImportacao([`Não foi possível importar: ${erro instanceof Error ? erro.message : String(erro)}`]);
      }
    });
  }, [enfesto, acrescentarPecasImportadas]);

  const carregarPerfil = useCallback(() => {
    void window.enfestoCad?.abrirArquivoTexto('perfil').then((arquivo) => {
      if (!arquivo) return;
      try {
        const n = aplicarPerfil(window.localStorage, arquivo.conteudo);
        setMensagensImportacao([`Perfil carregado (${n} preferência(s)): vale ao abrir o programa de novo.`]);
      } catch (e) {
        setMensagensImportacao([e instanceof Error ? e.message : String(e)]);
      }
    });
  }, []);

  // Os dois arquivos que saem pelo mesmo caminho do texto.
  const exportarAstm = useCallback(async () => {
    const caminho = await salvarTexto('moldes-astm.dxf', gerarDxfAstm(pecas, projetoAtual.nome, proximoId));
    if (caminho) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `DXF ASTM salvo em ${caminho}`);
  }, [pecas, tecido, enfesto, projetoAtual.nome, salvarTexto, registrarEventoEPersistir]);

  const plotarMoldes = useCallback(
    async (opcoes: Parameters<typeof moldesParaPlotar>[1]) => {
      const lista = moldesParaPlotar(pecas, opcoes, proximoId);
      const plt = gerarPlt(lista, { canetas: canetasDoPlotter, larguraDaMesaMm: opcoes.larguraDoPapelMm, cabecalho: [`${projetoAtual.nome} (${projetoAtual.codigo}) - moldes`] });
      const caminho = await salvarTexto('moldes.plt', plt);
      if (caminho) registrarEventoEPersistir('exportacao-de-pdf', { pecas, tecido, enfesto }, `Moldes (PLT) salvos em ${caminho}: ${lista.length} peça(s)`);
    },
    [pecas, tecido, enfesto, canetasDoPlotter, projetoAtual.nome, projetoAtual.codigo, salvarTexto, registrarEventoEPersistir],
  );

  // O projeto num arquivo (ADR 0156): sai como está agora; entra na biblioteca e abre, sem trocar o que há nela.
  const exportarProjetoHandler = useCallback(async (senha: string | null) => {
    const api = window.enfestoCad;
    const projeto = projetoParaEnviarARede(projetoAtual.id);
    if (!api || !projeto) return;
    const claro = textoDoProjeto(projeto);
    const bytes = new TextEncoder().encode(senha ? await cifrarProjeto(claro, senha) : claro);
    const caminho = await api.salvarArquivo(nomeDoArquivoDoProjeto(projeto), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    if (caminho) setMensagensImportacao([`Projeto salvo em ${caminho}.`]);
  }, [projetoAtual.id, projetoParaEnviarARede]);

  const entrarComOProjeto = useCallback(
    (texto: string) => {
      const r = projetoDoArquivo(texto, projetos, { id: () => `projeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, codigo: novoCodigoDeProjeto });
      if ('erro' in r) {
        setMensagensImportacao([r.erro]);
        return;
      }
      if (JSON.stringify(projetoAtual.estadoAtual) !== JSON.stringify({ pecas, tecido, enfesto })) {
        const salvo = salvarAntesDeTrocar();
        setProjetos((lista) => [...lista.filter((p) => p.id !== salvo.id), salvo]);
      }
      setProjetos((lista) => [...lista, r.projeto]);
      mostrarProjeto(r.projeto);
      void persistirProjeto(r.projeto).then(carregarListaDeProjetos);
    },
    [projetos, projetoAtual, pecas, tecido, enfesto, novoCodigoDeProjeto, salvarAntesDeTrocar, mostrarProjeto, persistirProjeto, carregarListaDeProjetos],
  );

  const importarProjetoHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) return;
    void api.abrirArquivoTexto('projeto').then((arquivo) => {
      if (!arquivo) return;
      if (ehProjetoCifrado(arquivo.conteudo)) setDialogoDeFerramenta({ tipo: 'senha-do-projeto', conteudo: arquivo.conteudo });
      else entrarComOProjeto(arquivo.conteudo);
    });
  }, [entrarComOProjeto]);

  const importarPdfHandler = useCallback(() => {
    const api = window.enfestoCad;
    if (!api) {
      window.alert('Importação de arquivo só está disponível rodando dentro do aplicativo Electron (npm run dev / build), não num navegador comum.');
      return;
    }
    void api.abrirArquivoPdf().then(async (arquivo) => {
      if (!arquivo) return;
      arquivoImportadoRef.current = arquivo.caminho.split(/[\\/]/).pop() ?? arquivo.caminho;
      const nomeBase = arquivoImportadoRef.current.replace(/\.pdf$/i, '');
      const resultado = importarPdf(arquivo.conteudo);
      // A peça sem linha de fio no PDF entra com o fio na horizontal, como as do DXF.
      const pecasDoPdf = resultado.pecas.map((p) => (p.linhaDeFio || p.molde ? p : { ...p, linhaDeFio: linhaDeFioSobreContorno(p.contorno, 'horizontal') }));
      const mensagens = [...resultado.avisos];
      let importadas = 0;

      // A peça inteira, quando o PDF traz o registro dela; senão, a que o desenho mostra. Cada uma vai para um
      // lugar livre: as posições da página não dizem nada, e deixariam a peça em cima das que já estão no projeto.
      const agora = new Date().toISOString();
      if (pecasDoPdf.length > 0) {
        const novosMoldes = posicionarAsQueChegam(pecasDoPdf.map((p) => moldeDaPecaImportada(p, proximoId)), pecas, enfesto);
        acrescentarPecasImportadas(
          novosMoldes,
          { formato: 'pdf', arquivo: arquivoImportadoRef.current, importadaEmIso: agora, unidade: 'mm (tamanho real do PDF)', unidadeAssumida: false },
          `Importação do PDF “${arquivoImportadoRef.current}”: ${novosMoldes.length} peça(s)`,
        );
        importadas += novosMoldes.length;
      }
      if (resultado.pecas.length === 0) {
        const contornos = await extrairContornosDoPdf(arquivo.conteudo);
        if (contornos.candidatos.length > 0 && contornos.alturaPaginaPt !== null) {
          // PDF de outro programa: os contornos fechados viram peças no tamanho do papel, com o nome do arquivo.
          const moldes = moldesDosContornosDoPdf(contornos, nomeBase, proximoId);
          acrescentarPecasImportadas(
            moldes,
            { formato: 'pdf', arquivo: arquivoImportadoRef.current, importadaEmIso: agora, unidade: 'tamanho do papel (1:1, em mm)', unidadeAssumida: true },
            `Importação do PDF “${arquivoImportadoRef.current}”: ${moldes.length} peça(s)`,
          );
          importadas += moldes.length;
        } else {
          const diagnostico = await diagnosticarVetorPdf(arquivo.conteudo);
          if (diagnostico.subcaminhos > 0) {
            const textoDoDiagnostico = descreverDiagnosticoVetorial(diagnostico);
            const indiceGenerico = mensagens.findIndex((m) => m.startsWith('Nenhuma peça reconhecível'));
            if (indiceGenerico >= 0) mensagens.splice(indiceGenerico, 1, textoDoDiagnostico);
            else mensagens.push(textoDoDiagnostico);
          }
        }
      }
      // Como no DXF: importou, sem faixa; nada entrou, a faixa diz o motivo (ADR 0095).
      setMensagensImportacao(importadas === 0 && mensagens.length > 0 ? mensagens : null);
    });
  }, [pecas, enfesto, acrescentarPecasImportadas]);

  // Ao abrir o programa o foco fica no corpo da página, fora da janela do
  // app, e os atalhos (F1, Ctrl+O...) só valeriam depois do primeiro clique.
  // Só pega o foco se ninguém o tiver: um diálogo aberto fica com ele.
  const appShellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) appShellRef.current?.focus();
  }, []);

  const aoTeclar = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Os diálogos (Sobreposicao) já seguram as próprias teclas; isto cobre
      // uma tecla que chegue de fora deles enquanto um está aberto.
      if (e.currentTarget.querySelector('[role="dialog"][aria-modal="true"]')) return;

      if (e.key === 'F1') {
        e.preventDefault();
        setPainelDeAjuda('atalhos');
        return;
      }

      if (ehCampoDeDigitar(e.target)) return;

      const teclaDoEncaixe = modo === 'selecionar' ? acaoDaTeclaDoEncaixe(e) : null;
      if (teclaDoEncaixe) {
        e.preventDefault();
        if (teclaDoEncaixe.tipo === 'plotar') void exportarPlt();
        else if (teclaDoEncaixe.tipo === 'localizar') abrirBiblioteca();
        else if (teclaDoEncaixe.tipo === 'verificar') setMostrarValidacao(true);
        else if (teclaDoEncaixe.tipo === 'medir') entrarModoDeMedida('medir-distancia');
        else if (teclaDoEncaixe.tipo === 'cortar') usarFerramentaDeMolde('cortar');
        else if (teclaDoEncaixe.tipo === 'texto') usarFerramentaDeAnotacao('inserir-texto');
        else executarTeclaDoEncaixe(teclaDoEncaixe);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        // Primeiro desliga a Mão/Zoom por janela; a ferramenta de baixo continua.
        if (ferramentaDeVista !== null) setFerramentaDeVista(null);
        else cancelarModo();
      } else if (e.key === 'Enter' && (modo === 'novo-molde' || modo === 'novo-furo')) {
        e.preventDefault();
        finalizarContornoEmEdicao();
      } else if (e.key === 'Enter' && modo === 'remover-regiao' && !trecho.inicio && trecho.livres.length > 0) {
        // "Remover região" pelos elementos: o Enter confirma a linha (e, com "Unir moldes", a segunda tira a faixa).
        e.preventDefault();
        const peca = pecas.find((p) => p.id === selecionadoId);
        const confirmado = peca && confirmarElementosDeRemover(pecas, peca, trecho, proximoId, opcoesDeRemover);
        if (confirmado) {
          setTrecho(confirmado.estado);
          if (confirmado.pecas) aplicarMudanca([...confirmado.pecas]);
          setRecadoDaFerramenta(confirmado.recado);
        }
      } else if (e.key === 'Enter' && modo === 'linhas-auxiliares' && trecho.livres.length > 0) {
        // "Linhas auxiliares", no modo manual: o Enter converte as linhas indicadas.
        e.preventDefault();
        const peca = pecas.find((p) => p.id === selecionadoId);
        const confirmado = peca && confirmarLinhasAuxiliares(opcoesDeMarcacao, pecas, peca, trecho);
        if (confirmado) {
          setTrecho(confirmado.estado);
          if (confirmado.pecas) aplicarMudanca([...confirmado.pecas]);
          setRecadoDaFerramenta(confirmado.recado);
        }
      } else if (e.key === 'Enter' && modo === 'cadastrar-pique' && trecho.livres.length > 0) {
        // "Cadastrar pique": o Enter confirma as linhas do desenho; o clique seguinte é o do ponto de referência.
        e.preventDefault();
        const peca = pecas.find((p) => p.id === selecionadoId);
        const confirmado = peca && confirmarLinhasDoCadastro(peca, trecho);
        if (confirmado) {
          setTrecho(confirmado.estado);
          setRecadoDaFerramenta(confirmado.recado);
        }
      } else if (e.key === 'Enter' && modo === 'cortar' && !trecho.inicio && trecho.livres.length > 0) {
        // "Contorno manual" do Cortar: o Enter confirma os elementos indicados.
        e.preventDefault();
        const peca = pecas.find((p) => p.id === selecionadoId);
        const confirmado = peca && confirmarCortePelosElementos(pecas, peca, trecho, proximoId, opcoesDeCorte);
        if (confirmado) {
          setTrecho(confirmado.estado);
          if (confirmado.pecas) aplicarMudanca([...confirmado.pecas]);
          setRecadoDaFerramenta(confirmado.recado);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        refazer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicarSelecionado();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && modo === 'manipulacao-rapida' && trecho.livres.length > 0) {
        // Com um elemento escolhido na "Manipulação rápida", Delete apaga o elemento, e não a peça.
        e.preventDefault();
        const peca = pecas.find((p) => p.id === selecionadoId);
        const apagado = peca && apagarElementoEscolhido(pecas, peca, trecho, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
        setTrecho(SEM_TRECHO);
        if (apagado) {
          aplicarMudanca([...apagado.pecas]);
          setRecadoDaFerramenta(apagado.recado);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && modo === 'editar-pontos-de-curva' && alcaDeCurva) {
        // Com um ponto de passagem escolhido, Delete tira o ponto de passagem, e não a peça.
        e.preventDefault();
        const peca = pecas.find((p) => p.id === selecionadoId);
        const apagada = peca && apagarAlca(pecas, peca, alcaDeCurva);
        setAlcaDeCurva(null);
        if (apagada) {
          if (apagada.pecas) aplicarMudanca([...apagada.pecas]);
          setRecadoDaFerramenta(apagada.recado);
        }
      } else if (e.key === 'Backspace' && modo === 'curva' && trecho.livres.length > 0) {
        e.preventDefault();
        setTrecho((atual) => ({ ...atual, livres: atual.livres.slice(0, -1) }));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        excluirSelecionado();
      } else if (e.key === '+' || e.key === '=') {
        zoom(1.15);
      } else if (e.key === '-') {
        zoom(1 / 1.15);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        ajustarTela();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarComo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarProjetoAtual();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        abrirBiblioteca();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        novoProjeto();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        importarDxfHandler();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (pecas.length > 0) setMostrarExportacaoPdf(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setMostrarHistorico(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selecionarTudo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copiarSelecionado();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        recortarSelecionado();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        colar();
      }
    },
    [
      modo,
      trecho,
      opcoesDeCorte,
      opcoesDeRemover,
      opcoesDeMarcacao,
      alcaDeCurva,
      pecas,
      selecionadoId,
      transform.escalaPxPorMm,
      aplicarMudanca,
      ferramentaDeVista,
      executarTeclaDoEncaixe,
      exportarPlt,
      entrarModoDeMedida,
      usarFerramentaDeMolde,
      usarFerramentaDeAnotacao,
      cancelarModo,
      finalizarContornoEmEdicao,
      desfazer,
      refazer,
      duplicarSelecionado,
      excluirSelecionado,
      zoom,
      ajustarTela,
      salvarProjetoAtual,
      salvarComo,
      abrirBiblioteca,
      novoProjeto,
      importarDxfHandler,
      selecionarTudo,
      copiarSelecionado,
      recortarSelecionado,
      colar,
    ],
  );

  // O menu Editar do Mac (⌘Z, ⌘C, ⌘V…): lá o menu pega a tecla antes da página, e manda a ação para cá. Num campo
  // de texto ela é do texto; no desenho, do programa. As funções vão por uma referência: a escuta é feita uma vez só.
  const acoesDoMenuRef = useRef({ desfazer, refazer, copiarSelecionado, recortarSelecionado, colar, selecionarTudo });
  useEffect(() => {
    acoesDoMenuRef.current = { desfazer, refazer, copiarSelecionado, recortarSelecionado, colar, selecionarTudo };
  }, [desfazer, refazer, copiarSelecionado, recortarSelecionado, colar, selecionarTudo]);
  useEffect(
    () =>
      window.enfestoCad?.aoEditarPeloMenu?.((acao) => {
        const janelaAberta = document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
        const destino = destinoDaAcaoDoMenu(ehCampoDeDigitar(document.activeElement), janelaAberta);
        if (destino === 'texto') window.enfestoCad?.editarTexto(acao);
        if (destino !== 'programa') return;
        const acoes = acoesDoMenuRef.current;
        if (acao === 'desfazer') acoes.desfazer();
        else if (acao === 'refazer') acoes.refazer();
        else if (acao === 'copiar') acoes.copiarSelecionado();
        else if (acao === 'recortar') acoes.recortarSelecionado();
        else if (acao === 'colar') acoes.colar();
        else acoes.selecionarTudo();
      }),
    [],
  );

  // Medidas da aba Conferência: só aparecem com uma das ferramentas dela
  // ligada, e só as que ainda valem para as peças de agora.
  const emModoDeMedida =
    modo === 'medir-distancia' ||
    modo === 'medir-perimetro' ||
    modo === 'comparar-perimetros' ||
    modo === 'comparar-distancias';
  // A cota como ficaria com o próximo clique: só quando falta o clique que a posiciona.
  const cotaEmPrevia = useMemo(
    () => (ehFerramentaDeCotaPorPontos(modo) ? previaDaCota(modo, pontosEmEdicao, cursorMundo) : null),
    [modo, pontosEmEdicao, cursorMundo],
  );
  const medicoesResolvidas = useMemo(
    () =>
      emModoDeMedida
        ? medicao.medicoes.map((m) => resolverMedicao(m, pecas)).filter((m): m is MedicaoResolvida => m !== null)
        : [],
    [emModoDeMedida, medicao, pecas],
  );
  const inicioDoTrecho = useMemo(() => {
    const inicio = emModoDeMedida ? medicao.inicioDoTrecho : null;
    if (!inicio || !pecas.some((p) => p.id === inicio.pecaId && p.contorno === inicio.contorno)) return null;
    return inicio.de.ponto;
  }, [emModoDeMedida, medicao, pecas]);

  // Prévia das ferramentas de curva e arco: o trecho que sai, a linha que entra
  // e os pontos já indicados; no círculo e na espiral, o contorno novo inteiro.
  const previaNoDesenho = useMemo<PreviaNoDesenho | null>(() => {
    if (modo === 'calibrar-imagem' && calibracao) {
      // Os pontos já clicados e a medida que eles marcam (até o mouse, enquanto falta o segundo).
      const [primeiro, segundo] = calibracao.pontos;
      const ate = segundo ?? cursorMundo;
      return { marcas: calibracao.pontos, ...(primeiro && ate ? { linhas: [[primeiro, ate]] } : {}) };
    }
    if (modo === 'editar-pontos-de-curva' && pecaSelecionada && !trecho.inicio) {
      // As alças das curvas registradas e, com uma escolhida, a curva como ficaria com ela no lugar do mouse.
      const alcas = previaDasAlcas(pecaSelecionada, alcaDeCurva, cursorMundo);
      if (alcas) return alcas;
    }
    if (ehFerramentaDeTrecho(modo) && pecaSelecionada) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const mouse = cursorMundo
        ? { noContorno: posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm), livre: cursorMundo }
        : null;
      const opcoes =
        modo === 'curva-predefinida' && curvaEscolhida
          ? { forma: curvaEscolhida.curva.forma, espelhar: curvaEscolhida.espelhar }
          : {};
      return previaDoTrecho(modo, pecaSelecionada.contorno, trecho, mouse, opcoes);
    }
    if (pecaSelecionada && ehModoDeMarcacao(modo)) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const noContorno = cursorMundo ? posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm) : null;
      return previaDaMarcacao(modo, opcoesDeMarcacao, pecaSelecionada, trecho, cursorMundo ? { noContorno, livre: cursorMundo } : null, {
        raioMm,
        linhaInterna: cursorMundo && !noContorno ? (linhaInternaPerto(pecaSelecionada, cursorMundo, raioMm)?.linha ?? null) : null,
      });
    }
    if (pecaSelecionada && ehModoDeGraduacao(modo)) {
      return previaDaGraduacao(modo, opcoesDaGraduacao, pecaSelecionada, trecho, cursorMundo, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
    }
    if (pecaSelecionada && ehModoDeElemento(modo)) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const mouse = cursorMundo
        ? { noContorno: posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm), livre: cursorMundo }
        : null;
      return previaDoElemento(modo, opcoesDeElemento, pecas, pecaSelecionada, trecho, mouse, raioMm);
    }
    if (pecaSelecionada && ehFerramentaDePence(modo)) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const mouse = cursorMundo
        ? {
            noContorno: posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm),
            livre: cursorMundo,
            pence: pencePerto(pecaSelecionada, cursorMundo, raioMm)?.id ?? null,
            semRegistro: penceSemRegistroSobOClique(modo, pecaSelecionada, cursorMundo, raioMm),
            prega: pregaPerto(pecaSelecionada, cursorMundo, 0)?.id ?? null,
            pregaSemRegistro: pregaSemRegistroSobOClique(modo, pecaSelecionada, cursorMundo),
            cunha: cunhaSobOClique(modo, pecaSelecionada, cursorMundo),
            linhaInterna: linhaInternaPerto(pecaSelecionada, cursorMundo, raioMm)?.linha ?? null,
          }
        : null;
      return previaDaPence(modo, opcoesDasPences, pecaSelecionada, trecho, mouse);
    }
    if (modo === 'conferir') {
      return previaDaConferencia(opcoesDaConferencia, pecas, conferencia, cursorMundo, RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm);
    }
    if (pecaSelecionada && modo === 'dobrar') {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const mouse = cursorMundo
        ? {
            noContorno: posicaoNoContornoPerto(cursorMundo, pecaSelecionada.contorno, raioMm),
            livre: cursorMundo,
            linhaInterna: linhaInternaPerto(pecaSelecionada, cursorMundo, raioMm)?.linha ?? null,
          }
        : null;
      return previaDeDobrar(opcoesDeDobrar, pecaSelecionada, trecho, mouse);
    }
    if (pecaSelecionada && (ehFerramentaDeReta(modo) || modo === 'bainha' || modo === 'forro-entretela-vista' || modo === 'desdobrar' || modo === 'unir')) {
      const raioMm = RAIO_DE_MEDICAO_PX / transform.escalaPxPorMm;
      const contorno = pecaSelecionada.contorno;
      if (modo === 'desdobrar') return previaDeDesdobrar(pecaSelecionada, cursorMundo ? arestaPerto(cursorMundo, contorno, raioMm) : null);
      if (modo === 'unir') {
        return previaDeUnir(
          pecaSelecionada,
          trecho.inicio?.indiceAresta ?? null,
          cursorMundo ? arestaPerto(cursorMundo, contorno, raioMm) : null,
          cursorMundo ? arestaDeOutraPecaPerto(cursorMundo, pecas, pecaSelecionada.id, raioMm) : null,
        );
      }
      const mouse = cursorMundo ? { noContorno: posicaoNoContornoPerto(cursorMundo, contorno, raioMm), livre: cursorMundo } : null;
      if (modo === 'cortar') {
        // Com a linha do corte indicada, a parte sob o mouse: é a que ganha a costura.
        const daParte = previaDaParteDoCorte(pecaSelecionada, trecho, cursorMundo, opcoesDeCorte);
        if (daParte) return daParte;
        // O elemento sob o mouse (fora do contorno) e os já indicados: a linha do corte que eles dão.
        const sobOMouse = cursorMundo && !mouse?.noContorno ? (linhaInternaPerto(pecaSelecionada, cursorMundo, raioMm)?.linha ?? null) : null;
        const pelosElementos = previaDoCortePelosElementos(pecaSelecionada, trecho, sobOMouse, corteManual);
        if (pelosElementos) return pelosElementos;
      }
      if (modo === 'remover-regiao') {
        const sobOMouse = cursorMundo && !mouse?.noContorno ? (linhaInternaPerto(pecaSelecionada, cursorMundo, raioMm)?.linha ?? null) : null;
        const pelosElementos = previaDoRemoverPelosElementos(pecaSelecionada, trecho, sobOMouse, cursorMundo, opcoesDeRemover.unir);
        if (pelosElementos) return pelosElementos;
      }
      return modo === 'bainha'
        ? previaDaBainha(pecaSelecionada, trecho, mouse, opcoesDeBainha)
        : modo === 'forro-entretela-vista'
          ? previaDaPecaDerivada(pecaSelecionada, trecho, mouse, opcoesDaPecaDerivada)
          : previaDaReta(modo, pecaSelecionada, trecho, mouse, modo === 'remover-regiao' && opcoesDeRemover.unir);
    }
    if (modo === 'circulo' && pontosEmEdicao[0] && cursorMundo && !mesmoPonto(pontosEmEdicao[0], cursorMundo)) {
      return { novo: circulo(pontosEmEdicao[0], cursorMundo), novoFechado: true };
    }
    // Antes do centro: um anel no centro de cada círculo já feito (o clique nele abre as medidas).
    if (modo === 'circulo' && !pontosEmEdicao[0]) {
      const centros = centrosDasFiguras(pecas, 'circulo');
      if (centros.length > 0) return { marcas: centros };
    }
    if (modo === 'espiral' && espiralPendente && cursorMundo) {
      return { novo: espiral(cursorMundo, espiralPendente.larguraMm, espiralPendente.perimetroMm), novoFechado: true, marcas: centrosDasFiguras(pecas, 'espiral') };
    }
    return null;
  }, [
    modo,
    opcoesDeMarcacao,
    corteManual,
    opcoesDeCorte,
    opcoesDeRemover.unir,
    pecas,
    pecaSelecionada,
    trecho,
    cursorMundo,
    curvaEscolhida,
    espiralPendente,
    opcoesDeBainha,
    opcoesDaPecaDerivada,
    opcoesDasPences,
    opcoesDaGraduacao,
    opcoesDeElemento,
    opcoesDeDobrar,
    opcoesDaConferencia,
    conferencia,
    alcaDeCurva,
    pontosEmEdicao,
    calibracao,
    transform.escalaPxPorMm,
  ]);

  /** O texto da ferramenta de curva ou arco ligada, conforme o que já foi clicado. */
  const textoDaConstrucao = ((): string | null => {
    const fim = ' Esc sai.';
    if (ehFerramentaDePence(modo)) {
      return instrucaoDaPence(
        modo,
        opcoesDasPences,
        trecho,
        pecaSelecionada ? pencesDaPeca(pecaSelecionada).length > 0 : false,
        pecaSelecionada ? pregasDaPeca(pecaSelecionada).length > 0 : false,
      );
    }
    if (ehModoDeMarcacao(modo)) return instrucaoDaMarcacao(modo, opcoesDeMarcacao, trecho);
    if (ehModoDeGraduacao(modo)) return instrucaoDaGraduacao(modo, opcoesDaGraduacao, trecho, regraEmUso, vezDoConjunto);
    if (ehModoDeElemento(modo)) return instrucaoDoElemento(modo, opcoesDeElemento, trecho);
    if (modo === 'conferir') return textoDaConferencia(opcoesDaConferencia, conferencia, cursorMundo);
    if (modo === 'calibrar-imagem') {
      return (
        (calibracao?.pontos.length === 1
          ? 'Calibrar escala: agora clique na outra ponta da medida.'
          : 'Calibrar escala: clique numa ponta de uma medida que você conhece na imagem (o zero de uma régua, por exemplo).') + fim
      );
    }
    if (modo === 'inserir-texto') return `Inserir texto: clique onde o texto “${textoAInserir.texto.trim()}” deve ficar, na peça selecionada.` + fim;
    if (modo === 'editar-texto') return 'Editar texto: clique em cima de um texto da peça selecionada.' + fim;
    if (modo === 'linha-de-simetria') {
      return 'Linha de simetria: clique na aresta em que a peça selecionada é dobrada (clicar de novo na mesma aresta tira a marca).' + fim;
    }
    if (modo === 'relacionar-piques') return 'Relacionamento piques: clique em cima de um pique da peça selecionada para dar o código dele.' + fim;
    switch (modo) {
      case 'curva':
        if (!trecho.inicio) return 'Curva: clique no contorno da peça selecionada, onde a curva começa.' + fim;
        return trecho.livres.length === 0
          ? 'Curva: clique nos pontos por onde a curva deve passar, fora do contorno.' + fim
          : 'Curva: mais pontos de passagem, ou clique no contorno, onde a curva termina — ela entra no lugar do trecho em destaque. Backspace desfaz o último ponto.' + fim;
      case 'arco-2-pontos':
        if (!trecho.inicio) return 'Arco por 2 pontos: clique no contorno da peça selecionada, onde o arco começa.' + fim;
        return !trecho.fim
          ? 'Arco por 2 pontos: clique no contorno, onde o arco termina.' + fim
          : 'Arco por 2 pontos: clique por onde o arco deve passar.' + fim;
      case 'arco-3-pontos':
        if (!trecho.inicio) return 'Arco por 3 pontos: clique no contorno da peça selecionada, onde o arco começa.' + fim;
        return trecho.livres.length === 0
          ? 'Arco por 3 pontos: clique por onde o arco deve passar, fora do contorno.' + fim
          : 'Arco por 3 pontos: clique no contorno, onde o arco termina (um clique fora dele troca o ponto de passagem).' + fim;
      case 'arco-tangente':
        return 'Arco tangente a 2 retas: clique num canto da peça selecionada e digite o raio.' + fim;
      case 'arco-tangente-arco-reta':
        return 'Arco tangente a arco e reta: clique num canto em que um arco encontra uma reta e digite o raio.' + fim;
      case 'arco-tangente-2-arcos':
        return 'Arco tangente a 2 arcos: clique num canto em que dois arcos se encontram e digite o raio.' + fim;
      case 'arco-tangente-a-elemento':
        return !trecho.inicio
          ? 'Arco tangente à reta ou arco: clique no contorno da peça selecionada, onde o arco começa — ele sai dali dando continuidade ao elemento vizinho.' + fim
          : 'Arco tangente à reta ou arco: clique no contorno, onde o arco termina — ele entra no lugar do trecho em destaque.' + fim;
      case 'cota-raio':
        return 'Raio: clique sobre um arco do contorno de uma peça. Para apagar uma cota, clique no número dela.' + fim;
      case 'editar-pontos-de-curva':
        if (alcaDeCurva) return instrucaoComAlca(alcaDeCurva) + fim;
        return !trecho.inicio
          ? 'Editar pontos de curva: clique no contorno da peça selecionada, no começo do trecho.' + avisoDasAlcas(pecaSelecionada) + fim
          : 'Editar pontos de curva: clique no fim do trecho — os pontos entre os dois serão redistribuídos.' + fim;
      case 'cadastrar-curva':
        return !trecho.inicio
          ? 'Cadastrar curva: clique no contorno da peça selecionada, no começo do trecho a guardar.' + fim
          : 'Cadastrar curva: clique no fim do trecho.' + fim;
      case 'curva-predefinida': {
        const nome = curvaEscolhida ? ` (“${curvaEscolhida.curva.nome}”${curvaEscolhida.espelhar ? ', espelhada' : ''})` : '';
        return !trecho.inicio
          ? `Pré-definida${nome}: clique no contorno da peça selecionada, onde a curva começa.` + fim
          : `Pré-definida${nome}: clique no contorno, onde a curva termina.` + fim;
      }
      case 'circulo':
        return pontosEmEdicao.length === 0
          ? 'Por raio: clique no centro do círculo.' + avisoDasFiguras(pecas, 'circulo') + fim
          : 'Por raio: clique na borda do círculo — a distância até o centro é o raio, e a barra de status mostra a medida.' + fim;
      case 'espiral':
        return 'Espiral: clique onde o centro da espiral deve ficar.' + avisoDasFiguras(pecas, 'espiral') + fim;
      case 'cortar':
        return instrucaoDaReta('cortar', trecho, undefined, corteManual);
      case 'remover-regiao':
        return instrucaoDaReta('remover-regiao', trecho, opcoesDeRemover);
      case 'dobrar':
        return instrucaoDeDobrar(opcoesDeDobrar, trecho);
      case 'desdobrar':
        return (
          `Desdobrar: clique na aresta da peça selecionada que é a linha de dobra — ${
            pecaSelecionada?.dobraMantida ? 'a metade guardada volta como era (noutra aresta, entra o espelho)' : 'a outra metade entra espelhada'
          }${opcoesDeDobrar.fioNoCentro ? ', e o fio vai para o centro da peça' : ''}.` + fim
        );
      case 'unir': {
        const nome = unirApenasMovendo ? 'Unir (apenas mover)' : 'Unir';
        return !trecho.inicio
          ? `${nome}: clique na aresta da peça selecionada por onde as duas se juntam.` + fim
          : `${nome}: clique na aresta da outra peça — ela gira e encosta na aresta em destaque.` + fim;
      }
      case 'bainha':
        return !trecho.inicio
          ? 'Bainha: clique no contorno da peça selecionada, onde a bainha começa.' + fim
          : 'Bainha: clique no contorno, onde a bainha termina — a sobra tracejada entra no lugar do trecho em destaque.' + fim;
      case 'forro-entretela-vista': {
        const qual = opcoesDaPecaDerivada.tipo === 'vista' ? 'a vista' : 'o forro';
        return !trecho.inicio
          ? `${qual === 'a vista' ? 'Vista' : 'Forro'}: clique no contorno da peça selecionada, onde o trecho começa.` + fim
          : `${qual === 'a vista' ? 'Vista' : 'Forro'}: clique onde o trecho termina — a peça tracejada é ${qual} que sai, ao lado da peça.` + fim;
      }
      default:
        return null;
    }
  })();

  // Diálogos da graduação: o das opções da ferramenta pedida e o da tabela do ponto clicado.
  const dialogoDeGraduacao =
    dialogoDeFerramenta?.tipo === 'graduacao' && pecaSelecionada
      ? dialogoDaGraduacao(dialogoDeFerramenta.ferramenta, opcoesDaGraduacao, pecaSelecionada)
      : null;
  const pontoDaGraduacao = ((): {
    readonly indice: number;
    readonly graduacao: NonNullable<Molde['graduacao']>;
    readonly regra: readonly Ponto2D[];
  } | null => {
    if (dialogoDeFerramenta?.tipo !== 'tabela-do-ponto' && dialogoDeFerramenta?.tipo !== 'nome-da-regra') return null;
    const graduacao = pecaSelecionada?.graduacao;
    const indice = dialogoDeFerramenta.indice;
    if (!pecaSelecionada || !graduacao || indice >= pecaSelecionada.contorno.length) return null;
    return { indice, graduacao, regra: regraDoVertice(graduacao, pecaSelecionada.contorno, indice) };
  })();
  const regraParaColar = ((): readonly Ponto2D[] | null => {
    if (!regraCopiada || !pontoDaGraduacao) return null;
    try {
      return regraParaAGraduacao(regraCopiada, pontoDaGraduacao.graduacao);
    } catch {
      return null;
    }
  })();

  // O diálogo de opções da ferramenta de reta ou ponto que foi pedida.
  const dialogoDeElemento =
    dialogoDeFerramenta?.tipo === 'elemento' ? dialogoDoElemento(dialogoDeFerramenta.ferramenta, opcoesDeElemento) : null;

  // O diálogo de opções da ferramenta de pence ou prega que foi pedida.
  const dialogoDePence =
    dialogoDeFerramenta?.tipo === 'pence' ? dialogoDaPence(dialogoDeFerramenta.ferramenta, opcoesDasPences) : null;

  const textoDaFaixa = ((): React.ReactNode => {
    if (ferramentaDeVista === 'mao') return 'Mão: arraste para mover a vista. Esc ou um novo clique na Mão para sair.';
    if (ferramentaDeVista === 'zoom-elemento') return 'Zoom de um elemento: clique numa peça, numa linha ou num furo. Esc para cancelar.';
    if (ferramentaDeVista === 'zoom-janela') {
      return 'Zoom por janela: arraste um retângulo sobre a área a ampliar. Esc para cancelar.';
    }
    // Ferramentas de curva e arco: o recado do que a ferramenta acabou de fazer
  // (ou de por que não fez) vem antes da instrução do próximo clique.
    if (textoDaConstrucao) return recadoDaFerramenta ? `${recadoDaFerramenta} — ${textoDaConstrucao}` : textoDaConstrucao;
    switch (modo) {
      case 'novo-molde':
        return `${recadoDaFerramenta ? `${recadoDaFerramenta} — ` : ''}Clique para adicionar pontos do contorno. Enter fecha o contorno (com o Ímã ligado, clicar no primeiro ponto também fecha); Esc cancela.`;
      case 'novo-furo':
        return 'Clique para adicionar pontos do furo. Enter fecha o furo (com o Ímã ligado, clicar no primeiro ponto também fecha); Esc cancela.';
      case 'retangulo':
        return pontosEmEdicao.length === 0
          ? 'Retângulo: clique no primeiro canto. Esc cancela.'
          : 'Retângulo: clique no canto oposto — as medidas dos lados aparecem no desenho e na barra de status. Esc cancela.';
      case 'definir-fio':
        return pontosEmEdicao.length === 0
          ? 'Clique no início da linha de fio.'
          : 'Clique no fim da linha de fio (a seta aponta para lá).';
      case 'sentido-do-fio':
        return pontosEmEdicao.length === 0
          ? 'Sentido do fio: clique no início da nova linha de fio da peça selecionada. Esc cancela.'
          : 'Sentido do fio: clique no fim da linha de fio (a seta aponta para lá). Esc cancela.';
      case 'definir-cerca':
        return 'Arraste de um canto ao outro para definir a cerca. Esc para cancelar.';
      case 'modificar':
        return 'Modificar: clique num ponto da peça para digitar o deslocamento exato, ou arraste-o. Para vários pontos, use Shift+clique ou um retângulo e depois clique num deles. Esc sai.';
      case 'redefinir-perimetro':
        return 'Redefinir perímetro: clique numa aresta da peça, perto da ponta que deve andar, e digite o novo comprimento. Esc sai.';
      // As quatro abaixo ficavam sem instrução: o botão ficava apertado, e nada dizia o que fazer.
      case 'mover-ponto':
        return 'Mover ponto: arraste um ponto da peça selecionada. Para mover vários juntos, use Shift+clique ou um retângulo em volta deles, e arraste um dos escolhidos. Esc sai.';
      case 'inserir-ponto':
        return 'Inserir ponto: clique sobre o contorno da peça selecionada, onde o ponto novo deve ficar. Esc sai.';
      case 'ponto-de-casamento':
        return `${recadoDaFerramenta ? `${recadoDaFerramenta} — ` : ''}Ponto de casamento (${nomeDoPontoDeCasamento(grupoDoPontoDeCasamento)}): clique na peça, no ponto em que passa a linha do desenho (a listra). Em outra peça, o mesmo grupo cai na mesma listra; na mesma peça, o ponto muda de lugar. Esc sai.`;
      case 'excluir-ponto':
        return `${recadoDaFerramenta ? `${recadoDaFerramenta} — ` : ''}Excluir ponto: clique num ponto da peça selecionada para tirá-lo do contorno. Esc sai.`;
      case 'arredondar-ou-chanfrar':
        return 'Arredondar ou chanfrar: clique num canto da peça selecionada e escolha, na janela, arredondar ou chanfrar e a medida. Esc sai.';
      case 'medir-distancia': {
        if (pontosEmEdicao.length > 0) return 'Distância: clique no segundo ponto. Esc sai.';
        const medida = medicoesResolvidas[0];
        return medida
          ? `${descreverMedicao(medida)} — clique para medir de novo; Esc sai.`
          : 'Distância: clique no primeiro ponto (perto de um vértice, o clique cai exatamente nele). Esc sai.';
      }
      case 'medir-perimetro': {
        if (inicioDoTrecho) {
          return 'Perímetro: clique no segundo ponto do contorno — o trecho segue a numeração dos pontos, do primeiro clique ao segundo. Esc sai.';
        }
        const medida = medicoesResolvidas[0];
        return medida
          ? `${descreverMedicao(medida)} — clique para medir de novo; Esc sai.`
          : 'Perímetro: clique dentro de uma peça para medir o perímetro dela, ou em dois pontos do contorno para medir o trecho entre eles. Esc sai.';
      }
      case 'comparar-distancias': {
        if (pontosEmEdicao.length > 0) return 'Comparar distância: clique no segundo ponto. Esc sai.';
        const [primeira, segunda] = medicoesResolvidas;
        if (primeira && segunda) return `${descreverComparacao(primeira, segunda)} — clique para comparar de novo; Esc sai.`;
        if (primeira) return `${descreverMedicao(primeira)} — agora meça a 2ª distância. Esc sai.`;
        return 'Comparar distância: meça a 1ª distância — clique em dois pontos (perto de um vértice, o clique cai exatamente nele). Esc sai.';
      }
      case 'cota-distancia':
      case 'cota-horizontal-vertical': {
        const nome = modo === 'cota-distancia' ? 'Cota distância' : 'Horizontal / Vertical';
        if (pontosEmEdicao.length === 0) {
          return `${nome}: clique no primeiro ponto, numa peça (perto de um vértice, o clique cai exatamente nele). Para apagar uma cota, clique no número dela. Esc sai.`;
        }
        if (pontosEmEdicao.length === 1) return `${nome}: clique no segundo ponto. Esc sai.`;
        return modo === 'cota-distancia'
          ? 'Cota distância: clique onde a linha de cota deve ficar. Esc sai.'
          : 'Horizontal / Vertical: clique onde a cota deve ficar — acima ou abaixo dos pontos, mede a horizontal; ao lado deles, a vertical. Esc sai.';
      }
      case 'cota-angulo':
        return [
          'Ângulo: clique num ponto de um dos lados, numa peça. Para apagar uma cota, clique no número dela. Esc sai.',
          'Ângulo: clique no vértice do ângulo. Esc sai.',
          'Ângulo: clique num ponto do outro lado. Esc sai.',
          'Ângulo: clique onde o arco da cota deve ficar. Esc sai.',
        ][Math.min(pontosEmEdicao.length, 3)]!;
      case 'cota-perimetro':
        return 'Cota perímetro: clique dentro de uma peça, onde o perímetro dela deve ficar escrito. Para apagar uma cota, clique no número dela. Esc sai.';
      case 'comparar-perimetros': {
        const [primeira, segunda] = medicoesResolvidas;
        if (inicioDoTrecho) {
          return 'Comparar perímetros: clique no segundo ponto do contorno — o trecho segue a numeração dos pontos. Esc sai.';
        }
        if (primeira && segunda) return `${descreverComparacao(primeira, segunda)} — clique para comparar de novo; Esc sai.`;
        if (primeira) return `${descreverMedicao(primeira)} — agora faça a 2ª medida. Esc sai.`;
        return 'Comparar perímetros: faça a 1ª medida — clique dentro de uma peça (perímetro inteiro) ou em dois pontos do contorno (trecho). Esc sai.';
      }
      default:
        break;
    }
    if (aviso && aviso.pecas === pecas && aviso.selecionadoId === selecionadoId) return aviso.texto;
    if (cerca) {
      return (
        <>
          Cerca ativa: &ldquo;Mover cerca&rdquo; (aba Manipulação) desloca os pontos destacados. Clique em
          &ldquo;Definir cerca&rdquo; de novo para removê-la.
        </>
      );
    }
    return null;
  })();

  return (
    <div ref={appShellRef} className="app-shell" onKeyDown={aoTeclar} tabIndex={-1}>
      <BarraDeFerramentas
        modo={modo}
        podeDesfazer={passado.length > 0}
        podeRefazer={futuro.length > 0}
        temSelecao={selecionadoId !== null || idsSelecionadosEmLote.size > 0}
        temSelecaoUnica={selecionadoId !== null}
        onNovoProjeto={novoProjeto}
        onDesfazer={desfazer}
        onRefazer={refazer}
        onDuplicar={duplicarSelecionado}
        onExcluir={excluirSelecionado}
        onSelecionarTudo={selecionarTudo}
        podeSelecionarTudo={pecas.length > 0}
        onCopiar={copiarSelecionado}
        onRecortar={recortarSelecionado}
        onColar={colar}
        podeColar={clipboard !== null}
        onZoomIn={() => zoom(1.15)}
        onZoomOut={() => zoom(1 / 1.15)}
        onAjustarTela={ajustarTela}
        onVistaAnterior={vistaAnterior}
        onProximaVista={proximaVista}
        podeVistaAnterior={vistasAnteriores.length > 0}
        podeProximaVista={vistasSeguintes.length > 0}
        mostrarGrade={mostrarGrade}
        onAlternarGrade={() => setMostrarGrade((v) => !v)}
        imaAtivo={imaAtivo}
        onAlternarIma={() => setImaAtivo((v) => !v)}
        unidadeDaRegua={unidadeDaRegua}
        onDefinirUnidadeDaRegua={setUnidadeDaRegua}
        canetasDoPlotter={canetasDoPlotter}
        onDefinirCanetasDoPlotter={definirCanetasDoPlotter}
        onAbrirAtalhos={() => setPainelDeAjuda('atalhos')}
        onAbrirSobre={() => setPainelDeAjuda('sobre')}
        mostrarListaDePecas={mostrarListaDePecas}
        onAlternarListaDePecas={() => setMostrarListaDePecas((v) => !v)}
        mostrarBarraDeVisualizacao={mostrarBarraDeVisualizacao}
        onAlternarBarraDeVisualizacao={() => setMostrarBarraDeVisualizacao((v) => !v)}
        mostrarValidacao={mostrarValidacao}
        onAlternarValidacao={() => setMostrarValidacao((v) => !v)}
        onAbrirPropriedadesDaPeca={() => selecionadoId && abrirPropriedadesDaPeca(selecionadoId)}
        temCerca={cerca !== null}
        onAlternarDefinirCerca={alternarDefinirCerca}
        onMoverCerca={() => setMostrarMoverCerca(true)}
        onEntrarModoSelecionar={cancelarModo}
        onEntrarModoNovoMolde={entrarModoNovoMolde}
        onEntrarModoNovoFuro={entrarModoNovoFuro}
        onUsarFerramentaDeMarcacao={usarFerramentaDeMarcacao}
        onImportarDxf={importarDxfHandler}
        onImportarPdf={importarPdfHandler}
        onAbrirTecido={() => setPainelAberto('tecido')}
        onAbrirEnfesto={() => setPainelAberto('enfesto')}
        onSugerirPosicao={sugerirPosicaoParaSelecionada}
        podeSugerirPosicao={selecionadoId !== null && enfesto !== null}
        onNestingAutomatico={abrirConfiguracaoDeNesting}
        podeExecutarNesting={enfesto !== null && pecas.length > 0 && !nestingExecutando}
        onAbrirExportacaoPdf={() => setMostrarExportacaoPdf(true)}
        podeExportarPdf={pecas.length > 0}
        onExportarDxf={() => void exportarDxf()}
        onExportarPlt={() => void exportarPlt()}
        onExportarPltPorPartes={() => setDialogoDeFerramenta({ tipo: 'plt-por-partes' })}
        onExportarAstm={() => void exportarAstm()}
        onFerramentasDoPlotter={() => setDialogoDeFerramenta({ tipo: 'ferramentas-do-plotter' })}
        esquemaDeCores={esquemaDeCores}
        onEsquemaDeCores={(esquema) => {
          setEsquemaDeCores(esquema);
          aplicarEsquema(esquema, window.localStorage, document.documentElement);
        }}
        onSalvarPerfil={() => void salvarTexto('perfil-enfesto-cad.json', perfilAtual(window.localStorage))}
        onCarregarPerfil={carregarPerfil}
        onRestaurarPadroes={() => {
          if (!window.confirm('Tirar as preferências deste computador (favoritos, teclas, cores, canetas)? Os projetos não mudam.')) return;
          restaurarPadroes(window.localStorage);
          setMensagensImportacao(['Preferências tiradas: valem ao abrir o programa de novo.']);
        }}
        onSobMedida={() => setDialogoDeFerramenta({ tipo: 'sob-medida' })}
        onPlotarMoldes={() => setDialogoDeFerramenta({ tipo: 'plotar-moldes' })}
        onTamanhoIntermediario={() => setDialogoDeFerramenta({ tipo: 'tamanho-intermediario' })}
        onMoldeVizinho={verMoldeVizinho}
        sobreposicaoDeMoldes={sobreposicaoDeMoldes}
        onAlternarSobreposicao={() => executarTeclaDoEncaixe({ tipo: 'sobreposicao' })}
        onZoomDeUmElemento={() => alternarFerramentaDeVista('zoom-elemento')}
        mostrarNaoGraduados={mostrarNaoGraduados}
        onAlternarNaoGraduados={() => setMostrarNaoGraduados((v) => !v)}
        onCoresDosTamanhos={() => {
          if (pecas.some((p) => p.graduacao)) setDialogoDeFerramenta({ tipo: 'cores-dos-tamanhos' });
          else avisar('Nenhuma peça tem tamanhos: gradue-a antes.');
        }}
        onPiquePadrao={() => setDialogoDeFerramenta({ tipo: 'pique-padrao' })}
        estiloDaCostura={estiloDaCostura}
        onEstiloDaCostura={(estilo) => {
          setEstiloDaCostura(estilo);
          try {
            guardarEstiloDaCostura(window.localStorage, estilo);
          } catch {
            // Sem o armazenamento do navegador, vale até fechar.
          }
        }}
        lembrarOriginal={lembrarOriginal}
        onLembrarOriginal={() => setLembrarOriginal((v) => !v)}
        onOrganizarMoldes={() => aplicarMudanca(organizarPecas(pecas, enfesto?.larguraUtilMm ?? 1500))}
        onAlinharPecas={() => setDialogoDeFerramenta({ tipo: 'alinhar-pecas' })}
        onImportarPlt={importarPltHandler}
        onExportarProjeto={() => setDialogoDeFerramenta({ tipo: 'exportar-projeto' })}
        onImportarProjeto={importarProjetoHandler}
        onExportarIso={() => setDialogoDeFerramenta({ tipo: 'corte-iso' })}
        onSalvar={salvarProjetoAtual}
        onSalvarComo={salvarComo}
        onAbrirBiblioteca={abrirBiblioteca}
        onAbrirHistorico={() => setMostrarHistorico(true)}
        onAbrirRelatorio={() => setMostrarRelatorio(true)}
        onAbrirPlanoDeCorte={abrirPlanejamento}
        onAbrirSalaDeCorte={abrirSalaDeCorte}
        onAbrirFilaDeEncaixes={abrirFilaDeEncaixes}
        onEntrarModoMoverPonto={entrarModoMoverPonto}
        onEntrarModoModificar={entrarModoModificar}
        onEntrarModoRedefinirPerimetro={entrarModoRedefinirPerimetro}
        onEntrarModoInserirPonto={entrarModoInserirPonto}
        onEntrarModoExcluirPonto={entrarModoExcluirPonto}
        onEntrarModoArredondarOuChanfrar={entrarModoArredondarOuChanfrar}
        onAbrirDimensionar={() => setMostrarDimensionar(true)}
        onEspelharManual={espelharSelecionadaManualmente}
        onGirarLivre={girarLivreSelecionada}
        onElementoParalelo={criarElementoParaleloDaSelecionada}
        onConverterEmCostura={() => setMostrarCostura(true)}
        onInverterSelecao={inverterSelecaoDePecas}
        onCriarPontoDeRestauracao={criarPontoDeRestauracao}
        onRestaurar={restaurarSelecionada}
        temPontoDeRestauracao={selecionadoId !== null && pontosDeRestauracao.has(selecionadoId)}
        onEntrarModoRetangulo={entrarModoRetangulo}
        onEntrarModoSentidoDoFio={entrarModoSentidoDoFio}
        onExtrairTodasAsRegioes={extrairTodasAsRegioesDaSelecionada}
        onComponentePronto={() => setDialogoDeFerramenta({ tipo: 'componente' })}
        onPontoDeCasamento={pecas.length > 0 ? () => setDialogoDeFerramenta({ tipo: 'ponto-de-casamento' }) : undefined}
        onAbrirCostura={() => setMostrarCostura(true)}
        onRemoverCostura={removerCostura}
        podeRemoverCostura={alvosDeCostura.some((p) => p.margemDeCosturaMm > 0)}
        onEntrarModoMedirDistancia={() => entrarModoDeMedida('medir-distancia')}
        onEntrarModoMedirPerimetro={() => entrarModoDeMedida('medir-perimetro')}
        onEntrarModoCompararPerimetros={() => entrarModoDeMedida('comparar-perimetros')}
        onAbrirInformacoesDosMoldes={() => setMostrarInformacoesDosMoldes(true)}
        onEntrarModoCompararDistancias={() => entrarModoDeMedida('comparar-distancias')}
        onEntrarModoCotaDistancia={() => entrarModoDeCota('cota-distancia')}
        onEntrarModoCotaHorizontalVertical={() => entrarModoDeCota('cota-horizontal-vertical')}
        onEntrarModoCotaAngulo={() => entrarModoDeCota('cota-angulo')}
        onEntrarModoCotaPerimetro={() => entrarModoDeCota('cota-perimetro')}
        onConverterEmContorno={converterEmContorno}
        onAbrirVariantes={abrirVariantes}
        onAbrirMateriais={abrirMateriais}
        onAbrirFichaTecnica={abrirFichaTecnica}
        onAbrirDesenhoTecnico={() => abrirDesenhoTecnico()}
        onAbrirColecoes={() => abrirColecoes('mix')}
        onAbrirRecomendacaoDeTamanho={setRecomendacaoAberta}
        onAbrirProvador3D={() => setMostrarProvador3D(true)}
        onAbrirInspiracao={setInspiracaoAberta}
        onAbrirImpressaoDigital={() => setMostrarImpressaoDigital(true)}
        onAbrirMoldeDaFoto={() => setMostrarMoldeDaFoto(true)}
        onAbrirMesaDigitalizadora={() => setMostrarMesaDigitalizadora(true)}
        onEntrarModoCurva={() => entrarModoNaPecaSelecionada('curva')}
        onEntrarModoArco2Pontos={() => entrarModoNaPecaSelecionada('arco-2-pontos')}
        onEntrarModoArco3Pontos={() => entrarModoNaPecaSelecionada('arco-3-pontos')}
        onEntrarModoArcoTangente={() => entrarModoNaPecaSelecionada('arco-tangente')}
        onUsarFerramentaDeArco={entrarModoNaPecaSelecionada}
        onEntrarModoCotaRaio={() => entrarModoDeConstrucao('cota-raio')}
        onEntrarModoEditarPontosDeCurva={() => entrarModoNaPecaSelecionada('editar-pontos-de-curva')}
        onEntrarModoCadastrarCurva={() => entrarModoNaPecaSelecionada('cadastrar-curva')}
        onAbrirCurvaPredefinida={() => selecionadoId && setDialogoDeFerramenta({ tipo: 'escolher-curva' })}
        onAbrirEspiral={() => setDialogoDeFerramenta({ tipo: 'espiral' })}
        onEntrarModoCirculo={() => entrarModoDeConstrucao('circulo')}
        onUsarFerramentaDeMolde={usarFerramentaDeMolde}
        temOutraPeca={pecas.length >= 2}
        onUsarFerramentaDeAnotacao={usarFerramentaDeAnotacao}
        onAbrirImagens={abrirImagens}
        onAbrirProgramas={abrirProgramas}
        podeAbrirProgramas={typeof window.enfestoCad?.listarProgramas === 'function'}
        onUsarFerramentaDeElemento={usarFerramentaDeElemento}
        onUsarFerramentaDeGraduacao={usarFerramentaDeGraduacao}
        temGraduacao={pecaSelecionada?.graduacao !== undefined}
        temOutrasMarcadas={[...idsSelecionadosEmLote].some((id) => id !== selecionadoId)}
        onAlinhar={alinharSelecionadas}
        podeAlinhar={idsSelecionadosEmLote.size >= 2}
      />
      {painelAberto === 'tecido' && (
        <PainelDeTecido
          tecidoAtual={tecido}
          onFechar={() => setPainelAberto(null)}
          onSalvar={(t) => {
            setTecido(t);
            setPainelAberto(null);
            registrarEventoEPersistir('mudanca-de-configuracao', { pecas, tecido: t, enfesto }, `Tecido: ${t.nome}`);
          }}
        />
      )}
      {painelAberto === 'enfesto' && (
        <PainelDeEnfesto
          configAtual={enfesto}
          onFechar={() => setPainelAberto(null)}
          onSalvar={(c) => {
            setEnfesto(c);
            setPainelAberto(null);
            registrarEventoEPersistir(
              'mudanca-de-configuracao',
              { pecas, tecido, enfesto: c },
              `Enfesto: ${ROTULO_DO_TIPO[c.tipo]}`,
            );
          }}
        />
      )}
      {mostrarPainelDeNesting && (
        <PainelDeNesting
          pecas={pecas}
          distanciaEntreMoldesMm={enfesto?.distanciaMinimaEntrePecasMm ?? DISTANCIA_PADRAO_ENTRE_PECAS_MM}
          sentidoDoTecido={sentidoUnicoDoTecido(tecido) ? { nome: tecido?.nome ?? '', sentido: sentidoUnicoDoTecido(tecido)! } : null}
          executando={nestingExecutando}
          progresso={progressoNesting}
          resultado={resultadoNesting}
          onCalcular={calcularNestingAutomatico}
          onPorNaFila={porNaFila}
          onAlterarGrupo={alterarGrupoDaPeca}
          onCancelar={cancelarNestingAutomatico}
          onAplicar={aplicarResultadoNesting}
          onFechar={fecharPainelDeNesting}
        />
      )}
      {mostrarExportacaoPdf && (
        <PainelDeExportacaoPdf
          podeExportarEncaixeCompleto={enfesto !== null}
          gerando={gerandoPdf}
          onExportar={(opcoes) => void exportarPdf(opcoes)}
          onFechar={() => setMostrarExportacaoPdf(false)}
        />
      )}
      {mostrarDimensionar && pecaSelecionada && (
        <PainelDeDimensionar
          larguraAtualMm={dimensoesDoMolde(pecaSelecionada).larguraMm}
          alturaAtualMm={dimensoesDoMolde(pecaSelecionada).alturaMm}
          onAplicar={(fatorX, fatorY, comoCopia) => {
            dimensionarSelecionada(fatorX, fatorY, comoCopia);
            setMostrarDimensionar(false);
          }}
          onFechar={() => setMostrarDimensionar(false)}
        />
      )}
      {mostrarBiblioteca && (
        <PainelDeBiblioteca
          projetos={projetos}
          avisos={avisosDaBiblioteca}
          projetoAtualId={projetoAtual.id}
          onAbrir={abrirProjeto}
          onDuplicar={duplicarProjetoDaBiblioteca}
          onRenomear={renomearProjetoDaBiblioteca}
          onArquivar={arquivarProjetoDaBiblioteca}
          onExcluir={excluirProjetoDaBiblioteca}
          onFechar={() => setMostrarBiblioteca(false)}
          onAprovarComoBase={aprovarComoBaseDaBiblioteca}
          onTirarDasBases={tirarDasBasesDaBiblioteca}
          onNovoModeloDaBase={novoModeloDaBase}
          onPorPecasDaBase={porPecasDaBase}
          pastaDaRede={pastaDaBiblioteca}
          projetoParaEnviarARede={projetoParaEnviarARede}
          onTrazerDaRede={trazerProjetoDaRede}
        />
      )}
      {mostrarHistorico && (
        <PainelDeHistorico
          projeto={projetoAtual}
          onRestaurar={(idDoEvento) => {
            restaurarVersaoDoHistorico(idDoEvento);
            setMostrarHistorico(false);
          }}
          onFechar={() => setMostrarHistorico(false)}
        />
      )}
      {mostrarPlanoDeCorte && cadastroDeProducao && configuracaoDoPlanejamento && (
        <PainelDePlanejamento
          onSalvarTexto={salvarTexto}
          pastaDoErp={pastaDoErp}
          projetosDaBiblioteca={projetos}
          nomeDoProjeto={(id) => nomesDosProjetos.get(id) ?? (id === projetoAtual.id ? `${projetoAtual.nome} (${projetoAtual.codigo})` : 'projeto não encontrado na biblioteca')}
          projeto={projetoAtual}
          pecas={pecas}
          tecidoDoProjeto={tecido}
          tipoDoEnfesto={enfesto?.tipo ?? 'impar'}
          cadastro={cadastroDeProducao.cadastro}
          cadastroSomenteLeitura={cadastroDeProducao.somenteLeitura}
          avisosDoCadastro={cadastroDeProducao.avisos}
          configuracaoGuardada={configuracaoDoPlanejamento}
          buscarRiscos={buscarRiscos}
          agoraIso={() => new Date().toISOString()}
          novoId={(prefixo) => `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}
          onMudarCadastro={mudarCadastroDeProducao}
          onRegistrarRevisao={registrarRevisao}
          onGuardarRascunho={guardarRascunhoDoPlano}
          onConfirmar={confirmarPlanoDeCorte}
          onRemoverRascunho={removerRascunhoDoPlano}
          onGuardarConfiguracao={guardarConfiguracaoNoComputador}
          onAbrirPeca={abrirPecaDoPlanejamento}
          onFechar={() => setMostrarPlanoDeCorte(false)}
        />
      )}
      {mostrarSalaDeCorte && cadastroDeProducao && (
        <PainelDaSalaDeCorte
          cadastro={cadastroDeProducao.cadastro}
          somenteLeitura={cadastroDeProducao.somenteLeitura}
          nomeDoProjeto={(id) => nomesDosProjetos.get(id) ?? (id === projetoAtual.id ? `${projetoAtual.nome} (${projetoAtual.codigo})` : 'projeto não encontrado na biblioteca')}
          agoraIso={() => new Date().toISOString()}
          novoId={(prefixo) => `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}
          onMudarCadastro={mudarCadastroDeProducao}
          onSalvarTexto={salvarTexto}
          onFechar={() => setMostrarSalaDeCorte(false)}
        />
      )}
      {fichaAberta && bibliotecaDeMateriais && (
        <PainelDaFichaTecnica
          ficha={fichaAberta.ficha}
          parteInicial={fichaAberta.parte}
          pecas={pecas}
          encaixe={encaixeParaConsumo(pecas, enfesto?.larguraUtilMm ?? null)}
          larguraDoTecidoMm={tecido?.larguraUtilMm ?? enfesto?.larguraUtilMm ?? null}
          biblioteca={bibliotecaDeMateriais.biblioteca}
          responsavelSugerido={projetoAtual.autor ?? ''}
          onGuardar={guardarFichaTecnica}
          onExportarPdf={(f, c, t) => void exportarPdfDaFicha(f, c, t)}
          onAbrirMateriais={abrirMateriais}
          imagens={imagensDoProjeto(projetoAtual)}
          onAbrirDesenho={(f) => abrirDesenhoTecnico(f)}
          agoraIso={agoraIsoDaFicha}
          novoId={novoIdDaFicha}
          onFechar={() => setFichaAberta(null)}
        />
      )}
      {mostrarImpressaoDigital && (
        <PainelDaImpressaoDigital
          pecas={pecas}
          mesa={enfesto ? { larguraMm: enfesto.larguraUtilMm, comprimentoMm: comprimentoDoEncaixeAImprimirMm(pecas, enfesto) } : null}
          imagens={imagensDeEstampa}
          config={lerImpressaoDigital(projetoAtual.impressaoDigital)}
          onGuardar={guardarImpressaoDigital}
          onExportar={exportarImpressaoDigital}
          onFechar={() => setMostrarImpressaoDigital(false)}
        />
      )}
      {inspiracaoAberta && (
        <PainelDeInspiracao
          painel={lerPainelDeInspiracao(projetoAtual.inspiracao)}
          parteInicial={inspiracaoAberta}
          contexto={(() => {
            const ficha = lerFichaTecnica(projetoAtual.fichaTecnica);
            return {
              nomeDoModelo: ficha?.nomeDoModelo || projetoAtual.nome,
              ...(ficha?.descricao ? { descricao: ficha.descricao } : {}),
              ...(tecido?.nome ? { tecido: tecido.nome } : {}),
            };
          })()}
          desenhoComoPng={(() => {
            const fichaDoDesenho = lerFichaTecnica(projetoAtual.fichaTecnica);
            const desenho = fichaDoDesenho?.desenho;
            return desenho && desenho.elementos.length > 0 ? () => pngDoSvg(svgDoDesenho(desenho, imagensDoProjeto(projetoAtual), '', fichaDoDesenho.medidas), 1024) : null;
          })()}
          lerImagem={lerImagemParaInspiracao}
          reduzirImagem={reduzirParaInspiracao}
          servico={servicoDeIa}
          onGuardar={guardarInspiracao}
          onSalvarArquivo={salvarArquivoDoProvador}
          novoId={() => `inspiracao-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}
          agoraIso={() => new Date().toISOString()}
          onFechar={() => setInspiracaoAberta(null)}
        />
      )}
      {lookNoProvador && (
        <PainelDoProvador3D
          pecas={lookNoProvador.pecas}
          montagemGuardada={lookNoProvador.montagem}
          ficha={lerFichaTecnica(lookNoProvador.primeiro.fichaTecnica)}
          regrasDeCaimento={lerRegrasDeCaimento(lookNoProvador.primeiro.regrasDeCaimento)}
          imagens={lookNoProvador.imagens}
          nomeDoModelo={`Look ${lookNoProvador.nome}`}
          onGuardar={() => {}}
          onSalvarArquivo={salvarArquivoDoProvador}
          novoId={() => `costura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}
          onFechar={() => setLookNoProvador(null)}
        />
      )}
      {mostrarProvador3D && (
        <PainelDoProvador3D
          pecas={pecas}
          montagemGuardada={lerMontagem3d(projetoAtual.montagem3d)}
          ficha={lerFichaTecnica(projetoAtual.fichaTecnica)}
          regrasDeCaimento={lerRegrasDeCaimento(projetoAtual.regrasDeCaimento)}
          imagens={imagensDoProjeto(projetoAtual)}
          nomeDoModelo={projetoAtual.nome}
          onGuardar={guardarMontagem3d}
          onSalvarArquivo={salvarArquivoDoProvador}
          novoId={() => `costura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}
          onFechar={() => setMostrarProvador3D(false)}
          onCriarPeca={(peca) => aplicarMudanca([...pecas, componenteNoProjeto(peca, pecas)])}
        />
      )}
      {recomendacaoAberta && (
        <PainelDeRecomendacaoDeTamanho
          ficha={lerFichaTecnica(projetoAtual.fichaTecnica)}
          regrasGuardadas={lerRegrasDeCaimento(projetoAtual.regrasDeCaimento)}
          elasticidadeGuardada={lerElasticidadeDaRecomendacao(projetoAtual.elasticidadeDaRecomendacao)}
          parteInicial={recomendacaoAberta}
          onGuardarRegras={guardarRegrasDeCaimento}
          onGuardarElasticidade={guardarElasticidadeDaRecomendacao}
          onAbrirMedidas={() => {
            setRecomendacaoAberta(null);
            abrirFichaTecnica('medidas');
          }}
          onSalvarTexto={salvarTexto}
          onFechar={() => setRecomendacaoAberta(null)}
        />
      )}
      {mostrarMesaDigitalizadora && (
        <PainelDaMesaDigitalizadora onCriarPecas={criarPecasDaMesa} escolhaDePorta={escolhaDePortaSerial} onFechar={() => setMostrarMesaDigitalizadora(false)} />
      )}
      {mostrarMoldeDaFoto && (
        <PainelDaFotoParaMolde
          imagens={imagens}
          onTrazerFoto={() => arquivoDeImagemRef.current?.click()}
          onCriarPeca={criarPecaDaFoto}
          lerPixels={pixelsDaImagem}
          paraDataUrl={dataUrlDosPixels}
          onFechar={() => setMostrarMoldeDaFoto(false)}
        />
      )}
      {colecoesAbertas && (
        <PainelDeColecoes
          onVestirLook={vestirLook}
          arquivo={colecoes.arquivo}
          avisos={colecoes.avisos}
          somenteLeitura={colecoes.somenteLeitura}
          // O projeto aberto entra como está agora (a lista da Biblioteca pode ter a versão de antes dele).
          projetos={[...projetos.filter((p) => p.id !== projetoAtual.id), projetoAtual]}
          projetoAbertoId={projetoAtual.id}
          hoje={hoje}
          responsavelSugerido={projetoAtual.autor ?? ''}
          parteInicial={colecoesAbertas}
          agoraIso={agoraIsoDaFicha}
          novoId={novoIdDaFicha}
          onMudar={colecoes.mudar}
          onAbrirProjeto={(id) => {
            setColecoesAbertas(null);
            abrirProjeto(id);
          }}
          onSalvarTexto={salvarTexto}
          onFechar={() => setColecoesAbertas(null)}
        />
      )}
      {desenhoAberto && (
        <PainelDoDesenhoTecnico
          desenho={desenhoAberto.desenho}
          somenteLeitura={desenhoAberto.somenteLeitura}
          imagens={imagensDoProjeto(projetoAtual)}
          medidas={desenhoAberto.medidas}
          tamanhos={desenhoAberto.tamanhos}
          onGuardar={guardarDesenhoTecnico}
          onExportarSvg={(d) => void exportarSvgDoDesenho(d)}
          novoId={novoIdDaFicha}
          onFechar={() => setDesenhoAberto(null)}
        />
      )}
      {mostrarMateriais && bibliotecaDeMateriais && (
        <PainelDeMateriais
          biblioteca={bibliotecaDeMateriais.biblioteca}
          avisos={bibliotecaDeMateriais.avisos}
          somenteLeitura={bibliotecaDeMateriais.somenteLeitura}
          malhasDoCadastro={cadastroDeProducao?.cadastro.malhas ?? []}
          custosDosModelos={custosDosModelos(
            // O projeto aberto entra como está agora (a lista da Biblioteca pode ter a versão de antes dele).
            [...projetos.filter((p) => p.id !== projetoAtual.id), { ...projetoAtual, estadoAtual: { pecas, tecido, enfesto } }],
            bibliotecaDeMateriais.biblioteca,
          )}
          onMudar={mudarBibliotecaDeMateriais}
          onTrocarNosModelos={(deId, paraId) => {
            const materiais = bibliotecaDeMateriais.biblioteca.materiais;
            const de = materiais.find((m) => m.id === deId);
            const para = materiais.find((m) => m.id === paraId);
            if (!de || !para) return 'O material saiu da biblioteca.';
            try {
              // O projeto aberto entra como está agora; os outros, como estão na Biblioteca.
              const troca = trocarMaterialNosModelos([...projetos.filter((p) => p.id !== projetoAtual.id), projetoAtual], de, para, new Date().toISOString());
              for (const p of troca.mudados) void persistirProjeto(p);
              setProjetos((lista) => lista.map((p) => troca.mudados.find((m) => m.id === p.id) ?? p));
              const aberto = troca.mudados.find((m) => m.id === projetoAtual.id);
              if (aberto) setProjetoAtual(aberto);
              return recadoDaTroca(troca, de, para);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onSalvarTexto={salvarTexto}
          agoraIso={() => new Date().toISOString()}
          novoId={() => `material-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}
          onFechar={() => setMostrarMateriais(false)}
        />
      )}
      {mostrarFilaDeEncaixes && (
        <PainelDaFilaDeEncaixes
          fila={filaDeEncaixes.fila}
          progresso={filaDeEncaixes.progresso}
          avisos={filaDeEncaixes.avisos}
          somenteLeitura={filaDeEncaixes.somenteLeitura}
          projetoAbertoId={projetoAtual.id}
          projetoExiste={(id) => projetos.some((p) => p.id === id)}
          onMudar={filaDeEncaixes.mudar}
          onAplicar={aplicarDaFila}
          onAbrirProjeto={abrirProjeto}
          onExportarCsv={() => void exportarCsvDaFila()}
          agoraIso={() => new Date().toISOString()}
          onFechar={() => setMostrarFilaDeEncaixes(false)}
          rede={pastaDaFila ? filaNaRede : null}
        />
      )}
      {relatorioAtual && (
        <PainelDeRelatorio
          relatorio={relatorioAtual}
          gerando={gerandoRelatorio}
          onExportarPdf={() => void exportarRelatorio('pdf')}
          onExportarExcel={() => void exportarRelatorio('xlsx')}
          onFechar={() => setMostrarRelatorio(false)}
        />
      )}
      {mostrarNovoProjeto && (
        <PainelDeNovoProjeto
          onCriar={criarNovoProjetoComDados}
          bases={basesAprovadas(projetos)}
          onCriarDaBase={(id, nome) => {
            const erro = novoModeloDaBase(id, nome);
            if (!erro) setMostrarNovoProjeto(false);
            return erro;
          }}
          onFechar={() => setMostrarNovoProjeto(false)}
        />
      )}
      {mostrarMoverCerca && cerca && (
        <PainelDeMoverCerca
          cerca={cerca}
          pecas={alvosDaCerca}
          temSelecao={selecionadoId !== null || idsSelecionadosEmLote.size > 0}
          opcoes={opcoesDaCerca}
          onAlterarOpcoes={setOpcoesDaCerca}
          onAplicar={aplicarMoverCerca}
          onFechar={() => setMostrarMoverCerca(false)}
        />
      )}
      {modo === 'modificar' && pontosParaModificar && pecaSelecionada && (
        <PainelDeModificar
          peca={pecaSelecionada}
          indices={pontosParaModificar}
          onAplicar={(delta, modoDeModificar, alcanceMm) => aplicarModificar(pontosParaModificar, delta, modoDeModificar, alcanceMm)}
          onFechar={() => setPontosParaModificar(null)}
        />
      )}
      {modo === 'redefinir-perimetro' && redefinicaoDePerimetro && pecaSelecionada && (
        <PainelDeRedefinirPerimetro
          peca={pecaSelecionada}
          redefinicao={redefinicaoDePerimetro}
          onAlterar={alterarRedefinicaoDePerimetro}
          onAplicar={(comprimento, ponta) =>
            aplicarRedefinirPerimetro(redefinicaoDePerimetro.indiceAresta, comprimento, ponta)
          }
          onFechar={() => setRedefinicaoDePerimetro(null)}
        />
      )}
      {mostrarCostura && alvosDeCostura.length > 0 && (
        <PainelDeCostura pecas={alvosDeCostura} onAplicar={aplicarCostura} onFechar={() => setMostrarCostura(false)} />
      )}
      {mostrarInformacoesDosMoldes && (
        <PainelDeInformacoesDosMoldes
          pecas={pecas}
          selecionadoId={selecionadoId}
          onSelecionar={selecionarUnico}
          onFechar={() => setMostrarInformacoesDosMoldes(false)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'escolher-curva' && (
        <PainelDeCurvaPredefinida
          curvas={curvasDisponiveis}
          idInicial={curvaEscolhida?.curva.id ?? null}
          espelharInicial={curvaEscolhida?.espelhar ?? false}
          onEscolher={(curva, espelhar) => {
            entrarModoDeConstrucao('curva-predefinida');
            setCurvaEscolhida({ curva, espelhar });
          }}
          onExcluir={excluirCurvaCadastrada}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'salvar-como' && (
        <DialogoDeCampos
          titulo="Salvar como"
          resumo={[['Projeto atual', projetoAtual.nome]]}
          campos={[{ tipo: 'texto', id: 'nome', rotulo: 'Nome do novo projeto', inicial: `${projetoAtual.nome} (cópia)` }]}
          nota="Grava o desenho de agora como um projeto novo, com este nome, e passa a trabalhar nele."
          rotuloDoBotao="Salvar"
          onAplicar={(valores) => {
            salvarComoNovoProjeto(String(valores.nome));
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'arredondar-ou-chanfrar' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Arredondar ou chanfrar"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[
            {
              tipo: 'escolha',
              id: 'operacao',
              rotulo: 'No canto clicado',
              opcoes: [
                { valor: 'arredondar', rotulo: 'Arredondar' },
                { valor: 'chanfrar', rotulo: 'Chanfrar' },
              ],
              inicial: ultimoCanto.arredondar ? 'arredondar' : 'chanfrar',
            },
            {
              tipo: 'medida',
              id: 'valor',
              rotulo: 'Raio do arredondamento, ou distância do chanfro ao canto (mm)',
              inicial: String(ultimoCanto.valorMm).replace('.', ','),
            },
          ]}
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) => aplicarNoCanto(dialogoDeFerramenta.indice, valores.operacao === 'arredondar', Number(valores.valor))}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'girar-livre' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Girar livre"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[{ tipo: 'medida', id: 'angulo', rotulo: 'Ângulo em graus (positivo gira no sentido anti-horário)', inicial: '0' }]}
          nota="Isto redefine a orientação de referência da peça: depois de girar, confira se a linha de fio continua no sentido certo do tecido."
          rotuloDoBotao="Girar"
          onAplicar={(valores) => aplicarGiroLivre(Number(valores.angulo))}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'elemento-paralelo' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Elemento paralelo"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[{ tipo: 'medida', id: 'distancia', rotulo: 'Distância em mm (positivo = para fora, negativo = para dentro)', inicial: '10' }]}
          nota="Cria uma peça nova com o contorno desta deslocado por igual. Furos, piques e marcas não vão para a peça nova."
          rotuloDoBotao="Criar"
          onAplicar={(valores) => aplicarElementoParalelo(Number(valores.distancia))}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'numero-de-pontos' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Editar pontos de curva"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            [
              'Trecho',
              `${pontosDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)} pontos em ${formatarMm(comprimentoDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim))}`,
            ],
          ]}
          campos={[
            {
              tipo: 'inteiro',
              id: 'pontos',
              rotulo: 'Número de pontos do trecho (contando as duas pontas)',
              inicial: String(pontosDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)),
            },
            {
              tipo: 'inteiro',
              id: 'passagem',
              rotulo: 'Ou: tornar o trecho uma curva editável, com este número de pontos de passagem',
              inicial: '',
              opcional: true,
            },
          ]}
          nota="Os pontos ficam igualmente espaçados ao longo do trecho. Com menos pontos a curva fica mais simples, e a forma pode mudar um pouco. Preenchido o segundo campo, o trecho vira uma curva com pontos de passagem (os anéis), que dá para mover, acrescentar e tirar depois: serve para a curva que veio de fora, foi desenhada ponto a ponto ou foi mexida à mão. A mensagem diz quanto a forma mudou."
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) =>
            valores.passagem !== undefined
              ? tornarCurvaEditavel(dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim, Number(valores.passagem))
              : aplicarTrecho(
                  'editar-pontos-de-curva',
                  { inicio: dialogoDeFerramenta.inicio, fim: dialogoDeFerramenta.fim, livres: [] },
                  { quantidadeDePontos: Number(valores.pontos) },
                )
          }
          onFechar={() => {
            setDialogoDeFerramenta(null);
            setTrecho(SEM_TRECHO);
          }}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'cadastrar-curva' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Cadastrar curva"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            [
              'Trecho',
              `${pontosDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)} pontos em ${formatarMm(comprimentoDoTrecho(pecaSelecionada.contorno, dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim))}`,
            ],
          ]}
          campos={[{ tipo: 'texto', id: 'nome', rotulo: 'Nome da curva', inicial: '' }]}
          nota="Fica guardada só a forma do trecho, sem o tamanho: em “Pré-definida”, ela estica ou encolhe para caber entre dois pontos. O cadastro fica neste computador."
          rotuloDoBotao="Cadastrar"
          onAplicar={(valores) => cadastrarCurva(String(valores.nome), dialogoDeFerramenta.inicio, dialogoDeFerramenta.fim)}
          onFechar={() => {
            setDialogoDeFerramenta(null);
            setTrecho(SEM_TRECHO);
          }}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'figura' &&
        (() => {
          const daFigura = pecas.find((p) => p.id === dialogoDeFerramenta.id);
          const dialogo = daFigura ? dialogoDaFigura(daFigura) : null;
          if (!daFigura || !dialogo) return null;
          return (
            <DialogoDeCampos
              key={dialogoDeFerramenta.id}
              titulo={dialogo.titulo}
              resumo={[['Peça', daFigura.nome]]}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao="Aplicar"
              onAplicar={(valores) => {
                try {
                  const resultado = aplicarDialogoDaFigura(pecas, daFigura, valores);
                  aplicarMudanca([...resultado.pecas]);
                  setRecadoDaFerramenta(resultado.recado);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'exportar-projeto' && (
        <DialogoDeCampos
          titulo="Exportar projeto"
          campos={[{ tipo: 'texto', id: 'senha', rotulo: 'Senha (opcional)', inicial: '', opcional: true }]}
          nota="Com senha, o arquivo só abre com ela. Quem perde a senha perde o arquivo: não há como recuperar."
          rotuloDoBotao="Salvar o arquivo"
          onAplicar={(valores) => {
            void exportarProjetoHandler(typeof valores.senha === 'string' && valores.senha !== '' ? valores.senha : null);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'exportar-projeto' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'senha-do-projeto' && (
        <DialogoDeCampos
          titulo="Projeto com senha"
          campos={[{ tipo: 'texto', id: 'senha', rotulo: 'Senha do arquivo', inicial: '' }]}
          rotuloDoBotao="Abrir"
          onAplicar={(valores) => {
            void decifrarProjeto(dialogoDeFerramenta.conteudo, String(valores.senha)).then(entrarComOProjeto, (e: unknown) => setMensagensImportacao([e instanceof Error ? e.message : String(e)]));
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'senha-do-projeto' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'ferramentas-do-plotter' && (
        <DialogoDeCampos
          titulo="Ferramentas do plotter"
          campos={(Object.keys(ROTULO_DO_ELEMENTO) as ElementoDoPlotter[]).map((e) => ({ tipo: 'inteiro' as const, id: e, rotulo: `${ROTULO_DO_ELEMENTO[e]}: caneta (1 a 8)`, inicial: String(ferramentasDoPlotter[e] ?? ''), opcional: true }))}
          nota="A caneta de cada elemento no PLT. Em branco: segue a opção de uma ou duas canetas."
          rotuloDoBotao="Guardar"
          onAplicar={(valores) => {
            const novas: Partial<Record<ElementoDoPlotter, number>> = {};
            for (const e of Object.keys(ROTULO_DO_ELEMENTO) as ElementoDoPlotter[]) {
              if (valores[e] === undefined) continue;
              const n = Number(valores[e]);
              if (!(n >= 1 && n <= 8)) return 'As canetas vão de 1 a 8.';
              novas[e] = n;
            }
            setFerramentasDoPlotter(novas);
            try {
              window.localStorage.setItem('enfesto-cad:ferramentas-do-plotter', JSON.stringify(novas));
            } catch {
              // Sem o armazenamento do navegador, vale até fechar.
            }
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'ferramentas-do-plotter' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'mover-com-referencia' && (
        <DialogoDeCampos
          titulo="Mover com referência"
          campos={[
            {
              tipo: 'escolha',
              id: 'referencia',
              rotulo: 'A partir de',
              opcoes: [
                { valor: 'peca', rotulo: 'Onde a peça está' },
                { valor: 'mesa', rotulo: 'O canto da mesa' },
              ],
              inicial: 'peca',
            },
            { tipo: 'medida', id: 'horizontal', rotulo: 'Horizontal (mm, + para a direita)', inicial: '0' },
            { tipo: 'medida', id: 'vertical', rotulo: 'Vertical (mm, + para baixo)', inicial: '0' },
          ]}
          rotuloDoBotao="Mover"
          onAplicar={(valores) => {
            const ids = idsSelecionadosEmLote.size > 0 ? idsSelecionadosEmLote : new Set(selecionadoId ? [selecionadoId] : []);
            aplicarMudanca(moverComReferencia(pecas, ids, valores['referencia'] === 'mesa' ? 'mesa' : 'peca', valores['horizontal'] as number, valores['vertical'] as number));
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'mover-com-referencia' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'cores-dos-tamanhos' && (
        <DialogoDeCampos
          titulo="Cores dos tamanhos"
          campos={[...new Set(pecas.flatMap((p) => p.graduacao?.tamanhos ?? []))].map((t, i) => ({ tipo: 'cor' as const, id: t, rotulo: t, inicial: corDoTamanho(t, i, coresDosTamanhos) }))}
          nota="A cor de cada tamanho na área de trabalho. Fica lembrada neste computador."
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) => {
            const cores = { ...coresDosTamanhos, ...(valores as Readonly<Record<string, string>>) };
            setCoresDosTamanhos(cores);
            try {
              guardarCoresDosTamanhos(window.localStorage, cores);
            } catch {
              // Sem o armazenamento do navegador, vale até fechar.
            }
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'cores-dos-tamanhos' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'pique-padrao' && (
        <DialogoDeCampos
          titulo="Pique padrão"
          campos={[
            { tipo: 'medida', id: 'largura', rotulo: 'Largura (mm)', inicial: String(opcoesDeMarcacao.inserir.formato.larguraMm).replace('.', ',') },
            { tipo: 'medida', id: 'altura', rotulo: 'Altura (mm)', inicial: String(opcoesDeMarcacao.inserir.formato.alturaMm).replace('.', ',') },
            { tipo: 'medida', id: 'angulo', rotulo: 'Ângulo (graus)', inicial: String(opcoesDeMarcacao.inserir.formato.anguloGraus).replace('.', ',') },
          ]}
          nota="As medidas com que os piques novos começam. Fica lembrado neste computador; os piques já postos não mudam."
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) => {
            const pique = { larguraMm: valores['largura'] as number, alturaMm: valores['altura'] as number, anguloGraus: valores['angulo'] as number };
            if (pique.larguraMm < MEDIDA_MINIMA_DO_PIQUE_MM || pique.alturaMm < MEDIDA_MINIMA_DO_PIQUE_MM || pique.larguraMm > MEDIDA_MAXIMA_DO_PIQUE_MM || pique.alturaMm > MEDIDA_MAXIMA_DO_PIQUE_MM) {
              return `Largura e altura vão de ${MEDIDA_MINIMA_DO_PIQUE_MM} a ${MEDIDA_MAXIMA_DO_PIQUE_MM} mm.`;
            }
            setOpcoesDeMarcacao((o) => ({ ...o, inserir: { ...o.inserir, formato: { ...o.inserir.formato, ...pique } }, multiplos: { ...o.multiplos, formato: { ...o.multiplos.formato, ...pique } } }));
            try {
              guardarPiquePadrao(window.localStorage, pique);
            } catch {
              // Sem o armazenamento do navegador, vale até fechar.
            }
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'pique-padrao' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'sob-medida' &&
        (() => {
          const ficha = lerFichaTecnica(projetoAtual.fichaTecnica);
          const medidas = ficha?.medidas ?? [];
          return (
            <DialogoDeCampos
              titulo="Sob medida"
              campos={[
                { tipo: 'texto', id: 'nome', rotulo: 'Nome do tamanho (a cliente, a ordem)', inicial: '' },
                ...medidas.map((m) => ({ tipo: 'medida' as const, id: `m-${m.id}`, rotulo: `${m.nome} da peça pronta (cm)`, inicial: '', opcional: true })),
              ]}
              nota="As medidas da peça pronta, com a folga, dizem onde ela cai na grade da ficha técnica. As peças ganham um tamanho nessa posição, por inteiro: não é um ajuste medida por medida. Confira na peça-piloto."
              rotuloDoBotao="Criar o tamanho"
              onAplicar={(valores) => {
                try {
                  if (!ficha || medidas.length === 0) return 'A ficha técnica não tem a tabela de medidas.';
                  const informadas = Object.fromEntries(medidas.flatMap((m) => (valores[`m-${m.id}`] === undefined ? [] : [[m.id, Number(valores[`m-${m.id}`])]])));
                  const { posicao, porMedida } = posicaoDasMedidas(medidas, ficha.tamanhos, informadas);
                  const novas = pecas.map((p) => (p.graduacao?.tamanhos.length === ficha.tamanhos.length ? comTamanhoSobMedida(p, String(valores.nome), posicao) : p));
                  if (novas.every((p, i) => p === pecas[i])) return 'Nenhuma peça tem a mesma grade da ficha técnica.';
                  aplicarMudanca(novas);
                  setMensagensImportacao([`Tamanho “${String(valores.nome).trim()}” criado na posição ${numeroComVirgula(posicao + 1, 2)} da grade (${porMedida.map((m) => `${m.nome}: ${numeroComVirgula(m.posicao + 1, 2)}`).join(', ')}).`]);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'sob-medida' ? null : d))}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'plotar-moldes' && (
        <DialogoDeCampos
          titulo="Plotar moldes"
          campos={[
            { tipo: 'medida', id: 'papel', rotulo: 'Largura do papel (mm)', inicial: String(enfesto?.larguraUtilMm ?? 1500) },
            { tipo: 'caixa', id: 'selecionadas', rotulo: 'Só as peças selecionadas', inicial: false },
            { tipo: 'caixa', id: 'tamanhos', rotulo: 'Cada tamanho separado', inicial: false },
            { tipo: 'caixa', id: 'desdobrar', rotulo: 'Desdobrar as peças de simetria', inicial: true },
            { tipo: 'caixa', id: 'girar', rotulo: 'Girar 90°', inicial: false },
          ]}
          nota="Sai um PLT com os moldes em colunas na largura do papel, sem mexer no encaixe. Confira a escala no primeiro risco."
          rotuloDoBotao="Salvar o PLT"
          onAplicar={(valores) => {
            const larguraDoPapelMm = Number(valores.papel);
            if (!(larguraDoPapelMm > 0)) return 'Diga a largura do papel.';
            const ids = new Set([...idsSelecionadosEmLote, ...(selecionadoId ? [selecionadoId] : [])]);
            if (valores.selecionadas === true && ids.size === 0) return 'Nenhuma peça selecionada.';
            void plotarMoldes({ larguraDoPapelMm, ...(valores.selecionadas === true ? { ids } : {}), tamanhosSeparados: valores.tamanhos === true, desdobrar: valores.desdobrar === true, girar90: valores.girar === true });
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'plotar-moldes' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'tamanho-intermediario' && (
        <DialogoDeCampos
          titulo="Tamanho intermediário"
          campos={[
            { tipo: 'texto', id: 'nome', rotulo: 'Nome do tamanho novo', inicial: '' },
            { tipo: 'texto', id: 'depois', rotulo: 'Depois de qual tamanho', inicial: pecaSelecionada?.graduacao?.tamanhos[0] ?? '' },
          ]}
          nota="Entra em todas as peças que têm esse tamanho e um seguinte, com as regras no meio do caminho entre os dois."
          rotuloDoBotao="Criar"
          onAplicar={(valores) => {
            try {
              const depois = String(valores.depois);
              const comEle = pecas.map((p) => (p.graduacao && p.graduacao.tamanhos.indexOf(depois) >= 0 && p.graduacao.tamanhos.indexOf(depois) < p.graduacao.tamanhos.length - 1 ? comTamanhoIntermediario(p, String(valores.nome), depois) : p));
              if (comEle.every((p, i) => p === pecas[i])) return `Nenhuma peça tem um tamanho depois de “${depois}”.`;
              aplicarMudanca(comEle);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'tamanho-intermediario' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'alinhar-pecas' && (
        <DialogoDeCampos
          titulo="Alinhar peças"
          resumo={[['Selecionadas', String(new Set([...idsSelecionadosEmLote, ...(selecionadoId ? [selecionadoId] : [])]).size)]]}
          campos={[
            {
              tipo: 'escolha',
              id: 'modo',
              rotulo: 'Como',
              opcoes: (Object.keys(ROTULO_DE_ALINHAR) as ModoDeAlinhar[]).map((valor) => ({ valor, rotulo: ROTULO_DE_ALINHAR[valor] })),
              inicial: 'comeco',
            },
          ]}
          nota="Só a posição muda. Se uma peça cair sobre outra, a validação avisa; Ctrl+Z desfaz."
          rotuloDoBotao="Alinhar"
          onAplicar={(valores) => {
            const ids = new Set([...idsSelecionadosEmLote, ...(selecionadoId ? [selecionadoId] : [])]);
            if (ids.size < 2) return 'Selecione ao menos duas peças (retângulo, ou Ctrl+clique).';
            aplicarMudanca(alinharPecas(pecas, ids, valores.modo as ModoDeAlinhar));
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'alinhar-pecas' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'plt-por-partes' && (
        <DialogoDeCampos
          titulo="PLT por partes"
          campos={[
            { tipo: 'medida', id: 'xInicial', rotulo: 'X inicial: onde o papel acabou, no comprimento do risco (mm)', inicial: '', opcional: true },
            { tipo: 'medida', id: 'papel', rotulo: 'Largura do papel, se o risco for mais largo (mm)', inicial: '', opcional: true },
            { tipo: 'inteiro', id: 'faixa', rotulo: 'Faixa do papel (1, 2…)', inicial: '1' },
          ]}
          nota="O que fica antes do X inicial não sai, e o plotter recomeça do zero. Com a largura do papel, sai só a faixa pedida; imprima a seguinte depois. Confira as emendas no primeiro risco: isto não foi testado num plotter físico."
          rotuloDoBotao="Salvar o PLT"
          onAplicar={(valores) => {
            const faixa = Number(valores.faixa);
            if (valores.xInicial === undefined && valores.papel === undefined) return 'Diga o X inicial, a largura do papel, ou os dois.';
            if (!(faixa >= 1)) return 'A faixa começa em 1.';
            void exportarPlt({ ...(valores.xInicial !== undefined ? { xInicialMm: Number(valores.xInicial) } : {}), ...(valores.papel !== undefined ? { larguraDoPapelMm: Number(valores.papel), faixa } : {}) });
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'plt-por-partes' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'corte-iso' && (
        <DialogoDeCampos
          titulo="Exportar para a mesa de corte (ISO)"
          resumo={[
            ['Peças', String(pecas.length)],
            ['Largura da mesa', enfesto ? `${numeroComVirgula(enfesto.larguraUtilMm / 10, 1)} cm (do enfesto)` : 'a das peças (sem enfesto)'],
          ]}
          campos={[
            { tipo: 'inteiro', id: 'velocidade', rotulo: 'Velocidade de corte (mm/min)', inicial: String(VELOCIDADE_PADRAO_MM_MIN) },
            { tipo: 'caixa', id: 'caneta', rotulo: 'Riscar as linhas internas e o fio com a caneta (T3)', inicial: false },
            { tipo: 'caixa', id: 'tangencial', rotulo: 'Faca tangencial: o eixo C acompanha o corte (sobe para girar nas viradas acima de 30°)', inicial: false },
            { tipo: 'caixa', id: 'furador', rotulo: 'Furador pelos comandos M43 e M44, e não pelo eixo Z', inicial: false },
            { tipo: 'medida', id: 'lamina', rotulo: 'Faca tangencial: distância da ponta ao eixo (mm, opcional)', inicial: '', opcional: true },
          ]}
          nota="O encaixe em G-code (ISO 6983), em mm e coordenadas absolutas: T1 faca (contorno e furos), T2 piqueteador, T3 caneta, T4 furador (marcas). Em cada peça, o de dentro é feito antes do contorno. Não foi testado numa mesa de corte: confira o primeiro corte numa folha de papel."
          rotuloDoBotao="Salvar o ISO"
          onAplicar={(valores) => {
            const velocidade = Number(valores.velocidade);
            if (!(velocidade >= 100)) return 'A velocidade precisa ser de pelo menos 100 mm/min.';
            void exportarIso(velocidade, valores.caneta === true, valores.tangencial === true, Number(valores.lamina ?? 0), valores.furador === true);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'corte-iso' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'espiral' && (
        <DialogoDeCampos
          titulo="Espiral"
          campos={[
            { tipo: 'medida', id: 'largura', rotulo: 'Largura da tira (mm)', inicial: String(espiralPendente?.larguraMm ?? 60) },
            {
              tipo: 'medida',
              id: 'perimetro',
              rotulo: 'Perímetro (mm): o comprimento da borda de dentro',
              inicial: String(espiralPendente?.perimetroMm ?? 1000),
            },
          ]}
          nota="É o molde em espiral do babado: uma tira enrolada, cuja borda de dentro — a que se costura esticada — mede o perímetro. Depois de confirmar, clique onde o centro da espiral deve ficar."
          rotuloDoBotao="Posicionar"
          onAplicar={(valores) => {
            const larguraMm = Number(valores.largura);
            const perimetroMm = Number(valores.perimetro);
            try {
              espiral(ponto(0, 0), larguraMm, perimetroMm);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            entrarModoDeConstrucao('espiral');
            setEspiralPendente({ larguraMm, perimetroMm });
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'bainha' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Bainha"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[
            {
              tipo: 'inteiro',
              id: 'dobras',
              rotulo: `Número de dobras (1 a ${MAXIMO_DE_DOBRAS_DA_BAINHA})`,
              inicial: String(opcoesDeBainha.dobras),
            },
            { tipo: 'medida', id: 'largura', rotulo: 'Largura de cada dobra (mm)', inicial: paraCampo(opcoesDeBainha.larguraMm) },
            {
              tipo: 'medida',
              id: 'largura2',
              rotulo: 'Largura 2 (mm): só se a outra ponta tiver largura diferente',
              inicial: opcoesDeBainha.largura2Mm === undefined ? '' : paraCampo(opcoesDeBainha.largura2Mm),
              opcional: true,
            },
            { tipo: 'caixa', id: 'piques', rotulo: 'Pique nas pontas de cada linha de dobra', inicial: opcoesDeBainha.piques },
          ]}
          nota="Depois de confirmar, clique no contorno da peça onde a bainha começa e onde termina. A sobra sai para fora da peça, as laterais copiam as costuras vizinhas (para caírem em cima delas quando a bainha dobrar), e cada linha de dobra fica como linha interna."
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            const opcoes: OpcoesDeBainha = {
              dobras: Number(valores.dobras),
              larguraMm: Number(valores.largura),
              ...(valores.largura2 === undefined ? {} : { largura2Mm: Number(valores.largura2) }),
              piques: valores.piques === true,
            };
            try {
              conferirOpcoesDeBainha(opcoes);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            entrarModoDeConstrucao('bainha');
            setOpcoesDeBainha(opcoes);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'componente' && (
        <DialogoDeCampos
          titulo="Componente pronto"
          campos={[
            {
              tipo: 'escolha',
              id: 'tipo',
              rotulo: 'Componente',
              opcoes: (Object.keys(COMPONENTES) as TipoDeComponente[]).map((t) => ({ valor: t, rotulo: `${COMPONENTES[t].nome} — ${COMPONENTES[t].descricao}` })),
              inicial: 'bolso-chapa',
            },
          ]}
          nota="O componente sai uma peça nova, pelas medidas que você der na janela seguinte: com o fio, a costura de 10 mm, a dobra e os piques. Ela entra depois das peças da mesa, e muda como qualquer peça."
          rotuloDoBotao="Continuar"
          onAplicar={(valores) => {
            setDialogoDeFerramenta({ tipo: 'medidas-do-componente', componente: valores.tipo as TipoDeComponente });
            return null;
          }}
          // A janela fecha depois de aplicar: só a da escolha, para a das medidas ficar aberta.
          onFechar={() => setDialogoDeFerramenta((d) => (d?.tipo === 'componente' ? null : d))}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'medidas-do-componente' && (
        <DialogoDeCampos
          titulo={COMPONENTES[dialogoDeFerramenta.componente].nome}
          campos={COMPONENTES[dialogoDeFerramenta.componente].campos.map((c) => ({ tipo: 'medida' as const, id: c.id, rotulo: c.rotulo, inicial: paraCampo(c.padraoMm) }))}
          nota={COMPONENTES[dialogoDeFerramenta.componente].descricao}
          rotuloDoBotao="Criar"
          onAplicar={(valores) => {
            const tipo = dialogoDeFerramenta.componente;
            try {
              const medidas = Object.fromEntries(COMPONENTES[tipo].campos.map((c) => [c.id, Number(valores[c.id])]));
              const nova = componenteNoProjeto(componente(tipo, medidas, proximoId), pecas);
              const novasPecas = [...pecas, nova];
              aplicarMudanca(novasPecas);
              setSelecionadoId(nova.id);
              setIdsSelecionadosEmLote(new Set());
              const retangulo = retanguloDoDesenho(novasPecas, enfesto, imagens);
              if (retangulo) setTransform(enquadrarRetanguloDoMundo(retangulo, tamanhoDaTela));
              setAviso({ texto: `Componente “${COMPONENTES[tipo].nome}” criado pelas medidas, depois das peças da mesa.`, pecas: novasPecas, selecionadoId: nova.id });
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            setDialogoDeFerramenta(null);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'ponto-de-casamento' && (
        <DialogoDeCampos
          titulo="Ponto de casamento"
          campos={[
            {
              tipo: 'texto',
              id: 'grupo',
              rotulo: 'Grupo (em branco: o ponto principal, que cai na linha do desenho)',
              inicial: grupoDoPontoDeCasamento,
              opcional: true,
            },
          ]}
          nota="O risco de um tecido listrado ou xadrez põe cada peça onde o ponto dela cai numa linha do desenho. O ponto principal (em branco) cai na linha de referência do tecido; o de um grupo (manga, bolso) cai na mesma listra que o do mesmo grupo nas outras peças — na cava da frente e na cabeça da manga, a listra da cava passa pela manga. Depois de continuar, clique nas peças."
          rotuloDoBotao="Continuar"
          onAplicar={(valores) => {
            const grupo = grupoLimpo(String(valores.grupo ?? ''));
            if (/[:\-–—]/.test(grupo)) return 'O nome do grupo não pode ter dois-pontos nem traço (eles separam o nome no rótulo).';
            setGrupoDoPontoDeCasamento(grupo);
            entrarModoDeConstrucao('ponto-de-casamento');
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'forro-entretela-vista' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Forro, entretela e vista"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[
            {
              tipo: 'escolha',
              id: 'tipo',
              rotulo: 'Gerar',
              opcoes: [
                { valor: 'vista', rotulo: 'Vista — a faixa ao longo de um trecho (decote, meio da frente, cava)' },
                { valor: 'forro', rotulo: 'Forro — a peça sem a faixa de um trecho (encurtado na barra, ou sem a vista)' },
                { valor: 'entretela', rotulo: 'Entretela — a peça inteira recuada em volta, sem costura' },
              ],
              inicial: opcoesDaPecaDerivada.tipo,
            },
            { tipo: 'medida', id: 'largura', rotulo: 'Vista: a largura (mm) · Forro: quanto encurta (mm)', inicial: paraCampo(opcoesDaPecaDerivada.larguraMm) },
            {
              tipo: 'medida',
              id: 'largura2',
              rotulo: 'Vista: a largura na outra ponta (mm), só se for diferente',
              inicial: opcoesDaPecaDerivada.largura2Mm === undefined ? '' : paraCampo(opcoesDaPecaDerivada.largura2Mm),
              opcional: true,
            },
            { tipo: 'medida', id: 'recuo', rotulo: 'Entretela: o recuo em volta (mm)', inicial: paraCampo(opcoesDaPecaDerivada.recuoMm) },
          ]}
          nota="A vista e o forro: depois de continuar, clique no contorno onde o trecho começa e onde termina (o trecho mais curto entre os dois). A entretela sai na hora. A peça nova fica ao lado da principal, que não muda; o forro e a entretela entram nos grupos “Forro” e “Entretela” do encaixe, porque são de outro tecido."
          rotuloDoBotao="Continuar"
          onAplicar={(valores) => {
            const opcoes: OpcoesDaPecaDerivada = {
              tipo: valores.tipo as TipoDePecaDerivada,
              larguraMm: Number(valores.largura),
              ...(valores.largura2 === undefined ? {} : { largura2Mm: Number(valores.largura2) }),
              recuoMm: Number(valores.recuo),
            };
            try {
              conferirOpcoesDaPecaDerivada(opcoes);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            setOpcoesDaPecaDerivada(opcoes);
            if (!pedeOTrecho(opcoes.tipo)) {
              try {
                const resultado = aplicarPecaDerivada(pecas, pecaSelecionada, null, opcoes, proximoId);
                aplicarMudanca([...resultado.pecas]);
                // A entretela não pede clique: se a ferramenta esperava o trecho (de uma vista), deixa de esperar.
                cancelarModo();
                setRecadoDaFerramenta(resultado.recado);
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
              setDialogoDeFerramenta(null);
              return null;
            }
            entrarModoDeConstrucao('forro-entretela-vista');
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'unir' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Unir moldes"
          resumo={[['Primeira peça', pecaSelecionada.nome]]}
          campos={dialogoDeUnir(unirApenasMovendo, opcoesDeUniao).campos}
          nota={dialogoDeUnir(unirApenasMovendo, opcoesDeUniao).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            const lido = lerDialogoDeUnir(valores);
            entrarModoDeConstrucao('unir');
            setUnirApenasMovendo(lido.apenasMover);
            setOpcoesDeUniao(lido.uniao);
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'pence' && dialogoDePence && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.ferramenta}
          titulo={dialogoDePence.titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDePence.campos}
          nota={dialogoDePence.nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            try {
              const novas = lerDialogoDaPence(dialogoDeFerramenta.ferramenta, opcoesDasPences, valores);
              entrarModoDeConstrucao(dialogoDeFerramenta.ferramenta);
              setOpcoesDasPences(novas);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'elemento' && dialogoDeElemento && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.ferramenta}
          titulo={dialogoDeElemento.titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeElemento.campos}
          nota={dialogoDeElemento.nota}
          rotuloDoBotao={dialogoDeElemento.rotuloDoBotao}
          onAplicar={(valores) => {
            const ferramenta = dialogoDeFerramenta.ferramenta;
            try {
              const novas = lerDialogoDoElemento(ferramenta, opcoesDeElemento, valores);
              setOpcoesDeElemento(novas);
              // "Por coordenada" cria o ponto na hora; as outras ligam a ferramenta.
              if (ferramenta === 'ponto-por-coordenada') {
                const resultado = aplicarPontoPorCoordenada(novas, pecas, pecaSelecionada, proximoId);
                const novasPecas = [...resultado.pecas];
                aplicarMudanca(novasPecas);
                // Sai da ferramenta que estava ligada, para a confirmação aparecer na faixa de mensagens.
                cancelarModo();
                avisar(resultado.recado, novasPecas);
              } else if (ehModoDeElemento(ferramenta)) {
                entrarModoDeConstrucao(ferramenta);
              }
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      <input
        ref={arquivoDeImagemRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
        hidden
        tabIndex={-1}
        aria-label="Arquivo de imagem do modelo"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // Esvazia o campo: escolher de novo o mesmo arquivo tem de valer outra vez.
          e.target.value = '';
          if (arquivo) void receberArquivoDeImagem(arquivo);
        }}
      />
      {programas && (
        <PainelDeProgramas
          programas={programas}
          erro={erroDosProgramas}
          onAbrir={(id) => {
            void window.enfestoCad?.abrirPrograma(id).then(setErroDosProgramas, (e: unknown) => setErroDosProgramas(e instanceof Error ? e.message : String(e)));
          }}
          onRemover={(id) => mudarProgramas(window.enfestoCad?.removerPrograma(id))}
          onAdicionarArquivo={(nome) => mudarProgramas(window.enfestoCad?.adicionarArquivoDePrograma(nome))}
          onAdicionarEndereco={(nome, endereco) => mudarProgramas(window.enfestoCad?.adicionarEnderecoDePrograma(nome, endereco))}
          onFechar={() => setProgramas(null)}
        />
      )}
      {painelDeImagens && (
        <PainelDeImagens
          imagens={imagens}
          digitalizando={painelDeImagens === 'digitalizar'}
          erro={erroDasImagens}
          onAdicionar={() => arquivoDeImagemRef.current?.click()}
          onMostrar={(id, visivel) => {
            const imagem = imagens.find((i) => i.id === id);
            if (imagem) setErroDasImagens(mudarImagens((projeto) => substituirImagem(projeto, { ...imagem, visivel }, new Date().toISOString())));
          }}
          onOpacidade={(id, opacidade) => {
            const imagem = imagens.find((i) => i.id === id);
            if (imagem) setErroDasImagens(mudarImagens((projeto) => substituirImagem(projeto, { ...imagem, opacidade }, new Date().toISOString())));
          }}
          onCalibrar={iniciarCalibracao}
          onRemover={(id) => {
            const imagem = imagens.find((i) => i.id === id);
            // Fora do desfazer: a imagem é do projeto, não do desenho das peças.
            if (!imagem || !window.confirm(`Remover a imagem “${imagem.nome}” do projeto? Isto não pode ser desfeito.`)) return;
            setErroDasImagens(mudarImagens((projeto) => removerImagem(projeto, id, new Date().toISOString())));
          }}
          onContornar={contornarAImagem}
          onFechar={() => setPainelDeImagens(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'escala-da-imagem' &&
        calibracao?.pontos.length === 2 &&
        (() => {
          const imagem = imagens.find((i) => i.id === calibracao.imagemId);
          const [a, b] = calibracao.pontos as readonly [Ponto2D, Ponto2D];
          if (!imagem) return null;
          return (
            <DialogoDeCampos
              titulo="Escala da imagem"
              resumo={[
                ['Imagem', imagem.nome],
                ['Entre os dois pontos, na escala de agora', formatarMm(Math.hypot(b.x - a.x, b.y - a.y))],
              ]}
              campos={[{ tipo: 'medida', id: 'distancia', rotulo: 'Distância real entre os dois pontos (mm)', inicial: '' }]}
              nota="A imagem cresce ou encolhe a partir do canto de cima à esquerda, até os dois pontos ficarem à distância digitada. Dá para calibrar de novo quando quiser."
              rotuloDoBotao="Calibrar"
              onAplicar={(valores) => {
                let calibrada: ImagemDoModelo;
                try {
                  calibrada = calibrarImagem(imagem, a, b, Number(valores.distancia));
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
                const erro = mudarImagens((projeto) => substituirImagem(projeto, calibrada, new Date().toISOString()));
                if (erro) return erro;
                // A imagem mudou de tamanho: a vista vai até ela, para o contorno começar à vista.
                mudarVistaPara(enquadrarRetanguloDoMundo(retanguloDaImagem(calibrada), tamanhoDaTela));
                const recado = `Imagem “${calibrada.nome}” na escala (${descreverEscalaDaImagem(calibrada)})`;
                if (calibracao.contornarDepois) {
                  entrarModoNovoMolde();
                  setRecadoDaFerramenta(`${recado}. Agora contorne o molde`);
                } else {
                  cancelarModo();
                  avisar(`${recado}.`);
                }
                setCalibracao(null);
                return null;
              }}
              onFechar={() => {
                setDialogoDeFerramenta(null);
                // Fechado sem calibrar: os dois pontos são esquecidos, para clicar de novo.
                setCalibracao((atual) => (atual ? { ...atual, pontos: [] } : null));
              }}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'editar-pence' &&
        pecaSelecionada &&
        (() => {
          // A pence sem registro entra no diálogo já com o registro que teria: a peça só muda ao aplicar.
          const reconhecer = dialogoDeFerramenta.reconhecer;
          const pecaDaPence = reconhecer ? comPenceReconhecida(pecaSelecionada, reconhecer) : pecaSelecionada;
          const dialogo = dialogoDeEditarPence(pecaDaPence, dialogoDeFerramenta.id, reconhecer !== undefined);
          if (!dialogo) return null;
          return (
            <DialogoDeCampos
              key={dialogoDeFerramenta.id}
              titulo={dialogo.titulo}
              resumo={[['Peça', pecaSelecionada.nome]]}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao="Aplicar"
              onAplicar={(valores) => {
                try {
                  const resultado = aplicarEdicaoDaPence(pecas, pecaDaPence, dialogoDeFerramenta.id, valores, proximoId);
                  aplicarMudanca([...resultado.pecas]);
                  setRecadoDaFerramenta(resultado.recado);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'editar-prega' &&
        pecaSelecionada &&
        (() => {
          // A prega sem registro entra no diálogo já com o registro que teria: a peça só muda ao aplicar.
          const reconhecerPrega = dialogoDeFerramenta.reconhecer;
          const pecaDaPrega = reconhecerPrega ? comPregaReconhecida(pecaSelecionada, reconhecerPrega) : pecaSelecionada;
          const dialogo = dialogoDeEditarPrega(pecaDaPrega, dialogoDeFerramenta.id, reconhecerPrega !== undefined);
          if (!dialogo) return null;
          return (
            <DialogoDeCampos
              key={dialogoDeFerramenta.id}
              titulo={dialogo.titulo}
              resumo={[['Peça', pecaSelecionada.nome]]}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao="Aplicar"
              onAplicar={(valores) => {
                try {
                  const resultado = aplicarEdicaoDaPrega(pecas, pecaDaPrega, dialogoDeFerramenta.id, valores, proximoId);
                  aplicarMudanca([...resultado.pecas]);
                  setRecadoDaFerramenta(resultado.recado);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'editar-cunha' &&
        pecaSelecionada &&
        (() => {
          const dialogo = dialogoDeEditarCunha(pecaSelecionada, dialogoDeFerramenta.id);
          if (!dialogo) return null;
          return (
            <DialogoDeCampos
              key={dialogoDeFerramenta.id}
              titulo={dialogo.titulo}
              resumo={[['Peça', pecaSelecionada.nome]]}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao="Aplicar"
              onAplicar={(valores) => {
                try {
                  const resultado = aplicarEdicaoDaCunha(pecas, pecaSelecionada, dialogoDeFerramenta.id, valores, proximoId);
                  aplicarMudanca([...resultado.pecas]);
                  setRecadoDaFerramenta(resultado.recado);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'cortar' && pecaSelecionada && (
        <DialogoDeCampos
          titulo={dialogoDeCortar(opcoesDeCorte, corteManual).titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeCortar(opcoesDeCorte, corteManual).campos}
          nota={dialogoDeCortar(opcoesDeCorte, corteManual).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            try {
              setOpcoesDeCorte(lerDialogoDeCortar(valores));
              setCorteManual(lerContornoDoCorte(valores));
              entrarModoDeConstrucao('cortar');
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'remover-regiao' && pecaSelecionada && (
        <DialogoDeCampos
          titulo={dialogoDeRemoverRegiao(opcoesDeRemover).titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeRemoverRegiao(opcoesDeRemover).campos}
          nota={dialogoDeRemoverRegiao(opcoesDeRemover).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            setOpcoesDeRemover(lerDialogoDeRemoverRegiao(valores));
            entrarModoDeConstrucao('remover-regiao');
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'conferir' && (
        <DialogoDeCampos
          titulo="Conferir moldes"
          campos={dialogoDaConferencia(opcoesDaConferencia).campos}
          nota={dialogoDaConferencia(opcoesDaConferencia).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            try {
              const opcoes = lerDialogoDaConferencia(valores);
              entrarModoDeConstrucao('conferir');
              setConferencia(SEM_CONFERENCIA);
              setOpcoesDaConferencia(opcoes);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'dobrar' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Dobrar"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeDobrar(opcoesDeDobrar).campos}
          nota={dialogoDeDobrar(opcoesDeDobrar).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            entrarModoDeConstrucao('dobrar');
            setOpcoesDeDobrar(lerDialogoDeDobrar(valores));
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'cor' && (
        <DialogoDeCampos
          titulo="Cor da peça"
          resumo={[['Peças', alvosDeCostura.length === 1 ? alvosDeCostura[0]!.nome : `${alvosDeCostura.length} selecionadas`]]}
          campos={[
            {
              tipo: 'escolha',
              id: 'cor',
              rotulo: 'Cor de fundo no desenho',
              opcoes: [{ valor: '', rotulo: 'Sem cor (a padrão)' }, ...CORES_DE_PECA.map((c) => ({ valor: c.valor, rotulo: c.nome }))],
              inicial: alvosDeCostura[0]?.cor ?? '',
            },
          ]}
          nota="A cor é só do desenho na tela, para distinguir as peças. O contorno continua mostrando se a peça está selecionada ou com problema."
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) => {
            try {
              const cor = String(valores.cor) === '' ? null : String(valores.cor);
              const ids = new Set(alvosDeCostura.map((p) => p.id));
              aplicarMudanca(pecas.map((p) => (ids.has(p.id) ? definirCor(p, cor) : p)));
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'texto-novo' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Inserir texto"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[
            { tipo: 'texto', id: 'texto', rotulo: 'Texto', inicial: textoAInserir.texto },
            { tipo: 'medida', id: 'altura', rotulo: 'Altura das letras (mm)', inicial: String(textoAInserir.alturaMm).replace('.', ',') },
          ]}
          nota="Depois de confirmar, clique onde o texto deve ficar. Ele fica preso à peça: anda, gira e é salvo com ela, e sai no PDF."
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            const alturaMm = Number(valores.altura);
            try {
              // Confere o texto e a altura antes de ligar a ferramenta.
              adicionarTexto(pecaSelecionada, { x: 0, y: 0 }, String(valores.texto), alturaMm, 'conferencia');
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            entrarModoDeConstrucao('inserir-texto');
            setTextoAInserir({ texto: String(valores.texto), alturaMm });
            return null;
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'editar-texto' && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.id}
          titulo="Editar texto"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={[
            {
              tipo: 'texto',
              id: 'texto',
              rotulo: 'Texto (em branco, apaga)',
              inicial: pecaSelecionada.textos?.find((t) => t.id === dialogoDeFerramenta.id)?.texto ?? '',
              opcional: true,
            },
            {
              tipo: 'medida',
              id: 'altura',
              rotulo: 'Altura das letras (mm)',
              inicial: String(pecaSelecionada.textos?.find((t) => t.id === dialogoDeFerramenta.id)?.alturaMm ?? 10).replace('.', ','),
            },
          ]}
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) => {
            try {
              const texto = valores.texto === undefined ? '' : String(valores.texto);
              const nova = alterarTexto(pecaSelecionada, dialogoDeFerramenta.id, texto, Number(valores.altura));
              aplicarMudanca(pecas.map((p) => (p.id === pecaSelecionada.id ? nova : p)));
              setRecadoDaFerramenta(texto.trim() === '' ? 'Texto apagado.' : 'Texto alterado.');
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'codigo-do-pique' && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.id}
          titulo="Relacionamento de piques"
          resumo={[
            ['Peça', pecaSelecionada.nome],
            [
              'Códigos em uso',
              [...new Set(pecas.flatMap((p) => p.piques.flatMap((q) => (q.codigo ? [q.codigo] : []))))]
                .map((codigo) => `${codigo} (${piquesComOCodigo(pecas, codigo).map((r) => `${r.peca.nome}: ${r.quantos}`).join(', ')})`)
                .join(' · ') || 'nenhum ainda',
            ],
          ]}
          campos={[
            {
              tipo: 'texto',
              id: 'codigo',
              rotulo: 'Código deste pique (em branco, tira o código)',
              inicial: pecaSelecionada.piques.find((q) => q.id === dialogoDeFerramenta.id)?.codigo ?? '',
              opcional: true,
            },
          ]}
          nota="Dê o mesmo código aos piques que se encontram na costura, um em cada peça. O código aparece escrito na ponta do pique."
          rotuloDoBotao="Aplicar"
          onAplicar={(valores) => {
            try {
              const codigo = valores.codigo === undefined ? '' : String(valores.codigo);
              const nova = definirCodigoDoPique(pecaSelecionada, dialogoDeFerramenta.id, codigo);
              const novasPecas = pecas.map((p) => (p.id === pecaSelecionada.id ? nova : p));
              aplicarMudanca(novasPecas);
              const onde = piquesComOCodigo(novasPecas, codigo).filter((r) => r.peca.id !== pecaSelecionada.id);
              setRecadoDaFerramenta(
                codigo.trim() === ''
                  ? 'Código tirado do pique.'
                  : onde.length > 0
                    ? `Pique com o código “${codigo.trim()}”: o mesmo de ${onde.map((r) => `“${r.peca.nome}”`).join(', ')}.`
                    : `Pique com o código “${codigo.trim()}”: ainda não há outro pique com esse código em outra peça.`,
              );
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'autor' && (
        <DialogoDeCampos
          titulo="Autor do modelo"
          resumo={[['Projeto', `${projetoAtual.nome} (${projetoAtual.codigo})`]]}
          campos={[{ tipo: 'texto', id: 'autor', rotulo: 'Nome de quem fez o modelo (em branco, tira o autor)', inicial: projetoAtual.autor ?? '', opcional: true }]}
          nota="O autor fica guardado no projeto, junto com o nome e o código dele."
          rotuloDoBotao="Guardar"
          onAplicar={(valores) => {
            try {
              const atualizado = definirAutor(projetoAtual, valores.autor === undefined ? '' : String(valores.autor), new Date().toISOString());
              setProjetoAtual(atualizado);
              persistirProjeto(atualizado);
              avisar(atualizado.autor ? `Autor do projeto: ${atualizado.autor}.` : 'O projeto ficou sem autor.');
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'tamanhos' && pecaSelecionada && (
        <DialogoDeCampos
          titulo="Graduação: tamanhos"
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeTamanhos(pecaSelecionada).campos}
          nota={dialogoDeTamanhos(pecaSelecionada).nota}
          rotuloDoBotao="Indicar no desenho"
          onAplicar={(valores) => {
            try {
              const comTamanhos = aplicarTamanhos(pecaSelecionada, valores);
              // Confirmar sem mudar nada não gasta um passo de desfazer.
              if (!mesmosTamanhos(pecaSelecionada, comTamanhos)) {
                aplicarMudanca(pecas.map((p) => (p.id === pecaSelecionada.id ? comTamanhos : p)));
              }
              entrarModoDeConstrucao('graduar-tabela');
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'marcacao' &&
        pecaSelecionada &&
        (() => {
          const ferramenta = dialogoDeFerramenta.ferramenta;
          const dialogo = dialogoDaMarcacao(ferramenta, opcoesDeMarcacao, pecas, piquesCadastrados);
          if (!dialogo) return null;
          return (
            <DialogoDeCampos
              key={ferramenta}
              titulo={dialogo.titulo}
              resumo={[['Peça', pecaSelecionada.nome]]}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao={dialogo.rotuloDoBotao}
              onAplicar={(valores) => {
                try {
                  const novas = lerDialogoDaMarcacao(ferramenta, opcoesDeMarcacao, valores, piquesCadastrados);
                  // "Cadastrar pique", excluir ou alterar o nome: o cadastro muda ao confirmar. As peças só mudam se foi
                  // pedido levar a mudança aos piques já postos.
                  if (ferramenta === 'cadastrar-pique' && cadastroAgeNaHora(novas)) {
                    const feito = aplicarCadastro(novas, piquesCadastrados, pecas);
                    // O cadastro muda como um passo do Ctrl+Z, com as peças novas, se algum pique delas foi alcançado.
                    const comOsPiquesLevados = feito.pecas ? [...feito.pecas] : undefined;
                    if (!mudarCadastroDePiques(feito.cadastrados, comOsPiquesLevados)) return 'Não foi possível guardar o cadastro neste computador.';
                    setOpcoesDeMarcacao({ ...novas, cadastrar: { ...novas.cadastrar, acao: 'criar', nome: '', descricao: '', redesenhar: false } });
                    cancelarModo();
                    avisar(feito.recado, comOsPiquesLevados ?? pecas);
                    return null;
                  }
                  // "Substituir" e o "Remover" com "todos" agem ao confirmar; as outras ligam a ferramenta.
                  const alvos = novas.substituir.onde === 'todas' ? pecas.map((p) => p.id) : novas.substituir.onde === 'marcadas' ? [...idsSelecionadosEmLote] : [pecaSelecionada.id];
                  const naHora =
                    ferramenta === 'substituir-piques'
                      ? aplicarSubstituir(novas, pecas, alvos, proximoId)
                      : ferramenta === 'remover-pique' && removerAgeNaHora(novas)
                        ? aplicarRemoverTodos(novas, pecas, pecaSelecionada)
                        : null;
                  setOpcoesDeMarcacao(novas);
                  if (naHora) {
                    const novasPecas = [...naHora.pecas];
                    aplicarMudanca(novasPecas);
                    cancelarModo();
                    avisar(naHora.recado, novasPecas);
                  } else if (ehModoDeMarcacao(ferramenta)) {
                    entrarModoDeConstrucao(ferramenta);
                  }
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'alterar-pique' &&
        pecaSelecionada &&
        (() => {
          const { id, interno } = dialogoDeFerramenta;
          const doTexto = dialogoDeFerramenta.texto === true;
          const dialogo = doTexto ? dialogoDeAlterarTexto(pecaSelecionada, id) : dialogoDeAlterarPique(pecaSelecionada, id, interno, piquesCadastrados);
          if (!dialogo) return null;
          return (
            <DialogoDeCampos
              key={id}
              titulo={dialogo.titulo}
              resumo={[['Peça', pecaSelecionada.nome]]}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao={dialogo.rotuloDoBotao}
              onAplicar={(valores) => {
                try {
                  if (doTexto) {
                    const doTextoFeito = aplicarAlteracaoDoTexto(pecas, pecaSelecionada, id, valores);
                    aplicarMudanca([...doTextoFeito.pecas]);
                    setRecadoDaFerramenta(doTextoFeito.recado);
                    return null;
                  }
                  const feito = aplicarAlteracaoDoPique(pecas, pecaSelecionada, id, interno, valores, piquesCadastrados);
                  aplicarMudanca([...feito.pecas]);
                  setRecadoDaFerramenta(feito.recado);
                  // Com a posição por indicar, o clique seguinte é o do lugar do pique.
                  setTrecho(feito.mover ? { ...SEM_TRECHO, alvo: id } : SEM_TRECHO);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'graduacao' && dialogoDeGraduacao && pecaSelecionada && (
        <DialogoDeCampos
          key={dialogoDeFerramenta.ferramenta}
          titulo={dialogoDeGraduacao.titulo}
          resumo={[['Peça', pecaSelecionada.nome]]}
          campos={dialogoDeGraduacao.campos}
          nota={dialogoDeGraduacao.nota}
          rotuloDoBotao={dialogoDeGraduacao.rotuloDoBotao}
          onAplicar={(valores) => {
            const ferramenta = dialogoDeFerramenta.ferramenta;
            try {
              const novas = lerDialogoDaGraduacao(ferramenta, opcoesDaGraduacao, valores);
              // "Separar", "Unir" e "Remover do molde inteiro" agem na hora; as outras ligam a ferramenta.
              const naHora =
                // "Separar" só age na hora quando nem o tamanho nem a posição são para indicar com o mouse.
                ferramenta === 'separar-tamanhos'
                  ? separarAgeNaHora(novas)
                    ? aplicarSeparar(novas, pecas, pecaSelecionada, proximoId)
                    : null
                  : ferramenta === 'unir-tamanhos'
                    ? aplicarUnir(pecas, pecaSelecionada, idsSelecionadosEmLote, novas.unir.ajustarCurvas)
                    : ferramenta === 'remover-graduacao' && novas.remover.onde === 'molde'
                      ? aplicarRemoverDoMolde(novas, pecas, pecaSelecionada)
                      : null;
              setOpcoesDaGraduacao(novas);
              if (ferramenta === 'unir-tamanhos') setIdsSelecionadosEmLote(new Set());
              if (naHora) {
                const novasPecas = [...naHora.pecas];
                aplicarMudanca(novasPecas);
                cancelarModo();
                avisar(naHora.recado, novasPecas);
              } else if (ehModoDeGraduacao(ferramenta)) {
                entrarModoDeConstrucao(ferramenta);
              }
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'escolher-regra' && (
        <PainelDeRegras
          regras={regrasDoUsuario}
          idInicial={regraEscolhida?.id ?? null}
          onEscolher={(regra) => {
            entrarModoDeConstrucao('graduar-regras');
            setRegraEscolhida(regra);
            setConjuntoEmUso(null);
          }}
          onExcluir={excluirRegraCadastrada}
          conjuntos={conjuntosDeRegras}
          onEscolherConjunto={(conjunto) => {
            entrarModoDeConstrucao('graduar-regras');
            setConjuntoEmUso({ id: conjunto.id, posicao: 0 });
          }}
          onCriarConjunto={(nome, regras) => {
            try {
              const novos = [...conjuntosDeRegras, criarConjuntoDeRegras(proximoId(), nome, regras)];
              if (!gravarConjuntosDeRegras(window.localStorage, novos)) return 'Não foi possível guardar o conjunto neste computador.';
              setConjuntosDeRegras(novos);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onExcluirConjunto={(id) => {
            const novos = conjuntosDeRegras.filter((c) => c.id !== id);
            gravarConjuntosDeRegras(window.localStorage, novos);
            setConjuntosDeRegras(novos);
            if (conjuntoEmUso?.id === id) setConjuntoEmUso(null);
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'tabela-do-ponto' && pontoDaGraduacao && pecaSelecionada && (
        <PainelDeTabelaDeGraduacao
          key={pontoDaGraduacao.indice}
          nomeDaPeca={pecaSelecionada.nome}
          numeroDoPonto={pontoDaGraduacao.indice + 1}
          graduado={pontoGraduadoEm(pontoDaGraduacao.graduacao, pecaSelecionada.contorno, pontoDaGraduacao.indice) !== null}
          tamanhos={pontoDaGraduacao.graduacao.tamanhos}
          base={pontoDaGraduacao.graduacao.base}
          deslocamentos={pontoDaGraduacao.regra}
          copiada={regraParaColar}
          onCopiar={(deslocamentos) =>
            setRegraCopiada(regraDoPonto('copiada', 'copiada', pontoDaGraduacao.graduacao, deslocamentos))
          }
          onAplicar={(deslocamentos) => {
            try {
              const graduacao = definirRegra(pontoDaGraduacao.graduacao, pecaSelecionada.contorno, pontoDaGraduacao.indice, deslocamentos);
              aplicarMudanca(pecas.map((p) => (p.id === pecaSelecionada.id ? { ...p, graduacao } : p)));
              setRecadoDaFerramenta(`Ponto ${pontoDaGraduacao.indice + 1} graduado pela tabela.`);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'tabela-do-pique' &&
        pecaSelecionada &&
        (() => {
          const dialogo = dialogoDoPique(pecaSelecionada, dialogoDeFerramenta.id, piqueCopiado);
          if (!dialogo) return null;
          return (
            <DialogoDeCampos
              key={dialogoDeFerramenta.id}
              titulo={dialogo.titulo}
              resumo={dialogo.resumo.map(([nome, valor]) => [nome, valor] as [string, string])}
              campos={dialogo.campos}
              nota={dialogo.nota}
              rotuloDoBotao="Aplicar"
              onAplicar={(valores) => {
                try {
                  const resultado = aplicarDialogoDoPique(pecas, pecaSelecionada, dialogoDeFerramenta.id, valores, piqueCopiado);
                  if (resultado.copiada) setPiqueCopiado(resultado.copiada);
                  aplicarMudanca([...resultado.pecas]);
                  setRecadoDaFerramenta(resultado.recado);
                  return null;
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              }}
              onFechar={() => setDialogoDeFerramenta(null)}
            />
          );
        })()}
      {dialogoDeFerramenta?.tipo === 'nome-da-regra' && pontoDaGraduacao && pecaSelecionada && (
        <PainelDeCriarRegra
          key={pontoDaGraduacao.indice}
          nomeDaPeca={pecaSelecionada.nome}
          numeroDoPonto={pontoDaGraduacao.indice + 1}
          tamanhos={pontoDaGraduacao.graduacao.tamanhos}
          base={pontoDaGraduacao.graduacao.base}
          deslocamentos={pontoDaGraduacao.regra}
          onCriar={(nome, codigo, tabela) => {
            try {
              const regra = regraDaTabela(proximoId(), nome, codigo, tabela);
              const novas = [...regrasDoUsuario, regra];
              if (!gravarRegrasCadastradas(window.localStorage, novas)) return 'Não foi possível guardar a regra neste computador.';
              setRegrasDoUsuario(novas);
              setRecadoDaFerramenta(`Regra “${regra.nome}” criada: está em “Regras”.`);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {dialogoDeFerramenta?.tipo === 'raio-do-arco' && pecaSelecionada && (
        <DialogoDeCampos
          titulo={nomeDaFerramentaDeCanto(ferramentaDoCanto(pecaSelecionada.contorno, dialogoDeFerramenta.indice))}
          resumo={[
            ['Peça', pecaSelecionada.nome],
            ['Canto', `ponto ${dialogoDeFerramenta.indice + 1}`],
          ]}
          campos={[{ tipo: 'medida', id: 'raio', rotulo: 'Raio do arco (mm)', inicial: '10' }]}
          nota="O canto vira um arco tangente aos dois elementos que se encontram nele. Entre duas retas, um raio grande demais é reduzido ao que cabe; com um arco de um dos lados, o raio que não cabe é recusado."
          rotuloDoBotao="Criar arco"
          onAplicar={(valores) => {
            const raioMm = Number(valores.raio);
            if (!(raioMm > 0)) return 'O raio precisa ser maior que zero.';
            try {
              aplicarMudanca(
                pecas.map((p) =>
                  p.id === pecaSelecionada.id ? arredondarCanto(p, dialogoDeFerramenta.indice, raioMm, proximoId()) : p,
                ),
              );
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          }}
          onFechar={() => setDialogoDeFerramenta(null)}
        />
      )}
      {mostrarVariantes && (
        <PainelDeVariantes
          variantes={variantesDoProjeto(projetos, projetoAtual)}
          projetoAtualId={projetoAtual.id}
          nomeSugerido={nomeDaProximaVariante(projetos, projetoAtual)}
          onCriar={criarVarianteDoProjeto}
          onAbrir={abrirVarianteDoProjeto}
          onFechar={() => setMostrarVariantes(false)}
        />
      )}
      {painelDeAjuda && <PainelDeAjuda conteudo={painelDeAjuda} onFechar={() => setPainelDeAjuda(null)} />}
      {textoDaFaixa && (
        <div className="faixa-de-instrucao" role="status">
          {textoDaFaixa}
        </div>
      )}
      {salvamento && !salvamento.ok && !salvamento.dispensado && (
        <div className="faixa-de-avisos faixa-de-erro" role="alert">
          <strong>O projeto não foi salvo.</strong> {salvamento.erro} O desenho continua aberto: confira se há espaço no disco e se a
          pasta de dados não está bloqueada (pelo antivírus, por exemplo), e salve de novo com Ctrl+S.{' '}
          <button onClick={() => setSalvamento({ ...salvamento, dispensado: true })}>Dispensar</button>
        </div>
      )}
      {mensagensImportacao && (
        <div className="faixa-de-avisos faixa-da-importacao" role="alert">
          <strong>Avisos da importação:</strong>
          <ul>
            {mensagensImportacao.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <button onClick={() => setMensagensImportacao(null)}>Dispensar</button>
        </div>
      )}
      <div className={mostrarListaDePecas ? 'corpo-principal' : 'corpo-principal sem-lista-de-pecas'}>
        {mostrarListaDePecas && (
          <PainelDePecas
            pecas={pecas}
            selecionadoId={selecionadoId}
            idsSelecionadosEmLote={idsSelecionadosEmLote}
            onSelecionar={selecionarUnico}
            onAlternarSelecaoEmLote={alternarSelecaoEmLote}
            onAbrirPropriedades={abrirPropriedadesDaPeca}
          />
        )}
        <div className="coluna-do-desenho">
          <div className="barra-de-documento">
            <span className="aba-de-documento" title="Projeto aberto">
              {projetoAtual.nome || 'Projeto sem nome'}
            </span>
            <span className="contexto-do-documento">
              <span>Tecido: {tecido ? `${tecido.nome} (${numeroComVirgula(tecido.larguraUtilMm)} mm úteis)` : 'não configurado'}</span>
              <span>
                Enfesto:{' '}
                {enfesto ? `${ROTULO_DO_TIPO[enfesto.tipo]}, ${enfesto.quantidadeDeCamadas} camada(s)` : 'não configurado'}
              </span>
            </span>
          </div>
          <AreaDeDesenho
            contornoOriginal={lembrarOriginal ? (projetoAtual.estadoAtual.pecas.find((p) => p.id === selecionadoId)?.contorno ?? null) : null}
            imagens={imagens}
            pecas={pecas}
            selecionadoId={selecionadoId}
            idsSelecionadosEmLote={idsSelecionadosEmLote}
            enfesto={enfesto}
            idsComErro={idsComErro}
            transform={transform}
            modo={modo}
            pontosEmEdicao={pontosEmEdicao}
            contornoFinalizado={contornoPendente}
            onTransformChange={setTransform}
            onSelecionar={selecionarUnico}
            onCursorMove={setCursorMundo}
            onCliqueNoCanvas={onCliqueNoCanvas}
            onMoverPeca={moverPeca}
            onMoverPecas={moverPecas}
            onConferirTamanho={conferirTamanho}
            travaDoEixo={travaDoEixo}
            onAlternarNaSelecao={alternarPecaNaSelecao}
            onSelecionarVarias={selecionarPecasPeloRetangulo}
            onAbrirPropriedades={abrirPropriedadesDaPeca}
            onMoverVariosPontos={moverVariosPontosDaSelecionada}
            onIndicarPontosParaModificar={setPontosParaModificar}
            onIndicarArestaParaRedefinir={indicarArestaParaRedefinir}
            arestaEmDestaque={arestaEmDestaque}
            onInserirPontoNoMolde={inserirPontoNaSelecionada}
            onExcluirPontoDoMolde={excluirPontoDaSelecionada}
            onArredondarOuChanfrarCanto={arredondarOuChanfrarVerticeDaSelecionada}
            cerca={cerca}
            opcoesDaCerca={opcoesDaCerca}
            onDefinirCerca={definirCerca}
            ferramentaDeVista={ferramentaDeVista}
            onZoomJanelaConcluido={() => setFerramentaDeVista(null)}
            onZoomNoElemento={(ponto, raioMm) => {
              const r = retanguloDoElemento(pecas, ponto, raioMm);
              if (r) mudarVistaPara(enquadrarRetanguloDoMundo(r, tamanhoDaTela));
              setFerramentaDeVista(null);
            }}
            estiloDaCostura={estiloDaCostura}
            coresDosTamanhos={coresDosTamanhos}
            mostrarNaoGraduados={mostrarNaoGraduados}
            onGuardarVista={guardarVista}
            mostrarGrade={mostrarGrade}
            imaAtivo={imaAtivo}
            unidadeDaRegua={unidadeDaRegua}
            onAlternarUnidadeDaRegua={() => setUnidadeDaRegua((u) => (u === 'cm' ? 'mm' : u === 'mm' ? 'pol' : 'cm'))}
            onTamanhoChange={aoMudarTamanhoDaTela}
            medicoes={medicoesResolvidas}
            inicioDoTrecho={inicioDoTrecho}
            cotaEmPrevia={cotaEmPrevia}
            previa={previaNoDesenho}
          />
          {mostrarBarraDeVisualizacao && (
            <BarraDeVisualizacao
              ferramentaDeVista={ferramentaDeVista}
              onAlternarFerramentaDeVista={alternarFerramentaDeVista}
              onZoomIn={() => zoom(1.15)}
              onZoomOut={() => zoom(1 / 1.15)}
              onAjustarTela={ajustarTela}
              onVistaAnterior={vistaAnterior}
              onProximaVista={proximaVista}
              podeVistaAnterior={vistasAnteriores.length > 0}
              podeProximaVista={vistasSeguintes.length > 0}
              mostrarGrade={mostrarGrade}
              onAlternarGrade={() => setMostrarGrade((v) => !v)}
              imaAtivo={imaAtivo}
              onAlternarIma={() => setImaAtivo((v) => !v)}
              passoDaGradeMm={passoDaGradeEmMm(transform.escalaPxPorMm)}
              unidadeDaRegua={unidadeDaRegua}
            />
          )}
        </div>
      </div>
      {mostrarPropriedadesDaPeca && pecaSelecionada && (
        <Sobreposicao titulo="Propriedades da peça" onFechar={() => setMostrarPropriedadesDaPeca(false)}>
          <PainelDePropriedades
            peca={pecaSelecionada}
            gruposDoEncaixe={ordemDosGrupos(pecas)}
            onAlterar={alterarPecaSelecionada}
            onGirar={girarPecaSelecionada}
          />
        </Sobreposicao>
      )}
      {mostrarValidacao && (
        <div className={`faixa-de-validacao ${estadoDaValidacao(problemasDeValidacao)}`} role="alert">
          <strong>Validação do projeto:</strong>
          <label
            className="folga-da-validacao"
            title="Quanto uma linha interna pode passar da borda da peça (a linha de corte) sem ser apontada. Vale de 0 a 100 mm, e fica guardado neste computador."
          >
            Linhas internas: apontar o que passa de{' '}
            <input
              type="text"
              inputMode="decimal"
              size={4}
              aria-label="Folga das linhas internas fora da peça, em milímetros"
              aria-invalid={folgaDigitada(folgaNoCampo) === null}
              value={folgaNoCampo}
              onChange={(e) => mudarFolgaDaValidacao(e.target.value)}
              onBlur={() => setFolgaNoCampo(folgaEscrita(folgaForaDaPecaMm))}
              // Enter e Esc saem do campo, e o foco volta para o programa: é nele que os atalhos (o Ctrl+Z, por
              // exemplo) são ouvidos — com o foco solto na página, eles não valeriam até o próximo clique.
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') appShellRef.current?.focus();
              }}
            />{' '}
            mm da borda da peça
          </label>
          {problemasDeValidacao.length === 0 ? (
            <p>Nenhum problema encontrado.</p>
          ) : (
            <ul>
              {problemasDeValidacao.map((p, i) => (
                <li
                  key={i}
                  className={`severidade-${p.severidade}`}
                  onClick={() => p.pecasEnvolvidasIds[0] && setSelecionadoId(p.pecasEnvolvidasIds[0])}
                >
                  [{p.severidade === 'erro' ? 'ERRO' : 'aviso'}] {p.mensagem}
                  {p.tipo === 'linha-solta' && (
                    <>
                      {' '}
                      <button
                        type="button"
                        title="Tira da peça as linhas internas que estão fora dela: as que não têm parte nenhuma dentro. Ctrl+Z desfaz."
                        onClick={(e) => {
                          e.stopPropagation();
                          tirarLinhasDeFora(p.pecasEnvolvidasIds[0], 'soltas');
                        }}
                      >
                        Tirar
                      </button>
                    </>
                  )}
                  {p.tipo === 'linha-que-sai' && (
                    <>
                      {' '}
                      <button
                        type="button"
                        title="Corta na borda da peça as linhas internas que saem dela e tira só o que está fora; o que está dentro fica. Ctrl+Z desfaz."
                        onClick={(e) => {
                          e.stopPropagation();
                          tirarLinhasDeFora(p.pecasEnvolvidasIds[0], 'so-o-de-fora');
                        }}
                      >
                        Tirar só o de fora
                      </button>{' '}
                      <button
                        type="button"
                        title="Tira da peça, inteiras, as linhas internas que saem dela. Ctrl+Z desfaz."
                        onClick={(e) => {
                          e.stopPropagation();
                          tirarLinhasDeFora(p.pecasEnvolvidasIds[0], 'que-saem');
                        }}
                      >
                        Tirar a linha
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <BarraDeStatus
        cursorMundo={cursorMundo}
        transform={transform}
        totalDePecas={pecas.length}
        pecasSelecionadas={idsSelecionadosEmLote.size > 0 ? idsSelecionadosEmLote.size : selecionadoId !== null ? 1 : 0}
        problemas={problemasDeValidacao}
        onAlternarValidacao={() => setMostrarValidacao((v) => !v)}
        aproveitamentoPercentual={aproveitamentoAtualDaMesa}
        unidade={unidadeDaRegua}
        salvamento={salvamento}
        fila={{
          calculando: contagemDaFila(filaDeEncaixes.fila).executando,
          aguardando: contagemDaFila(filaDeEncaixes.fila).aguardando,
          prontos: concluidosSemAplicar(filaDeEncaixes.fila),
        }}
        onAbrirFila={abrirFilaDeEncaixes}
        prazos={avisoDePrazos(colecoes.arquivo.colecoes, hoje)}
        onAbrirPrazos={() => abrirColecoes('tarefas')}
        pontoReferencia={
          MODOS_COM_PONTO_DE_REFERENCIA.has(modo) && pontosEmEdicao.length > 0
            ? pontosEmEdicao[pontosEmEdicao.length - 1]!
            : null
        }
      />
    </div>
  );
}
