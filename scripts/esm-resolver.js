import { register } from 'node:module';

register('./esm-loader.js', import.meta.url);
