import assert from "assert";

/**
 * Demultiplexação dos logs do Docker.
 *
 * Quando o container NÃO tem TTY, a API do Docker devolve stdout e stderr
 * multiplexados com um cabeçalho de 8 bytes por frame:
 *   [0]     tipo do stream (1 = stdout, 2 = stderr)
 *   [1..3]  reservado (zeros)
 *   [4..7]  tamanho do payload em big-endian
 *
 * Sem remover esses cabeçalhos o terminal mostra lixo binário — era
 * exatamente o que acontecia na versão anterior (`logs.toString()`).
 */

const HEADER_SIZE = 8;
const STREAM_STDERR = 2;

export interface DemuxedLogs {
  stdout: string;
  stderr: string;
  /** Log completo em ordem, com stderr e stdout intercalados. */
  combined: string;
}

/**
 * Remove os cabeçalhos de um Buffer multiplexado.
 * Se o buffer não parecer multiplexado, devolve o texto como está.
 */
export function demuxLogBuffer(input: Buffer, tty = false): DemuxedLogs {
  if (tty) {
    const text = input.toString("utf8");
    return { stdout: text, stderr: "", combined: text };
  }

  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const allChunks: string[] = [];

  let offset = 0;
  let parsedAnyFrame = false;

  while (offset + HEADER_SIZE <= input.length) {
    const type = input[offset];
    // Um frame válido tem tipo 0/1/2 e os 3 bytes seguintes zerados.
    if (type > STREAM_STDERR || input[offset + 1] !== 0 || input[offset + 2] !== 0 || input[offset + 3] !== 0) {
      break;
    }
    const size = input.readUInt32BE(offset + 4);
    const start = offset + HEADER_SIZE;
    const end = start + size;
    if (end > input.length) break;

    const payload = input.subarray(start, end).toString("utf8");
    parsedAnyFrame = true;
    allChunks.push(payload);
    if (type === STREAM_STDERR) errChunks.push(payload);
    else outChunks.push(payload);

    offset = end;
  }

  // Se nada foi interpretado como frame, trata como texto simples.
  if (!parsedAnyFrame) {
    const text = input.toString("utf8");
    return { stdout: text, stderr: "", combined: text };
  }

  // Sobra eventual sem cabeçalho válido.
  if (offset < input.length) {
    const tail = input.subarray(offset).toString("utf8");
    allChunks.push(tail);
    outChunks.push(tail);
  }

  return {
    stdout: outChunks.join(""),
    stderr: errChunks.join(""),
    combined: allChunks.join(""),
  };
}

/** Versão de conveniência: devolve só o texto combinado. */
export function demuxToText(input: Buffer, tty = false): string {
  return demuxLogBuffer(input, tty).combined;
}

/** Verifica se um Buffer parece vir multiplexado (usado em testes). */
export function looksMultiplexed(buf: Buffer): boolean {
  if (buf.length < HEADER_SIZE) return false;
  const type = buf[0];
  return type >= 0 && type <= 2 && buf[1] === 0 && buf[2] === 0 && buf[3] === 0;
}

assert(HEADER_SIZE === 8);
