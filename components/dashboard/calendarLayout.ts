/**
 * Akıllı Takvim — saf yerleşim yardımcıları (DOM/React yok, test edilebilir).
 * Tarihler "YYYY-MM-DD" anahtarlarıdır; hafta Pazartesi başlar (Türkiye).
 */

import { addDaysKey, parseDateKey, utcDateKey } from "@/lib/holidays";

export const CALENDAR_WEEKS = 6;
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Türkiye'de bugünün anahtarı. */
export function todayKeyTR(now: Date = new Date()): string {
  return utcDateKey(new Date(now.getTime() + TR_OFFSET_MS));
}

/** Ayın 6 haftalık ızgarası (42 gün), ilk hücre ayın 1'ini içeren haftanın Pazartesi'si. */
export function monthGridKeys(year: number, month0: number): string[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const startKey = addDaysKey(utcDateKey(first), -offset);
  return Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => addDaysKey(startKey, i));
}

export function keyMonth0(key: string): number {
  return parseDateKey(key)!.getUTCMonth();
}

export function keyDay(key: string): number {
  return parseDateKey(key)!.getUTCDate();
}

/** 0=Pazartesi … 6=Pazar */
export function keyWeekdayMon0(key: string): number {
  return (parseDateKey(key)!.getUTCDay() + 6) % 7;
}

/** "05.10.2026" */
export function formatKeyTR(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y}`;
}

export interface SpanEvent {
  start: string;
  end: string;
}

export interface WeekSegment<E extends SpanEvent> {
  event: E;
  /** 0–6, hafta içindeki ilk / son sütun (kırpılmış) */
  colStart: number;
  colEnd: number;
  lane: number;
  /** Etkinlik önceki haftadan geliyor / sonraki haftaya sürüyor */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Bir haftanın bar yerleşimi: çakışmayan şeritlere (lane) açgözlü atama.
 * Sıra: erken başlayan → uzun süren → çağıranın verdiği sıra. maxLanes'i
 * aşan segmentler gizlenir; hiddenByDay her gün için gizlenen etkinlik
 * sayısını verir ("+N daha"). Aynı gün çok etkinlik olsa da hücre büyümez.
 */
export function layoutWeek<E extends SpanEvent>(
  weekKeys: string[],
  events: E[],
  maxLanes: number
): { segments: WeekSegment<E>[]; hiddenByDay: number[] } {
  const weekStart = weekKeys[0];
  const weekEnd = weekKeys[weekKeys.length - 1];
  const colOf = (key: string) => weekKeys.indexOf(key);

  const candidates = events
    .map((event, order) => ({ event, order }))
    .filter(({ event }) => event.end >= weekStart && event.start <= weekEnd)
    .map(({ event, order }) => {
      const colStart = event.start < weekStart ? 0 : colOf(event.start);
      const colEnd = event.end > weekEnd ? weekKeys.length - 1 : colOf(event.end);
      return { event, order, colStart, colEnd };
    })
    .sort((a, b) => a.colStart - b.colStart || b.colEnd - b.colStart - (a.colEnd - a.colStart) || a.order - b.order);

  const laneEnds: number[] = []; // her şeridin son dolu sütunu
  const segments: WeekSegment<E>[] = [];
  const hiddenByDay = new Array(weekKeys.length).fill(0);

  for (const c of candidates) {
    let lane = laneEnds.findIndex((end) => end < c.colStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(c.colEnd);
    } else {
      laneEnds[lane] = c.colEnd;
    }
    if (lane < maxLanes) {
      segments.push({
        event: c.event,
        colStart: c.colStart,
        colEnd: c.colEnd,
        lane,
        continuesBefore: c.event.start < weekStart,
        continuesAfter: c.event.end > weekEnd,
      });
    } else {
      for (let col = c.colStart; col <= c.colEnd; col++) hiddenByDay[col]++;
    }
  }
  return { segments, hiddenByDay };
}

/** Bir güne değen etkinlikler ("+N daha" listesi). */
export function eventsOnDay<E extends SpanEvent>(events: E[], key: string): E[] {
  return events.filter((e) => e.start <= key && e.end >= key);
}
