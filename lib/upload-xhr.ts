// PUT a file to a signed URL while reporting upload progress.
// fetch() doesn't expose upload-progress events reliably across browsers,
// so this uses XMLHttpRequest, which does via `xhr.upload.onprogress`.
export function putWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 });
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}
