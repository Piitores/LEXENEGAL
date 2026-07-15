// Config Remotion — vidéo promotionnelle (voir remotion/STORYBOARD.md).
// Ce fichier est hors du build Vite/Vercel (tsconfig n'inclut que src/).
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('remotion/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
