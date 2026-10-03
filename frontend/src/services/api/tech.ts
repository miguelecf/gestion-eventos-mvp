/**
 * ===================================================================
 * API SERVICE: Technical Capacity
 * ===================================================================
 * Servicio para gestionar capacidad técnica de franjas horarias
 * ===================================================================
 */

import { httpClient } from './client';

/**
 * Estructura del backend: TechCapacityResponse
 */
interface BackendTechCapacityBlock {
  from: string;      // HH:mm
  to: string;        // HH:mm
  used: number;
  available: number;
}

interface BackendTechCapacityResponse {
  date: string;           // yyyy-MM-dd
  blockMinutes: number;
  defaultSlots: number;
  blocks: BackendTechCapacityBlock[];
}

/**
 * Estructura del frontend (adaptada)
 */
export interface TechCapacityBlock {
  id: string;             // Generado: from-to
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  maxCapacity: number;    // used + available
  usedCapacity: number;   // used
  availableCapacity: number; // available
}

export interface TechCapacitySummary {
  totalBlocks: number;
  saturatedBlocks: number;  // blocks donde available === 0
  totalUsed: number;
  averageUsage: number;     // (totalUsed / totalCapacity) * 100
}

export interface TechCapacity {
  date: string;
  blocks: TechCapacityBlock[];
  summary: TechCapacitySummary;
}

/**
 * Obtiene la capacidad técnica para una fecha específica
 * @param date - Fecha en formato YYYY-MM-DD
 */
export async function fetchTechCapacity(date: string): Promise<TechCapacity> {
  const backendData = await httpClient.get<BackendTechCapacityResponse>(
    '/api/tech/capacity',
    { params: { date } }
  );

  // Transformar bloques del backend al formato del frontend
  const blocks: TechCapacityBlock[] = backendData.blocks.map((block) => ({
    id: `${block.from}-${block.to}`,
    startTime: block.from,
    endTime: block.to,
    maxCapacity: block.used + block.available,
    usedCapacity: block.used,
    availableCapacity: block.available,
  }));

  // Calcular summary
  const saturatedBlocks = blocks.filter(b => b.availableCapacity === 0).length;
  const totalUsed = blocks.reduce((sum, b) => sum + b.usedCapacity, 0);
  const totalCapacity = blocks.reduce((sum, b) => sum + b.maxCapacity, 0);
  const averageUsage = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;

  return {
    date: backendData.date,
    blocks,
    summary: {
      totalBlocks: blocks.length,
      saturatedBlocks,
      totalUsed,
      averageUsage: Math.round(averageUsage * 10) / 10, // 1 decimal
    },
  };
}
