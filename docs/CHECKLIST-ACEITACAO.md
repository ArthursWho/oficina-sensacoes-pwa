# Checklist de Aceitação Final no Tablet — Oficina "O Mundo a Partir do Útero" (v1.1.0)

Execute este roteiro no tablet Android oficial da oficina antes do início da coleta de dados com os participantes.

- **Aparelho / Modelo do Tablet**: `_____________________________________________`
- **Versão do Chrome Android**: `_____________________________________________`
- **Versão exibida no Menu do Operador (`1.1.0+<sha>`)**: `________________________`
- **Volumes calibrados para a coleta**: Editadas: `______%` | Originais: `______%`

---

## 1. Instalação, Atualização, Calibração de Volume e Diagnóstico Inicial

- [ ] **1.1. Instalação / Atualização para v1.1.0**:
  - Com Wi-Fi ligado, abrir o app (ou atualizar pelo Menu do Operador → **Aplicativo** → **"Atualizar aplicativo"**).
  - Abrir o **Menu do Operador** (engrenagem no canto superior esquerdo) → seção **Diagnóstico** → **"Exibir diagnóstico"** e confirmar:
    - [ ] Versão / Commit do build: `1.1.0+...`
    - [ ] Modo de build: `PRODUÇÃO`
    - [ ] Banco ativo: `mundo-utero-coleta`
    - [ ] Service Worker ativo: `sim`
    - [ ] Modo de exibição: `fullscreen` ou `standalone`
    - [ ] Tela sempre ligada: `ativa`
    - [ ] Armazenamento protegido: `sim`
    - [ ] Áudios pré-carregados: `13/13`
- [ ] **1.2. Teste do Cartão "Volume das faixas" (v1.1.0)**:
  - Na Tela 1 (TCLE), abrir o Menu do Operador e verificar o cartão **"Volume das faixas"**:
    - [ ] Tocar em **"Tocar exemplo"** em **Editadas**: a música do Par 1 toca e o botão muda para **"Parar"**.
    - [ ] Enquanto toca, tocar em **"Tocar exemplo"** em **Originais**: o exemplo editado para imediatamente e o original começa.
    - [ ] Ajustar o slider e os botões `[ − ]` / `[ + ]` (testar clique único de 1% e segurar para repetição contínua) durante o exemplo: o volume muda suavemente em tempo real sem estalos.
    - [ ] Testar o botão **"Restaurar padrão (100%)"** e depois definir os valores finais escolhidos pelo grupo, fechar e reabrir o menu para confirmar que os percentuais ficaram salvos.
- [ ] **1.3. Conferência do texto do TCLE na Tela 1**:
  - Rolar o TCLE até a seção 12 e confirmar que o texto está íntegro conforme decisão do grupo (nota: os campos entre colchetes nas seções 9 e 10 ainda aparecem na `v1.0.0`, conforme esperado).

---

## 2. Validação 100% Offline (Modo Avião) e Modo de Ensaio

- [ ] **2.1. Ativar Modo Avião**:
  - Desligar Wi-Fi e dados móveis no tablet. Fechar completamente o app (remover dos recentes) e abrir novamente pelo ícone **"Útero"** na tela inicial. O app deve abrir imediatamente com **"Áudio pronto"** e **"Armazenamento pronto"**.
- [ ] **2.2. Ligar o Modo de Ensaio**:
  - Na Tela 1 (TCLE), abrir o Menu do Operador → seção **Aplicativo** → alternar **"Modo de ensaio"** para **`Ligado`**.
  - Confirmar que a faixa vermelha fixa **"MODO DE ENSAIO — os dados não entram na coleta"** aparece no topo e que o **Banco ativo** no Diagnóstico mudou para `mundo-utero-ensaio`.
- [ ] **2.3. Executar 3 sessões completas no Modo de Ensaio**:
  - Anotar em papel as respostas dadas nas 3 sessões (incluindo pelo menos 1 uso do botão *"Ouvir novamente"* na versão editada e 1 na original).
  - Verificar que os batimentos cardíacos tocam na Tela 2, fazem fade-out antes de cada música, voltam nos intervalos e na Tela 4, e que nenhuma faixa toca sobreposta.
  - Verificar que ao início do Par 1 o interruptor **"Modo de ensaio"** no menu fica bloqueado (*"Disponível apenas na tela inicial."*).
  - Ao final da 3ª sessão, abrir o Menu do Operador e confirmar **"Sessões concluídas: 3"** e **"Ainda não exportadas: 3"**.
- [ ] **2.4. Exportação e conferência das 3 sessões de ensaio**:
  - Tocar em **"Exportar CSV"** e **"Exportar XLSX"**.
  - Confirmar que os arquivos gerados têm o prefixo **`ENSAIO_mundo-utero_..._3sessoes.csv`** e **`.xlsx`** e que **"Ainda não exportadas"** passou para **`0`**.
  - Abrir o arquivo exportado e conferir se as 18 linhas ($3 \times 6$) e as 9 colunas batem exatamente com as respostas anotadas no papel.

---

## 3. Recusa, Interrupção, Reinício do Tablet e Isolamento da Coleta

- [ ] **3.1. Teste de Recusa**:
  - Iniciar na Tela 1, digitar um nome qualquer e tocar em **"Não aceito"**.
  - Confirmar que a tela de agradecimento aparece, tocar em **"Voltar ao início"** e verificar no Menu do Operador que a contagem de sessões **não aumentou** e o campo de nome voltou vazio.
- [ ] **3.2. Teste de Interrupção no meio do ciclo**:
  - Aceitar o TCLE, iniciar o Par 1 e, no meio da música ou pergunta, tocar na **engrenagem** → **"Interromper"**.
  - Confirmar que o áudio para imediatamente, a contagem de sessões **não aumentou** e o próximo participante não pulou número.
- [ ] **3.3. Reinício físico do tablet e retorno automático ao Modo de Coleta**:
  - Reiniciar o tablet Android (desligar e ligar novamente, mantendo em Modo Avião) e abrir o app pelo ícone **"Útero"**.
  - Confirmar que o **Modo de ensaio voltou DESLIGADO automaticamente** (sem faixa vermelha no topo e com banco ativo = `mundo-utero-coleta`).
  - Confirmar que **"Sessões concluídas"** no banco de produção (`mundo-utero-coleta`) está em **`0`** (nenhuma sessão de ensaio entrou na coleta real!).
  - Ligar temporariamente o Modo de ensaio só para confirmar que as 3 sessões de ensaio sobreviveram ao reinício do tablet, e **desligar o Modo de ensaio novamente**.

---

## 4. Compartilhamento e Layout (Retrato e Paisagem)

- [ ] **4.1. Rotação Retrato / Paisagem**:
  - Girar o tablet entre paisagem e retrato na Tela 1 e no Menu do Operador: confirmar ausência de barra de rolagem horizontal e que a engrenagem não sobrepõe nenhum botão ou texto.
- [ ] **4.2. Teste de Envio (E-mail / Google Drive)**:
  - Religar o Wi-Fi rapidamente, testar o envio do arquivo `ENSAIO_...` para o e-mail/Drive do grupo (via botão *"Compartilhar arquivo"* ou pelo app *Arquivos / Downloads* do Android) e **voltar o tablet para o Modo Avião**.

---

## 5. Aprovação Final para Início da Oficina

- [ ] Confirmo que todos os itens acima foram verificados no tablet oficial e que o **Modo de ensaio foi deixado DESLIGADO** (`Banco ativo: mundo-utero-coleta`).

- **Data e Hora da Validação**: `____ / ____ / 2026 às ____:____`
- **Responsável pela Validação (Nome e Assinatura)**: `_____________________________________________`
