import { expect, type Page } from '@playwright/test';

export const e2ePassword = process.env.E2E_PASSWORD || 'admin123';

export function uniqueEventName(prefix: string): string {
  return `${prefix} E2E ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function createFreeLocationRequest(page: Page, prefix: string): Promise<string> {
  const eventName = uniqueEventName(prefix);
  await page.goto('/solicitud');
  await expect(page.getByRole('heading', { name: 'Solicitud de Evento' })).toBeVisible();
  await page.getByLabel('Nombre del evento').fill(eventName);
  await page.getByRole('radio', { name: 'Otra ubicación' }).check();
  await page.getByRole('textbox', { name: 'Ubicación *', exact: true }).fill('Sede de pruebas E2E');
  await page.getByLabel('Fecha').fill(futureDate(90));
  await page.getByLabel('Hora de inicio').fill('10:00');
  await page.getByLabel('Hora de fin').fill('11:00');
  await page.getByLabel('Nombre completo').fill('Persona de pruebas E2E');
  await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.test`);
  await page.getByLabel('Teléfono').fill('+54 11 5555 0101');
  await page.getByRole('button', { name: 'Enviar Solicitud' }).click();
  await expect(page).toHaveURL(/\/solicitud\/confirmacion\/[0-9a-f-]+/i);
  return eventName;
}

export async function loginAs(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(e2ePassword);
  await page.getByRole('button', { name: 'Ingresar a la plataforma' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/);
  await expect(page.getByRole('heading', { name: 'Bienvenido al panel de eventos' })).toBeVisible();
}

export { futureDate };
