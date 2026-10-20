import { describe, expect, it } from "vitest";
import { parseMusicLink } from "./music";

describe("parseMusicLink", () => {
  it("handles YouTube Music playlists, songs, and youtu.be links", () => {
    expect(parseMusicLink("https://music.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&si=abc")?.embedUrl)
      .toBe("https://www.youtube.com/embed/videoseries?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&playsinline=1&rel=0&modestbranding=1");
    expect(parseMusicLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x")?.kind).toBe("song");
    expect(parseMusicLink("https://youtu.be/dQw4w9WgXcQ")?.embedUrl).toContain("/embed/dQw4w9WgXcQ");
    expect(parseMusicLink("youtube.com/watch?v=dQw4w9WgXcQ&list=PL123456")?.embedUrl).toContain("embed/dQw4w9WgXcQ?list=PL123456");
  });
  it("handles Spotify, Apple Music, and SoundCloud", () => {
    expect(parseMusicLink("https://open.spotify.com/intl-de/playlist/37i9dQZF1DX76Wlfdnj7AP?si=1")?.embedUrl).toBe("https://open.spotify.com/embed/playlist/37i9dQZF1DX76Wlfdnj7AP");
    expect(parseMusicLink("https://music.apple.com/us/playlist/pure-workout/pl.abc123")?.embedUrl).toBe("https://embed.music.apple.com/us/playlist/pure-workout/pl.abc123");
    expect(parseMusicLink("https://soundcloud.com/artist/track-name")?.service).toBe("soundcloud");
  });
  it("rejects everything else", () => {
    expect(parseMusicLink("https://example.com/playlist")).toBeNull();
    expect(parseMusicLink("not a link")).toBeNull();
    expect(parseMusicLink("https://music.youtube.com/explore")).toBeNull();
  });
});
