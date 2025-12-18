import prisma from "@booking-for-all/db";
import { Resend } from "resend";
import { initI18n } from "@booking-for-all/i18n";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const MOBILE_APP_LAUNCHED = process.env.MOBILE_APP_LAUNCHED === "true";

// Initialize i18n instance
let i18nInstance: Awaited<ReturnType<typeof initI18n>> | null = null;
const getI18nInstance = async () => {
  if (!i18nInstance) {
    i18nInstance = await initI18n();
  }
  return i18nInstance;
};

export async function sendMobileAppNotificationEmail(
  userId: string,
  userEmail: string,
  userName: string,
  language: string = "en"
): Promise<void> {
  // Check if mobile app is launched
  if (!MOBILE_APP_LAUNCHED) {
    return; // Don't send if app not launched yet
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
      },
    });

    if (!user) {
      return;
    }

    // Note: Metadata field doesn't exist on User model
    // If duplicate prevention is needed, consider adding a metadata field to the User model
    // or using a separate tracking table

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
    const orgSlug = organization?.slug || "";
    const orgId = organization?.id || "";

    // Build deep link
    const deepLink = orgId
      ? `bookingapp://org?orgId=${orgId}&orgSlug=${orgSlug}`
      : "bookingapp://";

    // Get app store URLs
    const iosUrl =
      process.env.MOBILE_APP_IOS_URL ||
      "https://apps.apple.com/app/booking-for-all";
    const androidUrl =
      process.env.MOBILE_APP_ANDROID_URL ||
      "https://play.google.com/store/apps/details?id=com.bookingforall.app";

    // Get i18n instance
    const i18n = await getI18nInstance();

    // Send email
    await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: i18n.t("emails.mobileApp.subject", { lng: language }),
      html: `
        <h2>${i18n.t("emails.mobileApp.greeting", { lng: language })}</h2>
        <p>${i18n.t("emails.mobileApp.dear", { lng: language, name: userName })}</p>
        <p>${i18n.t("emails.mobileApp.announcement", { lng: language })}</p>
        
        <h3>${i18n.t("emails.mobileApp.features", { lng: language })}</h3>
        <ul>
          <li><strong>${i18n.t("emails.mobileApp.voiceBooking", { lng: language })}</strong></li>
          <li><strong>${i18n.t("emails.mobileApp.easyAccess", { lng: language })}</strong></li>
          <li><strong>${i18n.t("emails.mobileApp.onTheGo", { lng: language })}</strong></li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${iosUrl}" style="display: inline-block; margin: 10px; padding: 15px 30px; background-color: #007AFF; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            ${i18n.t("emails.mobileApp.downloadIOS", { lng: language })}
          </a>
          <a href="${androidUrl}" style="display: inline-block; margin: 10px; padding: 15px 30px; background-color: #34A853; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            ${i18n.t("emails.mobileApp.downloadAndroid", { lng: language })}
          </a>
        </div>
        
        ${
          orgId
            ? `
        <p>${i18n.t("emails.mobileApp.deepLink", { lng: language })}</p>
        <p><a href="${deepLink}">${i18n.t("emails.mobileApp.openApp", { lng: language, orgName: organization?.name })}</a></p>
        `
            : ""
        }
        
        <p>${i18n.t("emails.mobileApp.bestRegards", { lng: language })}<br>${i18n.t("emails.mobileApp.theTeam", { lng: language })}</p>
      `,
    });

    // Note: Metadata field doesn't exist on User model
    // If tracking notification status is needed, consider adding a metadata field
    // or using a separate tracking table

    console.log(`✅ Mobile app notification email sent to: ${userEmail}`);
  } catch (error) {
    console.error("❌ Failed to send mobile app notification email:", error);
    // Don't throw - email failure shouldn't break login
  }
}
