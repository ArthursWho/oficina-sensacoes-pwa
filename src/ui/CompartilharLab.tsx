import { useEffect, useState } from 'preact/hooks';
import { TRACKS } from '../content/tracks';
import {
  copiarComoTexto,
  MIME_SHARE_CSV,
  MIME_SHARE_TXT,
  MIME_SHARE_XLSX,
} from '../export/baixar';
import { gerarCsv, gerarCsvBlob } from '../export/csv';
import { gerarXlsx } from '../export/xlsx';
import { LinhaSessao } from '../session/tipos';
import { Button } from './components/Button';

type DisplayMode = 'fullscreen' | 'standalone' | 'browser';

function getDisplayMode(): DisplayMode {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: fullscreen)').matches
  ) {
    return 'fullscreen';
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return 'standalone';
  }
  return 'browser';
}

// Sessão fictícia válida de 6 linhas em memória (não acessa IndexedDB)
const LINHAS_EXEMPLO: readonly LinhaSessao[] = TRACKS.map((t, idx) => ({
  id_participante: 'Participante_01',
  data_hora: '2026-11-19 03:00:00',
  ordem_musica: idx + 1,
  musica: t.rotulo,
  reconheceu: idx % 2 === 0 ? 'Sim' : 'Não',
  tipo_pergunta_2: idx % 2 === 0 ? 'Acertou' : 'Surpreendeu',
  resposta_pergunta_2: 'Sim',
  repeticoes_editado: idx % 2,
  repeticoes_original: 0,
}));

const CSV_TEXTO_SEM_BOM = gerarCsv(LINHAS_EXEMPLO);
const CSV_BLOB_COM_BOM = gerarCsvBlob(LINHAS_EXEMPLO);

interface VarianteLab {
  id: number;
  nomeVariante: string;
  mime: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  canShareResult: string;
  shareData: ShareData | null;
}

function avaliarCanShare(data: ShareData | null): string {
  if (!data) return '— (aguardando preparo)';
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.canShare !== 'function'
  ) {
    return 'indisponível';
  }
  try {
    return navigator.canShare(data) ? 'sim' : 'não';
  } catch (e) {
    const nome = e instanceof Error ? e.name : 'Erro';
    return `não (${nome})`;
  }
}

// Laboratório de Compartilhamento (#compartilhar-lab) — 100% em memória, sem tocar no banco real
export function CompartilharLab() {
  const [fileXlsx, setFileXlsx] = useState<File | null>(null);
  const [preparandoXlsx, setPreparandoXlsx] = useState<boolean>(false);
  const [resultados, setResultados] = useState<Record<number, string>>({});
  const [relatorioFallback, setRelatorioFallback] = useState<string>('');
  const [msgRelatorio, setMsgRelatorio] = useState<string>('');

  // Cria os Files de CSV sincronamente uma única vez
  const [filesCsv] = useState(() => {
    const f1 = new File(
      [CSV_BLOB_COM_BOM],
      'mundo-utero_teste_v1.csv',
      { type: MIME_SHARE_CSV }
    );
    const f2 = new File(
      [CSV_BLOB_COM_BOM],
      'mundo-utero_teste_v2.csv',
      { type: 'text/csv;charset=utf-8' }
    );
    const f3 = new File(
      [CSV_BLOB_COM_BOM],
      'mundo-utero_teste_v3.txt',
      { type: MIME_SHARE_TXT }
    );
    const f6 = new File(
      [CSV_BLOB_COM_BOM],
      'mundo-utero_teste_v6.csv',
      { type: MIME_SHARE_CSV }
    );
    return { f1, f2, f3, f6 };
  });

  const prepararXlsxEmMemoria = async () => {
    setPreparandoXlsx(true);
    try {
      const blob = await gerarXlsx(LINHAS_EXEMPLO);
      const file = new File([blob], 'mundo-utero_teste_v4.xlsx', {
        type: MIME_SHARE_XLSX,
      });
      setFileXlsx(file);
    } catch {
      // Ignora falha na preparação
    } finally {
      setPreparandoXlsx(false);
    }
  };

  useEffect(() => {
    void prepararXlsxEmMemoria();
  }, []);

  const bytesTextoSemBom = new TextEncoder().encode(CSV_TEXTO_SEM_BOM).byteLength;

  const variantes: VarianteLab[] = [
    {
      id: 1,
      nomeVariante: '1. CSV estrito ("text/csv", .csv)',
      mime: MIME_SHARE_CSV,
      nomeArquivo: filesCsv.f1.name,
      tamanhoBytes: filesCsv.f1.size,
      canShareResult: avaliarCanShare({ files: [filesCsv.f1] }),
      shareData: { files: [filesCsv.f1] },
    },
    {
      id: 2,
      nomeVariante: '2. CSV com charset ("text/csv;charset=utf-8", .csv)',
      mime: 'text/csv;charset=utf-8',
      nomeArquivo: filesCsv.f2.name,
      tamanhoBytes: filesCsv.f2.size,
      canShareResult: avaliarCanShare({ files: [filesCsv.f2] }),
      shareData: { files: [filesCsv.f2] },
    },
    {
      id: 3,
      nomeVariante: '3. CSV como texto plano ("text/plain", .txt)',
      mime: MIME_SHARE_TXT,
      nomeArquivo: filesCsv.f3.name,
      tamanhoBytes: filesCsv.f3.size,
      canShareResult: avaliarCanShare({ files: [filesCsv.f3] }),
      shareData: { files: [filesCsv.f3] },
    },
    {
      id: 4,
      nomeVariante: '4. XLSX oficial (.xlsx)',
      mime: MIME_SHARE_XLSX,
      nomeArquivo: fileXlsx ? fileXlsx.name : 'mundo-utero_teste_v4.xlsx',
      tamanhoBytes: fileXlsx ? fileXlsx.size : 0,
      canShareResult: avaliarCanShare(fileXlsx ? { files: [fileXlsx] } : null),
      shareData: fileXlsx ? { files: [fileXlsx] } : null,
    },
    {
      id: 5,
      nomeVariante: '5. Somente texto ({ title, text } sem BOM)',
      mime: 'text/plain (payload text)',
      nomeArquivo: '— (sem File)',
      tamanhoBytes: bytesTextoSemBom,
      canShareResult: avaliarCanShare({
        title: 'mundo-utero_teste.csv',
        text: CSV_TEXTO_SEM_BOM,
      }),
      shareData: {
        title: 'mundo-utero_teste.csv',
        text: CSV_TEXTO_SEM_BOM,
      },
    },
    {
      id: 6,
      nomeVariante: '6. CSV "text/csv" + title + text juntos',
      mime: MIME_SHARE_CSV,
      nomeArquivo: filesCsv.f6.name,
      tamanhoBytes: filesCsv.f6.size,
      canShareResult: avaliarCanShare({
        files: [filesCsv.f6],
        title: filesCsv.f6.name,
        text: 'Exportação O Mundo a Partir do Útero',
      }),
      shareData: {
        files: [filesCsv.f6],
        title: filesCsv.f6.name,
        text: 'Exportação O Mundo a Partir do Útero',
      },
    },
  ];

  // Handler SÍNCRONO chamando navigator.share diretamente no clique
  const handleTestarVariante = (v: VarianteLab) => {
    if (!v.shareData) {
      setResultados((prev) => ({
        ...prev,
        [v.id]: 'ERRO: Arquivo ainda não preparado',
      }));
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function'
    ) {
      setResultados((prev) => ({
        ...prev,
        [v.id]: 'ERRO: NotSupportedError — navigator.share ausente',
      }));
      return;
    }

    try {
      const p = navigator.share(v.shareData);
      p.then(
        () => {
          setResultados((prev) => ({ ...prev, [v.id]: 'OK' }));
        },
        (e: unknown) => {
          const nome =
            e && typeof e === 'object' && 'name' in e
              ? String((e as { name: unknown }).name)
              : 'Error';
          const msg =
            e instanceof Error
              ? e.message
              : e && typeof e === 'object' && 'message' in e
              ? String((e as { message: unknown }).message)
              : String(e);

          if (nome === 'AbortError') {
            setResultados((prev) => ({
              ...prev,
              [v.id]: 'cancelado (AbortError)',
            }));
          } else {
            setResultados((prev) => ({
              ...prev,
              [v.id]: `ERRO: ${nome} — ${msg}`,
            }));
          }
        }
      );
    } catch (e: unknown) {
      const nome =
        e && typeof e === 'object' && 'name' in e
          ? String((e as { name: unknown }).name)
          : 'Error';
      const msg = e instanceof Error ? e.message : String(e);
      setResultados((prev) => ({
        ...prev,
        [v.id]: `ERRO SÍNCRONO: ${nome} — ${msg}`,
      }));
    }
  };

  const montarTextoRelatorio = (): string => {
    const ua =
      typeof navigator !== 'undefined' ? navigator.userAgent : 'indisponível';
    const temShare =
      typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const temCanShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function';
    const modo = getDisplayMode();

    const linhasRel = [
      '=== Relatório #compartilhar-lab ===',
      `Data/Hora: ${new Date().toISOString()}`,
      `User-Agent: ${ua}`,
      `navigator.share: ${temShare ? 'presente' : 'ausente'}`,
      `navigator.canShare: ${temCanShare ? 'presente' : 'ausente'}`,
      `display-mode: ${modo}`,
      '',
      '--- Variantes ---',
      ...variantes.map(
        (v) =>
          `[${v.nomeVariante}] MIME="${v.mime}" | arq="${v.nomeArquivo}" (${
            v.tamanhoBytes
          } B) | canShare=${v.canShareResult} | resultado=${
            resultados[v.id] ?? 'não testado'
          }`
      ),
    ];
    return linhasRel.join('\n');
  };

  const handleCopiarRelatorio = async () => {
    const texto = montarTextoRelatorio();
    const ok = await copiarComoTexto(texto);
    if (ok) {
      setMsgRelatorio('Relatório copiado para a área de transferência.');
      setRelatorioFallback('');
    } else {
      setMsgRelatorio(
        'Não foi possível copiar automaticamente. Selecione o relatório abaixo:'
      );
      setRelatorioFallback(texto);
    }
  };

  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent : 'indisponível';
  const temShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const temCanShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function';
  const modo = getDisplayMode();

  return (
    <main class="demo-gallery">
      <header class="demo-header">
        <div>
          <h1 class="diag-title">Laboratório de Compartilhamento — Etapa 8.1</h1>
          <p class="diag-subtitle">
            Diagnóstico Web Share API no Android (#compartilhar-lab)
          </p>
        </div>
        <div class="demo-row">
          <a href="#" class="demo-back-link">
            ← App Principal
          </a>
          <a href="#diagnostico" class="demo-back-link">
            #diagnostico
          </a>
          <a href="#armazenamento-lab" class="demo-back-link">
            #armazenamento-lab
          </a>
        </div>
      </header>

      <div class="sessao-lab-banner" role="note">
        <strong>AVISO FIXO:</strong> Laboratório de testes. Não usa os dados
        reais.
      </div>

      {/* 1. Informações do ambiente */}
      <section class="demo-section">
        <h2 class="demo-section__title">1. Informações do Ambiente</h2>
        <div class="lab-status-grid">
          <div class="lab-stat-card">
            <span class="diag-detail">navigator.share</span>
            <strong
              class={`lab-stat-val ${
                temShare ? 'lab-text-ok' : 'lab-text-fail'
              }`}
            >
              {temShare ? 'Presente' : 'Ausente'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">navigator.canShare</span>
            <strong
              class={`lab-stat-val ${
                temCanShare ? 'lab-text-ok' : 'lab-text-fail'
              }`}
            >
              {temCanShare ? 'Presente' : 'Ausente'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">Modo de exibição</span>
            <strong class="lab-stat-val">{modo}</strong>
          </div>
          <div class="lab-stat-card lab-stat-card--wide">
            <span class="diag-detail">navigator.userAgent</span>
            <span style={{ fontSize: '0.88rem', wordBreak: 'break-all' }}>
              {ua}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Tabela de variantes */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">2. Tabela de Variantes</h2>
          <Button
            variant="ghost"
            disabled={preparandoXlsx}
            onClick={prepararXlsxEmMemoria}
          >
            {preparandoXlsx
              ? 'Preparando XLSX...'
              : fileXlsx
              ? 'Recriar XLSX em memória'
              : 'Preparar XLSX'}
          </Button>
        </div>

        <div class="sessao-table-wrap">
          <table class="sessao-table">
            <thead>
              <tr>
                <th>Variante</th>
                <th>Tipo MIME</th>
                <th>Nome do Arquivo</th>
                <th>Bytes</th>
                <th>canShare</th>
                <th>Ação (Síncrona)</th>
                <th>Último Resultado</th>
              </tr>
            </thead>
            <tbody>
              {variantes.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.nomeVariante}</strong>
                  </td>
                  <td>
                    <code>{v.mime}</code>
                  </td>
                  <td>{v.nomeArquivo}</td>
                  <td>{v.tamanhoBytes}</td>
                  <td>
                    <strong>{v.canShareResult}</strong>
                  </td>
                  <td>
                    <Button
                      variant="primary"
                      disabled={!v.shareData}
                      onClick={() => handleTestarVariante(v)}
                    >
                      Compartilhar
                    </Button>
                  </td>
                  <td>
                    <strong>{resultados[v.id] ?? '—'}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Copiar relatório */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">3. Relatório para Diagnóstico</h2>
          <Button variant="secondary" onClick={handleCopiarRelatorio}>
            Copiar relatório
          </Button>
        </div>
        {msgRelatorio && <p class="diag-detail">{msgRelatorio}</p>}
        {relatorioFallback && (
          <textarea
            class="ui-operator-textarea"
            readOnly
            rows={10}
            value={relatorioFallback}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </section>
    </main>
  );
}
