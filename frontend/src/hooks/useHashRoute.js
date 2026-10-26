import { useEffect, useState } from "react";

const DEFAULT_ROUTE = "/dashboard";

function readRoute() {
  const path = window.location.hash.replace(/^#/, "").split("?")[0];
  return path || DEFAULT_ROUTE;
}

/** Minimal hash router: returns the current path such as "/feedback". */
export function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
