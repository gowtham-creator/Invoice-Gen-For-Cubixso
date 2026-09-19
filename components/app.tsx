"use client";

/**
 * The application: the invoice list, an invoice open for editing, and the
 * preview, switched by the URL hash (see router.ts).
 */

import { EditorScreen } from "./editor-screen";
import { Home } from "./home";
import { useRoute } from "./router";
import { useKeepSessionAlive } from "./session";
import { ToastProvider } from "./toast";

export default function App() {
  const [route, go, back] = useRoute();
  useKeepSessionAlive();
  return (
    <ToastProvider>
      {route.name === "home" ? (
        <Home go={go} />
      ) : (
        // Keyed by id so opening another invoice starts from its own record.
        <EditorScreen key={route.id} id={route.id} previewing={route.name === "preview"} go={go} back={back} />
      )}
    </ToastProvider>
  );
}
