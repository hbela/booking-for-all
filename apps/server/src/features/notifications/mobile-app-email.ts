import prisma from '@booking-for-all/db';
import { Resend } from 'resend';
import i18n from '@booking-for-all/i18n';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

const MOBILE_APP_LAUNCHED = process.env.MOBILE_APP_LAUNCHED === 'true';

export async function sendMobileAppNotificationEmail(
  userId: string,
  userEmail: string,
  userName: string,
  language: string = 'en'
): Promise<void> {
  // Check if mobile app is launched
  if (!MOBILE_APP_LAUNCHED) {
    return; // Don't send if app not launched yet
  }

  try {
    // Check if user has already been notified
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        metadata: true,
      },
    });

    if (!user) {
      return;
    }

    // Check metadata for notification status
    const metadata = (user.metadata as any) || {};
    if (metadata.mobileAppNotifiedAt) {
      // Already notified
      return;
    }

    // Get user's organizations for deep linking
    const memberships = await prisma.member.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      take: 1, // Use first organization for deep link
    });

    const organization = memberships[0]?.organization;
    const orgSlug = organization?.slug || '';
    const orgId = organization?.id || '';

    // Build deep link
    const deepLink = orgId 
      ? `bookingapp://org?orgId=${orgId}&orgSlug=${orgSlug}`
      : 'bookingapp://';

    // Get app store URLs
    const iosUrl = process.env.MOBILE_APP_IOS_URL || 'https://apps.apple.com/app/booking-for-all';
    const androidUrl = process.env.MOBILE_APP_ANDROID_URL || 'https://play.google.com/store/apps/details?id=com.bookingforall.app';

    // Send email
    await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: i18nInstance.t('emails.mobileApp.subject', { lng: language }),
      html: `
        <h2>${i18nInstance.t('emails.mobileApp.greeting', { lng: language })}</h2>
        <p>${i18nInstance.t('emails.mobileApp.dear', { lng: language, name: userName })}</p>
        <p>${i18nInstance.t('emails.mobileApp.announcement', { lng: language })}</p>
        
        <h3>${i18nInstance.t('emails.mobileApp.features', { lng: language })}</h3>
        <ul>
          <li><strong>${i18nInstance.t('emails.mobileApp.voiceBooking', { lng: language })}</strong></li>
          <li><strong>${i18nInstance.t('emails.mobileApp.easyAccess', { lng: language })}</strong></li>
          <li><strong>${i18nInstance.t('emails.mobileApp.onTheGo', { lng: language })}</strong></li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${iosUrl}" style="display: inline-block; margin: 10px; padding: 15px 30px; background-color: #007AFF; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            ${i18nInstance.t('emails.mobileApp.downloadIOS', { lng: language })}
          </a>
          <a href="${androidUrl}" style="display: inline-block; margin: 10px; padding: 15px 30px; background-color: #34A853; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            ${i18nInstance.t('emails.mobileApp.downloadAndroid', { lng: language })}
          </a>
        </div>
        
        ${orgId ? `
        <p>${i18nInstance.t('emails.mobileApp.deepLink', { lng: language })}</p>
        <p><a href="${deepLink}">${i18nInstance.t('emails.mobileApp.openApp', { lng: language, orgName: organization?.name })}</a></p>
        ` : ''}
        
        <p>${i18nInstance.t('emails.mobileApp.bestRegards', { lng: language })}<br>${i18nInstance.t('emails.mobileApp.theTeam', { lng: language })}</p>
      `,
    });

    // Mark as notified in user metadata
    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: JSON.stringify({
          ...metadata,
          mobileAppNotifiedAt: new Date().toISOString(),
        }),
      },
    });

    console.log(`✅ Mobile app notification email sent to: ${userEmail}`);
  } catch (error) {
    console.error('❌ Failed to send mobile app notification email:', error);
    // Don't throw - email failure shouldn't break login
  }
}

