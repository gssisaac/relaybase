import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

/** Scheduled job document helpers (scheduler routes through newsletter/trigger dispatch). */
export class ScheduledJobService {
  private static instance: ScheduledJobService;

  static getInstance(): ScheduledJobService {
    if (!ScheduledJobService.instance) {
      ScheduledJobService.instance = new ScheduledJobService();
    }
    return ScheduledJobService.instance;
  }

  listDueJobs(now: Date = new Date()) {
    const data = readStudioDocument();
    return data.scheduledJobs.filter(
      (j) => j.status === "pending" && new Date(j.runAt).getTime() <= now.getTime(),
    );
  }

  mutateJobs(mutator: (draft: ReturnType<typeof readStudioDocument>) => void) {
    return mutateStudioDocument(mutator);
  }
}

export const scheduledJobService = ScheduledJobService.getInstance();
