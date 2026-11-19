import { useState } from 'preact/hooks';
import { STRINGS } from '../content/strings';
import { listarPendencias, temPendencias } from '../content/tcle';
import { TRACKS } from '../content/tracks';
import { Button } from './components/Button';
import { Checkbox } from './components/Checkbox';
import { IconeEngrenagem } from './components/IconeEngrenagem';
import { Modal } from './components/Modal';
import { ProgressoPar } from './components/ProgressoPar';
import { RadioGroup } from './components/RadioGroup';
import { TcleViewer } from './components/TcleViewer';
import { TextField } from './components/TextField';

// Ícone SVG de Play para o botão "Iniciar"
function IconePlay() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

// Galeria de demonstração dos componentes da Etapa 2 (#componentes)
export function GaleriaComponentes() {
  const [aceitouTermo, setAceitouTermo] = useState<boolean>(false);
  const [autorizacaoImagem, setAutorizacaoImagem] = useState<'sim' | 'nao' | null>(null);
  const [nome, setNome] = useState<string>('');
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [progressoDemo, setProgressoDemo] = useState<number>(1);

  const pendencias = listarPendencias();

  return (
    <main class="demo-gallery">
      <header class="demo-header">
        <div>
          <h1 class="diag-title">Galeria de Componentes — Etapa 2</h1>
          <p class="diag-subtitle">
            Conteúdo & Design System ("O Mundo a Partir do Útero")
          </p>
        </div>
        <a href="#diagnostico" class="demo-back-link">
          ← Voltar ao Diagnóstico (#diagnostico)
        </a>
      </header>

      {/* 1. TcleViewer completo dentro da ScrollArea */}
      <section class="demo-section">
        <div class="demo-section__head">
          <h2 class="demo-section__title">
            1. TcleViewer + ScrollArea (Status de pendências:{' '}
            {temPendencias() ? `${pendencias.length} pendentes` : 'Nenhuma'})
          </h2>
        </div>
        <TcleViewer maxHeight="420px" />
      </section>

      {/* 2. Button em todas as variantes e estados */}
      <section class="demo-section">
        <h2 class="demo-section__title">2. Button (Variantes e Estados)</h2>
        <div class="demo-grid">
          <Button variant="primary" icon={<IconePlay />}>
            {STRINGS.botoes.iniciar}
          </Button>
          <Button variant="primary">{STRINGS.botoes.aceitoParticipar}</Button>
          <Button variant="secondary">{STRINGS.botoes.ouvirNovamente}</Button>
          <Button variant="ghost">{STRINGS.botoes.naoAceito}</Button>
          <Button variant="danger">
            {STRINGS.menuOperador.botaoInterromper}
          </Button>
          <Button variant="ghost" icon={<IconeEngrenagem />}>
            Menu Operador
          </Button>
        </div>

        <h3 class="demo-subsection__title">Estados: Pressionado e Desabilitado</h3>
        <div class="demo-grid">
          <Button variant="primary" pressed>
            Primary (Pressionado)
          </Button>
          <Button variant="secondary" pressed>
            Secondary (Pressionado)
          </Button>
          <Button variant="primary" disabled>
            Primary (Disabled)
          </Button>
          <Button variant="secondary" disabled>
            Secondary (Disabled)
          </Button>
          <Button variant="ghost" disabled>
            Ghost (Disabled)
          </Button>
          <Button variant="danger" disabled>
            Danger (Disabled)
          </Button>
        </div>
      </section>

      {/* 3. Checkbox grande */}
      <section class="demo-section">
        <h2 class="demo-section__title">3. Checkbox Grande</h2>
        <div class="demo-stack">
          <Checkbox
            id="chk-consentimento-interativo"
            label={STRINGS.consentimentoParticipacao}
            checked={aceitouTermo}
            onChange={setAceitouTermo}
          />
          <Checkbox
            id="chk-demo-marcado"
            label="Exemplo fixo marcado (checked)"
            checked={true}
            onChange={() => {}}
          />
          <Checkbox
            id="chk-demo-disabled"
            label="Exemplo desabilitado (disabled)"
            checked={false}
            disabled
            onChange={() => {}}
          />
        </div>
      </section>

      {/* 4. RadioGroup grande */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          4. RadioGroup Grande (Sem pré-seleção inicial)
        </h2>
        <div class="demo-stack">
          <RadioGroup
            name="consentimento-imagem"
            legend="Autorização de uso de imagem (selecione uma opção):"
            value={autorizacaoImagem}
            onChange={setAutorizacaoImagem}
            options={[
              { value: 'sim', label: STRINGS.consentimentoImagemSim },
              { value: 'nao', label: STRINGS.consentimentoImagemNao },
            ]}
          />
          <div>
            <Button
              variant="ghost"
              onClick={() => setAutorizacaoImagem(null)}
            >
              Limpar seleção do RadioGroup
            </Button>
          </div>
        </div>
      </section>

      {/* 5. TextField */}
      <section class="demo-section">
        <h2 class="demo-section__title">5. TextField (Campo de Nome)</h2>
        <div class="demo-stack">
          <TextField
            id="input-nome-demo"
            label={STRINGS.campoNome.rotulo}
            note={STRINGS.campoNome.nota}
            placeholder={STRINGS.campoNome.placeholder}
            value={nome}
            onInput={setNome}
          />
          <TextField
            id="input-nome-disabled"
            label="Campo desabilitado (estado disabled)"
            value="Participante Exemplo"
            disabled
            onInput={() => {}}
          />
        </div>
      </section>

      {/* 6. ProgressoPar e IconeEngrenagem */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          6. ProgressoPar ("n / 6") & IconeEngrenagem
        </h2>
        <div class="demo-row">
          <ProgressoPar atual={progressoDemo} total={6} />
          <Button
            variant="secondary"
            onClick={() =>
              setProgressoDemo((p) => (p >= 6 ? 1 : p + 1))
            }
          >
            Avançar faixa ({progressoDemo}/6)
          </Button>
          <span class="demo-gear-preview" title="IconeEngrenagem">
            <IconeEngrenagem size={28} />
          </span>
        </div>
      </section>

      {/* 7. Modal de confirmação */}
      <section class="demo-section">
        <h2 class="demo-section__title">7. Modal de Confirmação</h2>
        <Button variant="danger" onClick={() => setModalAberto(true)}>
          Abrir Modal de Confirmação
        </Button>
        <Modal
          aberto={modalAberto}
          titulo={STRINGS.menuOperador.cancelarSessaoAtual}
          mensagem={STRINGS.menuOperador.confirmacaoInterromper}
          rotuloConfirmar={STRINGS.menuOperador.botaoInterromper}
          rotuloCancelar={STRINGS.menuOperador.botaoContinuar}
          onConfirmar={() => setModalAberto(false)}
          onCancelar={() => setModalAberto(false)}
        />
      </section>

      {/* 8. Catálogo de faixas (tracks.ts) */}
      <section class="demo-section">
        <h2 class="demo-section__title">
          8. Catálogo de Faixas (src/content/tracks.ts)
        </h2>
        <ol class="ui-tcle__list">
          {TRACKS.map((t) => (
            <li key={t.ordem} class="ui-tcle__list-item">
              <strong>{t.rotulo}</strong> —{' '}
              <span class="diag-detail" style={{ display: 'inline' }}>
                {t.srcEditado} | {t.srcOriginal}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
