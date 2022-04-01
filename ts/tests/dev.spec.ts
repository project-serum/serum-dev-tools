import { hello_world } from "../src/index";
describe("Serum Dev Tools", () => {
  test("sample test", () => {
    expect(hello_world(2)).toBe("hello 2");
  });
});
