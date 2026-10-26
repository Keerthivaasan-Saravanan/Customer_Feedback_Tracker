import { useEffect, useState } from "react";
import { RATING_OPTIONS, SORT_LABELS } from "../constants.js";
import Icon from "./Icon.jsx";

const SEARCH_DEBOUNCE_MS = 300;

export default function FilterBar({ filters, meta, onChange, onReset }) {
  const [searchText, setSearchText] = useState(filters.product_search);

  // Keep the input in sync when the parent resets filters.
  useEffect(() => {
    setSearchText(filters.product_search);
  }, [filters.product_search]);

  // Debounce so the API is not called on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchText !== filters.product_search) onChange("product_search", searchText);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, filters.product_search, onChange]);

  const hasActiveFilters = ["product", "product_search", "rating", "category", "status"].some(
    (key) => filters[key] !== ""
  );

  return (
    <section className="toolbar" aria-label="Filter feedback">
      <label className="field field--search">
        <span className="sr-only">Search by product name</span>
        <Icon name="search" size={16} className="field__icon" />
        <input
          type="search"
          className="input"
          placeholder="Search by product name"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          maxLength={120}
        />
      </label>

      <label className="field">
        <span className="sr-only">Product</span>
        <select className="select" value={filters.product} onChange={(e) => onChange("product", e.target.value)}>
          <option value="">All products</option>
          {(meta?.products ?? []).map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="sr-only">Category</span>
        <select className="select" value={filters.category} onChange={(e) => onChange("category", e.target.value)}>
          <option value="">All categories</option>
          {(meta?.categories ?? []).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="sr-only">Rating</span>
        <select className="select" value={filters.rating} onChange={(e) => onChange("rating", e.target.value)}>
          <option value="">Any rating</option>
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {rating} stars
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="sr-only">Sort order</span>
        <select className="select" value={filters.sort} onChange={(e) => onChange("sort", e.target.value)}>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="btn btn--ghost" onClick={onReset} disabled={!hasActiveFilters}>
        <Icon name="x" size={14} />
        Clear
      </button>
    </section>
  );
}
