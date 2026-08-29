#!/usr/bin/env node
import { isProductionDatabase } from "./db-url.mjs";

if (process.env.ALLOW_DEMO_SEED === "true") {
  process.exit(0);
}

if (isProductionDatabase()) {
  console.error(
    "Refusing a destructive database command against production.\n" +
      "This will not run prisma migrate reset, db push --force-reset, or demo seed on Neon/Netlify.",
  );
  process.exit(1);
}
