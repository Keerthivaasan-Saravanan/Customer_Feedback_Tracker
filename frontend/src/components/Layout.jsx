import { NAV_ITEMS } from "../constants.js";
import Icon from "./Icon.jsx";

export default function Layout({ route, title, subtitle, actions, children }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#/dashboard">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="message" size={18} />
          </span>
          <span className="brand__text">
            <strong>Feedback Tracker</strong>
            <small>Customer insights</small>
          </span>
        </a>

        <nav className="nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = route === item.path;
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                className={`nav__link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <Icon name="shield" size={16} />
          <div>
            <strong>Local data store</strong>
            <small>Records saved to JSON on the server</small>
          </div>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div className="topbar__titles">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar__actions">{actions}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
