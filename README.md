# O Mundo a Partir do Útero — PWA (v1.1.0)

Aplicativo Web Progressivo (PWA) 100% offline construído para a atividade didática **"Oficina de Sensações — O mundo a partir do útero"** do 1º semestre do curso de Psicologia da **UNIVILLE** (Estatística, Embriologia e Genética, Processos Básicos em Psicologia I e Psicologia: História, Escolas e Profissão I).

> **Nota da versão 1.1.0:** Adicionado o cartão **"Volume das faixas"** no Menu do Operador, permitindo calibrar separadamente o volume das faixas **Editadas** e **Originais** (de 10% a 100%, com botão *"Tocar exemplo"* ao lado de cada controle). **Importante:** Atualize o aplicativo no tablet pelo Menu do Operador (*Aplicativo → Atualizar aplicativo*) e calibre os volumes com os fones da tenda **ANTES** de iniciar a coleta com o primeiro participante real.

O aplicativo executa em tela cheia no tablet Android (Chrome), em ambiente com pouca luz, conduzindo o participante pela leitura do TCLE, reprodução de 6 pares de faixas musicais (versão filtrada intrauterina e versão original) com batimentos cardíacos nos intervalos, armazenamento local anônimo em IndexedDB e exportação offline em CSV/XLSX.

---

## 1. Requisitos e Comandos Principais

- **Node.js** 20+ (recomendado Node 22) e **npm**.

```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento (modo desenvolvimento, com laboratórios #*-lab ativos)
npm run dev

# Verificar tipagem TypeScript
npm run typecheck

# Rodar suíte completa de testes unitários e de integração (Vitest)
npm run test

# Gerar build de produção (elimina laboratórios, injeta CSP e usa o banco "mundo-utero-coleta")
npm run build

# Gerar build local com laboratórios (apenas para inspeção técnica local, nunca para deploy)
npm run build:lab

# Executar pipeline completa de validação de release (typecheck -> test -> build -> verificar:dist -> check:release)
npm run release:verificar
```

---

## 2. Como Publicar e Como Lançar Correções (Tags Git)

O workflow `.github/workflows/deploy.yml` publica no **GitHub Pages** **somente** quando uma tag no formato `v*.*.*` é enviada (ou por disparo manual `workflow_dispatch` na aba Actions), e apenas após o job `release:verificar` passar. Pushes comuns na branch `main` executam apenas a integração contínua (`.github/workflows/ci.yml`), sem alterar o site publicado da oficina.

### Publicando a versão `v1.0.0`:
```bash
git push origin main
git push origin v1.0.0
```

### Como corrigir um problema depois de publicado:
1. Faça o ajuste necessário no código.
2. **REGRA CRÍTICA DE PRESERVAÇÃO DE DADOS:** **NUNCA altere a constante `NOME_BANCO_PRODUCAO = "mundo-utero-coleta"`** em `src/storage/nomesBanco.ts`. Mudar esse nome faz o aplicativo abrir um banco vazio e esconde as sessões já coletadas no tablet.
3. Atualize a versão no `package.json` (ex.: `1.0.1`) e rode `npm run release:verificar`.
4. Crie e envie uma nova tag:
   ```bash
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```
5. No tablet (conectado temporariamente ao Wi-Fi, **entre um participante e outro**, na tela inicial do TCLE), abra o **Menu do Operador** (engrenagem no canto superior esquerdo) → seção **Aplicativo** → toque em **"Atualizar aplicativo"** e confirme.

---

## 3. Ponto de Atenção Conhecido: Campos entre Colchetes no TCLE

Conforme decisão do grupo para a versão `v1.0.0`, o texto do TCLE em `src/content/tcle.ts` mantém literalmente os marcadores entre colchetes de contato (`[nome da professora]`, `[e-mail institucional]`, `[nome]`, `[e-mail ou telefone]`) e a nota `[Confirmar o enquadramento com a professora responsável.]` na seção 9.

O script `npm run check:release` (incluído em `npm run release:verificar`) emite um **AVISO** listando essas 5 pendências, mas retorna código de saída `0` para não bloquear a publicação.

### Como preencher esses dados futuramente:
1. Abra `src/content/tcle.ts` e edite o objeto `PENDENCIAS` com os nomes/contatos reais e altere `enquadramentoEticoConfirmado` para `true`.
2. Rode `npm run release:verificar` (ele informará `[OK check:release] sem pendências no TCLE`).
3. Gere uma nova tag (ex.: `v1.0.1`), envie para o GitHub e atualize o app no tablet pelo Menu do Operador antes da próxima sessão.

---

## 4. Direitos Autorais dos Áudios e Privacidade (`robots.txt` / `noindex`)

- **Uso estritamente acadêmico**: Os trechos musicais em `public/audio/` são obras protegidas por direitos autorais, utilizados exclusivamente para fins didáticos sem fins comerciais na atividade presencial da disciplina. Recomenda-se manter o repositório privado (se o plano do GitHub permitir Pages privado) e **despublicar o GitHub Pages imediatamente após o encerramento da oficina e exportação dos dados**.
- **Bloqueio de indexação**: O aplicativo inclui `<meta name="robots" content="noindex,nofollow">` no `index.html` e `public/robots.txt` com `User-agent: *` / `Disallow: /` para evitar indexação por buscadores.
- **Documentação complementar em `docs/`**:
  - [docs/RUNBOOK-OPERADOR.md](file:///c:/Users/PC/Documents/Dev/PWA%20O%20Mundo%20a%20Partir%20do%20%C3%9Atero/docs/RUNBOOK-OPERADOR.md) — Guia prático de operação antes, durante e depois da oficina.
  - [docs/DICIONARIO-DE-DADOS.md](file:///c:/Users/PC/Documents/Dev/PWA%20O%20Mundo%20a%20Partir%20do%20%C3%9Atero/docs/DICIONARIO-DE-DADOS.md) — Especificação das 9 colunas exportadas para a análise de Estatística.
  - [docs/CHECKLIST-ACEITACAO.md](file:///c:/Users/PC/Documents/Dev/PWA%20O%20Mundo%20a%20Partir%20do%20%C3%9Atero/docs/CHECKLIST-ACEITACAO.md) — Roteiro de validação final no tablet antes do início da coleta.
