import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const farms = await prisma.farm.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } });
  console.table(farms);

  // Also check casual worker counts per farmId
  const counts = await prisma.casualWorker.groupBy({
    by: ["farmId", "farm"],
    _count: true,
  });
  console.log("\nCasual workers per farm:");
  console.table(counts.map(c => ({ farmId: c.farmId, farm: c.farm, count: c._count })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
