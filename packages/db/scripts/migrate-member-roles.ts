/**
 * Migration script to populate role field in existing Member records
 * 
 * This script:
 * 1. Checks if the role column exists in the database
 * 2. Sets role to CLIENT for all existing members that have null role
 * 
 * Run with: npx tsx packages/db/scripts/migrate-member-roles.ts
 * 
 * NOTE: You must first:
 * 1. Run Prisma migration to add the role column:
 *    npx prisma migrate dev --name add_role_to_member --schema=packages/db/prisma/schema/schema.prisma
 * 2. Regenerate Prisma client:
 *    npx prisma generate --schema=packages/db/prisma/schema/schema.prisma
 */

import { PrismaClient } from '../prisma/generated/client';

const prisma = new PrismaClient();

async function migrateMemberRoles() {
  console.log('🔄 Starting Member role migration...');

  try {
    // First, check if the role column exists in the database using raw SQL
    const tableInfo = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'member' AND column_name = 'role'
    `;

    if (tableInfo.length === 0) {
      console.log('⚠️  Role column does not exist yet. Please run the Prisma migration first:');
      console.log('   npx prisma migrate dev --name add_role_to_member --schema=packages/db/prisma/schema/schema.prisma');
      console.log('   Then regenerate the client: npx prisma generate --schema=packages/db/prisma/schema/schema.prisma');
      return;
    }

    // Get total count of members
    const totalMembers = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM member
    `;
    const totalCount = Number(totalMembers[0]?.count || 0);
    console.log(`📊 Found ${totalCount} total members`);

    // Count members with null role
    const nullRoleMembers = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM member WHERE role IS NULL
    `;
    const nullCount = Number(nullRoleMembers[0]?.count || 0);
    console.log(`📊 Found ${nullCount} members with null role`);

    if (nullCount === 0) {
      console.log('✅ All members already have a role assigned');
      return;
    }

    // Update all members that don't have a role set (or have null role)
    // Using raw SQL to handle the update
    const updateResult = await prisma.$executeRaw`
      UPDATE member 
      SET role = 'CLIENT' 
      WHERE role IS NULL
    `;

    console.log(`✅ Updated ${updateResult} members with CLIENT role (default)`);

    // Optional: Set OWNER role for users who have OWNER role globally
    // Uncomment if you want to migrate based on User.role
    /*
    const ownerUsers = await prisma.user.findMany({
      where: { role: 'OWNER' },
      include: { members: true },
    });

    for (const user of ownerUsers) {
      for (const member of user.members) {
        await prisma.member.update({
          where: { id: member.id },
          data: { role: 'OWNER' },
        });
      }
    }
    console.log(`✅ Updated ${ownerUsers.length} users' memberships to OWNER role`);
    */

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateMemberRoles()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
