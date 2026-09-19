import {
  recordTrackingClick,
  recordTrackingOpen,
  TRACKING_PIXEL_GIF,
} from "@services/tracking/record";
import {
  recordAutomationTrackingClick,
  recordAutomationTrackingOpen,
} from "@services/tracking/trigger-record";
import { resolveSafeRedirectTarget } from "@services/tracking/redirect";

export class TrackingService {
  private static instance: TrackingService;

  static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }

  recordNewsletterOpen(newsletterId: string, recipientId: string) {
    return recordTrackingOpen(newsletterId, recipientId);
  }

  recordNewsletterClick(newsletterId: string, recipientId: string, url: string) {
    return recordTrackingClick(newsletterId, recipientId, url);
  }

  recordTriggerOpen(triggerId: string, triggerSendId: string) {
    return recordAutomationTrackingOpen(triggerId, triggerSendId);
  }

  recordTriggerClick(
    triggerId: string,
    triggerSendId: string,
    url: string,
  ) {
    return recordAutomationTrackingClick(triggerId, triggerSendId, url);
  }

  safeRedirectTarget(raw: string) {
    return resolveSafeRedirectTarget(raw);
  }

  get trackingPixelGif() {
    return TRACKING_PIXEL_GIF;
  }
}

export const trackingService = TrackingService.getInstance();
