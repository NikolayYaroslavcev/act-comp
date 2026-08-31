import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Base UI's popup/menu positioning relies on the real requestAnimationFrame.
// Repeatedly toggling vi.useFakeTimers()/vi.useRealTimers() across many tests
// (e.g. widgets/task/task-detail.test.tsx's inline-edit suite) can leave the
// restored "real" requestAnimationFrame no longer invoking its callbacks for
// the rest of the run, breaking unrelated Base UI popups in later tests.
// Excluding it (and its sibling) from the fake-timer set keeps it real always.
vi.setConfig({
  fakeTimers: {
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  },
});
