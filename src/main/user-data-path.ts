import { app } from "electron";
import path from "node:path";

// Chimaera keeps its own profile so it does not share the LevelDB and single-instance lock with an installed Hydra.
// Must be the first import of the entry file: later modules read the userData path when they load.
app.setName("Chimaera");
app.setPath("userData", path.join(app.getPath("appData"), "chimaera"));
