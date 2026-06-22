'use client'

import { useMemo, useRef, useState } from 'react'

type Variant = {
  id: string
  sku?: string | null
  color?: string | null
  colorHex?: string | null
  size?: string | null
  material?: string | null
  images?: string[] | null
}

type Props = {
  productId: string
  productName?: string | null
  categoryName?: string | null
  variants: Variant[]
  onVariantImagesSaved?: (variantId: string, images: string[]) => void
  onVariantImagesChanged?: (variantId: string, images: string[]) => void
}

export default function VariantImageManager({
  productId,
  productName,
  categoryName,
  variants,
  onVariantImagesSaved,
  onVariantImagesChanged,
}: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId]
  )

  function emitImages(variantId: string, images: string[]) {
    onVariantImagesSaved?.(variantId, images)
    onVariantImagesChanged?.(variantId, images)
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || !selectedVariantId) return
    setBusy(true)

    try {
      const urls: string[] = []

      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)

        const uploadRes = await fetch('/api/admin/uploads', {
          method: 'POST',
          body: fd,
        })

        if (!uploadRes.ok) {
          throw new Error('Upload failed')
        }

        const uploadJson = await uploadRes.json()
        if (!uploadJson?.url) {
          throw new Error('Upload did not return url')
        }

        urls.push(uploadJson.url)
      }

      const saveRes = await fetch(
        `/api/admin/products/${productId}/variants/${selectedVariantId}/images`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: urls,
            mode: 'append',
          }),
        }
      )

      if (!saveRes.ok) {
        throw new Error('Saving variant images failed')
      }

      const saveJson = await saveRes.json()
      emitImages(selectedVariantId, saveJson.images ?? [])
    } catch (err) {
      console.error(err)
      alert('Variant image upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeImage(url: string) {
    if (!selectedVariantId) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/variants/${selectedVariantId}/images`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: url }),
        }
      )
      if (!res.ok) throw new Error('Delete failed')

      const json = await res.json()
      emitImages(selectedVariantId, json.images ?? [])
    } catch (err) {
      console.error(err)
      alert('Failed to remove image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Variant Images</h3>
          {(productName || categoryName) && (
            <p className="text-sm text-neutral-500">
              {[productName, categoryName].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>

        <select
          className="rounded border px-3 py-2"
          value={selectedVariantId}
          onChange={(e) => setSelectedVariantId(e.target.value)}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.sku || v.id}
              {v.color ? ` • ${v.color}` : ''}
              {v.size ? ` • ${v.size}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => uploadFiles(e.target.files)}
          disabled={busy || !selectedVariantId}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(selectedVariant?.images ?? []).map((url) => (
          <div key={url} className="rounded border p-2">
            <img src={url} alt="" className="h-32 w-full rounded object-cover" />
            <button
              type="button"
              className="mt-2 w-full rounded bg-red-600 px-3 py-2 text-sm text-white"
              onClick={() => removeImage(url)}
              disabled={busy}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {!selectedVariant?.images?.length && (
        <p className="text-sm text-neutral-500">No images for this variant yet.</p>
      )}
    </div>
  )
}