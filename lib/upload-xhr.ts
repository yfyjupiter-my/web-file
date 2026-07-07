// PUT a file to a signed URL while reporting upload progress.
// fetch() doesn't expose upload-progress events reliably across browsers,
// so this uses XMLHttpRequest, which does via `xhr.upload.onprogress`.

// Generous whole-request deadline so a stalled connection can't leave the
// promise pending (and the modal frozen) forever: a floor of 2 minutes plus
// time for the max upload size at a slow ~100 KB/s.
const TIMEOUT_FLOOR_MS = 2 * 60 * 1_000;
const MS_PER_BYTE = 1 / 100; // 100 KB/s ≈ 0.01 ms per byte

export function putWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<{ ok: boolean; status?: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.timeout = TIMEOUT_FLOOR_MS + Math.round(file.size * MS_PER_BYTE);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}
