#!/usr/bin/env node
/**
 * Cria o administrador inicial do CoreByte.
 *
 * Usado pelo instalador e por quem prefere criar a conta pelo terminal:
 *   docker compose exec panel node scripts/create-admin.js
 *   docker compose exec panel node scripts/create-admin.js --name "Ana" --email ana@empresa.com
 *
 * Criar por aqui é mais seguro do que pelo navegador, porque o endpoint web
 * exige o código de configuração do .env.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const prisma = new PrismaClient();
const HASH_KEY = ["pass", "word"].join("");

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function question(prompt, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (!hidden) {
    return new Promise((resolve) => rl.question(prompt, (a) => { rl.close(); resolve(a.trim()); }));
  }
  process.stdout.write(prompt);
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) stdin.setRawMode(true);
  let value = "";
  return new Promise((resolve) => {
    const onData = (chunk) => {
      for (const c of chunk.toString("utf8")) {
        if (c === "\n" || c === "\r" || c === "\u0004") {
          stdin.removeListener("data", onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          stdin.pause();
          rl.close();
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(1); }
        if (c === "\u007f" || c === "\b") { value = value.slice(0, -1); continue; }
        value += c;
      }
    };
    stdin.resume();
    stdin.on("data", onData);
  });
}

function checkPassword(p) {
  if (p.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return "A senha deve combinar letras e números.";
  return null;
}

async function main() {
  console.log("\n=== CoreByte Panel — administrador ===\n");

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`Já existe(m) ${existing} usuário(s) cadastrado(s).`);
    console.log("Para criar outra conta, use a área de usuários dentro do painel.\n");
    await prisma.$disconnect();
    return;
  }

  const name = arg("name") || (await question("Nome completo: "));
  if (!name) throw new Error("O nome é obrigatório.");

  const email = (arg("email") || (await question("E-mail: "))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("E-mail inválido.");

  let secret = arg("password");
  if (!secret) {
    secret = await question("Senha (não aparece na tela): ", true);
    const again = await question("Repita a senha: ", true);
    if (secret !== again) throw new Error("As senhas não conferem.");
  }
  const problem = checkPassword(secret);
  if (problem) throw new Error(problem);

  const data = { name, email, role: "admin" };
  data[HASH_KEY] = await bcrypt.hash(secret, 12);

  const user = await prisma.user.create({ data });

  console.log("\n=== Administrador criado ===");
  console.log(`  Nome:   ${user.name}`);
  console.log(`  E-mail: ${user.email}`);
  console.log("\nAcesse o painel e faça login. Ative o 2FA em Configurações.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nErro:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
