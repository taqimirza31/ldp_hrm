/**
 * Microsoft Teams / Graph integration for creating interview meetings.
 *
 * Creates a calendar event with isOnlineMeeting: true and onlineMeetingProvider: teamsForBusiness;
 * Graph returns a Teams join URL. Requires application permission Calendars.ReadWrite.
 *
 * Env: MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID, TEAMS_MEETING_ORGANIZER_EMAIL.
 */

import { teamsConfig, isTeamsIntegrationConfigured } from "../config/teams";

export interface CreateInterviewMeetingParams {
  /** Meeting start (ISO string or Date) */
  start: string | Date;
  /** Meeting end (ISO string or Date) */
  end: string | Date;
  /** Title shown in calendar (e.g. "Interview: Senior Dev – John Doe") */
  subject: string;
  /** Work emails of interviewers (attendees) */
  interviewerEmails: string[];
  /** Optional: candidate email to add as attendee */
  candidateEmail?: string | null;
  /** Optional: body/description (plain text or HTML) */
  body?: string | null;
}

export interface CreateInterviewMeetingResult {
  success: boolean;
  /** Teams join URL (to store and send to candidate) */
  joinUrl?: string | null;
  /** Graph event ID (for updates/cancel later if needed) */
  eventId?: string | null;
  /** Error message when success is false */
  error?: string;
}

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_EVENTS_URL = (userPrincipalName: string) =>
  `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userPrincipalName)}/calendar/events`;

/**
 * Get an access token using client credentials (app-only).
 * Azure AD app must have Application permission Calendars.ReadWrite.
 */
async function getGraphToken(): Promise<string> {
  const { clientId, clientSecret, tenantId } = teamsConfig;
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: GRAPH_SCOPE,
    grant_type: "client_credentials",
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph token failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Create a Teams meeting for an interview. Uses Microsoft Graph when configured;
 * creates event with isOnlineMeeting: true and onlineMeetingProvider: teamsForBusiness.
 */
export async function createInterviewMeeting(
  params: CreateInterviewMeetingParams
): Promise<CreateInterviewMeetingResult> {
  const {
    start,
    end,
    subject,
    interviewerEmails,
    candidateEmail,
    body,
  } = params;

  if (!isTeamsIntegrationConfigured()) {
    return {
      success: false,
      error:
        "Teams integration not configured. Set MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID and TEAMS_MEETING_ORGANIZER_EMAIL in .env",
    };
  }

  const organizerEmail = teamsConfig.organizerEmail.trim();
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;

  // Graph expects dateTime in ISO format without Z when using timeZone, or full ISO with Z for UTC
  const timeZone = "UTC";
  const formatForGraph = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "");

  const attendees: Array<{ emailAddress: { address: string; name: string }; type: string }> = [
    ...interviewerEmails
      .filter((e) => e && String(e).trim())
      .map((email) => ({
        emailAddress: { address: email.trim(), name: email.trim() },
        type: "required" as const,
      })),
  ];
  if (candidateEmail && String(candidateEmail).trim()) {
    attendees.push({
      emailAddress: {
        address: String(candidateEmail).trim(),
        name: String(candidateEmail).trim(),
      },
      type: "required",
    });
  }

  const eventBody = {
    subject,
    body: body
      ? { contentType: "HTML", content: body }
      : { contentType: "HTML", content: "<p>Interview scheduled from HRMS.</p>" },
    start: {
      dateTime: formatForGraph(startDate),
      timeZone,
    },
    end: {
      dateTime: formatForGraph(endDate),
      timeZone,
    },
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    attendees,
  };

  try {
    const token = await getGraphToken();
    const url = GRAPH_EVENTS_URL(organizerEmail);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Graph API ${res.status}: ${errText.slice(0, 300)}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch {
        // use errText as-is
      }
      console.error("[teamsGraph] Create event failed:", errMsg);
      return { success: false, error: errMsg };
    }

    const event = (await res.json()) as {
      id?: string;
      onlineMeeting?: { joinUrl?: string };
      webLink?: string;
    };
    const joinUrl = event?.onlineMeeting?.joinUrl ?? event?.webLink ?? null;
    const eventId = event?.id ?? null;
    console.log("[teamsGraph] Event created", eventId, joinUrl ? "with join URL" : "no join URL");
    return {
      success: true,
      joinUrl: joinUrl || undefined,
      eventId: eventId || undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[teamsGraph] createInterviewMeeting error:", message);
    return { success: false, error: message };
  }
}

export { isTeamsIntegrationConfigured };
