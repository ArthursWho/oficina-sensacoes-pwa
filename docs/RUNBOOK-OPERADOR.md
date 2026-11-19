# Runbook do Operador — Oficina "O Mundo a Partir do Útero"

Guia rápido de operação do tablet Android na tenda da oficina.

---

## 1. ANTES da Oficina (Preparação e Ensaio)

- [ ] **Instalar o PWA**: Com o tablet conectado ao Wi-Fi, abrir a URL HTTPS oficial no **Google Chrome**, aguardar os indicadores no topo direito da Tela 1 mostrarem **"Áudio pronto"** e **"Armazenamento pronto"**, abrir o menu do Chrome (`⋮`) e tocar em **"Instalar aplicativo"** (ou **"Adicionar à tela inicial"**). Fechar o Chrome e abrir o app pelo ícone **"Útero"** na tela inicial.
- [ ] **Conferir o Diagnóstico no Menu do Operador**: Tocar na engrenagem (canto superior esquerdo) → rolar até **Diagnóstico** → tocar em **"Exibir diagnóstico"** e confirmar:
  - **Versão / Commit do build**: `1.0.0+<sha>`
  - **Modo de build**: `PRODUÇÃO`
  - **Banco ativo**: `mundo-utero-coleta` (quando o Modo de ensaio está desligado)
  - **Service Worker ativo**: `sim`
  - **Modo de exibição**: `fullscreen` ou `standalone`
  - **Tela sempre ligada**: `ativa`
  - **Armazenamento protegido**: `sim`
  - **Áudios pré-carregados**: `13/13`
- [ ] **Verificar atualização pendente**: Na seção **Aplicativo** do menu, se aparecer o botão **"Atualizar aplicativo"**, tocar nele e confirmar para carregar a versão mais recente antes de desligar o Wi-Fi.
- [ ] **Decisão sobre "Sons da interface"**: Na seção **Aplicativo**, definir **"Sons da interface"** (`Ligado` ou `Desligado`) conforme combinado pelo grupo e **manter a mesma opção durante toda a coleta**.
- [ ] **Calibrar o "Volume das editadas e das originais" (v1.1.0)**:
  1. Plugar os fones de ouvido oficiais da tenda e fixar o volume físico do tablet em um nível confortável.
  2. Com o app na **Tela 1 (TCLE)**, abrir o Menu do Operador e localizar o cartão **"Volume das faixas"** (entre *Exportar dados* e *Aplicativo*).
  3. Tocar em **"Tocar exemplo"** na caixa **Editadas** e na caixa **Originais** para comparar a intensidade percebida nos fones.
  4. **Regra do controle:** Os controles vão de `10%` a `100%` e **só abaixam** (`100%` é o nível original sem atenuação). Se as faixas originais soarem mais altas que as editadas, **abaixe o controle das Originais** (ex.: para `75%` ou `80%`); se faltar volume geral em ambas, aumente o volume físico do próprio tablet.
  5. **Fechar os valores ANTES da primeira participante real**, anotá-los no caderno da equipe e **NÃO mudar durante toda a coleta**. Os percentuais ficam salvos automaticamente no aparelho (mesmo se o tablet for reiniciado ou se o Modo de ensaio for ligado/desligado).
- [ ] **Fazer um ensaio completo usando o "Modo de ensaio"**:
  1. Na tela inicial (TCLE), abrir o Menu do Operador → seção **Aplicativo** → mudar **"Modo de ensaio"** para **`Ligado`**.
  2. Confirmar que a faixa vermelha fixa **"MODO DE ENSAIO — os dados não entram na coleta"** apareceu no topo da tela.
  3. Fechar o menu, percorrer os 6 pares de músicas até a tela de encerramento e exportar o CSV/XLSX pelo menu (confirmar que o arquivo baixado começa com o prefixo `ENSAIO_mundo-utero_...`).
  4. No Menu do Operador, tocar em **"Iniciar novo participante"** (para voltar ao TCLE) e mudar **"Modo de ensaio"** de volta para **`Desligado`**. Confirmar que a faixa vermelha sumiu e que **"Sessões concluídas"** voltou à contagem real da coleta (`0` antes do primeiro participante real).
- [ ] **Configurar o hardware do tablet na tenda**:
  - Tablet com bateria em 100% e conectado ao carregador/tomada (ou powerbank).
  - **Ligar o Modo Avião** (Wi-Fi e dados móveis desligados) após concluir a instalação/atualização.
  - Ativar **Não Perturbar** (silenciar alarmes e notificações).
  - Fixar o brilho da tela em nível baixo/confortável para a tenda escura.
  - Plugar os fones de ouvido que serão usados e calibrar o volume físico do tablet em nível baixo a moderado.
  - Opcional: ativar **"Fixar aplicativo"** (*Screen Pinning*) nas configurações de segurança do Android para impedir saída acidental pelos botões de navegação.

---

## 2. DURANTE a Oficina (Condução de cada Participante)

- **Papel do condutor**: Entregar o tablet sempre na **Tela 1 (TCLE)** com os campos em branco e verificar visualmente que a faixa vermelha de ensaio **NÃO** está ativa.
- **Em caso de recusa ("Não aceito")**: O app exibe uma mensagem acolhedora e não grava nada. Após o participante sair, toque no botão discreto **"Voltar ao início"** no canto inferior direito para preparar a Tela 1 para o próximo participante.
- **Em caso de desconforto ou desistência no meio da sessão**:
  1. Retire os fones do participante com calma.
  2. Toque na **engrenagem** (canto superior esquerdo) → no modal *"Sessão em andamento. Deseja realmente interromper?"*, toque em **"Interromper"** e feche o menu.
  3. O áudio para imediatamente, a sessão parcial é descartada (nada é salvo e o número do participante não é consumido) e o app retorna à Tela 1 limpa.
- **Se o áudio for interrompido (aparecer o aviso "O áudio foi interrompido.")**: Basta tocar no botão grande **"Retomar"**. A faixa atual recomeça do início sem somar repetição na estatística.
- **Ao final da experiência (Tela 4 — "Experiência concluída")**:
  1. O participante lê o agradecimento, retira os fones e segue para a conversa final com o grupo.
  2. Confira no canto superior direito da Tela 4 o indicador discreto **"Sessão salva"**.
  3. Se aparecer uma faixa inferior de erro (*"Não foi possível salvar esta sessão..."*), toque em **"Tentar novamente"** até aparecer **"Sessão salva"** (nunca inicie novo participante antes de salvar).
  4. Para preparar o tablet para a próxima pessoa: toque na **engrenagem** → **"Iniciar novo participante"**.

---

## 3. DEPOIS da Oficina (Exportação e Backup)

- [ ] **Exportar no fim de cada turno/dia e ao término da oficina**:
  1. Abrir o **Menu do Operador** (engrenagem).
  2. Conferir **"Sessões concluídas: N"** e **"Ainda não exportadas: M"**.
  3. Tocar em **"Exportar CSV"** e em **"Exportar XLSX"** (ambos os arquivos são salvos na pasta `Downloads` do tablet com o nome `mundo-utero_YYYYMMDD-HHmmss_Nsessoes.csv` / `.xlsx`).
  4. Confirmar que **"Ainda não exportadas"** zerou (`0`).
- [ ] **Guardar cópias em pelo menos 2 lugares diferentes**:
  - Religar o Wi-Fi do tablet ao final da coleta e usar o botão **"Compartilhar arquivo"** (ou abrir o app **Arquivos / Files** do Android → pasta **Downloads**) para enviar o `.csv` e o `.xlsx` por **e-mail** e salvar no **Google Drive** do grupo.
  - Como contingência adicional, tocar em **"Copiar como texto"**, colar em um documento de texto e salvar.
- [ ] **O que NUNCA fazer antes de confirmar os backups no computador do grupo**:
  - **NÃO** limpar os dados/cache do Google Chrome.
  - **NÃO** desinstalar o aplicativo `"Útero"` da tela inicial.
  - **NÃO** trocar de tablet no meio da coleta sem exportar todas as sessões do aparelho anterior (os IDs `Participante_01`, `Participante_02`... são locais a cada aparelho).

---

## 4. Tabela de Solução Rápida de Problemas

| Sintoma | Causa Provável | Ação Imediata |
| :--- | :--- | :--- |
| **Som não toca nos fones** | Fone mal encaixado ou volume de mídia do Android no zero | Verificar o plugue P2/USB-C e aumentar o botão físico de volume do tablet. |
| **"Aceito participar" exibe erro de áudio ou armazenamento** | Contexto de áudio bloqueado ou aba anônima/armazenamento cheio | Tocar em **"Tentar novamente"** no modal. Confirmar que o app não está em guia anônima do Chrome. |
| **Tela apagou sozinha** | Economia de bateria do Android bloqueou o Wake Lock | Desativar o modo "Economia de bateria" do Android e aumentar o tempo limite de tela do sistema para 10 ou 30 minutos. |
| **Erro ao salvar na Tela 4** | Falha momentânea de transação no IndexedDB | Tocar no botão **"Tentar novamente"** na barra inferior da Tela 4 até exibir `"Sessão salva"`. |
| **Botão "Compartilhar arquivo" falha no tablet** | Restrição do Web Share API em certas versões do Android | O arquivo **já foi baixado** na pasta `Downloads`! Abra o app **Arquivos (Files)** do tablet → **Downloads** e compartilhe por lá, ou use **"Copiar como texto"**. |
| **App não abre offline** | Limpeza acidental de cache do Chrome | Conectar ao Wi-Fi, recarregar a URL no Chrome até **"Service Worker ativo: sim"** no Diagnóstico do menu e só então voltar ao Modo Avião (as sessões no IndexedDB permanecem salvas). |
| **Atualização de versão disponível** | Nova tag `v1.0.x` publicada no GitHub | Na Tela 1 (entre participantes), conectar ao Wi-Fi, abrir Menu do Operador → **Aplicativo** → **"Atualizar aplicativo"**. |

---

## 5. Cuidados Éticos e LGPD + Ponto de Atenção do TCLE

- **Anonimato e LGPD**: Conforme o TCLE, o nome digitado na Tela 1 serve apenas para formalizar a leitura na tela e **jamais é gravado** no banco ou nos arquivos exportados. A autorização opcional de imagem também não é vinculada às respostas do aplicativo.
- **Guarda e descarte**: Os arquivos `.csv` e `.xlsx` devem ser utilizados exclusivamente para a elaboração agrupada do relatório acadêmico das disciplinas envolvidas e descartados após a conclusão do semestre, conforme orientação da professora responsável.
- **Ponto de atenção (campos entre colchetes no TCLE)**: Na versão `1.0.0`, as seções 9 e 10 do TCLE ainda exibem os campos entre colchetes (`[nome da professora]`, `[e-mail institucional]`, `[nome]`, `[e-mail ou telefone]` e `[Confirmar o enquadramento com a professora responsável.]`). Caso o grupo deseje preenchê-los antes da oficina, basta editar `PENDENCIAS` em `src/content/tcle.ts`, publicar a tag `v1.0.1` e clicar em **"Atualizar aplicativo"** no menu do operador.
