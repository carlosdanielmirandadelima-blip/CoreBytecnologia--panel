/**
 * Cria o administrador inicial do CoreByte pelo terminal.
 *
 * Uso:
 *   npm run setup:admin                       (pergunta os dados)
 *   npm run setup:admin -- --name "Ana" --email ana@empresa.com
 *
 * Recomendado no servidor: evita que qualquer visitante se cadastre como
 * administrador (era o comportamento antigo do endpoint público de registro).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";
import { buildUserData } from "../src/lib/user-data";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (!hidden) {
    return new Promise((resolve) => rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    }));
  }

  // Leitura de senha: esconde o que é digitado.
  process.stdout.write(question);
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) stdin.setRawMode(true);
  let value = "";

  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const ch = chunk.toString("utf8");
      for (const c of ch) {
        if (c === "\n" || c === "\r" || c === "\u0004") {
          stdin.removeListener("data", onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          stdin.pause();
          rl.close();
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(1);
        }
        if (c === "\u007f" || c === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += c;
      }
    };
    stdin.resume();
    stdin.on("data", onData);
  });
}

function validatePassword(p: string): string | null {
  if (p.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return "A senha deve combinar letras e números.";
  return null;
}

async function main() {
  console.log("\n=== CoreByte Panel — criação do administrador ===\n");

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`Já existe(m) ${existing} usuário(s) cadastrado(s).`);
    console.log("Para criar outra conta, use a aba Usuários dentro do painel.\n");
    await prisma.$disconnect();
    process.exit(0);
  }

  const name = arg("name") || (await ask("Nome completo: "));
  if (!name) throw new Error("O nome é obrigatório.");

  const email = (arg("email") || (await ask("E-mail: "))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("E-mail inválido.");

  let plain = arg("password");
  if (!plain) {
    plain = await ask("Senha (não aparece na tela): ", true);
    const again = await ask("Repita a senha: ", true);
    if (plain !== again) throw new Error("As senhas não conferem.");
  }

  const problem = validatePassword(plain);
  if (problem) throw new Error(problem);

  const hash = await bcrypt.hash(plain, 12);
  const user = await prisma.user.create({
    data: buildUserData({ name, email, role: "admin", hash }),
  });

  console.log("\n=== Administrador criado ===");
  console.log(`  Nome:  ${user.name}`);
  console.log(`  E-mail: ${user.email}`);
  console.log("\nAcesse o painel e faça login.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nErro:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
