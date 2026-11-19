import fs from 'node:fs';
import { expect, Page, test } from '@playwright/test';

// Monitora em todos os cenários: zero requisições para origens externas e zero violações de CSP
function monitorarSegurancaERede(page: Page) {
  const requisicoesExternas: string[] = [];
  const violacoesCsp: string[] = [];

  page.on('request', (req) => {
    const url = req.url();
    if (
      url.startsWith('http://') ||
      url.startsWith('https://')
    ) {
      const parsed = new URL(url);
      if (parsed.origin !== 'http://localhost:4173') {
        requisicoesExternas.push(url);
      }
    }
  });

  void page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (e) => {
      (
        window as unknown as { __cspViolations?: string[] }
      ).__cspViolations =
        (window as unknown as { __cspViolations?: string[] }).__cspViolations ||
        [];
      (
        window as unknown as { __cspViolations: string[] }
      ).__cspViolations.push(e.BlockedURI || e.violatedDirective);
    });
  });

  return {
    async afirmarZeroViolacoes() {
      expect(requisicoesExternas).toEqual([]);
      const cspNoBrowser = await page.evaluate(
        () =>
          (window as unknown as { __cspViolations?: string[] })
            .__cspViolations || []
      );
      expect([...violacoesCsp, ...cspNoBrowser]).toEqual([]);
    },
  };
}

async function contarRegistrosIndexedDb(
  page: Page,
  nomeBanco: string
): Promise<number> {
  return page.evaluate(async (dbName) => {
    return new Promise<number>((resolve) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('sessoes')) {
          db.close();
          resolve(0);
          return;
        }
        const tx = db.transaction('sessoes', 'readonly');
        const countReq = tx.objectStore('sessoes').count();
        countReq.onsuccess = () => {
          db.close();
          resolve(countReq.result);
        };
        countReq.onerror = () => {
          db.close();
          resolve(0);
        };
      };
      req.onerror = () => resolve(0);
    });
  }, nomeBanco);
}

test.describe('E2E — O Mundo a Partir do Útero (Build de Produção)', () => {
  test('1, 2 & 3. Offline após Service Worker, zero chamadas externas/CSP, recusa e interrupção não gravam nada', async ({
    page,
    context,
  }) => {
    const seguranca = monitorarSegurancaERede(page);

    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: /Termo de Consentimento Livre e Esclarecido/i,
      })
    ).toBeVisible();

    // Aguarda Service Worker ativar e pré-carga dos 13 áudios concluir
    await expect(page.getByText('Áudio pronto')).toBeVisible({
      timeout: 30_000,
    });

    // Fica OFFLINE e recarrega
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: /Termo de Consentimento Livre e Esclarecido/i,
      })
    ).toBeVisible();
    await expect(page.getByText('Áudio pronto')).toBeVisible({
      timeout: 30_000,
    });

    // Cenário 3a: Recusa não grava nada
    await page.getByRole('button', { name: 'Não aceito' }).click();
    await expect(
      page.getByRole('heading', { name: /Agradecemos a sua atenção/i })
    ).toBeVisible();
    expect(await contarRegistrosIndexedDb(page, 'mundo-utero-coleta')).toBe(0);

    await page.getByRole('button', { name: 'Voltar ao início' }).click();

    // Cenário 3b: Cancelamento pela engrenagem (modal "Interromper") não grava nada
    await page
      .getByText(
        'Li e concordo em participar voluntariamente da Oficina de Sensações'
      )
      .click();
    await page.getByRole('button', { name: 'Aceito participar' }).click();
    await expect(
      page.getByRole('heading', {
        name: /Tudo pronto\? Vamos iniciar a nossa experiência imersiva/i,
      })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Menu do operador' }).click();
    await page.getByRole('button', { name: 'Interromper' }).click();
    await page.getByRole('button', { name: 'Fechar' }).click();

    expect(await contarRegistrosIndexedDb(page, 'mundo-utero-coleta')).toBe(0);
    await seguranca.afirmarZeroViolacoes();
  });

  test('4, 5 & 6. Sessão completa offline, exportação CSV com BOM, persistência entre reloads e Modo de Ensaio isolado', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    const seguranca = monitorarSegurancaERede(page);

    await page.goto('/');
    await expect(page.getByText('Áudio pronto')).toBeVisible({
      timeout: 30_000,
    });
    await context.setOffline(true);

    // Aceita TCLE e inicia sessão em produção
    await page
      .getByText(
        'Li e concordo em participar voluntariamente da Oficina de Sensações'
      )
      .click();
    await page.getByRole('button', { name: 'Aceito participar' }).click();
    await page.getByRole('button', { name: 'Iniciar' }).click();

    // Responde os 6 pares aguardando o término real de cada faixa editada e original
    for (let par = 1; par <= 6; par++) {
      await expect(
        page.getByRole('heading', { name: 'Você reconheceu essa música?' })
      ).toBeVisible({ timeout: 40_000 });
      await page.getByRole('button', { name: 'Sim' }).click();

      await expect(
        page.getByRole('heading', { name: 'Você acertou qual música era?' })
      ).toBeVisible({ timeout: 60_000 });
      await page.getByRole('button', { name: 'Sim' }).click();
    }

    // Encerramento e confirmação de "Sessão salva"
    await expect(
      page.getByRole('heading', { name: 'Experiência concluída' })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sessão salva')).toBeVisible();
    expect(await contarRegistrosIndexedDb(page, 'mundo-utero-coleta')).toBe(1);

    // Exporta CSV pelo menu e valida BOM + 6 linhas + cabeçalho
    await page.getByRole('button', { name: 'Menu do operador' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const download = await downloadPromise;
    const caminhoDownload = await download.path();
    expect(caminhoDownload).toBeTruthy();
    if (caminhoDownload) {
      const bytes = fs.readFileSync(caminhoDownload);
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
      const texto = bytes.subarray(3).toString('utf-8');
      const linhas = texto.trim().split('\r\n');
      expect(linhas).toHaveLength(7); // cabeçalho + 6 linhas
      expect(linhas[0]).toBe(
        'id_participante;data_hora;ordem_musica;musica;reconheceu;tipo_pergunta_2;resposta_pergunta_2;repeticoes_editado;repeticoes_original'
      );
      expect(linhas[1]).toContain('Participante_01;');
    }

    // Cenário 5: Recarrega a página -> sessão continua gravada e Modo de Ensaio começa DESLIGADO
    await page.reload();
    expect(await contarRegistrosIndexedDb(page, 'mundo-utero-coleta')).toBe(1);

    // Cenário 6: Liga Modo de Ensaio no TCLE e verifica banner
    await page.getByRole('button', { name: 'Menu do operador' }).click();
    await expect(page.getByText('Sessões concluídas: 1')).toBeVisible();
    await page
      .locator('.diag-item', { hasText: 'Modo de ensaio' })
      .getByRole('button', { name: 'Desligado' })
      .click();
    await expect(
      page.getByText('MODO DE ENSAIO — os dados não entram na coleta')
    ).toBeVisible();
    await expect(page.getByText('Sessões concluídas: 0')).toBeVisible();

    // Recarrega e confirma que o Modo de Ensaio voltou DESLIGADO
    await page.reload();
    await expect(
      page.getByText('MODO DE ENSAIO — os dados não entram na coleta')
    ).toHaveCount(0);

    await seguranca.afirmarZeroViolacoes();
  });

  test('7. Viewport de celular (412×915): TCLE renderiza sem rolagem horizontal e o menu abre', async ({
    page,
  }) => {
    const seguranca = monitorarSegurancaERede(page);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /Termo de Consentimento Livre e Esclarecido/i,
      })
    ).toBeVisible();

    const temScrollHorizontal = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(temScrollHorizontal).toBe(false);

    await page.getByRole('button', { name: 'Menu do operador' }).click();
    await expect(
      page.getByRole('heading', { name: 'Menu do operador' })
    ).toBeVisible();

    await seguranca.afirmarZeroViolacoes();
  });
});
