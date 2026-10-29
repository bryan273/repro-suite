/* Repro Lite Pyodide worker: loads Python + scientific packages from jsDelivr and runs code. */
const PYODIDE_VERSION = '0.26.4';
const BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
importScripts(`${BASE}pyodide.js`);

let pyodideReady = null;
let out = [];
let err = [];

async function init() {
  const py = await loadPyodide({ indexURL: BASE });
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => err.push(s) });
  await py.loadPackage(['numpy', 'pandas', 'scipy', 'scikit-learn']);
  await py.runPythonAsync('import warnings\nwarnings.filterwarnings("ignore")');
  return py;
}

self.onmessage = async (e) => {
  const { type, id, code } = e.data || {};
  if (type === 'init') {
    try {
      pyodideReady = pyodideReady || init();
      await pyodideReady;
      self.postMessage({ type: 'ready' });
    } catch (ex) {
      self.postMessage({ type: 'init_error', error: String(ex && ex.message ? ex.message : ex) });
    }
    return;
  }
  if (type === 'run') {
    const py = await pyodideReady;
    out = [];
    err = [];
    const t0 = performance.now();
    let ok = true;
    try {
      await py.runPythonAsync(code);
    } catch (ex) {
      ok = false;
      err.push(String(ex && ex.message ? ex.message : ex));
    }
    self.postMessage({
      type: 'result',
      id,
      ok,
      stdout: out.join('\n'),
      stderr: err.join('\n'),
      elapsed_ms: Math.round(performance.now() - t0),
    });
  }
};
