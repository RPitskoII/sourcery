import type { LeadWithActivity } from "../types/leads";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = Date.now();

function getStatusPriority(status: string): number {
  switch (status) {
    case "replied":
      return 100;
    case "meeting_scheduled":
      return 80;
    case "contacted":
    case "in_progress":
      return 60;
    case "new":
      return 40;
    case "proposal_sent":
      return 20;
    case "closed_won":
    case "closed_lost":
      return 0;
    default:
      return 40;
  }
}

function getMeetingWithinWeek(lead: LeadWithActivity): boolean {
  const meetingDate = lead.activity?.meeting_date;
  if (!meetingDate) return false;
  const t = new Date(meetingDate).getTime();
  return t >= NOW && t <= NOW + SEVEN_DAYS_MS;
}

function getNextActionApproaching(lead: LeadWithActivity): boolean {
  const d = lead.activity?.next_action_date;
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= NOW && t <= NOW + SEVEN_DAYS_MS;
}

export function sortLeadsForDemo(leads: LeadWithActivity[]): LeadWithActivity[] {
  return [...leads].sort((a, b) => {
    const statusA = a.activity?.status ?? "new";
    const statusB = b.activity?.status ?? "new";
    const priorityA = getStatusPriority(statusA);
    const priorityB = getStatusPriority(statusB);
    if (priorityA !== priorityB) return priorityB - priorityA;

    if (statusA === "meeting_scheduled" && statusB === "meeting_scheduled") {
      const meetingA = getMeetingWithinWeek(a) ? 1 : 0;
      const meetingB = getMeetingWithinWeek(b) ? 1 : 0;
      if (meetingA !== meetingB) return meetingB - meetingA;
    }

    if (
      (statusA === "contacted" || statusA === "in_progress") &&
      (statusB === "contacted" || statusB === "in_progress")
    ) {
      const approachingA = getNextActionApproaching(a) ? 1 : 0;
      const approachingB = getNextActionApproaching(b) ? 1 : 0;
      if (approachingA !== approachingB) return approachingB - approachingA;
    }

    const scoreA = a.overall_score ?? 0;
    const scoreB = b.overall_score ?? 0;
    return scoreB - scoreA;
  });
}
