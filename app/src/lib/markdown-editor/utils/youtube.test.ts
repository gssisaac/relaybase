import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isYouTubeUrl,
  parseYouTubeTimeToSeconds,
  parseYouTubeUrl,
  renderYouTubeEmailCard,
  transformYouTubeEmbedsToHtml,
} from "./youtube";

describe("parseYouTubeUrl", () => {
  it("parses youtu.be short URLs with list params", () => {
    const res = parseYouTubeUrl("https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4");
    assert.ok(res);
    assert.equal(res.videoId, "g87ErJB0rh4");
    assert.equal(res.listId, "RDg87ErJB0rh4");
    assert.equal(
      res.embedUrl,
      "https://www.youtube-nocookie.com/embed/g87ErJB0rh4?list=RDg87ErJB0rh4",
    );
    assert.equal(
      res.watchUrl,
      "https://www.youtube.com/watch?v=g87ErJB0rh4&list=RDg87ErJB0rh4",
    );
    assert.equal(
      res.thumbnailUrl,
      "https://img.youtube.com/vi/g87ErJB0rh4/hqdefault.jpg",
    );
  });

  it("parses standard watch URLs with start time", () => {
    const res = parseYouTubeUrl("https://www.youtube.com/watch?v=g87ErJB0rh4&t=1m30s");
    assert.ok(res);
    assert.equal(res.videoId, "g87ErJB0rh4");
    assert.equal(res.startTime, "1m30s");
    assert.equal(
      res.embedUrl,
      "https://www.youtube-nocookie.com/embed/g87ErJB0rh4?start=90",
    );
  });

  it("parses shorts, live, and embed URLs", () => {
    assert.equal(parseYouTubeUrl("https://www.youtube.com/shorts/g87ErJB0rh4")?.videoId, "g87ErJB0rh4");
    assert.equal(parseYouTubeUrl("https://www.youtube.com/embed/g87ErJB0rh4")?.videoId, "g87ErJB0rh4");
    assert.equal(parseYouTubeUrl("https://www.youtube.com/live/g87ErJB0rh4")?.videoId, "g87ErJB0rh4");
    assert.equal(parseYouTubeUrl("https://music.youtube.com/watch?v=g87ErJB0rh4")?.videoId, "g87ErJB0rh4");
  });

  it("returns null for non-YouTube URLs", () => {
    assert.equal(parseYouTubeUrl("https://example.com/video.mp4"), null);
    assert.equal(parseYouTubeUrl(""), null);
    assert.equal(parseYouTubeUrl(null), null);
  });
});

describe("isYouTubeUrl", () => {
  it("detects valid YouTube links", () => {
    assert.equal(isYouTubeUrl("https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4"), true);
    assert.equal(isYouTubeUrl("https://www.youtube.com/watch?v=g87ErJB0rh4"), true);
    assert.equal(isYouTubeUrl("https://example.com"), false);
  });
});

describe("parseYouTubeTimeToSeconds", () => {
  it("parses seconds, minutes, and hours", () => {
    assert.equal(parseYouTubeTimeToSeconds("90"), 90);
    assert.equal(parseYouTubeTimeToSeconds("1m30s"), 90);
    assert.equal(parseYouTubeTimeToSeconds("1h2m3s"), 3723);
  });
});

describe("renderYouTubeEmailCard", () => {
  it("renders a responsive table with thumbnail and play button", () => {
    const html = renderYouTubeEmailCard(
      "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4",
      "Test Video",
    );
    assert.ok(html.includes("https://img.youtube.com/vi/g87ErJB0rh4/hqdefault.jpg"));
    assert.ok(html.includes("https://www.youtube.com/watch?v=g87ErJB0rh4&amp;list=RDg87ErJB0rh4") || html.includes("https://www.youtube.com/watch?v=g87ErJB0rh4&list=RDg87ErJB0rh4"));
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("alt=\"Test Video\""));
  });
});

describe("transformYouTubeEmbedsToHtml", () => {
  it("transforms video elements pointing to YouTube into cards", () => {
    const raw = '<video src="https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4" controls></video>';
    const transformed = transformYouTubeEmbedsToHtml(raw);
    assert.ok(transformed.includes("https://img.youtube.com/vi/g87ErJB0rh4/hqdefault.jpg"));
    assert.ok(!transformed.includes("<video"));
  });

  it("transforms image tags pointing to YouTube into cards", () => {
    const raw = '<img src="https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4" alt="My Video" />';
    const transformed = transformYouTubeEmbedsToHtml(raw);
    assert.ok(transformed.includes("https://img.youtube.com/vi/g87ErJB0rh4/hqdefault.jpg"));
    assert.ok(transformed.includes("alt=\"My Video\""));
  });

  it("leaves regular images and regular video files alone", () => {
    const img = '<img src="https://example.com/pic.png" alt="Pic" />';
    assert.equal(transformYouTubeEmbedsToHtml(img), img);

    const video = '<video src="https://example.com/clip.mp4" controls></video>';
    assert.equal(transformYouTubeEmbedsToHtml(video), video);
  });
});
