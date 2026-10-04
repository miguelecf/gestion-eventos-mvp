import { expect, test } from '@playwright/test';
import { createFreeLocationRequest, loginAs, uniqueEventName } from './helpers';

test('an admin reviews, converts, and edits an internal event comment', async ({ page }) => {
  const eventName = await createFreeLocationRequest(page, 'Admin flow');
  await loginAs(page, 'admin.full');

  await page.goto('/solicitudes');
  await expect(page.getByRole('heading', { name: 'Solicitudes' })).toBeVisible();
  await page.getByPlaceholder('Buscar por solicitud, tracking, solicitante o email...').fill(eventName);
  const requestRow = page.getByRole('row').filter({ hasText: eventName });
  await expect(requestRow).toBeVisible();
  await requestRow.getByRole('button', { name: 'Ver' }).click();

  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  await page.getByRole('button', { name: 'Pasar a revisión' }).click();
  await page.getByRole('button', { name: 'Convertir a evento' }).click();
  await page.getByLabel('Requiere soporte técnico').check();
  await page.getByRole('button', { name: 'Confirmar conversión' }).click();

  await expect(page).toHaveURL(/\/events\/\d+$/);
  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comentarios internos' })).toBeVisible();

  const originalComment = uniqueEventName('Internal comment');
  const editedComment = `${originalComment} edited`;
  await page.getByLabel('Nuevo comentario').fill(originalComment);
  await page.getByRole('button', { name: 'Publicar comentario' }).click();
  const comment = page.getByText(originalComment, { exact: true });
  await expect(comment).toBeVisible();
  const commentCard = comment.locator('..');
  await commentCard.getByRole('button', { name: 'Editar' }).click();
  await commentCard.locator('textarea').fill(editedComment);
  await commentCard.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(editedComment, { exact: true })).toBeVisible();
});
