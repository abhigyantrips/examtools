import JSZip from 'jszip';

// Read a ZIP file and return the JSZip instance
export async function loadZip(file: File) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  return zip;
}

// Generate a Blob for the ZIP so it can be downloaded
export async function generateZipBlob(zip: JSZip) {
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

// Read a text file from the zip (or null if not present)
export async function readTextFile(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path);
  if (!f) return null;
  try {
    const text = await f.async('string');
    return text;
  } catch (err) {
    console.warn('Failed to read text file from zip', path, err);
    return null;
  }
}

// Write a text file into the zip (overwrites if present)
export function writeTextFile(zip: JSZip, path: string, text: string) {
  try {
    zip.file(path, text);
  } catch (err) {
    console.warn('Failed to write text file to zip', path, err);
  }
}
