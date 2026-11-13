import { test, expect } from '@playwright/test';

test.describe('Configuração inicial', () => {
  test('mostra as etapas de configuração', async ({ page }) => {
    await page.goto('/setup');

    await expect(page.getByRole('heading', { name: 'Concluir a configuração' })).toBeVisible();
    await expect(page.getByText('npm run db:migrate')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entrar no aplicativo' })).toHaveAttribute('href', '/auth/login');
  });
});
