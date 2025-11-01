import prisma from '@my-better-t-app/db';

/**
 * Check if organization can be enabled (has active subscription, departments, and providers)
 */
export async function canEnableOrganization(organizationId: string): Promise<boolean> {
  // Check if organization has active subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      organizationId,
      status: 'active',
    },
  });

  if (!subscription) {
    return false;
  }

  // Check if organization has at least one department
  const departmentCount = await prisma.department.count({
    where: { organizationId },
  });

  if (departmentCount === 0) {
    return false;
  }

  // Check if organization has at least one provider
  const providerCount = await prisma.provider.count({
    where: {
      department: {
        organizationId,
      },
    },
  });

  if (providerCount === 0) {
    return false;
  }

  return true;
}

/**
 * Enable organization if all conditions are met
 */
export async function tryEnableOrganization(organizationId: string): Promise<boolean> {
  const canEnable = await canEnableOrganization(organizationId);
  
  if (canEnable) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { enabled: true },
    });
    return true;
  }
  
  return false;
}

/**
 * Disable organization if conditions are no longer met
 */
export async function checkAndDisableOrganization(organizationId: string): Promise<void> {
  const canEnable = await canEnableOrganization(organizationId);
  
  if (!canEnable) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { enabled: false },
    });
  }
}

