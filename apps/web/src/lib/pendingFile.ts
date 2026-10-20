let pendingFile: File | null = null;

export function setPendingFile(file: File) {
  pendingFile = file;
}

export function takePendingFile(): File | null {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
