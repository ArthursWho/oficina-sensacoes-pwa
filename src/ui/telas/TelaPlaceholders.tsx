import { sessionStore } from '../../session/store';
import { Estado } from '../../session/tipos';
import { Button } from '../components/Button';

// Placeholder provisório evoluído para a Tela 4 (Encerramento — persistência real vem na Etapa 7)
export function TelaEncerramentoPlaceholder({ estado }: { estado: Estado }) {
  const concluida = estado.fase === 'encerramento' ? estado.concluida : null;
  const persistencia =
    estado.fase === 'encerramento' ? estado.persistencia : '—';

  return (
    <main class="tela-fluxo tela-placeholder">
      <div class="diag-container" style={{ maxWidth: '880px' }}>
        <h1 class="diag-title">Encerramento (Placeholder — Etapa 6)</h1>
        <p class="diag-subtitle">
          Status de persistência: <strong>{persistencia}</strong>
        </p>

        <div class="sessao-lab-banner" role="note" style={{ marginBottom: '1.25rem' }}>
          <strong>AVISO:</strong> Dados ainda NÃO são gravados (Etapa 7)
        </div>

        {concluida && (
          <div
            class="sessao-table-wrap"
            style={{ marginBottom: '1.5rem', maxHeight: '320px', overflowY: 'auto' }}
          >
            <table class="sessao-table">
              <thead>
                <tr>
                  <th>id_participante</th>
                  <th>data_hora</th>
                  <th>ordem_musica</th>
                  <th>musica</th>
                  <th>reconheceu</th>
                  <th>tipo_pergunta_2</th>
                  <th>resposta_pergunta_2</th>
                  <th>repeticoes_editado</th>
                  <th>repeticoes_original</th>
                </tr>
              </thead>
              <tbody>
                {concluida.linhas.map((l) => (
                  <tr key={l.ordem_musica}>
                    <td>{l.id_participante}</td>
                    <td>{l.data_hora}</td>
                    <td>{l.ordem_musica}</td>
                    <td>{l.musica}</td>
                    <td>{l.reconheceu}</td>
                    <td>{l.tipo_pergunta_2}</td>
                    <td>{l.resposta_pergunta_2}</td>
                    <td>{l.repeticoes_editado}</td>
                    <td>{l.repeticoes_original}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Button
          variant="secondary"
          onClick={() =>
            sessionStore.dispatch({ tipo: 'REINICIAR', forcar: true })
          }
        >
          Reiniciar (provisório)
        </Button>
      </div>
    </main>
  );
}
