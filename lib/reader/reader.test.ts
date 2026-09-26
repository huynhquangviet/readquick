import { describe, expect, it } from "vitest";

import { createFakeClock } from "./fake-clock";
import { createReader, type ReaderEvent } from "./reader";

function setup(
  words: string[],
  options: { sentenceStarts?: number[]; speed?: number; position?: number } = {},
) {
  const clock = createFakeClock();
  const reader = createReader({
    words,
    sentenceStarts: options.sentenceStarts ?? [0],
    speed: options.speed,
    position: options.position,
    clock,
  });
  return { clock, reader };
}

/** Records what the Reader emits, and totals the activity increments. */
function listen(reader: ReturnType<typeof setup>["reader"]) {
  const events: ReaderEvent[] = [];
  reader.subscribe((event) => events.push(event));
  return {
    events,
    positions: () =>
      events.flatMap((e) => (e.type === "position" ? [e.position] : [])),
    wordsRead: () =>
      events.reduce((sum, e) => sum + (e.type === "activity" ? e.wordsRead : 0), 0),
    playedMs: () =>
      events.reduce((sum, e) => sum + (e.type === "activity" ? e.playedMs : 0), 0),
  };
}

describe("timing", () => {
  it.each([
    { speed: 100, ms: 600 },
    { speed: 250, ms: 240 },
    { speed: 400, ms: 150 },
    { speed: 800, ms: 75 },
  ])("shows each Word for $ms ms at $speed words per minute", ({ speed, ms }) => {
    const { clock, reader } = setup(["one", "two", "three"], { speed });

    reader.play();
    clock.advance(ms - 1);
    expect(reader.position).toBe(0);
    clock.advance(1);
    expect(reader.position).toBe(1);
    clock.advance(ms);
    expect(reader.position).toBe(2);
  });
});

describe("Pause on punctuation", () => {
  // At 600 wpm the base duration is 100 ms.
  const speed = 600;

  function timeOnScreen(word: string) {
    const { clock, reader } = setup([word, "next"], { speed });
    reader.play();
    let elapsed = 0;
    while (reader.position === 0 && elapsed < 10_000) {
      clock.advance(1);
      elapsed += 1;
    }
    return elapsed;
  }

  it("shows a plain Word for the base duration", () => {
    expect(timeOnScreen("plain")).toBe(100);
  });

  it("keeps a Word ending in a comma on screen longer than the base duration", () => {
    expect(timeOnScreen("however,")).toBeGreaterThan(100);
  });

  it("keeps a Word ending a Sentence on screen longer than one ending in a comma", () => {
    expect(timeOnScreen("done.")).toBeGreaterThan(timeOnScreen("however,"));
    expect(timeOnScreen("really?")).toBeGreaterThan(timeOnScreen("however,"));
    expect(timeOnScreen("stop!")).toBeGreaterThan(timeOnScreen("however,"));
  });

  it("looks past closing quotes and brackets to the punctuation before them", () => {
    expect(timeOnScreen("done.”")).toBe(timeOnScreen("done."));
    expect(timeOnScreen("(done.)")).toBe(timeOnScreen("done."));
  });

  it("keeps a very long Word on screen longer than the base duration", () => {
    expect(timeOnScreen("internationalization")).toBeGreaterThan(100);
    expect(timeOnScreen("understand")).toBe(100);
  });

  it("does not count punctuation towards a Word being very long", () => {
    expect(timeOnScreen("hello,,,,,,,,,,,")).toBe(timeOnScreen("hello,"));
  });

  it("pauses on Vietnamese Words the same way", () => {
    expect(timeOnScreen("viên.")).toBeGreaterThan(100);
    expect(timeOnScreen("viên")).toBe(100);
  });
});

describe("Anchor letter", () => {
  function split(word: string) {
    const { reader } = setup([word]);
    const { before, anchor, after } = reader.current;
    return { before, anchor, after };
  }

  it.each([
    { word: "a", before: "", anchor: "a", after: "" },
    { word: "to", before: "", anchor: "t", after: "o" },
    { word: "read", before: "r", anchor: "e", after: "ad" },
    { word: "reading", before: "re", anchor: "a", after: "ding" },
    { word: "understanding", before: "unde", anchor: "r", after: "standing" },
  ])("picks $anchor as the Anchor letter of $word", ({ word, ...expected }) => {
    expect(split(word)).toEqual(expected);
  });

  it("always splits a Word into exactly one Anchor letter with the rest around it", () => {
    for (let length = 1; length <= 40; length++) {
      const word = "abcdefghij".repeat(4).slice(0, length);
      const { before, anchor, after } = split(word);
      expect(anchor).toHaveLength(1);
      expect(before + anchor + after).toBe(word);
      // Near the first third, so the eye lands early in the Word.
      expect(before.length).toBeLessThanOrEqual(Math.ceil(length / 3));
    }
  });

  it("picks a letter and keeps punctuation around it", () => {
    expect(split("“Hello,”")).toEqual({ before: "“H", anchor: "e", after: "llo,”" });
    expect(split("(a)")).toEqual({ before: "(", anchor: "a", after: ")" });
  });

  it("picks an Anchor letter for a Word with no letters", () => {
    expect(split("—")).toEqual({ before: "", anchor: "—", after: "" });
    expect(split("...")).toEqual({ before: "", anchor: ".", after: ".." });
  });

  it("treats accented Vietnamese letters as single letters", () => {
    expect(split("người")).toEqual({ before: "n", anchor: "g", after: "ười" });
    expect(split("nguoì")).toEqual({ before: "n", anchor: "g", after: "uoì" });
  });

  it("follows the current Word as it changes", () => {
    const { clock, reader } = setup(["read", "reading"], { speed: 600 });
    reader.play();
    clock.advance(100);
    expect(reader.current).toMatchObject({ index: 1, text: "reading", anchor: "a" });
  });
});

describe("play and pause", () => {
  it("starts paused on the given Reading position", () => {
    const { clock, reader } = setup(["a", "b", "c"], { position: 1 });
    expect(reader.position).toBe(1);
    expect(reader.playing).toBe(false);
    clock.advance(10_000);
    expect(reader.position).toBe(1);
  });

  it("stops advancing while paused and carries on from the same Word", () => {
    const { clock, reader } = setup(["a", "b", "c", "d"], { speed: 600 });
    reader.play();
    clock.advance(100);
    reader.pause();
    expect(reader.playing).toBe(false);
    clock.advance(10_000);
    expect(reader.position).toBe(1);
    reader.play();
    clock.advance(100);
    expect(reader.position).toBe(2);
  });
});

describe("end of the Document", () => {
  it("stops on the last Word once it has been shown, without looping", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 600 });
    reader.play();
    clock.advance(200);
    expect(reader.position).toBe(2);
    expect(reader.playing).toBe(true);
    clock.advance(99);
    expect(reader.playing).toBe(true);
    clock.advance(1);
    expect(reader.playing).toBe(false);
    expect(reader.ended).toBe(true);
    clock.advance(10_000);
    expect(reader.position).toBe(2);
  });

  it("does not restart when played again at the end", () => {
    const { clock, reader } = setup(["a", "b"], { speed: 600 });
    reader.play();
    clock.advance(200);
    reader.play();
    expect(reader.playing).toBe(false);
    expect(reader.position).toBe(1);
  });

  it("can be played again after seeking back", () => {
    const { clock, reader } = setup(["a", "b"], { speed: 600 });
    reader.play();
    clock.advance(200);
    reader.seek(0);
    expect(reader.ended).toBe(false);
    reader.play();
    clock.advance(100);
    expect(reader.position).toBe(1);
  });

  it("stops after the only Word of a one-Word Document", () => {
    const { clock, reader } = setup(["a"], { speed: 600 });
    reader.play();
    clock.advance(100);
    expect(reader.playing).toBe(false);
    expect(reader.position).toBe(0);
  });
});

describe("Rewind and Forward", () => {
  //             0      1     2       3     4     5    6     7
  const words = ["One", "two", "three.", "Four", "five.", "Six", "seven", "eight."];
  const sentenceStarts = [0, 3, 5];

  function at(position: number) {
    return setup(words, { sentenceStarts, position, speed: 600 });
  }

  it.each([
    { from: 1, to: 0 }, // mid-Sentence: back to the start of that Sentence
    { from: 2, to: 0 },
    { from: 4, to: 3 },
    { from: 3, to: 0 }, // on a Sentence start: back to the previous Sentence
    { from: 5, to: 3 },
    { from: 7, to: 5 },
    { from: 0, to: 0 }, // start of the Document
  ])("Rewind from Word $from lands on Word $to", ({ from, to }) => {
    const { reader } = at(from);
    reader.rewind();
    expect(reader.position).toBe(to);
  });

  it.each([
    { from: 0, to: 3 },
    { from: 1, to: 3 },
    { from: 3, to: 5 },
    { from: 4, to: 5 },
    { from: 5, to: 7 }, // last Sentence: on to the last Word
    { from: 6, to: 7 },
    { from: 7, to: 7 }, // end of the Document
  ])("Forward from Word $from lands on Word $to", ({ from, to }) => {
    const { reader } = at(from);
    reader.forward();
    expect(reader.position).toBe(to);
  });

  it("keeps going with repeated presses", () => {
    const { reader } = at(7);
    reader.rewind();
    reader.rewind();
    reader.rewind();
    expect(reader.position).toBe(0);
    reader.forward();
    reader.forward();
    reader.forward();
    reader.forward();
    expect(reader.position).toBe(7);
  });

  it("works on a Document with a single Sentence", () => {
    const { reader } = setup(["a", "b", "c"], { position: 1 });
    reader.rewind();
    expect(reader.position).toBe(0);
    reader.forward();
    expect(reader.position).toBe(2);
  });

  it("carries on playing from the new Word with a fresh display time", () => {
    const { clock, reader } = at(0);
    reader.play();
    clock.advance(50);
    reader.forward();
    expect(reader.position).toBe(3);
    clock.advance(99);
    expect(reader.position).toBe(3);
    clock.advance(1);
    expect(reader.position).toBe(4);
  });

  it("stays paused when paused", () => {
    const { clock, reader } = at(0);
    reader.forward();
    clock.advance(10_000);
    expect(reader.position).toBe(3);
    expect(reader.playing).toBe(false);
  });

  it("leaves the end of the Document so playback can resume", () => {
    const { clock, reader } = at(6);
    reader.play();
    clock.advance(300); // "seven" 100 ms, then "eight." 200 ms
    expect(reader.ended).toBe(true);
    reader.rewind();
    expect(reader.ended).toBe(false);
    expect(reader.position).toBe(5);
    reader.play();
    clock.advance(100);
    expect(reader.position).toBe(6);
  });
});

describe("Reading position events", () => {
  it("emits each new position as playback moves on", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(200);
    expect(heard.positions()).toEqual([1, 2]);
  });

  it("emits the position after Rewind, Forward and seek, but not when nothing moved", () => {
    const words = ["a", "b.", "c", "d."];
    const { reader } = setup(words, { sentenceStarts: [0, 2] });
    const heard = listen(reader);
    reader.forward();
    reader.rewind();
    reader.rewind(); // already at the start
    reader.seek(3);
    reader.seek(3);
    expect(heard.positions()).toEqual([2, 0, 3]);
  });

  it("tells when playback starts, pauses and reaches the end", () => {
    const { clock, reader } = setup(["a", "b"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    reader.pause();
    reader.play();
    clock.advance(200);
    expect(heard.events.filter((e) => e.type === "playback")).toEqual([
      { type: "playback", playing: true, ended: false },
      { type: "playback", playing: false, ended: false },
      { type: "playback", playing: true, ended: false },
      { type: "playback", playing: false, ended: true },
    ]);
  });

  it("stops emitting once unsubscribed", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 600 });
    const events: ReaderEvent[] = [];
    const unsubscribe = reader.subscribe((event) => events.push(event));
    unsubscribe();
    reader.play();
    clock.advance(200);
    expect(events).toEqual([]);
  });
});

describe("Words read and time played", () => {
  it("counts every Word shown, and the time it took, over a whole Document", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(300);
    expect(heard.wordsRead()).toBe(3);
    expect(heard.playedMs()).toBe(300);
  });

  it("emits the increments as they happen, not only at the end", () => {
    const { clock, reader } = setup(["a", "b", "c", "d"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(100);
    expect(heard.wordsRead()).toBe(2);
    expect(heard.playedMs()).toBe(100);
  });

  it("leaves paused time out of the time played", () => {
    const { clock, reader } = setup(["a", "b", "c", "d"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(70);
    reader.pause();
    clock.advance(5000);
    reader.play();
    clock.advance(20);
    reader.pause();
    expect(heard.playedMs()).toBe(90);
  });

  it("counts a Word once even when paused and resumed on it", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(30);
    reader.pause();
    reader.play();
    reader.pause();
    reader.play();
    expect(heard.wordsRead()).toBe(1);
  });

  it("counts Words shown again after a Rewind", () => {
    const words = ["a", "b.", "c", "d."];
    const { clock, reader } = setup(words, { sentenceStarts: [0, 2], speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(100 + 200 + 100); // a, b., c shown; now on d.
    expect(reader.position).toBe(3);
    expect(heard.wordsRead()).toBe(4);
    reader.rewind(); // back to the start of the second Sentence, "c"
    expect(reader.position).toBe(2);
    expect(heard.wordsRead()).toBe(5);
    clock.advance(100);
    expect(heard.wordsRead()).toBe(6); // "d." again
  });

  it("does not count Words skipped by Forward", () => {
    const words = ["a", "b", "c.", "d", "e", "f."];
    const { reader } = setup(words, { sentenceStarts: [0, 3] });
    const heard = listen(reader);
    reader.play();
    expect(heard.wordsRead()).toBe(1); // "a"
    reader.forward(); // skips "b" and "c."
    expect(reader.position).toBe(3);
    expect(heard.wordsRead()).toBe(2); // just "d" on top
  });

  it("does not count Words shown by moving while paused until playback shows them", () => {
    const words = ["a", "b.", "c", "d."];
    const { clock, reader } = setup(words, { sentenceStarts: [0, 2], speed: 600 });
    const heard = listen(reader);
    reader.forward();
    reader.seek(3);
    clock.advance(10_000);
    expect(heard.wordsRead()).toBe(0);
    expect(heard.playedMs()).toBe(0);
    reader.play();
    expect(heard.wordsRead()).toBe(1);
  });

  it("counts the time of a long-shown Word as played", () => {
    const { clock, reader } = setup(["done.", "next"], { speed: 600 });
    const heard = listen(reader);
    reader.play();
    clock.advance(200);
    expect(heard.playedMs()).toBe(200);
  });
});

describe("Speed change", () => {
  it("defaults to 250 words per minute", () => {
    const { clock, reader } = setup(["a", "b"]);
    expect(reader.speed).toBe(250);
    reader.play();
    clock.advance(240);
    expect(reader.position).toBe(1);
  });

  it("applies to the next Words when changed while paused", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 100 });
    reader.setSpeed(600);
    reader.play();
    clock.advance(100);
    expect(reader.position).toBe(1);
  });

  it("speeds up the Word on screen, counting the time it has already had", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 100 }); // 600 ms a Word
    reader.play();
    clock.advance(200);
    reader.setSpeed(200); // 300 ms a Word, 200 ms already spent
    clock.advance(99);
    expect(reader.position).toBe(0);
    clock.advance(1);
    expect(reader.position).toBe(1);
  });

  it("slows down the Word on screen, counting the time it has already had", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 600 }); // 100 ms a Word
    reader.play();
    clock.advance(50);
    reader.setSpeed(300); // 200 ms a Word, 50 ms already spent
    clock.advance(149);
    expect(reader.position).toBe(0);
    clock.advance(1);
    expect(reader.position).toBe(1);
  });

  it("moves on at once when the Word has already had longer than the new Speed gives it", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 100 });
    reader.play();
    clock.advance(500);
    reader.setSpeed(800); // 75 ms a Word
    clock.advance(0);
    expect(reader.position).toBe(1);
  });

  it("keeps Words read and time played correct across a change", () => {
    const { clock, reader } = setup(["a", "b", "c"], { speed: 100 });
    const heard = listen(reader);
    reader.play();
    clock.advance(200);
    reader.setSpeed(200);
    clock.advance(1000);
    expect(heard.wordsRead()).toBe(3);
    expect(heard.playedMs()).toBe(200 + 100 + 300 + 300);
  });

  it("stays within 100 to 800 words per minute", () => {
    const { reader } = setup(["a"]);
    reader.setSpeed(50);
    expect(reader.speed).toBe(100);
    reader.setSpeed(5000);
    expect(reader.speed).toBe(800);
    reader.setSpeed(400);
    expect(reader.speed).toBe(400);
  });
});

describe("seek", () => {
  const words = ["a", "b", "c", "d", "e"];

  it("moves to the Word while paused and stays paused", () => {
    const { clock, reader } = setup(words, { speed: 600 });
    reader.seek(3);
    expect(reader.position).toBe(3);
    expect(reader.current.text).toBe("d");
    clock.advance(10_000);
    expect(reader.position).toBe(3);
  });

  it("moves to the Word while playing and carries on from there with a fresh display time", () => {
    const { clock, reader } = setup(words, { speed: 600 });
    reader.play();
    clock.advance(50);
    reader.seek(2);
    expect(reader.position).toBe(2);
    clock.advance(99);
    expect(reader.position).toBe(2);
    clock.advance(1);
    expect(reader.position).toBe(3);
  });

  it("stays within the Document", () => {
    const { reader } = setup(words);
    reader.seek(99);
    expect(reader.position).toBe(4);
    reader.seek(-3);
    expect(reader.position).toBe(0);
  });
});

describe("a Document with no Words", () => {
  it("cannot be read", () => {
    expect(() => setup([])).toThrow(RangeError);
  });
});
