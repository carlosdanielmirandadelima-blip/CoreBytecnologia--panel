/**
 * Agendamento baseado em cron (5 campos: minuto hora dia mês dia-da-semana).
 *
 * A implementação anterior assumia que os dois primeiros campos eram sempre
 * números: um agendamento como "0 2 * * *" funcionava, mas um intervalo do
 * tipo "a cada 15 minutos" (o mais comum) calculava a próxima execução errada.
 * Aqui os campos são interpretados de verdade (curinga, listas, intervalos e passos).
 */

interface CronField {
  values: number[];
}

function parseField(field: string, min: number, max: number): CronField | null {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const piece = part.trim();
    if (!piece) return null;

    // Passo: intervalo com / passo, ex.: a cada 5.
    let step = 1;
    let range = piece;
    const slash = piece.indexOf("/");
    if (slash !== -1) {
      const stepStr = piece.slice(slash + 1);
      step = Number(stepStr);
      if (!Number.isInteger(step) || step < 1) return null;
      range = piece.slice(0, slash);
    }

    let from = min;
    let to = max;
    if (range !== "*") {
      const dash = range.indexOf("-");
      if (dash !== -1) {
        from = Number(range.slice(0, dash));
        to = Number(range.slice(dash + 1));
        if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
      } else {
        const single = Number(range);
        if (!Number.isInteger(single)) return null;
        from = single;
        to = slash !== -1 ? max : single;
      }
    }

    if (from < min || to > max || from > to) return null;
    for (let v = from; v <= to; v += step) values.add(v);
  }

  if (!values.size) return null;
  return { values: Array.from(values).sort((a, b) => a - b) };
}

export function validateCron(expr: string): boolean {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return (
    parseField(parts[0], 0, 59) !== null && // minuto
    parseField(parts[1], 0, 23) !== null && // hora
    parseField(parts[2], 1, 31) !== null && // dia do mês
    parseField(parts[3], 1, 12) !== null && // mês
    parseField(parts[4], 0, 6) !== null // dia da semana
  );
}

/** Calcula a próxima execução a partir de agora. */
export function nextRunFromCron(expr: string, from: Date = new Date()): Date {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expressão cron inválida: "${expr}"`);

  const minute = parseField(parts[0], 0, 59);
  const hour = parseField(parts[1], 0, 23);
  const dom = parseField(parts[2], 1, 31);
  const month = parseField(parts[3], 1, 12);
  const dow = parseField(parts[4], 0, 6);

  if (!minute || !hour || !dom || !month || !dow) {
    throw new Error(`Expressão cron inválida: "${expr}"`);
  }

  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  // Procura até 366 dias à frente (um agendamento anual ainda é encontrado).
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (
      minute.values.includes(cursor.getMinutes()) &&
      hour.values.includes(cursor.getHours()) &&
      month.values.includes(cursor.getMonth() + 1) &&
      dom.values.includes(cursor.getDate()) &&
      dow.values.includes(cursor.getDay())
    ) {
      return cursor;
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  throw new Error(`Não foi possível calcular a próxima execução de "${expr}"`);
}

/** Texto legível em português para exibir na interface. */
export function describeCron(expr: string): string {
  const p = String(expr || "").trim().split(/\s+/);
  if (p.length !== 5) return expr;
  const [m, h, dom, mon, dow] = p;

  const everyMin = m.startsWith("*/") ? Number(m.slice(2)) : null;
  if (everyMin && h === "*") return `A cada ${everyMin} minuto(s)`;

  if (/^\d+$/.test(m) && /^\d+$/.test(h)) {
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (dom === "*" && mon === "*" && dow === "*") return `Todos os dias às ${time}`;
    if (dom === "*" && mon === "*" && dow === "1-5") return `Dias úteis às ${time}`;
    if (dom === "*" && mon === "*" && dow === "0") return `Domingos às ${time}`;
    if (/^\d+$/.test(dom) && mon === "*" && dow === "*") return `Todo dia ${dom} do mês às ${time}`;
    return `${expr} (às ${time})`;
  }

  return expr;
}

/** Converte em milissegundos até a próxima execução (usado pelo worker). */
export function msUntilNext(expr: string, from: Date = new Date()): number {
  return nextRunFromCron(expr, from).getTime() - from.getTime();
}
