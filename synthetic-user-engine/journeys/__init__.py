"""Catálogo de recorridos. El orden es el de ejecución dentro de cada ronda."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from journeys.cuentas import alta_de_cuenta
from journeys.eventos import baja_logica, choque_de_espacio, conformidades, reprogramacion
from journeys.permisos import matriz_de_permisos
from journeys.prioridad import prioridad_rectorado
from journeys.solicitudes import conversion_simultanea, solicitud_aprobada, solicitud_rechazada


@dataclass(frozen=True)
class JourneyDef:
    key: str
    title: str
    run: Callable
    once: bool = False  # Se ejecuta solo en la primera ronda.


JOURNEYS = [
    JourneyDef("matriz_de_permisos", "La matriz de permisos se cumple por HTTP para cada perfil", matriz_de_permisos, once=True),
    JourneyDef("solicitud_aprobada", "Una solicitud pública llega al calendario", solicitud_aprobada),
    JourneyDef("solicitud_rechazada", "Una solicitud se rechaza con motivo", solicitud_rechazada),
    JourneyDef("conversion_simultanea", "Dos áreas convierten la misma solicitud a la vez", conversion_simultanea),
    JourneyDef("reprogramacion", "Un cambio de agenda obliga a revisar de nuevo", reprogramacion),
    JourneyDef("choque_de_espacio", "Dos eventos no comparten espacio y horario", choque_de_espacio),
    JourneyDef("conformidades", "Cada área da solo su conformidad", conformidades),
    JourneyDef("prioridad_rectorado", "Rectorado desplaza a un evento y Ceremonial lo reprograma", prioridad_rectorado),
    JourneyDef("baja_logica", "La baja de un evento libera el espacio y queda auditada", baja_logica),
    JourneyDef("alta_de_cuenta", "Ciclo de vida de una cuenta interna", alta_de_cuenta),
]
