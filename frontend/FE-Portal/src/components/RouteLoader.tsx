/**
 * Minimal top progress bar shown during lazy route loading.
 * Keeps it non-jarring — just a thin blue bar at the top.
 */

import { useEffect, useState } from "react";

const RouteLoader = () => {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay before showing — prevents flash on fast loads
    const showTimer = setTimeout(() => setVisible(true), 100);

    const t1 = setTimeout(() => setWidth(40), 150);
    const t2 = setTimeout(() => setWidth(70), 400);
    const t3 = setTimeout(() => setWidth(85), 800);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <div className="h-[3px] w-full bg-gray-200/50">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-r"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

export default RouteLoader;
