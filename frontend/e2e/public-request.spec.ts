import { expect, test } from '@playwright/test';
import { futureDate, uniqueEventName } from './helpers';

test('a visitor submits a request for Tercera edad and tracks its receipt', async ({ page }) => {
  const eventName = uniqueEventName('Public request');

  await page.goto('/solicitud');
  await expect(page.getByRole('heading', { name: 'Solicitud de Evento' })).toBeVisible();
  await page.getByLabel('Nombre del evento').fill(eventName);
  await page.getByLabel('Tipo de audiencia').selectOption({ label: 'Tercera edad' });
  await page.getByLabel('Fecha').fill(futureDate(60));
  await page.getByLabel('Hora de inicio').fill('10:00');
  await page.getByLabel('Hora de fin').fill('11:00');

  const spaceSelect = page.getByLabel('Espacio');
  await expect(spaceSelect).toBeEnabled();
  await expect.poll(async () => spaceSelect.locator('option').count()).toBeGreaterThan(1);
  const waitForAvailabilityResponse = () => page.waitForResponse(
    (response) => response.url().includes('/public/availability/check') && response.request().method() === 'POST',
    { timeout: 20_000 },
  );
  let availabilityResponsePromise = waitForAvailabilityResponse();
  await spaceSelect.selectOption({ index: 1 });

  const availableHeading = page.getByRole('heading', { name: /Horario Disponible/i });
  const conflictHeading = page.getByRole('heading', { name: /Conflicto Detectado/i });
  let available = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const availabilityResponse = await availabilityResponsePromise;
    expect(availabilityResponse.status(), 'the public availability endpoint should succeed').toBe(200);
    await expect.poll(
      async () => (await availableHeading.isVisible()) || (await conflictHeading.isVisible()),
      { timeout: 20_000 },
    ).toBe(true);
    if (await availableHeading.isVisible()) {
      available = true;
      break;
    }
    availabilityResponsePromise = waitForAvailabilityResponse();
    await page.getByLabel('Fecha').fill(futureDate(60 + (attempt + 1) * 7));
  }
  expect(available, 'the public availability check should find an available future slot').toBe(true);
  await expect(page.getByText('Puede continuar con el envío de la solicitud.')).toBeVisible();

  await page.getByLabel('Nombre completo').fill('Persona pública E2E');
  await page.getByLabel('Email').fill(`public-${Date.now()}@example.test`);
  await page.getByLabel('Teléfono').fill('+54 11 5555 0202');
  await page.getByRole('button', { name: 'Enviar Solicitud' }).click();
  await expect(page).toHaveURL(/\/solicitud\/confirmacion\/[0-9a-f-]+/i);

  await page.getByRole('link', { name: 'Ver Estado de Solicitud' }).click();
  await expect(page).toHaveURL(/\/track\/[0-9a-f-]+/i);
  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  await expect(page.getByText('Recibida', { exact: true })).toBeVisible();
});
