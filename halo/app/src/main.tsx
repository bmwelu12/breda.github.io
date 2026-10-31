import { createRoot } from "react-dom/client";
import "./styles.css";
import { createApi } from "./api.ts";
import { App } from "./App.tsx";

createApi().then((api) => createRoot(document.getElementById("root")!).render(<App api={api} />));
