import {generateClient} from "./client/generate-client";
import {generateShared} from "./shared/generate-shared";
import {generateServer} from "./server/generate-server";
import {generateSrcTauri} from "./src-tauri/generate-src-tauri";


generateServer();

generateShared();

generateClient();

generateSrcTauri();