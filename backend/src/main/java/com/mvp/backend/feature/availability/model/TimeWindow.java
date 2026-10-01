package com.mvp.backend.feature.availability.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class TimeWindow {
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final LocalDate date;
    private final LocalDateTime start;
    private final LocalDateTime end;

    private TimeWindow(LocalDate date, LocalDateTime start, LocalDateTime end) {
        this.date = date;
        this.start = start;
        this.end = end;
    }

    public static TimeWindow of(LocalDate date, LocalTime from, LocalTime to) {
        if (date == null || from == null || to == null) {
            throw new IllegalArgumentException("date, from and to must be non-null");
        }
        return new TimeWindow(date, date.atTime(from), date.atTime(to));
    }

    public TimeWindow withBuffers(int bufferBeforeMin, int bufferAfterMin) {
        // Sin recortar al día: un montaje/desmontaje que cruza medianoche ocupa el día adyacente
        // y debe poder solaparse con eventos de ese día (hallazgo 3.8).
        return new TimeWindow(date, start.minusMinutes(bufferBeforeMin), end.plusMinutes(bufferAfterMin));
    }

    /**
     * Porción de la ventana que cae dentro de {@code day} (00:00–24:00), para mostrar ocupación diaria.
     * Devuelve null si no la intersecta.
     */
    public TimeWindow clampToDay(LocalDate day) {
        LocalDateTime dayStart = day.atStartOfDay();
        LocalDateTime dayEnd = day.plusDays(1).atStartOfDay();
        LocalDateTime clampedStart = start.isBefore(dayStart) ? dayStart : start;
        LocalDateTime clampedEnd = end.isAfter(dayEnd) ? dayEnd : end;
        return clampedStart.isBefore(clampedEnd) ? new TimeWindow(day, clampedStart, clampedEnd) : null;
    }

    public boolean overlaps(TimeWindow other) {
        return this.start.isBefore(other.end) && other.start.isBefore(this.end);
    }

    public String formattedStart() {
        return format(start, false);
    }

    public String formattedEnd() {
        return format(end, true);
    }

    private String format(LocalDateTime value, boolean isEnd) {
        if (isEnd && value.toLocalTime().equals(LocalTime.MIDNIGHT) && value.toLocalDate().isAfter(date)) {
            return "24:00";
        }
        return value.toLocalTime().format(FORMATTER);
    }
}