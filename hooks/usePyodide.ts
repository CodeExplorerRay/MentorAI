import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    loadPyodide: any;
  }
}

export const usePyodide = () => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    let intervalId: any;

    const initPyodide = async () => {
      try {
        if (window.loadPyodide && !pyodideRef.current) {
          const pyodide = await window.loadPyodide();
          pyodideRef.current = pyodide;
          setIsReady(true);
          setIsLoading(false);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (e) {
        console.error("Failed to load Pyodide", e);
        setIsLoading(false);
      }
    };

    // Check immediately
    initPyodide();

    // Poll if script hasn't loaded yet
    intervalId = setInterval(() => {
        if (!isReady && !pyodideRef.current) {
            initPyodide();
        } else {
            clearInterval(intervalId);
        }
    }, 500);

    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [isReady]);

  const runPython = async (code: string) => {
    if (!pyodideRef.current) return { success: false, output: "Python runtime is not ready yet." };

    try {
      // Capture stdout using StringIO
      pyodideRef.current.setStdout({ batched: (msg: string) => console.log(msg) });
      
      // Wrap code to redirect stdout to a string variable
      const wrappedCode = `
import sys
from io import StringIO
old_stdout = sys.stdout
sys.stdout = mystdout = StringIO()

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(e)

sys.stdout = old_stdout
sys.stdout_content = mystdout.getvalue()
`;
      await pyodideRef.current.runPythonAsync(wrappedCode);
      const stdout = pyodideRef.current.globals.get('sys').stdout_content;
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, output: error.message || "Execution Error" };
    }
  };

  return { isReady, isLoading, runPython };
};