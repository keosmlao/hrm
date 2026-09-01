import assert from "node:assert/strict";
import { test } from "node:test";
import { excerpt, plainText, renderInline, renderMarkdown } from "./markdown";

test("HTML ໃນເນື້ອໃນຖືກ escape — ຝັງ script ບໍ່ໄດ້", () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("ລິງ javascript: ຖືກປະຕິເສດ ເຫຼືອແຕ່ຂໍ້ຄວາມ", () => {
  const html = renderInline("[ກົດນີ້](javascript:alert(1))");
  assert.ok(!html.includes("href"));
  assert.ok(html.includes("ກົດນີ້"));
});

test("ລິງນອກເປີດແທັບໃໝ່ ແລະ ມີ rel ກັນ tabnabbing; ລິງພາຍໃນບໍ່ມີ", () => {
  const outside = renderInline("[ODIEN](https://odien.net)");
  assert.ok(outside.includes('target="_blank"'));
  assert.ok(outside.includes('rel="noopener noreferrer"'));

  const inside = renderInline("[ພະນັກງານ](/employees)");
  assert.ok(inside.includes('href="/employees"'));
  assert.ok(!inside.includes("target"));
});

test("ຕົວໜາ / ອຽງ / code ໃນແຖວ", () => {
  assert.equal(renderInline("**ສຳຄັນ**"), "<strong>ສຳຄັນ</strong>");
  assert.equal(renderInline("*ໝາຍເຫດ*"), "<em>ໝາຍເຫດ</em>");
  assert.equal(renderInline("`npm test`"), "<code>npm test</code>");
});

test("ໃນ code span ບໍ່ຖືກຕີຄວາມເປັນ markdown ຕໍ່", () => {
  assert.equal(renderInline("`**ບໍ່ໜາ**`"), "<code>**ບໍ່ໜາ**</code>");
});

test("ຫົວຂໍ້ເລີ່ມທີ່ h2 — h1 ສະຫງວນໃຫ້ຫົວຂໍ້ບົດ", () => {
  assert.equal(renderMarkdown("# ບົດນຳ"), "<h2>ບົດນຳ</h2>");
  assert.equal(renderMarkdown("## ຂັ້ນຕອນ"), "<h3>ຂັ້ນຕອນ</h3>");
});

test("ລາຍການ ແລະ ລຳດັບ ແຍກ block ກັນ", () => {
  const html = renderMarkdown("- ໜຶ່ງ\n- ສອງ\n\n1. ກ\n2. ຂ");
  assert.ok(html.includes("<ul><li>ໜຶ່ງ</li><li>ສອງ</li></ul>"));
  assert.ok(html.includes("<ol><li>ກ</li><li>ຂ</li></ol>"));
});

test("code block ຮັກສາເນື້ອໃນດິບໄວ້", () => {
  const html = renderMarkdown("```\nline 1\n  line 2\n```");
  assert.equal(html, "<pre><code>line 1\n  line 2</code></pre>");
});

test("code block ທີ່ລືມປິດ ຍັງ render ອອກ ບໍ່ຫາຍ", () => {
  assert.equal(renderMarkdown("```\nຄ້າງໄວ້"), "<pre><code>ຄ້າງໄວ້</code></pre>");
});

test("ອ້າງອີງ ແລະ ເສັ້ນຂັ້ນ", () => {
  const html = renderMarkdown("> ໝາຍເຫດ\n\n---");
  assert.ok(html.includes("<blockquote>ໝາຍເຫດ</blockquote>"));
  assert.ok(html.includes("<hr />"));
});

test("ຫຍໍ້ໜ້າຫຼາຍແຖວ ຕໍ່ດ້ວຍ <br /> ບໍ່ແມ່ນຫຍໍ້ໜ້າໃໝ່", () => {
  assert.equal(renderMarkdown("ແຖວໜຶ່ງ\nແຖວສອງ"), "<p>ແຖວໜຶ່ງ<br />ແຖວສອງ</p>");
});

test("ຂໍ້ຄວາມລ້ວນ ຕັດເຄື່ອງໝາຍ markdown ອອກ", () => {
  assert.equal(plainText("# ຫົວຂໍ້\n\n**ໜາ** ແລະ [ລິງ](/x)"), "ຫົວຂໍ້ ໜາ ແລະ ລິງ");
});

test("ຄຳອະທິບາຍຫຍໍ້ ຕັດຕາມຄວາມຍາວ ແລ້ວຕໍ່ດ້ວຍຈຸດ", () => {
  assert.equal(excerpt("ກຂຄງຈ", 10), "ກຂຄງຈ");
  assert.equal(excerpt("abcdefghijk", 5), "abcde…");
});
