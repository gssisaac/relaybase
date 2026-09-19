import { buildStudioAnalytics } from "@services/analytics/build-studio-analytics";
import { buildStudioDashboard } from "@services/analytics/build-studio-dashboard";
import { buildDashboardSendingAggregate } from "@services/analytics/sending-aggregate";

export class AnalyticsService {
  private static instance: AnalyticsService;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  buildAnalytics() {
    return buildStudioAnalytics();
  }

  buildDashboard() {
    return buildStudioDashboard();
  }

  dashboardSendingAggregate(input: Parameters<typeof buildDashboardSendingAggregate>[0]) {
    return buildDashboardSendingAggregate(input);
  }
}

export const analyticsService = AnalyticsService.getInstance();
