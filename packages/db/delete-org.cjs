/**
 * Delete an organization and all related records from the database.
 *
 * Usage: node delete-org.cjs <organizationId>
 * Example: node delete-org.cjs 1bb85245-76d9-41e9-b86a-dec74b5d0528
 */

const { PrismaClient } = require('./prisma/generated');

const orgId = process.argv[2];

if (!orgId) {
  console.error('Usage: node delete-org.cjs <organizationId>');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

async function main() {
  // Verify the organization exists first
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    console.error(`Organization with id "${orgId}" not found.`);
    process.exit(1);
  }

  console.log(`Deleting organization: "${org.name}" (${orgId})...\n`);

  const results = await prisma.$transaction([
    prisma.booking.deleteMany({ where: { organizationId: orgId } }),
    prisma.event.deleteMany({ where: { organizationId: orgId } }),
    prisma.provider.deleteMany({ where: { organizationId: orgId } }),
    prisma.department.deleteMany({ where: { organizationId: orgId } }),
    prisma.subscription.deleteMany({ where: { organizationId: orgId } }),
    prisma.invitation.deleteMany({ where: { organizationId: orgId } }),
    prisma.member.deleteMany({ where: { organizationId: orgId } }),
    prisma.session.updateMany({ where: { activeOrganizationId: orgId }, data: { activeOrganizationId: null } }),
    prisma.organization.delete({ where: { id: orgId } }),
  ]);

  const labels = ['Bookings', 'Events', 'Providers', 'Departments', 'Subscriptions', 'Invitations', 'Members', 'Sessions nullified', 'Organization'];
  results.forEach((r, i) => {
    console.log(labels[i] + ': ' + (r.count !== undefined ? r.count + ' rows' : 'deleted'));
  });

  console.log('\nDone! All records deleted successfully.');
}

main()
  .catch(e => { console.error(e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());
