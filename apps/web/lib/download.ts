/** Saves a base64 file returned by the API (payouts.export, purchases.receipt) through the browser. */
export function downloadBase64File(file: { filename: string; mimeType: string; base64: string }) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: file.mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
