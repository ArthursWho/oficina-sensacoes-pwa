# Dicionário de Dados — Oficina "O Mundo a Partir do Útero"

Especificação técnica da base de dados exportada pelo aplicativo (`.csv` e `.xlsx`) para análise na disciplina de **Estatística** e demais disciplinas integradas do 1º semestre de Psicologia (UNIVILLE).

---

## 1. Estrutura Geral do Arquivo Exportado

- **Formato**: Formato longo (*long format* / *tidy data*).
- **Granularidade**: **1 linha por música por participante** (exatamente **6 linhas por sessão concluída**). Sessões recusadas ou interrompidas/canceladas antes do 6º par não são gravadas e não entram na base.
- **Ordenação**: As linhas são ordenadas numericamente pelo número do participante (`Participante_01`, `Participante_02`, ..., `Participante_10`) e, dentro de cada participante, pela sequência fixa das músicas (`ordem_musica` de `1` a `6`).
- **Codificação do CSV**: UTF-8 com BOM (`EF BB BF`), separador ponto e vírgula (`;`) e quebra de linha `CRLF` (`\r\n`), pronto para abertura direta no Microsoft Excel em português, LibreOffice Calc, R, Python (pandas), Jamovi ou SPSS.
- **Planilha XLSX**: Aba única chamada `"sessoes"`, com linha de cabeçalho congelada e tipos nativos (texto vs número).

---

## 2. Especificação das 9 Colunas (na ordem exata)

| # | Nome da Coluna | Tipo (CSV / XLSX) | Valores Possíveis / Domínio | Como é Gerada e Significado |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `id_participante` | Texto (`string`) | `"Participante_01"`, `"Participante_02"`, ..., `"Participante_99"`, `"Participante_100"` | Identificador sequencial anônimo atribuído ao aceitar o TCLE, calculado como `(maior número já salvo no banco) + 1`, com padding mínimo de 2 dígitos. Não tem vínculo com o nome digitado na tela do termo. |
| **2** | `data_hora` | Texto (`string`) | `"YYYY-MM-DD HH:mm:ss"` (ex.: `"2026-11-19 19:42:15"`) | Data e hora no **fuso horário local do tablet** registradas no exato momento em que o participante responde à **Pergunta 2** daquele par musical. No XLSX é gravada explicitamente como texto para preservar o formato ISO legível sem conversão ambígua de data do Excel. |
| **3** | `ordem_musica` | Número inteiro (`number`) | `1`, `2`, `3`, `4`, `5` ou `6` | Posição fixa do par musical na sequência experimental (de 1 a 6). |
| **4** | `musica` | Texto (`string`) | `"Título — Artista"` (com travessão `—`, U+2014):<br>1. `"Cheia de Manias — Raça Negra"`<br>2. `"Three Little Birds — Bob Marley & The Wailers"`<br>3. `"Anunciação — Alceu Valença"`<br>4. `"Evidências — Chitãozinho & Xororó"`<br>5. `"Take On Me — a-ha"`<br>6. `"Thriller — Michael Jackson"` | Rótulo completo da faixa musical correspondente à `ordem_musica`, proveniente do catálogo oficial (`src/content/tracks.ts`). |
| **5** | `reconheceu` | Texto (`string`) | `"Sim"` ou `"Não"` | Resposta do participante à **Pergunta 1** (*"Você reconheceu essa música?"*), exibida imediatamente após o término da versão **editada** (filtrada para simular a audição intrauterina). |
| **6** | `tipo_pergunta_2` | Texto (`string`) | `"Acertou"` ou `"Surpreendeu"` | Variável derivada determinística que indica qual variante da Pergunta 2 foi exibida após a versão **original** (com revelação de título e artista):<br>• Se `reconheceu == "Sim"` → **`"Acertou"`** (*"Você acertou qual música era?"*)<br>• Se `reconheceu == "Não"` → **`"Surpreendeu"`** (*"Se surpreendeu com a resposta?"*) |
| **7** | `resposta_pergunta_2` | Texto (`string`) | `"Sim"` ou `"Não"` | Resposta do participante à **Pergunta 2** (cuja pergunta depende de `tipo_pergunta_2` acima). |
| **8** | `repeticoes_editado` | Número inteiro (`number`) | Inteiro $\ge 0$ (`0`, `1`, `2`, ...) | Quantidade de vezes que o participante tocou voluntariamente no botão **"Ouvir novamente"** após a primeira reprodução completa da versão **editada** naquele par. Se ouviu apenas a reprodução obrigatória inicial, o valor é `0`. **Nota:** Interrupções acidentais do sistema seguidas do botão *"Retomar"* **não** incrementam este contador. |
| **9** | `repeticoes_original` | Número inteiro (`number`) | Inteiro $\ge 0$ (`0`, `1`, `2`, ...) | Quantidade de vezes que o participante tocou voluntariamente no botão **"Ouvir novamente"** após a primeira reprodução completa da versão **original** naquele par. Se ouviu apenas a reprodução inicial, o valor é `0`. Interrupções/retomadas **não** incrementam este contador. |

---

## 3. Observações para a Análise Estatística

1. **Unidade amostral vs. Unidade de observação**:
   - Cada participante ($N$ participantes) gera **6 linhas** ($6 \times N$ observações).
   - Para análises por participante (ex.: total de músicas reconhecidas ou total de acertos por pessoa), agrupe por `id_participante`.
   - Para análises por música (ex.: taxa de reconhecimento intrauterino da faixa 1 vs. faixa 6), agrupe por `ordem_musica` ou `musica`.
2. **Interpretação conjunta de `reconheceu`, `tipo_pergunta_2` e `resposta_pergunta_2`**:
   - **Reconhecimento verdadeiro confirmado (acerto)**: `reconheceu == "Sim"` **E** `tipo_pergunta_2 == "Acertou"` **E** `resposta_pergunta_2 == "Sim"`.
   - **Falso reconhecimento (achou que reconheceu, mas errou qual era a música)**: `reconheceu == "Sim"` **E** `tipo_pergunta_2 == "Acertou"` **E** `resposta_pergunta_2 == "Não"`.
   - **Não reconheceu e se surpreendeu na revelação**: `reconheceu == "Não"` **E** `tipo_pergunta_2 == "Surpreendeu"` **E** `resposta_pergunta_2 == "Sim"`.
   - **Não reconheceu e não se surpreendeu**: `reconheceu == "Não"` **E** `tipo_pergunta_2 == "Surpreendeu"` **E** `resposta_pergunta_2 == "Não"`.
