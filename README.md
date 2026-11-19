# O Mundo a Partir do Útero (PWA)

Aplicação web progressiva (PWA) 100% offline para a oficina acadêmica de Sensação e Percepção (Psicologia — UNIVILLE).

## 1. Como rodar localmente

Instale as dependências e inicie o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Para verificar a tipagem TypeScript:

```bash
npm run typecheck
```

## 2. Como fazer o build e testar o Service Worker localmente

Gere a versão de produção na pasta `dist/` e inicie o servidor de pré-visualização:

```bash
npm run build
npm run preview
```

Acesse o endereço exibido no terminal (ex.: `http://localhost:4173`) pelo navegador para validar o registro do Service Worker e o pré-cache dos arquivos de áudio.

## 3. Como publicar no GitHub Pages

O projeto já inclui o workflow `.github/workflows/deploy.yml` que publica automaticamente a pasta `dist` a cada push na branch `main`.

Passo a passo para ativar:
1. Crie um repositório no GitHub e envie o código na branch `main`:
   ```bash
   git init
   git add .
   git commit -m "Etapa 1: fundação PWA"
   git branch -M main
   git remote add origin https://github.com/<SEU_USUARIO>/<SEU_REPOSITORIO>.git
   git push -u origin main
   ```
2. No GitHub, acesse **Settings > Pages**.
3. Em **Build and deployment > Source**, selecione **GitHub Actions**.
4. Aguarde a conclusão do workflow na aba **Actions**; a URL HTTPS pública será gerada automaticamente.

## 4. Instruções de instalação no tablet Android

1. Conecte o tablet à internet e abra a URL HTTPS do projeto no **Google Chrome**.
2. Aguarde alguns segundos até o painel de diagnóstico exibir **"a) Service Worker ativo: OK"** (isso confirma que o app e os 13 áudios foram baixados para o cache offline).
3. Toque em **"Testar áudio em cache"** para confirmar que o áudio responde `OK`.
4. Abra o menu do Chrome (três pontos no canto superior direito) e toque em **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.
5. Feche o Chrome, ative o **Modo Avião** do tablet e abra o aplicativo pelo ícone **"Útero"** na tela inicial.
6. Verifique se o item **"b) Modo de exibição atual"** mostra `fullscreen` ou `standalone` e se o botão **"Testar áudio em cache"** continua respondendo `OK` mesmo offline.
