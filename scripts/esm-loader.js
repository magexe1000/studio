import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@capacitor/core') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export const Capacitor = globalThis.Capacitor; export const registerPlugin = (name) => globalThis.Capacitor.Plugins[name];'
    };
  }
  if (specifier === '@capacitor/app') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export const App = { addListener: () => ({ remove: async () => {} }) };'
    };
  }
  if (specifier === '@capacitor/filesystem') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export const Filesystem = { stat: async () => ({ size: 5 * 1024 * 1024, uri: "file:///mock/path/to/downloaded.apk" }), deleteFile: async () => {} };'
    };
  }
  if (specifier === '@capacitor/share') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export const Share = { share: async () => {} };'
    };
  }

  if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
    const parentUrl = context.parentURL;
    if (parentUrl) {
      const parentPath = fileURLToPath(parentUrl);
      const resolvedPath = path.resolve(path.dirname(parentPath), specifier);
      if (fs.existsSync(resolvedPath + '.js')) {
        return {
          format: 'module',
          shortCircuit: true,
          url: pathToFileURL(resolvedPath + '.js').href
        };
      }
      if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
        return {
          format: 'module',
          shortCircuit: true,
          url: pathToFileURL(path.join(resolvedPath, 'index.js')).href
        };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('data:text/javascript')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: decodeURIComponent(url.slice(21))
    };
  }

  if (url.endsWith('.json')) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: 'json' }
    });
  }

  const result = await nextLoad(url, context);
  if (url.endsWith('.js') && result.source) {
    let sourceStr = typeof result.source === 'string' ? result.source : result.source.toString('utf8');
    if (sourceStr.includes('import.meta.env')) {
      sourceStr = sourceStr.replace(/import\.meta\.env/g, '(globalThis.importMetaEnv || {})');
      return {
        ...result,
        source: sourceStr
      };
    }
  }
  return result;
}
