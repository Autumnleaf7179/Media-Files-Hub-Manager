import { Router, type IRouter } from "express";
import healthRouter from "./health";
import libraryRouter from "./library";
import mediaRouter from "./media";
import metadataRouter from "./metadata";
import playlistsRouter from "./playlists";
import playerRouter from "./player";
import settingsRouter from "./settings";
import searchesRouter from "./searches";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(libraryRouter);
router.use(mediaRouter);
router.use(metadataRouter);
router.use(playlistsRouter);
router.use(playerRouter);
router.use(settingsRouter);
router.use(searchesRouter);
router.use(statsRouter);

export default router;
