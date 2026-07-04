import { Suspense, startTransition, useEffect, useState } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { store } from "@/store/store";
import RouteLoader from "./RouteLoader";

const ProvidersLayout = () => {
  const [showToaster, setShowToaster] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setShowToaster(true);
    });
  }, []);

  return (
    <ReduxProvider store={store}>
      <TooltipProvider>
        {showToaster ? <Toaster /> : null}
        <Suspense fallback={<RouteLoader />}>
          <Outlet />
        </Suspense>
      </TooltipProvider>
    </ReduxProvider>
  );
};

export default ProvidersLayout;
