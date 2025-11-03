import { readFileSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../apps/server/.env" });

/**
 * Migration script to convert SQLite backup to PostgreSQL
 * 
 * Usage:
 *   cd packages/db
 *   pnpm tsx scripts/migrate-sqlite-to-postgres.ts
 */

async function init() {
  // Dynamic import to handle ESM module resolution
  const clientModule = await import("../prisma/generated/index.js");
  const { PrismaClient } = clientModule;
  const { withAccelerate } = await import("@prisma/extension-accelerate");

  // Create Prisma Client - check if using Accelerate
  const databaseUrl = process.env.DATABASE_URL;
  const isAccelerateUrl = databaseUrl?.startsWith("prisma+postgres://");

const basePrismaClient = new PrismaClient({
  log: [], // Disable Prisma logs to reduce noise - we'll handle errors ourselves
});

  // Apply Accelerate extension only if using Accelerate URL
  const prisma = isAccelerateUrl
    ? basePrismaClient.$extends(withAccelerate())
    : basePrismaClient;

  return prisma;
}

// Tables that need to be inserted in order (respecting foreign keys)
const TABLE_ORDER = [
  "user",
  "account",
  "session",
  "verification",
  "organization",
  "member",
  "invitation",
  "department",
  "provider",
  "event",
  "booking",
  "product",
  "subscription",
  "payment", // Payment depends on subscription
  "apikey",
];

interface InsertData {
  table: string;
  values: Record<string, any>[];
}

function parseSQLiteBackup(filePath: string): InsertData[] {
  const content = readFileSync(filePath, "utf-8");
  const inserts: InsertData[] = [];
  
  // Extract table name and columns from CREATE TABLE statements
  const tableColumns: Record<string, string[]> = {};
  const createTableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([^)]+)\)/gi;
  let match;
  
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columnsDef = match[2];
    const columns = columnsDef
      .split(",")
      .map((col) => col.trim().split(/\s+/)[0])
      .filter((col) => col && !col.startsWith("CONSTRAINT"));
    tableColumns[tableName] = columns;
  }
  
  // Extract INSERT statements - use multiline matching to handle long strings
  // Match everything between VALUES and the closing parenthesis, handling nested quotes
  const insertRegex = /INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(((?:[^()]|\([^()]*\))*)\)/gi;
  
  while ((match = insertRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    const valuesStr = match[3];
    
    if (!tableColumns[tableName]) {
      console.warn(`⚠️  Table ${tableName} not found in CREATE TABLE statements`);
      continue;
    }
    
    const columns = columnsStr.split(",").map((c) => c.trim().replace(/"/g, ""));
    const values = parseValues(valuesStr);
    
    if (columns.length !== values.length) {
      console.warn(
        `⚠️  Column/Value mismatch in ${tableName}: ${columns.length} columns, ${values.length} values`
      );
      console.warn(`   Columns: ${columns.join(", ")}`);
      console.warn(`   Values preview: ${values.slice(0, 5).join(", ")}...`);
      // Try to continue anyway - might be a parsing issue
      if (values.length < columns.length) {
        // Pad with nulls if values are missing
        while (values.length < columns.length) {
          values.push(null);
        }
      } else {
        // Skip if too many values
        continue;
      }
    }
    
    const row: Record<string, any> = {};
    columns.forEach((col, idx) => {
      let value = values[idx];
      
      // Convert SQLite datetime integers to PostgreSQL timestamps
      // Handle createdAt, updatedAt, expiresAt, and also start/end for events
      // Note: We'll do this conversion in mapRowToPrisma to ensure it happens correctly
      
      // Handle NULL
      if (value === null || value === "NULL") {
        row[col] = null;
      } else {
        row[col] = value;
      }
    });
    
    if (!inserts.find((i) => i.table === tableName)) {
      inserts.push({ table: tableName, values: [] });
    }
    
    inserts.find((i) => i.table === tableName)!.values.push(row);
  }
  
  return inserts;
}

function parseValues(valuesStr: string): any[] {
  const values: any[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let parenDepth = 0;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    
    if (!inString && char === "(") {
      parenDepth++;
      current += char;
    } else if (!inString && char === ")") {
      parenDepth--;
      current += char;
    } else if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar) {
      // Check if this is an escaped quote
      if (valuesStr[i - 1] === "\\") {
        current += char;
      } else {
        // Check if next char is also a quote (double quote for escaping)
        if (valuesStr[i + 1] === stringChar) {
          // Double quote escape - skip this and next char, add one
          current += stringChar;
          i++; // Skip next char
        } else {
          // End of string
          inString = false;
          stringChar = "";
          current += char;
        }
      }
    } else if (!inString && parenDepth === 0 && char === ",") {
      values.push(parseValue(current.trim()));
      current = "";
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }
  
  return values;
}

function parseValue(value: string): any {
  value = value.trim();
  
  // Handle NULL
  if (value === "NULL" || value === "null") {
    return null;
  }
  
  // Handle empty strings - keep as empty string, not null
  if (value === "''" || value === '""') {
    return "";
  }
  
  // Handle quoted strings
  if ((value.startsWith("'") && value.endsWith("'")) || 
      (value.startsWith('"') && value.endsWith('"'))) {
    const unquoted = value.slice(1, -1);
    // Replace escaped quotes
    return unquoted.replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  
  // Try to parse as number (but not if it's a string that looks like a number)
  if (/^-?\d+$/.test(value) && !value.startsWith("'") && !value.startsWith('"')) {
    return parseInt(value, 10);
  }
  
  if (/^-?\d+\.\d+$/.test(value) && !value.startsWith("'") && !value.startsWith('"')) {
    return parseFloat(value);
  }
  
  return value;
}

async function migrateData() {
  const prisma = await init();
  
  try {
    console.log("🚀 Starting SQLite to PostgreSQL migration...\n");
    
    // Try multiple possible paths for the backup file
    const possiblePaths = [
      "C:\\sqlite\\db\\express.db.backup.sql", // Absolute path
      join(process.cwd(), "../../../sqlite/db/express.db.backup.sql"), // Relative from packages/db
      join(process.cwd(), "../../sqlite/db/express.db.backup.sql"), // Alternative relative
    ];
    
    let backupPath: string | null = null;
    for (const path of possiblePaths) {
      try {
        readFileSync(path, "utf-8");
        backupPath = path;
        break;
      } catch {
        // Try next path
      }
    }
    
    if (!backupPath) {
      throw new Error(
        `Backup file not found. Tried:\n${possiblePaths.map(p => `  - ${p}`).join("\n")}\n\nPlease ensure the file exists at C:\\sqlite\\db\\express.db.backup.sql`
      );
    }
    
    console.log(`📖 Reading backup file: ${backupPath}`);
    
    const insertData = parseSQLiteBackup(backupPath);
    
    console.log(`\n📊 Found data for ${insertData.length} tables:\n`);
    insertData.forEach((data) => {
      console.log(`   - ${data.table}: ${data.values.length} rows`);
    });
    
    // Insert data in order, respecting TABLE_ORDER
    const orderedData = insertData.sort((a, b) => {
      const aIndex = TABLE_ORDER.indexOf(a.table);
      const bIndex = TABLE_ORDER.indexOf(b.table);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    for (const data of orderedData) {
      if (!TABLE_ORDER.includes(data.table)) {
        console.warn(`⚠️  Skipping unknown table: ${data.table}`);
        continue;
      }
      
      if (data.values.length === 0) {
        console.log(`\n⏭️  Skipping ${data.table} (no data)`);
        continue;
      }
      
      console.log(`\n📥 Inserting ${data.values.length} rows into ${data.table}...`);
      
      try {
        let inserted = 0;
        let errors = 0;
        const model = (prisma as any)[data.table];
        
        if (!model) {
          console.error(`❌ Model ${data.table} not found in Prisma client`);
          continue;
        }
        
        // Verify parent records exist for foreign key relationships
        if (data.table === "account") {
          // Check if users exist
          const userCount = await (prisma as any).user.count();
          if (userCount === 0) {
            console.error(`❌ Cannot insert accounts: No users found in database. Users must be inserted first.`);
            console.error(`   Please ensure users are inserted before accounts.`);
            continue;
          }
          console.log(`   ✓ Verified ${userCount} users exist`);
        }
        
        for (const row of data.values) {
          try {
            // Map SQLite field names to Prisma model names
            const mappedRow = mapRowToPrisma(data.table, row);
            
            // Skip rows with required foreign keys that are null
            if (data.table === "session" && !mappedRow.userId) {
              errors++;
              if (errors <= 3) {
                console.warn(`⚠️  Skipping session with null userId: ${mappedRow.id}`);
              }
              continue;
            }
            
            // Try create first, fallback to update if exists
            try {
              await model.create({
                data: mappedRow,
              });
              inserted++;
            } catch (error: any) {
              // If unique constraint violation, try update (this is expected on re-runs)
              if (error.code === "P2002" || 
                  error.message?.includes("Unique constraint") || 
                  error.message?.includes("already exists") ||
                  error.message?.includes("duplicate key") ||
                  error.message?.includes("unique constraint")) {
                const idField = mappedRow.id;
                if (idField) {
                  try {
                    await model.update({
                      where: { id: idField },
                      data: mappedRow,
                    });
                    inserted++; // Count as inserted since we updated
                  } catch (updateError: any) {
                    // If update also fails, skip this row
                    errors++;
                    if (errors <= 3) {
                      console.warn(`⚠️  Could not create or update ${data.table} with id ${idField}: ${updateError.message}`);
                    }
                    continue;
                  }
                } else {
                  errors++;
                  if (errors <= 3) {
                    console.warn(`⚠️  Unique constraint failed for ${data.table} but no id field found`);
                  }
                  continue;
                }
              } else if (error.message?.includes("Foreign key constraint") || error.message?.includes("userId_fkey") || error.message?.includes("organizationId_fkey") || error.message?.includes("departmentId_fkey") || error.message?.includes("providerId_fkey") || error.message?.includes("eventId_fkey") || error.message?.includes("memberId_fkey")) {
                // Foreign key constraint - parent record might not exist yet
                // This shouldn't happen if TABLE_ORDER is correct, but log it and skip
                errors++;
                if (errors <= 3) {
                  console.warn(
                    `⚠️  Foreign key constraint failed for ${data.table}. Parent record may not exist. Skipping this row.`
                  );
                  console.warn(`   Row ID: ${mappedRow.id || mappedRow._id}`);
                  // Try to identify which foreign key is missing
                  if (mappedRow.userId) {
                    console.warn(`   Referenced userId: ${mappedRow.userId}`);
                  }
                  if (mappedRow.organizationId) {
                    console.warn(`   Referenced organizationId: ${mappedRow.organizationId}`);
                  }
                }
                // Skip this row - parent doesn't exist
                continue;
              } else {
                throw error;
              }
            }
            
            if (inserted > 0 && inserted % 100 === 0) {
              process.stdout.write(".");
            }
          } catch (error: any) {
            errors++;
            if (errors <= 5) {
              // Only show first 5 errors
              console.error(
                `\n❌ Error inserting row into ${data.table}:`,
                error.message
              );
            }
          }
        }
        
        console.log(
          `\n✅ ${data.table}: ${inserted} inserted, ${errors} errors`
        );
      } catch (error: any) {
        console.error(`\n❌ Error migrating ${data.table}:`, error.message);
        throw error;
      }
    }
    
    console.log("\n\n✅ Migration completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function mapRowToPrisma(table: string, row: Record<string, any>): Record<string, any> {
  // Map SQLite field names to Prisma model field names
  // Most fields use the same name, but some need conversion
  
  const mapped: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(row)) {
    // Prisma models use 'id' (mapped to '_id' in database)
    // Convert _id to id for Prisma
    let prismaKey = key === "_id" ? "id" : key;
    
    // Handle special cases
    if (table === "user" && key === "role") {
      // Ensure role is uppercase enum value
      if (typeof value === "string") {
        const upperValue = value.toUpperCase();
        // Map common variations
        const roleMap: Record<string, string> = {
          USER: "CLIENT",
          ADMIN: "ADMIN",
          OWNER: "OWNER",
          PROVIDER: "PROVIDER",
          CLIENT: "CLIENT",
        };
        mapped[prismaKey] = roleMap[upperValue] || "CLIENT";
        continue;
      }
    }
    
    // Convert SQLite datetime integers (milliseconds since epoch) to Date objects
    // Handle createdAt, updatedAt, expiresAt, start/end for events, subscription dates
    if (
      (key.includes("At") || key === "expiresAt" || key === "start" || key === "end" ||
       key === "currentPeriodStart" || key === "currentPeriodEnd" || key === "cancelledAt" ||
       key === "lastRequest") &&
      typeof value === "number" &&
      value > 1000000000000 // Likely a timestamp in milliseconds
    ) {
      mapped[prismaKey] = new Date(value);
      continue;
    }
    
    // Convert SQLite boolean representation
    // Only convert if it's explicitly a boolean field, not integer fields that happen to be 0/1
    if (typeof value === "number" && (value === 0 || value === 1)) {
      // Check if this field should be boolean based on column name
      // Include: verified fields, enabled, banned, isBooked, isActive, needsPasswordChange, emailVerified
      // Exclude integer fields like requestCount, remaining, amount, duration, etc.
      const isBooleanField = 
        (key.includes("verified") || key === "emailVerified" || key === "enabled" || key === "banned" || 
         key === "isBooked" || key === "isActive" || key === "needsPasswordChange") &&
        !key.includes("Count") && !key.includes("remaining") && !key.includes("amount") &&
        !key.includes("duration") && key !== "priceCents" && key !== "amount";
      
      if (isBooleanField) {
        mapped[prismaKey] = value === 1;
        continue;
      }
      // For integer fields that are 0/1, keep as number
      if (key === "requestCount" || key === "remaining" || key === "amount" || key === "duration") {
        mapped[prismaKey] = value;
        continue;
      }
    }
    
    // Handle emailVerified specifically if it's still a number
    if (key === "emailVerified" && typeof value === "number") {
      mapped[prismaKey] = value === 1;
      continue;
    }
    
    // Handle requestCount specifically - convert boolean back to integer if needed
    if (key === "requestCount") {
      if (typeof value === "boolean") {
        mapped[prismaKey] = value ? 1 : 0;
        continue;
      }
      if (typeof value === "number") {
        mapped[prismaKey] = value;
        continue;
      }
    }
    
    // Handle JSON metadata fields
    if (key === "metadata" && typeof value === "string" && value.startsWith('"')) {
      try {
        // Remove outer quotes if present
        const unquoted = value.replace(/^"|"$/g, '');
        mapped[prismaKey] = JSON.parse(unquoted);
        continue;
      } catch {
        // If parsing fails, keep original value
      }
    }
    
    mapped[prismaKey] = value;
  }
  
  return mapped;
}

// Run migration
migrateData()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

