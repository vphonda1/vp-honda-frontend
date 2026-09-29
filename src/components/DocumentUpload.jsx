import React, { useState, useRef } from 'react'
import { compressAndConvert, formatFileSize } from '../utils/imageCompression'
import { apiPost } from '../utils/apiConfig'
import './DocumentUpload.css'

// ═══════════════════════════════════════════════════════════════
// Phase 20: दस्तावेज़ अब सीधे Cloudinary पर
// ───────────────────────────────────────────────────────────────
// पहले हर दस्तावेज़ आवेदन के अंदर ही (base64 रूप में) MongoDB में जाता था —
// एक आवेदन 1–5 MB का बन जाता था, free MongoDB भरने लगा था और हर सूची भारी थी।
// अब: फ़ोन पर compress → सीधे Cloudinary → आवेदन में सिर्फ़ link (≈100 अक्षर)।
//
// सुरक्षा जाल: नेटवर्क/Cloudinary में कोई गड़बड़ी हो तो पुराने तरीके से ही
// (base64) सुरक्षित हो जाता है — काम कभी रुकता नहीं।
// पुराने आवेदनों के base64 दस्तावेज़ पहले जैसे ही खुलते और दिखते हैं।
// ═══════════════════════════════════════════════════════════════
async function uploadToCloud(dataUrl, { applicationId, field, fileName }) {
  const { upload } = await apiPost(`/applications/${applicationId}/doc-signature`, { field })
  const form = new FormData()
  const blob = await (await fetch(dataUrl)).blob()
  form.append('file', blob, fileName || `${field}.jpg`)
  form.append('api_key', upload.apiKey)
  form.append('timestamp', String(upload.timestamp))
  form.append('signature', upload.signature)
  form.append('folder', upload.folder)
  if (upload.publicId) form.append('public_id', upload.publicId)
  if (upload.tags) form.append('tags', upload.tags)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${upload.cloudName}/auto/upload`, {
    method: 'POST', body: form
  })
  const out = await res.json()
  if (!res.ok || !out.secure_url) throw new Error(out?.error?.message || 'Cloudinary upload असफल')
  return out.secure_url
}

/**
 * Universal Document Upload Component
 * - Automatic 3-level image compression
 * - Camera + Gallery support  
 * - PDF support (no compression for PDFs)
 * - Shows preview and size info
 * 
 * Usage:
 * <DocumentUpload
 *   label="Aadhaar Card"
 *   value={formData.aadhaarPhoto}
 *   onChange={(base64) => setFormData({...formData, aadhaarPhoto: base64})}
 *   required={true}
 *   maxSizeKB={500}
 * />
 */
export default function DocumentUpload({ 
  label = 'Document',
  value = null,
  onChange,
  required = false,
  maxSizeKB = 500,
  accept = 'image/*,application/pdf',
  language = 'hi',
  hint = null,
  // Phase 20: आवेदन की ID (या उसे बनाने वाला function) — दस्तावेज़ Cloudinary पर भेजने के लिए
  applicationId = null,
  ensureApplicationId = null,
  field = 'doc'
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  
  // Cloudinary पर भेजो; न हो सके तो पुराने तरीके से (base64) सुरक्षित करो
  const saveValue = async (dataUrl, fileName) => {
    let appId = applicationId
    try {
      if (!appId && ensureApplicationId) appId = await ensureApplicationId()
    } catch { appId = null }

    if (appId) {
      try {
        setProgress(85)
        const url = await uploadToCloud(dataUrl, { applicationId: appId, field, fileName })
        onChange(url)
        return { onCloud: true }
      } catch (err) {
        console.warn('[दस्तावेज़] Cloudinary पर नहीं गया, फ़ोन में ही सुरक्षित:', err.message)
      }
    }
    onChange(dataUrl)          // सुरक्षा जाल — काम रुकना नहीं चाहिए
    return { onCloud: false }
  }

  const handleFile = async (file) => {
    if (!file) return
    
    setError('')
    setUploading(true)
    setProgress(0)
    
    try {
      // PDF? Don't compress, just convert
      if (file.type === 'application/pdf') {
        if (file.size > 2 * 1024 * 1024) {
          setError(language === 'hi' 
            ? '⚠️ PDF 2MB से बड़ी नहीं हो सकती' 
            : '⚠️ PDF cannot be larger than 2MB')
          setUploading(false)
          return
        }
        
        setProgress(40)
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('PDF पढ़ी नहीं जा सकी'))
          reader.readAsDataURL(file)
        })
        setProgress(60)
        const saved = await saveValue(dataUrl, file.name)
        setInfo({ type: 'PDF', size: file.size, compressed: false, onCloud: saved.onCloud })
        setProgress(100)
        setUploading(false)
        return
      }
      
      // Image? Compress
      if (file.type.startsWith('image/')) {
        setProgress(20)
        const result = await compressAndConvert(file, maxSizeKB)
        setProgress(80)
        
        const saved = await saveValue(result.base64, file.name)
        setInfo({
          type: 'Image',
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
          compressed: true,
          onCloud: saved.onCloud
        })
        setProgress(100)
        setUploading(false)
        
        // Log compression result
        console.log(`📦 Compressed: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${result.compressionRatio} saved)`)
        return
      }
      
      setError(language === 'hi' 
        ? '⚠️ केवल Image या PDF allowed है' 
        : '⚠️ Only Image or PDF allowed')
      setUploading(false)
    } catch (err) {
      console.error('Upload error:', err)
      setError(language === 'hi' 
        ? `❌ Error: ${err.message}` 
        : `❌ Error: ${err.message}`)
      setUploading(false)
    }
  }
  
  const handleRemove = () => {
    onChange(null)
    setInfo(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }
  
  const handleCamera = () => {
    if (cameraRef.current) cameraRef.current.click()
  }
  
  const handleGallery = () => {
    if (inputRef.current) inputRef.current.click()
  }
  
  // Check if value is set
  const hasValue = value && value.length > 0
  
  return (
    <div className="doc-upload">
      <label className="doc-upload-label">
        {label} {required && <span className="required">*</span>}
        {hasValue && <span className="badge-success">✅ Uploaded</span>}
      </label>
      
      {hint && <p className="upload-hint">💡 {hint}</p>}
      
      {/* Hidden file inputs */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFile(e.target.files[0])}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFile(e.target.files[0])}
        style={{ display: 'none' }}
      />
      
      {!hasValue && !uploading && (
        <div className="upload-buttons">
          <button type="button" onClick={handleCamera} className="upload-btn camera-btn">
            📷 {language === 'hi' ? 'फोटो खींचें' : 'Take Photo'}
          </button>
          <button type="button" onClick={handleGallery} className="upload-btn gallery-btn">
            📁 {language === 'hi' ? 'Gallery / PDF' : 'Gallery / PDF'}
          </button>
        </div>
      )}
      
      {uploading && (
        <div className="uploading-state">
          <div className="upload-progress">
            <div className="progress-fill" style={{width: `${progress}%`}}></div>
          </div>
          <p>
            {progress < 50 && (language === 'hi' ? '📷 Photo पढ़ रहा है...' : '📷 Reading photo...')}
            {progress >= 50 && progress < 80 && (language === 'hi' ? '🗜️ Compress कर रहा है...' : '🗜️ Compressing...')}
            {progress >= 80 && progress < 100 && (language === 'hi' ? '✅ Almost done...' : '✅ Almost done...')}
            {progress === 100 && '✅ Done!'}
          </p>
        </div>
      )}
      
      {error && <div className="upload-error">{error}</div>}
      
      {hasValue && !uploading && (
        <div className="upload-preview">
          {/* फ़ोटो — base64 हो या Cloudinary का link, दोनों दिखते हैं */}
          {(value.startsWith('data:image') || (/^https?:/i.test(value) && !/\.pdf($|\?)/i.test(value))) && (
            <img src={value} alt={label} className="preview-image" />
          )}

          {/* PDF */}
          {(value.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(value)) && (
            <div className="preview-pdf">
              <span className="pdf-icon">📄</span>
              <p>{language === 'hi' ? 'PDF Document Uploaded' : 'PDF Document Uploaded'}</p>
              {/^https?:/i.test(value) && (
                <a href={value} target="_blank" rel="noopener noreferrer">खोलें</a>
              )}
            </div>
          )}
          
          {/* Compression info */}
          {info && info.compressed && (
            <div className="compression-info">
              <p>📦 {language === 'hi' ? 'Compression Success' : 'Compression Success'}</p>
              <small>
                {formatFileSize(info.originalSize)} → {formatFileSize(info.compressedSize)} 
                <strong> ({info.compressionRatio} saved)</strong>
                {info.onCloud ? ' · ☁️ Cloud पर सुरक्षित' : ' · 📱 फ़ोन से भेजा जाएगा'}
              </small>
            </div>
          )}
          
          {info && !info.compressed && (
            <div className="compression-info">
              <p>📄 {language === 'hi' ? 'Original PDF' : 'Original PDF'}</p>
              <small>{formatFileSize(info.size)}</small>
            </div>
          )}
          
          <div className="upload-actions">
            <button type="button" onClick={handleRemove} className="btn-remove">
              🗑️ {language === 'hi' ? 'हटाएँ' : 'Remove'}
            </button>
            <button type="button" onClick={handleGallery} className="btn-replace">
              🔄 {language === 'hi' ? 'बदलें' : 'Replace'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}