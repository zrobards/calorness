import { describe, expect, it } from "vitest";
import { matchScore, rankMatches } from "./match";

const db = [
  { name: "Chobani Flip Strawberry Cheesecake 4-4.5 Oz", brand: "Chobani", calories: 160 },
  { name: "Chobani Flip Cookies & Cream 4-4.5 Oz", brand: "Chobani", calories: 150 },
  { name: "Greek Yogurt", brand: "Ocean Spray", calories: 140 },
  { name: "Strawberry Cheesecake Ice Cream", brand: "Ben & Jerry's", calories: 270 },
];

describe("matchScore", () => {
  it("scores the right flavor highest", () => {
    const ranked = rankMatches({ brand: "Chobani", product: "Chobani Flip Strawberry Cheesecake" }, db);
    expect(ranked[0].c.name).toContain("Strawberry Cheesecake");
    expect(ranked[0].score).toBeGreaterThan(0.75);
  });

  it("penalizes the wrong brand", () => {
    const right = matchScore({ brand: "Chobani", product: "Strawberry Cheesecake" }, db[0]);
    const wrong = matchScore({ brand: "Chobani", product: "Strawberry Cheesecake" }, db[3]);
    expect(right).toBeGreaterThan(wrong);
  });

  it("drops weak matches", () => {
    expect(rankMatches({ brand: "Quest", product: "Quest Protein Bar Birthday Cake" }, db)).toEqual([]);
  });
});
