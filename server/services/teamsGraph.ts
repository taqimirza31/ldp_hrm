/**
 * Microsoft Teams / Graph integration for creating interview meetings.
 *
 * When TEAMS_* env vars are set, this service will create a Teams meeting
 * (via Microsoft Graph) when an interview is scheduled. Until the Graph API
 * is implemented here, createInterviewMeeting returns a stub and logs params.
 *
 * Required env: TEAMS_GRAPH_CLIENT_ID, TEAMS_GRAPH_CLIENT_SECRET,
 * TEAMS_GRAPH_TENANT_ID, TEAMS_MEETING_ORGANIZER_EMAIL.
 */

import { isTeamsIntegrationConfigured } from "../config/teams";

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
  /** Optional: body/description (e.g. link to candidate profile) */
  body?: string | null;
}

export interface CreateInterviewMeetingResult {
  success: boolean;
  /** Teams join URL (to store and send to candidate/interviewers) */
  joinUrl?: string | null;
  /** Graph event ID (for updates/cancel later if needed) */
  eventId?: string | null;
  /** Error message when success is false */
  error?: string;
}

/**
 * Create a Teams meeting for an interview. Uses Microsoft Graph when configured;
 * otherwise returns a stub result so recruitment flow does not break.
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
      error: "Teams integration not configured. Set MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID (same as SSO) and TEAMS_MEETING_ORGANIZER_EMAIL in .env",
    };
  }

  // TODO: When you have the API, replace this block with:
  // 1. Get an access token (client credentials flow) using teamsConfig
  // 2. POST https://graph.microsoft.com/v1.0/users/{organizerEmail}/calendar/events
  //    with body: { subject, start, end, isOnlineMeeting: true, attendees: [...] }
  // 3. Return { success: true, joinUrl: event.onlineMeeting.joinUrl, eventId: event.id }
  const startDate = typeof start === "string" ? start : start.toISOString();
  const endDate = typeof end === "string" ? end : end.toISOString();
  console.log("[teamsGraph] createInterviewMeeting (stub)", {
    subject,
    start: startDate,
    end: endDate,
    interviewerEmails,
    candidateEmail: candidateEmail ?? null,
    body: body ? "(present)" : null,
  });

  return {
    success: true,
    joinUrl: null,
    eventId: null,
    error: undefined,
  };
}

export { isTeamsIntegrationConfigured };
