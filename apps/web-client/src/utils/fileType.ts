export type FileKind =
  | 'pdf'
  | 'document'
  | 'sheet'
  | 'slides'
  | 'image'
  | 'archive'
  | 'video'
  | 'audio'
  | 'text'
  | 'file'

const EXTENSION_KINDS: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'document',
  docx: 'document',
  odt: 'document',
  rtf: 'document',
  txt: 'text',
  md: 'text',
  xls: 'sheet',
  xlsx: 'sheet',
  ods: 'sheet',
  csv: 'sheet',
  ppt: 'slides',
  pptx: 'slides',
  odp: 'slides',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  zip: 'archive',
  rar: 'archive',
  tar: 'archive',
  gz: 'archive',
  '7z': 'archive',
  mp4: 'video',
  mkv: 'video',
  mov: 'video',
  webm: 'video',
  avi: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  flac: 'audio',
}

function extensionOf(title: string): string {
  const dot = title.lastIndexOf('.')
  return dot === -1 ? '' : title.slice(dot + 1).toLowerCase()
}

function kindFromMime(mimeType: string): FileKind | null {
  const mime = mimeType.toLowerCase()
  if (!mime || mime === 'application/octet-stream') return null
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'sheet'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slides'
  if (mime.includes('word') || mime.includes('opendocument.text')) return 'document'
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) return 'archive'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/')) return 'text'
  return null
}

/** Coarse file category for badges, resolved from the MIME type with a filename-extension fallback. */
export function fileKind(title: string, mimeType: string): FileKind {
  return kindFromMime(mimeType) ?? EXTENSION_KINDS[extensionOf(title)] ?? 'file'
}