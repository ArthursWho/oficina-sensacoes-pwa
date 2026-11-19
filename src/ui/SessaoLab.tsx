import { useEffect, useState } from 'preact/hooks';
import { TOTAL_PARES } from '../session/config';
import {
  botoes,
  faixaAtual,
  progresso,
  revelarMusica,
  sessaoAtiva,
  sessaoNaoSalva,
  textoPergunta2,
} from '../session/seletores';
import { ItemLogEfeito, sessionStore } from '../session/store';
import { Efeito, Estado, Evento, Resposta } from '../session/tipos';
import { formatarDataHora, validarSessao } from '../session/utilidades';
import { Button } from './components/Button';

function formatarEfeitoCurto(efeito: Efeito): string {
  switch (efeito.tipo) {
    case 'tocarFaixa':
      return `tocarFaixa(par=${efeito.par}, versao="${efeito.versao}", epoca=${efeito.epoca})`;
    case 'agendarTransicao':
      return `agendarTransicao(ms=${efeito.ms})`;
    case 'persistirSessao':
      return `persistirSessao(id="${efeito.sessao.id_participante}", linhas=${efeito.sessao.linhas.length})`;
    default:
      return efeito.tipo;
  }
}

// Laboratório da Máquina de Estados da Sessão (#sessao-lab) — 100% puro, sem áudio
export function SessaoLab() {
  const [estado, setEstado] = useState<Estado>(() => sessionStore.getEstado());
  const [logEfeitos, setLogEfeitos] = useState<readonly ItemLogEfeito[]>(() =>
    sessionStore.getLogEfeitos()
  );
  const [ultimoEventoStr, setUltimoEventoStr] = useState<string>('—');
  const [ultimoIgnorado, setUltimoIgnorado] = useState<boolean>(false);
  const [contadorParticipante, setContadorParticipante] = useState<number>(1);

  useEffect(() => {
    const desassinar = sessionStore.assinar((novoEstado, resultado, evento) => {
      setEstado(novoEstado);
      setLogEfeitos(sessionStore.getLogEfeitos());
      setUltimoEventoStr(evento.tipo);
      setUltimoIgnorado(resultado.ignorado);
    });
    return desassinar;
  }, []);

  const disparar = (evento: Evento) => {
    sessionStore.dispatch(evento);
  };

  // Extrai época atual da sessão se existir
  const epocaAtual =
    estado.fase === 'boas_vindas' ||
    estado.fase === 'ciclo' ||
    estado.fase === 'encerramento'
      ? estado.sessao.epoca
      : 0;

  // Simula o término do áudio que está tocando no momento com a época correta
  const handleSimularFimAudioAtual = () => {
    if (estado.fase === 'ciclo' && estado.etapa.tipo === 'editado_tocando') {
      disparar({ tipo: 'AUDIO_EDITADO_FIM', epoca: estado.sessao.epoca });
      return;
    }
    if (estado.fase === 'ciclo' && estado.etapa.tipo === 'original_tocando') {
      disparar({ tipo: 'AUDIO_ORIGINAL_FIM', epoca: estado.sessao.epoca });
      return;
    }
    // Se não estiver tocando, dispara AUDIO_EDITADO_FIM para demonstrar que é ignorado
    disparar({ tipo: 'AUDIO_EDITADO_FIM', epoca: epocaAtual });
  };

  // Simula evento de áudio com época antiga (deve ser ignorado)
  const handleSimularAudioEpocaAntiga = () => {
    const epocaErrada = Math.max(0, epocaAtual - 1);
    if (estado.fase === 'ciclo' && estado.etapa.tipo === 'original_tocando') {
      disparar({ tipo: 'AUDIO_ORIGINAL_FIM', epoca: epocaErrada });
    } else {
      disparar({ tipo: 'AUDIO_EDITADO_FIM', epoca: epocaErrada });
    }
  };

  // Simula uma sessão completa dos 6 pares com respostas variadas e repetições
  const handleSimularSessaoCompleta = () => {
    sessionStore.dispatch({ tipo: 'REINICIAR', forcar: true });
    sessionStore.limparLogEfeitos();

    const num = contadorParticipante;
    setContadorParticipante((n) => n + 1);

    sessionStore.dispatch({
      tipo: 'ACEITAR',
      proximoNumero: num,
      autorizaImagem: 'autoriza',
    });
    sessionStore.dispatch({ tipo: 'INICIAR' });

    const respostasPadrao: Array<{
      p1: Resposta;
      p2: Resposta;
      repEd: number;
      repOr: number;
    }> = [
      { p1: 'Sim', p2: 'Sim', repEd: 1, repOr: 0 },
      { p1: 'Não', p2: 'Sim', repEd: 0, repOr: 1 },
      { p1: 'Sim', p2: 'Não', repEd: 0, repOr: 0 },
      { p1: 'Sim', p2: 'Sim', repEd: 2, repOr: 1 },
      { p1: 'Não', p2: 'Não', repEd: 0, repOr: 0 },
      { p1: 'Sim', p2: 'Sim', repEd: 0, repOr: 0 },
    ];

    for (let par = 1; par <= TOTAL_PARES; par++) {
      const cfgPar = respostasPadrao[par - 1];
      let st = sessionStore.getEstado();
      const ep1 = st.fase === 'ciclo' ? st.sessao.epoca : 1;
      sessionStore.dispatch({ tipo: 'AUDIO_EDITADO_FIM', epoca: ep1 });

      for (let r = 0; r < cfgPar.repEd; r++) {
        sessionStore.dispatch({ tipo: 'OUVIR_NOVAMENTE' });
        st = sessionStore.getEstado();
        const epRep = st.fase === 'ciclo' ? st.sessao.epoca : 1;
        sessionStore.dispatch({ tipo: 'AUDIO_EDITADO_FIM', epoca: epRep });
      }

      sessionStore.dispatch({ tipo: 'RESPONDER_P1', resposta: cfgPar.p1 });
      st = sessionStore.getEstado();
      const ep2 = st.fase === 'ciclo' ? st.sessao.epoca : 1;
      sessionStore.dispatch({ tipo: 'AUDIO_ORIGINAL_FIM', epoca: ep2 });

      for (let r = 0; r < cfgPar.repOr; r++) {
        sessionStore.dispatch({ tipo: 'OUVIR_NOVAMENTE' });
        st = sessionStore.getEstado();
        const epRepOr = st.fase === 'ciclo' ? st.sessao.epoca : 1;
        sessionStore.dispatch({ tipo: 'AUDIO_ORIGINAL_FIM', epoca: epRepOr });
      }

      sessionStore.dispatch({
        tipo: 'RESPONDER_P2',
        resposta: cfgPar.p2,
        agora: formatarDataHora(new Date()),
      });

      if (par < TOTAL_PARES) {
        sessionStore.dispatch({ tipo: 'TRANSICAO_FIM' });
      }
    }
  };

  const stBotoes = botoes(estado);
  const track = faixaAtual(estado);
  const prog = progresso(estado);
  const revelar = revelarMusica(estado);
  const perg2 = textoPergunta2(estado);

  const sessaoFinal =
    estado.fase === 'encerramento' ? estado.concluida : null;
  const validacaoFinal = sessaoFinal ? validarSessao(sessaoFinal) : null;

  return (
    <main class="demo-gallery">
      <header class="demo-header">
        <div>
          <h1 class="diag-title">Laboratório da Sessão — Etapa 4</h1>
          <p class="diag-subtitle">
            Máquina de Estados Pura (#sessao-lab)
          </p>
        </div>
        <div class="demo-row">
          <a href="#diagnostico" class="demo-back-link">
            ← Diagnóstico (#diagnostico)
          </a>
          <a href="#componentes" class="demo-back-link">
            #componentes
          </a>
          <a href="#audio-lab" class="demo-back-link">
            #audio-lab
          </a>
        </div>
      </header>

      {/* Aviso fixo de que este laboratório não toca áudio */}
      <div class="sessao-lab-banner" role="note">
        <strong>AVISO FIXO:</strong> Este laboratório testa exclusivamente a
        função redutora pura (<code>src/session/</code>) e <strong>não toca áudio</strong>.
        Os efeitos emitidos são apenas exibidos no log abaixo.
      </div>

      {/* 1. Estado atual formatado */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">1. Estado Atual da Máquina</h2>
          {ultimoIgnorado ? (
            <span class="diag-status status-fail">
              IGNORADO (último evento: {ultimoEventoStr})
            </span>
          ) : (
            <span class="diag-status status-ok">
              TRANSIÇÃO OK (último evento: {ultimoEventoStr})
            </span>
          )}
        </div>

        <div class="lab-status-grid">
          <div class="lab-stat-card">
            <span class="diag-detail">fase</span>
            <strong class="lab-stat-val">{estado.fase}</strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">par / progresso</span>
            <strong class="lab-stat-val">
              {estado.fase === 'ciclo' ? `${estado.par} (${prog})` : '—'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">etapa do par</span>
            <strong class="lab-stat-val">
              {estado.fase === 'ciclo' ? estado.etapa.tipo : '—'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">época (epoca)</span>
            <strong class="lab-stat-val">
              {estado.fase === 'boas_vindas' ||
              estado.fase === 'ciclo' ||
              estado.fase === 'encerramento'
                ? estado.sessao.epoca
                : '—'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">repetições (editado / original)</span>
            <strong class="lab-stat-val">
              {estado.fase === 'ciclo' && estado.etapa.tipo !== 'transicao'
                ? `${estado.etapa.repeticoesEditado} / ${estado.etapa.repeticoesOriginal}`
                : '—'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">batimentosAudiveis</span>
            <strong class="lab-stat-val">
              {estado.fase === 'boas_vindas' ||
              estado.fase === 'ciclo' ||
              estado.fase === 'encerramento'
                ? String(estado.sessao.batimentosAudiveis)
                : '—'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">persistencia</span>
            <strong class="lab-stat-val">
              {estado.fase === 'encerramento' ? estado.persistencia : '—'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">seletores ativos</span>
            <span class="diag-detail">
              ativa: <strong>{String(sessaoAtiva(estado))}</strong> | naoSalva:{' '}
              <strong>{String(sessaoNaoSalva(estado))}</strong> | revelar:{' '}
              <strong>{String(revelar)}</strong>
            </span>
          </div>
        </div>

        {track && (
          <div class="lab-live-timer">
            <div>
              Faixa do par atual:{' '}
              <strong>
                {revelar ? track.rotulo : '[Oculta até original_tocando]'}
              </strong>
            </div>
            {perg2 && (
              <div>
                Pergunta 2 selecionada: <strong>{perg2}</strong>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Botões de eventos relevantes + Simulação de áudio */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          2. Disparar Eventos (Habilitados por <code>botoes(estado)</code> e fase)
        </h2>

        <h3 class="demo-subsection__title">TCLE e Boas-vindas</h3>
        <div class="demo-grid">
          <Button
            variant="primary"
            disabled={estado.fase !== 'tcle'}
            onClick={() => {
              const num = contadorParticipante;
              setContadorParticipante((n) => n + 1);
              disparar({
                tipo: 'ACEITAR',
                proximoNumero: num,
                autorizaImagem: 'autoriza',
              });
            }}
          >
            ACEITAR (#{contadorParticipante})
          </Button>
          <Button
            variant="ghost"
            disabled={estado.fase !== 'tcle'}
            onClick={() => disparar({ tipo: 'RECUSAR' })}
          >
            RECUSAR
          </Button>
          <Button
            variant="primary"
            disabled={!stBotoes.play}
            onClick={() => disparar({ tipo: 'INICIAR' })}
          >
            INICIAR (Play)
          </Button>
        </div>

        <h3 class="demo-subsection__title">Eventos de Áudio e Transição do Ciclo</h3>
        <div class="demo-grid">
          <Button
            variant="secondary"
            disabled={
              !(
                estado.fase === 'ciclo' &&
                (estado.etapa.tipo === 'editado_tocando' ||
                  estado.etapa.tipo === 'original_tocando') &&
                !estado.etapa.interrompido
              )
            }
            onClick={handleSimularFimAudioAtual}
          >
            Simular fim do áudio atual (época {epocaAtual})
          </Button>
          <Button
            variant="secondary"
            disabled={
              !(
                estado.fase === 'ciclo' &&
                (estado.etapa.tipo === 'editado_tocando' ||
                  estado.etapa.tipo === 'original_tocando') &&
                !estado.etapa.interrompido
              )
            }
            onClick={() =>
              disparar({ tipo: 'AUDIO_INTERROMPIDO', epoca: epocaAtual })
            }
          >
            AUDIO_INTERROMPIDO
          </Button>
          <Button
            variant="primary"
            disabled={!stBotoes.retomar}
            onClick={() => disparar({ tipo: 'RETOMAR' })}
          >
            RETOMAR
          </Button>
          <Button
            variant="secondary"
            disabled={
              !(estado.fase === 'ciclo' && estado.etapa.tipo === 'transicao')
            }
            onClick={() => disparar({ tipo: 'TRANSICAO_FIM' })}
          >
            TRANSICAO_FIM
          </Button>
        </div>

        <h3 class="demo-subsection__title">Respostas do Participante e Repetição</h3>
        <div class="demo-grid">
          <Button
            variant="secondary"
            disabled={!stBotoes.ouvirNovamente}
            onClick={() => disparar({ tipo: 'OUVIR_NOVAMENTE' })}
          >
            OUVIR_NOVAMENTE
          </Button>
          <Button
            variant="primary"
            disabled={!stBotoes.respostaP1}
            onClick={() => disparar({ tipo: 'RESPONDER_P1', resposta: 'Sim' })}
          >
            RESPONDER_P1 ("Sim")
          </Button>
          <Button
            variant="primary"
            disabled={!stBotoes.respostaP1}
            onClick={() => disparar({ tipo: 'RESPONDER_P1', resposta: 'Não' })}
          >
            RESPONDER_P1 ("Não")
          </Button>
          <Button
            variant="primary"
            disabled={!stBotoes.respostaP2}
            onClick={() =>
              disparar({
                tipo: 'RESPONDER_P2',
                resposta: 'Sim',
                agora: formatarDataHora(new Date()),
              })
            }
          >
            RESPONDER_P2 ("Sim")
          </Button>
          <Button
            variant="primary"
            disabled={!stBotoes.respostaP2}
            onClick={() =>
              disparar({
                tipo: 'RESPONDER_P2',
                resposta: 'Não',
                agora: formatarDataHora(new Date()),
              })
            }
          >
            RESPONDER_P2 ("Não")
          </Button>
        </div>

        <h3 class="demo-subsection__title">Persistência, Cancelamento e Reinício</h3>
        <div class="demo-grid">
          <Button
            variant="primary"
            disabled={estado.fase !== 'encerramento'}
            onClick={() => disparar({ tipo: 'PERSISTENCIA_OK' })}
          >
            Simular persistência OK
          </Button>
          <Button
            variant="danger"
            disabled={estado.fase !== 'encerramento'}
            onClick={() => disparar({ tipo: 'PERSISTENCIA_FALHA' })}
          >
            Simular persistência com falha
          </Button>
          <Button
            variant="secondary"
            disabled={
              !(
                estado.fase === 'encerramento' &&
                estado.persistencia === 'falha'
              )
            }
            onClick={() => disparar({ tipo: 'TENTAR_PERSISTIR_NOVAMENTE' })}
          >
            TENTAR_PERSISTIR_NOVAMENTE
          </Button>
          <Button
            variant="danger"
            disabled={!sessaoAtiva(estado)}
            onClick={() => disparar({ tipo: 'CANCELAR' })}
          >
            CANCELAR sessão
          </Button>
          <Button
            variant="secondary"
            onClick={() => disparar({ tipo: 'REINICIAR' })}
          >
            REINICIAR (normal)
          </Button>
          <Button
            variant="ghost"
            onClick={() => disparar({ tipo: 'REINICIAR', forcar: true })}
          >
            REINICIAR (forcar: true)
          </Button>
        </div>
      </section>

      {/* Painel "Forçar evento inválido" */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          3. Painel "Forçar Evento Inválido / Fora de Hora" (Testar <code>ignorado: true</code>)
        </h2>
        <p class="diag-detail">
          Estes botões estão sempre habilitados para você comprovar que eventos fora
          de hora ou com época antiga são ignorados sem alterar o estado.
        </p>
        <div class="demo-grid">
          <Button
            variant="ghost"
            onClick={handleSimularAudioEpocaAntiga}
          >
            Simular áudio de época antiga (época {Math.max(0, epocaAtual - 1)})
          </Button>
          <Button
            variant="ghost"
            onClick={() => disparar({ tipo: 'RESPONDER_P1', resposta: 'Sim' })}
          >
            Forçar RESPONDER_P1 fora de hora
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              disparar({
                tipo: 'RESPONDER_P2',
                resposta: 'Sim',
                agora: formatarDataHora(new Date()),
              })
            }
          >
            Forçar RESPONDER_P2 fora de hora
          </Button>
          <Button
            variant="ghost"
            onClick={() => disparar({ tipo: 'OUVIR_NOVAMENTE' })}
          >
            Forçar OUVIR_NOVAMENTE fora de hora
          </Button>
          <Button
            variant="ghost"
            onClick={() => disparar({ tipo: 'TRANSICAO_FIM' })}
          >
            Forçar TRANSICAO_FIM fora de hora
          </Button>
        </div>
      </section>

      {/* Simular sessão completa e Tabela de 6 linhas / 9 colunas */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">
            4. Simulação Completa & Tabela Final (9 Colunas)
          </h2>
          <Button variant="primary" onClick={handleSimularSessaoCompleta}>
            Simular sessão completa (6 pares)
          </Button>
        </div>

        {sessaoFinal && validacaoFinal && (
          <div class="demo-stack">
            <div
              class={`diag-status ${
                validacaoFinal.ok ? 'status-ok' : 'status-fail'
              }`}
            >
              validarSessao({sessaoFinal.id_participante}):{' '}
              {validacaoFinal.ok
                ? 'OK (6 linhas válidas, 9 colunas exatas)'
                : `FALHA (${validacaoFinal.erros.join('; ')})`}
            </div>

            <div class="sessao-table-wrap">
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
                  {sessaoFinal.linhas.map((l) => (
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
          </div>
        )}
      </section>

      {/* Log dos efeitos emitidos */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">
            5. Log de Efeitos Emitidos ({logEfeitos.length})
          </h2>
          <Button
            variant="ghost"
            onClick={() => {
              sessionStore.limparLogEfeitos();
              setLogEfeitos([]);
            }}
          >
            Limpar log de efeitos
          </Button>
        </div>
        <pre class="lab-log-area">
          {logEfeitos.length === 0
            ? 'Nenhum efeito emitido ainda.'
            : logEfeitos
                .map(
                  (item) =>
                    `#${String(item.ordem).padStart(2, '0')} [evento=${
                      item.eventoTipo
                    } | época=${item.epocaSessao ?? '—'}] -> ${formatarEfeitoCurto(
                      item.efeito
                    )}`
                )
                .join('\n')}
        </pre>
      </section>
    </main>
  );
}
