// Client-side validation mirrors the backend rules. The server remains the
// source of truth; these checks give immediate, field-level feedback.

export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 500;
const NAME_MAX_LENGTH = 120;
const PRODUCT_MAX_LENGTH = 120;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const EMPTY_FORM = {
  customer_name: "",
  customer_email: "",
  product: "",
  rating: 0,
  category: "",
  comments: "",
};

export function validateFeedbackForm(values) {
  const errors = {};

  const name = values.customer_name.trim();
  if (!name) {
    errors.customer_name = "Customer name is required.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.customer_name = `Customer name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  const email = values.customer_email.trim();
  if (!email) {
    errors.customer_email = "Customer email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.customer_email = "Enter a valid email address, such as name@company.com.";
  }

  const product = values.product.trim();
  if (!product) {
    errors.product = "Product is required.";
  } else if (product.length > PRODUCT_MAX_LENGTH) {
    errors.product = `Product must be ${PRODUCT_MAX_LENGTH} characters or fewer.`;
  }

  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) {
    errors.rating = "Select a rating from 1 to 5.";
  }

  if (!values.category) {
    errors.category = "Select a category.";
  }

  const comments = values.comments.trim();
  if (!comments) {
    errors.comments = "Comments are required.";
  } else if (comments.length < COMMENT_MIN_LENGTH) {
    errors.comments = `Comments need at least ${COMMENT_MIN_LENGTH} characters (currently ${comments.length}).`;
  } else if (comments.length > COMMENT_MAX_LENGTH) {
    errors.comments = `Comments can be at most ${COMMENT_MAX_LENGTH} characters (currently ${comments.length}).`;
  }

  return errors;
}

/** Converts API error details ([{field, message}]) into a field -> message map. */
export function fieldErrorsFromApi(details = []) {
  return details.reduce((acc, { field, message }) => {
    if (field && !acc[field]) acc[field] = message;
    return acc;
  }, {});
}
