import prisma from '@booking-for-all/db';

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

/**
 * Check if organization has an active subscription
 */
export async function hasActiveSubscription(organizationId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      organizationId,
      status: 'active',
    },
  });

  return !!subscription;
}

/**
 * Check if organization is active (enabled is true).
 * Otherwise throws an AppError indicating it is suspended/frozen.
 */
import { AppError } from '../errors/AppError';

export async function verifyOrganizationActive(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { enabled: true, status: true },
  });

  if (!org) {
    throw new AppError('Organization not found', 'NOT_FOUND', 404);
  }

  // If the organization is disabled and the status is one of the suspended states, freeze it.
  const frozenStatuses = ['SUSPENDED', 'REFUND_REQUESTED', 'PAYMENT_FAILED', 'SUBSCRIPTION_DELETED'];
  if (!org.enabled && frozenStatuses.includes(org.status)) {
    throw new AppError(
      `Organization activities are frozen. Status: ${org.status}`,
      'ORGANIZATION_FROZEN',
      403
    );
  }
}
