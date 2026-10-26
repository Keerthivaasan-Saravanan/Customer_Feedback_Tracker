// Shared UI constants. Business rules mirror the backend so the UI only offers valid actions.

export const NEXT_STATUS = {
  New: "Reviewed",
  Reviewed: "Resolved",
  Resolved: null,
};

export const ACTION_LABELS = {
  Reviewed: "Mark as reviewed",
  Resolved: "Mark as resolved",
};

export const STATUS_STEPS = ["New", "Reviewed", "Resolved"];

export const RATING_OPTIONS = [5, 4, 3, 2, 1];

export const SORT_LABELS = {
  newest: "Newest first",
  oldest: "Oldest first",
  rating_high: "Highest rating",
  rating_low: "Lowest rating",
};

export const PAGE_SIZES = [10, 25, 50];

export const INITIAL_FILTERS = {
  product: "",
  product_search: "",
  rating: "",
  category: "",
  status: "",
  sort: "newest",
};

export const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "grid" },
  { path: "/feedback", label: "Feedback", icon: "list" },
  { path: "/submit", label: "Submit feedback", icon: "plus" },
];

export const CATEGORY_COLORS = {
  Bug: "#b42318",
  Suggestion: "#2563a8",
  Compliment: "#2f7d4f",
  Other: "#6b7785",
};

export const STATUS_COLORS = {
  New: "#2563a8",
  Reviewed: "#6a4fb0",
  Resolved: "#2f7d4f",
};
