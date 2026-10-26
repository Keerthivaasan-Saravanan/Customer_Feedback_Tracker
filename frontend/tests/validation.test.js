import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  EMPTY_FORM,
  fieldErrorsFromApi,
  validateFeedbackForm,
} from "../src/validation.js";

const VALID = {
  customer_name: "Priya Nair",
  customer_email: "priya.nair@example.com",
  product: "Nimbus CRM",
  rating: 4,
  category: "Suggestion",
  comments: "Please add bulk editing for contact tags.",
};

const withChanges = (changes) => ({ ...VALID, ...changes });

describe("validateFeedbackForm", () => {
  test("accepts a complete valid form", () => {
    assert.deepEqual(validateFeedbackForm(VALID), {});
  });

  test("empty form reports every required field", () => {
    const errors = validateFeedbackForm(EMPTY_FORM);
    assert.deepEqual(Object.keys(errors).sort(), [
      "category",
      "comments",
      "customer_email",
      "customer_name",
      "product",
      "rating",
    ]);
  });

  test("whitespace-only values count as empty", () => {
    const errors = validateFeedbackForm(withChanges({ customer_name: "   ", product: "\t" }));
    assert.ok(errors.customer_name);
    assert.ok(errors.product);
  });

  test("rejects malformed email addresses", () => {
    for (const email of ["plainaddress", "a@b", "two@@example.com", "spaces in@example.com"]) {
      assert.ok(validateFeedbackForm(withChanges({ customer_email: email })).customer_email, email);
    }
  });

  test("accepts common valid email shapes", () => {
    for (const email of ["a.b+tag@sub.example.co", "user_1@company.org"]) {
      assert.equal(validateFeedbackForm(withChanges({ customer_email: email })).customer_email, undefined, email);
    }
  });

  test("rating must be a whole number from 1 to 5", () => {
    for (const rating of [0, 6, 4.5, -1, NaN]) {
      assert.ok(validateFeedbackForm(withChanges({ rating })).rating, String(rating));
    }
    for (const rating of [1, 5]) {
      assert.equal(validateFeedbackForm(withChanges({ rating })).rating, undefined);
    }
  });

  test("category must be selected", () => {
    assert.ok(validateFeedbackForm(withChanges({ category: "" })).category);
  });

  test("comment length boundaries are enforced on trimmed text", () => {
    const tooShort = "x".repeat(COMMENT_MIN_LENGTH - 1);
    const exactMin = "x".repeat(COMMENT_MIN_LENGTH);
    const exactMax = "x".repeat(COMMENT_MAX_LENGTH);
    const tooLong = "x".repeat(COMMENT_MAX_LENGTH + 1);

    assert.ok(validateFeedbackForm(withChanges({ comments: tooShort })).comments);
    assert.equal(validateFeedbackForm(withChanges({ comments: exactMin })).comments, undefined);
    assert.equal(validateFeedbackForm(withChanges({ comments: exactMax })).comments, undefined);
    assert.ok(validateFeedbackForm(withChanges({ comments: tooLong })).comments);
  });

  test("padding a short comment with spaces does not make it valid", () => {
    const padded = `   ${"x".repeat(5)}   `;
    assert.ok(validateFeedbackForm(withChanges({ comments: padded })).comments);
  });

  test("name and product length limits", () => {
    assert.ok(validateFeedbackForm(withChanges({ customer_name: "n".repeat(121) })).customer_name);
    assert.ok(validateFeedbackForm(withChanges({ product: "p".repeat(121) })).product);
  });
});

describe("fieldErrorsFromApi", () => {
  test("maps server details to a field map, keeping the first message per field", () => {
    const mapped = fieldErrorsFromApi([
      { field: "rating", message: "first" },
      { field: "rating", message: "second" },
      { field: "comments", message: "too short" },
    ]);
    assert.deepEqual(mapped, { rating: "first", comments: "too short" });
  });

  test("ignores entries without a field and handles missing details", () => {
    assert.deepEqual(fieldErrorsFromApi([{ message: "no field" }]), {});
    assert.deepEqual(fieldErrorsFromApi(undefined), {});
  });
});
