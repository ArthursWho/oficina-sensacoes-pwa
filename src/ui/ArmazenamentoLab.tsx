import { deleteDB } from 'idb';
import { useEffect, useState } from 'preact/hooks';
import { TRACKS } from '../content/tracks';
import { TOTAL_PARES } from '../session/config';
import { LinhaSessao, Resposta, SessaoConcluida } from '../session/tipos';
import {
  formatarDataHora,
  formatarIdParticipante,
} from '../session/utilidades';
import {
  estadoArmazenamento,
  EstadoArmazenamentoDispositivo,
} from '../storage/persistente';
import { criarRepositorio, repositorio } from '../storage/repositorio';
import { Button } from './components/Button';

const NOME_DB_TESTE = 'mundo-utero-teste';
const repoTeste = criarRepositorio(NOME_DB_TESTE);

function gerarSessaoAleatoriaValida(numeroParticipante: number): SessaoConcluida {
  const id = formatarIdParticipante(numeroParticipante);
  const agora = formatarDataHora(new Date());
  const linhas: LinhaSessao[] = [];

  for (let i = 0; i < TOTAL_PARES; i++) {
    const reconheceu: Resposta = Math.random() < 0.5 ? 'Sim' : 'Não';
    const respostaP2: Resposta = Math.random() < 0.5 ? 'Sim' : 'Não';
    linhas.push({
      id_participante: id,
      data_hora: agora,
      ordem_musica: i + 1,
      musica: TRACKS[i].rotulo,
      reconheceu,
      tipo_pergunta_2: reconheceu === 'Sim' ? 'Acertou' : 'Surpreendeu',
      resposta_pergunta_2: respostaP2,
      repeticoes_editado: Math.floor(Math.random() * 3),
      repeticoes_original: Math.floor(Math.random() * 2),
    });
  }

  return {
    id_participante: id,
    linhas,
  };
}

// Laboratório de Armazenamento IndexedDB (#armazenamento-lab)
export function ArmazenamentoLab() {
  const [infoStorage, setInfoStorage] =
    useState<EstadoArmazenamentoDispositivo | null>(null);
  const [saudeReal, setSaudeReal] = useState<{
    saudavel: boolean;
    motivo?: string;
  } | null>(null);

  // Dados reais (somente leitura)
  const [contagemReal, setContagemReal] = useState<number>(0);
  const [proximoNumReal, setProximoNumReal] = useState<number>(1);
  const [sessoesReais, setSessoesReais] = useState<SessaoConcluida[]>([]);
  const [idRealExpandido, setIdRealExpandido] = useState<string | null>(null);

  // Banco de teste ("mundo-utero-teste")
  const [sessoesTeste, setSessoesTeste] = useState<SessaoConcluida[]>([]);
  const [idTesteExpandido, setIdTesteExpandido] = useState<string | null>(null);
  const [msgTeste, setMsgTeste] = useState<string>(
    'Pronto para testar em "mundo-utero-teste".'
  );
  const [operandoTeste, setOperandoTeste] = useState<boolean>(false);

  const carregarDadosReais = async () => {
    const [est, saude, count, prox, lista] = await Promise.all([
      estadoArmazenamento(),
      repositorio.verificarSaude(),
      repositorio.contarSessoes().catch(() => 0),
      repositorio.proximoNumeroParticipante().catch(() => 1),
      repositorio.listarSessoes().catch(() => []),
    ]);

    setInfoStorage(est);
    setSaudeReal(saude);
    setContagemReal(count);
    setProximoNumReal(prox);
    setSessoesReais(lista);
  };

  const handleListarTeste = async () => {
    setOperandoTeste(true);
    try {
      const lista = await repoTeste.listarSessoes();
      setSessoesTeste(lista);
      setMsgTeste(
        `Banco de teste listado: ${lista.length} sessão(ões) encontrada(s).`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgTeste(`Erro ao listar banco de teste: ${msg}`);
    } finally {
      setOperandoTeste(false);
    }
  };

  const handleGravarSessaoTeste = async () => {
    setOperandoTeste(true);
    try {
      const prox = await repoTeste.proximoNumeroParticipante();
      const sessao = gerarSessaoAleatoriaValida(prox);
      await repoTeste.salvarSessao(sessao);
      const lista = await repoTeste.listarSessoes();
      setSessoesTeste(lista);
      setIdTesteExpandido(sessao.id_participante);
      setMsgTeste(
        `Sessão "${sessao.id_participante}" gravada e verificada com sucesso em "${NOME_DB_TESTE}".`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgTeste(`Erro ao gravar no banco de teste: ${msg}`);
    } finally {
      setOperandoTeste(false);
    }
  };

  const handleApagarBancoTeste = async () => {
    setOperandoTeste(true);
    try {
      await deleteDB(NOME_DB_TESTE);
      setSessoesTeste([]);
      setIdTesteExpandido(null);
      setMsgTeste(`Banco de teste "${NOME_DB_TESTE}" apagado com sucesso.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgTeste(`Erro ao apagar banco de teste: ${msg}`);
    } finally {
      setOperandoTeste(false);
    }
  };

  useEffect(() => {
    void carregarDadosReais();
    void handleListarTeste();
  }, []);

  const renderTabelaSessao = (s: SessaoConcluida) => (
    <div class="sessao-table-wrap" style={{ marginTop: '0.75rem' }}>
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
          {s.linhas.map((l) => (
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
  );

  return (
    <main class="demo-gallery">
      <header class="demo-header">
        <div>
          <h1 class="diag-title">Laboratório de Armazenamento — Etapa 7</h1>
          <p class="diag-subtitle">
            Persistência Local em IndexedDB (#armazenamento-lab)
          </p>
        </div>
        <div class="demo-row">
          <a href="#" class="demo-back-link">
            ← App Principal
          </a>
          <a href="#diagnostico" class="demo-back-link">
            #diagnostico
          </a>
          <a href="#audio-lab" class="demo-back-link">
            #audio-lab
          </a>
          <a href="#sessao-lab" class="demo-back-link">
            #sessao-lab
          </a>
        </div>
      </header>

      {/* 1. Estado do armazenamento e saúde do banco */}
      <section class="demo-section">
        <div class="demo-row" style={{ justifyContent: 'space-between' }}>
          <h2 class="demo-section__title">1. Estado do Armazenamento</h2>
          <Button variant="ghost" onClick={carregarDadosReais}>
            Atualizar leitura
          </Button>
        </div>

        <div class="lab-status-grid">
          <div class="lab-stat-card">
            <span class="diag-detail">Armazenamento persistente?</span>
            <strong class="lab-stat-val">
              {!infoStorage
                ? '...'
                : !infoStorage.suportado
                ? 'Sem suporte'
                : infoStorage.persistido
                ? 'SIM (Concedido)'
                : 'NÃO (Padrão)'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">Uso / Quota estimada</span>
            <strong class="lab-stat-val">
              {infoStorage?.usoMB !== undefined &&
              infoStorage?.quotaMB !== undefined
                ? `${infoStorage.usoMB} MB / ${infoStorage.quotaMB} MB`
                : 'Não informado'}
            </strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">Saúde do banco ("mundo-utero")</span>
            <strong
              class={`lab-stat-val ${
                saudeReal?.saudavel ? 'lab-text-ok' : 'lab-text-fail'
              }`}
            >
              {!saudeReal
                ? '...'
                : saudeReal.saudavel
                ? 'SAUDÁVEL (OK)'
                : `FALHA (${saudeReal.motivo})`}
            </strong>
          </div>
        </div>
      </section>

      {/* 2. Dados REAIS (somente leitura) */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          2. Dados REAIS ("mundo-utero" — Somente Leitura)
        </h2>
        <div class="lab-status-grid">
          <div class="lab-stat-card">
            <span class="diag-detail">Sessões concluídas gravadas</span>
            <strong class="lab-stat-val">{contagemReal}</strong>
          </div>
          <div class="lab-stat-card">
            <span class="diag-detail">Próximo número de participante</span>
            <strong class="lab-stat-val">
              {proximoNumReal} ({formatarIdParticipante(proximoNumReal)})
            </strong>
          </div>
        </div>

        {sessoesReais.length === 0 ? (
          <p class="diag-detail">
            Nenhuma sessão concluída gravada no banco real ainda.
          </p>
        ) : (
          <ul class="lab-preload-list">
            {sessoesReais.map((s) => {
              const expandido = idRealExpandido === s.id_participante;
              return (
                <li
                  key={s.id_participante}
                  class="lab-preload-item"
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div
                    class="demo-row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <strong>{s.id_participante}</strong>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setIdRealExpandido(
                          expandido ? null : s.id_participante
                        )
                      }
                    >
                      {expandido ? 'Ocultar 6 linhas' : 'Ver 6 linhas × 9 colunas'}
                    </Button>
                  </div>
                  {expandido && renderTabelaSessao(s)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Banco de TESTE ("mundo-utero-teste") */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          3. Banco de TESTE ("{NOME_DB_TESTE}")
        </h2>
        <div class="aviso-destaque-box" role="note">
          <strong>AVISO FIXO:</strong> O banco de teste (
          <code>{NOME_DB_TESTE}</code>) é totalmente separado e{' '}
          <strong>não afeta os dados reais</strong> da oficina.
        </div>

        <div class="demo-grid">
          <Button
            variant="primary"
            disabled={operandoTeste}
            onClick={handleGravarSessaoTeste}
          >
            Gravar sessão de teste
          </Button>
          <Button
            variant="secondary"
            disabled={operandoTeste}
            onClick={handleListarTeste}
          >
            Listar ({sessoesTeste.length})
          </Button>
          <Button
            variant="danger"
            disabled={operandoTeste}
            onClick={handleApagarBancoTeste}
          >
            Apagar banco de teste
          </Button>
        </div>

        <p class="diag-detail">Status: {msgTeste}</p>

        {sessoesTeste.length > 0 && (
          <ul class="lab-preload-list">
            {sessoesTeste.map((s) => {
              const expandido = idTesteExpandido === s.id_participante;
              return (
                <li
                  key={s.id_participante}
                  class="lab-preload-item"
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div
                    class="demo-row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <strong>{s.id_participante} (teste)</strong>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setIdTesteExpandido(
                          expandido ? null : s.id_participante
                        )
                      }
                    >
                      {expandido ? 'Ocultar tabela' : 'Ver 6 linhas × 9 colunas'}
                    </Button>
                  </div>
                  {expandido && renderTabelaSessao(s)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
