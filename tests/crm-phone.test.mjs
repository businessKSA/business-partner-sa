import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCrmPhone, phoneFromNotes } from "../api/_phone.js";

test("Saudi spellings collapse to +9665XXXXXXXX", () => {
  for (const raw of ["0501234567", "501234567", "966501234567", "+966501234567", "00966501234567", "+966 50 123 4567", "05-0123-4567"]) {
    assert.equal(normalizeCrmPhone(raw), "+966501234567", raw);
  }
});

test("non-Saudi and empty input are kept, never invented", () => {
  assert.equal(normalizeCrmPhone(""), "");
  assert.equal(normalizeCrmPhone(null), "");
  assert.equal(normalizeCrmPhone("abc"), "");
  assert.equal(normalizeCrmPhone("+44 7700 900123"), "+44 7700 900123");
});

test("phoneFromNotes reads the buried number and ignores an empty label", () => {
  assert.equal(phoneFromNotes("قناة: المستشار (الموقع) · أحمد · الجوال: 0501234567\n🧑 الزائر: مرحبا"), "+966501234567");
  assert.equal(phoneFromNotes("الجوال:  · البريد: a@b.co"), "");
  assert.equal(phoneFromNotes("الجوال: 12345 · x"), "");
  assert.equal(phoneFromNotes("no label 0501234567"), "");
});
