import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('a viewer sees only permitted navigation and cannot edit events', async ({ page }) => {
  await loginAs(page, 'viewer');

  await expect(page.getByRole('link', { name: 'Solicitar evento' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solicitudes', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Espacios', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Departamentos', exact: true })).toHaveCount(0);

  await page.goto('/events/1/edit');
  await expect(page).toHaveURL(/\/unauthorized$/);
  await expect(page.getByRole('heading', { name: 'Acceso Denegado' })).toBeVisible();
});
